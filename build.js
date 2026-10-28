// Builds dist/ : a single self-contained index.html (Chart.js, data generator, public catalog and app inlined; works from file://) + data.json export
const fs = require('fs'), path = require('path');
const { buildCatalog } = require('./data/trim');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const dg = src('datagen.js'), app = src('app.js'), report = src('report.js'), tts = src('tts.js'), css = src('styles.css');
const chart = fs.readFileSync(path.join(__dirname, 'vendor', 'chart.umd.min.js'), 'utf8');
const catalog = JSON.stringify(buildCatalog(path.join(__dirname, 'data'))).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
let html = src('index.html').replace('/*CHARTJS*/', () => chart).replace('/*CSS*/', () => css).replace('/*CATALOG*/', () => 'window.WRCatalog=' + catalog + ';').replace('/*DATAGEN*/', () => dg).replace('/*TTS*/', () => tts).replace('/*REPORT*/', () => report).replace('/*APP*/', () => app);
fs.mkdirSync('dist', { recursive: true });
const W = require('./src/datagen.js'); const summary = JSON.stringify(W.exportSummary());
fs.writeFileSync('dist/index.html', html);
fs.writeFileSync('dist/data.json', summary);
fs.writeFileSync('dist/.nojekyll', '');
const scriptPath = path.join(__dirname, 'audio', 'default-script.txt');
if (fs.existsSync(scriptPath)) {
  const WRTTS = require('./src/tts.js');
  const spoken = fs.readFileSync(scriptPath, 'utf8');
  const wav = Buffer.from(WRTTS.wav(spoken));
  fs.writeFileSync(path.join(__dirname, 'dist', 'wr-store-audio-summary.wav'), wav);
  console.log('wav', wav.length, 'script chars', spoken.length);
}
console.log('index.html', html.length, 'data.json', summary.length, 'catalog', catalog.length);
