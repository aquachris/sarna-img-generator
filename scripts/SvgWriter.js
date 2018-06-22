module.exports = (function () {
	'use strict';

	var fs = require('fs');
	var Delaunator = require('Delaunator');
	var Observable = require('./Observable.js');
	var InfluenceMap = require('./InfluenceMap.js');
	var VoronoiBorder = require('./VoronoiBorder.js');

	/**
	 * An instance of this class writes SVG files on demand, using the given
	 * base map and the desired center coordinates and bounds.
	 */
	var SvgWriter = function (logger, baseDir) {
		this.parent.call(this);
		this.baseDir = baseDir || '.';
		this.logger = logger;
	};

	SvgWriter.prototype = Object.create(Observable.prototype);
    SvgWriter.prototype.constructor = SvgWriter;
    SvgWriter.prototype.parent = Observable;

	/**
	 * Create an SVG file
	 *
	 * @param systems {Array} The array containing all systems
	 * @param focusedSystemIdx {int} Focused system's index in the systems array
	 */
	SvgWriter.prototype.writeSvg = function (systems, factions, focusedSystemIdx, displayedYear) {
		var focusedSystem = systems[focusedSystemIdx];
		var filename = this.baseDir + '/output/' + focusedSystem.name + '_' + displayedYear + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var faction, factionColor;
		var svgMarkup = '';

		// jump radius circles
		svgMarkup += '<circle cx="'+focusedSystem.x+'" cy="'+(-focusedSystem.y)+'" r="30" class="jump-radius" />';
		svgMarkup += '<circle cx="'+focusedSystem.x+'" cy="'+(-focusedSystem.y)+'" r="60" class="jump-radius" />';
		//svgMarkup += '<text x="'+focusedSystem.x+'" y="'+(-focusedSystem.y)+'"><textPath xlink:href="#jump-circle-30">30 LY</textPath></text>';

		// iterate over all systems and paint them if they are within the bounds of the displayed rectangle
		for(var i = 0, len = systems.length; i < len; i++) {
			if(!this.systemIsVisible(systems[i], focusedSystem.x - 70, -focusedSystem.y - 70, 140, 140)) {
				continue;
			}
			faction = factions[systems[i]['3025']];
			if(faction) {
				factionColor = factions[systems[i]['3025']].color;
			} else {
				factionColor = '#fff';
			}
			svgMarkup += '<circle class="system '+systems[i]['3025'].toLowerCase()+'" cx="'+systems[i].x+'" cy="'+(-systems[i].y)+'" r=".75" style="fill:'+factionColor+'" />\n';
			svgMarkup += '<text class="system-name '+systems[i]['3025']+'" x="'+systems[i].x+'" y="'+(-systems[i].y)+'" dx="1.5" dy="1">'+systems[i].name+'</text>';
		}

		tpl = tpl.replace('{WIDTH}', '550');
		tpl = tpl.replace('{HEIGHT}', '550');
		tpl = tpl.replace('{VIEWBOX}', (focusedSystem.x - 70) + ',' + (-focusedSystem.y - 70) + ', 140, 140');
		tpl = tpl.replace('{ELEMENTS}', svgMarkup);

		// make filename safe
		filename = filename.replace(/[\+\s\(\)]/g, '_');

		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};



	SvgWriter.prototype.writeSvgAllSystems = function (systems) {
		var name = 'all';
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var systemCircles = '';
		var fill;
		var borderSystems = [];
		var curSystem, curNeighbor;
		var curAffiliation, curNeighborAffiliation;

		for(var i = 0, len = systems.length; i < len; i++) {
			curSystem = systems[i];
			curAffiliation = curSystem['3025'].trim() || '';
			curAffiliation = curAffiliation.split(',')[0];
			if(curAffiliation === '' || curAffiliation === 'U' || curAffiliation === 'I' || curAffiliation === 'A') {
				continue;
			}
			// go through system's neighbors
			for(var j = 0, jlen = curSystem.neighbors.length; j < jlen; j++) {
				curNeighbor = systems[curSystem.neighbors[j]];
				curNeighborAffiliation = curNeighbor['3025'].trim() || '';
				curNeighborAffiliation = curNeighborAffiliation.split(',')[0];
				if(curNeighborAffiliation === '' || curNeighborAffiliation === 'U' || curNeighborAffiliation === 'I' || curNeighborAffiliation === 'A') {
					continue;
				}
				if(curAffiliation !== curNeighborAffiliation) {
					this.logger.log(curSystem.name + ': ' + curAffiliation + ' vs. ' + curNeighbor.name + ': ' + curNeighborAffiliation);
					borderSystems.push(curSystem);
					break;
				}
			}
		}


			/*if(systems[i]['3025'].startsWith('FS')) {
				fill = '#ffaa00';
			} else {
				fill = '#000000';
			}*/
			// mirror y coordinates
		for(var i = 0, len = borderSystems.length; i < len; i++) {
			fill = '#000000';
			systemCircles += '<circle data-name="'+borderSystems[i].name+'" cx="' + borderSystems[i].x + '" cy="' + (-borderSystems[i].y) + '" r="2" fill="'+fill+'" />\n';
		}
		tpl = tpl.replace('{WIDTH}', '700');
		tpl = tpl.replace('{HEIGHT}', '700');
		tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		tpl = tpl.replace('{ELEMENTS}', systemCircles);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	SvgWriter.prototype.writeSvgBorders = function (systems) {
		var infMap = new InfluenceMap(this.logger).init(-700, -700, 1400, 1400, 20);

		var name = 'borders';
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var cellOrigin, red, blue, green, fill;
		var curSystem;
		var curAffiliation;
		var systemsString = '';
		var cellString = '';

		for(var i = 0, len = systems.length; i < len; i++) {
			curSystem = systems[i];
			curAffiliation = curSystem['3025'].trim() || '';
			curAffiliation = curAffiliation.split(',')[0];
			fill = '#aaa';
			if(curAffiliation === 'DC') {
				infMap.addInfluencer(curSystem.name, curSystem.x, -curSystem.y, 1);
				fill = '#000';
			}
			systemsString += '<circle data-name="'+curSystem.name+'" cx="'+curSystem.x+'" cy="'+(-curSystem.y)+'" r="3" style="stroke-width: 0; fill: '+fill+';" />\n';
		}

		for(var idx = 0, len = infMap.cells.length; idx < len; idx++) {
			red = 255;
			blue = Math.min(255, Math.max(0, Math.floor(255 - infMap.cells[idx] * 255)));
			green = blue;
			fill = 'rgba('+red+', '+green+', '+blue+')';
			cellOrigin = infMap.getCellOrigin(idx);
			if(blue === 255) {
				continue;
			}
			cellString += '<rect data-idx="'+idx+'" x="'+cellOrigin.x+'" y="'+cellOrigin.y+'" width="'+infMap.cellSize+'" height="'+infMap.cellSize+'" style="fill:'+fill+'; stroke: #000000; stroke-width: 0;" />\n';
		}

		tpl = tpl.replace('{WIDTH}', '700');
		tpl = tpl.replace('{HEIGHT}', '700');
		tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		tpl = tpl.replace('{ELEMENTS}', cellString + systemsString);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	SvgWriter.prototype.writeSvgDelaunay = function (systems) {
		var name = 'delaunay';
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var curSystem, curAff, curTri, curPoint, curCentroid, curD;
		var systemsString = '';
		var trianglesString = '';
		var voronoiString = '';
		var points = [];
		var adjacentTriIndices = []; // array of the same size as points
		var centroids = [];

		for(var i = 0, len = systems.length; i < len; i++) {
			curAff = systems[i]['3025'].trim();
			curAff = curAff.split(',')[0];
			if(curAff === '' || curAff === 'U' || curAff === 'I' || curAff === 'A') {
				continue;
			}
			points.push([
				systems[i].x,
				systems[i].y
			]);
			adjacentTriIndices.push([]);
			systemsString += '<circle cx="'+systems[i].x+'" cy="'+(-systems[i].y)+'" r="3" style="fill: #000; stroke-width: 0;" />\n';
		}

		var delaunay = Delaunator.from(points);
		var voronoiNodes = [];

		for(var i = 0, len = delaunay.triangles.length; i < len; i += 3) {
			curCentroid = {
				x: 0,
				y: 0,
				p1: delaunay.triangles[i],
				p2: delaunay.triangles[i+1],
				p3: delaunay.triangles[i+2]
			};
			curPoint = points[delaunay.triangles[i]];
			adjacentTriIndices[delaunay.triangles[i]].push(i);
			curD = 'M' + curPoint[0] + ',' + (-curPoint[1]);
			curCentroid.x += curPoint[0];
			curCentroid.y += curPoint[1];
			curPoint = points[delaunay.triangles[i+1]];
			adjacentTriIndices[delaunay.triangles[i+1]].push(i);
			curD += ' L' + curPoint[0] + ',' + (-curPoint[1]);
			curCentroid.x += curPoint[0];
			curCentroid.y += curPoint[1];
			curPoint = points[delaunay.triangles[i+2]];
			adjacentTriIndices[delaunay.triangles[i+2]].push(i);
			curD += ' L' + curPoint[0] + ',' + (-curPoint[1]);
			curCentroid.x += curPoint[0];
			curCentroid.y += curPoint[1];
			trianglesString += '<path d="'+curD+'" style="fill: none; stroke: #f00; stroke-width: 1px;" />';
			curCentroid.x /= 3;
			curCentroid.y /= 3;
			centroids.push(curCentroid);
		}

		var triIdx, neighborCentroids;
		for(var i = 0, len = centroids.length; i < len; i++) {
			curCentroid = centroids[i];
			voronoiString += '<circle cx="'+curCentroid.x+'" cy="'+(-curCentroid.y)+'" r="2" style="fill: #00c; stroke-width: 0;" />\n';
			// for the given centroid / triangle, find all (three) adjacent triangles:
			triIdx = i*3;
			//adjacentTriIndices[triIdx];
			//adjacentTriIndices[triIdx+1];
			//adjacentTriIndices[triIdx+2];
			neighborCentroids = [];
			for(var t1p = 0; t1p < adjacentTriIndices[curCentroid.p1].length; t1p++) {
				if(adjacentTriIndices[curCentroid.p1][t1p] === triIdx) {
					continue;
				}
				for(var t2p = 0; t2p < adjacentTriIndices[curCentroid.p2].length; t2p++) {
					if(adjacentTriIndices[curCentroid.p2][t2p] === triIdx) {
						continue;
					}
					if(adjacentTriIndices[curCentroid.p1][t1p] === adjacentTriIndices[curCentroid.p2][t2p]) {
						neighborCentroids.push(adjacentTriIndices[curCentroid.p1][t1p] / 3);
					}
				}
				for(var t3p = 0; t3p < adjacentTriIndices[curCentroid.p3].length; t3p++) {
					if(adjacentTriIndices[curCentroid.p3][t3p] === triIdx) {
						continue;
					}
					if(adjacentTriIndices[curCentroid.p1][t1p] === adjacentTriIndices[curCentroid.p3][t3p]) {
						neighborCentroids.push(adjacentTriIndices[curCentroid.p1][t1p] / 3);
					}
				}
			}
			for(var t2p = 0; t2p < adjacentTriIndices[curCentroid.p2].length; t2p++) {
				if(adjacentTriIndices[curCentroid.p2][t2p] === triIdx) {
					continue;
				}
				for(var t3p = 0; t3p < adjacentTriIndices[curCentroid.p3].length; t3p++) {
					if(adjacentTriIndices[curCentroid.p3][t3p] === triIdx) {
						continue;
					}
					if(adjacentTriIndices[curCentroid.p2][t2p] === adjacentTriIndices[curCentroid.p3][t3p]) {
						neighborCentroids.push(adjacentTriIndices[curCentroid.p2][t2p] / 3);
					}
				}
			}

			// paint lines to neighboring centroids
			for(var j = 0; j < neighborCentroids.length; j++) {
				curD = 'M' + curCentroid.x + ',' + (-curCentroid.y) + ' L';
				curD += centroids[neighborCentroids[j]].x + ',' + (-centroids[neighborCentroids[j]].y);
				voronoiString += '<path d="'+curD+'" style="stroke: #0c0; stroke-width: 1px;" />\n';
			}
		}

		tpl = tpl.replace('{WIDTH}', '700');
		tpl = tpl.replace('{HEIGHT}', '700');
		tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		tpl = tpl.replace('{ELEMENTS}', trianglesString + voronoiString + systemsString);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	SvgWriter.prototype.writeSvgVoronoi = function (systems) {
		var name = 'voronoi';
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var curSys, curAff;
		var parsedSystems = [];
		var vBorder;
		var borderNodes;
		var curD;
		var voronoiString = '';

		for(var i = 0, len = systems.length; i < len; i++) {
			curSys = systems[i];
			curAff = (curSys['3025'] || '').trim().split(',')[0];
			if(curAff === '' || curAff === 'U' || curAff === 'I' || curAff === 'A') {
				continue;
			}
			parsedSystems.push({
				x : curSys.x,
				y : curSys.y,
				col : curAff
			});
		}
		parsedSystems.sort(function (a, b) {
			if(a.x < b.x) {
				return -1;
			} else if(a.x > b.x) {
				return 1;
			} else if(a.y < b.y) {
				return -1;
			} else if(a.y > b.y) {
				return 1;
			} else {
				return 0;
			}
		});

		vBorder = new VoronoiBorder(this.logger).init(parsedSystems);
		borderNodes = vBorder.getBorderPointsForColor('DC');
		console.log(borderNodes.length, borderNodes[0]);

		curD = '';
		var curNN;
		for(var i = 0, len = vBorder.nodes.length; i < len; i++) {
			curD = 'M' + vBorder.nodes[i].x.toFixed(2) + ',' + (-vBorder.nodes[i].y).toFixed(2);
			for(var ni = 0; ni < vBorder.nodes[i].neighborNodes.length; ni++) {
				curNN = vBorder.nodes[vBorder.nodes[i].neighborNodes[ni]];
				voronoiString += '<path d="'+curD+' L'+curNN.x.toFixed(2)+','+(-curNN.y).toFixed(2)+'" style="stroke:#aaf;stroke-width:2px;fill:none;" />\n';
			}
		}

		curD = '';
		for(var i = 0, len = borderNodes[0].length; i < len; i++) {
			if(i === 0) {
				curD += 'M';
			} else {
				curD += 'L';
			}
			curD += borderNodes[0][i].x.toFixed(2) + ',' + (-borderNodes[0][i].y).toFixed(2) + ' ';
		}
		voronoiString += '<path d="' + curD + '" style="stroke:#f00;stroke-width:2px;fill:none;" />\n';

		curD = '';
		for(var i = 0, len = borderNodes[1].length; i < len; i++) {
			if(i === 0) {
				curD += 'M';
			} else {
				curD += 'L';
			}
			curD += borderNodes[1][i].x.toFixed(2) + ',' + (-borderNodes[1][i].y).toFixed(2) + ' ';
		}
		voronoiString += '<path d="' + curD + '" style="stroke:#fa0;stroke-width:2px;fill:none;" />\n';

		curD = '';
		for(var i = 0, len = borderNodes[2].length; i < len; i++) {
			if(i === 0) {
				curD += 'M';
			} else {
				curD += 'L';
			}
			curD += borderNodes[2][i].x.toFixed(2) + ',' + (-borderNodes[2][i].y).toFixed(2) + ' ';
		}
		voronoiString += '<path d="' + curD + '" style="stroke:#0c0;stroke-width:2px;fill:none;" />\n';

		var fill = '';
		for(var i = 0, len = parsedSystems.length; i < len; i++) {
			fill = '#aaa';
			if(parsedSystems[i].col === 'DC') {
				fill = '#a00';
			}
			voronoiString += '<circle cx="' + parsedSystems[i].x + '" cy="' + (-parsedSystems[i].y) + '" r="2" style="stroke-width: 0; fill: '+fill+'" />\n';
		}

		tpl = tpl.replace('{WIDTH}', '700');
		tpl = tpl.replace('{HEIGHT}', '700');
		tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		tpl = tpl.replace('{ELEMENTS}', voronoiString);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	/**
	 * @returns {boolean} true if the system's coordinates are within the bounds of the given rectangle
	 * @private
	 */
	SvgWriter.prototype.systemIsVisible = function (system, x, y, w, h) {
		return system.x >= x
				&& system.x <= x + w
				&& -system.y >= y
				&& -system.y <= y + h;
	};

	return SvgWriter;

})();
