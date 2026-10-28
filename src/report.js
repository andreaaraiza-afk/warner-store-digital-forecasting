/* Monthly analysis report. Computed in the browser from the dashboard data.
   Sales sections are synthetic DEMO DATA. Catalog suggestions are public. */
(function () {
  'use strict';
  var LS = 'wr-report-presets-v1';
  var SITE = 'https://andreaaraiza-afk.github.io/warner-store-digital-forecasting/';
  var HOSTED_AUDIO = SITE + 'wr-store-audio-summary.wav';
  var GMAIL_LIMIT = 7500;
  var SECTIONS = [
    { id: 'highlights', label: 'Highlights' },
    { id: 'channels', label: 'Channel performance' },
    { id: 'products', label: 'Products and artists' },
    { id: 'forecast', label: 'Forecast outlook' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'audio', label: 'Audio summary' },
    { id: 'method', label: 'How this report was built' },
    { id: 'notes', label: 'Custom notes' }
  ];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var api, state;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function D() { return api.data(); }
  function T() { return api.today(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m0, d) { return y + '-' + pad(m0 + 1) + '-' + pad(d); }
  function parts(iso) { var p = iso.split('-'); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function monthEnd(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }
  function addYears(iso, dy) { var p = parts(iso); var dt = new Date(Date.UTC(p.y + dy, p.m, p.d)); return dt.toISOString().slice(0, 10); }
  function pretty(iso) { var p = parts(iso); return MON[p.m] + ' ' + p.d + ', ' + p.y; }
  function monthLabel(start, end) {
    var a = parts(start), b = parts(end);
    if (a.y === b.y && a.m === b.m && a.d === 1 && b.d === monthEnd(b.y, b.m)) return MONTHS[a.m] + ' ' + a.y;
    return pretty(start) + ' – ' + pretty(end);
  }
  function rangePhrase(start, end) {
    var a = parts(start), b = parts(end);
    if (start === end) return MON[a.m] + ' ' + a.d + ', ' + a.y;
    if (a.y === b.y) return MON[a.m] + ' ' + a.d + ' – ' + MON[b.m] + ' ' + b.d + ', ' + b.y;
    return pretty(start) + ' – ' + pretty(end);
  }
  function storefrontShort(store) {
    if (store === -1) return 'All';
    if (store === 0) return 'Shopify';
    if (store === 10) return 'Amazon';
    if (store === 1) return 'Amazon US';
    if (store === 2) return 'Amazon UK';
    if (store === 3) return 'Amazon DE';
    return api.storeLabel(store);
  }
  function headerLine(m) {
    var f = m.filters;
    var chan = f.chan < 0 ? 'All' : f.chanLabel;
    var cat = f.cat < 0 ? 'All' : f.catLabel;
    return 'Warner Records Store · Storefront: ' + storefrontShort(f.store) + ' · Channel: ' + chan + ' · Category: ' + cat + ' · ' + rangePhrase(m.period.start, m.period.end);
  }
  function fm(v, d) {
    var s = api.fm(v, d);
    if (s.charAt(0) === '$' && s.charAt(1) === '-') return '-$' + s.slice(2);
    return s;
  }
  function fn(v) { return api.fn(v); }
  function fp(v, d) { return api.fp(v, d); }
  function sgn(p) { return api.sgn(p); }
  function vs(cur, base) { if (base == null) return 'n/a'; var p = api.pct(cur, base); return p == null ? 'n/a' : sgn(p); }
  function slot(id, html) {
    if (state.keepEdits && state.edits[id]) return '<div class="r-edit" data-block="' + esc(id) + '" data-dirty="1" contenteditable="true">' + state.edits[id] + '</div>';
    return '<div class="r-edit" data-block="' + esc(id) + '" contenteditable="true">' + html + '</div>';
  }
  function htm(headers, rows) {
    if (!rows.length) return '<p class="r-empty">Nothing to list for this filter.</p>';
    return '<table><thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  function resolvePeriod(opts) {
    var endIso = D().meta.end, p = parts(endIso), s, e, key = opts.period || 'last-month';
    if (key === 'mtd') { s = ymd(p.y, p.m, 1); e = endIso; }
    else if (key === '30') { e = endIso; s = D().iso(T() - 29); }
    else if (key === '90') { e = endIso; s = D().iso(T() - 89); }
    else if (key === 'custom') {
      s = opts.from || D().iso(T() - 29); e = opts.to || endIso;
      if (s > e) { var t = s; s = e; e = t; }
    } else {
      key = 'last-month';
      var last = monthEnd(p.y, p.m);
      var y = p.y, m = p.m;
      if (p.d < last) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
      s = ymd(y, m, 1); e = ymd(y, m, monthEnd(y, m));
    }
    var ds = D().dayOf(s), de = D().dayOf(e);
    if (ds < 0) ds = 0; if (de > T()) de = T(); if (ds > de) ds = de;
    s = D().iso(ds); e = D().iso(de);
    var len = de - ds + 1, ps = ds - len, pe = ds - 1, prev = null;
    if (pe >= 0) prev = { s: Math.max(0, ps), e: pe, partial: ps < 0, start: D().iso(Math.max(0, ps)), end: D().iso(pe) };
    var ys = D().dayOf(addYears(s, -1)), ye = D().dayOf(addYears(e, -1)), yoy = null;
    if (ye >= 0) yoy = { s: Math.max(0, ys), e: ye, partial: ys < 0, start: D().iso(Math.max(0, ys)), end: D().iso(ye) };
    if (yoy && yoy.partial && yoy.s > yoy.e) yoy = null;
    return { key: key, s: ds, e: de, start: s, end: e, days: len, label: monthLabel(s, e), prev: prev, yoy: yoy && !yoy.partial ? yoy : (yoy && yoy.partial ? null : yoy) };
  }

  function filt(opts) { return { store: +opts.store, chan: +opts.chan, cat: +opts.cat, reg: -1 }; }
  function aggAt(range, f) { if (!range) return null; return api.agg(range.s, range.e, f); }
  function chanOk(i, store) { var amz = i >= D().dtcChannels; if (store === 0 && amz) return false; if (store > 0 && !amz) return false; return true; }

  function channelRows(cur, prev, yoy, store, only) {
    var rows = [], net = cur.net || 0;
    D().channels.forEach(function (name, i) {
      if (!chanOk(i, store)) return;
      if (only >= 0 && i !== only) return;
      rows.push({
        name: name, rev: cur.chan[i],
        prev: prev ? prev.chan[i] : null,
        yoy: yoy ? yoy.chan[i] : null,
        share: net ? cur.chan[i] / net : 0
      });
    });
    rows.sort(function (a, b) { return b.rev - a.rev; });
    return rows;
  }
  function findChan(rows, name) { for (var i = 0; i < rows.length; i++) if (rows[i].name === name) return rows[i]; return { name: name, rev: 0, prev: null, yoy: null, share: 0 }; }
  function movers(cur, base, kind, store) {
    if (!base) return null;
    var labels = kind === 'cat' ? D().categories : D().channels;
    var a = kind === 'cat' ? cur.cat : cur.chan, b = kind === 'cat' ? base.cat : base.chan, out = [];
    for (var i = 0; i < labels.length; i++) {
      if (kind === 'chan' && !chanOk(i, store)) continue;
      out.push({ name: labels[i], cur: a[i], prev: b[i], delta: a[i] - b[i], pct: api.pct(a[i], b[i]) });
    }
    out.sort(function (x, y) { return y.delta - x.delta; });
    return { best: out[0], worst: out[out.length - 1], all: out };
  }

  function buildModel(opts) {
    opts = opts || {};
    var period = resolvePeriod(opts);
    var f = filt(opts);
    var cur = api.agg(period.s, period.e, f);
    var prev = period.prev ? api.agg(period.prev.s, period.prev.e, f) : null;
    var yoyR = period.yoy;
    var yoy = yoyR ? api.agg(yoyR.s, yoyR.e, f) : null;
    var store = f.store, only = f.chan, topN = Math.max(1, Math.min(15, +opts.topN || 5));
    var tone = opts.tone || 'marketing';
    var dtc = store === -1 || store === 0, amzOn = store !== 0;
    var chans = channelRows(cur, prev, yoy, store, only);
    var social = [];
    var socNet = 0;
    for (var si = 0; si < 5; si++) socNet += cur.soc[si];
    D().social.forEach(function (name, i) { social.push({ name: name, rev: cur.soc[i], share: socNet ? cur.soc[i] / socNet : 0 }); });
    social.sort(function (a, b) { return b.rev - a.rev; });

    var media = api.mediaAgg(period.s, period.e, '', store);
    var mediaPrev = period.prev ? api.mediaAgg(period.prev.s, period.prev.e, '', store) : null;
    var camps = media.rows.filter(function (x) { return x.spend > 50; }).map(function (x) {
      return { platform: x.m.platform, name: x.m.name, type: x.m.type, spend: x.spend, rev: x.rev, roas: x.roas, cac: x.cac, acos: x.acos, conv: x.conv };
    });
    var byRoas = camps.filter(function (x) { return x.roas != null; }).slice().sort(function (a, b) { return b.roas - a.roas; });
    var best = byRoas[0] || null, worst = byRoas.length ? byRoas[byRoas.length - 1] : null;
    var shiftFrom = camps.filter(function (x) { return x.spend > 1000; }).sort(function (a, b) { return a.roas - b.roas; })[0] || null;
    var shiftTo = camps.filter(function (x) { return x.spend > 500 && x.name.indexOf('Brand Search') < 0; }).sort(function (a, b) { return b.roas - a.roas; })[0] || null;
    var shift = null;
    if (shiftFrom && shiftTo && shiftFrom !== shiftTo && shiftTo.roas > shiftFrom.roas) {
      shift = { from: shiftFrom, to: shiftTo, gain: shiftFrom.spend * 0.5 * (shiftTo.roas - shiftFrom.roas) * 0.6 };
    }
    var platforms = Object.keys(media.plat).map(function (p) {
      var x = media.plat[p], y = mediaPrev && mediaPrev.plat[p];
      return { platform: p, spend: x.spend, rev: x.rev, roas: x.spend ? x.rev / x.spend : null, cac: x.newc ? x.spend / x.newc : null, prevRoas: y && y.spend ? y.rev / y.spend : null };
    }).sort(function (a, b) { return b.spend - a.spend; });

    var crm = api.crmAgg(period.s, period.e);
    var crmPrev = period.prev ? api.crmAgg(period.prev.s, period.prev.e) : null;
    var campsCrm = crm.camps.slice().sort(function (a, b) { return b.rev - a.rev; }).slice(0, topN);
    var flows = crm.flows.slice().sort(function (a, b) { return b.rev - a.rev; }).slice(0, topN);
    var emailRev = 0, smsRev = 0;
    crm.camps.forEach(function (c) { if (c.channel === 'sms') smsRev += c.rev; else emailRev += c.rev; });

    var markets = [];
    if (amzOn) {
      [1, 2, 3].forEach(function (s) {
        if (store !== -1 && store !== 10 && store !== s) return;
        var ads = api.mediaAgg(period.s, period.e, 'Amazon Ads', s);
        markets.push({
          name: D().stores[s], rev: cur.st[s], orders: cur.stOrd[s], fees: cur.stFee[s],
          feeRate: cur.st[s] ? cur.stFee[s] / cur.st[s] : null,
          adSpend: ads.spend, adRev: ads.rev, acos: ads.acos, roas: ads.roas
        });
      });
    }

    var products = [], artists = {};
    D().products.forEach(function (p, i) {
      if (f.cat >= 0 && p.cat !== f.cat) return;
      if (store > 0 && !p.amz) return;
      var rev = cur.pr[i], units = cur.pu[i];
      if (rev <= 0 && units <= 0) return;
      products.push({ title: p.title, artist: p.artist, cat: D().categories[p.cat], rev: rev, units: units, prev: prev ? prev.pr[i] : null });
      var ar = artists[p.artist] || (artists[p.artist] = { artist: p.artist, rev: 0, units: 0 });
      ar.rev += rev; ar.units += units;
    });
    products.sort(function (a, b) { return b.rev - a.rev; });
    var artistList = Object.keys(artists).map(function (k) { return artists[k]; }).sort(function (a, b) { return b.rev - a.rev; });

    var slow = [];
    D().products.forEach(function (p, i) {
      if (f.cat >= 0 && p.cat !== f.cat) return;
      if (store > 0 && !p.amz) return;
      if (p.alloc) return;
      if (p.launch > period.s) return;
      var inv = api.invFor(p, store);
      if (inv.onHand <= 0 || inv.vel <= 0) return;
      var cover = inv.onHand / inv.vel;
      if (cover < 180) return;
      slow.push({ title: p.title, artist: p.artist, cat: D().categories[p.cat], cover: cover, onHand: inv.onHand, rev: cur.pr[i], cost: inv.onHand * p.cost });
    });
    slow.sort(function (a, b) { return (a.rev / Math.max(1, a.cost)) - (b.rev / Math.max(1, b.cost)); });

    var fc = api.getForecast(store);
    var risk = [];
    fc.prods.forEach(function (x) {
      if (f.cat >= 0 && x.p.cat !== f.cat) return;
      if (!(x.so && x.inv.vel > 0 && !(x.p.alloc && x.p.stock[0] === 0))) return;
      var days = x.so - T();
      if (days > 90) return;
      risk.push({ title: x.p.title, artist: x.p.artist, cat: D().categories[x.p.cat], days: days, onHand: x.inv.onHand, lost: x.lost, so: D().iso(x.so) });
    });
    risk.sort(function (a, b) { return a.days - b.days; });
    var lostTot = fc.prods.reduce(function (a, x) { return a + (f.cat < 0 || x.p.cat === f.cat ? x.lost : 0); }, 0);

    var catalog = window.WRCatalog;
    var gaps = {}, topNames = {};
    artistList.slice(0, topN).forEach(function (a) { topNames[a.artist] = a.rev; });
    var artistIdeas = [];
    if (catalog) {
      catalog.artists.forEach(function (a) {
        a.suggestions.forEach(function (sg) {
          if (sg.group !== 'missing_format' && sg.group !== 'merch' && sg.group !== 'bundle' && sg.group !== 'signed_color' && sg.group !== 'pricing') return;
          var g = gaps[sg.text] || (gaps[sg.text] = { text: sg.text, group: sg.group, n: 0, reason: sg.reason, sample: [] });
          g.n++; if (g.sample.length < 3) g.sample.push(a.name);
        });
        if (topNames[a.name] && a.suggestions.length) {
          artistIdeas.push({ artist: a.name, rev: topNames[a.name], items: a.suggestions.slice(0, 2) });
        }
      });
    }
    artistIdeas.sort(function (a, b) { return b.rev - a.rev; });
    var gapList = Object.keys(gaps).map(function (k) { return gaps[k]; }).sort(function (a, b) { return b.n - a.n; });

    var catMove = movers(cur, prev, 'cat', store);
    var chanMove = movers(cur, prev, 'chan', store);
    var catMoveY = movers(cur, yoy, 'cat', store);
    var chanMoveY = movers(cur, yoy, 'chan', store);

    return {
      tone: tone, topN: topN,
      period: period,
      filters: {
        store: store, storeLabel: api.storeLabel(store),
        chan: only, chanLabel: only < 0 ? 'All channels' : D().channels[only],
        cat: f.cat, catLabel: f.cat < 0 ? 'All categories' : D().categories[f.cat],
        dtc: dtc, amzOn: amzOn
      },
      highlights: {
        net: cur.net, orders: cur.orders, aov: cur.aov, cvr: cur.cvr, newShare: cur.newShare, retRate: cur.retRate,
        newC: cur.newC, units: cur.units, sessions: cur.sessions,
        prev: prev, yoy: yoy,
        catMove: catMove, chanMove: chanMove, catMoveY: catMoveY, chanMoveY: chanMoveY
      },
      channels: { rows: chans, social: social, socNet: socNet, paid: { media: media, mediaPrev: mediaPrev, platforms: platforms, camps: camps, best: best, worst: worst, shift: shift }, crm: { cur: crm, prev: crmPrev, camps: campsCrm, flows: flows, emailRev: emailRev, smsRev: smsRev }, amazon: { markets: markets, fee: markets.reduce(function (a, x) { return a + x.fees; }, 0), rev: markets.reduce(function (a, x) { return a + x.rev; }, 0) } },
      products: { best: products.slice(0, topN), artists: artistList.slice(0, topN), slow: slow.slice(0, topN), risk: risk.slice(0, topN) },
      forecast: { fc: fc, lost: lostTot, riskCount: risk.length, channelNote: only >= 0 || f.cat >= 0 },
      recommendations: { gaps: gapList.slice(0, topN), artists: artistIdeas.slice(0, topN), label: catalog ? catalog.label : 'From public artist store catalogs, scraped Oct 27, 2026' },
      method: null
    };
  }

  function lead(m) {
    var h = m.highlights, p = m.period;
    if (!h.orders) return '<p>No orders matched ' + esc(p.label) + ' with these filters. Widen the period or set channel and category back to all.</p>';
    var bits = ['Net revenue was <b>' + esc(fm(h.net)) + '</b> on <b>' + esc(fn(h.orders)) + '</b> orders (AOV ' + esc(fm(h.aov, 2)) + ')'];
    if (h.prev) bits.push(esc(vs(h.net, h.prev.net)) + ' versus the previous period (' + esc(p.prev.start) + ' – ' + esc(p.prev.end) + ', ' + esc(fm(h.prev.net)) + ')');
    if (h.yoy) bits.push(esc(vs(h.net, h.yoy.net)) + ' versus last year (' + esc(p.yoy.start) + ' – ' + esc(p.yoy.end) + ', ' + esc(fm(h.yoy.net)) + ')');
    var line = '<p>' + bits.join(', ') + '.</p>';
    var extra = '';
    if (m.tone !== 'exec') {
      extra += '<p>New customers were ' + esc(fp(h.newShare)) + ' of orders (' + esc(fn(h.newC)) + ' new, ' + esc(fn(h.orders - h.newC)) + ' returning). Return rate was ' + esc(fp(h.retRate)) + ' of revenue. ';
      extra += h.cvr == null ? 'Conversion rate is not available when a category filter is on, because sessions are not split by category.' : 'Conversion was ' + esc(fp(h.cvr, 2)) + (h.sessions != null ? ' on ' + esc(fn(h.sessions)) + ' sessions' : '') + '.';
      extra += '</p>';
    }
    return line + extra + moverPara(m);
  }
  function moverBit(mv, word) {
    if (!mv || !mv.best) return '';
    var s = 'The biggest ' + word + ' gain was <b>' + esc(mv.best.name) + '</b> (' + esc(fm(mv.best.delta)) + (mv.best.pct != null ? ', ' + esc(sgn(mv.best.pct)) : '') + ')';
    if (mv.worst && mv.worst !== mv.best && mv.worst.delta < 0) s += '; the biggest drag was <b>' + esc(mv.worst.name) + '</b> (' + esc(fm(mv.worst.delta)) + ')';
    return s + '. ';
  }
  function moverPara(m) {
    var h = m.highlights, t = '';
    if (h.catMove) t += moverBit(h.catMove, 'category');
    if (h.chanMove && m.filters.chan < 0) t += moverBit(h.chanMove, 'channel');
    if (h.catMoveY) {
      var ybit = moverBit(h.catMoveY, 'category');
      t += 'Against last year, ' + ybit.charAt(0).toLowerCase() + ybit.slice(1);
    }
    if (!t) return '';
    if (m.tone === 'exec') {
      var one = h.catMove && h.catMove.best ? 'Largest category move versus the previous period: <b>' + esc(h.catMove.best.name) + '</b> ' + esc(fm(h.catMove.best.delta)) + '.' : '';
      return one ? '<p>' + one + '</p>' : '';
    }
    return '<p>' + t + '</p>';
  }

  function kpiGrid(m) {
    var h = m.highlights;
    function cell(label, value, sub) { return '<div class="r-metric"><b>' + esc(label) + '</b><strong>' + esc(value) + '</strong><small>' + sub + '</small></div>'; }
    function pair(cur, pk, yk) {
      var s = h.prev ? vs(cur, h.prev[pk]) + ' vs prev' : 'no prior period';
      if (h.yoy) s += ' · ' + vs(cur, h.yoy[yk || pk]) + ' vs LY';
      return s;
    }
    return '<div class="r-metrics">' +
      cell('Net revenue', fm(h.net), pair(h.net, 'net')) +
      cell('Orders', fn(h.orders), pair(h.orders, 'orders')) +
      cell('AOV', fm(h.aov, 2), pair(h.aov, 'aov')) +
      cell('Conversion', h.cvr == null ? 'n/a' : fp(h.cvr, 2), h.cvr == null ? 'Category filter hides sessions' : pair(h.cvr, 'cvr')) +
      cell('New vs returning', fp(h.newShare) + ' new', fn(h.newC) + ' new · ' + fn(Math.max(0, h.orders - h.newC)) + ' returning') +
      cell('Return rate', fp(h.retRate), h.prev ? vs(h.retRate, h.prev.retRate) + ' vs prev' : '') +
      '</div>';
  }

  function secHighlights(m) {
    return '<section class="r-sec" data-sec="highlights"><h2>Highlights <span class="r-badge r-badge-demo">DEMO DATA</span></h2>' +
      '<p class="r-kicker">Synthetic store performance for ' + esc(m.period.label) + ' · ' + esc(m.filters.storeLabel) + ' · ' + esc(m.filters.chanLabel) + ' · ' + esc(m.filters.catLabel) + '.</p>' +
      slot('highlights.lead', lead(m)) + slot('highlights.kpis', kpiGrid(m)) + '</section>';
  }

  function secChannels(m) {
    var c = m.channels, paid = c.paid, crm = c.crm, html = '<section class="r-sec" data-sec="channels"><h2>Channel performance <span class="r-badge r-badge-demo">DEMO DATA</span></h2>';
    var rows = c.rows.map(function (r) { return [r.name, fm(r.rev), fp(r.share), vs(r.rev, r.prev), vs(r.rev, r.yoy)]; });
    var note = m.filters.chan >= 0 ? '<p>The channel filter limits order revenue to <b>' + esc(m.filters.chanLabel) + '</b>. Paid media and CRM below are not sliced by that order channel; they follow the storefront, matching the dashboard.</p>' : '<p>Order revenue by channel for this period. Shares use filtered net revenue as the base.</p>';
    html += slot('channels.intro', note);
    if (m.tone !== 'exec') html += htm(['Channel', 'Net revenue', 'Share', 'Vs previous', 'Vs last year'], rows);

    var search = findChan(c.rows, 'Organic Search'), aff = findChan(c.rows, 'Affiliate & Referral'), direct = findChan(c.rows, 'Direct');
    html += '<h3>Organic search, affiliate, and direct</h3>' + slot('channels.owned',
      '<p>Organic search contributed <b>' + esc(fm(search.rev)) + '</b> (' + esc(fp(search.share)) + ' of filtered revenue), ' + esc(vs(search.rev, search.prev)) + ' versus the previous period and ' + esc(vs(search.rev, search.yoy)) + ' versus last year. ' +
      'Affiliate and referral contributed <b>' + esc(fm(aff.rev)) + '</b> (' + esc(vs(aff.rev, aff.prev)) + ' vs previous). Direct was <b>' + esc(fm(direct.rev)) + '</b> (' + esc(fp(direct.share)) + ').</p>');

    html += '<h3>Organic social</h3>';
    if (!m.filters.dtc || m.filters.chan >= 0 && m.filters.chan !== 1) {
      html += slot('channels.social', '<p>' + (m.filters.chan >= 0 && m.filters.chan !== 1 ? 'Organic social orders are excluded by the channel filter.' : 'Organic social is a Shopify DTC session source. This storefront filter has no DTC orders, so social revenue is $0.') + '</p>');
    } else {
      var top = c.social[0];
      html += slot('channels.social', '<p>Organic social (referrer with no paid UTM) was <b>' + esc(fm(c.socNet)) + '</b>. <b>' + esc(top.name) + '</b> led with ' + esc(fm(top.rev)) + ' (' + esc(fp(top.share)) + ' of organic social).</p>');
      if (m.tone !== 'exec') html += htm(['Platform', 'Revenue', 'Share of organic social'], c.social.map(function (s) { return [s.name, fm(s.rev), fp(s.share)]; }));
    }

    html += '<h3>Paid media</h3>';
    var p = paid.media, shift = paid.shift;
    var paidProse = '<p>Platform-reported last-click spend was <b>' + esc(fm(p.spend)) + '</b> against <b>' + esc(fm(p.rev)) + '</b> attributed revenue (ROAS <b>' + (p.roas ? esc(p.roas.toFixed(2) + 'x') : 'n/a') + '</b>, CAC ' + esc(fm(p.cac, 2)) + (p.acos != null ? ', ACoS ' + esc(fp(p.acos)) : '') + '). ';
    if (paid.mediaPrev && paid.mediaPrev.roas) paidProse += 'ROAS was ' + esc(vs(p.roas, paid.mediaPrev.roas)) + ' versus the previous period. ';
    if (paid.best && paid.worst) paidProse += 'Best campaign by ROAS: <b>' + esc(paid.best.platform + ' · ' + paid.best.name) + '</b> at ' + esc(paid.best.roas.toFixed(2)) + 'x on ' + esc(fm(paid.best.spend)) + '. Weakest: <b>' + esc(paid.worst.platform + ' · ' + paid.worst.name) + '</b> at ' + esc(paid.worst.roas.toFixed(2)) + 'x on ' + esc(fm(paid.worst.spend)) + '. ';
    if (shift) paidProse += 'Budget-shift idea: moving half of <b>' + esc(shift.from.name) + '</b> spend toward <b>' + esc(shift.to.name) + '</b> would add about <b>' + esc(fm(shift.gain)) + '</b> of attributed revenue if the destination kept 60% of its ROAS gap.';
    else paidProse += 'No budget shift is suggested: there is not a clearly weaker campaign with enough spend sitting next to a stronger non-brand campaign.';
    paidProse += '</p>';
    html += slot('channels.paid', paidProse);
    if (m.tone !== 'exec') {
      html += htm(['Platform', 'Spend', 'Attributed revenue', 'ROAS', 'CAC', 'Vs prev ROAS'], paid.platforms.map(function (x) {
        return [x.platform, fm(x.spend), fm(x.rev), x.roas ? x.roas.toFixed(2) + 'x' : '—', fm(x.cac, 2), vs(x.roas, x.prevRoas)];
      }));
      var show = paid.camps.slice().sort(function (a, b) { return b.spend - a.spend; }).slice(0, m.topN);
      html += htm(['Platform', 'Campaign', 'Spend', 'Revenue', 'ROAS', 'CAC', 'ACoS'], show.map(function (x) {
        return [x.platform, x.name, fm(x.spend), fm(x.rev), x.roas ? x.roas.toFixed(2) + 'x' : '—', fm(x.cac, 2), x.acos != null ? fp(x.acos) : '—'];
      }));
    }

    html += '<h3>CRM · email and SMS</h3>';
    var crmNote = m.filters.dtc ? 'Klaviyo-style campaigns and flows for Shopify DTC.' : 'This storefront filter does not include Shopify DTC. CRM still describes Shopify DTC, not the filtered orders.';
    var cr = crm.cur, cp = crm.prev;
    var crmProse = '<p>' + esc(crmNote) + ' CRM revenue was <b>' + esc(fm(cr.rev)) + '</b> (' + esc(vs(cr.rev, cp && cp.rev)) + ' vs previous). Email campaigns ' + esc(fm(crm.emailRev)) + ', SMS campaigns ' + esc(fm(crm.smsRev)) + ', flows ' + esc(fm(cr.flowRev)) + ' (' + esc(fp(cr.flowRev / (cr.rev || 1))) + ' of CRM). Email open rate ' + esc(fp(cr.openRate)) + ', click rate ' + esc(fp(cr.clickRate, 2)) + ', unsub rate ' + esc(fp(cr.unsubRate, 2)) + '. SMS click rate ' + esc(fp(cr.smsCtr, 1)) + '. Email list ' + esc(fn(cr.eList)) + ' (' + (cr.eGrowth >= 0 ? '+' : '') + esc(fn(cr.eGrowth)) + ' in period); SMS list ' + esc(fn(cr.sList)) + '.</p>';
    html += slot('channels.crm', crmProse);
    if (m.tone === 'detailed') {
      html += htm(['Date', 'Channel', 'Campaign', 'Recipients', 'Revenue', 'Unsub rate'], crm.camps.map(function (x) {
        return [x.date, x.channel, x.name, fn(x.recipients), fm(x.rev), x.recipients ? fp(x.unsubs / x.recipients, 2) : '—'];
      }));
      html += htm(['Flow', 'Channel', 'Sends', 'Revenue', 'Rev / recipient'], crm.flows.map(function (x) {
        return [x.name, x.channel, fn(x.sends), fm(x.rev), '$' + (x.rpr || 0).toFixed(2)];
      }));
    }

    html += '<h3>Amazon storefronts</h3>';
    if (!m.filters.amzOn) html += slot('channels.amazon', '<p>Amazon US, UK, and DE are excluded because the storefront filter is Shopify DTC.</p>');
    else {
      var amzProse = '<p>Amazon net revenue in this cut was <b>' + esc(fm(c.amazon.rev)) + '</b>, with fees of <b>' + esc(fm(c.amazon.fee)) + '</b>';
      if (c.amazon.rev) amzProse += ' (' + esc(fp(c.amazon.fee / c.amazon.rev)) + ' of Amazon net revenue)';
      amzProse += '. Fees are referral, FBA, and the media closing fee, in USD.</p>';
      html += slot('channels.amazon', amzProse);
      if (m.tone !== 'exec') html += htm(['Marketplace', 'Net revenue', 'Orders', 'Fees', 'Fee rate', 'Ad spend', 'ACoS', 'ROAS'], c.amazon.markets.map(function (x) {
        return [x.name, fm(x.rev), fn(x.orders), fm(x.fees), x.feeRate == null ? '—' : fp(x.feeRate), fm(x.adSpend), x.acos == null ? '—' : fp(x.acos), x.roas ? x.roas.toFixed(2) + 'x' : '—'];
      }));
    }
    if (c.rows.length) html += '<div class="r-chart"><canvas id="rChanChart" aria-label="Net revenue by channel, demo data"></canvas></div>';
    html += '</section>';
    return html;
  }

  function secProducts(m) {
    var pr = m.products;
    var html = '<section class="r-sec" data-sec="products"><h2>Products and artists <span class="r-badge r-badge-demo">DEMO DATA</span></h2>';
    html += slot('products.intro', '<p>Best sellers are ranked by filtered net revenue. Slow movers have more than 180 days of cover and were already on sale before this period. Stock-out risk is the 90-day unit forecast against on-hand units' + (m.filters.chan >= 0 ? '. Inventory is not split by the channel filter' : '') + '.</p>');
    html += '<h3>Best performing products</h3>' + htm(['Product', 'Artist', 'Category', 'Units', 'Net revenue', 'Vs previous'], pr.best.map(function (x) {
      return [x.title, x.artist, x.cat, fn(x.units), fm(x.rev), vs(x.rev, x.prev)];
    }));
    html += '<h3>Best performing artists</h3>' + htm(['Artist', 'Units', 'Net revenue'], pr.artists.map(function (x) { return [x.artist, fn(x.units), fm(x.rev)]; }));
    html += '<h3>Slow movers</h3>' + (pr.slow.length ? htm(['Product', 'Artist', 'On hand', 'Days of cover', 'Net revenue'], pr.slow.map(function (x) {
      return [x.title, x.artist, fn(x.onHand), x.cover.toFixed(0), fm(x.rev)];
    })) : '<p class="r-empty">No slow movers with more than 180 days of cover for this filter.</p>');
    html += '<h3>Stock-out risks</h3>' + (pr.risk.length ? htm(['Product', 'Artist', 'On hand', 'Projected stock-out', 'Days', 'Revenue at risk'], pr.risk.map(function (x) {
      return [x.title, x.artist, fn(x.onHand), x.so, String(x.days), fm(x.lost)];
    })) : '<p class="r-empty">No SKUs project a stock-out inside 90 days for this filter.</p>');
    html += '</section>';
    return html;
  }

  function secForecast(m) {
    var fc = m.forecast.fc, peak = fc.peak;
    var lo = fc.tot * Math.exp(-1.2816 * fc.totSd), hi = fc.tot * Math.exp(1.2816 * fc.totSd);
    var html = '<section class="r-sec" data-sec="forecast"><h2>Forecast outlook <span class="r-badge r-badge-demo">DEMO DATA</span></h2>';
    var prose = '<p>The next 90 days are forecast at <b>' + esc(fm(fc.tot)) + '</b> net revenue for <b>' + esc(m.filters.storeLabel) + '</b> (80% band ' + esc(fm(lo)) + ' – ' + esc(fm(hi)) + '). That is ' + esc(sgn(api.pct(fc.tot, fc.ly))) + ' versus the same 90 days last year (' + esc(fm(fc.ly)) + ') and ' + esc(sgn(api.pct(fc.tot, fc.last90))) + ' versus the last 90 days (' + esc(fm(fc.last90)) + '). Peak day is <b>' + esc(D().iso(peak.d)) + '</b> at ' + esc(fm(peak.f)) + (api.peakLabel(peak.d) ? ' (' + esc(api.peakLabel(peak.d)) + ')' : '') + '. Daily backtest MAPE is ' + esc(fp(fc.mape)) + '. Projected stock-outs put about <b>' + esc(fm(m.forecast.lost)) + '</b> at risk' + (m.forecast.riskCount ? ' across ' + esc(String(m.forecast.riskCount)) + ' flagged SKUs' : '') + '.</p>';
    if (m.forecast.channelNote) prose += '<p>The forecast follows the storefront only. Category and channel filters do not change the 90-day total; they do limit the stock-out list in the products section.</p>';
    html += slot('forecast.body', prose) + '</section>';
    return html;
  }

  function groupName(g) {
    return { missing_format: 'Missing format', merch: 'Merch to add', bundle: 'Bundle', signed_color: 'Signed or colored vinyl', pricing: 'Pricing gap' }[g] || g;
  }
  function secRecs(m) {
    var r = m.recommendations;
    var html = '<section class="r-sec" data-sec="recommendations"><h2>Recommendations <span class="r-badge r-badge-demo">DEMO DATA</span> <span class="r-badge r-badge-pub">PUBLIC CATALOG</span></h2>';
    html += '<p class="r-kicker">' + esc(r.label) + '. Focus areas below use the synthetic results in this report. The add-to-site list does not.</p>';
    var gapHtml = r.gaps.length ? '<ul>' + r.gaps.map(function (g) {
      return '<li><b>' + esc(g.text) + '</b> (' + esc(groupName(g.group)) + ', ' + g.n + ' roster stores). ' + esc(g.reason) + (g.sample.length ? ' Examples: ' + esc(g.sample.join(', ')) + '.' : '') + '</li>';
    }).join('') + '</ul>' : '<p>No catalog gaps were available.</p>';
    var artHtml = r.artists.length ? '<ul>' + r.artists.map(function (a) {
      return '<li><b>' + esc(a.artist) + '</b> (' + esc(fm(a.rev)) + ' in this report) — ' + a.items.map(function (sg) { return esc(sg.text); }).join('; ') + '.</li>';
    }).join('') + '</ul>' : '<p>None of this period’s top artists have an open catalog suggestion. The roster gaps above still apply.</p>';
    html += '<h3>Products and formats to add</h3>' + slot('recs.catalog', '<p>These are the most common gaps on the public artist stores, plus any gaps on artists who already sell in this period.</p>' + artHtml + gapHtml);

    var ch = m.channels, search = findChan(ch.rows, 'Organic Search'), topSoc = ch.social[0], cr = ch.crm.cur, shift = ch.paid.shift;
    var seo = 'Organic search was ' + fm(search.rev) + ' (' + fp(search.share) + ', ' + vs(search.rev, search.prev) + ' vs previous, ' + vs(search.rev, search.yoy) + ' vs last year). ';
    if (m.filters.chan >= 0 && m.filters.chan !== 0) seo = 'Organic search is outside the current channel filter (' + m.filters.chanLabel + '), so it is not a focus in this cut. ';
    else seo += (search.yoy != null && search.rev < search.yoy ? 'It is down versus last year: refresh artist and format pages for the categories that grew, and point internal links at in-stock vinyl.' : 'It is holding or growing: publish new-release pages on street date and add collection copy for formats the public roster sells that a given artist store still lacks.');
    var social = !m.filters.dtc || (m.filters.chan >= 0 && m.filters.chan !== 1)
      ? 'Organic social is not in this cut, so there is no social focus until the filter includes Shopify DTC and the Organic Social channel.'
      : 'Organic social was ' + fm(ch.socNet) + ', led by ' + topSoc.name + ' at ' + fm(topSoc.rev) + ' (' + fp(topSoc.share) + ' of social). Put the next content sprint on ' + topSoc.name + ' and keep the other four platforms as supporting cuts.';
    var paid = 'Paid ROAS was ' + (ch.paid.media.roas ? ch.paid.media.roas.toFixed(2) + 'x' : 'n/a') + ' on ' + fm(ch.paid.media.spend) + ' spend (CAC ' + fm(ch.paid.media.cac, 2) + '). ';
    paid += shift ? 'Shift about half of ' + shift.from.name + ' (' + shift.from.roas.toFixed(2) + 'x) toward ' + shift.to.name + ' (' + shift.to.roas.toFixed(2) + 'x). The illustrative gain is ' + fm(shift.gain) + ' if the stronger campaign keeps 60% of the ROAS gap.' : 'Keep spend with the higher-ROAS campaigns in the table; no single shift clears the bar used here (over $1,000 on the weak side, over $500 and not brand search on the strong side).';
    if (m.filters.chan >= 0) paid += ' Paid figures follow the storefront, not the order-channel filter.';
    var crmF = 'CRM revenue was ' + fm(cr.rev) + ' (' + vs(cr.rev, ch.crm.prev && ch.crm.prev.rev) + ' vs previous), with flows at ' + fp(cr.flowRev / (cr.rev || 1)) + ' of that. Email unsub rate was ' + fp(cr.unsubRate, 2) + ' and SMS click rate ' + fp(cr.smsCtr, 1) + '. ';
    var hot = ch.crm.camps.filter(function (x) { return x.recipients && x.unsubs / x.recipients > 0.005; }).sort(function (a, b) { return b.unsubs / b.recipients - a.unsubs / a.recipients; })[0];
    crmF += hot ? 'Review ' + hot.name + ' (' + hot.date + ', ' + fp(hot.unsubs / hot.recipients, 2) + ' unsub) before the next send.' : 'No campaign in this period cleared a 0.5% unsub rate. Put the next test on the top flow by revenue per recipient.';
    if (!m.filters.dtc) crmF += ' This CRM read is Shopify DTC even though the report filter is Amazon.';
    html += '<h3>Where to focus</h3>' + slot('recs.focus', '<p><b>Paid.</b> ' + esc(paid) + '</p><p><b>CRM.</b> ' + esc(crmF) + '</p><p><b>SEO.</b> ' + esc(seo) + '</p><p><b>Organic social.</b> ' + esc(social) + '</p>');
    html += '</section>';
    return html;
  }

  function words() { return window.WRTTS; }
  function moneyWords(v) {
    if (v == null || isNaN(v) || !words()) return 'an unknown amount';
    var sign = v < 0 ? 'negative ' : '';
    var a = Math.abs(v);
    if (a >= 1000000) return sign + words().sayDecimal(Math.round(a / 100000) / 10) + ' million dollars';
    if (a >= 1000) return sign + words().sayInt(Math.round(a / 1000)) + ' thousand dollars';
    return sign + words().sayInt(Math.round(a)) + ' dollars';
  }
  function countWords(n) {
    n = Math.abs(Math.round(n || 0));
    if (n >= 1000000) return words().sayDecimal(Math.round(n / 100000) / 10) + ' million';
    if (n >= 1000) return words().sayInt(Math.round(n / 1000)) + ' thousand';
    return words().sayInt(n);
  }
  function moveWords(cur, base) {
    if (base == null || !isFinite(base) || base === 0) return '';
    var p = api.pct(cur, base);
    if (p == null || !isFinite(p)) return '';
    return (p >= 0 ? 'up ' : 'down ') + words().sayInt(Math.abs(Math.round(p * 100))) + ' percent';
  }
  function shortName(s) {
    var t = String(s || '').split(/[–—-]/)[0].replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    return t.split(' ').slice(0, 4).join(' ') || 'that campaign';
  }
  function dayWords(iso) {
    var p = parts(iso);
    var special = { 1: 'first', 2: 'second', 3: 'third', 20: 'twentieth', 21: 'twenty first', 22: 'twenty second', 23: 'twenty third', 30: 'thirtieth', 31: 'thirty first' };
    return MONTHS[p.m] + ' ' + (special[p.d] || words().sayInt(p.d)) + ', ' + words().sayYear(p.y);
  }
  function podcastScript(m) {
    var h = m.highlights, ch = m.channels, f = m.filters, p = m.period;
    if (!h.orders) {
      return ['Hi, this is the Warner Records Store audio summary for ' + dayWords(p.start) + ' through ' + dayWords(p.end) + '. Storefront ' + storefrontShort(f.store) + ', channel ' + (f.chan < 0 ? 'all' : f.chanLabel) + ', category ' + (f.cat < 0 ? 'all' : f.catLabel) + '. No orders matched this cut, so there is nothing to read out. Widen the period, or set channel and category back to all. That is the summary. Talk soon.'];
    }
    var paras = [];
    paras.push('Hi, welcome back. This is the Warner Records Store audio summary. Today we are covering ' + dayWords(p.start) + ' through ' + dayWords(p.end) + '. Storefront, ' + storefrontShort(f.store) + '. Channel, ' + (f.chan < 0 ? 'all' : f.chanLabel) + '. Category, ' + (f.cat < 0 ? 'all' : f.catLabel) + '. Before the numbers: sales, ads, CRM, Amazon, and the forecast are demo data, not a live Shopify or Klaviyo account. Product ideas at the end come from public artist store catalogs.');
    var hi = 'Here is where this window landed. Net revenue was ' + moneyWords(h.net) + ', on about ' + countWords(h.orders) + ' orders. Average order value was ' + moneyWords(h.aov) + '. ';
    hi += h.cvr == null ? 'Conversion is hidden while a category filter is on. ' : 'Conversion was ' + words().sayDecimal(h.cvr * 100) + ' percent. ';
    hi += 'About ' + words().sayInt(Math.round(h.newShare * 100)) + ' percent of orders were new customers. The return rate was ' + words().sayDecimal(h.retRate * 100) + ' percent of revenue. ';
    if (h.prev) hi += 'Versus the previous period, revenue was ' + (moveWords(h.net, h.prev.net) || 'flat') + '. ';
    if (h.yoy) hi += 'Versus last year, it was ' + (moveWords(h.net, h.yoy.net) || 'flat') + '. ';
    paras.push(hi);
    var mv = '';
    if (h.catMove && h.catMove.best) {
      mv += 'The biggest category gain versus the previous period was ' + h.catMove.best.name + ', ' + moneyWords(h.catMove.best.delta) + '. ';
      if (h.catMove.worst && h.catMove.worst.delta < 0) mv += 'The biggest drag was ' + h.catMove.worst.name + ', ' + moneyWords(h.catMove.worst.delta) + '. ';
    }
    if (h.chanMove && f.chan < 0 && h.chanMove.best) {
      mv += 'On channels, the biggest gain was ' + h.chanMove.best.name + ', ' + moneyWords(h.chanMove.best.delta) + '. ';
      if (h.chanMove.worst && h.chanMove.worst.delta < 0) mv += 'The softest channel was ' + h.chanMove.worst.name + ', ' + moneyWords(h.chanMove.worst.delta) + '. ';
    }
    if (mv) paras.push(mv);
    var search = findChan(ch.rows, 'Organic Search'), aff = findChan(ch.rows, 'Affiliate & Referral'), direct = findChan(ch.rows, 'Direct');
    var owned = 'Looking across the mix. Organic search contributed ' + moneyWords(search.rev) + (moveWords(search.rev, search.prev) ? ', ' + moveWords(search.rev, search.prev) + ' versus the previous period' : '') + '. Affiliate and referral contributed ' + moneyWords(aff.rev) + '. Direct was ' + moneyWords(direct.rev) + '. ';
    if (!f.dtc || (f.chan >= 0 && f.chan !== 1)) owned += 'Organic social is outside this cut. ';
    else owned += 'Organic social, the referrer with no paid tag, was ' + moneyWords(ch.socNet) + ', led by ' + (ch.social[0] ? ch.social[0].name : 'one platform') + ' at ' + moneyWords(ch.social[0] ? ch.social[0].rev : 0) + '. ';
    paras.push(owned);
    var paid = ch.paid.media, shift = ch.paid.shift;
    var paidP = 'Paid media spent ' + moneyWords(paid.spend) + ' and attributed ' + moneyWords(paid.rev) + '. Return on ad spend was ' + (paid.roas ? words().sayDecimal(Math.round(paid.roas * 10) / 10) + ' times' : 'not available') + ', and new customer cost was ' + moneyWords(paid.cac) + '. ';
    if (ch.paid.best && ch.paid.worst) paidP += 'Strongest campaign: ' + ch.paid.best.platform + ' ' + shortName(ch.paid.best.name) + ', at ' + words().sayDecimal(Math.round(ch.paid.best.roas * 10) / 10) + ' times. Weakest: ' + ch.paid.worst.platform + ' ' + shortName(ch.paid.worst.name) + ', at ' + words().sayDecimal(Math.round(ch.paid.worst.roas * 10) / 10) + ' times. ';
    if (shift) paidP += 'A useful shift is about half of ' + shortName(shift.from.name) + ' toward ' + shortName(shift.to.name) + ', roughly ' + moneyWords(shift.gain) + ' if the stronger campaign keeps most of its return. ';
    paras.push(paidP);
    var cr = ch.crm.cur;
    var crmMove = moveWords(cr.rev, ch.crm.prev && ch.crm.prev.rev);
    var crmP = 'CRM, the Shopify email and SMS program' + (f.dtc ? '' : ', even on an Amazon filter') + ', brought in ' + moneyWords(cr.rev) + (crmMove ? ', ' + crmMove + ' versus the previous period' : '') + '. Flows were ' + words().sayInt(Math.round(cr.flowRev / (cr.rev || 1) * 100)) + ' percent of that. ';
    if (!f.amzOn) crmP += 'Amazon is excluded on this Shopify cut. ';
    else {
      crmP += 'Amazon net revenue was ' + moneyWords(ch.amazon.rev) + ', with fees of ' + moneyWords(ch.amazon.fee) + '. ';
      if (ch.amazon.markets && ch.amazon.markets.length) {
        var mk = ch.amazon.markets.slice().sort(function (a, b) { return b.rev - a.rev; })[0];
        if (mk && mk.rev) crmP += mk.name + ' led, at ' + moneyWords(mk.rev) + (mk.acos != null ? ', advertising cost of sale ' + words().sayInt(Math.round(mk.acos * 100)) + ' percent' : '') + '. ';
      }
    }
    paras.push(crmP);
    var pr = m.products;
    var prod = 'On the product side, ';
    if (pr.best[0]) prod += 'the top seller was ' + pr.best[0].title + ' by ' + pr.best[0].artist + ', at ' + moneyWords(pr.best[0].rev) + '. ';
    if (pr.artists[0]) prod += 'The top artist was ' + pr.artists[0].artist + '. ';
    if (pr.risk[0]) prod += 'Watch stock on ' + pr.risk[0].title + ', about ' + countWords(pr.risk[0].days) + ' days out. ';
    if (pr.slow[0]) prod += pr.slow[0].title + ' is a slow mover, with about ' + countWords(pr.slow[0].cover) + ' days of cover. ';
    paras.push(prod);
    var fc = m.forecast.fc;
    paras.push('The ninety day forecast for ' + storefrontShort(f.store) + ' is ' + moneyWords(fc.tot) + ' of net revenue. That is ' + (moveWords(fc.tot, fc.ly) || 'flat') + ' versus the same ninety days last year, and the peak day is ' + dayWords(D().iso(fc.peak.d)) + ' at ' + moneyWords(fc.peak.f) + '. ' + (m.forecast.channelNote ? 'That forecast follows the storefront only. Category and channel do not change the ninety day total. ' : ''));
    var rec = m.recommendations;
    var recP = 'A few things I would put on the list. ';
    if (rec.artists[0] && rec.artists[0].items[0]) recP += rec.artists[0].artist + ' already sells here. The public catalog says: ' + rec.artists[0].items[0].text + '. ';
    else if (rec.gaps[0]) recP += 'A common public catalog gap is ' + rec.gaps[0].text + '. ';
    var focusSearch = findChan(ch.rows, 'Organic Search');
    recP += 'For paid, keep budget near the higher return campaigns' + (shift ? ', including that shift we just covered' : '') + '. ';
    recP += 'For CRM, the next test belongs on the strongest flow. ';
    recP += 'For search, organic was ' + moneyWords(focusSearch.rev) + '. Publish street date pages while stock is healthy. ';
    if (f.dtc && !(f.chan >= 0 && f.chan !== 1) && ch.social[0]) recP += 'For organic social, put the next sprint on ' + ch.social[0].name + '. ';
    paras.push(recP);
    paras.push('That is the readout. The tables are in the report if you want every row, and the whole thing is still demo data except the public catalog suggestions. Thanks for listening. Talk soon.');
    return paras;
  }
  function secAudio(m) {
    var paras = podcastScript(m);
    var body = paras.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
    return '<section class="r-sec" data-sec="audio"><h2>Audio summary <span class="r-badge r-badge-demo">DEMO DATA</span></h2>' +
      '<p class="r-kicker">A two to four minute host script from this report. Play uses your browser voice. Download builds a WAV in the page, with no upload and no API key. The email button opens a Gmail draft and does not send it.</p>' +
      '<div class="r-audio-actions no-print"><button type="button" data-audio="toggle">Play audio</button><button type="button" data-audio="wav">Download audio</button></div>' +
      slot('audio.script', body) + '</section>';
  }

  function secMethod(m) {
    var p = m.period, cat = window.WRCatalog;
    var text = '<p>This report was built in the browser from the dashboard’s own dataset. Sales, traffic, paid media, CRM, Amazon, and the forecast are synthetic demo data, seed 20261027, covering ' + esc(D().meta.start) + ' through ' + esc(D().meta.end) + '. The selected window is <b>' + esc(p.label) + '</b> (' + esc(p.start) + ' to ' + esc(p.end) + ', ' + p.days + ' days), ' + esc(m.filters.storeLabel) + ', ' + esc(m.filters.chanLabel) + ', ' + esc(m.filters.catLabel) + '. ';
    text += p.prev ? 'The previous period is the equal-length window immediately before (' + esc(p.prev.start) + ' to ' + esc(p.prev.end) + (p.prev.partial ? ', shortened because the dataset starts ' + esc(D().meta.start) : '') + '). ' : 'No previous period is available inside the dataset. ';
    text += p.yoy ? 'Last year is the same calendar dates one year earlier (' + esc(p.yoy.start) + ' to ' + esc(p.yoy.end) + '). ' : 'Last year falls outside the dataset, so year-ago comparisons are omitted. ';
    text += 'Order metrics use those filters. Paid media is platform-reported last click for the storefront. CRM is Klaviyo-style and covers Shopify DTC only. The 90-day forecast is seasonal-naive (same weekday last year times trailing 8-week growth) and uses the storefront only. ';
    text += 'Suggestions to add products or formats come from ' + esc(cat ? cat.label : 'public artist store catalogs, scraped Oct 27, 2026') + (cat && cat.method ? ' ' + esc(cat.method) : '') + ' Audience is ' + esc(m.tone === 'exec' ? 'an executive summary' : m.tone === 'detailed' ? 'a detailed readout' : 'the marketing team') + ', with up to ' + m.topN + ' rows in each list. The audio summary is a spoken script of these same figures. Play uses the browser speech API. Download audio builds a WAV on this device. The hosted file linked from the audio email is the default last full month, all storefronts, all channels, and all categories. Edited paragraphs are kept when you regenerate if “Keep edited text” is on; tables and unedited paragraphs refresh from the data. Email buttons open a Gmail draft in a new tab and never send it.</p>';
    return '<section class="r-sec" data-sec="method"><h2>How this report was built</h2>' + slot('method.body', text) + '</section>';
  }

  function secNotes() {
    var body = state.notes || '<p>Add a note for the reader. This text is kept when you regenerate.</p>';
    return '<section class="r-sec" data-sec="notes"><h2>Notes</h2><div class="r-edit" data-block="notes.body" contenteditable="true">' + body + '</div></section>';
  }

  function renderHtml(m) {
    var map = { highlights: secHighlights, channels: secChannels, products: secProducts, forecast: secForecast, recommendations: secRecs, audio: secAudio, method: secMethod, notes: secNotes };
    var partsHtml = state.order.map(function (id) {
      var chunk = map[id](m);
      if (!state.on[id]) chunk = chunk.replace('class="r-sec"', 'class="r-sec hide"');
      return chunk;
    }).join('');
    return '<header class="r-head"><p class="r-meta" id="reportMeta">' + esc(headerLine(m)) + '</p><h1 id="reportHeading">Performance Analysis</h1><p class="r-flags"><span class="r-badge r-badge-demo">DEMO DATA</span> <span class="r-badge r-badge-pub">PUBLIC CATALOG</span></p><p class="r-kicker">Sales, media, CRM, Amazon, and the forecast are synthetic. Product and format suggestions are from public artist store catalogs, scraped Oct 27, 2026.</p></header>' + partsHtml;
  }

  function captureEdits() {
    document.querySelectorAll('#reportDoc [data-block]').forEach(function (el) {
      var id = el.getAttribute('data-block');
      if (id === 'notes.body') { state.notes = el.innerHTML; return; }
      if (el.getAttribute('data-dirty') === '1') state.edits[id] = el.innerHTML;
    });
  }

  function readControls() {
    state.period = $('rPeriod').value;
    state.from = $('rFrom').value;
    state.to = $('rTo').value;
    state.store = +$('rStore').value;
    state.chan = +$('rChan').value;
    state.cat = +$('rCat').value;
    state.tone = $('rTone').value;
    state.topN = +$('rTop').value;
    state.keepEdits = $('rKeep').checked;
  }
  function writeControls() {
    $('rPeriod').value = state.period;
    $('rFrom').value = state.from || '';
    $('rTo').value = state.to || '';
    $('rStore').value = String(state.store);
    syncChanOptions();
    $('rChan').value = String(state.chan);
    $('rCat').value = String(state.cat);
    $('rTone').value = state.tone;
    $('rTop').value = String(state.topN);
    $('rKeep').checked = !!state.keepEdits;
    $('rCustom').classList.toggle('hide', state.period !== 'custom');
    paintSections();
  }
  function syncChanOptions() {
    var st = +$('rStore').value, sel = $('rChan'), dtcN = D().dtcChannels;
    Array.prototype.forEach.call(sel.options, function (op) {
      var v = +op.value; if (v < 0) return;
      var amz = v >= dtcN;
      op.disabled = (st === 0 && amz) || (st > 0 && !amz);
    });
    if (sel.selectedOptions[0] && sel.selectedOptions[0].disabled) sel.value = '-1';
  }
  function opts() {
    return { period: state.period, from: state.from, to: state.to, store: state.store, chan: state.chan, cat: state.cat, tone: state.tone, topN: state.topN };
  }

  function renderReport(flags) {
    if (!flags || !flags.skipCapture) captureEdits();
    if (!state.keepEdits) state.edits = {};
    readControls();
    var model;
    try { model = buildModel(opts()); }
    catch (err) { window.__WR_REPORT_ERROR = err; $('rStatus').textContent = 'Could not build the report. ' + err.message; return null; }
    window.__WR_REPORT_ERROR = null;
    state.last = model;
    stopSpeech();
    if (state.chart) { try { state.chart.destroy(); } catch (e1) { /* chart already gone */ } state.chart = null; }
    $('reportDoc').innerHTML = renderHtml(model);
    try { paintReportChart(model); } catch (eChart) { /* chart is optional */ }
    var kept = Object.keys(state.edits).length;
    $('rStatus').textContent = 'Built ' + model.period.label + ' · ' + model.filters.storeLabel + ' · ' + model.highlights.orders + ' orders' + (kept && state.keepEdits ? ' · ' + kept + ' edited block' + (kept === 1 ? '' : 's') + ' kept' : '') + '.';
    var mail = gmailLink(reportSubject(model), plainReport());
    $('rMail').href = mail.url;
    var audioMail = gmailLink(audioSubject(model), audioBody(model));
    $('rMailAudio').href = audioMail.url;
    return model;
  }

  function paintReportChart(m) {
    if (state.chart) { try { state.chart.destroy(); } catch (e2) { /* already destroyed */ } state.chart = null; }
    var canvas = document.getElementById('rChanChart');
    if (!canvas || !m || !state.on.channels || typeof Chart === 'undefined') return;
    var rows = m.channels.rows.filter(function (r) { return r.rev > 0; }).slice(0, 10);
    if (!rows.length) return;
    state.chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: rows.map(function (r) { return r.name; }), datasets: [{ label: 'Net revenue', data: rows.map(function (r) { return Math.round(r.rev); }), backgroundColor: '#e2b340', borderRadius: 3 }] },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false }, title: { display: true, text: 'Net revenue by channel (DEMO DATA)', color: '#3a342c', font: { family: 'Inter, sans-serif', size: 12 } } },
        scales: {
          x: { ticks: { color: '#5e5a52', callback: function (v) { return api.fm(v); } }, grid: { color: '#eeeae2' } },
          y: { ticks: { color: '#3a342c', font: { size: 11 } }, grid: { display: false } }
        }
      }
    });
  }

  function textOf(el) { return (el.innerText || '').replace(/\n{3,}/g, '\n\n').trim(); }
  function tableMd(table) {
    var rows = Array.prototype.map.call(table.rows, function (tr) {
      return Array.prototype.map.call(tr.cells, function (td) { return textOf(td).replace(/\|/g, '/').replace(/\n/g, ' '); });
    });
    if (!rows.length) return '';
    var head = rows[0], body = rows.slice(1);
    var line = '| ' + head.join(' | ') + ' |\n| ' + head.map(function () { return '---'; }).join(' | ') + ' |';
    return line + '\n' + body.map(function (r) { return '| ' + r.join(' | ') + ' |'; }).join('\n');
  }
  function toMarkdown() {
    var doc = $('reportDoc');
    if (!doc || !state.last) return '';
    var m = state.last, lines = [headerLine(m), '', '# Performance Analysis', '', 'DEMO DATA for sales, media, CRM, Amazon, and the forecast. PUBLIC CATALOG for product suggestions (' + (window.WRCatalog ? window.WRCatalog.label : 'scraped Oct 27, 2026') + ').', ''];
    Array.prototype.forEach.call(doc.querySelectorAll('.r-sec'), function (sec) {
      if (sec.classList.contains('hide')) return;
      var h = sec.querySelector('h2');
      lines.push('## ' + textOf(h).replace(/\s+/g, ' '));
      Array.prototype.forEach.call(sec.querySelectorAll('[data-block], table, h3'), function (el) {
        if (el.tagName === 'TABLE') lines.push('', tableMd(el));
        else if (el.tagName === 'H3') lines.push('', '### ' + textOf(el));
        else lines.push('', textOf(el));
      });
      lines.push('');
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function plainReport() {
    var doc = $('reportDoc');
    if (!doc || !state.last) return '';
    var clone = doc.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('.no-print,.hide'), function (el) { el.remove(); });
    clone.setAttribute('style', 'position:fixed;left:-9999px;top:0;');
    document.body.appendChild(clone);
    var text = (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    clone.remove();
    if (text.indexOf('Warner Records Store ·') !== 0) text = headerLine(state.last) + '\n\nPerformance Analysis\n\n' + text;
    return text + '\n';
  }
  function reportSubject(m) { return 'Warner Records Store analysis · ' + rangePhrase(m.period.start, m.period.end) + ' (DEMO DATA)'; }
  function audioSubject(m) { return 'WR Store Audio Summary – ' + rangePhrase(m.period.start, m.period.end); }
  function audioBody(m) {
    var script = scriptPlain();
    var bits = script.split(/\n+/).filter(Boolean).slice(0, 4).join('\n\n');
    return headerLine(m) + '\n\nPerformance Analysis\n\nAudio summary (DEMO DATA). Nothing is sent until you send it.\n\n' + bits + '\n\nListen: ' + HOSTED_AUDIO + '\n\nThat file is the default last full month, all storefronts, all channels, and all categories, hosted with the dashboard. If this draft uses a different period or filter, attach the WAV from Download audio. A Gmail compose link cannot attach a file.\n\nDashboard: ' + SITE + '\n';
  }
  function gmailLink(subject, body) {
    var base = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(subject) + '&body=';
    var note = '\n\n[Draft shortened to fit the Gmail compose link. The full formatted report was copied to the clipboard. Paste it into this draft. Dashboard: ' + SITE + ']';
    var url = base + encodeURIComponent(body);
    var truncated = false;
    if (url.length > GMAIL_LIMIT) {
      truncated = true;
      var b = body;
      while (b.length > 80 && (base + encodeURIComponent(b + note)).length > GMAIL_LIMIT) b = b.slice(0, Math.floor(b.length * 0.8));
      var cut = b.lastIndexOf('\n');
      if (cut > 80) b = b.slice(0, cut);
      url = base + encodeURIComponent(b + note);
    }
    return { url: url, truncated: truncated };
  }
  function openGmail(kind) {
    if (!state.last) return;
    captureEdits();
    var link = kind === 'audio' ? gmailLink(audioSubject(state.last), audioBody(state.last)) : gmailLink(reportSubject(state.last), plainReport());
    var el = $(kind === 'audio' ? 'rMailAudio' : 'rMail');
    el.href = link.url;
    if (link.truncated) {
      copyRich(true);
      $('rStatus').textContent = 'Opened a Gmail draft. The full formatted report is on the clipboard — paste it in. Nothing is sent until you send it.';
    } else $('rStatus').textContent = 'Opened a Gmail draft in a new tab. Nothing is sent until you send it.';
    window.open(link.url, '_blank', 'noopener,noreferrer');
  }
  function download(name, mime, data) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600);
  }
  function withChartImages(clone) {
    var live = $('reportDoc').querySelectorAll('canvas');
    var copies = clone.querySelectorAll('canvas');
    Array.prototype.forEach.call(copies, function (canvas, i) {
      var img = document.createElement('img');
      img.alt = (live[i] && live[i].getAttribute('aria-label')) || 'Chart';
      try { img.src = live[i] ? live[i].toDataURL('image/png') : ''; } catch (e3) { img.alt = 'Chart unavailable'; }
      img.setAttribute('style', 'max-width:100%;height:auto;display:block;margin:8px 0 14px;');
      canvas.parentNode.replaceChild(img, canvas);
    });
  }
  function inlineStyles(clone) {
    function set(sel, css) {
      Array.prototype.forEach.call(clone.querySelectorAll(sel), function (el) {
        el.setAttribute('style', css + (el.getAttribute('style') || ''));
      });
    }
    set('.r-meta', 'font-family:Georgia,serif;font-size:14px;font-weight:700;color:#3a342c;margin:0 0 8px;');
    set('h1', 'font-family:Georgia,serif;font-size:28px;color:#16150f;margin:0 0 8px;');
    set('h2', 'font-family:Georgia,serif;font-size:20px;color:#16150f;margin:22px 0 8px;border-top:1px solid #e4dfd4;padding-top:12px;');
    set('h3', 'font-family:Georgia,serif;font-size:16px;color:#16150f;margin:14px 0 6px;');
    set('p', 'font-family:Georgia,serif;font-size:15px;line-height:1.5;color:#1c1b18;margin:0 0 10px;');
    set('table', 'border-collapse:collapse;width:100%;font-family:Georgia,serif;font-size:13px;margin:8px 0 14px;');
    set('th', 'text-align:left;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#6d6a62;border-bottom:1px solid #e4dfd4;padding:6px 8px;background:#f7f4ee;');
    set('td', 'border-bottom:1px solid #eeeae2;padding:6px 8px;vertical-align:top;color:#1c1b18;');
    set('.r-badge-demo', 'display:inline-block;font-family:Georgia,serif;font-size:10px;font-weight:700;letter-spacing:.06em;background:#fff6d8;color:#8a6a00;border:1px solid #e6d48a;border-radius:99px;padding:2px 8px;');
    set('.r-badge-pub', 'display:inline-block;font-family:Georgia,serif;font-size:10px;font-weight:700;letter-spacing:.06em;background:#e7f1ff;color:#1d4e89;border:1px solid #b9d4f5;border-radius:99px;padding:2px 8px;');
    set('.r-metric', 'border:1px solid #e4dfd4;border-radius:8px;padding:8px 10px;background:#ffffff;display:inline-block;min-width:140px;margin:0 8px 8px 0;vertical-align:top;');
    set('.r-metric b', 'display:block;font-size:11px;color:#6d6a62;font-weight:600;');
    set('.r-metric strong', 'display:block;font-size:20px;color:#16150f;');
    set('.r-kicker', 'font-family:Georgia,serif;font-size:13px;color:#5e5a52;margin:0 0 10px;');
    set('a', 'color:#1d4e89;');
    set('img', 'max-width:100%;height:auto;');
  }
  function fragmentHtml() {
    captureEdits();
    var clone = $('reportDoc').cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('.hide,.no-print'), function (el) { el.remove(); });
    Array.prototype.forEach.call(clone.querySelectorAll('[contenteditable]'), function (el) { el.removeAttribute('contenteditable'); });
    withChartImages(clone);
    inlineStyles(clone);
    return clone.innerHTML;
  }
  function exportHtml() {
    var title = state.last ? headerLine(state.last) : 'Warner Records Store analysis';
    var css = 'body{font:15px/1.5 Georgia,serif;color:#1c1b18;background:#fff;max-width:820px;margin:32px auto;padding:0 20px}';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + css + '</style></head><body>' + fragmentHtml() + '</body></html>';
  }
  function scriptPlain() {
    var el = document.querySelector('#reportDoc [data-block="audio.script"]');
    if (el) {
      var t = '';
      try { t = el.innerText || ''; } catch (e4) { t = ''; }
      if (!String(t).trim()) t = el.textContent || '';
      t = String(t).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (t) return t;
    }
    return state.last ? podcastScript(state.last).join('\n\n') : '';
  }
  function copyRich(silent) {
    var html = fragmentHtml();
    var plain = plainReport();
    var done = function (how) { if (!silent) $('rStatus').textContent = 'Copied the formatted report' + (how ? ' (' + how + ')' : '') + '.'; };
    function fallback() {
      var holder = document.createElement('div');
      holder.contentEditable = 'true';
      holder.setAttribute('style', 'position:fixed;left:-9999px;top:0;');
      holder.innerHTML = html;
      document.body.appendChild(holder);
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(holder);
      sel.removeAllRanges();
      sel.addRange(range);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e5) { ok = false; }
      sel.removeAllRanges();
      holder.remove();
      done(ok ? 'selection' : 'unavailable');
      return ok;
    }
    if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
      var item = {};
      item['text/html'] = new Blob([html], { type: 'text/html' });
      item['text/plain'] = new Blob([plain], { type: 'text/plain' });
      navigator.clipboard.write([new ClipboardItem(item)]).then(function () { done('html'); }).catch(function () { fallback(); });
      return;
    }
    fallback();
  }
  function setPlayLabel(playing) {
    var t = playing ? 'Pause audio' : 'Play audio';
    if ($('rPlay')) $('rPlay').textContent = t;
    var inline = document.querySelector('#reportDoc [data-audio="toggle"]');
    if (inline) inline.textContent = t;
  }
  function stopSpeech() {
    if (state && state.speechTimer) { clearInterval(state.speechTimer); state.speechTimer = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
    setPlayLabel(false);
  }
  function toggleSpeech() {
    if (!window.speechSynthesis) { $('rStatus').textContent = 'This browser has no speech synthesis. Download the WAV instead.'; return; }
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      setPlayLabel(false);
      $('rStatus').textContent = 'Paused. Press Play audio to resume.';
      return;
    }
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
      setPlayLabel(true);
      $('rStatus').textContent = 'Playing the audio summary.';
      return;
    }
    var text = scriptPlain();
    if (!text) { $('rStatus').textContent = 'There is no script to read yet.'; return; }
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    var voices = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    var en = null;
    voices.forEach(function (v) { if (!en && /^en/i.test(v.lang)) en = v; });
    if (en) u.voice = en;
    u.onend = function () { if (state.speechTimer) { clearInterval(state.speechTimer); state.speechTimer = null; } setPlayLabel(false); };
    u.onerror = function () { setPlayLabel(false); $('rStatus').textContent = 'The browser voice stopped. Download the WAV to keep a file.'; };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setPlayLabel(true);
    if (state.speechTimer) clearInterval(state.speechTimer);
    state.speechTimer = setInterval(function () {
      if (!speechSynthesis.speaking) { clearInterval(state.speechTimer); state.speechTimer = null; setPlayLabel(false); return; }
      if (speechSynthesis.paused) return;
      speechSynthesis.pause();
      speechSynthesis.resume();
    }, 10000);
    $('rStatus').textContent = 'Playing the audio summary in the browser voice.';
  }
  function downloadAudio() {
    if (!window.WRTTS) { $('rStatus').textContent = 'The audio engine did not load.'; return; }
    $('rStatus').textContent = 'Building the WAV in this browser…';
    setTimeout(function () {
      try {
        var bytes = window.WRTTS.wav(scriptPlain());
        download(fileSlug() + '.wav', 'audio/wav', new Blob([bytes], { type: 'audio/wav' }));
        $('rStatus').textContent = 'Downloaded a WAV of this script. It was built in the browser, with no upload.';
      } catch (err) { $('rStatus').textContent = 'Could not build the audio file. ' + err.message; }
    }, 30);
  }
  function fileSlug() {
    var p = state.last ? state.last.period : null;
    return 'wr-store-report-' + (p ? p.start + '_' + p.end : 'draft');
  }

  function paintSections() {
    $('rSectionList').innerHTML = state.order.map(function (id) {
      var label = SECTIONS.filter(function (s) { return s.id === id; })[0].label;
      return '<div class="sec-row" data-id="' + id + '"><button type="button" data-move="-1" aria-label="Move ' + esc(label) + ' up">↑</button><button type="button" data-move="1" aria-label="Move ' + esc(label) + ' down">↓</button><label class="check"><input type="checkbox" data-on="' + id + '"' + (state.on[id] ? ' checked' : '') + '> ' + esc(label) + '</label></div>';
    }).join('');
  }
  function applySectionDom() {
    var doc = $('reportDoc');
    state.order.forEach(function (id) {
      var el = doc.querySelector('[data-sec="' + id + '"]');
      if (!el) return;
      el.classList.toggle('hide', !state.on[id]);
      doc.appendChild(el);
    });
    paintReportChart(state.last);
  }

  function loadPresetList() {
    var all = readStore();
    var sel = $('rPresets');
    var cur = sel.value;
    sel.innerHTML = '<option value="">Saved presets</option>' + all.map(function (p, i) { return '<option value="' + i + '">' + esc(p.name) + '</option>'; }).join('');
    if (cur) sel.value = cur;
  }
  function readStore() { try { return JSON.parse(localStorage.getItem(LS) || '[]') || []; } catch (e) { return []; } }
  function writeStore(all) { localStorage.setItem(LS, JSON.stringify(all)); }

  function snapshot() {
    captureEdits();
    readControls();
    return {
      name: ($('rPresetName').value || '').trim() || ('Preset ' + new Date().toISOString().slice(0, 16)),
      period: state.period, from: state.from, to: state.to, store: state.store, chan: state.chan, cat: state.cat,
      tone: state.tone, topN: state.topN, keepEdits: state.keepEdits,
      order: state.order.slice(), on: Object.assign({}, state.on), edits: Object.assign({}, state.edits), notes: state.notes
    };
  }
  function applyPreset(p) {
    state.period = p.period; state.from = p.from; state.to = p.to; state.store = p.store; state.chan = p.chan; state.cat = p.cat;
    state.tone = p.tone; state.topN = p.topN; state.keepEdits = p.keepEdits !== false;
    state.order = (p.order && p.order.length) ? p.order.slice() : SECTIONS.map(function (s) { return s.id; });
    state.on = Object.assign({}, p.on || {});
    SECTIONS.forEach(function (s) {
      if (state.order.indexOf(s.id) < 0) state.order.push(s.id);
      if (state.on[s.id] == null) state.on[s.id] = true;
    });
    state.edits = Object.assign({}, p.edits || {});
    state.notes = p.notes || '';
    state.touchedPeriod = true;
    writeControls();
    renderReport({ skipCapture: true });
  }

  function bind() {
    $('btnReport').addEventListener('click', openReport);
    $('rClose').addEventListener('click', closeReport);
    $('reportOverlay').addEventListener('click', function (e) { if (e.target === $('reportOverlay')) closeReport(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('reportOverlay').classList.contains('hide')) closeReport(); });
    ['rPeriod', 'rStore', 'rChan', 'rCat', 'rTone', 'rTop', 'rFrom', 'rTo', 'rKeep'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        if (id === 'rPeriod') { state.touchedPeriod = true; $('rCustom').classList.toggle('hide', $('rPeriod').value !== 'custom'); }
        if (id === 'rStore') syncChanOptions();
        renderReport();
      });
    });
    $('rRegen').addEventListener('click', function () { renderReport(); });
    $('rDiscard').addEventListener('click', function () { state.edits = {}; renderReport({ skipCapture: true }); $('rStatus').textContent += ' Edits cleared.'; });
    $('rPdf').addEventListener('click', function () { window.print(); });
    $('rHtml').addEventListener('click', function () { download(fileSlug() + '.html', 'text/html', exportHtml()); });
    $('rMd').addEventListener('click', function () { download(fileSlug() + '.md', 'text/markdown', toMarkdown()); });
    $('rCopy').addEventListener('click', function () { copyRich(false); });
    $('rMail').addEventListener('click', function (e) { e.preventDefault(); openGmail('report'); });
    $('rMailAudio').addEventListener('click', function (e) { e.preventDefault(); openGmail('audio'); });
    $('rPlay').addEventListener('click', toggleSpeech);
    $('rWav').addEventListener('click', downloadAudio);
    $('reportDoc').addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-audio');
      if (act === 'toggle') toggleSpeech();
      else if (act === 'wav') downloadAudio();
    });
    $('rSectionList').addEventListener('click', function (e) {
      var row = e.target.closest('.sec-row'); if (!row) return;
      var id = row.getAttribute('data-id');
      var dir = e.target.getAttribute('data-move');
      if (!dir) return;
      var i = state.order.indexOf(id), j = i + (+dir);
      if (j < 0 || j >= state.order.length) return;
      var tmp = state.order[i]; state.order[i] = state.order[j]; state.order[j] = tmp;
      paintSections(); applySectionDom();
    });
    $('rSectionList').addEventListener('change', function (e) {
      var id = e.target.getAttribute('data-on'); if (!id) return;
      state.on[id] = e.target.checked;
      applySectionDom();
    });
    $('reportDoc').addEventListener('input', function (e) {
      var el = e.target.closest('[data-block]'); if (!el) return;
      var id = el.getAttribute('data-block');
      if (id === 'notes.body') { state.notes = el.innerHTML; return; }
      el.setAttribute('data-dirty', '1');
      state.edits[id] = el.innerHTML;
    });
    $('rSave').addEventListener('click', function () {
      try {
        var all = readStore(), snap = snapshot(), idx = -1;
        all.forEach(function (p, i) { if (p.name === snap.name) idx = i; });
        if (idx >= 0) all[idx] = snap; else all.push(snap);
        writeStore(all); loadPresetList();
        $('rStatus').textContent = 'Saved preset “' + snap.name + '” in this browser.';
      } catch (err) { $('rStatus').textContent = 'Could not save the preset in this browser.'; }
    });
    $('rLoad').addEventListener('click', function () {
      var all = readStore(), i = +$('rPresets').value;
      if (!all[i]) { $('rStatus').textContent = 'Choose a saved preset first.'; return; }
      applyPreset(all[i]);
      $('rPresetName').value = all[i].name;
      $('rStatus').textContent = 'Loaded preset “' + all[i].name + '”.';
    });
    $('rDelete').addEventListener('click', function () {
      var all = readStore(), i = +$('rPresets').value;
      if (!all[i]) return;
      var name = all[i].name;
      all.splice(i, 1); writeStore(all); loadPresetList();
      $('rStatus').textContent = 'Deleted preset “' + name + '”.';
    });
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* clipboard blocked */ }
    ta.remove();
  }
  function initState() {
    state = {
      period: 'last-month', from: '', to: '', store: -1, chan: -1, cat: -1, tone: 'marketing', topN: 5, keepEdits: true,
      order: SECTIONS.map(function (s) { return s.id; }), on: {}, edits: {}, notes: '', touchedPeriod: false, last: null, chart: null, speechTimer: null
    };
    SECTIONS.forEach(function (s) { state.on[s.id] = true; });
  }
  function openReport() {
    if (!state) initState();
    var pf = api.pageFilters();
    state.store = pf.store; state.chan = pf.chan; state.cat = pf.cat;
    if (!state.touchedPeriod) state.period = 'last-month';
    var meta = D().meta;
    $('rFrom').min = $('rTo').min = meta.start; $('rFrom').max = $('rTo').max = meta.end;
    if (!state.from) state.from = meta.end.slice(0, 8) + '01';
    if (!state.to) state.to = meta.end;
    writeControls();
    $('reportOverlay').classList.remove('hide');
    document.body.classList.add('report-open');
    renderReport();
    var st = $('rStatus').textContent;
    $('rStatus').textContent = st + ' Storefront, channel, and category were copied from the dashboard.';
  }
  function closeReport() {
    captureEdits();
    stopSpeech();
    $('reportOverlay').classList.add('hide');
    document.body.classList.remove('report-open');
  }

  function copySelect(from, to) { $(to).innerHTML = $(from).innerHTML; }

  window.WRReportInstall = function (next) {
    api = next;
    initState();
    copySelect('fStore', 'rStore');
    copySelect('fChan', 'rChan');
    copySelect('fCat', 'rCat');
    bind();
    loadPresetList();
    window.__WR_REPORT = {
      model: function (o) { return buildModel(o); },
      open: openReport,
      markdown: toMarkdown,
      html: exportHtml,
      fragment: fragmentHtml,
      plain: plainReport,
      header: function (o) { return headerLine(o || state.last); },
      script: function (o) { return o ? podcastScript(o).join('\n\n') : scriptPlain(); },
      gmail: gmailLink,
      mail: function () { return $('rMail').getAttribute('href') || ''; },
      audioMail: function () { return $('rMailAudio').getAttribute('href') || ''; },
      state: function () { return state; }
    };
  };
})();
