/* Warner Records Store — SAMPLE / DEMO DATA generator.
 * Deterministic (seeded) synthetic data modeled on the public catalog of shop.warnerrecords.com
 * (artists, formats, price points). Sales, traffic, ads, CRM and Amazon figures are invented.
 * Storefronts: 0 = Shopify DTC, 1 = Amazon US, 2 = Amazon UK, 3 = Amazon DE (all reported in USD).
 * Runs in browser (window.WRData) and Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WRData = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SEED = 20261027;
  var START = Date.UTC(2025, 4, 1); // 2025-05-01
  var END = Date.UTC(2026, 9, 27);  // 2026-10-27 (today)
  var DAY = 86400000;
  var NDAYS = Math.round((END - START) / DAY) + 1;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var rnd;
  function gauss() { var u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function poisson(l) { if (l <= 0) return 0; if (l > 40) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss())); var L = Math.exp(-l), k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; }
  function pickW(cum, total) { var r = rnd() * total, lo = 0, hi = cum.length - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return lo; }
  function iso(d) { return new Date(START + d * DAY).toISOString().slice(0, 10); }
  function dayOf(s) { var p = s.split('-'); return Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - START) / DAY); }

  var CATEGORIES = ['Vinyl LPs', 'Colored & Limited Vinyl', 'Signed & Store Exclusives', 'CDs', 'Cassettes & 7" Singles', 'Box Sets & Deluxe', 'Apparel', 'Accessories & Posters', 'Bundles'];
  var CAT_CODE = ['LP', 'CV', 'SX', 'CD', 'CS', 'BX', 'AP', 'AC', 'BN'];
  var CHANNELS = ['Organic Search', 'Organic Social', 'Paid Search', 'Paid Social', 'Email', 'SMS', 'Direct', 'Affiliate & Referral', 'Amazon Organic', 'Amazon Sponsored Ads'];
  var DTC_CH = 8; // channels 0..7 are Shopify DTC traffic sources, 8..9 are Amazon
  var STORES = ['Shopify DTC', 'Amazon US', 'Amazon UK', 'Amazon DE'];
  var SOCIAL = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X'];
  var REGIONS = ['West', 'South', 'Northeast', 'Midwest', 'International'];
  var RET = [0.028, 0.03, 0.02, 0.012, 0.015, 0.035, 0.055, 0.025, 0.04];
  // [artist, title, cat, price, cost, weight, opts]  opts: l=pre-order/launch date, r=street date, a=allocation (units), x=not on Amazon, h=holiday title
  var P = [
    ['Zach Bryan', 'The Great American Bar Scene 2LP', 0, 39.98, 15, 9],
    ['Zach Bryan', 'Zach Bryan Vinyl 2LP', 0, 34.98, 14, 4.5],
    ['Zach Bryan', 'American Heartbreak 3LP', 0, 44.98, 18, 3.6],
    ['Zach Bryan', 'Elisabeth 2LP', 0, 36.98, 14, 3.8, { l: '2026-10-02', r: '2026-11-13' }],
    ['Green Day', 'SAVIORS Deluxe 180g Black Vinyl LP', 0, 31.98, 12, 2.6],
    ['Linkin Park', 'FROM ZERO Standard Vinyl LP', 0, 27.98, 11, 5],
    ['Linkin Park', 'PAPERCUTS Standard Black Vinyl 2LP', 0, 39.98, 15, 3],
    ['My Chemical Romance', 'The Black Parade Vinyl 2LP', 0, 39.98, 15, 6],
    ['My Chemical Romance', 'Three Cheers for Sweet Revenge Vinyl LP', 0, 24.98, 10, 3.6],
    ['Mac Miller', 'Circles Vinyl 2LP', 0, 39.98, 15, 3],
    ['Mac Miller', 'Balloonerism Vinyl 2LP', 0, 39.98, 15, 2.3],
    ['Gorillaz', 'Demon Days (2LP Black)', 0, 39.98, 15, 3.3],
    ['Dijon', 'Baby Vinyl LP (Black)', 0, 29.98, 11, 1.8, { l: '2025-06-17', r: '2025-08-15' }],
    ['sombr', 'I Barely Know Her Black Vinyl', 0, 24.98, 10, 3, { l: '2025-06-27', r: '2025-08-22' }],
    ['The Black Keys', 'No Rain, No Flowers Bone Vinyl LP', 0, 27.98, 11, 2, { l: '2025-05-20', r: '2025-08-08' }],
    ['Billy Strings', 'So Much For Goodbyes Vinyl 2LP', 0, 39.98, 15, 2.4, { l: '2026-08-21', r: '2026-11-06' }],
    ['Madonna', 'CONFESSIONS II – 12-track Standard Vinyl LP', 0, 29.98, 11, 2.4, { l: '2026-04-24', r: '2026-06-12' }],
    ['Weezer', 'Weezer (Blue Album) Black Vinyl', 0, 27.98, 11, 1.5],
    ['Tom Petty & The Heartbreakers', 'Finding Wildflowers Standard Black 2LP', 0, 29.98, 12, 1.3],
    ['Biffy Clyro', 'Futique LP', 0, 27.98, 11, 0.9, { l: '2025-07-01', r: '2025-09-26' }],
    ['Benson Boone', 'American Heart – Red White and Blue Marble Vinyl', 1, 29.98, 12, 3.4, { l: '2025-05-16', r: '2025-06-20' }],
    ['My Chemical Romance', 'Three Cheers (Deluxe) Red & Black Marble Vinyl 2LP', 1, 36.98, 14, 2.9],
    ['Mac Miller', 'GO:OD AM Silver Vinyl 2LP', 1, 36.98, 14, 2.3],
    ['Linkin Park', 'FROM ZERO (Deluxe) Translucent Emerald Green Vinyl 2LP', 1, 39.98, 15, 3, { l: '2025-05-16' }],
    ['Linkin Park', 'From Zero Alternate Cover 1 Blueberry Vinyl LP', 1, 31.98, 12, 1.9],
    ['Green Day', 'Warning 25th Anniversary Neon Orange Vinyl LP', 1, 27.98, 11, 2.4, { l: '2025-08-14', r: '2025-10-31' }],
    ['Green Day', 'SAVIORS Store Exclusive Bluejay Marble Vinyl LP', 1, 27.98, 11, 1.7, { x: 1 }],
    ['Deftones', 'Private Music Initial Pressing Ultra Clear Vinyl LP', 1, 29.98, 12, 3, { l: '2025-06-24', r: '2025-08-22' }],
    ['Muse', 'The Wow! Signal Red Vinyl', 1, 27.98, 11, 2, { l: '2026-08-21', r: '2026-09-26' }],
    ['Michael Bublé', 'Christmas (Red Vinyl)', 1, 17.58, 8, 2.6, { h: 1 }],
    ['Dolly Parton', 'A Holly Dolly Christmas (2LP White Vinyl)', 1, 34.98, 14, 1.2, { h: 1 }],
    ['Cher', 'Christmas Ruby Red Vinyl LP', 1, 19.98, 8.5, 0.9, { h: 1 }],
    ['Neil Young', "Tonight's The Night 50th Anniversary Clear 2LP", 1, 49.98, 19, 1],
    ['The Black Keys', 'Brothers – Limited Edition Cola Bottle Clear Vinyl 2LP', 1, 39.98, 15, 2.1, { l: '2026-10-02', r: '2026-11-20' }],
    ['Nessa Barrett', 'AFTERCARE Neon Green Vinyl LP', 1, 29.98, 12, 1.3],
    ['Gavin Adcock', 'Own Worst Enemy Gold Vinyl 2LP', 1, 29.98, 12, 2.1],
    ['Josh Groban', 'Gems Clear Vinyl 2LP', 1, 39.98, 15, 0.8],
    ['Billy Strings', 'Highway Prayers Evergreen & Cola Bottle Clear Splatter 2LP', 1, 49.98, 19, 1],
    ['Deftones', 'Private Music Store Exclusive Metallic Gold Vinyl LP', 2, 34.98, 13, 2.6, { l: '2025-06-24', r: '2025-08-22', a: 6000, x: 1 }],
    ['Michael Bublé', 'Christmas 10th Anniversary Super Deluxe Box Set (Signed)', 2, 99.98, 42, 0.7, { l: '2025-11-03', a: 1000, x: 1, h: 1 }],
    ['Green Day', 'Warning 25th Anniversary Deluxe Box Set (RSD Black Friday)', 2, 149.98, 65, 0.6, { l: '2025-11-28', a: 1200, x: 1 }],
    ['Linkin Park', 'FROM ZERO League of Legends Worlds Picture Disc', 2, 39.98, 15, 1.6, { l: '2025-10-14', a: 4000, x: 1 }],
    ['Neil Young', 'Oceanside Countryside Clear LP (RSD Exclusive)', 2, 27.98, 11, 1.4, { l: '2026-04-18', a: 2000, x: 1 }],
    ['Madonna', 'CONFESSIONS II – Exclusive Picture Disc', 2, 16, 7, 1.5, { l: '2026-04-27', a: 2500, x: 1 }],
    ['Warren Zeiders', 'No Brakes – Signed Jade Green Vinyl LP', 2, 27.98, 11, 1.7, { l: '2026-07-17', a: 1500, x: 1 }],
    ['Muse', "The Wow! Signal Vinyl (Store Exclusive Collectors' Edition)", 2, 44.98, 17, 2.4, { l: '2026-08-21', a: 3000, x: 1 }],
    ['Rachel Chinouriri', 'Limited White Label Pressing (Store Exclusive)', 2, 25.98, 10, 1, { l: '2026-09-04', a: 1500, x: 1 }],
    ['Gavin Adcock', 'The Day I Hang It Up Signed Alt Cover 2 Cherry Vinyl 2LP', 2, 46.98, 17, 2.4, { l: '2026-09-22', a: 2000, x: 1 }],
    ['Lydia Night', 'Parody of Pleasure Signed Baby Pink Vinyl', 2, 27.98, 11, 1.1, { l: '2026-09-22', a: 800, x: 1 }],
    ['Lucky Daye', 'ALOUD Signed Orange Vinyl', 2, 31.98, 12, 1.6, { l: '2026-10-02', a: 1500, x: 1 }],
    ['Blake Whiten', 'Something To Say Signed Vinyl', 2, 24.98, 10, 1, { l: '2026-10-23', a: 500, x: 1 }],
    ['Benson Boone', 'American Heart CD', 3, 14.98, 2.6, 2.4, { l: '2025-05-16', r: '2025-06-20' }],
    ['Deftones', 'Private Music CD', 3, 14.98, 2.6, 1.6, { l: '2025-06-24', r: '2025-08-22' }],
    ['Zach Bryan', 'The Great American Bar Scene CD', 3, 14.98, 2.6, 3],
    ['Zach Bryan', 'Elisabeth CD', 3, 14.98, 2.6, 1.8, { l: '2026-10-02', r: '2026-11-13' }],
    ['Madonna', 'CONFESSIONS II – 16-track Deluxe CD', 3, 34.98, 6, 1.4, { l: '2026-04-24', r: '2026-06-12' }],
    ['JISOO', 'AMORTAGE (BLACK ver.)', 3, 29.98, 7, 1.9],
    ['JISOO', 'AMORTAGE (PURPLE ver.)', 3, 29.98, 7, 1.5],
    ['Linkin Park', 'FROM ZERO Standard CD', 3, 14.98, 2.6, 2.3],
    ['Green Day', 'American Idiot CD', 3, 11.99, 2.2, 2],
    ['Michael Bublé', 'Christmas CD', 3, 11.18, 2.2, 2, { h: 1 }],
    ['Josh Groban', 'Harmony CD', 3, 18.98, 3, 0.7],
    ['Dua Lipa', 'Future Nostalgia CD', 3, 11.99, 2.2, 1.7],
    ['Teddy Swims', "I've Tried Everything But Therapy (Complete Edition) 2CD", 3, 24.98, 4.5, 1.2],
    ['Gavin Adcock', 'Own Worst Enemy Standard CD', 3, 11.98, 2.2, 1.1],
    ['sombr', 'back to friends 7" White Vinyl', 4, 7.99, 3, 2.8],
    ['Benson Boone', 'The Time Of My Life 7" Vinyl', 4, 9.98, 3.4, 1, { l: '2026-06-25' }],
    ['Muse', 'The Wow! Signal Cassette (Store Exclusive)', 4, 14.98, 3.5, 1.1, { l: '2026-08-21', x: 1 }],
    ['Madonna', 'CONFESSIONS II – Standard Cassette', 4, 15.98, 3.5, 1, { l: '2026-04-24', r: '2026-06-12' }],
    ['Deftones', 'Private Music Cassette', 4, 15.98, 3.5, 1, { l: '2025-06-24', r: '2025-08-22' }],
    ['Nessa Barrett', 'pretty poison Cassette Tape', 4, 9.98, 3, 0.5],
    ['Weezer', 'Relic WZR.C01 – Signal Capture Cassette', 4, 15.98, 3.5, 0.4],
    ['Dua Lipa', 'Training Season Cassette Single (Limited)', 4, 7.5, 2.6, 0.8],
    ['Green Day', 'Dookie 30th Anniversary Color Vinyl Box Set', 5, 174.98, 80, 0.7],
    ['Green Day', 'American Idiot (20th Anniversary) Super Deluxe Box Set', 5, 199.98, 90, 0.5],
    ['Deftones', 'White Pony (20th Anniversary) Super Deluxe Box Set', 5, 129.98, 55, 0.6],
    ['Teddy Swims', "I've Tried Everything But Therapy Complete 3LP", 5, 69.98, 27, 2],
    ['Tom Petty & The Heartbreakers', 'An American Treasure 6LP Vinyl Box Set', 5, 149.98, 62, 0.45],
    ['The Black Keys', 'El Camino (10th Anniversary Super Deluxe) 5LP', 5, 149.98, 62, 0.4],
    ['Linkin Park', 'Meteora 20th Anniversary Deluxe Vinyl Box Set', 5, 89.98, 38, 0.8],
    ['Linkin Park', 'Meteora – One Step Vinyl LP', 5, 99.98, 45, 0.4],
    ['Michael Bublé', 'Christmas 10th Anniversary Super Deluxe Box Set', 5, 99.98, 42, 0.6, { h: 1 }],
    ['Green Day', 'Blue Skull T-Shirt', 6, 30, 9, 2.4],
    ['Green Day', 'Warning Photo Zip Hoodie', 6, 80, 24, 0.8],
    ['My Chemical Romance', 'Revenge Rosary Hoodie', 6, 90, 26, 1.2, { x: 1 }],
    ['My Chemical Romance', 'Black Parade Raglan Tee', 6, 50, 13, 1.6],
    ['Teddy Swims', 'Lose Control Tee', 6, 35, 10, 1.4],
    ['Teddy Swims', 'Teddy Holiday Sweater', 6, 80, 24, 0.5, { h: 1, x: 1 }],
    ['Gorillaz', 'Brushed Font Logo Hoodie Black', 6, 60, 18, 0.9],
    ['Liam Gallagher', 'RKID Hoodie Black', 6, 69.99, 21, 0.6],
    ['Foals', 'Diamond Flowers Tour Black T-Shirt', 6, 29.99, 9, 0.3],
    ['Lydia Night', 'Lydia Night Logo T-Shirt', 6, 36, 10, 0.6, { l: '2026-09-22', x: 1 }],
    ['bunii', 'BUNIIVERSITY White Cardigan', 6, 80, 24, 0.5, { l: '2026-09-18', x: 1 }],
    ['Lydia Night', 'Lydia Night Pin Pack', 7, 28, 6, 0.4, { l: '2026-09-22', x: 1 }],
    ['Lydia Night', 'Gutter Dad Hat', 7, 40, 11, 0.4, { l: '2026-09-22', x: 1 }],
    ['Warner Records', 'BUNIIVERSITY HONOR ROLL Yard Sign', 7, 20, 5, 0.3, { l: '2026-09-18', x: 1 }],
    ['Warner Records', 'Gaming Mouse Pad / Slipmat', 7, 30, 7, 0.5],
    ['Deftones', 'Private Music Cross Body Bag', 7, 50, 15, 0.6, { l: '2025-06-24' }],
    ['Liam Gallagher', 'Why Tea Why Not Mug Black/White', 7, 13.99, 4, 0.5],
    ['bunii', 'BUNIIVERSITY Corduroy Baseball Cap', 7, 35, 9, 0.4, { l: '2026-09-18', x: 1 }],
    ['Deftones', 'Private Music Vinyl x Windbreaker Box Set', 8, 150, 55, 0.8, { l: '2025-06-24', a: 2500, x: 1 }],
    ['Zach Bryan', 'Elisabeth 2LP + CD Bundle', 8, 49.98, 17, 0.9, { l: '2026-10-02', x: 1 }],
    ['Teddy Swims', 'Complete Edition 3LP + Lose Control Tee Bundle', 8, 99.98, 36, 0.5, { x: 1 }],
    ['Green Day', 'SAVIORS LP + Blue Skull Tee Bundle', 8, 54.98, 20, 0.5, { x: 1 }]
  ];
  var MONTH = [.85, .8, .86, .95, .9, .86, .9, .88, .95, 1.0, 1.25, 1.55];
  var HOLI = [.3, .18, .18, .18, .18, .2, .45, .25, .35, .8, 2.6, 4.8];
  var WD = [1.08, .9, .9, .95, 1.0, 1.12, 1.05];
  // Amazon fee model (USD): referral rate, per-unit FBA, closing fee for media categories
  var AMZ_REF = [.15, .15, .15, .15, .15, .15, .17, .17, .15], AMZ_FBA = [4.35, 4.35, 4.35, 3.22, 3.22, 7.95, 4.75, 4.1, 6], AMZ_CLOSE = [1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 0, 0, 0];
  var MKT_FBA = [0, 1, 1.12, 1.2], MKT_TREND = [0, .1, .45, .03], MKT_SHARE = [0, .72, .18, .1];

  function generate() {
    rnd = mulberry32(SEED);
    var products = P.map(function (p, i) {
      var o = p[6] || {};
      return { id: i, sku: 'WR-' + CAT_CODE[p[2]] + '-' + String(1001 + i), artist: p[0], title: p[1], name: p[0] + ' – ' + p[1], cat: p[2], price: p[3], cost: p[4], w: p[5],
        launch: o.l ? dayOf(o.l) : -9999, release: o.r ? iso(Math.min(dayOf(o.r), 99999)) : null, rel: o.r ? dayOf(o.r) : null, alloc: o.a || 0, amz: !o.x, holiday: !!o.h, sold: 0 };
    });
    var bf = [dayOf('2025-11-28'), dayOf('2026-11-27')], rsd = [dayOf('2025-11-28'), dayOf('2026-04-18')];
    var viral = [dayOf('2026-10-05'), dayOf('2026-10-27')]; // sombr organic TikTok moment (synthetic)
    var events = {}, amzEv = {};
    function ev(s, m, tgt) { tgt = tgt || events; var d = dayOf(s); if (d >= 0 && d < NDAYS) tgt[d] = (tgt[d] || 1) * m; }
    // BFCM 2025 (Black Friday = RSD Black Friday)
    ev('2025-11-21', 1.15); ev('2025-11-24', 1.2); ev('2025-11-25', 1.25); ev('2025-11-26', 1.35); ev('2025-11-27', 1.5); ev('2025-11-28', 3.1); ev('2025-11-29', 2.0); ev('2025-11-30', 1.7); ev('2025-12-01', 2.5); ev('2025-12-02', 1.5);
    ev('2025-12-15', 1.25); ev('2025-12-16', 1.3); ev('2025-12-17', 1.2); ev('2025-12-22', .8); ev('2025-12-23', .65); ev('2025-12-24', .5); ev('2025-12-25', .45); ev('2025-12-26', 1.05);
    // Record Store Day (April) and holiday-in-July / long weekends
    ev('2026-04-17', 1.2); ev('2026-04-18', 1.9); ev('2026-04-19', 1.4); ev('2026-04-20', 1.15);
    ev('2025-07-25', 1.1); ev('2026-07-24', 1.15); ev('2026-07-25', 1.2); ev('2026-07-26', 1.1);
    ev('2025-09-01', 1.2); ev('2026-09-07', 1.2); ev('2026-05-25', 1.2); ev('2026-02-14', 1.1);
    // Amazon tentpoles (Prime Day / Prime Big Deal Days dates for 2026 are assumptions)
    [['2025-07-08', 2.1], ['2025-07-09', 2.0], ['2025-07-10', 1.8], ['2025-07-11', 1.9], ['2025-10-07', 1.8], ['2025-10-08', 1.7], ['2026-07-14', 2.2], ['2026-07-15', 2.1], ['2026-07-16', 1.8], ['2026-07-17', 1.6], ['2026-10-06', 1.85], ['2026-10-07', 1.75],
      ['2025-11-27', 1.4], ['2025-11-28', 2.4], ['2025-11-29', 1.8], ['2025-11-30', 1.6], ['2025-12-01', 2.1], ['2025-12-02', 1.4], ['2025-12-22', .85], ['2025-12-24', .55], ['2025-12-25', .5]].forEach(function (x) { ev(x[0], x[1], amzEv); });
    var launchBoost = {};
    products.forEach(function (p) {
      if (p.launch > 0 && p.launch < NDAYS) { var k = 1 + Math.min(.45, .07 * p.w); events[p.launch] = (events[p.launch] || 1) * k; events[p.launch + 1] = (events[p.launch + 1] || 1) * (1 + (k - 1) * .4); launchBoost[p.launch] = 1; }
      if (p.rel != null && p.rel < NDAYS) { events[p.rel] = (events[p.rel] || 1) * (1 + Math.min(.25, .04 * p.w)); amzEv[p.rel] = (amzEv[p.rel] || 1) * (1 + Math.min(.3, .05 * p.w)); }
    });
    function discount(d, cat, store, excl) {
      if (excl) return 0;
      if (store === 0) {
        if (d >= bf[0] - 3 && d <= bf[0] + 4) return cat === 3 ? .25 : cat === 6 || cat === 7 ? .3 : .2;
        if (d >= rsd[1] - 1 && d <= rsd[1] + 2 && cat <= 1) return .1;
        if (events[d] > 1.15 && !launchBoost[d]) return .1;
        return rnd() < .08 ? .1 : 0;
      }
      if ((amzEv[d] || 1) > 1.5 && cat !== 6) return .15;
      return 0;
    }
    function pw(p, d, m, store) { // product demand weight
      if (d < p.launch || (p.alloc && p.sold >= p.alloc)) return 0;
      if (store > 0 && !p.amz) return 0;
      var w = p.w;
      if (p.holiday) { w *= HOLI[m]; var dt = new Date(START + d * DAY); if (m === 11 && dt.getUTCDate() > 21) w *= .4; }
      if (p.launch > 0) { var age = d - p.launch; w *= 1 + (store ? 3 : 12) * Math.exp(-age / 4) + (age < 45 ? .5 : 0); if (p.rel != null && d < p.rel) w *= .85; }
      if (p.rel != null && d >= p.rel) w *= 1 + (store ? 5 : 3) * Math.exp(-(d - p.rel) / 5);
      if (p.artist === 'My Chemical Romance' && d >= dayOf('2025-07-11') && d <= dayOf('2025-09-10')) w *= 1.8; // Black Parade tour
      if (p.artist === 'sombr' && d >= viral[0]) w *= 2.2;
      if (p.cat <= 1 && d >= rsd[1] - 1 && d <= rsd[1] + 2) w *= 1.4;
      if (p.cat === 3 && store > 0) w *= 1.35; // CD buyers skew to Amazon
      if (p.cat >= 6 && store > 0) w *= .45;
      if (p.title.indexOf('Gems') >= 0 || p.title.indexOf('Harmony') >= 0 || p.title.indexOf('pretty poison') >= 0 || p.title.indexOf('Relic') >= 0) w *= 1.15 - .7 * d / NDAYS; // fading
      return w;
    }
    var dayFactor = new Float64Array(NDAYS), sessions = [], NCH = CHANNELS.length;
    var oDay = [], oChan = [], oReg = [], oNew = [], oLine = [], oStore = [], oSoc = [], lProd = [], lQty = [], lRev = [], lRet = [], lFee = [], lFeeRef = [];
    var chanBase = [.16, .11, .10, .13, .16, .07, .19, .08], regW = [.31, .27, .2, .14, .08], usReg = [.33, .29, .22, .16];
    var sombrIdx = products.filter(function (p) { return p.artist === 'sombr'; }).map(function (p) { return p.id; });
    for (var d = 0; d < NDAYS; d++) {
      var dt = new Date(START + d * DAY), m = dt.getUTCMonth(), wd = dt.getUTCDay();
      var trend = 1 + 0.2 * d / 365;
      var f = trend * MONTH[m] * WD[wd] * (events[d] || 1) * Math.exp(0.07 * gauss());
      if (m === 11 && dt.getUTCDate() <= 20) f *= 1.06;
      dayFactor[d] = f;
      var sess = new Array(STORES.length * NCH).fill(0);
      for (var st = 0; st < STORES.length; st++) {
        var nOrders;
        if (st === 0) nOrders = poisson(520 * f);
        else { var fa = (1 + MKT_TREND[st] * d / 365) * MONTH[m] * (WD[wd] * .5 + .5) * (amzEv[d] || 1) * Math.exp(.08 * gauss()); nOrders = poisson(230 * MKT_SHARE[st] * fa); }
        var cum = new Float64Array(products.length), tot = 0;
        for (var i = 0; i < products.length; i++) { tot += pw(products[i], d, m, st); cum[i] = tot; }
        var cw, cc = [], ct = 0;
        if (st === 0) {
          cw = chanBase.slice(); var q4 = m >= 10 ? 1 : 0;
          cw[1] *= 1 + .45 * d / NDAYS; if (launchBoost[d] || launchBoost[d - 1]) cw[1] *= 1.8; if (d >= viral[0]) cw[1] *= 1.9;
          cw[3] *= 1 + .5 * q4 + .1 * d / NDAYS; cw[2] *= 1 + .2 * q4;
          if (wd === 2 || wd === 4) cw[4] *= 1.6; if (wd === 5) cw[5] *= 1.9; if (launchBoost[d]) { cw[4] *= 1.7; cw[5] *= 2.2; }
          if ((events[d] || 1) > 1.5) { cw[4] *= 1.8; cw[5] *= 2.4; cw[3] *= 1.3; }
          for (i = 0; i < cw.length; i++) { ct += cw[i]; cc.push(ct); }
        }
        var sw = [.36, .26 * (1 + .6 * d / NDAYS) * (d >= viral[0] ? 3 : 1), .13, .15 * (1 - .3 * d / NDAYS), .1 * (1 - .35 * d / NDAYS)], sc = [], stt = 0; for (i = 0; i < 5; i++) { stt += sw[i]; sc.push(stt); }
        var rc = [], rt = 0; for (i = 0; i < regW.length; i++) { rt += regW[i] * (i === 4 ? 1 + .5 * d / NDAYS : 1); rc.push(rt); }
        var urc = [], urt = 0; for (i = 0; i < 4; i++) { urt += usReg[i]; urc.push(urt); }
        var spShare = .28 + (m >= 10 ? .06 : 0) + .04 * d / NDAYS;
        var chOrd = new Array(NCH).fill(0);
        for (var o = 0; o < nOrders; o++) {
          var ch, rg, soc = 255;
          if (st === 0) { ch = pickW(cc, ct); rg = pickW(rc, rt); if (ch === 1) soc = pickW(sc, stt); }
          else { ch = rnd() < spShare ? 9 : 8; rg = st === 1 ? pickW(urc, urt) : 4; }
          var retProb = st ? .3 : .42 + .08 * d / NDAYS + (ch === 4 || ch === 5 ? .3 : 0) + (ch === 2 || ch === 3 ? -.12 : 0) + (ch === 1 ? -.1 : 0);
          var isNew = rnd() > retProb ? 1 : 0;
          oDay.push(d); oChan.push(ch); oReg.push(rg); oNew.push(isNew); oLine.push(lProd.length); oStore.push(st); oSoc.push(soc); chOrd[ch]++;
          var nl = st ? 1 + (rnd() < .12 ? 1 : 0) : 1 + (rnd() < .38 ? 1 : 0) + (rnd() < .12 ? 1 : 0);
          for (var l = 0; l < nl; l++) {
            var pi = (l === 0 && soc === 1 && d >= viral[0] && rnd() < .5) ? sombrIdx[rnd() < .6 ? 0 : 1] : pickW(cum, tot);
            var pr = products[pi];
            if (pw(pr, d, m, st) === 0) continue;
            var qty = (pr.cat === 3 || pr.cat === 4) && rnd() < .12 ? 2 : 1;
            if (pr.alloc) { if (pr.sold >= pr.alloc) continue; qty = 1; pr.sold += 1; }
            var unit = st ? pr.price * .94 : pr.price;
            var rev = Math.round(qty * unit * (1 - discount(d, pr.cat, st, pr.alloc > 0)) * 100) / 100;
            var fee = 0, feeRef = 0;
            if (st) { feeRef = rev * AMZ_REF[pr.cat]; fee = feeRef + qty * (AMZ_FBA[pr.cat] * MKT_FBA[st] + AMZ_CLOSE[pr.cat]); }
            lProd.push(pi); lQty.push(qty); lRev.push(rev); lFee.push(Math.round(fee * 100) / 100); lFeeRef.push(Math.round(feeRef * 100) / 100);
            lRet.push(rnd() < RET[pr.cat] * (st ? (st === 3 ? 2.2 : 1.6) : 1) * (d > NDAYS - 14 ? .4 : 1) ? 1 : 0);
          }
        }
        var ev1 = 1 + .25 * ((events[d] || 1) - 1) / 2.4;
        var crate = st ? [0, 0, 0, 0, 0, 0, 0, 0, .125, .085] : [.024, .011, .029, .013, .045, .05, .033, .027];
        for (i = 0; i < NCH; i++) if (crate[i]) sess[st * NCH + i] = Math.round(chOrd[i] / (crate[i] * (st ? 1 : ev1)) * (1 + .05 * gauss()));
      }
      sessions.push(sess);
    }
    oLine.push(lProd.length);
    var dayStart = new Int32Array(NDAYS + 1), di = 0;
    for (var k = 0; k < oDay.length; k++) { while (di <= oDay[k]) { dayStart[di++] = k; } }
    while (di <= NDAYS) dayStart[di++] = oDay.length;

    // ---------- Inventory (DTC warehouse + FBA per marketplace) ----------
    var vel = products.map(function () { return [0, 0, 0, 0]; });
    for (k = dayStart[NDAYS - 28]; k < oDay.length; k++) for (var li = oLine[k]; li < oLine[k + 1]; li++) vel[lProd[li]][oStore[k]] += lQty[li] / 28;
    var invRnd = mulberry32(SEED + 7);
    function byTitle(t) { for (var i = 0; i < products.length; i++) if (products[i].title === t) return i; return -1; }
    var forceRisk = {}, overstock = {}, fbaRisk = {};
    forceRisk[byTitle('The Great American Bar Scene 2LP')] = 11; forceRisk[byTitle('The Black Parade Vinyl 2LP')] = 9; forceRisk[byTitle('Christmas (Red Vinyl)')] = 40; forceRisk[byTitle('FROM ZERO Standard Vinyl LP')] = 14;
    overstock[byTitle('Gems Clear Vinyl 2LP')] = 260; overstock[byTitle('Harmony CD')] = 340; overstock[byTitle('pretty poison Cassette Tape')] = 420; overstock[byTitle('Relic WZR.C01 – Signal Capture Cassette')] = 380; overstock[byTitle('Futique LP')] = 230; overstock[byTitle('Diamond Flowers Tour Black T-Shirt')] = 300;
    fbaRisk[byTitle('The Great American Bar Scene CD')] = [0, 8, 40, 45]; fbaRisk[byTitle('Demon Days (2LP Black)')] = [0, 45, 10, 50];
    products.forEach(function (p, i) {
      p.vel = vel[i].map(function (v) { return Math.round(v * 1000) / 1000; }); p.velocity = p.vel[0] + p.vel[1] + p.vel[2] + p.vel[3];
      var v = p.vel[0];
      p.stock = [0, 0, 0, 0];
      if (p.alloc) { p.stock[0] = Math.max(0, p.alloc - p.sold); p.inbound = 0; p.inboundEta = null; }
      else {
        var cover = forceRisk[i] || overstock[i] || (70 + invRnd() * 110);
        p.stock[0] = Math.max(2, Math.round(v * cover));
        if (forceRisk[i]) { p.inbound = Math.round(v * 45); p.inboundEta = iso(NDAYS - 1 + (p.holiday ? 50 : 24 + (i % 3) * 6)); } // vinyl re-press lead time
        else if (invRnd() < .35) { p.inbound = Math.round(v * (30 + invRnd() * 40)); p.inboundEta = iso(NDAYS - 1 + 10 + Math.round(invRnd() * 40)); }
        else { p.inbound = 0; p.inboundEta = null; }
        for (var s = 1; s < 4; s++) if (p.amz) p.stock[s] = Math.round(p.vel[s] * (fbaRisk[i] ? fbaRisk[i][s] : 35 + invRnd() * 45));
      }
      p.onHand = p.stock[0] + p.stock[1] + p.stock[2] + p.stock[3];
      delete p.w;
    });

    // ---------- Paid media ----------
    var CAMPAIGNS = [ // platform, name, type, base daily spend, ROAS, CPM, CTR, newShare, start, end, opts
      ['Google', 'Brand Search – Warner Records Store', 'Search', 260, 10.5, 34, .09, .3],
      ['Google', 'Non-Brand Search – Vinyl Records & Box Sets', 'Search', 380, 3.0, 28, .045, .7],
      ['Google', 'Performance Max – Shopping Feed', 'Shopping', 700, 4.3, 9, .012, .6, null, null, { late: 1 }],
      ['Google', 'YouTube – New Release Pre-roll', 'YouTube', 240, 1.3, 7.5, .006, .8],
      ['Meta', 'Prospecting – Alt/Rock & Country Fans', 'Prospecting', 560, 2.0, 11, .011, .8, null, null, { wave: 1 }],
      ['Meta', 'Retargeting – DPA Viewed Not Purchased', 'Retargeting', 240, 6.6, 14, .018, .22],
      ['Meta', 'Advantage+ Shopping', 'ASC', 520, 3.7, 10, .013, .58, null, null, { late: 1 }],
      ['Meta', 'Holiday Vinyl Gift Guide 2025', 'Seasonal', 900, 3.3, 12, .014, .7, '2025-11-10', '2025-12-21'],
      ['Meta', 'Pre-order Push – Deftones Private Music', 'Launch', 450, 5.2, 12, .016, .5, '2025-06-24', '2025-08-31'],
      ['Meta', 'Pre-order Push – Zach Bryan Elisabeth', 'Launch', 480, 4.8, 12, .016, .55, '2026-10-02', '2026-10-27'],
      ['TikTok', 'Spark Ads – Fan Unboxing Videos', 'Spark Ads', 260, 1.9, 6.5, .009, .85, '2025-08-01'],
      ['TikTok', 'TopView – Muse The Wow! Signal Launch', 'TopView', 650, 0.62, 9.5, .007, .9, '2026-08-14', '2026-10-27', { decay: 1 }],
      ['TikTok', 'Creator Collab – Holiday Vinyl Hauls', 'Creator', 340, 2.4, 7, .01, .86, '2025-11-01', '2026-01-05']
    ];
    var prnd = mulberry32(SEED + 99);
    function pg() { var u = 1 - prnd(), v = prnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var media = [];
    CAMPAIGNS.forEach(function (c, ci) {
      var op = c[10] || {}, s = c[8] ? dayOf(c[8]) : 0, e = c[9] ? Math.min(NDAYS - 1, dayOf(c[9])) : NDAYS - 1;
      var row = { id: ci, platform: c[0], name: c[1], type: c[2], store: 0, start: iso(Math.max(0, s)), end: iso(e), spend: [], impr: [], clicks: [], conv: [], rev: [], newc: [] };
      for (var d = 0; d < NDAYS; d++) {
        if (d < s || d > e) { row.spend.push(0); row.impr.push(0); row.clicks.push(0); row.conv.push(0); row.rev.push(0); row.newc.push(0); continue; }
        var f = Math.pow(dayFactor[d], .8), age = d - s;
        var sp = 1.2 * c[3] * f * (c[8] ? (age < 7 ? 1.4 : 1) : 1) * Math.exp(.12 * pg());
        if (op.decay) sp *= 1 + .4 * Math.exp(-age / 10);
        var roas = c[4] * Math.exp(.18 * pg()) * (op.wave ? 1 + .15 * Math.sin(d / 40) : 1) * (op.decay ? Math.max(.35, 1.4 - age / 60) : 1);
        if (op.late && d > NDAYS - 120) roas *= 1.12;
        var impr = sp / c[5] * 1000, clicks = impr * c[6] * Math.exp(.1 * pg());
        var rev = sp * roas, aov = c[0] === 'Google' ? 62 : c[0] === 'Meta' ? 55 : 44;
        var conv = Math.max(0, Math.round(rev / aov));
        row.spend.push(Math.round(sp * 100) / 100); row.impr.push(Math.round(impr)); row.clicks.push(Math.round(clicks));
        row.conv.push(conv); row.rev.push(Math.round(conv * aov * Math.exp(.05 * pg()))); row.newc.push(Math.round(conv * c[7] * (1 + .1 * pg())));
      }
      media.push(row);
    });
    // Amazon Ads: attributed sales tie back to the 'Amazon Sponsored Ads' orders in each marketplace
    var spRev = [null, new Float64Array(NDAYS), new Float64Array(NDAYS), new Float64Array(NDAYS)], spOrd = [null, new Float64Array(NDAYS), new Float64Array(NDAYS), new Float64Array(NDAYS)];
    for (k = 0; k < oDay.length; k++) if (oChan[k] === 9) { spOrd[oStore[k]][oDay[k]]++; for (li = oLine[k]; li < oLine[k + 1]; li++) spRev[oStore[k]][oDay[k]] += lRev[li]; }
    var AMZC = [ // marketplace, name, type, share of SP-attributed sales, ACoS, CPC
      [1, 'SP – Auto – Full Catalog', 'Sponsored Products', .30, .34, .62], [1, 'SP – Manual Exact – Artist & Album Keywords', 'Sponsored Products', .34, .17, .62],
      [1, 'SP – Product Targeting – New Releases', 'Sponsored Products', .18, .29, .62], [1, 'Sponsored Brands – Warner Records Store', 'Sponsored Brands', .18, .21, .8],
      [2, 'SP – Auto – Full Catalog', 'Sponsored Products', .45, .31, .58], [2, 'SP – Manual – Artist Keywords', 'Sponsored Products', .55, .19, .58],
      [3, 'SP – Auto – Full Catalog', 'Sponsored Products', .6, .52, .55], [3, 'SP – Manual – Artist Keywords', 'Sponsored Products', .4, .27, .55]
    ];
    AMZC.forEach(function (c, j) {
      var row = { id: CAMPAIGNS.length + j, platform: 'Amazon Ads', name: STORES[c[0]].replace('Amazon ', '') + ' · ' + c[1], type: c[2], store: c[0], start: iso(0), end: iso(NDAYS - 1), spend: [], impr: [], clicks: [], conv: [], rev: [], newc: [] };
      for (var d = 0; d < NDAYS; d++) {
        var rv = spRev[c[0]][d] * c[3] * Math.exp(.1 * pg()), sp = rv * c[4] * Math.exp(.15 * pg()), cl = sp / (c[5] * Math.exp(.08 * pg())), cv = Math.round(spOrd[c[0]][d] * c[3]);
        row.spend.push(Math.round(sp * 100) / 100); row.rev.push(Math.round(rv)); row.clicks.push(Math.round(cl)); row.impr.push(Math.round(cl / .0042)); row.conv.push(cv); row.newc.push(Math.round(cv * .68));
      }
      media.push(row);
    });

    // ---------- CRM (Klaviyo-style, Shopify DTC only) ----------
    var crnd = mulberry32(SEED + 555);
    var emailList = [], smsList = [], eL = 640000, sL = 92000;
    var flowsDef = [['Welcome Series', 'email', .55, .07, .045, 0, 48], ['Abandoned Cart', 'email', .5, .09, .11, 900, 62], ['Browse Abandonment', 'email', .46, .06, .035, 700, 48],
      ['Back in Stock Alert', 'email', .6, .12, .08, 380, 40], ['Post-Purchase: Complete the Discography', 'email', .52, .045, .03, 320, 38], ['Winback (120 days)', 'email', .33, .025, .022, 600, 46], ['Abandoned Cart SMS', 'sms', .98, .12, .09, 260, 60]];
    var flows = flowsDef.map(function (f) { return { name: f[0], channel: f[1], sends: [], opens: [], clicks: [], conv: [], rev: [], unsubs: [] }; });
    var campaigns = [];
    var themes = ['New Release Friday: This Week\'s Vinyl', 'Store-Exclusive Colors: Pre-order Now', 'Back in Stock: Fan-Favorite Pressings', 'Artist Spotlight: Green Day', 'Staff Picks: Vinyl Club', 'Weekend Sale: 20% Off Catalog Vinyl', 'Signed Copies Just Dropped', 'Merch Drop: New Tour Tees', 'Anniversary Editions & Box Sets', 'Members Early Access'];
    for (var d2 = 0; d2 < NDAYS; d2++) {
      var dt2 = new Date(START + d2 * DAY), wd2 = dt2.getUTCDay(), f2 = dayFactor[d2];
      var signE = Math.round(520 * f2 * Math.exp(.15 * (crnd() - .5))), signS = Math.round(140 * f2 * (1 + .5 * d2 / NDAYS));
      var unE = Math.round(eL * .00016), unS = Math.round(sL * .0003);
      flows.forEach(function (fl, fi) {
        var fd = flowsDef[fi], base = fi === 0 ? signE * 2.6 : fd[5] * f2 * (1 + .25 * d2 / NDAYS);
        var sends = Math.round(base * Math.exp(.1 * (crnd() - .5)));
        var opens = Math.round(sends * fd[2] * (1 + .06 * (crnd() - .5))), clicks = Math.round(sends * fd[3] * (1 + .1 * (crnd() - .5)));
        var conv = Math.round(clicks * fd[4] * 2.6 * (1 + .15 * (crnd() - .5)));
        fl.sends.push(sends); fl.opens.push(opens); fl.clicks.push(clicks); fl.conv.push(conv);
        fl.rev.push(Math.round(conv * fd[6])); fl.unsubs.push(Math.round(sends * (fd[1] === 'sms' ? .004 : .0012)));
      });
      var isBF = d2 >= bf[0] - 7 && d2 <= bf[0] + 4, isRSD = d2 >= rsd[1] - 2 && d2 <= rsd[1];
      var dropP = null; for (var pi2 = 0; pi2 < products.length; pi2++) if (products[pi2].launch === d2 && (!dropP || P[pi2][5] > P[dropP.id][5])) dropP = products[pi2];
      var nameFor = function (type) {
        var key = iso(d2), pre = type === 'sms' ? 'SMS: ' : '';
        if (isBF) return pre + (d2 < bf[0] - 1 ? 'Black Friday Early Access' : d2 <= bf[0] + 2 ? 'Black Friday + RSD Exclusives Are Live' : 'Cyber Monday: Final Hours');
        if (dropP) return pre + (dropP.alloc ? 'Limited Drop: ' : 'Pre-order Now: ') + dropP.artist + ' – ' + dropP.title;
        if (isRSD) return pre + 'Record Store Day: Vinyl Week Deals';
        if (key >= '2025-12-08' && key <= '2025-12-18') return pre + (key >= '2025-12-15' ? 'Last Chance for Holiday Shipping' : 'Holiday Gift Guide: Vinyl for Everyone');
        return pre + themes[Math.floor(crnd() * themes.length)];
      };
      var doEmail = wd2 === 2 || wd2 === 4 || isBF || !!dropP || isRSD, doSms = (wd2 === 5 && (Math.floor(d2 / 7) % 2 === 0)) || (isBF && d2 % 2 === 0) || (dropP && P[dropP.id][5] >= 1.5);
      if (doEmail) {
        var rec = Math.round(eL * (isBF || dropP ? .9 : .55 + .3 * crnd())), or = .36 + .1 * crnd(), ctr = (isBF ? .034 : dropP ? .038 : .016 + .014 * crnd());
        var cl = Math.round(rec * ctr), cv = Math.round(cl * (isBF ? .06 : .028 + .02 * crnd())), un = Math.round(rec * (.0012 + .0022 * crnd()));
        if (iso(d2) === '2026-08-13') { un = Math.round(rec * .0068); }
        campaigns.push({ date: iso(d2), channel: 'email', name: nameFor('email'), recipients: rec, opens: Math.round(rec * or), clicks: cl, conv: cv, rev: Math.round(cv * (isBF ? 64 : dropP ? 52 : 50)), unsubs: un });
        unE += un;
      }
      if (doSms) {
        var rec2 = Math.round(sL * (.85 + .15 * crnd())), ctr2 = .07 + .06 * crnd() + (isBF ? .03 : 0);
        var cl2 = Math.round(rec2 * ctr2), cv2 = Math.round(cl2 * (.03 + .025 * crnd())), un2 = Math.round(rec2 * (.005 + .007 * crnd()));
        campaigns.push({ date: iso(d2), channel: 'sms', name: nameFor('sms'), recipients: rec2, opens: null, clicks: cl2, conv: cv2, rev: Math.round(cv2 * (dropP ? 48 : 55)), unsubs: un2 });
        unS += un2;
      }
      flows.forEach(function (fl) { if (fl.channel === 'email') unE += fl.unsubs[d2]; else unS += fl.unsubs[d2]; });
      eL += signE - unE; sL += signS - unS;
      emailList.push({ size: eL, signups: signE, unsubs: unE }); smsList.push({ size: sL, signups: signS, unsubs: unS });
    }

    return {
      meta: { seed: SEED, start: iso(0), end: iso(NDAYS - 1), ndays: NDAYS, generated: 'synthetic demo data', source: 'Catalog modeled on shop.warnerrecords.com/products.json (titles, formats, prices); all sales/traffic/ads/CRM/Amazon numbers invented', note: 'SAMPLE / DEMO DATA — not real Warner Records Store results' },
      categories: CATEGORIES, channels: CHANNELS, dtcChannels: DTC_CH, stores: STORES, social: SOCIAL, regions: REGIONS, products: products,
      orders: { day: Int16Array.from(oDay), chan: Uint8Array.from(oChan), reg: Uint8Array.from(oReg), isNew: Uint8Array.from(oNew), store: Uint8Array.from(oStore), soc: Uint8Array.from(oSoc), line: Int32Array.from(oLine), dayStart: dayStart },
      lines: { prod: Uint16Array.from(lProd), qty: Uint8Array.from(lQty), rev: Float32Array.from(lRev), ret: Uint8Array.from(lRet), fee: Float32Array.from(lFee), feeRef: Float32Array.from(lFeeRef) },
      sessions: sessions, nch: NCH, media: media, crm: { campaigns: campaigns, flows: flows, emailList: emailList, smsList: smsList },
      iso: iso, dayOf: dayOf
    };
  }

  // Compact JSON export (daily aggregates)
  function exportSummary(D) {
    D = D || generate();
    var n = D.meta.ndays, C = D.categories.length, S = D.stores.length;
    var daily = [], catDaily = [], storeDaily = [], socDaily = [];
    for (var d = 0; d < n; d++) {
      var rev = 0, orders = 0, units = 0, ret = 0, nw = 0, fee = 0, cr = [], sr = [0, 0, 0, 0], so = [0, 0, 0, 0, 0]; for (var c = 0; c < C; c++) cr.push(0);
      for (var o = D.orders.dayStart[d]; o < D.orders.dayStart[d + 1]; o++) {
        orders++; nw += D.orders.isNew[o];
        for (var l = D.orders.line[o]; l < D.orders.line[o + 1]; l++) { var r = D.lines.rev[l]; rev += r; units += D.lines.qty[l]; fee += D.lines.fee[l]; if (D.lines.ret[l]) ret += r; cr[D.products[D.lines.prod[l]].cat] += r; sr[D.orders.store[o]] += r; if (D.orders.soc[o] < 5) so[D.orders.soc[o]] += r; }
      }
      daily.push([D.iso(d), orders, units, Math.round(rev), Math.round(ret), nw, D.sessions[d].reduce(function (a, b) { return a + b; }, 0), Math.round(fee)]);
      catDaily.push(cr.map(Math.round)); storeDaily.push(sr.map(Math.round)); socDaily.push(so.map(Math.round));
    }
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    return {
      meta: D.meta, categories: D.categories, channels: D.channels, stores: D.stores, socialPlatforms: D.social, regions: D.regions,
      dailyColumns: ['date', 'orders', 'units', 'grossRevenue', 'returnedRevenue', 'newCustomers', 'sessions', 'amazonFees'], daily: daily, categoryDailyRevenue: catDaily, storefrontDailyGrossRevenue: storeDaily, organicSocialDailyGrossRevenue: socDaily,
      products: D.products.map(function (p) { return { sku: p.sku, artist: p.artist, title: p.title, category: D.categories[p.cat], price: p.price, cost: p.cost, onAmazon: p.amz, stockByStorefront: p.stock, inbound: p.inbound, inboundEta: p.inboundEta, velocity28dByStorefront: p.vel, launch: p.launch > 0 ? D.iso(p.launch) : null, streetDate: p.release }; }),
      paidMedia: D.media.map(function (m) { return { platform: m.platform, storefront: D.stores[m.store], campaign: m.name, type: m.type, start: m.start, end: m.end, spend: Math.round(sum(m.spend)), impressions: sum(m.impr), clicks: sum(m.clicks), conversions: sum(m.conv), revenue: sum(m.rev), newCustomers: sum(m.newc), dailySpend: m.spend.map(Math.round), dailyRevenue: m.rev }; }),
      crm: { campaigns: D.crm.campaigns, flows: D.crm.flows.map(function (f) { return { name: f.name, channel: f.channel, sends: sum(f.sends), opens: sum(f.opens), clicks: sum(f.clicks), conversions: sum(f.conv), revenue: sum(f.rev), unsubs: sum(f.unsubs) }; }), emailListSize: D.crm.emailList.map(function (x) { return x.size; }), smsListSize: D.crm.smsList.map(function (x) { return x.size; }) }
    };
  }
  return { generate: generate, exportSummary: exportSummary };
});
