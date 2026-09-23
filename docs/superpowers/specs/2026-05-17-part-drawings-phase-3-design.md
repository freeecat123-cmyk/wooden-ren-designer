# 零件圖 Phase 3 Design Spec

**Date:** 2026-05-17
**Status:** Draft — autonomous mode (user 授權兩個 phase 都做、P3 先)
**Phase 2 spec:** `2026-05-17-part-drawings-phase-2-design.md`
**Phase 2 PR:** #4 open (base=PR #3)
**Branch:** `worktree-part-drawings-phase-3`

---

## Scope（7 tasks）

Phase 3 補匠師 must-have：**難件特殊渲染**（maker-needs.md §1-§7 列了一堆「正投影不夠」的 case）+ **silhouette gap 補**（geometry-coverage.md 標了 7 個 shape 落 AABB fallback）。

| Phase 3 做 | 估時 |
|---|---|
| 1. ShapeSpecificAnnotation 框架 + lathe 段別表 | 5-7h |
| 2. arch-bent 弦長 + 矢高 + 1:1 樣板輪廓 | 3-4h |
| 3. apron-trapezoid 上下邊雙標 + bevel 角度 | 4-5h |
| 4. hoof 馬蹄腳「腳趾朝外」+ 轉折 Y + 毛料厚建議 | 3-4h |
| 5. splayed-tapered / splayed-round-tapered 真長 + 上下徑 | 3-4h |
| 6. 7 silhouette gap 補（shaker / notched / finger-joint / dovetail / face-rounded / live-edge / regular-polygon） | 8-12h |
| 7. 1×2 grid 切換難件強制 + Phase 3 28-template smoke | 3-4h |

**合計 29-40h ≈ 4-5 day**

| Phase 3.5 不做 | 為什麼 |
|---|---|
| 局部放大圖（detail callout）| Collision-free routing 複雜、Phase 3 已飽和、留 Phase 4 |

---

## 1. ShapeSpecificAnnotation 框架

新元件 `<ShapeSpecificAnnotation ctx part view />` 在 `annotation.tsx` 加入 PartDrawing 的 overlayContent fragment。

```tsx
export function ShapeSpecificAnnotation({ ctx, part, view }) {
  if (!part.shape) return null;
  switch (part.shape.kind) {
    case "lathe-turned": return <LatheSegmentTable ctx={ctx} part={part} view={view} />;
    case "arch-bent": return <ArchBentChord ctx={ctx} part={part} view={view} />;
    case "apron-trapezoid": return <ApronTrapezoidDualEdge ctx={ctx} part={part} view={view} />;
    case "hoof": return <HoofDirection ctx={ctx} part={part} view={view} />;
    case "splayed-tapered":
    case "splayed-round-tapered": return <SplayedTrueLength ctx={ctx} part={part} view={view} />;
    default: return null;
  }
}
```

### 1.1 LatheSegmentTable

`lathe-turned` 用 12 個 hard-coded `LATHE_SEG` 段（在 svg-views.tsx 1006-1039）。每段半徑 = `legSize/2 × scaleFactor`、高度比例。

side view 下方畫一個 (段別 N, Y from bot, 半徑 R) 表格：

```
段│ Y │ R
─┼────┼───
1│ 0  │ 18
2│ 25 │ 21
...
12│425│ 16
```

字級 7px、單行高 10px。export `LATHE_SEG` constant from svg-views.tsx.

### 1.2 ArchBentChord（Phase 3 Task 2）

`arch-bent` 用 `bendMm` 弧度 + 部件 `length`。

front view 上方標：
- 弦長 = visible.length（直線距）
- 矢高 = bendMm

側邊小字「弧切向順紋」。配 simulation：1:1 樣板 dash 輪廓（細虛 dash 4-2）疊在 front silhouette 旁邊。

### 1.3 ApronTrapezoidDualEdge（Task 3）

`apron-trapezoid` shape 有 `topLengthScale` + `bottomLengthScale` + optional `bevelAngle`。

top view 標：
- 上邊長 = visible.length × topLengthScale
- 下邊長 = visible.length × bottomLengthScale

側視標：
- 端面斜角 θ（從 bevelAngle 推），單位 °

front view 角標小箭頭「外側 ↗」（從 part 在世界座標 X/Z sign 推方向）。

### 1.4 HoofDirection（Task 4）

`hoof` shape：`hoofMm` (高)、`hoofScale` (放大倍數)、`dirX`/`dirZ` (外撇方向)。

front + side view 加：
- 「腳趾朝 → / ← / ↑ / ↓」中文（不寫 dirX/dirZ 變數名）
- 腳趾轉折 Y = visible.thickness - hoofMm（從底往上量）標一條 dim line
- 毛料厚建議：`legSize × hoofScale`（卡片底加一行）

### 1.5 SplayedTrueLength（Task 5）

`splayed-tapered` / `splayed-round-tapered`：有 `dxMm`/`dzMm` 偏移 + `bottomScale` 錐度。

front view 標：
- 真實長度 L_real = √(visible.length² + dxMm² + dzMm²)
- 兩端面斜角 = atan2(√(dxMm² + dzMm²), visible.length)

top view（splayed-round-tapered）：
- 頂徑 = visible.width / 2
- 底徑 = visible.width × bottomScale / 2

---

## 2. Silhouette gap 補（Task 6）

7 個 shape 目前 `projectPartSilhouette` 落 AABB。改 `lib/render/geometry.ts`：

| Shape | 解法 |
|---|---|
| `shaker` | 上段方料 squareFrac + 下段錐料 bottomScale → 兩段 polygon 合 |
| `notched-corners` | 角落 clip：corner radius 採樣加進 outline |
| `finger-joint-ends` | 顯式 comb polygon（per `segmentCount` + `fingerWidth`）|
| `dovetail-ends` | 梯形 comb（per `segmentCount` + `angleDeg`）— 注意 Phase 1 dovetail 已部分實作（user 的 tray dovetail 工作），不要 break |
| `face-rounded` / `chamfered-top` | 文檔聲明「3D only」加 JSDoc 警告、不畫差 |
| `live-edge` | sine wave 沿外緣採樣 |
| `regular-polygon` | 前/側 N-gon vertices hull |

每個分支加 audit test：建一個 test part with shape → silhouette polygon point count > 4 (not AABB)。

---

## 3. 1×2 grid 切換（Task 7）

`<PrintPartDrawings>` 偵測 group 的 `representative.shape.kind` 屬於「hard shapes」清單 → 該 group 強制單列（col-span-2）。

```tsx
const HARD_SHAPES = new Set([
  "lathe-turned", "arch-bent", "apron-trapezoid",
  "hoof", "splayed-tapered", "splayed-round-tapered"
]);

const isHard = (g) => g.representative.shape && HARD_SHAPES.has(g.representative.shape.kind);
```

CSS：在 grid items 上 `col-span-2`。

互動 panel 不切換（modal 已大）。

---

## 4. 驗收

- [ ] 28 模板 panel + print 零 crash
- [ ] tsc + audit 不退步
- [ ] 隨抽 lathe 看段別表（coat-rack column）
- [ ] 隨抽 arch-bent 看弦+矢（bench windsor 背？或 dining-chair back rail）
- [ ] 隨抽 apron-trapezoid 看上下邊雙標
- [ ] 隨抽 hoof 看方向 + 腳趾轉折
- [ ] silhouette gap 7 shape 各驗 silhouette 不再 AABB
- [ ] 1×2 grid 切換在難件出現（不破壞輕件 2×2）

---

## 5. Out of scope

- 局部放大圖（Phase 3.5 或 4）
- 木紋/面向/配對 ID/butt-joint 宣告（Phase 2 已做）
- 3D 縮圖（Phase 2.5）
- 毛料雙標通用版（Phase 2.5）— 此 spec 只在 hoof/lathe 等難件加 hint，通用版 Phase 2.5
