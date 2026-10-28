/* Builds a Gmail drafts.create payload. Never sends mail.
   Usable from Node (module.exports) and from the dashboard (window.WRGmailMime). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WRGmailMime = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
  var DRAFTS_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';
  var PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
  /* Stay under Gmail's 25MB message cap, including base64 expansion. */
  var MAX_RFC822_BYTES = 20 * 1024 * 1024;

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(String(str));
    return Buffer.from(String(str), 'utf8');
  }
  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined' && Buffer.from) return Buffer.from(bytes).toString('base64');
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function utf8Base64(str) { return bytesToBase64(utf8Bytes(str)); }
  function bufferToBase64(buf) {
    if (buf instanceof ArrayBuffer) buf = new Uint8Array(buf);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(buf)) return buf.toString('base64');
    return bytesToBase64(buf);
  }
  function wrap76(b64) {
    var out = [];
    var s = String(b64 || '').replace(/\s+/g, '');
    for (var i = 0; i < s.length; i += 76) out.push(s.slice(i, i + 76));
    return out.join('\r\n');
  }
  function base64urlFromBytes(bytes) {
    return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function encodeSubject(value) {
    var text = String(value || '');
    if (/^[\t\x20-\x7E]*$/.test(text)) return text;
    var bytes = utf8Bytes(text);
    var words = [];
    for (var i = 0; i < bytes.length; i += 45) {
      words.push('=?UTF-8?B?' + bytesToBase64(bytes.slice(i, i + 45)) + '?=');
    }
    return words.join('\r\n ');
  }
  function extractDataImages(html) {
    var images = [];
    var n = 0;
    var out = String(html || '').replace(/src=(["'])data:image\/(png|jpeg|jpg);base64,([^"']+)\1/gi, function (_, _q, kind, b64) {
      n += 1;
      var mime = /jpe?g/i.test(kind) ? 'image/jpeg' : 'image/png';
      var ext = mime === 'image/jpeg' ? 'jpg' : 'png';
      var cid = 'img' + n + '@wr-store';
      images.push({ cid: cid, mime: mime, filename: 'image-' + n + '.' + ext, base64: String(b64).replace(/\s+/g, '') });
      return 'src="cid:' + cid + '"';
    });
    return { html: out, images: images };
  }
  function part(headers, bodyBase64) {
    return headers.join('\r\n') + '\r\n\r\n' + wrap76(bodyBase64) + '\r\n';
  }
  function assemble(opts) {
    var html = opts.html || '';
    var plain = opts.plain || '';
    var images = opts.images || [];
    var audio = opts.audio;
    var mix = opts.mix || 'wr-mix';
    var rel = opts.rel || 'wr-rel';
    var alt = opts.alt || 'wr-alt';
    var headers = ['MIME-Version: 1.0'];
    if (opts.from) headers.push('From: ' + opts.from);
    headers.push('Subject: ' + encodeSubject(opts.subject || ''));
    var altBody = '--' + alt + '\r\n' +
      part(['Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64'], utf8Base64(plain)) +
      '--' + alt + '\r\n' +
      part(['Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64'], utf8Base64(html)) +
      '--' + alt + '--\r\n';
    var related = altBody;
    if (images.length) {
      related = '--' + rel + '\r\n' +
        'Content-Type: multipart/alternative; boundary="' + alt + '"\r\n\r\n' +
        altBody;
      images.forEach(function (img) {
        related += '--' + rel + '\r\n' + part([
          'Content-Type: ' + img.mime + '; name="' + img.filename + '"',
          'Content-Transfer-Encoding: base64',
          'Content-ID: <' + img.cid + '>',
          'Content-Disposition: inline; filename="' + img.filename + '"'
        ], img.base64);
      });
      related += '--' + rel + '--\r\n';
    }
    var rootType, rootBody;
    if (audio) {
      rootType = 'multipart/mixed; boundary="' + mix + '"';
      rootBody = '--' + mix + '\r\n' +
        'Content-Type: ' + (images.length ? 'multipart/related; boundary="' + rel + '"' : 'multipart/alternative; boundary="' + alt + '"') + '\r\n\r\n' +
        related +
        '--' + mix + '\r\n' + part([
          'Content-Type: ' + (audio.contentType || 'audio/mpeg') + '; name="' + audio.filename + '"',
          'Content-Transfer-Encoding: base64',
          'Content-Disposition: attachment; filename="' + audio.filename + '"'
        ], audio.base64) +
        '--' + mix + '--\r\n';
    } else if (images.length) {
      rootType = 'multipart/related; boundary="' + rel + '"';
      rootBody = related;
    } else {
      rootType = 'multipart/alternative; boundary="' + alt + '"';
      rootBody = altBody;
    }
    headers.push('Content-Type: ' + rootType);
    return headers.join('\r\n') + '\r\n\r\n' + rootBody;
  }
  function buildMimeMessage(opts) {
    opts = opts || {};
    var extracted = extractDataImages(opts.html || '');
    var html = extracted.html;
    var audio = opts.audio && opts.audio.base64 ? opts.audio : null;
    var droppedAudio = false;
    function pack(useAudio) {
      return assemble({
        from: opts.from || '',
        subject: opts.subject || '',
        html: html,
        plain: opts.plain || '',
        images: extracted.images,
        audio: useAudio,
        mix: opts.mix,
        rel: opts.rel,
        alt: opts.alt
      });
    }
    var rfc = pack(audio);
    if (audio && utf8Bytes(rfc).length > MAX_RFC822_BYTES) {
      droppedAudio = true;
      var note = '<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#5e5a52;margin:0 0 14px;">The recap audio is linked above and is not attached, so this draft stays within Gmail’s size limit.</p>';
      html += note;
      rfc = pack(null);
    }
    var bytes = utf8Bytes(rfc);
    return {
      rfc822: rfc,
      raw: base64urlFromBytes(bytes),
      bytes: bytes.length,
      attachedAudio: !!(audio && !droppedAudio),
      imageCount: extracted.images.length,
      cids: extracted.images.map(function (img) { return img.cid; }),
      scope: SCOPE,
      draftsUrl: DRAFTS_URL,
      profileUrl: PROFILE_URL
    };
  }
  function draftBody(raw) { return JSON.stringify({ message: { raw: raw } }); }
  function draftWebUrl(messageId) {
    return 'https://mail.google.com/mail/u/0/#drafts?compose=' + encodeURIComponent(messageId || '');
  }

  return {
    SCOPE: SCOPE,
    DRAFTS_URL: DRAFTS_URL,
    PROFILE_URL: PROFILE_URL,
    MAX_RFC822_BYTES: MAX_RFC822_BYTES,
    buildMimeMessage: buildMimeMessage,
    extractDataImages: extractDataImages,
    draftBody: draftBody,
    draftWebUrl: draftWebUrl,
    bufferToBase64: bufferToBase64,
    encodeSubject: encodeSubject
  };
});
