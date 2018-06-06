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
	SvgWriter.prototype.writeSvg = function (systems, focusedSystemIdx, displayedYear) {
		var focusedSystem = systems[focusedSystemIdx];
		var filename = this.baseDir + '/output/' + focusedSystem.name + '_' + displayedYear + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
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
			svgMarkup += '<circle class="system" cx="'+systems[i].x+'" cy="'+(-systems[i].y)+'" r=".75" />\n';
			svgMarkup += '<text class="system-name" x="'+systems[i].x+'" y="'+(-systems[i].y)+'" dx="1.5" dy="1">'+systems[i].name+'</text>';
		}
		
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
		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i]['3025'].startsWith('FS')) {
				fill = '#ffaa00';
			} else {
				fill = '#000000';
			}
			// mirror y coordinates
			systemCircles += '<circle cx="' + systems[i].x + '" cy="' + (-systems[i].y) + '" r="2" fill="'+fill+'" />\n';
		}
		tpl = tpl.replace('{VIEWBOX}', '-600 -600 1200 1200');
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