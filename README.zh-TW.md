# 個人臨床藥學工具集

[English](README.md) | **繁體中文**

> Clinical Pharmacy Toolkit — 梁哲嘉藥師

臨床藥學工具入口網站，彙整個人開發的各類臨床計算、藥物安全分析、政府資料庫查詢與院內輔助工具。

🔗 **Live Site**: [pharmacy-portal.liangrxdev.workers.dev](https://pharmacy-portal.liangrxdev.workers.dev)

## 收錄工具

| 分類 | 工具 | 說明 |
|------|------|------|
| 臨床計算 | [Bicarb Dosing Calculator](https://liangrxdev.github.io/bicarb-dosing-calc/) | NaHCO₃ 補充劑量計算 |
| 臨床計算 | [Opioid Converter](https://liangrxdev.github.io/opioid-converter-zh/) | 鴉片類藥物等效劑量換算 |
| 臨床計算 | [Dopamine Dose Calculator](https://liangrxdev.github.io/dopamine-dose-calculator/) | Dopamine 滴速計算 |
| 臨床計算 | [KDIGO AKI Staging](https://liangrxdev.github.io/kdigo-aki-stage/) | KDIGO 急性腎損傷分期 |
| 臨床計算 | [O₂ Cylinder Timer](https://liangrxdev.github.io/o2-cylinder-timer/) | 攜帶式醫用氧氣小鋼瓶（3.4 L）可用時間估算 |
| 臨床計算 | [Vancomycin AUC Calculator](https://liangrxdev.github.io/vanco-auc-calc/) | AUC 導向萬古黴素劑量：經驗起始、雙點反算（Sawchuk-Zaske）、Bayesian AUC |
| 實證教學 | [Diagnostic Test EBM Calculator](https://liangrxdev.github.io/dx-ebm-calc/) | 概似比(LR)/貝氏更新/Fagan nomogram + 檢驗 LR 速查庫 |
| 實證教學 | [Treatment Effect EBM Calculator](https://liangrxdev.github.io/tx-ebm-calc/) | ARR/NNT/NNH/RRR + 白話說明 + 百人效益圖 (Cates plot) |
| 實證教學 | [實證評讀練習室](https://liangrxdev.github.io/critical-appraisal-training-tw/) | CASP、RoB 2、GRADE 評讀練習、答案比對與指導者批改 |
| 藥物安全 | [FAERS Suspect Ranker](https://liangrxdev.github.io/faers-suspect-ranker/) | 多藥 ADR 嫌疑排序（ROR/PRR） |
| 藥物安全 | [用藥安全踩雷](https://medication-safety-minesweeper.pages.dev/) | 合成病例訓練辨識具臨床可行動性的用藥問題，於藥品配對矩陣插旗並計分解析 |
| 政府資料庫 | [TFDA Drug Info Search](https://liangrxdev.github.io/TFDA-drug-info-search/) | TFDA 藥品許可證查詢 |
| 政府資料庫 | [Pill Detective TW](https://liangrxdev.github.io/pill-detective-tw/) | 依刻字、顏色、形狀與刻痕搜尋 TFDA 藥品外觀資料 |
| 政府資料庫 | [TFDA Drug Shortage Dashboard](https://liangrxdev.github.io/TFDA-drug-shortage-dashboard/) | TFDA 藥品供應(缺藥替代)資訊儀表板 |
| 政府資料庫 | [TFDA Drug Recall Dashboard](https://liangrxdev.github.io/TFDA-drug-recall-dashboard/) | TFDA 藥品回收儀表板 |
| 政府資料庫 | [藥品辨識王](https://liangrxdev.github.io/TFDA-drug-id-quiz/) | 以 TFDA 藥品外觀資料集出題（三種難度＋閃卡模式） |
| 政府資料庫 | [健保藥價歷史查詢](https://liangrxdev.github.io/NHI-drug-price-history/) | 健保代號 1995 年至今支付價歷史、預告異動與並列比較 |
| 政府資料庫 | [台灣藥品臨床試驗檢索](https://taiwan-clinical-trial-radar.pages.dev/) | 檢索 TFDA 藥品臨床試驗審查紀錄（不提供招募狀態） |
| 院內工具 | IV 共用管路相容性查詢 | Y-site 相容性比對（GAS 院內） |
| 院內工具 | 抗血栓藥品停復藥建議 | 圍術期停藥/復藥時程（GAS 院內） |
| 院內工具 | 院內藥品外觀仿單查詢 | 藥品外觀圖片與仿單（GAS 院內） |
| 院內工具 | 用藥多語言轉換工具 | 中→英/越/印/泰用藥指示翻譯（GAS 院內） |

## 架構

```
pharmacy-portal/
├── public/                     ← 唯一部署目錄（wrangler.jsonc assets.directory；白名單）
│   ├── index.html              ← 入口頁（純靜態，fetch tools.json 動態渲染）
│   ├── tools.json              ← 工具清單（單一來源，新增工具僅需編輯此檔）
│   ├── manifest.webmanifest    ← PWA 安裝資訊（名稱「藥學工具」、圖示、主題色）
│   ├── sw.js                   ← Service Worker（僅快取入口 shell）
│   ├── _headers                ← Cloudflare 安全標頭（CSP 等）
│   ├── robots.txt / sitemap.xml
│   └── icons/                  ← App 圖示（Rx Tool，綠底 #2E4F4F）
├── tools/                      ← repo 腳本（gen-seo、檢查），不部署
└── .github/workflows/check.yml ← CI 不變量檢查
```

只有 `public/` 會上傳為靜態資產，`.git/`、`CLAUDE.md`、README 與腳本一律不對外。新增對外檔案請放進 `public/`。

### PWA（可安裝）

- 支援「加入主畫面」安裝為獨立 App，全螢幕 `standalone` 顯示
- Service Worker **僅快取入口 shell**（`./` / `tools.json` / manifest / 圖示）：離線可開工具總匯與搜尋；個別工具（GitHub Pages / GAS 院內）仍需連線。導覽 `/`、`/index.html`（含任意 query）一律以 `./` 為 cache key；不 precache `index.html`，因 Cloudflare 會將其 307 → `/`
- 任何 shell 檔（`index.html` / `tools.json` / manifest / 圖示）變動都必須升 `public/sw.js` 的 `CACHE`；新增 shell 檔另需加入 `SHELL`

- **新增工具**：編輯 `public/tools.json` → 執行 `node tools/gen-seo.js` 重生 JSON-LD 與 `sitemap.xml` → push 到 `main`，Cloudflare 自動部署
- **SEO/GEO**：`<head>` 含 description／canonical／Open Graph／Twitter Card 與 JSON-LD（`WebSite`+`Person`+`ItemList`）；`robots.txt`（明示放行 AI 爬蟲）＋ `sitemap.xml`。JSON-LD 為 `application/ld+json` data block，不受 CSP `script-src` 管，毋須重算 hash
- **設計系統**：MUJI 暖米白（`#F5F0E8` / `#3D7A8A`）、純手寫 CSS、Noto Sans TC
- **部署平台**：Cloudflare Workers（Git 整合自動部署）
- **SW 快取越界檢查**：`node tools/check-sw-cache-scope.js`。CacheStorage 是 origin 共用的，`liangrxdev.github.io` 上十幾個工具的 SW 若沒有前綴守衛，更新時會刪光鄰居的離線快取——每個 repo 的測試都只看得見自己，這個不變量只有跨 repo 掃描守得住。**新增 PWA 工具時跑一次**（腳本自動發現 `projects/` 下所有 `sw.js`，不必登錄清單）
- **CI 檢查**（`.github/workflows/check.yml`；本機可跑 `node tools/check-portal.js`）：`tools.json` 可解析、行內 script sha256 與 `_headers` 一致、`gen-seo` 產出無 diff、shell 變動但 `sw.js` 的 `CACHE` 未升即失敗
- **安全標頭**：`public/_headers` 提供 CSP + HSTS 等；CSP 的 `script-src` 用行內 script 的 sha256 hash（改 `public/index.html` 內 `<script>` 後需重算，指令見 `_headers` 註解）

## tools.json Schema

```jsonc
{
  "id": "tool-id",           // 唯一識別碼
  "name": "English Name",    // 英文名稱
  "nameZh": "中文名稱",       // 中文名稱（卡片主標題）
  "description": "說明文字",   // 簡述功能
  "category": "clinical",     // clinical | ebm | adr | gov | internal
  "url": "https://...",       // 工具連結（GAS 院內工具填 null）
  "repo": "https://...",      // 公開 GitHub repo（無或 private 則 null）
  "platform": "github-pages", // github-pages | cloudflare-pages | gas
  "status": "active",         // active | maintenance | deprecated
  "tags": ["tag1", "tag2"]    // 搜尋用標籤
}
```

## License

MIT

## 3D 藥局（Phase 2 美術）

`/pharmacy/` 是獨立的原生 ES module / Three.js 探索頁；首頁維持原有工具入口。
工具名稱、描述、連結與分類均讀取 `/tools.json`，`scene-layout.js` 僅保存空間配置。
分類按鈕、工具列表及手機詳情面板不依賴 WebGL；`?no3d=1` 可測試備援。
Phase 1 架構保留，場景已加入五區代表性家具、藥架與中央藥師；詳見 [Phase 2 美術與驗證紀錄](docs/phase2-art.md)。

```bash
npm ci
npm run build:three       # 更新已納入版本控制的 vendor bundle 與 MIT 授權
npm run check:three       # 逐 byte 驗證可重現性
node tools/check-portal.js
npx playwright install --with-deps chromium
npm run test:pharmacy
python3 -m http.server 8000 --directory public
```

若環境已有 Chromium，可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:pharmacy`。
一般靜態伺服器不會套用 `_headers`；smoke test 的內建伺服器會模擬路由 CSP 與 redirect。
CI 使用 Playwright 配對的 Chromium 與 ANGLE/SwiftShader，確認 `data-world="ready"`、非單色 framebuffer、
桌面與手機導覽、備援與首頁 zero-3D。產生的截圖在忽略的 `test-results/`。
Android Chrome 實機操作與 production Cloudflare CSP 單一標頭仍需人工／後續階段驗證。
