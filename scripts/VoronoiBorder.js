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
        // map of border node indices
        this.borderNodeIndices = null;
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
    VoronoiBorder.prototype.init = function (objects, cellMode) {
        this.objects = objects;
        this.cellMode = cellMode || VoronoiBorder.CELL_MODES.CIRCUMCENTERS;
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
        var o1, o2, o3;
        var col1, col2;
        var borderEdge;

        this.points = [];
        this.nodes = [];
        this.borderEdges = {};
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
            o1 = curObj;
            curObj.adjacentTriIndices.push(i);
            // second point of the triangle
            curObj = this.objects[this.delaunay.triangles[i+1]];
            o2 = curObj;
            curObj.adjacentTriIndices.push(i);
            // third point of the triangle
            curObj = this.objects[this.delaunay.triangles[i+2]];
            o3 = curObj;
            curObj.adjacentTriIndices.push(i);

            // Calculate voronoi node coordinates
            if(this.cellMode === VoronoiBorder.CELL_MODES.CIRCUMCENTERS) {
                circumcenter = Utils.circumcenter([o1.x, o1.y], [o2.x, o2.y], [o3.x, o3.y]);
                curNode.x = circumcenter[0];
                curNode.y = circumcenter[1];
            } else {
                curNode.x = (o1.x + o2.x + o3.x) / 3;
                curNode.y = (o1.y + o2.y + o3.y) / 3;
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
            o1 = this.objects[curNode.p1];
            o2 = this.objects[curNode.p2];
            o3 = this.objects[curNode.p3];
            // iterate over the current triangle's point A's adjacent triangles and
            // compare them to point B's and C's. If two of those points are part of the
            // same triangle, they are a neighbor of the current triangle
            for(var t1p = 0; t1p < o1.adjacentTriIndices.length; t1p++) {
                if(o1.adjacentTriIndices[t1p] === triIdx) {
                    continue;
                }
                for(var t2p = 0; t2p < o2.adjacentTriIndices.length; t2p++) {
                    if(o2.adjacentTriIndices[t2p] === triIdx) {
                        continue;
                    }
                    if(o1.adjacentTriIndices[t1p] === o2.adjacentTriIndices[t2p]) {
                        neighborNodes.push(o1.adjacentTriIndices[t1p] / 3);
                    }
                }
                for(var t3p = 0; t3p < o3.adjacentTriIndices.length; t3p++) {
                    if(o3.adjacentTriIndices[t3p] === triIdx) {
                        continue;
                    }
                    if(o1.adjacentTriIndices[t1p] === o3.adjacentTriIndices[t3p]) {
                        neighborNodes.push(o1.adjacentTriIndices[t1p] / 3);
                    }
                }
            }
            // compare point B's and point C's adjacent triangles (same as above)
            for(var t2p = 0; t2p < o2.adjacentTriIndices.length; t2p++) {
                if(o2.adjacentTriIndices[t2p] === triIdx) {
                    continue;
                }
                for(var t3p = 0; t3p < o3.adjacentTriIndices.length; t3p++) {
                    if(o3.adjacentTriIndices[t3p] === triIdx) {
                        continue;
                    }
                    if(o2.adjacentTriIndices[t2p] === o3.adjacentTriIndices[t3p]) {
                        neighborNodes.push(o2.adjacentTriIndices[t2p] / 3);
                    }
                }
            }
            curNode.neighborNodes = neighborNodes;

            // Step 3.1: Iterate over this node's objects and mark it as a border node if at least
            // one of the objects has a different color value than the other two
            this.borderNodeIndices[o1.col] = this.borderNodeIndices[o1.col] || [];
            this.borderNodeIndices[o2.col] = this.borderNodeIndices[o2.col] || [];
            this.borderNodeIndices[o3.col] = this.borderNodeIndices[o3.col] || [];
            borderColors = {};
            // case 1: all objects share the same color (no border)
            if(o1.col === o2.col && o2.col === o3.col) {
                // do nothing
            // case 2: object 1 and 2 share color C1, object 3 has color C2
            } else if(o1.col === o2.col && o1.col !== o3.col) {
                this.borderNodeIndices[o1.col].push(i);
                borderColors[o1.col] = true;
                this.borderNodeIndices[o3.col].push(i);
                borderColors[o3.col] = true;
            // case 2: object 1 and 3 share color C1, object 2 has color C2
            } else if(o1.col === o3.col && o1.col !== o2.col) {
                this.borderNodeIndices[o1.col].push(i);
                borderColors[o1.col] = true;
                this.borderNodeIndices[o2.col].push(i);
                borderColors[o2.col] = true;
            // case 3: object 2 and 3 share color C1, object 1 has color C2
            } else if(o2.col === o3.col && o2.col !== o1.col) {
                this.borderNodeIndices[o1.col].push(i);
                borderColors[o1.col] = true;
                this.borderNodeIndices[o2.col].push(i);
                borderColors[o2.col] = true;
            // case 5: each object has a different color
            } else {
                this.borderNodeIndices[o1.col].push(i);
                borderColors[o1.col] = true;
                this.borderNodeIndices[o2.col].push(i);
                borderColors[o2.col] = true;
                this.borderNodeIndices[o3.col].push(i);
                borderColors[o3.col] = true;
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
                                x1: curNode.x,
                                y1: curNode.y,
                                x2: curNeighbor.x,
                                y2: curNeighbor.y,
                                o1: commonObj[0],
                                o2: commonObj[1],
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
                        if(prevEdge.x1 === cmpEdge.x1 && prevEdge.y1 === cmpEdge.y1) {
                            // this case should only occur for the first edge in an edge loop, if at all
                            // --> switch points for e1
                            this.swapEdgePoints(prevEdge);
                            adjacent = true;
                            //this.logger.log('col '+col+': switched edge points for edge ' + prevEdge.id);
                        } else if(prevEdge.x1 === cmpEdge.x2 && prevEdge.y1 === cmpEdge.y2) {
                            // this case should only occur for the first edge in an edge loop, if at all
                            // --> switch points for e1, e2
                            this.swapEdgePoints(prevEdge);
                            this.swapEdgePoints(cmpEdge);
                            adjacent = true;
                            //this.logger.log('col '+col+': switched edge points for edge ' + prevEdge.id + ' AND ' + cmpEdge.id);
                        } else if(prevEdge.x2 === cmpEdge.x1 && prevEdge.y2 === cmpEdge.y1) {
                            // perfect case - no actions necessary
                            adjacent = true;
                        } else if(prevEdge.x2 === cmpEdge.x2 && prevEdge.y2 === cmpEdge.y2) {
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
        var tmp = e.x1;
        e.x1 = e.x2;
        e.x2 = tmp;
        tmp = e.y1;
        e.y1 = e.y2;
        e.y2 = tmp;
        tmp = e.p1;
        e.p1 = e.p2;
        e.p2 = tmp;
        e.id = e.id.split('-').reverse().join('-');
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
        var tension = .65;

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
                p1 = [curEdge.x1, curEdge.y1];
                p2 = [nextEdge.x1, nextEdge.y1]; // curEdge.p2 = nextEdge.p1
                p3 = [nextEdge.x2, nextEdge.y2];

                // for border edge points that border on 3 different colors
                if(Object.keys(nextEdge.p1.borderColors).length > 2) {// && !nextEdge.p1.borderColors['I']) {
                    curEdge.p1c2x = p1[0]; //curEdge.x1;
                    curEdge.p1c2y = p1[1]; //curEdge.y1;
                    curEdge.p2c1x = curEdge.p2c2x = nextEdge.p1c1x = nextEdge.p1c2x = p2[0]; //nextEdge.x1;
                    curEdge.p2c1y = curEdge.p2c2y = nextEdge.p1c1y = nextEdge.p1c2y = p2[1]; //nextEdge.y1;
                    nextEdge.p2c1x = p3[0]; //nextEdge.x1;
                    nextEdge.p2c1y = p3[1]; //nextEdge.y1;
                }

                dist12 = Utils.distance(p1[0], p1[1], p2[0], p2[1]);
                dist23 = Utils.distance(p2[0], p2[1], p3[0], p3[1]);

                // generate two control points for the looked at point (p2)
                // see http://walter.bislins.ch/blog/index.asp?page=JavaScript%3A+Bezier%2DSegmente+f%FCr+Spline+berechnen
                fa = tension * dist12 / (dist12 + dist23);
                fb = tension * dist23 / (dist12 + dist23);

                w = p3[0] - p1[0];
                h = p3[1] - p1[1];

                //if(curEdge.p1c1x !== curEdge.x1 || curEdge.p1c1y !== curEdge.y1) {
                //}
                if(curEdge.p2c1x === undefined && nextEdge.p1c1x === undefined) {
                    curEdge.p2c1x = nextEdge.p1c1x = p2[0] - fa * w;
                    curEdge.p2c1y = nextEdge.p1c1y = p2[1] - fa * h;
                } else {
                    curEdge.p2c1x = nextEdge.p1c1x = (curEdge.p2c1x || nextEdge.p1c1x);
                    curEdge.p2c1y = nextEdge.p1c1y = (curEdge.p2c1y || nextEdge.p1c1y);
                }
                if(curEdge.p2c2x === undefined && nextEdge.p1c2x === undefined) {
                    curEdge.p2c2x = nextEdge.p1c2x = p2[0] + fb * w;
                    curEdge.p2c2y = nextEdge.p1c2y = p2[1] + fb * h;
                } else {
                    curEdge.p2c2x = nextEdge.p1c2x = (curEdge.p2c2x || nextEdge.p1c2x);
                    curEdge.p2c2y = nextEdge.p1c2y = (curEdge.p2c2y || nextEdge.p1c2y);
                }
            }
        }
    };

    return VoronoiBorder;
})();
