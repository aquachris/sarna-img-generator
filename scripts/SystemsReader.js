module.exports = (function () {
    'use strict';

    var xlsx = require('node-xlsx');
	var fs = require('fs');
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
		this.workbook = undefined;
		this.factions = undefined;
		this.systems = undefined;
		this.nebulae = undefined;
        this.addEventTopics('systemsRead');
    };

    SystemsReader.prototype = Object.create(Observable.prototype);
    SystemsReader.prototype.constructor = SystemsReader;
    SystemsReader.prototype.parent = Observable;

	/**
	 * Reads the SUCK master list excel file and reference it in a variable.
	 * This function only reads the file if no workbook reference has been
	 * read yet, or if the forceReread parameter is a truthy value.
	 *
	 * @param forceReread {boolean} Read the file, even if there is already a valid reference
	 * @private
	 */
	SystemsReader.prototype.readWorkbook = function (forceReread) {
		if(!forceReread && !!this.workbook) {
			this.logger.log('No need to read SUCK file again - reference already exists');
			return;
		}
		this.logger.log('Now reading SUCK file');

		// Read xlsx file
        // TODO make file name configurable
		this.workbook = xlsx.parse(__dirname + '/../data/Systems By Era.xlsx');
	};

	/**
	 * Reads the faction list from the SUCK master list excel file.
	 */
	SystemsReader.prototype.readFactions = function () {
		this.readWorkbook();

		this.logger.log('Faction reader started');
		this.factions = {};

		var factionsSheet = this.workbook[2]; // TODO magic number
		var curRow, curFaction, curR, curG, curB, curColor;

		// headers
		var headerRowIdx = 0; // TODO magic number
		var colIdxMap = {}; // map of column titles (lowercase) to column indices
		curRow = factionsSheet.data[headerRowIdx];

		// sort out column title -> column index mapping
		for(var i = 0, len = curRow.length; i < len; i++) {
			colIdxMap[(''+curRow[i]).toLowerCase()] = i;
		}

		// read faction data
		for(var rowIdx = headerRowIdx + 1, endIdx = factionsSheet.data.length; rowIdx < endIdx; rowIdx++) {
			curRow = factionsSheet.data[rowIdx];

			// skip factions without a short character sequence
			if(!curRow[colIdxMap['short']]) {
				continue;
			}

			// read faction
			curColor = '#';
			curR = curRow[colIdxMap['r']] || 0;
			curG = curRow[colIdxMap['g']] || 0;
			curB = curRow[colIdxMap['b']] || 0;
			curColor += ('0' + curR.toString(16)).slice(-2);
			curColor += ('0' + curG.toString(16)).slice(-2);
			curColor += ('0' + curB.toString(16)).slice(-2);
			curFaction = {
				shortName: curRow[colIdxMap['short']],
				longName: curRow[colIdxMap['long']],
				category: curRow[colIdxMap['#class']],
				color: curColor,
				founding: curRow[colIdxMap['founding']] || '',
				dissolution: curRow[colIdxMap['dissolution']] || ''
			};
			this.factions[curFaction.shortName] = curFaction;
		}
	};

    /**
     * Reads the planetary systems from the SUCK master list excel file.
	 *
	 * @returns {Array} The systems list
     */
    SystemsReader.prototype.readSystems = function () {
		this.readWorkbook();

        this.logger.log('Systems reader started');

		var systemsSheet = this.workbook[1];

        //var nebulaeSheet = this.workbook[3];

		var curRow, curSystem, curAffiliation;
		this.systems = [];

		// sort out headers
		var headerRowIdx = 2; // TODO magic number
		var colIdxMap = {}; // map of column titles (lowercase) to column indices

		curRow = systemsSheet.data[headerRowIdx];
		//console.log(curRow);

		for(var i = 0, len = curRow.length; i < len; i++) {
			colIdxMap[(''+curRow[i]).toLowerCase()] = i;
		}

		//console.log(colIdxMap);

		for(var rowIdx = headerRowIdx + 1, endIdx = systemsSheet.data.length; rowIdx < endIdx; rowIdx++) {
			curRow = systemsSheet.data[rowIdx];

			// skip systems without coordinates
			if(curRow[colIdxMap['x']] === undefined || curRow[colIdxMap['y']] === undefined) {
				continue;
			}

			// skip apocryphal systems for now (TODO)
			if(curRow[colIdxMap['status']].toLowerCase() === 'apocryphal') {
				continue;
			}

			// skip systems without a 3025 affiliation for now (TODO)
			if(curRow[colIdxMap['3025']] === undefined) {
				continue;
			}

			// read system
			curSystem = {};
			// name and status
			curSystem.name = curRow[colIdxMap['system']];
			curSystem.status = curRow[colIdxMap['status']];
			// coordinates
			curSystem.x = curRow[colIdxMap['x']];
			curSystem.y = curRow[colIdxMap['y']];

			// 3025 affiliation
			curAffiliation = curRow[colIdxMap['3025']] || '';
			curSystem['3025'] = curAffiliation.split(/\s*\,\s*/gi)[0];
			curSystem['3025_all'] = curAffiliation;

			this.systems.push(curSystem);
		}

        this.findNeighbors([30, 60]);

		fs.writeFileSync('./output/systems.json', JSON.stringify(this.systems), { encoding: 'utf8' });
		/*
		console.log(systemsSheet.name, systemsSheet.data.length);
		console.log(systemsSheet.data[0]); // era descriptions
		console.log(systemsSheet.data[1]); // ?
		console.log(systemsSheet.data[2]); // table headers and actual years
		console.log(systemsSheet.data[3]); // first planetary system
		console.log(systemsSheet.data[4]);
		console.log(systemsSheet.data[5]);
		*/
		this.logger.log('systems file written');
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
     * Neighbors with search dist != 30 will be saved in arrays named
     * neighbors_<search_dist>, e.g. neighbors_60.
     *
     * @private
     * @param radii {Array} An array of different radii to generate neighbor arrays for. Default: [30]
     */
    SystemsReader.prototype.findNeighbors = function (radii) {
        var p;
    	var neighbors;
        var neighborArrs = {};
        var dist;

        if(!radii) {
            radii = [30];
        }

        for(var idx = 0, len = this.systems.length; idx < len; idx++) {
            p = this.systems[idx];
            neighbors = [];
            for(var rI = 0, rLen = radii.length; rI < rLen; rI++) {
                neighborArrs[rI] = [];
            }
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
                for(var rI = 0, rLen = radii.length; rI < rLen; rI++) {
                    if(dist <= radii[rI]) {
                        neighborArrs[rI].push(nIdx);
                    }
                }
        		/*if(dist <= 30) {
        			neighbors.push(nIdx);
        		}*/
        	}
            for(var rI = 0, rLen = radii.length; rI < rLen; rI++) {
                if(radii[rI] === 30) {
                    p.neighbors = neighborArrs[rI];
                } else {
                    p['neighbors_'+radii[rI]] = neighborArrs[rI];
                }
            }
            //p.neighbors = neighbors;
            //this.logger.log(p.name + ' has ' + neighbors.length + ' neighbors');
        }
    };

    return SystemsReader;
})();
