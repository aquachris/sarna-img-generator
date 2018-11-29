var fs = require('fs');
var Logger = require('./Logger.js');
var LogRenderer = require('./LogRenderer.js');
var Utils = require('./Utils.js');
var SystemsReader = require('./SystemsReader.js');
var PoissonDisc = require('./PoissonDisc.js');
var VoronoiBorder = require('./VoronoiBorder.js');
var NebulaRandomizer = require('./NebulaRandomizer.js');
var LabelManager = require('./LabelManager.js');
var SvgWriter = require('./SvgWriter.js');

var main = function () {
    // initialize objects
    var logger = new Logger();
    var logRenderer = new LogRenderer(logger, '../data/script_log.html', '../data/log.tpl.html');
    var reader = new SystemsReader(logger);
	var writer = new SvgWriter(logger);
	var pDisc;
	var nebulaeRandomizer;
	var vBorder;
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

    // read factions from the xlsx
	reader.readFactions();

    // read nebulae from the xlsx
    reader.readNebulae();

    // read planetary systems from the xlsx
    reader.readSystemsAndEras();
	
	// read label settings from the config file
	reader.readLabelConfig();

    // image dimensions in pixels
    var dimensions = {
        w: 1000,
        h: 1000
    };

    // the visible rectangle, in map space:
	var viewRect = {
		x: -2000,
		y: -2000,
		w: 4000,
		h: 4000
	};

    viewRect = {
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

    var focusedSystemName = 'Janina';
	focusedSystemName = 'Desolate Plains';
	//focusedSystemName = 'Ferihegy';
	//focusedSystemName = 'Apollo';
	//focusedSystemName = 'Butler';
	//focusedSystemName = 'Babaeski';
	//focusedSystemName = 'Terra';
	//focusedSystemName = 'Ridgebrook';
	//focusedSystemName = 'New Vandenburg';
	//focusedSystemName = 'Alloway';
	//focusedSystemName = 'Naco';
	//focusedSystemName = 'Rosetta';
	//focusedSystemName = 'Thala';
	focusedSystemName = 'Badlands Cluster';
	focusedSystemName = 'Brocchi\'s Cluster';
	focusedSystemName = 'Chaine Cluster';
	focusedSystemName = 'Enders Cluster';
	focusedSystemName = 'Hyades Cluster';
	focusedSystemName = 'Pleiades Cluster'
	focusedSystemName = 'Spica';
	
    for(var i = 0, len = reader.systems.length; i < len; i++) {
        if(reader.systems[i].name === focusedSystemName) {
            viewRect.x = reader.systems[i].x - viewRect.w * .5;
            viewRect.y = reader.systems[i].y - viewRect.h * .5;
            minimapViewRect.x = reader.systems[i].x - 600;
            minimapViewRect.y = reader.systems[i].y - 300;
            break;
        }
    }

	// generate points randomly scattered in 2D space
    pDisc = new PoissonDisc().init(-2000, -2000, 4000, 4000, 35, 30);

	// randomize and clamp nebulae
    nebulaeRandomizer = new NebulaRandomizer(logger).init(reader.nebulae);
	//clampedNebulae = Utils.clampObjects(nebulaeRandomizer.nebulae, viewRect, 0);
	clampedNebulae = nebulaeRandomizer.generateBoundedNebulae(viewRect);
	minimapNebulae = nebulaeRandomizer.generateBoundedNebulae(minimapViewRect);
	
    // for each era ...
	//for(var eraI = 0; eraI < 1; eraI++) {
	for(var eraI = 16; eraI < 17; eraI++) {
	//for(var eraI = 0; eraI < reader.eras.length; eraI++) {
		curEra = reader.eras[eraI];
		reservedPoints = [];
		voronoiSystems = [];

		for(var i = 0; i < reader.systems.length; i++) {
			curSys = reader.systems[i];
			curAff = curSys.affiliations[eraI].split(',')[0].trim();
			reader.systems[i].col = curAff;
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
				name : curSys.name
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
		clampedBorders = vBorder.generateBoundedBorders(viewRect);

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
		minimapBorders = vBorder.generateBoundedBorders(minimapViewRect);

		// create an svg with a universe picture
        writer.writeSystemNeighborhoodSvg(
            focusedSystemName,
			dimensions,
			viewRect,
			curEra,
			labelMgr.objects,
			labelMgr.factions,
			clampedBorders,
            labelMgr.ellipticalObjects,
			{
				dimensions : minimapDimensions,
				viewRect : minimapViewRect,
				borders: minimapBorders,
				nebulae: minimapNebulae
			}, 
			[30, 60]
		);
	}

    // finish by rendering out the logs
    logRenderer.render();
};

main();
