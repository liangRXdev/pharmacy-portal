# 3D Pharmacy UX 與視覺微調審閱

2026-10-30（Asia/Taipei）。基底為正式發布版本 `b86be04`。本地實作、驗證與審閱截圖已交付，依使用者指示提交至本機 Git；**尚未 push、merge 或部署**。

## UX 文案與 Rx Hub DOM

初始主要訊息改為「選擇工作區開始探索」及「藥師會帶你前往，抵達後即可查看工具。」；次要提示「也可以點選地面自由移動。」以較小字級、較低視覺權重呈現。沒有 modal tutorial 或阻擋操作的步驟。

沿用既有 `#explore` DOM 按鈕與 hub history view，入口文字為「Rx Hub · 關於作者」。藥師沿既有路線抵達 Hub 後，使用既有 `#detail` 介紹面板顯示語意化 article、作者姓名、角色、兩段短介紹、動態領域／工具總數與 GitHub CTA。作者資訊集中於 `identity.js`，也供本地 CanvasTexture 的作者帳號標示使用；工具清單仍只從 tools.json 讀取。

GitHub CTA 僅指向 `https://github.com/liangRXdev`，沿用 HTTPS-only safeLink，設定 `_blank` 與 `noopener noreferrer`，未新增 API／analytics／外部 logo 或 runtime 依賴。一般與 visited 樣式均使用白字／teal，對比為 **6.00:1**。

作者面板沿用非 modal DOM dialog。Hub 按鈕可鍵盤進入，aria-controls／aria-expanded 對應面板；GitHub link 可鍵盤聚焦。關閉按鈕返回全景並將焦點還給 Hub 入口；Escape 保留原有返回全景與 overview 焦點行為。Back／forward 恢復既有 hub view 與作者面板，未新增 hash 路由。

手機作者面板最高為 `min(40dvh, 320px)`，內容可捲動，GitHub CTA sticky 且至少 44px 高，關閉按鈕保持可操作；390×844 測試確認面板遮擋不超過 3D scene 的一半。此面板不複製完整專案清單，首頁仍是主要工具目錄。

## 材質與空間層次

- 保留目前樓板、區域配置、路線、停靠點、相機 preset、家具數量與原生 Three.js 結構。
- 以較有區別的暖灰地板、暖白牆面與淺木色建立建築層次；MeshStandardMaterial 的 roughness 依地板／木材／白色家具／Hub 區分，metalness 維持 0，不使用 gloss、bloom、chrome 或 PBR 貼圖組。
- Hub 使用較深的 muted teal 櫃身與獨立的木色基座，保持相同尺寸。既有螢幕改為程序繪製 HOME／Rx／liangRXdev／GitHub 圖樣，前側 Rx 標誌提升文字與背景對比，藥師與工作台仍清楚可見。
- 區域選取只調整地板：選取區域以小幅 emissive 提亮，其餘地板與中性色混合 22%；不改家具透明度、不模糊或遮隱其他區域。
- 既有藥架框體由約 1.75 提升至 2.0 場景單位，調整原有四層層板高度，沒有增加層數、藥盒或額外 props。保留低工作桌、中高度櫃台與高儲藏架的輪廓差異。
- 行走姿態包絡半徑仍為 `0.568969`，最小通道間隙仍為 `0.206031`（規格為 0.1）；桌機／手機障礙邊界數仍為 574／467，所有工具的實際 mesh 可見性檢查通過。

## 前後繪製數據

前版本取自仍未變更的正式站；後版本取自本地工作目錄。兩者以相同 Chrome ANGLE／SwiftShader、DPR 2、桌機 1440×1100／手機 390×844 量測全景。

| 畫面 | 原版 draw calls | 本次 draw calls | 原版／本次 triangles |
| --- | --- | --- | --- |
| 桌機全景 | 93 | 96（+3） | 8,576／8,576 |
| 手機全景 | 93 | 96（+3） | 6,912／6,912 |

增加的三個 draw calls 來自 Hub 櫃身、基座及分開的 HOME／Rx 材質批次；沒有增加裝飾 primitive。原始數據為 `test-results/polish-before-01/art-metrics.json` 及 `test-results/polish-review-final-01/art-metrics.json`。

**閒置零繪製保留。** 原有 20 個效能情境加上桌機／手機作者面板開啟及關閉後的四個情境，共 24 個情境通過；穩定後 RAF callback、draw calls、標籤座標寫入皆為 0。這是繪製工作量驗證，不宣稱為實機 FPS 或耗電量測。

## 驗證與素材

以下均已執行並通過：

- Portal invariants／CSP、Three vendor 逐 byte 可重現、SEO 重建無差異、git diff --check。
- 16 組 WebGL／mobile smoke、610 項空間斷言、1,586 項 walking 斷言。
- 32,722 項 free navigation 斷言，以及桌機 mouse／手機 touch 的改道、無效點、最後目的地、history 與 reduced motion。
- 新增作者面板測試：正常步行尚未到站時不開面板、鍵盤關閉與 Escape、CTA 顏色／可見範圍／44px、手機遮擋比例、context loss 備援；工具數量改為 21 的 fixture 仍從載入資料顯示正確總數。
- 24 個效能情境，包含作者面板開啟與關閉後的 idle zero-render。
- SW ownership：11 個可載入 SW 通過；既有 migraine-tracker Workbox 產物因 `define is not defined` 跳過，未列為通過。

根目錄仍零 3D 請求。CSP、SW、tools.json、routing 格式、navigation／journey／walkable engine、vendor、CI workflow 與 dependencies 未改動。此次手機驗證是 Chrome viewport／touch 測試，尚未進行本次修改的 Android 實機重驗。

指定六種審閱截圖皆位於 `test-results/polish-review-final-01/`：

1. `desktop-overview.png`
2. `desktop-hub-focus.png`
3. `desktop-author-panel.png`
4. `desktop-clinical.png`
5. `mobile-overview.png`
6. `mobile-author-panel.png`

Hub focus 圖於審閱用 browser 暫時隱藏固定面板以顯示完整幾何；作者面板圖則保留正常 UI。另保留全五區、手機工具近景及空間圖。截圖與測試產物均受 Git ignore，不部署。本地互動預覽為 `http://127.0.0.1:4175/pharmacy/`。

## 修改檔案

| 檔案 | 用途 |
| --- | --- |
| public/pharmacy/identity.js（新增） | 集中作者識別與 GitHub URL |
| public/pharmacy/main.js | 導覽文案、Hub 抵達後的作者內容、焦點與既有面板切換 |
| public/pharmacy/index.html | 初始主／次導覽提示及 Hub 按鈕語意 |
| public/pharmacy/pharmacy.css | 文案層次、作者面板、手機高度、teal CTA／visited 樣式 |
| public/pharmacy/geometry.js | 材質角色、程序 HOME／Rx 螢幕與既有藥架垂直比例 |
| public/pharmacy/architecture.js | Hub 櫃身／基座材質與既有螢幕識別 |
| public/pharmacy/world.js | 地板 roughness 與選取區域的材質強弱 |
| tests/pharmacy-smoke.mjs | 作者連結安全屬性、鍵盤、焦點與 history 回歸 |
| tests/pharmacy-performance.mjs | 作者面板開啟／關閉後零繪製 |
| tests/pharmacy-polish.mjs（新增） | 作者身分、動態計數、手機、正常到站與故障備援 |
| tools/capture-pharmacy.mjs | 六種審閱畫面與前後繪製 counters |
| docs/ux-visual-polish.md（新增） | 本次本地審閱紀錄 |

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd run test:pharmacy
node tests/pharmacy-polish.mjs
npm.cmd run test:pharmacy:free
npm.cmd run test:pharmacy:performance
node tools/capture-pharmacy.mjs test-results/polish-review-next
```
