# Phase 4 — 發布前驗證與正式發布確認

2026-10-30（Asia/Taipei）。狀態：**發布前檢查通過，Android Chrome 實機驗收由使用者確認通過。PR #10 尚未合併；正式發布後確認待合併及部署完成後執行。**

## 受測版本與發布界線

| 項目 | 本次確認 |
| --- | --- |
| PR | https://github.com/liangRXdev/pharmacy-portal/pull/10 |
| 受測 commit | `12ea6bfc5ff33a177705d274c83748d7ec47a9bf` |
| 受測 public tree | `ad6db437448d87ee8b23ef326077f24518f5abc3` |
| Cloudflare Preview version | `deae4ec9-7387-4750-975a-b3294123bbbb` |
| 不可變受測 Preview | https://deae4ec9-pharmacy-portal.liangrxdev.workers.dev |
| 分支 Preview／實機驗收入口 | https://codex-pharmacy-r6-free-navigation-pharmacy-portal.liangrxdev.workers.dev/pharmacy/ |
| 合併前正式站 commit | `ef3c82e5952bad982043b55f0545a873fd85a183` |
| 合併前 Cloudflare version（GitHub build 記錄） | `b3c00c40-158a-47a0-a763-8373115f7ccd` |

本階段新增驗證工具、測試的遠端 base 支援與文件，未變更 `public/`。後續 PR commit 若只有這些輔助檔案變更，以上 public tree 仍是受測發布內容；任何公開資產變更均須重新核對與驗證。正式站 version 來源為合併前 commit 的 Workers Builds 記錄；實際線上內容另以 Git blob SHA-256 比對確認。

## 自動檢查結果

| 檢查 | 結果與證據 |
| --- | --- |
| Preview HTTP／來源一致性 | **87 項通過**，28 個公開資產逐 byte 對照 Git commit blob；以 Git blob 而非 Windows checkout CRLF 作為來源。包含 HTML、ES modules、CSS、JSON、icons、vendor 與授權檔。 |
| CSP／安全標頭 | 根目錄的 inline script hash 與實際回應一致；藥局路由僅一組 CSP，script-src 為 self。nosniff、DENY、frame-ancestors、HSTS 符合設定。 |
| MIME／快取 | JavaScript／CSS MIME 正確；SW 為 no-cache；未版本化的藥局資產可重驗證、未設定 immutable。首頁、藥局、world.js、walkable.js、SW 的 ETag 條件請求均回 304。 |
| canonical redirect | `/index.html`、`/pharmacy`、`/pharmacy/index.html` 正確導向；`?no3d=1` 經 redirect 保留。 |
| 發布目錄隔離 | `.git/HEAD`、`.env`、package.json、CLAUDE.md、handoff、docs、tools 與 `_headers` 內容未對外暴露。部署根目錄維持 `public/`。 |
| 真實 Preview 瀏覽器 smoke | **16 組通過**；桌機／手機全部 22 工具入口、hash/history、鍵盤、200% 等效 viewport、CSP、module failure、context loss、資源清理、root zero-3D 與 SW ownership。 |
| 自由選點 | Preview 上原生 mouse／touch 的完整繞障、中央到站不顯示工具、無效點保留行程、改道、三次改點最後生效、自由站位工具介紹、history 與 reduced motion 通過。 |
| Preview Phase 3 重驗 | **20 個情境通過**；穩定後 RAF callback、draw calls、標籤座標寫入均為 0，拖曳阻尼、步行、改道與 resize 正常喚醒。 |
| 合併前正式站基準 | **59 項通過**，正式站 19 個公開資產仍逐 byte 對應 `ef3c82e`，沒有提前套用 PR 資產。 |
| 實際版面 | 以不可變 Preview 擷取桌機／手機全景、Rx Hub、五區、工具介紹及空間圖，檢視正常渲染完成後的取景。 |

瀏覽器自動測試使用 Windows Chrome、ANGLE／SwiftShader；其 frame／draw counters 不等於手機硬體 FPS 或耗電量。測試中的故障注入、模組觀測 hook、SW 與 browser cache 操作只作用在隔離的測試 browser context，未更動遠端服務。

證據保存於忽略的 `test-results/phase4-preview-01/http-audit.json`、`test-results/phase4-production-baseline-01/http-audit.json` 與 `test-results/phase4-preview-01/screenshots/`。Preview 效能原始結果另存 `test-results/phase4-preview-01/performance.json`。這些測試產物不部署。

## 人工驗收

使用者於 2026-10-30 回覆「通過 Android Chrome 實機驗收」，涵蓋已提供之 Preview 自由移動、工具介紹、觸控與流暢度驗收。這是使用者實機確認，與自動化手機 viewport 測試分別記錄。

## 重跑方式

HTTP 驗證需指定受測 Git ref，並使用新的輸出批次名稱；工具會比對遠端內容與該 ref 的 Git blob，並在任何檢查失敗時以非零狀態結束。

```powershell
node tools/verify-preview.mjs https://deae4ec9-pharmacy-portal.liangrxdev.workers.dev 12ea6bf test-results/phase4-preview-02
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:PHARMACY_BASE_URL='https://deae4ec9-pharmacy-portal.liangrxdev.workers.dev'
node tests/pharmacy-smoke.mjs
node tests/pharmacy-free-ui.mjs
node tests/pharmacy-performance.mjs
node tools/capture-pharmacy.mjs test-results/phase4-preview-02/screenshots
Remove-Item Env:PHARMACY_BASE_URL
```

`PHARMACY_BASE_URL` 未設定時，測試繼續使用原本 localhost 伺服器；CI 既有測試方式不變。遠端故障注入仍只修改測試 browser 的 response，不修改 Preview。

## 合併與正式站確認

1. 確認 PR 最新 CI 全綠、public tree 與受測版本相同、Android 驗收未因公開資產變更失效。
2. 由使用者決定合併 PR，等待 Cloudflare 正式版本建置／部署成功，記錄 merge SHA 與正式 version ID。不能把 Preview Build 成功當成正式發布完成。
3. 先 fetch 合併後的 Git commit，將 HTTP 驗證工具的目標改為 `https://pharmacy-portal.liangrxdev.workers.dev`，Git ref 改為 merge SHA，以新批次核對所有資產、CSP、MIME、redirect、ETag 與私有檔案隔離。
4. 對正式站重跑 browser smoke、自由移動與效能流程；另用發布前已造訪的瀏覽器分頁重新整理，確認同源 HTTP／SW 舊快取不會留下新舊模組混用。保留一般及無痕／全新 profile 的確認結果。
5. 正式站檢查失敗時停止擴大發布，先檢視 Cloudflare 的實際 version／response。必要時選回上述已知正常的正式 version（若仍可選取），或建立合併 PR 的 revert 提交並重新發布；恢復後再驗證正式資產符合 `ef3c82e`。本次只記錄回復基準，未執行 rollback。

根目錄 shell 與 tools.json 在本 PR 未變更，因此 SW shell cache 不為藥局更新而升版。3D 模組沒有納入 shell precache；首頁離線工具目錄可用，不宣稱完整 3D 頁面可離線載入。

**結論：發布前驗證通過，可交由使用者決定合併。正式站發布與發布後驗證尚未執行。**
