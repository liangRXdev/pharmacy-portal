# pharmacy-portal — 專案規則

臨床藥學工具集入口站。單頁 PWA，無建置流程，部署於 Cloudflare Workers Static Assets。

---

## 架構

- `index.html` — 整站唯一頁面，CSS 與 JS 皆行內
- `tools.json` — 工具清單資料源（分類、URL、狀態、tags），新增工具改這裡
- `sw.js` — 只快取入口 shell；外部工具（github.io、GAS）與 Google Fonts 一律走網路
- `_headers` — Cloudflare 安全標頭，含 CSP
- `tools/gen-seo.js` — 由 tools.json 產生 SEO 檔案

## 三個會咬人的地方

1. **改 `index.html` 的 `<script>` 內容 → 必須重算 CSP hash**，否則整段 JS 被擋下。
   ```bash
   node -e "const fs=require('fs'),c=require('crypto');const m=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/);console.log('sha256-'+c.createHash('sha256').update(m[1],'utf8').digest('base64'))"
   ```
   將結果寫回 `_headers` 的 `script-src`。

2. **改動 shell 檔案（index.html / tools.json / manifest / icons）→ 必須升 `sw.js` 的 `CACHE` 版本號**，否則舊快取不會更新。若新增 shell 靜態檔，同步加入 `SHELL` 陣列。

3. **新增工具 → 跑 `node tools/gen-seo.js`** 重生 sitemap 與結構化資料，否則 SEO 檔案與 tools.json 不同步。
   JSON-LD 是 `application/ld+json` data block，**不受 CSP `script-src` 管**，改它毋須重算 hash。

驗證線上版本時，Cloudflare 邊緣會 cache HIT 舊 HTML，需帶 `Cache-Control: no-cache` 才抓得到新版。

## 樣式慣例

- 內文字型 `Noto Sans TC`，等寬字型 `JetBrains Mono`（Google Fonts，CSP 已允許 fonts.googleapis.com / fonts.gstatic.com）
- CSS class 用 kebab-case（`site-header`、`tools-grid`、`category-bar`），非 BEM
- 新增外部資源前先確認 CSP 是否允許；`connect-src` 目前只有 `'self'`

## SEO 現況

Tier 1 已完成（meta / OG / JSON-LD / robots.txt / sitemap.xml）。Tier 2、3 未做。
