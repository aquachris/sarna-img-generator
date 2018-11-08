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
        this.eras = undefined;
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
			//this.logger.log('No need to read SUCK file again - reference already exists');
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
		var columnIdxMap = {}; // map of column titles (lowercase) to column indices
		curRow = factionsSheet.data[headerRowIdx];

		// sort out column title -> column index mapping
		for(var i = 0, len = curRow.length; i < len; i++) {
			columnIdxMap[(''+curRow[i]).toLowerCase()] = i;
		}

		// read faction data
		for(var rowIdx = headerRowIdx + 1, endIdx = factionsSheet.data.length; rowIdx < endIdx; rowIdx++) {
			curRow = factionsSheet.data[rowIdx];

			// skip factions without a short character sequence
			if(!curRow[columnIdxMap['short']]) {
				continue;
			}

			// read faction
			curColor = '#';
			curR = curRow[columnIdxMap['r']] || 0;
			curG = curRow[columnIdxMap['g']] || 0;
			curB = curRow[columnIdxMap['b']] || 0;
			curColor += ('0' + curR.toString(16)).slice(-2);
			curColor += ('0' + curG.toString(16)).slice(-2);
			curColor += ('0' + curB.toString(16)).slice(-2);
			curFaction = {
				shortName: curRow[columnIdxMap['short']],
				longName: curRow[columnIdxMap['long']],
				category: curRow[columnIdxMap['#class']],
				color: curColor,
				founding: curRow[columnIdxMap['founding']] || '',
				dissolution: curRow[columnIdxMap['dissolution']] || ''
			};
			this.factions[curFaction.shortName] = curFaction;
		}
	};

    /**
     * Reads the planetary systems from the SUCK master list excel file.
	 *
	 * @returns {Array} The systems list
     */
    SystemsReader.prototype.readSystemsAndEras = function () {
		this.readWorkbook();

        this.logger.log('Systems reader started');

		var systemsSheet = this.workbook[1];
        //var nebulaeSheet = this.workbook[3];

		var curRow, curSystem, curAffiliation;
		// sort out headers
		var headerRowIdx = 2; // TODO magic number
		var columnIdxMap = {}; // map of column titles (lowercase) to column indices
        var curEra;

        this.systems = [];
        this.eras = [];

		curRow = systemsSheet.data[headerRowIdx];

        // column index map
		for(var i = 0, len = curRow.length; i < len; i++) {
            if(i < 5) { // TODO magic number
                columnIdxMap[(curRow[i]+'').toLowerCase()] = i;
            } else {
                columnIdxMap['era_'+this.eras.length] = i;
                this.eras.push({
                    idx: i,
                    name: systemsSheet.data[0][i], // TODO magic number
                    year: curRow[i]
                });
            }
		}

        //this.logger.log('reading ' + (systemsSheet.data.length - headerRowIdx) + ' systems');
		for(var rowIdx = headerRowIdx + 1, endIdx = systemsSheet.data.length; rowIdx < endIdx; rowIdx++) {
			curRow = systemsSheet.data[rowIdx];

			// skip systems without coordinates
			if(curRow[columnIdxMap['x']] === undefined || curRow[columnIdxMap['y']] === undefined) {
				continue;
			}

			// skip apocryphal systems for now (TODO)
			if(curRow[columnIdxMap['status']].toLowerCase() === 'apocryphal') {
				continue;
			}

			// read system
			curSystem = {
				radiusX: 1.0,
				radiusY: 1.0
			};
			// TODO read this from SUCS file
            if(curRow[columnIdxMap['system']] === 'Hyades Cluster') {
				curSystem.radiusX = 5.0;
				curSystem.radiusY = 5.0;
            }
			// name and status
			curSystem.name_full = curRow[columnIdxMap['system']];
            curSystem.name = curSystem.name_full;
            var parentheses;
            if(parentheses = curSystem.name_full.match(/(.+)\s*\(\s*(.+)\s*\)/i)) {
                if(parentheses[2].match(/[0-9]/)) {
                    curSystem.oldName = parentheses[1].trim();
                    curSystem.newName = parentheses[2].replace(/\s[0-9]+\'*s*\+*/g, '');
                    curSystem.name = curSystem.newName;
                } else {
                    curSystem.name = parentheses[1].trim();
                }
                //console.log(parentheses, curSystem.name, curSystem.oldName || '', curSystem.newName || '');
            }
			curSystem.status = curRow[columnIdxMap['status']];
			// coordinates
			curSystem.x = curRow[columnIdxMap['x']];
			curSystem.y = curRow[columnIdxMap['y']];

            // era affiliations
			curSystem.affiliations = [];
            for(var eraIdx = 0; eraIdx < this.eras.length; eraIdx++) {
                curEra = this.eras[eraIdx];
                curAffiliation = curRow[columnIdxMap['era_'+eraIdx]] || '';//eras[eraI].idx] || '';
                curSystem.affiliations.push(curAffiliation);
            }

			this.systems.push(curSystem);
		}
		this.systems.sort(function (a, b) {
			return (b.radiusX + b.radiusY) - (a.radiusX + a.radiusY);
		});

        //this.findNeighbors([30, 60]);

		//fs.writeFileSync('./output/systems.json', JSON.stringify(this.systems), { encoding: 'utf8' });
        //this.logger.log('systems file written');

		/*
		console.log(systemsSheet.name, systemsSheet.data.length);
		console.log(systemsSheet.data[0]); // era descriptions
		console.log(systemsSheet.data[1]); // ?
		console.log(systemsSheet.data[2]); // table headers and actual years
		console.log(systemsSheet.data[3]); // first planetary system
		console.log(systemsSheet.data[4]);
		console.log(systemsSheet.data[5]);
		*/
    };

    /**
     * Reads the nebulae from the corresponding sheet.
     */
    SystemsReader.prototype.readNebulae = function () {
        this.readWorkbook();

        this.logger.log('Nebulae reader started');

        var nebulaeSheet = this.workbook[3];

		var curRow;
		// sort out headers
		var headerRowIdx = 0; // TODO magic number
		var columnIdxMap = {}; // map of column titles (lowercase) to column indices
        var curNeb;

        this.nebulae = [];

		curRow = nebulaeSheet.data[headerRowIdx];

        // column index map
		for(var i = 0, len = curRow.length; i < len; i++) {
            columnIdxMap[(curRow[i]+'').toLowerCase()] = i;
		}

		for(var rowIdx = headerRowIdx + 1, endIdx = nebulaeSheet.data.length; rowIdx < endIdx; rowIdx++) {
			curRow = nebulaeSheet.data[rowIdx];

			// skip rows without coordinates
			if(curRow[columnIdxMap['x']] === undefined || curRow[columnIdxMap['y']] === undefined) {
				continue;
			}

			// read nebula
            curNeb = {
                name: curRow[columnIdxMap['nebula']],
    			centerX: curRow[columnIdxMap['x']],
                centerY: curRow[columnIdxMap['y']],
                w: curRow[columnIdxMap['width']],
                h: curRow[columnIdxMap['height']]
            };
            curNeb.x = curNeb.centerX - curNeb.w * .5;
            curNeb.y = curNeb.centerY - curNeb.h * .5;
			this.nebulae.push(curNeb);
		}
    };

    /**
     * Calculates the distance between two planetary systems (euclidean distance in LY)
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
