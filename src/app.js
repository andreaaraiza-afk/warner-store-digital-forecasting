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
function kpiHtml(k) { return k.map(function (x) { return '<div class="kpi"><div class="l">' + x[0] + '</div><div class="v">' + x[1] + '</div>' + (x[2] || '<span class="d neu">n/a</span>') + (x[3] || '') + '</div>'; }).join(''); }
function spark(arr, good) {
  if (!arr || arr.length < 2) return '';
  var mx = -Infinity, mn = Infinity, i;
  for (i = 0; i < arr.length; i++) { if (arr[i] == null || !isFinite(arr[i])) continue; if (arr[i] > mx) mx = arr[i]; if (arr[i] < mn) mn = arr[i]; }
  if (!isFinite(mx)) return '';
  var pts = arr.map(function (v, n) { var y = 20 - ((v - mn) / (mx - mn || 1)) * 18; return (n / (arr.length - 1) * 100).toFixed(1) + ',' + y.toFixed(1); }).join(' ');
  return '<svg viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="' + (good ? '#3ddc97' : '#ff6b6b') + '" stroke-width="1.6" vector-effect="non-scaling-stroke" points="' + pts + '"/></svg>';
}
function goodDelta(html) { return html && html.indexOf('class="d up"') >= 0; }

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
        var p = L.prod[l], c = D.products[p].cat; if (f.cat >= 0 && c !== f.cat) continue; if (f.artist && D.products[p].artist !== f.artist) continue;
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
  if (f.cat < 0 && f.reg < 0 && !f.artist) { r.sessions = r.dSess.reduce(function (a, b) { return a + b; }, 0); r.cvr = r.sessions ? r.orders / r.sessions : null; } else { r.sessions = null; r.cvr = null; }
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
function filt() { return { cat: +$('fCat').value, chan: +$('fChan').value, reg: +$('fReg').value, store: +$('fStore').value, artist: ($('fArtist') && $('fArtist').value) || '' }; }
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
var ui = { chan: 'social', bk: 'chan', prodOpen: false, mediaOpen: false, crmOpen: false, amzOpen: false, socOpen: false, healthCols: false, fixesOpen: false, sugAll: false, focusSku: '', focusCamp: '' };
function dailySpend(s, e, store) {
  var out = [];
  for (var d = s; d <= e; d++) { var t = 0; D.media.forEach(function (mm) { if (mediaOk(mm, '', store)) t += mm.spend[d] || 0; }); out.push(t); }
  return out;
}
function artistNamed(name, artist) { return !!(artist && name && String(name).toLowerCase().indexOf(artist.toLowerCase()) >= 0); }
function moreLink(flag, label) { return '<button type="button" class="link" data-more="' + flag + '">' + label + '</button>'; }
function bindDrawer(id, fn) {
  var el = $(id); if (!el) return;
  el._draw = fn;
  if (!el._wired) { el._wired = true; el.addEventListener('toggle', function () { if (el.open && el._draw) el._draw(); }); }
  if (el.open) fn();
}
function setStorefront(v, skipRender) {
  $('fStore').value = String(v);
  var amz = v > 0;
  $('fAmz').classList.toggle('hide', !amz);
  if (amz) $('fAmz').value = String(v);
  $('storeSeg').querySelectorAll('button').forEach(function (b) {
    var dv = b.getAttribute('data-v');
    b.classList.toggle('on', dv === 'amazon' ? amz : dv === String(v));
  });
  if (!skipRender) render();
}
function moreCount() {
  var n = 0;
  if ($('fCat').value !== '-1') n++;
  if ($('fChan').value !== '-1') n++;
  if ($('fReg').value !== '-1') n++;
  if ($('fCmp').value !== 'prev') n++;
  return n;
}
function render() {
  if (!state.holdFocus) { state.focusSku = ''; ui.focusCamp = ''; }
  syncChannelOptions();
  var R = getRange(), F = filt(); state.R = R; state.F = F;
  var cur = agg(R.s, R.e, F), cmp = R.cs >= 0 ? agg(R.cs, R.ce, F) : null;
  var m = mediaAgg(R.s, R.e, '', F.store), mc = R.cs >= 0 ? mediaAgg(R.cs, R.ce, '', F.store) : null;
  var c = crmAgg(R.s, R.e), cc = R.cs >= 0 ? crmAgg(R.cs, R.ce) : null;
  state.cur = cur; state.cmp = cmp; state.dtcAll = (F.chan < 0 ? cur : agg(R.s, R.e, Object.assign({}, F, { chan: -1 }))).st[0]; state.m = m; state.mc = mc; state.c = c; state.cc = cc;
  state.FC = getForecast(F.store);
  state.spend = dailySpend(R.s, R.e, F.store);
  state.spendC = R.cs >= 0 ? dailySpend(R.cs, R.ce, F.store) : null;
  var who = F.artist || 'All artists';
  $('rangeInfo').innerHTML = '<b>' + storeLabel(F.store) + '</b> · ' + esc(who) + ' · ' + D.iso(R.s) + ' → ' + D.iso(R.e) + ' (' + R.len + 'd) vs ' + (R.cs >= 0 ? D.iso(R.cs) + ' → ' + D.iso(R.ce) : 'n/a (before data start)');
  var nMore = moreCount();
  $('moreBtn').textContent = nMore ? 'More filters · ' + nMore : 'More filters';
  var merHtml, merSpark = '';
  if (F.artist) merHtml = '<span class="d neu">Spend is not split by artist</span>';
  else if (m.spend) {
    var mer = cur.net / m.spend, merP = cmp && mc && mc.spend ? cmp.net / mc.spend : null;
    merHtml = (cmp && mc && mc.spend ? delta(mer, merP) : '<span class="d neu">n/a</span>');
    merSpark = spark(state.spend.map(function (sp, i) { return sp ? cur.dRev[i] / sp : null; }), !(merP != null && mer < merP));
  } else merHtml = '<span class="d neu">n/a</span>';
  var cvrHtml = cur.cvr == null ? '<span class="d neu">n/a with category, region, or artist</span>' : (cmp && cmp.cvr != null ? delta(cur.cvr, cmp.cvr) : '<span class="d neu">n/a</span>');
  var cvrSeries = cur.cvr == null ? null : cur.dOrd.map(function (o, i) { return cur.dSess[i] ? o / cur.dSess[i] : null; });
  var aovSeries = cur.dOrd.map(function (o, i) { return o ? cur.dRev[i] / o : null; });
  var newSeries = cur.dOrd.map(function (o, i) { return o ? cur.dNew[i] / o : null; });
  var dNet = cmp && delta(cur.net, cmp.net), dOrd = cmp && delta(cur.orders, cmp.orders), dAov = cmp && delta(cur.aov, cmp.aov), dNew = cmp && ddelta(cur.newShare, cmp.newShare);
  var k = [
    ['Net revenue', fm(cur.net), dNet || '<span class="d neu">n/a</span>', spark(cur.dRev, goodDelta(dNet))],
    ['Orders', fn(cur.orders), dOrd || '<span class="d neu">n/a</span>', spark(cur.dOrd, goodDelta(dOrd))],
    ['AOV', fm(cur.aov, 2), dAov || '<span class="d neu">n/a</span>', spark(aovSeries, goodDelta(dAov))],
    [F.store > 0 || F.store === 10 ? 'Unit session %' : 'Conversion rate', cur.cvr == null ? '—' : fp(cur.cvr, 2), cvrHtml, spark(cvrSeries, goodDelta(cvrHtml))],
    [incDTC(F.store) ? 'New customer share' : 'New-to-brand share', fp(cur.newShare), dNew || '<span class="d neu">n/a</span>', spark(newSeries, goodDelta(dNew))],
    ['Paid media MER', F.artist || !m.spend ? '—' : (cur.net / m.spend).toFixed(2) + 'x', merHtml, merSpark]
  ];
  $('kpis').innerHTML = kpiHtml(k);
  var moved = [];
  moved.push('Units ' + fn(cur.units) + (cmp ? ' ' + sgn(pct(cur.units, cmp.units)) : ''));
  moved.push('Return rate ' + fp(cur.retRate));
  $('ovMoved').textContent = 'Units and return rate sit with products. Organic social, CRM, and Amazon fees sit on their channel tab.';
  state.movedLine = moved.join(' · ');
  renderOverview(cur, cmp, R); renderChannels(); renderProducts(); renderForecast(); renderInsights(); renderSeoUx();
  state.holdFocus = false;
  if (state.focusSku) { var hit = document.querySelector('#tProd tr.hit'); if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'nearest' }); }
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
function scoreSpan(n) {
  if (n == null || n === '') return '—';
  var c = n < 50 ? 's-bad' : n < 90 ? 's-mid' : 's-ok';
  return '<span class="score ' + c + '">' + n + '</span>';
}
function renderSeoUx() {
  var A = window.WRAudit;
  if (!$('health') || !A) return;
  $('seoBanner').textContent = (A.source || '') + (A.uxNote ? ' ' + A.uxNote : '');
  $('seoNote').textContent = 'Audited ' + (A.auditedAt || '').replace('T', ' ').slice(0, 16) + ' UTC · Lighthouse ' + (A.lighthouseVersion || '') + ' · ' + (A.fieldNote || '');
  var pages = ['home', 'collection', 'product', 'search', 'cart'];
  var rows = pages.map(function (id) {
    var m = auditRun(id, 'mobile'), d = auditRun(id, 'desktop');
    if (!m) return null;
    return { page: id, perf: m.scores.performance, perfD: d && d.scores.performance, seo: m.scores.seo, seoD: d && d.scores.seo, a11y: m.scores.accessibility, a11yD: d && d.scores.accessibility, bp: m.scores.bestPractices, bpD: d && d.scores.bestPractices, lcp: m.lab.lcpMs / 1000, lcpD: d && d.lab.lcpMs / 1000, cls: m.lab.cls, clsD: d && d.lab.cls, tbt: m.lab.tbtMs, tbtD: d && d.lab.tbtMs };
  }).filter(Boolean);
  var cols = [
    { k: 'page', l: 'Page' },
    { k: 'perf', l: 'Perf M / D', f: function (v, r) { return scoreSpan(r.perf) + ' / ' + scoreSpan(r.perfD); } },
    { k: 'seo', l: 'SEO M / D', f: function (v, r) { return scoreSpan(r.seo) + ' / ' + scoreSpan(r.seoD); } },
    { k: 'a11y', l: 'A11y', cls: 'hide-m', f: function (v, r) { return scoreSpan(r.a11y) + ' / ' + scoreSpan(r.a11yD); } },
    { k: 'lcp', l: 'Mobile LCP', n: 1, f: function (v) { return '<span class="score ' + (v >= 4 ? 's-bad' : v >= 2.5 ? 's-mid' : 's-ok') + '">' + v.toFixed(1) + 's</span>'; } },
    { k: 'cls', l: 'CLS', n: 1, f: function (v) { return '<span class="score ' + (v >= 0.1 ? 's-bad' : 's-ok') + '">' + v + '</span>'; } }
  ];
  if (ui.healthCols) cols.push(
    { k: 'bp', l: 'Best practices M / D', f: function (v, r) { return scoreSpan(r.bp) + ' / ' + scoreSpan(r.bpD); } },
    { k: 'lcpD', l: 'Desktop LCP', n: 1, f: function (v) { return v == null ? '—' : v.toFixed(1) + 's'; } },
    { k: 'clsD', l: 'Desktop CLS', n: 1, f: function (v) { return v == null ? '—' : String(v); } },
    { k: 'tbt', l: 'TBT M / D', f: function (v, r) { return Math.round(r.tbt) + ' / ' + (r.tbtD == null ? '—' : Math.round(r.tbtD)) + ' ms'; } }
  );
  table('tScore', cols, rows, 'page', false);
  var homeM = auditRun('home', 'mobile'), homeD = auditRun('home', 'desktop');
  var bp = homeM && homeD ? 'Homepage best practices ' + homeM.scores.bestPractices + ' / ' + homeD.scores.bestPractices + '. TBT and desktop vitals are in all columns.' : '';
  $('healthMore').innerHTML = '<span>' + bp + '</span>' + moreLink('healthCols', ui.healthCols ? 'Fewer columns' : 'All columns');
  var fixes = (A.fixes || []).slice().sort(function (a, b) { return a.rank - b.rank; });
  var shownF = ui.fixesOpen ? fixes : fixes.slice(0, 5);
  function sevOf(impact) { return impact === 'High' ? 'h' : impact === 'Low' ? 'l' : 'm'; }
  function tagOf(area) { return area === 'ux' ? 'UX' : area === 'seo' ? 'SEO' : String(area || '').toUpperCase(); }
  var fixHtml = shownF.map(function (fx) {
    var badge = fx.source === 'DEMO' ? '<span class="badge-demo">DEMO</span>' : '<span class="badge-real">REAL</span>';
    return '<div class="issue"><span class="sev ' + sevOf(fx.impact) + '">' + esc(String(fx.impact || '').toUpperCase()) + '</span><div><div class="t">' + esc(fx.title) + ' <span class="tag">' + esc(tagOf(fx.area)) + '</span> ' + badge + '</div><div class="m">Impact ' + esc(fx.impact) + ' · effort ' + esc(fx.effort) + ' · ' + esc(fx.source) + '</div></div></div>';
  }).join('') || '<p class="muted">No ranked fixes in the audit file.</p>';
  var issues = A.issues || [];
  if (ui.fixesOpen && issues.length) {
    fixHtml += '<p class="muted" style="margin-top:8px">Audit findings</p>' + issues.map(function (it) {
      return '<div class="issue"><span class="sev ' + (it.severity === 'high' ? 'h' : it.severity === 'low' ? 'l' : 'm') + '">' + esc(it.severity.toUpperCase()) + '</span><div><div class="t">' + esc(it.title) + ' <span class="tag">' + esc(tagOf(it.area)) + '</span></div><div class="m">' + esc(it.detail) + '</div></div></div>';
    }).join('');
  }
  $('fixes').innerHTML = fixHtml;
  $('fixesMore').innerHTML = '<span>' + (ui.fixesOpen ? 'All ' + fixes.length + ' fixes plus the audit findings' : 'Top ' + shownF.length + ' of ' + fixes.length + ' · findings open with Show all') + '</span>' + moreLink('fixesOpen', ui.fixesOpen ? 'Show less' : 'Show all ' + fixes.length);
  var shots = A.screenshots || {};
  $('uxShots').innerHTML = [['homeDesktop', 'Homepage · desktop'], ['homeMobile', 'Homepage · mobile'], ['productDesktop', 'Product · desktop'], ['productMobile', 'Product · mobile']].map(function (pair) {
    var src = shots[pair[0]]; if (!src) return '';
    return '<figure class="card shot-card"><img alt="' + esc(pair[1]) + ' of shop.warnerrecords.com" src="' + src + '"><figcaption>' + esc(pair[1]) + ' · real public screenshot</figcaption></figure>';
  }).join('');
  var demo = auditDemo(state.R.s, state.R.e, state.F);
  var kw = demo.keywords || [], pageRows = demo.pages || [];
  var kwNote = 'DEMO · not Search Console. ';
  if (state.F.artist) {
    var al = state.F.artist.toLowerCase();
    kw = kw.filter(function (k) { return String(k.query).toLowerCase().indexOf(al) >= 0; });
    pageRows = pageRows.filter(function (pg) { return (pg.title + ' ' + pg.path).toLowerCase().indexOf(al) >= 0; });
    kwNote += kw.length ? 'Rows whose query names ' + state.F.artist + '. Revenue is still the Organic Search allocation, not an artist slice. ' : 'No demo keyword is named for ' + state.F.artist + '. ';
  }
  if (!demo.dtc) kwNote += 'Storefront filter is Amazon, so Shopify organic keywords are hidden.';
  else if (demo.organicBlocked) kwNote += 'Channel filter excludes Organic Search, so keyword revenue is hidden.';
  else if (demo.organic) kwNote += 'Revenue and clicks allocate this period’s Shopify Organic Search (' + fm(demo.organic.net) + ', ' + fn(demo.organic.orders) + ' orders).';
  $('seoKwNote').textContent = kwNote;
  table('tSeoKw', [{ k: 'query', l: 'Keyword' }, { k: 'position', l: 'Position', n: 1, f: function (v) { return v.toFixed(1); } }, { k: 'impressions', l: 'Impressions', n: 1, f: function (v) { return v == null ? '—' : fn(v); } }, { k: 'clicks', l: 'Clicks', n: 1, f: function (v) { return v == null ? '—' : fn(v); } }, { k: 'ctr', l: 'CTR', n: 1, f: function (v) { return fp(v, 1); } }, { k: 'revenue', l: 'Revenue', n: 1, f: fm }], kw, 'revenue', true);
  table('tSeoPages', [{ k: 'path', l: 'Page' }, { k: 'title', l: 'Title', cls: 'hide-m' }, { k: 'sessions', l: 'Sessions', n: 1, f: function (v) { return v == null ? '—' : fn(v); } }, { k: 'revenue', l: 'Organic revenue', n: 1, f: fm }], pageRows, 'revenue', true);
  var funnels = [], sum = $('funnelSum');
  if (state.F.artist) {
    sum.innerHTML = 'Demo device funnel <span class="badge-demo">DEMO</span>';
    $('uxFunnelNote').textContent = 'The demo device model is not split by artist. Clear the artist filter to see the Shopify DTC mobile and desktop allocation.';
  } else if (!demo.devices) {
    sum.innerHTML = 'Demo device funnel <span class="badge-demo">DEMO</span>';
    $('uxFunnelNote').textContent = 'DEMO device split is Shopify DTC. This storefront or channel filter has no Shopify DTC orders.';
  } else {
    var mob = demo.devices.mobile, desk = demo.devices.desktop;
    var line = 'Demo device funnel · mobile AOV ' + fm(mob.aov, 2) + ' vs desktop ' + fm(desk.aov, 2);
    if (mob.cvr != null) line += ' · conversion ' + fp(mob.cvr, 2) + ' vs ' + fp(desk.cvr, 2);
    sum.innerHTML = esc(line) + ' <span class="badge-demo">DEMO</span>';
    $('uxFunnelNote').textContent = mob.cvr == null ? 'DEMO allocation of filtered Shopify DTC orders. Conversion is hidden because a category or region filter is on.' : 'DEMO allocation of filtered Shopify DTC orders and sessions. Mobile is ' + Math.round((A.demoModel.mobileSessionShare) * 100) + '% of sessions, with a lower order share and a lower AOV.';
    ['mobile', 'desktop'].forEach(function (name) {
      var row = demo.devices[name];
      funnels.push({ device: name, sessions: row.sessions, orders: row.orders, cvr: row.cvr, aov: row.aov, revenue: row.revenue });
    });
  }
  table('tUxFunnel', [{ k: 'device', l: 'Device' }, { k: 'sessions', l: 'Sessions', n: 1, f: function (v) { return v == null ? '—' : fn(v); } }, { k: 'orders', l: 'Orders', n: 1, f: fn }, { k: 'cvr', l: 'Conversion', n: 1, f: function (v) { return v == null ? '—' : fp(v, 2); } }, { k: 'aov', l: 'AOV', n: 1, f: function (v) { return fm(v, 2); } }, { k: 'revenue', l: 'Net revenue', n: 1, cls: 'hide-m', f: fm }], funnels, 'revenue', true);
}
window.WRAuditDemo = auditDemo;
function breakRows(labels, curArr, cmpArr) {
  var rows = [];
  for (var i = 0; i < labels.length; i++) {
    var v = curArr[i] || 0, p = cmpArr ? (cmpArr[i] || 0) : null;
    if (v < 1 && !(p > 1)) continue;
    rows.push({ name: labels[i], v: v, g: p == null ? null : (p ? v / p - 1 : (v ? 1 : 0)) });
  }
  rows.sort(function (a, b) { return b.v - a.v; });
  return rows;
}
function drawBreak(cur, cmp) {
  var F = state.F, rows;
  if (ui.bk === 'cat') rows = breakRows(D.categories, cur.cat, cmp && cmp.cat);
  else if (ui.bk === 'store') rows = breakRows(D.stores, cur.st, cmp && cmp.st);
  else if (ui.bk === 'reg') rows = breakRows(D.regions, cur.reg, cmp && cmp.reg);
  else {
    var idx = D.channels.map(function (_, i) { return i; }).filter(function (i) { return i < NDTC ? incDTC(F.store) : incAmz(F.store); });
    rows = breakRows(idx.map(function (i) { return D.channels[i]; }), idx.map(function (i) { return cur.chan[i]; }), cmp && idx.map(function (i) { return cmp.chan[i]; }));
  }
  var colors = rows.map(function (r) { return r.g == null ? '#f5c542' : r.g >= 0 ? '#3ddc97' : '#ff6b6b'; });
  mk('cBreak', { type: 'bar', data: { labels: rows.map(function (r) { return r.name; }), datasets: [{ label: 'Net revenue', data: rows.map(function (r) { return r.v; }), backgroundColor: colors, borderRadius: 4 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { var r = rows[c.dataIndex]; return fm(r.v) + (r.g == null ? '' : ' · ' + sgn(r.g) + ' vs comparison'); } } } }, scales: { x: { ticks: { callback: function (v) { return fm(v); } } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } } } });
  $('bkNote').textContent = rows.length ? 'Bar length is net revenue. Green is up versus the comparison, red is down.' : 'No revenue in this cut.';
}
function renderOverview(cur, cmp, R) {
  var B = buckets(R.s, R.e), labels = B.b.map(function (x) { return D.iso(x[0]).slice(5); });
  $('trendNote').textContent = (B.w === 7 ? 'Weekly' : 'Daily') + ' · dashed = comparison period';
  var ds = [{ type: 'bar', label: 'Net revenue', data: bsum(cur.dRev, R.s, B.b), backgroundColor: 'rgba(245,197,66,.75)', borderRadius: 3, yAxisID: 'y' },
    { type: 'line', label: 'Orders', data: bsum(cur.dOrd, R.s, B.b), borderColor: '#5aa9ff', pointRadius: 0, tension: .3, yAxisID: 'y1' }];
  if (cmp) { var cb = B.b.map(function (x) { return [x[0] - R.s + cmp.s, x[1] - R.s + cmp.s]; }); ds.push({ type: 'line', label: 'Net revenue (comparison)', data: bsum(cmp.dRev, cmp.s, cb), borderColor: 'rgba(255,255,255,.45)', borderDash: [5, 4], pointRadius: 0, tension: .3, yAxisID: 'y' }); }
  mk('cTrend', { data: { labels: labels, datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { ticks: { callback: function (v) { return fm(v); } } }, y1: { position: 'right', grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.dataset.yAxisID === 'y' ? fm(c.raw) : fn(c.raw)); } } } } } });
  $('bkSeg').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === ui.bk); });
  drawBreak(cur, cmp);
  bindDrawer('ovExtra', function () {
    var nw = bsum(cur.dNew, R.s, B.b), od = bsum(cur.dOrd, R.s, B.b), se = bsum(cur.dSess, R.s, B.b);
    mk('cNew', { type: 'bar', data: { labels: labels, datasets: [{ label: 'New', data: nw, backgroundColor: '#a78bfa', stack: 's' }, { label: 'Returning', data: od.map(function (v, i) { return v - nw[i]; }), backgroundColor: '#4dd0e1', stack: 's' }] }, options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } } });
    mk('cCvr', { data: { labels: labels, datasets: [{ type: 'line', label: 'Conversion rate %', data: cur.cvr == null ? [] : od.map(function (v, i) { return se[i] ? v / se[i] * 100 : null; }), borderColor: '#3ddc97', pointRadius: 0, tension: .3, yAxisID: 'y1' }, { type: 'bar', label: 'Sessions', data: se, backgroundColor: 'rgba(90,169,255,.35)', yAxisID: 'y' }] }, options: { maintainAspectRatio: false, scales: { y1: { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return v.toFixed(1) + '%'; } } } } } });
  });
}

// ---------- tables ----------
function table(id, cols, rows, sortKey, desc) {
  var t = $(id); t._cols = cols; t._rows = rows; t._sort = t._sort || { k: sortKey, d: desc };
  if (!cols.some(function (c) { return c.k === t._sort.k; })) t._sort = { k: sortKey, d: desc };
  var s = t._sort, r = rows.slice().sort(function (a, b) { var x = a[s.k], y = b[s.k]; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * (s.d ? -1 : 1); });
  t.tHead.innerHTML = '<tr>' + cols.map(function (c) { var cls = ((c.n ? 'n ' : '') + (c.cls || '')).trim(); return '<th data-k="' + c.k + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + c.l + (s.k === c.k ? (s.d ? ' ↓' : ' ↑') : '') + '</th>'; }).join('') + '</tr>';
  t.tBodies[0].innerHTML = r.length ? r.map(function (row) { var hit = state.focusSku && row.sku === state.focusSku ? ' class="hit"' : ''; return '<tr' + hit + '>' + cols.map(function (c) { var cls = ((c.n ? 'n ' : '') + (c.cls || '')).trim(); return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + (c.f ? c.f(row[c.k], row) : row[c.k]) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + cols.length + '" class="muted">No rows for the current filters.</td></tr>';
  t.tHead.onclick = function (ev) { var k = ev.target.getAttribute('data-k'); if (!k) return; t._sort = { k: k, d: t._sort.k === k ? !t._sort.d : true }; table(id, t._cols, t._rows); };
}
function statusOf(p, cover, inv) { if (p.alloc && p.stock[0] === 0) return ['Sold out', 'p-mut']; if (inv.vel === 0 && inv.onHand === 0) return ['Not listed', 'p-mut']; if (cover < 14) return ['Stockout risk', 'p-bad']; if (cover < 30) return ['Low stock', 'p-warn']; if (cover > 180) return ['Overstock', 'p-mut']; return ['Healthy', 'p-ok']; }
var prodMode = 'best';
function productRows() {
  var cur = state.cur, cmp = state.cmp, F = state.F, FC = state.FC;
  return D.products.map(function (p, i) {
    if (F.cat >= 0 && p.cat !== F.cat) return null;
    if (F.artist && p.artist !== F.artist) return null;
    if (F.store > 0 && !p.amz) return null;
    var inv = invFor(p, F.store), cover = inv.vel > 0 ? inv.onHand / inv.vel : 999, st = statusOf(p, cover, inv);
    var amzU = cur.puS[1][i] + cur.puS[2][i] + cur.puS[3][i];
    var fc = FC.prods[i], days = fc.so ? fc.so - T : null;
    return { name: p.title, artist: p.artist, sku: p.sku, cat: D.categories[p.cat], units: cur.pu[i], rev: cur.pr[i], du: cmp && cmp.pu[i] ? cur.pu[i] / cmp.pu[i] - 1 : null, rr: cur.pu[i] ? cur.pru[i] / cur.pu[i] : 0, amzS: cur.pu[i] ? amzU / cur.pu[i] : (p.amz ? 0 : null), vel: inv.vel, onHand: inv.onHand, inbound: inv.inbound, eta: inv.eta || '', cover: Math.min(cover, 999), status: st[0], cls: st[1], launched: p.launch <= state.R.s, invCost: inv.onHand * p.cost, amz: p.amz, alloc: p.alloc, so: fc.so ? D.iso(fc.so) : '', days: days == null ? 999 : days, lost: fc.lost, fcUnits: fc.units, us: cur.puS[1][i], uk: cur.puS[2][i], de: cur.puS[3][i], fee: cur.pfee[i], amzRev: (function () { var u = amzU, dtcU = cur.puS[0][i], share = F.store === -1 ? (u + dtcU ? u / (u + dtcU) : 0) : 1; return cur.pr[i] * share; })() };
  }).filter(Boolean);
}
function duCell(v) { return v == null ? '<span class="d neu">new</span>' : '<span class="d ' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%</span>'; }
function roasBar(v) {
  if (v == null || !isFinite(v)) return '—';
  var w = Math.max(4, Math.min(88, v / 7.5 * 88));
  var tick = 2.5 / 7.5 * 88;
  return '<span class="bar" style="width:' + w + 'px;background:' + (v >= 2.5 ? '#3ddc97' : '#ff6b6b') + '"><span class="tick" style="left:' + tick + 'px"></span></span><b class="' + (v >= 2.5 ? 'up' : 'dn') + '">' + v.toFixed(2) + 'x</b>';
}
function sliceRows(rows, open) { return open ? rows : rows.slice(0, 5); }
function paintMore(id, shown, total, open, flag, extra) {
  var el = $(id); if (!el) return;
  var left = open ? 'All ' + total + (extra ? ' · ' + extra : '') : 'Top ' + Math.min(5, total) + ' of ' + total + (extra ? ' · ' + extra : '');
  el.innerHTML = '<span>' + left + '</span>' + (total > 5 || extra ? moreLink(flag, open ? 'Show less' : 'Show all ' + total + (extra ? ' · ' + extra : '')) : '');
}
function setChanTab(tab, skipPaint) {
  ui.chan = tab;
  document.querySelectorAll('.chan-pane').forEach(function (p) { p.classList.toggle('hide', p.id !== 'pane-' + tab); });
  document.querySelectorAll('#chanTabs .chtab').forEach(function (b) { var on = b.getAttribute('data-tab') === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  document.querySelectorAll('#notes-channels .note-group').forEach(function (n) { n.classList.toggle('hide', n.getAttribute('data-tab') !== tab); });
  if (!skipPaint) renderChannels();
}
function renderChannels() {
  var cur = state.cur, cmp = state.cmp, F = state.F, R = state.R, m = state.m, mc = state.mc, c = state.c, cc = state.cc;
  var dtc = incDTC(F.store), socOn = dtc && (F.chan < 0 || F.chan === 1);
  var topPlat = 0; for (var i = 1; i < 5; i++) if (cur.soc[i] > cur.soc[topPlat]) topPlat = i;
  var socD = cmp ? delta(cur.socNet, cmp.socNet) : '';
  $('tabSocialV').innerHTML = (socOn ? fm(cur.socNet) : '—') + (socD ? ' ' + socD : '');
  $('tabSocialS').textContent = socOn ? fp(cur.socNet / (state.dtcAll || 1)) + ' of DTC · ' + D.social[topPlat] + ' ' + (cur.socNet ? Math.round(cur.soc[topPlat] / cur.socNet * 100) : 0) + '%' : 'Not in this storefront or channel';
  var roasD = mc && mc.roas && m.roas ? delta(m.roas, mc.roas) : '';
  $('tabPaidV').innerHTML = (m.roas ? m.roas.toFixed(2) + 'x' : '—') + (roasD ? ' ' + roasD : '');
  $('tabPaidS').textContent = fm(m.spend) + ' spend → ' + fm(m.rev);
  var crmD = dtc && cc ? delta(c.rev, cc.rev) : '';
  $('tabCrmV').innerHTML = (dtc ? fm(c.rev) : '—') + (crmD ? ' ' + crmD : '');
  $('tabCrmS').textContent = (state.dtcAll ? fp(c.rev / state.dtcAll) : '—') + ' of DTC · flows ' + fp(c.flowRev / (c.rev || 1));
  var mk3 = [1, 2, 3].filter(function (s) { return stOk(s, F.store); });
  function tot(r, k) { return r ? mk3.reduce(function (a, s) { return a + r[k][s]; }, 0) : 0; }
  var aRev = tot(cur, 'st'), aPrev = cmp ? tot(cmp, 'st') : null, aFee = tot(cur, 'stFee');
  var amzStore = F.store === -1 ? 10 : F.store;
  var ads = incAmz(F.store) ? mediaAgg(R.s, R.e, 'Amazon Ads', amzStore) : { spend: 0, roas: null, acos: null };
  var amzD = cmp && incAmz(F.store) ? delta(aRev, aPrev) : '';
  $('tabAmzV').innerHTML = (incAmz(F.store) ? fm(aRev) : '—') + (amzD ? ' ' + amzD : '');
  $('tabAmzS').textContent = incAmz(F.store) ? 'Fees ' + fp(aFee / (aRev || 1)) + ' · TACoS ' + fp(ads.spend / (aRev || 1)) : 'Shopify DTC only';
  document.querySelectorAll('.chan-pane').forEach(function (p) { p.classList.toggle('hide', p.id !== 'pane-' + ui.chan); });
  document.querySelectorAll('#notes-channels .note-group').forEach(function (n) { n.classList.toggle('hide', n.getAttribute('data-tab') !== ui.chan); });
  if (ui.chan === 'social') renderSocialPane();
  else if (ui.chan === 'paid') renderMedia();
  else if (ui.chan === 'crm') renderCrm();
  else renderAmazon();
}
function renderSocialPane() {
  var cur = state.cur, cmp = state.cmp, F = state.F, R = state.R;
  var socOn = incDTC(F.store) && (F.chan < 0 || F.chan === 1);
  $('socNote').textContent = socOn ? 'Social referrer, no paid UTM, no affiliate link.' + (F.artist ? ' Limited to ' + F.artist + '.' : '') : 'Organic social is Shopify DTC only, and only when the channel filter includes it.';
  var k = [
    ['Organic social revenue', socOn ? fm(cur.socNet) : '—', cmp && socOn ? delta(cur.socNet, cmp.socNet) : '<span class="d neu">n/a</span>'],
    ['Share of DTC', socOn && state.dtcAll ? fp(cur.socNet / state.dtcAll) : '—', ''],
    ['Orders', socOn ? fn(cur.socOrders) : '—', cmp && socOn ? delta(cur.socOrders, cmp.socOrders) : ''],
    ['New-customer share', socOn && cur.socOrders ? fp(cur.socNew / cur.socOrders) : '—', '']
  ];
  $('socialKpis').innerHTML = kpiHtml(k);
  var chips = D.social.map(function (name, i) {
    var rev = cur.soc[i]; if (!rev) return '';
    return '<span class="chip">' + name + ' <b>' + fm(rev) + '</b> · ' + (cur.socNet ? Math.round(rev / cur.socNet * 100) : 0) + '%</span>';
  }).join('');
  $('socialChips').innerHTML = chips ? '<span class="muted">Platform revenue</span>' + chips : '';
  var arts = Object.keys(cur.socArt).map(function (a) { return { artist: a, rev: cur.socArt[a] }; }).sort(function (a, b) { return b.rev - a.rev; });
  var shown = sliceRows(arts, ui.socOpen);
  table('tSocial', [{ k: 'artist', l: 'Artist', f: function (v) { return '<button type="button" class="prod-link" data-artist-jump="' + esc(v) + '">' + esc(v) + '</button>'; } }, { k: 'rev', l: 'Organic social revenue', n: 1, f: function (v) { return fm(v); } }], shown, 'rev', true);
  paintMore('socialMore', shown.length, arts.length, ui.socOpen, 'socOpen', '');
  bindDrawer('socialChart', function () {
    var B = buckets(R.s, R.e), labels = B.b.map(function (x) { return D.iso(x[0]).slice(5); });
    mk('cSoc', { type: 'bar', data: { labels: D.social, datasets: [{ label: 'Net revenue', data: Array.from(cur.soc), backgroundColor: SOCC, borderRadius: 3 }].concat(cmp ? [{ label: 'Comparison', data: Array.from(cmp.soc), backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 3 }] : []) }, options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: function (c) { var src = c.datasetIndex ? cmp : cur; return c.dataset.label + ': ' + fm(c.raw) + ' · ' + fn(src.socOrd[c.dataIndex]) + ' orders'; } } } }, scales: { y: { ticks: { callback: function (v) { return fm(v); } } } } } });
    var dtcRev = cur.dSt[0];
    var sds = D.social.map(function (n, i) { return { type: 'bar', label: n, stack: 's', backgroundColor: SOCC[i], data: bsum(cur.dSocP[i], R.s, B.b), yAxisID: 'y' }; });
    var shr = bsum(cur.dSoc, R.s, B.b), dt = bsum(dtcRev, R.s, B.b);
    sds.push({ type: 'line', label: '% of DTC revenue', data: shr.map(function (v, i) { return dt[i] ? v / dt[i] * 100 : null; }), borderColor: '#fff', pointRadius: 0, tension: .3, yAxisID: 'y1' });
    mk('cSocTrend', { data: { labels: labels, datasets: sds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { font: { size: 10 } } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return fm(v); } } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return v.toFixed(0) + '%'; } } } } } });
  });
}
function renderProducts() {
  var rows = productRows(), F = state.F, pool, sortK = 'rev', sortD = true;
  if (prodMode === 'best') { pool = rows.slice().sort(function (a, b) { return b.rev - a.rev; }).slice(0, 25); sortK = 'rev'; }
  else if (prodMode === 'slow') { pool = rows.filter(function (r) { return r.launched && r.onHand > 0 && !r.alloc; }).sort(function (a, b) { return a.rev / Math.max(1, a.invCost) - b.rev / Math.max(1, b.invCost); }).slice(0, 15); sortK = 'cover'; sortD = true; }
  else if (prodMode === 'risk') { pool = rows.filter(function (r) { return r.cover < 30 && r.status !== 'Sold out' && r.vel > 0; }).sort(function (a, b) { return a.cover - b.cover; }); sortK = 'cover'; sortD = false; }
  else { pool = rows.filter(function (r) { return r.amz && (r.us + r.uk + r.de) > 0; }).sort(function (a, b) { return b.amzRev - a.amzRev; }).slice(0, 20); sortK = 'amzRev'; }
  var cols = [
    { k: 'name', l: 'Product · Artist', cls: 'w', f: function (v, r) { return '<b>' + esc(v) + '</b><div class="muted">' + esc(r.artist) + (ui.prodOpen ? ' · ' + esc(r.sku) : '') + '</div>'; } },
    { k: 'units', l: 'Units', n: 1, f: fn },
    { k: 'rev', l: 'Net revenue', n: 1, f: function (v) { return fm(v); } },
    { k: 'du', l: 'Δ units', n: 1, cls: 'hide-m', f: duCell },
    { k: 'vel', l: 'Units/day', n: 1, cls: 'hide-m', f: function (v) { return v.toFixed(1); } },
    { k: 'cover', l: 'Days of cover', n: 1, f: function (v) { return v >= 999 ? '∞' : v.toFixed(0); } },
    { k: 'so', l: 'Projected stockout', cls: 'hide-m', f: function (v, r) { return v ? v.slice(5) + ' (' + r.days + 'd)' : '—'; } },
    { k: 'lost', l: 'Revenue at risk', n: 1, cls: 'hide-m', f: function (v) { return v > 0 ? '<span class="dn">' + fm(v) + '</span>' : '—'; } },
    { k: 'status', l: 'Status', f: function (v, r) { return '<span class="pill ' + r.cls + '">' + v + '</span>'; } }
  ];
  if (ui.prodOpen) cols.push(
    { k: 'cat', l: 'Category', cls: 'hide-m' },
    { k: 'rr', l: 'Return rate', n: 1, f: function (v) { return fp(v); } },
    { k: 'amzS', l: 'Amazon share', n: 1, f: function (v, r) { return r.amz ? fp(v, 0) : '<span class="muted">DTC only</span>'; } },
    { k: 'onHand', l: F.store > 0 || F.store === 10 ? 'FBA on hand' : 'On hand', n: 1, f: fn },
    { k: 'inbound', l: 'Inbound', n: 1, f: function (v, r) { return v ? fn(v) + ' <span class="muted">' + (r.eta || '').slice(5) + '</span>' : '—'; } },
    { k: 'fcUnits', l: 'Fcst units 90d', n: 1, f: function (v) { return fn(v); } }
  );
  if (prodMode === 'amazon' && ui.prodOpen) cols.push(
    { k: 'us', l: 'US', n: 1, f: fn }, { k: 'uk', l: 'UK', n: 1, f: fn }, { k: 'de', l: 'DE', n: 1, f: fn },
    { k: 'fee', l: 'Amazon fees', n: 1, f: function (v) { return fm(v); } }
  );
  var shown = sliceRows(pool, ui.prodOpen);
  var t = $('tProd'); t._sort = { k: sortK, d: sortD };
  $('prodNote').textContent = state.movedLine + ' · ' + storeLabel(F.store) + (F.artist ? ' · ' + F.artist : '') + (F.store > 0 || F.store === 10 ? ' · store exclusives are not on Amazon' : '');
  if (prodMode === 'amazon' && !incAmz(F.store)) {
    t.tHead.innerHTML = ''; t.tBodies[0].innerHTML = '<tr><td class="muted">Storefront is Shopify DTC, so Amazon rows are hidden. Switch to All or Amazon.</td></tr>';
    $('prodMore').innerHTML = '';
    return;
  }
  table('tProd', cols, shown, sortK, sortD);
  paintMore('prodMore', shown.length, pool.length, ui.prodOpen, 'prodOpen', 'SKU, returns, Amazon share, on hand, inbound, forecast units');
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
  $('amzKpis').innerHTML = kpiHtml([
    ['Amazon fees', fm(fee), cmp ? delta(fee, pfee, true) : ''],
    ['Fees % of revenue', fp(fee / (rev || 1)), cmp ? ddelta(fee / (rev || 1), pfee / (prev || 1)) : ''],
    ['Net proceeds', fm(rev - fee), cmp ? delta(rev - fee, prev - pfee) : ''],
    ['TACoS', fp(ads.spend / (rev || 1)), adsP && cmp ? ddelta(ads.spend / (rev || 1), adsP.spend / (prev || 1)) : '']
  ]);
  $('amzExtra').textContent = 'Orders ' + fn(ord) + ' · units ' + fn(un) + ' · referral fees ' + fm(feeRef) + ' · FBA + closing ' + fm(fee - feeRef) + ' · Sponsored ads ' + fm(ads.spend) + ' at ' + (ads.roas ? ads.roas.toFixed(2) + 'x ROAS' : '—') + ' · ACoS ' + fp(ads.acos) + (F.artist ? ' · revenue is ' + F.artist + ' only. Ads are not split by artist.' : '');
  var rows = D.products.map(function (p, i) {
    if (!p.amz || (F.cat >= 0 && p.cat !== F.cat) || (F.artist && p.artist !== F.artist)) return null;
    var u = mk3.reduce(function (a, s) { return a + cur.puS[s][i]; }, 0); if (!u) return null;
    var inv = invFor(p, amzStore), dtcU = cur.puS[0][i], share = F.store === -1 ? u / (u + dtcU || 1) : 1, r = cur.pr[i] * share, fe = cur.pfee[i];
    var fc = state.FC.prods[i];
    return { name: p.title, artist: p.artist, sku: p.sku, us: cur.puS[1][i], uk: cur.puS[2][i], de: cur.puS[3][i], rev: r, fee: fe, feeP: r ? fe / r : null, np: r - fe, fba: inv.onHand, cover: inv.vel ? Math.min(999, inv.onHand / inv.vel) : 999, lost: fc.lost };
  }).filter(Boolean).sort(function (a, b) { return b.rev - a.rev; });
  var shown = sliceRows(rows, ui.amzOpen);
  var cols = [
    { k: 'name', l: 'Product', cls: 'w', f: function (v, r) { return '<b>' + esc(v) + '</b><div class="muted">' + esc(r.artist) + '</div>'; } },
    { k: 'rev', l: 'Net revenue', n: 1, f: function (v) { return fm(v); } },
    { k: 'feeP', l: 'Fee %', n: 1, f: function (v) { return '<span class="' + (v > .4 ? 'dn' : '') + '">' + fp(v) + '</span>'; } },
    { k: 'cover', l: 'FBA cover', n: 1, f: function (v) { return '<span class="' + (v < 14 ? 'dn' : '') + '">' + (v >= 999 ? '∞' : v.toFixed(0)) + '</span>'; } },
    { k: 'fba', l: 'FBA on hand', n: 1, cls: 'hide-m', f: fn }
  ];
  if (ui.amzOpen) cols.push({ k: 'us', l: 'US', n: 1, f: fn }, { k: 'uk', l: 'UK', n: 1, f: fn }, { k: 'de', l: 'DE', n: 1, f: fn }, { k: 'fee', l: 'Fees', n: 1, f: function (v) { return fm(v); } }, { k: 'np', l: 'Net proceeds', n: 1, f: function (v) { return fm(v); } }, { k: 'lost', l: 'Revenue at risk', n: 1, f: function (v) { return v > 0 ? fm(v) : '—'; } });
  var t = $('tAmz'); t._sort = { k: 'rev', d: true };
  table('tAmz', cols, shown, 'rev', true);
  paintMore('amzMore', shown.length, rows.length, ui.amzOpen, 'amzOpen', 'marketplace units, fees, proceeds');
  bindDrawer('amzChart', function () {
    var B = buckets(R.s, R.e), labels = B.b.map(function (x) { return D.iso(x[0]).slice(5); });
    var ds = mk3.map(function (s) { return { type: 'bar', label: D.stores[s], stack: 's', backgroundColor: STC[s], data: bsum(cur.dSt[s], R.s, B.b) }; });
    ds.push({ type: 'line', label: 'Sponsored ads spend', yAxisID: 'y1', borderColor: '#fff', pointRadius: 0, tension: .3, data: B.b.map(function (x) { var t = 0; D.media.forEach(function (mm) { if (mediaOk(mm, 'Amazon Ads', amzStore)) t += sum(mm.spend, x[0], x[1]); }); return t; }) });
    mk('cAmzTrend', { data: { labels: labels, datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return fm(v); } } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return fm(v); } } } } } });
    mk('cAmzFees', { type: 'bar', data: { labels: mk3.map(function (s) { return D.stores[s]; }), datasets: [
      { label: 'Net proceeds', data: mk3.map(function (s) { return cur.st[s] - cur.stFee[s]; }), backgroundColor: '#3ddc97', stack: 'f' },
      { label: 'Referral fees', data: mk3.map(function (s) { return cur.stFeeRef[s]; }), backgroundColor: '#ff9900', stack: 'f' },
      { label: 'FBA + closing fees', data: mk3.map(function (s) { return cur.stFee[s] - cur.stFeeRef[s]; }), backgroundColor: '#e8453c', stack: 'f' }] },
      options: { maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: function (c) { var s = mk3[c.dataIndex]; return c.dataset.label + ': ' + fm(c.raw) + ' (' + fp(c.raw / (cur.st[s] || 1)) + ' of net rev)'; } } } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return fm(v); } } } } } });
  });
}
function renderMedia() {
  var R = state.R, F = state.F, plat = $('fPlat').value, m = mediaAgg(R.s, R.e, plat, F.store), mc = R.cs >= 0 ? mediaAgg(R.cs, R.ce, plat, F.store) : null;
  var platforms = ['Google', 'Meta', 'TikTok', 'Amazon Ads'].filter(function (p) { return D.media.some(function (mm) { return mm.platform === p && mediaOk(mm, '', F.store); }); });
  $('mediaNote').textContent = 'Platform-reported, last-click (synthetic) · ' + storeLabel(F.store) + (F.store === 0 ? ' · Google, Meta, TikTok' : F.store > 0 || F.store === 10 ? ' · Amazon Sponsored Products' : '') + (F.artist ? ' · Platform totals are not split by artist. The table lists campaigns named for ' + F.artist + ' when any exist.' : '');
  $('mediaKpis').innerHTML = kpiHtml([
    ['Spend', fm(m.spend), mc && delta(m.spend, mc.spend, true)],
    ['Attributed revenue', fm(m.rev), mc && delta(m.rev, mc.rev)],
    ['CAC (new customers)', fm(m.cac, 2), mc && delta(m.cac, mc.cac, true)],
    ['CTR · CPC', fp(m.ctr, 2) + ' · ' + fm(m.cpc, 2), (mc ? delta(m.ctr, mc.ctr) : '') + (mc ? ' ' + delta(m.cpc, mc.cpc, true) : '')]
  ]);
  $('mediaChips').innerHTML = '<span class="muted">Platform ROAS · CAC</span>' + platforms.map(function (p) {
    var x = m.plat[p]; if (!x || !x.spend) return '';
    var roas = x.rev / x.spend, cac = x.newc ? x.spend / x.newc : null;
    var flag = p === 'TikTok' && roas < 1;
    return '<span class="chip' + (flag ? ' flag' : '') + '">' + (flag ? 'FLAG · ' : '') + p + ' <b class="' + (roas >= 2.5 ? 'up' : 'dn') + '">' + roas.toFixed(2) + 'x</b> · ' + fm(cac, 0) + '</span>';
  }).join('');
  var prevMap = {}; if (mc) mc.rows.forEach(function (x) { prevMap[x.m.id] = x; });
  var rows = m.rows.filter(function (x) { return x.spend > 0; }).map(function (x) { var p = prevMap[x.m.id]; return { id: x.m.id, plat: x.m.platform, name: x.m.name, type: x.m.type, spend: x.spend, impr: x.impr, clicks: x.clicks, ctr: x.ctr, cpc: x.cpc, conv: x.conv, cvr: x.cvr, rev: x.rev, roas: x.roas, acos: x.acos, cac: x.cac, droas: p && p.roas ? x.roas / p.roas - 1 : null, sku: 'camp-' + x.m.id }; });
  if (F.artist) { var named = rows.filter(function (x) { return artistNamed(x.name, F.artist); }); if (named.length) rows = named; }
  if (ui.focusCamp) { var hitC = rows.filter(function (x) { return x.name === ui.focusCamp; }); if (hitC.length) rows = hitC; }
  rows.sort(function (a, b) { return b.spend - a.spend; });
  var shown = ui.focusCamp ? rows : sliceRows(rows, ui.mediaOpen);
  var cols = [
    { k: 'plat', l: 'Platform', f: function (v) { return '<span class="pill" style="background:' + PLAT[v] + '22;color:' + PLAT[v] + '">' + v + '</span>'; } },
    { k: 'name', l: 'Campaign', cls: 'w', f: function (v) { return esc(v); } },
    { k: 'spend', l: 'Spend', n: 1, f: function (v) { return fm(v); } },
    { k: 'rev', l: 'Revenue', n: 1, f: function (v) { return fm(v); } },
    { k: 'roas', l: 'ROAS', f: function (v) { return roasBar(v); } },
    { k: 'cac', l: 'CAC', n: 1, cls: 'hide-m', f: function (v) { return fm(v, 2); } }
  ];
  if (ui.mediaOpen) cols.push(
    { k: 'type', l: 'Type' }, { k: 'impr', l: 'Impr.', n: 1, f: fn }, { k: 'clicks', l: 'Clicks', n: 1, f: fn },
    { k: 'ctr', l: 'CTR', n: 1, f: function (v) { return fp(v, 2); } }, { k: 'cpc', l: 'CPC', n: 1, f: function (v) { return fm(v, 2); } },
    { k: 'conv', l: 'Conv.', n: 1, f: fn }, { k: 'cvr', l: 'CVR', n: 1, f: function (v) { return fp(v, 2); } },
    { k: 'acos', l: 'ACoS', n: 1, f: function (v) { return fp(v); } },
    { k: 'droas', l: 'Δ ROAS', n: 1, f: function (v) { return v == null ? '<span class="d neu">new</span>' : '<span class="d ' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%</span>'; } }
  );
  var t = $('tMedia'); t._sort = { k: 'spend', d: true };
  table('tMedia', cols, shown, 'spend', true);
  paintMore('mediaMore', shown.length, rows.length, ui.mediaOpen, 'mediaOpen', 'all columns');
  bindDrawer('mediaChart', function () {
    var B = buckets(R.s, R.e), labels = B.b.map(function (x) { return D.iso(x[0]).slice(5); });
    var ds = platforms.filter(function (p) { return !plat || plat === p; }).map(function (p) { return { type: 'bar', label: p + ' spend', stack: 's', backgroundColor: PLAT[p], data: B.b.map(function (x) { var t = 0; D.media.forEach(function (mm) { if (mm.platform === p && mediaOk(mm, '', F.store)) t += sum(mm.spend, x[0], x[1]); }); return t; }) }; });
    ds.push({ type: 'line', label: 'Attributed revenue', yAxisID: 'y1', borderColor: '#f5c542', pointRadius: 0, tension: .3, data: B.b.map(function (x) { var t = 0; D.media.forEach(function (mm) { if (mediaOk(mm, plat, F.store)) t += sum(mm.rev, x[0], x[1]); }); return t; }) });
    mk('cMediaTrend', { data: { labels: labels, datasets: ds }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return fm(v); } } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return fm(v); } } } } } });
  });
}
var crmMode = '';
function renderCrm() {
  var c = state.c, cc = state.cc, R = state.R, F = state.F, dtcNet = state.dtcAll, dtc = incDTC(F.store);
  $('crmNote').innerHTML = dtc ? 'Klaviyo-style campaigns and flows (synthetic) · Shopify DTC customers only.' : '<span style="color:#ff9900">Storefront filter is Amazon. Klaviyo covers Shopify DTC only, so this tab still shows DTC CRM for context.</span>';
  $('crmKpis').innerHTML = kpiHtml([
    ['CRM attributed revenue', fm(c.rev), cc && delta(c.rev, cc.rev)],
    ['Share of DTC revenue', dtcNet ? fp(c.rev / dtcNet) : '—', ''],
    ['Flows share of CRM', fp(c.flowRev / (c.rev || 1)), cc && ddelta(c.flowRev / (c.rev || 1), cc.flowRev / (cc.rev || 1))],
    ['Email open rate', fp(c.openRate), cc && ddelta(c.openRate, cc.openRate)]
  ]);
  $('crmExtra').textContent = 'Email click ' + fp(c.clickRate, 2) + ' · SMS click ' + fp(c.smsCtr, 1) + ' · email list ' + fn(c.eList) + ' (' + (c.eGrowth >= 0 ? '+' : '') + fn(c.eGrowth) + ') · SMS list ' + fn(c.sList) + ' (' + (c.sGrowth >= 0 ? '+' : '') + fn(c.sGrowth) + ') · unsub ' + fp(c.unsubRate, 2) + (F.artist ? ' · Sends are not split by artist. Campaigns named for ' + F.artist + ' are listed when any exist.' : '');
  var camps = c.camps.filter(function (x) { return !crmMode || x.channel === crmMode; });
  if (F.artist) { var named = camps.filter(function (x) { return artistNamed(x.name, F.artist); }); if (named.length) camps = named; }
  if (ui.focusCamp) { var one = camps.filter(function (x) { return x.name === ui.focusCamp; }); if (one.length) camps = one; }
  var rows = camps.map(function (x) { return { date: x.date, ch: x.channel, name: x.name, rec: x.recipients, or: x.opens == null ? null : x.opens / x.recipients, cr: x.clicks / x.recipients, conv: x.conv, rev: x.rev, rpr: x.rev / x.recipients, ur: x.unsubs / x.recipients }; }).sort(function (a, b) { return b.rev - a.rev; });
  var shown = ui.focusCamp ? rows : sliceRows(rows, ui.crmOpen);
  var cols = [
    { k: 'date', l: 'Date', cls: 'hide-m' },
    { k: 'ch', l: 'Channel', f: function (v) { return '<span class="pill ' + (v === 'sms' ? 'p-ok' : 'p-warn') + '">' + v.toUpperCase() + '</span>'; } },
    { k: 'name', l: 'Campaign', cls: 'w', f: function (v) { return esc(v); } },
    { k: 'rev', l: 'Revenue', n: 1, f: function (v) { return fm(v); } },
    { k: 'cr', l: 'Click rate', n: 1, f: function (v) { return fp(v, 2); } }
  ];
  if (ui.crmOpen) cols.push({ k: 'rec', l: 'Recipients', n: 1, f: fn }, { k: 'or', l: 'Open rate', n: 1, f: function (v) { return v == null ? '—' : fp(v); } }, { k: 'conv', l: 'Orders', n: 1, f: fn }, { k: 'rpr', l: 'Rev / recip.', n: 1, f: function (v) { return '$' + v.toFixed(3); } }, { k: 'ur', l: 'Unsub', n: 1, f: function (v) { return '<span class="' + (v > .005 ? 'dn' : '') + '">' + fp(v, 2) + '</span>'; } });
  var t = $('tCrm'); t._sort = { k: 'rev', d: true };
  table('tCrm', cols, shown, 'rev', true);
  paintMore('crmMore', shown.length, rows.length, ui.crmOpen, 'crmOpen', 'recipients, open rate, orders, unsub');
  bindDrawer('crmChart', function () {
    var fl = c.flows.slice().sort(function (a, b) { return b.rev - a.rev; });
    mk('cFlows', { type: 'bar', data: { labels: fl.map(function (f) { return f.name; }), datasets: [{ label: 'Revenue', data: fl.map(function (f) { return f.rev; }), backgroundColor: '#a78bfa', borderRadius: 3, xAxisID: 'x' }, { label: 'Revenue per recipient', data: fl.map(function (f) { return f.rpr; }), backgroundColor: '#f5c542', borderRadius: 3, xAxisID: 'x1' }] }, options: { indexAxis: 'y', maintainAspectRatio: false, scales: { y: { ticks: { font: { size: 10 } } }, x: { ticks: { callback: function (v) { return fm(v); } } }, x1: { position: 'top', grid: { display: false }, ticks: { callback: function (v) { return '$' + v.toFixed(2); } } } } } });
    var s0 = Math.min(R.s, T - 179), lab = [], e1 = [], s1 = []; for (var d = s0; d <= R.e; d += (R.e - s0 > 200 ? 7 : 1)) { lab.push(D.iso(d).slice(5)); e1.push(D.crm.emailList[d].size); s1.push(D.crm.smsList[d].size); }
    mk('cList', { type: 'line', data: { labels: lab, datasets: [{ label: 'Email subscribers', data: e1, borderColor: '#a78bfa', pointRadius: 0, tension: .3 }, { label: 'SMS subscribers', data: s1, borderColor: '#4dd0e1', pointRadius: 0, tension: .3, yAxisID: 'y1' }] }, options: { maintainAspectRatio: false, scales: { y: { ticks: { callback: fn } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: fn } } } } });
  });
}
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
function riskCount(artist) {
  return state.FC.prods.filter(function (x) {
    if (artist && x.p.artist !== artist) return false;
    return x.so && x.inv.vel > 0 && !(x.p.alloc && x.p.stock[0] === 0);
  });
}
function renderForecast() {
  var F0 = state.FC, st = state.F.store, artist = state.F.artist;
  var risks = riskCount(artist);
  var lost = risks.reduce(function (a, x) { return a + x.lost; }, 0);
  var lostAll = state.FC.prods.reduce(function (a, x) { return a + x.lost; }, 0);
  $('fcMethod').textContent = storeLabel(st) + ' · seasonal-naive (t−364 days, weekday-aligned) × trailing 8-week YoY growth (' + ((F0.g - 1) * 100).toFixed(1) + '%). Bands from 90-day backtest residuals (σ=' + F0.sd.toFixed(3) + ' log). Vs last 90 days ' + sgn(pct(F0.tot, F0.last90)) + '. The revenue model follows the storefront only' + (artist ? '. Stockout rows below are limited to ' + artist + '.' : '.');
  $('fcKpis').innerHTML = kpiHtml([
    ['Forecast net revenue (90d)', fm(F0.tot), '<span class="d neu">80%: ' + fm(F0.tot * Math.exp(-1.2816 * F0.totSd)) + ' – ' + fm(F0.tot * Math.exp(1.2816 * F0.totSd)) + '</span>'],
    ['vs same 90 days LY', sgn(pct(F0.tot, F0.ly)), '<span class="d neu">LY ' + fm(F0.ly) + '</span>'],
    ['Peak day', fm(F0.peak.f), '<span class="d neu">' + D.iso(F0.peak.d) + ' ' + peakLabel(F0.peak.d) + '</span>'],
    ['Backtest MAPE (daily)', fp(F0.mape), '<span class="d neu">90-day total error ' + fp(F0.totErr) + '</span>'],
    ['SKUs at stockout risk', '<span class="' + (risks.length ? 'dn' : '') + '">' + risks.length + '</span>', '<span class="d neu">' + (artist && lost !== lostAll ? fm(lost) + ' of this artist · ' + fm(lostAll) + ' all artists' : '≈' + fm(artist ? lost : lostAll) + ' demand at risk') + '</span>']
  ]);
  var s0 = T - 119, lab = [], act = [], f = [], l80 = [], h80 = [], l95 = [], h95 = [], ly = [];
  for (var d = s0; d <= T + 90; d++) { lab.push(D.iso(d).slice(5)); var x = d > T ? F0.fc[d - T - 1] : null; act.push(d <= T ? F0.A[d] : null); f.push(x ? x.f : d === T ? F0.A[T] : null); l80.push(x ? x.lo80 : null); h80.push(x ? x.hi80 : null); l95.push(x ? x.lo95 : null); h95.push(x ? x.hi95 : null); ly.push(F0.A[d - 364] != null ? F0.A[d - 364] : null); }
  mk('cFc', { type: 'line', data: { labels: lab, datasets: [
    { label: '95% band', data: h95, borderColor: 'transparent', backgroundColor: 'rgba(245,197,66,.08)', fill: '+1', pointRadius: 0 }, { label: '95% low', data: l95, borderColor: 'transparent', pointRadius: 0, fill: false },
    { label: '80% band', data: h80, borderColor: 'transparent', backgroundColor: 'rgba(245,197,66,.18)', fill: '+1', pointRadius: 0 }, { label: '80% low', data: l80, borderColor: 'transparent', pointRadius: 0, fill: false },
    { label: 'Actual', data: act, borderColor: '#5aa9ff', pointRadius: 0, tension: .2, borderWidth: 1.6 }, { label: 'Forecast', data: f, borderColor: '#f5c542', borderDash: [5, 3], pointRadius: 0, tension: .2, borderWidth: 2 },
    { label: 'Last year (t−364)', data: ly, borderColor: 'rgba(255,255,255,.22)', pointRadius: 0, tension: .2, borderWidth: 1 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { filter: function (i) { return i.text.indexOf('low') < 0; } } }, tooltip: { filter: function (i) { return i.dataset.label.indexOf('low') < 0 && i.raw != null; }, callbacks: { label: function (c) { return c.dataset.label + ': ' + fm(c.raw); } } } }, scales: { y: { ticks: { callback: function (v) { return fm(v); } } }, x: { ticks: { maxTicksLimit: 12 } } } } });
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
  mountNotes('notes-social', '', 'demo');
  mountNotes('notes-products', '', 'demo');
  mountNotes('notes-amazon', '', 'demo');
  mountNotes('notes-paid', '', 'demo');
  mountNotes('notes-crm', '', 'demo');
  mountNotes('notes-health', '', 'mix');
  mountNotes('notes-suggest', '', 'pub');

  var ovIn = cmp
    ? '<p>Net revenue (' + storeLabel(F.store) + ') is <b>' + fm(cur.net) + '</b>, ' + (cur.net >= cmp.net ? 'up' : 'down') + ' <b>' + fp(Math.abs(pct(cur.net, cmp.net))) + '</b> ' + cmpLbl + '. <b>' + cats[best] + '</b> contributed the largest gain (' + (bv >= 0 ? '+' : '') + fm(bv) + ')' + (wv < 0 ? '; <b>' + cats[worst] + '</b> was the biggest drag (' + fm(wv) + ').' : '.') + '</p>'
    : '<p>Net revenue (' + storeLabel(F.store) + ') is <b>' + fm(cur.net) + '</b> on <b>' + fn(cur.orders) + '</b> orders (AOV ' + fm(cur.aov, 2) + '). The comparison window starts before the dataset, so there is no prior period.</p>';
  var ovSg = best < 0 ? '<p>Pick a comparison that sits inside the dataset before choosing a category to push.</p>'
    : (wv < 0 ? '<p>Review <b>' + cats[worst] + '</b> first (' + fm(wv) + ' vs comparison). Check price, on-hand stock, and whether paid and email are still pushing it.</p>'
      : '<p>Put the next release push behind <b>' + cats[best] + '</b>, the largest gain (' + (bv >= 0 ? '+' : '') + fm(bv) + ').</p>');

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
  var aff = chanBlock(7, 'Affiliate');
  var affSg = !chanOn(7) ? aff.suggest : (aff.down
    ? '<p>Affiliate revenue slipped. Pause codes on slow movers and point the next partner drop at <b>' + (best >= 0 ? cats[best] : 'the leading category') + '</b>.</p>'
    : '<p>Keep creator codes on the SKUs that already sell through affiliate, and brief the next drop around <b>' + (best >= 0 ? cats[best] : 'the leading category') + '</b>.</p>');
  var direct = chanBlock(6, 'Direct');
  var directSg = !chanOn(6) ? direct.suggest : ((direct.share || 0) >= 0.12
    ? '<p>Direct is a large share. Hold out branded paid search before buying more brand terms, so this traffic is not purchased twice.</p>'
    : '<p>Direct is a smaller share. Make the return path obvious: recent artists, order status, and site search.</p>');
  ovIn += '<details class="owned"><summary>Search · Affiliate · Direct</summary>' + search.insight + searchSg + aff.insight + affSg + direct.insight + directSg + '</details>';
  if (F.artist) ovIn += '<p class="muted">Artist filter: <b>' + esc(F.artist) + '</b>. Order revenue includes only that artist’s products. Sessions, paid spend, and CRM sends are not split by artist.</p>';
  fillNotes('notes-overview', ovIn, ovSg);

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

  var drops = D.products.filter(function (p) { return (!F.artist || p.artist === F.artist) && p.alloc && p.launch > R.s - 60 && p.launch <= R.e && (F.store <= 0); });
  var rr = cats.map(function (_, i) { var g = 0, r = 0; D.products.forEach(function (p, j) { if (p.cat === i) { g += cur.pu[j]; r += cur.pru[j]; } }); return [i, g > 50 ? r / g : 0]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
  var prodIn = '<p>Highest return rate: <b>' + cats[rr[0]] + '</b> at ' + fp(rr[1]) + ' of units (average ' + fp(cur.retRate) + ' of revenue).</p>';
  var prodSg = rr[0] === 6 ? '<p>Check size guides and fit notes on <b>' + cats[rr[0]] + '</b>.</p>' : '<p>Most returns look like damaged sleeves or warped vinyl in transit. Review mailer packaging' + (amz ? ' (Amazon DE returns run highest)' : '') + '.</p>';
  if (drops.length && dtc) {
    var dd = drops.map(function (p) { return [p, p.alloc - p.stock[0]]; }).sort(function (a, b) { return b[0].launch - a[0].launch; }).slice(0, 3);
    prodIn += '<p><b>Limited and signed drops:</b> ' + dd.map(function (x) { return '<b>' + x[0].artist + ' – ' + x[0].title + '</b> ' + fp(x[1] / x[0].alloc, 0) + ' sold-through of ' + fn(x[0].alloc) + (x[0].stock[0] === 0 ? ' (sold out)' : ''); }).join('; ') + '.</p>';
    prodSg += '<p>Fast sell-through on those drops: consider a second color variant or a waitlist.</p>';
  } else prodIn += '<p>No limited or signed drop launched in this window' + (dtc ? '' : ' for a Shopify storefront') + '.</p>';

  var top = D.products.map(function (p, i) { return { p: p, r: cur.pr[i], inv: invFor(p, F.store), fc: FC.prods[i] }; }).filter(function (x) { return !F.artist || x.p.artist === F.artist; }).sort(function (a, b) { return b.r - a.r; }).slice(0, 15);
  var risk = top.filter(function (x) { return x.inv.vel > 0 && x.inv.onHand > 0 && (x.inv.onHand / x.inv.vel < 21 || (x.fc.so && x.fc.so - T < 45)); }).slice(0, 4);
  var over = D.products.filter(function (p) { if (F.artist && p.artist !== F.artist) return false; var iv = invFor(p, F.store); return iv.vel > 0 && iv.onHand / iv.vel > 180 && !p.alloc; }), oc = over.reduce(function (a, p) { return a + invFor(p, F.store).onHand * p.cost; }, 0);
  var stockIn = risk.length
    ? '<p><b>Inventory risk on best sellers (' + storeLabel(F.store) + '):</b> ' + risk.map(function (x) { return '<b>' + x.p.artist + ' – ' + x.p.title + '</b> (' + Math.round(x.inv.onHand / x.inv.vel) + ' days of cover' + (x.fc.so ? ', stockout ~' + D.iso(x.fc.so).slice(5) : '') + ')'; }).join(', ') + '.</p>'
    : '<p>None of the top sellers are inside 21 days of cover or a 45-day stockout for ' + storeLabel(F.store) + '.</p>';
  var stockSg = (risk.length ? '<p>Vinyl re-presses take 6–10 weeks. Place the PO or FBA replenishment now for BFCM.</p>' : '<p>No urgent replenishment on the current best sellers.</p>');
  stockSg += over.length ? '<p><b>' + over.length + ' slow movers</b> hold ' + fm(oc) + ' of inventory at cost with more than 180 days of cover (for example ' + over.slice(0, 3).map(function (p) { return p.artist + ' – ' + p.title; }).join(', ') + '). Bundle them or mark them down for BFCM.</p>' : '<p>No unallocated SKU is sitting on more than 180 days of cover.</p>';

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

  var lostTot = FC.prods.reduce(function (a, x) { return a + ((!F.artist || x.p.artist === F.artist) ? x.lost : 0); }, 0);
  var peak = peakLabel(FC.peak.d);
  var fcIn = '<p>Next 90 days (' + storeLabel(F.store) + '): <b>' + fm(FC.tot) + '</b> net revenue (' + sgn(pct(FC.tot, FC.ly)) + ' vs last year), peaking on <b>' + D.iso(FC.peak.d) + '</b>' + (peak ? ' (' + peak + ')' : '') + '. Projected stockouts put about <b>' + fm(lostTot) + '</b> of demand at risk' + (F.artist ? ' for <b>' + esc(F.artist) + '</b>' : '') + '.</p>';
  var fcSg = '<p>Cover the stockout risk before <b>' + D.iso(FC.peak.d) + '</b>' + (peak ? ' (' + peak + ')' : '') + '. The forecast revenue model follows the storefront only.</p>';
  fillNotes('notes-products', prodIn + stockIn + fcIn, prodSg + stockSg + fcSg);

  renderAuditNotes();
  renderSuggestNotes();
}
function renderAuditNotes() {
  var A = window.WRAudit, homeM = auditRun('home', 'mobile'), homeD = auditRun('home', 'desktop');
  var demo = state.R ? auditDemo(state.R.s, state.R.e, state.F) : null;
  if (!A || !homeM) {
    fillNotes('notes-health', '<p>The public audit is not in this build.</p>', '<p>Rebuild so the Lighthouse results are inlined.</p>');
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
  var cartM = auditRun('cart', 'mobile'), uxIssues = (A.issues || []).filter(function (i) { return i.area === 'ux' || i.area === 'both'; });
  var uxIn = '<p><b>' + (uxIssues[0] ? uxIssues[0].title : 'Lab performance') + '.</b> Homepage LCP is ' + (homeM.lab.lcpMs / 1000).toFixed(1) + 's on mobile' + (homeD ? ' and ' + (homeD.lab.lcpMs / 1000).toFixed(1) + 's on desktop' : '') + (cartM ? '. Cart CLS is ' + cartM.lab.cls + ' on mobile' : '') + '.</p>';
  if (state.F && state.F.artist) uxIn += '<p class="muted">DEMO device split is not split by artist.</p>';
  else if (demo && demo.devices) {
    var mob = demo.devices.mobile, desk = demo.devices.desktop;
    uxIn += '<p class="muted">DEMO device split of filtered Shopify DTC: mobile AOV ' + fm(mob.aov, 2) + ' vs desktop ' + fm(desk.aov, 2) + (mob.cvr == null ? '.' : ', conversion ' + fp(mob.cvr, 2) + ' vs ' + fp(desk.cvr, 2) + '.') + '</p>';
  } else uxIn += '<p class="muted">DEMO device split is hidden for this storefront or channel.</p>';
  var uxFixes = (A.fixes || []).filter(function (x) { return x.area === 'ux'; });
  var uxSg = uxFixes.length ? '<p>' + uxFixes.map(function (x) { return x.title; }).join('</p><p>') + '</p>' : '<p>No ranked UX fix is in the audit file.</p>';
  fillNotes('notes-health', seoIn + uxIn, seoSg + uxSg);
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
function sugFlat(a) {
  var cards = [];
  a.suggestions.forEach(function (s) {
    if (sug.group !== 'all' && s.group !== sug.group) return;
    var g = SUG_GROUPS.filter(function (x) { return x[0] === s.group; })[0];
    cards.push({ k: g ? g[1] : s.group, t: s.text, e: s.reason, ev: s.evidence });
  });
  if (sug.group === 'trending' || (sug.group === 'all' && ui.sugAll)) {
    (a.recent || []).forEach(function (p) {
      cards.push({ k: 'Trending items', t: p.title, e: (p.format || '') + ' · ' + money(p.price, p.currency) + ' · ' + (p.date || ''), href: p.url });
    });
  }
  return cards;
}
function sugRenderArtist() {
  var C = window.WRCatalog, a = sugCurrent();
  if (!a) {
    $('sugHead').innerHTML = '<p class="empty-note">No artist matches that search.</p>';
    $('sugKpis').innerHTML = ''; $('sugCards').innerHTML = ''; $('sugMore').innerHTML = ''; $('sugGroups').innerHTML = '';
    $('sugFitWrap').classList.add('hide');
    if (charts.cSugFit) { charts.cSugFit.destroy(); charts.cSugFit = null; }
    return;
  }
  var b = C.benchmarks, opCls = (a.operator || '').indexOf('WMG') >= 0 ? 'p-ok' : 'p-mut';
  var links = a.urls.map(function (u) { var host = u.replace(/^https?:\/\//, '').replace(/\/$/, ''); return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(host) + '</a>'; }).join('');
  $('sugHead').innerHTML = '<div class="card-h"><div><h3>' + esc(a.name) + '</h3><div class="artist-links">' + (links || '<span class="muted">No store URL</span>') + '</div></div><div><span class="badge-public">PUBLIC</span> <span class="pill ' + opCls + '">' + esc(a.operator || 'Store') + '</span> <span class="pill p-mut">' + esc(a.currency || '—') + '</span></div></div>';
  var low = a.inStock != null && a.inStock < b.median_in_stock_pct;
  $('sugKpis').innerHTML = kpiHtml([
    ['Products', fn(a.products), '<span class="muted">' + fn(a.music) + ' music · ' + fn(a.merch) + ' merch</span>'],
    ['In stock', (low ? '<span class="dn">' : '') + (a.inStock == null ? '—' : a.inStock.toFixed(1) + '%') + (low ? '</span>' : ''), '<span class="muted">Roster median ' + b.median_in_stock_pct + '%</span>'],
    ['Signed · colored vinyl', fn(a.signed) + ' · ' + fn(a.colored), '<span class="muted">' + b.pct_vinyl_sellers_with_signed + '% / ' + b.pct_vinyl_sellers_with_colored + '% of vinyl sellers</span>'],
    ['New, last 90 days', fn(a.new90), '<span class="muted">Newest ' + esc(a.newest || '—') + ' · ' + a.suggestions.length + ' gaps</span>']
  ]);
  var cards = sugFlat(a), shown = ui.sugAll ? cards : cards.slice(0, 3);
  $('sugCards').innerHTML = shown.length ? shown.map(function (c) {
    var title = c.href ? '<a class="prod-link" href="' + esc(c.href) + '" target="_blank" rel="noopener">' + esc(c.t) + '</a>' : esc(c.t);
    return '<article class="sug"><div class="k">' + esc(c.k) + '</div><div class="t">' + title + '</div><div class="e">' + esc(c.e) + '</div>' + (c.ev ? evHtml(c.ev) : '') + '</article>';
  }).join('') : '<p class="empty-note">No suggestions in this group.</p>';
  var rest = [], seenG = {};
  cards.slice(shown.length).forEach(function (c) { if (!seenG[c.k]) { seenG[c.k] = 1; rest.push(c.k); } });
  $('sugMore').innerHTML = '<span>' + (cards.length ? (ui.sugAll ? 'All ' + cards.length : Math.min(3, cards.length) + ' of ' + cards.length) : 'No cards') + (rest.length ? ' · ' + rest.join(', ') : '') + '</span>' + moreLink('sugAll', ui.sugAll ? 'Show less' : 'Show all ' + cards.length + ' · format coverage chart');
  $('sugFitWrap').classList.toggle('hide', !ui.sugAll);
  $('sugGroups').innerHTML = ui.sugAll && sug.group === 'all' ? '' : '';
  if (!ui.sugAll) { if (charts.cSugFit) { charts.cSugFit.destroy(); charts.cSugFit = null; } return; }
  var labels = Object.keys(b.format_adoption_pct);
  mk('cSugFit', { type: 'bar', data: { labels: labels, datasets: [{ label: 'Roster adoption', data: labels.map(function (k) { return b.format_adoption_pct[k] || 0; }), backgroundColor: labels.map(function (k) { return (a.formats[k] || 0) > 0 ? '#3ddc97' : (b.format_adoption_pct[k] || 0) >= 50 ? '#e8453c' : '#5c5c70'; }), borderRadius: 3 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.label + ': ' + c.raw + '% of stores · this store lists ' + fn(a.formats[c.label] || 0); } } } }, scales: { x: { max: 100, ticks: { callback: function (v) { return v + '%'; } } } } } });
  $('sugFitNote').textContent = 'Green = this store lists it · red = missing and at least half the roster sells it · bar length is roster adoption';
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
    ['Median in stock', b.median_in_stock_pct + '%', '<span class="muted">Across the roster</span>']
  ]);
  $('sugRosterExtra').textContent = 'Colored vinyl ' + b.pct_vinyl_sellers_with_colored + '% of vinyl sellers · signed ' + b.pct_vinyl_sellers_with_signed + '% · bundles ' + b.pct_stores_with_bundles + '% of stores.';
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
  if ($('sugTypes')) $('sugTypes').value = 'all';
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
  $('sugArtist').addEventListener('change', function () {
    if (!this.value) return;
    sug.name = this.value; sug.view = 'artist';
    if ($('fArtist').value !== this.value) { $('fArtist').value = this.value; render(); }
    sugRender();
  });
  $('sugView').addEventListener('click', function (e) { var v = e.target.getAttribute('data-v'); if (!v) return; sug.view = v; sugRender(); });
  $('sugTypes').addEventListener('change', function () { sug.group = this.value; sugRender(); });
  fmtSel.addEventListener('change', function () { sug.fmt = this.value; if (sug.view === 'roster') sugRenderRosterList(); });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.sug-jump'); if (!b) return; sugJump(b.getAttribute('data-artist')); });
  sugRender();
}

// ---------- init ----------
var searchItems = [], qActive = -1;
function syncSugFromArtist(name) {
  if (!name || !window.WRCatalog || !$('sugArtist')) return;
  if (!window.WRCatalog.artists.some(function (a) { return a.name === name; })) return;
  sug.name = name; sug.view = 'artist'; sug.q = ''; sug.group = 'all';
  if ($('sugSearch')) $('sugSearch').value = '';
  if ($('sugTypes')) $('sugTypes').value = 'all';
  sugSyncArtists();
  sugRender();
}
function buildSearch() {
  searchItems = [
    { type: 'Section', label: 'Overview', go: 'overview' },
    { type: 'Section', label: 'Channels', go: 'channels' },
    { type: 'Section', label: 'Organic social', go: 'channels', tab: 'social' },
    { type: 'Section', label: 'Paid media', go: 'channels', tab: 'paid' },
    { type: 'Section', label: 'CRM', go: 'channels', tab: 'crm' },
    { type: 'Section', label: 'Amazon', go: 'channels', tab: 'amazon' },
    { type: 'Section', label: 'Products and forecast', go: 'products' },
    { type: 'Section', label: 'Site health', go: 'health' },
    { type: 'Section', label: 'SEO', go: 'health' },
    { type: 'Section', label: 'UX', go: 'health' },
    { type: 'Section', label: 'Product suggestions', go: 'suggest' }
  ];
  var seen = {};
  D.products.forEach(function (p) { seen[p.artist] = 'sales'; });
  if (window.WRCatalog) window.WRCatalog.artists.forEach(function (a) { if (!seen[a.name]) seen[a.name] = 'roster'; });
  Object.keys(seen).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (name) {
    var opt = document.createElement('option'); opt.value = name; opt.textContent = name; $('fArtist').appendChild(opt);
    searchItems.push({ type: 'Artist', label: name, sub: seen[name] === 'sales' ? 'Demo catalog' : 'Public roster', artist: name, go: seen[name] === 'sales' ? 'overview' : 'suggest' });
  });
  D.products.forEach(function (p) { searchItems.push({ type: 'Product', label: p.title, sub: p.artist + ' · ' + p.sku, artist: p.artist, sku: p.sku, go: 'products' }); });
  D.media.forEach(function (m) { searchItems.push({ type: 'Campaign', label: m.name, sub: m.platform, go: 'channels', tab: m.platform === 'Amazon Ads' ? 'amazon' : 'paid', camp: m.name }); });
  var crmSeen = {};
  D.crm.campaigns.forEach(function (c) { if (crmSeen[c.name]) return; crmSeen[c.name] = 1; searchItems.push({ type: 'Campaign', label: c.name, sub: 'CRM · ' + c.channel, go: 'channels', tab: 'crm', camp: c.name }); });
  D.crm.flows.forEach(function (f) { searchItems.push({ type: 'Campaign', label: f.name, sub: 'CRM flow · ' + f.channel, go: 'channels', tab: 'crm' }); });
}
function qShow(list) {
  var box = $('qResults');
  if (!list) { box.classList.add('hide'); box._list = []; $('qFind').setAttribute('aria-expanded', 'false'); return; }
  box._list = list;
  box.innerHTML = list.length ? list.map(function (it, i) { return '<button type="button" class="q-item' + (i === qActive ? ' on' : '') + '" role="option" data-i="' + i + '"><span class="k">' + esc(it.type) + '</span><span><b>' + esc(it.label) + '</b>' + (it.sub ? '<div class="s">' + esc(it.sub) + '</div>' : '') + '</span></button>'; }).join('') : '<div class="q-empty">No matches</div>';
  box.classList.remove('hide');
  $('qFind').setAttribute('aria-expanded', 'true');
}
function qQuery(q) {
  q = String(q || '').trim().toLowerCase();
  if (q.length < 1) return qShow(null);
  var list = [];
  for (var i = 0; i < searchItems.length && list.length < 12; i++) {
    var it = searchItems[i], hay = (it.label + ' ' + (it.sub || '') + ' ' + (it.sku || '')).toLowerCase();
    if (hay.indexOf(q) >= 0) list.push(it);
  }
  qActive = list.length ? 0 : -1;
  qShow(list);
}
function qGo(it) {
  if (!it) return;
  qShow(null); $('qFind').value = '';
  if (it.camp) { ui.focusCamp = it.camp; ui.mediaOpen = true; ui.crmOpen = true; ui.amzOpen = true; }
  if (it.sku) { state.holdFocus = true; state.focusSku = it.sku; ui.prodOpen = true; prodMode = 'best'; }
  if (it.artist) { state.holdFocus = true; $('fArtist').value = it.artist; }
  if (it.artist || it.sku) { render(); if (it.artist) syncSugFromArtist(it.artist); }
  if (it.tab) setChanTab(it.tab);
  var el = $(it.go); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function init() {
  D = WRData.generate(); N = D.meta.ndays; T = N - 1; NCH = D.nch; NST = D.stores.length; NDTC = D.dtcChannels;
  D.categories.forEach(function (c, i) { $('fCat').insertAdjacentHTML('beforeend', '<option value="' + i + '">' + c.replace(/"/g, '&quot;') + '</option>'); });
  D.channels.forEach(function (c, i) { $('fChan').insertAdjacentHTML('beforeend', '<option value="' + i + '">' + c + (i >= NDTC ? ' (Amazon)' : '') + '</option>'); });
  D.regions.forEach(function (c, i) { $('fReg').insertAdjacentHTML('beforeend', '<option value="' + i + '">' + c + '</option>'); });
  buildSearch();
  $('fFrom').value = D.iso(T - 29); $('fTo').value = D.iso(T); $('fFrom').min = $('fTo').min = D.meta.start; $('fFrom').max = $('fTo').max = D.meta.end;
  ['fRange', 'fCat', 'fChan', 'fReg', 'fCmp', 'fFrom', 'fTo'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      document.querySelectorAll('.custom').forEach(function (e) { e.classList.toggle('hide', $('fRange').value !== 'custom'); });
      if ($('fRange').value === 'custom') { $('morePanel').classList.remove('hide'); $('moreBtn').setAttribute('aria-expanded', 'true'); }
      render();
    });
  });
  $('fArtist').addEventListener('change', function () { syncSugFromArtist(this.value); render(); });
  $('storeSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var v = b.getAttribute('data-v');
    if (v === 'amazon') setStorefront(+$('fStore').value > 0 ? +$('fStore').value : 10);
    else setStorefront(+v);
  });
  $('fAmz').addEventListener('change', function () { setStorefront(+this.value); });
  $('moreBtn').addEventListener('click', function () {
    $('morePanel').classList.toggle('hide');
    this.setAttribute('aria-expanded', $('morePanel').classList.contains('hide') ? 'false' : 'true');
  });
  $('bkSeg').addEventListener('click', function (e) {
    var v = e.target.getAttribute('data-v'); if (!v) return;
    ui.bk = v;
    this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
    if (state.cur) drawBreak(state.cur, state.cmp);
  });
  $('chanTabs').addEventListener('click', function (e) {
    var b = e.target.closest('.chtab'); if (!b) return;
    setChanTab(b.getAttribute('data-tab'));
    var sec = $('channels'); if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelectorAll('.tabs a').forEach(function (a) {
    a.addEventListener('click', function () { document.querySelectorAll('.tabs a').forEach(function (x) { x.classList.toggle('on', x === a); }); });
  });
  $('finder').addEventListener('submit', function (e) { e.preventDefault(); var list = $('qResults')._list || []; if (list.length) qGo(list[Math.max(0, qActive)]); });
  $('qFind').addEventListener('input', function () { qQuery(this.value); });
  $('qFind').addEventListener('keydown', function (e) {
    var list = $('qResults')._list || [];
    if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); qActive = Math.min(list.length - 1, qActive + 1); qShow(list); }
    else if (e.key === 'ArrowUp' && list.length) { e.preventDefault(); qActive = Math.max(0, qActive - 1); qShow(list); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list.length) qGo(list[Math.max(0, qActive)]); }
    else if (e.key === 'Escape') qShow(null);
  });
  $('qResults').addEventListener('click', function (e) { var b = e.target.closest('.q-item'); if (!b) return; qGo(($('qResults')._list || [])[+b.getAttribute('data-i')]); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.finder')) qShow(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    e.preventDefault(); $('qFind').focus();
  });
  document.addEventListener('click', function (e) {
    var jump = e.target.closest && e.target.closest('[data-artist-jump]');
    if (jump) { $('fArtist').value = jump.getAttribute('data-artist-jump'); syncSugFromArtist($('fArtist').value); render(); return; }
    var b = e.target.closest && e.target.closest('[data-more]'); if (!b) return;
    e.preventDefault();
    var key = b.getAttribute('data-more');
    ui[key] = !ui[key];
    if (key === 'prodOpen') renderProducts();
    else if (key === 'socOpen') renderSocialPane();
    else if (key === 'mediaOpen') renderMedia();
    else if (key === 'crmOpen') renderCrm();
    else if (key === 'amzOpen') renderAmazon();
    else if (key === 'healthCols' || key === 'fixesOpen') renderSeoUx();
    else if (key === 'sugAll') sugRender();
  });
  $('fPlat').addEventListener('change', function () { ui.focusCamp = ''; renderMedia(); });
  $('prodSeg').addEventListener('click', function (e) { var v = e.target.getAttribute('data-v'); if (!v) return; prodMode = v; ui.prodOpen = false; this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === e.target); }); $('tProd')._sort = null; renderProducts(); });
  $('crmSeg').addEventListener('click', function (e) { var v = e.target.getAttribute('data-v'); if (v == null) return; crmMode = v; this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === e.target); }); renderCrm(); });
  $('dataLink').addEventListener('click', function (e) { e.preventDefault(); var blob = new Blob([JSON.stringify(WRData.exportSummary(D))], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wr-store-demo-data.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); });
  render();
  sugInit();
  if (window.WRReportInstall) window.WRReportInstall({
    data: function () { return D; }, today: function () { return T; },
    agg: agg, mediaAgg: mediaAgg, crmAgg: crmAgg, getForecast: getForecast, invFor: invFor,
    fm: fm, fn: fn, fp: fp, pct: pct, sgn: sgn, storeLabel: storeLabel, peakLabel: peakLabel,
    pageFilters: function () { return { store: +$('fStore').value, chan: +$('fChan').value, cat: +$('fCat').value, reg: +$('fReg').value, artist: $('fArtist').value || '' }; },
    auditDemo: function (s, e, f) { return auditDemo(s, e, Object.assign({ reg: -1, cat: -1, chan: -1, store: -1, artist: '' }, f || {})); }
  });
  $('loading').remove(); window.__WR_READY = true;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
