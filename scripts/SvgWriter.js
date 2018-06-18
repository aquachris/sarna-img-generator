module.exports = (function () {
	'use strict';

	var fs = require('fs');
	var Observable = require('./Observable.js');

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
			systemCircles += '<circle cx="' + borderSystems[i].x + '" cy="' + (-borderSystems[i].y) + '" r="2" fill="'+fill+'" />\n';
		}
		tpl = tpl.replace('{WIDTH}', '700');
		tpl = tpl.replace('{HEIGHT}', '700');
		tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		tpl = tpl.replace('{ELEMENTS}', systemCircles);
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
