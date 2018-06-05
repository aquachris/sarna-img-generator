module.exports = (function () {
	'use strict';
	
	var fs = require('fs');
	
	/**
	 * An instance of this class writes SVG files on demand, using the given 
	 * base map and the desired center coordinates and bounds.
	 */
	var SvgWriter = function (logger) {
		this.parent.call(this);
		this.logger = logger;
	};
	
	SvgWriter.prototype = Object.create(Observable.prototype);
    SvgWriter.prototype.constructor = SvgWriter;
    SvgWriter.prototype.parent = Observable;
	
	SvgWriter.prototype.writeSvg = function () {
		fs.writeFileSync('./output/'+'.svg', data, { encoding: 'utf8'});
	};
	
	return SvgWriter;
	
})();