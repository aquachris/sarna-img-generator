module.exports = (function () {
	'use strict';

	var fs = require('fs');
	var Delaunator = require('Delaunator');
	var Observable = require('./Observable.js');
	var InfluenceMap = require('./InfluenceMap.js');
	var VoronoiBorder = require('./VoronoiBorder.js');
	var Utils = require('./Utils.js');

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
			if(!this.pointIsVisible(systems[i], focusedSystem.x - 70, focusedSystem.y - 70, 140, 140)) {
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
		var stroke;

		for(var i = 0, len = systems.length; i < len; i++) {
			curSys = systems[i];
			curAff = (curSys['3025'] || '').trim().split(',')[0];
			if(curAff === '' || curAff === 'U' || curAff === 'I' || curAff === 'A') {
				continue;
			}
			parsedSystems.push({
				x : curSys.x,
				y : curSys.y,
				col : curAff,
				name : curSys.name
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
		/*borderNodes = vBorder.getBorderPointsForColor('DC');
		console.log(borderNodes.length, borderNodes[0]);*/

		curD = '';
		var curNN;
		// paint voronoi cells
		/*for(var i = 0, len = vBorder.nodes.length; i < len; i++) {
			curD = 'M' + vBorder.nodes[i].x.toFixed(2) + ',' + (-vBorder.nodes[i].y).toFixed(2);
			for(var ni = 0; ni < vBorder.nodes[i].neighborNodes.length; ni++) {
				curNN = vBorder.nodes[vBorder.nodes[i].neighborNodes[ni]];
				voronoiString += '<path d="'+curD+' L'+curNN.x.toFixed(2)+','+(-curNN.y).toFixed(2)+'" style="stroke:#aaf;stroke-width:2px;fill:none;" />\n';
			}
		}*/


		/*for(var i = 0, len = borderEdges.length; i < len; i++) {
			stroke = '#0c0';
			if(borderEdges[i].isFirstInLoop) {
				stroke = '#fc0';
			}
			curD = 'M'+(borderEdges[i].x1+3)+','+(-borderEdges[i].y1)+' L'+(borderEdges[i].x2+3)+','+(-borderEdges[i].y2);
			voronoiString += '<path data-id="'+borderEdges[i].id+'" d="'+curD+'" style="stroke:'+stroke+';stroke-width:2px;fill:none;" />\n';
		}*/
		//console.log(borderEdges);

		//curD = 'M'+borderEdges[0].x1.toFixed(2)+','+(-borderEdges[0].y1).toFixed(2);
		var factionColors = {
			'DC': { stroke: '#a00', fill: 'rgba(255,20,20,.3)' },
			'LC': { stroke: '#00a', fill: 'rgba(20, 20, 220, .3)' },
			'CC': { stroke: '#0a0', fill: 'rgba(20, 220, 20, .3)' },
			'FS': { stroke: '#fc0', fill: 'rgba(255, 200, 20, .3)' },
			'FWL': { stroke: '#c3f', fill: 'rgba(220, 50, 255, .3)' },
			'D': { stroke: '#f00', fill: 'rgba(255, 0, 0, .5)' }
		};

		for(var faction in factionColors) {
			var borderEdges = vBorder.borderEdges[faction];
			curD = '';
			for(var i = 0, len = borderEdges.length; i < len; i++) {
				if(borderEdges[i].isFirstInLoop) {
					curD += ' M'+borderEdges[i].x1.toFixed(2)+','+(-borderEdges[i].y1).toFixed(2);
				}
				curD += ' L' + borderEdges[i].x2.toFixed(2)+','+(-borderEdges[i].y2).toFixed(2);
			}
			voronoiString += '<path fill-rule="evenodd" d="'+curD+'" ';
			voronoiString += 'style="stroke:'+factionColors[faction].stroke + ';stroke-width:2px;';
			voronoiString += 'fill:'+factionColors[faction].fill+';" />\n';
		}

		var fill = '';
		// paint system dots
		for(var i = 0, len = parsedSystems.length; i < len; i++) {
			fill = '#aaa';
			if(factionColors.hasOwnProperty(parsedSystems[i].col)) {
				fill = factionColors[parsedSystems[i].col].stroke;
			}
			voronoiString += '<circle data-name="'+parsedSystems[i].name+'" data-aff="'+parsedSystems[i].col+'" cx="' + parsedSystems[i].x + '" cy="' + (-parsedSystems[i].y) + '" r="2" style="stroke-width: 0; fill: '+fill+'" />\n';
		}

		tpl = tpl.replace('{WIDTH}', '700');
		tpl = tpl.replace('{HEIGHT}', '700');
		tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		tpl = tpl.replace('{ELEMENTS}', voronoiString);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	SvgWriter.prototype.writeSvgPoisson = function (pDisc, vBorder) {
		var xmlString = '';
		var name = 'poisson';
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var curP, curD, curE;
		var fill;
		var parsedSystems;

		/*for(var i = 0, len = pDisc.existingPoints.length; i < len; i++) {
			curP = pDisc.existingPoints[i];
			poissonString += '<circle cx="'+curP[0]+'" cy="'+(-curP[1])+'" r="2" style="stroke-width: 0; fill: #000;" />\n';
		}
		for(var i = 0, len = pDisc.generatedPoints.length; i < len; i++) {
			curP = pDisc.generatedPoints[i];
			poissonString += '<circle cx="'+curP[0]+'" cy="'+(-curP[1])+'" r="2" style="stroke-width: 0; fill: #888;" />\n';
		}*/

		var factionColors = {
			'DC': { stroke: '#a00', fill: 'rgba(255,20,20,.3)' },
			'LC': { stroke: '#00a', fill: 'rgba(20, 20, 220, .3)' },
			'CC': { stroke: '#0a0', fill: 'rgba(20, 220, 20, .3)' },
			'FS': { stroke: '#fc0', fill: 'rgba(255, 200, 20, .3)' },
			'FWL': { stroke: '#c3f', fill: 'rgba(220, 50, 255, .3)' },
			'D': { stroke: '#f00', fill: 'rgba(255, 0, 0, .5)' }
			//'DUMMY': { stroke: '#f00', fill: 'rgba(255, 0, 0, .5)' }
		};

		for(var faction in factionColors) {
			var borderEdges = vBorder.borderEdges[faction];
			curD = '';
			for(var i = 0, len = borderEdges.length; i < len; i++) {
				curE = borderEdges[i];
				if(curE.isFirstInLoop) {
					/*if(i > 0) {
						curD += 'z';
					}*/
					curD += ' M'+curE.x1.toFixed(2)+','+(-curE.y1).toFixed(2);
				}
				if(curE.n1c2x === null || curE.n1c2x === undefined ||
					curE.n2c1x === null || curE.n2c1x === undefined) {
					curD += ' L' + borderEdges[i].x2.toFixed(2)+','+(-borderEdges[i].y2).toFixed(2);
				} else {
					curD += ' C' + borderEdges[i].n1c2x.toFixed(2)+','+(-borderEdges[i].n1c2y).toFixed(2);
					curD += ' ' + borderEdges[i].n2c1x.toFixed(2)+','+(-borderEdges[i].n2c1y).toFixed(2);
					curD += ' ' + borderEdges[i].x2.toFixed(2)+','+(-borderEdges[i].y2).toFixed(2);
				}
			}
			xmlString += '<path fill-rule="evenodd" d="'+curD+'" ';
			xmlString += 'style="stroke:'+factionColors[faction].stroke + ';stroke-width:2px;';
			xmlString += 'fill:'+factionColors[faction].fill+';" />\n';
		}

		// paint system dots
		parsedSystems = vBorder.objects;
		for(var i = 0, len = parsedSystems.length; i < len; i++) {
			if(parsedSystems[i].col === 'DUMMY') {
				continue;
			}
			fill = '#aaa';
			if(factionColors.hasOwnProperty(parsedSystems[i].col)) {
				fill = factionColors[parsedSystems[i].col].stroke;
			}
			xmlString += '<circle data-name="'+parsedSystems[i].name+'" data-aff="'+parsedSystems[i].col+'" cx="' + parsedSystems[i].x + '" cy="' + (-parsedSystems[i].y) + '" r="2" style="stroke-width: 0; fill: '+fill+'" />\n';
		}

		// paint 3-way voronoi nodes
		/*for(var i = 0, len = vBorder.nodes.length; i < len; i++) {
			if(vBorder.nodes[i].borderColors.length > 2) {
				xmlString += '<circle cx="'+vBorder.nodes[i].x+'" cy="'+(-vBorder.nodes[i].y)+'" r="2" style="stroke-width:0;fill:#ff0" />\n';
			}
		}*/

		tpl = tpl.replace('{WIDTH}', '700');
		tpl = tpl.replace('{HEIGHT}', '700');
		//tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		tpl = tpl.replace('{VIEWBOX}', '-2000 -2000 4000 4000');
		tpl = tpl.replace('{ELEMENTS}', xmlString);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	SvgWriter.prototype.writeUniverseImage = function (year, vBorder, systems, factions, viewRect) {
		var name = 'universe_'+year;
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var rgb;
		var curP, curD, curEdge, prevEdge;
		var curEdgeVisible, prevEdgeVisible;
		var fill;
		var parsedSystems;
		var xmlString = '', systemsString = '';
		var safeBox;
		var viewBox;

		factions['D'] = {
			shortName : 'D',
			longName : 'Disputed',
			category : '',
			color: '#ff0000',
			founding: 0,
			dissolution: ''
		};
		factions['I'].color = '#000000';
		
		// svg viewBox's y is top left, not bottom left
		viewBox = {
			x: viewRect.x,
			y: viewRect.y + viewRect.h
			w: viewRect.w,
			h: viewRect.h
		};

		for(var faction in factions) {
			var borderEdges = vBorder.boundedBorderEdges[faction];
			if(!borderEdges || borderEdges.length === 0) {
				continue;
			}
			// don't paint borders for independent planets
			if(faction === 'I') {
				continue;
			}
			rgb = this.hexToRgb(factions[faction].color) || {r: 0, g:0, b:0};
			factions[faction].fill = 'rgba('+rgb.r+','+rgb.g+','+rgb.b+', .3)';

			curD = '';
			for(var i = 0, len = borderEdges.length; i < len; i++) {
				prevEdge = curEdge;
				curEdge = borderEdges[i];
				prevEdgeVisible = prevEdge && this.edgeIsVisible(prevEdge, safeBox);
				curEdgeVisible = this.edgeIsVisible(curEdge, safeBox)
				/*if(!curEdgeVisible) {
					continue;
				}*/
				prevEdgeVisible = true; // TODO fix this
				if(curEdge.isFirstInLoop || (!prevEdgeVisible && curEdgeVisible)) {
					/*if(i > 0) {
						curD += 'z';
					}*/
					curD += ' M'+curEdge.n1.x.toFixed(2)+','+(-curEdge.n1.y).toFixed(2);
				}
				if(curEdge.n1c2 === null || curEdge.n1c2 === undefined ||
					curEdge.n2c1 === null || curEdge.n2c1 === undefined ||
					!curEdgeVisible) {
					curD += ' L' + borderEdges[i].n2.x.toFixed(2)+','+(-borderEdges[i].n2.y).toFixed(2);
				} else {
					curD += ' C' + borderEdges[i].n1c2.x.toFixed(2)+','+(-borderEdges[i].n1c2.y).toFixed(2);
					curD += ' ' + borderEdges[i].n2c1.x.toFixed(2)+','+(-borderEdges[i].n2c1.y).toFixed(2);
					curD += ' ' + borderEdges[i].n2.x.toFixed(2)+','+(-borderEdges[i].n2.y).toFixed(2);
				}
			}
			if(curD.length === 0) {
				continue;
			}
			xmlString += '<path fill-rule="evenodd" d="'+curD+'" ';
			xmlString += 'style="stroke:'+factions[faction].color + ';stroke-width:2px;';
			xmlString += 'fill:'+factions[faction].fill+';" />\n';
		}

		// paint system dots
		parsedSystems = vBorder.objects;
		for(var i = 0, len = parsedSystems.length; i < len; i++) {
			if(parsedSystems[i].col === 'DUMMY' ||
				!Utils.pointInRectangle(parsedSystems[i], viewRect)) {
				continue;
			}
			fill = '#aaa';
			if(factions.hasOwnProperty(parsedSystems[i].col)) {
				fill = factions[parsedSystems[i].col].color;
			}
			systemsString += '<circle data-name="'+parsedSystems[i].name+'" ';
			systemsString += 'data-aff="'+parsedSystems[i].col+'" ';
			systemsString += 'cx="' + parsedSystems[i].x.toFixed(3) + '" ';
			systemsString += 'cy="' + (-parsedSystems[i].y).toFixed(3) + '" ';
			systemsString += 'r="2" style="stroke-width: 0; fill: '+fill+'" />\n';
		}

		tpl = tpl.replace('{WIDTH}', viewBox.w); //'700');
		tpl = tpl.replace('{HEIGHT}', viewBox.h); //'700');
		//tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		//tpl = tpl.replace('{VIEWBOX}', '-2000 -2000 4000 4000');
		tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
		tpl = tpl.replace('{ELEMENTS}', xmlString + systemsString);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	/**
	 * Note that point's y coordinate will be flipped for visibility checks and for display.
	 *
	 * @returns {boolean} true if the point's coordinates are within the bounds of the given rectangle
	 * @private
	 * @obsolete use Utils.pointInRectangle instead
	 */
	SvgWriter.prototype.pointIsVisible = function (point, rect) {
		return point.x >= rect.x
				&& point.x <= rect.x + rect.w
				&& -point.y >= rect.y
				&& -point.y <= rect.y + rect.h;
	};

	/**
	 * @see https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
	 * @private
	 */
	SvgWriter.prototype.componentToHex = function (c) {
	    var hex = c.toString(16);
	    return hex.length == 1 ? "0" + hex : hex;
	};

	/**
	 * @see https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
	 * @private
	 */
	SvgWriter.prototype.rgbToHex = function (r, g, b) {
    	return "#" + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
	};

	/**
	 * @see https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
	 * @private
	 */
	SvgWriter.prototype.hexToRgb = function (hex) {
	    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	    return result ? {
	        r: parseInt(result[1], 16),
	        g: parseInt(result[2], 16),
	        b: parseInt(result[3], 16)
	    } : null;
	};



	return SvgWriter;

})();
