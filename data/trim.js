// Trims the public artist-store feeds into the payload inlined in dist/index.html.
// Source files are the full catalogs; the page only needs roster benchmarks,
// per-artist suggestions, and a short list of recently added products to link out.
const fs = require('fs');
const path = require('path');

const CUTOFF = '2026-07-28'; // created_at on/after this matches summary new_last_90d
const RECENT_CAP = 12;
const MUSIC = new Set(['Vinyl', 'CD', 'Cassette', 'Box Set', 'Digital']);

function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  const header = rows[0];
  return rows.slice(1).filter(r => r.length > 1 && r.some(Boolean)).map(r => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] == null ? '' : r[i]; });
    return o;
  });
}

function num(v) {
  if (v == null || v === '') return null;
  const n = +v;
  return n === n ? n : null;
}

function groupOf(sg) {
  if (sg.type === 'missing_format') {
    const m = /^Add (.+) to the store$/.exec(sg.suggestion || '');
    const fmt = m ? m[1] : '';
    return MUSIC.has(fmt) ? 'missing_format' : 'merch';
  }
  if (sg.type === 'signed' || sg.type === 'colored_vinyl') return 'signed_color';
  if (sg.type === 'pricing_gap') return 'pricing';
  if (sg.type === 'bundle') return 'bundle';
  if (sg.type === 'restock') return 'restock';
  if (sg.type === 'stale_catalog') return 'stale';
  return sg.type;
}

function recentProducts(artistRec) {
  if (!artistRec) return [];
  const best = new Map();
  (artistRec.stores || []).forEach(st => {
    (st.catalog || []).forEach(p => {
      const d = (p.created_at || '').slice(0, 10);
      if (!d || d < CUTOFF || !p.url) return;
      const key = (p.title || '').trim().toLowerCase() + '\n' + (p.format || '');
      const row = {
        title: p.title,
        format: p.format || 'Other',
        price: p.price,
        currency: p.currency || st.currency || '',
        date: d,
        url: p.url,
        available: !!p.available
      };
      const prev = best.get(key);
      if (!prev || row.date > prev.date || (row.date === prev.date && row.currency === 'USD' && prev.currency !== 'USD')) best.set(key, row);
    });
  });
  return Array.from(best.values()).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title))).slice(0, RECENT_CAP);
}

function buildCatalog(dir) {
  dir = dir || path.join(__dirname);
  const sugg = JSON.parse(fs.readFileSync(path.join(dir, 'suggestions.json'), 'utf8'));
  const summary = parseCsv(fs.readFileSync(path.join(dir, 'artist_store_summary.csv'), 'utf8'));
  const stores = JSON.parse(fs.readFileSync(path.join(dir, 'artist_stores.json'), 'utf8'));
  const byStore = {};
  (stores.artists || []).forEach(a => { byStore[a.artist] = a; });
  const bySum = {};
  summary.forEach(r => { bySum[r.artist] = r; });

  const fmtKeys = ['Vinyl', 'CD', 'Cassette', 'Box Set', 'Bundle', 'T-Shirt/Top', 'Hoodie/Sweatshirt', 'Headwear', 'Poster/Print/Flag', 'Bags', 'Home/Drinkware', 'Accessories/Small goods', 'Apparel (other)', 'Digital'];
  const artists = Object.keys(sugg.artists).sort((a, b) => a.localeCompare(b, 'en')).map(name => {
    const s = sugg.artists[name];
    const row = bySum[name] || {};
    const formats = {};
    fmtKeys.forEach(k => { formats[k] = num(row['n_' + k]) || 0; });
    return {
      name: name,
      urls: String(s.store_urls || row.store_urls || '').split(' | ').map(u => u.trim()).filter(Boolean),
      operator: row.operators || '',
      currency: row.currency || '',
      products: num(row.products) || s.products || 0,
      music: num(row.music_products) || 0,
      merch: num(row.merch_products) || 0,
      formats: formats,
      signed: num(row.signed) || 0,
      colored: num(row.colored_vinyl) || 0,
      exclusive: num(row.exclusive_limited) || 0,
      preorders: num(row.preorders) || 0,
      inStock: num(row.in_stock_pct),
      new90: num(row.new_last_90d) || 0,
      newest: row.newest_product || '',
      median: {
        vinyl: num(row.median_price_usd_vinyl),
        cd: num(row.median_price_usd_cd),
        tee: num(row.median_price_usd_tee),
        hoodie: num(row.median_price_usd_hoodie),
        headwear: num(row.median_price_usd_headwear)
      },
      suggestions: (s.suggestions || []).map(sg => ({
        type: sg.type,
        group: groupOf(sg),
        text: sg.suggestion,
        reason: sg.reason,
        evidence: sg.evidence || {}
      })),
      recent: recentProducts(byStore[name])
    };
  });

  return {
    scraped: sugg.generated || stores.generated || '2026-10-27',
    label: 'From public artist store catalogs, scraped Oct 27, 2026',
    method: sugg.method || '',
    recentSince: CUTOFF,
    recentCap: RECENT_CAP,
    benchmarks: sugg.roster_benchmarks,
    artists: artists
  };
}

module.exports = { buildCatalog, parseCsv };
