# 零件圖（Part Shop Drawing）Design Spec — v2

**Date:** 2026-05-16
**Status:** Draft — pending user review（v1 砍 35% 冗餘）
**Scope:** **Phase 1 MVP only.** Phase 2/3/4 待 Phase 1 落地後另寫 spec。
**Research:** `docs/superpowers/research/2026-05-16-part-drawings/`（6 notes + 2 inspections）

---

## Motivation

wrd 缺 **per-part 製造圖**。複雜零件（含榫眼、含榫頭、或非方料）使用者做不出來——三視圖看整套、榫卯細節圖教技法，但沒人告訴他「這根左前腿要 720mm、距底 690 處開 40×15×30 榫眼」。

跟榫卯細節圖**不重複**：細節圖 = per joint **type** 技法；零件圖 = per **具體零件** 製造尺寸。

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

純方料無榫無造型 → 不出零件圖。

### 1.2 規模估算（28 templates）

- 28 furniture templates × 平均 ~12 part ≈ ~340 part
- 觸發 predicate ≈ ~240 part
- 合併 ×N + mirror 分張後 ≈ ~85–110 張獨立圖
- 重災區：座椅 / 凳 / 桌 / bench / dining-chair / bar-stool（每套 6–10 張）
- 輕災區：櫥櫃類（每套 1–4 張）

### 1.3 不在範圍

- `circle-chair`（PR #2 未 merge）——predicate 自動覆蓋，但 swept-curve silhouette / 楔釘榫展開 等特殊渲染歸 Phase 3
- Phase 2/3/4 全部元素（見 §7）

---

## 2. 合併規則

### 2.1 Geometry hash

```ts
type PartGeometryHash = {
  visible: Dimensions;     // L×W×T
  shape: Part["shape"];    // kind + 所有參數
  tenons: TenonSig[];      // sorted by position
  mortises: MortiseSig[];  // sorted by position
};
```

Hash 全等 → 一張圖、標題標 ×N。

### 2.2 Mirror 分張

左/右腿即使對稱也分兩張——榫眼 X 鏡像，工匠按單張會做成同手。
判定：榫眼/榫頭 `position` X 翻號 → 不同件。

### 2.3 邊界

- ×N 上限 99；超過顯示「×99+」
- 同模板零觸發 part（極端 case） → 整 section 不渲染、不顯示空 placeholder

---

## 3. 排序

依 `categorizePart()` 結構角色（跟材料單 BOM 對齊）：
1. case / panel / 框
2. leg / 腳
3. apron / stretcher / 牙條 / 橫撐
4. drawer / 抽屜
5. door / 門板
6. back / arm / 椅背扶手
7. hardware / 五金
8. **unknown** —— `categorizePart` 回 unknown 的 part 排最後、組內按 `part.id` 字典序

---

## 4. 內容（Phase 1 only）

### 4.1 三視圖卡片（Phase 1 最小狀態示意）

```
┌────────────────────────────────────────┐
│ 腿 ×4                  比例 1:5   P-01 │
├────────────────────────────────────────┤
│  [正視]      [俯視]      [側視]         │
│  ┌──┐        ┌────┐      ┌──┐          │
│  │  │        │    │      │  │          │
│  │□ │        └────┘      │  │          │
│  └──┘                    └──┘          │
│  720          40×40      720           │
│                                        │
│  榫眼1: 40×15×30  距底 690            │
│  榫眼2: 40×15×30  距底 690            │
│                                        │
│  材料：胡桃木                          │
└────────────────────────────────────────┘
```

### 4.2 Phase 1 必有元素（**只有這 7 件**）

1. **三視圖**（第三角法、local 座標、length 軸水平）
2. **整體 L×W×T 標註**（T1）
3. **榫眼/榫頭 bounding box 投影 + 「W×L×D 距邊 X」標**（T2）
4. **×N 徽章 + 比例 + 零件編號**（標題列）
5. **材料**（卡片底）
6. **2×2 grid 印製 section**（不切換 1×2、不分難件）
7. **互動 panel**（列表 + 點 part 開大圖 modal）

**不做（Phase 2+）：** 木紋箭頭 / 面向記號 / 3D 安裝縮圖 / 配對 ID 詳寫 / butt-joint 慣例宣告小字 / 毛料雙標 / title block 底列。

### 4.3 線重慣例

沿用 `svg-views.tsx` 既有規則：粗實線 = 可見邊、細實線 = 標註、細虛線 = 隱藏邊。Phase 2 再依 ISO 128-2 細化分層。

### 4.4 榫卯標註

Phase 1：bounding box（細虛 `2 2` 區別標準隱藏線）+ leader 引到一行文字「W×L 深 D，距底 X」。中文+mm、最多 1 位小數。不分通榫/盲榫的細語法（Phase 2）。

---

## 5. 架構與輸出

### 5.1 共用 component

```tsx
<PartDrawing part={part} design={design} />
```
純 SVG renderer，**互動 panel 跟印製 section 都調用同一個**。

### 5.2 OrthoView 擴展

```tsx
// lib/render/svg-views.tsx:644
export function OrthoView({
  ...,
  isolatePartId?: string,    // 新
  showDimensions?: boolean,  // 新（預設 true）
}) {
  // 若 isolatePartId，把 design.parts filter 到單件、recenter 到 origin
  // 否則行為不變
}
```
**Default 行為不啟用**——既有三視圖完全不受影響。

### 5.3 互動 panel 位置

**Inline section** 放在三視圖下方（不開新 tab）。理由：少做 tab 切換 UI、滾動瀏覽更直覺。Mobile：橫向滑卡片。

### 5.4 印製 section 位置

```
插入：JoineryDetail 結束後、PrintToolList 之前
（具體：在 `{usages.length > 0 && (...)}` 區塊後、`<PrintToolList />` 前）
```
- `<section data-print-page className="px-10 py-12">`
- 2×2 grid，每張 `.print-keep`
- 卡片過大強制單張一頁（auto break-before-page）

### 5.5 isolatePartId 資料流

```
PartDrawingsPanel.tsx  ──selectedPartId──>  <PartDrawing> ──prop──>  OrthoView
PrintPartDrawings.tsx  ──for each merged──>  <PartDrawing>
```
印製不需要 panel state——直接 map 過合併後的 group。

---

## 6. 檔案結構

**新檔：**
```
lib/render/part-drawing/
  drawing.tsx           ← <PartDrawing> SVG component
  grouping.ts           ← geometry hash + merge ×N + mirror 分張
components/design/
  PartDrawingsPanel.tsx ← 互動 panel
components/print/
  PrintPartDrawings.tsx ← 印製 section
```

**修改：**
```
lib/render/svg-views.tsx        ← OrthoView 加 isolatePartId / showDimensions
app/design/[type]/print/page.tsx ← 插 <PrintPartDrawings/>
app/design/[type]/page.tsx       ← 插 <PartDrawingsPanel/>（或最近的三視圖容器）
```

---

## 7. 時程 + Phase 1 task 預估（為 writing-plans 鋪路）

**Phase 1 全部估 5-6 day（44-52 h）：**

| Task | 時數 |
|---|---|
| predicate + grouping（hash + mirror + ×N + 上限） | 4-6h |
| OrthoView 加 isolatePartId（含 recenter / filter） | 3-4h |
| `<PartDrawing>` 3-view + T1（外形）+ T2（榫卯 bbox）渲染 | **8-12h（最長一條）** |
| 標註 layout（leader、文字避撞、簡單 rule-based 不做 collision-free routing） | 6-8h |
| 卡片標題列（×N / 比例 / 編號 / 材料） | 2-3h |
| PartDrawingsPanel（列表 + 點開 modal + 上下件） | 4-6h |
| PrintPartDrawings（2×2 grid + `.print-keep`） | 3-4h |
| 28 模板 audit（每個都跑、修 edge case） | 4-8h |
| TypeScript / `audit-overlaps` 不退步 | 2-3h |

長線在 SVG 標註 layout——文字撞、leader 角度、多榫眼的排版是 phase 1 最容易爆時數的部份。

### Phase 1 驗收（最小）

- [ ] 28 模板每個跑 design page + print page，零 crash
- [ ] `tsc --noEmit` 零錯、`scripts/audit-overlaps.ts` 不退步
- [ ] 隨抽 5 個 part 比對 spec 上的 `visible.length` 跟圖上 L 一致
- [ ] 合併 ×N 數量 = 材料單同類 part 數量

---

## 8. Out of scope（Phase 2/3/4 各自開 spec）

- **Phase 2**：木紋方向箭頭 / 面向記號 / 3D 安裝縮圖 / 配對 ID 詳註 / 毛料雙標 / butt-joint 慣例宣告 / title block 底列 / 榫卯標註語法（通榫/盲榫/Ø）細化
- **Phase 3**：難件特殊渲染（lathe 段別表 / arch-bent 弦+矢 / apron-trapezoid 雙邊長 + bevel / hoof / splayed-round-tapered）/ 7 個 shape silhouette gap 修補（shaker / notched-corners / finger-joint-ends / dovetail-ends / face-rounded / live-edge / regular-polygon）/ 印製頁 1×2 強制切換 / 局部放大圖
- **Phase 4（可選）**：cover index 頁 / 加工順序 / 鋸台桌鋸設定值 / 1:1 樣板列印
- **drafting-math.md §A12 / §A6.5 / §A6.6 / §A8.1 同步**：Phase 1 落地後另開 doc task，不綁這 spec
- **永遠不做**：CNC export（DXF / G-code）、PDF post-processing、多語系

---

## 9. 開放問題（v2 已預設、user 否決就改）

| # | 問題 | 預設 |
|---|---|---|
| 1 | 排序 | 結構角色（§3 列）— unknown 尾排 |
| 2 | 互動 panel 位置 | 三視圖下方 inline section（不開 tab） |
| 3 | 配對 ID 簡/詳 | 預設**不出現**（Phase 2 才加） |

不滿意預設你直接說、改 spec 即可。

---

**研究來源：** `research/2026-05-16-part-drawings/` 6 notes + `_INSPECTION.md` + `_SPEC_VERIFICATION.md`
