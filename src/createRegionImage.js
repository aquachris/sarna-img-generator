'use strict';

var fs = require('fs');
var path = require('path');
var Logger = require('./Logger.js');
var LogRenderer = require('./LogRenderer.js');
var Utils = require('./Utils.js');
var SystemsReader = require('./SystemsReader.js');
var PoissonDisc = require('./PoissonDisc.js');
var VoronoiBorder = require('./VoronoiBorder.js');
var BorderLabeler = require('./BorderLabeler.js');
var NebulaRandomizer = require('./NebulaRandomizer.js');
var LabelManager = require('./LabelManager.js');
var SvgWriter = require('./SvgWriter.js');

var createRegionImage = function () {
    // initialize objects
    var logger = new Logger(Logger.MESSAGE);
    var logRenderer = new LogRenderer(logger,
			path.join(__dirname, '../data/script_log.html'),
			path.join(__dirname, '../data/log.tpl.html'));
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
    var regionName;
	var tmpIdx;

    // read factions from the xlsx
	reader.readFactions();

    // read nebulae from the xlsx
    reader.readNebulae();

    // read eras
    reader.readEras();

    // read planetary systems from the xlsx
    reader.readSystems();

	// read label settings from the config file
	reader.readLabelConfig();

/*    // FWL AT FOUNDING
    regionName = 'FWL Founding Region';
    // image dimensions in pixels
    var dimensions = {
        w: 840,
        h: 540
    };

    // the visible rectangle, in map space:
	var viewRect = {
        x: -350,
        y: -290,
        w: 420,
        h: 270
    };

	var minimapDimensions = {
		w: 200,
		h: 150
	};
	var minimapViewRect = {
		x: -400 -140,
		y: -300 -155,
		w: 800,
		h: 600
	};*/

    // ENTIRE KNOWN SPACE
    // regionName = 'Known space';
    // // image dimensions in pixels
    // var dimensions = {
    //     w: 2000,
    //     h: 2000
    // };

    // // the visible rectangle, in map space:
	// var viewRect = {
    //     x: -2000,
    //     y: -2000,
    //     w: 4000,
    //     h: 4000
    // };

	// var minimapDimensions = {
	// 	w: 300,
	// 	h: 300
	// };
	// var minimapViewRect = {
	// 	x: -2000,
	// 	y: -2000,
	// 	w: 4000,
	// 	h: 4000
	// };

	// FWL space
	// regionName = 'FWL space';
	// var dimensions = {
	// 	w: 900,
	// 	h: 900
	// };
	// // the visible rectangle, in map space:
	// var viewRect = {
  //       x: -420,
  //       y: -420,
  //       w: 450,
  //       h: 450
  //   };
	//
	// var minimapDimensions = {
	// 	w: 300,
	// 	h: 300
	// };
	// var minimapViewRect = {
	// 	x: -450,
	// 	y: -450,
	// 	w: 900,
	// 	h: 900
	// };

	// Region around Tukayyid
	regionName = 'Region around Tukayyid';
	var dimensions = {
		w: 200 * 4,
		h: 100 * 4
	};
	// the visible rectangle, in map space:
	var viewRect = {
	      x: -102,
	      y: 155, // 210.420,
	      w: 200,
	      h: 100
	  };

	var minimapDimensions = {
		w: 0,
		h: 0
	};
	var minimapViewRect = {
		x: -450,
		y: -450,
		w: 900,
		h: 900
	};

 // CLAN INVASION CORRIDOR
 /*
    regionName = 'Clan Invasion Corridor';
    // image dimensions in pixels
    var dimensions = {
        w: 2200,
        h: 1680
    };

    // the visible rectangle, in map space:
	var viewRect = {
        x: -240,
        y: 150,
        w: 550,
        h: 420
    };

	var minimapDimensions = {
		w: 220,
		h: 220
	};
	var minimapViewRect = {
		x: -550,
		y: -600,
		w: 1200,
		h: 1200
	};*/

    // size factor
    var sizeFactor = 1;
    dimensions.w *= sizeFactor;
    dimensions.h *= sizeFactor;
    minimapDimensions.w *= sizeFactor;
    minimapDimensions.h *= sizeFactor;

    // generate points randomly scattered in 2D space
    pDisc = new PoissonDisc().init(-2000, -2000, 4000, 4000, 35, 30);

    // randomize nebulae
    nebulaeRandomizer = new NebulaRandomizer(logger).init(reader.nebulae);

    // clamp nebulae to view box
	clampedNebulae = nebulaeRandomizer.generateBoundedNebulae(viewRect);
	minimapNebulae = nebulaeRandomizer.generateBoundedNebulae(minimapViewRect);

    // for each era ...
	for(var eraI = 0; eraI < reader.eras.length; eraI++) {
		if(!(false
            //|| eraI === 0 // 2271 FWL Founding
			//|| eraI === 4 // 2367
            //|| eraI === 15 // 2864
            //|| eraI === 16 // 3025
            // || eraI === 18 // 3040
            // || eraI === 19 // 3050
            //|| eraI === 20 // 3050
            //|| eraI === 21 // 3050
			//|| eraI === 22 // 3050
            //|| eraI === 23 // 3051
            //|| eraI === 24 // 3052
            //|| eraI === 26 // 3058
			|| eraI === 24
		)) {
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
			if(curAff === '' || curAff === 'U' || curAff === 'A' || reader.systems[i].hidden) {
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
        writer.writeRegionSvg(
            'Hotspots/'+regionName,
            regionName,
			dimensions,
			viewRect,
			curEra,
			labelMgr.objects,
			labelMgr.factions,
			clampedBorders,
            borderLabeler.polylines,
            labelMgr.ellipticalObjects,
            {
                max: 100,
                step: 10
            },
            false,
					{
                dimensions : minimapDimensions,
                viewRect : minimapViewRect,
                borders: minimapBorders,
                nebulae: minimapNebulae,
				cutoutRect : true
            },
			null
		);
	}

    // finish by rendering out the logs
    logRenderer.render();
};

module.exports = { createRegionImage };
