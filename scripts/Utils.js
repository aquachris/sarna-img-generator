module.exports = (function () {
    'use strict';

	var Utils = {};

    /**
     * @param p {Array} 2D-Point in the form [x,y]
     * @param q {Array} 2D-Point in the form [x,y]
     * @param r {Array} 2D-Point in the form [x,y]
     * @returns {Array} Circumcenter point in the form [x,y]
     */
    Utils.circumcenter = function (p, q, r) {
        // Line PQ is represented as ax + by = c
        var abc = this.lineFromPoints(p, q);

        // Line QR is represented as ex + fy = g
        var efg = this.lineFromPoints(q, r);

        // Converting lines PQ and QR to perpendicular
        // vbisectors. After this, L = ax + by = c
        // M = ex + fy = g
        this.perpendicularBisectorFromLine(p, q, abc);
        this.perpendicularBisectorFromLine(q, r, efg);

        // The point of intersection of L and M gives
        // the circumcenter
        var circumcenter = this.lineLineIntersection(abc, efg);

        if (circumcenter[0] === Infinity && circumcenter[1] === Infinity) {
            //this.logger.warn('parallel bisectors');
            return null;
        }
        return circumcenter;
    };

    /**
     * Calculate an approximation for the perimeter (or "circumference") of
     * an ellipse.
     * The calculation is done using Ramanujan's approximation #2
     * @see https://www.mathsisfun.com/geometry/ellipse-perimeter.html
     *
     * @param {ellipse} The ellipse in the format { w: <width>, h: <height> }
     * @returns {Number} The approximated perimeter length
     */
    Utils.ellipseCircumference = function (ellipse) {
        var a, b;
        a = Math.max(ellipse.w*.5, ellipse.h*.5);
        b = Math.min(ellipse.w*.5, ellipse.h*.5);
        return Math.PI * (3 * (a + b) - Math.sqrt((3*a + b) * (a + 3*b)) );
    };

    /**
     * Get the point of an ellipse at a given angle.
     * @see https://math.stackexchange.com/questions/22064/calculating-a-point-that-lies-on-an-ellipse-given-an-angle
     *
     * @param {ellipse} The ellipse, e.g. { centerX: 1, centerY: 5.4, w: 10, h: 5 }
     * @param {angle} The angle in radians
     * @returns {Array} The point on the ellipse at the given angle
     */
    Utils.pointOnEllipseWithAngle = function (ellipse, angle) {
        var a = ellipse.w * .5;
        var b = ellipse.h * .5;
        var p = [0,0];
        var tanPhi = Math.tan(angle);

        if(angle === Math.PI *.5) { // 90°
            p[1] = b;
        } else if(angle === Math.PI * 1.5) { // 270°
            p[1] = -b;
        } else if(angle > Math.PI * .5 && angle < Math.PI * 1.5) {
            p[0] = -(a*b) / Math.sqrt(b*b + a*a * tanPhi*tanPhi);
            p[1] = -(a*b*tanPhi) / Math.sqrt(b*b + a*a * tanPhi*tanPhi);
        } else {
            p[0] = a*b / Math.sqrt(b*b + a*a * tanPhi*tanPhi);
            p[1] = a*b*tanPhi / Math.sqrt(b*b + a*a * tanPhi*tanPhi);
        }

        p[0] += ellipse.centerX;
        p[1] += ellipse.centerY;

        return p;
    };


    /**
     * Get the point on the unit circle (center at 0,0 and radius 1) that corresponds
     * to the percent value given.
     * @see https://hackernoon.com/a-simple-pie-chart-in-svg-dbdd653b6936
     *
     * @param {float} The percent value, given as a decimal number between 0 and 1
     * @returns {Array} The point on the circle
     */
    Utils.pointOnUnitCircleWithPercentValue = function (percent) {
        return {
            x: Math.cos(2 * Math.PI * percent),
            y: Math.sin(2 * Math.PI * percent)
        };
    };

    /**
     * Calculates the angle between two vectors.
     *
     * @param v1 {Array} a 2D vector
     * @param v2 {Array} a 2D vector
     * @returns {Number} The angle in radians (range is [0, PI] or [0°, 180°])
     */
    Utils.angleBetweenVectors = function (v1, v2) {
        var nv1 = this.deepCopy(v1);
        var nv2 = this.deepCopy(v2);
        this.normalizeVector2d(nv1);
        this.normalizeVector2d(nv2);
        return this.angleBetweenNormalizedVectors(nv1, nv2);
    };

    /**
     * Calculates the angle between two normalized vectors.
     *
     * @param v1 {Array} a 2D vector
     * @param v2 {Array} a 2D vector
     * @returns {Number} The angle in radians (range is [0, PI] or [0°, 180°])
     */
    Utils.angleBetweenNormalizedVectors = function (v1, v2) {
        return Math.acos(this.dotProduct2d(v1, v2));
    };

	/**
	 * Calculates the "true" (360°) angle between two points.
	 *
	 * @param p1 {Object} The first point
	 * @param p2 {Object} The second point
	 * @returns {Number} The angle in radians (range is [0, 2*PI] or [0°, 360°])
	 */
	Utils.angleBetweenPoints = function (p1, p2) {
		return Math.atan2(p2.y - p1.y, p2.x - p1.x);

	};

    /**
     * @param p {Array} a 2D point
     * @param q {Array} a 2D point
     * @returns {Array} a line, represented as ret[0]x + ret[1]y = ret[2]
     */
    Utils.lineFromPoints = function (p, q) {
        var ret = [];
        ret[0] = q[1] - p[1];
        ret[1] = p[0] - q[0];
        ret[2] = ret[0]*p[0] + ret[1]*p[1];
        return ret;
    };

    /**
     * Find a line that is perpendicular to the given line and goes through
     * point p.
     *
     * @param line {Array} The line, represented as line[0]x + line[1]y = line[2]
     * @param p {Object} The point, an object with properties x and y
     * @returns {Object} The resulting line, represented as ret[0]x + ret[1]y = ret[2]
     */
    Utils.perpendicularFromLineToPoint = function (line, p) {
        var ret = [1, 1, 0];
        ret[0] = -line[1] / line[0]; // perpendicular slope
        ret[2] = p.y + ret[0] * p.x;
        return ret;
    };

	/**
	 * Calculates the euclidean distance between the given line and point.
	 *
	 * @param line {Array} The line, represented as line[0]x + line[1]y = line[2]
     * @param p {Object} The point, an object with properties x and y
     * @returns {Object} The resulting line, represented as ret[0]x + ret[1]y = ret[2]
	 * @see https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
	 */
	Utils.distanceLineToPoint = function (line, p) {
		return Math.abs(line[0] * p.x + line[1] * p.y - line[2]) / Math.sqrt(line[0] * line[0] + line[1] * line[1]);
	};

    /**
     * Converts the input line to its perpendicular bisector.
     * Param abc will be modified.
     *
     * @param p {Array} a 2D point (first point of the source line)
     * @param q {Array} a 2D point (second point of the source line)
     * @param abc {Array} a line, represented as a*x + b*y = c
     */
     Utils.perpendicularBisectorFromLine = function (p, q, abc) {
         var midPoint = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

        // -bx + ay = c is perpendicular to ax + by = c
        abc[2] = -abc[1]*(midPoint[0]) + abc[0]*(midPoint[1]);
        var temp = abc[0];
        abc[0] = -abc[1];
        abc[1] = temp;
    };

    /**
     * Returns the intersection point of two lines.
     *
	 * @param abc {Array} the first line, represented as a*x + b*y = c
	 * @param efg {Array} the second line, represented as a*x + b*y = c
     * @returns {Array} The intersection point
     */
    Utils.lineLineIntersection = function (abc, efg) {
        var ret = [];
        var determinant = abc[0]*efg[1] - efg[0]*abc[1];
        if (determinant == 0) {
            // lines are parallel
            return [Infinity, Infinity];
        }

        ret[0] = (efg[1]*abc[2] - abc[1]*efg[2]) / determinant;
        ret[1] = (abc[0]*efg[2] - efg[0]*abc[2]) / determinant;
        return ret;
    };


    /**
     * Calculates the euclidean distance between two points.
     *
     * @param x1 {Number} Point 1 X coordinate
     * @param y1 {Number} Point 1 Y coordinate
     * @param x2 {Number} Point 2 X coordinate
     * @param y2 {Number} Point 2 y coordinate
     * @returns {Number} The euclidean distance
     */
    Utils.distance = function(x1, y1, x2, y2) {
    	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };

    /**
     * Calculates the euclidean distance between two points,
     * using point objects.
     *
     * @param p1 {Object} Point 1
     * @param p2 {Object} Point 2
     * @returns {Number} The euclidean distance
     */
    Utils.pointDistance = function (p1, p2) {
        return this.distance(p1.x, p1.y, p2.x, p2.y);
    }

    /**
     * Calculates vector length.
     *
     * @param v {Array} 2-piece array representing the vector
     * @returns {Number}
     */
    Utils.vectorLength2d = function (v) {
        return Math.sqrt(Math.pow(v[0],2) + Math.pow(v[1],2));
    };

    /**
     * Scales vector to desired length. Note that the passed vector will be changed.
     *
     * @param v {Array} 2-piece array representing the vector
     * @param scaleTo {Number} Desired length
     */
    Utils.scaleVector2d = function (v, scaleTo) {
        var mag = this.vectorLength2d(v);
		if(mag === 0) {
			return;
		}
        v[0] = v[0] * scaleTo / mag;
        v[1] = v[1] * scaleTo / mag;
    };

    /**
     * Multiplies the given vector by the scalar value. Note that the vector will be changed.
     *
     * @param v {Array} 2-piece array representing the vector
     * @param scalar {Number} The scalar value
     */
    Utils.scalarMultVector2d = function (v, scalar) {
        v[0] *= scalar;
        v[1] *= scalar;
    };

    /**
     * Scales vector to 1. Note that the passed vector will be changed.
     *
     * @param v {Array} 2-piece array representing the vector
     */
    Utils.normalizeVector2d = function (v) {
        this.scaleVector2d(v, 1);
    };

    /**
     * Dot product betweent two 2d vectors.
     *
     * If vectors are normalized and the angle between them is theta, the
     * returned value is cos(theta).
	 *
     * @param v1 {Array} 2-piece array representing the first vector
     * @param v2 {Array} 2-piece array representing the second vector
     * @returns {Number} dot product of v1 and v2
     */
    Utils.dotProduct2d = function (v1, v2) {
        return v1[0] * v2[0] + v1[1] * v2[1];
    };

    /**
     * Cross product between two 2d vectors.
     *
     * @param v1 {Array} 2-piece array representing the first vector
     * @param v2 {Array} 2-piece array representing the second vector
     * @returns {Number} cross product of v1 and v2
     */
    Utils.crossProduct2d = function (v1, v2) {
        return v1[0] * v2[1] - v1[1] * v2[0];
    };

	/**
	 * @returns {boolean} true if p is in the triangle formed by p0, p1, p2
	 */
	Utils.pointInTriangle = function(p, p0, p1, p2) {
		var A = 1/2 * (-p1.y * p2.x + p0.y * (-p1.x + p2.x) + p0.x * (p1.y - p2.y) + p1.x * p2.y);
		var sign = A < 0 ? -1 : 1;
		var s = (p0.y * p2.x - p0.x * p2.y + (p2.y - p0.y) * p.x + (p0.x - p2.x) * p.y) * sign;
		var t = (p0.x * p1.y - p0.y * p1.x + (p0.y - p1.y) * p.x + (p1.x - p0.x) * p.y) * sign;

		return s > 0 && t > 0 && (s + t) < 2 * A * sign;
	};

	/**
     * @param p {Object} The point
     * @param rect {Object} The rectangle, defined by its bottom left corner (x,y) and its dimensions (w,h)
     * @param strict {boolean} (optional) If strict is true, the point may not lie on the rectangle's perimeter
	 * @returns {boolean} true if p lies within the rectangle
	 */
	Utils.pointInRectangle = function(p, rect, strict) {
        if(!strict) {
            return p.x >= rect.x
				&& p.x <= rect.x + rect.w
				&& p.y >= rect.y
				&& p.y <= rect.y + rect.h;
        } else {
            return p.x > rect.x
				&& p.x < rect.x + rect.w
				&& p.y > rect.y
				&& p.y < rect.y + rect.h;
        }
	};

    /**
     * Checks whether the inner rectangle is completely within the outer rectangle.
     * Note that a rectangle's x, y position is its bottom left corner.
     *
     * @param innerRect {Object} The inner rectangle
     * @param outerRect {Object} The outer rectangle
     * @returns {boolean} true if innerRect lies completely within outerRect
     */
    Utils.rectangleInRectangle = function (innerRect, outerRect) {
        return innerRect.x >= outerRect.x
            && innerRect.x + innerRect.w <= outerRect.x + outerRect.w
            && innerRect.y >= outerRect.y
            && innerRect.y + innerRect.h <= outerRect.y + outerRect.h;
    };

    /**
     * Returns closest point to p on rectangle's perimeter
     * https://stackoverflow.com/questions/20453545/how-to-find-the-nearest-point-in-the-perimeter-of-a-rectangle-to-a-given-point
     *
     * @param p {Object} The 2D point (an object with properties x and y)
     * @param rect {Object} The rectangle (x, y, w, h)
     * @param distFromCorner {Number} (optional) The minimum distance from a rectangle corner
     * @returns {Object} The closest point
     */
	Utils.getClosestPointOnRectanglePerimeter = function (p, rect, distFromCorner) {
		if(distFromCorner === undefined) {
			distFromCorner = 0;
		}

		var left = rect.x;
		var right = left + rect.w;
		var bottom = rect.y;
		var top = bottom + rect.h;

		var x = this.clampNumber(p.x, left, right);
		var y = this.clampNumber(p.y, bottom, top);

		var dl = Math.abs(x - left);
		var dr = Math.abs(x - right);
		var db = Math.abs(y - bottom);
		var dt = Math.abs(y - top);

		var m = Math.min(dl, dr, dt, db);

		var ret;
		switch(m) {
			case dt:
				ret = { x: x, y: top };
				break;
			case db:
				ret = { x: x, y: bottom };
				break;
			case dl:
				ret = { x: left, y: y };
				break;
			case dr:
				ret = { x: right, y: y };
				break;
			default:
				ret = { x: left, y: top };
		}

		if(ret.x === left || ret.x === right) {
			ret.y = this.clampNumber(ret.y, bottom + distFromCorner, top - distFromCorner);
		} else if(ret.y === top || ret.y === bottom) {
			ret.x = this.clampNumber(ret.x, left + distFromCorner, right - distFromCorner);
		}

		return ret;
	};

    /**
     * Checks whether the two lines described by two points on each line (p0 and p1, p2 and p3) intersect.
     * Note that this does NOT check for the given line "segments", but for the infinite line.
     *
     * @param p0 {Object} The first line's first point
     * @param p1 {Object} The first line's second point
     * @param p2 {Object} The second line's first point
     * @param p3 {Object} The second line's second point
     * @returns {boolean} true if the lines intersect
     * @see https://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect/1201356#1201356
     */
    Utils.doLinesIntersect = function (p0, p1, p2, p3) {
        // make sure the lines have lengths > 0
        if( (p0.x === p1.x && p0.y === p1.y)
            || (p2.x === p3.x && p2.y === p3.y) ) {
            return false;
        } else if(p0.x === p1.x) {
            return !(p2.x === p3.x && p0.x !== p2.x);
        } else if(p2.x === p3.x) {
            return true;
        } else {
            // neither line is parallel to the y-axis
            return (p0.y-p1.y) / (p0.x-p1.x) !== (p2.y-p3.y) / (p2.x-p3.x);
        }
    };

    /**
     * @param p0 {Object} The first line's start point
     * @param p1 {Object} The first line's end point
     * @param p2 {Object} The second line's start point
     * @param p3 {Object} The second line's end point
     * @returns {Object} The intersection point, or null
     * @see https://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect/1201356#1201356
     */
    Utils.getLineSegmentsIntersection = function(p0, p1, p2, p3) {
        var s1 = {};
        var s2 = {};
        s1.x = p1.x - p0.x;
        s1.y = p1.y - p0.y;
        s2.x = p3.x - p2.x;
        s2.y = p3.y - p2.y;
        var s, t;
        s = (-s1.y * (p0.x - p2.x) + s1.x * (p0.y - p2.y)) / (-s2.x * s1.y + s1.x * s2.y);
        t = ( s2.x * (p0.y - p2.y) - s2.y * (p0.x - p2.x)) / (-s2.x * s1.y + s1.x * s2.y);
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            // Collision detected
            return {
                x: p0.x + (t * s1.x),
                y: p0.y + (t * s1.y)
            };
        }
        return null; // No collision
    };

    /**
     * Returns intersection points of a line with a rectangle.
     *
     * @param line {Object} The line (an object with properties x1, y1, x2 and y2)
     * @param rect {Object} The rectangle (x, y, w, h)
     * @returns {Array} List of intersection points (x, y)
     */
    Utils.lineRectangleIntersection = function (line, rect) {
        var left = rect.x;
		var right = left + rect.w;
		var bottom = rect.y;
		var top = bottom + rect.h;
        var lineAsAbc = this.lineFromPoints([line.x1, line.y1], [line.x2, line.y2]);
        var isec;
        var isecPoints = [];

        var lines = [
            this.lineFromPoints([left, top], [right, top]),
            this.lineFromPoints([right, top], [right, bottom]),
            this.lineFromPoints([right, bottom], [left, bottom]),
            this.lineFromPoints([left, bottom], [left, top])
        ];
        for(var i = 0; i < 4; i++) {
            isec = Utils.lineLineIntersection(lineAsAbc, lines[i]);
            if(isec[0] !== Infinity
                && isec[0] >= left && isec[0] <= right
                && isec[1] >= bottom && isec[1] <= top) {
                isecPoints.push(isec);
            }
        }
        return isecPoints;
    };

	/**
	 * Returns intersection points of a line with a circle.
	 *
	 * @param line {Object} The line (an object with properties x1, y1, x2 and y2)
	 * @param circle {Object} The circle (centerX, centerY, radius)
	 * @param dontEnforceSegments {boolean} Do not limit intersection points to the given segment
	 * @returns {Array} List of intersection points (x, y)
	 */
	Utils.lineCircleIntersection = function (line, circle, dontEnforceSegments) {
		return this.lineEllipseIntersection(line, {
			centerX : circle.centerX,
			centerY : circle.centerY,
			radiusX : circle.radius,
			radiusY : circle.radius
		}, !!dontEnforceSegments);
	};

	/**
	 * Finds all intersection points of a polyline and a circle.
	 *
	 * @param pLineParts {Array} The parts of the polyline
	 * @param circle {Object} The circle (centerX, centerY, radius)
	 * @param dontEnforceSegments {boolean} Do not limit intersection points to the given segment
	 * @returns {Array} List of intersection points (x, y)
	 */
	Utils.polylineCircleIntersection = function (pLineParts, circle, dontEnforceSegments) {
		var iPoints = [];
		for(var i = 0, len = pLineParts.length; i < len; i++) {
			iPoints = iPoints.concat(this.lineCircleIntersection({
				x1: pLineParts[i].p1.x,
				y1: pLineParts[i].p1.y,
				x2: pLineParts[i].p2.x,
				y2: pLineParts[i].p2.y
			}, circle, dontEnforceSegments));
		}
		return iPoints;
	};

	/**
	 * Returns intersection points of a line with an ellipse.
	 * http://csharphelper.com/blog/2017/08/calculate-where-a-line-segment-and-an-ellipse-intersect-in-c/
	 * https://stackoverflow.com/questions/1073336/circle-line-segment-collision-detection-algorithm
	 *
	 * @param line {Object} The line (an object with properties x1, y1, x2 and y2)
	 * @param ellipse {Object} The ellipse (centerX, centerY, radiusX, radiusY)
	 * @param dontEnforceSegments {boolean} Do not limit intersection points to the given segment
	 * @returns {Array} List of intersection points (x, y)
	 */
	Utils.lineEllipseIntersection = function (line, ellipse, dontEnforceSegments) {
		// consider the ellipse to be centered at origin for now
		var p1 = { x: line.x1 - ellipse.centerX, y: line.y1 - ellipse.centerY };
		var p2 = { x: line.x2 - ellipse.centerX, y: line.y2 - ellipse.centerY };
		var ts = [];
		var ret = [];

		// semimajor and semiminor axes
		var a = ellipse.radiusX;
		var b = ellipse.radiusY;

		// calculate quadratic parameters
		var quadA = Math.pow((p2.x - p1.x), 2) / (a * a) + Math.pow(p2.y - p1.y, 2) / (b * b);
		var quadB = 2 * p1.x * (p2.x - p1.x) / (a * a) + 2 * p1.y * (p2.y - p1.y) / (b * b);
		var quadC = Math.pow(p1.x, 2) / (a * a) + Math.pow(p1.y, 2) / (b * b) - 1;

		// calculate discriminant
		var discriminant = quadB * quadB - 4 * quadA * quadC;
		if(discriminant === 0) {
			// one real solution
			ts.push(-quadB / (2 * quadA));
		} else if(discriminant > 0) {
			// two real solutions
			ts.push((-quadB + Math.sqrt(discriminant)) / (2 * quadA));
			ts.push((-quadB - Math.sqrt(discriminant)) / (2 * quadA));
		} else {
			// no intersection
		}

		// convert t values into points and translate to actual ellipse location
		for(var i = 0, len = ts.length; i < len; i++) {
			if(!dontEnforceSegments && (ts[i] < 0 || ts[i] > 1)) {
				continue;
			}
			ret.push({
				x: p1.x + (p2.x - p1.x) * ts[i] + ellipse.centerX,
				y: p1.y + (p2.y - p1.y) * ts[i] + ellipse.centerY
			});
		}
		return ret;
	};

	/**
     * Returns closest point to p on ellipse's perimeter
	 *
     * @param p {Object} The 2D point (an object with properties x and y)
     * @param ellipse {Object} The ellipse (centerX, centerY, radiusX, radiusY)
     * @returns {Object} The closest point
     */
	Utils.getClosestPointOnEllipsePerimeter = function (p, ellipse) {
		var iPoints = this.lineEllipseIntersection({
			x1: p.x, y1: p.y,
			x2: ellipse.centerX, y2: ellipse.centerY
		}, ellipse);

        //console.log(p, ellipse.centerX, ellipse.centerY, ellipse.radiusX, ellipse.radiusY, iPoints);

		if(iPoints.length === 0) {
			return null;
		} else if(iPoints.length === 1) {
			return iPoints[0];
		} else {
			var d0 = this.distance(p.x, p.y, iPoints[0].x, iPoints[0].y);
			var d1 = this.distance(p.x, p.y, iPoints[1].x, iPoints[1].y);
			if(d0 < d1) {
				return iPoints[0];
			} else {
				return iPoints[1];
			}
		}
	};

    /**
     * Returns the intersection point of the line between the point p and the center
     * point of rectangle rect, and the perimeter of rect.
     *
     * @param {Object} p
     * @param {Object} rect
     * @returns {Object} The intersection point
     */
    Utils.pointRectangleIntersection = function (p, rect) {
        var intPoints = this.lineRectangleIntersection({
            x1: p.x, y1: p.y,
            x2: rect.x + rect.w * .5, y2: rect.y + rect.h * .5
        }, rect);
        if(intPoints && intPoints.length > 1) {
            if(this.distance(intPoints[0][0], intPoints[0][1], p.x, p.y)
                <= this.distance(intPoints[1][0], intPoints[1][1], p.x, p.y)) {
                return {
                    x: intPoints[0][0],
                    y: intPoints[0][1]
                };
            } else {
                return {
                    x: intPoints[1][0],
                    y: intPoints[1][1]
                };
            }
        } else if(intPoints && intPoints.length === 1) {
            return {
                x: intPoints[0][0],
                y: intPoints[0][1]
            };
        } else {
            return null;
        }
    };

    /**
     * A rectangle is defined by its bottom left corner (x,y) and its
     * width and height (w,h).
     *
     * @returns {Number} The two rectangles' overlapping area
     */
    Utils.rectanglesOverlap = function (rect1, rect2) {
        var left, right, top, bottom;
        if( rect1.x < rect2.x + rect2.w
            && rect1.x + rect1.w > rect2.x
            && rect1.y < rect2.y + rect2.h
            && rect1.y + rect1.h > rect2.y ) {
            left = Math.max(rect1.x, rect2.x);
            right = Math.min(rect1.x + rect1.w, rect2.x + rect2.w);
            bottom = Math.max(rect1.y, rect2.y);
            top = Math.min(rect1.y + rect1.h, rect2.y + rect2.h);
            return (right - left) * (top - bottom);
        }
        return 0;
        /*return ( rect1.x < rect2.x + rect2.w
            && rect1.x + rect1.w > rect2.x
            && rect1.y < rect2.y + rect2.h
            && rect1.y + rect1.h > rect2.y );*/
    };

    /**
     * Calculates the overlapping polygon (intersection) of a x / y axis aligned rectangle with
	 * another, rotated rectangle.
     *
     * @param rect {Object} A rectangle, defined by its bottom left corner (x,y) and its width and height (w,h)
     * @param rotRect {Object} A rotated rectangle, defined by its corners in clockwise order (p0, p1, p2, p3)
     * @returns {Object} The overlapping polygon
     * @see https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm
     */
    Utils.rectRotRectOverlap = function (rect, rotRect) {
        var curPt, nextPt, prevPt;
        var curSide, nextSide;
        var iSide;
        var currentlyInside = false;
        var clippedLines = [
            this.rectLineClip(rect, rotRect.p0, rotRect.p1),
            this.rectLineClip(rect, rotRect.p1, rotRect.p2),
            this.rectLineClip(rect, rotRect.p2, rotRect.p3),
            this.rectLineClip(rect, rotRect.p3, rotRect.p0)
        ];
        //console.log('clipped lines: ', clippedLines);
        var side = {
            NONE: false,
            LEFT: 1,
            TOP: 2,
            RIGHT: 3,
            BOTTOM: 4
        };
        var corners = {
            bl: {x: rect.x, y: rect.y, _intermediate:true}, // bottom left
            tl: {x: rect.x, y: rect.y + rect.h, _intermediate:true}, // top left
            tr: {x: rect.x + rect.w, y: rect.y + rect.h, _intermediate:true }, // top right
            br: {x: rect.x + rect.w, y: rect.y, _intermediate:true}, // bottom right
        };
        // private helper function
        var turn = function (side) {
            return (side % 4) + 1;
        };
        // private helper function
        var pointIsOnSide = function (p) {
            if(p.x === rect.x) {
                return side.LEFT;
            } else if(p.x === rect.x + rect.w) {
                return side.RIGHT;
            } else if(p.y === rect.y) {
                return side.BOTTOM;
            } else if(p.y === rect.y + rect.h) {
                return side.TOP;
            }
            return side.NONE;
        }

        var polygon = [];
        for(var i = 0; i < clippedLines.length; i++) {
            if(!clippedLines[i]) {
                clippedLines.splice(i,1);
                i--;
                continue;
            } else {
                // add points to the polygon
                polygon.push(clippedLines[i].p0);
                polygon.push(clippedLines[i].p1);
            }
        }

        // check if the entire rectangle lies within the rotated rectangle
        if(clippedLines.length === 0) {
            if(
                Math.min(rotRect.p0.x, rotRect.p1.x, rotRect.p2.x, rotRect.p3.x) < corners.bl.x
                && Math.max(rotRect.p0.x, rotRect.p1.x, rotRect.p2.x, rotRect.p3.x) > corners.tl.x
                && Math.min(rotRect.p0.y, rotRect.p1.y, rotRect.p2.y, rotRect.p3.y) < corners.br.y
                && Math.max(rotRect.p0.y, rotRect.p1.y, rotRect.p2.y, rotRect.p3.y) > corners.tr.y
            ) {
                polygon.push(corners.bl);
                polygon.push(corners.tl);
                polygon.push(corners.tr);
                polygon.push(corners.br);
            }
        }

        // clean up and complete the polygon
        for(var i = 0; i < polygon.length; i++) {
            curPt = polygon[i];
            nextPt = polygon[(i+1) % polygon.length];
            //console.log(i, curPt, nextPt);
            // remove identical next points
            while(curPt.x === nextPt.x && curPt.y === nextPt.y && polygon.length > 1) {
                if(i+1 < polygon.length) {
                    polygon.splice(i+1,1);
                } else {
                    polygon.splice(i,1);
                    i--;
                    curPt = polygon[i];
                }
                nextPt = polygon[(i+1) % polygon.length];
                //console.log('polygon length is '+polygon.length+', nextPt is now ' + ((i+1) % polygon.length), nextPt);
            }
            // check remaining point count
            if(polygon.length < 2) {
                // something's funky
                console.warn('polygon could not be built with one point');
                break;
            }
            // find out if the points lie on any of the rectangle's sides
            curSide = pointIsOnSide(curPt);
            nextSide = pointIsOnSide(nextPt);
            if(!curSide) {
                currentlyInside = true;
            } else if(!curPt._intermediate) {
                currentlyInside = !currentlyInside;
            }
            // if either point lies inside the rectangle, or if we have just entered the rectangle,
            // or if we are currently looking at an in-between point, there are no in-between points to insert
            if(!curSide || !nextSide || currentlyInside || curPt._intermediate) {
                continue;
            }
            // both points lie on the perimeter
            // if the points are on the same perimeter, there is no need for a connecting point
            if(curSide === nextSide) {
                continue;
            }
            // points lie on different sides. insert intermediate points at the corners in clockwise fashion
            iSide = curSide;
            var j = 0;
            do {
                iSide = turn(iSide);
                if(iSide === side.RIGHT) {
                    j++;
                    polygon.splice(i+j,0,Utils.deepCopy(corners.tr));
                } else if(iSide === side.BOTTOM) {
                    j++;
                    polygon.splice(i+j,0,Utils.deepCopy(corners.br));
                } else if(iSide === side.LEFT) {
                    j++;
                    polygon.splice(i+j,0,Utils.deepCopy(corners.bl));
                } else if(iSide === side.TOP) {
                    j++;
                    polygon.splice(i+j,0,Utils.deepCopy(corners.tl));
                }
            } while(iSide !== nextSide && iSide !== curSide);
        }

        if(polygon.length < 2) {
            return {
				l: clippedLines,
				p: []
			};
        } else {
            return {
				l: clippedLines,
				p: polygon
			};
        }
    };

    /**
     * Uses the Cohen Sutherland line clip algorithm to find the clipped line within
     * a rectangle.
     *
     * @param rect {Object} The rectangle, defined by its bottom left corner (x,y) and its width and height (w,h)
     * @param pFrom {Object} Starting point of the line
     * @param pTo {Object} End point of the line
     * @returns {Array} An array of the two end points of the clipped line segment, or null
     * @see https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm
     */
    Utils.rectLineClip = function (rect, pFrom, pTo) {
        var xMin = rect.x;
        var xMax = rect.x + rect.w;
        var yMin = rect.y;
        var yMax = rect.y + rect.h;
        var codes = {
            INSIDE : 0,
            LEFT: 1,
            RIGHT: 2,
            BOTTOM: 4,
            TOP: 8
        };
		//console.log('xMin ' + xMin.toFixed(2) + ', xMax ' + xMax.toFixed(2) );
		//console.log('yMin ' + yMin.toFixed(2) + ', yMax ' + yMax.toFixed(2) );
		//console.log('pFrom ' + pFrom.x + ',' + pFrom.y);
		//console.log('pTo ' + pTo.x + ',' + pTo.y);
        var p0 = this.deepCopy(pFrom);
        var p1 = this.deepCopy(pTo);
        var x, y;
        var outcode0, outcode1, outcodeOut;
        var accept;

        // private helper function
        var computeOutcode = function (lx,ly) {
            var code = codes.INSIDE;
            if(lx < xMin) {
                code = code | codes.LEFT;
            } else if(lx > xMax) {
                code = code | codes.RIGHT;
            }
			if(ly < yMin) {
                code = code | codes.BOTTOM;
            } else if(ly > yMax) {
                code = code | codes.TOP;
            }
	        return code;
        };

        outcode0 = computeOutcode(p0.x, p0.y);
        outcode1 = computeOutcode(p1.x, p1.y);
        accept = false;
        while (true) {
    		if (!(outcode0 | outcode1)) {
    			// bitwise OR is 0: both points inside window; trivially accept and exit loop
    			accept = true;
    			break;
    		} else if (outcode0 & outcode1) {
    			// bitwise AND is not 0: both points share an outside zone (LEFT, RIGHT, TOP,
				// or BOTTOM), so both must be outside window; exit loop (accept is false)
    			break;
    		} else {
    			// At least one endpoint is outside the clip rectangle; pick it.
    			outcodeOut = outcode0 !== codes.INSIDE ? outcode0 : outcode1;

    			// Now find the intersection point;
    			// use formulas:
    			//   slope = (y1 - y0) / (x1 - x0)
    			//   x = x0 + (1 / slope) * (ym - y0), where ym is ymin or ymax
    			//   y = y0 + slope * (xm - x0), where xm is xmin or xmax
    			// No need to worry about divide-by-zero because, in each case, the
    			// outcode bit being tested guarantees the denominator is non-zero
    			if (outcodeOut & codes.TOP) {           // point is above the clip window
    				x = p0.x + (p1.x - p0.x) * (yMax - p0.y) / (p1.y - p0.y);
    				y = yMax;
    			} else if (outcodeOut & codes.BOTTOM) { // point is below the clip window
    				x = p0.x + (p1.x - p0.x) * (yMin - p0.y) / (p1.y - p0.y);
    				y = yMin;
    			} else if (outcodeOut & codes.RIGHT) {  // point is to the right of clip window
    				y = p0.y + (p1.y - p0.y) * (xMax - p0.x) / (p1.x - p0.x);
					x = xMax;
    			} else if (outcodeOut & codes.LEFT) {   // point is to the left of clip window
    				y = p0.y + (p1.y - p0.y) * (xMin - p0.x) / (p1.x - p0.x);
					x = xMin;
    			}

    			// Now we move outside point to intersection point to clip
    			// and get ready for next pass.
    			if (outcodeOut == outcode0) {
    				p0.x = x;
    				p0.y = y;
    				outcode0 = computeOutcode(x, y);
    			} else {
    				p1.x = x;
    				p1.y = y;
    				outcode1 = computeOutcode(x, y);
    			}
    		}
    	}
    	if (accept) {
    		return {
                p0 : p0,
                p1 : p1
            };
    	}
        return null;
    };

    /**
     * Calculates the area of the given polygon.
     *
     * @param pPoints {Array} An array of polygon points
     * @see http://www.mathopenref.com/coordpolygonarea2.html
     */
    Utils.polygonArea = function (pPoints) {
        var area = 0;
        var j = pPoints.length - 1;
        for(var i = 0; i < pPoints.length; i++) {
            area += (pPoints[j].x+pPoints[i].x) * (pPoints[j].y-pPoints[i].y);
            j = i;
        }
        return area * .5;
    };

    /**
     * Checks if a given point lies to the left of a line.
     *
     * @param p {Object} The point
     * @param lineSPt {Object} The line's start point
     * @param lineEPt {Object} The line's end point
     * @see http://alienryderflex.com/point_left_of_ray/
     */
    Utils.pointIsLeftOfLine = function (p, lineSPt, lineEPt) {
        return (p.y - lineSPt.y) * (lineEPt.x - lineSPt.x)
                > (p.x - lineSPt.x) * (lineEPt.y - lineSPt.y);
    };

	/**
	 * @param o {Object} A JS object
	 * @returns {Object} Deep copy of the provided object
	 */
	Utils.deepCopy = function (o) {
		return JSON.parse(JSON.stringify(o));
	};

    /**
     * @returns A number clamped to the range [min,max]
     */
    Utils.clampNumber = function (num, min, max) {
        return Math.max(min, Math.min(max, num));
    };

	/**
	 * Filter the objects in a given array by whether the objects are within the bounding box or not.
	 *
	 * @param objects {Array} An array of objects that need to have numeric properties x and y, optionally w and h
	 * @param rect {Object} The bounding box (x, y, w, h)
     * @param tolerance {Number} Bounding box tolerance, default is 5
     * @param defaultObjWidth {Number} Default object width, defaults to 1
     * @param defaultObjHeight {Number} Default object height, defaults to 1
     * @returns {Array} The filtered objects array
	 */
    Utils.clampObjects = function (objects, rect, tolerance, defaultObjWidth, defaultObjHeight) {
        var ret = [];
        var tRect;
        var objRect;

        tolerance === undefined ? tolerance = 5 : false;
        defaultObjWidth === undefined ? defaultObjWidth = 1 : false;
        defaultObjHeight === undefined ? defaultObjHeight = 1 : false;

        tRect = {
            x: rect.x - tolerance,
            y: rect.y - tolerance,
            w: rect.w + tolerance * 2,
            h: rect.h + tolerance * 2
        };

        for(var i = 0, len = objects.length; i < len; i++) {
            objRect = {
                x : objects[i].x - objects[i].radiusX,
                y : objects[i].y - objects[i].radiusY,
                w : objects[i].radiusX * 2 || defaultObjWidth,
                h : objects[i].radiusY * 2 || defaultObjHeight
            };
            if(objects[i].w !== undefined) {
                objRect.x -= objRect.w *.5;
            }
            if(objects[i].h !== undefined) {
                objRect.y -= objRect.h * .5;
            }

            if(this.rectanglesOverlap(tRect, objRect) > 0) {
                ret.push(this.deepCopy(objects[i]));
            }
        }
        return ret;
    };

    /**
     * Converts degrees to radians
     */
    Utils.degToRad = function (angleInDegrees) {
        return angleInDegrees * Math.PI / 180;
    };

    /**
     * Converts radians to degrees
     */
    Utils.radToDeg = function (angleInRadians) {
        return angleInRadians * 180 / Math.PI;
    };

    /**
     * Calculates a simple polygon centroid.
     * @returns {Object} The centroid
     */
    Utils.simplePolygonCentroid = function (points) {
        var centroid = {x: 0,y:0};
        for(var i = 0, len = points.length; i < len; i++) {
            centroid.x += points[i].x;
            centroid.y += points[i].y;
        }
        centroid.x /= points.length;
        centroid.y /= points.length;
        return centroid;
    };

    /**
     * Calculates the centroid (barycenter) of a polygon.
     *
     * @param points {Array} The polygon's points, in object form (properties x and y)
     * @returns {Object} The polygon centroid in object form
     * @see https://en.wikipedia.org/wiki/Centroid
     */
    Utils.polygonCentroid = function (points) {
        var A = 0;
        var centroid = {x: 0, y: 0};
        var ip1;
        for(var i = 0, len = points.length; i < len; i++) {
            ip1 = (i + 1) % len;
            A += points[i].x * points[ip1].y - points[ip1].x * points[i].y;
        }
        A *= .5;
        for(var i = 0, len = points.length; i < len; i++) {
            ip1 = (i + 1) % len;
            centroid.x += (points[i].x + points[ip1].x)*(points[i].x*points[ip1].y - points[ip1].x*points[i].y);
            centroid.y += (points[i].y + points[ip1].y)*(points[i].x*points[ip1].y - points[ip1].x*points[i].y);
        }
        centroid.x /= 6 * A;
        centroid.y /= 6 * A;
        return centroid;
    };

    /**
     * Calculates a convex polygon's area. Note that the points have to be in order, either
     * clockwise or counterclockwise.
     *
     * @param points {Array} The polygon's points, in object form (properties x and y)
     * @returns {float} The polygon's area
     * @see http://www.mathwords.com/a/area_convex_polygon.htm
     */
    Utils.convexPolygonArea = function (points) {
        var sum1 = 0, sum2 = 0;
        var ip1;

        for(var i = 0, len = points.length; i < len; i++) {
            ip1 = (i + 1) % len;
            sum1 += points[i].x * points[ip1].y;
            sum2 += points[i].y * points[ip1].x;
        }
        return Math.abs(0.5 * (sum1 - sum2));
    };

    /**
     * Finds the closest point to p, from the set of provided points. The distance metric
     * used is euclidean.
     *
     * @param p {Object} The origin point, in object form (properties x and y)
     * @param points {Array} The candidate points, in object form (properties x and y)
     * @returns {Object} The closest point to p
     */
    Utils.closestPoint = function (p, points) {
        var dist;
        var minDist = Infinity;
        var closest = null;
        for(var i = 0, len = points.length; i < len; i++) {
            dist = Utils.distance(p.x, p.y, points[i].x, points[i].y);
            if(dist < minDist) {
                minDist = dist;
                closest = points[i];
            }
        }
        return closest;
    };
	
	/**
     * Finds all edge meeting points between startPos and endPos on a polyline.
	 *
     * @param pLineParts {Array} The polyline's edges
	 * @param startPos {Number} The starting position in map units from the polyline's start point
	 * @param endPos {Number} The end position in map units from the polyline's start point
	 * @returns {Array} The edge meeting points between the start position and the end position
     */
    Utils.findEdgeMeetingPoints = function (pLineParts, startPos, endPos) {
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
	 * Finds the point that lies at the given distance from the start of a polyline.
	 *
	 * @param pLineParts {Array} The polyline, an array of edges
	 * @param d {Number} The distance from the polyline's start point
	 * @returns {Object} The point at distance d (or null)
	 */
	Utils.pointAlongPolyline = function (pLineParts, d) {
		var curLine, curLength;
		var vec;
		for(var i = 0, len = pLineParts.length; i < len; i++) {
			curLine = pLineParts[i];
			curLength = this.pointDistance(curLine.p1, curLine.p2);
			if(curLength < d) {
				// the point lies beyond the current line
				// subtract the current line's length from the distance and continue with the next line
				d -= curLength;
				continue;
			} else {
				// the point lies on the current line
				vec = [curLine.p2.x - curLine.p1.x, curLine.p2.y - curLine.p1.y];
				this.scaleVector2d(vec, d);
				return {
					x: curLine.p1.x + vec[0],
					y: curLine.p1.y + vec[1]
				};
			}
		}
		return null;
	};

    /**
     * Finds the point that lies at the given distance from the start of a polycurve made up of
     * cubic bezier curves.
     *
     * @param pParts {Array} The polycurve, an array of edges (with points n1, n2 and control points n1c1, n1c2 etc.)
     * @param d {Number} The distance from the polyline's start point
     * @returns {Object} The point at distance d (or null)
     */
    Utils.pointAlongCubicPolycurve = function (pLineParts, d) {
        var curLine, curLength;
		var vec;
		for(var i = 0, len = pLineParts.length; i < len; i++) {
			curLine = pLineParts[i];
			curLength = this.pointDistance(curLine.n1, curLine.n2);
			if(curLength < d) {
				// the point lies beyond the current line
				// subtract the current line's length from the distance and continue with the next line
				d -= curLength;
				continue;
			} else {
				// the point lies on the current line
                if(curLine.n1c2 !== undefined && curLine.n1c2 !== null
                    && curLine.n2c1 !== undefined && curLine.n2c1 !== null) {
                    // curLine has control points --> treat as cubic bezier curve
                    // d / curLength gives a number between 0 and 1
                    return this.pointOnCubicBezierCurve(
                        curLine.n1, curLine.n1c2, curLine.n2c1, curLine.n2,
                        d / curLength
                    );
                } else {
                    // curLine has no control points --> treat as line
                    vec = [curLine.p2.x - curLine.p1.x, curLine.p2.y - curLine.p1.y];
    				this.scaleVector2d(vec, d);
    				return {
    					x: curLine.p1.x + vec[0],
    					y: curLine.p1.y + vec[1]
    				};
                }
			}
		}
		return null;
    };

    /**
     * Finds the point on a cubic bezier line.
     *
     * @param p0 {Object} The bezier start point
     * @param p1 {Object} The first bezier control point
     * @param p2 {Object} The second bezier control point
     * @param p3 {Object} The bezier end point
     * @param t {Number} How far along the curve to look (0 <= t <= 1)
     */
    Utils.pointOnCubicBezierCurve = function (p0, p1, p2, p3, t) {
        return {
            x: Math.pow((1-t),3)*p0.x + 3*t*Math.pow((1-t),2)*p1.x + 3*t*t*(1-t)*p2.x + Math.pow(t,3)*p3.x,
            y: Math.pow((1-t),3)*p0.y + 3*t*Math.pow((1-t),2)*p1.y + 3*t*t*(1-t)*p2.y + Math.pow(t,3)*p3.y
        };
    };

    /**
     * @param mat {Array} The matrix to rotate
     * @param angle {Number} The angle in radians
     * @returns {Array} The rotated matrix, a new object
     */
    Utils.matrix2dRotate = function (mat, angle) {
        var rot = [
            Math.cos(angle), Math.sin(angle),
            -Math.sin(angle), Math.cos(angle)
        ];
        return this.matrix2dMultiply(mat, rot);
    };

    /**
     * Matrix indices are row-based:
     * | 0 1 |
     * | 2 3 |
     * @param mat1 {Array} The first matrix
     * @param mat2 {Array} The second matrix
     * @returns {Array} The multiplied 2d matrix, a new object
     */
    Utils.matrix2dMultiply = function (mat1, mat2) {
        return [mat1[0] * mat2[0] + mat1[1] * mat2[2], mat1[0] * mat2[1] + mat1[1] * mat2[3],
                    mat1[2] * mat2[0] + mat1[3] * mat2[2], mat1[2] * mat2[1] + mat1[3] * mat2[3]];

    };

	Utils.basicAvgVector = function (vectors) {
		var avg = [0, 0];
		var nVecs = [];
		for(var i = 0, len = vectors.length; i < len; i++) {
			nVecs.push(Utils.deepCopy(vectors[i]));
			this.scaleVector2d(nVecs[i], 1);
			avg[0] += nVecs[i][0];
			avg[1] += nVecs[i][1];
		}
		this.scaleVector2d(avg, 1);
		//console.log(avg);
		return avg;
	};

	/**
	 *
	 */
	Utils.simpleLinearRegression = function (samples) {
		var alpha, beta;
		var xAvg = 0;
		var x2Avg = 0;
		var yAvg = 0;
		var y2Avg = 0;
		var xyAvg = 0;
		var sx = 0;
		var sy = 0;
		var rxy;

		for(var i = 0, len = samples.length; i < len; i++) {
			xAvg += samples[i].x;
			x2Avg += samples[i].x * samples[i].x;
			yAvg += samples[i].y;
			y2Avg += samples[i].y * samples[i].y;
			xyAvg += samples[i].x * samples[i].y;
		}
		xAvg /= samples.length;
		x2Avg /= samples.length;
		yAvg /= samples.length;
		y2Avg /= samples.length;
		xyAvg /= samples.length;

		// deviations
		for(var i = 0, len = samples.length; i < len; i++) {
			sx += Math.pow(samples[i].x - xAvg, 2);
			sy += Math.pow(samples[i].y - yAvg, 2);
		}
		sx = Math.sqrt(sx / samples.length);
		sy = Math.sqrt(sy / samples.length);

		rxy = (xyAvg - xAvg * yAvg) / Math.sqrt((x2Avg - xAvg * xAvg) * (y2Avg - yAvg * yAvg));
		beta = rxy * sy / sx;
		alpha = yAvg - beta * xAvg;
		return {
			alpha: alpha,
			beta: beta
		};
	};


	Utils.findLineByLeastSquares = function(values_x, values_y) {
		var sum_x = 0;
		var sum_y = 0;
		var sum_xy = 0;
		var sum_xx = 0;
		var count = 0;

		/*
		 * We'll use those variables for faster read/write access.
		 */
		var x = 0;
		var y = 0;
		var values_length = values_x.length;

		if (values_length != values_y.length) {
			throw new Error('The parameters values_x and values_y need to have same size!');
		}

		/*
		 * Nothing to do.
		 */
		if (values_length === 0) {
			return [ [], [] ];
		}

		/*
		 * Calculate the sum for each of the parts necessary.
		 */
		for (var v = 0; v < values_length; v++) {
			x = values_x[v];
			y = values_y[v];
			sum_x += x;
			sum_y += y;
			sum_xx += x*x;
			sum_xy += x*y;
			count++;
		}

		/*
		 * Calculate m and b for the formular:
		 * y = x * m + b
		 */
		var m = (count*sum_xy - sum_x*sum_y) / (count*sum_xx - sum_x*sum_x);
		var b = (sum_y/count) - (m*sum_x)/count;

		/*
		 * We will make the x and y result line now
		 */
		var result_values_x = [];
		var result_values_y = [];

		for (var v = 0; v < values_length; v++) {
			x = values_x[v];
			y = x * m + b;
			result_values_x.push(x);
			result_values_y.push(y);
		}

		return [result_values_x, result_values_y];
	};

    return Utils;
})();
