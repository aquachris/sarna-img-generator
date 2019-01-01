module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');
	var seedrandom = require('seedrandom');

    /**
     * An instance of this class generates a set of randomized points around the circumference
	 * of an elliptical (nebula) object in order to generate a cloud-like object to display.
     */
    var NebulaRandomizer = function (logger) {
        this.logger = logger || console;

		// array of the nebula objects
		this.nebulae = null;
    };

    NebulaRandomizer.prototype.constructor = NebulaRandomizer;

	NebulaRandomizer.prototype.init = function (nebulae) {
        this.nebulae = nebulae || [];
		this.calculate();
		return this;
	};

	NebulaRandomizer.prototype.calculate = function () {
        var curNebula;
		var widthToHeight;
        var numPoints;
        var curPoint, prevPoint;
        var startAngle;
        var angleInDeg, angleInRad;
		var distToCenter;
		var rng;

        for(var i = 0, len = this.nebulae.length; i < len; i++) {
            curNebula = this.nebulae[i];
            curNebula.points = [];
			rng = seedrandom(curNebula.name);
            // calculate approximated ellipse circumference
			curNebula.circumference = Utils.ellipseCircumference(curNebula);

			// ellipse's width to height ratio
			widthToHeight = curNebula.w / curNebula.h;

            numPoints = curNebula.circumference / 5;
            numPoints *= 0.9 + rng() * .25;
			numPoints = Math.max(3, Math.round(numPoints));

            startAngle = Math.floor(rng()*360);
            angleInDeg = 0;
            angleInRad = 0;
            for(var j = 0; j < numPoints; j++) {
                angleInDeg = startAngle + j * 360 / numPoints;
                if(angleInDeg >= 360) angleInDeg -= 360;
                angleInRad = Utils.degToRad(angleInDeg);
                curPoint = Utils.pointOnEllipseWithAngle(curNebula, angleInRad);
                curNebula.points.push({
					x: curPoint[0],
					y: curPoint[1]
				});
            }

			this.randomizePoints(curNebula, rng);
			this.generateControlPoints(curNebula);
        }
	};

	NebulaRandomizer.prototype.randomizePoints = function (nebula, rng) {
		var prevI, nextI;
		var p1, p2, p3;
		var dist;
		var deviation;

		nebula.originalPoints = nebula.points;
		nebula.points = [];

		for(var i = 0, len = nebula.originalPoints.length; i < len; i++) {
			prevI = i - 1;
			if(prevI < 0) {
				prevI = len - 1;
			}
			nextI = i + 1;
			if(nextI >= len) {
				nextI = 0;
			}

			p1 = nebula.originalPoints[prevI];
			p2 = nebula.originalPoints[i];
			p3 = nebula.originalPoints[nextI];

			dist = Math.min(Utils.distance(p2.x, p2.y, p1.x, p1.y),
							Utils.distance(p2.x, p2.y, p3.x, p3.y));

			// deviate in a random x and y direction
			deviation = [rng(), rng()];

			// scale deviation
			Utils.scaleVector2d(deviation, (rng() - 0.5) * dist * .975);

			nebula.points.push({
				x: p2.x + deviation[0],
				y: p2.y + deviation[1]
			});
		}
	};

	/**
     * For each nebula point, generate two bezier control points.
	 * The goal is to make the nebula look "natural", if that is even possible in 2D.
	 *
	 * @param nebula {Object} The nebula object
     */
    NebulaRandomizer.prototype.generateControlPoints = function (nebula) {
		var prevI, nextI;
        var p1, p2, p3, dist12, dist23, w, h;
        var fa, fb;
        var tension = .35;//.65;


		for(var i = 0, len = nebula.points.length; i < len; i++) {
			prevI = i - 1;
			if(prevI < 0) {
				prevI = nebula.points.length - 1;
			}
			nextI = i + 1;
			if(nextI >= nebula.points.length) {
				nextI = 0;
			}

			p1 = nebula.points[prevI];
			p2 = nebula.points[i];
			p3 = nebula.points[nextI];

			dist12 = Utils.distance(p1.x, p1.y, p2.x, p2.y);
			dist23 = Utils.distance(p2.x, p2.y, p3.x, p3.y);

			// generate two control points for the looked at point (p2)
			// see http://walter.bislins.ch/blog/index.asp?page=JavaScript%3A+Bezier%2DSegmente+f%FCr+Spline+berechnen
			fa = tension * dist12 / (dist12 + dist23);
			fb = tension * dist23 / (dist12 + dist23);

			w = p3.x - p1.x;
			h = p3.y - p1.y;

			p2.c1 = {
				x: p2.x - fa * w,
				y: p2.y - fa * h
			};
			p2.c2 = {
				x: p2.x + fb * w,
				y: p2.y + fb * h
			};
		}
    };

	/**
	 * Reduces the amount of points in a nebula polygon path to only those that are actually displayed,
	 * and also adds connecting "off-screen" lines to maintain shape closure.
	 *
	 * This is an optional step that reduces file size.
	 *
	 * @param rect {Object} The bounding box (x, y, w, h in map space)
     * @param tolerance {Number} Bounding box tolerance, default is 10
	 * @returns {Array} List of bounded nebulae for each faction
	 */
	NebulaRandomizer.prototype.generateBoundedNebulae = function (rect, tolerance) {
		var tRect;
		var curNebula;
		var curNebulaIsVisible;
		var curPoint, prevPoint;
		var curPointVisible, prevPointVisible;
		var curBoundedNeb;
		var boundedNebulae = [];
		var outsidePoints = [];
		var aggregatedOutsidePoints = [];

		tolerance === undefined ? tolerance = 3 : false;
		tRect = {
            x: rect.x - tolerance,
            y: rect.y - tolerance,
            w: rect.w + tolerance * 2,
            h: rect.h + tolerance * 2
        };

		// private helper function that constrains a point to the given rectangle
        var clampPoint = function(x, y, rect) {
            return {
                x: Math.min(Math.max(x, rect.x), rect.x + rect.w),
                y: Math.min(Math.max(y, rect.y), rect.y + rect.h)
            };
        };

		// private helper function that aggregates outside points
		var aggregateOutsidePoints  = function (points) {
			var resultingPoints = [];

            var p1, p2, p3;
            var newEdge;

            if(!points || points.length < 1) {
                return resultingPoints;
            } else if(points.length === 1) {
				resultingPoints.push(Utils.deepCopy(points[0]));
			}

            // make sure p1 and p2 are set
            p1 = points[0];
            p2 = points[1];

            // Remove points one by one:
            // If the array's first three points are on a common line along the
            // x or y direction, the middle point can be removed.
            // If not, point 1 will be added to the resulting array and removed
			// from the list
            while(points.length > 2) {
                p1 = points[0];
                p2 = points[1];
                p3 = points[2];

                // remove identical points p2, or ones that are on a line between p1 and p3
                if( (p1.x === p2.x && (p1.y === p2.y || p2.x === p3.x)) ||
                    (p1.y === p2.y && p2.y === p3.y) ) {
                    points.splice(1, 1); // remove p2

                // there is a switch in direction at p2
                } else {
					resultingPoints.push(p1);
					points.shift(); // remove p1
                }
            }
            // clean up the remaining two points
            resultingPoints.push(p1);
			resultingPoints.push(p2);
			return resultingPoints;
		};

		// iterate over all nebulae
		for(var i = 0; i < this.nebulae.length; i++) {
			curNebula = this.nebulae[i];
			curNebulaIsVisible = false;
			curBoundedNeb = Utils.deepCopy(curNebula);
			curBoundedNeb.allPoints = curBoundedNeb.points;
			curBoundedNeb.points = [];
			curPoint = undefined;
			curPointVisible = false;
			prevPointVisible = false;
			outsidePoints = [];


			// iterate over the current nebula's points
			for(var j = 0; j < curNebula.points.length; j++) {
				prevPoint = curPoint;
				curPoint = curNebula.points[j];
				prevPointVisible = !!prevPoint ? Utils.pointInRectangle(prevPoint, tRect) : false;
				curPointVisible = Utils.pointInRectangle(curPoint, tRect);

				// either the current point or the previous point is visible
				// --> add current point to list, after adding any outside points that precede it
				if(prevPointVisible || curPointVisible) {
					aggregatedOutsidePoints = aggregateOutsidePoints(outsidePoints);
					for(var oi = 0; oi < aggregatedOutsidePoints.length; oi++) {
						curBoundedNeb.points.push(aggregatedOutsidePoints[oi]);
					}
					outsidePoints = [];
					curBoundedNeb.points.push(Utils.deepCopy(curPoint));
					curNebulaIsVisible = true;

				// both the previous and the current point are invisible
                // --> add the current edge's first point to a list of outside points
                //     that will be aggregated and re-assembled to shorter path parts later
                } else {
                    outsidePoints.push(clampPoint(curPoint.x, curPoint.y, tRect));
				}
			}

			// add remaining outside points
			aggregatedOutsidePoints = aggregateOutsidePoints(outsidePoints);
			if(curNebulaIsVisible || aggregatedOutsidePoints.length >= 4) {
				for(var oi = 0; oi < aggregatedOutsidePoints.length; oi++) {
					curBoundedNeb.points.push(aggregatedOutsidePoints[oi]);
				}
			}

			if(curBoundedNeb.points.length > 0) {
				boundedNebulae.push(curBoundedNeb);
			}
		}

		return boundedNebulae;
	};

    return NebulaRandomizer;
})();
