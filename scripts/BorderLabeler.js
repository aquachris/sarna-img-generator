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
     * - generate candidates along the polyline. The candidates must lie along a
     *      comparably straight stretch of the polyline that is long enough to fit
     *      the label in question.
     * - generate preliminary label positions for each polyline.
     * - for each preliminary position, generate a number of alternate candidates
     * - evaluate all candidates using the weighted metric described below, and pick the
     *      best one (or none, if none of them is good enough)
     * - candidate metric conditions:
     *      - minimal overlap with other labels
     *      - horizontal labels preferred over vertical labels
     *      - middle of the polyline is preferred to the edges
     *    --> all of these conditions are weighted, weights sum to 1
     * - for the selected candidate
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
    BorderLabeler.prototype.init = function (factions, labelGrid, viewRect, glyphSettings, distanceBetweenLabels) {
        this.factions = factions;
        this.labelGrid = labelGrid;
        this.viewRect = viewRect;
        this.glyphSettings = glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };
        this.distanceBetweenLabels = distanceBetweenLabels;
		this.polylines = {};
        this.borderLabels = [];
        this.settings = {
            candidateQualityThreshold : 0.55, // the lowest accepted candidate rating
            candidateDistFactor : .25, // distance factor (on the polyline) between candidates. Lower number = higher quality, slower
            labelGrowFactor: .05, // the step size factor for incrementally growing the label size. lower number = higher quality, slower
            labelPolylineTolerance: 0.75, // the tolerance for labels crossing their polyline
        };
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
        this.selectCandidates();
    };

    /**
     * Extract polylines from the border loops.
     * @private
     */
    BorderLabeler.prototype.extractPolylines = function (borderLoops) {
        var curLoop, curEdge, otherEdge, tmpArr;
        var curPolyline;
        var firstLoopPolyline;
        var otherCol;
        var e1, e2;
        var newPolylineAtBorderChange = false;

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
    				if(otherCol === null || (newPolylineAtBorderChange && curEdge.leftCol !== otherCol)) {
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
                            length : 0,
                            candidates : [],
                            labels : []
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
                        // if the entire edge loop is not visible, make sure the polyline starts
                        // with an edge "at the edge" of the screen,
                        for(var ei = 0; ei < curPolyline.edges.length - 1; ei++) {
                            curEdge = curPolyline.edges[ei];
                            otherEdge = curPolyline.edges[ei+1];
                            if(curEdge.n2.x !== otherEdge.n1.x || curEdge.n2.y !== otherEdge.n1.y) {
                                // there is a break after index ei --> make ei + 1 the new starting edge
                                tmpArr = curPolyline.edges.splice(0,ei+1)
                                curPolyline.edges = curPolyline.edges.concat(tmpArr);
                                break;
                            }
                        }

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
            this.logger.info('Polylines cannot be merged: No adjacent edges found.');
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
            length += (this.glyphSettings.widths[text[i]] || charDefaultWidth);
        }

        return length;
    };

	/**
	 * Generates candidate positions.
	 */
	BorderLabeler.prototype.generateCandidates = function () {
        var curPolyline;
        var curLoop;
        var curDist;
        var faction;
        var labelWidth;
        var splitLabel;
        var splitLabelWidth;
        var numCurFactionCandidates;
        for(var factionKey in this.polylines) {
            faction = this.factions[factionKey];
            if(!faction
                || !this.polylines.hasOwnProperty(factionKey)
                || factionKey === 'DUMMY'
                || factionKey === 'I') {
                continue;
            }
            // DEBUG
            /*if(factionKey !== 'CS') {
                continue;
            }*/
            // DEBUG END
            console.log('generating candidates for ' + factionKey);
            labelWidth = this.calculateLabelLength(faction ? faction.longName : '');
            curLoop = null;

            // first pass:
            // make sure the polylines are long enough to fit a faction label
            for(var i = 0; i < this.polylines[factionKey].length; i++) {
                curPolyline = this.polylines[factionKey][i];

                // Keep merging polylines for as long as it takes to make the long
                // faction label fit. If the polyline consists of the entire loop, give up.
                //while(curPolyline.length < labelWidth) {
                curDist = Utils.pointDistance(curPolyline.edges[0].n1, curPolyline.edges[curPolyline.edges.length-1].n2);
                while(curDist < labelWidth) {
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
                        if(i <= 0) {
                            //this.logger.log('cannot backwards merge first polyline');
                            break;
                        }
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
                    curDist = Utils.pointDistance(curPolyline.edges[0].n1, curPolyline.edges[curPolyline.edges.length-1].n2);
                }
                curLoop = curPolyline.loop;
            }

            // second pass:
            // generate candidate locations for the (possibly) merged polylines
            numCurFactionCandidates = 0;
            for(var i = 0; i < this.polylines[factionKey].length; i++) {
                curPolyline = this.polylines[factionKey][i];
                this.findCandidatesIteratively(curPolyline, faction.longName);
                // additionally generate candidates for the wrapped label if applicable
                splitLabel = faction.longName.split(/\s+/g);
                while(splitLabel.length > 2) {
                    splitLabel.splice(0,2,splitLabel[0]+' '+splitLabel[1]);
                }
                if(splitLabel.length > 1) {
                    this.findCandidatesIteratively(curPolyline, splitLabel);
                }
                // rate and sort the candidates
                this.rateAndSortCandidates(curPolyline, [], curPolyline.candidates);
                if(curPolyline.candidates.length > 0
                    && !curPolyline.candidates[0].taboo
                    && curPolyline.candidates[0].rating >= this.settings.candidateQualityThreshold) {
                    numCurFactionCandidates++;
                }
            }

            // possible third pass: if no valid candidates have been found,
            // find candidates with the faction key as label
            for(var i = 0; i < this.polylines[factionKey].length; i++) {
                curPolyline = this.polylines[factionKey][i];
                if(curPolyline.candidates.length === 0
                    || curPolyline.candidates[0].taboo
                    || curPolyline.candidates[0].rating < this.settings.candidateQualityThreshold) {
                    // the long labels yielded no suitable candidates
                    // generate labels using the faction key only
                    console.log('using ' + factionKey + ' only, highest rating is ' + curPolyline.candidates[0].rating);
                    this.findCandidatesIteratively(curPolyline, factionKey);
                    console.log(curPolyline.candidates.length + ' candidates');
                    this.rateAndSortCandidates(curPolyline, [], curPolyline.candidates);
                }
            }
        }
	};

    /**
     * Select the labels from the list of candidates for each faction.
     */
    BorderLabeler.prototype.selectCandidates = function () {
        var faction;
        var curPolyline, curCandidate;
        var factionLabels;

        for(var factionKey in this.polylines) {
            faction = this.factions[factionKey];
            factionLabels = [];
            if(!faction
                || !this.polylines.hasOwnProperty(factionKey)
                || factionKey === 'DUMMY'
                || factionKey === 'I') {
                continue;
            }
            for(var i = 0; i < this.polylines[factionKey].length; i++) {
                curPolyline = this.polylines[factionKey][i];
                while(curPolyline.candidates.length > 0) {
                    this.rateAndSortCandidates(curPolyline, factionLabels, curPolyline.candidates);
                    curCandidate = curPolyline.candidates[0];
                    if(!curCandidate.taboo && curCandidate.rating >= this.settings.candidateQualityThreshold) {
                        //console.log('new ' + curPolyline.candidates[0].id +', ' + curPolyline.candidates[0].rating);
                        factionLabels.push(curCandidate);
                        curPolyline.labels.push(Utils.deepCopy(curCandidate));
                        curCandidate.taboo = true;
                    } else {
                        break;
                    }
                }
            }
        }
    };

    /**
     * Generates candidates along the polyline.
     *
     * @param polyline {Object} The polyline
     * @param labelTextParts {Array} The label text to place
     * @param labelWidth {Number} The label text's width in map units
     * @private
     */
    BorderLabeler.prototype.findCandidatesIteratively = function (polyline, labelTextParts) {
        var candidates = polyline.candidates || [];
        var startPos = 0; // the starting position along the polyline (a number btw. 0 and the polyline's length)
        var endPos = 0; // the end position along the polyline (see above)
        var startPt, endPt;
        var newCandidate, controlPoints, curCtrlPt, ctrlPointDist;
        var angle, candidateLine, tmp;
        var labelWidths = [];
        var maxLabelWidth = 0; // the maximum width of one of the label parts
        var totalLabelWidth = 0; // the width of all label parts concatenated together
        var labelDxValues = [];
        var dxSum = 0;
        var labelDyValues = [];
        var labelPartBBoxes = [];
        var startPosStepSize; // the distance (on the polyline) between candidates
        var searchStepSize; // the size of the next incremental search step
        var candidateDisqualified = false;

        if(labelTextParts && typeof labelTextParts === 'string') {
            labelTextParts = [labelTextParts];
        }
        if(!labelTextParts || labelTextParts.length === 0) {
            this.logger.warn('BorderLabeler could not find label candidates: No label text for polyline "'+polyline.id+'".');
            return;
        }
        // calculate label widths
        for(var i = 0; i < labelTextParts.length; i++) {
            labelWidths.push(this.calculateLabelLength(labelTextParts[i]));
            maxLabelWidth = Math.max(maxLabelWidth, labelWidths[labelWidths.length-1]);
        }
        totalLabelWidth = this.calculateLabelLength(labelTextParts.join(' '));
        // calculate dx / dy values
        for(var i = 0; i < labelTextParts.length; i++) {
            // negate all the preceding label parts
            labelDxValues.push((maxLabelWidth - labelWidths[i]) * .5 - dxSum);
            dxSum += labelDxValues[i] + labelWidths[i];
            if(i === 0) {
                labelDyValues.push((labelTextParts.length-1) * -this.glyphSettings.lineHeight);
            } else {
                labelDyValues.push(i * this.glyphSettings.lineHeight);
            }
        }

        // TODO make these configurable
        startPosStepSize = maxLabelWidth * this.settings.candidateDistFactor; //totalLabelWidth * .25; // the distance (on the polyline) between candidates
        searchStepSize = maxLabelWidth * this.settings.labelGrowFactor; // totalLabelWidth * .05; // the size of the next incremental search step

        while(endPos < polyline.length + maxLabelWidth) {// && labelText === 'Draconis Combine') {
            // look at a new starting position
            endPos = startPos + maxLabelWidth;
            startPt = Utils.pointAlongPolyline(polyline.edges, startPos % polyline.length);
            do {
                endPt = Utils.pointAlongPolyline(polyline.edges, endPos % polyline.length);
                endPos += searchStepSize;
                if(!endPt) {
                    break;
                }
            } while(Utils.pointDistance(startPt, endPt) < maxLabelWidth);
            // abort if the current candidate goes beyond the polyline
            if(!endPt) {
                break;
            }
            // the candidate's start and end point have been found
            newCandidate = {
                polylineId : polyline.id,
                midPt : {x: (startPt.x + endPt.x) * .5, y: (startPt.y + endPt.y) * .5 },
                fromPt : startPt,
                toPt : endPt,
                midPos : (startPos + endPos) / 2,
                startPos : startPos,
                endPos : endPos - searchStepSize,
                midPosByPolylineLength : ((startPos + endPos) / 2) / polyline.length,
                labelText : labelTextParts[0],
                labelParts : labelTextParts,
                labelWidth : maxLabelWidth,
                labelHeight : labelTextParts.length * this.glyphSettings.lineHeight,
                controlPointDist : -Infinity,
                verticalOffset : -Infinity,
                dxValues : labelDxValues,
                dyValues : labelDyValues
            };
            // get a different mathematical representation of the candidate line
            candidateLine = Utils.lineFromPoints([startPt.x, startPt.y], [endPt.x, endPt.y]);

            // Gather up all possible control points for the candidate. Control points lie
            // on the polyline and include the candidate line's start and end points, as well
            // as any polyline edge meeting points along the candidate line.
            controlPoints = this.findEdgeMeetingPoints(polyline.edges, startPos, endPos);
            controlPoints.push(Utils.pointAlongCubicPolycurve(polyline.edges, newCandidate.startPos));
            controlPoints.push(Utils.pointAlongCubicPolycurve(polyline.edges, newCandidate.endPos));
            controlPoints.push(Utils.pointAlongCubicPolycurve(polyline.edges, newCandidate.midPos));

            // Use the control points to calculate the line's vertical offset
            for(var ci = 0; ci < controlPoints.length; ci++) {
                curCtrlPt = controlPoints[ci];
                if(!curCtrlPt) {
                    continue;
                }
                // only take control points on the label's side of the polyline into account
                /*if(Utils.pointIsLeftOfLine(curCtrlPt, startPt, endPt)) {
                    continue;
                }*/
                //this.logger.log('dist is ' + Utils.distanceLineToPoint(candidateLine, curCtrlPt));
                ctrlPointDist = Utils.distanceLineToPoint(candidateLine, curCtrlPt);
                if(Utils.pointIsLeftOfLine(curCtrlPt, startPt, endPt)) {
                    ctrlPointDist *= -1;
                }
                // default additional distance
                // TODO magic number?
                ctrlPointDist += 1;
                // ctrlPointDist += borderWidth * 2;

                newCandidate.controlPointDist = Math.max(
                    newCandidate.controlPointDist,
                    ctrlPointDist
                );
            }

			// perpendicular line, points towards right hand side
			var perpVec = [
				newCandidate.toPt.y - newCandidate.fromPt.y,
				-1*(newCandidate.toPt.x - newCandidate.fromPt.x)
			];

            angle = Utils.radToDeg(Utils.angleBetweenPoints(newCandidate.fromPt, newCandidate.toPt));
            angle = (angle + 360) % 360;
            //this.logger.log(newCandidate.controlPointDist);
            if(angle > 90 && angle < 270) {
                tmp = newCandidate.fromPt;
                newCandidate.fromPt = newCandidate.toPt;
                newCandidate.toPt = tmp;
                newCandidate.angle = (angle + 180) % 360;
				newCandidate.flipped = true;
                newCandidate.verticalOffset = -newCandidate.controlPointDist;
                newCandidate.lineOffset = -this.glyphSettings.lineHeight;
                //Math.min(-1.5, -newCandidate.controlPointDist);
            } else {
				newCandidate.angle = angle;
				newCandidate.flipped = false;
                newCandidate.verticalOffset =  newCandidate.controlPointDist + newCandidate.labelHeight;
                newCandidate.lineOffset = this.glyphSettings.lineHeight;
                //Math.max(1, newCandidate.controlPointDist) + this.glyphSettings.lineHeight; // TODO this is the minimum offset!
            }

			// calculate the candidate's (rotated) bounding box
            var xVecL, xVecR, yVec, bbox;
            for(var i = 0; i < labelWidths.length; i++) {
                xVecL = [newCandidate.toPt.x - newCandidate.fromPt.x, newCandidate.toPt.y - newCandidate.fromPt.y];
                xVecR = Utils.deepCopy(xVecL);
                Utils.scaleVector2d(xVecL, 0.5 * (maxLabelWidth - labelWidths[i]));
                Utils.scaleVector2d(xVecR, 0.5 * (maxLabelWidth + labelWidths[i]));
                yVec = Utils.deepCopy(perpVec);
                Utils.scaleVector2d(yVec, Math.abs(newCandidate.verticalOffset + labelDyValues[i]));
                bbox = {};
                bbox.bl = {
                    x: newCandidate.fromPt.x + xVecL[0] + yVec[0],
                    y: newCandidate.fromPt.y + xVecL[1] + yVec[1]
                };
                bbox.br = {
                    x: newCandidate.toPt.x + xVecR[0] + yVec[0],
                    y: newCandidate.toPt.y + xVecR[1] + yVec[1]
                };
                if(newCandidate.flipped) {
    				Utils.scaleVector2d(yVec, Math.abs(newCandidate.verticalOffset) + this.glyphSettings.lineHeight * i);
    			} else {
    				Utils.scaleVector2d(yVec, Math.abs(newCandidate.verticalOffset) - this.glyphSettings.lineHeight * i);
    			}
                bbox.tl = {
                    x: newCandidate.fromPt.x + xVecL[0] + yVec[0],
                    y: newCandidate.fromPt.y + xVecL[1] + yVec[1]
                };
                bbox.tr = {
                    x: newCandidate.toPt.x + xVecR[0] + yVec[0],
                    y: newCandidate.toPt.y + xVecR[1] + yVec[1]
                };
                labelPartBBoxes.push(bbox);
            }
            newCandidate.labelPartBBoxes = labelPartBBoxes;
			Utils.scaleVector2d(perpVec, Math.abs(newCandidate.verticalOffset));
			newCandidate.bl = {
				x: newCandidate.fromPt.x + perpVec[0],
				y: newCandidate.fromPt.y + perpVec[1]
			};
			newCandidate.br = {
				x: newCandidate.toPt.x + perpVec[0],
				y: newCandidate.toPt.y + perpVec[1]
			};
			if(newCandidate.flipped) {
				Utils.scaleVector2d(perpVec, Math.abs(newCandidate.verticalOffset) + newCandidate.labelHeight);
			} else {
				Utils.scaleVector2d(perpVec, Math.abs(newCandidate.verticalOffset) - newCandidate.labelHeight);
			}
			newCandidate.tl = {
				x: newCandidate.fromPt.x + perpVec[0],
				y: newCandidate.fromPt.y + perpVec[1]
			};
			newCandidate.tr = {
				x: newCandidate.toPt.x + perpVec[0],
				y: newCandidate.toPt.y + perpVec[1]
			};
            newCandidate.id = polyline.id + '_' + candidates.length;

            candidateDisqualified = false;

            // check whether any of the candidate's points lie outside the viewRect
            if(!Utils.pointInRectangle(newCandidate.bl, this.viewRect)
                || !Utils.pointInRectangle(newCandidate.tl, this.viewRect)
                || !Utils.pointInRectangle(newCandidate.tr, this.viewRect)
                || !Utils.pointInRectangle(newCandidate.br, this.viewRect)) {
                this.logger.info('candidate '+newCandidate.id+' will be disqualified because it lies outside the viewport');
                candidateDisqualified = true;
            }

            // check whether the candidate intersects any of the polyline's edges
            var iPoint, minIPtDist = 0;
            for(var ei = 0; !candidateDisqualified && ei < polyline.edges.length; ei++) {
                minIPtDist = 0;
                iPoint = Utils.getLineSegmentsIntersection(polyline.edges[ei].p1, polyline.edges[ei].p2,
                            newCandidate.bl, newCandidate.br);
                if(iPoint !== null) {
                    minIPtDist = Math.min(
                        Utils.pointDistance(newCandidate.bl, iPoint),
                        Utils.pointDistance(newCandidate.br, iPoint)
                    );
                }
                iPoint = Utils.getLineSegmentsIntersection(polyline.edges[ei].p1, polyline.edges[ei].p2,
                            newCandidate.tl, newCandidate.tr);
                if(iPoint !== null) {
                    minIPtDist = Math.max(minIPtDist,
                        Math.min(
                            Utils.pointDistance(newCandidate.tl, iPoint),
                            Utils.pointDistance(newCandidate.tr, iPoint)
                        )
                    );
                }
                if(minIPtDist > this.settings.labelPolylineTolerance) {
                    this.logger.log('candidate '+newCandidate.id+' will be disqualified because it intersects the polyline');
                    candidateDisqualified = true;
                    break;
                }
            }

            // evaluate disqualification status
            if(candidateDisqualified) {
                // candidate will not be added to candidate list - iterate with a smaller step size
                startPos += startPosStepSize * .5;
                continue;
            }

			// candidate is ready to go
            candidates.push(newCandidate);

            // prepare start position for next iteration
            startPos += startPosStepSize;
        }

        // DEBUG
        /*for(var i = 0; i < candidates.length; i++) {
            if(candidates[i].id !== 'FS_0_63') {
                candidates.splice(i,1);
                i--;
            }
        }
        console.log(candidates.length + ' candidates');*/
        // DEBUG END

        polyline.candidates = candidates;
    };

    /**
     * Helper function that finds all edge meeting points between startPos and endPos
     * on a polyline.
     * TODO put this in Utils? Might be too specific.
     * @private
     */
    BorderLabeler.prototype.findEdgeMeetingPoints = function (pLineParts, startPos, endPos) {
        var curLine;
        var curLineStartDist = 0;
        var lineInRange = false;
        var points = [];
		for(var i = 0, len = pLineParts.length; i < len; i++) {
			curLine = pLineParts[i];
            if(startPos < curLineStartDist + curLine.length) {
                lineInRange = true;
            }
            if(lineInRange) {
                if(curLineStartDist >= startPos) {
                    points.push(curLine.n1);
                }
                if(curLineStartDist + curLine.length <= endPos) {
                    points.push(curLine.n2);
                } else {
                    break;
                }
            }
            curLineStartDist += curLine.length;
        }
		return points;
    };

    /**
     * Add a numerical rating between 0 (bad) and 1 (good) to each of the given candidates,
     * and sort the candidates array by rating (in descending fashion).
     *
     * @param placedLabels {Array} The labels that have already been placed
     * @param candidates {Array} The candidates to rate. Note that this array will be changed.
     */
    BorderLabeler.prototype.rateAndSortCandidates = function (polyline, placedLabels, candidates) {
        var weights = { // TODO make this a config option
            overlap: .65,
            angle: .15,
            verticalDistance: .125,
            centeredness : .075
        };
        var curCandidate;
        var overlapRating;
        var overlapMax, overlapArea;
        var angleRating;
        var verticalDistanceRating;
        var verticalDistanceMax;
        var centerednessRating;
		var polygons, lines;

        // minimum position distance between label midpoints
        // minimum euclidean distance between label midpoints
        // TODO make these configurable
        var minPosDist = 25;
        var minTrueDist = 35;

        if(!candidates || candidates.length === 0) {
            return;
        }
        if(!placedLabels) {
            placedLabels = [];
        }

        overlapMax = candidates[0].labelWidth * this.glyphSettings.lineHeight;
        verticalDistanceMax = candidates.map(function (el) {
            return el.controlPointDist;
        }).reduce(function (acc, curVal) {
            return Math.max(acc, curVal);
        }, 0);

        for(var i = 0; i < candidates.length; i++) {
            curCandidate = candidates[i];
			polygons = [];
			lines = [];

            // if the candidate is already taboo, skip rating it
            if(!!curCandidate.taboo) {
                continue;
            }

            // disqualify the label if it is too close to another label that
            // already exists for this faction
            for(var li = 0; li < placedLabels.length; li++) {
                if( (placedLabels[li].polylineId === curCandidate.polylineId
                        && Math.abs(placedLabels[li].midPos, curCandidate.midPos) < minPosDist)
                    || (Utils.pointDistance(placedLabels[li].midPt, curCandidate.midPt) < minTrueDist)
                ) {
                    curCandidate.taboo = true;
                    break;
                }
            }

            // rate the overlap area
            overlapArea = this.findCandidateOverlapWithExistingLabels(curCandidate, polygons, lines);
            overlapRating = 1 - Math.min(1, 4 * overlapArea / overlapMax);
            overlapRating *= weights.overlap;

            // rate the angle
            if(curCandidate.angle <= 90) {
                angleRating = 1 - curCandidate.angle / 90;
            } else { // 270 <= angle < 360
                angleRating = (curCandidate.angle - 270) / 90;
            }
            angleRating *= weights.angle;

            // rate the distance
            verticalDistanceRating = 1 - curCandidate.controlPointDist / verticalDistanceMax;
            verticalDistanceRating *= weights.verticalDistance;

            // rate the centeredness
            centerednessRating = 1 - Math.abs(.5 - curCandidate.midPosByPolylineLength) * 2;
            centerednessRating *= weights.centeredness;

            curCandidate.rating = overlapRating + angleRating + verticalDistanceRating + centerednessRating;
            curCandidate.polygons = polygons;
            curCandidate.lines = lines;
        }

        candidates.sort(function (a, b) {
            if(!a.taboo && !!b.taboo) {
                return -1;
            } else if(!!a.taboo && !b.taboo) {
                return 1;
            }
            return b.rating - a.rating;
        });
    };

    BorderLabeler.prototype.findCandidateOverlapWithExistingLabels = function (candidate, polygons, lines) {
        var boundingBox = {
            x: Math.min(candidate.bl.x, candidate.tl.x, candidate.br.x, candidate.tr.x),
            y: Math.min(candidate.bl.y, candidate.tl.y, candidate.br.y, candidate.tr.y),
            right: Math.max(candidate.bl.x, candidate.tl.x, candidate.br.x, candidate.tr.x),
            top: Math.max(candidate.bl.y, candidate.tl.y, candidate.br.y, candidate.tr.y)
        };
        boundingBox.w = boundingBox.right - boundingBox.x;
        boundingBox.h = boundingBox.top - boundingBox.y;
		var boundingRect = {
			p0: candidate.bl,
			p1: candidate.tl,
			p2: candidate.tr,
			p3: candidate.br
		};
        //console.log('bbox ', boundingBox);
        var overlaps = this.labelGrid.getOverlaps(boundingBox);
		var intersection;
		var overlapArea = 0;

        if(overlaps && overlaps.length) {
            //console.log(overlaps.length + ' object overlaps detected!');
			for(var i = 0; i < overlaps.length; i++) {
                intersection = Utils.rectRotRectOverlap(overlaps[i], boundingRect);
				polygons.push(intersection.p);
				lines.push(intersection.l);
				overlapArea += Utils.polygonArea(polygons[polygons.length -1]);
			}
        }
		/*if(overlapArea > 0) {
			console.log('overlap area is ' + overlapArea + ' for ' + candidate.id);
		}*/
        return overlapArea;
    };

	return BorderLabeler;
})();
