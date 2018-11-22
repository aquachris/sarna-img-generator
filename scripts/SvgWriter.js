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
	 * Create a system neighborhood SVG file.
	 */
	SvgWriter.prototype.writeSystemNeighborhoodSvg = function (name, dimensions, viewRect, era, systems, factions, borders, nebulae, minimapSettings, additionalConfig) {
		var safeEraName = era.name.replace(/[\\\/]/g, '_').replace(/[\:]/g, '');
		var filename = this.baseDir + '/output/'+name.replace(/\s/g, '_')+'_' +era.year + '_' + safeEraName + '.svg';
		this.writeSvg(filename, dimensions, viewRect, era, systems, factions, borders, nebulae, minimapSettings, additionalConfig);
	};

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
		var stroke, fill, rgba;
		var labelCls;
		var prevEdge, curEdge, curD;
		var pxPerLy = dimensions.w / viewRect.w;
		var htmlTpl, tplObj;
		var isec1, isec2;

		// initialize elements object
		els = {
			borders: '',
			factionLabels : '',
			jumpRings : '',
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

		// iterate over factions and render borders / state areas
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
			rgba = this.hexToRgba(factions[faction].color) || {r: 0, g:0, b:0};
			if(!factions[faction].fill) {
				factions[faction].fill = 'rgba('+rgba.r+','+rgba.g+','+rgba.b+', .3)';
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
			tplObj = {
				faction : faction,
				stroke : factions[faction].color,
				fill : factions[faction].fill,
				d : curD
			};
			els.borders += `<path fill-rule="evenodd" class="border ${tplObj.faction}"
						style="stroke: ${tplObj.stroke}; stroke-width: 1px; fill: ${tplObj.fill};"
						d="${tplObj.d}" />\n`;
		}

		// render nebulae
		var prevPoint, curPoint;
		for(var i = 0, len = nebulae.length; i < len; i++) {
			// nebula ellipse
			tplObj = {
				name : nebulae[i].name,
				x : nebulae[i].centerX.toFixed(3),
				y : (-nebulae[i].centerY).toFixed(3),
				rx : nebulae[i].w*.5,
				ry : nebulae[i].h*.5
			};
			/*els.nebulae += `<ellipse data-name="${tplObj.name}"
						cx="${tplObj.x}" cy="${tplObj.y}" rx="${tplObj.rx}" ry="${tplObj.ry}" />\n`;*/

			curD = '';
			for(var j = 0, jlen = nebulae[i].points.length; j <= jlen; j++) {
				curPoint = nebulae[i].points[j % jlen];
				if(j === 0) {
					curD += 'M' + curPoint.x.toFixed(2) + ',' + (-curPoint.y).toFixed(2);
				} else {
					prevPoint = nebulae[i].points[j-1];
					curD += ' C' + prevPoint.c2.x.toFixed(2) + ',' + (-prevPoint.c2.y).toFixed(2);
					curD += ' ' + curPoint.c1.x.toFixed(2) + ',' + (-curPoint.c1.y).toFixed(2);
					curD += ' ' + curPoint.x.toFixed(2) + ',' + (-curPoint.y).toFixed(2);
				}
				//curD += nebulae[i].points[j].x.toFixed(3) + ',';
				//curD += (-nebulae[i].points[j].y).toFixed(3);
			}

			els.nebulae += `<path fill-rule="evenodd" class="nebula"
						data-name="${tplObj.name}"
						d="${curD}" />\n`;

			// style="stroke: #000; stroke-width: 0.25px; fill: #0007;"
			/*els.nebulae += `<ellipse data-name="${tplObj.name}"
						cx="${tplObj.x}" cy="${tplObj.y}" rx="${tplObj.rx}" ry="${tplObj.ry}" />\n`;*/

			// nebula label
			tplObj = {
				x : nebulae[i].label.x.toFixed(3),
				y : (-nebulae[i].label.y).toFixed(3),
				name : nebulae[i].name
			};
			els.nebulaeLabels += `<text x="${tplObj.x}" y="${tplObj.y}" class="nebulae-label">
				${tplObj.name}</text>\n`;
		}

		/*console.log(Utils.lineEllipseIntersection({
			x1: 5, y1: 5,
			x2: 0, y2: 0
		}, {
			centerX: -2, centerY: -1,
			radiusX: 3, radiusY: 3
		}));*/

		// render clusters and planetary systems
		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i].col === 'DUMMY') {
				continue;
			}
			fill = '#aaaaaa';
			if(factions.hasOwnProperty(systems[i].col)) {
				fill = factions[systems[i].col].color;
			}
			labelCls = '';
			if(systems[i].col === '' || systems[i].col === 'U' || systems[i].col === 'A') {
				fill = '#aaaaaa';
				labelCls = 'uninhabited';
			}

			if(systems[i].isCluster) {
				// cluster ellipse
				// Microsoft browsers do not support the hexadecimal rgba notation (#000000ff)
				// use rgba(r, g, b, a) syntax instead
				rgba = this.hexToRgba(fill + '88');
				tplObj = {
					faction : systems[i].col,
					additionalClasses : '',
					name : systems[i].name,
					x : systems[i].centerX.toFixed(3),
					y : (-systems[i].centerY).toFixed(3),
					radiusX : systems[i].radiusX,
					radiusY : systems[i].radiusY,
					angle : systems[i].rotation,
					stroke : fill,
					fill : `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})`
				};
				if(systems[i].status.toLowerCase() === 'apocryphal') {
					tplObj.additionalClasses += 'apocryphal';
				}
				els.systems += `<ellipse class="cluster ${tplObj.faction} ${tplObj.additionalClasses}" 
							data-name="${tplObj.name}"
							cx="${tplObj.x}" cy="${tplObj.y}" rx="${tplObj.radiusX}" ry="${tplObj.radiusY}"
							transform="rotate(${tplObj.angle}, ${tplObj.x}, ${tplObj.y})"
							style="fill: ${tplObj.fill};"  />\n`;

				// connector
				if(systems[i].label.connector) {
					curD = 'M' + systems[i].label.connector.p1.x.toFixed(2);
					curD += ',' + (-systems[i].label.connector.p1.y).toFixed(2);
					curD += ' L' + systems[i].label.connector.p2.x.toFixed(2);
					curD += ',' + (-systems[i].label.connector.p2.y).toFixed(2);
					curD += ' L' + systems[i].label.connector.p3.x.toFixed(2);
					curD += ',' + (-systems[i].label.connector.p3.y).toFixed(2);
					els.systems += `<path d="${curD}" class="label-connector" />\n`;
				}

				tplObj = {
					x : systems[i].label.x.toFixed(3),
					y: (-systems[i].label.y).toFixed(3),
					labelClass : labelCls,
					name : systems[i].name,
					sup : ''
				};
				if((systems[i].status || '').toLowerCase() === 'apocryphal') {
					tplObj.labelClass += ' apocryphal';
					tplObj.sup = '<tspan class="sup" dx="0.5" dy="1">(apocryphal)</tspan>';
				}
				els.systemLabels += `<text x="${tplObj.x}" y="${tplObj.y}"
										class="system-label ${tplObj.labelClass}" >
							${tplObj.name}${tplObj.sup}
							</text>\n`;

			} else {
				// system circle
				tplObj = {
					faction : systems[i].col,
					additionalClasses : '',
					name : systems[i].name,
					x : systems[i].centerX.toFixed(3),
					y : (-systems[i].centerY).toFixed(3),
					r : systems[i].radiusX,
					fill : fill
				};
				if(systems[i].status.toLowerCase() === 'apocryphal') {
					tplObj.additionalClasses += 'apocryphal';
				}
				els.systems += `<circle class="system ${tplObj.faction} ${tplObj.additionalClasses}"
							data-name="${tplObj.name}" cx="${tplObj.x}" cy="${tplObj.y}" r="${tplObj.r}"
							style="fill: ${tplObj.fill}" />\n`;

				// system label
				tplObj = {
					x : systems[i].label.x.toFixed(3),
					y : (-systems[i].label.y).toFixed(3),
					labelClass : labelCls,
					name : systems[i].name,
					sup : ''
				};
				if((systems[i].status || '').toLowerCase() === 'apocryphal') {
					tplObj.labelClass += ' apocryphal';
					tplObj.sup = '<tspan class="sup" dx="0.5" dy="-1">(apocryphal)</tspan>';
				}
				els.systemLabels += `<text x="${tplObj.x}" y="${tplObj.y}"
										class="system-label ${tplObj.labelClass}">
							${tplObj.name}${tplObj.sup}</text>\n`;
			}
		}

		// render jump rings
		els.jumpRings = this.renderJumpRings({
			x: viewRect.x + viewRect.w * .5,
			y: viewRect.y + viewRect.h * .5
		}, additionalConfig.jumpRings);

		// render the minimap
		if(minimapSettings) {

			var pxPerLyMinimap = minimapSettings.dimensions.w / minimapSettings.viewRect.w;

			// add clip path for minimap content
			tplObj = {
				x : minimapSettings.viewRect.x,
				y : -minimapSettings.viewRect.y - minimapSettings.viewRect.h,
				w : minimapSettings.viewRect.w,
				h : minimapSettings.viewRect.h
			};
			defsStr += `<clipPath id="minimapClip">
						<rect x="${tplObj.x}" y="${tplObj.y}"
								width="${tplObj.w}" height="${tplObj.h}" />
						</clipPath>\n`;

			// paint minimap
			var minimapScale = pxPerLyMinimap / pxPerLy;

			var minimapMargin = 10 / pxPerLy;

			tplObj = {
				x: viewRect.x + viewRect.w - minimapSettings.viewRect.w * minimapScale - minimapMargin,
				y: -viewRect.y - minimapSettings.viewRect.h * minimapScale - minimapMargin
				//y: -viewRect.y - viewRect.h * .25// + viewRect.h - minimapSettings.viewRect.h * .5 * minimapScale - 10 / pxPerLy
			}
			els.minimap = `<g class="minimap-outer" transform="translate(${tplObj.x}, ${tplObj.y}) scale(${minimapScale})">\n`;

			//els.minimap += '<rect x="'+minimapSettings.viewRect.x+'" y="'+minimapSettings.viewRect.y+'" ';
			els.minimap += `<rect x="0" y="0"
							width="${minimapSettings.viewRect.w}" height="${minimapSettings.viewRect.h}"
							style="fill: #fff" />\n`;

			tplObj = {
				tX : -minimapSettings.viewRect.x,
				tY : minimapSettings.viewRect.y + minimapSettings.viewRect.h
			};
			els.minimap += `<g class="minimap-inner" clip-path="url(#minimapClip)"
								transform="translate(${tplObj.tX}, ${tplObj.tY})">\n`;

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
				rgba = this.hexToRgba(factions[faction].color) || {r: 0, g:0, b:0};
				if(!factions[faction].fill) {
					factions[faction].fill = 'rgba('+rgba.r+','+rgba.g+','+rgba.b+', .3)';
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
				tplObj = {
					stroke : factions[faction].color,
					fill : factions[faction].fill
				};
				els.minimap += `<path fill-rule="evenodd" class="border ${faction}"
								style="stroke: ${tplObj.stroke}; stroke-width:2px; fill:${tplObj.fill};"
								d="${curD}" />\n`;
			}

			// map cutout rectangle
			tplObj = {
				x: viewRect.x,
				y: -viewRect.y - viewRect.h,
				w: viewRect.w,
				h: viewRect.h
			};
			els.minimap += `<rect x="${tplObj.x}" y="${tplObj.y}" width="${tplObj.w}" height="${tplObj.h}"
								style="fill: none; stroke: #fff; stroke-width: 10;" />\n`;
			els.minimap += `<rect x="${tplObj.x}" y="${tplObj.y}" width="${tplObj.w}" height="${tplObj.h}"
								style="fill: none; stroke: #a00; stroke-width: 3;" />\n`;

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
				tplObj = {
					tX : periPoint.x.toFixed(2),
					tY : (-periPoint.y).toFixed(2),
					rot : Utils.radToDeg(angle).toFixed(2)
				};
				els.minimap += `<g transform="translate(${tplObj.tX}, ${tplObj.tY}) rotate(${tplObj.rot})">
									<path d="M5,0 l50,20 l0,-40z" style="stroke-width: 4; stroke: #fff; fill: #a00;" />
								</g>`;

				var textPoint = Utils.deepCopy(periPoint);
				if(periPoint.x < minimapSettings.viewRect.x + 60) {
					textPoint.x += 60;
				} else if(periPoint.x < minimapSettings.viewRect.x + minimapSettings.viewRect.w - 150) {
					textPoint.x += 30;
				} else {
					textPoint.x -= 200;
				}
				textPoint.y = Utils.clampNumber(periPoint.y, minimapSettings.viewRect.y + 60, minimapSettings.viewRect.y + minimapSettings.viewRect.h - 60);
				tplObj = {
					x : textPoint.x.toFixed(2),
					y : (-textPoint.y).toFixed(2),
					roundedDist : Math.round(pPointDist / 5) * 5,
					distStr : ''
				};
				if(pPointDist >= 3) {
					tplObj.distStr = `<tspan x="${tplObj.x}" dy="1.1em" class="smaller">${tplObj.roundedDist} LY</tspan>`;
				}

				els.minimap += `<text x="${tplObj.x}" y="${tplObj.y}">
									<tspan>Terra</tspan>
									${tplObj.distStr}
								</text>\n`;
			}

			// close minimap inner container
			els.minimap += `</g>\n`;

			// frame around the minimap
			tplObj = {
				w : minimapSettings.viewRect.w + 10,
				h : minimapSettings.viewRect.h + 10
			};
			els.minimap += `<rect x="-5" y="-5" width="${tplObj.w}" height="${tplObj.h}"
							style="fill: none; stroke: #000; stroke-width: 10;" />\n`;

			// close minimap outer container
			els.minimap += `</g>`;
		}

		// scale
		var scaleMargin = 10 / pxPerLy;
		tplObj = {
			tX  : viewRect.x + scaleMargin,
			tY  : -viewRect.y - 1.5 - scaleMargin,
			t10 : 10 - 1.365,
			t20 : 20 - 1.365,
			t30 : 30 - 1.365,
			t40 : 40 - 1.365,
			t50 : 50 - 1.365
		};
		els.scale = `<g transform="translate(${tplObj.tX}, ${tplObj.tY})">
						<rect x="0" y="0" width="50" height="1.5" class="black" />
						<rect x="10" y="0" width="10" height="1.5" class="white" />
						<rect x="30" y="0" width="10" height="1.5" class="white" />
						<rect x="0" y="0" width="50" height="1.5" class="frame" />
						<text x="-0.682" y="-1">0</text>
						<text x="${tplObj.t10}" y="-1">10</text>
						<text x="${tplObj.t20}" y="-1">20</text>
						<text x="${tplObj.t30}" y="-1">30</text>
						<text x="${tplObj.t40}" y="-1">40</text>
						<text x="${tplObj.t50}" y="-1">50</text>
						<text x="51" y="1.85">LY</text>
					</g>\n`;

		elementsStr = '';
		if(!!els.borders) {
			elementsStr += `<g class="borders">${els.borders}</g>\n`;
		}
		if(!!els.factionLabels) {
			elementsStr += `<g class="faction-labels">${els.factionLabels}</g>\n`;
		}
		if(!!els.nebulae) {
		elementsStr += `<g class="nebulae">${els.nebulae}</g>\n`;
		}
		if(!!els.nebulaeLabels) {
			elementsStr += `<g class="nebulae-labels">${els.nebulaeLabels}</g>\n`;
		}
		if(!!els.jumpRings) {
			elementsStr += `<g class="jump-radius-rings">${els.jumpRings}</g>\n`;
		}
		if(!!els.systems) {
			elementsStr += `<g class="systems">${els.systems}</g>\n`;
		}
		if(!!els.systemLabels) {
			elementsStr += `<g class="system-labels">${els.systemLabels}</g>\n`;
		}
		if(!!els.minimap) {
			elementsStr += `<g class="minimap">${els.minimap}</g>\n`;
		}
		if(!!els.scale) {
			elementsStr += `<g class="scale">${els.scale}</g>\n`;
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
	
	/**
	 * @param c {Object} The center point of all jump rings
	 * @param jumpRingDistances {Array} The distances to paint jump rings at
	 * @returns {String} SVG elements representing the jump radius rings
	 * @private
	 */
	SvgWriter.prototype.renderJumpRings = function (c, jumpRingDistances) {
		var ret = '';
		var tplObj;
		if(!c || !jumpRingDistances) {
			return ret;
		}
		tplObj = {
			cx: c.x.toFixed(3),
			cy: (-c.y).toFixed(3)
		};
		for(var i = 0; i < jumpRingDistances.length; i++) {
			tplObj.r = jumpRingDistances[i];
			ret += `<circle cx="${tplObj.cx}" cy="${tplObj.cy}" r="${tplObj.r}" />\n`;
		}			
		return ret;
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
	SvgWriter.prototype.hexToRgba = function (hex) {
		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
		var a = result && result[4] ? parseInt(result[4], 16) / 255 : 1;
		// round opacity to two decimals
		a = Math.round(a*100)/100;
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16),
			a: a
		} : null;
	};

	return SvgWriter;

})();
