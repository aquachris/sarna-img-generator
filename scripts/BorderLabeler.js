module.exports = (function () {
    'use strict';

    var Utils = require('./Utils.js');

    /**
	 * An instance of this class uses the algorithm outlined in the paper below in
     * order to place labels pairwise on a border line between two state entities.
     *
     * Algorithm paper:
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

    /**
     * @param edges {Array} The edges in the given polyline
     */
    BorderLabeler.prototype.run = function (edges) {
        var lineH = this.glyphSettings.lineHeight;
        var charDefaultWidth = this.glyphSettings.widths.default;
        var labelWidth = 0;
        var wMax = 0;
        var sDistance = 0;
        var pPoints = [];
        var pLineLength = 0;
        var leftFac, rightFac;
        var leftFacLabel = '', rightFacLabel = '';

        // iterate over the edges to assemble all points and calculate the polyline's length
        for(var i = 0, len = edges.length; i < len; i++) {
            if(i === 0) {
                pPoints.push(edges[i].n1);
                leftFac = edges[i].leftCol;
                rightFac = edges[i].rightCol;
            }
            pPoints.push(edges[i].n2);
            pLineLength += edges[i].length;
        }

        var calculateLengths = function (label1, label2) {
            wMax = 0;
            for(var i = 0; i < label1.length; i++) {
                wMax += this.glyphSettings.widths[label1[i]] || charDefaultWidth;
            }
            labelWidth = 0;
            for(var i = 0; i < label2.length; i++) {
                labelWidth += this.glyphSettings.widths[label2[i]] || charDefaultWidth;
            }
            // maximum label length
            wMax = Math.max(wMax, labelWidth);
            // minimum distance between q candidates
            sDistance = 2 * wMax;

            leftFacLabel = label1;
            rightFacLabel = label1;
        };

        if(this.factions.hasOwnProperty(leftFac)) {
            leftFacLabel = this.factions[leftFac].longName;
        }
        if(this.factions.hasOwnProperty(rightFac)) {
            rightFacLabel = this.factions[rightFac].longName;
        }

        calculateLengths(leftFacLabel, rightFacLabel);
        if(pLineLength < 2 * sDistance + wMax) {
            // long labels are too long - try short ones
            calculateLengths(leftFac, rightFac);
            if(pLineLength < 2 * sDistance + wMax) {
                // short labels are too short also - no labeling
                return;
            }
        }

        // find candidate locations along the polyline
        
    };
});
