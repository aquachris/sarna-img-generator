module.exports = (function () {
    'use strict';

    var seedrandom = require('seedrandom');

    /**
     * An instance of this class generates blue noise using Bridson's Poisson Disc algorithm
     */
    var PoissonDisc = function (logger) {
        this.logger = logger || console;
    };

    PoissonDisc.prototype.constructor = PoissonDisc;

	/**
	 * (Re-)initializes and runs the algorithm.
	 * 
	 * @param x {Number} Algorithm area left limit
	 * @param y {Number} Algorithm area bottom limit
	 * @param w {Number} Algorithm area width
	 * @param h {Number} Algorithm area height
	 * @param radius {Number} "Elbow space" for each point: Generated points are placed at a distance of r to 2*r from each other
	 * @param maxSamples {Number} Maximum amount of candidates for an active sample (optional, default is 30)
	 */
    PoissonDisc.prototype.init = function (x, y, w, h, radius, maxSamples) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.maxSamples = maxSamples || 30;
        this.radius = radius;
        this.radius2 = radius * radius;
        this.radius2x3 = 3 * this.radius2;
        this.cellSize = radius * Math.SQRT1_2,
        this.gridWidth = Math.ceil(w / this.cellSize);
        this.gridHeight = Math.ceil(h / this.cellSize);
        this.grid = new Array(this.gridWidth * this.gridHeight);
        this.queue = [];
        this.queueSize = 0;
        this.sampleSize = 0;
        this.rng = seedrandom('sarna');

        this.generatedPoints = [];
        this.runUntilDone();
        return this;
    };

	/**
	 * Runs the poisson disc algorithm and populates the generatedPoints property.
	 */
    PoissonDisc.prototype.runUntilDone = function () {
        var s;
        this.generatedPoints = [];
        // start with a sample at a fixed x,y (origin)
        this.generatedPoints.push(this.placeSample({x: this.x, y: this.y}));
		// generate samples as long as a free spot can be found
        while(s = this.generateSample()) {
            this.generatedPoints.push(s);
        }
        // done
        this.logger.log('blue noise generation done, ' + this.sampleSize + ' points generated');
    };

	/**
	 * Generates a new sample by looking at a random active sample in the queue and 
	 * spawning new candidates from that position. If a valid candidate is found, this candidate 
	 * becomes our new sample. If no valid candidate is found, the active sample is marked 
	 * inactive (removed from the queue), and the next random active sample is looked at for 
	 * candidates. 
	 * If no valid candidate can be found for any of the active samples, the function returns null
	 * and the algorithm terminates.
	 * 
	 * @returns {Object} The generated sample, or null.
	 */
    PoissonDisc.prototype.generateSample = function () {
        // Pick a random existing sample and remove it from the queue.
        while (this.queueSize) {
          var i = this.rng() * this.queueSize | 0,
              s = this.queue[i];

          // Make a new candidate between [radius, 2 * radius] from the existing sample.
          for (var j = 0; j < this.maxSamples; ++j) {
            var a = 2 * Math.PI * this.rng(),
                r = Math.sqrt(this.rng() * this.radius2x3 + this.radius2),
                x = s.x + r * Math.cos(a),
                y = s.y + r * Math.sin(a);

            // Reject candidates that are outside the allowed extent,
            // or closer than 2 * radius to any existing sample.
            if(x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h && this.positionValid(x,y)) {
                return this.placeSample({x:x, y:y});
            }
          }

          this.queue[i] = this.queue[--this.queueSize];
          this.queue.length = this.queueSize;
        }
        return null;
    };

	/**
	 * Places a sample.
	 * 
	 * @param s {Object} The sample
	 * @param grid {Array} The used cell occupation grid (optional)
	 * @param noEnqueue {boolean} Set to true to place an inactive sample (optional)
	 * @returns {Object} The sample
	 */
    PoissonDisc.prototype.placeSample = function(s, grid, noEnqueue) {
        grid = grid || this.grid;
        if(!noEnqueue) {
            this.queue.push(s);
            this.queueSize++;
        }
        grid[this.gridWidth * ((s.y - this.y) / this.cellSize | 0) + ((s.x - this.x) / this.cellSize | 0)] = s;
        this.sampleSize++;
        //this.logger.log('sample placed: ' + (x - this.x) + ', ' + (y - this.y));
        return s;
    };

	/**
	 * Determines whether point (x,y) is a valid position for a new sample.
	 *
	 * @param x {Number} Point's x coordinate
	 * @param y {Number} Point's y coordinate
	 * @param grid {Array} The grid to check for cell occupation (default is this.grid)
	 * @returns {boolean} true if (x,y) is a valid / unoccupied position
	 */
    PoissonDisc.prototype.positionValid = function (x, y, grid) {
        var i, j, i0, j0, i1, j1;
        grid = grid || this.grid;
        i = (x - this.x) / this.cellSize | 0,
        j = (y - this.y) / this.cellSize | 0,
        i0 = Math.max(i - 2, 0),
        j0 = Math.max(j - 2, 0),
        i1 = Math.min(i + 3, this.gridWidth),
        j1 = Math.min(j + 3, this.gridHeight);

        for (j = j0; j < j1; ++j) {
          var o = j * this.gridWidth;
          for (i = i0; i < i1; ++i) {
            if (s = grid[o + i]) {
              var s,
                  dx = s.x - x,
                  dy = s.y - y;
              if (dx * dx + dy * dy < this.radius2) return false;
            }
          }
        }

        return true;
    };

	/**
	 * Introduces a new list of reserved points and aggregates them with the list of generated 
	 * ("blue noise") points. The aggregated points list contains all reserved points, plus generated 
	 * points in those places where there are no reserved points (according to the normal poisson disc
	 * valid location determination). 
	 * The function's output is saved in this.aggregatedPoints.
	 *
	 * @param reservedPoints {Array} List of existing fixed points
	 */
    PoissonDisc.prototype.replaceReservedPoints = function (reservedPoints) {
        var poissonPoint, reservedPoint, pointsRejected = 0;
        this.reservedPoints = reservedPoints;
        this.aggregatedGrid = new Array(this.gridWidth * this.gridHeight);
        this.aggregatedPoints = [];

        // reserved points
        for(var i = 0, len = reservedPoints.length; i < len; i++) {
            this.aggregatedPoints.push(
                this.placeSample(reservedPoints[i], this.aggregatedGrid, true)
            );
        }

        // fill up with poisson points
        for(var i = 0, len = this.generatedPoints.length; i < len; i++) {
            if(this.positionValid(this.generatedPoints[i].x, this.generatedPoints[i].y, this.aggregatedGrid)) {
                this.aggregatedPoints.push(
                    this.placeSample(this.generatedPoints[i], this.aggregatedGrid, true)
                );
            } else {
                pointsRejected++;
            }
        }
    };

    return PoissonDisc;
})();
