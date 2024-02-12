module.exports = (function () {
  'use strict';

  var fs = require('fs');
  var path = require('path');
  var Utils = require('./Utils.js');

  /**
   * An instance of this class writes SVG files on demand, using the given
   * base map and the desired center coordinates and bounds.
   */
  var SvgWriter = function (logger, baseDir) {
    this.baseDir = baseDir || __dirname;
    this.logger = logger;
    this.markup = {};
    this.initMarkup();
  };

  SvgWriter.prototype.constructor = SvgWriter;

  /**
   * Resets the generated markup.
   * @private
   */
  SvgWriter.prototype.initMarkup = function () {
    this.markup = {
      defs: '',
      css: '',
      borders: '',
      borderLabels: '',
      jumpRings: '',
      nebulae: '',
      nebulaeLabels: '',
      clusters: '',
      systems: '',
      systemLabels: '',
      minimap: '',
      title: '',
      scaleHelp: '',
      overlays: ''
    };
  };

  /*SvgWriter.prototype.writeSystemNeighborhoodSvg = function (name, dimensions, viewRect, era, systems, factions, borders, nebulae, minimapSettings, jumpRings) {
    var safeEraName = era.name.replace(/[\\\/]/g, '_').replace(/[\:]/g, '');
    var filename = this.baseDir + '/output/'+name.replace(/\s/g, '_')+'_' +era.year + '_' + safeEraName + '.svg';
    this.writeSvg(null, filename, dimensions, viewRect, era, systems, factions, borders, null, nebulae, minimapSettings, jumpRings);
  };*/

  /**
   * Create a system neighborhood SVG file.
   */
  SvgWriter.prototype.writeNeighborhoodSvg = function (
    articleName,
    name,
    dimensions,
    viewRect,
    era,
    systems,
    factions,
    borders,
    borderLabelLines,
    nebulae,
    minimapSettings,
    jumpRings
  ) {
    //var safeEraName = era.year + '_' + era.name.replace(/[\\\/]/g, '_').replace(/[\:]/g, '');
    var safeEraName = (era.year + '').replace(/[\\\/]/g, '_').replace(/[\:]/g, '').replace(/[a-z]+$/, '');
    var dir = path.join(this.baseDir, '..', 'output', 'neighborhood', safeEraName); //.replace(/[\+\s\(\)]/g, '_');
    //var filename = (articleName.replace(/\s/g, '_')+'_' + safeEraName + '.svg').replace(/[\+\s\(\)]/g, '_');
    var filename = (articleName.replace(/\s/g, '_') + '_' + safeEraName + '.svg').replace(/\s+/g, '_');
    var scaleHelpSettings;
    this.writeSvg({
      renderFactions: true,
      renderBorderLabels: true,
      renderSystems: true,
      renderSystemLabels: true,
      renderClusters: true,
      renderClusterLabels: true,
      renderNebulae: true,
      renderNebulaeLabels: true,
      renderJumpRings: true,
      renderMinimap: true,
      renderScaleHelp: true,
      renderLogo: true
    }, name, dir, filename, dimensions, viewRect, era, systems, factions, borders, borderLabelLines, nebulae, scaleHelpSettings, minimapSettings, jumpRings);
  };

  /**
   * Create a region SVG file.
   */
  SvgWriter.prototype.writeRegionSvg = function (dir, name, dimensions, viewRect, era, systems, factions, borders, borderLabelLines, nebulae, scaleHelpSettings, minimapSettings, jumpRings) {
    //var safeEraName = era.year + '_' + era.name.replace(/[\\\/]/g, '_').replace(/[\:]/g, '');
    var safeEraName = (era.year + '').replace(/[\\\/]/g, '_').replace(/[\:]/g, '').replace(/[a-z]+$/, '');
    var filename = (name.replace(/\s/g, '_') + '_' + safeEraName + '.svg').replace(/[\+\s\(\)]/g, '_');
    dir = dir || safeEraName;
    dir = path.join(this.baseDir, 'output', dir); //.replace(/[\+\s\(\)]/g, '_');
    this.writeSvg({
      renderFactions: true,
      renderBorderLabels: true,
      renderSystems: true,
      renderSystemLabels: true,
      renderClusters: true,
      renderClusterLabels: true,
      renderNebulae: true,
      renderNebulaeLabels: true,
      renderJumpRings: false,
      renderMinimap: true,
      renderScaleHelp: true,
      renderLogo: true
    }, name, dir, filename, dimensions, viewRect, era, systems, factions, borders, borderLabelLines, nebulae, scaleHelpSettings, minimapSettings, jumpRings);
  };

  /**
   * Create an SVG file.
   *
   * @param settings {Object} The export settings
   * @param name {String} The focused system's name
   * @param dir {String} The directory to put the file in (will be created if it doesn't exist)
   * @param filename {String} The file name
   * @param dimensions {Object} The image dimensions in pixels {w:<width>, h:<height>}
   * @param viewRect {Object} The viewport rectangle in map space {x: <left x>, y: <bottom y>, w:<width>, h:<height>}
   * @param era {Object} The map era
   * @param systems {Array} Array of all displayed systems
   * @param factions {Object} Key/value map of the displayed factions
   * @param borders {Object} Key/value map of faction borders
   * @param nebulae {Array} Array of all displayed nebulae
   * @param minimapSettings {Object} Settings for an optional minimap (dimensions, viewRect and borders)
   * @param jumpRings {Array} List of jump ring radii
   */
  SvgWriter.prototype.writeSvg = function (
    settings,
    name,
    dir,
    filename,
    dimensions,
    viewRect,
    era,
    systems,
    factions,
    borders,
    borderLabelLines,
    nebulae,
    scaleHelpSettings,
    minimapSettings,
    jumpRings
  ) {
    var tpl = fs.readFileSync(path.join(this.baseDir, '/../data/map_base.svg'), {encoding: 'utf-8'});
    var viewBox;
    var elementsStr;
    var pxPerLy = dimensions.w / viewRect.w;
    var scaleHelpSettings;

    settings = settings || {};
    settings.renderFactions = settings.renderFactions === undefined ? true : settings.renderFactions;
    settings.renderBorderLabels = settings.renderBorderLabels === undefined ? true : settings.renderBorderLabels;
    settings.renderSystems = settings.renderSystems === undefined ? true : settings.renderSystems;
    settings.renderSystemLabels = settings.renderSystemLabels === undefined ? true : settings.renderSystemLabels;
    settings.renderClusters = settings.renderClusters === undefined ? true : settings.renderClusters;
    settings.renderClusterLabels = settings.renderClusterLabels === undefined ? true : settings.renderClusterLabels;
    settings.renderNebulae = settings.renderNebulae === undefined ? true : settings.renderNebulae;
    settings.renderNebulaLabels = settings.renderNebulaLabels === undefined ? true : settings.renderNebulaLabels;
    settings.renderJumpRings = settings.renderJumpRings === undefined ? true : settings.renderJumpRings;
    settings.renderMinimap = settings.renderMinimap === undefined ? true : settings.renderMinimap;
    settings.renderScaleHelp = settings.renderScaleHelp === undefined ? true : settings.renderScaleHelp;
    settings.renderLogo = settings.renderLogo === undefined ? true : settings.renderLogo;
    settings.custom = settings.custom || {};

    // reset markup
    this.initMarkup();

    // generate css rules
    this.generateCSS(pxPerLy);

    // render faction borders and state areas
    this.renderFactions(settings, factions, borders, borderLabelLines || []);

    // render nebulae
    this.renderNebulae(settings, nebulae);

    // render systems and clusters
    this.renderSystemsAndClusters(settings, factions, systems);

    // render jump rings
    this.renderJumpRings(settings, viewRect, jumpRings || []);

    // render the minimap
    this.renderMinimap(settings, minimapSettings, viewRect, pxPerLy, factions, nebulae);

    // render logo
    this.renderLogo(settings, name, era, viewRect, pxPerLy);

    // render title
    this.renderTitle(settings);

    // render scale help
    scaleHelpSettings = scaleHelpSettings || {};
    scaleHelpSettings.max = scaleHelpSettings.max || 50;
    scaleHelpSettings.step = scaleHelpSettings.step || 10;
    this.renderScaleHelp(settings, scaleHelpSettings, viewRect, pxPerLy);

    // concatenate markup
    elementsStr = '';
    elementsStr += this.markup.borders ? `<g class="borders">${this.markup.borders}\n\t</g>\n` : '';
    elementsStr += this.markup.borderLabels ? `\t<g class="border-labels">${this.markup.borderLabels}\n\t</g>\n` : '';
    elementsStr += this.markup.clusters ? `\t<g class="clusters">${this.markup.clusters}\n\t</g>\n` : '';
    elementsStr += this.markup.nebulae ? `\t<g class="nebulae">${this.markup.nebulae}\n\t</g>\n` : '';
    elementsStr += this.markup.nebulaeLabels ? `\t<g class="nebulae-labels">${this.markup.nebulaeLabels}\n\t</g>\n` : '';
    elementsStr += this.markup.jumpRings ? `\t<g class="jump-radius-rings">${this.markup.jumpRings}\n\t</g>\n` : '';
    elementsStr += this.markup.systems ? `\t<g class="systems">${this.markup.systems}\n\t</g>\n` : '';
    elementsStr += this.markup.systemLabels ? `\t<g class="system-labels">${this.markup.systemLabels}\n\t</g>\n` : '';
    elementsStr += this.markup.minimap ? `\t<g class="minimap">${this.markup.minimap}\n\t</g>\n` : '';
    elementsStr += this.markup.title ? `\t<g class="title">${this.markup.title}\n\t</g>` : '';
    elementsStr += this.markup.scaleHelp ? `\t<g class="scale">${this.markup.scaleHelp}\n\t</g>\n` : '';
    elementsStr += this.markup.overlays ? `\t<g class="overlays">${this.markup.overlays}\n\t</g>\n` : '';

    // insert markup into base map template
    tpl = tpl.replace('{WIDTH}', dimensions.w);
    tpl = tpl.replace('{HEIGHT}', dimensions.h);
    // svg viewBox's y is top left, not bottom left
    // viewRect is in map space, viewBox is in svg space
    viewBox = {
      x: viewRect.x,
      y: -viewRect.y - viewRect.h,
      w: viewRect.w,
      h: viewRect.h
    };
    // remove unnecessary newlines and spaces
    //elementsStr = elementsStr.replace(/\n\s+/gi, ' ');
    //this.markup.defs = this.markup.defs.replace(/\n\s+/gi, ' ');

    tpl = tpl.replace('{VIEWBOX}', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
    tpl = tpl.replace('{DEFS}', this.markup.defs);
    tpl = tpl.replace('{CSS}', this.markup.css);
    tpl = tpl.replace('{ELEMENTS}', elementsStr);

    if (settings.custom.docTitle) {
      tpl = tpl.replace('{META_TITLE}', `${settings.custom.docTitle}`);
    } else {
      tpl = tpl.replace('{META_TITLE}', `${name} system and interstellar neighborhood, Year ${era.year} (${Utils.htmlEncode(era.name)})`);
    }
    tpl = tpl.replace('{META_VERSION}', '1.4');
    tpl = tpl.replace('{META_CREATED}', new Date().toISOString());
    // write file
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true});
    }
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, tpl, {encoding: 'utf8'});
    this.logger.log('file "' + filePath + '" written');
  };

  /**
   * @private
   */
  SvgWriter.prototype.generateCSS = function (pxPerLy) {
    var txtShd = 0.14 * pxPerLy + 'px';
    txtShd = '0.35em'
    var txtShdRule = 'text-shadow: ';
    txtShdRule += `#fff ${txtShd} ${txtShd},`;
    txtShdRule += `#fff -${txtShd} ${txtShd},`;
    txtShdRule += `#fff ${txtShd} -${txtShd},`;
    txtShdRule += `#fff -${txtShd} -${txtShd};`;

    // system label text shadow
    //this.markup.css += `text.system-label { ${txtShdRule} }\n`;
    // minimap text shadow
    //this.markup.css += `.minimap-outer text { ${txtShdRule} }\n`;
    // scaling help text shadow
    this.markup.css += `.scale text { ${txtShdRule} }\n`;
  };


  /**
   * @private
   */
  SvgWriter.prototype.renderLogo = function (settings, name, era, viewRect, pxPerLy) {
    var sizeInLy = {
      w: 30,
      h: 48
    };
    //var ratio = sizeInLy.w / sizeInLy.h;
    //var targetHeightInLy = 20;
    //var targetWidthInLy = targetHeightInLy * ratio;
    //var scale = argetHeightInLy / sizeInLy.h;
    var scale = 0.5;
    var padding = {x: 1.5, y: 1.5};
    var origin = {
      x: (viewRect.x + padding.x) / scale,
      y: -(viewRect.y + viewRect.h - padding.y) / scale
      //x: (viewRect.x + viewRect.w - targetWidthInLy - padding.x) / scale,
      //y: -(viewRect.y + viewRect.h - padding.y) / scale
    };
    var logoPaths = '';
    this.markup.css += '\t\tg.logo .ribbon { fill:#ffc103; stroke:#000; stroke-width: 0.5px; stroke-linecap: butt; stroke-linejoin:miter; }\n';
    this.markup.css += '\t\tg.logo .atlas-silhouette { fill: #000; fill-rule:evenodd; stroke: none; }\n';
    this.markup.css += '\t\tg.logo .text { fill: #000; stroke: none; }\n';
    this.markup.css += '\t\tg.logo .atlas-highlights { fill: #ddd; stroke: none; }\n';
    // full-width "ribbon" at the top
    /*logoPaths += `<path class="ribbon"
      d="M0.2,-1.75 h279.5 v20 h-279.5z" />`;
    logoPaths += `<path class="atlas-silhouette" transform="scale(0.6)"
      d="m 18.8957034,3.8675228 c 0.485987,-0.2159542 2.927018,0.093248 2.100977,2.574835 3.059783,-0.6662384 2.098207,3.2355276
      1.392796,2.9308326 -0.42082,0.59414 -0.37125,1.114098 -0.37125,1.114098 2.896862,-0.02462 4.481695,0.891209 4.481695,0.891209
      0.247501,0.693278 4.877556,2.277765 4.877556,2.277765 l -0.02462,0.495347 c -4.184623,-1.683279 -5.051222,-1.732849 -5.051222,-1.732849
      -0.03917,1.485695 -0.432603,2.29163 -1.241314,2.063543 -0.596564,-0.168468 -1.240966,-0.550118 -1.358478,-0.776125 -0.596564,-0.08008
      -1.213236,-0.04958 -1.213236,-0.04958 l -0.1487,-0.396202 h -0.272459 c -0.169493,0.878331 -0.787911,0.725169 -0.787911,0.725169 l
      0.134151,1.331787 -0.140045,0.927952 0.05269,2.258353 -0.12271,0.647867 0.155294,0.758099 0.561556,0.414927 c 0.07557,-0.693624
      0.416314,-0.413886 0.674213,-0.439537 0.460682,0.37125 0.921365,0.791376 1.382049,0.845798 0.238834,0.152521 0.509906,0.298803
      0.659307,0.553582 l 1.573049,0.270033 2.085379,-0.03951 1.660547,0.06245 1.092762,0.121556 0.327958,0.341152 -25.7183745,-0.0246
      0.9436757,-0.714462 2.6095628,-0.381286 1.243741,0.04957 0.690505,-0.336934 0.587206,0.322375 1.470788,-0.28459 c 0.915821,-0.316483
      1.018772,-0.557743 1.190705,-1.711011 0.263099,-0.795537 0.174013,-1.708238 0.175053,-2.591126 0.220811,0.125484 0.234328,-0.720662
      0.233635,-1.059329 -0.0014,-0.574727 0.29187,-1.394527 0.414234,-1.978615 l -0.752901,-0.744233 0.350106,-1.050316 -0.03501,-1.995948
      c 0.517539,-0.396907 0.3307,-0.7938065 -0.07001,-1.1907076 l -0.739943,0.2006187 0.046,3.6805699 0.26318,0.390386 -0.700605,0.518891
      c -0.544521,-0.260944 -1.101653,0.719239 -2.030994,0.533908 -0.405221,-0.327574 -0.232619,-0.654801 -0.339037,-0.982375 0,0
      -0.175054,-0.03501 -0.63019,-0.175052 l 0.315094,-1.015306 0.630191,-2.4510846 c 0.412847,0.2069416 0.274885,-1.0697283 1.470788,-2.1709986
      -0.227742,-2.3349609 0.723089,-2.9765894 1.680853,-3.1863061 0.455136,-0.035693 0.910273,-0.1379625 1.365757,0 0.477667,0.3743699
      0.898834,0.8052419 1.190703,1.3657564 0.240223,-0.068985 0.22185,-0.2235815 0.294298,-0.3036538 0,0 -0.699864,-0.7175431 -0.774738,-0.8184151
      -0.06794,-0.091859 0.03778,-0.04437 0.03778,-0.04437 0.250968,0.2322488 0.830547,0.7684986 0.847533,0.7293292 0.131375,-0.3022685
      0.248193,-1.0454626 0.295682,-1.3834362 l 0.560169,0.07002 0.210062,0.2800851 m -0.907749,11.0569247 c 0.274985,-0.05946 0.530417,-0.09281
      1.265986,-0.08172 l 0.004,2.060614 c -0.398389,0.02317 -0.115148,1.641459 -0.285161,3.08865 l -0.24221,0.921115 c -0.366527,0.09474
      -1.028328,0.160488 -1.593107,-0.212739 l -0.02074,-1.932357 c 0.438843,0.120578 0.182048,-1.894578 0.323336,-2.8259 z"/>`;
    logoPaths += `<path class="atlas-highlights" transform="scale(0.6)"
      d="m 21.0180224,5.3210017 c -0.598366,-0.4533081 -1.04047,-0.2322769 -1.146888,-0.5598528 0,0 -0.06585,-0.7714678 -0.520986,-0.9115164
      l 0.877441,0.1770123 0.539325,0.4263589 z m -0.681749,1.333594 -0.04848,-0.1859189 -0.209115,-0.3840296 0.213879,-0.5660784 0.47089,0.0068
      c 0.105759,0.084859 0.182682,0.1996015 0.250479,0.3057807 l 0.01034,0.1584267 h -0.227167 l -0.03786,-0.2271663 -0.249883,-0.01514
      0.01645,0.5166823 c 0,0 0.493074,0.061496 0.500647,-0.021795 0.0076,-0.083291 -0.01916,0.4518536 -0.01916,0.4518536 z m 1.797976,-0.1830865
      c 0.741886,-0.046038 0.887726,0.8019909 0.995432,1.7072218 -0.168275,0.1840667 -0.357616,0.2522661 -0.60623,-0.00553 0.08099,0.1783359
      0.330662,0.8288908 -0.106012,0.6814988 -0.664335,-0.7061542 -0.366922,-0.2863048 -0.454333,0.03029 -0.257931,0.072747 -0.484237,0.2641596
      -0.48462,0.6966436 l -0.514912,0.01514 c 0.259539,-0.471002 0.534998,-1.0693682 0.757222,-1.2418456 l -0.43919,-0.6814997 -0.07572,1.1812655
      -0.484621,0.03029 c -0.479576,-0.3085817 -0.95915,-0.6785291 -1.438723,-0.5603354 l 0.121158,-0.5906332 c 0.16569,0.2865614 0.466702,0.2988807
      1.075254,0.2633622 0.600804,-0.1551066 0.566025,-0.6930566 0.527567,-1.179108 0.290411,-0.1094495 0.493649,0.086201 0.733207,0.154734
      0.24099,0.1458382 0.232149,0.6058579 0.35968,0.893521 0.502794,-0.4515493 0.246887,-0.9238855 0.03484,-1.3950196 z m -3.578186,0.6774001
      -0.428142,-0.9884872 -1.033748,-0.7889836 c 0,0 -1.067682,-1.2872771 -1.097971,-1.3024212 -0.03029,-0.01514 -0.499767,-0.1438718
      -0.499767,-0.1438718 l 0.310461,0.4543326 0.196879,0.1741609 -0.446761,0.3786111 0.764793,0.06058 0.310461,0.07572 0.31046,0.4846217
      0.03787,0.6966439 -0.454333,0.8253715 0.371038,0.3861822 0.295317,-0.340749 0.10601,-0.8253717 0.772366,0.4846219 0.09844,0.3937552 z
      m -0.520086,-2.8619605 0.595182,0.029329 c -0.0074,-0.080671 0.0077,-0.3759901 0.0077,-0.3759901 l 0.189351,-0.2120203 c -0.211299,-0.1669741
      -0.420436,-0.3577164 -0.651211,-0.3104606 0.123879,0.3384915 0.146806,0.5698616 -0.141022,0.869142 z m 7.804841,7.2990236 5.52687,2.271301
      -0.0069,0.126668 -5.466015,-2.007803 c -0.139101,-0.210794 -0.09114,-0.296883 -0.05398,-0.390166 z"/>`;
    logoPaths += `<text x="22.5" y="6.5" style="font-size: 1.3mm">` +
      `<tspan style="font-weight: bold">${name}</tspan><tspan> system &amp; interstellar neighborhood</tspan>` +
      `</text>`;
    logoPaths += `<text x="22.5" y="12.5" style="font-size: 1.3mm">` +
      `<tspan style="font-weight: bold">Year ${era.year}</tspan><tspan> (${era.name})</tspan>` +
      `</text>`;*/
    // right-side shield ribbon
    //var targetWidthInLy = 20;
    scale = 0.45;
    var targetHeightInLy = sizeInLy.h * scale;
    var origin = settings.custom.logoOrigin || {
      //x: (viewRect.x + viewRect.w - targetWidthInLy - padding.x) / scale,
      //y: -(viewRect.y + viewRect.h - padding.y) / scale
      x: viewRect.x / scale + padding.x,
      y: -(viewRect.y + targetHeightInLy) / scale - padding.y
    };
    logoPaths += `<path class="ribbon"
			d="m 0.5,0 h 28 v 30 l -14,7 -14,-7 z m 0,32.5 14,7 14,-7 v 7 l -14,7 -14,-7 z" />`;
    /*logoPaths += `<path class="atlas-silhouette"
      d="m 14.8957034,4.8675228 c 0.485987,-0.2159542 2.927018,0.093248 2.100977,2.574835 3.059783,-0.6662384 2.098207,3.2355276
        1.392796,2.9308326 -0.42082,0.59414 -0.37125,1.114098 -0.37125,1.114098 2.896862,-0.02462 4.481695,0.891209
        4.481695,0.891209 0.247501,0.693278 4.877556,2.277765 4.877556,2.277765 l -0.02462,0.495347 c -4.184623,-1.683279
        -5.051222,-1.732849 -5.051222,-1.732849 -0.03917,1.485695 -0.432603,2.29163 -1.241314,2.063543 -0.596564,-0.168468
        -1.240966,-0.550118 -1.358478,-0.776125 -0.596564,-0.08008 -1.213236,-0.04958 -1.213236,-0.04958 l -0.1487,-0.396202
        h -0.272459 c -0.169493,0.878331 -0.787911,0.725169 -0.787911,0.725169 l 0.134151,1.331787 -0.140045,0.927952
        0.05269,2.258353 -0.12271,0.647867 0.155294,0.758099 0.561556,0.414927 c 0.07557,-0.693624 0.416314,-0.413886
        0.674213,-0.439537 0.460682,0.37125 0.921365,0.791376 1.382049,0.845798 0.238834,0.152521 0.509906,0.298803
        0.659307,0.553582 l 1.573049,0.270033 2.085379,-0.03951 1.660547,0.06245 1.092762,0.121556 0.327958,0.341152
        -25.7183745,-0.0246 0.9436757,-0.714462 2.6095628,-0.381286 1.243741,0.04957 0.690505,-0.336934 0.587206,0.322375
        1.470788,-0.28459 c 0.915821,-0.316483 1.018772,-0.557743 1.190705,-1.711011 0.263099,-0.795537 0.174013,-1.708238
        0.175053,-2.591126 0.220811,0.125484 0.234328,-0.720662 0.233635,-1.059329 -0.0014,-0.574727 0.29187,-1.394527
        0.414234,-1.978615 l -0.752901,-0.744233 0.350106,-1.050316 -0.03501,-1.995948 c 0.517539,-0.396907 0.3307,-0.7938065
        -0.07001,-1.1907076 l -0.739943,0.2006187 0.046,3.6805699 0.26318,0.390386 -0.700605,0.518891 c -0.544521,-0.260944
        -1.101653,0.719239 -2.030994,0.533908 -0.405221,-0.327574 -0.232619,-0.654801 -0.339037,-0.982375 0,0
        -0.175054,-0.03501 -0.63019,-0.175052 l 0.315094,-1.015306 0.630191,-2.4510846 c 0.412847,0.2069416
        0.274885,-1.0697283 1.470788,-2.1709986 -0.227742,-2.3349609 0.723089,-2.9765894 1.680853,-3.1863061
        0.455136,-0.035693 0.910273,-0.1379625 1.365757,0 0.477667,0.3743699 0.898834,0.8052419 1.190703,1.3657564
        0.240223,-0.068985 0.22185,-0.2235815 0.294298,-0.3036538 0,0 -0.699864,-0.7175431 -0.774738,-0.8184151
        -0.06794,-0.091859 0.03778,-0.04437 0.03778,-0.04437 0.250968,0.2322488 0.830547,0.7684986 0.847533,0.7293292
        0.131375,-0.3022685 0.248193,-1.0454626 0.295682,-1.3834362 l 0.560169,0.07002 0.210062,0.2800851
        m -0.907749,11.0569247 c 0.274985,-0.05946 0.530417,-0.09281 1.265986,-0.08172 l 0.004,2.060614
        c -0.398389,0.02317 -0.115148,1.641459 -0.285161,3.08865 l -0.24221,0.921115 c -0.366527,0.09474 -1.028328,0.160488
        -1.593107,-0.212739 l -0.02074,-1.932357 c 0.438843,0.120578 0.182048,-1.894578 0.323336,-2.8259 z" />`;
    logoPaths += `<path class="atlas-highlights"
      d="m 17.0180224,6.3210017 c -0.598366,-0.4533081 -1.04047,-0.2322769 -1.146888,-0.5598528 0,0 -0.06585,-0.7714678
        -0.520986,-0.9115164 l 0.877441,0.1770123 0.539325,0.4263589 z m -0.681749,1.333594 -0.04848,-0.1859189
        -0.209115,-0.3840296 0.213879,-0.5660784 0.47089,0.0068 c 0.105759,0.084859 0.182682,0.1996015 0.250479,0.3057807
        l 0.01034,0.1584267 h -0.227167 l -0.03786,-0.2271663 -0.249883,-0.01514 0.01645,0.5166823 c 0,0 0.493074,0.061496
        0.500647,-0.021795 0.0076,-0.083291 -0.01916,0.4518536 -0.01916,0.4518536 z m 1.797976,-0.1830865
        c 0.741886,-0.046038 0.887726,0.8019909 0.995432,1.7072218 -0.168275,0.1840667 -0.357616,0.2522661
        -0.60623,-0.00553 0.08099,0.1783359 0.330662,0.8288908 -0.106012,0.6814988 -0.664335,-0.7061542
        -0.366922,-0.2863048 -0.454333,0.03029 -0.257931,0.072747 -0.484237,0.2641596 -0.48462,0.6966436
        l -0.514912,0.01514 c 0.259539,-0.471002 0.534998,-1.0693682 0.757222,-1.2418456 l -0.43919,-0.6814997
        -0.07572,1.1812655 -0.484621,0.03029 c -0.479576,-0.3085817 -0.95915,-0.6785291 -1.438723,-0.5603354
        l 0.121158,-0.5906332 c 0.16569,0.2865614 0.466702,0.2988807 1.075254,0.2633622 0.600804,-0.1551066
        0.566025,-0.6930566 0.527567,-1.179108 0.290411,-0.1094495 0.493649,0.086201 0.733207,0.154734 0.24099,0.1458382
        0.232149,0.6058579 0.35968,0.893521 0.502794,-0.4515493 0.246887,-0.9238855 0.03484,-1.3950196 z
        m -3.578186,0.6774001 -0.428142,-0.9884872 -1.033748,-0.7889836 c 0,0 -1.067682,-1.2872771 -1.097971,-1.3024212
        -0.03029,-0.01514 -0.499767,-0.1438718 -0.499767,-0.1438718 l 0.310461,0.4543326 0.196879,0.1741609
        -0.446761,0.3786111 0.764793,0.06058 0.310461,0.07572 0.31046,0.4846217 0.03787,0.6966439 -0.454333,0.8253715
        0.371038,0.3861822 0.295317,-0.340749 0.10601,-0.8253717 0.772366,0.4846219 0.09844,0.3937552 z
        m -0.520086,-2.8619605 0.595182,0.029329 c -0.0074,-0.080671 0.0077,-0.3759901 0.0077,-0.3759901
        l 0.189351,-0.2120203 c -0.211299,-0.1669741 -0.420436,-0.3577164 -0.651211,-0.3104606 0.123879,0.3384915
        0.146806,0.5698616 -0.141022,0.869142 z m 7.804841,7.2990236 5.52687,2.271301 -0.0069,0.126668 -5.466015,-2.007803
        c -0.139101,-0.210794 -0.09114,-0.296883 -0.05398,-0.390166 z" />`;
    */
    logoPaths += `<path class="atlas-silhouette" ` +
      `d="m14.8957,4.8675c0.486,-0.216 2.9270,0.0932 2.101,2.5748 3.0598,-0.6662 2.0982,3.2355 1.3928,2.9308 -0.4208,0.5941 ` +
      `-0.3713,1.1141 -0.3713,1.1141 2.8969,-0.02462 4.4817,0.8912 4.4817,0.8912 0.2475,0.6933 4.8776,2.2778 4.8776,2.2778` +
      `l-0.0246,0.4953c-4.1846,-1.6833 -5.0512,-1.7328 -5.0512,-1.7328 -0.0392,1.4857 -0.4326,2.2916 -1.2413,2.0635 ` +
      `-0.5966,-0.1685 -1.241,-0.5501 -1.3585,-0.7761 -0.5966,-0.0801 -1.2132,-0.0496 -1.2132,-0.0496l-0.1487,-0.3962` +
      `h-0.2725c-0.1695,0.8783 -0.7879,0.7252 -0.7879,0.7252l0.1342,1.332 -0.1400,0.928 0.0527,2.2584 -0.1227,0.6479 ` +
      `0.1553,0.7581 0.5616,0.4149c0.0756,-0.6936 0.4163,-0.4139 0.6742,-0.4395 0.4607,0.3713 0.9214,0.7914 1.3820,0.8458 ` +
      `0.2388,0.1525 0.5099,0.2988 0.6593,0.5536l1.5730,0.2700 2.0854,-0.0395 1.6605,0.0625 1.0928,0.1216 0.328,0.3412 ` +
      `-25.7184,-0.0246 0.9437,-0.7145 2.6096,-0.3813 1.2437,0.0496 0.6905,-0.3369 0.5872,0.3224 1.4708,-0.2846c0.9158,-0.3165 ` +
      `1.0188,-0.5577 1.1907,-1.711 0.2631,-0.7955 0.1740,-1.7082 0.1751,-2.5911 0.2208,0.1255 0.2343,-0.7207 0.2336,-1.0593 ` +
      `-0.0014,-0.5747 0.2919,-1.3945 0.4142,-1.9786l-0.7529,-0.7442 0.3501,-1.0503 -0.035,-1.9959c0.5175,-0.3969 0.3307,-0.7938 ` +
      `-0.07,-1.1907l-0.7399,0.2006 0.046,3.6806 0.2632,0.3904 -0.7006,0.5189c-0.5445,-0.2609 -1.1017,0.7192 -2.031,0.5339 ` +
      `-0.4052,-0.3276 -0.2326,-0.6548 -0.339,-0.9828 0,0 -0.1751,-0.035 -0.6302,-0.1751 l 0.3151,-1.0153 0.6302,-2.4511` +
      `c0.4128,0.2069 0.2749,-1.0697 1.4708,-2.171 -0.2277,-2.335 0.7231,-2.9766 1.6809,-3.1863 0.4551,-0.0357 0.9103,-0.138 ` +
      `1.3658,0 0.4777,0.3744 0.8988,0.8052 1.1907,1.3658 0.2402,-0.069 0.2219,-0.2236 0.2943,-0.3037 0,0 -0.6999,-0.7175 ` +
      `-0.7747,-0.8184 -0.0679,-0.0919 0.0378,-0.0444 0.0378,-0.0444 0.251,0.2322 0.8305,0.7685 0.8475,0.7293 0.1314,-0.3023 ` +
      `0.2482,-1.0455 0.2957,-1.3834l0.5602,0.07 0.2101,0.2801m-0.9077,11.0569c0.275,-0.0595 0.5304,-0.0928 1.266,-0.0817` +
      `l0.004,2.0606c-0.3984,0.0232 -0.1151,1.6415 -0.2852,3.0887l-0.2422,0.9211c-0.3665,0.0947 -1.0283,0.1605 -1.5931,-0.2127` +
      `l-0.0207,-1.9324c0.4388,0.1206 0.182,-1.8946 0.3233,-2.8259z" />`;
    logoPaths += `<path class="atlas-highlights" ` +
      `d="m17.018,6.321c-0.5984,-0.4533 -1.0405,-0.2323 -1.1469,-0.5598 0,0 -0.0656,-0.7715 -0.521,-0.9115l0.8774,0.177 ` +
      `0.5393,0.4264z m-0.6817,1.3336 -0.0485,-0.1859 -0.2091,-0.384 0.2139,-0.5661 0.4709,0.0068c0.1058,0.0849 0.1827,0.1996 ` +
      `0.2505,0.3058l0.0103,0.1584h-0.2272l-0.0379,-0.2272 -0.2499,-0.0151 0.0165,0.5167c0,0 0.4931,0.0615 0.5006,-0.0218 ` +
      `0.0076,-0.0833 -0.0192,0.4519 -0.0192,0.4519z m1.798,-0.1831c0.7419,-0.046 0.8877,0.802 0.9954,1.707 -0.1683,0.1841 ` +
      `-0.3576,0.2523 -0.6062,-0.0055 0.081,0.1783 0.3307,0.8289 -0.106,0.6815 -0.6643,-0.7062 -0.3669,-0.2863 -0.4543,0.0303 ` +
      `-0.2579,0.0727 -0.4842,0.2642 -0.4846,0.6966l-0.5149,0.0151c0.2595,-0.471 0.535,-1.0694 0.7572,-1.242l-0.4392,-0.6815 ` +
      `-0.0757,1.1813 -0.4846,0.0303c-0.4796,-0.3086 -0.9592,-0.6785 -1.4387,-0.5603l0.1212,-0.5906c0.1657,0.2866 0.4667,0.2989 ` +
      `1.0753,0.2634 0.6008,-0.1551 0.566,-0.6931 0.5276,-1.1791 0.2904,-0.1094 0.4936,0.0862 0.7332,0.1547 0.241,0.1458 ` +
      `0.2321,0.6059 0.3597,0.8935 0.5028,-0.4515 0.2469,-0.9239 0.0348,-1.395z m-3.5782,0.6774 -0.4281,-0.9885 -1.0337,-0.789` +
      `c0,0 -1.0677,-1.2873 -1.098,-1.3024 -0.0303,-0.0151 -0.4998,-0.1439 -0.4998,-0.1439l0.3105,0.4543 0.1969,0.1742 ` +
      `-0.4468,0.3786 0.7648,0.0606 0.3105,0.0757 0.3105,0.4846 0.0379,0.6966 -0.4543,0.8254 0.371,0.3862 0.2953,-0.3407 ` +
      `0.106,-0.8254 0.7724,0.4846 0.0984,0.3938z m-0.5201,-2.862 0.5952,0.0293c-0.0074,-0.0807 0.0077,-0.376 0.0077,-0.376` +
      `l0.1894,-0.212c-0.2113,-0.167 -0.4204,-0.3577 -0.6512,-0.3105 0.1239,0.3385 0.1468,0.5699 -0.141,0.8691z m7.8048,7.299 ` +
      `5.5269,2.2713 -0.0069,0.1267 -5.466,-2.0078c-0.1391,-0.2108 -0.0911,-0.2969 -0.054,-0.3902z" />`;
    logoPaths += `<path class="text"
				d="m 3,24.5 c -0.8544857,0.0068 -1.5216627,0.312179 -1.7294313,1.032922 -0.2631783,1.189068
					0.8961304,1.574093 1.7211285,1.765719 0.9101434,0.188076 1.2439235,0.55857 1.1891379,0.905 -0.2034529,1.018617
					-1.0175079,0.874647 -2.9862211,0.623936 l -0.033826,0.525532 c 2.5992937,0.767602 3.6922952,-0.264949
					3.7159403,-1.053218 0.081979,-0.482383 -0.1012625,-1.211695 -1.7737125,-1.578753 -0.4024607,-0.104316
					-1.1946494,-0.204819 -1.1586944,-0.922527 0.2139824,-1.046465 1.6183391,-0.90156 2.5120419,-0.524917
					l 0.2250966,-0.488941 c -0.5884983,-0.18562 -1.1687682,-0.288859 -1.6814599,-0.284753 z m 5.0625225,0.07165
					c -0.090908,7.87e-4 -0.1808864,0.01113 -0.3084319,0.03289 -0.6987093,1.299073 -1.8954736,3.988593
					-2.2279034,4.843577 l 0.6559171,0.0098 c 0.3431736,-0.610111 0.5484814,-1.179065 0.747247,-1.474508
					0.9499041,0.0091 1.7110858,-0.008 2.2626521,-0.01937 0.2736762,0.621009 0.5630272,1.212333 0.7115762,1.508332
					l 0.721416,-0.0011 c -0.57163,-1.4591 -2.0130914,-4.275964 -2.2478914,-4.87537 -0.1315983,-0.01637
					-0.2236749,-0.02508 -0.3145817,-0.02429 z m 17.0356971,0.0067 c -0.09091,7.88e-4 -0.180886,0.01082
					-0.308432,0.0326 -0.69871,1.299074 -1.895473,3.988593 -2.227903,4.843576 l 0.655918,0.0098 c 0.343172,-0.61011
					0.54848,-1.179062 0.747246,-1.474506 0.949904,0.0091 1.711085,-0.008 2.262651,-0.01937 0.273677,0.621009
					0.563028,1.212641 0.711578,1.508638 l 0.721415,-0.0016 c -0.571629,-1.45898 -2.0134,-4.275537 -2.248199,-4.874941
					-0.131599,-0.01637 -0.223366,-0.02507 -0.314274,-0.0243 z m -13.422159,0.03534 c -0.02395,1.158498
					-0.03509,3.765208 -0.03013,4.845113 l 0.793374,0.0067 c 0.01233,-0.745714 0.0058,-1.379695 0.01445,-1.979435
					0.385605,-0.0073 0.66569,-0.0048 1.142704,0.0037 0.308469,0.571307 1.104051,1.670621 1.302302,1.95668
					l 0.862256,0.0052 c -0.539293,-0.83388 -1.249097,-1.72349 -1.533244,-2.084623 0.525194,-0.274083 1.189343,-0.417369
					1.143935,-1.377947 -0.01016,-1.719655 -1.887108,-1.278459 -3.695645,-1.375489 z m 6.043169,0.01753
					c -0.354508,0.0027 -0.633041,0.013 -0.795217,0.0098 -0.01547,1.26813 -0.0067,3.776161 -0.02122,4.848495
					l 0.666064,-0.0052 c 0.01018,-0.664779 0.0018,-3.609357 0.0067,-3.899829 0.442953,0.535982 2.794327,3.500833
					3.112299,3.906904 0.199126,-0.01516 0.587916,-0.01022 0.860719,-0.0025 l -0.004,-4.80237 c -0.258513,0.01216
					-0.54723,-0.03114 -0.717419,-0.03413 -0.01113,0.717447 -0.01162,3.159454 -0.0044,3.893065 -0.427542,-0.512611
					-2.584711,-3.270071 -3.10369,-3.914281 z m -5.341124,0.493549 h 1.615652 c 1.080128,0.483586 0.759282,1.564862
					-0.124541,1.799545 l -1.504028,-0.02275 z m -4.3109074,0.225893 0.8606543,2.059516 -1.6977573,-0.0018 z
					m 17.0294824,0.01821 0.866869,2.047703 -1.697757,-0.0018 z"
				style="transform: scale(0.95); transform-origin: 15px 25px;" />`;
    logoPaths = logoPaths.replace(/\s\s+/g, ' ');
    // put logo together
    this.markup.overlays += `<g class="logo" transform="scale(${scale}) translate(${origin.x},${origin.y})">${logoPaths}</g>`;
  };


  /**
   ${origin.x} ${origin.y} @private
   */
  SvgWriter.prototype.renderFactions = function (settings, factions, borders, borderLabelLines) {
    var borderLoops, curLoop;
    var borderEdges;
    var curEdge, prevEdge, curD;
    var rgba, hex, tplObj;
    var polygon;
    var factionFillOpacity = .3; // TODO make this configurable

    // make sure there is a faction entry for disputed systems
    if (!factions['D']) {
      factions['D'] = {
        shortName: 'D',
        longName: 'Disputed',
        category: '',
        color: '#ff0000',
        fill: 'transparent',
        founding: 0,
        dissolution: ''
      };
    }

    // change independent systems' primary color to black (from white)
    factions['I'].color = '#000000';

    // iterate over factions and render borders / state areas
    for (var faction in factions) {
      // add borders (if faction borders have been passed)
      borderLoops = borders[faction];
      if (!borderLoops || borderLoops.length === 0) {
        continue;
      }
      // don't paint borders for independent planets
      if (faction === 'I' || faction === 'D') {
        continue;
      }
      rgba = this.hexToRgba(factions[faction].color) || {r: 0, g: 0, b: 0};
      if (!factions[faction].fill) {
        factions[faction].fill = `rgb(${rgba.r},${rgba.g},${rgba.b})`;
      }

      // trace borders one edge at a time
      curD = '';
      for (var i = 0, len = borderLoops.length; i < len; i++) {
        curLoop = borderLoops[i];
        for (var li = 0; li < curLoop.edges.length; li++) {
          curEdge = curLoop.edges[li];
          if (li === 0) { //curEdge.isFirstInLoop) {
            curD += ' M' + curEdge.n1.x.toFixed(2) + ',' + (-curEdge.n1.y).toFixed(2);
          }
          if (curEdge.n1c2 === null || curEdge.n1c2 === undefined ||
            curEdge.n2c1 === null || curEdge.n2c1 === undefined) {
            curD += ' L' + curEdge.n2.x.toFixed(2) + ',' + (-curEdge.n2.y).toFixed(2);
          } else {
            curD += ' C' + curEdge.n1c2.x.toFixed(2) + ',' + (-curEdge.n1c2.y).toFixed(2);
            curD += ' ' + curEdge.n2c1.x.toFixed(2) + ',' + (-curEdge.n2c1.y).toFixed(2);
            curD += ' ' + curEdge.n2.x.toFixed(2) + ',' + (-curEdge.n2.y).toFixed(2);
          }
        }
      }

      if (curD.length === 0) {
        continue;
      }

      // convert a faction area to SVG markup
      tplObj = {
        faction: faction,
        stroke: factions[faction].color,
        fill: factions[faction].fill,
        d: curD
      };
      if (settings.renderFactions) {
        this.markup.borders += `\n\t\t<path fill-rule="evenodd" class="border ${tplObj.faction}" ` +
          `style="stroke: ${tplObj.stroke}; stroke-width: 1px; fill: ${tplObj.fill}; ` +
          `fill-opacity: ${factionFillOpacity};" ` +
          `d="${tplObj.d}" />`;
      }
    }

    if (settings.renderBorderLabels) {
      var curPolyline;
      var curCtrlPoints;
      for (var faction in borderLabelLines) {
        //console.log(faction + ' has ' + borderLabelLines[faction].length + ' polylines');
        for (var pi = 0; pi < borderLabelLines[faction].length; pi++) {
          curPolyline = borderLabelLines[faction][pi];
          // make sure the border labels are visible against the faction background
          rgba = this.hexToRgba(curPolyline.fill) || {r: 0, g: 0, b: 0};
          while (rgba.r + rgba.g + rgba.b >= 500) {
            rgba.r *= .8;
            rgba.g *= .8;
            rgba.b *= .8;
          }
          while (rgba.r + rgba.g >= 420) {
            //rgba.r = rgba.g = rgba.b = 0;
            rgba.r *= .4;
            rgba.g *= .4;
            rgba.b *= .4;
          }
          hex = this.rgbToHex(Math.round(rgba.r), Math.round(rgba.g), Math.round(rgba.b));
          //console.log(curPolyline.id, curPolyline.edges.length);
          curD = '';
          curCtrlPoints = '';

          for (var li = 0; li < curPolyline.labels.length; li++) {
            tplObj = {
              plId: curPolyline.id,
              lId: curPolyline.labels[li].id,
              fill: hex,
              x1: curPolyline.labels[li].bl.x.toFixed(2),
              y1: (-curPolyline.labels[li].bl.y).toFixed(2),
              x2: curPolyline.labels[li].br.x.toFixed(2),
              y2: (-curPolyline.labels[li].br.y).toFixed(2),
              text: curPolyline.labels[li].labelText,
              rating: curPolyline.labels[li].rating.toFixed(3),
              midPos: curPolyline.labels[li].midPos.toFixed(3)
            };
            // add label baseline path to defs
            this.markup.defs += `\n\t\t<path id="label-path-${tplObj.lId}" ` +
              `d="M${tplObj.x1},${tplObj.y1} L${tplObj.x2},${tplObj.y2}" />`;
            // add label text element to borderLabels group
            this.markup.borderLabels += `\n\t\t<text text-anchor="left" ` +
              `data-candidate-rating="${tplObj.rating}" style="fill: ${tplObj.fill};">` +
              `<textPath xlink:href="#label-path-${tplObj.lId}">`;
            for (var ltpi = 0; ltpi < curPolyline.labels[li].labelParts.length; ltpi++) {
              tplObj.text = curPolyline.labels[li].labelParts[ltpi];
              tplObj.dx = (curPolyline.labels[li].dxValues[ltpi]).toFixed(2);
              tplObj.dy = (curPolyline.labels[li].dyValues[ltpi]).toFixed(2);
              this.markup.borderLabels += `<tspan x="${tplObj.dx}" dy="${tplObj.dy}">${tplObj.text}</tspan>`;
            }
            this.markup.borderLabels += `</textPath></text>`;
          }
        }
      }
    }
  };

  /**
   * Renders nebula objects.
   * @private
   */
  SvgWriter.prototype.renderNebulae = function (settings, nebulae) {
    var tplObj, curD;
    var prevPoint, curPoint;

    for (var i = 0, len = nebulae.length; i < len; i++) {

      if (settings.renderNebulae) {
        // nebula ellipse / polygon
        tplObj = {
          name: nebulae[i].name,
          x: nebulae[i].centerX.toFixed(3),
          y: (-nebulae[i].centerY).toFixed(3),
          rx: nebulae[i].w * .5,
          ry: nebulae[i].h * .5
        };
        /*els.nebulae += `<ellipse data-name="${tplObj.name}"
              cx="${tplObj.x}" cy="${tplObj.y}" rx="${tplObj.rx}" ry="${tplObj.ry}" />\n`;*/

        curD = '';
        //console.log(nebulae[i].allPoints);
        for (var j = 0, jlen = nebulae[i].points.length; j <= jlen; j++) {
          curPoint = nebulae[i].points[j % jlen];
          (j > 0) && (prevPoint = nebulae[i].points[j - 1]);
          if (j === 0) {
            curD += 'M' + curPoint.x.toFixed(2) + ',' + (-curPoint.y).toFixed(2);
          } else if (!prevPoint.c2 || !curPoint.c1) {
            curD += ' L' + curPoint.x.toFixed(2) + ',' + (-curPoint.y).toFixed(2);

          } else {
            prevPoint = nebulae[i].points[j - 1];
            curD += ' C' + prevPoint.c2.x.toFixed(2) + ',' + (-prevPoint.c2.y).toFixed(2);
            curD += ' ' + curPoint.c1.x.toFixed(2) + ',' + (-curPoint.c1.y).toFixed(2);
            curD += ' ' + curPoint.x.toFixed(2) + ',' + (-curPoint.y).toFixed(2);
          }
        }

        this.markup.nebulae += `<path fill-rule="evenodd" class="nebula"
							data-name="${tplObj.name}"
							d="${curD}" />\n`;
      }

      // nebula label
      if (settings.renderNebulaLabels) {
        if (!nebulae[i].label.isAngledLabel) {
          tplObj = {
            x: nebulae[i].label.x.toFixed(3),
            y: (-nebulae[i].label.y).toFixed(3),
            name: nebulae[i].name,
            cls: 'nebulae-label'
          };
          this.markup.nebulaeLabels += `<text x="${tplObj.x}" y="${tplObj.y}" class="${tplObj.cls}">
						${tplObj.name}</text>\n`;
        } else {
          /*tplObj = {
            x: nebulae[i].label.pcx.toFixed(3),
            y: (-nebulae[i].label.pcy).toFixed(3),
            name: nebulae[i].name,
            cls : 'nebulae-label large'
          };
          tplObj.angle = Math.round(nebulae[i].label.angle); //-90;
          this.markup.nebulaeLabels += `<g style="transform:translate(${tplObj.x}px, ${tplObj.y}px)">
            <text style="transform:rotate(${tplObj.angle}deg)" class="${tplObj.cls}" text-anchor="middle" alignment-baseline="middle">
            ${tplObj.name}</text></g>`;*/

          tplObj = {
            x: -nebulae[i].label.w * .5,
            y: -nebulae[i].label.h * .5,
            txtY: nebulae[i].label.h * .5,
            //txtY : -nebulae[i].label.h * .5,
            w: nebulae[i].label.w.toFixed(2),
            h: nebulae[i].label.h.toFixed(2),
            tx: nebulae[i].label.pcx.toFixed(3),
            ty: (-nebulae[i].label.pcy).toFixed(3),
            m: Utils.matrix2dRotate([1, 0, 0, 1], Utils.degToRad(-nebulae[i].label.angle)),
            name: nebulae[i].name,
            cls: 'nebulae-label'
          };
          if (nebulae[i].label.isLarge) {
            tplObj.cls += ' large';
          }
          /*this.markup.nebulaeLabels += `<rect x="${tplObj.x}" y="${tplObj.y}"
            width="${tplObj.w}" height="${tplObj.h}"
            style="transform: matrix(${tplObj.m[0]},${tplObj.m[2]},${tplObj.m[1]},${tplObj.m[3]},${tplObj.tx},${tplObj.ty});  fill: #a00a"></rect>;*/
          this.markup.nebulaeLabels += `<text x="${tplObj.x}" y="${tplObj.txtY}"
						style="transform: matrix(${tplObj.m[0]},${tplObj.m[2]},${tplObj.m[1]},${tplObj.m[3]},${tplObj.tx},${tplObj.ty});"
						class="${tplObj.cls}">${tplObj.name}</text>`;
        }
        /*tplObj = {
          x : nebulae[i].label.x.toFixed(3),
          y : (-nebulae[i].label.y).toFixed(3),
          name : nebulae[i].name,
          vcx : nebulae[i].label.vcx.toFixed(3),
          vcy : (-nebulae[i].label.vcy).toFixed(3),
          pcx : nebulae[i].label.pcx.toFixed(3),
          pcy : (-nebulae[i].label.pcy).toFixed(3)
        };*/
        /*this.markup.nebulaeLabels += `<line x1="${tplObj.vcx}" y1="${tplObj.vcy}"
          x2="${tplObj.pcx}" y2="${tplObj.pcy}"
          style="stroke-width: .25px; stroke: #f00;" />`;*/

        //tplObj.angle = -90;//nebulae[i].label.l.angle;

        /*tplObj.x6 = nebulae[i].label.l.x6.toFixed(3);
        tplObj.y6 = (-nebulae[i].label.l.y6).toFixed(3);*/
        //this.markup.nebulaeLabels += `<circle cx="${tplObj.x6}" cy="${tplObj.y6}" r=".5" style="fill:red" />`;
      }
    }
  };

  /**
   * Renders systems and cluster objects.
   * @private
   */
  SvgWriter.prototype.renderSystemsAndClusters = function (settings, factions, systems) {
    var tplObj;
    var fill, rgba;
    var labelCls;
    var curD;
    var dispRegEx = /D\s*\(([^\)]+)\)/g; // regex for disputed system notation: "D(CC,FS)"
    var dispReResult, dispColArr, dispCls;
    var defsMap = {};
    const filter = settings.custom.noShadows ? '' : 'filter="url(#sLblShd)"';

    for (var i = 0, len = systems.length; i < len; i++) {
      if (systems[i].col === 'DUMMY') {
        continue;
      }
      fill = '#aaaaaa';
      if (factions.hasOwnProperty(systems[i].col)) {
        fill = factions[systems[i].col].color;
      }
      labelCls = '';
      dispCls = '';
      if (systems[i].col === '' || systems[i].col === 'U') {
        systems[i].col = 'U';
        fill = '#aaaaaa';
        labelCls = 'undiscovered';
      } else if (systems[i].col === 'A') {
        fill = '#000000';
        labelCls = 'abandoned';
      } else if (systems[i].col === 'I') {
        fill = '#ffffff';
        labelCls = 'independent';
      } else if (dispReResult = dispRegEx.exec(systems[i].col)) {
        dispCls = 'disputed';
        dispColArr = dispReResult[1].trim().split(/\s*,\s*/g);
        for (var di = 0; di < dispColArr.length; di++) {
          dispCls += '-' + dispColArr[di];
        }
        // generate css class and svg pattern for this disputed state
        defsMap[dispCls] = {
          css: this.createDisputedCssRule(dispCls),
          pattern: this.createDisputedPattern(dispCls, factions)
        }

      }
      // reset the regex
      dispRegEx.lastIndex = 0;

      if (systems[i].isCluster) {
        // cluster ellipse
        // Microsoft browsers do not support the hexadecimal rgba notation (#000000ff)
        // use rgba(r, g, b, a) syntax instead
        rgba = this.hexToRgba(fill + '44');
        tplObj = {
          faction: systems[i].col,
          additionalClasses: dispCls,
          name: systems[i].name,
          x: systems[i].centerX.toFixed(3),
          y: (-systems[i].centerY).toFixed(3),
          radiusX: systems[i].radiusX,
          radiusY: systems[i].radiusY,
          angle: systems[i].rotation,
          stroke: fill,
          fill: `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})`
        };
        if (systems[i].status.toLowerCase() === 'apocryphal') {
          tplObj.additionalClasses += 'apocryphal';
        }
        if (settings.renderClusters) {
          this.markup.clusters += `\n\t\t<ellipse class="cluster ${tplObj.faction} ${tplObj.additionalClasses}" ` +
            `data-name="${tplObj.name}" ` +
            `cx="${tplObj.x}" cy="${tplObj.y}" rx="${tplObj.radiusX}" ry="${tplObj.radiusY}" ` +
            `transform="rotate(${tplObj.angle}, ${tplObj.x}, ${tplObj.y})" ` +
            `style="fill: ${tplObj.fill};"  />`;
        }

        if (settings.renderClusterLabels) {
          // connector
          if (systems[i].label.connector) {
            curD = 'M' + systems[i].label.connector.p1.x.toFixed(2);
            curD += ',' + (-systems[i].label.connector.p1.y).toFixed(2);
            curD += ' L' + systems[i].label.connector.p2.x.toFixed(2);
            curD += ',' + (-systems[i].label.connector.p2.y).toFixed(2);
            curD += ' L' + systems[i].label.connector.p3.x.toFixed(2);
            curD += ',' + (-systems[i].label.connector.p3.y).toFixed(2);
            this.markup.clusters += `\n\t\t<path d="${curD}" class="label-connector" />`;
          }

          tplObj = {
            x: systems[i].label.x.toFixed(3),
            y: (-systems[i].label.y).toFixed(3),
            labelClass: labelCls,
            name: systems[i].name,
            sup: ''
          };
          if ((systems[i].status || '').toLowerCase() === 'apocryphal') {
            tplObj.labelClass += ' apocryphal';
            tplObj.sup = '<tspan class="sup" dx="0.5" dy="1">(apocryphal)</tspan>';
          }
          this.markup.systemLabels += `\n\t\t<text x="${tplObj.x}" y="${tplObj.y}" ` +
            `${filter} ` +
            `class="system-label ${tplObj.labelClass}">` +
            `${tplObj.name}${tplObj.sup}</text>`;
        }

      } else {
        // system circle
        tplObj = {
          faction: systems[i].col,
          additionalClasses: dispCls,
          name: systems[i].name,
          x: systems[i].centerX.toFixed(3),
          y: (-systems[i].centerY).toFixed(3),
          r: systems[i].radiusX,
          fill: fill
        };
        if (systems[i].status.toLowerCase() === 'apocryphal') {
          tplObj.additionalClasses += 'apocryphal';
        }
        switch (systems[i].capitalLvl) {
          case 1:
            tplObj.additionalClasses += ' faction-capital';
            break;
          case 2:
            tplObj.additionalClasses += ' major-capital';
            break;
          case 3:
            tplObj.additionalClasses += ' minor-capital';
            break;
        }
        tplObj.additionalClasses = tplObj.additionalClasses.trim();
        if (settings.renderSystems) {
          if (systems[i].capitalLvl > 0 && systems[i].capitalLvl <= 2) {
            this.markup.systems += `\n\t\t<circle class="system-decoration ${(tplObj.faction + ' ' + tplObj.additionalClasses).trim()}" ` +
              `data-name="${tplObj.name}" ` +
              `cx="${tplObj.x}" cy="${tplObj.y}" r="${tplObj.r * 1.5}" />`;
            if (systems[i].capitalLvl === 1) {
              this.markup.systems += `\n\t\t<circle class="system-decoration ${(tplObj.faction + ' ' + tplObj.additionalClasses).trim()}" ` +
                `data-name="${tplObj.name}" ` +
                `cx="${tplObj.x}" cy="${tplObj.y}" r="${tplObj.r * 2}" />`;
            }
          }
          this.markup.systems += `\n\t\t<circle class="system ${tplObj.faction} ${tplObj.additionalClasses.trim()}" ` +
            `data-name="${tplObj.name}" ` +
            `cx="${tplObj.x}" cy="${tplObj.y}" r="${tplObj.r}" ` +
            `style="fill: ${tplObj.fill}" />`;
          if (systems[i].capitalLvl > 0) {
            this.markup.systems += `\n\t\t<circle class="system-decoration ${(tplObj.faction + ' ' + tplObj.additionalClasses).trim()}" ` +
              `data-name="${tplObj.name}" ` +
              `cx="${tplObj.x}" cy="${tplObj.y}" r="${tplObj.r * .15}" />`;
          }
        }

        if (settings.renderSystemLabels) {
          var labelDelta = {x: 0, y: 0.5};
          var minorLabelDelta = {x: .15, y: 0};
          var baseline = systems[i].label.y + systems[i].label.h - systems[i].label.lineHeight;
          //if(systems[i].label.additions.length > 0) {
          baseline += labelDelta.y;
          //}
          // system label
          tplObj = {
            x: systems[i].label.x.toFixed(3),
            y: (-baseline).toFixed(3),
            labelClass: labelCls,
            name: systems[i].label.name
          };
          /*if((systems[i].status || '').toLowerCase() === 'apocryphal') {
            tplObj.labelClass += ' apocryphal';
            tplObj.sup = '<tspan class="sup" dx="0.5" dy="-1">(apocryphal)</tspan>';
          }*/
          this.markup.systemLabels += `\n\t\t<text x="${tplObj.x}" y="${tplObj.y}" ` +
            `class="system-label ${tplObj.labelClass}" ` +
            `${filter}>` +
            `${tplObj.name}</text>`;
          /*this.markup.systemLabels += `<rect x="${tplObj.x}" y="${-systems[i].label.y - systems[i].label.h}"
                     width="${systems[i].label.w}" height="${systems[i].label.h}"
                    style="fill: none; stroke: #f00; stroke-width: .25" />`*/
          // label additions (capital, hidden, apocryphal)
          const additions = (systems[i].label.additions || []).filter(addition => !!addition.text);
          if (additions.length > 0) {
            tplObj.x = (systems[i].label.x + minorLabelDelta.x).toFixed(3);
            tplObj.y = (-systems[i].label.y + minorLabelDelta.y).toFixed(3); // TODO
            this.markup.systemLabels += `\n\t\t<text x="${tplObj.x}" y="${tplObj.y}" ` +
              `${filter} ` +
              `class="system-label additions ${tplObj.labelClass}">`;
            for (let lai = 0; lai < additions.length; lai++) {
              tplObj.y = (-baseline + (lai + 1) * (1.5) + minorLabelDelta.y).toFixed(3); // TODO
              tplObj.aTxt = additions[lai].text;
              tplObj.aCls = additions[lai].class;
              this.markup.systemLabels += `<tspan x="${tplObj.x}" y="${tplObj.y}" class="${tplObj.aCls}">${tplObj.aTxt}</tspan>`;
            }
            this.markup.systemLabels += `</text>`;
          }
        }
      }
    }
    // add the defs that were created along the way
    for (var dispKey in defsMap) {
      if (!defsMap.hasOwnProperty(dispKey)) {
        continue;
      }
      this.markup.css += defsMap[dispKey].css;
      this.markup.defs += defsMap[dispKey].pattern;
    }
  };

  /**
   * Renders the minimap.
   * @private
   */
  SvgWriter.prototype.renderMinimap = function (settings, minimapSettings, viewRect, pxPerLy, factions) {
    var pxPerLyMinimap, minimapScale, minimapMargin;
    var tplObj;
    var borderEdgeLoops, borderEdges, prevEdge, curEdge;
    var rgba;
    var curD, curPoint, prevPoint;
    var focusedCoords;
    var nebulae;
    var factionFillOpacity = .3; // TODO make this configurable

    if (!settings.renderMinimap || !minimapSettings) {
      return;
    }

    pxPerLyMinimap = minimapSettings.dimensions.w / minimapSettings.viewRect.w;

    // add clip path for minimap content
    tplObj = {
      x: minimapSettings.viewRect.x,
      y: -minimapSettings.viewRect.y - minimapSettings.viewRect.h,
      w: minimapSettings.viewRect.w,
      h: minimapSettings.viewRect.h
    };
    this.markup.defs += `<clipPath id="minimapClip">
			<rect x="${tplObj.x}" y="${tplObj.y}"
					width="${tplObj.w}" height="${tplObj.h}" />
			</clipPath>\n`;

    // paint minimap
    minimapScale = pxPerLyMinimap / pxPerLy;
    minimapMargin = 10 / pxPerLy;

    tplObj = {
      x: viewRect.x + viewRect.w - minimapSettings.viewRect.w * minimapScale - minimapMargin,
      y: -viewRect.y - minimapSettings.viewRect.h * minimapScale - minimapMargin
    }
    this.markup.minimap = `<g class="minimap-outer" transform="translate(${tplObj.x}, ${tplObj.y}) scale(${minimapScale})">\n`;
    this.markup.minimap += `<rect x="0" y="0"
				width="${minimapSettings.viewRect.w}" height="${minimapSettings.viewRect.h}"
				style="fill: #fff" />\n`;

    tplObj = {
      tX: -minimapSettings.viewRect.x,
      tY: minimapSettings.viewRect.y + minimapSettings.viewRect.h
    };
    this.markup.minimap += `<g class="minimap-inner" clip-path="url(#minimapClip)"
								transform="translate(${tplObj.tX}, ${tplObj.tY})">\n`;

    // iterate over factions and add state areas
    for (var faction in factions) {
      borderEdgeLoops = minimapSettings.borders[faction];
      if (!borderEdgeLoops || borderEdgeLoops.length === 0) {
        continue;
      }
      // don't paint borders for independent planets
      if (faction === 'I' || faction === 'D') {
        continue;
      }
      rgba = this.hexToRgba(factions[faction].color) || {r: 0, g: 0, b: 0};
      if (!factions[faction].fill) {
        factions[faction].fill = `rgb(${rgba.r},${rgba.g},${rgba.b})`;
      }

      curD = '';
      for (var i = 0, len = borderEdgeLoops.length; i < len; i++) {
        for (var j = 0; j < borderEdgeLoops[i].edges.length; j++) {
          prevEdge = curEdge;
          curEdge = borderEdgeLoops[i].edges[j];
          if (j === 0) {
            curD += ' M' + curEdge.n1.x.toFixed(2) + ',' + (-curEdge.n1.y).toFixed(2);
          }
          curD += ' L' + curEdge.n2.x.toFixed(2) + ',' + (-curEdge.n2.y).toFixed(2);
        }
      }
      if (curD.length === 0) {
        continue;
      }
      tplObj = {
        stroke: factions[faction].color,
        fill: factions[faction].fill
      };
      this.markup.minimap += `<path fill-rule="evenodd" class="border ${faction}"
					style="stroke: ${tplObj.stroke}; stroke-width:2px; fill:${tplObj.fill};
					fill-opacity: ${factionFillOpacity}"
					d="${curD}" />\n`;
    }

    // iterate over nebulae
    nebulae = minimapSettings.nebulae || [];
    for (var i = 0, len = nebulae.length; i < len; i++) {
      // nebula ellipse / polygon
      tplObj = {
        name: nebulae[i].name,
        x: nebulae[i].centerX.toFixed(3),
        y: (-nebulae[i].centerY).toFixed(3),
        rx: nebulae[i].w * .5,
        ry: nebulae[i].h * .5
      };

      curD = '';
      for (var j = 0, jlen = nebulae[i].allPoints.length; j <= jlen; j++) {
        curPoint = nebulae[i].allPoints[j % jlen];
        prevPoint = nebulae[i].allPoints[(jlen + j - 1) % jlen];
        if (j === 0) {
          curD += 'M' + curPoint.x.toFixed(1) + ',' + (-curPoint.y).toFixed(1);
        } else if (true) {
          curD += ' C' + prevPoint.c2.x.toFixed(1) + ',' + (-prevPoint.c2.y).toFixed(1);
          curD += ' ' + curPoint.c1.x.toFixed(1) + ',' + (-curPoint.c1.y).toFixed(1);
          curD += ' ' + curPoint.x.toFixed(1) + ',' + (-curPoint.y).toFixed(1);
        } else {
          curD += ' L' + curPoint.x.toFixed(1) + ',' + (-curPoint.y).toFixed(1);
        }
      }

      this.markup.minimap += `<path fill-rule="evenodd" class="nebula"
						data-name="${tplObj.name}"
						d="${curD}" />\n`;
    }

    // focused system position
    tplObj = {
      x: (minimapSettings.viewRect.x + minimapSettings.viewRect.w * .5).toFixed(1),
      y: (-minimapSettings.viewRect.y - minimapSettings.viewRect.h * .5).toFixed(1)
    };
    if (minimapSettings.centerDot) {
      this.markup.minimap += `<circle cx="${tplObj.x}" cy="${tplObj.y}" r="3"
									style="fill: #a00" />\n`;
      /*curD = `M${tplObj.x - 27},${tplObj.y} l20,0 `;
      curD += `m14,0 l20,0 `;
      curD += `M${tplObj.x},${tplObj.y - 27} l0,20 `;
      curD += `m0,14 l0,20 `;
      this.markup.minimap += `<path d="${curD}" style="stroke: #111; stroke-width: 3; fill: none;" />\n`*/
    }
    if (minimapSettings.rings) {
      for (var ri = 0; ri < minimapSettings.rings.length; ri++) {
        this.markup.minimap += `<circle cx="${tplObj.x}" cy="${tplObj.y}" r="${minimapSettings.rings[ri]}"
										style="fill: none; stroke: #333; stroke-width: 2" />\n`;
      }
    }

    // map cutout rectangle
    if (minimapSettings.cutoutRect) {
      tplObj = {
        x: viewRect.x,
        y: -viewRect.y - viewRect.h,
        w: viewRect.w,
        h: viewRect.h
      };
      this.markup.minimap += `<rect x="${tplObj.x}" y="${tplObj.y}" width="${tplObj.w}" height="${tplObj.h}"
								style="fill: none; stroke: #fff; stroke-width: 10;" />\n`;
      this.markup.minimap += `<rect x="${tplObj.x}" y="${tplObj.y}" width="${tplObj.w}" height="${tplObj.h}"
								style="fill: none; stroke: #a00; stroke-width: 3;" />\n`;
    }

    // Terra indicator
    focusedCoords = [viewRect.x + viewRect.w * .5, -viewRect.y - viewRect.h * .5];
    if (Utils.pointInRectangle({x: 0, y: 0}, minimapSettings.viewRect)) {
      /*this.markup.minimap += '<circle cx="0" cy="0" r="8" style="fill: transparent; stroke: #fff; stroke-width: 8;" />'
      this.markup.minimap += '<circle cx="0" cy="0" r="20" style="fill: transparent; stroke: #fff; stroke-width: 8;" />'
      this.markup.minimap += '<circle cx="0" cy="0" r="8" style="fill: transparent; stroke: #000; stroke-width: 3;" />'
      this.markup.minimap += '<circle cx="0" cy="0" r="20" style="fill: transparent; stroke: #000; stroke-width: 3;" />'*/
      //els.minimap += '<circle cx="0" cy="0" r="32" style="fill: transparent; stroke: #000; stroke-width: 3;" />'
    } else {
      // line to origin
      /*var lineToOrigin = Utils.lineFromPoints(focusedCoords, [0,0]);
      var distToOrigin = Utils.distance(focusedCoords[0], focusedCoords[1], 0, 0);*/

      /*var p1, p2;
      var rTop = -minimapSettings.viewRect.y - minimapSettings.viewRect.h;
      var rRight = minimapSettings.viewRect.x + minimapSettings.viewRect.w;
      var rBottom = -minimapSettings.viewRect.y;
      var rLeft = minimapSettings.viewRect.x;*/

      // closest perimeter point from origin
      var periPoint = Utils.getClosestPointOnRectanglePerimeter({x: 0, y: 0}, minimapSettings.viewRect);
      var pPointDist = Utils.distance(periPoint.x, periPoint.y, 0, 0);

      var angle = Utils.angleBetweenVectors([1, 0], [periPoint.x, periPoint.y]);
      // differentiate whether the focused point lies below the y = 0 line to get the true 360° angle
      if (periPoint.y > 0) {
        angle = Math.PI * 2 - angle;
      }

      // arrow towards origin
      tplObj = {
        tX: periPoint.x.toFixed(2),
        tY: (-periPoint.y).toFixed(2),
        rot: Utils.radToDeg(angle).toFixed(2)
      };
      this.markup.minimap += `<g transform="translate(${tplObj.tX}, ${tplObj.tY}) rotate(${tplObj.rot})">
								<path d="M5,0 l50,20 l0,-40z" style="stroke-width: 4; stroke: #fff; fill: #a00;" />
							</g>`;

      var textPoint = Utils.deepCopy(periPoint);
      if (periPoint.x < minimapSettings.viewRect.x + 60) {
        textPoint.x += 60;
      } else if (periPoint.x < minimapSettings.viewRect.x + minimapSettings.viewRect.w - 150) {
        textPoint.x += 30;
      } else {
        textPoint.x -= 200;
      }
      textPoint.y = Utils.clampNumber(periPoint.y, minimapSettings.viewRect.y + 60, minimapSettings.viewRect.y + minimapSettings.viewRect.h - 60);
      tplObj = {
        x: textPoint.x.toFixed(2),
        y: (-textPoint.y).toFixed(2),
        roundedDist: Math.round(pPointDist / 5) * 5,
        distStr: ''
      };
      if (pPointDist >= 3) {
        tplObj.distStr = `<tspan x="${tplObj.x}" dy="1.1em" class="smaller">${tplObj.roundedDist} LY</tspan>`;
      }

      this.markup.minimap += `<text x="${tplObj.x}" y="${tplObj.y}" filter="url(#sLblShdMM)">
								<tspan>Terra</tspan>
								${tplObj.distStr}
							</text>\n`;
    }

    // close minimap inner container
    this.markup.minimap += `</g>\n`;

    // frame around the minimap
    tplObj = {
      w: minimapSettings.viewRect.w + 10,
      h: minimapSettings.viewRect.h + 10
    };
    this.markup.minimap += `<rect x="-5" y="-5" width="${tplObj.w}" height="${tplObj.h}"
					style="fill: none; stroke: #000; stroke-width: 10;" />\n`;

    // close minimap outer container
    this.markup.minimap += `</g>`;
  };

  /**
   * Renders the title
   * @private
   */
  SvgWriter.prototype.renderTitle = function (settings) {
    if (!settings.displayTitle) {
      return;
    }
    let x = 0;
    let y = 0;
    if (settings.custom && settings.custom.titlePosition) {
      x = settings.custom.titlePosition.x === undefined ? 0 : settings.custom.titlePosition.x;
      y = settings.custom.titlePosition.y === undefined ? 0 : settings.custom.titlePosition.y;
    }
    this.markup.title += `\n\t\t<g transform="translate(${x}, ${y})">` +
      `\n\t\t\t<text x="0" y="0" style="font-weight: bold">${settings.displayTitle}</text>` +
      `\n\t\t</g>`;
  }

  /**
   * Renders the scale help.
   * @private
   */
  SvgWriter.prototype.renderScaleHelp = function (settings, scaleHelpSettings, viewRect, pxPerLy) {
    var scaleMargin = {
      x: 10 / pxPerLy + 20,
      y: 10 / pxPerLy
    };
    var tplObj = {
      tX: scaleHelpSettings.tX !== undefined ? scaleHelpSettings.tX : viewRect.x + scaleMargin.x,
      tY: scaleHelpSettings.tY !== undefined ? scaleHelpSettings.tY : -viewRect.y - 1.5 - scaleMargin.y,
      t10: 10 - 1.365,
      t20: 20 - 1.365,
      t30: 30 - 1.365,
      t40: 40 - 1.365,
      t50: 50 - 1.365
    };
    var cssClasses = ['black', 'white'];

    if (!settings.renderScaleHelp) {
      return;
    }
    if (!scaleHelpSettings) {
      scaleHelpSettings = {};
    }
    scaleHelpSettings.max = scaleHelpSettings.max || 50;
    scaleHelpSettings.step = scaleHelpSettings.step || 10;
    this.markup.scaleHelp = `\n\t\t<g transform="translate(${tplObj.tX}, ${tplObj.tY})">`;
    for (var i = 0, ly = 0; ly <= scaleHelpSettings.max; i++, ly += scaleHelpSettings.step) {
      if (ly < scaleHelpSettings.max) {
        this.markup.scaleHelp += `\n\t\t\t<rect x="${ly}" y="0" width="${scaleHelpSettings.step}" height="1.5" class="${cssClasses[i % 2]}" />`;
      }
      this.markup.scaleHelp += `\n\t\t\t<text x="${ly}" y="-1" text-anchor="middle">${ly}</text>`;
    }
    this.markup.scaleHelp += `\n\t\t\t<rect x="0" y="0" width="${scaleHelpSettings.max}" height="1.5" class="frame" />`;
    this.markup.scaleHelp += `\n\t\t\t<text x="${scaleHelpSettings.max + 1}" y="1.85">LY</text>`
    this.markup.scaleHelp += `\n\t\t</g>`;
  };

  /**
   * @param c {Object} The center point of all jump rings
   * @param jumpRingDistances {Array} The distances to paint jump rings at
   * @private
   */
  SvgWriter.prototype.renderJumpRings = function (settings, viewRect, jumpRingDistances) {
    var tplObj;
    if (!settings.renderJumpRings || !viewRect || !jumpRingDistances) {
      return;
    }
    tplObj = {
      cx: (viewRect.x + viewRect.w * .5).toFixed(3),
      cy: (-viewRect.y - viewRect.h * .5).toFixed(3) - 15
    };
    for (var i = 0; i < jumpRingDistances.length; i++) {
      tplObj.r = jumpRingDistances[i];
      this.markup.jumpRings += `<circle cx="${tplObj.cx}" cy="${tplObj.cy}" r="${tplObj.r}" />\n`;
    }
  };

  /**
   * @private
   */
  SvgWriter.prototype.createDisputedCssRule = function (dispCls) {
    return `g.systems .system.${dispCls} { fill: url('#${dispCls}-fill') !important; }\n`;
  };

  /**
   * @private
   */
  SvgWriter.prototype.createDisputedPattern = function (dispCls, factions) {
    var p, pctEachSlice, curFaction, factionColor;
    var paths = '';
    var dispParts = dispCls.split('-');
    var curPct = 0;
    var startPt, endPt;
    pctEachSlice = 1 / (dispParts.length - 1);

    for (var i = 1, len = dispParts.length; i < len; i++) {
      curFaction = factions[dispParts[i]];
      factionColor = curFaction.color || '#000';
      startPt = Utils.pointOnUnitCircleWithPercentValue(curPct);
      curPct += pctEachSlice;
      endPt = Utils.pointOnUnitCircleWithPercentValue(curPct);
      paths += `<path d="M${startPt.x},${startPt.y} A1,1,0,0,1,${endPt.x},${endPt.y} L0,0"
						style="fill:${factionColor}; stroke-width: 0;" />\n`;
    }
    //'<path d="M1,0 A1,1,0,0,1,x,y L0,0 " style="fill:#f00; stroke-width: 0;" />';
    return `<pattern id="${dispCls}-fill" width="1" height="1" viewBox="-1 -1 2 2">
			<g style="transform:rotate(-90deg)">
				${paths}
			</g>
		</pattern>`;
  };

  /**
   * @see https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
   * @private
   */
  SvgWriter.prototype.componentToHex = function (c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  };

  /**
   * @see https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
   * @private
   */
  SvgWriter.prototype.rgbToHex = function (r, g, b) {
    return "#" + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
  };

  /**
   * @see https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
   * @private
   */
  SvgWriter.prototype.hexToRgba = function (hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
    var a = result && result[4] ? parseInt(result[4], 16) / 255 : 1;
    // round opacity to two decimals
    a = Math.round(a * 100) / 100;
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: a
    } : null;
  };

  return SvgWriter;

})();
