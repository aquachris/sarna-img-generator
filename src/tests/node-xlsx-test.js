var fs = require('fs');
var xlsx = require('node-xlsx');

// Parse a buffer
//var objFromBuffer = xlsx.parse(fs.readFileSync(__dirname + '/../data/Sarna Unified Cartography Kit (Official).xlsx'));
// Parse a file
var objFromFile = xlsx.parse(__dirname + '/../../data/Sarna Unified Cartography Kit (Official).xlsx');

var nebulaeTab = objFromFile[3];
var nebulae = [];
var nebulaeFields = [];
var curNebula;
for (var rowIdx = 0, rowLen = nebulaeTab.data.length; rowIdx < rowLen; rowIdx++) {
    //console.log(nebulaeTab.data[rowIdx]);
    curNebula = {};
    for(var colIdx = 0, colLen = nebulaeTab.data[rowIdx].length; colIdx < colLen; colIdx++) {
        if(rowIdx === 0) {
            nebulaeFields.push(nebulaeTab.data[rowIdx][colIdx].toLowerCase());
        } else {
            curNebula[nebulaeFields[colIdx]] = nebulaeTab.data[rowIdx][colIdx];
        }
    }
    if(rowIdx > 0) {
        nebulae.push(curNebula);
    }
}
console.log(nebulae);
