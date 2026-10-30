# R2 — 五區辨識與配置

狀態：R2 已由使用者確認，後續已進入 [R3 通行空間、路線與停靠點](redesign-r3.md)。以下保留 R2 紀錄。

## 空間配置

- 樓板由 17.2 × 16.6 調整為 19.6 × 20 個場景單位，主要增加後側討論／臨床工作空間與前側調劑作業深度；不是實際建築尺寸標示。
- 保留前側中央入口與 Rx Hub；Rx Hub 兩側預留環路，連接後側與前側橫向通道。
- 教學與臨床位於後側，資料與安全位於兩側，前側兩翼為共用儲藥與調劑區。
- 空間尺寸、分區、工具設備座標與候選通道由 scene-layout.js 提供，配置圖使用相同來源。
- CIRCULATION_PREVIEW 是可見地坪與空間預留，不是 R5 導航圖；R3 才以角色體積檢查障礙、轉向及停靠點。

## 五區辨識

| 工作區 | 主要特徵 |
| --- | --- |
| Clinical | AUC／TDM、renal／lab 螢幕、輸注架、藥品冷藏櫃 |
| EBM | 討論桌與座椅、大型 forest plot、書櫃、階梯式證據模型 |
| Medication Safety | ADR signal review、用藥審查雙螢幕、藥品配對矩陣板 |
| Open Data | Taiwan／radar 顯示、兩座較高的資料機櫃 |
| Internal | 雙翼調劑櫃台、藥架、unit-dose 格櫃、準備台、藥車與終端 |

螢幕皆為象徵性圖樣，無病患資料或真實臨床結果。
zone-art.js 將分區美術與 world 的互動／路由分離，繼續使用共用 geometry kit。
手機減少書籍、藥盒、座椅及次要藥車，保留主要功能輪廓與全部 22 項工具。

## 驗證與交付

- npm run check:three：vendor 可重現。
- node tools/check-portal.js：tools.json、CSP、local modules 與 SW shell invariants 通過。
- gen-seo 重生後，首頁及 sitemap 無差異。
- 既有 pharmacy smoke suite 13 組通過：桌面／手機全部 22 工具、介紹與連結、history、fallback、CSP、清理、鍵盤、標籤不重疊與 200% 等效 viewport。
- 桌面全景：83 draw calls、8,516 triangles；手機全景：83 draw calls、6,852 triangles。尚未執行 Phase 3 效能優化。
- 跨專案 SW：11 個可載入 SW 通過；既有 migraine-tracker Workbox 產物因 `define is not defined` 略過，不計為通過。

截圖批次：test-results/r2-01，包含桌面全景、無標籤全景、手機全景、桌面／手機五區與介紹面板。
layout-preview.png／layout-preview.svg 由相同場景座標產生，為 R2 配置草圖，不包含全部家具的障礙輪廓。

## 人工驗收與後續

由使用者確認五區在無 DOM 標籤時的辨識度、藥局連貫性、Rx Hub 環路及前側調劑區配置。
確認後進 R3，完成角色體積、障礙、路線與停靠點的檢查。
R4 再定案桌面／手機全景與近距探索視角；目前手機院內區以較廣取景保留雙翼配置。
R5 才加入角色移動與相機跟隨。尚未部署，手機 GPU／實機接受度仍待人工驗收。
