module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');
    var RectangleGrid = require('./RectangleGrid.js');

	/**
	 * An instance of this class uses a heuristic algorithm in order to place labels
     * on a canvas with minimal overlap.
     * The implemented algorithm is a variant of the tabu search with fixed label options.
     *
     * @see http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.21.6115&rep=rep1&type=pdf
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

    /**
     * Initializes this object.
     *
     * @param viewRect {Object} The visible rectangle {x, y, w, h}
     * @param objects {Array} List of objects that need to be labelled
     * @param objectRadius {Number} Radius of a single object node
     * @param objLabelDist {Number} Empty space between an object node and its text label
     * @param glyphSettings {Object} Several settings such as default width and height, and specific glyph widths
     * @param positionPrefs {Object} Position preferences in the same form as LabelManager.POSITIONS
     * @param alpha1 {Number} Weight for overlapping labels. Default is 1.0
     * @param alpha2 {Number} Weight for cartographic preference. Default is 0.5
     * @returns {LabelManager} this object
     */
    LabelManager.prototype.init = function (viewRect, objects, objectRadius, objLabelDist, glyphSettings, positionPrefs, alpha1, alpha2) {
        this.viewRect = viewRect || {x: 0, y: 0, w: 0, h: 0};
        this.objects = Utils.deepCopy(objects || []);
        this.objectRadius = objectRadius || 1;
        this.objLabelDist = objLabelDist || 0;
        this.glyphSettings = glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };
        this.alpha1 = alpha1 === undefined ? 1.0 : alpha1;
        this.alpha2 = alpha2 === undefined ? 0.5 : alpha2;

        // tabu search variables
        this.totalCost = Infinity;
        this.totalNumOverlaps = Infinity;
        this.bestCost = Infinity;
        this.bestConfig = [];
        this.tabuListSizeLimit = 0;
        this.tabuList = [];
        this.candidateListSizeLimit = 0;
        this.candidateList = [];

        this.grid = new RectangleGrid().init(viewRect);
        this.setInitialState();
        return this;
    };

    // - find out all *potential* overlap situations
    //

    LabelManager.prototype.setInitialState = function () {
        var curObj;

        // private helper function
        var generateLabelRect = function (o, objIdx, pos) {
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
                id: 'label_'+objIdx+'_'+pos,
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
            curObj.selLabelPos = 2; // use the 3 o'clock label by default
            curObj.overlapCost = Infinity;
            curObj.labelPosCost = LabelManager.POSITIONS[2];
            curObj.labels = [];
            for(var posIdx = 0; posIdx < 8; posIdx++) {
                curObj.labels.push(generateLabelRect.call(this, curObj, i, posIdx));
            }
            this.bestConfig.push(2);
            this.grid.placeObject(curObj);
            this.grid.placeObject(curObj.labels[curObj.selLabelPos]);
        }

        this.calculateTotalCost();
        this.bestCost = this.totalCost;
        this.saveCurrentConfigAsBest();
        console.log('total cost after init: ' + this.totalCost);
    };

    LabelManager.prototype.calculateTotalCost = function () {
        var curObj, curLabel, otherObj, otherLabel;
        var overlaps;

        // reset total cost and number of overlaps
        this.totalCost = 0;
        this.totalNumOverlaps = 0;
        // reset all costs
        for(var i = 0, len = this.objects.length; i < len; i++) {
            this.objects[i].overlapCost = 0;
            this.objects[i].labelPosCost = LabelManager.POSITIONS[this.objects[i].selLabelPos];
        }

        // iterate over all objects and add costs where overlaps are found
        for(var i = 0, len = this.objects.length; i < len; i++) {
            curObj = this.objects[i];
            curLabel = curObj.labels[curObj.selLabelPos];
            overlaps = this.grid.getOverlaps(curLabel, 'label_'+i);
            for(var j = 0, jlen = overlaps.length; j < jlen; j++) {
                otherObj = overlaps[j];
                // check if overlapped rectangle is an object or a label
                if(!otherObj.hasOwnProperty('labels')) {
                    // label
                    otherObj = otherObj.o;
                    otherObj.labelPosCost += this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];
                    this.totalCost += this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];
                }
                curObj.overlapCost += this.alpha1 * 1;
                otherObj.overlapCost += this.alpha1 * 1;
                this.totalCost += this.alpha1 * 2;
                this.totalNumOverlaps++;
            }
            //cost += this.objects[i].curCost;
        }
    };

    LabelManager.prototype.saveCurrentConfigAsBest = function () {
        for(var i = 0, len = this.objects.length; i < len; i++) {
            this.bestConfig[i] = this.objects[i].selLabelPos;
        }
    };



    return LabelManager;
})();
