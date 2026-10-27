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

## Build
From the repo root, with Node.js installed (no `npm install`; there are no dependencies beyond the vendored Chart.js):

```bash
node build.js
```

That reads `src/` (`index.html`, `styles.css`, `datagen.js`, `app.js`) and `vendor/chart.umd.min.js`, then writes:

- `dist/index.html` — single page with Chart.js, the generator and the app inlined
- `dist/data.json` — daily aggregate export
- `dist/.nojekyll` — so a static host does not run Jekyll on the page

The generator is deterministic (seed `20261027`, range ending 2026-10-27), so a rebuild reproduces the same dataset.

## GitHub Pages
`.github/workflows/pages.yml` publishes the committed `dist/` folder to GitHub Pages on pushes to `main` (and on manual dispatch). This repository is private. GitHub Pages on a private repo needs a plan that includes it (GitHub Pro, Team, or Enterprise); on a free private repo the workflow will not produce a public site until Pages is enabled. Treat the workflow as optional and do not depend on it. Opening `dist/index.html` locally, or the DigitalOcean static site in `.do/app.yaml`, does not require Pages.

## DigitalOcean App Platform
`.do/app.yaml` is a static site spec that serves `dist/` (`index_document: index.html`) from this repo's `main` branch.
