module.exports = (function () {
    'use strict';

	var Delaunator = require('Delaunator');
    var Utils = require('./Utils.js');

    /**
     * An instance of this class calculates a Voronoi diagram for a given set of
     * "colored" points (systems + affiliations).
     */
    var VoronoiBorder = function (logger) {
        //this.parent.call(this);
        this.logger = logger || console;
        // Delaunator object
        this.delaunay = null;
        // cell mode (how to calculate the voronoi nodes' coordinates from delaunay triangles)
        this.cellMode = VoronoiBorder.CELL_MODES.CIRCUMCENTERS;
        // array of the actual objects (e.g. systems) in the form {x: 0, y:0, col: 'fac1'}
        this.objects = null;
        // array of points in the form [x, y]
        // point index equals object index
        this.points = null;
        // array of voronoi nodes
        this.nodes = null;
        // map of border edges for each color
        this.borderEdges = null;
		// map of bounded border edges for each color
		this.boundedBorderEdges = null;
        // map of border node indices
        this.borderNodeIndices = null;
        // distance between border lines
        this.borderSeparation = 0;
    };

    //VoronoiBorder.prototype = Object.create(Observable.prototype);
    VoronoiBorder.prototype.constructor = VoronoiBorder;
    //VoronoiBorder.prototype.parent = Observable;

    VoronoiBorder.CELL_MODES = {
        CIRCUMCENTERS: 'circumcenters',
        CENTROIDS: 'centroids'
    };

    /**
     * Initializes this object.
     * @returns {VoronoiBorder} A reference to this object, initialized
     */
    VoronoiBorder.prototype.init = function (objects, cellMode, borderSeparation) {
        this.objects = objects;
        this.cellMode = cellMode || VoronoiBorder.CELL_MODES.CIRCUMCENTERS;
        this.borderSeparation = borderSeparation || 1;
        this.calculate();
        return this;
    };

    /**
     * Performs the various voronoi calculations.
     */
    VoronoiBorder.prototype.calculate = function () {
        var circumcenter;
        var curNode, curNeighbor, curObj;
        var triIdx, neighborNodes, borderColors;
        var commonObj;
        var obj1, obj2, obj3;
        var col1, col2;
        var borderEdge;

        this.points = [];
        this.nodes = [];
        this.borderEdges = {};
		this.boundedBorderEdges = {};
        this.borderNodeIndices = {};

        // Step 1: Iterate over all objects and generate a point array
        // in the format that Delaunator needs.
        for(var i = 0, len = this.objects.length; i < len; i++) {
            this.objects[i].adjacentTriIndices = [];
            this.points.push([this.objects[i].x, this.objects[i].y]);
        }

        this.delaunay = Delaunator.from(this.points);

        // Step 2: Iterate over all triangles and generate voronoi nodes.
        // While doing so, keep track of all incident triangles for each object.
        for(var i = 0, len = this.delaunay.triangles.length; i < len; i += 3) {
            curNode = {
                x: 0,
                y: 0,
                p1: this.delaunay.triangles[i],
                p2: this.delaunay.triangles[i+1],
                p3: this.delaunay.triangles[i+2]
            };
            // first point of the triangle
            curObj = this.objects[this.delaunay.triangles[i]];
            obj1 = curObj;
            curObj.adjacentTriIndices.push(i);
            // second point of the triangle
            curObj = this.objects[this.delaunay.triangles[i+1]];
            obj2 = curObj;
            curObj.adjacentTriIndices.push(i);
            // third point of the triangle
            curObj = this.objects[this.delaunay.triangles[i+2]];
            obj3 = curObj;
            curObj.adjacentTriIndices.push(i);

            // Calculate voronoi node coordinates
            if(this.cellMode === VoronoiBorder.CELL_MODES.CIRCUMCENTERS) {
                circumcenter = Utils.circumcenter([obj1.x, obj1.y], [obj2.x, obj2.y], [obj3.x, obj3.y]);
                curNode.x = circumcenter[0];
                curNode.y = circumcenter[1];
            } else {
                curNode.x = (obj1.x + obj2.x + obj3.x) / 3;
                curNode.y = (obj1.y + obj2.y + obj3.y) / 3;
            }

            this.nodes.push(curNode);
        }

        // Step 3: Iterate over voronoi nodes,
        //   a) connect neighboring voronoi nodes
        //   b) mark node as a border node if necessary
        for(var i = 0, len = this.nodes.length; i < len; i++) {
            curNode = this.nodes[i];
			// for the given voronoi node / delaunay triangle, find all (three) adjacent delaunay triangles:
			triIdx = i*3;
			neighborNodes = [];
            obj1 = this.objects[curNode.p1];
            obj2 = this.objects[curNode.p2];
            obj3 = this.objects[curNode.p3];
            // iterate over the current triangle's point A's adjacent triangles and
            // compare them to point B's and C's. If two of those points are part of the
            // same triangle, they are a neighbor of the current triangle
            for(var t1p = 0; t1p < obj1.adjacentTriIndices.length; t1p++) {
                if(obj1.adjacentTriIndices[t1p] === triIdx) {
                    continue;
                }
                for(var t2p = 0; t2p < obj2.adjacentTriIndices.length; t2p++) {
                    if(obj2.adjacentTriIndices[t2p] === triIdx) {
                        continue;
                    }
                    if(obj1.adjacentTriIndices[t1p] === obj2.adjacentTriIndices[t2p]) {
                        neighborNodes.push(obj1.adjacentTriIndices[t1p] / 3);
                    }
                }
                for(var t3p = 0; t3p < obj3.adjacentTriIndices.length; t3p++) {
                    if(obj3.adjacentTriIndices[t3p] === triIdx) {
                        continue;
                    }
                    if(obj1.adjacentTriIndices[t1p] === obj3.adjacentTriIndices[t3p]) {
                        neighborNodes.push(obj1.adjacentTriIndices[t1p] / 3);
                    }
                }
            }
            // compare point B's and point C's adjacent triangles (same as above)
            for(var t2p = 0; t2p < obj2.adjacentTriIndices.length; t2p++) {
                if(obj2.adjacentTriIndices[t2p] === triIdx) {
                    continue;
                }
                for(var t3p = 0; t3p < obj3.adjacentTriIndices.length; t3p++) {
                    if(obj3.adjacentTriIndices[t3p] === triIdx) {
                        continue;
                    }
                    if(obj2.adjacentTriIndices[t2p] === obj3.adjacentTriIndices[t3p]) {
                        neighborNodes.push(obj2.adjacentTriIndices[t2p] / 3);
                    }
                }
            }
            curNode.neighborNodes = neighborNodes;

            // Step 3.1: Iterate over this node's objects and mark it as a border node if at least
            // one of the objects has a different color value than the other two
            this.borderNodeIndices[obj1.col] = this.borderNodeIndices[obj1.col] || [];
            this.borderNodeIndices[obj2.col] = this.borderNodeIndices[obj2.col] || [];
            this.borderNodeIndices[obj3.col] = this.borderNodeIndices[obj3.col] || [];
            borderColors = {};
            // case 1: all objects share the same color (no border)
            if(obj1.col === obj2.col && obj2.col === obj3.col) {
                // do nothing
            // case 2: object 1 and 2 share color C1, object 3 has color C2
            } else if(obj1.col === obj2.col && obj1.col !== obj3.col) {
                this.borderNodeIndices[obj1.col].push(i);
                borderColors[obj1.col] = true;
                this.borderNodeIndices[obj3.col].push(i);
                borderColors[obj3.col] = true;
            // case 2: object 1 and 3 share color C1, object 2 has color C2
            } else if(obj1.col === obj3.col && obj1.col !== obj2.col) {
                this.borderNodeIndices[obj1.col].push(i);
                borderColors[obj1.col] = true;
                this.borderNodeIndices[obj2.col].push(i);
                borderColors[obj2.col] = true;
            // case 3: object 2 and 3 share color C1, object 1 has color C2
            } else if(obj2.col === obj3.col && obj2.col !== obj1.col) {
                this.borderNodeIndices[obj1.col].push(i);
                borderColors[obj1.col] = true;
                this.borderNodeIndices[obj2.col].push(i);
                borderColors[obj2.col] = true;
            // case 5: each object has a different color
            } else {
                this.borderNodeIndices[obj1.col].push(i);
                borderColors[obj1.col] = true;
                this.borderNodeIndices[obj2.col].push(i);
                borderColors[obj2.col] = true;
                this.borderNodeIndices[obj3.col].push(i);
                borderColors[obj3.col] = true;
            }
            curNode.borderColors = borderColors;

            // Step 3.2: Iterate over this node's neighbors and create border edges,
            // if the connection between the two neighbors is a border and it hasn't
            // been added to the border edges array yet.
            for(var ni = 0; ni < neighborNodes.length; ni++) {
                curNeighbor = this.nodes[neighborNodes[ni]];
                commonObj = [];
                for(var n1i = 1; n1i <= 3; n1i++) {
                    if(curNode['p'+n1i] === curNeighbor.p1) {
                        commonObj.push(curNeighbor.p1);
                    } else if(curNode['p'+n1i] === curNeighbor.p2) {
                        commonObj.push(curNeighbor.p2);
                    } else if(curNode['p'+n1i] === curNeighbor.p3) {
                        commonObj.push(curNeighbor.p3);
                    }
                }
                if(commonObj.length >= 2) {
                    col1 = this.objects[commonObj[0]].col;
                    col2 = this.objects[commonObj[1]].col;
                    if(col1 !== col2) {
                        // precondition for a border edge has been met
                        // make sure to only add the edge once
                        if(i < neighborNodes[ni]) {
                            borderEdge = {
                                id: i+'-'+neighborNodes[ni],
                                n1: {x: curNode.x, y: curNode.y},
                                n2: {x: curNeighbor.x, y: curNeighbor.y},
                                obj1: commonObj[0],
                                obj2: commonObj[1],
                                col1: col1,
                                col2: col2,
                                p1: curNode,
                                p2: curNeighbor
                            };
                            this.borderEdges[col1] = this.borderEdges[col1] || [];
                            this.borderEdges[col2] = this.borderEdges[col2] || [];
                            this.borderEdges[col1].push(borderEdge);
                            this.borderEdges[col2].push(borderEdge);
                        }
                    }
                }
            }
        }

        this.sortBorderEdges();
		this.separateEdges(this.borderSeparation);
        this.generateEdgeControlPoints();
    };

    /**
     * Sort the borderEdge arrays such that each edge is either followed
     * by its next neighbor (direction is undefined), or - if no such neighbor can be
     * found - by another edge loop's random starting edge. It should be possible
     * to iterate over the edges via e1.p2 = e2.p1, e2.p2 = e3.p1 etc.
     */
    VoronoiBorder.prototype.sortBorderEdges = function () {
        var oriColArr, newColArr;
        var curEdge, prevEdge, cmpEdge, adjacent;

        for(var col in this.borderEdges) {
            if(!this.borderEdges.hasOwnProperty(col)) {
                continue;
            }
            oriColArr = JSON.parse(JSON.stringify(this.borderEdges[col]));
            newColArr = [];
            curEdge = null;
            prevEdge = null;
            while(oriColArr.length > 0) {
                if(!curEdge) {
                    curEdge = oriColArr.splice(0, 1)[0];
                    curEdge.isFirstInLoop = true;
                } else {
                    prevEdge = curEdge;
                    curEdge = null;
                    for(var i = 0, len = oriColArr.length; i < len; i++) {
                        cmpEdge = oriColArr[i];
                        adjacent = false;
                        if(prevEdge.n1.x === cmpEdge.n1.x && prevEdge.n1.y === cmpEdge.n1.y) {
                            // this case should only occur for the first edge in an edge loop, if at all
                            // --> swap points for e1
                            this.swapEdgePoints(prevEdge);
                            adjacent = true;
                            //this.logger.log('col '+col+': switched edge points for edge ' + prevEdge.id);
                        } else if(prevEdge.n1.x === cmpEdge.n2.x && prevEdge.n1.y === cmpEdge.n2.y) {
                            // this case should only occur for the first edge in an edge loop, if at all
                            // --> switch points for e1, e2
                            this.swapEdgePoints(prevEdge);
                            this.swapEdgePoints(cmpEdge);
                            adjacent = true;
                            //this.logger.log('col '+col+': switched edge points for edge ' + prevEdge.id + ' AND ' + cmpEdge.id);
                        } else if(prevEdge.n2.x === cmpEdge.n1.x && prevEdge.n2.y === cmpEdge.n1.y) {
                            // perfect case - no actions necessary
                            adjacent = true;
                        } else if(prevEdge.n2.x === cmpEdge.n2.x && prevEdge.n2.y === cmpEdge.n2.y) {
                            // swap points for e2
                            this.swapEdgePoints(cmpEdge);
                            adjacent = true;
                        }
                        if(adjacent) {
                            curEdge = cmpEdge;
                            oriColArr.splice(i, 1);
                            break;
                        }
                    }
                    if(!curEdge) {
                        // no neighbor found -  start a new loop
                        curEdge = oriColArr.splice(0, 1)[0];
                        curEdge.isFirstInLoop = true;
                    }
                }
                newColArr.push(curEdge);
            }
            this.borderEdges[col] = newColArr;
        }
    };

    /**
     * Switches the two points of a single edge.
     * @param e {Object} the edge object
     * @private
     */
    VoronoiBorder.prototype.swapEdgePoints = function (e) {
        var tmp = e.n1;
        e.n1 = e.n2;
        e.n2 = tmp;
        tmp = e.p1;
        e.p1 = e.p2;
        e.p2 = tmp;
        e.id = e.id.split('-').reverse().join('-');
    };

    /**
     * Pulls each border edge slightly closer to its same-color object.
     *
     * This is optional - works well when border strokes are shown.
     * @param pullDist {Number} Borders will be pulled apart by this many units.
     */
    VoronoiBorder.prototype.separateEdges = function (pullDist) {
        var oriEdges;
        var curLoopStartIdx;
        var curEdge, nextEdge;
        var curO, nextO;
		var p1, p2, p3;
		var vec1, perp1, vec2, perp2;
        var centerPoint;
        var adjVector;
        var dotProduct;
		var extFactor;
        for(var col in this.borderEdges) {
            if(!this.borderEdges.hasOwnProperty(col)) {
                continue;
            }
            curLoopStartIdx = -1;
			oriEdges = JSON.parse(JSON.stringify(this.borderEdges[col]));
            for(var i = 0, len = this.borderEdges[col].length; i < len; i++) {
                curEdge = this.borderEdges[col][i];
                if(curEdge.isFirstInLoop) {
                    curLoopStartIdx = i;
                }
                nextEdge = this.borderEdges[col][i+1];
                if(!nextEdge || nextEdge.isFirstInLoop) {
                    nextEdge = this.borderEdges[col][curLoopStartIdx];
                }
                curO = curEdge.col1 === col ? this.objects[curEdge.obj1] : this.objects[curEdge.obj2];
                nextO = nextEdge.col1 === col ? this.objects[nextEdge.obj1] : this.objects[nextEdge.obj2];

				p1 = { x: oriEdges[i].n1.x, y: oriEdges[i].n1.y };
				p2 = { x: oriEdges[i].n2.x, y: oriEdges[i].n2.y };
				p3 = { x: nextEdge.n2.x, y: nextEdge.n2.y };

				vec1 = [p2.x - p1.x, p2.y - p1.y];
				Utils.normalizeVector2d(vec1);
				/*centerPoint = {
                    x: (p1.x + p2.x) / 2,
                    y: (p1.y + p2.y) / 2
                };*/
				perp1 = [-vec1[1], vec1[0]];
                // TODO there must be a more elegant way to determine this
				if(Utils.distance(curO.x, curO.y, p2.x, p2.y) < Utils.distance(curO.x, curO.y, p2.x + perp1[0], p2.y + perp1[1])) {
					perp1 = [vec1[1], -vec1[0]];
				}
				Utils.normalizeVector2d(perp1);

				vec2 = [p3.x - p2.x, p3.y - p2.y];
				Utils.normalizeVector2d(vec2);
				centerPoint = {
                    x: (p3.x + p2.x) / 2,
                    y: (p3.y + p2.y) / 2
                };
				perp2 = [-vec2[1], vec2[0]];
                // TODO there must be a more elegant way to determine this
				if(Utils.distance(nextO.x, nextO.y, p2.x, p2.y) < Utils.distance(nextO.x, nextO.y, p2.x + perp2[0], p2.y + perp2[1])) {
					perp2 = [vec2[1], -vec2[0]];
				}
				Utils.normalizeVector2d(perp2);

				dotProduct = Utils.dotProduct2d(perp1, perp2);

				extFactor = 1;
				// case 1: the angle between the two vectors is <= 90°
				if(dotProduct >= 0) {
					adjVector = [perp1[0] + perp2[0], perp1[1] + perp2[1]];

				// case 2: the angle between the two vectors is > 90°
				} else {
					// case 2a: the angle between curEdge and nextEdge is < 90*
                    // TODO there must be a more elegant way to determine this
					if(Utils.distance(curO.x, curO.y, centerPoint.x, centerPoint.y) < Utils.distance(curO.x, curO.y, centerPoint.x + perp2[0], centerPoint.y + perp2[1])) {
						adjVector = [p2.x - p1.x + p2.x - p3.x, p2.y - p1.y + p2.y - p3.y];

					// case 2b: the angle between curEdge and nextEdge is > 180*
					} else {
						adjVector = [p1.x - p2.x + p3.x - p2.x, p1.y - p2.y + p3.y - p2.y];
					}
					extFactor =	0.6 * (1 - dotProduct); // TODO magic numbers. Also, this doesn't really have a big effect - leave out?
				}
				// scale the vector to be pullDist units long
				//Utils.normalizeVector2d(adjVector);
				Utils.scaleVector2d(adjVector, pullDist * extFactor);

				// move the point in question
				curEdge.n2.x = nextEdge.n1.x = oriEdges[i].n2.x + adjVector[0];
                curEdge.n2.y = nextEdge.n1.y = oriEdges[i].n2.y + adjVector[1];
            }
        }
    };

    /**
     * For each point of each color's border edges, generate two bezier control
     * points. The goal is to have rounded edges.
     *
     * Requires sorted edges and loop start markings as provided by this.sortBorderEdges.
     */
    VoronoiBorder.prototype.generateEdgeControlPoints = function () {
        var curEdge, nextEdge;
        var p1, p2, p3, dist12, dist23, w, h;
        var curLoopStartIdx;
        var fa, fb;
        var tension = .35;//.65;

        // each color edge is treated separately
        for(var col in this.borderEdges) {
            if(!this.borderEdges.hasOwnProperty(col)) {
                continue;
            }

            curLoopStartIdx = -1;
            for(var i = 0, len = this.borderEdges[col].length; i < len; i++) {
                curEdge = this.borderEdges[col][i];
                if(curEdge.isFirstInLoop) {
                    curLoopStartIdx = i;
                }
                nextEdge = this.borderEdges[col][i+1];
                if(!nextEdge || nextEdge.isFirstInLoop) {
                    nextEdge = this.borderEdges[col][curLoopStartIdx];
                }
                p1 = { x: curEdge.n1.x, y: curEdge.n1.y };
                p2 = { x: nextEdge.n1.x, y: nextEdge.n1.y }; // curEdge.p2 = nextEdge.p1
                p3 = { x: nextEdge.n2.x, y: nextEdge.n2.y };

                // for border edge points that border on 3 different colors
                if(Object.keys(nextEdge.p1.borderColors).length > 2) {// && !nextEdge.p1.borderColors['I']) {
                    curEdge.n1c2 = { x: p1.x, y: p1.y };
                    curEdge.n2c1 = curEdge.n2c2 = nextEdge.n1c1 = nextEdge.n1c2 = { x: p2.x, y: p2.y };
                    nextEdge.n2c1 = { x: p3.x, y: p3.y };
				}

                dist12 = Utils.distance(p1.x, p1.y, p2.x, p2.y);
                dist23 = Utils.distance(p2.x, p2.y, p3.x, p3.y);

                // generate two control points for the looked at point (p2)
                // see http://walter.bislins.ch/blog/index.asp?page=JavaScript%3A+Bezier%2DSegmente+f%FCr+Spline+berechnen
                fa = tension * dist12 / (dist12 + dist23);
                fb = tension * dist23 / (dist12 + dist23);

                w = p3.x - p1.x;
                h = p3.y - p1.y;

                if(curEdge.n2c1 === undefined && nextEdge.n1c1 === undefined) {
                    curEdge.n2c1 = nextEdge.n1c1 = {
                        x: p2.x - fa * w,
                        y: p2.y - fa * h
                    };
                } else {
                    curEdge.n2c1 = nextEdge.n1c1 = (curEdge.n2c1 || nextEdge.n1c1);
                }
                if(curEdge.n2c2x === undefined && nextEdge.n1c2x === undefined) {
                    curEdge.n2c2 = nextEdge.n1c2 = {
                        x: p2.x + fb * w,
                        y: p2.y + fb * h
                    };
                } else {
                    curEdge.n2c2 = nextEdge.n1c2 = (curEdge.n2c2 || nextEdge.n1c2);
                }
            }
        }
    };

	/**
	 * Generate a set of bounded borders for each faction.
	 * This is an optional step that reduces the amount of edges in a border path to only those that are actually displayed,
	 * plus connecting "off-screen" lines to maintain shape closure.
	 *
	 * @param rect {Object} The bounding box (x, y, w, h in map space)
	 */
	VoronoiBorder.prototype.generateBoundedBorders = function (rect) {
		var curColEdges;
		var outsideEdgePoints, outsideEdges;
		var prevEdge, curEdge;
		var prevEdgeVisible, curEdgeVisible;
		var curLoopStartIdx;
		var curLoopVisible;
		var newEdge;
        var tolerance = 5;
        var tRect = {
            x: rect.x - tolerance,
            y: rect.y - tolerance,
            w: rect.w + tolerance * 2,
            h: rect.h + tolerance * 2
        };

        // private helper function
        var clampPoint = function(x, y, rect) {
            return {
                x: Math.min(Math.max(x, rect.x), rect.x + rect.w),
                y: Math.min(Math.max(y, rect.y), rect.y + rect.h)
            };
        };

        // private helper function
        var aggregatePointsToEdges = function(points, log) {
            var edges = [];
            var p1, p2, p3;

            if(!points || points.length < 2) {
                return edges;
            }

            // Remove points one by one, while adding edges:
            // If the array's first three points are on a common line along the
            // x or y direction, the middle point can be removed.
            // If not, a new edge must be added between point 1 and point 2, and point 1
            // can be removed from the array.
            while(points.length > 2) {
                if(!!log) {
                    console.log(points.length + ' points');
                }
                p1 = points[0];
                p2 = points[1];
                p3 = points[2];

                // remove identical points p2, or ones that are on a line between p1 and p3
                if( (p1.x === p2.x && (p1.y === p2.y || p2.x === p3.x)) ||
                    (p1.y === p2.y && p2.y === p3.y) ) {
                    points.splice(1, 1); // remove p2

                // there is a switch in direction at p2 --> new edge
                } else {
                    edges.push({
                        n1: p1,
                        n2: p2,
                        p1: p1,
                        p2: p2
                    });
                    points.shift(); // remove p1
                }
            }
            // clean up the remaining two points
            edges.push({
                n1: points[0],
                n2: points[1],
                p1: points[0],
                p2: points[1]
            });
            return edges;
        };

		this.boundedBorderEdges = {};

		for(var col in this.borderEdges) {
			if(!this.borderEdges.hasOwnProperty(col)) {
				continue;
			}
			curColEdges = [];
            outsideEdgePoints = [];

			curEdge = null;
			curEdgeVisible = false;
			curLoopVisible = false;
			for(var i = 0, len = this.borderEdges[col].length; i < len; i++) {
				prevEdge = curEdge;
				prevEdgeVisible = !!prevEdge && curEdgeVisible;

                curEdge = this.borderEdges[col][i];
				curEdgeVisible = Utils.pointInRectangle(curEdge.n1, tRect) || Utils.pointInRectangle(curEdge.n2, tRect);

				if(curEdge.isFirstInLoop) {
					curLoopVisible = false;
                    outsideEdgePoints = [];
                    prevEdge = null;
                    prevEdgeVisible = false;
				}

			    // either the previous or the current edge is visible
                // --> add the current edge to the list as is, after adding
                //     any outside edges that precede it (if applicable)
				if(prevEdgeVisible || curEdgeVisible) {
                    if(outsideEdgePoints.length > 0) {
                        // edge loop is coming back into view
                        // --> resolve all outside edge points that were added for the current edge loop
                        outsideEdges = aggregatePointsToEdges(outsideEdgePoints);
                        for(var j = 0, jlen = outsideEdges.length; j < jlen; j++) {
                            curColEdges.push(outsideEdges[j]);
                        }
                        outsideEdgePoints = [];
                    }
					newEdge = Utils.deepCopy(curEdge);

					if(!curLoopVisible) {
						newEdge.isFirstInLoop = true;
						curLoopVisible = true;
					}
                    curColEdges.push(newEdge);

                // both the previous and the current edge are invisible
                // --> add the current edge's first point to a list of outside points
                //     that will be aggregated and re-assembled to shorter path parts later
                } else {
                    outsideEdgePoints.push(clampPoint(curEdge.n1.x, curEdge.n1.y, tRect));
				}
			}

			if(curColEdges.length > 0) {
				this.boundedBorderEdges[col] = curColEdges;
			}
		};
	};

    return VoronoiBorder;
})();
