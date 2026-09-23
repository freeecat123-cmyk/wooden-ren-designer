# 零件圖 Phase 2.5 Design Spec

**Date:** 2026-05-17
**Status:** Draft — autonomous mode
**Branch:** `worktree-part-drawings-phase-2.5`
**Base:** Phase 3 end `3434d4e`

---

## Scope（4 element + smoke = 5 task）

| Phase 2.5 做 | 估時 |
|---|---|
| 1. 安裝位置縮圖（SVG mini three-view 標出 target part）| 4-5h |
| 2. 毛料雙標（成品 vs 毛料 per shape）| 4-5h |
| 3. title block 底列重設計（圖框感、編號/比例/材料/公差 整齊一行）| 2-3h |
| 4. 榫卯標註語法細化（通榫 / 盲榫 / Ø 自動偵測）| 3-4h |
| 5. Final smoke + commit | 1h |

**合計 14-18h ≈ 2-3 day**

---

## 1. 安裝位置縮圖（InstallHint）

**避開 Three.js**：不用 `<PerspectiveView>`（client-only、Three.js SSR 不友善），改用既有 SVG `<ThreeViewLayout>` 或 `<OrthoView>` 縮小成 ~80×80px、target part 著紅。

實作：
- 新 component `<InstallHintMini design highlightPartId />` in `lib/render/part-drawing/install-hint.tsx`
- 內部呼叫 `<OrthoView design view="front" />`（縮放）+ 用 CSS `[data-part-id="..."] { fill: #dc2626 !important; }` 覆蓋顏色
- 放在 PartDrawing 右上角絕對定位

OrthoView 需要 export part 對應的 SVG element 帶 `data-part-id` 屬性。確認後標 highlight。

**Fallback：** 若 OrthoView 不能輕鬆標 part id，畫一個非常簡化的家具 bbox + 該 part 位置 dot（從 part.origin 推 X/Y 比例）。可接受 ~50×50px 簡圖。

## 2. 毛料雙標

每張卡片底加「成品 W×D×H ／ 毛料 W'×D'×H'」一行，毛料 = 成品 + 材料浪費 buffer。

Per-shape rule（記 `lib/render/part-drawing/raw-stock.ts`）:

```ts
function rawStockSize(part: Part): { L: number; W: number; T: number } {
  const visible = part.visible;
  const shape = part.shape;
  
  // Default：成品 +5mm 兩端餘量 + 2mm 刨光
  let L = visible.length + 10 + 2;
  let W = visible.width + 4;
  let T = visible.thickness + 2;
  
  // shape-specific multipliers
  if (shape?.kind === "lathe-turned") {
    // 車旋件：徑向放 1.15×，端面 +20mm 留車削餘量
    W = visible.width * 1.15;
    T = visible.thickness * 1.15;
    L = visible.length + 20;
  } else if (shape?.kind === "hoof") {
    // 馬蹄腳：legSize × hoofScale 含腳趾段
    const hoofScale = (shape as any).hoofScale ?? 1.4;
    W = visible.width * hoofScale;
    T = visible.thickness * hoofScale;
  } else if (shape?.kind === "round" || shape?.kind === "round-tapered" || shape?.kind === "splayed-round-tapered") {
    // 圓料：直徑 +6mm 車削餘量
    W = visible.width + 6;
    T = visible.thickness + 6;
  } else if (shape?.kind === "arch-bent") {
    // 弧形件：弦+矢的對角放大 +10%
    L = visible.length * 1.1;
  } else if (shape?.kind === "splayed-tapered") {
    // 外斜錐料：依 dx/dz 偏移加長
    const dx = (shape as any).dxMm ?? 0;
    const dz = (shape as any).dzMm ?? 0;
    L = Math.sqrt(visible.length ** 2 + dx ** 2 + dz ** 2) + 12;
  }
  
  return { L: Math.round(L), W: Math.round(W), T: Math.round(T) };
}
```

PartDrawing 卡片底新增：
```
成品 35×35×425　|　毛料 47×47×445
```

## 3. title block 底列重設計

現況：底部一行「材料：胡桃木」+ butt-joint 宣告。Phase 2.5 升級成正規 title block 表格列：

```
┌────────────────────────────────────────────┐
│ ...drawing content...                       │
├──┬───────┬──┬──────┬──┬──────┬──┬────┬─────┤
│編號│P-01│名稱│左前腿×4│材料│胡桃木│比例│1:5│公差│±1mm│
├──┴───────┴──┴──────┴──┴──────┴──┴────┴─────┤
│ ※ visible.length = 含榫對接長度...           │
└────────────────────────────────────────────┘
```

`<TitleBlock part group index />` in `annotation.tsx` 或 `drawing.tsx`：分隔線 + 表格化欄位 + butt-joint footer 整合。

## 4. 榫卯標註語法細化

T2LabelList 現在格式：「榫眼1（X）：W×L 深 D，距底 Y」

升級：偵測通榫 vs 盲榫：
- 通榫：mortise.depth >= part.visible.thickness (or some axis) → 標「通」
- 盲榫：mortise.depth < thickness → 標「深 D」（原樣）

榫頭：同樣 length vs 對接 part thickness → 通/盲。

預備 Ø（圓孔/dowel）支援：若資料有 `kind: "round-hole"` 之類 flag → 標「Ø8 深 20」。Phase 2.5 暫時跳過 dowel（資料模型沒明確 round-hole）、只做通/盲。

T2LabelList 升級：
- 通榫：「榫眼1（X）：W×L 通」（不寫深）
- 盲榫：「榫眼1（X）：W×L 深 D」（不變）

## 5. Final smoke

audit 加：
- InstallHintMini 在 PartDrawing render 出現
- 毛料雙標出現
- title block 結構出現
- 通榫/盲榫詞彙各≥1 出現

---

## Out of scope
- 真 3D 縮圖（Three.js client-side）—— Phase 4 或永不（SVG mini 夠用）
- 局部放大圖（Phase 3.5）
- Ø dowel 支援（資料模型限制）
- 多語系
