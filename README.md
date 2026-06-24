# 個人臨床藥學工具集

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
| 藥物安全 | [FAERS Suspect Ranker](https://liangrxdev.github.io/faers-suspect-ranker/) | 多藥 ADR 嫌疑排序（ROR/PRR） |
| 政府資料庫 | [TFDA Drug Info Search](https://liangrxdev.github.io/TFDA-drug-info-search/) | TFDA 藥品許可證查詢 |
| 政府資料庫 | [TFDA Drug Shortage Dashboard](https://liangrxdev.github.io/TFDA-drug-shortage-dashboard/) | TFDA 藥品供應(缺藥替代)資訊儀表板 |
| 政府資料庫 | [TFDA Drug Recall Dashboard](https://liangrxdev.github.io/TFDA-drug-recall-dashboard/) | TFDA 藥品回收儀表板 |
| 院內工具 | IV 共用管路相容性查詢 | Y-site 相容性比對（GAS 院內） |
| 院內工具 | 抗血栓藥品停復藥建議 | 圍術期停藥/復藥時程（GAS 院內） |
| 院內工具 | 院內藥品外觀仿單查詢 | 藥品外觀圖片與仿單（GAS 院內） |
| 院內工具 | 用藥多語言轉換工具 | 中→英/越/印/泰用藥指示翻譯（GAS 院內） |

## 架構

```
pharmacy-portal/
├── index.html    ← 入口頁（純靜態，fetch tools.json 動態渲染）
└── tools.json    ← 工具清單（單一來源，新增工具僅需編輯此檔）
```

- **新增工具**：編輯 `tools.json`，push 到 `main`，Cloudflare 自動部署
- **設計系統**：MUJI 暖米白（`#F5F0E8` / `#3D7A8A`）、純手寫 CSS、Noto Sans TC
- **部署平台**：Cloudflare Workers（Git 整合自動部署）
- **安全標頭**：`_headers` 提供 CSP + HSTS 等；CSP 的 `script-src` 用行內 script 的 sha256 hash（改 `index.html` 內 `<script>` 後需重算，指令見 `_headers` 註解）

## tools.json Schema

```jsonc
{
  "id": "tool-id",           // 唯一識別碼
  "name": "English Name",    // 英文名稱
  "nameZh": "中文名稱",       // 中文名稱（卡片主標題）
  "description": "說明文字",   // 簡述功能
  "category": "clinical",     // clinical | adr | gov | internal
  "url": "https://...",       // 工具連結（GAS 院內工具填 null）
  "repo": "https://...",      // GitHub repo（無則 null）
  "platform": "github-pages", // github-pages | gas
  "status": "active",         // active | maintenance | deprecated
  "tags": ["tag1", "tag2"]    // 搜尋用標籤
}
```

## License

MIT
