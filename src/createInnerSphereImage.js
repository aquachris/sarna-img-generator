var fs = require('fs');
var path = require('path');
var Logger = require('./Logger.js');
var LogRenderer = require('./LogRenderer.js');
var SystemsReader = require('./SystemsReader.js');
var PoissonDisc = require('./PoissonDisc.js');
var VoronoiBorder = require('./VoronoiBorder.js');
var BorderLabeler = require('./BorderLabeler.js');
var NebulaRandomizer = require('./NebulaRandomizer.js');
var LabelManager = require('./LabelManager.js');
var Utils = require('./Utils.js');
var SvgWriter = require('./SvgWriter.js');

var createInnerSphereImage = function (year, logLevel = Logger.MESSAGE) {
    console.log(`----------`);
    console.log(`Generating Inner Sphere map(s), selected year: `, year || 'none');
    console.log(`----------`);

    // initialize objects
    var logger = new Logger(logLevel);
    var logRenderer = new LogRenderer(
        logger,
        path.join(__dirname, '..', 'data', 'script_log.html'),
        path.join(__dirname, '..', 'data', 'log.tpl.html')
    );
    var reader = new SystemsReader(logger);
	var writer = new SvgWriter(logger);

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

    // throw error if requested year doesn't exist
    if (year !== undefined && !reader.eras.map((era) => era.year).includes(year)) {
        throw new Error(`Year "${year}" could not be found in the data set. Aborting.`);
    }

	var years = ['3025', '3030', '3052'];
    var reservedPoints;
    var voronoiSystems;
    var filteredSystems;
    var clampedSystems;
    var clampedNebulae;
    var clampedBorders;
	var curYear;
    var curSys, curAff, curBorderAff, curP;
    var systemRadius = 1;
    var labelDist = 0.5;


    // the visible rectangle, in map space:
    var viewRect = {
		x: -650,
		y: -570,
		w: 1450,
		h: 1200
	};
    var dimensions = {
        w: viewRect.w,
        h: viewRect.h
    };
    var minimapViewRect = {
        x: -100,
        y: -100,
        w: 200,
        h: 200
    };

    // generate additional points randomly
    var pDisc = new PoissonDisc().init(-2000, -2000, 4000, 4000, 35, 30);

    // randomize nebulae
    var nebulaeRandomizer = new NebulaRandomizer(logger).init(reader.nebulae);

    var erasToGenerate = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 24, 25, 26, 30, 31, 32, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43];

     // for each era ...
     for(var eraI = 0; eraI < reader.eras.length; eraI++) {
        curEra = reader.eras[eraI];
        if (year !== undefined && curEra.year !== year) {
            continue;
        } else if (year === undefined && !erasToGenerate.includes(eraI)) {
            continue;
        }
        
        reservedPoints = [];
        voronoiSystems = [];

        console.log('starting on ', curEra);

        for(var i = 0; i < reader.systems.length; i++) {
            curSys = reader.systems[i];
            curAff = '';
            const borderAffiliation = curSys.affiliations[eraI].match(/^[AIU]\s*\(([^)]+)\)/);
            if(curSys.affiliations[eraI].search(/^D\s*\(/g) >= 0) {
                curAff = curSys.affiliations[eraI];
            } else if (curSys.affiliations[eraI].match(/^\w+\s*\([^)]+\)/)) {
                curAff = curSys.affiliations[eraI].split('(')[0].trim();
            } else {
                curAff = curSys.affiliations[eraI].split(',')[0].trim();
            }
            if(borderAffiliation && borderAffiliation[1] === 'H') {
                reader.systems[i].hidden = true;
            } else {
                reader.systems[i].hidden = false;
            }
            if (borderAffiliation && borderAffiliation[1] !== 'H') {
                curBorderAff = borderAffiliation[1];
            } else {
                curBorderAff = curAff;
            }
            reader.systems[i].col = curAff;
            reader.systems[i].capitalLvl = curSys.capitalLvls[eraI];
            if(curBorderAff === '' || curBorderAff === 'U' || curBorderAff === 'A' || reader.systems[i].hidden) {
                  continue;
            }
            if(curSys.status.toLowerCase() === 'apocryphal') {
                continue;
            }
            reservedPoints.push({x: curSys.x, y: curSys.y, col: curAff});
            voronoiSystems.push({
                x: curSys.x,
                y: curSys.y,
                col: curBorderAff,
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
        var safeEraName = (curEra.year + '').replace(/[\\\/]/g, '_').replace(/[\:]/g, '').replace(/[a-z]+$/, '');
		var filename = ('Sarna_BT_Inner_Sphere_' + safeEraName + '.svg').replace(/[\+\s\(\)]/g, '_');
		var dir = path.join(__dirname, '..', 'output', 'innersphere');
        const minimapSettings = {};
        const jumpRings = [];
        const docTitle = `BattleTech: The Inner Sphere, Year ${String(curEra.year).replace(/[a-z]+$/, '')} (${Utils.htmlEncode(curEra.name)})`;
		writer.writeSvg({
			renderFactions : true,
			renderBorderLabels : true,
			renderSystems : true,
			renderSystemLabels : true,
			renderClusters : true,
			renderClusterLabels : true,
			renderNebulae : true,
			renderNebulaeLabels : true,
			renderJumpRings : false,
			renderMinimap : false,
			renderHelp : true,
			renderLogo : true,
            displayTitle: docTitle,
            custom: {
                docTitle,
                logoOrigin: {
                    x: -1434,
                    y: -1390.5,
                },
                titlePosition: {
                    x: -621,
                    y: -622,
                },
                noShadows: true,
            }
		}, 'BT', dir, filename, dimensions, viewRect, curEra, labelMgr.objects, labelMgr.factions, clampedBorders, borderLabeler.polylines, labelMgr.ellipticalObjects, {
            tX: -620,
            tY: -612,
            max: 100,
        }, minimapSettings, jumpRings);

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
    while(clampedNebulae && clampedNebulae.length > 0) {
        clampedNebulae[0].points = null;
        clampedNebulae[0].allPoints = null;
        clampedNebulae[0] = null;
        clampedNebulae.shift();
    }
    clampedNebulae = null;
};

module.exports = { createInnerSphereImage };
