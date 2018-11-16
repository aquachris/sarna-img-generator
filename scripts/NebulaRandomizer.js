module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');

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
        var circumference;
        var numPoints;
        var curPoint, prevPoint;
        var startAngle;
        var angleInDeg, angleInRad;

        for(var i = 0, len = this.nebulae.length; i < len; i++) {
            curNebula = this.nebulae[i];
            curNebula.points = [];
            curNebula.ctrlPoints = [];
            // calculate approximated ellipse circumference
            circumference = Utils.ellipseCircumference(curNebula);

            numPoints = 12;

            startAngle = Math.floor(Math.random()*360);
            angleInDeg = 0;
            angleInRad = 0;
            for(var j = 0; j < numPoints; j++) {
                angleInDeg = startAngle + j * 360 / numPoints;
                if(angleInDeg >= 360) angleInDeg -= 360;
                angleInRad = Utils.degToRad(angleInDeg);
                curPoint = Utils.pointOnEllipseWithAngle(curNebula, angleInRad);
                curNebula.points.push();
            }
        }
	};

    return NebulaRandomizer;
})();
