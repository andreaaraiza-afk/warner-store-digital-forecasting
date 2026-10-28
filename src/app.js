(function () {
'use strict';
var D, N, T, NCH, NST, NDTC; // data, ndays, today index, #channels, #storefronts, #DTC channels
var $ = function (id) { return document.getElementById(id); };
var charts = {};
var COL = ['#f5c542', '#e8453c', '#5aa9ff', '#3ddc97', '#a78bfa', '#ff9f43', '#4dd0e1', '#f472b6', '#c3e88d'];
var PLAT = { Google: '#5aa9ff', Meta: '#a78bfa', TikTok: '#f472b6', 'Amazon Ads': '#ff9900' };
var STC = ['#f5c542', '#ff9900', '#ffbf69', '#c77d22'];
var SOCC = ['#e1306c', '#25f4ee', '#ff4444', '#4b7bec', '#d0d0d8'];
Chart.defaults.color = '#9a9aae'; Chart.defaults.borderColor = 'rgba(255,255,255,.06)'; Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.plugins.legend.labels.boxWidth = 10;
function fm(v, d) { if (v == null || isNaN(v)) return '—'; var a = Math.abs(v); if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'; if (a >= 1e4) return '$' + (v / 1e3).toFixed(1) + 'K'; return '$' + v.toFixed(d == null ? 0 : d).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fn(v) { if (v == null || isNaN(v)) return '—'; var a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (a >= 1e4) return (v / 1e3).toFixed(1) + 'K'; return Math.round(v).toLocaleString('en-US'); }
function fp(v, d) { return v == null || isNaN(v) || !isFinite(v) ? '—' : (v * 100).toFixed(d == null ? 1 : d) + '%'; }
function pct(a, b) { return b ? a / b - 1 : null; }
function sgn(p) { return p == null || !isFinite(p) ? 'n/a' : (p >= 0 ? '+' : '−') + fp(Math.abs(p)); }
function delta(a, b, inv) { var p = pct(a, b); if (p == null || !isFinite(p)) return '<span class="d neu">n/a</span>'; var up = p >= 0, good = inv ? !up : up; return '<span class="d ' + (Math.abs(p) < .005 ? 'neu' : good ? 'up' : 'dn') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(p * 100).toFixed(1) + '%</span>'; }
function ddelta(a, b) { if (a == null || b == null || isNaN(a) || isNaN(b)) return '<span class="d neu">n/a</span>'; var x = a - b; return '<span class="d ' + (x >= 0 ? 'up' : 'dn') + '">' + (x >= 0 ? '▲ ' : '▼ ') + Math.abs(x * 100).toFixed(1) + ' pts</span>'; }
function sum(a, s, e) { var t = 0; for (var i = s; i <= e; i++) t += a[i] || 0; return t; }
function mk(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); return charts[id]; }
function kpiHtml(k) { return k.map(function (x) { return '<div class="kpi"><div class="l">' + x[0] + '</div><div class="v">' + x[1] + '</div>' + (x[2] || '<span class="d neu">n/a</span>') + '</div>'; }).join(''); }

// ---------- storefront helpers ----------
// store filter: -1 all, 0 Shopify DTC, 10 all Amazon, 1..3 a single Amazon marketplace
function stOk(s, f) { return f === -1 || (f === 10 ? s > 0 : s === f); }
function incDTC(f) { return f === -1 || f === 0; }
function incAmz(f) { return f !== 0; }
function storeLabel(f) { return f === -1 ? 'all storefronts' : f === 10 ? 'Amazon (all marketplaces)' : D.stores[f]; }
function invFor(p, f) {
  var oh = 0, v = 0; for (var s = 0; s < NST; s++) if (stOk(s, f)) { oh += p.stock[s]; v += p.vel[s]; }
  var dtc = incDTC(f); return { onHand: oh, vel: v, inbound: dtc ? p.inbound : 0, eta: dtc ? p.inboundEta : null };
}

// ---------- aggregation ----------
function agg(s, e, f) {
  if (s < 0) return null;
  var C = D.categories.length, P = D.products.length, O = D.orders, L = D.lines, i;
  var r = { gross: 0, ret: 0, orders: 0, units: 0, newC: 0, fee: 0, feeRef: 0, cat: new Float64Array(C), chan: new Float64Array(NCH), reg: new Float64Array(D.regions.length), pu: new Float64Array(P), pr: new Float64Array(P), pru: new Float64Array(P), pfee: new Float64Array(P),
    st: new Float64Array(NST), stOrd: new Float64Array(NST), stUnits: new Float64Array(NST), stFee: new Float64Array(NST), stFeeRef: new Float64Array(NST), stNew: new Float64Array(NST), puS: [], dSt: [],
    soc: new Float64Array(5), socOrd: new Float64Array(5), socNew: 0, socArt: {}, dSoc: [], dSocP: [[], [], [], [], []], dRev: [], dOrd: [], dNew: [], s: s, e: e };
  for (i = 0; i < NST; i++) { r.puS.push(new Float64Array(P)); r.dSt.push([]); }
  for (var d = s; d <= e; d++) {
    var dr = 0, dord = 0, dn = 0, ds = [0, 0, 0, 0], dso = [0, 0, 0, 0, 0];
    for (var o = O.dayStart[d]; o < O.dayStart[d + 1]; o++) {
      var so = O.store[o];
      if (!stOk(so, f.store)) continue; if (f.chan >= 0 && O.chan[o] !== f.chan) continue; if (f.reg >= 0 && O.reg[o] !== f.reg) continue;
      var hit = 0, orev = 0, sc = O.soc[o];
      for (var l = O.line[o]; l < O.line[o + 1]; l++) {
        var p = L.prod[l], c = D.products[p].cat; if (f.cat >= 0 && c !== f.cat) continue;
        hit = 1; var v = L.rev[l], q = L.qty[l], nv = L.ret[l] ? 0 : v, fe = L.fee[l];
        r.gross += v; if (L.ret[l]) { r.ret += v; r.pru[p] += q; } r.units += q; r.cat[c] += nv; r.pu[p] += q; r.pr[p] += nv; orev += nv;
        r.fee += fe; r.feeRef += L.feeRef[l]; r.pfee[p] += fe; r.stFee[so] += fe; r.stFeeRef[so] += L.feeRef[l]; r.stUnits[so] += q; r.puS[so][p] += q;
        if (sc < 5) { var a = D.products[p].artist; r.socArt[a] = (r.socArt[a] || 0) + nv; }
      }
      if (hit) {
        r.orders++; dord++; dr += orev; r.chan[O.chan[o]] += orev; r.reg[O.reg[o]] += orev; r.st[so] += orev; r.stOrd[so]++; ds[so] += orev;
        if (O.isNew[o]) { r.newC++; dn++; r.stNew[so]++; }
        if (sc < 5) { r.soc[sc] += orev; r.socOrd[sc]++; dso[sc] += orev; if (O.isNew[o]) r.socNew++; }
      }
    }
    r.dRev.push(dr); r.dOrd.push(dord); r.dNew.push(dn); for (i = 0; i < NST; i++) r.dSt[i].push(ds[i]);
    var tso = 0; for (i = 0; i < 5; i++) { r.dSocP[i].push(dso[i]); tso += dso[i]; } r.dSoc.push(tso);
  }
  r.net = r.gross - r.ret; r.aov = r.orders ? r.net / r.orders : 0; r.retRate = r.gross ? r.ret / r.gross : 0; r.newShare = r.orders ? r.newC / r.orders : 0;
  r.socNet = r.soc.reduce(function (a, b) { return a + b; }, 0); r.socOrders = r.socOrd.reduce(function (a, b) { return a + b; }, 0);
  r.amzNet = r.st[1] + r.st[2] + r.st[3];
  r.dSess = [];
  for (d = s; d <= e; d++) { var row = D.sessions[d], t = 0; for (var st = 0; st < NST; st++) if (stOk(st, f.store)) for (var ch = 0; ch < NCH; ch++) if (f.chan < 0 || ch === f.chan) t += row[st * NCH + ch]; r.dSess.push(t); }
  if (f.cat < 0 && f.reg < 0) { r.sessions = r.dSess.reduce(function (a, b) { return a + b; }, 0); r.cvr = r.sessions ? r.orders / r.sessions : null; } else { r.sessions = null; r.cvr = null; }
  return r;
}
function mediaOk(m, plat, store) { if (plat && m.platform !== plat) return false; return stOk(m.store, store); }
function mediaAgg(s, e, plat, store) {
  if (s < 0) return null;
  var rows = D.media.filter(function (m) { return mediaOk(m, plat, store); }).map(function (m) {
    var x = { m: m, spend: sum(m.spend, s, e), impr: sum(m.impr, s, e), clicks: sum(m.clicks, s, e), conv: sum(m.conv, s, e), rev: sum(m.rev, s, e), newc: sum(m.newc, s, e) };
    x.roas = x.spend ? x.rev / x.spend : null; x.cac = x.newc ? x.spend / x.newc : null; x.ctr = x.impr ? x.clicks / x.impr : null; x.cpc = x.clicks ? x.spend / x.clicks : null; x.cvr = x.clicks ? x.conv / x.clicks : null; x.acos = x.rev ? x.spend / x.rev : null; return x;
  });
  var t = { spend: 0, impr: 0, clicks: 0, conv: 0, rev: 0, newc: 0, rows: rows, plat: {} };
  rows.forEach(function (x) { ['spend', 'impr', 'clicks', 'conv', 'rev', 'newc'].forEach(function (k) { t[k] += x[k]; }); var p = t.plat[x.m.platform] = t.plat[x.m.platform] || { spend: 0, rev: 0, newc: 0 }; p.spend += x.spend; p.rev += x.rev; p.newc += x.newc; });
  t.roas = t.spend ? t.rev / t.spend : null; t.cac = t.newc ? t.spend / t.newc : null; t.ctr = t.impr ? t.clicks / t.impr : null; t.cpc = t.clicks ? t.spend / t.clicks : null; t.acos = t.rev ? t.spend / t.rev : null; return t;
}
function crmAgg(s, e) {
  if (s < 0) return null;
  var a = D.iso(s), b = D.iso(e);
  var camps = D.crm.campaigns.filter(function (c) { return c.date >= a && c.date <= b; });
  var flows = D.crm.flows.map(function (f) { var x = { name: f.name, channel: f.channel, sends: sum(f.sends, s, e), opens: sum(f.opens, s, e), clicks: sum(f.clicks, s, e), conv: sum(f.conv, s, e), rev: sum(f.rev, s, e), unsubs: sum(f.unsubs, s, e) }; x.rpr = x.sends ? x.rev / x.sends : 0; return x; });
  var t = { camps: camps, flows: flows, campRev: 0, flowRev: 0, eRec: 0, eOpen: 0, eClick: 0, eUnsub: 0, sRec: 0, sClick: 0, sUnsub: 0 };
  camps.forEach(function (c) { t.campRev += c.rev; if (c.channel === 'email') { t.eRec += c.recipients; t.eOpen += c.opens; t.eClick += c.clicks; t.eUnsub += c.unsubs; } else { t.sRec += c.recipients; t.sClick += c.clicks; t.sUnsub += c.unsubs; } });
  flows.forEach(function (f) { t.flowRev += f.rev; });
  t.rev = t.campRev + t.flowRev; t.openRate = t.eRec ? t.eOpen / t.eRec : null; t.clickRate = t.eRec ? t.eClick / t.eRec : null; t.smsCtr = t.sRec ? t.sClick / t.sRec : null; t.unsubRate = t.eRec ? t.eUnsub / t.eRec : null;
  t.eList = D.crm.emailList[e].size; t.sList = D.crm.smsList[e].size; t.eGrowth = t.eList - (s > 0 ? D.crm.emailList[s - 1].size : D.crm.emailList[0].size); t.sGrowth = t.sList - (s > 0 ? D.crm.smsList[s - 1].size : D.crm.smsList[0].size);
  return t;
}

// ---------- state ----------
function getRange() {
  var v = $('fRange').value, e = T, s;
  if (v === 'custom') { s = Math.max(0, D.dayOf($('fFrom').value)); e = Math.min(T, D.dayOf($('fTo').value)); if (!(s <= e)) { s = T - 29; e = T; } }
  else if (v === 'qtd') s = D.dayOf('2026-10-01'); else if (v === 'ytd') s = D.dayOf('2026-01-01');
  else if (v === 'bf') { s = D.dayOf('2025-11-21'); e = D.dayOf('2025-12-02'); }
  else if (v === 'rsd') { s = D.dayOf('2026-04-13'); e = D.dayOf('2026-04-26'); }
  else s = T - (+v) + 1;
  var len = e - s + 1, cmp = $('fCmp').value === 'yoy' ? [s - 364, e - 364] : [s - len, s - 1];
  return { s: s, e: e, len: len, cs: cmp[0], ce: cmp[1] };
}
function filt() { return { cat: +$('fCat').value, chan: +$('fChan').value, reg: +$('fReg').value, store: +$('fStore').value }; }
function buckets(s, e) { var len = e - s + 1, w = len > 120 ? 7 : 1, out = []; for (var d = s; d <= e; d += w) out.push([d, Math.min(e, d + w - 1)]); return { w: w, b: out }; }
function bsum(arr, s0, b) { return b.map(function (x) { var t = 0; for (var d = x[0]; d <= x[1]; d++) t += arr[d - s0] || 0; return t; }); }
function syncChannelOptions() {
  var st = +$('fStore').value, sel = $('fChan');
  Array.prototype.forEach.call(sel.options, function (op) { var v = +op.value; if (v < 0) return; var amzCh = v >= NDTC; op.disabled = (st === 0 && amzCh) || (st > 0 && !amzCh); });
  if (sel.selectedOptions[0] && sel.selectedOptions[0].disabled) sel.value = '-1';
  Array.prototype.forEach.call($('fReg').options, function (op) { var v = +op.value; op.disabled = (st === 2 || st === 3) && v >= 0 && v !== 4; });
  if ($('fReg').selectedOptions[0] && $('fReg').selectedOptions[0].disabled) $('fReg').value = '-1';
}

// ---------- render ----------
var state = {};
function render() {
  syncChannelOptions();
  var R = getRange(), F = filt(); state.R = R; state.F = F;
  var cur = agg(R.s, R.e, F), cmp = R.cs >= 0 ? agg(R.cs, R.ce, F) : null;
  var m = mediaAgg(R.s, R.e, '', F.store), mc = R.cs >= 0 ? mediaAgg(R.cs, R.ce, '', F.store) : null;
  var c = crmAgg(R.s, R.e), cc = R.cs >= 0 ? crmAgg(R.cs, R.ce) : null;
  state.cur = cur; state.cmp = cmp; state.dtcAll = (F.chan < 0 ? cur : agg(R.s, R.e, Object.assign({}, F, { chan: -1 }))).st[0]; state.m = m; state.mc = mc; state.c = c; state.cc = cc;
  state.FC = getForecast(F.store);
  $('rangeInfo').innerHTML = '<b>' + storeLabel(F.store) + '</b> · ' + D.iso(R.s) + ' → ' + D.iso(R.e) + ' (' + R.len + 'd) vs ' + (R.cs >= 0 ? D.iso(R.cs) + ' → ' + D.iso(R.ce) : 'n/a (before data start)');
  var dtc = incDTC(F.store), amz = incAmz(F.store);
  var k = [
    ['Net revenue', fm(cur.net), cmp && delta(cur.net, cmp.net)], ['Orders', fn(cur.orders), cmp && delta(cur.orders, cmp.orders)],
    ['AOV', fm(cur.aov, 2), cmp && delta(cur.aov, cmp.aov)], ['Units sold', fn(cur.units), cmp && delta(cur.units, cmp.units)],
    [F.store > 0 || F.store === 10 ? 'Unit session %' : 'Conversion rate', cur.cvr == null ? '—' : fp(cur.cvr, 2), cur.cvr == null ? '<span class="d neu">n/a with category/region filter</span>' : cmp && delta(cur.cvr, cmp.cvr)],
    [dtc ? 'New customer share' : 'New-to-brand share', fp(cur.newShare), cmp && ddelta(cur.newShare, cmp.newShare)], ['Return rate', fp(cur.retRate), cmp && delta(cur.retRate, cmp.retRate, true)],
    ['Paid media MER', m.spend ? (cur.net / m.spend).toFixed(2) + 'x' : '—', cmp && mc && mc.spend ? delta(cur.net / m.spend, cmp.net / mc.spend) : '']
  ];
  if (dtc) k.push(['Organic social revenue', fm(cur.socNet), cmp && delta(cur.socNet, cmp.socNet)]);
  if (amz) k.push(['Amazon fees', fm(cur.fee), cmp && delta(cur.fee, cmp.fee, true)]);
  k.push(['CRM revenue (DTC)', dtc ? fm(c.rev) : '—', dtc ? cc && delta(c.rev, cc.rev) : '<span class="d neu">Klaviyo covers Shopify DTC only</span>']);
  $('kpis').innerHTML = kpiHtml(k);
  renderOverview(cur, cmp, R); renderProducts(); renderAmazon(); renderMedia(); renderCrm(); renderForecast(); renderInsights(); renderSeoUx();
}
function auditRun(id, form) {
  var A = window.WRAudit; if (!A || !A.runs) return null;
  for (var i = 0; i < A.runs.length; i++) if (A.runs[i].id === id && A.runs[i].formFactor === form) return A.runs[i];
  return null;
}
function auditDemo(s, e, f) {
  var A = window.WRAudit, model = A && A.demoModel;
  var dtc = !f || f.store === -1 || f.store === 0;
  var organicBlocked = f && f.chan >= 0 && f.chan !== 0;
  var dtcBlocked = f && f.chan >= NDTC;
  var out = { dtc: dtc, organicBlocked: organicBlocked, dtcBlocked: dtcBlocked, keywords: [], pages: [], devices: null, organic: null };
  if (!model) return out;
  if (dtc && !organicBlocked) {
    var org = agg(s, e, { store: 0, chan: 0, cat: f.cat, reg: f.reg });
    out.organic = { net: org.net, orders: org.orders, sessions: org.sessions, cvr: org.cvr };
    out.keywords = model.keywords.map(function (k) {
      var clicks = org.sessions != null ? org.sessions * k.share : null;
      return { query: k.query, position: k.position, ctr: k.ctr, share: k.share, clicks: clicks, impressions: clicks != null && k.ctr ? clicks / k.ctr : null, revenue: org.net * k.share };
    });
    out.pages = model.pages.map(function (p) {
      return { path: p.path, title: p.title, share: p.share, revenue: org.net * p.share, sessions: org.sessions != null ? org.sessions * p.share : null };
    });
  }
  if (dtc && !dtcBlocked) {
    var chan = f.chan >= 0 && f.chan < NDTC ? f.chan : -1;
    var base = agg(s, e, { store: 0, chan: chan, cat: f.cat, reg: f.reg });
    var sess = null;
    if (base.cvr != null) {
      sess = 0;
      var chans = chan >= 0 ? [chan] : [0, 1, 2, 3, 4, 5, 6, 7];
      for (var d = s; d <= e; d++) chans.forEach(function (ch) { sess += D.sessions[d][ch] || 0; });
    }
    var om = base.orders * model.mobileOrderShare, od = base.orders - om;
    var rm = base.net * model.mobileRevenueShare, rd = base.net - rm;
    var sm = sess == null ? null : sess * model.mobileSessionShare;
    var sd = sess == null ? null : sess - sm;
    out.devices = {
      mobile: { sessions: sm, orders: om, revenue: rm, cvr: sm ? om / sm : null, aov: om ? rm / om : 0 },
      desktop: { sessions: sd, orders: od, revenue: rd, cvr: sd ? od / sd : null, aov: od ? rd / od : 0 }
    };
    out.deviceBase = { orders: base.orders, net: base.net, sessions: sess };
  }
  return out;
}
function scoreColor(n) { return n == null ? 'var(--mut)' : n >= 90 ? 'var(--good)' : n >= 50 ? 'var(--acc)' : 'var(--bad)'; }
function sevClass(s) { return s === 'high' ? 'sev-high' : s === 'low' ? 'sev-low' : 'sev-medium'; }
function issueLi(list) {
  return (list || []).map(function (it) {
    return '<li><span class="sev ' + sevClass(it.severity) + '">' + it.severity.toUpperCase() + '</span><b>' + it.title + '</b><div class="muted">' + it.detail + '</div></li>';
  }).join('');
}
function renderSeoUx() {
  var A = window.WRAudit;
  if (!$('seo') || !A) return;
  var homeM = auditRun('home', 'mobile'), homeD = auditRun('home', 'desktop');
  $('seoBanner').textContent = A.source;
  $('seoNote').textContent = 'Audited ' + (A.auditedAt || '').replace('T', ' ').slice(0, 16) + ' UTC · Lighthouse ' + (A.lighthouseVersion || '') + ' · ' + (A.fieldNote || '');
  var pills = [];
  [['Performance', homeM && homeM.scores.performance, homeD && homeD.scores.performance], ['Accessibility', homeM && homeM.scores.accessibility, homeD && homeD.scores.accessibility], ['Best practices', homeM && homeM.scores.bestPractices, homeD && homeD.scores.bestPractices], ['SEO', homeM && homeM.scores.seo, homeD && homeD.scores.seo]].forEach(function (row) {
    pills.push('<div class="score-pill"><span>' + row[0] + '</span><b style="color:' + scoreColor(row[1]) + '">' + (row[1] == null ? '—' : row[1]) + '</b><span>mobile · desktop ' + (row[2] == null ? '—' : row[2]) + '</span></div>');
  });
  $('seoScores').innerHTML = pills.join('');
  if (homeM && homeD) {
    var labs = ['performance', 'accessibility', 'bestPractices', 'seo'];
    var labels = ['Performance', 'Accessibility', 'Best practices', 'SEO'];
    mk('cSeoScore', { type: 'bar', data: { labels: labels, datasets: [
      { label: 'Mobile', data: labs.map(function (k) { return homeM.scores[k]; }), backgroundColor: '#5aa9ff', borderRadius: 3 },
      { label: 'Desktop', data: labs.map(function (k) { return homeD.scores[k]; }), backgroundColor: '#f5c542', borderRadius: 3 }
    ] }, options: { maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } } });
  }
  var realIssues = (A.issues || []).filter(function (i) { return i.area === 'seo' || i.area === 'both'; });
  $('seoIssues').innerHTML = issueLi(realIssues);
  var demo = auditDemo(state.R.s, state.R.e, state.F);
  var kwNote = 'DEMO · not Search Console. ';
  if (!demo.dtc) kwNote += 'Storefront filter is Amazon, so Shopify organic keywords are hidden.';
  else if (demo.organicBlocked) kwNote += 'Channel filter excludes Organic Search, so keyword revenue is hidden.';
  else if (demo.organic) kwNote += 'Revenue and clicks allocate this period’s Shopify Organic Search (' + fm(demo.organic.net) + ', ' + fn(demo.organic.orders) + ' orders).';
  else kwNote += 'Demo model is not in this build.';
  $('seoKwNote').textContent = kwNote;
  table('tSeoKw', [{ k: 'query', l: 'Keyword' }, { k: 'position', l: 'Position', n: 1, f: function (v) { return v.toFixed(1); } }, { k: 'impressions', l: 'Impressions', n: 1, f: function (v) { return v == null ? '—' : fn(v); } }, { k: 'clicks', l: 'Clicks', n: 1, f: function (v) { return v == null ? '—' : fn(v); } }, { k: 'ctr', l: 'CTR', n: 1, f: function (v) { return fp(v, 1); } }, { k: 'revenue', l: 'Revenue', n: 1, f: fm }], demo.keywords, 'revenue', true);
  table('tSeoPages', [{ k: 'path', l: 'Page' }, { k: 'title', l: 'Title' }, { k: 'sessions', l: 'Sessions', n: 1, f: function (v) { return v == null ? '—' : fn(v); } }, { k: 'revenue', l: 'Organic revenue', n: 1, f: fm }], demo.pages, 'revenue', true);
  table('tSeoFix', [{ k: 'rank', l: '#', n: 1 }, { k: 'title', l: 'Fix' }, { k: 'source', l: 'Source' }, { k: 'impact', l: 'Impact' }, { k: 'effort', l: 'Effort' }], (A.fixes || []).filter(function (x) { return x.area !== 'ux'; }), 'rank', false);
  $('uxBanner').textContent = A.uxNote || A.source;
  var pages = ['home', 'collection', 'product', 'search', 'cart'];
  var vitalRows = pages.map(function (id) {
    var m = auditRun(id, 'mobile'), d = auditRun(id, 'desktop');
    return m ? { page: id, lcpM: m.lab.lcpMs, lcpD: d && d.lab.lcpMs, clsM: m.lab.cls, clsD: d && d.lab.cls, tbtM: m.lab.tbtMs, tbtD: d && d.lab.tbtMs } : null;
  }).filter(Boolean);
  if (vitalRows.length) mk('cUxVital', { type: 'bar', data: { labels: vitalRows.map(function (r) { return r.page; }), datasets: [
    { label: 'Mobile LCP (s)', data: vitalRows.map(function (r) { return r.lcpM / 1000; }), backgroundColor: '#e8453c', borderRadius: 3 },
    { label: 'Desktop LCP (s)', data: vitalRows.map(function (r) { return r.lcpD / 1000; }), backgroundColor: '#f5c542', borderRadius: 3 }
  ] }, options: { maintainAspectRatio: false, scales: { y: { ticks: { callback: function (v) { return v + 's'; } } } } } });
  function cell(run) { return !run ? '—' : '<b style="color:' + scoreColor(run.scores.performance) + '">' + run.scores.performance + '</b> / ' + run.scores.accessibility + ' / ' + run.scores.bestPractices + ' / ' + run.scores.seo; }
  $('uxScoreTable').innerHTML = '<table><thead><tr><th>Page</th><th>Mobile P / A / BP / SEO</th><th>Desktop</th><th>Mobile LCP</th><th>CLS</th><th>TBT</th></tr></thead><tbody>' + pages.map(function (id) {
    var m = auditRun(id, 'mobile'), d = auditRun(id, 'desktop');
    if (!m) return '';
    return '<tr><td>' + id + '</td><td>' + cell(m) + '</td><td>' + cell(d) + '</td><td>' + (m.lab.lcpMs / 1000).toFixed(1) + 's</td><td>' + m.lab.cls + '</td><td>' + Math.round(m.lab.tbtMs) + 'ms</td></tr>';
  }).join('') + '</tbody></table>';
  var shots = A.screenshots || {};
  $('uxShots').innerHTML = [['homeDesktop', 'Homepage · desktop'], ['homeMobile', 'Homepage · mobile'], ['productDesktop', 'Product · desktop'], ['productMobile', 'Product · mobile']].map(function (pair) {
    var src = shots[pair[0]]; if (!src) return '';
    return '<figure class="card shot-card"><img alt="' + pair[1] + ' of shop.warnerrecords.com" src="' + src + '"><figcaption>' + pair[1] + ' · real public screenshot</figcaption></figure>';
  }).join('');
  $('uxIssues').innerHTML = issueLi((A.issues || []).filter(function (i) { return i.area === 'ux' || i.area === 'both'; }));
  var funnels = [];
  if (!demo.devices) $('uxFunnelNote').textContent = 'DEMO device split is Shopify DTC. This storefront or channel filter has no Shopify DTC orders.';
  else {
    $('uxFunnelNote').textContent = demo.devices.mobile.cvr == null ? 'DEMO allocation of filtered Shopify DTC orders. Conversion is hidden because a category or region filter is on.' : 'DEMO allocation of filtered Shopify DTC orders and sessions. Mobile is ' + Math.round((A.demoModel.mobileSessionShare) * 100) + '% of sessions, with a lower order share and a lower AOV.';
    ['mobile', 'desktop'].forEach(function (name) {
      var row = demo.devices[name];
      funnels.push({ device: name, sessions: row.sessions, orders: row.orders, cvr: row.cvr, aov: row.aov, revenue: row.revenue });
    });
  }
  table('tUxFunnel', [{ k: 'device', l: 'Device' }, { k: 'sessions', l: 'Sessions', n: 1, f: function (v) { return v == null ? '—' : fn(v); } }, { k: 'orders', l: 'Orders', n: 1, f: fn }, { k: 'cvr', l: 'Conversion', n: 1, f: function (v) { return v == null ? '—' : fp(v, 2); } }, { k: 'aov', l: 'AOV', n: 1, f: function (v) { return fm(v, 2); } }, { k: 'revenue', l: 'Net revenue', n: 1, f: fm }], funnels, 'revenue', true);
}
window.WRAuditDemo = auditDemo;
function renderOverview(cur, cmp, R) {
  var B = buckets(R.s, R.e), labels = B.b.map(function (x) { return D.iso(x[0]).slice(5); });
  $('trendNote').textContent = (B.w === 7 ? 'Weekly' : 'Daily') + ' · dashed = comparison period';
  var ds = [{ type: 'bar', label: 'Net revenue', data: bsum(cur.dRev, R.s, B.b), backgroundColor: 'rgba(245,197,66,.75)', borderRadius: 3, yAxisID: 'y' },
    { type: 'line', label: 'Orders', data: bsum(cur.dOrd, R.s, B.b), borderColor: '#5aa9ff', pointRadius: 0, tension: .3, yAxisID: 'y1' }];
  if (cmp) { var cb = B.b.map(function (x) { return [x[0] - R.s + cmp.s, x[1] - R.s + cmp.s]; }); ds.push({ type: 'line', label: 'Net revenue (comparison)', data: bsum(cmp.dRev, cmp.s, cb), borderColor: 'rgba(255,255,255,.45)', borderDash: [5, 4], pointRadius: 0, tension: .3, yAxisID: 'y' }); }
  mk('cTrend', { data: { labels: labels, datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { ticks: { callback: function (v) { return fm(v); } } }, y1: { position: 'right', grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.dataset.yAxisID === 'y' ? fm(c.raw) : fn(c.raw)); } } } } } });
  var cats = D.categories;
  mk('cMix', { type: 'doughnut', data: { labels: cats, datasets: [{ data: Array.from(cur.cat), backgroundColor: COL, borderColor: '#14141b' }] }, options: { maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } }, tooltip: { callbacks: { label: function (c) { return c.label + ': ' + fm(c.raw) + ' (' + fp(c.raw / cur.net) + ')'; } } } } } });
  var chIdx = D.channels.map(function (_, i) { return i; }).filter(function (i) { return (i < NDTC ? incDTC(state.F.store) : incAmz(state.F.store)); });
  mk('cChan', { type: 'bar', data: { labels: chIdx.map(function (i) { return D.channels[i]; }), datasets: [{ label: 'Current', data: chIdx.map(function (i) { return cur.chan[i]; }), backgroundColor: chIdx.map(function (i) { return i === 1 ? '#e1306c' : i >= NDTC ? '#ff9900' : '#f5c542'; }), borderRadius: 3 }].concat(cmp ? [{ label: 'Comparison', data: chIdx.map(function (i) { return cmp.chan[i]; }), backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 3 }] : []) }, options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { ticks: { callback: function (v) { return fm(v); } } } } } });
  var g = cats.map(function (_, i) { return cmp && cmp.cat[i] ? (cur.cat[i] / cmp.cat[i] - 1) * 100 : 0; });
  mk('cCatGrowth', { type: 'bar', data: { labels: cats.map(function (c) { return c.replace(' & Limited Vinyl', ' Vinyl').replace(' & Store Exclusives', ' & Excl.').replace(' Singles', '').replace(' & Deluxe', '').replace(' & Posters', ''); }), datasets: [{ label: '% change', data: g, backgroundColor: g.map(function (v) { return v >= 0 ? '#3ddc97' : '#ff6b6b'; }), borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: function (v) { return v + '%'; } } }, x: { ticks: { font: { size: 10 } } } } } });
  mk('cReg', { type: 'bar', data: { labels: D.regions, datasets: [{ label: 'Current', data: Array.from(cur.reg), backgroundColor: '#e8453c', borderRadius: 3 }].concat(cmp ? [{ label: 'Comparison', data: Array.from(cmp.reg), backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 3 }] : []) }, options: { maintainAspectRatio: false, scales: { y: { ticks: { callback: function (v) { return fm(v); } } } } } });
  mk('cStore', { type: 'bar', data: { labels: D.stores, datasets: [{ label: 'Current', data: Array.from(cur.st), backgroundColor: STC, borderRadius: 3 }].concat(cmp ? [{ label: 'Comparison', data: Array.from(cmp.st), backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 3 }] : []) }, options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + fm(c.raw) + (cur.net ? ' (' + fp(c.raw / (c.datasetIndex ? cmp.net : cur.net)) + ')' : ''); } } } }, scales: { y: { ticks: { callback: function (v) { return fm(v); } } } } } });
  // Organic social
  var socOn = incDTC(state.F.store) && (state.F.chan < 0 || state.F.chan === 1);
  $('socNote').textContent = socOn ? 'Social referrer, no paid UTM, no affiliate link' : 'Not in current filter (Shopify DTC + Organic Social only)';
  mk('cSoc', { type: 'bar', data: { labels: D.social, datasets: [{ label: 'Net revenue', data: Array.from(cur.soc), backgroundColor: SOCC, borderRadius: 3 }].concat(cmp ? [{ label: 'Comparison', data: Array.from(cmp.soc), backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 3 }] : []) }, options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: function (c) { var src = c.datasetIndex ? cmp : cur; return c.dataset.label + ': ' + fm(c.raw) + ' · ' + fn(src.socOrd[c.dataIndex]) + ' orders'; } } } }, scales: { y: { ticks: { callback: function (v) { return fm(v); } } } } } });
  var dtcRev = cur.dSt[0];
  var sds = D.social.map(function (n, i) { return { type: 'bar', label: n, stack: 's', backgroundColor: SOCC[i], data: bsum(cur.dSocP[i], R.s, B.b), yAxisID: 'y' }; });
  var shr = bsum(cur.dSoc, R.s, B.b), dt = bsum(dtcRev, R.s, B.b);
  sds.push({ type: 'line', label: '% of DTC revenue', data: shr.map(function (v, i) { return dt[i] ? v / dt[i] * 100 : null; }), borderColor: '#fff', pointRadius: 0, tension: .3, yAxisID: 'y1' });
  mk('cSocTrend', { data: { labels: labels, datasets: sds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { font: { size: 10 } } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return fm(v); } } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return v.toFixed(0) + '%'; } } } } } });
  var nw = bsum(cur.dNew, R.s, B.b), od = bsum(cur.dOrd, R.s, B.b);
  mk('cNew', { type: 'bar', data: { labels: labels, datasets: [{ label: 'New', data: nw, backgroundColor: '#a78bfa', stack: 's' }, { label: 'Returning', data: od.map(function (v, i) { return v - nw[i]; }), backgroundColor: '#4dd0e1', stack: 's' }] }, options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } } });
  var se = bsum(cur.dSess, R.s, B.b);
  mk('cCvr', { data: { labels: labels, datasets: [{ type: 'line', label: 'Conversion rate %', data: cur.cvr == null ? [] : od.map(function (v, i) { return se[i] ? v / se[i] * 100 : null; }), borderColor: '#3ddc97', pointRadius: 0, tension: .3, yAxisID: 'y1' }, { type: 'bar', label: 'Sessions', data: se, backgroundColor: 'rgba(90,169,255,.35)', yAxisID: 'y' }] }, options: { maintainAspectRatio: false, scales: { y1: { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return v.toFixed(1) + '%'; } } } } } });
}

// ---------- tables ----------
function table(id, cols, rows, sortKey, desc) {
  var t = $(id); t._cols = cols; t._rows = rows; t._sort = t._sort || { k: sortKey, d: desc };
  if (!cols.some(function (c) { return c.k === t._sort.k; })) t._sort = { k: sortKey, d: desc };
  var s = t._sort, r = rows.slice().sort(function (a, b) { var x = a[s.k], y = b[s.k]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * (s.d ? -1 : 1); });
  t.tHead.innerHTML = '<tr>' + cols.map(function (c) { return '<th data-k="' + c.k + '" class="' + (c.n ? 'n' : '') + '">' + c.l + (s.k === c.k ? (s.d ? ' ↓' : ' ↑') : '') + '</th>'; }).join('') + '</tr>';
  t.tBodies[0].innerHTML = r.length ? r.map(function (row) { return '<tr>' + cols.map(function (c) { return '<td class="' + (c.n ? 'n' : '') + '">' + (c.f ? c.f(row[c.k], row) : row[c.k]) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + cols.length + '" class="muted">No rows for the current filters.</td></tr>';
  t.tHead.onclick = function (ev) { var k = ev.target.getAttribute('data-k'); if (!k) return; t._sort = { k: k, d: t._sort.k === k ? !t._sort.d : true }; table(id, t._cols, t._rows); };
}
function statusOf(p, cover, inv) { if (p.alloc && p.stock[0] === 0) return ['Sold out', 'p-mut']; if (inv.vel === 0 && inv.onHand === 0) return ['Not listed', 'p-mut']; if (cover < 14) return ['Stockout risk', 'p-bad']; if (cover < 30) return ['Low stock', 'p-warn']; if (cover > 180) return ['Overstock', 'p-mut']; return ['Healthy', 'p-ok']; }
var prodMode = 'best';
function productRows() {
  var cur = state.cur, cmp = state.cmp, F = state.F;
  return D.products.map(function (p, i) {
    if (F.cat >= 0 && p.cat !== F.cat) return null;
    if (F.store > 0 && !p.amz) return null;
    var inv = invFor(p, F.store), cover = inv.vel > 0 ? inv.onHand / inv.vel : 999, st = statusOf(p, cover, inv);
    var amzU = cur.puS[1][i] + cur.puS[2][i] + cur.puS[3][i];
    return { name: p.title, artist: p.artist, sku: p.sku, cat: D.categories[p.cat], units: cur.pu[i], rev: cur.pr[i], du: cmp && cmp.pu[i] ? cur.pu[i] / cmp.pu[i] - 1 : null, rr: cur.pu[i] ? cur.pru[i] / cur.pu[i] : 0, amzS: cur.pu[i] ? amzU / cur.pu[i] : (p.amz ? 0 : null), vel: inv.vel, onHand: inv.onHand, inbound: inv.inbound, eta: inv.eta || '', cover: Math.min(cover, 999), status: st[0], cls: st[1], launched: p.launch <= state.R.s, invCost: inv.onHand * p.cost, amz: p.amz, alloc: p.alloc };
  }).filter(Boolean);
}
function renderProducts() {
  var rows = productRows(), F = state.F, cols = [
    { k: 'name', l: 'Product' }, { k: 'artist', l: 'Artist' }, { k: 'sku', l: 'SKU', f: function (v) { return '<span class="muted">' + v + '</span>'; } }, { k: 'cat', l: 'Category' },
    { k: 'units', l: 'Units', n: 1, f: fn }, { k: 'rev', l: 'Net revenue', n: 1, f: function (v) { return fm(v); } }, { k: 'du', l: 'Δ units', n: 1, f: function (v) { return v == null ? '<span class="d neu">new</span>' : '<span class="d ' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%</span>'; } }];
  if (F.store === -1) cols.push({ k: 'amzS', l: 'Amazon share', n: 1, f: function (v, r) { return r.amz ? fp(v, 0) : '<span class="muted">DTC only</span>'; } });
  cols = cols.concat([{ k: 'rr', l: 'Return rate', n: 1, f: function (v) { return fp(v); } }, { k: 'vel', l: 'Units/day (28d)', n: 1, f: function (v) { return v.toFixed(1); } }, { k: 'onHand', l: F.store > 0 || F.store === 10 ? 'FBA on hand' : 'On hand', n: 1, f: fn },
    { k: 'inbound', l: 'Inbound', n: 1, f: function (v, r) { return v ? fn(v) + ' <span class="muted">' + r.eta.slice(5) + '</span>' : '—'; } }, { k: 'cover', l: 'Days of cover', n: 1, f: function (v) { return v >= 999 ? '∞' : v.toFixed(0); } },
    { k: 'status', l: 'Status', f: function (v, r) { return '<span class="pill ' + r.cls + '">' + v + '</span>'; } }]);
  var t = $('tProd');
  if (prodMode === 'best') { t._sort = { k: 'rev', d: true }; rows = rows.sort(function (a, b) { return b.rev - a.rev; }).slice(0, 25); }
  else if (prodMode === 'slow') { t._sort = { k: 'cover', d: true }; rows = rows.filter(function (r) { return r.launched && r.onHand > 0 && !r.alloc; }).sort(function (a, b) { return a.rev / Math.max(1, a.invCost) - b.rev / Math.max(1, b.invCost); }).slice(0, 15); }
  else if (prodMode === 'risk') { t._sort = { k: 'cover', d: false }; rows = rows.filter(function (r) { return r.cover < 30 && r.status !== 'Sold out' && r.vel > 0; }); }
  else t._sort = t._sort || { k: 'rev', d: true };
  $('prodNote').textContent = 'Storefront: ' + storeLabel(F.store) + (F.store > 0 || F.store === 10 ? ' · store exclusives, signed items and bundles are not listed on Amazon' : '');
  table('tProd', cols, rows, 'rev', true);
}
function renderAmazon() {
  var F = state.F, R = state.R, cur = state.cur, cmp = state.cmp;
  if (!incAmz(F.store)) { $('amzBody').classList.add('hide'); $('amzOff').classList.remove('hide'); return; }
  $('amzBody').classList.remove('hide'); $('amzOff').classList.add('hide');
  var mk3 = [1, 2, 3].filter(function (s) { return stOk(s, F.store); });
  function tot(r, k) { return r ? mk3.reduce(function (a, s) { return a + r[k][s]; }, 0) : null; }
  var rev = tot(cur, 'st'), fee = tot(cur, 'stFee'), feeRef = tot(cur, 'stFeeRef'), ord = tot(cur, 'stOrd'), un = tot(cur, 'stUnits');
  var prev = tot(cmp, 'st'), pfee = tot(cmp, 'stFee');
  var amzStore = F.store === -1 ? 10 : F.store;
  var ads = mediaAgg(R.s, R.e, 'Amazon Ads', amzStore), adsP = R.cs >= 0 ? mediaAgg(R.cs, R.ce, 'Amazon Ads', amzStore) : null;
  var k = [['Amazon net revenue', fm(rev), cmp && delta(rev, prev)], ['Orders · units', fn(ord) + ' <span class="muted" style="font-size:13px">' + fn(un) + ' u</span>', cmp && delta(ord, tot(cmp, 'stOrd'))],
    ['Amazon fees', fm(fee), cmp && delta(fee, pfee, true)], ['Fees % of revenue', fp(fee / (rev || 1)), cmp && ddelta(fee / (rev || 1), pfee / (prev || 1))],
    ['Net proceeds', fm(rev - fee), cmp && delta(rev - fee, prev - pfee)], ['Sponsored ads spend', fm(ads.spend), adsP && delta(ads.spend, adsP.spend, true)],
    ['Ads ROAS · ACoS', (ads.roas ? ads.roas.toFixed(2) + 'x' : '—') + ' <span class="muted" style="font-size:13px">' + fp(ads.acos) + '</span>', adsP && delta(ads.roas, adsP.roas)], ['TACoS', fp(ads.spend / (rev || 1)), adsP && cmp ? ddelta(ads.spend / (rev || 1), adsP.spend / (prev || 1)) : '']];
  $('amzKpis').innerHTML = kpiHtml(k);
  var B = buckets(R.s, R.e), labels = B.b.map(function (x) { return D.iso(x[0]).slice(5); });
  var ds = mk3.map(function (s) { return { type: 'bar', label: D.stores[s], stack: 's', backgroundColor: STC[s], data: bsum(cur.dSt[s], R.s, B.b) }; });
  ds.push({ type: 'line', label: 'Sponsored ads spend', yAxisID: 'y1', borderColor: '#fff', pointRadius: 0, tension: .3, data: B.b.map(function (x) { var t = 0; D.media.forEach(function (mm) { if (mediaOk(mm, 'Amazon Ads', amzStore)) t += sum(mm.spend, x[0], x[1]); }); return t; }) });
  mk('cAmzTrend', { data: { labels: labels, datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return fm(v); } } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return fm(v); } } } } } });
  mk('cAmzFees', { type: 'bar', data: { labels: mk3.map(function (s) { return D.stores[s]; }), datasets: [
    { label: 'Net proceeds', data: mk3.map(function (s) { return cur.st[s] - cur.stFee[s]; }), backgroundColor: '#3ddc97', stack: 'f' },
    { label: 'Referral fees', data: mk3.map(function (s) { return cur.stFeeRef[s]; }), backgroundColor: '#ff9900', stack: 'f' },
    { label: 'FBA + closing fees', data: mk3.map(function (s) { return cur.stFee[s] - cur.stFeeRef[s]; }), backgroundColor: '#e8453c', stack: 'f' }] },
    options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: function (c) { var s = mk3[c.dataIndex]; return c.dataset.label + ': ' + fm(c.raw) + ' (' + fp(c.raw / (cur.st[s] || 1)) + ' of net rev)'; } } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return fm(v); } } } } } });
  var rows = D.products.map(function (p, i) {
    if (!p.amz || (F.cat >= 0 && p.cat !== F.cat)) return null;
    var u = mk3.reduce(function (a, s) { return a + cur.puS[s][i]; }, 0); if (!u) return null;
    var inv = invFor(p, amzStore), share = F.store === -1 ? u / (cur.pu[i] || 1) : 1, r = cur.pr[i] * share, fe = cur.pfee[i];
    if (F.store === -1) { var dtcU = cur.puS[0][i]; r = cur.pr[i] * (u / (u + dtcU)); }
    return { name: p.title, artist: p.artist, cat: D.categories[p.cat], us: cur.puS[1][i], uk: cur.puS[2][i], de: cur.puS[3][i], rev: r, fee: fe, feeP: r ? fe / r : null, np: r - fe, fba: inv.onHand, cover: inv.vel ? Math.min(999, inv.onHand / inv.vel) : 999 };
  }).filter(Boolean).sort(function (a, b) { return b.rev - a.rev; }).slice(0, 20);
  table('tAmz', [{ k: 'name', l: 'Product' }, { k: 'artist', l: 'Artist' }, { k: 'cat', l: 'Category' }, { k: 'us', l: 'US units', n: 1, f: fn }, { k: 'uk', l: 'UK units', n: 1, f: fn }, { k: 'de', l: 'DE units', n: 1, f: fn },
    { k: 'rev', l: 'Net revenue', n: 1, f: function (v) { return fm(v); } }, { k: 'fee', l: 'Amazon fees', n: 1, f: function (v) { return fm(v); } }, { k: 'feeP', l: 'Fee %', n: 1, f: function (v) { return '<span style="color:' + (v > .4 ? '#ff6b6b' : 'inherit') + '">' + fp(v) + '</span>'; } },
    { k: 'np', l: 'Net proceeds', n: 1, f: function (v) { return fm(v); } }, { k: 'fba', l: 'FBA on hand', n: 1, f: fn }, { k: 'cover', l: 'FBA days of cover', n: 1, f: function (v) { return '<span style="color:' + (v < 14 ? '#ff6b6b' : 'inherit') + '">' + (v >= 999 ? '∞' : v.toFixed(0)) + '</span>'; } }], rows, 'rev', true);
}
function renderMedia() {
  var R = state.R, F = state.F, plat = $('fPlat').value, m = mediaAgg(R.s, R.e, plat, F.store), mc = R.cs >= 0 ? mediaAgg(R.cs, R.ce, plat, F.store) : null;
  var platforms = ['Google', 'Meta', 'TikTok', 'Amazon Ads'].filter(function (p) { return D.media.some(function (mm) { return mm.platform === p && mediaOk(mm, '', F.store); }); });
  $('mediaNote').textContent = 'Platform-reported, last-click (synthetic) · ' + storeLabel(F.store) + (F.store === 0 ? ' (Google, Meta, TikTok)' : F.store > 0 || F.store === 10 ? ' (Amazon Sponsored Products & Brands)' : '');
  var k = [['Spend', fm(m.spend), mc && delta(m.spend, mc.spend, true)], ['Attributed revenue', fm(m.rev), mc && delta(m.rev, mc.rev)], ['ROAS', m.roas ? m.roas.toFixed(2) + 'x' : '—', mc && delta(m.roas, mc.roas)], ['CAC (new customers)', fm(m.cac, 2), mc && delta(m.cac, mc.cac, true)], ['CTR', fp(m.ctr, 2), mc && delta(m.ctr, mc.ctr)], ['CPC', fm(m.cpc, 2), mc && delta(m.cpc, mc.cpc, true)]];
  platforms.forEach(function (p) { var x = m.plat[p], y = mc && mc.plat[p]; if (x && (!plat || plat === p)) k.push([p + ' ROAS · CAC', (x.spend ? (x.rev / x.spend).toFixed(2) + 'x' : '—') + ' <span class="muted" style="font-size:13px">' + fm(x.newc ? x.spend / x.newc : null) + '</span>', y && y.spend && x.spend ? delta(x.rev / x.spend, y.rev / y.spend) : '']); });
  $('mediaKpis').innerHTML = kpiHtml(k);
  var B = buckets(R.s, R.e), labels = B.b.map(function (x) { return D.iso(x[0]).slice(5); });
  var ds = platforms.filter(function (p) { return !plat || plat === p; }).map(function (p) { return { type: 'bar', label: p + ' spend', stack: 's', backgroundColor: PLAT[p], data: B.b.map(function (x) { var t = 0; D.media.forEach(function (mm) { if (mm.platform === p && mediaOk(mm, '', F.store)) t += sum(mm.spend, x[0], x[1]); }); return t; }) }; });
  ds.push({ type: 'line', label: 'Attributed revenue', yAxisID: 'y1', borderColor: '#f5c542', pointRadius: 0, tension: .3, data: B.b.map(function (x) { var t = 0; D.media.forEach(function (mm) { if (mediaOk(mm, plat, F.store)) t += sum(mm.rev, x[0], x[1]); }); return t; }) });
  mk('cMediaTrend', { data: { labels: labels, datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return fm(v); } } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return fm(v); } } } } } });
  var act = m.rows.filter(function (x) { return x.spend > 0; }).sort(function (a, b) { return b.roas - a.roas; });
  mk('cRoas', { type: 'bar', data: { labels: act.map(function (x) { return (x.m.platform === 'Amazon Ads' ? 'Amazon' : x.m.platform) + ' · ' + x.m.name; }), datasets: [{ label: 'ROAS', data: act.map(function (x) { return x.roas; }), backgroundColor: act.map(function (x) { return x.roas < 1.5 ? '#ff6b6b' : x.roas < 2.5 ? '#f5c542' : '#3ddc97'; }), borderRadius: 3 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { font: { size: 9 } } }, x: { ticks: { callback: function (v) { return v + 'x'; } } } } }, plugins: [{ id: 'tgt', afterDraw: function (ch) { var x = ch.scales.x.getPixelForValue(2.5), a = ch.chartArea, g = ch.ctx; g.save(); g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(x, a.top); g.lineTo(x, a.bottom); g.stroke(); g.restore(); } }] });
  var prevMap = {}; if (mc) mc.rows.forEach(function (x) { prevMap[x.m.id] = x; });
  var rows = m.rows.filter(function (x) { return x.spend > 0; }).map(function (x) { var p = prevMap[x.m.id]; return { plat: x.m.platform, name: x.m.name, type: x.m.type, spend: x.spend, impr: x.impr, clicks: x.clicks, ctr: x.ctr, cpc: x.cpc, conv: x.conv, cvr: x.cvr, rev: x.rev, roas: x.roas, acos: x.acos, cac: x.cac, droas: p && p.roas ? x.roas / p.roas - 1 : null }; });
  table('tMedia', [{ k: 'plat', l: 'Platform', f: function (v) { return '<span class="pill" style="background:' + PLAT[v] + '22;color:' + PLAT[v] + '">' + v + '</span>'; } }, { k: 'name', l: 'Campaign' }, { k: 'type', l: 'Type', f: function (v) { return '<span class="muted">' + v + '</span>'; } },
    { k: 'spend', l: 'Spend', n: 1, f: function (v) { return fm(v); } }, { k: 'impr', l: 'Impr.', n: 1, f: fn }, { k: 'clicks', l: 'Clicks', n: 1, f: fn }, { k: 'ctr', l: 'CTR', n: 1, f: function (v) { return fp(v, 2); } }, { k: 'cpc', l: 'CPC', n: 1, f: function (v) { return fm(v, 2); } },
    { k: 'conv', l: 'Conv.', n: 1, f: fn }, { k: 'cvr', l: 'CVR', n: 1, f: function (v) { return fp(v, 2); } }, { k: 'rev', l: 'Revenue', n: 1, f: function (v) { return fm(v); } },
    { k: 'roas', l: 'ROAS', n: 1, f: function (v) { return '<b style="color:' + (v < 1.5 ? '#ff6b6b' : v < 2.5 ? '#f5c542' : '#3ddc97') + '">' + v.toFixed(2) + 'x</b>'; } }, { k: 'acos', l: 'ACoS', n: 1, f: function (v) { return fp(v); } }, { k: 'cac', l: 'CAC', n: 1, f: function (v) { return fm(v, 2); } },
    { k: 'droas', l: 'Δ ROAS', n: 1, f: function (v) { return v == null ? '<span class="d neu">new</span>' : '<span class="d ' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%</span>'; } }], rows, 'spend', true);
}
var crmMode = '';
function renderCrm() {
  var c = state.c, cc = state.cc, cur = state.cur, R = state.R, F = state.F, dtcNet = state.dtcAll;
  $('crmNote').innerHTML = incDTC(F.store) ? 'Klaviyo-style campaigns & flows (synthetic) · Shopify DTC customers only' : '<span style="color:#ff9900">Storefront filter is Amazon — Klaviyo CRM only covers Shopify DTC, so this section shows DTC CRM for context.</span>';
  var k = [['CRM attributed revenue', fm(c.rev), cc && delta(c.rev, cc.rev)], ['Share of DTC revenue', dtcNet ? fp(c.rev / dtcNet) : '—', ''], ['Flows share of CRM', fp(c.flowRev / (c.rev || 1)), cc && ddelta(c.flowRev / c.rev, cc.flowRev / cc.rev)],
    ['Email open rate', fp(c.openRate), cc && ddelta(c.openRate, cc.openRate)], ['Email click rate', fp(c.clickRate, 2), cc && ddelta(c.clickRate, cc.clickRate)], ['SMS click rate', fp(c.smsCtr, 1), cc && ddelta(c.smsCtr, cc.smsCtr)],
    ['Email list', fn(c.eList), '<span class="d ' + (c.eGrowth >= 0 ? 'up' : 'dn') + '">' + (c.eGrowth >= 0 ? '+' : '') + fn(c.eGrowth) + ' net</span>'], ['SMS list', fn(c.sList), '<span class="d ' + (c.sGrowth >= 0 ? 'up' : 'dn') + '">' + (c.sGrowth >= 0 ? '+' : '') + fn(c.sGrowth) + ' net</span>'], ['Email unsub rate', fp(c.unsubRate, 2), cc && delta(c.unsubRate, cc.unsubRate, true)]];
  $('crmKpis').innerHTML = kpiHtml(k);
  var fl = c.flows.slice().sort(function (a, b) { return b.rev - a.rev; });
  mk('cFlows', { type: 'bar', data: { labels: fl.map(function (f) { return f.name; }), datasets: [{ label: 'Revenue', data: fl.map(function (f) { return f.rev; }), backgroundColor: '#a78bfa', borderRadius: 3, xAxisID: 'x' }, { label: 'Revenue per recipient', data: fl.map(function (f) { return f.rpr; }), backgroundColor: '#f5c542', borderRadius: 3, xAxisID: 'x1' }] }, options: { indexAxis: 'y', maintainAspectRatio: false, scales: { y: { ticks: { font: { size: 10 } } }, x: { ticks: { callback: function (v) { return fm(v); } } }, x1: { position: 'top', grid: { display: false }, ticks: { callback: function (v) { return '$' + v.toFixed(2); } } } } } });
  var s0 = Math.min(R.s, T - 179), lab = [], e1 = [], s1 = []; for (var d = s0; d <= R.e; d += (R.e - s0 > 200 ? 7 : 1)) { lab.push(D.iso(d).slice(5)); e1.push(D.crm.emailList[d].size); s1.push(D.crm.smsList[d].size); }
  mk('cList', { type: 'line', data: { labels: lab, datasets: [{ label: 'Email subscribers', data: e1, borderColor: '#a78bfa', pointRadius: 0, tension: .3 }, { label: 'SMS subscribers', data: s1, borderColor: '#4dd0e1', pointRadius: 0, tension: .3, yAxisID: 'y1' }] }, options: { maintainAspectRatio: false, scales: { y: { ticks: { callback: fn } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: fn } } } } });
  var rows = c.camps.filter(function (x) { return !crmMode || x.channel === crmMode; }).map(function (x) { return { date: x.date, ch: x.channel, name: x.name, rec: x.recipients, or: x.opens == null ? null : x.opens / x.recipients, cr: x.clicks / x.recipients, conv: x.conv, rev: x.rev, rpr: x.rev / x.recipients, ur: x.unsubs / x.recipients }; });
  table('tCrm', [{ k: 'date', l: 'Date' }, { k: 'ch', l: 'Channel', f: function (v) { return '<span class="pill ' + (v === 'sms' ? 'p-ok' : 'p-warn') + '">' + v.toUpperCase() + '</span>'; } }, { k: 'name', l: 'Campaign' }, { k: 'rec', l: 'Recipients', n: 1, f: fn },
    { k: 'or', l: 'Open rate', n: 1, f: function (v) { return v == null ? '—' : fp(v); } }, { k: 'cr', l: 'Click rate', n: 1, f: function (v) { return fp(v, 2); } }, { k: 'conv', l: 'Orders', n: 1, f: fn }, { k: 'rev', l: 'Revenue', n: 1, f: function (v) { return fm(v); } }, { k: 'rpr', l: 'Rev / recip.', n: 1, f: function (v) { return '$' + v.toFixed(3); } },
    { k: 'ur', l: 'Unsub rate', n: 1, f: function (v) { return '<span style="color:' + (v > .005 ? '#ff6b6b' : 'inherit') + '">' + fp(v, 2) + '</span>'; } }], rows, 'date', true);
}

// ---------- forecast (per storefront, cached) ----------
var FCC = {};
function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
function getForecast(store) {
  if (FCC[store]) return FCC[store];
  var full = agg(0, T, { cat: -1, chan: -1, reg: -1, store: store }), A = full.dRev, H = 90, LAG = 364, W = 56;
  function growth(o) { return sum(A, o - W + 1, o) / sum(A, o - W + 1 - LAG, o - LAG); }
  var o = T - H, g0 = growth(o), res = [], ape = [], sa = 0, sf = 0;
  for (var d = o + 1; d <= T; d++) { var f = A[d - LAG] * g0; res.push(Math.log(A[d] / f)); ape.push(Math.abs(A[d] - f) / A[d]); sa += A[d]; sf += f; }
  var mu = avg(res), sd = Math.sqrt(res.reduce(function (a, b) { return a + (b - mu) * (b - mu); }, 0) / (res.length - 1));
  var mape = avg(ape), g = growth(T);
  var fc = []; for (var h = 1; h <= H; h++) { var base = A[T + h - LAG] * g; fc.push({ d: T + h, f: base, lo80: base * Math.exp(-1.2816 * sd), hi80: base * Math.exp(1.2816 * sd), lo95: base * Math.exp(-1.96 * sd), hi95: base * Math.exp(1.96 * sd) }); }
  var tot = fc.reduce(function (a, x) { return a + x.f; }, 0), ly = sum(A, T + 1 - LAG, T + H - LAG), last90 = sum(A, T - H + 1, T);
  var totErr = Math.abs(sa / sf - 1), totSd = Math.max(sd / Math.sqrt(H) * 3, totErr);
  // product unit forecast: seasonal index by category (holiday titles get their own index); limited drops decay
  var C = D.categories.length, grp = []; for (var c = 0; c <= C; c++) grp.push(new Float64Array(N));
  for (var oo = 0; oo < D.orders.day.length; oo++) { if (!stOk(D.orders.store[oo], store)) continue; var dd = D.orders.day[oo]; for (var l = D.orders.line[oo]; l < D.orders.line[oo + 1]; l++) { var pp = D.products[D.lines.prod[l]]; grp[pp.holiday ? C : pp.cat][dd] += D.lines.qty[l]; } }
  var idxs = grp.map(function (u) { var b = sum(u, T - 27 - LAG, T - LAG) / 28; var arr = []; for (var h = 1; h <= H; h++) arr.push(b ? u[T + h - LAG] / b : 1); return arr; });
  var gg = Math.min(g, 1.3) / Math.max(.8, g) * g;
  var prods = D.products.map(function (p) {
    var inv = invFor(p, store), idx = p.alloc ? null : idxs[p.holiday ? C : p.cat], cum = 0, stock = inv.onHand, so = null, unmet = 0, etaD = inv.eta ? D.dayOf(inv.eta) : null, arrived = false, ai = idx ? avg(idx) : 1;
    var fresh = p.launch > 0 && T - p.launch < 45;
    for (var h = 1; h <= H; h++) {
      var u = inv.vel * (idx && !fresh ? (idx[h - 1] * .7 + .3 * ai) : Math.exp(-h / 45)) * gg / Math.max(.8, g);
      if (!arrived && etaD != null && T + h >= etaD) { stock += inv.inbound; arrived = true; }
      cum += u; if (stock - u < 0) { if (so == null) so = T + h; unmet += u - Math.max(0, stock); stock = 0; } else stock -= u;
    }
    return { p: p, inv: inv, units: cum, rev: cum * p.price * (store > 0 || store === 10 ? .94 : 1), lo: cum * Math.exp(-1.2816 * sd / Math.sqrt(10)), hi: cum * Math.exp(1.2816 * sd / Math.sqrt(10)), so: so, unmet: unmet, lost: unmet * p.price };
  });
  return (FCC[store] = { A: A, fc: fc, sd: sd, mape: mape, g: g, tot: tot, ly: ly, last90: last90, totSd: totSd, totErr: totErr, prods: prods, peak: fc.reduce(function (a, x) { return x.f > a.f ? x : a; }, fc[0]) });
}
function peakLabel(d) { var s = D.iso(d); return s === '2026-11-27' ? 'Black Friday + RSD' : s === '2026-11-30' ? 'Cyber Monday' : s >= '2026-12-01' && s <= '2026-12-20' ? 'Holiday gifting' : ''; }
function renderForecast() {
  var F0 = state.FC, st = state.F.store;
  $('fcMethod').textContent = storeLabel(st) + ' · seasonal-naive (t−364 days, weekday-aligned) × trailing 8-week YoY growth (' + ((F0.g - 1) * 100).toFixed(1) + '%). Bands from 90-day backtest residuals (σ=' + F0.sd.toFixed(3) + ' log). Applies the storefront filter only.';
  var k = [['Forecast net revenue (90d)', fm(F0.tot), '<span class="muted">80%: ' + fm(F0.tot * Math.exp(-1.2816 * F0.totSd)) + ' – ' + fm(F0.tot * Math.exp(1.2816 * F0.totSd)) + '</span>'], ['vs same 90 days LY', sgn(pct(F0.tot, F0.ly)), '<span class="muted">LY ' + fm(F0.ly) + '</span>'], ['vs last 90 days', sgn(pct(F0.tot, F0.last90)), '<span class="muted">Holiday seasonality</span>'],
    ['Peak day', fm(F0.peak.f), '<span class="muted">' + D.iso(F0.peak.d) + ' ' + peakLabel(F0.peak.d) + '</span>'], ['Backtest MAPE (daily)', fp(F0.mape), '<span class="muted">90-day total error ' + fp(F0.totErr) + '</span>'], ['SKUs at stockout risk', String(F0.prods.filter(function (x) { return x.so && x.inv.vel > 0 && !(x.p.alloc && x.p.stock[0] === 0); }).length), '<span class="muted">within 90 days</span>']];
  $('fcKpis').innerHTML = kpiHtml(k);
  var s0 = T - 119, lab = [], act = [], f = [], l80 = [], h80 = [], l95 = [], h95 = [], ly = [];
  for (var d = s0; d <= T + 90; d++) { lab.push(D.iso(d).slice(5)); var x = d > T ? F0.fc[d - T - 1] : null; act.push(d <= T ? F0.A[d] : null); f.push(x ? x.f : d === T ? F0.A[T] : null); l80.push(x ? x.lo80 : null); h80.push(x ? x.hi80 : null); l95.push(x ? x.lo95 : null); h95.push(x ? x.hi95 : null); ly.push(F0.A[d - 364] != null ? F0.A[d - 364] : null); }
  mk('cFc', { type: 'line', data: { labels: lab, datasets: [
    { label: '95% band', data: h95, borderColor: 'transparent', backgroundColor: 'rgba(245,197,66,.08)', fill: '+1', pointRadius: 0 }, { label: '95% low', data: l95, borderColor: 'transparent', pointRadius: 0, fill: false },
    { label: '80% band', data: h80, borderColor: 'transparent', backgroundColor: 'rgba(245,197,66,.18)', fill: '+1', pointRadius: 0 }, { label: '80% low', data: l80, borderColor: 'transparent', pointRadius: 0, fill: false },
    { label: 'Actual', data: act, borderColor: '#5aa9ff', pointRadius: 0, tension: .2, borderWidth: 1.6 }, { label: 'Forecast', data: f, borderColor: '#f5c542', borderDash: [5, 3], pointRadius: 0, tension: .2, borderWidth: 2 },
    { label: 'Last year (t−364)', data: ly, borderColor: 'rgba(255,255,255,.22)', pointRadius: 0, tension: .2, borderWidth: 1 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { filter: function (i) { return i.text.indexOf('low') < 0; } } }, tooltip: { filter: function (i) { return i.dataset.label.indexOf('low') < 0 && i.raw != null; }, callbacks: { label: function (c) { return c.dataset.label + ': ' + fm(c.raw); } } } }, scales: { y: { ticks: { callback: function (v) { return fm(v); } } }, x: { ticks: { maxTicksLimit: 14 } } } } });
  var rows = F0.prods.filter(function (x) { return x.inv.vel > 0 && !(x.p.alloc && x.p.stock[0] === 0) && (state.F.cat < 0 || x.p.cat === state.F.cat); }).sort(function (a, b) { return b.rev - a.rev; }).slice(0, 20).map(function (x) {
    var days = x.so ? x.so - T : null, risk = !x.so ? ['Covered', 'p-ok'] : days <= 21 ? ['High', 'p-bad'] : days <= 45 ? ['Medium', 'p-warn'] : ['Low', 'p-mut'];
    return { name: x.p.title, artist: x.p.artist, cat: D.categories[x.p.cat], vel: x.inv.vel, units: x.units, range: x.lo, hi: x.hi, rev: x.rev, onHand: x.inv.onHand, inbound: x.inv.inbound, eta: x.inv.eta || '', so: x.so ? D.iso(x.so) : '', days: days == null ? 999 : days, risk: risk[0], cls: risk[1], lost: x.lost };
  });
  table('tFc', [{ k: 'name', l: 'Product' }, { k: 'artist', l: 'Artist' }, { k: 'cat', l: 'Category' }, { k: 'vel', l: 'Units/day (28d)', n: 1, f: function (v) { return v.toFixed(1); } }, { k: 'units', l: 'Fcst units 90d', n: 1, f: function (v, r) { return '<b>' + fn(v) + '</b> <span class="muted">(' + fn(r.range) + '–' + fn(r.hi) + ')</span>'; } }, { k: 'rev', l: 'Fcst revenue', n: 1, f: function (v) { return fm(v); } },
    { k: 'onHand', l: 'On hand', n: 1, f: fn }, { k: 'inbound', l: 'Inbound (ETA)', n: 1, f: function (v, r) { return v ? fn(v) + ' <span class="muted">' + r.eta.slice(5) + '</span>' : '—'; } }, { k: 'so', l: 'Projected stockout', f: function (v, r) { return v ? v + ' <span class="muted">(' + r.days + 'd)</span>' : '—'; } },
    { k: 'days', l: 'Risk', f: function (v, r) { return '<span class="pill ' + r.cls + '">' + r.risk + '</span>'; } }, { k: 'lost', l: 'Revenue at risk', n: 1, f: function (v) { return v > 0 ? '<span style="color:#ff6b6b">' + fm(v) + '</span>' : '—'; } }], rows, 'rev', true);
}

// ---------- insights, one pair of callouts per section ----------
function noteCards(label, kind) {
  var realPill = '<span class="pill" style="background:rgba(90,169,255,.15);color:var(--blue)">REAL</span>';
  var pill = kind === 'real' ? realPill : kind === 'pub' ? '<span class="pill" style="background:rgba(90,169,255,.15);color:var(--blue)">PUBLIC</span>' : kind === 'mix' ? realPill + ' <span class="pill p-warn">DEMO</span>' : '<span class="pill p-warn">DEMO</span>';
  var kick = label ? '<p class="note-kicker">' + label + '</p>' : '';
  return kick + '<article class="callout callout-insight"><h3>Insights ' + pill + '</h3><div class="callout-body"></div></article><article class="callout callout-suggest"><h3>Suggestions ' + pill + '</h3><div class="callout-body"></div></article>';
}
function mountNotes(id, label, kind) {
  var root = $(id); if (!root || root.querySelector('.callout')) return;
  root.innerHTML = noteCards(label, kind);
}
function fillNotes(id, insight, suggest) {
  var root = $(id); if (!root) return;
  var ib = root.querySelector('.callout-insight .callout-body');
  var sb = root.querySelector('.callout-suggest .callout-body');
  if (ib) ib.innerHTML = insight;
  if (sb) sb.innerHTML = suggest;
}
function renderInsights() {
  var cur = state.cur, cmp = state.cmp, m = state.m, mc = state.mc, c = state.c, R = state.R, F = state.F, FC = state.FC, cats = D.categories;
  var cmpLbl = $('fCmp').value === 'yoy' ? 'vs same period last year' : 'vs the previous ' + R.len + ' days';
  var dtc = incDTC(F.store), amz = incAmz(F.store);
  var best = -1, bv = -Infinity, worst = -1, wv = Infinity;
  if (cmp) cats.forEach(function (_, i) { var x = cur.cat[i] - cmp.cat[i]; if (x > bv) { bv = x; best = i; } if (x < wv) { wv = x; worst = i; } });
  var hl = 'Net revenue is <b>' + fm(cur.net) + '</b> on ' + storeLabel(F.store) + ' (' + D.iso(R.s).slice(5) + '–' + D.iso(R.e).slice(5) + ')';
  if (cmp) hl += ', ' + (cur.net >= cmp.net ? 'up' : 'down') + ' <b>' + fp(Math.abs(pct(cur.net, cmp.net))) + '</b> ' + cmpLbl;
  hl += '.';
  if (best >= 0) hl += ' <b>' + cats[best] + '</b> led the category move.';
  $('hlSummary').innerHTML = hl;

  mountNotes('notes-overview', '', 'demo');
  mountNotes('notes-search', 'Organic search', 'demo');
  mountNotes('notes-affiliate', 'Affiliate', 'demo');
  mountNotes('notes-direct', 'Direct', 'demo');
  mountNotes('notes-social', '', 'demo');
  mountNotes('notes-products', 'Products and artists', 'demo');
  mountNotes('notes-stock', 'Inventory', 'demo');
  mountNotes('notes-amazon', '', 'demo');
  mountNotes('notes-paid', '', 'demo');
  mountNotes('notes-crm', '', 'demo');
  mountNotes('notes-forecast', '', 'demo');
  mountNotes('notes-seo', '', 'mix');
  mountNotes('notes-ux', '', 'mix');
  mountNotes('notes-suggest', '', 'pub');

  var ovIn = cmp
    ? '<p>Net revenue (' + storeLabel(F.store) + ') is <b>' + fm(cur.net) + '</b>, ' + (cur.net >= cmp.net ? 'up' : 'down') + ' <b>' + fp(Math.abs(pct(cur.net, cmp.net))) + '</b> ' + cmpLbl + '. <b>' + cats[best] + '</b> contributed the largest gain (' + (bv >= 0 ? '+' : '') + fm(bv) + ')' + (wv < 0 ? '; <b>' + cats[worst] + '</b> was the biggest drag (' + fm(wv) + ').' : '.') + '</p>'
    : '<p>Net revenue (' + storeLabel(F.store) + ') is <b>' + fm(cur.net) + '</b> on <b>' + fn(cur.orders) + '</b> orders (AOV ' + fm(cur.aov, 2) + '). The comparison window starts before the dataset, so there is no prior period.</p>';
  var ovSg = best < 0 ? '<p>Pick a comparison that sits inside the dataset before choosing a category to push.</p>'
    : (wv < 0 ? '<p>Review <b>' + cats[worst] + '</b> first (' + fm(wv) + ' vs comparison). Check price, on-hand stock, and whether paid and email are still pushing it.</p>'
      : '<p>Put the next release push behind <b>' + cats[best] + '</b>, the largest gain (' + (bv >= 0 ? '+' : '') + fm(bv) + ').</p>');
  fillNotes('notes-overview', ovIn, ovSg);

  function chanOn(idx) { return (F.chan < 0 || F.chan === idx) && (idx < NDTC ? dtc : amz); }
  function chanBlock(idx, name) {
    if (F.chan >= 0 && F.chan !== idx) return { insight: '<p>The channel filter is <b>' + D.channels[F.chan] + '</b>, so ' + name + ' is outside this cut.</p>', suggest: '<p>Set Channel to All or ' + name + ' to read this one.</p>' };
    if (idx < NDTC && !dtc) return { insight: '<p>' + name + ' is a Shopify DTC channel. This storefront has no DTC orders.</p>', suggest: '<p>Switch the storefront to All or Shopify DTC.</p>' };
    var rev = cur.chan[idx], share = cur.net ? rev / cur.net : 0;
    var bit = cmp ? ' It is <b>' + sgn(pct(rev, cmp.chan[idx])) + '</b> ' + cmpLbl + '.' : '';
    return { rev: rev, share: share, down: !!(cmp && cmp.chan[idx] && rev < cmp.chan[idx]), insight: '<p><b>' + name + '</b> is <b>' + fm(rev) + '</b>, ' + fp(share) + ' of filtered net revenue.' + bit + '</p>' };
  }
  var search = chanBlock(0, 'Organic search');
  var searchSg = !chanOn(0) ? search.suggest : (search.down
    ? '<p>Search revenue is down. Refresh landing pages for the categories that grew, and point internal links at in-stock vinyl.</p>'
    : '<p>Search is holding or growing. Publish new-release pages on street date, and add collection copy for the formats buyers already search.</p>');
  fillNotes('notes-search', search.insight, searchSg);
  var aff = chanBlock(7, 'Affiliate');
  var affSg = !chanOn(7) ? aff.suggest : (aff.down
    ? '<p>Affiliate revenue slipped. Pause codes on slow movers and point the next partner drop at <b>' + (best >= 0 ? cats[best] : 'the leading category') + '</b>.</p>'
    : '<p>Keep creator codes on the SKUs that already sell through affiliate, and brief the next drop around <b>' + (best >= 0 ? cats[best] : 'the leading category') + '</b>.</p>');
  fillNotes('notes-affiliate', aff.insight, affSg);
  var direct = chanBlock(6, 'Direct');
  var directSg = !chanOn(6) ? direct.suggest : ((direct.share || 0) >= 0.12
    ? '<p>Direct is a large share. Hold out branded paid search before buying more brand terms, so this traffic is not purchased twice.</p>'
    : '<p>Direct is a smaller share. Make the return path obvious: recent artists, order status, and site search.</p>');
  fillNotes('notes-direct', direct.insight, directSg);

  if (!(dtc && (F.chan < 0 || F.chan === 1))) {
    fillNotes('notes-social', '<p>' + (F.chan >= 0 && F.chan !== 1 ? 'The channel filter excludes Organic Social.' : 'Organic social is a Shopify DTC session source. This storefront has no DTC orders.') + '</p>', '<p>Include Shopify DTC and the Organic Social channel to get a platform suggestion.</p>');
  } else if (!(cur.socNet > 0)) {
    fillNotes('notes-social', '<p>Organic social revenue is <b>$0</b> in this cut.</p>', '<p>Widen the dates or clear the category filter before planning a social sprint.</p>');
  } else {
    var tp = 0; for (var i = 1; i < 5; i++) if (cur.soc[i] > cur.soc[tp]) tp = i;
    var arts = Object.keys(cur.socArt).sort(function (a, b) { return cur.socArt[b] - cur.socArt[a]; });
    var dtcNet = state.dtcAll, psCac = null; if (m.plat.Meta || m.plat.TikTok) { var ps = (m.plat.Meta || { spend: 0, newc: 0 }), pt = (m.plat.TikTok || { spend: 0, newc: 0 }); psCac = (ps.spend + pt.spend) / Math.max(1, ps.newc + pt.newc); }
    var gTik = cmp && cmp.soc[1] ? pct(cur.soc[1], cmp.soc[1]) : null;
    var socIn = '<p><b>Organic social</b> (social referrer, no paid UTM or affiliate link) drove <b>' + fm(cur.socNet) + '</b> — ' + fp(cur.socNet / (dtcNet || 1)) + ' of Shopify DTC revenue' + (cmp ? ', <b>' + sgn(pct(cur.socNet, cmp.socNet)) + '</b> ' + cmpLbl : '') + '. <b>' + D.social[tp] + '</b> leads with ' + fm(cur.soc[tp]) + ' (' + fp(cur.soc[tp] / cur.socNet, 0) + ')' + (gTik != null && tp === 1 ? ', TikTok ' + sgn(gTik) : '') + '; top artist from organic posts: <b>' + (arts[0] || '—') + '</b>. ' + fp(cur.socNew / Math.max(1, cur.socOrders), 0) + ' of these orders were new customers' + (psCac ? ' — worth ≈<b>' + fm(cur.socNew * psCac) + '</b> at paid social\'s ' + fm(psCac) + ' CAC.' : '.') + '</p>';
    fillNotes('notes-social', socIn, '<p>Put the next content sprint on <b>' + D.social[tp] + '</b>' + (arts[0] ? ' around <b>' + arts[0] + '</b>' : '') + ', and keep the other platforms as supporting cuts.</p>');
  }

  var drops = D.products.filter(function (p) { return p.alloc && p.launch > R.s - 60 && p.launch <= R.e && (F.store <= 0); });
  var rr = cats.map(function (_, i) { var g = 0, r = 0; D.products.forEach(function (p, j) { if (p.cat === i) { g += cur.pu[j]; r += cur.pru[j]; } }); return [i, g > 50 ? r / g : 0]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
  var prodIn = '<p>Highest return rate: <b>' + cats[rr[0]] + '</b> at ' + fp(rr[1]) + ' of units (average ' + fp(cur.retRate) + ' of revenue).</p>';
  var prodSg = rr[0] === 6 ? '<p>Check size guides and fit notes on <b>' + cats[rr[0]] + '</b>.</p>' : '<p>Most returns look like damaged sleeves or warped vinyl in transit. Review mailer packaging' + (amz ? ' (Amazon DE returns run highest)' : '') + '.</p>';
  if (drops.length && dtc) {
    var dd = drops.map(function (p) { return [p, p.alloc - p.stock[0]]; }).sort(function (a, b) { return b[0].launch - a[0].launch; }).slice(0, 3);
    prodIn += '<p><b>Limited and signed drops:</b> ' + dd.map(function (x) { return '<b>' + x[0].artist + ' – ' + x[0].title + '</b> ' + fp(x[1] / x[0].alloc, 0) + ' sold-through of ' + fn(x[0].alloc) + (x[0].stock[0] === 0 ? ' (sold out)' : ''); }).join('; ') + '.</p>';
    prodSg += '<p>Fast sell-through on those drops: consider a second color variant or a waitlist.</p>';
  } else prodIn += '<p>No limited or signed drop launched in this window' + (dtc ? '' : ' for a Shopify storefront') + '.</p>';
  fillNotes('notes-products', prodIn, prodSg);

  var top = D.products.map(function (p, i) { return { p: p, r: cur.pr[i], inv: invFor(p, F.store), fc: FC.prods[i] }; }).sort(function (a, b) { return b.r - a.r; }).slice(0, 15);
  var risk = top.filter(function (x) { return x.inv.vel > 0 && x.inv.onHand > 0 && (x.inv.onHand / x.inv.vel < 21 || (x.fc.so && x.fc.so - T < 45)); }).slice(0, 4);
  var over = D.products.filter(function (p) { var iv = invFor(p, F.store); return iv.vel > 0 && iv.onHand / iv.vel > 180 && !p.alloc; }), oc = over.reduce(function (a, p) { return a + invFor(p, F.store).onHand * p.cost; }, 0);
  var stockIn = risk.length
    ? '<p><b>Inventory risk on best sellers (' + storeLabel(F.store) + '):</b> ' + risk.map(function (x) { return '<b>' + x.p.artist + ' – ' + x.p.title + '</b> (' + Math.round(x.inv.onHand / x.inv.vel) + ' days of cover' + (x.fc.so ? ', stockout ~' + D.iso(x.fc.so).slice(5) : '') + ')'; }).join(', ') + '.</p>'
    : '<p>None of the top sellers are inside 21 days of cover or a 45-day stockout for ' + storeLabel(F.store) + '.</p>';
  var stockSg = (risk.length ? '<p>Vinyl re-presses take 6–10 weeks. Place the PO or FBA replenishment now for BFCM.</p>' : '<p>No urgent replenishment on the current best sellers.</p>');
  stockSg += over.length ? '<p><b>' + over.length + ' slow movers</b> hold ' + fm(oc) + ' of inventory at cost with more than 180 days of cover (for example ' + over.slice(0, 3).map(function (p) { return p.artist + ' – ' + p.title; }).join(', ') + '). Bundle them or mark them down for BFCM.</p>' : '<p>No unallocated SKU is sitting on more than 180 days of cover.</p>';
  fillNotes('notes-stock', stockIn, stockSg);

  if (!(amz && cur.amzNet > 0)) {
    fillNotes('notes-amazon', '<p>' + (amz ? 'Amazon net revenue is $0 in this cut.' : 'The storefront filter is Shopify DTC, so Amazon is excluded.') + '</p>', '<p>Switch to All storefronts or an Amazon marketplace to get a fee and ads suggestion.</p>');
  } else {
    var mk3 = [1, 2, 3].filter(function (s) { return stOk(s, F.store); });
    var aRev = mk3.reduce(function (a, s) { return a + cur.st[s]; }, 0), aFee = mk3.reduce(function (a, s) { return a + cur.stFee[s]; }, 0);
    var gro = mk3.map(function (s) { return [s, cmp && cmp.st[s] ? pct(cur.st[s], cmp.st[s]) : null]; }).sort(function (a, b) { return (b[1] || -9) - (a[1] || -9); });
    var feeHi = mk3.slice().sort(function (a, b) { return cur.stFee[b] / (cur.st[b] || 1) - cur.stFee[a] / (cur.st[a] || 1); })[0];
    var amzIn = '<p><b>Amazon</b> ' + (F.store === -1 ? 'storefronts are <b>' + fp(aRev / (cur.net || 1)) + '</b> of total net revenue (' + fm(aRev) + ')' : 'net revenue is <b>' + fm(aRev) + '</b>') + (mk3.length > 1 ? ': ' + mk3.map(function (s) { return D.stores[s].replace('Amazon ', '') + ' ' + fm(cur.st[s]); }).join(' · ') : '') + '. ' + (gro[0][1] != null ? '<b>' + D.stores[gro[0][0]] + '</b> is growing fastest (' + sgn(gro[0][1]) + '). ' : '') + 'Fees take <b>' + fp(aFee / (aRev || 1)) + '</b> of Amazon revenue' + (mk3.length > 1 ? ', highest in <b>' + D.stores[feeHi] + '</b> (' + fp(cur.stFee[feeHi] / (cur.st[feeHi] || 1)) + ')' : '') + '.</p>';
    var aStore = F.store === -1 ? 10 : F.store, ads = mediaAgg(R.s, R.e, 'Amazon Ads', aStore);
    var bad = ads.rows.filter(function (x) { return x.spend > 500; }).sort(function (a, b) { return b.acos - a.acos; })[0], good = ads.rows.filter(function (x) { return x.spend > 500; }).sort(function (a, b) { return a.acos - b.acos; })[0];
    var amzSg = '<p>Low-priced CDs and 7"s lose about 40% to referral, FBA, and closing fees. Steer those to DTC bundles.</p>';
    if (bad && good && bad !== good) amzSg = '<p>Sponsored ads spent ' + fm(ads.spend) + ' at <b>' + fp(ads.acos) + ' ACoS</b> (TACoS ' + fp(ads.spend / (aRev || 1)) + '). <b>' + bad.m.name + '</b> is at ' + fp(bad.acos) + ' ACoS, above the ~35% break-even after fees. Move budget to <b>' + good.m.name + '</b> (' + fp(good.acos) + ' ACoS, ' + good.roas.toFixed(2) + 'x).</p>' + amzSg;
    fillNotes('notes-amazon', amzIn, amzSg);
  }

  var act = m.rows.filter(function (x) { return x.spend > 1000 && x.m.platform !== 'Amazon Ads'; });
  var paidIn, paidSg;
  if (m.spend) {
    var pl = Object.keys(m.plat).map(function (k) { var x = m.plat[k]; return [k, x.rev / x.spend]; }).sort(function (a, b) { return b[1] - a[1]; });
    paidIn = '<p>Paid media: ' + fm(m.spend) + ' spend → ' + fm(m.rev) + ' attributed (<b>' + m.roas.toFixed(2) + 'x</b>' + (mc && mc.roas ? ', ' + (m.roas >= mc.roas ? 'up' : 'down') + ' from ' + mc.roas.toFixed(2) + 'x' : '') + '). Platform ROAS: ' + pl.map(function (x) { return x[0] + ' ' + x[1].toFixed(2) + 'x'; }).join(' · ') + '.</p>';
  } else paidIn = '<p>Paid media has no spend for this storefront in the selected window.</p>';
  if (act.length > 1) {
    var w = act.reduce(function (a, b) { return b.roas < a.roas ? b : a; }), bnb = act.filter(function (x) { return x.m.name.indexOf('Brand Search') < 0; }).reduce(function (a, b) { return b.roas > a.roas ? b : a; });
    paidSg = '<p>Worst DTC ROAS: <b>' + w.m.platform + ' · ' + w.m.name + '</b> at <b>' + w.roas.toFixed(2) + 'x</b> on ' + fm(w.spend) + ' (CAC ' + fm(w.cac) + '). Shifting half of that budget to <b>' + bnb.m.name + '</b> (' + bnb.roas.toFixed(2) + 'x) would add about <b>' + fm(w.spend * .5 * (bnb.roas - w.roas) * .6) + '</b>, assuming 60% of the ROAS gap holds.</p>';
  } else paidSg = '<p>Keep spend with the higher-ROAS campaigns. No weak campaign clears the $1,000 bar used for a shift.</p>';
  fillNotes('notes-paid', paidIn, paidSg);

  if (!dtc) {
    fillNotes('notes-crm', '<p>This storefront filter excludes Shopify DTC. The CRM charts are still the Klaviyo-style DTC read, not Amazon orders. CRM revenue on that read is <b>' + fm(c.rev) + '</b>.</p>', '<p>Do not apply this CRM suggestion to Amazon orders. Switch the storefront to Shopify or All before acting on flows.</p>');
  } else {
    var ft = c.flows.slice().sort(function (a, b) { return b.rev - a.rev; })[0];
    var crmIn = '<p>CRM drove <b>' + fm(c.rev) + '</b> (' + fp(c.rev / (state.dtcAll || 1)) + ' of DTC revenue); flows were ' + fp(c.flowRev / (c.rev || 1)) + ' of it. Top flow: <b>' + ft.name + '</b> (' + fm(ft.rev) + ', $' + ft.rpr.toFixed(2) + ' per recipient).</p>';
    var hu = c.camps.filter(function (x) { return x.recipients && x.unsubs / x.recipients > .005; }).sort(function (a, b) { return b.unsubs / b.recipients - a.unsubs / a.recipients; })[0];
    var crmSg = hu
      ? '<p>Unsubscribe spike: <b>' + hu.name + '</b> (' + hu.date + ', ' + hu.channel.toUpperCase() + ') hit ' + fp(hu.unsubs / hu.recipients, 2) + ' unsubs. Review frequency or segmentation before the next send.</p>'
      : '<p>No campaign cleared a 0.5% unsub rate. Put the next test on <b>' + ft.name + '</b>, the top flow by revenue.</p>';
    fillNotes('notes-crm', crmIn, crmSg);
  }

  var lostTot = FC.prods.reduce(function (a, x) { return a + x.lost; }, 0);
  var peak = peakLabel(FC.peak.d);
  fillNotes('notes-forecast',
    '<p>Next 90 days (' + storeLabel(F.store) + '): <b>' + fm(FC.tot) + '</b> net revenue (' + sgn(pct(FC.tot, FC.ly)) + ' vs last year), peaking on <b>' + D.iso(FC.peak.d) + '</b>' + (peak ? ' (' + peak + ')' : '') + '. Projected stockouts put about <b>' + fm(lostTot) + '</b> of demand at risk.</p>',
    '<p>Cover the stockout risk before <b>' + D.iso(FC.peak.d) + '</b>' + (peak ? ' (' + peak + ')' : '') + '. The forecast follows the storefront only.</p>');

  renderAuditNotes();
  renderSuggestNotes();
}
function renderAuditNotes() {
  var A = window.WRAudit, homeM = auditRun('home', 'mobile'), homeD = auditRun('home', 'desktop');
  var demo = state.R ? auditDemo(state.R.s, state.R.e, state.F) : null;
  if (!A || !homeM) {
    fillNotes('notes-seo', '<p>The public audit is not in this build.</p>', '<p>Rebuild so the Lighthouse results are inlined.</p>');
    fillNotes('notes-ux', '<p>The public audit is not in this build.</p>', '<p>Rebuild so the Lighthouse results are inlined.</p>');
    return;
  }
  var seoIssues = (A.issues || []).filter(function (i) { return i.area === 'seo' || i.area === 'both'; });
  var seoIn = '<p>Homepage lab performance is <b>' + homeM.scores.performance + '</b> on mobile (LCP ' + (homeM.lab.lcpMs / 1000).toFixed(1) + 's) and <b>' + (homeD ? homeD.scores.performance : '—') + '</b> on desktop. The SEO score is <b>' + homeM.scores.seo + '</b>.</p>';
  if (seoIssues[0]) seoIn += '<p><b>' + seoIssues[0].title + '.</b> ' + seoIssues[0].detail + '</p>';
  if (demo && demo.keywords && demo.keywords.length) {
    var topKw = demo.keywords.slice().sort(function (a, b) { return b.revenue - a.revenue; })[0];
    seoIn += '<p class="muted">DEMO keyword model, not Search Console: <b>' + topKw.query + '</b> is the largest share (' + fm(topKw.revenue) + ').</p>';
  } else if (demo && demo.organicBlocked) seoIn += '<p class="muted">DEMO keywords are hidden because the channel filter excludes Organic Search.</p>';
  else if (demo && !demo.dtc) seoIn += '<p class="muted">DEMO keywords are hidden because the storefront is Amazon.</p>';
  var seoFixes = (A.fixes || []).filter(function (x) { return x.area === 'seo' || x.source === 'DEMO' && x.area !== 'ux'; });
  var realFix = (A.fixes || []).filter(function (x) { return x.area === 'seo' && x.source === 'REAL'; })[0];
  var demoFix = (A.fixes || []).filter(function (x) { return x.source === 'DEMO'; })[0];
  var seoSg = (realFix ? '<p>' + realFix.title + '</p>' : '<p>No ranked SEO fix is in the audit file.</p>') + (demoFix ? '<p class="muted">DEMO: ' + demoFix.title + '</p>' : '');
  fillNotes('notes-seo', seoIn, seoSg);
  var cartM = auditRun('cart', 'mobile'), uxIssues = (A.issues || []).filter(function (i) { return i.area === 'ux' || i.area === 'both'; });
  var uxIn = '<p><b>' + (uxIssues[0] ? uxIssues[0].title : 'Lab performance') + '.</b> Homepage LCP is ' + (homeM.lab.lcpMs / 1000).toFixed(1) + 's on mobile' + (homeD ? ' and ' + (homeD.lab.lcpMs / 1000).toFixed(1) + 's on desktop' : '') + (cartM ? '. Cart CLS is ' + cartM.lab.cls + ' on mobile' : '') + '.</p>';
  if (demo && demo.devices) {
    var mob = demo.devices.mobile, desk = demo.devices.desktop;
    uxIn += '<p class="muted">DEMO device split of filtered Shopify DTC: mobile AOV ' + fm(mob.aov, 2) + ' vs desktop ' + fm(desk.aov, 2) + (mob.cvr == null ? '.' : ', conversion ' + fp(mob.cvr, 2) + ' vs ' + fp(desk.cvr, 2) + '.') + '</p>';
  } else uxIn += '<p class="muted">DEMO device split is hidden for this storefront or channel.</p>';
  var uxFixes = (A.fixes || []).filter(function (x) { return x.area === 'ux'; });
  fillNotes('notes-ux', uxIn, uxFixes.length ? '<p>' + uxFixes.map(function (x) { return x.title; }).join('</p><p>') + '</p>' : '<p>No ranked UX fix is in the audit file.</p>');
  void seoFixes;
}
function renderSuggestNotes() {
  var C = window.WRCatalog;
  if (!C || !$('notes-suggest')) return;
  mountNotes('notes-suggest', '', 'pub');
  if (sug.view === 'roster' || !sugCurrent()) {
    var counts = {};
    C.artists.forEach(function (a) { a.suggestions.forEach(function (s) { var g = counts[s.text] || (counts[s.text] = { text: s.text, n: 0, reason: s.reason }); g.n++; }); });
    var top = Object.keys(counts).map(function (k) { return counts[k]; }).sort(function (a, b) { return b.n - a.n; })[0];
    var nSug = C.artists.reduce(function (n, a) { return n + a.suggestions.length; }, 0);
    fillNotes('notes-suggest',
      '<p>The roster has <b>' + fn(nSug) + '</b> suggestions across <b>' + C.artists.length + '</b> public stores.' + (top ? ' The most common gap is <b>' + esc(top.text) + '</b> (' + top.n + ' stores).' : '') + '</p>',
      top ? '<p>' + esc(top.reason) + '</p>' : '<p>No catalog gaps were flagged.</p>');
    return;
  }
  var a = sugCurrent();
  var gap = a.suggestions[0];
  fillNotes('notes-suggest',
    '<p><b>' + esc(a.name) + '</b> lists ' + fn(a.products) + ' products and <b>' + a.suggestions.length + '</b> gap' + (a.suggestions.length === 1 ? '' : 's') + ' versus the roster. In stock: ' + (a.inStock == null ? '—' : a.inStock.toFixed(1) + '%') + '.</p>',
    gap ? '<p><b>' + esc(gap.text) + '</b> ' + esc(gap.reason) + '</p>' : '<p>No gap was flagged. If nothing new landed in 90 days, the freshness note on the cards is the next check.</p>');
}

// ---------- product suggestions (public catalogs; not the demo dataset) ----------
var SUG_GROUPS = [
  ['missing_format', 'Missing formats', 'Formats most roster stores sell that this store does not list.'],
  ['merch', 'Merch types to add', 'Apparel and goods that are common across the roster.'],
  ['pricing', 'Pricing gaps', 'Median price versus the roster. Prices are compared in USD only.'],
  ['bundle', 'Bundles', 'Music plus merch bundles, such as an LP and a tee.'],
  ['signed_color', 'Signed or colored vinyl', 'Signed physical items and colored or variant pressings.'],
  ['trending', 'Trending items', 'Products added in the last 90 days. Titles link to the live store page.'],
  ['restock', 'Restock', 'In-stock rate against the roster median.'],
  ['stale', 'Catalog freshness', 'Nothing new in the last 90 days.']
];
var EV_LABEL = {
  artist_physical_skus: 'Physical music SKUs', peer_pct_with_signed: 'Vinyl sellers with signed',
  music: 'Music SKUs', merch: 'Merch SKUs', peer_bundle_pct: 'Roster stores with bundles',
  artist_median_usd: 'Artist median', roster_median_usd: 'Roster median',
  in_stock_pct: 'In stock', roster_median: 'Roster median in stock',
  newest_product: 'Newest product', roster_new_90d: 'Roster products added, 90d',
  peer_adoption_pct: 'Roster adoption', artist_count: 'This store', artist_total_products: 'Products in store',
  artist_vinyl_skus: 'Vinyl SKUs', peer_pct_with_colored: 'Vinyl sellers with colored'
};
var sug = { q: '', name: '', view: 'artist', group: 'all', fmt: '', chartsReady: false };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function money(v, cur) { if (v == null || v === '' || isNaN(+v)) return '—'; var n = +v, sym = cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : cur === 'AUD' ? 'A$' : '$'; return sym + (n % 1 ? n.toFixed(2) : String(Math.round(n))); }
function evFmt(k, v) {
  if (v == null || v === '') return '—';
  if (k === 'newest_product') return String(v);
  if (k.indexOf('pct') >= 0 || k === 'roster_median' || k === 'in_stock_pct') return (Math.round(+v * 10) / 10) + '%';
  if (k.indexOf('usd') >= 0) return '$' + (+v % 1 ? (+v).toFixed(2) : String(+v));
  return String(v);
}
function evHtml(ev) {
  return '<div class="evs">' + Object.keys(ev || {}).map(function (k) { return '<span class="ev"><b>' + esc(EV_LABEL[k] || k) + '</b> ' + esc(evFmt(k, ev[k])) + '</span>'; }).join('') + '</div>';
}
function sugMatch(a, q) {
  if (!q) return true;
  var hay = (a.name + ' ' + (a.operator || '') + ' ' + a.suggestions.map(function (s) { return s.text + ' ' + s.reason; }).join(' ') + ' ' + a.recent.map(function (p) { return p.title + ' ' + p.format; }).join(' ')).toLowerCase();
  return hay.indexOf(q.toLowerCase()) >= 0;
}
function sugCurrent() { var C = window.WRCatalog; if (!C) return null; for (var i = 0; i < C.artists.length; i++) if (C.artists[i].name === sug.name) return C.artists[i]; return null; }
function sugSyncArtists() {
  var C = window.WRCatalog, sel = $('sugArtist'), matches = C.artists.filter(function (a) { return sugMatch(a, sug.q); }), prev = sug.name;
  if (!matches.length) { sel.innerHTML = '<option value="">No matches</option>'; sug.name = ''; return; }
  sel.innerHTML = matches.map(function (a) { return '<option value="' + esc(a.name) + '">' + esc(a.name) + ' (' + a.suggestions.length + ')</option>'; }).join('');
  if (!matches.some(function (a) { return a.name === prev; })) sug.name = matches[0].name;
  sel.value = sug.name;
}
function sugCards(list) {
  if (!list.length) return '<p class="empty-note">Nothing in this group for the current filters.</p>';
  return '<div class="sug-grid">' + list.map(function (sg) {
    var who = sg.artist ? '<button type="button" class="prod-link sug-jump" data-artist="' + esc(sg.artist) + '">' + esc(sg.artist) + '</button> · ' : '';
    return '<article class="sug-card"><h4>' + who + esc(sg.text) + '</h4><p>' + esc(sg.reason) + '</p>' + evHtml(sg.evidence) + '</article>';
  }).join('') + '</div>';
}
function sugTrendingCards(items, total) {
  if (!items.length) return '<p class="empty-note">No products added in the last 90 days for the current filters.</p>';
  var note = total > items.length ? '<p class="muted">Showing ' + items.length + ' newest of ' + fn(total) + ' added in the last 90 days. Each title opens the store page.</p>' : '<p class="muted">Each title opens the store page.</p>';
  return note + '<div class="sug-grid">' + items.map(function (p) {
    return '<article class="sug-card"><h4><a class="prod-link" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.title) + '</a></h4><p>' + (p.artist ? '<button type="button" class="prod-link sug-jump" data-artist="' + esc(p.artist) + '">' + esc(p.artist) + '</button> · ' : '') + esc(p.format) + ' · ' + esc(money(p.price, p.currency)) + ' · ' + esc(p.date) + '</p><div class="evs"><span class="ev"><b>' + (p.available ? 'In stock' : 'Sold out') + '</b></span><span class="ev"><a href="' + esc(p.url) + '" target="_blank" rel="noopener">View on store</a></span></div></article>';
  }).join('') + '</div>';
}
function sugGroupHtml(a) {
  var html = '', any = false;
  if (!a.suggestions.length && sug.group === 'all') html += '<p class="empty-note">No catalog gaps were flagged for ' + esc(a.name) + ' against the roster benchmarks.</p>';
  SUG_GROUPS.forEach(function (g) {
    if (sug.group !== 'all' && sug.group !== g[0]) return;
    if (g[0] === 'trending') {
      if (sug.group === 'all' && !a.recent.length) return;
      any = true;
      html += '<div class="sug-group"><div class="card-h"><h3>' + g[1] + '</h3><span class="muted">' + a.recent.length + ' shown</span></div><p class="muted">' + g[2] + '</p>' + sugTrendingCards(a.recent, a.new90) + '</div>';
      return;
    }
    var list = a.suggestions.filter(function (s) { return s.group === g[0]; });
    if (sug.group === 'all' && !list.length) return;
    any = true;
    html += '<div class="sug-group"><div class="card-h"><h3>' + g[1] + '</h3><span class="muted">' + list.length + '</span></div><p class="muted">' + g[2] + '</p>' + sugCards(list) + '</div>';
  });
  if (!any && sug.group !== 'all') html += '<p class="empty-note">No suggestions in this group for ' + esc(a.name) + '.</p>';
  return html;
}
function sugRenderArtist() {
  var C = window.WRCatalog, a = sugCurrent();
  if (!a) { $('sugHead').innerHTML = '<p class="empty-note">No artist matches that search.</p>'; $('sugKpis').innerHTML = ''; $('sugGroups').innerHTML = ''; if (charts.cSugFit) { charts.cSugFit.destroy(); charts.cSugFit = null; } return; }
  var b = C.benchmarks, opCls = (a.operator || '').indexOf('WMG') >= 0 ? 'p-ok' : 'p-mut';
  var links = a.urls.map(function (u) { var host = u.replace(/^https?:\/\//, '').replace(/\/$/, ''); return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(host) + '</a>'; }).join('');
  $('sugHead').innerHTML = '<div class="card-h"><div><h3>' + esc(a.name) + '</h3><div class="artist-links">' + (links || '<span class="muted">No store URL</span>') + '</div></div><div><span class="pill ' + opCls + '">' + esc(a.operator || 'Store') + '</span> <span class="pill p-mut">' + esc(a.currency || '—') + '</span></div></div>';
  $('sugKpis').innerHTML = kpiHtml([
    ['Products', fn(a.products), '<span class="muted">' + fn(a.music) + ' music · ' + fn(a.merch) + ' merch</span>'],
    ['In stock', a.inStock == null ? '—' : a.inStock.toFixed(1) + '%', '<span class="muted">Roster median ' + b.median_in_stock_pct + '%</span>'],
    ['New, last 90 days', fn(a.new90), '<span class="muted">Newest ' + esc(a.newest || '—') + '</span>'],
    ['Suggestions', String(a.suggestions.length), '<span class="muted">' + (a.suggestions.length ? 'Gaps vs the roster' : 'No gaps flagged') + '</span>'],
    ['Signed SKUs', fn(a.signed), '<span class="muted">' + b.pct_vinyl_sellers_with_signed + '% of vinyl sellers list signed</span>'],
    ['Colored vinyl SKUs', fn(a.colored), '<span class="muted">' + b.pct_vinyl_sellers_with_colored + '% of vinyl sellers list colored</span>']
  ]);
  var labels = Object.keys(b.format_adoption_pct);
  mk('cSugFit', { type: 'bar', data: { labels: labels, datasets: [{ label: 'Roster adoption', data: labels.map(function (k) { return b.format_adoption_pct[k] || 0; }), backgroundColor: labels.map(function (k) { return (a.formats[k] || 0) > 0 ? '#3ddc97' : (b.format_adoption_pct[k] || 0) >= 50 ? '#e8453c' : '#5c5c70'; }), borderRadius: 3 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.label + ': ' + c.raw + '% of stores · this store lists ' + fn(a.formats[c.label] || 0); } } } }, scales: { x: { max: 100, ticks: { callback: function (v) { return v + '%'; } } } } } });
  $('sugFitNote').textContent = 'Green = this store lists it · red = missing and at least half the roster sells it · bar length is roster adoption';
  $('sugGroups').innerHTML = sugGroupHtml(a);
}
function sugCollect(group) {
  var C = window.WRCatalog, out = [];
  C.artists.forEach(function (a) {
    if (!sugMatch(a, sug.q)) return;
    if (group === 'trending') a.recent.forEach(function (p) { if (!sug.fmt || p.format === sug.fmt) out.push(Object.assign({ artist: a.name }, p)); });
    else a.suggestions.forEach(function (s) { if (s.group === group) out.push(Object.assign({ artist: a.name }, s)); });
  });
  return out;
}
function sugRenderRosterList() {
  var C = window.WRCatalog, b = C.benchmarks;
  if (sug.group !== 'all' && sug.group !== 'trending') {
    var g = SUG_GROUPS.filter(function (x) { return x[0] === sug.group; })[0];
    var list = sugCollect(sug.group);
    $('tSugRecent').parentElement.parentElement.classList.add('hide');
    var host = $('sugRosterCards');
    if (!host) { host = document.createElement('div'); host.id = 'sugRosterCards'; $('sugRosterPane').appendChild(host); }
    host.classList.remove('hide');
    host.innerHTML = '<div class="sug-group"><div class="card-h"><h3>' + g[1] + ' across the roster</h3><span class="muted">' + list.length + '</span></div><p class="muted">' + g[2] + '</p>' + sugCards(list) + '</div>';
    return;
  }
  var extra = $('sugRosterCards'); if (extra) extra.classList.add('hide');
  $('tSugRecent').parentElement.parentElement.classList.remove('hide');
  var rows = sugCollect('trending').map(function (p) { return { date: p.date, artist: p.artist, title: p.title, format: p.format, price: p.price, currency: p.currency, url: p.url, available: p.available ? 1 : 0, stock: p.available ? 'In stock' : 'Sold out' }; });
  $('sugTrendNote').textContent = b.trend_note + ' ' + fn(b.new_products_last_90d) + ' new products across ' + b.stores_with_new_products_last_90d + ' stores. The table lists up to ' + C.recentCap + ' newest linked products per artist' + (sug.q ? ' matching the search' : '') + '.';
  table('tSugRecent', [
    { k: 'date', l: 'Added' },
    { k: 'artist', l: 'Artist', f: function (v) { return '<button type="button" class="prod-link sug-jump" data-artist="' + esc(v) + '">' + esc(v) + '</button>'; } },
    { k: 'title', l: 'Product', f: function (v, r) { return '<a class="prod-link" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(v) + '</a>'; } },
    { k: 'format', l: 'Format' },
    { k: 'price', l: 'Price', n: 1, f: function (v, r) { return money(v, r.currency); } },
    { k: 'available', l: 'Stock', f: function (v, r) { return '<span class="pill ' + (v ? 'p-ok' : 'p-bad') + '">' + r.stock + '</span>'; } }
  ], rows, 'date', true);
}
function sugDrawRoster() {
  if (sug.view !== 'roster' || sug.chartsReady) { if (sug.chartsReady) ['cSugAdopt', 'cSugPrice', 'cSugTrend'].forEach(function (id) { if (charts[id]) charts[id].resize(); }); return; }
  var b = window.WRCatalog.benchmarks;
  var adopt = Object.keys(b.format_adoption_pct).map(function (k) { return [k, b.format_adoption_pct[k]]; }).sort(function (a, c) { return c[1] - a[1]; });
  mk('cSugAdopt', { type: 'bar', data: { labels: adopt.map(function (x) { return x[0]; }), datasets: [{ label: 'Stores', data: adopt.map(function (x) { return x[1]; }), backgroundColor: '#5aa9ff', borderRadius: 3 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.raw + '% of roster stores'; } } } }, scales: { x: { max: 100, ticks: { callback: function (v) { return v + '%'; } } } } } });
  var priceL = [['Vinyl', 'vinyl'], ['CD', 'cd'], ['T-shirt', 'tee'], ['Hoodie', 'hoodie'], ['Headwear', 'headwear']];
  mk('cSugPrice', { type: 'bar', data: { labels: priceL.map(function (x) { return x[0]; }), datasets: [{ label: 'Median USD', data: priceL.map(function (x) { return b.median_price_usd[x[1]]; }), backgroundColor: ['#f5c542', '#5aa9ff', '#e8453c', '#a78bfa', '#3ddc97'], borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return money(c.raw, 'USD'); } } } }, scales: { y: { ticks: { callback: function (v) { return '$' + v; } } } } } });
  var tr = b.trending_formats_last_90d;
  mk('cSugTrend', { type: 'bar', data: { labels: tr.map(function (x) { return x.format; }), datasets: [{ label: 'Stores adding', data: tr.map(function (x) { return x.stores_adding_in_last_90d; }), backgroundColor: '#f5c542', borderRadius: 3 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.raw + ' stores (' + tr[c.dataIndex].pct_of_active_stores + '% of stores that added anything)'; } } } }, scales: { x: { ticks: { precision: 0 } } } } });
  sug.chartsReady = true;
}
function sugRenderRoster() {
  var C = window.WRCatalog, b = C.benchmarks, nSug = C.artists.reduce(function (n, a) { return n + a.suggestions.length; }, 0);
  $('sugRosterKpis').innerHTML = kpiHtml([
    ['Stores analyzed', fn(b.stores_analyzed), '<span class="muted">Public Shopify catalogs</span>'],
    ['Suggestions', fn(nSug), '<span class="muted">' + C.artists.length + ' artists</span>'],
    ['New products, 90 days', fn(b.new_products_last_90d), '<span class="muted">' + b.stores_with_new_products_last_90d + ' stores added something</span>'],
    ['Median in stock', b.median_in_stock_pct + '%', '<span class="muted">Across the roster</span>'],
    ['Colored vinyl', b.pct_vinyl_sellers_with_colored + '%', '<span class="muted">Of vinyl-selling stores</span>'],
    ['Signed items', b.pct_vinyl_sellers_with_signed + '%', '<span class="muted">Of vinyl-selling stores</span>'],
    ['Bundles', b.pct_stores_with_bundles + '%', '<span class="muted">Of roster stores</span>']
  ]);
  $('sugPriceNote').textContent = 'USD stores only · vinyl $' + b.median_price_usd.vinyl + ' · CD $' + b.median_price_usd.cd + ' · tee $' + b.median_price_usd.tee;
  $('sugTrendNote').textContent = b.trend_note;
  sugRenderRosterList();
  void $('sugRosterPane').offsetWidth;
  sugDrawRoster();
}
function sugRender() {
  if (!window.WRCatalog) return;
  var artistMode = sug.view === 'artist';
  $('sugArtistPane').classList.toggle('hide', !artistMode);
  $('sugRosterPane').classList.toggle('hide', artistMode);
  $('sugView').querySelectorAll('button').forEach(function (btn) { btn.classList.toggle('on', btn.getAttribute('data-v') === sug.view); });
  if (artistMode) sugRenderArtist(); else sugRenderRoster();
  renderSuggestNotes();
}
function sugJump(name) {
  sug.name = name; sug.view = 'artist'; sug.q = ''; sug.group = 'all';
  $('sugSearch').value = '';
  $('sugTypes').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-g') === 'all'); });
  sugSyncArtists(); sugRender();
  var el = $('suggest'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function sugInit() {
  var C = window.WRCatalog;
  if (!C || !$('sugArtist')) return;
  $('sugBanner').textContent = C.label + '. ' + C.method + ' Sales, ads, CRM, Amazon and the forecast above stay synthetic demo data.';
  var fmts = {};
  C.artists.forEach(function (a) { a.recent.forEach(function (p) { fmts[p.format] = 1; }); });
  var fmtSel = $('sugRecentFmt');
  Object.keys(fmts).sort().forEach(function (f) { fmtSel.insertAdjacentHTML('beforeend', '<option value="' + esc(f) + '">' + esc(f) + '</option>'); });
  sug.name = C.artists.length ? C.artists[0].name : '';
  sugSyncArtists();
  $('sugSearch').addEventListener('input', function () { sug.q = this.value.trim(); sugSyncArtists(); sugRender(); });
  $('sugArtist').addEventListener('change', function () { if (!this.value) return; sug.name = this.value; sug.view = 'artist'; sugRender(); });
  $('sugView').addEventListener('click', function (e) { var v = e.target.getAttribute('data-v'); if (!v) return; sug.view = v; sugRender(); });
  $('sugTypes').addEventListener('click', function (e) { var g = e.target.getAttribute('data-g'); if (!g) return; sug.group = g; this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-g') === g); }); sugRender(); });
  fmtSel.addEventListener('change', function () { sug.fmt = this.value; if (sug.view === 'roster') sugRenderRosterList(); });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.sug-jump'); if (!b) return; sugJump(b.getAttribute('data-artist')); });
  sugRender();
}

// ---------- init ----------
function init() {
  D = WRData.generate(); N = D.meta.ndays; T = N - 1; NCH = D.nch; NST = D.stores.length; NDTC = D.dtcChannels;
  D.categories.forEach(function (c, i) { $('fCat').insertAdjacentHTML('beforeend', '<option value="' + i + '">' + c.replace(/"/g, '&quot;') + '</option>'); });
  D.channels.forEach(function (c, i) { $('fChan').insertAdjacentHTML('beforeend', '<option value="' + i + '">' + c + (i >= NDTC ? ' (Amazon)' : '') + '</option>'); });
  D.regions.forEach(function (c, i) { $('fReg').insertAdjacentHTML('beforeend', '<option value="' + i + '">' + c + '</option>'); });
  $('fFrom').value = D.iso(T - 29); $('fTo').value = D.iso(T); $('fFrom').min = $('fTo').min = D.meta.start; $('fFrom').max = $('fTo').max = D.meta.end;
  ['fStore', 'fRange', 'fCat', 'fChan', 'fReg', 'fCmp', 'fFrom', 'fTo'].forEach(function (id) { $(id).addEventListener('change', function () { document.querySelectorAll('.custom').forEach(function (e) { e.classList.toggle('hide', $('fRange').value !== 'custom'); }); render(); }); });
  $('fPlat').addEventListener('change', renderMedia);
  $('prodSeg').addEventListener('click', function (e) { var v = e.target.getAttribute('data-v'); if (!v) return; prodMode = v; this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === e.target); }); $('tProd')._sort = null; renderProducts(); });
  $('crmSeg').addEventListener('click', function (e) { var v = e.target.getAttribute('data-v'); if (v == null) return; crmMode = v; this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === e.target); }); renderCrm(); });
  $('dataLink').addEventListener('click', function (e) { e.preventDefault(); var blob = new Blob([JSON.stringify(WRData.exportSummary(D))], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wr-store-demo-data.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); });
  render();
  sugInit();
  if (window.WRReportInstall) window.WRReportInstall({
    data: function () { return D; }, today: function () { return T; },
    agg: agg, mediaAgg: mediaAgg, crmAgg: crmAgg, getForecast: getForecast, invFor: invFor,
    fm: fm, fn: fn, fp: fp, pct: pct, sgn: sgn, storeLabel: storeLabel, peakLabel: peakLabel,
    pageFilters: function () { return { store: +$('fStore').value, chan: +$('fChan').value, cat: +$('fCat').value, reg: +$('fReg').value }; },
    auditDemo: function (s, e, f) { return auditDemo(s, e, Object.assign({ reg: -1, cat: -1, chan: -1, store: -1 }, f || {})); }
  });
  $('loading').remove(); window.__WR_READY = true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
