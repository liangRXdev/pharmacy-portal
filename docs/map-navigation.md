# 3D 地圖導覽

使用者已確認：正常使用時，3D 地圖是 `/pharmacy/` 的唯一導覽入口。
這項決策取代原交接文件「下方分類列與工具清單常態顯示」的安排。
首頁仍提供原有工具目錄。

後續已確認新增 [R5 藥師移動式探索](redesign-r5.md)，排在 R4 視覺驗收後、Phase 3 效能驗證前。
R5 所需的連續動線、通行空間與停靠點提前於 R2–R3 規劃；R4 驗收全景與較近的探索視角。
R4、R5 均已驗收；目前已加入步行與到站後顯示工具。
後續 [R6 自由點選移動](redesign-r6.md) 已本地實作，待動態驗收；其任意地面目的地取代下方 R5 的固定通道限制，工作區快速前往仍保留。

## 互動

- 全景：五個工作區標籤顯示名稱與工具數量。點選標籤或該區設備，藥師沿固定通道前往。
- 移動中：相機跟隨，點選另一工作區即從當前位置改道；最後一次目的地生效。抵達後才顯示工具名稱與介紹，reduced motion 則直接到站。
- 分區：每項工具有獨立編號、完整中文名稱與連到設備的引線；名稱不依賴 hover。
- 點選設備或名稱：開啟介紹面板，顯示 tools.json 的名稱、說明、tags 與允許的 HTTPS 連結。
- 關閉面板：返回原分區，焦點回到同一工具；Escape 返回全景。
- 返回全景：就地停止並重新探索其他區域；browser back/forward 與 deep links 沿用現有 hash routing 及到站流程。
- 「前往 Rx Hub」沿通道到中央停靠點並近看藥師；返回全景後再選擇工作區。工具選取後放大設備，完整介紹顯示於面板。
- 地圖標籤使用原生 button，支援 Tab、Enter 與手機觸控；canvas 本身不承擔文字可及性。

正常模式下，`backup-browser` 從初始 HTML 即為 hidden，不呈現第二份工具列。
WebGL 探測失敗、模組失敗、context loss 或 `?no3d=1` 才顯示備援分類與工具清單。
無 JavaScript 時保留回到首頁的連結。

## 資料與視覺

tools.json 維持唯一資料來源。地圖的名稱、數量、介紹與連結均從同一資料產生。
tool-art.js 依 tags/category 產生象徵性螢幕與設備，例如輸注架、氧氣瓶、資料機櫃與書本；
顯示編號與名稱以識別個別工具，沒有額外手動維護的工具名冊。
螢幕圖樣不顯示實際臨床結果或虛構的病患數據。

手機全景與分區使用不同高度與取景；分區名稱標籤使用碰撞避讓與最少 44px 點擊高度。
Three.js vendor、CSP、SW ownership 與首頁零 3D 載入規則維持原有邊界。

## 驗證

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd run test:pharmacy
node tools/capture-pharmacy.mjs test-results/map-only-review
```

smoke suite 逐一從地圖開啟桌面與手機的全部 22 項工具，核對名稱、介紹、連結、hash、
關閉後焦點返回，並檢查各區標籤不重疊、觸控尺寸、備援模式、鍵盤及 200% 等效 viewport。
原有 routing、CSP、SW、resource disposal 與 context loss 測試繼續執行。

地圖導覽初版（R2 前）的本地驗證：13 組 smoke checks 通過；桌面 84 draw calls／6,924 triangles，
手機 84 draw calls／6,108 triangles。Three.js vendor 可重現，portal/CSP 與 SEO 檢查通過。
跨專案 SW 檢查中 11 個可載入 SW 通過；既有 migraine-tracker Workbox 產物仍因 `define is not defined` 略過，不算通過。

截圖包含桌面／手機全景、五區分別取景與工具介紹面板。視覺仍由使用者驗收；
SwiftShader 測試不等同手機 GPU 效能或 Android 實機驗收，尚未部署。

五區配置見 [R2 紀錄](redesign-r2.md)，路網與模型淨空見 [R3 紀錄](redesign-r3.md)；最新視角、光線與驗收批次見 [R4 紀錄](redesign-r4.md)。
