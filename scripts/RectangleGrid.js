module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');

	/**
	 * An instance of this class represents a grid filled with rectangular objects.
     * The idea is to have a more efficient way of looking for overlaps.
	 */
	var RectangleGrid = function (logger) {
        this.logger = logger || console;
        this.viewRect = null;
        this.gridCellSize = RectangleGrid.DEFAULT_GRID_CELL_SIZE;
        this.grid = null;
	};

	RectangleGrid.prototype.constructor = RectangleGrid;

    RectangleGrid.DEFAULT_GRID_CELL_SIZE = 10;

    /**
     * Initializes this object.
     *
     * @returns {RectangleGrid} this object
     */
    RectangleGrid.prototype.init = function (viewRect, gridCellSize) {
        this.viewRect = viewRect || {x: 0, y: 0, w: 0, h: 0};
        this.gridCellSize = gridCellSize || RectangleGrid.DEFAULT_GRID_CELL_SIZE;
        this.constructGrid();
        return this;
    };

    /**
     * Builds the actual grid structure.
     */
    RectangleGrid.prototype.constructGrid = function () {
        var gridCol;
        this.grid = [];
        for(var x = this.viewRect.x; x < this.viewRect.x + this.viewRect.w; x += this.gridCellSize) {
            gridCol = [];
            for(var y = this.viewRect.y; y < this.viewRect.y + this.viewRect.h; y += this.gridCellSize) {
                // a single grid cell
                gridCol.push({
                    bbox : {
                        x: x,
                        y: y,
                        w: this.gridCellSize,
                        h: this.gridCellSize
                    },
                    occupants: []
                });
            }
            this.grid.push(gridCol);
        }
    };

    /**
     * Finds the coordinates of all grid cells that a given rectangle overlaps.
     *
     * @returns {Array} A list of {x,y} pairs of grid coordinates
     */
    RectangleGrid.prototype.gridCoordinatesForRect = function (rect) {
        var ret = [];
        var startX, startY; // top left grid coordinates
        var endX, endY; // bottom right grid coordinates
        var curX, curY;

        if(this.grid.length === 0 || !Utils.rectanglesOverlap(rect, this.viewRect)) {
            return ret;
        }

        startX = Utils.clampNumber(Math.floor((rect.x - this.viewRect.x) / this.gridCellSize), 0, this.grid.length-1);
        startY = Utils.clampNumber(Math.floor((rect.y + rect.h - this.viewRect.y) / this.gridCellSize), 0, this.grid[0].length-1);
        endX = Utils.clampNumber(Math.floor((rect.x + rect.w - this.viewRect.x) / this.gridCellSize), 0, this.grid.length-1);
        endY = Utils.clampNumber(Math.floor((rect.y - this.viewRect.y) / this.gridCellSize), 0, this.grid[0].length-1);

        curX = startX;
        curY = startY;
        while(curY >= endY) {
            ret.push({x: curX, y: curY});
            curX++;
            if(curX > endX) {
                curX = startX;
                curY--;
            }
        }
        return ret;
    };

    /**
     * Places an object in the grid.
     *
     * @param o {Object}
     */
    RectangleGrid.prototype.placeObject = function (o) {
        var gridCoords = this.gridCoordinatesForRect(o);
        var curCell, alreadyIn;

        // TODO certainly not the most elegant to go about this
        for(var i = 0, len = gridCoords.length; i < len; i++) {
            curCell = this.grid[gridCoords[i].x][gridCoords[i].y];
            // check if object is already in cell
            alreadyIn = false;
            for(var j = 0, jlen = curCell.occupants.length; j < jlen; j++) {
                if(curCell.occupants[j] === o) {
                    alreadyIn = true;
                    break;
                }
            }

            if(!alreadyIn) {
                curCell.occupants.push(o);
                //this.logger.log('object placed at grid coordinates '+gridCoords[i].x +','+gridCoords[i].y);
            }
        }
    };

    /**
     * Removes an object from the grid.
     *
     * @param o {Object}
     */
    RectangleGrid.prototype.unplaceObject = function (o) {
        var curCell;
        var gridCoords = this.gridCoordinatesForRect(o);

        for(var i = 0, len = gridCoords.length; i < len; i++) {
            curCell = this.grid[gridCoords[i].x][gridCoords[i].y];
            // search for object in cell
            for(var j = 0, jlen = curCell.occupants.length; j < jlen; j++) {
                if(curCell.occupants[j] === o) {
                    // remove object from cell
                    curCell.occupants.splice(j,1);
                    //this.logger.log('object removed from grid coordinates '+gridCoords[i].x +','+gridCoords[i].y);
                    break;
                }
            }
        }
    };

    /**
     * Tests a rectangular area for overlaps.
     *
     * @param o {Object} A rectangular object in the form {id: 'obj1', x: 0, y: 1, w: 2, h: 3}
     * @returns {boolean} true if the given rectangular object overlaps any objects in the grid
     */
    RectangleGrid.prototype.testRect = function (o, idPrefixToIgnore) {
        var coords = this.gridCoordinatesForRect(o);
        var occs;
        for(var i = 0, len = coords.length; i < len; i++) {
            occs = this.grid[coords[i].x][coords[i].y].occupants;
            for(var j = 0, jlen = occs.length; j < jlen; j++) {
                if(occs[j].id === o.id || occs[j].id.startsWith(idPrefixToIgnore)) {
                    continue;
                }
                if(Utils.rectanglesOverlap(o, occs[j])) {
                    return true;
                }
            }
        }
        return false;
    };

    /**
     * Gets all overlapped items for a rectangular item
     *
     * @param o {Object} A rectangular object in the form {id: 'obj1', x: 0, y: 1, w: 2, h: 3}
     * @returns {Array} The overlapped items
     */
    RectangleGrid.prototype.getOverlaps = function (o, idPrefixToIgnore) {
        var ret = [];
        var idMap = {};
        var coords = this.gridCoordinatesForRect(o);
        var occs;
        for(var i = 0, len = coords.length; i < len; i++) {
            occs = this.grid[coords[i].x][coords[i].y].occupants;
            for(var j = 0, jlen = occs.length; j < jlen; j++) {
                if(occs[j].id === o.id || occs[j].id.startsWith(idPrefixToIgnore)) {
                    continue;
                }
                if(Utils.rectanglesOverlap(o, occs[j])) {
                    if(!idMap.hasOwnProperty(occs[j].id)) {
                        ret.push(occs[j]);
                        idMap[occs[j].id] = true;
                    }
                }
            }
        }
        return ret;
    };

    /**
     * Gets all overlapped items for a rectangular item
     *
     * @param o {Object} A rectangular object in the form {id: 'obj1', x: 0, y: 1, w: 2, h: 3}
     * @returns {Number} Number of overlapped items
     */
    RectangleGrid.prototype.getNumOverlaps = function (o, idPrefixToIgnore) {
        var ret = 0;
        var idMap = {};
        var coords = this.gridCoordinatesForRect(o);
        var occs;
        for(var i = 0, len = coords.length; i < len; i++) {
            occs = this.grid[coords[i].x][coords[i].y].occupants;
            for(var j = 0, jlen = occs.length; j < jlen; j++) {
                if(occs[j].id === o.id || occs[j].id.startsWith(idPrefixToIgnore)) {
                    continue;
                }
                if(Utils.rectanglesOverlap(o, occs[j])) {
                    if(!idMap.hasOwnProperty(occs[j].id)) {
                        ret++;
                        idMap[occs[j].id] = true;
                    }
                }
            }
        }
        return ret;
    };

    /**
     * Counts all unique rectangle overlaps in the entire grid.
     *
     * @returns {Number} The number of overlaps between objects
     */
    RectangleGrid.prototype.countOverlaps = function () {
        var sum = 0;
        var overlapMap = {};
        var occs, occ1, occ2;

        for(var x = 0; x < this.grid.length; x++) {
            for(var y = 0; y < this.grid[x].length; y++) {
                occs = this.grid[x][y].occupants;
                for(var i = 0; i < occs.length; i++) {
                    for(var j = 0; j < occs.length; j++) {
                        if(i === j) {
                            continue;
                        }
                        occ1 = occs[i];
                        occ2 = occs[j];
                        if(overlapMap.hasOwnProperty(occ1.id+'_'+occ2.id)
                        || overlapMap.hasOwnProperty(occ2.id+'_'+occ1.id)) {
                            continue;
                        }
                        if(Utils.rectanglesOverlap(occ1, occ2)) {
                            overlapMap[occ1.id+'_'+occ2.id] = true;
                            sum++;
                        }
                    }
                }
            }
        }
        return sum;
    };

	return RectangleGrid;
})();
