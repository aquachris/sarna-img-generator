module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');
    var RectangleGrid = require('./RectangleGrid.js');

	/**
	 * An instance of this class uses a heuristic algorithm
	 * in order to place labels on a canvas with minimal overlap.
	 */
	var LabelManager = function (logger) {
        this.logger = logger || console;
	};

	LabelManager.prototype.constructor = LabelManager;

    /**
     * Default label position preference values
     * Indices:
     * 7 | 0 | 1
     * 6 | X | 2
     * 5 | 4 | 3
     */
    LabelManager.POSITIONS = [
        0.25, 0.4, 0.0, 0.5, 0.6, 0.8, 0.5, 0.8
    ];
/*        n: 0.25,
        ne: 0.4,
        e: 0.0,
        se: 0.5,
        s: 0.6,
        sw: 0.8,
        w: 0.5,
        nw: 0.8
    };*/

    /**
     * Initializes this object.
     *
     * @param viewRect {Object} The visible rectangle {x, y, w, h}
     * @param objects {Array} List of objects that need to be labelled
     * @param objectRadius {Number} Radius of a single object node
     * @param objLabelDist {Number} Empty space between an object node and its text label
     * @param glyphSettings {Object} Several settings such as default width and height, and specific glyph widths
     * @param positionPrefs {Object} Position preferences in the same form as LabelManager.POSITIONS
     * @returns {LabelManager} this object
     */
    LabelManager.prototype.init = function (viewRect, objects, objectRadius, objLabelDist, glyphSettings, positionPrefs) {
        this.viewRect = viewRect || {x: 0, y: 0, w: 0, h: 0};
        this.objects = Utils.deepCopy(objects || []);
        this.objectRadius = objectRadius || 1;
        this.objLabelDist = objLabelDist || 0;
        this.glyphSettings = glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };
        this.labels = [];

        this.grid = new RectangleGrid().init(viewRect);
        this.setInitialState();
        return this;
    };

    // - find out all *potential* overlap situations
    //

    LabelManager.prototype.setInitialState = function () {
        var curObj;

        // private helper function
        var generateLabelRect = function (o, i, pos) {
            var oRad = this.objectRadius;
            var dist = this.objLabelDist;
            var lineH = this.glyphSettings.lineHeight;
            var xDelta = 0, yDelta = 0;

            var labelWidth = 0;
            var defaultWidth = this.glyphSettings.widths.default;
            for(var i = 0; i < o.name.length; i++) {
                labelWidth += this.glyphSettings.widths[o.name[i]] || defaultWidth;
            }
            switch(pos) {
                case 0:
                    xDelta = -labelWidth*.5;
                    yDelta = oRad + dist + lineH;
                    break;
                case 1:
                    xDelta = oRad + dist;
                    yDelta = oRad + dist + lineH;
                    break;
                case 2:
                    xDelta = oRad + dist;
                    yDelta = lineH *.5;
                    break;
                case 3:
                    xDelta = oRad + dist;
                    yDelta = -oRad - dist
                    break;
                case 4:
                    xDelta = -labelWidth * .5;
                    yDelta = -oRad - dist
                    break;
                case 5:
                    xDelta = -oRad - dist - labelWidth;
                    yDelta = -oRad - dist
                    break;
                case 6:
                    xDelta = -oRad - dist - labelWidth;
                    yDelta = lineH * .5;
                    break;
                case 7:
                    xDelta = -oRad - dist - labelWidth;
                    yDelta = oRad + dist + lineH;
                    break;
            }

            return {
                id: 'label_'+i+'_'+pos,
                o: o,
                pos: pos,
                x: o.centerX + xDelta,
                y: o.centerY + yDelta,
                w: labelWidth,
                h: lineH
            }
        };

        for(var i = 0, len = this.objects.length; i < len; i++) {
            curObj = this.objects[i];
            curObj.centerX = curObj.x;
            curObj.centerY = curObj.y;
            curObj.x = curObj.x - this.objectRadius;
            curObj.y = curObj.y + this.objectRadius;
            curObj.w = curObj.h = this.objectRadius * 2;
            curObj.id = 'obj_'+i;
            curObj.selLabelIdx = 2; // use the 3 o'clock label by default
            curObj.curCost = Infinity;
            curObj.labels = [];
            for(var pos = 0; pos < 8; pos++) {
                curObj.labels.push(generateLabelRect.call(this, curObj, i, pos));
            }
            this.grid.placeObject(curObj);
            this.grid.placeObject(curObj.labels[curObj.selLabelsIdx]);
        }
    };

    LabelManager.prototype.evaluateTotalCost = function () {
        var cost = 0;
        for(var i = 0, len = this.objects.length; i < len; i++) {
            cost += this.objects[i].curCost;
        }
    };

    return LabelManager;
})();
