// Builds dist/ : a single self-contained index.html (Chart.js, data generator, public catalog and app inlined; works from file://) + data.json export
const fs = require('fs'), path = require('path');
const { buildCatalog } = require('./data/trim');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const dg = src('datagen.js'), app = src('app.js'), css = src('styles.css');
const auditPath = path.join(__dirname, 'data', 'public-audit.json');
const auditObj = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : { runs: [], issues: [], fixes: [], screenshots: {} };
const auditJs = 'window.WRAudit=' + JSON.stringify(auditObj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ';';
const chart = fs.readFileSync(path.join(__dirname, 'vendor', 'chart.umd.min.js'), 'utf8');
const catalog = JSON.stringify(buildCatalog(path.join(__dirname, 'data'))).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const manifestPath = path.join(__dirname, 'audio', 'manifest.json');
let recapItems = {};
if (fs.existsSync(manifestPath)) {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  recapItems = parsed.items || parsed;
}
const recapJson = JSON.stringify(recapItems);
const report = src('report.js').replace('var RECAPS = {"placeholder":1};', 'var RECAPS = ' + recapJson + ';');
let html = src('index.html').replace('/*CHARTJS*/', () => chart).replace('/*CSS*/', () => css).replace('/*CATALOG*/', () => 'window.WRCatalog=' + catalog + ';').replace('/*DATAGEN*/', () => dg).replace('/*AUDIT*/', () => auditJs).replace('/*REPORT*/', () => report).replace('/*APP*/', () => app);
fs.mkdirSync('dist', { recursive: true });
const W = require('./src/datagen.js');
const summaryObj = W.exportSummary();
summaryObj.seo = { label: 'REAL public audit of shop.warnerrecords.com, plus a DEMO keyword model', audit: auditObj };
summaryObj.ux = { label: 'REAL public lab audit and screenshots, plus a DEMO mobile/desktop allocation', audit: auditObj };
const summary = JSON.stringify(summaryObj);
fs.writeFileSync('dist/index.html', html);
fs.writeFileSync('dist/data.json', summary);
fs.writeFileSync('dist/.nojekyll', '');
const recapHtml = src('recap.html').replace('var RECAPS = {"placeholder":1};', 'var RECAPS = ' + recapJson + ';');
fs.writeFileSync(path.join(__dirname, 'dist', 'recap.html'), recapHtml);
const audioOut = path.join(__dirname, 'dist', 'audio');
fs.mkdirSync(audioOut, { recursive: true });
const audioDir = path.join(__dirname, 'audio');
if (fs.existsSync(audioDir)) {
  fs.readdirSync(audioDir).forEach(function (name) {
    if (/\.(mp3|png|json)$/.test(name)) fs.copyFileSync(path.join(audioDir, name), path.join(audioOut, name));
  });
}
const oldWav = path.join(__dirname, 'dist', 'wr-store-audio-summary.wav');
if (fs.existsSync(oldWav)) fs.unlinkSync(oldWav);
const shotDir = path.join(__dirname, 'audit', 'shots');
const shotOut = path.join(__dirname, 'dist', 'audit');
fs.mkdirSync(shotOut, { recursive: true });
if (fs.existsSync(shotDir)) {
  fs.readdirSync(shotDir).forEach(function (name) {
    if (name.endsWith('.jpg')) fs.copyFileSync(path.join(shotDir, name), path.join(shotOut, name));
  });
}
console.log('index.html', html.length, 'data.json', summary.length, 'catalog', catalog.length, 'recaps', Object.keys(recapItems).length);
