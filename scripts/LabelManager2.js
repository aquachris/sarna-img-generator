module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');
    var RectangleGrid = require('./RectangleGrid.js');

	/**
	 * An instance of this class uses a heuristic algorithm in order to place labels
     * on a canvas with minimal overlap.
     *
     * Algorithm idea: Go from right to left.
     * - For each system label, check if it overlaps other systems or labels. If it does, push it to the nearest
     *   non-overlapping y direction (up or down) until there is no longer an overlap
     * - If a label has been pushed up or down by more than its height, move it to the system's
     *   other side and repeat algorithm.
     * - If a label cannot be placed on either side of the system, try directly above or below the system
     * - If the label still cannot be placed, give up (?)
	 */
	var LabelManager2 = function (logger) {
        this.logger = logger || console;
	};

	LabelManager2.prototype.constructor = LabelManager2;

    /**
     * Initializes this object.
     *
     * @param viewRect {Object} The visible rectangle {x, y, w, h}
     * @param objects {Array} List of objects that need to be labelled
     * @param objectRadius {Number} Radius of a single object node
     * @param objLabelDist {Number} Empty space between an object node and its text label
     * @param glyphSettings {Object} Several settings such as default width and height, and specific glyph widths
     * @returns {LabelManager} this object
     */
    LabelManager2.prototype.init = function (viewRect, objects, objectRadius, objLabelDist, glyphSettings) {
        this.viewRect = viewRect || {x: 0, y: 0, w: 0, h: 0};
        this.objects = Utils.deepCopy(objects || []);
        this.objectRadius = objectRadius || 1;
        this.objLabelDist = objLabelDist || 0;
        this.glyphSettings = glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };

        this.grid = new RectangleGrid().init(viewRect);
        this.setInitialState();
        this.run();
        return this;
    };

    LabelManager2.prototype.setInitialState = function () {
        var curObj;
        this.orderedObjIndices = [];

        // private helper function
        var generateLabelRect = function (obj, objIdx) {
            var objRad = this.objectRadius;
            var dist = this.objLabelDist;
            var lineH = this.glyphSettings.lineHeight;
            var defaultWidth = this.glyphSettings.widths.default;
            var labelWidth = 0;
            for(var i = 0; i < obj.name.length; i++) {
                labelWidth += this.glyphSettings.widths[obj.name[i]] || defaultWidth;
            }

            return {
                id: 'label_'+objIdx,
                o: obj,
                x: obj.centerX + objRad + dist,
                y: obj.centerY - lineH * .5,
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
        }
    };

    LabelManager2.prototype.run = function () {
        var curObj, curLabel;
        var overlaps;
        var minY, maxY;
        var minOverlap;
        var primaryDir;
        var attempts;

        this.orderedObjIndices.sort(function(a, b) {
            return this.objects[b].x - this.objects[a].x;
        }.bind(this));

        for(var i = 0, len = this.orderedObjIndices.length; i < len; i++) {
            curObj = this.objects[this.orderedObjIndices[i]];
            curLabel = curObj.label;

            overlaps = this.grid.getOverlaps(curLabel);
            if(overlaps.length === 0) {
                continue;
            }
            minY = Infinity;
            maxY = -Infinity;
            for(var j = 0, jlen = overlaps.length; j < jlen; j++) {
                if(overlaps[j].x < curObj.x) {
                    continue;
                }
                minY = Math.min(overlaps[j].y, minY);
                maxY = Math.max(overlaps[j].y, maxY);
            }
            if(minY === Infinity || maxY === -Infinity) {
                continue;
            }
            if(curObj.name === 'Castor')
                this.logger.log(curObj.centerY, minY, maxY);

            minOverlap = Infinity;
            primaryDir = '';
            attempts = 0;

            // primary direction
            // secondary direction
            // left
            // centered above
            // centered below

            // check for the closer overlap-free edge (top or bottom)
            if(curObj.centerY - minY < maxY - curObj.centerY ) {
                primaryDir = 'down';
                // move label down
                curLabel.y = minY - this.glyphSettings.lineHeight;
                if(minY <= curObj.centerY - this.objectRadius) {
                    curLabel.x = curObj.centerX;
                }
                if(curObj.name === 'Castor')
                    this.logger.log('label for ' + curObj.name + ' moved down');
            } else if(maxY <= curObj.y) {
                primaryDir = 'up';
                // move label up
                curLabel.y = maxY + this.glyphSettings.lineHeight;
                if(curLabel.y >= curObj.centerY + this.objectRadius) {
                    curLabel.x = curObj.centerX;
                }
                if(curObj.name === 'Castor')
                    this.logger.log('label for ' + curObj.name + ' moved up to ' + curLabel.y);
            }

            //
            // up: Math.min(maxY + this.glyphSettings.lineHeight, curObj.y + this.glyphSettings.lineHeight)
            // down: Math.max(minY - this.glyphSettings.lineHeight, curObj - this.glyphSettings.lineHeight)
            
        }
    };

    /*
    LabelManager2.prototype.setInitialState = function () {
        var curObj;

        // private helper function
        var generateLabelRect = function (o, objIdx, pos) {
            var oRad = this.objectRadius;
            var dist = this.objLabelDist;
            var yDist = 0;//dist * .5;
            var lineHBuf = -.25;//.25;
            var lineH = this.glyphSettings.lineHeight + lineHBuf *2;
            var xDelta = 0, yDelta = 0;

            var labelWidth = 0;
            var defaultWidth = this.glyphSettings.widths.default;
            for(var i = 0; i < o.name.length; i++) {
                labelWidth += this.glyphSettings.widths[o.name[i]] || defaultWidth;
            }
            switch(pos) {
                case 0:
                    xDelta = -labelWidth*.5;
                    yDelta = oRad + yDist;
                    break;
                case 1:
                    xDelta = oRad;// + dist *.5;
                    yDelta = oRad + yDist;
                    break;
                case 2:
                    xDelta = oRad + dist;
                    yDelta = -lineH *.5;
                    break;
                case 3:
                    xDelta = oRad;// + dist * .5;
                    yDelta = -oRad - yDist - lineH;
                    break;
                case 4:
                    xDelta = -labelWidth * .5;
                    yDelta = -oRad - yDist - lineH;
                    break;
                case 5:
                    xDelta = -oRad - labelWidth;//-oRad - dist - labelWidth;
                    yDelta = -oRad - yDist - lineH;
                    break;
                case 6:
                    xDelta = -oRad - dist - labelWidth;
                    yDelta = -lineH * .5;
                    break;
                case 7:
                    xDelta = -oRad - labelWidth;//-oRad - dist - labelWidth;
                    yDelta = oRad + yDist;
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
            this.orderedObjIndices.push(i);
            curObj = this.objects[i];
            curObj.centerX = curObj.x;
            curObj.centerY = curObj.y;
            curObj.x = curObj.x - this.objectRadius;
            curObj.y = curObj.y - this.objectRadius;
            curObj.w = curObj.h = this.objectRadius * 2;
            curObj.id = 'obj_'+i;
            curObj.selLabelPos = 2; // use the 3 o'clock label by default
            curObj.overlapCost = Infinity;
            curObj.labelPosCost = LabelManager.POSITIONS[2];
            curObj.labels = [];
            for(var posIdx = 0; posIdx < 8; posIdx++) {
                curObj.labels.push(generateLabelRect.call(this, curObj, i, posIdx));
            }
            //
            delete curObj.neighbors;
            delete curObj.neighbors_60;
            delete curObj.adjacentTriIndices;
            delete curObj['3030_all'];
            delete curObj['3052_all'];
            //
            this.bestConfig.push(2);
            this.grid.placeObject(curObj);
            this.grid.placeObject(curObj.labels[curObj.selLabelPos]);
        }

        this.calculateTotalCost();
        this.bestCost = this.totalCost;
        this.saveCurrentConfigAsBest();
        this.recalculateListSizes();
        this.iteration = 0;
        this.logger.log('LabelManager: total cost after init: ' + this.totalCost);
        while(this.iterate()) {}
        this.logger.log('LabelManager: algorithm terminated after ' + this.iteration + ' iterations');
    };*/


    return LabelManager2;
})();
