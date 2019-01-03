module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');
    var RectangleGrid = require('./RectangleGrid.js');

	/**
	 * An instance of this class uses a heuristic algorithm in order to place labels
     * on a canvas with minimal overlap.
	 *
	 * Algorithm idea:
	 * While going from right to left and greedily picking the first 0-collision label position:
	 * - try label positions directly right, above, below, left of the system, with r/1.5 units of tolerance (adjust for detected collision)
	 * - try collision-adjusted positions right, above, below, left beyond tolerance up to maximum adjustment range
	 * - if none of the position options can be used without collision, choose option with lowest collision value
	 * - positions outside the viewRect are completely invalid
	 *
	 * Note that coordinate system origin is considered to be bottom left. Each rectangle's origin is also
	 * at the rectangle's bottom left corner.
	 */
	var LabelManager = function (logger) {
        this.logger = logger || console;
	};

	LabelManager.prototype.constructor = LabelManager;

    /**
     * Initializes this object.
     *
     * @param viewRect {Object} The visible rectangle {x, y, w, h}
     * @param objects {Array} List of objects that need to be labelled. Required properties: x, y, name, col (=faction)
     * @param objectRadius {Number} Radius of a single object node
     * @param ellipticalObjects {Array} List of non-standard, elliptical objects
     * @param objLabelDist {Number} Empty space between an object node and its text label
     * @param glyphSettings {Object} Several settings such as default width and height, and specific glyph widths
     * @param factions {Object} Key-value map of the available factions
	 * @param labelConfig {Object} Config object for manual label placement
     * @returns {LabelManager} this object
     */
    LabelManager.prototype.init = function (viewRect, objects, objectRadius, ellipticalObjects, objLabelDist,
			factions, labelConfig) {
        this.viewRect = viewRect || {x: 0, y: 0, w: 0, h: 0};
        this.objects = Utils.deepCopy(objects || []);
        this.objectRadius = objectRadius || 1;
        this.ellipticalObjects = Utils.deepCopy(ellipticalObjects || []);
        this.objLabelDist = objLabelDist || 0;
        this.factions = Utils.deepCopy(factions);
		this.labelConfig = labelConfig || {};
		this.glyphSettings = labelConfig._glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };
        // cannot really determine why, but there seems to be a .5 shift required
        // for the labels to be at the correct y position
        this.defaultDelta = { x: 0, y: .5 };

        this.grid = new RectangleGrid().init(viewRect);
        this.setInitialState();
        this.run();
        return this;
    };

    /**
     * Instantiates the labels and adds all objects and labels to the grid.
     * Also generates faction centroids.
     * @private
     */
    LabelManager.prototype.setInitialState = function () {
        var curObj;
        var curFaction;
        var centerPoint;
        var closestPoint;
        var viewRectCenter, centroid;
        this.orderedObjIndices = [];

        // private helper function that generates a label object
        var generateLabelRect = function (obj, objIdx, isElliptical) {
            var objRad = this.objectRadius;
            var dist = this.objLabelDist;
            var lineH = this.glyphSettings.lineHeight;
            var defaultWidth = this.glyphSettings.widths.default;
            var labelWidth = 0;
            var labelId;
			var x, y;
			var sup;
            for(var i = 0; i < obj.name.length; i++) {
                labelWidth += this.glyphSettings.widths[obj.name[i]] || defaultWidth;
            }
			if((obj.status || '').toLowerCase() === 'apocryphal') {
				sup = '(apocryphal)';
				labelWidth += this.glyphSettings.widths[' '] || defaultWidth;
				for(var i = 0; i < sup.length; i++) {
					labelWidth += .6 * this.glyphSettings.widths[sup[i]] || defaultWidth;
				}
			}

            labelId = 'label_';
            if(!isElliptical) {
                x = obj.centerX + objRad + dist;
            } else {
                x = obj.centerX + obj.w * .5 + dist;
                labelId += 'e_';
            }
            y = obj.centerY - lineH * .5;
            // make sure label is in view rect
			x = Utils.clampNumber(x, this.viewRect.x, this.viewRect.x + this.viewRect.w - labelWidth);
			y = Utils.clampNumber(y, this.viewRect.y + lineH, this.viewRect.y + this.viewRect.h - lineH);
            return {
                id: labelId + objIdx,
                o: obj,
                x: x,
                y: y,
                w: labelWidth,
                h: lineH
            }
        };

        for(var i = 0, len = this.objects.length; i < len; i++) {
            this.orderedObjIndices.push(i);
            curObj = this.objects[i];
            curObj.centerX = curObj.x;
            curObj.centerY = curObj.y;
            curObj.x = curObj.x - this.objectRadius * curObj.radiusX;
            curObj.y = curObj.y - this.objectRadius * curObj.radiusY;
            curObj.w = curObj.h = this.objectRadius * curObj.radiusY * 2;
            curObj.id = 'obj_'+i;
            curObj.label = generateLabelRect.call(this, curObj, i);

			if(!curObj.isCluster) {
				this.grid.placeObject(curObj);
			}
            this.grid.placeObject(curObj.label);

			if(curObj.hasOwnProperty('col')) {
                curFaction = this.factions[curObj.col];
                if(curFaction) {
                    curFaction.centroidSums = curFaction.centroidSums || {x:0,y:0};
					curFaction.centroidSums.x += curObj.centerX;
					curFaction.centroidSums.y += curObj.centerY;
					curFaction.numObj = (curFaction.numObj || 0) + 1;
					curFaction.centerX = curFaction.centroidSums.x / curFaction.numObj;
					curFaction.centerY = curFaction.centroidSums.y / curFaction.numObj;
				}
            }
        }

        for(var i = 0, len = this.ellipticalObjects.length; i < len; i++) {
            curObj = this.ellipticalObjects[i];
            viewRectCenter = { x: this.viewRect.x + this.viewRect.w * .5, y:  this.viewRect.y + this.viewRect.h * .5 };
            curObj.centerX = curObj.x + curObj.w * .5;
            curObj.centerY = curObj.y + curObj.h * .5;
            curObj.id = 'obj_e_' + i;
            curObj.label = generateLabelRect.call(this, curObj, i, true);
			if(curObj.w > 30 || curObj.h > 30) {
				if(Utils.convexPolygonArea(curObj.points) > 800) {
					curObj.label.isLarge = true;
					curObj.label.h *= 1.6;
					curObj.label.w *= 1.6;
                }

				centroid = Utils.polygonCentroid(curObj.points);

				// prevent nebula labels in the view box's center:
				// check if label distance is at least 25% the view rect's width from center
				var minDist = this.viewRect.w * .16;
				if(Utils.distance(centroid.x, centroid.y, viewRectCenter.x, viewRectCenter.y) < minDist) {
					// distance is too small to be comfortable --> move label toward nebula's center
					var moveVect = [curObj.centerX - centroid.x, curObj.centerY - centroid.y];
					if(moveVect[0] == 0 || moveVect[1] == 0) {
						moveVect[1] = 1;
					}
					Utils.scaleVector2d(moveVect, minDist);
					centroid.x += moveVect[0];
					centroid.y += moveVect[1];
					//curObj.label.baseAngle = 90;
				}

                // large label
                curObj.label.vcx = viewRectCenter.x;
                curObj.label.vcy = viewRectCenter.y;
                curObj.label.pcx = centroid.x;
                curObj.label.pcy = centroid.y;
                curObj.label.lx = centroid.x - curObj.label.w * .5;
                curObj.label.ly = centroid.y - curObj.label.h * .5;
                curObj.label.x = curObj.label.lx;
                curObj.label.y = curObj.label.ly;
				curObj.label.isAngledLabel = true;

				curObj.label.baseAngle = Utils.radToDeg(
					Utils.angleBetweenVectors([1, 0],[centroid.x-viewRectCenter.x, centroid.y-viewRectCenter.y])
				);
                if(curObj.label.baseAngle <= 35 || curObj.label.baseAngle >= 145) {
				//if(curObj.label.baseAngle <= 50 || curObj.label.baseAngle >= 140) {

                    if(viewRectCenter.y < centroid.y) {
                        // centroid is above the viewBox's center
                        curObj.label.angle = 90 - curObj.label.baseAngle;
                    } else { // if(viewRectCenter.y > centroid.y) {
                        // centroid is below the viewBox's center
                        curObj.label.angle = -90 + curObj.label.baseAngle;
                    }
                } else if(curObj.label.baseAngle <= 55 || curObj.label.baseAngle >= 125) {
                    if( (viewRectCenter.x < centroid.x && viewRectCenter.y > centroid.y)
                        || (viewRectCenter.x > centroid.x && viewRectCenter.y < centroid.y) ) {
                        curObj.label.angle = -70;
                    } else {
                        curObj.label.angle = 70;
                    }
                } else {
                    curObj.label.angle = 0;
                }
            } else {
				// use regular system-style labels
            }
        }
    };

    /**
     * @private
     */
    LabelManager.prototype.keepInViewRect = function (obj) {
        obj.x = Utils.clampNumber(obj.x, this.viewRect.x, this.viewRect.x + this.viewRect.w - obj.w);
        obj.y = Utils.clampNumber(obj.y, this.viewRect.y, this.viewRect.y + this.viewRect.h - obj.h);
    };

    /**
     * @private
     */
    LabelManager.prototype.getOverlapData = function (label) {
        var ret = {
            minX : Infinity,
            maxX : -Infinity,
            minY : Infinity,
            maxY : -Infinity,
            area : 0
        };
        var overlaps = this.grid.getOverlaps(label);
        for(var i = 0, len = overlaps.length; i < len; i++) {
            // ignore other labels to the left of the current label (yet to be processed)
            if(overlaps[i].hasOwnProperty('o') && overlaps[i].o.x < label.o.x) {
                continue;
            }
            ret.minX = Math.min(ret.minX, overlaps[i].x);
            ret.maxX = Math.max(ret.maxX, overlaps[i].x + overlaps[i].w);
            ret.minY = Math.min(ret.minY, overlaps[i].y);
            ret.maxY = Math.max(ret.maxY, overlaps[i].y + overlaps[i].h);
            ret.area += Utils.rectanglesOverlap(label, overlaps[i]);
        }

        return ret;
    };

    /**
     * Places an object's label, either according to a manual configuration
     * or automatically.
     *
     * @param obj {Object} The object whose label to place
     */
	LabelManager.prototype.determineLabelPositionFor = function (obj) {
		var manualArr = this.labelConfig[obj.name];

        if(manualArr && manualArr.length > 0) {
    		for(var i = 0; i < manualArr.length; i++) {
    			this.applyManualConfig(obj, manualArr[i]);
    			if(true) {
    				break;
    			}
    		}
            return;
        } else {
            this.applyAutomaticPlacement(obj);
        }
	};

	/**
     * Places a label according to the passed manual configuration object.
	 * @private
	 */
	LabelManager.prototype.applyManualConfig = function (obj, config) {
		var dist = this.objLabelDist;
		var position = Utils.deepCopy(config.position);
		var anchor = config.anchor;
		var connPoint, isecPoint, labelEdgePoint;

		// position shorthands
		if(typeof position.x === 'string') {
			if(position.x === 'left') {
				position.x = obj.centerX - obj.radiusX - dist;
			} else if(position.x === 'center') {
				position.x = obj.centerX;
			} else if(position.x === 'right') {
				position.x = obj.centerX + obj.radiusX + dist;
			} else {
				this.logger.warn(`label config for ${obj.name}: x position shorthand "${position.x}" is unknown`);
			}
		}
		if(typeof position.y === 'string') {
			if(position.y === 'top') {
				position.y = obj.centerY + obj.radiusY + dist * .5;
			} else if(position.y === 'center') {
				position.y = obj.centerY;
			} else if(position.y === 'bottom') {
				position.y = obj.centerY - obj.radiusY - dist * .5;
			} else {
				this.logger.warn(`label config for ${obj.name}: y position shorthand "${position.y}" is unknown`);
			}
		}
		// anchor shorthands
		if(typeof anchor.x === 'string') {
			if(anchor.x === 'center') {
				position.x -= obj.label.w * .5;
			} else if(anchor.x === 'right') {
				position.x -= obj.label.w;
			}
		}
		if(typeof anchor.y === 'string') {
			if(anchor.y === 'center') {
				position.y -= obj.label.h * .5;
			} else if(anchor.y === 'top') {
				position.y -= obj.label.h;
			}
		}

		obj.label.x = position.x + position.dx + this.defaultDelta.x;
		obj.label.y = position.y + position.dy + this.defaultDelta.y;

		// connector
		if(config.connector) {
			connPoint = {
				x: obj.centerX + config.connector.dx || 0,
				y: obj.centerY + config.connector.dy || 0
			};
			isecPoint = Utils.getClosestPointOnEllipsePerimeter(connPoint, obj);

            if(obj.label.y <= connPoint.y && obj.label.y + obj.label.h >= connPoint.y) {
                labelEdgePoint = {
                    x: obj.label.x + obj.label.w + dist,
                    y: connPoint.y
                };
                if(obj.label.x > connPoint.x) {
                    labelEdgePoint.x = obj.label.x - dist;
                }
            } else if(obj.label.x <= connPoint.x && obj.label.x + obj.label.w >= connPoint.x) {
                labelEdgePoint = {
                    x: connPoint.x,
                    y: obj.label.y + obj.label.h + dist * .5
                };
                if(obj.label.y > connPoint.y) {
                    labelEdgePoint.y = obj.label.y - dist;
                }
            } else {
                labelEdgePoint = Utils.getClosestPointOnRectanglePerimeter(connPoint, obj.label);
            }


			obj.label.connector = {
				p1: labelEdgePoint,
				p2: connPoint,
				p3: isecPoint
			};
		}
	};

    /**
     * Places a label at the best possible position.
     * TODO This function is very repetitive. It should be possible to extract and modularize the repeated logic.
     *
     * @param obj {Object} The object whose label needs to be placed
     * @returns {Number} The overlapped area's size (in square units) for the label's best position
     * @private
     */
    LabelManager.prototype.findBestLabelPositionFor = function (obj) {
        var label = obj.label;
        var objRad = this.objectRadius;
        var dist = this.objLabelDist;
        var opt1, opt2, tmp;
        var overlaps;
        var curOverlap, minOverlap;
        var minOverlapX, minOverlapY;
        var ovData;

        var evaluateCurrentPos = function () {
            this.keepInViewRect(label);
            ovData = this.getOverlapData(label);
            curOverlap = ovData.area;
            if(curOverlap < 0.1) {
                curOverlap = 0;
            }
            if(curOverlap < minOverlap) {
                minOverlap = curOverlap;
                minOverlapX = label.x;
                minOverlapY = label.y;
            }
        };

		minOverlap = Infinity;

		// check position centered to the right
        minOverlapX = label.x = obj.centerX + objRad + dist + this.defaultDelta.x;
        minOverlapY = label.y = obj.centerY - label.h * .5 + this.defaultDelta.y;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // if initial position overlaps, check alternatives on the right side, small tolerance
        // push label up
        opt1 = Math.min(ovData.maxY, obj.centerY) + dist;// + obj.h * 0.375);
        // push label down
        opt2 = Math.max(ovData.minY - label.h, obj.centerY - label.h) - dist; //- obj.h * 0.375 - label.h);

        // if down direction is closer, swap options order
        if(obj.centerY - ovData.minY < ovData.maxY - obj.centerY) {
            tmp = opt1;
            opt1 = opt2;
            opt2 = tmp;
        }

        label.y = opt1;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        label.y = opt2;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check position above
        label.x = obj.centerX - label.w * 0.5 + this.defaultDelta.x;
        label.y = obj.y + obj.h + dist * 0.5 + this.defaultDelta.y;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check alternatives above
        // push label right
        opt1 = Math.min(ovData.maxX + dist, obj.x);
        // push label left
        opt2 = Math.max(ovData.minX - dist, obj.x + obj.w - label.w);

        label.x = opt1;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }
        label.x = opt2;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check position below
        label.x = obj.centerX - label.w * 0.5 + this.defaultDelta.x;
        label.y = obj.y - label.h - dist * 0.5 + this.defaultDelta.y;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check alternatives below
        // push label right
        opt1 = Math.min(ovData.maxX + dist * 2, obj.x);
        // push label left
        opt2 = Math.max(ovData.minX - label.w - dist, obj.x + obj.w - label.w);

        label.x = opt1;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }
        label.x = opt2;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check left side
        label.x = obj.x - label.w - dist * 1.5 + this.defaultDelta.x;// * 0.25;
        label.y = obj.centerY - label.h * 0.5 + this.defaultDelta.y;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check alternatives on the left side, small tolerance
        // push label up
        opt1 = Math.min(ovData.maxY, obj.centerY) + dist;// + obj.h * 0.375);
        // push label down
        opt2 = Math.max(ovData.minY - label.h, obj.centerY - label.h) - dist; //- obj.h * 0.375 - label.h);

        // if down direction is closer, swap options order
        if(obj.centerY - ovData.minY < ovData.maxY - obj.centerY) {
            tmp = opt1;
            opt1 = opt2;
            opt2 = tmp;
        }

        label.y = opt1;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        label.y = opt2;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check alternatives on the right side, large tolerance
        label.x = obj.centerX + objRad + dist + this.defaultDelta.x;
        label.y = obj.centerY - label.h * .5 + this.defaultDelta.y;
        evaluateCurrentPos.call(this);

        // push label up
        opt1 = Math.min(ovData.maxY, obj.centerY + obj.h) + dist;
        // push label down
        opt2 = Math.max(ovData.minY - label.h, obj.centerY - obj.h - label.h)  - dist;

        // if down direction is closer, swap options order
        if(obj.centerY - ovData.minY < ovData.maxY - obj.centerY) {
            tmp = opt1;
            opt1 = opt2;
            opt2 = tmp;
        }

        label.y = opt1;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        label.y = opt2;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check alternatives on the left side, large tolerance
        label.x = obj.x - label.w - dist + this.defaultDelta.x;
        label.y = obj.centerY - label.h * .5 + this.defaultDelta.y;
        evaluateCurrentPos.call(this);

        // push label up
        opt1 = Math.min(ovData.maxY + dist, obj.centerY + obj.h);
        // push label down
        opt2 = Math.max(ovData.minY - label.h - dist, obj.centerY - obj.h - label.h);

        // if down direction is closer, swap options order
        if(obj.centerY - ovData.minY < ovData.maxY - obj.centerY) {
            tmp = opt1;
            opt1 = opt2;
            opt2 = tmp;
        }

        label.y = opt1;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        label.y = opt2;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // no overlap-free option found. Use option with minimal overlap.
        label.x = minOverlapX;
        label.y = minOverlapY;

		this.logger.log('overlapping label: "'+obj.name+'" for ' + minOverlap + ' units.');
        return minOverlap;
    };

    /**
     *
     */
    LabelManager.prototype.findBestLabelPositionForEllipticalObj = function (obj) {
        var label = obj.label;
        var dist = this.objLabelDist * 2;
        var opt1, opt2, tmp;
        var overlaps;
        var curOverlap, minOverlap;
        var minOverlapX, minOverlapY;
        var ovData;

        var evaluateCurrentPos = function () {
            this.keepInViewRect(label);
            ovData = this.getOverlapData(label);
            curOverlap = ovData.area;
            if(curOverlap < 0.1) {
                curOverlap = 0;
            }
            if(curOverlap < minOverlap) {
                minOverlap = curOverlap;
                minOverlapX = label.x;
                minOverlapY = label.y;
            }
        };

        minOverlap = Infinity;

		// check position centered to the right
        minOverlapX = label.x = obj.x + obj.w + dist;
        minOverlapY = label.y = obj.centerY - label.h * .5;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        /*
        // if initial position overlaps, check alternatives on the right side, small tolerance
        // push label up
        opt1 = Math.min(ovData.maxY, obj.centerY) + dist;// + obj.h * 0.375);
        // push label down
        opt2 = Math.max(ovData.minY - label.h, obj.centerY - label.h) - dist; //- obj.h * 0.375 - label.h);

        // if down direction is closer, swap options order
        if(obj.centerY - ovData.minY < ovData.maxY - obj.centerY) {
            tmp = opt1;
            opt1 = opt2;
            opt2 = tmp;
        }

        label.y = opt1;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        label.y = opt2;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }*/

        // check position below
        label.x = obj.centerX - label.w * 0.5;
        label.y = obj.y - label.h - dist * .5;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check position above
        label.x = obj.centerX - label.w * 0.5;
        label.y = obj.y + obj.h + dist * .5;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // check position to the left
        label.x = obj.x - label.w - dist;
        label.y = obj.centerY - label.h * .5;
        evaluateCurrentPos.call(this);
        if(curOverlap === 0) {
            return 0;
        }

        // no overlap-free option found. Use option with minimal overlap.
        label.x = minOverlapX;
        label.y = minOverlapY;

		this.logger.log('overlapping label: "'+obj.name+'" for ' + minOverlap + ' units.');
        return minOverlap;
    };

    /**
     * Executes the label placement algorithm.
     * @private
     */
    LabelManager.prototype.run = function () {
        var curObj, curLabel;
        var overlaps;
        var minY, maxY;
        var curOverlap, minOverlap;
        var minOverlapX, minOverlapY;
        var positionSequence;
        var attempts;
        var curPos;

        this.orderedObjIndices.sort(function(a, b) {
            return this.objects[b].x - this.objects[a].x;
        }.bind(this));

        for(var i = 0, len = this.orderedObjIndices.length; i < len; i++) {
            curObj = this.objects[this.orderedObjIndices[i]];
            this.grid.unplaceObject(curObj.label);
			if(this.labelConfig.hasOwnProperty(curObj.name)) {
				this.determineLabelPositionFor(curObj);
			} else {
				this.findBestLabelPositionFor(curObj);
			}
            this.grid.placeObject(curObj.label);
        }

        // place elliptical objects (secondary pass, regular object labels should disregard these)
        for(var i = 0, len = this.ellipticalObjects.length; i < len; i++) {
            curObj = this.ellipticalObjects[i];

            this.grid.placeObject(curObj);
            this.findBestLabelPositionForEllipticalObj(curObj);
            this.grid.placeObject(curObj.label);
        }
    };

    /**
     * Generates and places faction labels
     */
    LabelManager.prototype.placeFactionLabels = function () {
        var curFaction;
        for(var faction in this.factions) {
            curFaction = this.factions[faction];
        }
    };

    return LabelManager;
})();
