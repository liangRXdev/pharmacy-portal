# Phase 3 效能驗證

2026-10-30：R1–R5 已由使用者驗收。本文件先固定 R5 通過時的量測基準，尚不代表 Phase 3 優化或實機驗收完成。

## 已驗證基準

| 項目 | 桌機 | 手機 viewport |
| --- | --- | --- |
| 全景 draw calls／frame | 93 | 93 |
| 全景 triangles／frame | 8,576 | 6,912 |
| DPR 上限 | 2 | 1.5 |
| Three vendor | 516,388 bytes，gzip 130,219 bytes | 相同 |

來源：本次 `npm.cmd run test:pharmacy` 真實 WebGL renderer counters。環境為 Windows 系統 Chrome、ANGLE／SwiftShader，數字描述提交的幾何量；不能換算為實機 FPS。R5 將靜態藥師拆成身體與四肢批次，draw calls 由 R4 的 84 增至 93，三角形數維持相同。

首頁維持 zero-3D 請求；手機採簡化家具變體、DPR 上限。頁面隱藏／BFCache 時暫停 RAF，恢復時不累積背景移動時間。16 組 smoke、610 項空間斷言與 1,586 項移動斷言均通過，沒有新增正式介面的 FPS／debug UI。

## 待驗證與調整

目前可見頁面仍持續 render 及重排投影標籤，即使藥師與相機已停止。優先量測 idle、相機操作、步行與改道四種狀態，再決定閒置更新節奏及標籤更新頻率；保持動畫跟隨、OrbitControls damping、resize、鍵盤、reduced motion 與資源清理。

不以歷史約 60 draw calls 作硬上限，也不為降低 counter 刪除已驗收的家具或工具辨識。是否需要進一步合併靜態材質／幾何或動態品質，應由實測決定。

Android 實機 GPU、觸控及長時間耗電尚未量測。正式 Cloudflare headers／快取與發布檢查仍屬 Phase 4；目前沒有 commit、push 或部署。
