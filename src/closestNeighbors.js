const Utils = require('./Utils.js');

let name = 'Almotacen';
let x = -99.116;
let y = 309.722;

console.log('\n--- ' + name);
[
    { name: 'Antares', x: -124.891, y: 297.734 },
    { name: 'Baker 3', x: -104.473, y: 324.098 },
    { name: 'Devin', x: -110.627, y: 333.924 },
    { name: 'Deweidewd', x: -107.279, y: 283.248 },
    { name: 'Dompaire', x: -74.717, y: 300.067 },
    { name: 'Graus', x: -100.617, y: 297.223 },
    { name: 'Leskovik', x: -90.486, y: 333.151 },
    { name: 'Sudeten', x: -83.471, y: 292.084 },
    { name: 'Zoetermeer', x: -78.079, y: 330.566 },
].forEach((n) => {
    console.log(n.name + ': ' + 
        Utils.distance(x, y, n.x, n.y).toFixed(3) + 
        ' LY');
});

name = 'Matteo';
x = -145.2407857;
y = 294.6219775;
console.log('\n--- ' + name);
[
    { name: 'Antares', x: -124.891, y: 297.734 },
    { name: 'Babaeski', x: -137.586, y: 307.817 },
    { name: 'Esteros', x: -157.657, y: 268.588 },
    { name: 'Mkuranga', x: -160.780, y: 317.382 },
    { name: 'Morges', x: -141.416, y: 283.196 },
    { name: 'Yeguas', x: -160.660, y: 281.747 },
].forEach((n) => {
    console.log(n.name + ': ' + 
        Utils.distance(x, y, n.x, n.y).toFixed(3) + 
        ' LY');
});

name = 'Sardinas';
x = -308.2242995;
y = 330.403826;
console.log('\n--- ' + name);
[
    { name: 'Anembo', x: -288.729, y: 314.793 },
    { name: 'Arluna', x: -281.493, y: 333.921 },
    { name: 'Bucklands', x: -326.196, y: 330.561 },
    { name: 'Inarcs', x: -295.180, y: 337.543 },
    { name: 'Jerangle', x: -318.176, y: 355.385 },
    { name: 'Mandaoaaru', x: -304.992, y: 307.561 },
    { name: 'Trentham', x: -310.742, y: 342.974 },
    { name: 'Willunga', x: -333.734, y: 345.303 },
    { name: 'Winter', x: -299.333, y: 350.462 },
].forEach((n) => {
    console.log(n.name + ': ' + 
        Utils.distance(x, y, n.x, n.y).toFixed(3) + 
        ' LY');
});
