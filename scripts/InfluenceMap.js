module.exports = (function () {
    'use strict';

	var fs = require('fs');
    var Observable = require('./Observable.js');

    /**
     * An instance of this class represents an influence map.
     * Uses a 2D cartesian coordinate systems, euclidean distance metrics and
     * a cubic falloff logic
     */
    var InfluenceMap = function (logger) {
        this.parent.call(this);
        this.logger = logger || console;
        this.x = 0;
        this.y = 0;
        this.w = 0;
        this.h = 0;
        this.cellSize = 1;
        this.numHCells = 0;
        this.numVCells = 0;
        this.influencers = [];
        this.cells = null;
    };

    InfluenceMap.prototype = Object.create(Observable.prototype);
    InfluenceMap.prototype.constructor = InfluenceMapBordersMgr;
    InfluenceMap.prototype.parent = Observable;

    /**
     * Initializes the map grid with the desired dimensions and cell size
     */
    InfluenceMap.prototype.init = function (x, y, w, h, cellSize) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.cellSize = cellSize || 1;
        this.numHCells = 0;
        this.numVCells = 0;
        this.cells = [];

        // generate the grid
        // The grid is represented by a one-dimensional array, indices are row-major:
        // 6 7 8
        // 3 4 5
        // 0 1 2
        for(var i = 0; i <= this.h; i += this.cellSize) {
            this.numVCells++;
            for(var j = 0; j <= this.w; j += this.cellSize) {
                this.numHCells++;
                this.cells.push(0);
            }
        }

        return this;
    };

    /**
     * Adds a single point influencer to the map.
     */
    InfluenceMap.prototype.addInfluencer = function (id, x, y, strength) {
        var newInfluencer = {
            id : id,
            x : x,
            y : y,
            strength : strength
        };
        this.influencers.push(newInfluencer);
        this.applyInfluencer(newInfluencer);
    };

    /**
     * Applies a single influencer to the map
     */
    InfluenceMap.prototype.applyInfluencer = function (influencer) {
        var curCellDist = 0;
        var curScaledDist = 0;
        var curDist = 0;
        var attenuatedWeight = 1;
        var weightFactor = -1/30; // TODO magic numbers
        var xMin, xMax, yMin, yMax;
        for(var maxAttenuatedWeight = 1; maxAttenuatedWeight > 0; curCellDist++) {
            curScaledDist = curCellDist * this.cellSize;
            xMin = influencer.x - curScaledDist;
            xMax = influencer.x + curScaledDist;
            yMin = influencer.y - curScaledDist;
            yMax = influencer.y + curScaledDist;
            maxAttenuatedWeight = 0;

            // walk around the influencer cell clockwise at the current cell distance, starting from the bottom left
            for(curX = xMin; curX <= xMax; curX += curCellDist) {
                curY = yMin;
                curDist = this.dist(influencer.x, influencer.y, curX, curY);
                attenuatedWeight = weightFactor * curDist + 1;
                maxAttenuatedWeight = Math.max(attenuatedWeight, maxAttenuatedWeight);
                //curX, curY
            }
        }
    };

    /**
     * Recalculates the entire influence map
     */
    InfluenceMap.prototype.recalculate = function () {
        this.init();
        for(var i = 0, len = this.influencers.length; i < len; i++) {
            this.applyInfluencer(this.influencers[i]);
        }
    };

    /**
     * Converts x, y coordinates to a cell index
     * @private
     * @returns {int} the cell index, -1 for coordinates out of bounds
     */
    InfluenceMap.prototype.coordsToCellIdx = function (x, y) {
        if(x < this.x || x > this.x + this.w || y < this.y || y > this.y + this.h) {
            return -1;
        }
        var xCellCoord = Math.floor((x - this.x) / this.cellSize);
        var yCellCoord = Math.floor((y - this.y) / this.cellSize);
        return yCellCoord * this.numHCells + xCellCoord;
    };

    /**
     * Calculate the distance between two points (euclidean distance in LY)
     * @private
     */
    InfluenceMap.prototype.dist = function(x1, y1, x2, y2) {
    	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };



    return InfluenceMapBordersMgr;
})();
