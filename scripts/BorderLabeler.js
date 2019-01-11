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
        return this;
    };

    /**
     * Extract polylines from the border loops.
     */
    BorderLabeler.prototype.extractPolylines = function (borderLoops) {
        var curLoop;
        var curPolyline;

        this.polylines = {};
        for(var faction in borderLoops) {
            if(!borderLoops.hasOwnProperty(faction)) {
                continue;
            }
            this.polylines[faction] = [];
            // iterate over this faction's loops
            for(var i = 0, len = borderLoops[faction].length; i < len; i++) {
                curLoop = borderLoops[faction][i];
            }
            //curPolyline =
        }
    };

	/**
	 * Extract polylines from border polygons
	 */
	BorderLabeler.prototype.extractPolylinesOld = function (borderPolygonMap) {
		var borderEdges;
		var otherCol;
		var curEdge, curPolyline, nextPolyline;
		var borderId;

		this.polylines = [];

		for(var col in borderPolygonMap) {
			borderEdges = borderPolygonMap[col];
			if(curPolyline) {
				this.polylines.push(curPolyline);
			}
			curPolyline = null;
			for(var i = 0, len = borderEdges.length; i < len; i++) {
				curEdge = borderEdges[i];
				if(!curEdge.hasOwnProperty('leftCol') || !curEdge.hasOwnProperty('rightCol')) {
					// skip this edge
					continue;
				}
				if(!Utils.pointInRectangle(curEdge.n1, this.viewRect) && !Utils.pointInRectangle(curEdge.n2, this.viewRect)) {
					// skip this edge
					continue;
				}
				if(curEdge.leftCol === col) {
					otherCol = curEdge.rightCol;
				} else {
					otherCol = curEdge.leftCol;
				}
				if(otherCol < col) {
					if(curPolyline) {
						this.polylines.push(curPolyline);
						curPolyline = null;
					}
					// skip this edge
					continue;
				}
				borderId = col + '-' + otherCol;
				if(curPolyline && borderId !== curPolyline.borderId) {
					// close existing polyline and start new one
					this.polylines.push(curPolyline);
					curPolyline = null;
				}
				if(!curPolyline) {
					curPolyline = {
						borderId : borderId,
						leftCol : curEdge.leftCol,
						rightCol : curEdge.rightCol,
						lineParts : []
					};
				}
				curPolyline.lineParts.push(curEdge);
			}
		}
		if(curPolyline) {
			this.polylines.push(curPolyline);
			curPolyline = null;
		}
		// try to connect polylines belonging together
		this.polylines.sort(function (a, b) {
			if(a.borderId < b.borderId) {
				return -1;
			} else if(a.borderId > b.borderId) {
				return 1;
			} else {
				return 0;
			}
		});
		for(var i = 0; i < this.polylines.length - 1; i++) {
			curPolyline = this.polylines[i];
			nextPolyline = this.polylines[i+1];
			if(curPolyline.borderId !== nextPolyline.borderId) {
				continue;
			}
			//console.log('possible merge opportunity for ' + curPolyline.borderId);
			if(curPolyline.lineParts[curPolyline.lineParts.length - 1].p2.x === nextPolyline.lineParts[0].p1.x
				&& curPolyline.lineParts[curPolyline.lineParts.length - 1].p2.y === nextPolyline.lineParts[0].p1.y) {
				//console.log('MERGE end to start');
				curPolyline.lineParts = curPolyline.lineParts.concat(nextPolyline.lineParts);
				// remove merged polyline
				this.polylines.splice(i + 1, 1);
			} else if(curPolyline.lineParts[0].p1.x === nextPolyline.lineParts[nextPolyline.lineParts.length - 1].p2.x
				&& curPolyline.lineParts[0].p1.y === nextPolyline.lineParts[nextPolyline.lineParts.length - 1].p2.y) {
				//console.log('MERGE start to end');
				curPolyline.lineParts = nextPolyline.lineParts.concat(curPolyline.lineParts);
				// remove merged polyline
				this.polylines.splice(i + 1, 1);
			}
		}
	};

	/**
	 * Generate candidate positions
	 */
	BorderLabeler.prototype.generateCandidates = function () {
		for(var i = 0; i < this.polylines.length; i++) {
			this.polylines[i].candidates = this.generateCandidatesAlongPolyline(this.polylines[i]);
		}
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

	/**
	 * Corresponds to Phase II in the linked algorithm paper.
	 */
	BorderLabeler.prototype.findCenterlines = function () {
		for(var i = 0, len = this.polylines.length; i < len; i++) {
			for(var j = 0; j < this.polylines[i].candidates.length; j++) {
				this.findCenterlineForCandidate(this.polylines[i], this.polylines[i].candidates[j]);
			}
		}
	};

	/**
	 *
	 */
	BorderLabeler.prototype.findCenterlineForCandidate = function (polyline, candidate) {
		var t1, t2;
		var radius = 0;
		var cur, curDist, min1, min2, minDist1, minDist2;
		var iPoints = Utils.polylineCircleIntersection(polyline.lineParts, {
			centerX : candidate.x,
			centerY : candidate.y,
			radius : radius
		});
		candidate.iPoints = [];
		// find t1 and t2
		for(var i = .6; i <= 1; i += .1) {
			radius = polyline.wMax * i;
			var iPoints = Utils.polylineCircleIntersection(polyline.lineParts, {
				centerX : candidate.x,
				centerY : candidate.y,
				radius : radius
			});
			// use only the two closest intersection points
			if(iPoints > 2) {
				minDist1 = minDist2 = Infinity;
				min1 = min2 = null;
				for(var j = 0; j < iPoints.length; j++) {
					curDist = Utils.distance(candidate.x, candidate.y, iPoints[j].x, iPoints[j].y);
					if(curDist < minDist2) {
						minDist2 = curDist;
						min2 = iPoints[j];
					}
					if(minDist1 > minDist2) {
						cur = min1;
						curDist = minDist1;
						min1 = min2;
						minDist1 = minDist2;
						min2 = cur;
						minDist2 = curDist;
					}
				}
				iPoints = [min1, min2];
			}
			if(iPoints < 2) {
				this.logger.info('phase II: <2 intersection points with C for ' + polyline.borderId + ' ' + i + ', r ' + radius);
				continue;
			}
			if(polyline.wMax > Utils.distance(iPoints[0].x, iPoints[0].y, iPoints[1].x, iPoints[1].y)) {
				this.logger.info('phase II: circle radius too small for ' + polyline.borderId + ' ' + i + ', r ' + radius);
				continue;
			}
			break;
		}
		// find all polyline points inside the circle
		for(var i = 0, len = polyline.lineParts.length; i < len; i++) {
			// for the first line part, look at p1 as well as p2
			if(i === 0) {
				cur = polyline.lineParts[i].p1;
				curDist = Utils.distance(candidate.x, candidate.y, cur.x, cur.y);
				if(curDist < radius) {
					iPoints.push(cur);
				}
			}
			cur = polyline.lineParts[i].p2;
			curDist = Utils.distance(candidate.x, candidate.y, cur.x, cur.y);
			if(curDist < radius) {
				iPoints.push(cur);
			}
		}
		candidate.iPoints = iPoints;
		var reg = Utils.simpleLinearRegression(iPoints);
		//var vec = [1, reg.alpha + reg.beta];
		var iVecs = [];
        var xs = [];
        var ys = [];
		for(var i = 0, len = iPoints.length; i < len; i++) {
            xs.push(iPoints[i].x);
            ys.push(iPoints[i].y);
			iVecs.push([
				candidate.x - iPoints[i].x,
				candidate.y - iPoints[i].y
			]);
		}
		var vec = Utils.basicAvgVector(iVecs);
        var vec2 = Utils.findLineByLeastSquares(xs, ys);
		//Utils.scaleVector2d(vec, polyline.wMax * .5);
		/*var rLine = {
			x1: candidate.x - vec2[0], y1: candidate.y - vec2[1],
			x2: candidate.x + vec2[0], y2: candidate.y + vec2[1]
		};*/
        var rLine = {
            x1: vec2[0][0], y1: vec2[1][0],
            x2: vec2[0][1], y2: vec2[1][1]
        };
        var rLineAsLine = Utils.lineFromPoints([rLine.x1, rLine.y1], [rLine.x2, rLine.y2]);
        //console.log('rLine', rLine);
        var perp = Utils.perpendicularFromLineToPoint(rLineAsLine, candidate);
        var perpLine = {
            x1: rLine.x1, y1: -perp[0]*rLine.x1 + perp[2],
            x2: rLine.x2, y2: -perp[0]*rLine.x2 + perp[2]
        };
        var perpIPoint = Utils.lineLineIntersection(rLineAsLine, perp);
        var perpIVec = [perpLine.x1 - perpIPoint[0], perpLine.y1 - perpIPoint[1]];

        /*Utils.perpendicularBisectorFromLine(
            [1, 1], [0, 0], pBiLine
        );
        console.log('perpBis', pBiLine);*/
        //var pp1 = { x: candidate.x - 10, y: perp[0]

		// point distances
		var leftMax = 0, rightMax = 0;
		var curH;
		for(var i = 0; i < iPoints.length; i++) {
			curH = Utils.distanceLineToPoint(rLineAsLine, iPoints[i]);
			//console.log(rLineAsLine, iPoints[i].x, iPoints[i].y, curH.toFixed(1));
			//console.log(curH);
			if(Utils.pointIsLeftOfLine(iPoints[i], {x: rLine.x1, y: rLine.y1}, {x: rLine.x2, y: rLine.y2})) {
				leftMax = Math.max(leftMax, curH);
			} else {
				rightMax = Math.max(rightMax, curH);
			}
		}
        // add additional padding
        // TODO make this a user parameter
        leftMax += this.glyphSettings.lineHeight * 1.25;
        rightMax += this.glyphSettings.lineHeight * 1.25;

		var leftVec = Utils.deepCopy(perpIVec);
		var rightVec = Utils.deepCopy(perpIVec);
		//console.log(rLineAsLine);
		var slope = -rLineAsLine[0] / rLineAsLine[1];
		if(slope <= 0) {
			Utils.scaleVector2d(leftVec, -leftMax);
			Utils.scaleVector2d(rightVec, rightMax);
		} else {
			Utils.scaleVector2d(leftVec, leftMax);
			Utils.scaleVector2d(rightVec, -rightMax);
		}
        perpLine = {
            x1 : perpIPoint[0] + leftVec[0],
            y1 : perpIPoint[1] + leftVec[1],
			x2 : perpIPoint[0] + rightVec[0],
			y2 : perpIPoint[1] + rightVec[1]
        };

        // text angle
        var textAngle = -1 * Utils.radToDeg(Utils.angleBetweenPoints({
            x: rLine.x1, y: rLine.y1
        }, {
            x: rLine.x2, y: rLine.y2
        }));
        if(textAngle > 90 && textAngle < 270) {
            textAngle -= 180;
        }

        candidate.textAngle = textAngle;
		candidate.rLine = rLine;
        candidate.perpLine = perpLine;
        candidate.perpIPoint = {x: perpIPoint[0], y: perpIPoint[1]};
	};

	return BorderLabeler;
})();
