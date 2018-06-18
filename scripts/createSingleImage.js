var fs = require('fs');
var Logger = require('./Logger.js');
var LogRenderer = require('./LogRenderer.js');
var SystemsReader = require('./SystemsReader.js');
var SvgWriter = require('./SvgWriter.js');

var main = function () {
    // initialize objects
    var logger = new Logger();
    var logRenderer = new LogRenderer(logger, './output/logs/script_log.html', '../data/log.tpl.html');
    var reader = new SystemsReader(logger);
	var writer = new SvgWriter(logger);

	// read factions from the xlsx
	reader.readFactions();

    // read planetary systems from the xlsx
    reader.readSystems();

	// create a single svg with all systems
	writer.writeSvgAllSystems(reader.systems);

    // finish by rendering out the logs
    logRenderer.render();
};

main();
