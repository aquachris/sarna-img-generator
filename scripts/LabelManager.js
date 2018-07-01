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
        0.25, 0.6, 0.0, 0.6, 0.25, 0.8, 0.25, 0.8
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
     * @param alpha2 {Number} Weight for cartographic preference. Default is 0.0
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
        this.orderedObjIndices = [];
        this.candidateListSizeLimit = 0;
        this.candidateList = [];
        this.tabuCandidateList = [];
        this.iteration = 0;
        this.iterationLimit = 300;

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
    };

    /**
     * @returns {boolean} false if the algorithm has terminated
     */
    LabelManager.prototype.iterate = function () {
        var curCandidate, curObj, curLabel;
        var overlaps, numOverlaps;
        var curCost;
        var bestCandidate;
        var otherObj;

        this.findCandidates();
        for(var i = 0, len = this.candidateList.length; i < len; i++) {
            curCandidate = this.candidateList[i];
            curObj = this.objects[curCandidate.idx];
            curCandidate.bestPos = curObj.selLabelPos;
            curCandidate.bestCost = curObj.overlapCost + curObj.labelPosCost;
            /*if(curCandidate.idx === 175) {
                curLabel = curObj.labels[4];
                otherObj = this.grid.getOverlaps(curLabel, 'label_'+curCandidate.idx);
                console.log('175 ', 6, curCost);
                console.log('this:', curLabel.x, curLabel.y, curLabel.w, curLabel.h);
                console.log(otherObj.length);
                //console.log('other: ', otherObj.x, otherObj.y, otherObj.w, otherObj.h);
            }*/
            for(var pos = 0; pos < 8; pos++) {
                curLabel = curObj.labels[pos];
                numOverlaps = this.grid.getNumOverlaps(curLabel, 'label_'+curCandidate.idx);
                curCost = this.alpha1 * numOverlaps + this.alpha2 * LabelManager.POSITIONS[pos];
                if(pos !== curObj.selLabelPos && curCost < curCandidate.bestCost) {
                    if(curCandidate.idx === 122) {
                        console.log(curObj.selLabelPos, curCandidate.bestCost, 'now', pos, curCost);
                    }
                    curCandidate.bestPos = pos;
                    curCandidate.bestCost = curCost;
                }
            }
            if((!bestCandidate && curCandidate.bestCost <= curObj.overlapCost + curObj.labelPosCost)
                || curCandidate.bestCost < bestCandidate.bestCost
            ) {
                bestCandidate = curCandidate;
                if(bestCandidate.idx === 122) {
                    console.log('BEST: ', bestCandidate);
                }
            }
        }

        if(!bestCandidate) {
            this.logger.log('no non-tabu best candidate found');
            for(var i = 0, len = this.tabuCandidateList.length; i < len; i++) {
                curCandidate = this.tabuCandidateList[i];
                curObj = this.objects[curCandidate.idx];
                curCandidate.bestPos = curObj.selLabelPos;
                curCandidate.bestCost = curObj.overlapCost + curObj.labelPosCost;
                for(var pos = 0; pos < 8; pos++) {
                    curLabel = curObj.labels[pos];
                    numOverlaps = this.grid.getNumOverlaps(curLabel, 'label_'+curCandidate.idx);
                    curCost = this.alpha1 * numOverlaps + this.alpha2 * LabelManager.POSITIONS[pos];
                    if(curCost < curCandidate.bestCost) {
                        curCandidate.bestPos = pos;
                        curCandidate.bestCost = curCost;
                    }
                }
                if(!bestCandidate || curCandidate.bestCost < bestCandidate.bestCost){
                    bestCandidate = curCandidate;
                    if(bestCandidate.idx === 183) {
                        console.log('BEST: ', bestCandidate);
                    }
                }
            }
        }

        if(!bestCandidate) {
            this.logger.warn('LabelManager: no best candidate found');
            return false;
        }
        //this.logger.log('LabelManager: best candidate is now ', bestCandidate);

        curObj = this.objects[bestCandidate.idx];
        curLabel = curObj.labels[curObj.selLabelPos];
        curCost = curObj.overlapCost + curObj.labelPosCost;

        // update costs for current object: remove label cost
        curObj.labelPosCost -= this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];

        // remove previous label and update costs accordingly
        overlaps = this.grid.getOverlaps(curLabel);
        for(var i = 0, len = overlaps.length; i < len; i++) {
            otherObj = overlaps[i];
            // check if overlapped rectangle is an object or a label
            if(!otherObj.hasOwnProperty('labels')) {
                // label
                otherObj = otherObj.o;
                //otherObj.labelPosCost -= this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];
                this.totalCost -= this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];
            }
            curObj.overlapCost -= this.alpha1;
            //otherObj.overlapCost -= this.alpha1 * 1;
            this.totalCost -= this.alpha1;
            this.totalNumOverlaps--;
        }
        this.grid.unplaceObject(curLabel);

        // add new label and update costs accordingly
        curObj.selLabelPos = bestCandidate.bestPos;
        //this.logger.log('best label position for ' + curObj.id + ' is now ' + bestCandidate.bestPos);
        curLabel = curObj.labels[curObj.selLabelPos];
        // update costs for current object: add label cost
        curObj.labelPosCost += this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];

        overlaps = this.grid.getOverlaps(curLabel);
        for(var i = 0, len = overlaps.length; i < len; i++) {
            otherObj = overlaps[i];
            // check if overlapped rectangle is an object or a label
            if(!otherObj.hasOwnProperty('labels')) {
                // label
                otherObj = otherObj.o;
                //otherObj.labelPosCost += this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];
                this.totalCost += this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];
            }
            curObj.overlapCost += this.alpha1;
            //otherObj.overlapCost += this.alpha1 * 1;
            this.totalCost += this.alpha1;
            this.totalNumOverlaps++;
        }
        this.grid.placeObject(curLabel);

        // add this object to the tabu list
        this.tabuList.push(bestCandidate.idx);
        if(this.tabuList.length > this.tabuListSizeLimit) {
            this.tabuList.shift();
        }

        this.iteration++;
        if(this.iteration % 100 === 0) {
            this.logger.log('finished iteration #' + this.iteration +', total cost is now ' + this.totalCost);
        }
        if(this.totalNumOverlaps === 0 || this.iteration >= this.iterationLimit) {
            /*this.findCandidates();
            for(var i = 0; i < this.candidateList.length; i++) {
                curCandidate = this.candidateList[i];
                curObj = this.objects[curCandidate.idx];
                this.logger.log('candidate: ', this.candidateList[i], curObj.overlapCost);
            }*/
            return false;
        } else if(this.iteration % 50 === 0) {
            this.recalculateListSizes();
        }
        return true;
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
            this.totalCost += this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];
            for(var j = 0, jlen = overlaps.length; j < jlen; j++) {
                otherObj = overlaps[j];
                // check if overlapped rectangle is an object or a label
                if(!otherObj.hasOwnProperty('labels')) {
                    // label
                    otherObj = otherObj.o;
                    //otherObj.labelPosCost += this.alpha2 * LabelManager.POSITIONS[curObj.selLabelPos];
                }
                curObj.overlapCost += this.alpha1 * 1;
                //otherObj.overlapCost += this.alpha1 * 1;
                this.totalCost += this.alpha1;
                this.totalNumOverlaps++;
            }
        }
    };

    LabelManager.prototype.saveCurrentConfigAsBest = function () {
        for(var i = 0, len = this.objects.length; i < len; i++) {
            this.bestConfig[i] = this.objects[i].selLabelPos;
        }
    };

    LabelManager.prototype.recalculateListSizes = function () {
        this.tabuListSizeLimit = Math.min(7 + Math.floor(0.25 * this.totalNumOverlaps), this.objects.length - 1);
        while(this.tabuList.length > this.tabuListSizeLimit) {
            this.tabuList.shift();
        }
        this.candidateListSizeLimit = 1 + Math.floor(0.15 * this.totalNumOverlaps);
        this.logger.log('tabu list size is now ' + this.tabuListSizeLimit + ', candidate list size is now ' + this.candidateListSizeLimit);
    };

    LabelManager.prototype.findCandidates = function () {
        var tabuKeys = {};
        this.candidateList = [];
        this.orderedObjIndices.sort(function (a,b) {
            if(this.objects[a].overlapCost + this.objects[a].labelPosCost
                > this.objects[b].overlapCost + this.objects[b].labelPosCost) {
                return -1;
            }
            return 1;
        }.bind(this));
        for(var i = 0, len = this.tabuList.length; i < len; i++) {
            tabuKeys[this.tabuList[i]] = true;
        }
        for(var i = 0; i < this.orderedObjIndices.length; i++) {
            if(tabuKeys.hasOwnProperty(this.orderedObjIndices[i])) {
                this.tabuCandidateList.push({
                    idx: this.orderedObjIndices[i],
                    bestPos: -1,
                    bestCost: Infinity,
                    isTabu : tabuKeys.hasOwnProperty(this.orderedObjIndices[i])
                });
            } else {
                if(this.objects[this.orderedObjIndices[i]].overlapCost === 0) {
                    continue;
                }
                this.candidateList.push({
                    idx: this.orderedObjIndices[i],
                    bestPos: -1,
                    bestCost: Infinity,
                    isTabu : tabuKeys.hasOwnProperty(this.orderedObjIndices[i])
                });
                if(this.candidateList.length >= this.candidateListSizeLimit) {
                    break;
                }
            }
        }
    };

    return LabelManager;
})();
