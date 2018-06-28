module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');

	/**
	 * An instance of this class uses a heuristic algorithm
	 * in order to place labels on a canvas with minimal overlap.
	 */
	var LabelManager = function (logger) {
		this.reservedObjects = [];
		this.movableObjects = [];
	};
	
	LabelManager.prototype.constructor = LabelManager;
	
	return LabelManager;
})();