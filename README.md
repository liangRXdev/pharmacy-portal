# Clinical Pharmacy Toolkit (個人臨床藥學工具集)

**English** | [繁體中文](README.zh-TW.md)

> Clinical Pharmacy Toolkit — by pharmacist Che-chia Liang (梁哲嘉)

A portal for clinical pharmacy tools, collecting my own clinical calculators, drug-safety analysis tools, government database lookups and in-hospital support tools. The site is in Traditional Chinese.

🔗 **Live Site**: [pharmacy-portal.liangrxdev.workers.dev](https://pharmacy-portal.liangrxdev.workers.dev)

## Tools

| Category | Tool | Description |
|------|------|------|
| Clinical calculation | [Bicarb Dosing Calculator](https://liangrxdev.github.io/bicarb-dosing-calc/) | NaHCO₃ replacement dose calculation |
| Clinical calculation | [Opioid Converter](https://liangrxdev.github.io/opioid-converter-zh/) | Opioid equianalgesic dose conversion |
| Clinical calculation | [Dopamine Dose Calculator](https://liangrxdev.github.io/dopamine-dose-calculator/) | Dopamine infusion rate calculation |
| Clinical calculation | [KDIGO AKI Staging](https://liangrxdev.github.io/kdigo-aki-stage/) | KDIGO acute kidney injury staging |
| Clinical calculation | [O₂ Cylinder Timer](https://liangrxdev.github.io/o2-cylinder-timer/) | Remaining-time estimate for a portable medical oxygen cylinder (3.4 L) |
| Clinical calculation | [Vancomycin AUC Calculator](https://liangrxdev.github.io/vanco-auc-calc/) | AUC-guided vancomycin dosing: empiric start, two-level (Sawchuk-Zaske), Bayesian AUC |
| EBM education | [Diagnostic Test EBM Calculator](https://liangrxdev.github.io/dx-ebm-calc/) | Likelihood ratio (LR) / Bayesian update / Fagan nomogram + test LR library |
| EBM education | [Treatment Effect EBM Calculator](https://liangrxdev.github.io/tx-ebm-calc/) | ARR/NNT/NNH/RRR + plain-language explanation + 100-person Cates plot |
| EBM education | [Critical Appraisal Training](https://liangrxdev.github.io/critical-appraisal-training-tw/) | CASP, RoB 2 and GRADE appraisal practice, answer comparison and instructor review |
| Drug safety | [FAERS Suspect Ranker](https://liangrxdev.github.io/faers-suspect-ranker/) | Ranks suspect drugs for an ADR in polypharmacy (ROR/PRR) |
| Drug safety | [Medication Safety Minesweeper](https://medication-safety-minesweeper.pages.dev/) | Training on actionable drug-related problems with synthetic cases: flag interactions on a drug-pair matrix, then get scored feedback |
| Government data | [TFDA Drug Info Search](https://liangrxdev.github.io/TFDA-drug-info-search/) | TFDA drug license lookup |
| Government data | [Pill Detective TW](https://liangrxdev.github.io/pill-detective-tw/) | Search TFDA drug appearance data by imprint, color, shape and score line |
| Government data | [TFDA Drug Shortage Dashboard](https://liangrxdev.github.io/TFDA-drug-shortage-dashboard/) | TFDA drug supply (shortage and alternatives) dashboard |
| Government data | [TFDA Drug Recall Dashboard](https://liangrxdev.github.io/TFDA-drug-recall-dashboard/) | TFDA drug recall dashboard |
| Government data | [TFDA Drug Identification Quiz](https://liangrxdev.github.io/TFDA-drug-id-quiz/) | Drug-appearance identification quiz built on the TFDA appearance dataset (3 levels + flashcards) |
| Government data | [NHI Drug Price History](https://liangrxdev.github.io/NHI-drug-price-history/) | Full NHI reimbursement price history by drug code since 1995, upcoming changes and side-by-side comparison |
| Government data | [Taiwan Clinical Trial Radar](https://taiwan-clinical-trial-radar.pages.dev/) | Search TFDA drug clinical-trial review records (no recruitment status) |
| In-hospital | IV Y-site compatibility lookup | Y-site compatibility check (GAS, in-hospital) |
| In-hospital | Antithrombotic hold/resume advice | Perioperative hold/resume timing (GAS, in-hospital) |
| In-hospital | In-hospital drug appearance & label lookup | Drug images and package inserts (GAS, in-hospital) |
| In-hospital | Multilingual medication instructions | Chinese → English / Vietnamese / Indonesian / Thai medication-instruction translation (GAS, in-hospital) |

## Architecture

```
pharmacy-portal/
├── public/                     ← The only deployed directory (wrangler.jsonc assets.directory; whitelist)
│   ├── index.html              ← Landing page (pure static; fetches tools.json and renders dynamically)
│   ├── tools.json              ← Tool list (single source of truth; adding a tool only needs this file)
│   ├── manifest.webmanifest    ← PWA install info (name "藥學工具", icons, theme color)
│   ├── sw.js                   ← Service worker (caches the landing shell only)
│   ├── _headers                ← Cloudflare security headers (CSP etc.)
│   ├── robots.txt / sitemap.xml
│   └── icons/                  ← App icons (Rx Tool, green background #2E4F4F)
├── tools/                      ← Repo scripts (gen-seo, checks); not deployed
└── .github/workflows/check.yml ← CI invariant checks
```

Only `public/` is uploaded as static assets, so `.git/`, `CLAUDE.md`, READMEs and scripts are never served. Put any new public file under `public/`.

### PWA (installable)

- Supports "Add to Home Screen" as a standalone app in full-screen `standalone` mode
- The service worker **caches only the landing shell** (`./` / `tools.json` / manifest / icons): the tool directory and search work offline; individual tools (GitHub Pages / in-hospital GAS) still need a connection. Navigations to `/` or `/index.html` (any query) are all served from the `./` cache key; `index.html` itself is not precached because Cloudflare 307-redirects it to `/`
- Any change to a shell file (`index.html` / `tools.json` / manifest / icons) requires bumping `CACHE` in `public/sw.js`; a new shell file must also be added to `SHELL`

- **Adding a tool**: edit `public/tools.json` → run `node tools/gen-seo.js` to regenerate JSON-LD and `sitemap.xml` → push to `main`; Cloudflare deploys automatically
- **SEO/GEO**: `<head>` contains description / canonical / Open Graph / Twitter Card and JSON-LD (`WebSite` + `Person` + `ItemList`); `robots.txt` (explicitly allows AI crawlers) + `sitemap.xml`. JSON-LD is an `application/ld+json` data block, not governed by CSP `script-src`, so no hash recompute is needed
- **Design system**: MUJI-style warm off-white (`#F5F0E8` / `#3D7A8A`), hand-written CSS, Noto Sans TC
- **Hosting**: Cloudflare Workers (automatic deploys via Git integration)
- **SW cache scope check**: `node tools/check-sw-cache-scope.js`. CacheStorage is shared per origin; if the service workers of the dozen-plus tools on `liangrxdev.github.io` lack a prefix guard, an update wipes the neighbors' offline caches — each repo's tests only see themselves, so this invariant can only be guarded by a cross-repo scan. **Run it whenever you add a PWA tool** (the script auto-discovers every `sw.js` under `projects/`; no registry needed)
- **CI checks** (`.github/workflows/check.yml`, also `node tools/check-portal.js` locally): `tools.json` parses; inline-script sha256 matches `_headers`; `gen-seo` output has no diff; shell changes without a `sw.js` `CACHE` bump fail
- **Security headers**: `public/_headers` provides CSP + HSTS etc.; CSP `script-src` uses sha256 hashes of inline scripts (recompute after editing a `<script>` in `public/index.html`; the command is in the `_headers` comments)

## tools.json Schema

```jsonc
{
  "id": "tool-id",           // unique identifier
  "name": "English Name",    // English name
  "nameZh": "中文名稱",       // Chinese name (card title)
  "description": "說明文字",   // short description
  "category": "clinical",     // clinical | ebm | adr | gov | internal
  "url": "https://...",       // tool link (null for in-hospital GAS tools)
  "repo": "https://...",      // public GitHub repo (null if none or private)
  "platform": "github-pages", // github-pages | cloudflare-pages | gas
  "status": "active",         // active | maintenance | deprecated
  "tags": ["tag1", "tag2"]    // search tags
}
```

## License

MIT
