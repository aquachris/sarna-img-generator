module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');

    /**
	 * An instance of this class uses the algorithm outlined in the paper below in
     * order to place labels pairwise on a border line between two state entities.
     *
     * Algorithm paper:
     * http://www.cartographicperspectives.org/index.php/journal/article/view/cp79-rylov-reimer/1374
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
    BorderLabeler.prototype.init = function (vBorders, factions, viewRect, glyphSettings, distanceBetweenLabels) {
        this.vBorders = vBorders;
        this.factions = factions;
        this.glyphSettings = glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };
		this.viewRect = viewRect;
		this.polylines = [];
        return this;
    };
	
	/**
	 * Extract polylines from border polygons
	 */
	BorderLabeler.prototype.extractPolylines = function (borderPolygonMap) {
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
			console.log('possible merge opportunity for ' + curPolyline.borderId);
			if(curPolyline.lineParts[curPolyline.lineParts.length - 1].p2.x === nextPolyline.lineParts[0].p1.x 
				&& curPolyline.lineParts[curPolyline.lineParts.length - 1].p2.y === nextPolyline.lineParts[0].p1.y) {
				console.log('MERGE end to start');
				curPolyline.lineParts = curPolyline.lineParts.concat(nextPolyline.lineParts);
				// remove merged polyline
				this.polylines.splice(i + 1, 1);
			} else if(curPolyline.lineParts[0].p1.x === nextPolyline.lineParts[nextPolyline.lineParts.length - 1].p2.x 
				&& curPolyline.lineParts[0].p1.y === nextPolyline.lineParts[nextPolyline.lineParts.length - 1].p2.y) {
				console.log('MERGE start to end');
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
		console.log(this.polylines.length + ' polylines');
		for(var i = 0; i < this.polylines.length; i++) {
			this.polylines[i].candidates = this.generateCandidatesAlongPolyline(this.polylines[i]);
			//console.log(this.polylines[i].candidates);
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
                wMax += this.glyphSettings.widths[label1[i]] || charDefaultWidth;
            }
            labelWidth = 0;
            for(var i = 0; i < label2.length; i++) {
                labelWidth += this.glyphSettings.widths[label2[i]] || charDefaultWidth;
            }
            // maximum label length
            wMax = Math.max(wMax, labelWidth);
            // minimum distance between q candidates
            sDistance = 1.25 * wMax; // 2 * wMax

            leftFacLabel = label1;
            rightFacLabel = label1;
        }.bind(this);

        if(this.factions.hasOwnProperty(leftFac)) {
            leftFacLabel = this.factions[leftFac].longName;
        }
        if(this.factions.hasOwnProperty(rightFac)) {
            rightFacLabel = this.factions[rightFac].longName;
        }

        calculateLengths(leftFacLabel, rightFacLabel);
        if(pLineLength < 2 * sDistance + wMax) {
            // long labels are too long - try short ones
            calculateLengths(leftFac, rightFac);
            if(pLineLength < 2 * sDistance + wMax) {
                // short labels are too short also - no labeling
				this.logger.log('candidate location generation: line is too short for ' + polyline.borderId);//, pLineLength, 2*sDistance+wMax);
                return [];
            } else {
				this.logger.log('candidate location generation: using short labels for ' + polyline.borderId);//, pLineLength, 2*sDistance+wMax);
			}
        }
		polyline.sDistance = sDistance;
		polyline.wMax = wMax;
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
				this.logger.log('phase II: <2 intersection points with C for ' + polyline.borderId + ' ' + i + ', r ' + radius);
				continue;
			}
			if(polyline.wMax > Utils.distance(iPoints[0].x, iPoints[0].y, iPoints[1].x, iPoints[1].y)) {
				this.logger.log('phase II: circle radius too small for ' + polyline.borderId + ' ' + i + ', r ' + radius);
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
		for(var i = 0, len = iPoints.length; i < len; i++) {
			iVecs.push([
				candidate.x - iPoints[i].x,
				candidate.y - iPoints[i].y
			]);
		}
		var vec = Utils.basicAvgVector(iVecs);
		Utils.scaleVector2d(vec, polyline.wMax * .5);
		var rLine = { 
			x1: candidate.x - vec[0], y1: candidate.y - vec[1], 
			x2: candidate.x + vec[0], y2: candidate.y + vec[1] 
		};
		candidate.rLine = rLine;
	};
	
	return BorderLabeler;
})();
