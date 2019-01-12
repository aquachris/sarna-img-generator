module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');

    /**
	 * An instance of this class uses the algorithm outlined below in
     * order to place labels on a border line between two state entities.
     *
     * Algorithm idea:
     * For each faction border (retrievable as an array of clockwise edge loops):
     * - generate polylines that are long enough to put the faction label next to
     *      at least once. Ideally, restrict a polyline to a single border.
     * - generate preliminary label positions for each polyline
     * - for each preliminary position, generate a number of alternate candidates
     * - evaluate all candidates using the weighted metric described below, and pick the
     *      best one (or none, if none of them is good enough)
     * - candidate metric conditions:
     *      - minimal overlap with other labels
     *      - mostly straight labels
     *      - horizontal labels preferred over vertical labels
     *      - middle of the polyline is preferred to the edges
     *    --> all of these conditions are weighted, weights sum to 1
     * - for the selected candidate, use the closest polyline points and svg text-path
     *      to achieve the desired result
	 */
	var BorderLabeler = function (logger) {
        this.logger = logger || console;
	};

	BorderLabeler.prototype.constructor = BorderLabeler;

    /**
     * Initializes this object.
     *
     * @returns {Object} this object
     */
    BorderLabeler.prototype.init = function (factions, viewRect, glyphSettings, distanceBetweenLabels) {
        this.factions = factions;
        this.viewRect = viewRect;
        this.glyphSettings = glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };
        this.glyphSizeFactor = .8;
        this.distanceBetweenLabels = distanceBetweenLabels;
		this.polylines = {};
        this.borderLabels = [];
        return this;
    };

    /**
     * Runs the labeling algorithm.
     *
     * @param borderLoops {Object} The border loop objects
     */
    BorderLabeler.prototype.generateLabels = function (borderLoops) {
        this.extractPolylines(borderLoops);
        this.generateCandidates();
    };

    /**
     * Extract polylines from the border loops.
     * @private
     */
    BorderLabeler.prototype.extractPolylines = function (borderLoops) {
        var curLoop, curEdge;
        var curPolyline;
        var firstLoopPolyline;
        var otherCol;
        var e1, e2;

        this.polylines = {};
        for(var faction in borderLoops) {
            if(!borderLoops.hasOwnProperty(faction)) {
                continue;
            }
            this.polylines[faction] = [];
            // iterate over this faction's loops
            for(var i = 0, len = borderLoops[faction].length; i < len; i++) {
                curLoop = borderLoops[faction][i];
                otherCol = null;
                curPolyline = null;
                firstLoopPolyline = null;
                for(var ei = 0; ei < curLoop.edges.length; ei++) {
                    curEdge = curLoop.edges[ei];
                    if(!Utils.pointInRectangle(curEdge.n1, this.viewRect) && !Utils.pointInRectangle(curEdge.n2, this.viewRect)) {
    					// skip this edge
    					continue;
    				}
                    // if the border "partner" side changes, open a new polyline
                    // otherCol is initially blank
    				if(curEdge.leftCol !== otherCol) {
    					// close existing polyline
                        if(curPolyline && curPolyline.edges.length > 0) {
                            this.polylines[faction].push(curPolyline);
                        }
                        // start new polyline
    					curPolyline = {
                            id : faction + '_' + this.polylines[faction].length,
                            fill : this.factions[faction] ? this.factions[faction].color : '#000',
                            loop : curLoop,
                            edges : [],
                            length : 0
                        };
                        if(!firstLoopPolyline) {
                            firstLoopPolyline = curPolyline;
                        }
    				}
                    otherCol = curEdge.leftCol;
    				curPolyline.edges.push(curEdge);
                    curPolyline.length += Utils.pointDistance(curEdge.n1, curEdge.n2);
                }
                if(curPolyline && curPolyline.edges.length > 0) {
                    // determine if the loop's last polyline should be merged into the first one
                    e1 = curPolyline.edges[curPolyline.edges.length-1];
                    e2 = firstLoopPolyline.edges[0];
                    if(curPolyline !== firstLoopPolyline // polylines are not identical
                        && e1.leftCol === e2.leftCol // polylines have the same neighbor faction
                        && e1.n2.x === e2.n1.x && e1.n2.y === e2.n1.y) { // polylines are adjacent
                        // merge current polyline into first loop polyline
                        this.mergePolylines(firstLoopPolyline, curPolyline);
                    } else {
                        this.polylines[faction].push(curPolyline);
                    }
                }
            }
        }
    };

    /**
     * Copies the second polyline's edges into the first one's, with the resulting
     * edges array  in proper (clockwise) order.
     * The polylines must belong to the same loop and must be adjacent.
     * Note that the first polyline will be modified.
     *
     * @param p1 {Object} The first polyline
     * @param p2 {Object} The second polyline
     * @returns {boolean} true if the polylines have been correctly merged
     * @private
     */
    BorderLabeler.prototype.mergePolylines = function (pl1, pl2) {
        var pl1FirstEdge = pl1.edges[0];
        var pl1LastEdge = pl1.edges[pl1.edges.length - 1];
        var pl2FirstEdge = pl2.edges[0];
        var pl2LastEdge = pl2.edges[pl2.edges.length - 1];
        if(pl1 === pl2) {
            this.logger.error('Polyline cannot be merged into itself.');
            return false;
        }
        if(pl1LastEdge.n2.x === pl2FirstEdge.n1.x && pl1LastEdge.n2.y === pl2FirstEdge.n1.y) {
            // order is pl1 -> pl2
            pl1.edges = pl1.edges.concat(pl2.edges);
        } else if(pl1FirstEdge.n1.x === pl2LastEdge.n2.x && pl1FirstEdge.n1.y === pl2LastEdge.n2.y) {
            // order is pl2 -> pl1
            pl1.edges = pl2.edges.concat(pl1.edges);
        } else {
            this.logger.error('Polylines cannot be merged: No adjacent edges found.');
            /*this.logger.error(pl1.edges[0].leftCol, pl1.edges[0].rightCol);
            this.logger.error(pl2.edges[0].leftCol, pl2.edges[0].rightCol);*/
            //this.logger.error(pl1LastEdge.n2, pl1LastEdge.leftCol, pl1LastEdge.rightCol);
            //this.logger.error(pl2FirstEdge.n1, pl2FirstEdge.leftCol, pl2FirstEdge.rightCol);
            //this.logger.error(pl2LastEdge.n2, pl1FirstEdge.n1);
            return false;
        }
        pl1.length += pl2.length;
        this.logger.info('polylines successfully merged');
        return true;
    };

    /**
     * Calculates the label's length for the given text.
     *
     * @param text {String} The text
     * @returns {Number} The label length, in map units
     * @private
     */
    BorderLabeler.prototype.calculateLabelLength = function (text) {
        var length = 0;
        var lineH = this.glyphSettings.lineHeight;
        var charDefaultWidth = this.glyphSettings.widths.default;

        for(var i = 0; i < text.length; i++) {
            length += (this.glyphSettings.widths[text[i]] || charDefaultWidth) * this.glyphSizeFactor;
        }

        return length;
    };

	/**
	 * Generates candidate positions.
	 */
	BorderLabeler.prototype.generateCandidates = function () {
        var curPolyline;
        var curLoop;
        var faction;
        var labelWidth;
        for(var factionKey in this.polylines) {
            if(!this.polylines.hasOwnProperty(factionKey)) {
                continue;
            }
            faction = this.factions[factionKey];
            labelWidth = this.calculateLabelLength(faction ? faction.longName : '');
            curLoop = null;

            // first pass:
            // make sure the polylines are long enough to fit a faction label
            for(var i = 0; i < this.polylines[factionKey].length; i++) {
                curPolyline = this.polylines[factionKey][i];
                //if(!this.generateCandidatesAlongPolylines(faction.longName)) {

                // Keep merging polylines for as long as it takes to make the long
                // faction label fit. If the polyline consists of the entire loop, give up.
                while(curPolyline.length < labelWidth) {
                    // long faction name does not fit

                    // if there is no next polyline, or if one exists, but it belongs to a different loop ...
                    if(i >= this.polylines[factionKey].length - 1 // next line either does not exist or ...
                        || curPolyline.loop !== this.polylines[factionKey][i+1].loop) { // ... belongs to a different loop
                        // check if the previous line belonged to the same loop
                        if(curPolyline.loop !== curLoop) {
                            // the current line is the only one remaining for its loop --> abort
                            break;
                        }
                        // there is a previous polyline A that belonged to the same loop as the current one (B)
                        // set the current polyline to be the previous one, for a backward merge
                        i--;
                        curPolyline = this.polylines[factionKey][i];
                    }

                    // merge the two lines (next into current)
                    if(!this.mergePolylines(curPolyline, this.polylines[factionKey][i+1])) {
                        // something went wrong --> abort!
                        this.logger.error('polyline merge failed');
                        break;
                    }
                    // remove the  next polyline from the List
                    this.polylines[factionKey].splice(i+1, 1);
                }
                curLoop = curPolyline.loop;
            }

            // second pass:
            // generate candidate locations for the (possibly) merged polylines
            for(var i = 0; i < this.polylines[factionKey].length; i++) {
                curPolyline = this.polylines[factionKey][i];
                curPolyline.candidates = [];
                curPolyline.candidates.push({
                    dist: curPolyline.length * .5,
                    pos : Utils.pointAlongPolyline(curPolyline.edges, curPolyline.length * .5),
                    fromPos : Utils.pointAlongPolyline(curPolyline.edges, curPolyline.length * .5 - labelWidth * .5),
                    toPos : Utils.pointAlongPolyline(curPolyline.edges, curPolyline.length * .5 + labelWidth * .5),
                    labelText : faction.longName,
                    labelWidth : labelWidth
                });
            }
        }

        //
		/*for(var i = 0; i < this.polylines.length; i++) {
			this.polylines[i].candidates = this.generateCandidatesAlongPolyline(this.polylines[i]);
		}*/
	};


    /**
     * @param polyline {Array} The polyline
	 * @returns {Array} The candidate points
     */
    BorderLabeler.prototype.generateCandidatesAlongPolyline = function (polyline) {
        var lineH = this.glyphSettings.lineHeight;
        var charDefaultWidth = this.glyphSettings.widths.default;
        var labelWidth = 0;
        var wMax = 0;
        var sDistance = 0;
        var pPoints = [];
        var pLineLength = 0;
        var leftFac, rightFac;
        var leftFacLabel = '', rightFacLabel = '';
        var leftFacFill = '', rightFacFill = '';

        // iterate over the polyline's parts to assemble all points and calculate the polyline's length
        for(var i = 0, len = polyline.lineParts.length; i < len; i++) {
            if(i === 0) {
                pPoints.push(polyline.lineParts[i].n1);
                leftFac = polyline.lineParts[i].leftCol;
                rightFac = polyline.lineParts[i].rightCol;
            }
            pPoints.push(polyline.lineParts[i].n2);
            pLineLength += polyline.lineParts[i].length;
        }
		polyline.length = pLineLength;

        var calculateLengths = function (label1, label2) {
            wMax = 0;
            for(var i = 0; i < label1.length; i++) {
                wMax += (this.glyphSettings.widths[label1[i]] || charDefaultWidth) * this.glyphSizeFactor;
            }
            labelWidth = 0;
            for(var i = 0; i < label2.length; i++) {
                labelWidth += (this.glyphSettings.widths[label2[i]] || charDefaultWidth) * this.glyphSizeFactor;
            }
            // maximum label length
            wMax = Math.max(wMax, labelWidth);
            // minimum distance between q candidates
            sDistance = 2 * wMax; // 2 * wMax

            leftFacLabel = label1;
            rightFacLabel = label2;
        }.bind(this);

        if(this.factions.hasOwnProperty(leftFac)) {
            leftFacLabel = this.factions[leftFac].longName;
            leftFacFill = this.factions[leftFac].color;
        }
        if(this.factions.hasOwnProperty(rightFac)) {
            rightFacLabel = this.factions[rightFac].longName;
            rightFacFill = this.factions[rightFac].color;
        }

        calculateLengths(leftFacLabel, rightFacLabel);
        if(pLineLength < 2 * sDistance + wMax) {
            // long labels are too long - try short ones
            calculateLengths(leftFac, rightFac);
            if(pLineLength < 2 * sDistance + wMax) {
                // short labels are too short also - no labeling
				this.logger.info('candidate location generation: line is too short for ' + polyline.borderId);//, pLineLength, 2*sDistance+wMax);
                return [];
            } else {
				this.logger.info('candidate location generation: using short labels for ' + polyline.borderId);//, pLineLength, 2*sDistance+wMax);
			}
        }
		polyline.sDistance = sDistance;
		polyline.wMax = wMax;
		polyline.leftFacLabel = leftFacLabel;
        polyline.leftFacFill = leftFacFill;
        polyline.rightFacLabel = rightFacLabel;
        polyline.rightFacFill = rightFacFill;
		if(sDistance <= 0) {
			// something's funky - abort!
			this.logger.warn('candidate location generation: sDistance is 0');
			return [];
		}

        // find candidate locations along the polyline
		var d = 1.5 * sDistance;
		var candidates = [];
		var pAlongPl;
		//this.logger.log('candidate location generation: sDistance is ' + sDistance + ', polyline length is ' + pLineLength);
		while(d < pLineLength - sDistance) {
			if(pAlongPl = Utils.pointAlongPolyline(polyline.lineParts, d)) {
				candidates.push(pAlongPl);
			}
			d += 1.5 * sDistance;
		}
		return candidates;
    };

	return BorderLabeler;
})();
