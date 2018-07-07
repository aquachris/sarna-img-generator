module.exports = (function () {
    'use strict';

	var fs = require('fs');
    var Observable = require('./Observable.js');

    /**
     * An instance of this class represents an influence map.
     * Uses a 2D cartesian coordinate systems, euclidean distance metrics and
     * a linear (TODO: cubic) falloff logic
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
    InfluenceMap.prototype.constructor = InfluenceMap;
    InfluenceMap.prototype.parent = Observable;
	
	InfluenceMap.MODES = {
		ADDITIVE : 'additive',
		MAXIMUM : 'maximum'
	};

    /**
     * Initializes the map grid with the desired dimensions and cell size
     */
    InfluenceMap.prototype.init = function (x, y, w, h, cellSize, mode) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.cellSize = cellSize || 1;
        this.numHCells = 0;
        this.numVCells = 0;
        this.cells = [];
		this.mode = mode || InfluenceMap.MODES.MAXIMUM;

        // generate the grid
        // The grid is represented by a one-dimensional array, indices are row-major:
        // 6 7 8
        // 3 4 5
        // 0 1 2
        for(var i = 0; i < this.h; i += this.cellSize) {
            this.numVCells++;
            for(var j = 0; j < this.w; j += this.cellSize) {
				if(i === 0) {
					this.numHCells++;
				}
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
		var maxAttenuatedWeight = 1;
        var weightFactor = -1/50; // TODO magic numbers
        var xMin, xMax, yMin, yMax, xCur, yCur;
		var centroid;
		var cellIdx;
		var direction = 'up';
		var rCorrective = 0.00005;
		
		// go outwards from the current cell as long as an influence can be felt
		while(maxAttenuatedWeight > 0) {
            curScaledDist = curCellDist * this.cellSize;
            xMin = influencer.x - curScaledDist;
            xMax = influencer.x + curScaledDist;
            yMin = influencer.y - curScaledDist;
            yMax = influencer.y + curScaledDist;
            maxAttenuatedWeight = 0;

            // walk around the influencer cell clockwise at the current cell distance, starting from the bottom left
			xCur = xMin;
			yCur = yMin;
			direction = 'up';
			while(direction !== 'stop') {
				cellIdx = this.coordsToCellIdx(xCur, yCur);
				centroid = this.getCellCentroid(cellIdx);
				//this.logger.log('it ' + xCur + ', ' + yCur + ', cellIdx: ' + cellIdx + ', centroid: ' + centroid);
				if(centroid) {
					curDist = this.dist(influencer.x, influencer.y, centroid.x, centroid.y);
					attenuatedWeight = Math.max(0, weightFactor * curDist + 1);
					maxAttenuatedWeight = Math.max(maxAttenuatedWeight, attenuatedWeight);
					//this.logger.log('applying ' + attenuatedWeight + ' to ' +xCur + ', ' + yCur + ' (' + cellIdx + ')');
					this.applyInfluenceToCell(cellIdx, attenuatedWeight);
				}
				// check state for clockwise path around the influencer origin
				if(curCellDist === 0) {
					direction = 'stop';
				} else if(direction === 'up') {
					yCur += this.cellSize;
					if(yCur >= yMax - rCorrective) { // rounding corrective 
						direction = 'right';
					}
				} else if(direction === 'right') {
					xCur += this.cellSize;
					if(xCur >= xMax - rCorrective) { // rounding corrective 
						direction = 'down';
					}
				} else if(direction === 'down') {
					yCur -= this.cellSize;
					if(yCur <= yMin + rCorrective) { // rounding corrective 
						direction = 'left';
					}
				} else if(direction === 'left') {
					xCur -= this.cellSize;
					if(xCur <= xMin + rCorrective) { // rounding corrective 
						direction = 'stop';
					}
				} else {
					direction = 'stop';
				}
			}
			
			// increment the cell distance and proceed to next iteration
			curCellDist++;
        }
    };
	
	/**
	 * Applies influence value to a cell.
	 * @private
	 */
	InfluenceMap.prototype.applyInfluenceToCell = function (cellIdx, weight) {
		if(weight === 0 || cellIdx < 0 || cellIdx >= this.cells.length) {
			return;
		}
		if(this.mode === InfluenceMap.MODES.ADDITIVE) {
			this.cells[cellIdx] += weight;
		} else {
			this.cells[cellIdx] = Math.max(this.cells[cellIdx], weight);
		}
	};
	
	/**
	 * Applies influence value to a set of coordinates.
	 * @private
	 */
	InfluenceMap.prototype.applyInfluenceToCoords = function (x, y, weight) {
		this.applyInfluenceToCell(this.coordsToCellIdx(x, y), weight);
		
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
	 * Returns the cell origin coordinates
	 * @private
	 * @returns {Object} The coordinates of the given cell's origin, or null for an invalid cell index
	 */
	InfluenceMap.prototype.getCellOrigin = function (cellIdx) {
		var cellX = cellIdx % this.numHCells;
		var cellY = Math.floor(cellIdx / this.numHCells);
		if(cellIdx < 0 || cellIdx >= this.cells.length) {
			return null;
		}
		return {
			x : this.x + cellX * this.cellSize,
			y : this.y + cellY * this.cellSize
		};
	};
	
	/**
	 * Returns the cell centroid coordinates
	 * @private
	 * @returns {Object} The coordinates of the given cell's centroid, or null for an invalid cell index
	 */
	InfluenceMap.prototype.getCellCentroid = function (cellIdx) {
		var cellX = cellIdx % this.numHCells;
		var cellY = Math.floor(cellIdx / this.numHCells);
		if(cellIdx < 0 || cellIdx >= this.cells.length) {
			return null;
		}
		return {
			x : this.x + cellX * this.cellSize + this.cellSize * .5,
			y : this.y + cellY * this.cellSize + this.cellSize * .5
		};
	};
	
	/**
	 * Returns the cell centroid coordinates for a given set of coordinates
	 * @private
	 * @returns {Object} The coordinates of the given cell's centroid, or null for an invalid cell index
	 */
	InfluenceMap.prototype.getCentroidForCoords = function (x, y) {
		return this.getCellCentroid(this.coordsToCellIdx(x, y));
	};

    /**
     * Calculate the distance between two points (euclidean distance in LY)
     * @private
     */
    InfluenceMap.prototype.dist = function(x1, y1, x2, y2) {
    	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };



    return InfluenceMap;
})();
