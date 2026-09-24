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
| Clinical calculation | [Diagnostic Test EBM Calculator](https://liangrxdev.github.io/dx-ebm-calc/) | Likelihood ratio (LR) / Bayesian update / Fagan nomogram + test LR library |
| Clinical calculation | [Treatment Effect EBM Calculator](https://liangrxdev.github.io/tx-ebm-calc/) | ARR/NNT/NNH/RRR + plain-language explanation + 100-person Cates plot |
| Drug safety | [FAERS Suspect Ranker](https://liangrxdev.github.io/faers-suspect-ranker/) | Ranks suspect drugs for an ADR in polypharmacy (ROR/PRR) |
| Government data | [TFDA Drug Info Search](https://liangrxdev.github.io/TFDA-drug-info-search/) | TFDA drug license lookup |
| Government data | [Pill Detective TW](https://liangrxdev.github.io/pill-detective-tw/) | Search TFDA drug appearance data by imprint, color, shape and score line |
| Government data | [TFDA Drug Shortage Dashboard](https://liangrxdev.github.io/TFDA-drug-shortage-dashboard/) | TFDA drug supply (shortage and alternatives) dashboard |
| Government data | [TFDA Drug Recall Dashboard](https://liangrxdev.github.io/TFDA-drug-recall-dashboard/) | TFDA drug recall dashboard |
| In-hospital | IV Y-site compatibility lookup | Y-site compatibility check (GAS, in-hospital) |
| In-hospital | Antithrombotic hold/resume advice | Perioperative hold/resume timing (GAS, in-hospital) |
| In-hospital | In-hospital drug appearance & label lookup | Drug images and package inserts (GAS, in-hospital) |
| In-hospital | Multilingual medication instructions | Chinese → English / Vietnamese / Indonesian / Thai medication-instruction translation (GAS, in-hospital) |

## Architecture

```
pharmacy-portal/
├── index.html              ← Landing page (pure static; fetches tools.json and renders dynamically)
├── tools.json              ← Tool list (single source of truth; adding a tool only needs this file)
├── manifest.webmanifest    ← PWA install info (name "藥學工具", icons, theme color)
├── sw.js                   ← Service worker (caches the landing shell only)
└── icons/                  ← App icons (Rx Tool, green background #2E4F4F)
```

### PWA (installable)

- Supports "Add to Home Screen" as a standalone app in full-screen `standalone` mode
- The service worker **caches only the landing shell** (`index.html` / `tools.json` / icons): the tool directory and search work offline; individual tools (GitHub Pages / in-hospital GAS) still need a connection
- After editing a `<script>` in `index.html` you only need to recompute the CSP hash, not touch `sw.js`; but adding a new shell file requires updating the `SHELL` list and `CACHE` version in `sw.js`

- **Adding a tool**: edit `tools.json` → (if SEO needs updating) run `node tools/gen-seo.js` to regenerate JSON-LD and `sitemap.xml` → push to `main`; Cloudflare deploys automatically
- **SEO/GEO**: `<head>` contains description / canonical / Open Graph / Twitter Card and JSON-LD (`WebSite` + `Person` + `ItemList`); `robots.txt` (explicitly allows AI crawlers) + `sitemap.xml`. JSON-LD is an `application/ld+json` data block, not governed by CSP `script-src`, so no hash recompute is needed
- **Design system**: MUJI-style warm off-white (`#F5F0E8` / `#3D7A8A`), hand-written CSS, Noto Sans TC
- **Hosting**: Cloudflare Workers (automatic deploys via Git integration)
- **SW cache scope check**: `node tools/check-sw-cache-scope.js`. CacheStorage is shared per origin; if the service workers of the dozen-plus tools on `liangrxdev.github.io` lack a prefix guard, an update wipes the neighbors' offline caches — each repo's tests only see themselves, so this invariant can only be guarded by a cross-repo scan. **Run it whenever you add a PWA tool** (the script auto-discovers every `sw.js` under `projects/`; no registry needed)
- **Security headers**: `_headers` provides CSP + HSTS etc.; CSP `script-src` uses sha256 hashes of inline scripts (recompute after editing a `<script>` in `index.html`; the command is in the `_headers` comments)

## tools.json Schema

```jsonc
{
  "id": "tool-id",           // unique identifier
  "name": "English Name",    // English name
  "nameZh": "中文名稱",       // Chinese name (card title)
  "description": "說明文字",   // short description
  "category": "clinical",     // clinical | adr | gov | internal
  "url": "https://...",       // tool link (null for in-hospital GAS tools)
  "repo": "https://...",      // GitHub repo (null if none)
  "platform": "github-pages", // github-pages | gas
  "status": "active",         // active | maintenance | deprecated
  "tags": ["tag1", "tag2"]    // search tags
}
```

## License

MIT
