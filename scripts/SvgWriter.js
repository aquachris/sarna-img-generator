module.exports = (function () {
	'use strict';

	var fs = require('fs');
	var Utils = require('./Utils.js');

	/**
	 * An instance of this class writes SVG files on demand, using the given
	 * base map and the desired center coordinates and bounds.
	 */
	var SvgWriter = function (logger, baseDir) {
		this.baseDir = baseDir || '.';
		this.logger = logger;
		this.markup = {};
		this.initMarkup();
	};

    SvgWriter.prototype.constructor = SvgWriter;

	/**
	 * Resets the generated markup.
	 * @private
	 */
	SvgWriter.prototype.initMarkup = function () {
		this.markup = {
			defs : '',
			css : '',
			borders: '',
			borderLabels: '',
			jumpRings : '',
			nebulae : '',
			nebulaeLabels : '',
			clusters : '',
			systems : '',
			systemLabels : '',
			minimap : '',
			scaleHelp : '',
			overlays : ''
		};
	};

	/**
	 * Create a system neighborhood SVG file.
	 */
	SvgWriter.prototype.writeSystemNeighborhoodSvg = function (name, dimensions, viewRect, era, systems, factions, borders, nebulae, minimapSettings, jumpRings) {
		var safeEraName = era.name.replace(/[\\\/]/g, '_').replace(/[\:]/g, '');
		var filename = this.baseDir + '/output/'+name.replace(/\s/g, '_')+'_' +era.year + '_' + safeEraName + '.svg';
		this.writeSvg(null, filename, dimensions, viewRect, era, systems, factions, borders, null, nebulae, minimapSettings, jumpRings);
	};

	SvgWriter.prototype.writeBorderSvg = function (name, dimensions, viewRect, era, systems, factions, borders, borderLabelLines, nebulae, minimapSettings) {
		var safeEraName = era.name.replace(/[\\\/]/g, '_').replace(/[\:]/g, '');
		var filename = this.baseDir + '/output/'+name.replace(/\s/g, '_')+'_' +era.year + '_' + safeEraName + '_borders.svg';
		this.writeSvg({
			//renderBorderLabels : false,
			//renderSystems : false,
			//renderSystemLabels : false,
			renderClusters : false,
			renderClusterLabels : false,
			renderMinimap : false,
			renderScaleHelp : false
		}, filename, dimensions, viewRect, era, systems, factions, borders, borderLabelLines, nebulae, minimapSettings);
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
	 * @param jumpRings {Array} List of jump ring radii
	 */
	SvgWriter.prototype.writeSvg = function (settings, filename, dimensions, viewRect, era, systems, factions, borders, borderLabelLines, nebulae, minimapSettings, jumpRings) {
		var tpl = fs.readFileSync(this.baseDir + '/../data/map_base.svg', { encoding: 'utf-8' });
		var viewBox;
		var elementsStr;
		var pxPerLy = dimensions.w / viewRect.w;

		settings = settings || {};
		settings.renderFactions = settings.renderFactions === undefined ? true : false;
		settings.renderBorderLabels = settings.renderBorderLabels === undefined ? true : false;
		settings.renderNebulae = settings.renderNebulae === undefined ? true : false;
		settings.renderNebulaLabels = settings.renderNebulaLabels === undefined ? true : false;
		settings.renderJumpRings = settings.renderJumpRings === undefined ? true : false;
		settings.renderSystems = settings.renderSystems === undefined ? true : false;
		settings.renderSystemLabels = settings.renderSystemLabels === undefined ? true : false;
		settings.renderClusters = settings.renderClusters === undefined ? true : false;
		settings.renderClusterLabels = settings.renderClusterLabels === undefined ? true : false;
		settings.renderMinimap = settings.renderMinimap === undefined ? true : false;
		settings.renderScaleHelp = settings.renderScaleHelp === undefined ? true : false;

		// reset markup
		this.initMarkup();

		// render faction borders and state areas
		this.renderFactions(settings, factions, borders, borderLabelLines || []);

		// render nebulae
		this.renderNebulae(settings, nebulae);

		// render systems and clusters
		this.renderSystemsAndClusters(settings, factions, systems);

		// render jump rings
		this.renderJumpRings(settings, viewRect, jumpRings || []);

		// render the minimap
		this.renderMinimap(settings, minimapSettings, viewRect, pxPerLy, factions, nebulae);

		// render scale help
		this.renderScaleHelp(settings, viewRect, pxPerLy);

		// concatenate markup
		elementsStr = '';
		elementsStr += this.markup.borders ? `<g class="borders">${this.markup.borders}</g>\n` : '';
		elementsStr += this.markup.borderLabels ? `<g class="border-labels">${this.markup.borderLabels}</g>\n` : '';
		elementsStr += this.markup.clusters ? `<g class="clusters">${this.markup.clusters}</g>\n` : '';
		elementsStr += this.markup.nebulae ? `<g class="nebulae">${this.markup.nebulae}</g>\n` : '';
		elementsStr += this.markup.nebulaeLabels ? `<g class="nebulae-labels">${this.markup.nebulaeLabels}</g>\n` : '';
		elementsStr += this.markup.jumpRings ? `<g class="jump-radius-rings">${this.markup.jumpRings}</g>\n` : '';
		elementsStr += this.markup.systems ? `<g class="systems">${this.markup.systems}</g>\n` : '';
		elementsStr += this.markup.systemLabels ? `<g class="system-labels">${this.markup.systemLabels}</g>\n` : '';
		elementsStr += this.markup.minimap ? `<g class="minimap">${this.markup.minimap}</g>\n` : '';
		elementsStr += this.markup.scaleHelp ? `<g class="scale">${this.markup.scaleHelp}</g>\n` : '';
		elementsStr += this.markup.overlays ? `<g class="overlays">${this.markup.overlays}</g>\n` : '';

		// insert markup into base map template
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
		// remove unnecessary newlines and spaces
		elementsStr = elementsStr.replace(/\n\s+/gi, ' ');
		//this.markup.defs = this.markup.defs.replace(/\n\s+/gi, ' ');

		tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
		tpl = tpl.replace('{DEFS}', this.markup.defs);
		tpl = tpl.replace('{CSS}', this.markup.css);
		tpl = tpl.replace('{ELEMENTS}', elementsStr);
		// make filename safe
		filename = filename.replace(/[\+\s\(\)]/g, '_');
		// write file
		fs.writeFileSync(filename, tpl, { encoding: 'utf8'});
		this.logger.log('file "' + filename + '" written');
	};

	/**
	 * @private
	 */
	SvgWriter.prototype.renderFactions = function (settings, factions, borders, borderLabelLines) {
		var borderLoops, curLoop;
		var borderEdges;
		var curEdge, prevEdge, curD;
		var rgba, hex, tplObj;
		var polygon;

		// make sure there is a faction entry for disputed systems
		if(!factions['D']) {
			factions['D'] = {
				shortName : 'D',
				longName : 'Disputed',
				category : '',
				color : '#ff0000',
				fill : 'transparent',
				founding : 0,
				dissolution : ''
			};
		}

		// change independent systems' primary color to black (from white)
		factions['I'].color = '#000000';

		// iterate over factions and render borders / state areas
		for(var faction in factions) {
			// add borders (if faction borders have been passed)
			borderLoops = borders[faction];
			if(!borderLoops || borderLoops.length === 0) {
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

			// trace borders one edge at a time
			curD = '';
			for(var i = 0, len = borderLoops.length; i < len; i++) {
				curLoop = borderLoops[i];
				for(var li = 0; li < curLoop.edges.length; li++) {
					curEdge = curLoop.edges[li];
					if(li === 0) { //curEdge.isFirstInLoop) {
						curD += ' M'+curEdge.n1.x.toFixed(2)+','+(-curEdge.n1.y).toFixed(2);
					}
					if(curEdge.n1c2 === null || curEdge.n1c2 === undefined ||
						curEdge.n2c1 === null || curEdge.n2c1 === undefined) {
						curD += ' L' + curEdge.n2.x.toFixed(2)+','+(-curEdge.n2.y).toFixed(2);
					} else {
						curD += ' C' + curEdge.n1c2.x.toFixed(2)+','+(-curEdge.n1c2.y).toFixed(2);
						curD += ' ' + curEdge.n2c1.x.toFixed(2)+','+(-curEdge.n2c1.y).toFixed(2);
						curD += ' ' + curEdge.n2.x.toFixed(2)+','+(-curEdge.n2.y).toFixed(2);
					}
				}
			}

			if(curD.length === 0) {
				continue;
			}

			// convert a faction area to SVG markup
			tplObj = {
				faction : faction,
				stroke : factions[faction].color,
				fill : factions[faction].fill,
				d : curD
			};
			if(settings.renderFactions) {
				this.markup.borders += `<path fill-rule="evenodd" class="border ${tplObj.faction}"
						style="stroke: ${tplObj.stroke}; stroke-width: 1px; fill: ${tplObj.fill};"
						d="${tplObj.d}" />\n`;
				/*this.markup.defs += `<path id="label-path-${tplObj.faction}"
					d="${tplObj.d}" />`;
				this.markup.borders += `<text dy="-2">
    				<textPath startOffset="2" spacing="auto" xlink:href="#label-path-${tplObj.faction}">
						<tspan>${tplObj.faction}</tspan></textPath>
  				</text>`;*/
			}
		}

		if(settings.renderBorderLabels) {
			var curPolyline;
			var curCtrlPoints;
			for(var faction in borderLabelLines) {
				//console.log(faction + ' has ' + borderLabelLines[faction].length + ' polylines');
				for(var pi = 0; pi < borderLabelLines[faction].length; pi++) {
					curPolyline = borderLabelLines[faction][pi];
					// make sure the border labels are visible against the faction background
					rgba = this.hexToRgba(curPolyline.fill) || {r:0,g:0,b:0};
					if(rgba.r + rgba.g + rgba.b >= 600) {
						rgba.r = rgba.g = rgba.b = 0;
					}
					hex = this.rgbToHex(rgba.r, rgba.g, rgba.b);
					//console.log(curPolyline.id, curPolyline.edges.length);
					curD = '';
					curCtrlPoints = '';

					this.renderBorderLabels = true;
					this.renderBorderLabelCandidates = false;

					if(!!this.renderBorderLabels) {
						//console.log(curPolyline.id, curPolyline.labels.length);
						for(var li = 0; li < curPolyline.labels.length; li++) {
							tplObj = {
								plId : curPolyline.id,
								lId : curPolyline.labels[li].id,
								fill: hex,
								x1 : curPolyline.labels[li].bl.x.toFixed(2),
								y1 : (-curPolyline.labels[li].bl.y).toFixed(2),
								x2 : curPolyline.labels[li].br.x.toFixed(2),
								y2 : (-curPolyline.labels[li].br.y).toFixed(2),
								text : curPolyline.labels[li].labelText,
								opacity : 1,
								rating: curPolyline.labels[li].rating.toFixed(3),
								midPos: curPolyline.labels[li].midPos.toFixed(3)
							};
							// add label baseline path to defs
							this.markup.defs += `<path id="label-path-${tplObj.lId}"
								d="M${tplObj.x1},${tplObj.y1} L${tplObj.x2},${tplObj.y2}" />`;
							// add label text element to borderLabels group
							this.markup.borderLabels += `<text text-anchor="left"
								data-rating="${tplObj.rating}" data-mid-pos="${tplObj.midPos}">
			    				<textPath xlink:href="#label-path-${tplObj.lId}">`;
							for(var ltpi = 0; ltpi < curPolyline.labels[li].labelParts.length; ltpi++) {
								tplObj.text = curPolyline.labels[li].labelParts[ltpi];
								tplObj.dx = (curPolyline.labels[li].dxValues[ltpi]).toFixed(2);
								tplObj.dy = (curPolyline.labels[li].dyValues[ltpi]).toFixed(2);
								this.markup.borderLabels += `<tspan dx="${tplObj.dx}" dy="${tplObj.dy}"
									style="fill: ${tplObj.fill}; opacity: ${tplObj.opacity}">${tplObj.text}</tspan>`;
							}
							this.markup.borderLabels += `</textPath></text>`;
						}
					}

					if(!!this.renderBorderLabelCandidates) {
						for(var ei = 0; ei < curPolyline.edges.length; ei++) {
							curEdge = curPolyline.edges[ei];
							if(ei === 0
								//|| (prevEdge && curEdge.n1.x !== prevEdge.n2.x && curEdge.n1.y !== prevEdge.n2.y)
							) {
								curD += 'M'+curEdge.n1.x.toFixed(2)+','+(-curEdge.n1.y).toFixed(2);
							}
							//if(curEdge.n1c2 === null || curEdge.n1c2 === undefined ||
							//	curEdge.n2c1 === null || curEdge.n2c1 === undefined) {
							curD += ' L' + curEdge.n2.x.toFixed(2)+','+(-curEdge.n2.y).toFixed(2);
							prevEdge = curEdge;
							/*} else {
								curD += ' C' + curEdge.n1c2.x.toFixed(2)+','+(-curEdge.n1c2.y).toFixed(2);
								curD += ' ' + curEdge.n2c1.x.toFixed(2)+','+(-curEdge.n2c1.y).toFixed(2);
								curD += ' ' + curEdge.n2.x.toFixed(2)+','+(-curEdge.n2.y).toFixed(2);
							}*/
							// render control points
							/*if(curEdge.n1c2 !== null && curEdge.n1c2 !== undefined &&
								curEdge.n2c1 !== null && curEdge.n2c1 !== undefined) {
								tplObj = {
									x1 : curEdge.n1c2.x.toFixed(2),
									y1 : (-curEdge.n1c2.y).toFixed(2),
									x2 : curEdge.n2c1.x.toFixed(2),
									y2 : (-curEdge.n2c1.y).toFixed(2)
								};
								this.markup.borderLabels += `<circle cx="${tplObj.x1}" cy="${tplObj.y1}" r="0.3" style="fill: black;" />`;
								this.markup.borderLabels += `<circle cx="${tplObj.x2}" cy="${tplObj.y2}" r="0.3" style="fill: black;" />`;
							}*/
						}
						tplObj = {
							plId : curPolyline.id,
							stroke : '#000'
						};
						if(curPolyline.mergeFailed) {
							tplObj.stroke = '#c00';
						}
						this.markup.borderLabels += `<path fill-rule="evenodd" data-id="${tplObj.plId}"
							style="stroke: ${tplObj.stroke}; stroke-width: .3px; fill: none;" d="${curD}" />\n`;

						for(var ci = 0; ci < curPolyline.candidates.length; ci++) {
							// DEBUG
							/*if(curPolyline.candidates[ci].id !== 'FS_0_9') {
								continue;
							}*/
							// END DEBUG
							tplObj = {
								plId : curPolyline.id,
								cId : curPolyline.candidates[ci].id,
								x1 : curPolyline.candidates[ci].bl.x.toFixed(2),
								y1 : (-curPolyline.candidates[ci].bl.y).toFixed(2),
								x2 : curPolyline.candidates[ci].br.x.toFixed(2),
								y2 : (-curPolyline.candidates[ci].br.y).toFixed(2)
							};
							this.markup.defs += `<path id="label-path-${tplObj.cId}"
								d="M${tplObj.x1},${tplObj.y1} L${tplObj.x2},${tplObj.y2}" />`;
							tplObj = {
								plId : curPolyline.id,
								cId : curPolyline.candidates[ci].id,
								fill: hex,
								x: curPolyline.candidates[ci].midPt.x.toFixed(2),
								y: (-curPolyline.candidates[ci].midPt.y).toFixed(2),
								text : curPolyline.candidates[ci].labelText,
								rating : curPolyline.candidates[ci].rating.toFixed(4),
								isAbove : curPolyline.candidates[ci].labelIsAbovePolyline,
								innerLoop : curPolyline.candidates[ci].inInnerLoop,
								angle : curPolyline.candidates[ci].angle.toFixed(3)
								//dist: curPolyline.candidates[ci].dist,
							};
							//console.log(curPolyline.candidates[ci].midPt);
							this.markup.borderLabels += `<circle cx="${tplObj.x}" cy="${tplObj.y}"
								r=".7" style="stroke-width: 0; fill: #a00;" data-above="${tplObj.isAbove}" />\n`;
							this.markup.borderLabels += `<text text-anchor="left">
			    				<textPath xlink:href="#label-path-${tplObj.cId}"
								data-rating="${tplObj.rating}" data-angle="${tplObj.angle}"
								data-above="${tplObj.isAbove}" data-inner-loop="${tplObj.innerLoop}">`;

							for(var ctpi = 0; ctpi < curPolyline.candidates[ci].labelParts.length; ctpi++) {
								tplObj.text = curPolyline.candidates[ci].labelParts[ctpi];
								tplObj.dx = (curPolyline.candidates[ci].dxValues[ctpi]).toFixed(2);
								tplObj.dy = (curPolyline.candidates[ci].dyValues[ctpi]).toFixed(2);
								this.markup.borderLabels += `<tspan dx="${tplObj.dx}" dy="${tplObj.dy}"
									style="fill: ${tplObj.fill};">${tplObj.text}</tspan>`;
							}
							this.markup.borderLabels += `</textPath></text>`;

							tplObj = {
								cId : curPolyline.candidates[ci].id,
								x0: curPolyline.candidates[ci].bl.x.toFixed(3),
								y0: (-curPolyline.candidates[ci].bl.y).toFixed(3),
								x1: curPolyline.candidates[ci].tl.x.toFixed(3),
								y1: (-curPolyline.candidates[ci].tl.y).toFixed(3),
								x2: curPolyline.candidates[ci].tr.x.toFixed(3),
								y2: (-curPolyline.candidates[ci].tr.y).toFixed(3),
								x3: curPolyline.candidates[ci].br.x.toFixed(3),
								y3: (-curPolyline.candidates[ci].br.y).toFixed(3)
							};
							tplObj.d = `M${tplObj.x0},${tplObj.y0} L${tplObj.x1},${tplObj.y1}
								L${tplObj.x2},${tplObj.y2} L${tplObj.x3},${tplObj.y3} z`;
							this.markup.borderLabels += `<path data-id="${tplObj.cId}"
								d="${tplObj.d}"
								style="stroke: #0052; stroke-width: .3; fill: none;" />`;

							for(var pci = 0; pci < curPolyline.candidates[ci].polygons.length; pci++) {
								polygon = curPolyline.candidates[ci].polygons[pci];
								curD = '';
								for(var ppi = 0; ppi < polygon.length; ppi++) {
									if(ppi === 0) {
										curD = 'M';
									} else {
										curD += ' L';
									}
									curD += polygon[ppi].x.toFixed(3);
									curD += ','+(-polygon[ppi].y).toFixed(3);
								}
								if(!curD) {
									continue;
								}
								curD += 'z';
								this.markup.overlays += `<path d="${curD}" style="stroke-width: 0; fill: #0a05" />`;
							}
							var cLine;
							var cpLine;
							for(var cli = 0; cli < curPolyline.candidates[ci].lines.length; cli++) {
								cLine = curPolyline.candidates[ci].lines[cli];
								if(!cLine) {
									console.log(cLine);
									continue;
								}
								for(var cpli = 0; cpli < cLine.length; cpli++) {
									if(!cLine[cpli] || !cLine[cpli].p0 || !cLine[cpli].p1) {
										continue;
									}
									curD = 'M'+cLine[cpli].p0.x.toFixed(3)+','+(-cLine[cpli].p0.y).toFixed(3);
									curD += ' L'+cLine[cpli].p1.x.toFixed(3)+','+(-cLine[cpli].p1.y).toFixed(3);
									this.markup.overlays += `<path d="${curD}" style="stroke-width: .25; stroke: #0c0" />`;
								}
							}
						}
					}
				}
			}
		}
	};

	/**
	 * Renders nebula objects.
	 * @private
	 */
	SvgWriter.prototype.renderNebulae = function (settings, nebulae) {
		var tplObj, curD;
		var prevPoint, curPoint;

		for(var i = 0, len = nebulae.length; i < len; i++) {

			if(settings.renderNebulae) {
				// nebula ellipse / polygon
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
					(j > 0) && (prevPoint = nebulae[i].points[j-1]);
					if(j === 0) {
						curD += 'M' + curPoint.x.toFixed(2) + ',' + (-curPoint.y).toFixed(2);
					} else if(!prevPoint.c2 || !curPoint.c1) {
						curD += ' L' + curPoint.x.toFixed(2) + ',' + (-curPoint.y).toFixed(2);

					} else {
						prevPoint = nebulae[i].points[j-1];
						curD += ' C' + prevPoint.c2.x.toFixed(2) + ',' + (-prevPoint.c2.y).toFixed(2);
						curD += ' ' + curPoint.c1.x.toFixed(2) + ',' + (-curPoint.c1.y).toFixed(2);
						curD += ' ' + curPoint.x.toFixed(2) + ',' + (-curPoint.y).toFixed(2);
					}
				}

				this.markup.nebulae += `<path fill-rule="evenodd" class="nebula"
							data-name="${tplObj.name}"
							d="${curD}" />\n`;
			}

			// nebula label
			if(settings.renderNebulaLabels) {
				if(!nebulae[i].label.isAngledLabel) {
					tplObj = {
						x: nebulae[i].label.x.toFixed(3),
						y: (-nebulae[i].label.y).toFixed(3),
						name: nebulae[i].name,
						cls : 'nebulae-label'
					};
					this.markup.nebulaeLabels += `<text x="${tplObj.x}" y="${tplObj.y}" class="${tplObj.cls}">
						${tplObj.name}</text>\n`;
				} else {
					/*tplObj = {
						x: nebulae[i].label.pcx.toFixed(3),
						y: (-nebulae[i].label.pcy).toFixed(3),
						name: nebulae[i].name,
						cls : 'nebulae-label large'
					};
					tplObj.angle = Math.round(nebulae[i].label.angle); //-90;
					this.markup.nebulaeLabels += `<g style="transform:translate(${tplObj.x}px, ${tplObj.y}px)">
						<text style="transform:rotate(${tplObj.angle}deg)" class="${tplObj.cls}" text-anchor="middle" alignment-baseline="middle">
						${tplObj.name}</text></g>`;*/

					tplObj = {
						x : -nebulae[i].label.w * .5,
						y : -nebulae[i].label.h * .5,
						txtY : nebulae[i].label.h * .5,
						//txtY : -nebulae[i].label.h * .5,
						w : nebulae[i].label.w.toFixed(2),
						h : nebulae[i].label.h.toFixed(2),
						tx : nebulae[i].label.pcx.toFixed(3),
						ty : (-nebulae[i].label.pcy).toFixed(3),
						m : Utils.matrix2dRotate([1,0,0,1], Utils.degToRad(-nebulae[i].label.angle)),
						name: nebulae[i].name,
						cls : 'nebulae-label'
					};
					if(nebulae[i].label.isLarge) {
						tplObj.cls += ' large';
					}
					/*this.markup.nebulaeLabels += `<rect x="${tplObj.x}" y="${tplObj.y}"
						width="${tplObj.w}" height="${tplObj.h}"
						style="transform: matrix(${tplObj.m[0]},${tplObj.m[2]},${tplObj.m[1]},${tplObj.m[3]},${tplObj.tx},${tplObj.ty});  fill: #a00a"></rect>;*/
					this.markup.nebulaeLabels += `<text x="${tplObj.x}" y="${tplObj.txtY}"
						style="transform: matrix(${tplObj.m[0]},${tplObj.m[2]},${tplObj.m[1]},${tplObj.m[3]},${tplObj.tx},${tplObj.ty});"
						class="${tplObj.cls}">${tplObj.name}</text>`;
				}
				/*tplObj = {
					x : nebulae[i].label.x.toFixed(3),
					y : (-nebulae[i].label.y).toFixed(3),
					name : nebulae[i].name,
					vcx : nebulae[i].label.vcx.toFixed(3),
					vcy : (-nebulae[i].label.vcy).toFixed(3),
					pcx : nebulae[i].label.pcx.toFixed(3),
					pcy : (-nebulae[i].label.pcy).toFixed(3)
				};*/
				/*this.markup.nebulaeLabels += `<line x1="${tplObj.vcx}" y1="${tplObj.vcy}"
					x2="${tplObj.pcx}" y2="${tplObj.pcy}"
					style="stroke-width: .25px; stroke: #f00;" />`;*/

				//tplObj.angle = -90;//nebulae[i].label.l.angle;

				/*tplObj.x6 = nebulae[i].label.l.x6.toFixed(3);
				tplObj.y6 = (-nebulae[i].label.l.y6).toFixed(3);*/
				//this.markup.nebulaeLabels += `<circle cx="${tplObj.x6}" cy="${tplObj.y6}" r=".5" style="fill:red" />`;
			}
		}
	};

	/**
	 * Renders systems and cluster objects.
	 * @private
	 */
	SvgWriter.prototype.renderSystemsAndClusters = function (settings, factions, systems) {
		var tplObj;
		var fill, rgba;
		var labelCls;
		var curD;
		var dispRegEx = /D\s*\(([^\)]+)\)/g; // regex for disputed system notation: "D(CC,FS)"
		var dispReResult, dispColArr, dispCls;
		var defsMap = {};

		for(var i = 0, len = systems.length; i < len; i++) {
			if(systems[i].col === 'DUMMY') {
				continue;
			}
			fill = '#aaaaaa';
			if(factions.hasOwnProperty(systems[i].col)) {
				fill = factions[systems[i].col].color;
			}
			labelCls = '';
			dispCls = '';
			if(systems[i].col === '' || systems[i].col === 'U') {
				systems[i].col = 'U';
				fill = '#aaaaaa';
				labelCls = 'undiscovered';
			} else if(systems[i].col === 'A') {
				fill = '#000000';
				labelCls = 'abandoned';
			} else if(systems[i].col === 'I') {
				fill = '#ffffff';
				labelCls = 'independent';
			} else if(dispReResult = dispRegEx.exec(systems[i].col)) {
				dispCls = 'disputed';
				dispColArr = dispReResult[1].trim().split(/\s*,\s*/g);
				for(var di = 0; di < dispColArr.length; di++) {
					dispCls += '-'+dispColArr[di];
				}
				// generate css class and svg pattern for this disputed state
				defsMap[dispCls] = {
					css : this.createDisputedCssRule(dispCls),
					pattern : this.createDisputedPattern(dispCls, factions)
				}

			}
			// reset the regex
			dispRegEx.lastIndex = 0;

			if(systems[i].isCluster) {
				// cluster ellipse
				// Microsoft browsers do not support the hexadecimal rgba notation (#000000ff)
				// use rgba(r, g, b, a) syntax instead
				rgba = this.hexToRgba(fill + '44');
				tplObj = {
					faction : systems[i].col,
					additionalClasses : dispCls,
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
				if(settings.renderClusters) {
					this.markup.clusters += `<ellipse class="cluster ${tplObj.faction} ${tplObj.additionalClasses}"
								data-name="${tplObj.name}"
								cx="${tplObj.x}" cy="${tplObj.y}" rx="${tplObj.radiusX}" ry="${tplObj.radiusY}"
								transform="rotate(${tplObj.angle}, ${tplObj.x}, ${tplObj.y})"
								style="fill: ${tplObj.fill};"  />\n`;
				}

				if(settings.renderClusterLabels) {
					// connector
					if(systems[i].label.connector) {
						curD = 'M' + systems[i].label.connector.p1.x.toFixed(2);
						curD += ',' + (-systems[i].label.connector.p1.y).toFixed(2);
						curD += ' L' + systems[i].label.connector.p2.x.toFixed(2);
						curD += ',' + (-systems[i].label.connector.p2.y).toFixed(2);
						curD += ' L' + systems[i].label.connector.p3.x.toFixed(2);
						curD += ',' + (-systems[i].label.connector.p3.y).toFixed(2);
						this.markup.clusters += `<path d="${curD}" class="label-connector" />\n`;
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
					this.markup.systemLabels += `<text x="${tplObj.x}" y="${tplObj.y}"
											class="system-label ${tplObj.labelClass}" >
								${tplObj.name}${tplObj.sup}
								</text>\n`;
				}

			} else {
				// system circle
				tplObj = {
					faction : systems[i].col,
					additionalClasses : dispCls,
					name : systems[i].name,
					x : systems[i].centerX.toFixed(3),
					y : (-systems[i].centerY).toFixed(3),
					r : systems[i].radiusX,
					fill : fill
				};
				if(systems[i].status.toLowerCase() === 'apocryphal') {
					tplObj.additionalClasses += 'apocryphal';
				}
				if(settings.renderSystems) {
					this.markup.systems += `<circle class="system ${tplObj.faction} ${tplObj.additionalClasses}"
								data-name="${tplObj.name}" cx="${tplObj.x}" cy="${tplObj.y}" r="${tplObj.r}"
								style="fill: ${tplObj.fill}" />\n`;
				}

				if(settings.renderSystemLabels) {
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
					this.markup.systemLabels += `<text x="${tplObj.x}" y="${tplObj.y}"
											class="system-label ${tplObj.labelClass}">
								${tplObj.name}${tplObj.sup}</text>\n`;
				}
			}
		}
		// add the defs that were created along the way
		for(var dispKey in defsMap) {
			if(!defsMap.hasOwnProperty(dispKey)) {
				continue;
			}
			this.markup.css += defsMap[dispKey].css;
			this.markup.defs += defsMap[dispKey].pattern;
		}
	};

	/**
	 * Renders the minimap.
	 * @private
	 */
	SvgWriter.prototype.renderMinimap = function (settings, minimapSettings, viewRect, pxPerLy, factions) {
		var pxPerLyMinimap, minimapScale, minimapMargin;
		var tplObj;
		var borderEdges, prevEdge, curEdge;
		var rgba;
		var curD, curPoint;
		var focusedCoords;
		var nebulae;

		if(!settings.renderMinimap || !minimapSettings) {
			return;
		}

		pxPerLyMinimap = minimapSettings.dimensions.w / minimapSettings.viewRect.w;

		// add clip path for minimap content
		tplObj = {
			x : minimapSettings.viewRect.x,
			y : -minimapSettings.viewRect.y - minimapSettings.viewRect.h,
			w : minimapSettings.viewRect.w,
			h : minimapSettings.viewRect.h
		};
		this.markup.defs += `<clipPath id="minimapClip">
			<rect x="${tplObj.x}" y="${tplObj.y}"
					width="${tplObj.w}" height="${tplObj.h}" />
			</clipPath>\n`;

		// paint minimap
		minimapScale = pxPerLyMinimap / pxPerLy;
		minimapMargin = 10 / pxPerLy;

		tplObj = {
			x: viewRect.x + viewRect.w - minimapSettings.viewRect.w * minimapScale - minimapMargin,
			y: -viewRect.y - minimapSettings.viewRect.h * minimapScale - minimapMargin
		}
		this.markup.minimap = `<g class="minimap-outer" transform="translate(${tplObj.x}, ${tplObj.y}) scale(${minimapScale})">\n`;
		this.markup.minimap += `<rect x="0" y="0"
				width="${minimapSettings.viewRect.w}" height="${minimapSettings.viewRect.h}"
				style="fill: #fff" />\n`;

		tplObj = {
			tX : -minimapSettings.viewRect.x,
			tY : minimapSettings.viewRect.y + minimapSettings.viewRect.h
		};
		this.markup.minimap += `<g class="minimap-inner" clip-path="url(#minimapClip)"
								transform="translate(${tplObj.tX}, ${tplObj.tY})">\n`;

		// iterate over factions and add state areas
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
			this.markup.minimap += `<path fill-rule="evenodd" class="border ${faction}"
					style="stroke: ${tplObj.stroke}; stroke-width:2px; fill:${tplObj.fill};"
					d="${curD}" />\n`;
		}

		// iterate over nebulae
		nebulae = minimapSettings.nebulae || [];
		for(var i = 0, len = nebulae.length; i < len; i++) {
			// nebula ellipse / polygon
			tplObj = {
				name : nebulae[i].name,
				x : nebulae[i].centerX.toFixed(3),
				y : (-nebulae[i].centerY).toFixed(3),
				rx : nebulae[i].w*.5,
				ry : nebulae[i].h*.5
			};

			curD = '';
			for(var j = 0, jlen = nebulae[i].allPoints.length; j <= jlen; j++) {
				curPoint = nebulae[i].allPoints[j % jlen];
				if(j === 0) {
					curD += 'M' + curPoint.x.toFixed(1) + ',' + (-curPoint.y).toFixed(1);
				} else {
					curD += ' L' + curPoint.x.toFixed(1) + ',' + (-curPoint.y).toFixed(1);
				}
			}

			this.markup.minimap += `<path fill-rule="evenodd" class="nebula"
						data-name="${tplObj.name}"
						d="${curD}" />\n`;
		}

		// map cutout rectangle
		tplObj = {
			x: viewRect.x,
			y: -viewRect.y - viewRect.h,
			w: viewRect.w,
			h: viewRect.h
		};
		this.markup.minimap += `<rect x="${tplObj.x}" y="${tplObj.y}" width="${tplObj.w}" height="${tplObj.h}"
							style="fill: none; stroke: #fff; stroke-width: 10;" />\n`;
		this.markup.minimap += `<rect x="${tplObj.x}" y="${tplObj.y}" width="${tplObj.w}" height="${tplObj.h}"
							style="fill: none; stroke: #a00; stroke-width: 3;" />\n`;

		// Terra indicator
		focusedCoords = [viewRect.x+viewRect.w*.5,-viewRect.y-viewRect.h*.5];
		if(Utils.pointInRectangle({x:0, y:0}, minimapSettings.viewRect)) {
			/*els.minimap += '<circle cx="0" cy="0" r="8" style="fill: transparent; stroke: #fff; stroke-width: 8;" />'
			els.minimap += '<circle cx="0" cy="0" r="20" style="fill: transparent; stroke: #fff; stroke-width: 8;" />'
			els.minimap += '<circle cx="0" cy="0" r="8" style="fill: transparent; stroke: #000; stroke-width: 3;" />'
			els.minimap += '<circle cx="0" cy="0" r="20" style="fill: transparent; stroke: #000; stroke-width: 3;" />'*/
			//els.minimap += '<circle cx="0" cy="0" r="32" style="fill: transparent; stroke: #000; stroke-width: 3;" />'
		} else {
			// line to origin
			/*var lineToOrigin = Utils.lineFromPoints(focusedCoords, [0,0]);
			var distToOrigin = Utils.distance(focusedCoords[0], focusedCoords[1], 0, 0);*/

			/*var p1, p2;
			var rTop = -minimapSettings.viewRect.y - minimapSettings.viewRect.h;
			var rRight = minimapSettings.viewRect.x + minimapSettings.viewRect.w;
			var rBottom = -minimapSettings.viewRect.y;
			var rLeft = minimapSettings.viewRect.x;*/

			// closest perimeter point from origin
			var periPoint = Utils.getClosestPointOnRectanglePerimeter({x:0,y:0}, minimapSettings.viewRect);
			var pPointDist = Utils.distance(periPoint.x, periPoint.y, 0, 0);

			var angle = Utils.angleBetweenVectors([1,0], [periPoint.x, periPoint.y]);
			// differentiate whether the focused point lies below the y = 0 line to get the true 360° angle
			if(periPoint.y > 0) {
				angle = Math.PI * 2 - angle;
			}

			// arrow towards origin
			tplObj = {
				tX : periPoint.x.toFixed(2),
				tY : (-periPoint.y).toFixed(2),
				rot : Utils.radToDeg(angle).toFixed(2)
			};
			this.markup.minimap += `<g transform="translate(${tplObj.tX}, ${tplObj.tY}) rotate(${tplObj.rot})">
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

			this.markup.minimap += `<text x="${tplObj.x}" y="${tplObj.y}">
								<tspan>Terra</tspan>
								${tplObj.distStr}
							</text>\n`;
		}

		// close minimap inner container
		this.markup.minimap += `</g>\n`;

		// frame around the minimap
		tplObj = {
			w : minimapSettings.viewRect.w + 10,
			h : minimapSettings.viewRect.h + 10
		};
		this.markup.minimap += `<rect x="-5" y="-5" width="${tplObj.w}" height="${tplObj.h}"
					style="fill: none; stroke: #000; stroke-width: 10;" />\n`;

		// close minimap outer container
		this.markup.minimap += `</g>`;
	};

	/**
	 * Renders the scale help.
	 * @private
	 */
	SvgWriter.prototype.renderScaleHelp = function (settings, viewRect, pxPerLy) {
		var scaleMargin = 10 / pxPerLy;
		var tplObj = {
			tX  : viewRect.x + scaleMargin,
			tY  : -viewRect.y - 1.5 - scaleMargin,
			t10 : 10 - 1.365,
			t20 : 20 - 1.365,
			t30 : 30 - 1.365,
			t40 : 40 - 1.365,
			t50 : 50 - 1.365
		};

		if(!settings.renderScaleHelp) {
			return;
		}
		this.markup.scaleHelp = `<g transform="translate(${tplObj.tX}, ${tplObj.tY})">
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
	};

	/**
	 * @param c {Object} The center point of all jump rings
	 * @param jumpRingDistances {Array} The distances to paint jump rings at
	 * @private
	 */
	SvgWriter.prototype.renderJumpRings = function (settings, viewRect, jumpRingDistances) {
		var tplObj;
		if(!settings.renderJumpRings || !viewRect || !jumpRingDistances) {
			return;
		}
		tplObj = {
			cx: (viewRect.x + viewRect.w * .5).toFixed(3),
			cy: (-viewRect.y - viewRect.h * .5).toFixed(3)
		};
		for(var i = 0; i < jumpRingDistances.length; i++) {
			tplObj.r = jumpRingDistances[i];
			this.markup.jumpRings += `<circle cx="${tplObj.cx}" cy="${tplObj.cy}" r="${tplObj.r}" />\n`;
		}
	};

	/**
	 * @private
	 */
	SvgWriter.prototype.createDisputedCssRule = function (dispCls) {
		return `g.systems .system.${dispCls} { fill: url('#${dispCls}-fill') !important; }\n`;
	};

	/**
	 * @private
 	 */
	SvgWriter.prototype.createDisputedPattern = function (dispCls, factions) {
		var p, pctEachSlice, curFaction, factionColor;
		var paths = '';
		var dispParts = dispCls.split('-');
		var curPct = 0;
		var startPt, endPt;
		pctEachSlice = 1 / (dispParts.length - 1);

		for(var i = 1, len = dispParts.length; i < len; i++) {
			curFaction = factions[dispParts[i]];
			factionColor = curFaction.color || '#000';
			startPt = Utils.pointOnUnitCircleWithPercentValue(curPct);
			curPct += pctEachSlice;
			endPt = Utils.pointOnUnitCircleWithPercentValue(curPct);
			paths += `<path d="M${startPt.x},${startPt.y} A1,1,0,0,1,${endPt.x},${endPt.y} L0,0"
						style="fill:${factionColor}; stroke-width: 0;" />\n`;
		}
		//'<path d="M1,0 A1,1,0,0,1,x,y L0,0 " style="fill:#f00; stroke-width: 0;" />';
		return `<pattern id="${dispCls}-fill" width="1" height="1" viewBox="-1 -1 2 2">
			<g style="transform:rotate(-90deg)">
				${paths}
			</g>
		</pattern>`;
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
