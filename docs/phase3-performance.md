# Phase 3 效能驗證

2026-10-30：R1–R5 已由使用者驗收，並提交為 `ac9a835`。Phase 3 本地按需繪製優化與自動驗證完成，實機效能驗收仍待執行。

## 已驗證基準

| 項目 | 桌機 | 手機 viewport |
| --- | --- | --- |
| 全景 draw calls／frame | 93 | 93 |
| 全景 triangles／frame | 8,576 | 6,912 |
| DPR 上限 | 2 | 1.5 |
| Three vendor | 516,388 bytes，gzip 130,219 bytes | 相同 |

來源：本次 `npm.cmd run test:pharmacy` 真實 WebGL renderer counters。環境為 Windows 系統 Chrome、ANGLE／SwiftShader，數字描述提交的幾何量；不能換算為實機 FPS。R5 將靜態藥師拆成身體與四肢批次，draw calls 由 R4 的 84 增至 93，三角形數維持相同。

首頁維持 zero-3D 請求；手機採簡化家具變體、DPR 上限。頁面隱藏／BFCache 時暫停 RAF，恢復時不累積背景移動時間。16 組 smoke、610 項空間斷言與 1,586 項移動斷言均通過，沒有新增正式介面的 FPS／debug UI。

## 本次調整

`world.js` 改為按需繪製：步行、轉身、相機過渡或 OrbitControls damping 尚在進行時保持 RAF；停止後不再排程。選區／工具、改站、hover 改變、縮放拖曳、resize、字型載入完成、reduced motion 與頁面恢復會喚醒畫面。轉身以正規化角差判斷完成，避免繞一圈後因角度不等於數值 0 而不停更新。

投影標籤只在相機或版面失效時重排；hover 變色不需重排。標籤寬高依目前版面快取，於視角切換、resize 或字型就緒時失效，減少逐幀 DOM 尺寸讀取。保留既有模型、設備、材質、DPR 與鏡頭，沒有新增動態降畫質或 FPS UI。

## 前後量測

`tests/pharmacy-performance.mjs --baseline` 從 Git 讀取 `ac9a835` 的原版 world.js，透過測試路由置換重建 R5 基準；其餘資產與測試環境相同。改善版直接測試目前工作目錄。每列約 650–880ms，依實際 elapsed time 記錄；這是提交工作量的量測，不能宣稱為硬體 FPS 或耗電改善百分比。

| 閒置狀態 | 桌機原版 draw calls／標籤座標寫入 | 手機原版 draw calls／標籤座標寫入 | 改善版兩種尺寸 |
| --- | --- | --- | --- |
| 全景 | 1,674／1,152 | 3,720／2,560 | 0／0 |
| 分區 | 840／990 | 1,736／2,046 | 0／0 |
| 工具介紹 | 686／784 | 1,950／2,184 | 0／0 |
| 拖曳阻尼結束 | 2,139／1,472 | 3,627／2,496 | 0／0 |
| 改站後抵達 | 714／1,020 | 1,664／1,920 | 0／0 |
| resize 後穩定 | 630／900 | 1,664／1,920 | 0／0 |

改善版另斷言所有上述閒置狀態的 RAF callback 為 0。拖曳仍有實際 draw calls 與不同的投影座標；步行及改道持續繪製及更新標籤；resize 會補繪，再回到閒置。使用「連續安靜 350ms」後再取樣，並設 12 秒上限，保留阻尼自然結束的時間，未以硬停動畫通過測試。

基準與改善版原始 JSON 位於忽略的 `test-results/phase3-baseline.json`、`test-results/phase3-performance.json`。CI 已加入 `npm run test:pharmacy:performance`，不執行需讀歷史 commit 的 baseline 模式。

## 驗證與邊界

16 組 smoke、610 項空間斷言、1,586 項移動斷言持續通過。Framebuffer 檢查改在實際繪製的同一 RAF 中讀取，避免將持續重繪當作測試前提。Portal/CSP、Three vendor 可重現性、SEO 重建無差異與 `git diff --check` 通過。

不以歷史約 60 draw calls 作硬上限，也不為降低 counter 刪除已驗收的家具或工具辨識。是否需要進一步合併靜態材質／幾何或動態品質，應由實測決定。

Android 實機 GPU、觸控及長時間耗電尚未量測。正式 Cloudflare headers／快取與發布檢查仍屬 Phase 4。R1–R5 已本機 commit；Phase 3 依使用者指示另行提交，沒有 push 或部署。
