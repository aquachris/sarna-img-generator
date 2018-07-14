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
	 * Create an SVG file.
	 *
	 * @param filename {String} The file name
	 * @param dimensions {Object} The image dimensions in pixels {w:<width>, h:<height>}
	 * @param viewRect {Object} The viewport rectangle in map space {x: <left x>, y: <bottom y>, w:<width>, h:<height>}
	 * @param era {Object} The map era
	 * @param systems {Array} Array of all displayed systems
	 * @param factions {Object} Key/value map of the displayed factions
	 * @param borders {Object} Key/value map of faction borders
	 * @param additionalConfig {Object} Additional configuration options like jump radius circles or cutout rectangles
	 */
	SvgWriter.prototype.writeSvg = function (filename, dimensions, viewRect, era, systems, factions, borders, additionalConfig) {
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf-8' });
		var viewBox;
		var elementsStr;
		var els;
		var borderEdges;
		var stroke, fill, rgb;
		var prevEdge, curEdge, curD;

		// initialize elements object
		els = {
			borders: '',
			factionLabels : '',
			jumpRadius : '',
			cutout : '',
			systems : '',
			systemLabels : ''
		};

		// create a faction entry for disputed systems
		factions['D'] = {
			shortName : 'D',
			longName : 'Disputed',
			category : '',
			color : '#ff0000',
			fill : 'transparent',
			founding : 0,
			dissolution : ''
		};
		// change independent systems' primary color to black (from white)
		factions['I'].color = '#000000';

		// iterate over factions
		for(var faction in factions) {
			// add faction labels (if faction centroids have been set)
			/*if(factions[faction].centerX !== undefined && factions[faction].centerY !== undefined) {
				els.factionLabels += '<text x="'+factions[faction].centerX.toFixed(3)+'"';
				els.factionLabels += ' y="'+(-factions[faction].centerY).toFixed(3)+'" ';
				els.factionLabels += ' class="faction-label '+faction+'">';
				els.factionLabels +=	factions[faction].longName;
				els.factionLabels += '</text>\n';
			}*/

			// add borders (if faction borders have been passed)
			//borderEdges = vBorder.boundedBorderEdges[faction];
			borderEdges = borders[faction];
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
			els.borders += '<path fill-rule="evenodd" ';
			els.borders += 'class="border '+faction+'" ';
			els.borders += 'style="stroke:'+factions[faction].color + ';stroke-width:1px;';
			els.borders += 'fill:'+factions[faction].fill+';" ';
			els.borders += 'd="'+curD+'" />\n';
		}

		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i].col === 'DUMMY') {
				//!Utils.pointInRectangle(parsedSystems[i], viewRect)) {
				continue;
			}
			fill = '#aaa';
			if(factions.hasOwnProperty(systems[i].col)) {
				fill = factions[systems[i].col].color;
			}
			els.systems += '<circle class="system '+systems[i].col+'" ';
			els.systems += ' data-name="'+systems[i].name+'"';
			//els.systems += ' data-aff="'+systems[i].col+'"';
			els.systems += ' cx="' + systems[i].centerX.toFixed(3) + '"';
			els.systems += ' cy="' + (-systems[i].centerY).toFixed(3) + '"';
			els.systems += ' r="1" style="fill: '+fill+'" />\n';
			els.systemLabels += '<text x="'+systems[i].label.x.toFixed(3) + '" ';
			els.systemLabels += ' y="'+(-systems[i].label.y-systems[i].h*.25).toFixed(3)+'" ';
			els.systemLabels += '  filter="url(#sLblShd)" class="system-label">';
			els.systemLabels += systems[i].name + '</text>';
		}

		els.jumpRadius = '<circle class="jump-radius" cx="'+(viewRect.x+viewRect.w*.5)+'" cy="'+(-viewRect.y-viewRect.h*.5)+'" r="30" />\n';

		elementsStr = '';
		if(!!els.borders) {
			elementsStr += '<g class="borders">'+els.borders+'</g>\n';
		}
		if(!!els.factionLabels) {
			elementsStr += '<g class="faction-labels">'+els.factionLabels+'</g>\n';
		}
		if(!!els.jumpRadius) {
			elementsStr += '<g class="jump-radius">'+els.jumpRadius+'</g>\n';
		}
		if(!!els.systems) {
			elementsStr += '<g class="systems">'+els.systems+'</g>\n';
		}
		if(!!els.systemLabels) {
			elementsStr += '<g class="system-labels">'+els.systemLabels+'</g>\n';
		}

		tpl = tpl.replace('{WIDTH}', dimensions.w);
		tpl = tpl.replace('{HEIGHT}', dimensions.h);
		// svg viewBox's y is top left, not bottom left
		// viewRect is in map space, viewBox is in svg space
		viewBox = {
			x: viewRect.x,
			y: -viewRect.y - viewRect.h,
			w: viewRect.w,
			h: viewRect.h
		};
		tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
		tpl = tpl.replace('{ELEMENTS}', elementsStr);
		// make filename safe
		filename = filename.replace(/[\+\s\(\)]/g, '_');
		// write file
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};


	SvgWriter.prototype.writeSystemNeighborhoodSvg = function (dimensions, viewRect, era, systems, factions, borders) {
		var safeEraName = era.name.replace(/[\\\/]/g, '_').replace(/[\:]/g, '');
		var filename = this.baseDir + '/output/Spica_' +era.year + '_' + safeEraName + '.svg';
		this.writeSvg(filename, dimensions, viewRect, era, systems, factions, borders);
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
