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

    var existingPoints = [];
    var voronoiSystems = [];
    var curSys, curAff, curP;
    for(var i = 0; i < reader.systems.length; i++) {
        curSys = reader.systems[i];
        curAff = curSys['3025'].split(',')[0].trim();
        if(curAff === '' || curAff === 'U' || curAff === 'A') {
            continue;
        }
        existingPoints.push([curSys.x, curSys.y]);
        voronoiSystems.push({
            x: curSys.x,
            y: curSys.y,
            col : curAff,
            name : curSys.name
        });
    }

    // generate additional points randomly
    var pDisc = new PoissonDisc().init(-2000, -2000, 4000, 4000, 33, existingPoints, 30);

    for(var i = 0; i < pDisc.generatedPoints.length; i++) {
        curP = pDisc.generatedPoints[i];

        voronoiSystems.push({
            x: curP[0],
            y: curP[1],
            col: 'DUMMY',
            name: 'Dummy'
        })
    }

    // generate the voronoi diagram to find borders
    vBorder = new VoronoiBorder(this.logger).init(voronoiSystems, VoronoiBorder.CELL_MODES.CIRCUMCENTERS);

	// create an svg with a universe picture
    writer.writeUniverseImage(vBorder, reader.systems, reader.factions);

    // finish by rendering out the logs
    logRenderer.render();
};

main();
