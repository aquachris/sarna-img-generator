'use strict';
var fs = require('fs');
var Logger = require('./Logger.js');
var StupidLogger = require('./StupidLogger.js');
var LogRenderer = require('./LogRenderer.js');
var Utils = require('./Utils.js');
var SystemsReader = require('./SystemsReader.js');
var PoissonDisc = require('./PoissonDisc.js');
var VoronoiBorder = require('./VoronoiBorder.js');
var BorderLabeler = require('./BorderLabeler.js');
var NebulaRandomizer = require('./NebulaRandomizer.js');
var LabelManager = require('./LabelManager.js');
var SvgWriter = require('./SvgWriter.js');

var main = function () {
    // initialize objects
    // the logger and log renderer just hog memory
    // TODO make the logger smarter (flush at regular intervals to keep memory usage in check)
    // var logger = new Logger(Logger.MESSAGE);
    var logger = new StupidLogger();
    //var logger = console;
    //var logRenderer = new LogRenderer(logger, '../data/script_log.html', '../data/log.tpl.html');
    var reader = new SystemsReader(logger);
	var writer = new SvgWriter(logger);
	var pDisc;
	var nebulaeRandomizer;
	var vBorder;
	var borderLabeler;
    var labelMgr;
	var curEra;
    var reservedPoints;
    var voronoiSystems;
    var clampedSystems;
	var clampedBorders, minimapBorders;
    var clampedNebulae, minimapNebulae;
    var curSys, curAff, curP;
    var systemRadius = 1;
    var labelDist = 0.5;
    var tmpIdx;

    // read factions from the xlsx
	reader.readFactions();

    // read nebulae from the xlsx
    reader.readNebulae();

    // read eras from the xlsx
    reader.readEras();

    // read planetary systems from the xlsx
    reader.readSystems();

	// read label settings from the config file
	reader.readLabelConfig();

    /*
    // image dimensions in pixels
    var dimensions = {
        w: 1000,
        h: 1000
    };

    // the visible rectangle, in map space:
	var viewRect = {
        x: -70,
        y: -70,
        w: 140,
        h: 140
	};

	var minimapDimensions = {
		w: 400,
		h: 200
	};
	var minimapViewRect = {
		x: -600,
		y: -300,
		w: 1200,
		h: 600
	};
    */

    // image dimensions in pixels
    var dimensions = {
        w: 1000,
        h: 1143
    };

    // the visible rectangle, in map space:
    var viewRect = {
        x: -70,
        y: -80,
        w: 140,
        h: 160
    };

	var minimapDimensions = {
		w: 400,
		h: 200
	};
	var minimapViewRect = {
		x: -600,
		y: -300,
		w: 1200,
		h: 600
	};

    var focusedSystem;
    var focusedSystemName;
    var focusedSystemArticleName;

    // generate points randomly scattered in 2D space
    pDisc = new PoissonDisc().init(-2000, -2000, 4000, 4000, 35, 30);

    // randomize nebulae
    nebulaeRandomizer = new NebulaRandomizer(logger).init(reader.nebulae);

    for(var fsi = 0; fsi < reader.systems.length; fsi++) {// reader.systems.length; fsi++) {
        focusedSystem = reader.systems[fsi];
        focusedSystemName = focusedSystem.name;
        focusedSystemArticleName = focusedSystem.sarnaLink.split('/').pop();
        logger.log('Starting on ' + focusedSystemName);

        viewRect.x = focusedSystem.x - viewRect.w * .5;
        viewRect.y = focusedSystem.y - viewRect.h * .5 - 15; // TODO 10 LY off because map is not rectangular?
        minimapViewRect.x = focusedSystem.x - minimapViewRect.w * .5;
        minimapViewRect.y = focusedSystem.y - minimapViewRect.h * .5;

        // clamp nebulae to view box
    	clampedNebulae = nebulaeRandomizer.generateBoundedNebulae(viewRect);
    	minimapNebulae = nebulaeRandomizer.generateBoundedNebulae(minimapViewRect);

        // for each era ...
    	for(var eraI = 0; eraI < reader.eras.length; eraI++) {
			if(
                eraI === 0 || eraI > 10
                // eraI !== 16 // 3025
                // eraI !== 42 // 3151
			) {
				continue;
			}
    		curEra = reader.eras[eraI];
    		reservedPoints = [];
    		voronoiSystems = [];

    		for(var i = 0; i < reader.systems.length; i++) {
    			curSys = reader.systems[i];
                curAff = '';
                if(curSys.affiliations[eraI].search(/^D\s*\(/g) >= 0) {
                    curAff = curSys.affiliations[eraI];
                } else {
                    curAff = curSys.affiliations[eraI].split(',')[0].trim();
                }
                if((tmpIdx = curAff.search(/\(\s*H\s*\)/g)) >= 0) {
                    reader.systems[i].hidden = true;
                    curAff = curAff.substr(0,tmpIdx).trim();
                } else {
                    reader.systems[i].hidden = false;
                }
    			reader.systems[i].col = curAff;
                reader.systems[i].capitalLvl = curSys.capitalLvls[eraI];
    			if(curAff === '' || curAff === 'U' || curAff === 'A') {
    		          continue;
    			}
    			if(curSys.status.toLowerCase() === 'apocryphal') {
    				continue;
    			}
    			reservedPoints.push({x: curSys.x, y: curSys.y, col: curAff});
    			voronoiSystems.push({
    				x: curSys.x,
    				y: curSys.y,
    				col : curAff,
    				name : curSys.names[eraI]
    			});
    		}
            pDisc.replaceReservedPoints(reservedPoints);

    		for(var i = 0; i < pDisc.aggregatedPoints.length; i++) {
    			curP = pDisc.aggregatedPoints[i];
    			if(!curP.col) {
                    voronoiSystems.push({
        				x: curP.x,
        				y: curP.y,
        				col: 'DUMMY',
        				name: 'Dummy'
        			});
                }
    		}

    		// generate the voronoi diagram to find borders
    		vBorder = new VoronoiBorder(logger).init(voronoiSystems, VoronoiBorder.CELL_MODES.CIRCUMCENTERS, .5);

    		// clamp the systems and borders to the image's viewBox
    		clampedSystems = Utils.clampObjects(reader.systems, viewRect, 0);
            // for each of the clamped systems, replace its name with the current era's name
            for(var i = 0; i < clampedSystems.length; i++) {
                clampedSystems[i].name = clampedSystems[i].names[eraI];
            }

            //clampedBorders = vBorder.borderEdgeLoops;
    		clampedBorders = vBorder.generateBoundedBorderLoops(viewRect);

    		// initiate and execute the label manager
            labelMgr = new LabelManager(logger).init(
                viewRect,
                clampedSystems,
                systemRadius,
                clampedNebulae,
                labelDist,
                reader.factions,
    			reader.labelConfig
            );

    		// minimap borders
    		minimapBorders = vBorder.generateBoundedBorderLoops(minimapViewRect);

			// add border labels
			borderLabeler = new BorderLabeler(logger).init(
				labelMgr.factions,
                labelMgr.grid,
				viewRect,
				reader.labelConfig._borderGlyphSettings || {},
				1
			);
            borderLabeler.generateLabels(clampedBorders);

    		// create an svg with a universe picture
            writer.writeNeighborhoodSvg(
                focusedSystemArticleName,
                focusedSystemName,
    			dimensions,
    			viewRect,
    			curEra,
    			labelMgr.objects,
    			labelMgr.factions,
    			clampedBorders,
                borderLabeler.polylines,
                labelMgr.ellipticalObjects,
    			{
    				dimensions : minimapDimensions,
    				viewRect : minimapViewRect,
    				borders: minimapBorders,
    				nebulae: minimapNebulae,
                    centerDot : true,
                    rings: [30,60]
    			},
    			[30, 60]
    		);

            // remove object references
            while(reservedPoints.length > 0) {
                reservedPoints[0] = null;
                reservedPoints.shift();
            }
            reservedPoints = null;
            while(voronoiSystems.length > 0) {
                voronoiSystems[0].name = null;
                voronoiSystems[0].col = null;
                voronoiSystems[0] = null;
                voronoiSystems.shift();
            }
            voronoiSystems = null;
    	}

        // remove object references
        while(clampedNebulae.length > 0) {
            clampedNebulae[0].points = null;
            clampedNebulae[0].allPoints = null;
            clampedNebulae[0] = null;
            clampedNebulae.shift();
        }
        clampedNebulae = null;
        while(minimapNebulae.length > 0) {
            minimapNebulae[0].points = null;
            minimapNebulae[0].allPoints = null;
            minimapNebulae[0] = null;
            minimapNebulae.shift();
        }
        minimapNebulae = null;
    }

    // finish by rendering out the logs
    // see reason for commenting this out at the top
    //logRenderer.render();
};

main();
