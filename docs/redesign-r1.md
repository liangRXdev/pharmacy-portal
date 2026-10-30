# R1 — 藥局建築與空間配置

此文件保留 R1 的實作與驗收範圍；後續已依使用者指示進入 [R2 五區辨識與配置](redesign-r2.md)。尚未部署。

## 本階段範圍

- 以單一開頂建築取代分散工作站的空間配置：連續樓板、後側與左側完整牆、右側與前側剖面矮牆。
- 後側為教學與臨床工作區，兩側為公開資料與用藥安全，前側為共用儲藥／調劑區。
- 中央入口、十字通道與開放隔間連通各區；Rx Hub 為中央工作島。
- 原有院內設備與工具終端移至兩側調劑櫃台，入口通道不放置工作站。
- 保留現有各區設備作為上下文；五區的進一步美術辨識與作業細節留待 R2、R3。
- 手機沿用簡化的藥品格數與既有 DPR 上限，維持同一棟建築輪廓。

## 實作邊界

`architecture.js` 僅負責建築與共用家具，繼續使用既有 geometry kit 的 geometry/material 批次與資源清理。
`scene-layout.js` 僅調整空間座標。未複製工具資料，未修改 routing、DOM、fallback、CSP、SW 或首頁載入方式。

Windows 的 smoke test 靜態伺服器改用 `path.sep` 判定目錄邊界；原有測試斷言均保留。

## 重現截圖

```powershell
npm.cmd ci
# 未安裝 Playwright Chromium 時，可使用本機 Chrome：
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
node tools/capture-pharmacy.mjs test-results/r1-review
```

截圖使用實際 WebGL 與 production `_headers`，桌面 viewport 1440×1100、手機 390×844。
`desktop-no-labels.png` 僅在截圖期間隱藏 DOM 分區標籤，無改變正式 UI。

驗收檔案：`desktop-scene.png`、`desktop-no-labels.png`、`mobile-overview.png`。

## 驗收門檻

由使用者確認：不依賴分區標籤，也能辨識為同一間完整醫院藥局；中央入口、調劑區與 Rx Hub 的關係清楚。
收到視覺確認後才進入 R2。

自動檢查：Three.js reproducibility、portal/CSP invariants、SEO 無差異、SW ownership，以及既有 pharmacy smoke suite。
手機截圖及 SwiftShader 測試不等同實機 GPU 效能或 Android 操作驗收。
