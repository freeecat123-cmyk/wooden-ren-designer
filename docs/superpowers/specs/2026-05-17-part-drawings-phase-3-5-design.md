# 零件圖 Phase 3.5 Design Spec

**Date:** 2026-05-17
**Status:** Simplified — collision-free routing 留 Phase 5

## Scope (simplified)

1 task：DetailCallout simplified — 為複雜榫卯 part 在 front view 渲染一個 2× zoom detail inset，配 straight leader line。沒做：collision-free leader routing、多 detail、3:1/5:1 scale 切換。

## 觸發條件

Part has 至少一個 "interesting" feature：
- ≥2 mortises OR
- 任一 tenon `length >= 40mm` (深盲榫 / 通榫)

挑第 1 個符合的 mortise/tenon 作為 detail target。

## 渲染

front view overlay 中：
1. main view 該 feature 已被 T2Annotations 畫了細虛 box → 在 box 外加一個紅圈（圓心 + 半徑 = box max dim × 0.7）標明「這是 detail」
2. SVG 右下角畫一個 ~60×60 的 detail inset：
   - 用一個小 `<svg>` 嵌套或 `<g transform="translate scale">` 把該 feature local box 放大 2× 顯示
   - inset 外加 border + 「詳圖 A 2:1」標題
3. 一條 straight leader line 從圈圈中心 → inset 邊緣

實作上：DetailCallout 直接畫 inset 在 OrthoViewBoxCtx 提供的 SVG 空間裡，用 `partLocalToSvg` 算 feature 位置。

## Out of scope

- Collision-free leader routing
- 多 detail callout per part
- 圈圈+leader 文字標籤
- 動態 scale (5:1 / 10:1)
- non-front view 也加 callout
