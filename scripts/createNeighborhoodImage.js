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
    var labelMgr;
    var reservedPoints;
    var voronoiSystems;
    var clampedSystems;
	var clampedBorders;
    var clampedNebulae;
	var curYear;
    var curSys, curAff, curP;
    var years = [];//['3025', '3030', '3052'];
    var glyphSettings;
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
    for(var i = 0, len = reader.systems.length; i < len; i++) {
        if(reader.systems[i].name === focusedSystemName) {
            viewRect.x = reader.systems[i].x - viewRect.w * .5;
            viewRect.y = reader.systems[i].y - viewRect.h * .5;
            minimapViewRect.x = reader.systems[i].x - 600;
            minimapViewRect.y = reader.systems[i].y - 300;
            break;
        }
    }

    // generate additional points randomly
    var pDisc = new PoissonDisc().init(-2000, -2000, 4000, 4000, 35, 30);

    // prepare label letter settings
    glyphSettings = {
        lineHeight : 2.5,
        widths: {
            '0':1.36474609375, '1':1.36474609375, '2':1.36474609375, '3':1.36474609375, '4':1.36474609375,
            '5':1.36474609375, '6':1.36474609375, '7':1.36474609375, '8':1.36474609375, '9':1.36474609375,
            'A':1.4990234375, 'B':1.473388671875, 'C':1.50146484375, 'D':1.695556640625, 'E':1.402587890625,
            'F':1.3037109375, 'G':1.668701171875, 'H':1.688232421875, 'I':0.9326171875, 'J':1.041259765625,
            'K':1.4697265625, 'L':1.243896484375, 'M':1.92626953125, 'N':1.668701171875, 'O':1.768798828125,
            'P':1.378173828125, 'Q':1.768798828125, 'R':1.551513671875, 'S':1.392822265625, 'T':1.4599609375,
            'U':1.639404296875, 'V':1.49169921875, 'W':2.254638671875, 'X':1.451416015625, 'Y':1.4404296875,
            'Z':1.397705078125,
            'a':1.312255859375, 'b':1.3818359375, 'c':1.153564453125, 'd':1.3818359375, 'e':1.31591796875,
            'f':0.7958984375, 'g':1.3818359375, 'h':1.39404296875, 'i':0.5712890625, 'j':0.704345703125,
            'k':1.2451171875, 'l':0.5712890625, 'm':2.099609375, 'n':1.39404296875, 'o':1.357421875,
            'p':1.3818359375, 'q':1.3818359375, 'r':0.90087890625, 's':1.11572265625, 't':0.836181640625,
            'u':1.39404296875, 'v':1.2451171875, 'w':1.85546875, 'x':1.23779296875, 'y':1.2451171875,
            'z':1.11083984375,
            "'":0.52734375, ' ':0.78125, 'default': 1
        }
    };

    // for each era ...
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

            if(curP.col) {
                //voronoiSystems.push(curP);
            } else {
                voronoiSystems.push({
    				x: curP.x,
    				y: curP.y,
    				col: 'DUMMY',
    				name: 'Dummy'
    			});
            }
		}

        // randomize nebulae
        var nebulaeRandomizer = new NebulaRandomizer(logger).init(reader.nebulae);

		// generate the voronoi diagram to find borders
		var vBorder = new VoronoiBorder(logger).init(voronoiSystems, VoronoiBorder.CELL_MODES.CIRCUMCENTERS, .5);

		// clamp the systems and borders to the image's viewBox
		clampedSystems = Utils.clampObjects(reader.systems, viewRect, 0);
		clampedBorders = vBorder.generateBoundedBorders(viewRect);
        clampedNebulae = Utils.clampObjects(nebulaeRandomizer.nebulae, viewRect, 0);

		// initiate and execute the label manager
        labelMgr = new LabelManager(logger).init(
            viewRect,
            clampedSystems,
            systemRadius,
            clampedNebulae,
            labelDist,
            glyphSettings,
            reader.factions,
			reader.labelConfig
        );

		// minimap borders
		var minimapBorders = vBorder.generateBoundedBorders(minimapViewRect);

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
				borders: minimapBorders
			}, 
			{
				jumpRings: [30, 60]
			}
		);
	}

    // finish by rendering out the logs
    logRenderer.render();
};

main();
