# R4 — 全景、近距探索、光線與手機呈現

狀態：使用者已於 2026-10-30 確認視覺驗收，接續實作 R5。以下保留 R4 定案紀錄；移動及到站後的鏡頭調整見 R5。

## 視角與操作

- 全景：依 viewport aspect、FOV 與藥局尺寸自動計算距離，保留完整樓板、牆體與設備輪廓。
- 「近看藥師」：靜態近看 Rx Hub、藥師與協作空間；此視角隱藏分區／工具標籤，使用「返回全景」繼續探索。
- 分區：依工作區實際尺寸取景，較全景拉近。手機院內區保留兩側調劑櫃台的完整關係。
- 工具：選取後聚焦單一設備；桌面將設備放在側邊介紹面板左側，手機則放在 bottom sheet 上方。
- 工具介紹開啟時，地圖只保留所選工具的編號標記；完整名稱與用途留在既有介紹面板，關閉後恢復該區所有工具名稱。
- 手機視角控制位於地圖上方，提供最少 44px 操作高度；工具近景使用 320px 畫面與最高 50dvh 的介紹面板。
- 手機全景的分區標籤置於地圖周邊，以引線連到工作區，保留 Rx Hub 與藥局中央的可見範圍。
- 全景、分區與工具 hash routing 沿用原有形式；藥師近景以 history state 保存視角，browser back/forward 可往返，不增加新的 hash 路由。
- 預設相機過渡維持 750ms；reduced-motion 下直接定位。

camera-framing.js 集中定義取景尺寸與方向，live world 與遮擋檢查共用視角來源。
下方仍不顯示工具列表；WebGL 或模組失敗時才顯示文字備援。

## 光線與角色可見性

- HemisphereLight 1.6、DirectionalLight 2.4，採 ACES filmic tone mapping 與 exposure 1.08，收斂過亮地坪並保留暖白、木色與 teal。
- Three.js 維持 0.180.0；vendor 僅增加 ACESFilmicToneMapping export，未升級依賴或加入外部 JS。
- Rx Hub 前側標誌降低，保留藥師白袍與身體可見範圍；增加簡單眼睛與鼻部，使近景能辨識臉部方向。
- 角色量測與轉向半徑保持 0.524；R3 最小障礙淨空維持 0.251，高於 0.1 要求。

## 已修正的實際遮擋

初版近景的桌面 Dopamine 工具被前排輸注設備遮擋，手機兩項 EBM 工具受到資料區大螢幕遮擋。
單一工具視角已提高俯角，沒有移動已驗收的家具與行走路網。
藥師近景同步隱藏地圖標籤，避免依賴下一個動畫 frame 才更新按鈕的可見狀態。

## 驗證

- pharmacy smoke suite：16 組通過，含 R3 的 610 項空間斷言，以及全部 22 工具的桌面／手機操作、名稱與連結、鍵盤、history、fallback、CSP、清理與 200% 等效 viewport。
- 使用實際 Mesh／InstancedMesh 檢查預設全景不裁切模型邊界，並以 Raycaster 檢查藥師頭部／白袍及全部設備的分區、工具預設視角。
- 逐一核對 22 項工具的 live SVG 投影座標與相機預設，誤差須小於 2px，設備焦點不得位於介紹面板覆蓋範圍。
- 檢查「近看藥師 → 返回全景 → 上一頁／下一頁」的視角與標題恢復。
- 上述遮擋檢查針對預設視角；使用者自行拖曳旋轉後的任意角度不在此保證範圍。
- 桌面全景：84 draw calls／8,576 triangles；手機：84／6,912。尚未進入 Phase 3 效能優化。
- Three.js reproducibility、portal/CSP invariants、SEO 無差異、git diff --check 均通過。
- 跨專案 SW：11 個可載入 SW 通過；既有 migraine-tracker Workbox 產物仍因 `define is not defined` 略過，不計為通過。

## 驗收批次

test-results/r4-review-02：桌面與手機全景、Rx Hub 藥師近景、五區、工具介紹，以及當次 R3 路線／淨空資料。

由使用者驗收完整藥局辨識、藥師與設備比例、光線、字體及手機面板遮擋；確認後才進入 R5。
截圖與 SwiftShader 測試不等同手機 GPU 或 R5 動態操作驗收。尚未部署。
