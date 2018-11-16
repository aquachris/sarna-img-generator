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
        
        // array of the actual objects (e.g. systems) in the form {x: 0, y:0, col: 'fac1'}
        this.objects = null;
        // array of points in the form [x, y]
        // point index equals object index
        this.points = null;
        // array of voronoi nodes
        this.nodes = null;
        // map of border edges for each color
        this.borderEdges = null;
        // map of border node indices
        this.borderNodeIndices = null;
        // distance between border lines
        this.borderSeparation = 0;
    };

    NebulaRandomizer.prototype.constructor = NebulaRandomizer;
	
	NebulaRandomizer.prototype.init = function () {
		this.calculate();
		return this;
	};
	
	NebulaRandomizer.prototype.calculate = function () {
		
		// circumference 2 * Math.PI * o.r
	};

    return NebulaRandomizer;
})();