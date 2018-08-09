module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');
    var RectangleGrid = require('./RectangleGrid.js');

	/**
	 * An instance of this class uses a heuristic algorithm in order to place labels
     * on a canvas with minimal overlap.
	 *
	 * Algorithm idea:
	 * - While going from right to left and greedily picking the first 0-collision label position:
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
     * @param objLabelDist {Number} Empty space between an object node and its text label
     * @param glyphSettings {Object} Several settings such as default width and height, and specific glyph widths
     * @param factions {Object} Key-value map of the available factions
     * @returns {LabelManager} this object
     */
    LabelManager.prototype.init = function (viewRect, objects, objectRadius, objLabelDist, glyphSettings, factions) {
        this.viewRect = viewRect || {x: 0, y: 0, w: 0, h: 0};
        this.objects = Utils.deepCopy(objects || []);
        this.objectRadius = objectRadius || 1;
        this.objLabelDist = objLabelDist || 0;
        this.glyphSettings = glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };
        this.factions = Utils.deepCopy(factions);

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
        this.orderedObjIndices = [];

        // private helper function
        var generateLabelRect = function (obj, objIdx) {
            var objRad = this.objectRadius;
            var dist = this.objLabelDist;
            var lineH = this.glyphSettings.lineHeight;
            var defaultWidth = this.glyphSettings.widths.default;
            var labelWidth = 0;
			var x, y;
            for(var i = 0; i < obj.name.length; i++) {
                labelWidth += this.glyphSettings.widths[obj.name[i]] || defaultWidth;
            }

			x = obj.centerX + objRad + dist;
			y = obj.centerY - lineH * .5;
			x = Math.max(this.viewRect.x, Math.min(x, this.viewRect.x + this.viewRect.w - labelWidth));
			y = Math.max(this.viewRect.y + lineH, Math.min(y, this.viewRect.y + this.viewRect.h - lineH));
            return {
                id: 'label_'+objIdx,
                o: obj,
                x: x,//obj.centerX + objRad + dist,
                y: y,//obj.centerY - lineH * .5,
                w: labelWidth,
                h: lineH
            }
        };

        for(var i = 0, len = this.objects.length; i < len; i++) {
            this.orderedObjIndices.push(i);
            curObj = this.objects[i];
            curObj.centerX = curObj.x;
            curObj.centerY = curObj.y;
            curObj.x = curObj.x - this.objectRadius;
            curObj.y = curObj.y - this.objectRadius;
            curObj.w = curObj.h = this.objectRadius * 2;
            curObj.id = 'obj_'+i;
            curObj.label = generateLabelRect.call(this, curObj, i);

            this.grid.placeObject(curObj);
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

        // initially place label centered to the right
        minOverlap = Infinity;
        minOverlapX = label.x = obj.centerX + objRad + dist;
        minOverlapY = label.y = obj.centerY - label.h * .5;
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
        label.x = obj.centerX - label.w * 0.5;
        label.y = obj.y + obj.h + dist * 0.5;
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
        label.x = obj.centerX - label.w * 0.5;
        label.y = obj.y - label.h - dist * 0.5;
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
        label.x = obj.x - label.w - dist;// * 0.25;
        label.y = obj.centerY - label.h * 0.5;
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
        label.x = obj.centerX + objRad + dist;
        label.y = obj.centerY - label.h * .5;
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
        label.x = obj.x - label.w - dist;
        label.y = obj.centerY - label.h * .5;
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
            this.findBestLabelPositionFor(curObj);
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
