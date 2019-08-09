var Logger = require('../Logger.js');
var SvgWriter = require('../SvgWriter.js');

var logger = new Logger(Logger.ALL);
var writer = new SvgWriter(logger, '..');

writer.writeSvg();