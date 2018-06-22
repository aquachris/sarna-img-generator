module.exports = (function () {
    'use strict';

	var Delaunator = require('Delaunator');

    /**
     * An instance of this class calculates a Voronoi diagram for a given set of
     * "colored" points (systems + affiliations).
     */
    var VoronoiBorder = function (logger) {
        //this.parent.call(this);
        this.logger = logger || console;
        // Delaunator object
        this.delaunay = null;
        // array of the actual objects (e.g. systems) in the form {x: 0, y:0, col: 'fac1'}
        this.objects = null;
        // array of points in the form [x, y]
        // point index equals object index
        this.points = null;
        // array of voronoi nodes
        this.nodes = null;
        // map of border node indices
        this.borderNodeIndices = null;
    };

    //VoronoiBorder.prototype = Object.create(Observable.prototype);
    VoronoiBorder.prototype.constructor = VoronoiBorder;
    //VoronoiBorder.prototype.parent = Observable;

    /**
     * Initializes this object.
     * @returns {VoronoiBorder} A reference to this object, initialized
     */
    VoronoiBorder.prototype.init = function (objects) {
        this.objects = objects;
        this.calculate();
        return this;
    };

    /**
     * Performs the various voronoi calculations.
     */
    VoronoiBorder.prototype.calculate = function () {
        var curNode, curObj;
        var triIdx, neighborNodes, borderColors;
        var o1, o2, o3;

        this.points = [];
        this.nodes = [];
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
            curObj.adjacentTriIndices.push(i);
            curNode.x += curObj.x;
            curNode.y += curObj.y;
            // second point of the triangle
            curObj = this.objects[this.delaunay.triangles[i+1]];
            curObj.adjacentTriIndices.push(i);
            curNode.x += curObj.x;
            curNode.y += curObj.y;
            // third point of the triangle
            curObj = this.objects[this.delaunay.triangles[i+2]];
            curObj.adjacentTriIndices.push(i);
            curNode.x += curObj.x;
            curNode.y += curObj.y;

            // finalize voronoi node
            curNode.x /= 3;
            curNode.y /= 3;

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
            // iterate over triangle point A's adjacent triangles and compare
            // them to point B's and C's. If two of those points are part of the same
            // triangle, they are a neighbor of the current triangle
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

            // Step 4: Go over this node's objects and mark it as a border node if at least
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
        }
    };

    /**
     * TODO this *really* isn't an efficient way to do it
     * @returns Array of arrays, where each array is a sequence of nodes wrapped around a contiguous area
     */
    VoronoiBorder.prototype.getBorderPointsForColor = function (col) {
        var bNodeCoords = [];
        var bnis = (this.borderNodeIndices[col] || []).slice(); // slice copies the array
        var curIdx, curNode, nextNode, curIdx;
        var curPath = [];
        var borders = [];

        while(bnis.length > 0) {
            if(!curNode) {
                if(curPath.length > 0) {
                    borders.push(curPath);
                    curPath = [];
                }
                curIdx = bnis.shift();
                curNode = this.nodes[curIdx];
            }
            curPath.push(curNode);
            // look for next node in this node's neighbors
            nextNode = null;
            for(var i = 0; i < 3; i++) {
                if(this.nodes[curNode.neighborNodes[i]].borderColors[col] === true) {
                    // search neighbor node in bnis array and remove it from there
                    for(var j = 0, len = bnis.length; j < len; j++) {
                        if(bnis[j] === curNode.neighborNodes[i]) {
                            nextNode = this.nodes[bnis.splice(j, 1)[0]];
                            break;
                        }
                    }
                    if(nextNode) {
                        break;
                    }
                }
            }
            curNode = nextNode;
        };
        return borders;
    };

    return VoronoiBorder;
})();
