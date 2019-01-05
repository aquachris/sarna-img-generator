module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');

    /**
	 * An instance of this class uses the algorithm outlined in the paper below in
     * order to place labels pairwise on a border line between two state entities.
     *
     * Reference paper:
     * http://www.cartographicperspectives.org/index.php/journal/article/view/cp79-rylov-reimer/1374
	 */
	var BorderLabeler = function (logger) {
        this.logger = logger || console;
	};

	BorderLabeler.prototype.constructor = BorderLabeler;

    /**
     * Initializes this object.
     *
     * @returns {Object} this object
     */
    BorderLabeler.prototype.init = function (vBorders, factions, glyphSettings, distanceBetweenLabels) {
        this.vBorders = vBorders;
        this.factions = factions;
        this.glyphSettings = glyphSettings || {};
        this.glyphSettings.lineHeight = this.glyphSettings.lineHeight || 3;
        this.glyphSettings.widths = this.glyphSettings.widths || { default: 1.6 };
        return this;
    };

    //BorderLabeler.prototype.
    /**
     * @param edges {Array} The edges in the given polyline
     */
    BorderLabeler.prototype.run = function (edges, fac1, fac2) {
        var fac1Label = '', fac2Label = '';
        var lineH = this.glyphSettings.lineHeight;
        var charDefaultWidth = this.glyphSettings.widths.default;
        var labelWidth = 0;
        var wMax = 0;

        if(this.factions.hasOwnProperty(fac1)) {
            fac1Label = this.factions[fac1].longName;
        }
        if(this.factions.hasOwnProperty(fac2)) {
            fac2Label = this.factions[fac2].longName;
        }

        for(var i = 0; i < fac1Label.length; i++) {
            wMax += this.glyphSettings.widths[fac1Label[i]] || defaultWidth;
        }
        for(var i = 0; i < fac2Label.length; i++) {
            labelWidth += this.glyphSettings.widths[fac2Label[i]] || defaultWidth;
        }
        wMax = Math.max(wMax, labelWidth);

        // iterate over the edges
        for(var i = 0, len = edges.length; i < len; i++) {
            
        }
    };
});
