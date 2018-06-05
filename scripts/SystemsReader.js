module.exports = (function () {
    'use strict';

    var xlsx = require('node-xlsx');
    var Observable = require('./Observable.js');

    /**
     * An instance of this class reads the planetary systems list from the
     * SUCK master list.
     *
     * @fires systemsRead When the systems list has been read
     */
    var SystemsReader = function (logger) {
        this.parent.call(this);
        this.logger = logger || console;
        this.addEventTopics('systemsRead');
    };

    SystemsReader.prototype = Object.create(Observable.prototype);
    SystemsReader.prototype.constructor = SystemsReader;
    SystemsReader.prototype.parent = Observable;

    /**
     * Initiates the data loading
     */
    SystemsReader.prototype.readSystems = function () {
        this.logger.log('Systems reader started');

        // Read xlsx file
        // TODO make file name configurable
        var workbook = xlsx.parse(__dirname + '/../data/Systems By Era.xlsx');

		var systemsSheet = workbook[1];
        var factionsSheet = workbook[2];
        var nebulaeSheet = workbook[3];
		
		console.log(systemsSheet.name, systemsSheet.data.length);
		console.log(systemsSheet.data[0]); // era descriptions
		console.log(systemsSheet.data[1]); // ?
		console.log(systemsSheet.data[2]); // years
		console.log(systemsSheet.data[3]); // first planetary system
		console.log(systemsSheet.data[4]);
		console.log(systemsSheet.data[5]);
    };

    /**
     * Calculate the distance between two planetary systems (euclidean distance in LY)
     * @private
     */
    SystemsReader.prototype.calcDistance = function(p1, p2) {
    	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    };

    /**
     * Find all planetary systems' neighbor systems.
     * @private
     */
    SystemsReader.prototype.findNeighbors = function () {
        var p;
    	var neighbors;
        var dist;

        for(var idx = 0, len = this.systems.length; idx < len; idx++) {
            p = this.systems[idx];
            neighbors = [];
        	for(var nIdx = 0, nLen = this.systems.length; nIdx < nLen; nIdx++) {
        		if(nIdx === idx) {
        			continue;
        		}
                dist = this.calcDistance(p, this.systems[nIdx]);
                if(dist === 0 && p.name < this.systems[nIdx].name) {
                    this.logger.warn('Identical coordinates for '+p.name+' and '+this.systems[nIdx].name+'.');
                } else if(dist <= 1 && p.name < this.systems[nIdx].name) {
                    this.logger.warn('Very similar coordinates for ' + p.name + ' and ' + this.systems[nIdx].name + ': Distance is ' + dist +' LY.');
                }
        		if(dist <= 30) {
        			neighbors.push(nIdx);
        		}
        	}
            p.neighbors = neighbors;
            //this.logger.log(p.name + ' has ' + neighbors.length + ' neighbors');
        }
    };

    return SystemsReader;
})();
