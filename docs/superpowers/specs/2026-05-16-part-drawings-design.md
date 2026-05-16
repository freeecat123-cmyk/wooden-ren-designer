# 零件圖（Part Shop Drawing）Design Spec

**Date:** 2026-05-16
**Status:** Draft — pending user review
**Research:** `docs/superpowers/research/2026-05-16-part-drawings/`

---

## Motivation

wrd 目前輸出：3D 透視圖、三視圖（整套家具）、榫卯細節圖（per joint type）、材料單、工序、工具單。
**缺**：per-part 製造圖。具體做法是：複雜零件（含榫眼、含榫頭、或非方料）的使用者**做不出來**，因為沒有單件視角的尺寸圖、榫位圖、面向資訊。

榫卯細節圖（已有）≠ 零件圖：
- 細節圖 = per joint **type** 的技法示意（通榫怎麼鑿、鳩尾怎麼劃線）
- 零件圖 = per **具體零件** 的製造圖（這根左前腿要長 720mm、頂端距底 690 處開 40×15×30 榫眼）

二者互補。

---

## 1. 範圍

### 1.1 篩選 predicate

```ts
function needsPartDrawing(part: Part): boolean {
  return part.tenons.length > 0
      || part.mortises.length > 0
      || (part.shape && part.shape.kind !== "box");
}
```

純方料無榫接無造型（如平板、隔板）→ 不出零件圖（裁切單已足夠）。

### 1.2 規模估算

- 26 模板 × 平均 13 part = ~340 part
- 觸發 predicate ≈ 240 part（71%）
- 合併同形 ×N 後 ≈ 85–95 張獨立零件圖
- 重災區：座椅 / 凳 / 桌 / bench / dining-chair / bar-stool（每套 6–10 張）
- 輕災區：櫥櫃類（每套 1–4 張，多數面板無榫）

### 1.3 不在範圍內

- `circle-chair`（圈椅）：尚未 merge 到 main，等 PR #2 P2/P3 視覺成熟再處理。屆時無需額外工作，predicate 自動覆蓋；只「楔釘榫展開圖」這類特殊渲染要補。

---

## 2. 合併規則

### 2.1 Geometry hash

```ts
type PartGeometryHash = {
  visible: Dimensions;           // L×W×T
  shape: Part["shape"];          // 含 kind + 所有參數
  tenons: TenonSig[];            // sorted by position
  mortises: MortiseSig[];        // sorted by position
};
```

Hash 全等 → 合併為一張圖、標題顯示 ×N。

### 2.2 Mirror 不合

左前腿 vs 右前腿即使外觀對稱也分兩張——榫眼位置鏡像，工匠按一張做會把兩根做成同手。

判定：tenon/mortise 的 `position` 軸若鏡像（X 翻號），即視為不同件。

### 2.3 標題

- 單件：「腿」
- ×N：「腿 ×4」
- 鏡像對：「左前腿 / 右前腿」分兩張，標題用 `nameZh`

---

## 3. 內容與符號

### 3.1 視圖佈局（第三角法）

```
       [俯視]
         |
[側視] [正視]
         |
       [底/後] ← 通常省略
```

- **Local 座標**：length 軸 = 正視水平、thickness 軸 = 正視垂直、width 軸 = 進深
- 部件 origin 沿用 §A10.9 慣例（底部中心，X/Z 從中心、Y 從底）
- 不畫第三角投影符號（§D2：客戶看不懂）

### 3.2 線重（ISO 128-2，base `b = 0.5mm` print / `1.5px` screen）

| 線型 | 寬 | 樣式 | 用途 |
|---|---|---|---|
| 可見輪廓 | `b` | 實線 | 此視圖可見邊 |
| 隱藏線 | `b/2` | dash `3·b` / gap `1.5·b` | 遠側面邊 |
| Mortise 邊（區分用） | `b/2` | dash `2 2`（細虛、跟標準隱藏線區別） | 榫眼位置框 |
| 中心線 | `b/2` | long-dash-dot `12-2-2-2 · b` | 對稱軸、孔心 |
| 標註 / 引線 / 延伸線 | `b/2` | 實線 | dimension 系統 |
| 箭頭 | — | 實心三角，比例 3:1 | 標註端 |

### 3.3 尺寸標註

**Tier 分級（窮舉策略）：**
- **T1（必標）**：L × W × T 外形
- **T2（必標）**：每個榫眼/榫頭的 (基準距、寬、長、深)
- **T3（必標）**：shape-specific 參數（tapered 頂底寬、splay dx/dz、hoof 高、apron-trapezoid 上下邊長 + bevel、lathe 段別表）
- **T4（可選 Phase 3）**：圓角半徑、edge-protection 偏移

**規則：**
- 榫位用 **baseline (datum)**：選定底面或左側面為 0 點，所有榫位從同一面量
- 外形用 **chain**：總長/總寬鏈式
- 對稱件對稱尺寸只標一側
- mm only、不寫單位、最多 1 位小數（用 `feedback_ui_number_precision`）
- 推導值（如 inset = outer − margin × 2）標 `(REF)`

### 3.4 榫卯標註語法

- 通榫：`通榫 W×L 通`
- 盲榫：`W×L 深 D`
- 圓孔：`Ø8 深 20 ×2`
- 中文 + mm，leader 用實線細 + 圓點端（不是箭頭——箭頭只給標註線兩端用）

---

## 4. 必有元素（Phase 1-2）

> 下面的元素清單是 **Phase 1 + Phase 2 結合**後的最終狀態；個別元素的落地階段見 §9。Phase 1 只做三視圖 + T1+T2 尺寸；木紋/面向/3D 縮圖/配對 ID/butt-joint 宣告等屬 Phase 2。

### 4.1 三視圖卡片（Phase 2 完整版示意）

```
┌────────────────────────────────────────────────────┐
│ 腿 ×4                          比例 1:5    P-01    │
├────────────────────────────────────────────────────┤
│  [正視]      [俯視]      [側視]     [3D 縮圖+紅圈]  │
│   ↑grain      ●  ●        ↑grain                   │
│  ┌──┐        ┌────┐       ┌──┐                     │
│  │  │        │    │       │  │                     │
│  │□ │        └────┘       │  │                     │
│  └──┘                     └──┘                     │
│  720          40×40       720                       │
│                                                     │
│  外面 → ← 內面                                     │
│                                                     │
│  榫眼1（頂內）：40×15 深 30，距底 690 ↔ apron-fr T1│
│  榫眼2（頂前）：40×15 深 30，距底 690 ↔ apron-l T1 │
│                                                     │
│  材料：胡桃木 │ 毛料：45×45×750 │ 公差 ±1mm        │
└────────────────────────────────────────────────────┘
```

### 4.2 元素清單

1. **三視圖**（第三角法，local 座標）
2. **整體 L×W×T 標註**（T1）
3. **每個榫眼/榫頭尺寸 + 距邊基準**（T2）
4. **木紋方向箭頭**（每個視圖一個）
5. **面向記號**：「外面」/「內面」/「上」/「下」於非對稱件
6. **3D 安裝位置縮圖**（右上角 ~80×80px，紅圈框該 part）
7. **配對 ID**：榫眼旁註「↔ {other-part-id} 榫頭{N}」
8. **×N 徽章**（標題列右側）
9. **比例**（標題列）
10. **零件編號**（標題列，如 `P-01`）
11. **title block 底列**：材料 / 毛料尺寸 / 公差說明
12. **butt-joint 慣例宣告**（卡片底部小字，一行）：
    `visible.length = 含榫對接長度；裸露長 = visible.length − 2 × 榫長`

---

## 5. 難件特殊渲染（Phase 3）

| Shape | 加 | 為什麼 |
|---|---|---|
| `lathe-turned` | silhouette 半剖 + (段別 Y, 半徑 R) 表 | 車旋件靠輪廓表，不靠尺寸線 |
| `arch-bent` | 弦長 + 矢高（非弧長）+ 1:1 樣板輪廓 | 工匠用弦+矢放樣，弧長算不準 |
| `apron-trapezoid` + bevel | 「上邊長 / 下邊長」雙標 + 端面斜角 θ + 「外側 ↗」 | 梯形 + 半斜面 + 端面雙斜 |
| `splayed-round-tapered` | 真實長度（hypot）+ 兩端面斜角 + 上下徑雙標 | 垂直高 ≠ 真長 |
| `hoof` | 「腳趾朝外」人話 + 腳趾轉折 Y + 毛料厚建議（×1.4） | 方向做反整批報廢 |
| `splayed-tapered` | 上下端長雙標 + 底面偏移 (dx, dz) | 同 trapezoid 邏輯 |

### 5.1 Silhouette gap 修補（Phase 3）

7 個 shape 目前 `projectPartSilhouette` 落 AABB fallback：

| Shape | 處理 |
|---|---|
| `shaker` | 加分支：上段方料 `squareFrac` + 下段錐料 `bottomScale` |
| `notched-corners` | 角落 clip 採樣加進 polygon |
| `finger-joint-ends` | 顯式 comb polygon（n × tooth） |
| `dovetail-ends` | 梯形 comb（per `segmentCount` + `angleDeg`） |
| `face-rounded` / `chamfered-top` | 文檔聲明「3D only」或加微弱 highlight 邊 |
| `live-edge` | 沿外緣採樣波形 |
| `regular-polygon` | 前/側 N-gon vertex 取 hull |

---

## 6. 輸出位置

### 6.1 互動 panel（設計頁）

新 component `<PartDrawingsPanel design />` 進設計頁，放在三視圖下方或獨立 tab。
- 列出所有觸發 predicate 的 part（合併後）
- 點 part → 展開大圖（modal 或 inline）
- 提供放大、上/下件導航
- mobile 友善（卡片橫向滑）

### 6.2 印製頁

在 `app/design/[type]/print/page.tsx` 第 223 與 226 行之間插新 section：

```
順序：
1. Cover
2. 三視圖
3. 材料單
4. 榫卯細節圖
5. 【零件圖】← 新增
6. 工具清單
7. 工序
```

- A4 直式，`<section data-print-page className="px-10 py-12">`
- **預設 2×2 grid**（4 張/頁），每張 ~350×200px
- 難件（lathe-turned / arch-bent / splayed-round-tapered / hoof）強制 **1×2 grid**（2 張/頁，每張 ~700×300px）
- 每張包 `.print-keep`（避免分頁切斷）
- 標題行下方加 cover index（part 總數、頁碼）

### 6.3 共用元件

`<PartDrawing part design />` 是純 SVG renderer，印製跟互動都調用同一個 component。

---

## 7. 排序

依**結構角色**（跟材料單 BOM 順序對齊，便於交叉查照）：

1. 案 / 框（panel / case）
2. 腳（leg）
3. 牙條 / 橫撐（apron / stretcher）
4. 抽屜（drawer）
5. 門板（door）
6. 椅背 / 扶手（back / arm）
7. 五金（hardware）

`categorizePart()` 已有對應 enum 直接用。

---

## 8. 檔案結構

### 新檔

```
lib/render/part-drawing/
  drawing.tsx              ← <PartDrawing part design /> 主元件
  grouping.ts              ← geometry hash + merge ×N
  annotation.ts            ← dimension chain / leader / 標註排版
  install-hint.tsx         ← 3D 安裝縮圖（重用 PerspectiveView with isolatePartId hack）

components/design/
  PartDrawingsPanel.tsx    ← 設計頁互動列表

components/print/
  PrintPartDrawings.tsx    ← 印製頁 section wrapper

docs/drafting-math.md      ← 新增 §A12, §A6.5, §A6.6, §A8.1（Phase 1 同步）
```

### 修改

```
lib/render/svg-views.tsx
  OrthoView({..., isolatePartId?: string, showDimensions?: boolean})
    └─ filter design.parts to [isolatePartId]
    └─ recenter at origin

lib/render/geometry.ts
  projectPartSilhouette
    └─ Phase 3 加 7 個 shape 分支

app/design/[type]/print/page.tsx
  └─ insert <PrintPartDrawings /> after JoineryDetail

app/design/[type]/page.tsx (or detail page wherever 三視圖 lives)
  └─ insert <PartDrawingsPanel />
```

---

## 9. 階段切分

### Phase 1（MVP, est. 2-3 day）
- predicate + grouping
- OrthoView 加 `isolatePartId`
- `<PartDrawing>` 三視圖 + T1+T2 尺寸
- 印製頁 section（2×2 grid only）
- 互動 panel（簡單 list + 點開 modal）
- 跑 26 模板 audit：每個模板都能渲染、無 crash

### Phase 2（est. 1-2 day）
- 木紋箭頭
- 面向記號
- 配對 ID（榫眼 ↔ 對應榫頭）
- 3D 安裝縮圖
- 毛料尺寸雙標
- butt-joint 慣例宣告
- title block 底列

### Phase 3（est. 3-4 day）
- 7 個 shape silhouette gap 補
- 難件特殊渲染（lathe 段別表 / arch-bent 弦+矢 / apron-trapezoid 斜角 / hoof 方向）
- 印製頁 1×2 grid 切換（難件強制）
- 局部放大圖（複雜榫卯）

### Phase 4（可選）
- cover index 頁
- 加工順序提示
- 鋸台/桌鋸設定值
- 1:1 樣板列印支援

---

## 10. drafting-math.md 同步

Phase 1 落地後，補進 doc：

- **§A12（新）**：零件圖規範（local 座標、merge ×N、install hint、title block）— ~600 字
- **§A6.5（新）**：榫卯特徵標註語法（depth callout、距邊 baseline、多榫眼排版）— ~1000 字
- **§A6.6（新）**：尺寸 Tier 分級（T1-T4、推導 REF、冗餘檢測）— ~800 字
- **§A8.1（Phase 3 新）**：局部放大圖（zoom 比例、callout 圓圈、不同於 §B detail）— ~600 字

---

## 11. 驗證

### Phase 1 驗收
- [ ] 26 模板各跑一次 design page + print page，零 crash
- [ ] `audit-overlaps.ts` 不退步
- [ ] `tsc --noEmit` 零錯
- [ ] 隨機抽 5 個 part 對比 `visible.length` 是否落在零件圖正確位置
- [ ] 合併 ×N 數量 vs 材料單數量交叉驗

### Phase 2 驗收
- 同上 + playwright 截圖 5 模板的零件圖，肉眼確認木紋/面向/3D 縮圖

### Phase 3 驗收
- 7 個 shape gap 各驗 1 個 template，silhouette 不再 AABB fallback
- lathe-turned 段別表跟 3D 對得上
- arch-bent 弦+矢算對

---

## 12. 風險

| 風險 | 緩解 |
|---|---|
| OrthoView 加 `isolatePartId` 影響現有三視圖 | 加 default 不啟用、保留現有路徑、加 e2e regression |
| Mirror 判定誤殺（合併過頭/分太多） | 先以 mortise position X-mirror 為唯一判定，後續調 |
| 印製頁 grid 在某些 mortise 密集 part 過擠 | Phase 3 切 1×2，先不擋發 |
| 7 個 shape gap 修補要動 `projectPartSilhouette` 核心 | Phase 3 隔離分支、加 audit test |
| 標註過密 vs 工匠 readability | Tier 分級+對稱省標。如還是擠，加局部放大圖（Phase 3） |

---

## 13. Out of scope

- CNC export（DXF / G-code）
- PDF post-processing（裁邊、頁碼章）
- 印製後手寫修改流程
- 多語系（英文版）
- circle-chair 等未 merge 模板

---

## 14. 開放問題（spec 寫完前最後確認）

- [ ] 排序——預設用「結構角色」（spec §7 列）OK 嗎？
- [ ] 互動 panel 是新 tab 還是 inline section（在三視圖下方）？
- [ ] 配對 ID 寫詳細（「↔ apron-front 榫頭1」）還是簡短代號（「↔ M1」）？傾向詳細，但會擠空間

---

**研究來源：** `docs/superpowers/research/2026-05-16-part-drawings/` 6 份 notes（parts-inventory / geometry-coverage / drafting-standards / doc-alignment / print-layout / maker-needs）+ 1 份檢查報告（_INSPECTION.md）。
