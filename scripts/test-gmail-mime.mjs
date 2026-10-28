/* Local check for the Gmail draft MIME builder. No network, no send. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const mime = require('../src/gmail-mime.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const header = 'Warner Records Store · Storefront: All · Channel: All · Category: All · Artist: Zach Bryan · Sep 1 – Sep 30, 2026';
const html = '<p class="r-meta">' + header + '</p><h1>Performance Analysis</h1>' +
  '<p><a href="https://wr-store-dashboard-tpvfd.ondigitalocean.app/recap.html?id=lm-all-all">Listen to the audio recap</a></p>' +
  '<img alt="Net revenue by channel" src="data:image/png;base64,' + png + '">';
const plain = header + '\n\nPerformance Analysis\n\nListen: https://wr-store-dashboard-tpvfd.ondigitalocean.app/recap.html?id=lm-all-all\n';
const small = mime.buildMimeMessage({
  from: 'owner@example.com',
  subject: 'Warner Records Store analysis · Sep 1 – Sep 30, 2026 (DEMO DATA)',
  html: html,
  plain: plain,
  audio: { filename: 'lm-all-all.mp3', contentType: 'audio/mpeg', base64: Buffer.from('not-a-real-mp3').toString('base64') },
  mix: 'mixTEST',
  rel: 'relTEST',
  alt: 'altTEST'
});

assert(small.attachedAudio, 'small recap should be attached');
assert(small.imageCount === 1, 'chart png should become one inline part');
assert(small.rfc822.indexOf('Content-ID: <img1@wr-store>') >= 0, 'inline image needs a Content-ID');
assert(small.rfc822.indexOf('filename="lm-all-all.mp3"') >= 0, 'mp3 filename should be on the attachment');
assert(small.rfc822.indexOf('multipart/mixed') >= 0, 'attachment requires multipart/mixed');
assert(small.rfc822.indexOf('multipart/related') >= 0, 'inline chart requires multipart/related');
assert(!small.raw.includes('+') && !small.raw.includes('/') && !small.raw.includes('='), 'Gmail raw must be unpadded base64url');

function decodePart(rfc, contentType) {
  var at = rfc.indexOf('Content-Type: ' + contentType);
  assert(at >= 0, 'missing part ' + contentType);
  var rest = rfc.slice(at);
  var sep = rest.indexOf('\r\n\r\n');
  var next = rest.indexOf('\r\n--', sep + 4);
  var b64 = rest.slice(sep + 4, next).replace(/\s+/g, '');
  return Buffer.from(b64, 'base64').toString('utf8');
}
var htmlOut = decodePart(small.rfc822, 'text/html; charset="UTF-8"');
assert(htmlOut.indexOf('Performance Analysis') > htmlOut.indexOf('Artist: Zach Bryan'), 'header with artist stays before Performance Analysis');
assert(htmlOut.includes('Listen to the audio recap'), 'listen link stays in the html part');
assert(htmlOut.includes('cid:img1@wr-store'), 'html points at the inline chart');
const body = mime.draftBody(small.raw);
assert(JSON.parse(body).message.raw === small.raw, 'drafts.create body is { message: { raw } }');
assert(mime.DRAFTS_URL === 'https://gmail.googleapis.com/gmail/v1/users/me/drafts', 'only the drafts collection is addressed');
assert(mime.SCOPE === 'https://www.googleapis.com/auth/gmail.compose', 'scope is compose-only');
assert(mime.draftWebUrl('abc123') === 'https://mail.google.com/mail/u/0/#drafts?compose=abc123', 'draft opens in Gmail web');

const hugeB64 = Buffer.alloc(16 * 1024 * 1024, 1).toString('base64');
const huge = mime.buildMimeMessage({
  subject: 'Too big',
  html: html,
  plain: plain,
  audio: { filename: 'lm-all-all.mp3', contentType: 'audio/mpeg', base64: hugeB64 },
  mix: 'mixBIG', rel: 'relBIG', alt: 'altBIG'
});
assert(!huge.attachedAudio, 'oversized mp3 is not attached');
assert(huge.rfc822.indexOf('filename="lm-all-all.mp3"') < 0, 'oversized mp3 has no attachment part');
assert(decodePart(huge.rfc822, 'text/html; charset="UTF-8"').includes('not attached'), 'oversized mp3 explains that the listen link is enough');
assert(huge.bytes < mime.MAX_RFC822_BYTES, 'dropped attachment stays under the cap');

const sources = ['src/gmail-mime.js', 'src/report.js'].map(function (rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}).join('\n');
assert(!sources.includes('messages.send'), 'must not call messages.send');
assert(!sources.includes('drafts.send'), 'must not call drafts.send');
assert(!sources.includes('mailto:'), 'must not use a mailto link');
assert(sources.includes('https://www.googleapis.com/auth/gmail.compose'), 'compose scope is present');
assert(!sources.includes("https://mail.google.com/'") && !sources.includes('https://mail.google.com/"'), 'must not request the full mail scope');
assert(!sources.includes('gmail.modify'), 'must not request modify');

console.log('gmail mime ok', small.bytes, 'bytes with audio,', huge.bytes, 'bytes linked only');
