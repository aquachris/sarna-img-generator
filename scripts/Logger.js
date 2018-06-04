module.exports = (function () {
    'use strict';

    var Logger = function (consoleVerbosity) {
        this.startTime = new Date();
        this.endTime = null;
        this.consoleVerbosity = consoleVerbosity || 0;
        this.flush();
    };

    Logger.ALL = 0;
    Logger.MESSAGE = 1;
    Logger.WARNING = 2;
    Logger.ERROR = 3;
    Logger.SILENT = 4;

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
