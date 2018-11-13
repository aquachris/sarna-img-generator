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
	 * @param nebulae {Array} Array of all displayed nebulae
	 * @param minimapSettings {Object} Settings for an optional minimap (dimensions, viewRect and borders)
	 * @param additionalConfig {Object} Additional configuration options like jump radius circles or cutout rectangles
	 */
	SvgWriter.prototype.writeSvg = function (filename, dimensions, viewRect, era, systems, factions, borders, nebulae, minimapSettings, additionalConfig) {
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf-8' });
		var viewBox;
		var defsStr = '';
		var elementsStr;
		var els;
		var borderEdges;
		var stroke, fill, rgb;
		var labelCls;
		var prevEdge, curEdge, curD;
		var pxPerLy = dimensions.w / viewRect.w;

		// initialize elements object
		els = {
			borders: '',
			factionLabels : '',
			jumpRadius : '',
			cutout : '',
			nebulae : '',
			nebulaeLabels : '',
			systems : '',
			systemLabels : '',
			minimap : '',
			scale : ''
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

		for(var i = 0, len = nebulae.length; i < len; i++) {
			els.nebulae += '<ellipse ';
			els.nebulae += 'data-name="'+nebulae[i].name+'" ';
			els.nebulae += 'cx="'+nebulae[i].centerX+'" ';
			els.nebulae += 'cy="'+(-nebulae[i].centerY)+'" ';
			els.nebulae += 'rx="'+(nebulae[i].w*.5)+'" ';
			els.nebulae += 'ry="'+(nebulae[i].h*.5)+'" ';
			els.nebulae += ' />\n';
			els.nebulaeLabels += '<text x="'+nebulae[i].label.x.toFixed(3) + '" ';
			els.nebulaeLabels += ' y="'+(-nebulae[i].label.y).toFixed(3)+'" ';
			els.nebulaeLabels += ' filter="url(#sLblShd)" class="nebulae-label">';
			els.nebulaeLabels += nebulae[i].name + '</text>';
		}

		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i].col === 'DUMMY') {
				continue;
			}
			fill = '#aaa';
			if(factions.hasOwnProperty(systems[i].col)) {
				fill = factions[systems[i].col].color;
			}
			labelCls = '';
			if(systems[i].col === '' || systems[i].col === 'U' || systems[i].col === 'A') {
				fill = '#aaa';
				labelCls = 'uninhabited';
			}
			
			if(systems[i].isCluster) {
				fill += '55';
				els.systems += '<ellipse class="cluster '+systems[i].col+'" ';
				els.systems += ' data-name="'+systems[i].name+'"';
				els.systems += ' cx="' + systems[i].centerX.toFixed(3) + '"';
				els.systems += ' cy="' + (-systems[i].centerY).toFixed(3) + '"';
				els.systems += ' rx="' + systems[i].radiusX + '"';
				els.systems += ' ry="' + systems[i].radiusY + '"';
				els.systems += ' transform="rotate(' + systems[i].rotation + ', ';
				els.systems += 		systems[i].centerX.toFixed(3) + ', ';
				els.systems += 		(-systems[i].centerY.toFixed(3)) + ')"';
				els.systems += ' style="fill: '+fill+'" />\n';
				els.systemLabels += '<text x="'+systems[i].label.x.toFixed(3) + '" ';
				els.systemLabels += ' y="'+(-systems[i].label.y-systems[i].h*.25).toFixed(3)+'" ';
				els.systemLabels += '  filter="url(#sLblShd)" class="system-label '+labelCls+'">';
				els.systemLabels += systems[i].name + '</text>\n';
			} else {
				els.systems += '<circle class="system '+systems[i].col+'" ';
				els.systems += ' data-name="'+systems[i].name+'"';
				//els.systems += ' data-aff="'+systems[i].col+'"';
				els.systems += ' cx="' + systems[i].centerX.toFixed(3) + '"';
				els.systems += ' cy="' + (-systems[i].centerY).toFixed(3) + '"';
				els.systems += ' r="' + systems[i].radiusX + '" style="fill: '+fill+'" />\n';
				els.systemLabels += '<text x="'+systems[i].label.x.toFixed(3) + '" ';
				els.systemLabels += ' y="'+(-systems[i].label.y-systems[i].h*.25).toFixed(3)+'" ';
				els.systemLabels += '  filter="url(#sLblShd)" class="system-label '+labelCls+'">';
				els.systemLabels += systems[i].name + '</text>\n';
			}
		}

		els.jumpRadius = '<circle class="jump-radius" cx="'+(viewRect.x+viewRect.w*.5)+'" cy="'+(-viewRect.y-viewRect.h*.5)+'" r="30" />\n';
		els.jumpRadius += '<circle class="jump-radius" cx="'+(viewRect.x+viewRect.w*.5)+'" cy="'+(-viewRect.y-viewRect.h*.5)+'" r="60" />\n';

		// minimap rendering
		if(minimapSettings) {

			var pxPerLyMinimap = minimapSettings.dimensions.w / minimapSettings.viewRect.w;

			// add clip path for minimap content
			defsStr += '<clipPath id="minimapClip">';
			defsStr += '<rect x="'+minimapSettings.viewRect.x+'" ';
			defsStr += 'y="'+(-minimapSettings.viewRect.y-minimapSettings.viewRect.h)+'" ';
			defsStr += 'width="'+minimapSettings.viewRect.w+'" ';
			defsStr += 'height="'+minimapSettings.viewRect.h+'" />';
			defsStr += '</clipPath>\n';

			// paint minimap
			var minimapScale = pxPerLyMinimap / pxPerLy;

			var minimapMargin = 10 / pxPerLy;

			var minimapPos = {
				x: viewRect.x + viewRect.w - minimapSettings.viewRect.w * minimapScale - minimapMargin,
				y: -viewRect.y - minimapSettings.viewRect.h * minimapScale - minimapMargin
				//y: -viewRect.y - viewRect.h * .25// + viewRect.h - minimapSettings.viewRect.h * .5 * minimapScale - 10 / pxPerLy
			}
			els.minimap = '<g class="minimap-outer" ';
			els.minimap += 'transform="translate('+minimapPos.x+','+minimapPos.y+') ';
			els.minimap += 'scale('+minimapScale+')">\n';

			//els.minimap += '<rect x="'+minimapSettings.viewRect.x+'" y="'+minimapSettings.viewRect.y+'" ';
			els.minimap += '<rect x="0" y="0" ';
			els.minimap += 'width="'+minimapSettings.viewRect.w+'" ';
			els.minimap += 'height="'+minimapSettings.viewRect.h+'" style="fill:#fff" />\n';

			els.minimap += '<g class="minimap-inner" ';
			els.minimap += 'transform="translate('+(-minimapSettings.viewRect.x)+',';
			els.minimap += (minimapSettings.viewRect.y+minimapSettings.viewRect.h)+')" ';
			els.minimap += ' clip-path="url(#minimapClip)" >\n';

			// iterate over factions
			for(var faction in factions) {
				borderEdges = minimapSettings.borders[faction];
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
					curD += ' L' + borderEdges[i].n2.x.toFixed(2)+','+(-borderEdges[i].n2.y).toFixed(2);
				}
				if(curD.length === 0) {
					continue;
				}
				els.minimap += '<path fill-rule="evenodd" ';
				els.minimap += 'class="border '+faction+'" ';
				els.minimap += 'style="stroke:'+factions[faction].color + ';stroke-width:2px;';
				//els.minimap += 'style="stroke-width:0;';
				els.minimap += 'fill:'+factions[faction].fill+';" ';
				els.minimap += 'd="'+curD+'" />\n';
			}

			// map cutout rectangle
			els.minimap += '<rect x="'+viewRect.x+'" y="'+(-viewRect.y-viewRect.h)+'" ';
			els.minimap += 'width="'+viewRect.w+'" height="' + viewRect.h + '" ';
			els.minimap += ' style="fill: none; stroke: #fff; stroke-width: 10;" />\n';
			els.minimap += '<rect x="'+viewRect.x+'" y="'+(-viewRect.y-viewRect.h)+'" ';
			els.minimap += 'width="'+viewRect.w+'" height="' + viewRect.h + '" ';
			els.minimap += ' style="fill: none; stroke: #a00; stroke-width: 3;" />\n';

			var focusedCoords = [viewRect.x+viewRect.w*.5,-viewRect.y-viewRect.h*.5];

			if(Utils.pointInRectangle({x:0, y:0}, minimapSettings.viewRect)) {
				/*els.minimap += '<circle cx="0" cy="0" r="8" style="fill: transparent; stroke: #fff; stroke-width: 8;" />'
				els.minimap += '<circle cx="0" cy="0" r="20" style="fill: transparent; stroke: #fff; stroke-width: 8;" />'
				els.minimap += '<circle cx="0" cy="0" r="8" style="fill: transparent; stroke: #000; stroke-width: 3;" />'
				els.minimap += '<circle cx="0" cy="0" r="20" style="fill: transparent; stroke: #000; stroke-width: 3;" />'*/
				//els.minimap += '<circle cx="0" cy="0" r="32" style="fill: transparent; stroke: #000; stroke-width: 3;" />'
			} else {
				// line to origin
				//els.minimap += '<path d="M'+focusedCoords[0]+','+focusedCoords[1]+' ';
				//els.minimap += 'L0,0z" ';
				//els.minimap += 'style="fill:#0f0;stroke-width:5;stroke:#0a0;" />\n';

				var lineToOrigin = Utils.lineFromPoints(focusedCoords, [0,0]);
				var distToOrigin = Utils.distance(focusedCoords[0], focusedCoords[1], 0, 0);

				var p1, p2;
				var rTop = -minimapSettings.viewRect.y - minimapSettings.viewRect.h;
				var rRight = minimapSettings.viewRect.x + minimapSettings.viewRect.w;
				var rBottom = -minimapSettings.viewRect.y;
				var rLeft = minimapSettings.viewRect.x;

				// closest perimeter point from origin
				var periPoint = Utils.getClosestPointOnRectanglePerimeter({x:0,y:0}, minimapSettings.viewRect);
				var pPointDist = Utils.distance(periPoint.x, periPoint.y, 0, 0);

				var angle = Utils.angleBetweenVectors([1,0], [periPoint.x, periPoint.y]);
				// differentiate whether the focused point lies below the y = 0 line to get the true 360° angle
				if(periPoint.y > 0) {
					angle = Math.PI * 2 - angle;
				}
				//console.log('angle: ', angle, Utils.radToDeg(angle));

				// arrow towards origin
				els.minimap += '<g ';
				els.minimap += 'transform="';
				els.minimap += ' translate('+periPoint.x.toFixed(2)+','+(-periPoint.y).toFixed(2)+') ';
				els.minimap += ' rotate('+Utils.radToDeg(angle).toFixed(2)+') ';
				els.minimap += '">\n';
				els.minimap += '<path d="M5,0 l50,20 l0,-40 z" ';
				els.minimap += 'style="stroke-width: 4; stroke: #fff; fill: #a00;" />\n';
				els.minimap += '</g>\n';

				var textPoint = Utils.deepCopy(periPoint);
				if(periPoint.x < minimapSettings.viewRect.x + 60) {
					textPoint.x += 60;
				} else if(periPoint.x < minimapSettings.viewRect.x + minimapSettings.viewRect.w - 150) {
					textPoint.x += 30;
				} else {
					textPoint.x -= 200;
				}
				textPoint.y = Utils.clampNumber(periPoint.y, minimapSettings.viewRect.y + 60, minimapSettings.viewRect.y + minimapSettings.viewRect.h - 60);
				els.minimap += '<text x="'+textPoint.x.toFixed(2)+'" y="'+(-textPoint.y).toFixed(2)+'" filter="url(#sLblShdMM)">\n';
				els.minimap += '<tspan>Terra</tspan>\n';
				if(pPointDist >= 3) {
					els.minimap += '<tspan x="'+textPoint.x.toFixed(2)+'" dy="1.1em" class="smaller">'+(Math.round(pPointDist/5)*5)+' LY</tspan>\n';
				}
				els.minimap += '</text>\n';
			}

			// close minimap inner container
			els.minimap += '</g>\n';

			// frame around the minimap
			els.minimap += '<rect x="-5" y="-5" ';//'+minimapSettings.viewRect.x+'" y="'+minimapSettings.viewRect.y+'" ';
			els.minimap += 'width="'+(minimapSettings.viewRect.w+10)+'" ';
			els.minimap += 'height="'+(minimapSettings.viewRect.h+10)+'" style="fill:none; stroke:rgba(0,0,0,1); stroke-width: 10" />\n';

			// close minimap outer container
			els.minimap += '</g>';
		}

		// scale
		var scaleMargin = 10 / pxPerLy;
		els.scale = '<g transform="translate('+(viewRect.x+scaleMargin)+','+(-viewRect.y - 1.5 - scaleMargin)+')">\n';
		els.scale += '<rect x="0" y="0" width="50" height="1.5" class="black" />\n';
		els.scale += '<rect x="10" y="0" width="10" height="1.5" class="white" />\n';
		els.scale += '<rect x="30" y="0" width="10" height="1.5" class="white" />\n';
		els.scale += '<rect x="0" y="0" width="50" height="1.5" class="frame" />\n';
		els.scale += '<text x="-0.682" y="-1" filter="url(#sLblShd)">0</text>\n'
		els.scale += '<text x="'+(10 - 1.365)+'" y="-1" filter="url(#sLblShd)">10</text>\n'; // 1.36474609375
		els.scale += '<text x="'+(20 - 1.365)+'" y="-1" filter="url(#sLblShd)">20</text>\n';
		els.scale += '<text x="'+(30 - 1.365)+'" y="-1" filter="url(#sLblShd)">30</text>\n';
		els.scale += '<text x="'+(40 - 1.365)+'" y="-1" filter="url(#sLblShd)">40</text>\n';
		els.scale += '<text x="'+(50 - 1.365)+'" y="-1" filter="url(#sLblShd)">50</text>\n';
		els.scale += '<text x="51" y="1.85" filter="url(#sLblShd)">LY</text>\n';
		//els.scale += '<text x="'+(25 - 3.0975341796875)+'" y="-1" filter="url(#sLblShd)">50 LY</text>'
		els.scale += '</g>\n'

		elementsStr = '';
		if(!!els.borders) {
			elementsStr += '<g class="borders">'+els.borders+'</g>\n';
		}
		if(!!els.factionLabels) {
			elementsStr += '<g class="faction-labels">'+els.factionLabels+'</g>\n';
		}
		if(!!els.nebulae) {
			elementsStr += '<g class="nebulae">'+els.nebulae+'</g>\n';
		}
		if(!!els.nebulaeLabels) {
			elementsStr += '<g class="nebulae-labels">'+els.nebulaeLabels+'</g>\n';
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
		if(!!els.minimap) {
			elementsStr += '<g class="minimap">'+els.minimap+'</g>\n';
		}
		if(!!els.scale) {
			elementsStr += '<g class="scale">'+els.scale+'</g>\n';
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
		tpl = tpl.replace('{DEFS}', defsStr);
		tpl = tpl.replace('{ELEMENTS}', elementsStr);
		// make filename safe
		filename = filename.replace(/[\+\s\(\)]/g, '_');
		// write file
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};


	SvgWriter.prototype.writeSystemNeighborhoodSvg = function (name, dimensions, viewRect, era, systems, factions, borders, nebulae, minimapSettings) {
		var safeEraName = era.name.replace(/[\\\/]/g, '_').replace(/[\:]/g, '');
		var filename = this.baseDir + '/output/'+name.replace(/\s/g, '_')+'_' +era.year + '_' + safeEraName + '.svg';
		this.writeSvg(filename, dimensions, viewRect, era, systems, factions, borders, nebulae, minimapSettings);
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
