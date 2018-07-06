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
        }
    };

    LabelManager2.prototype.run = function () {
        var curObj, curLabel;
        var overlaps;
        var minY, maxY;
        var curOverlap, minOverlap;
        var minOverlapX, minOverlapY;
        var positionSequence;
        var attempts;

        // private helper function
        var moveLabelToPos = function (obj, dir) {
            var dir = positionSequence[attempts];
            if(obj.name === 'Agador' || obj.name === 'Quentin') {
                console.log('moving '+obj.name+' ' + dir, minY, maxY);
            }

            if(dir === 'up') {
                obj.label.y = Math.min(maxY, obj.y + obj.h) + this.objLabelDist;
                /*if(obj.label.y >= obj.y + obj.h) {
                    obj.label.x = obj.x;
                }*/
            } else if(dir === 'down') {
                obj.label.y = Math.max(minY - this.glyphSettings.lineHeight, obj.y - this.glyphSettings.lineHeight) - this.objLabelDist;
                /*if(obj.label.y <= obj.y - this.glyphSettings.lineHeight) {
                    obj.label.x = obj.x;
                }*/
            } else if(dir === 'above') {
                obj.label.x = obj.centerX - obj.label.w * .5;
                obj.label.y = obj.y + obj.h;
            } else if(dir === 'below') {
                obj.label.x = obj.centerX - obj.label.w * .5;
                obj.label.y = obj.y - this.glyphSettings.lineHeight;
            } else if(dir === 'left') {
                obj.label.x = obj.x - obj.label.w - this.objLabelDist;
                obj.label.y = obj.centerY - this.glyphSettings.lineHeight * .5;
            }
        };

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
            curOverlap = 0;
            minOverlap = Infinity;
            minOverlapX = undefined;
            minOverlapY = undefined;
            for(var j = 0, jlen = overlaps.length; j < jlen; j++) {
                if(overlaps[j].x < curObj.x && !overlaps[j].hasOwnProperty('label')) {
                    continue;
                }
                minY = Math.min(overlaps[j].y, minY);
                maxY = Math.max(overlaps[j].y+overlaps[j].h, maxY);
            }
            if(minY === Infinity || maxY === -Infinity) {
                continue;
            }
            this.grid.unplaceObject(curObj.label);
            if(curObj.name === 'Castor')
                this.logger.log(curObj.centerY, minY, maxY);

            positionSequence = [];
            attempts = 0;

            // primary direction
            // secondary direction
            // left
            // centered above
            // centered below

            // check for the closer overlap-free edge (top or bottom)
            if(curObj.centerY - minY < maxY - curObj.centerY ) {
                positionSequence = ['down', 'up', 'above', 'below', 'left'];
            } else { //if(maxY <= curObj.y)
                positionSequence = ['up', 'down', 'above', 'below', 'left'];
            }

            while(attempts < positionSequence.length) {
                moveLabelToPos.call(this, curObj);
                overlaps = this.grid.getOverlaps(curLabel);
                curOverlap = 0;
                for(var j = 0, jlen = overlaps.length; j < jlen; j++) {
                    if(overlaps[j].x < curObj.x && !overlaps[j].hasOwnProperty('label')) {
                        continue;
                    }
                    curOverlap += Utils.rectanglesOverlap(curLabel, overlaps[j]);
                }
                if(curOverlap < minOverlap) {
                    minOverlap = curOverlap;
                    minOverlapX = curLabel.x;
                    minOverlapY = curLabel.y;
                }
                if(curOverlap === 0) {
                    break;
                }
                attempts++;
            }

            curLabel.x = minOverlapX;
            curLabel.y = minOverlapY;
            this.grid.placeObject(curObj.label);
        }
    };



    return LabelManager2;
})();
