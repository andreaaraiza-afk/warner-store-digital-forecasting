// Builds dist/ : a single self-contained index.html (Chart.js, data generator and app inlined; works from file://) + data.json export
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const dg = src('datagen.js'), app = src('app.js'), css = src('styles.css');
const chart = fs.readFileSync(path.join(__dirname, 'vendor', 'chart.umd.min.js'), 'utf8');
let html = src('index.html').replace('/*CHARTJS*/', () => chart).replace('/*CSS*/', () => css).replace('/*DATAGEN*/', () => dg).replace('/*APP*/', () => app);
fs.mkdirSync('dist', { recursive: true });
const W = require('./src/datagen.js'); const summary = JSON.stringify(W.exportSummary());
fs.writeFileSync('dist/index.html', html);
fs.writeFileSync('dist/data.json', summary);
fs.writeFileSync('dist/.nojekyll', '');
console.log('index.html', html.length, 'data.json', summary.length);
