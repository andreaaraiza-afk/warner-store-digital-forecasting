# Warner Records Store: Performance Dashboard (DEMO DATA)

This is an interactive single-page dashboard covering Shopify DTC plus **Amazon US/UK/DE**, organic social, paid media (Google, Meta, TikTok, Amazon Sponsored Products), CRM (Klaviyo-style email and SMS) and a 90-day forecast.

> **DEMO DATA.** Every sales, traffic, ad, CRM and Amazon figure is synthetic, generated with a fixed seed (20261027) over 2025-05-01 → 2026-10-27. Product titles, artists, formats and price points are modeled on the public catalog at shop.warnerrecords.com. These are not real store results.

## Open it locally
- From the repo root, open `dist/index.html` in a browser. It is fully self-contained: Chart.js, the data generator and the app are all inlined, so `file://` works (double-click the file, or run `xdg-open dist/index.html` / `open dist/index.html`). You can also serve the `dist/` folder from any static host.
- It works offline apart from Google Fonts, which falls back to system fonts.
- "Download data (JSON)" in the footer exports the daily aggregates. `dist/data.json` is the same export.
- Screenshots of the demo (filters, Amazon marketplaces, organic social, forecast) are in `screenshots/`.

## Features
- **Insights and suggestions** sit beside each section on a wide screen and stack under it on a narrow one. Overview, organic search, affiliate, direct, organic social, paid, CRM, Amazon, products, inventory, forecast, product suggestions, SEO, and UX each have an Insights card and a Suggestions card. A short highlight at the top (a sentence, plus jump links) replaces the old full-width insight list. DEMO, REAL, and PUBLIC labels stay on the cards they describe.
- **Storefront filter** (All / Shopify DTC / Amazon all / Amazon US / UK / DE). It applies to KPIs, charts, product tables, insights and the forecast. Channel and region options that don't fit the selected storefront are disabled. CRM always shows DTC data and labels itself as DTC-only.
- **Organic Social channel**: the session referrer is Instagram, TikTok, YouTube, Facebook or X, with no paid UTM, no ad click ID and no affiliate or creator ref. Per-platform breakdown, a daily stacked chart showing share of DTC, and insights covering top platform, top artist, new-customer share and implied CAC value.
- **Amazon section**: revenue by marketplace, units, Amazon fees (referral 15% media / 17% apparel, FBA per unit, $1.80 media closing fee), net proceeds, Sponsored ads spend, ROAS/ACoS/TACoS, FBA on-hand and top products.
- Categories: Vinyl LPs, Colored & Limited Vinyl, Signed & Store Exclusives, CDs, Cassettes & 7" Singles, Box Sets & Deluxe, Apparel, Accessories & Posters, Bundles.
- Seasonality: BFCM and the holiday season, Record Store Day (April, plus the RSD Black Friday drop in November), Prime Day / Prime Big Deal Days on Amazon, album release and pre-order spikes, an MCR tour lift and a viral sombr TikTok moment (Oct 2026).
- **Generate report**: the header button builds a monthly analysis from the dashboard numbers and the current storefront, channel, and category. The default period is the last full month; this month to date, the last 30 or 90 days, and a custom range are also available. The report header lists Warner Records Store, those filters (All when unset), and the date range, and it updates when you change them. Sections can be toggled and reordered. Audience (executive, marketing, detailed), top-item count, inline edits, and notes are kept when you regenerate. Export stays in the browser: print to PDF, download HTML or Markdown, or copy formatted HTML plus plain text. Open email draft copies that same layout (inline, email-safe HTML, including the chart) and opens a Gmail compose tab with the subject only and no recipient. A prompt tells you to paste with Cmd+V or Ctrl+V. Nothing is sent automatically. Presets are saved in localStorage. Sales sections stay labeled DEMO DATA. Each report section ends with its own Insights and Suggestions cards, including in the PDF, HTML, Markdown, copy, and Gmail paste. Catalog gaps that used to live in a separate recommendations section now sit with products and artists. Product suggestions inside the report stay labeled as the public catalog.
- **Audio recap**: the pasted draft has a “Listen to the audio recap” button. It opens `recap.html` on this site, with play, pause, 15-second skip, a scrubber, and playback speed. The voice is Kokoro (`af_heart`), an open-source neural TTS, pre-rendered for last full month with all channels for all storefronts, Shopify, and Amazon. A different period or filter uses the closest of those three, and the draft says so.
- **SEO and UX** (mixed labels): Lighthouse lab scores for mobile and desktop on the homepage, vinyl collection, a product page, search, and cart, plus an on-page crawl (titles, descriptions, H1s, canonicals, schema, alt text, robots.txt, sitemaps). Those are real public observations of shop.warnerrecords.com. Keyword rankings, impressions, and the mobile versus desktop conversion and AOV split are demo data allocated from the synthetic Organic Search and Shopify DTC totals. Re-run with `node scripts/audit-public.mjs` (Lighthouse optional). A monthly GitHub Action uploads a fresh audit artifact.
- **Product suggestions** (public catalog, not demo data): artist search and picker, suggestion cards with the reason and evidence, grouped into missing formats, merch types to add, pricing gaps, bundles, signed or colored vinyl, trending items, restock, and catalog freshness. The roster view charts format adoption, median USD prices, and formats added in the last 90 days, and links recent products to their store pages. Labeled "From public artist store catalogs, scraped Oct 27, 2026". The storefront, date, category, channel, and region filters apply to the synthetic sections only.

## Build
From the repo root, with Node.js installed (no `npm install`; there are no dependencies beyond the vendored Chart.js):

```bash
node build.js
```

That reads `src/` (`index.html`, `styles.css`, `datagen.js`, `report.js`, `app.js`, `recap.html`), `vendor/chart.umd.min.js`, `audio/` (pre-rendered Kokoro MP3s, `manifest.json`, and the play icon), and `data/` (suggestions, the per-artist summary, and the full public product feed), then writes:

- `dist/index.html` — single page with Chart.js, the generator, the report builder, a trimmed public catalog, and the app inlined
- `dist/recap.html` — hosted audio player
- `dist/audio/` — the MP3 recaps and play icon
- `dist/data.json` — daily aggregate export of the synthetic dataset
- `dist/.nojekyll` — so a static host does not run Jekyll on the page

The recaps are generated ahead of time with Kokoro (`af_heart`) and committed, because the Pages job only publishes `dist/` and a neural-model download would make that deploy fragile. `node scripts/render-recaps.mjs` regenerates them when the scripts change (it expects `kokoro-js` installed and `ffmpeg` on the path).

The sales generator is deterministic (seed `20261027`, range ending 2026-10-27). The catalog trim keeps roster benchmarks, all 358 suggestions, and up to 12 newest products per artist from the last 90 days (with store URLs) instead of embedding the full product feed.

## Private Pages deploy
`.github/workflows/pages.yml` encrypts `dist/index.html` and `dist/recap.html` with StatiCrypt (AES-256) before upload. The password is the Actions secret `DASHBOARD_PASSWORD`. The job reads that secret and does not print it. If the secret is empty, the job stops before upload, so a previous deployment is left as-is.

The published artifact is only the password pages, `robots.txt` (`Disallow: /`), and `.nojekyll`. Raw `data.json`, MP3 recaps, the audio manifest, and the SEO/UX screenshots are not uploaded. Audit images are inlined into the encrypted dashboard, and the three recap MP3s are inlined into the encrypted player, so they play after the password is entered. "Remember me" lasts 30 days in this browser. Both the password page and the decrypted pages send `noindex`.

This git repository is public, so the source, `dist/`, and `data/public-audit.json` are readable without the password. Free GitHub Pages cannot serve a private repository. For a login per person, use GitHub Enterprise private Pages, Cloudflare Pages with Cloudflare Access (email allowlist), or the DigitalOcean App Platform spec in `.do/app.yaml` behind authentication.

## GitHub Pages
The live URL is https://andreaaraiza-afk.github.io/warner-store-digital-forecasting/ . Opening `dist/index.html` locally does not ask for the Pages password.

## DigitalOcean App Platform
`.do/app.yaml` is a static site spec that serves `dist/` (`index_document: index.html`) from this repo's `main` branch.
