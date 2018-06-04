module.exports = (function () {

    var fs = require('fs');
    var Logger = require('./Logger.js');

    var LogRenderer = function (logger, outputPath, templatePath) {
        this.logger = logger;
        this.outputPath = outputPath;
        this.templateHTML = '';

        if(templatePath) {
            this.templateHTML = fs.readFileSync(templatePath, {
                encoding: 'utf8'
            });
        }
    };

    LogRenderer.prototype.render = function () {
        var logs = this.logger.logs;
        this.logger.time();

        var classes = {};
        classes[Logger.MESSAGE] = 'msg';
        classes[Logger.WARNING] = 'warn';
        classes[Logger.ERROR] = 'err';

        var html = '';
        // html += '<p>Start time: ' + this.logger.startTime + '</p>\n';
        // html += '<p>End time: ' + this.logger.endTime + '</p>\n';

        html += '<div class="logs">\n';
        for(var i = 0, len = logs.length; i < len; i++) {
            html += '<p class="'+classes[logs[i].severity]+'" data-idx="'+logs[i].idx+'">';
            html += logs[i].textParts.join(' ');
            html += '</p>\n';
        }
        html += '</div>\n';

        if(this.templateHTML) {
            html = this.templateHTML.replace('{LOG_CONTENT}', html);
        }

        fs.writeFile(this.outputPath, html, function(err) {
            if(err) {
                return console.log(err);
            }
            console.log('log file "'+this.outputPath+'" was saved');
        }.bind(this));
        this.logger.flush();
    };

    return LogRenderer;
})();
