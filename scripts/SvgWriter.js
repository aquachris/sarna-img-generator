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


	/**
	 *
	 */
	SvgWriter.prototype.writeNeighborhoodImage = function (systems, factions, vBorder, viewRect) {
		var name = 'neighborhood_';
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var viewBox;
		var rgb;
		var curD;
		var borderEdges;
		var prevEdge, curEdge;
		var borderElements;

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

		for(var faction in factions) {
			borderEdges = vBorder.boundedBorderEdges[faction];
			if(!borderEdges || borderEdges.length === 0) {
				continue;
			}
			// don't paint borders for independent planets
			if(faction === 'I') {
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
		}

		tpl = tpl.replace('{WIDTH}', '800');
		tpl = tpl.replace('{HEIGHT}', '800');
		tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
		tpl = tpl.replace('{ELEMENTS}', borderElements);
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
		var viewBox;

		factions['D'] = {
			shortName : 'D',
			longName : 'Disputed',
			category : '',
			color : '#ff0000',
			founding: 0,
			dissolution: ''
		};
		factions['I'].color = '#000000';

		// svg viewBox's y is top left, not bottom left
		// viewRect is in map space, viewBox is in svg space
		viewBox = {
			x: viewRect.x,
			y: - viewRect.y - viewRect.h,
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
			xmlString += '<path fill-rule="evenodd" d="'+curD+'" ';
			xmlString += 'style="stroke:'+factions[faction].color + ';stroke-width:1px;';
			xmlString += 'fill:'+factions[faction].fill+';" />\n';
		}

		// paint system dots
		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i].col === 'DUMMY') {
				//!Utils.pointInRectangle(parsedSystems[i], viewRect)) {
				continue;
			}
			fill = '#aaa';
			if(factions.hasOwnProperty(systems[i].col)) {
				fill = factions[systems[i].col].color;
			}
			systemsString += '<circle data-name="'+systems[i].name+'" ';
			systemsString += 'data-aff="'+systems[i].col+'" ';
			systemsString += 'cx="' + systems[i].x.toFixed(3) + '" ';
			systemsString += 'cy="' + (-systems[i].y).toFixed(3) + '" ';
			systemsString += 'r="1" style="stroke: #000; stroke-width: 0.25; fill: '+fill+'" />\n';
			systemsString += '<text x="'+(systems[i].x + 1.5).toFixed(3)+'" ';
			systemsString += 'y="' + (-systems[i].y).toFixed(3) + '">';
			systemsString += systems[i].name+ '</text>'
		}

		var boxString = '';//'<rect x="-50" y="-50" width="100" height="100" style="stroke: #000; stroke-width: 2; fill: none;" stroke-dasharray="12 2" />';

		//tpl = tpl.replace('{WIDTH}', viewBox.w); //'700');
		//tpl = tpl.replace('{HEIGHT}', viewBox.h); //'700');
		tpl = tpl.replace('{WIDTH}', '800');
		tpl = tpl.replace('{HEIGHT}', '800');
		//tpl = tpl.replace('{VIEWBOX}', '-700 -700 1400 1400');
		//tpl = tpl.replace('{VIEWBOX}', '-2000 -2000 4000 4000');
		tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
		tpl = tpl.replace('{ELEMENTS}', xmlString + systemsString + boxString);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	SvgWriter.prototype.writeLabelledImage = function(labelMgr, viewRect) {
		var name = 'labels';
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var systems = labelMgr.objects;
		var rgb;
		var fill;
		var parsedSystems;
		var labelsString = '', systemsString = '';
		var viewBox;

		// svg viewBox's y is top left, not bottom left
		// viewRect is in map space, viewBox is in svg space
		viewBox = {
			x: viewRect.x,
			y: - viewRect.y - viewRect.h,
			w: viewRect.w,
			h: viewRect.h
		};

		// paint system dots
		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i].col === 'DUMMY') {
				//!Utils.pointInRectangle(parsedSystems[i], viewRect)) {
				continue;
			}
			fill = '#000';
			systemsString += '<rect x="'+systems[i].x+'" y="'+(-systems[i].y-systems[i].h)+'"';
			systemsString += ' height="'+systems[i].h+'" width="'+systems[i].w+'"';
			systemsString += ' data-name="'+systems[i].name+'" data-id="'+systems[i].id+'"';
			systemsString += ' data-conflicts="'+systems[i].overlapCost+'"'
			systemsString += ' style="stroke-width: 0; fill: #a00;" />';

			for(var pos = 0; pos < 8; pos++) {
				//console.log(systems[i]);
				fill = 'rgba(50, 240, 50, 0.1)';
				if(systems[i].selLabelPos === pos) {
					fill = 'rgba(50, 200, 50, 0.5)';
				}
				labelsString += '<rect x="'+systems[i].labels[pos].x+'"';
				labelsString += ' y="'+(-systems[i].labels[pos].y - systems[i].labels[pos].h)+'"';
				labelsString += ' height="'+systems[i].labels[pos].h+'"';
				labelsString += ' width="'+systems[i].labels[pos].w+'"';
				labelsString += ' data-name="'+systems[i].name+'_'+pos+'"';
				labelsString += ' data-id="'+systems[i].labels[pos].id+'"';
				labelsString += ' style="stroke-width: 0; fill: '+fill+';" />';
				if(systems[i].selLabelPos === pos) {
					labelsString += '<text x="'+systems[i].labels[pos].x+'"';
					labelsString += ' y="'+(-systems[i].labels[pos].y-systems[i].labels[pos].h+1.5)+'">';
				 	labelsString += systems[i].name + '</text>';
				}
			}
			// systemsString += '<text x="'+(systems[i].x + 1.5).toFixed(3)+'" ';
			// systemsString += 'y="' + (-systems[i].y).toFixed(3) + '">';
			// systemsString += systems[i].name+ '</text>'
		}

		tpl = tpl.replace('{WIDTH}', '800');
		tpl = tpl.replace('{HEIGHT}', '800');
		tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
		tpl = tpl.replace('{ELEMENTS}', labelsString + systemsString);
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	SvgWriter.prototype.writeLabelledImage2 = function(labelMgr, viewRect) {
		var name = 'labels2';
		var filename = this.baseDir + '/output/' + name + '.svg';
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf8' });
		var systems = labelMgr.objects;
		var rgb;
		var fill;
		var parsedSystems;
		var labelsString = '', systemsString = '';
		var viewBox;

		// svg viewBox's y is top left, not bottom left
		// viewRect is in map space, viewBox is in svg space
		viewBox = {
			x: viewRect.x,
			y: - viewRect.y - viewRect.h,
			w: viewRect.w,
			h: viewRect.h
		};

		// paint system dots
		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i].col === 'DUMMY') {
				//!Utils.pointInRectangle(parsedSystems[i], viewRect)) {
				continue;
			}
			fill = '#000';
			systemsString += '<rect x="'+systems[i].x+'" y="'+(-systems[i].y-systems[i].h)+'"';
			systemsString += ' height="'+systems[i].h+'" width="'+systems[i].w+'"';
			systemsString += ' data-name="'+systems[i].name+'" data-id="'+systems[i].id+'"';
			systemsString += ' data-conflicts="'+systems[i].overlapCost+'"'
			systemsString += ' style="stroke-width: 0; fill: #a00;" />';

			fill = 'rgba(50, 200, 50, 0.5)';
			labelsString += '<rect x="'+systems[i].label.x+'"';
			labelsString += ' y="'+(-systems[i].label.y - systems[i].label.h)+'"';
			labelsString += ' height="'+systems[i].label.h+'"';
			labelsString += ' width="'+systems[i].label.w+'"';
			labelsString += ' data-name="'+systems[i].name+'"';
			labelsString += ' data-id="'+systems[i].label.id+'"';
			labelsString += ' style="stroke-width: 0; fill: '+fill+';" />';
			labelsString += '<text x="'+systems[i].label.x+'"';
			labelsString += ' y="'+(-systems[i].label.y-systems[i].label.h+1.5)+'">';
		 	labelsString += systems[i].name + '</text>';
			// systemsString += '<text x="'+(systems[i].x + 1.5).toFixed(3)+'" ';
			// systemsString += 'y="' + (-systems[i].y).toFixed(3) + '">';
			// systemsString += systems[i].name+ '</text>'
		}

		tpl = tpl.replace('{WIDTH}', '800');
		tpl = tpl.replace('{HEIGHT}', '800');
		tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
		tpl = tpl.replace('{ELEMENTS}', labelsString + systemsString);
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
