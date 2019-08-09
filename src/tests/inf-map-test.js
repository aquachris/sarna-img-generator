var InfluenceMap = require('../InfluenceMap.js');

var map = new InfluenceMap().init(10, 10, 50, 50, 10);

map.addInfluencer('a1', 29, 15, 1);
map.addInfluencer('a2', 53, 53, 1);
//map.addInfluencer('b1', 41, 34, -1);

console.log('now trying to display');
for(var y = 4; y >= 0; y--) {
	line = '';
	for(var x = 0; x < 5; x++) {
		line += map.cells[y*5 + x].toFixed(2) + ' | ';
	}
	console.log(line);
}
