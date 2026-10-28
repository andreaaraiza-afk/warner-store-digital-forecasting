/* Build the Pages artifact. Fails closed when DASHBOARD_PASSWORD is missing.
   The password is read from the environment and never printed. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const password = process.env.DASHBOARD_PASSWORD || '';
if (!password.trim()) {
  console.error('DASHBOARD_PASSWORD is not set. Refusing to publish an unencrypted site.');
  process.exit(1);
}
if (!(process.env.STATICRYPT_PASSWORD || '').trim()) process.env.STATICRYPT_PASSWORD = password;

const stage = path.join(root, 'site-private', 'stage');
const outDir = path.join(root, 'site-private', 'encrypted');
fs.rmSync(path.join(root, 'site-private'), { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

const shots = {
  'audit/home-desktop.jpg': path.join(root, 'dist', 'audit', 'home-desktop.jpg'),
  'audit/home-mobile.jpg': path.join(root, 'dist', 'audit', 'home-mobile.jpg'),
  'audit/product-desktop.jpg': path.join(root, 'dist', 'audit', 'product-desktop.jpg'),
  'audit/product-mobile.jpg': path.join(root, 'dist', 'audit', 'product-mobile.jpg')
};
let indexHtml = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
for (const [rel, file] of Object.entries(shots)) {
  if (!fs.existsSync(file)) {
    console.error('Missing screenshot ' + rel + '. Refusing to publish.');
    process.exit(1);
  }
  const uri = 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
  if (!indexHtml.includes(rel)) {
    console.error('Dashboard HTML does not reference ' + rel + '. Refusing to publish.');
    process.exit(1);
  }
  indexHtml = indexHtml.split(rel).join(uri);
}
fs.writeFileSync(path.join(stage, 'index.html'), indexHtml);

const audioIds = ['lm-all-all', 'lm-shopify-all', 'lm-amazon-all'];
const blobs = {};
for (const id of audioIds) {
  const file = path.join(root, 'dist', 'audio', id + '.mp3');
  if (!fs.existsSync(file)) {
    console.error('Missing audio ' + id + '. Refusing to publish.');
    process.exit(1);
  }
  blobs[id] = 'data:audio/mpeg;base64,' + fs.readFileSync(file).toString('base64');
}
let recapHtml = fs.readFileSync(path.join(root, 'dist', 'recap.html'), 'utf8');
const marker = 'window.WRAudioBlobs || {}';
if (!recapHtml.includes(marker)) {
  console.error('Recap page has no audio placeholder. Refusing to publish.');
  process.exit(1);
}
recapHtml = recapHtml.replace(marker, JSON.stringify(blobs));
fs.writeFileSync(path.join(stage, 'recap.html'), recapHtml);

const template = path.join(root, 'staticrypt', 'password_template.html');
const cliCandidates = [
  process.env.STATICRYPT_CLI,
  path.join(root, 'node_modules', 'staticrypt', 'cli', 'index.js'),
  '/tmp/staticrypt-ci/node_modules/staticrypt/cli/index.js'
].filter(Boolean);
const cli = cliCandidates.find((file) => fs.existsSync(file));
if (!cli) {
  console.error('StatiCrypt is not installed. Refusing to publish.');
  process.exit(1);
}
const args = [
  path.join(stage, 'index.html'),
  path.join(stage, 'recap.html'),
  '--config', 'false',
  '--directory', outDir,
  '--remember', '30',
  '--short',
  '--template', template,
  '--template-title', 'Warner Records Store',
  '--template-instructions', 'This site is private. Enter the password to continue. Nothing is sent anywhere.',
  '--template-button', 'Unlock',
  '--template-remember', 'Remember me for 30 days',
  '--template-color-primary', '#f5c542',
  '--template-color-secondary', '#0b0b0f',
  '--template-placeholder', 'Password',
  '--template-error', 'That password did not unlock the page.'
];
const result = spawnSync(process.execPath, [cli, ...args], {
  cwd: root,
  env: process.env,
  stdio: 'inherit'
});
if (result.status !== 0) {
  console.error('StatiCrypt failed. Nothing was published.');
  process.exit(result.status || 1);
}

const encryptedIndex = path.join(outDir, 'index.html');
const encryptedRecap = path.join(outDir, 'recap.html');
if (!fs.existsSync(encryptedIndex) || !fs.existsSync(encryptedRecap)) {
  console.error('Encrypted pages were not created. Refusing to publish.');
  process.exit(1);
}
const indexCipher = fs.readFileSync(encryptedIndex, 'utf8');
if (!indexCipher.includes('staticrypt') || indexCipher.includes('DEMO DATA only') || indexCipher.includes('id="btnReport"')) {
  console.error('index.html does not look encrypted. Refusing to publish.');
  process.exit(1);
}
const recapCipher = fs.readFileSync(encryptedRecap, 'utf8');
if (recapCipher.includes('data:audio/mpeg;base64') || recapCipher.includes('lm-all-all.mp3')) {
  console.error('Recap audio is still readable. Refusing to publish.');
  process.exit(1);
}
fs.writeFileSync(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
const published = fs.readdirSync(outDir);
const forbidden = published.filter((name) => /^(data\.json|manifest\.json)$/.test(name) || name.endsWith('.mp3') || name.endsWith('.jpg'));
if (forbidden.length) {
  console.error('Unencrypted files would be published. Refusing.');
  process.exit(1);
}
console.log('Encrypted site is ready. Pages: ' + published.filter((n) => n.endsWith('.html')).join(', ') + '.');
