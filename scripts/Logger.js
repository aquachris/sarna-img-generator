module.exports = (function () {
    'use strict';

    var Logger = function (consoleVerbosity) {
        this.startTime = new Date();
        this.endTime = null;
        this.consoleVerbosity = consoleVerbosity || 0;
        this.flush();
    };

    Logger.ALL = 0;
    Logger.INFO = 1;
    Logger.MESSAGE = 2;
    Logger.WARNING = 3;
    Logger.ERROR = 4;
    Logger.SILENT = 5;

    /**
     * @private
     */
    Logger.prototype.addEntry = function (severity, textParts) {
        this.logs.push({
            idx : this.logIndex,
            severity : severity,
            textParts : textParts
        });
        if(this.consoleVerbosity <= severity) {
            for(var i = 0; i < textParts.length; i++) {
                console.log(textParts[i]);
            }
        }
        this.logIndex++;
    };

    Logger.prototype.info = function () {
        this.addEntry(Logger.INFO, Array.prototype.slice.call(arguments));
    };

    Logger.prototype.log = function () {
        this.addEntry(Logger.MESSAGE, Array.prototype.slice.call(arguments));
    };

    Logger.prototype.warn = function () {
        this.addEntry(Logger.WARNING, Array.prototype.slice.call(arguments));
    };

    Logger.prototype.error = function () {
        this.addEntry(Logger.ERROR, Array.prototype.slice.call(arguments));
    };

    Logger.prototype.flush = function () {
        this.logIndex = 0;
        this.logs = [];
    };

    Logger.prototype.time = function () {
        this.endTime = new Date();
    };

    return Logger;
})();
