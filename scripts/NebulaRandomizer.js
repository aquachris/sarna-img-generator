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

			numPoints = Math.max(3, Math.round(curNebula.circumference / 5)); // 5
            //numPoints = 11;
			//numPoints = 20;
			//numPoints = 30;

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

    return NebulaRandomizer;
})();
