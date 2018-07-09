module.exports = (function () {
	'use strict';

	var fs = require('fs');
	var Delaunator = require('Delaunator');
	var VoronoiBorder = require('./VoronoiBorder.js');
	var Utils = require('./Utils.js');

	/**
	 * An instance of this class writes SVG files on demand, using the given
	 * base map and the desired center coordinates and bounds.
	 */
	var SvgWriter = function (logger, baseDir) {
		this.baseDir = baseDir || '.';
		this.logger = logger;
	};

    SvgWriter.prototype.constructor = SvgWriter;

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


	/**
	 *
	 */
	SvgWriter.prototype.writeNeighborhoodImage = function (dimensions, viewRect, era, systems, factions, vBorder) {
		var name = 'neighborhood_' + era;
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var viewBox;
		var rgb;
		var curD;
		var borderEdges;
		var prevEdge, curEdge;
		var factionLabelElements, borderElements, systemElements, systemNameElements, jumpRadiusElements;
		var elements;
		var stroke, fill;

		dimensions = dimensions || { w: 800, h: 800 };

		// svg viewBox's y is top left, not bottom left
		// viewRect is in map space, viewBox is in svg space
		viewBox = {
			x: viewRect.x,
			y: -viewRect.y - viewRect.h,
			w: viewRect.w,
			h: viewRect.h
		};

		factions['D'] = {
			shortName : 'D',
			longName : 'Disputed',
			category : '',
			color : '#ff0000',
			fill : 'transparent',
			founding : 0,
			dissolution : ''
		};
		factions['I'].color = '#000000';

		factionLabelElements = '';
		borderElements = '';

		for(var faction in factions) {
			borderEdges = vBorder.boundedBorderEdges[faction];
			if(!borderEdges || borderEdges.length === 0) {
				continue;
			}
			// don't paint borders for independent planets
			if(faction === 'I' || faction === 'D') {
				continue;
			}
			rgb = this.hexToRgb(factions[faction].color) || {r: 0, g:0, b:0};
			if(!factions[faction].fill) {
				factions[faction].fill = 'rgba('+rgb.r+','+rgb.g+','+rgb.b+', .3)';
			}

			curD = '';
			for(var i = 0, len = borderEdges.length; i < len; i++) {
				prevEdge = curEdge;
				curEdge = borderEdges[i];
				if(curEdge.isFirstInLoop) {
					curD += ' M'+curEdge.n1.x.toFixed(2)+','+(-curEdge.n1.y).toFixed(2);
				}
				if(curEdge.n1c2 === null || curEdge.n1c2 === undefined ||
					curEdge.n2c1 === null || curEdge.n2c1 === undefined) {
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
			borderElements += '<path fill-rule="evenodd" d="'+curD+'" ';
			borderElements += 'style="stroke:'+factions[faction].color + ';stroke-width:1px;';
			borderElements += 'fill:'+factions[faction].fill+';" />\n';

			if(factions[faction].centerX !== undefined && factions[faction].centerY !== undefined) {
				factionLabelElements += '<text x="'+factions[faction].centerX.toFixed(3)+'"';
				factionLabelElements += ' y="'+(-factions[faction].centerY).toFixed(3)+'" ';
				factionLabelElements += ' class="faction-label '+faction+'">';
				factionLabelElements +=	factions[faction].longName;
				factionLabelElements += '</text>\n';
			}
		}

		systemElements = '';
		systemNameElements = '';
		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i].col === 'DUMMY') {
				//!Utils.pointInRectangle(parsedSystems[i], viewRect)) {
				continue;
			}
			fill = '#aaa';
			if(factions.hasOwnProperty(systems[i].col)) {
				fill = factions[systems[i].col].color;
			}
			systemElements += '<circle data-name="'+systems[i].name+'" ';
			systemElements += 'data-aff="'+systems[i].col+'" ';
			systemElements += 'cx="' + systems[i].centerX.toFixed(3) + '" ';
			systemElements += 'cy="' + (-systems[i].centerY).toFixed(3) + '" ';
			systemElements += 'r="1" style="stroke: #000; stroke-width: 0.25; fill: '+fill+'" />\n';
			systemNameElements += '<text x="'+systems[i].label.x.toFixed(3) + '" ';
			systemNameElements += ' y="'+(-systems[i].label.y-systems[i].h*.25).toFixed(3)+'" class="system-label">';
			systemNameElements += systems[i].name + '</text>';
		}

		jumpRadiusElements = '<circle class="jump-radius" cx="'+(viewBox.x+viewBox.w*.5)+'" cy="'+(viewBox.y+viewBox.h*.5)+'" r="30" />\n';

		elements = '<g class="borders">'+borderElements+'</g>\n';
		//elements += '<g class="faction-labels">'+factionLabelElements+'</g>\n';
		elements += '<g class="jump-radius">'+jumpRadiusElements+'</g>\n';
		elements += '<g class="systems">'+systemElements+'</g>\n';
		elements += '<g class="system-labels">'+systemNameElements+'</g>\n';

		//tpl = tpl.replace('{WIDTH}', '5000');
		//tpl = tpl.replace('{HEIGHT}', '5000');
		tpl = tpl.replace('{WIDTH}', dimensions.w);
		tpl = tpl.replace('{HEIGHT}', dimensions.h);
		tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
		tpl = tpl.replace('{ELEMENTS}', elements);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
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
