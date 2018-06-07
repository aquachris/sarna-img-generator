var fs = require('fs');
var xlsx = require('xlsx');

// Parse a file
var objFromFile = xlsx.readFile(__dirname + '/../../data/Systems By Era.xlsx', { cellStyles : true });

console.log(Object.keys(objFromFile));
//console.log(Object.keys(objFromFile.Styles));
//console.log(objFromFile.Styles.Fills);
console.log(objFromFile.SheetNames);
var sheet = objFromFile.Sheets['Systems'];
console.log(xlsx.utils.sheet_to_json(sheet));
var cell = sheet['C31'];

console.log(cell);