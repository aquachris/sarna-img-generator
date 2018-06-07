var fs = require('fs');
var Logger = require('./Logger.js');
var LogRenderer = require('./LogRenderer.js');
var SystemsReader = require('./SystemsReader.js');
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
	
	// create a single svg with all systems
	//writer.writeSvgAllSystems(systems);
	
	// write svg files for all systems
	for(var i = 0, len = reader.systems.length; i < len; i++) {
		writer.writeSvg(reader.systems, reader.factions, i, '3025');
	}

    // finish by rendering out the logs
    logRenderer.render();
};

main();
