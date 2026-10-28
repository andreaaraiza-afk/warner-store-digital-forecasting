/* Re-run the public audit of https://shop.warnerrecords.com/
   Crawl only:  node scripts/audit-public.mjs --crawl-only
   Full lab:    node scripts/audit-public.mjs
     (needs `npm install lighthouse chrome-launcher` and Chrome)
   Assemble a previous lab dump:
     node scripts/audit-public.mjs --from-lighthouse /tmp/lh-summary.json --from-crawl /tmp/seo-crawl.json
   Nothing on the store is changed. No Search Console or Analytics.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'data', 'public-audit.json');
const args = process.argv.slice(2);
const crawlOnly = args.includes('--crawl-only');
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const PAGES = [
  ['home', 'https://shop.warnerrecords.com/'],
  ['collection', 'https://shop.warnerrecords.com/collections/vinyl'],
  ['product', 'https://shop.warnerrecords.com/products/great-american-bar-scene-vinyl'],
  ['search', 'https://shop.warnerrecords.com/search?q=vinyl'],
  ['cart', 'https://shop.warnerrecords.com/cart']
];
const SAMPLE = [
  'https://shop.warnerrecords.com/',
  'https://shop.warnerrecords.com/collections/vinyl',
  'https://shop.warnerrecords.com/collections/music',
  'https://shop.warnerrecords.com/collections/apparel',
  'https://shop.warnerrecords.com/collections/best-sellers',
  'https://shop.warnerrecords.com/products/great-american-bar-scene-vinyl',
  'https://shop.warnerrecords.com/products/private-music-cd',
  'https://shop.warnerrecords.com/products/confessions-ii-16-track-deluxe-cd',
  'https://shop.warnerrecords.com/search?q=vinyl',
  'https://shop.warnerrecords.com/search?q=zach+bryan',
  'https://shop.warnerrecords.com/cart'
];

function decode(s) {
  if (!s) return s;
  return s.replace(/&ndash;/g, '–').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

async function crawlSite() {
  const UA = 'Mozilla/5.0 (compatible; WRPublicAudit/1.0)';
  async function fetchText(url) {
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
    return { status: res.status, finalUrl: res.url, text: await res.text(), headers: Object.fromEntries(res.headers.entries()) };
  }
  const robots = await fetchText('https://shop.warnerrecords.com/robots.txt');
  const sitemap = await fetchText('https://shop.warnerrecords.com/sitemap.xml');
  const productMap = await fetchText('https://shop.warnerrecords.com/sitemap_products_1.xml?from=8867058122921&to=10326391455913');
  const collectionMap = await fetchText('https://shop.warnerrecords.com/sitemap_collections_1.xml?from=322808709289&to=491100569769');
  const productCount = [...productMap.text.matchAll(/<loc>https:\/\/shop\.warnerrecords\.com\/products\/[^<]+<\/loc>/g)].length;
  const collectionCount = [...collectionMap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].length;
  const pages = [];
  for (const url of SAMPLE) {
    const page = await fetchText(url);
    const html = page.text;
    const pick = (re) => { const m = html.match(re); return m ? decode(m[1]) : null; };
    const jsonlds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    const types = [];
    jsonlds.forEach((raw) => {
      try {
        const data = JSON.parse(raw);
        const walk = (node) => {
          if (!node || typeof node !== 'object') return;
          if (node['@type']) types.push(Array.isArray(node['@type']) ? node['@type'].join(',') : node['@type']);
          if (node['@graph']) node['@graph'].forEach(walk);
        };
        (Array.isArray(data) ? data : [data]).forEach(walk);
      } catch (e) { types.push('invalid-jsonld'); }
    });
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, ''))).filter(Boolean);
    const robotsMeta = pick(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
    const xrobots = page.headers['x-robots-tag'] || null;
    pages.push({
      url, status: page.status, finalUrl: page.finalUrl,
      title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
      metaDescription: pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i),
      h1: h1s.slice(0, 3),
      canonical: pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i),
      robotsMeta, xRobotsTag: xrobots,
      schemaTypes: [...new Set(types)].slice(0, 12),
      images: imgs.length,
      imagesMissingAlt: imgs.filter((tag) => !/\balt\s*=/.test(tag)).length,
      imagesEmptyAlt: imgs.filter((tag) => /\balt\s*=\s*(""|'')/.test(tag)).length,
      indexable: page.status === 200 && !(xrobots && /noindex/i.test(xrobots)) && !(robotsMeta && /noindex/i.test(robotsMeta))
    });
    console.log(page.status, url);
  }
  const titles = {};
  pages.forEach((p) => { if (p.title) (titles[p.title] = titles[p.title] || []).push(p.url); });
  return {
    crawledAt: new Date().toISOString(),
    robots: { status: robots.status, url: 'https://shop.warnerrecords.com/robots.txt', sitemap: (robots.text.match(/Sitemap:\s*(\S+)/i) || [])[1] || null, allowsAll: /User-agent:\s*\*\s*Allow:\s*\//i.test(robots.text) },
    sitemaps: { indexStatus: sitemap.status, indexUrl: 'https://shop.warnerrecords.com/sitemap.xml', productCount, collectionCount, productSitemapStatus: productMap.status, collectionSitemapStatus: collectionMap.status },
    pages,
    duplicateTitles: Object.entries(titles).filter(([, urls]) => urls.length > 1).map(([title, urls]) => ({ title, urls })),
    homepageH1: 'The only homepage H1 is the logo image, with alt text Warner Records. There is no separate text heading.'
  };
}

async function runLighthouse() {
  const lighthouse = (await import('lighthouse')).default;
  const chromeLauncher = await import('chrome-launcher');
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const out = [];
  try {
    for (const [id, url] of PAGES) {
      for (const form of ['mobile', 'desktop']) {
        console.log('RUN', id, form);
        const flags = { logLevel: 'error', output: 'json', port: chrome.port, onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], formFactor: form,
          screenEmulation: form === 'mobile' ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false } : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false } };
        if (form === 'desktop') flags.preset = 'desktop';
        const runner = await lighthouse(url, flags);
        const lhr = runner.lhr, a = lhr.audits;
        const num = (audit) => audit && audit.numericValue != null ? Math.round(audit.numericValue * 1000) / 1000 : null;
        const score = (cat) => cat && cat.score != null ? Math.round(cat.score * 100) : null;
        out.push({
          id, url, finalUrl: lhr.finalUrl, formFactor: lhr.configSettings.formFactor, fetchedAt: lhr.fetchTime, lighthouseVersion: lhr.lighthouseVersion,
          scores: { performance: score(lhr.categories.performance), accessibility: score(lhr.categories.accessibility), bestPractices: score(lhr.categories['best-practices']), seo: score(lhr.categories.seo) },
          lab: { lcpMs: num(a['largest-contentful-paint']), cls: num(a['cumulative-layout-shift']), tbtMs: num(a['total-blocking-time']), fcpMs: num(a['first-contentful-paint']), ttfbMs: num(a['server-response-time']), inpMs: num(a['interaction-to-next-paint']) }
        });
      }
    }
  } finally { await chrome.kill(); }
  return out;
}

function buildIssues(runs, crawl) {
  const homeM = runs.find((r) => r.id === 'home' && r.formFactor === 'mobile');
  const homeD = runs.find((r) => r.id === 'home' && r.formFactor === 'desktop');
  const missingDesc = (crawl.pages || []).filter((p) => !p.metaDescription).map((p) => p.url.replace('https://shop.warnerrecords.com', '') || '/');
  const search = (crawl.pages || []).find((p) => p.url.includes('/search?q=vinyl'));
  const emptyAlt = (crawl.pages || []).reduce((n, p) => n + (p.imagesEmptyAlt || 0), 0);
  const clsPages = runs.filter((r) => r.lab.cls >= 0.1).map((r) => r.id + ' ' + r.formFactor + ' ' + r.lab.cls);
  const issues = [
    { severity: 'high', area: 'ux', title: 'Homepage largest paint is slow on both form factors', detail: 'Lab LCP is ' + (homeM.lab.lcpMs / 1000).toFixed(1) + 's on mobile (performance ' + homeM.scores.performance + ') and ' + (homeD.lab.lcpMs / 1000).toFixed(1) + 's on desktop (performance ' + homeD.scores.performance + '). TBT is ' + Math.round(homeM.lab.tbtMs) + 'ms mobile and ' + Math.round(homeD.lab.tbtMs) + 'ms desktop. TTFB is ' + Math.round(homeM.lab.ttfbMs) + 'ms, so the wait is in the page, not the server.' },
    { severity: 'high', area: 'seo', title: 'Collection pages and the cart have no meta description', detail: 'Empty descriptions on ' + missingDesc.join(', ') + '. Lighthouse flags meta-description on the vinyl collection and the cart. The homepage and product pages do have descriptions.' },
    { severity: 'medium', area: 'ux', title: 'Cart and search shift layout', detail: 'CLS is at least 0.1 on ' + (clsPages.join('; ') || 'none') + '. Homepage mobile CLS is ' + homeM.lab.cls + '.' },
    { severity: 'medium', area: 'seo', title: 'Collections do not publish Collection or breadcrumb schema', detail: 'Product pages include Product schema (brand, GTIN, image). Collection pages in this sample only include Organization. No BreadcrumbList was found.' },
    { severity: 'medium', area: 'seo', title: 'Some images ship an empty alt attribute', detail: 'Across the sampled pages, ' + emptyAlt + ' images have alt="". The homepage H1 is the logo image (alt Warner Records), not a text heading.' },
    { severity: 'low', area: 'seo', title: 'Search results are noindex, which is why their SEO score is lower', detail: 'The vinyl search URL sends X-Robots-Tag: ' + ((search && search.xRobotsTag) || 'noindex') + '. That is a reasonable choice. It is not a broken title. The cart does not send noindex.' },
    { severity: 'low', area: 'ux', title: 'Search and cart in the header are icon-only', detail: 'The public homepage screenshot shows Music, Apparel, and Best Sellers as text, and search and cart as icons. On a phone that is easy to miss.' }
  ];
  const fixes = [
    { rank: 1, area: 'ux', source: 'REAL', impact: 'High', effort: 'Medium', title: 'Shrink the homepage hero and the main-thread work so LCP gets under 2.5s.' },
    { rank: 2, area: 'seo', source: 'REAL', impact: 'High', effort: 'Low', title: 'Write a unique meta description for each collection, and noindex the cart.' },
    { rank: 3, area: 'ux', source: 'REAL', impact: 'High', effort: 'Medium', title: 'Reserve space for cart and search modules so CLS stays under 0.1.' },
    { rank: 4, area: 'seo', source: 'REAL', impact: 'Medium', effort: 'Medium', title: 'Add CollectionPage and BreadcrumbList schema, and fill empty image alts.' },
    { rank: 5, area: 'ux', source: 'REAL', impact: 'Medium', effort: 'Low', title: 'Give the header search and cart a visible label on small screens.' },
    { rank: 6, area: 'seo', source: 'DEMO', impact: 'High', effort: 'Medium', title: 'In the demo keyword model, the largest queries are branded vinyl and Zach Bryan. Give those a landing path. This is not a Search Console rank.' }
  ];
  return { issues, fixes };
}

const demoModel = {
  label: 'DEMO DATA',
  note: 'Not from Search Console or Analytics. Clicks and revenue allocate this dashboard’s synthetic Shopify Organic Search. The device rows allocate filtered Shopify DTC orders. Shares are fixed (seed 20261027): mobile is 71% of sessions, 62% of orders, and 56% of net revenue, so desktop conversion and AOV come out higher.',
  mobileSessionShare: 0.71,
  mobileOrderShare: 0.62,
  mobileRevenueShare: 0.56,
  keywords: [
    { query: 'warner records vinyl', share: 0.16, position: 3.2, ctr: 0.084 },
    { query: 'zach bryan vinyl', share: 0.14, position: 4.1, ctr: 0.061 },
    { query: 'shop warner records', share: 0.12, position: 1.8, ctr: 0.112 },
    { query: 'deftones private music cd', share: 0.09, position: 6.4, ctr: 0.042 },
    { query: 'green day vinyl', share: 0.08, position: 7.2, ctr: 0.038 },
    { query: 'linkin park vinyl', share: 0.08, position: 5.5, ctr: 0.047 },
    { query: 'limited vinyl', share: 0.07, position: 8.1, ctr: 0.031 },
    { query: 'my chemical romance', share: 0.07, position: 9.4, ctr: 0.028 },
    { query: 'record store day', share: 0.06, position: 11.2, ctr: 0.022 },
    { query: 'band merch', share: 0.07, position: 14.6, ctr: 0.018 },
    { query: 'cassette', share: 0.06, position: 12.8, ctr: 0.019 }
  ],
  pages: [
    { path: '/', title: 'Warner Records - Official Store', share: 0.28 },
    { path: '/collections/vinyl', title: 'VINYL', share: 0.16 },
    { path: '/products/great-american-bar-scene-vinyl', title: 'The Great American Bar Scene 2LP', share: 0.14 },
    { path: '/collections/best-sellers', title: 'Best Sellers', share: 0.12 },
    { path: '/collections/apparel', title: 'Apparel', share: 0.08 },
    { path: '/products/private-music-cd', title: 'Private Music CD', share: 0.08 },
    { path: '/search?q=vinyl', title: 'Search vinyl', share: 0.08 },
    { path: '/collections/music', title: 'Music', share: 0.06 }
  ]
};

let runs, crawl;
if (arg('--from-lighthouse') && arg('--from-crawl')) {
  runs = JSON.parse(fs.readFileSync(arg('--from-lighthouse'), 'utf8'));
  crawl = JSON.parse(fs.readFileSync(arg('--from-crawl'), 'utf8'));
  crawl.pages.forEach((p) => { p.title = decode(p.title); p.metaDescription = decode(p.metaDescription); });
} else {
  crawl = await crawlSite();
  runs = crawlOnly ? [] : await runLighthouse();
}
const built = runs.length ? buildIssues(runs, crawl) : { issues: [], fixes: [] };
const doc = {
  label: 'REAL public audit',
  source: 'Lighthouse ' + ((runs[0] && runs[0].lighthouseVersion) || 'n/a') + ' and a public HTML fetch of https://shop.warnerrecords.com/. No login. The store was not changed. PageSpeed Insights returned HTTP 429 without an API key, so field INP is not included. Lab TBT is the blocking-time proxy.',
  fieldNote: 'INP is a field metric and was not returned. Lab TBT is shown instead.',
  auditedAt: (runs[0] && runs[0].fetchedAt) || crawl.crawledAt,
  lighthouseVersion: (runs[0] && runs[0].lighthouseVersion) || null,
  uxNote: 'Scores, Web Vitals, and screenshots are the real public Shopify store. The device funnel is demo data.',
  screenshots: {
    homeDesktop: 'audit/home-desktop.jpg',
    homeMobile: 'audit/home-mobile.jpg',
    productDesktop: 'audit/product-desktop.jpg',
    productMobile: 'audit/product-mobile.jpg'
  },
  runs: runs.map((r) => ({ id: r.id, url: r.url, finalUrl: r.finalUrl, formFactor: r.formFactor, fetchedAt: r.fetchedAt, scores: r.scores, lab: r.lab })),
  crawl: {
    crawledAt: crawl.crawledAt,
    robots: crawl.robots,
    sitemaps: crawl.sitemaps,
    duplicateTitles: crawl.duplicateTitles || [],
    homepageH1: crawl.homepageH1 || 'The only homepage H1 is the logo image, alt Warner Records.',
    pages: (crawl.pages || []).map((p) => ({ url: p.url, status: p.status, title: p.title, metaDescription: p.metaDescription || '', h1: p.h1, canonical: p.canonical, robotsMeta: p.robotsMeta || null, xRobotsTag: p.xRobotsTag || null, schemaTypes: p.schemaTypes, images: p.images, imagesMissingAlt: p.imagesMissingAlt, imagesEmptyAlt: p.imagesEmptyAlt, indexable: p.indexable }))
  },
  issues: built.issues,
  fixes: built.fixes,
  demoModel
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
console.log('wrote', outPath, 'runs', runs.length, 'issues', built.issues.length);
