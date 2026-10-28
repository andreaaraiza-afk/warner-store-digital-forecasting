/* Small in-browser formant synthesizer. Original code, no network and no API key.
   Turns text into a 16 kHz mono WAV the page can download. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WRTTS = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SR = 16000;
  var SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = [null, null, 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function sayInt(n) {
    n = Math.round(Math.abs(Number(n) || 0));
    if (n < 20) return SMALL[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + SMALL[n % 10] : '');
    if (n < 1000) return sayInt(Math.floor(n / 100)) + ' hundred' + (n % 100 ? ' ' + sayInt(n % 100) : '');
    if (n < 1000000) return sayInt(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + sayInt(n % 1000) : '');
    if (n < 1000000000) return sayInt(Math.floor(n / 1000000)) + ' million' + (n % 1000000 ? ' ' + sayInt(n % 1000000) : '');
    return String(n);
  }
  function sayDecimal(num) {
    var s = (Math.round(Math.abs(Number(num)) * 100) / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    var p = s.split('.');
    var t = sayInt(+p[0]);
    if (p[1]) t += ' point ' + p[1].split('').map(function (d) { return SMALL[+d]; }).join(' ');
    return t;
  }
  function sayYear(y) {
    y = +y;
    if (y >= 2000 && y < 2100) return 'twenty ' + sayInt(y - 2000);
    return sayInt(y);
  }

  /* vowel / consonant targets: f1, f2, voiced, noise mix, duration ms */
  var PH = {
    IY: [270, 2290, 1, 0, 90], IH: [390, 1990, 1, 0, 70], EY: [480, 2080, 1, 0, 100],
    EH: [530, 1840, 1, 0, 80], AE: [660, 1720, 1, 0, 90], AA: [730, 1090, 1, 0, 90],
    AO: [570, 840, 1, 0, 90], OW: [490, 910, 1, 0, 100], UH: [440, 1020, 1, 0, 70],
    UW: [300, 870, 1, 0, 90], AH: [640, 1190, 1, 0, 70], ER: [490, 1350, 1, 0, 80],
    AY: [730, 1090, 1, 0, 60], AW: [730, 1090, 1, 0, 60], OY: [570, 840, 1, 0, 60],
    M: [280, 900, 1, 0, 70], N: [280, 1400, 1, 0, 60], NG: [280, 1100, 1, 0, 70],
    L: [400, 1200, 1, 0, 60], R: [420, 1300, 1, 0, 60], W: [300, 700, 1, 0, 60], Y: [300, 2100, 1, 0, 50],
    P: [400, 1500, 0, 0.2, 70], B: [400, 1100, 1, 0.15, 60], T: [400, 1800, 0, 0.35, 60],
    D: [400, 1600, 1, 0.2, 55], K: [400, 1800, 0, 0.3, 70], G: [400, 1400, 1, 0.15, 60],
    F: [400, 1700, 0, 0.55, 80], V: [400, 1400, 1, 0.35, 70], TH: [400, 1700, 0, 0.4, 70],
    DH: [400, 1400, 1, 0.3, 60], S: [400, 2200, 0, 0.7, 80], Z: [400, 2000, 1, 0.4, 70],
    SH: [400, 2000, 0, 0.65, 90], ZH: [400, 1800, 1, 0.4, 70], HH: [500, 1500, 0, 0.45, 60],
    CH: [400, 2000, 0, 0.6, 80], JH: [400, 1800, 1, 0.4, 70],
    SIL: [0, 0, 0, 0, 40]
  };
  var DIPH = { AY: 'IY', AW: 'UH', OY: 'IY' };
  var WORDS = {
    a: 'AH', about: 'AH B AW T', across: 'AH K R AO S', after: 'AE F T ER', again: 'AH G EH N',
    ads: 'AE D Z', affiliate: 'AH F IH L IY IH T', all: 'AO L', also: 'AO L S OW', amazon: 'AE M AH Z AA N', an: 'AE N', and: 'AE N D',
    apparel: 'AH P AE R AH L',
    are: 'AA R', artist: 'AA R T IH S T', artists: 'AA R T IH S T S', as: 'AE Z', at: 'AE T',
    attach: 'AH T AE CH', audio: 'AO D IY OW', average: 'AE V R IH JH',
    back: 'B AE K', be: 'B IY', before: 'B IH F AO R', best: 'B EH S T', bigger: 'B IH G ER',
    biggest: 'B IH G EH S T', browser: 'B R AW Z ER', brought: 'B R AO T', budget: 'B AH JH IH T',
    but: 'B AH T', bundles: 'B AH N D AH L Z', by: 'B AY',
    cassettes: 'K AE S EH T S', cds: 'S IY D IY Z', colored: 'K AH L ER D',
    campaign: 'K AE M P EY N', campaigns: 'K AE M P EY N Z', catalog: 'K AE T AH L AO G',
    catalogs: 'K AE T AH L AO G Z', category: 'K AE T AH G AO R IY', channel: 'CH AE N AH L',
    channels: 'CH AE N AH L Z', click: 'K L IH K', conversion: 'K AH N V ER ZH AH N',
    cover: 'K AH V ER', customers: 'K AH S T AH M ER Z',
    dashboard: 'D AE SH B AO R D', data: 'D EY T AH', day: 'D EY', days: 'D EY Z', de: 'D IY IY',
    deluxe: 'D EH L AH K S', demo: 'D EH M OW', did: 'D IH D', direct: 'D ER EH K T', dollar: 'D AA L ER',
    dollars: 'D AA L ER Z', down: 'D AW N', download: 'D AW N L OW D',
    eight: 'EY T', eighteen: 'EY T IY N', eighty: 'EY T IY', eleven: 'IH L EH V AH N',
    email: 'IY M EY L', end: 'EH N D', exclusives: 'EH K S K L UW S IH V Z',
    facebook: 'F EY S B UH K', fees: 'F IY Z', fifteen: 'F IH F T IY N', fifth: 'F IH F TH',
    fifty: 'F IH F T IY', file: 'F AY L', filter: 'F IH L T ER', filters: 'F IH L T ER Z', first: 'F ER S T',
    five: 'F AY V', flow: 'F L OW', flows: 'F L OW Z', for: 'F AO R', forecast: 'F AO R K AE S T',
    forty: 'F AO R T IY', four: 'F AO R', fourteen: 'F AO R T IY N', fourth: 'F AO R TH',
    from: 'F R AH M', full: 'F UH L',
    gmail: 'JH IY M EY L',
    had: 'HH AE D', has: 'HH AE Z', have: 'HH AE V', here: 'HH IH R', hi: 'HH AY',
    highlights: 'HH AY L AY T S', hosted: 'HH OW S T IH D', hundred: 'HH AH N D R AH D',
    if: 'IH F', in: 'IH N', instagram: 'IH N S T AH G R AE M', into: 'IH N T UW',
    is: 'IH Z', it: 'IH T', its: 'IH T S',
    just: 'JH AH S T',
    landed: 'L AE N D IH D', last: 'L AE S T', led: 'L EH D', link: 'L IH NG K',
    limited: 'L IH M IH T IH D', list: 'L IH S T', look: 'L UH K', looking: 'L UH K IH NG', lps: 'EH L P IY Z',
    made: 'M EY D', mail: 'M EY L', million: 'M IH L Y AH N', month: 'M AH N TH',
    more: 'M AO R', most: 'M OW S T',
    net: 'N EH T', new: 'N UW', next: 'N EH K S T', nine: 'N AY N', nineteen: 'N AY N T IY N',
    ninety: 'N AY N T IY', not: 'N AA T', nothing: 'N AH TH IH NG', now: 'N AW',
    number: 'N AH M B ER', numbers: 'N AH M B ER Z',
    of: 'AH V', on: 'AA N', one: 'W AH N', or: 'AO R', order: 'AO R D ER', orders: 'AO R D ER Z',
    organic: 'AO R G AE N IH K', our: 'AW ER', out: 'AW T',
    page: 'P EY JH', paid: 'P EY D', paste: 'P EY S T', peak: 'P IY K', percent: 'P ER S EH N T',
    period: 'P IH R IY AH D', platform: 'P L AE T F AO R M', point: 'P OY N T',
    previous: 'P R IY V IY AH S', product: 'P R AA D AH K T', products: 'P R AA D AH K T S',
    public: 'P AH B L IH K', put: 'P UH T',
    quick: 'K W IH K',
    rate: 'R EY T', records: 'R EH K ER D Z', referral: 'R IH F ER AH L', reminder: 'R IH M AY N D ER', report: 'R IH P AO R T',
    returning: 'R IH T ER N IH NG', revenue: 'R EH V AH N UW', roas: 'R OW AE S',
    sales: 'S EY L Z', search: 'S ER CH', second: 'S EH K AH N D', seller: 'S EH L ER',
    send: 'S EH N D', sent: 'S EH N T', seven: 'S EH V AH N', seventeen: 'S EH V AH N T IY N',
    seventy: 'S EH V AH N T IY', shopify: 'SH AA P IH F AY', signed: 'S AY N D', six: 'S IH K S', sixteen: 'S IH K S T IY N',
    sixty: 'S IH K S T IY', sms: 'EH S EH M EH S', so: 'S OW', social: 'S OW SH AH L', sponsored: 'S P AA N S ER D',
    spend: 'S P EH N D', stock: 'S T AA K', store: 'S T AO R', storefront: 'S T AO R F R AH N T',
    strong: 'S T R AO NG', summary: 'S AH M ER IY',
    tables: 'T EY B AH L Z', talk: 'T AO K', team: 'T IY M', ten: 'T EH N', than: 'DH AE N',
    that: 'DH AE T', the: 'DH AH', their: 'DH EH R', then: 'DH EH N', there: 'DH EH R',
    third: 'TH ER D', thirteen: 'TH ER T IY N', thirty: 'TH ER T IY', this: 'DH IH S',
    thousand: 'TH AW Z AH N D', three: 'TH R IY', through: 'TH R UW', tiktok: 'T IH K T AA K',
    to: 'T UW', today: 'T AH D EY', top: 'T AA P', twelve: 'T W EH L V', twenty: 'T W EH N T IY',
    two: 'T UW',
    uk: 'Y UW K EY', until: 'AH N T IH L', up: 'AH P', us: 'Y UW EH S',
    value: 'V AE L Y UW', versus: 'V ER S AH S', vinyl: 'V AY N AH L',
    want: 'W AA N T', warner: 'W AO R N ER', was: 'W AH Z', watch: 'W AA CH', we: 'W IY',
    welcome: 'W EH L K AH M', were: 'W ER', what: 'W AH T', where: 'W EH R', which: 'W IH CH',
    window: 'W IH N D OW', with: 'W IH TH', worth: 'W ER TH',
    year: 'Y IH R', you: 'Y UW', your: 'Y AO R', youtube: 'Y UW T UW B',
    zero: 'Z IH R OW'
  };

  var RULES = [
    [/qu/g, ' K W '], [/ch/g, ' CH '], [/sh/g, ' SH '], [/th/g, ' TH '], [/ph/g, ' F '],
    [/ng/g, ' NG '], [/ck/g, ' K '], [/ee/g, ' IY '], [/ea/g, ' IY '], [/oo/g, ' UW '],
    [/ai/g, ' EY '], [/ay/g, ' EY '], [/ou/g, ' AW '], [/ow/g, ' OW '], [/oi/g, ' OY '],
    [/oy/g, ' OY '], [/ar/g, ' AA R '], [/or/g, ' AO R '], [/er/g, ' ER '], [/ir/g, ' ER '],
    [/ur/g, ' ER '], [/a/g, ' AE '], [/e/g, ' EH '], [/i/g, ' IH '], [/o/g, ' AA '],
    [/u/g, ' AH '], [/y/g, ' IY '], [/b/g, ' B '], [/c/g, ' K '], [/d/g, ' D '],
    [/f/g, ' F '], [/g/g, ' G '], [/h/g, ' HH '], [/j/g, ' JH '], [/k/g, ' K '],
    [/l/g, ' L '], [/m/g, ' M '], [/n/g, ' N '], [/p/g, ' P '], [/r/g, ' R '],
    [/s/g, ' S '], [/t/g, ' T '], [/v/g, ' V '], [/w/g, ' W '], [/x/g, ' K S '], [/z/g, ' Z ']
  ];

  function wordPhones(word) {
    var key = word.toLowerCase().replace(/[^a-z0-9']/g, '');
    if (!key) return [];
    if (/^\d+$/.test(key)) return sayInt(+key).split(/\s+/).reduce(function (a, w) { return a.concat(wordPhones(w)); }, []);
    if (WORDS[key]) return WORDS[key].split(/\s+/);
    var s = ' ' + key + ' ';
    RULES.forEach(function (r) { r[0].lastIndex = 0; s = s.replace(r[0], r[1]); });
    return s.trim().split(/\s+/).filter(function (p) { return PH[p]; });
  }

  function phonesFor(text) {
    var out = [];
    var re = /[A-Za-z0-9']+|[,.;:!?]/g, m;
    var src = String(text || '');
    while ((m = re.exec(src))) {
      var tok = m[0];
      if (tok === ',') out.push('SIL', 'SIL', 'SIL');
      else if (tok === ';' || tok === ':') out.push('SIL', 'SIL', 'SIL', 'SIL');
      else if (tok === '.' || tok === '!' || tok === '?') out.push('SIL', 'SIL', 'SIL', 'SIL', 'SIL');
      else {
        var ph = wordPhones(tok);
        if (!ph.length) ph = ['AH'];
        out = out.concat(ph);
        out.push('SIL');
      }
    }
    return out;
  }

  function synth(text) {
    var phones = phonesFor(text);
    if (!phones.length) phones = ['SIL', 'SIL', 'SIL', 'SIL'];
    var est = 0;
    phones.forEach(function (p) { est += ((PH[p] || PH.AH)[4]) / 1000 * SR + 8; });
    var buf = new Float32Array(est + SR);
    var n = 0, f0 = 118, phase = 0;
    var z1 = [0, 0], z2 = [0, 0];
    function pole(z, f, bw, x) {
      if (f < 40) return x * 0.2;
      var r = Math.exp(-Math.PI * bw / SR);
      var c = 2 * r * Math.cos(2 * Math.PI * f / SR);
      var y = (1 - r) * x + c * z[0] - r * r * z[1];
      if (y > 4) y = 4; else if (y < -4) y = -4;
      z[1] = z[0]; z[0] = y;
      return y;
    }
    phones.forEach(function (name, idx) {
      var spec = PH[name] || PH.AH;
      var f1 = spec[0], f2 = spec[1], voiced = spec[2], noise = spec[3], ms = spec[4];
      var next = DIPH[name] ? PH[DIPH[name]] : null;
      var len = Math.max(1, Math.round(ms / 1000 * SR));
      var endDrop = (phones[idx + 1] === 'SIL');
      for (var i = 0; i < len; i++) {
        var k = i / len;
        var a1 = f1, a2 = f2;
        if (next && k > 0.45) {
          var t = (k - 0.45) / 0.55;
          a1 = f1 + (next[0] - f1) * t;
          a2 = f2 + (next[1] - f2) * t;
        }
        var env = Math.sin(Math.PI * Math.min(1, k * 8)) * (endDrop ? (1 - k * 0.25) : 1);
        phase += f0 / SR;
        var glot = 0;
        if (voiced && phase >= 1) { phase -= 1; glot = 1; }
        var src = glot;
        if (noise) src += (Math.random() * 2 - 1) * noise;
        var y = pole(z1, a1 || 500, 80, src);
        y = pole(z2, a2 || 1500, 110, y);
        var amp = (voiced ? 0.55 : 0.22) * env;
        if (n < buf.length) buf[n++] = y * amp;
      }
      if (endDrop) f0 = 104; else f0 = 118;
    });
    var peak = 0.0001;
    for (var j = 0; j < n; j++) { var a = Math.abs(buf[j]); if (a > peak) peak = a; }
    var gain = 0.85 / peak;
    for (j = 0; j < n; j++) buf[j] *= gain;
    return buf.subarray(0, n);
  }

  function wav(text) {
    var samples = synth(text);
    var n = samples.length;
    var buf = new ArrayBuffer(44 + n * 2);
    var v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF');
    v.setUint32(4, 36 + n * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, SR, true);
    v.setUint32(28, SR * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, n * 2, true);
    var off = 44;
    for (var i = 0; i < n; i++) {
      var s = samples[i];
      if (s > 1) s = 1; else if (s < -1) s = -1;
      v.setInt16(off, s < 0 ? s * 32768 : s * 32767, true);
      off += 2;
    }
    return new Uint8Array(buf);
  }

  return { wav: wav, sayInt: sayInt, sayDecimal: sayDecimal, sayYear: sayYear, sampleRate: SR };
});
