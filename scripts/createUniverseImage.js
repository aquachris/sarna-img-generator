var fs = require('fs');
var Logger = require('./Logger.js');
var LogRenderer = require('./LogRenderer.js');
var SystemsReader = require('./SystemsReader.js');
var PoissonDisc = require('./PoissonDisc.js');
var VoronoiBorder = require('./VoronoiBorder.js');
var SvgWriter = require('./SvgWriter.js');

var main = function () {
    // initialize objects
    var logger = new Logger();
    var logRenderer = new LogRenderer(logger, '../data/script_log.html', '../data/log.tpl.html');
    var reader = new SystemsReader(logger);
	var writer = new SvgWriter(logger);

    // read factions from the xlsx
	reader.readFactions();

    // read planetary systems from the xlsx
    reader.readSystems();

	var years = ['3025', '3030', '3052'];
    var reservedPoints;
    var voronoiSystems;
    var filteredSystems;
	var curYear;
    var curSys, curAff, curP;

    // the visible rectangle, in map space:
	var viewRect = {
		x: -2000,
		y: -2000,
		w: 4000,
		h: 4000
	};
    viewRect = {
        x: -100,
        y: -100,
        w: 200,
        h: 200
    };
    var viewRect2 = {
        x: -50,
        y: -50,
        w: 100,
        h: 100
    };

    // generate additional points randomly
    var pDisc = new PoissonDisc().init(-2000, -2000, 4000, 4000, 35, 30);

	for(var yi = 0; yi < years.length; yi++) {
		curYear = years[yi];
		reservedPoints = [];
		voronoiSystems = [];

		for(var i = 0; i < reader.systems.length; i++) {
			curSys = reader.systems[i];
			curAff = curSys[curYear].split(',')[0].trim();
			if(curAff === '' || curAff === 'U' || curAff === 'A') {
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

		// generate the voronoi diagram to find borders
		vBorder = new VoronoiBorder(this.logger).init(voronoiSystems, VoronoiBorder.CELL_MODES.CIRCUMCENTERS, .5);
        vBorder.generateBoundedBorders(viewRect);
        //vBorder.generateBoundedBorders(viewRect2);
        filteredSystems = vBorder.generateBoundedObjects(viewRect);

		// create an svg with a universe picture
		//writer.writeUniverseImage(curYear, vBorder, reader.systems, reader.factions, viewRect);
        writer.writeUniverseImage(curYear, vBorder, filteredSystems, reader.factions, viewRect);
	}

    // finish by rendering out the logs
    logRenderer.render();
};

main();
