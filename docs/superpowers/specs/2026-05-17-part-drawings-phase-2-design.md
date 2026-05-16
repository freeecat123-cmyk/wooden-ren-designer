# 零件圖 Phase 2 Design Spec

**Date:** 2026-05-17
**Status:** Draft — autonomous mode
**Phase 1 spec:** `2026-05-16-part-drawings-design.md`（baseline）
**Phase 1 PR:** #3 open
**Branch:** `worktree-part-drawings-phase-2`

---

## Scope（6 件事，砍掉樂觀估的 4 件）

Phase 2 v2 spec §8 列了 8 個 Phase 2 元素 + 此 spec 加 T1/T2 SVG → 共 10。實際做 6、其他 defer：

| Phase 2 做 | 估時 |
|---|---|
| 1. T1 SVG overlay（啟用 stub）| 6-8h |
| 2. T2 dashed box（啟用 stub）| 6-8h |
| 3. 木紋方向箭頭 | 3-4h |
| 4. 面向記號（外/內/上/下）| 3-4h |
| 5. 配對 ID（榫眼 ↔ 對應榫頭）| 4-6h |
| 6. butt-joint 慣例宣告小字 | 1h |

**合計 23-31 h ≈ 3-4 day**

| Phase 2.5 / 3 不做 | 為什麼 |
|---|---|
| 3D 安裝縮圖 | PerspectiveView with isolate hack 複雜、Three.js SSR 不友善、卡片擠 |
| 毛料雙標 | 每 shape 規則多（lathe `×1.1` / hoof `×1.4` / box `+5mm` 等），歸 Phase 3 跟難件特殊渲染一起做 |
| title block 底列重設計 | 純美觀、現在的「材料：胡桃木」一行已夠用 |
| 榫卯標註語法細化（通榫/盲榫/Ø）| 通榫 vs 盲榫資料模型沒明確 flag，要從幾何推斷 edge case 多，歸 Phase 3 |

---

## 1. T1 SVG overlay

**問題：** Phase 1 走 text-row 是因 OrthoView 的 viewBox 計算用了非 export 常數（`PADDING=220 / DIM_OFFSET=50 / TITLE_BAR_H=32`）+ per-view 邏輯（vbContentW、drawAreaTop 不同 view 不同）。Phase 2 要解決。

**解法：slot prop pattern**

OrthoView 加 `overlayContent?: (ctx: ViewBoxCtx) => React.ReactNode` slot prop。OrthoView 算好 viewBox 後把 context 物件（vbX, vbY, vbW, vbH, partLocalToSvg(x,y) 轉換函式）傳給 callback。Caller（PartDrawing）用該 context 在正確座標畫 T1Dimensions。

```ts
// 新 export from svg-views.tsx
export interface OrthoViewBoxCtx {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  /** Convert part-local (x, y, z) mm to SVG (x, y) pixels for this view. */
  partLocalToSvg(localX: number, localY: number, localZ: number): { x: number; y: number };
}

// OrthoView prop
overlayContent?: (ctx: OrthoViewBoxCtx) => React.ReactNode;
```

T1Dimensions 改寫成 `(ctx, part, view) => SVG`：
- front view: 底部畫 length 標註（從 part 最左→最右 SVG 座標）；右側畫 thickness 標註
- top view: 底部畫 length；右側畫 width
- side view: 底部畫 width；右側畫 thickness

Phase 1 的 T1DimensionsRow（text-row）保留作 fallback、不刪——印製預覽小時還是 useful。SVG overlay 是 panel modal 大圖看清楚用。

## 2. T2 dashed box

同樣走 slot prop。複用 `mortiseLocalBox(part, m)` + `tenonLocalBox(part, t)` + `projectFeatureRect(part, view, localBox)` 取得每個榫眼/榫頭在當前 view 的 SVG 矩形位置，畫 `<rect stroke-dasharray="2 2" fill="none" stroke="#444" stroke-width="0.6">`。

每個 box 旁邊不畫 leader（Phase 3 才做 collision-free routing）。labels 仍走 T2LabelList 在卡片下方文字列。Box 純標位置。

## 3. 木紋方向箭頭

每視圖右上角小三角箭頭：
- `part.grainDirection === "length"` → 沿 length 軸方向
- `"width"` → 沿 width 軸
- `"thickness"` → 沿 thickness 軸（罕見，板材橫切時）

每 view 對應軸：
- front: length=horiz / width=深 / thickness=vert
- top: length=horiz / width=vert / thickness=深
- side: length=深 / width=horiz / thickness=vert

「深」軸（看不到的軸）→ 畫成 ⊙ 符號（點朝外）或 ⊗（點朝內）。
水平軸 → →/← 箭頭。垂直軸 → ↑/↓ 箭頭。

固定放右上角 padding 8px、長度 12px、stroke 0.5。下方寫小字「順紋」。

## 4. 面向記號（外/內/上/下）

非對稱件需要——例如有榫眼的一面 vs 沒有的一面。判定：哪面有 mortise/tenon 視為「內面」（榫接朝內），另一面是「外面」。

簡化規則 Phase 2：
- 若 part.mortises 全在 `+Z` 軸（後側）→ 後面標「內」、前面標「外」
- 若 part.tenons 在 `+Y`（頂端）→ 頂面標「上」、底面標「下」
- 若全部對稱 → 不標

只在 front view 左上角畫一個小箭頭 + 「外」/「內」/「上」/「下」字。

判斷邏輯加在 `lib/render/part-drawing/annotation.tsx` 新函式 `inferFacing(part): FacingHint | null`。

## 5. 配對 ID

榫眼旁註「↔ {other-part-id} 榫頭{N}」。判定：對於 mortise M of part A，掃 design 所有 tenons T，若 T 在 world 空間跟 M 重疊 → 配對。

簡化 Phase 2：用 origin 距離 + size match 做近似判斷（< 5mm AABB overlap 視為配對）。

加入 T2LabelList 結尾：
```
榫眼1（後左）：30×12 深 25，距底 690　↔ apron-front-2 榫頭1
```

新 helper `findMatchingFeature(part, feature, kind, design)` in `annotation.tsx`。

## 6. butt-joint 慣例宣告

卡片底部一行 8pt 灰字：
```
※ visible.length = 含榫對接長度；裸露長 = visible.length − 2 × 榫長
```

只在 `design.useButtJointConvention === true`（or `!== false`，default true）時顯示。

---

## 架構變動

**修改：**
- `lib/render/svg-views.tsx`：OrthoView 加 `overlayContent` slot prop、export `OrthoViewBoxCtx` type
- `lib/render/part-drawing/annotation.tsx`：
  - T1Dimensions 改寫成 `(ctx, part, view)`、啟用
  - T2Annotations 改寫成 `(ctx, part, view)`、啟用
  - 加 `GrainArrow`、`FacingMark`、`inferFacing`、`findMatchingFeature`
- `lib/render/part-drawing/drawing.tsx`：
  - 每個 OrthoView 用 `overlayContent` 注入 T1+T2+GrainArrow+FacingMark
  - 卡片底加 butt-joint 宣告

**不改：**
- grouping.ts
- PartDrawingsPanel
- PrintPartDrawings

---

## 驗收

Phase 2 acceptance（在 Phase 1 acceptance 之上）：
- [ ] 28 模板每個跑 panel + print 零 crash
- [ ] tsc + audit 不退步
- [ ] 隨抽 3 個 part 看 T1 SVG overlay 數字對齊
- [ ] 隨抽 3 個 part 看 T2 dashed box 落在 mortise/tenon 位置
- [ ] 木紋箭頭方向跟 part.grainDirection 一致
- [ ] 配對 ID 寫到合理對象（不是空 / 不是 leg-fl 配自己）
- [ ] butt-joint 宣告在 design.useButtJointConvention 預設 true 時出現

---

## Out of scope

- Phase 2.5：3D 安裝縮圖 / 毛料雙標 / title block 重設計 / 榫卯語法細化
- Phase 3：難件特殊渲染 + 7 silhouette gap + 1×2 grid 切換 + 局部放大圖
- drafting-math.md §A12 / §A6.5 / §A6.6 同步（單獨 doc task）
