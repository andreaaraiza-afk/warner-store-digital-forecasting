/* Regenerate the hosted Kokoro MP3s from audio/manifest.json transcripts.
   Requires kokoro-js (npm install kokoro-js) and ffmpeg. Not part of node build.js. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from 'kokoro-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'audio', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const items = manifest.items || manifest;

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(err.slice(-500))));
  });
}
function ffprobe(file) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('exit', (code) => code === 0 ? resolve(+out) : reject(new Error('ffprobe ' + file)));
  });
}
function wavFrom(chunks, sr) {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  let off = 44;
  chunks.forEach((chunk) => {
    for (let i = 0; i < chunk.length; i++) {
      let s = chunk[i];
      if (s > 1) s = 1; else if (s < -1) s = -1;
      buf.writeInt16LE(s < 0 ? s * 32768 : s * 32767, off);
      off += 2;
    }
  });
  return buf;
}

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
for (const id of Object.keys(items)) {
  const item = items[id];
  const text = String(item.transcript || '').trim();
  if (!text) { console.log('skip', id); continue; }
  console.log('speak', id, text.split(/\s+/).length, 'words');
  const chunks = [];
  let sr = 24000;
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;
    const audio = await tts.generate(sentence, { voice: item.voice || 'af_heart', speed: 1 });
    chunks.push(audio.audio);
    sr = audio.sampling_rate;
    if (i % 8 === 0) console.log(' ', id, i + 1, '/', sentences.length);
  }
  const wavPath = path.join(root, 'audio', id + '.wav');
  const mp3Path = path.join(root, 'audio', id + '.mp3');
  fs.writeFileSync(wavPath, wavFrom(chunks, sr));
  await ffmpeg(['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '4', '-ar', '24000', mp3Path]);
  fs.unlinkSync(wavPath);
  item.duration = Math.round((await ffprobe(mp3Path)) * 10) / 10;
  item.file = 'audio/' + id + '.mp3';
  item.voice = item.voice || 'af_heart';
  console.log('wrote', mp3Path, item.duration + 's');
}
fs.writeFileSync(manifestPath, JSON.stringify({ voice: 'af_heart', items }, null, 2) + '\n');
