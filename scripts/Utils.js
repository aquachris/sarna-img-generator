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
     * Calculates the euclidean distance between two points (euclidean distance in LY)
     *
     * @returns {Number} The euclidean distance
     */
    Utils.distance = function(x1, y1, x2, y2) {
    	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };

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
	 * @returns {boolean} true if p lies within the rectangle
	 */
	Utils.pointInRectangle = function(p, rect) {
		return p.x >= rect.x
				&& p.x <= rect.x + rect.w
				&& p.y >= rect.y
				&& p.y <= rect.y + rect.h;
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
	 * Returns intersection points of a line with an ellipse.
	 * http://csharphelper.com/blog/2017/08/calculate-where-a-line-segment-and-an-ellipse-intersect-in-c/
	 *
	 * @param line {Object} The line (an object with properties x1, y1, x2 and y2)
	 * @param ellipse {Object} The ellipse (centerX, centerY, radiusX, radiusY)
	 * @returns {Array} List of intersection points (x, y)
	 */
	Utils.lineEllipseIntersection = function (line, ellipse) {
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
                x : objects[i].x,
                y : objects[i].y,
                w : objects[i].w || defaultObjWidth,
                h : objects[i].h || defaultObjHeight
            };
            if(objects[i].w === undefined) {
                objRect.x -= objRect.w *.5;
            }
            if(objects[i].h === undefined) {
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

    return Utils;
})();
