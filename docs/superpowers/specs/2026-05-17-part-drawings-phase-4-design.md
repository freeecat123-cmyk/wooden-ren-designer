# 零件圖 Phase 4 Design Spec

**Date:** 2026-05-17
**Status:** Draft — autonomous mode (P3.5 待後續)
**Base:** Phase 2.5 end `4f92a9d`
**Branch:** `worktree-part-drawings-phase-4`

---

## Scope（4 element + smoke = 5 task）

| Phase 4 做 | 估時 |
|---|---|
| 1. Cover index 頁（零件清單表格）| 3-4h |
| 2. 加工順序建議（per-part 工序）| 3-4h |
| 3. 鋸台設定值提示（斜角件）| 2-3h |
| 4. 1:1 樣板列印頁（curved/lathe 件）| 4-5h |
| 5. Final smoke | 1h |

**合計 13-17h ≈ 2-3 day**

---

## 1. Cover index 頁

印製頁順序：cover → 三視 → 材料單 → 榫卯 → **【零件清單索引】** → 零件圖 → 工具 → 工序

新 component `<PartDrawingsIndex design />` 在 `components/print/`，插在 `PrintPartDrawings` 之前。

表格欄位：
| 編號 | 名稱 | ×N | 成品 | 毛料 | 材料 | 工法 |
|---|---|---|---|---|---|---|
| P-01 | 左前腿 | ×4 | 35×35×425 | 47×47×445 | 胡桃木 | 車旋 |
| P-02 | 前牙條 | ×1 | 350×60×20 | 362×64×22 | 胡桃木 | 帶肩榫 |
| ... |

「工法」欄是 derived hint：
- `shape.kind === "lathe-turned"` → 「車旋」
- `mortises.length > 0 && tenons.length > 0` → 「榫眼+榫頭」
- `mortises.length > 0` → 「鑿榫眼」
- `tenons.length > 0` → 「開榫頭」
- 否則 → 「鋸刨」

24 個 part group 一頁可裝；超過分頁。

## 2. 加工順序建議

每張卡片底加「工序」一行（在 title block 之後）：

per-shape default工序：
- box + tenons + mortises：「鋸料 → 刨平 → 鑿榫眼 → 開榫頭 → 試裝」
- box + tenons only：「鋸料 → 刨平 → 開榫頭」
- box + mortises only：「鋸料 → 刨平 → 鑿榫眼」
- lathe-turned：「圓鋸下料 → 車旋 → 細砂 → 鑿徑向榫眼」
- arch-bent：「鋸出輪廓 → 蒸彎/疊層 → 刨光」
- hoof：「鋸毛料 → 劃線 → 鑿/刨腳趾段 → 馬蹄收尾」
- splayed-*：「鋸料 → 計算傾角 → 刨平 → 開榫」
- apron-trapezoid：「鋸料 → 桌鋸斜切兩端 → 鑿榫頭 → 試裝」

新檔 `lib/render/part-drawing/process-steps.ts` 維護規則 + 提供 `inferProcessSteps(part): string[]`。

PartDrawing 渲染：
```
工序：鋸料 → 刨平 → 鑿榫眼 → 開榫頭 → 試裝
```

## 3. 鋸台設定值提示

僅針對特定斜角件加：

- `apron-trapezoid` + bevel：「桌鋸鋸片左/右傾 {bevel°}」
- `splayed-tapered` / `splayed-round-tapered`：「斜切鋸 {端面斜°}（端面）」
- `hoof`：「劃線後手鑿 / 帶鋸切除腳趾餘料」

整合到 `ShapeSpecificAnnotation` 的對應子元件、或加在「工序」之後一行：

```
鋸台：桌鋸鋸片左傾 7° + 擋板偏 5°
```

只有特定 shape 出現、其他 part 不打擾。

## 4. 1:1 樣板列印頁

新印製頁 section after `PrintPartDrawings`：

`<PrintTemplates design />` —— 蒐集所有 curved/lathe/arch-bent 件，繪製 1:1 比例輪廓供工匠剪下貼擋板用。

只挑這些 shape：
- `arch-bent`
- `lathe-turned`
- `hoof`
- `live-edge`（若有）

每件一頁（樣板要大），SVG width/height 設成實際 mm（用 CSS `width: ${L}mm`），CSS `@media print` 控制比例正確。

頁面標題：「樣板 — {part.nameZh}（1:1 真實尺寸）」
副題：「沿外輪廓剪下、貼擋板使用」

如果 design 沒有任何 curved part → section 不渲染。

## 5. Final smoke

audit 加：
- PartDrawingsIndex 渲染含 P-NN 行
- 卡片有「工序：」
- 鋸台提示出現在斜角件
- 1:1 樣板頁在有 curved 件時出現

---

## Out of scope（Phase 3.5 或永不）

- 局部放大圖（detail callout、leader routing）— Phase 3.5
- 真 3D 縮圖（Three.js client island）— maybe never
- 多語系 / CAD export
- 動態加工順序學習 / AI suggestion
