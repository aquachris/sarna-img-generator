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
            this.logger.warn('parallel bisectors');
            return null;
        }
        return circumcenter;
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
     * Also inputs the points whose mid-point lies on the bisector.
     * Param abc will be modified.
     *
     * @param p {Array} a 2D point
     * @param q {Array} a 2D point
     * @param abc {Array} a line, represented as ret[0]x + ret[1]y = ret[2]
     */
     Utils.perpendicularBisectorFromLine = function (p, q, abc) {
         var midPoint = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

        // c = -bx + ay
        abc[2] = -abc[1]*(midPoint[0]) + abc[0]*(midPoint[1]);

        var temp = abc[0];
        abc[0] = -abc[1];
        abc[1] = temp;
    };

    /**
     * Returns the intersection point of two lines.
     *
     * @returns {Array} The intersection point
     */
    Utils.lineLineIntersection = function (abc, efg) {
        var ret = [];
        var determinant = abc[0]*efg[1] - efg[0]*abc[1];
        if (determinant == 0) {
            // The lines are parallel. This is simplified by returning Infinity
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

    return Utils;
})();
