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
	 * @param abc {Array} a line, represented as ret[0]
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
	 * @returns o {Object} Deep copy of the provided object
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

    return Utils;
})();
