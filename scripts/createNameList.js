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

    // read planetary systems from the xlsx
    reader.readSystems();

    var names = '';
    var curName;
    for(var i = 0, len = reader.systems.length; i < len; i++) {
        curName = reader.systems[i].name.split(/\s*\(/);
        if(curName.length > 0 && curName[0].length > 0) {
            names += curName[0] + ',';
        }
        if(curName.length > 1 && curName[1].length > 0) {
            curName[1] = curName[1].replace(/[\(\)\+0-9\s]/g, '').replace(/\'s/g, '');
            if(curName[1].match(/[A-Z]\s*[a-z]+/g)) {
                names += curName[1] + ',';
            }
        }
    }
    fs.writeFileSync('./output/systemNames.txt', names);


    // finish by rendering out the logs
    logRenderer.render();
};

main();
