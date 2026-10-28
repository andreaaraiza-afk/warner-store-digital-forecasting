# Warner Records Store: Performance Dashboard (DEMO DATA)

This is an interactive single-page dashboard covering Shopify DTC plus **Amazon US/UK/DE**, organic social, paid media (Google, Meta, TikTok, Amazon Sponsored Products), CRM (Klaviyo-style email and SMS) and a 90-day forecast.

> **DEMO DATA.** Every sales, traffic, ad, CRM and Amazon figure is synthetic, generated with a fixed seed (20261027) over 2025-05-01 → 2026-10-27. Product titles, artists, formats and price points are modeled on the public catalog at shop.warnerrecords.com. These are not real store results.

## Open it locally
- From the repo root, open `dist/index.html` in a browser. It is fully self-contained: Chart.js, the data generator and the app are all inlined, so `file://` works (double-click the file, or run `xdg-open dist/index.html` / `open dist/index.html`). You can also serve the `dist/` folder from any static host.
- It works offline apart from Google Fonts, which falls back to system fonts.
- "Download data (JSON)" in the footer exports the daily aggregates. `dist/data.json` is the same export.
- Screenshots of the demo (filters, Amazon marketplaces, organic social, forecast) are in `screenshots/`.

## Features
- **Storefront filter** (All / Shopify DTC / Amazon all / Amazon US / UK / DE). It applies to KPIs, charts, product tables, insights and the forecast. Channel and region options that don't fit the selected storefront are disabled. CRM always shows DTC data and labels itself as DTC-only.
- **Organic Social channel**: the session referrer is Instagram, TikTok, YouTube, Facebook or X, with no paid UTM, no ad click ID and no affiliate or creator ref. Per-platform breakdown, a daily stacked chart showing share of DTC, and insights covering top platform, top artist, new-customer share and implied CAC value.
- **Amazon section**: revenue by marketplace, units, Amazon fees (referral 15% media / 17% apparel, FBA per unit, $1.80 media closing fee), net proceeds, Sponsored ads spend, ROAS/ACoS/TACoS, FBA on-hand and top products.
- Categories: Vinyl LPs, Colored & Limited Vinyl, Signed & Store Exclusives, CDs, Cassettes & 7" Singles, Box Sets & Deluxe, Apparel, Accessories & Posters, Bundles.
- Seasonality: BFCM and the holiday season, Record Store Day (April, plus the RSD Black Friday drop in November), Prime Day / Prime Big Deal Days on Amazon, album release and pre-order spikes, an MCR tour lift and a viral sombr TikTok moment (Oct 2026).
- **Generate report**: the header button builds a monthly analysis from the dashboard numbers and the current storefront, channel, and category. The default period is the last full month; this month to date, the last 30 or 90 days, and a custom range are also available. The report header lists Warner Records Store, those filters (All when unset), and the date range, and it updates when you change them. Sections can be toggled and reordered. Audience (executive, marketing, detailed), top-item count, inline edits, and notes are kept when you regenerate. Export stays in the browser: print to PDF, download HTML or Markdown, or copy formatted HTML plus plain text. Open email draft opens a Gmail compose tab with no recipient and does not send. Presets are saved in localStorage. Sales sections stay labeled DEMO DATA. Product suggestions inside the report stay labeled as the public catalog.
- **Audio summary**: an editable host-style script of the current report. Play and pause use the browser speech API. Download audio builds a WAV on the device (no API key and no upload). Email audio summary opens a Gmail draft with the script highlights and a link to the hosted default last-full-month file, `wr-store-audio-summary.wav`. If the draft is for a different cut, attach the downloaded WAV. Nothing is sent automatically.
- **Product suggestions** (public catalog, not demo data): artist search and picker, suggestion cards with the reason and evidence, grouped into missing formats, merch types to add, pricing gaps, bundles, signed or colored vinyl, trending items, restock, and catalog freshness. The roster view charts format adoption, median USD prices, and formats added in the last 90 days, and links recent products to their store pages. Labeled "From public artist store catalogs, scraped Oct 27, 2026". The storefront, date, category, channel, and region filters apply to the synthetic sections only.

## Build
From the repo root, with Node.js installed (no `npm install`; there are no dependencies beyond the vendored Chart.js):

```bash
node build.js
```

That reads `src/` (`index.html`, `styles.css`, `datagen.js`, `tts.js`, `report.js`, `app.js`), `vendor/chart.umd.min.js`, `audio/default-script.txt` when present, and `data/` (suggestions, the per-artist summary, and the full public product feed), then writes:

- `dist/index.html` — single page with Chart.js, the generator, the report builder, a local speech synthesizer, a trimmed public catalog, and the app inlined
- `dist/wr-store-audio-summary.wav` — spoken default last-full-month report (all storefronts), from `audio/default-script.txt`
- `dist/data.json` — daily aggregate export of the synthetic dataset
- `dist/.nojekyll` — so a static host does not run Jekyll on the page

The sales generator is deterministic (seed `20261027`, range ending 2026-10-27). The catalog trim keeps roster benchmarks, all 358 suggestions, and up to 12 newest products per artist from the last 90 days (with store URLs) instead of embedding the full product feed.

## GitHub Pages
`.github/workflows/pages.yml` publishes the committed `dist/` folder to GitHub Pages on pushes to `main` (and on manual dispatch). The live site is https://andreaaraiza-afk.github.io/warner-store-digital-forecasting/ . This repository is private; Pages on a private repo needs a plan that includes it (GitHub Pro, Team, or Enterprise). That plan is enabled here, so a push to `main` redeploys the dashboard. Opening `dist/index.html` locally does not require Pages.

## DigitalOcean App Platform
`.do/app.yaml` is a static site spec that serves `dist/` (`index_document: index.html`) from this repo's `main` branch.
