module.exports = (function () {
    'use strict';

    /**
     * An instance of this class generates blue noise using Bridson's Poisson Disc algorithm
     */
    var PoissonDisc = function (logger) {
        //this.parent.call(this);
        this.logger = logger || console;
    };

    //VoronoiBorder.prototype = Object.create(Observable.prototype);
    PoissonDisc.prototype.constructor = PoissonDisc;
    //VoronoiBorder.prototype.parent = Observable;

    PoissonDisc.prototype.init = function (x, y, w, h, radius, existingPoints, maxSamples) {
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

        this.existingPoints = existingPoints || [];
        this.generatedPoints = [];
        this.runUntilDone();
        return this;
    };

    PoissonDisc.prototype.runUntilDone = function () {
        var s;
        // generate samples
        for(var i = 0, len = this.existingPoints.length; i < len; i++) {
            this.placeSample(this.existingPoints[i][0], this.existingPoints[i][1], true);
        }
        this.generatedPoints = [];
        // start with a sample at a fixed x,y
        this.generatedPoints.push(this.placeSample(this.x, this.y));
        while(s = this.generateSample()) {
            this.generatedPoints.push(s);
        }
        // done
        this.logger.log('blue noise generation done, ' + this.sampleSize + ' points generated');
    };

    PoissonDisc.prototype.generateSample = function () {
        // Pick a random existing sample and remove it from the queue.
        while (this.queueSize) {
          var i = Math.random() * this.queueSize | 0,
              s = this.queue[i];

          // Make a new candidate between [radius, 2 * radius] from the existing sample.
          for (var j = 0; j < this.maxSamples; ++j) {
            var a = 2 * Math.PI * Math.random(),
                r = Math.sqrt(Math.random() * this.radius2x3 + this.radius2),
                x = s[0] + r * Math.cos(a),
                y = s[1] + r * Math.sin(a);

            // Reject candidates that are outside the allowed extent,
            // or closer than 2 * radius to any existing sample.
            if(x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h && this.positionValid(x,y)) {
                return this.placeSample(x, y);
            }
          }

          this.queue[i] = this.queue[--this.queueSize];
          this.queue.length = this.queueSize;
        }
        return null;
    };

    PoissonDisc.prototype.placeSample = function(x, y, noEnqueue) {
      var s = [x, y];
      if(!noEnqueue) {
          this.queue.push(s);
          this.queueSize++;
      }
      this.grid[this.gridWidth * ((y - this.y) / this.cellSize | 0) + ((x - this.x) / this.cellSize | 0)] = s;
      this.sampleSize++;
      //this.logger.log('sample placed: ' + (x - this.x) + ', ' + (y - this.y));
      return s;
    };

    PoissonDisc.prototype.positionValid = function (x, y) {
        var i = (x - this.x) / this.cellSize | 0,
            j = (y - this.y) / this.cellSize | 0,
            i0 = Math.max(i - 2, 0),
            j0 = Math.max(j - 2, 0),
            i1 = Math.min(i + 3, this.gridWidth),
            j1 = Math.min(j + 3, this.gridHeight);

        for (j = j0; j < j1; ++j) {
          var o = j * this.gridWidth;
          for (i = i0; i < i1; ++i) {
            if (s = this.grid[o + i]) {
              var s,
                  dx = s[0] - x,
                  dy = s[1] - y;
              if (dx * dx + dy * dy < this.radius2) return false;
            }
          }
        }

        return true;
    };

    return PoissonDisc;
})();
