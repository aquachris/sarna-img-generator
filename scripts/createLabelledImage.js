var fs = require('fs');
var Logger = require('./Logger.js');
var LogRenderer = require('./LogRenderer.js');
var SystemsReader = require('./SystemsReader.js');
var SvgWriter = require('./SvgWriter.js');
var LabelManager = require('./LabelManager.js');
var VoronoiBorder = require('./VoronoiBorder.js');

var main = function () {
    // initialize objects
    var logger = new Logger();
    var logRenderer = new LogRenderer(logger, '../data/script_log.html', '../data/log.tpl.html');
    var reader = new SystemsReader(logger);
	var writer = new SvgWriter(logger);
    var filteredSystems = [];
    var vBorder;

    // read planetary systems from the xlsx
    reader.readSystems();

	var years = ['3025'];
    var filteredSystems;
	var curYear;
    var curSys, curAff, curP;

    // the visible rectangle, in map space:
    viewRect = {
        x: -100,
        y: -100,
        w: 200,
        h: 200
    };

	for(var i = 0; i < reader.systems.length; i++) {
		curSys = reader.systems[i];
		curAff = curSys['3025'].split(',')[0].trim();
		if(curAff === '' || curAff === 'U' || curAff === 'A') {
			continue;
		}
        filteredSystems.push(curSys);
    }

    // generate the voronoi diagram to find borders
	vBorder = new VoronoiBorder(this.logger).init(filteredSystems, VoronoiBorder.CELL_MODES.CIRCUMCENTERS, .5);
    filteredSystems = vBorder.generateBoundedObjects(viewRect);

    var systemRadius = 1;
    var glyphSettings = {
        lineHeight: 3,
        widths : {
            'default': 1.6,
            ' ' : 0.9375, '0': 1.6376953125, '1':1.6376953125, '2':1.6376953125, '3':1.6376953125,
            '4':1.6376953125, '5':1.6376953125, '6':1.6376953125, '7':1.6376953125, '8':1.6376953125,
            '9':1.6376953125, "'":0.6328125,
            'A':1.798828125,'B':1.76806640625,'C':1.8017578125,'D':2.03466796875,'E':1.68310546875,
            'F':1.564453125,'G':2.00244140625,'H':2.02587890625,'I':1.119140625,'J':1.24951171875,
            'K':1.763671875,'L':1.49267578125,'M':2.3115234375,'N':2.00244140625,'O':2.12255859375,
            'P':1.65380859375,'Q':2.12255859375,'R':1.86181640625,'S':1.67138671875,'T':1.751953125,
            'U':1.96728515625,'V':1.7900390625,'W':2.70556640625,'X':1.74169921875,'Y':1.728515625,
            'Z':1.67724609375,
            'a':1.57470703125,'b':1.658203125,'c':1.38427734375,'d':1.658203125,'e':1.5791015625,
            'f':0.955078125,'g':1.658203125,'h':1.6728515625,'i':0.685546875,'j':0.84521484375,
            'k':1.494140625,'l':0.685546875,'m':2.51953125,'n':1.6728515625,'o':1.62890625,
            'p':1.658203125,'q':1.658203125,'r':1.0810546875,'s':1.3388671875,'t':1.00341796875,
            'u':1.6728515625,'v':1.494140625,'w':2.2265625,'x':1.4853515625,'y':1.494140625,
            'z':1.3330078125
        }
    }
    var nodeToTextDistance = .5;

    labelMgr = new LabelManager().init(viewRect, filteredSystems, systemRadius, nodeToTextDistance, glyphSettings);

	// create an svg with a universe picture
	//writer.writeUniverseImage(curYear, vBorder, reader.systems, reader.factions, viewRect);
    writer.writeLabelledImage(labelMgr, viewRect);

    // finish by rendering out the logs
    logRenderer.render();
};

main();
