module.exports = (function () {
    'use strict';

    var StupidLogger = function () {};

    StupidLogger.prototype.info = function () {
        // silence
    };

    StupidLogger.prototype.log = function () {
        console.log(...arguments);
    };

    StupidLogger.prototype.warn = function () {
        console.warn(...arguments);
    };

    StupidLogger.prototype.error = function () {
        console.warn(...arguments);
    };

    return StupidLogger;

})();
