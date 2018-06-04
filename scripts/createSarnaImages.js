var fs = require('fs');
var Logger = require('./Logger.js');
var LogRenderer = require('./LogRenderer.js');
var SystemsReader = require('./SystemsReader.js');

var main = function () {
    // initialize objects
    var logger = new Logger();
    var logRenderer = new LogRenderer(logger, '../data/script_log.html', '../data/log.tpl.html');
    var reader = new SystemsReader(logger);

    // read planetary systems from the xlsx
    reader.readSystems();

    // finish by rendering out the logs
    logRenderer.render();
};

main();
