module.exports = (function () {
    'use strict';

    var xlsx = require('node-xlsx');
	var fs = require('fs');
    var Observable = require('./Observable.js');

    var SHEET_COLUMNS = 1;
    var SHEET_FACTIONS = 3;
    var SHEET_SYSTEMS = 2;
    var SHEET_NEBULAE = 4;

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
		this.labelConfig = undefined;
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

		var factionsSheet = this.workbook[SHEET_FACTIONS];
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

			// skip factions without an id
			if(!curRow[columnIdxMap['id']]) {
				continue;
			}

			// read faction
			/*curColor = '#';
			curR = curRow[columnIdxMap['r']] || 0;
			curG = curRow[columnIdxMap['g']] || 0;
			curB = curRow[columnIdxMap['b']] || 0;
			curColor += ('0' + curR.toString(16)).slice(-2);
			curColor += ('0' + curG.toString(16)).slice(-2);
			curColor += ('0' + curB.toString(16)).slice(-2);*/
			curFaction = {
				shortName: curRow[columnIdxMap['id']],
				longName: curRow[columnIdxMap['factionname']],
				category: 'ok',//curRow[columnIdxMap['#class']],
				color: curRow[columnIdxMap['color']],
				founding: curRow[columnIdxMap['foundingyear']] || '',
				dissolution: curRow[columnIdxMap['dissolutionyear']] || ''
			};
            // TODO temp fixes - remove
            while(curFaction.color.length < 7) {
                curFaction.color += '0';
            }
            if(curFaction.shortName === 'TC') {
                curFaction.color = '#B73C26';
            }
			this.factions[curFaction.shortName] = curFaction;
		}
	};

    /**
     * Reads the eras and populates this object's era array
     */
    SystemsReader.prototype.readEras = function () {
        this.readWorkbook();
        this.logger.log('Reading eras');

        this.eras = [];

        var erasSheet = this.workbook[SHEET_COLUMNS];
        var i = 0;
        while(erasSheet.data[i][1] !== undefined) {
            if(!isNaN(parseInt(erasSheet.data[i][1]+''))) {
                this.eras.push({
                    idx: i,
                    name: erasSheet.data[i][2]+'',
                    year: erasSheet.data[i][1]
                });
            }
            i++;
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

		var systemsSheet = this.workbook[SHEET_SYSTEMS];
        //var nebulaeSheet = this.workbook[3];

		var curRow, curSystem, curAltNames, altRegexResult, curAffiliation, curScale;
		var parentheses;
		// sort out headers
		var headerRowIdx = 1; // TODO magic number
		var columnIdxMap = {}; // map of column titles (lowercase) to column indices
        var curEra;

        this.systems = [];

		curRow = systemsSheet.data[headerRowIdx];

        // column index map
		for(var i = 0, len = curRow.length; i < len; i++) {
            if(i < 8) { // TODO magic number
                columnIdxMap[(curRow[i]+'').toLowerCase()] = i;
            } else {
                columnIdxMap['era_'+(i-8)] = i;
                /*this.eras.push({
                    idx: i,
                    name: systemsSheet.data[1][i]+'',//systemsSheet.data[0][i], // TODO magic number
                    year: curRow[i]
                });*/
            }
		}

        //this.logger.log('reading ' + (systemsSheet.data.length - headerRowIdx) + ' systems');
		for(var rowIdx = headerRowIdx + 1, endIdx = systemsSheet.data.length; rowIdx < endIdx; rowIdx++) {
			curRow = systemsSheet.data[rowIdx];

			// skip systems without coordinates
			if(curRow[columnIdxMap['x']] === undefined || curRow[columnIdxMap['y']] === undefined) {
				continue;
			}

			// read system
			curSystem = {};
			// name and status
			curSystem.name_full = curRow[columnIdxMap['systemname']];
            curSystem.name = curSystem.name_full;
            curSystem.sarnaLink = curRow[columnIdxMap['sarnalink']];

            // find alternate names
			curAltNames = [];
			if(!!curRow[columnIdxMap['alternatename']]) {
				curAltNames = curRow[columnIdxMap['alternatename']].split(/[,\/]/gi);
				// disregard any alternative names that do not contain a year in parentheses
				for(var ni = 0; ni < curAltNames.length; ni++) {
					curAltNames[ni] = curAltNames[ni].trim();
					if((altRegexResult = curAltNames[ni].match(/(.*)\s+\((\d+).*\)/i)) === null) {
						curAltNames.splice(ni,1);
						ni--;
						continue;
					}
                    // translate the system plus year string into an object
                    curAltNames[ni] = {
                        name : altRegexResult[1], // new name
                        year : parseInt(altRegexResult[2],10) // starting year for new name
                    };
				}
			}
            // sort alternate names by year
            curAltNames.sort(function (a,b) { return a.year - b.year; });

			curSystem.status = 'ok';//curRow[columnIdxMap['status']];
			// coordinates
			curSystem.x = curRow[columnIdxMap['x']];
			curSystem.y = curRow[columnIdxMap['y']];
			// scale and rotation
			curScale = (curRow[columnIdxMap['size']] || '1,1,0').split(',');
			if(curScale.length === 0 || curScale[0].trim() === '') {
				curScale = [1, 1, 0];
			} else if(curScale.length === 1) {
				curScale = [curScale[0], curScale[0], 0];
			} else if(curScale.length === 2) {
				curScale = [curScale[0], curScale[1], 0];
			}
			curSystem.radiusX = parseFloat(curScale[0], 10);
			curSystem.radiusY = parseFloat(curScale[1], 10);
			curSystem.rotation = parseFloat(curScale[2], 10);
			curSystem.isCluster = curSystem.radiusX !== 1.0 || curSystem.radiusY !== 1.0;

            // era affiliations
			curSystem.affiliations = [];
            curSystem.capitalLvls = [];
			curSystem.names = [];
            for(var eraIdx = 0; eraIdx < this.eras.length; eraIdx++) {
                curEra = this.eras[eraIdx];
                curAffiliation = curRow[columnIdxMap['era_'+eraIdx]] || '';//eras[eraI].idx] || '';
                curSystem.affiliations.push(curAffiliation);
                if(curAffiliation.match(/faction capital/gi)) {
                    curSystem.capitalLvls.push(1);
                } else if(curAffiliation.match(/major capital/gi)) {
                    curSystem.capitalLvls.push(2);
                } else if(curAffiliation.match(/minor capital/gi)) {
                    curSystem.capitalLvls.push(3);
                } else {
                    curSystem.capitalLvls.push(0);
                }
				// default: use the regular name
				curSystem.names.push(curSystem.name.replace(/\s*\([^\)]+\)\s*/gi, ''));
                for(var ni = 0; ni < curAltNames.length; ni++) {
                    if(parseInt(curEra.year,10) >= curAltNames[ni].year) {
                        curSystem.names.pop();
                        curSystem.names.push(curAltNames[ni].name.replace(/\s*\([^\)]+\)\s*/gi, ''));
                    }
                }
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

        var nebulaeSheet = this.workbook[SHEET_NEBULAE];

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
                h: curRow[columnIdxMap['height']],
                type: 'nebula'
            };
            curNeb.x = curNeb.centerX - curNeb.w * .5;
            curNeb.y = curNeb.centerY - curNeb.h * .5;
            curNeb.radiusX = curNeb.w * .5;
            curNeb.radiusY = curNeb.h * .5;
			this.nebulae.push(curNeb);
		}
    };

	/**
	 * Reads and parses the json label config file
	 */
	SystemsReader.prototype.readLabelConfig = function () {
		this.logger.log('Label config reader started');

		var fileContent = fs.readFileSync(__dirname + '/../data/labelConfig.json', 'utf8');
		var arr;
		try {
			this.labelConfig = JSON.parse(fileContent);
		} catch (e) {
			this.labelConfig = {};
			console.error(e);
			return;
		}
		for(var name in this.labelConfig) {
			if(!this.labelConfig.hasOwnProperty(name)) {
				return;
			}
			arr = this.labelConfig[name];
			for(var i = 0; i < arr.length; i++) {
				// TODO validate manual config
			}
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
