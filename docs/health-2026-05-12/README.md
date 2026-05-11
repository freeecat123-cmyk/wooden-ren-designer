# wrd 預設值健檢報告 · 2026-05-12

學生 beta 開放前體檢：所有 28 個家具模板用 default URL（無任何 query param）
跑 Playwright 截圖，肉眼比對 + 抓警告。截圖 28 張在本資料夾。

**檢測環境**：localhost:3000 / 1400×900 viewport / build = local dev /
HEAD = `bf90683`（剛 push 的 student-facing scaffolding）。

---

## TL;DR

| 嚴重度 | 數量 | 摘要 |
|---|---|---|
| 🔴 P0 阻斷 | 0 | — |
| 🟠 P1 礙眼 | 6 | 警告默認觸發、家具預設不像家具、零件飄空 |
| 🟡 P2 體驗 | 3 | 預設造型可優化（例如圓凳預設方腳） |
| ✅ OK | 19 | — |

P0 / P1 都應該在學生開放前修。

---

## 🔴 P0 阻斷 — 無

✅ 沒有家具完全壞掉、3D 不出圖、或 console error 的情況。

---

## 🟠 P1 礙眼（學生看到會 WTF）

### P1-1 床架：床頭板飄在半空 ⚠️ 第二次出現
- 截圖：`04-bed.png`
- 床頭板 (headboard) 跟床框架之間有可見空隙，沒接到床尾橫木
- 應該貼住床尾立柱或上方橫木
- 跟前面修過的 cornice 飄空是相同 pattern（origin.y 加了不必要 offset）
- 預估：~30 行 fix in `lib/templates/bed.ts`

### P1-2 衣櫃：預設立刻跳警告「沒勾滑軌」
- 截圖：`06-wardrobe.png`
- 預設 4 個抽屜但沒 enable `drawerSlide` → 開頁就跳「大抽屜純木製滑軌易卡」
- 學生第一眼就被嚇到，以為自己做錯
- 修法：預設 enable `drawerSlide` OR 把這個警告改成只在「drawerCount ≥ 3 且明確選『純木滑軌』」時才出
- 同樣警告也在 `chest-of-drawers` 出現（共 6 抽屜）→ 一次修兩家具

### P1-3 斗櫃：同上「沒勾滑軌」警告
- 截圖：`11-chest-of-drawers.png`
- 共 6 個抽屜但沒勾「三段式滑軌」
- 與 P1-2 同根因，一起修

### P1-4 鞋櫃：預設立刻跳「層板過矮」警告
- 截圖：`08-shoe-cabinet.png`
- 「鞋櫃層板每層淨高 133mm 偏矮：高跟鞋 / 短靴需 ≥190mm」
- 預設 zone count 太多 → 每層分配淨高不夠
- 修法：把鞋櫃預設 zone 數從 N 降到合理值，或預設改成「2 層 + 大下層留高鞋」

### P1-5 吧檯椅：預設立刻跳「腳粗過細」警告
- 截圖：`19-bar-stool.png`
- 「腳粗 35mm 對 750mm 高的凳子可能太細（建議至少 50mm，比例 1:15）」
- 預設 legSize=35 但 height=750
- 修法：吧檯椅預設 legSize 改 50（或用 height/15 自動推）

### P1-6 立式衣帽架：完全沒有掛鉤
- 截圖：`28-coat-rack.png`
- 標題「多向掛鉤」但 3D 只看到立柱 + 十字底，沒有任何掛鉤 part
- 預估：要在 coat-rack.ts 加掛鉤 parts（hooks 等距分布在立柱上方）
- 學生看到「立式衣帽架」結果是支光禿禿的木竿，會以為壞掉

---

## 🟡 P2 體驗（可選優化，學生不一定會 WTF 但不漂亮）

### P2-1 圓凳：預設用方腳
- 截圖：`14-round-stool.png`
- 名字「圓凳」但 legShape 預設 `box`（方腳）
- 改 default = `round-tapered` 或 `round` 更符合命名

### P2-2 筆筒：3D 看起來像實心方塊
- 截圖：`22-pencil-holder.png`
- 應該是中空、頂部開口
- 可能視角問題 OR 3D 沒做頂部開口
- 影響感知品質但不影響裁切單

### P2-3 相框：3D 看起來像扁木塊
- 截圖：`24-photo-frame.png`
- 應該看到外框 + 中央照片區
- 預設高度 18mm 太薄可能視覺上區分不出來
- 影響第一印象但不影響功能

### P2-4 玻璃展示櫃：上層開放、下層才是玻璃櫃
- 截圖：`09-display-cabinet.png`
- 名字「玻璃展示櫃」但預設上層是開放層板、下層才是玻璃門
- 學生會以為「為何上面沒玻璃？」
- 改 default：top zone 也用 door+glass，或把名字改成「上下櫃」

---

## ✅ OK（19 個，公開無問題）

stool / dining-chair / dining-table / desk / nightstand / open-bookshelf /
bench / tea-table / round-table / round-tea-table / side-table /
low-table / media-console / chinese-cabinet / bookend / tray /
dovetail-box / wine-rack（+ display-cabinet 可勉強算）

---

## 建議優先順序（學生 beta 開放前）

| 順序 | 工作 | 工時 |
|---|---|---|
| 1 | P1-2 + P1-3 衣櫃/斗櫃預設啟 drawerSlide | 5 分鐘 |
| 2 | P1-5 吧檯椅 legSize 預設 35→50 | 2 分鐘 |
| 3 | P1-4 鞋櫃預設 zone count 調整 | 10 分鐘 |
| 4 | P1-1 床頭板飄空 fix | 20 分鐘 |
| 5 | P1-6 立式衣帽架加掛鉤 part | 60 分鐘 |
| 6 | P2-1 圓凳預設改圓腳 | 2 分鐘 |
| 7 | P2-2 / P2-3 / P2-4 細節（可開放後再修） | — |

**總工時**：P1 全修 ≈ 1.5 小時 / P2 看心情 / 完美主義 ≈ 2 小時

---

## 截圖索引

| # | 模板 | 評估 |
|---|---|---|
| 01 | stool（方凳） | ✅ |
| 02 | dining-chair（餐椅） | ✅（穩定性提示是 informational） |
| 03 | dining-table（餐桌） | ✅ |
| 04 | bed（床架） | 🟠 P1-1 床頭板飄空 |
| 05 | desk（書桌） | ✅ |
| 06 | wardrobe（衣櫃） | 🟠 P1-2 警告 + 門看不到 |
| 07 | nightstand（床頭櫃） | ✅ |
| 08 | shoe-cabinet（鞋櫃） | 🟠 P1-4 層板過矮警告 |
| 09 | display-cabinet（玻璃展示櫃） | 🟡 P2-4 預設配置 |
| 10 | open-bookshelf（開放書櫃） | ✅ |
| 11 | chest-of-drawers（斗櫃） | 🟠 P1-3 警告 |
| 12 | bench（長凳） | ✅ |
| 13 | tea-table（邊桌/床邊桌） | ✅ |
| 14 | round-stool（圓凳） | 🟡 P2-1 預設方腳 |
| 15 | round-table（圓餐桌） | ✅ |
| 16 | round-tea-table（圓茶几） | ✅ |
| 17 | side-table（邊桌/床頭桌） | ✅ |
| 18 | low-table（矮桌） | ✅ |
| 19 | bar-stool（吧檯椅） | 🟠 P1-5 腳粗警告 |
| 20 | media-console（電視櫃） | ✅ |
| 21 | chinese-cabinet（中式方角櫃） | ✅ |
| 22 | pencil-holder（筆筒） | 🟡 P2-2 視覺像實心方塊 |
| 23 | bookend（書擋） | ✅ |
| 24 | photo-frame（相框） | 🟡 P2-3 視覺像木塊 |
| 25 | tray（托盤） | ✅ |
| 26 | dovetail-box（木盒） | ✅ |
| 27 | wine-rack（紅酒架） | ✅ |
| 28 | coat-rack（立式衣帽架） | 🟠 P1-6 沒掛鉤 |
