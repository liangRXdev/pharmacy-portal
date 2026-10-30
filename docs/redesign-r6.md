# R6 — 自由點選移動

2026-10-30 需求確認後實作。本地實作、自動檢查與桌機／手機影片及互動預覽已交付，依使用者指示提交 R6。尚未 push 或部署；基底為 R1–R5 `ac9a835`、Phase 3 `444cccc`。

## 已定案互動

- 可點選通道與工作區內的可通行空地，顯示目的地標記並自行繞過家具；終點保留實際地面交點，不吸附到固定停靠點或格點。
- 有效的新目的地立即取代原行程，從角色當前位置改道；不排隊、不瞬移。點工作區標籤仍可快速前往既有停靠點。
- 點家具、牆面、場外或無法連通的地面：短暫提示「此處無法通行」，保留原行程與 history，不自動改位置。
- 自由移動途中不顯示工具名稱；在工作區內或其 0.6 場景單位的接近範圍停下後，顯示該區工具。中央通道停下保持中立；範圍重疊時選最近的工作區。
- 在自由站位開啟／關閉工具介紹，保留原站位。返回全景會就地停止；browser back/forward 保存自由目的地，重走時仍需通過尋路檢查。
- Reduced motion 直接到達有效目的地；缺少必要碰撞／尋路資料時不啟動移動，使用既有錯誤備援。
- 延用短點與拖曳的 6px 區分及多指手勢處理；保留 OrbitControls、五區原生按鈕及文字備援，不加入 WASD、自由操控或物理引擎。

## 實作與空間邊界

`walkable.js` 從實際場景 mesh／InstancedMesh 的障礙邊界建立可行走圖，格距 0.3。使用行走姿態包絡半徑 `0.568969` 加既有 `0.1` 間隙，連續檢查每段路徑的 capsule 與障礙 AABB 距離。旋轉家具的 AABB 採保守範圍，可能多繞路，不能穿過家具。

格點採八向連結，每條邊在使用前驗證；保留已驗證的固定通道作為狹窄通道的連通骨架。A* 取得可行路徑後，只以通過完整碰撞檢查的直線合併轉折。真實起點及終點另行連接，不用最近節點取代使用者的點。合法但隔離的空地仍會拒絕。

目前桌機／手機圖分別有 1,421／1,426 個節點；初始化在本機測試約 12–26ms，僅為此次環境觀測，並非手機硬體效能承諾。沒有新依賴、Three vendor 變更、物理模擬或正式 debug globals。

地面以場景真正可見的交點判斷，前方牆面／家具會阻擋點擊；工具裝飾螢幕與緊鄰的工具標記共同接受設備點擊，不能點穿遠處的牆。桌機全景標籤改與手機相同的周邊停靠方式，避免遮住工作區可點空地；中央自由站位仍提供五區入口。地圖下方持續不顯示工具列。

自由目的地存於 browser history state 的 `pharmacyPoint`，工作區／工具仍使用既有 hash；沒有另存工具名冊、patient data 或永久位置儲存。`tools.json` 仍為唯一名稱、描述與連結資料來源。

## 驗證

- 32,722 項自由尋路斷言：兩種實際場景、各 94 個可達終點、精確終點、密集獨立 circle-vs-AABB 檢查、繞障、隔離區域、場外／無效輸入、資料缺失與改道狀態保留。
- 桌機實際 mouse 與手機 touch：點 Rx Hub 後方空地並完整繞行、中央到站不顯示工具、無效點保留 revision／目的地、途中改點、三次快速改點以最後為準、自由進入 clinical 顯示六工具、開啟介紹保持站位、history 返回及 reduced motion 立即精確到站。
- 瀏覽器 UI 測試以測試路由注入相機／角色觀測 hook，操作仍經真實 pointer 事件與正式 main.js；不將 hook 加入產品碼。終點以點擊當下的實際 raycast 交點驗證，避免鏡頭跟隨造成畫面座標取樣時差。
- 原有 16 組 smoke、610 項空間斷言及 1,586 項 R5 斷言持續執行；全部 22 個工具、routing、CSP、fallback、WebGL context loss、資源清理及首頁 zero-3D 保留。
- Phase 3 的 idle 測試持續通過：穩定後零 RAF callback、零 draw calls、零標籤座標寫入；操作、移動與 resize 可喚醒。
- Portal/CSP 檢查、Three vendor 可重現性、SEO 重建無差異與 `git diff --check` 通過。CI 加入 `npm run test:pharmacy:free`。

## 驗收素材

新批次 `test-results/r6-recording-03/`，保留前批；該資料夾受 Git ignore，不部署。

| 影片 | 尺寸／比例 | 時長 | 編碼 |
| --- | --- | --- | --- |
| desktop-free-walk.webm | 1280×900／64:45 | 35.16 秒 | WebM、VP8、25 fps、無音訊 |
| mobile-free-walk.webm | 390×844／195:422 | 21.96 秒 | WebM、VP8、25 fps、無音訊 |

兩片均經 FFmpeg 完整解碼，包含上述正常繞行／無效點／改道／快速改點／自由到站工具介紹的操作；manifest 保存操作時間、精確首個目的地、最終站位及驗證狀態。另存中央到站、無效提示、工具介紹及首／中／末影格。25 fps 是錄影設定，不等於實機 FPS；Software GPU、Android 實機操作及耗電驗收仍須區分。

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd run test:pharmacy:free
npm.cmd run test:pharmacy
npm.cmd run test:pharmacy:performance
node tools/preview-pharmacy.mjs
# FFmpeg 已安裝於 test-results/playwright-runtime 時，可另開新批次：
node tools/record-free-pharmacy.mjs test-results/r6-recording-04
```

本機預覽 `http://127.0.0.1:4173/pharmacy/`；既有分頁需重新整理才載入 R6。Phase 4 正式發布檢查尚未進行。
