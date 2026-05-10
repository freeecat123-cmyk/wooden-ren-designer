# 12 種榫卯細節圖統一視覺規範（Unified Visual Spec）

> 撰寫者：architect agent
> 日期：2026-05-09
> HEAD：`1146094`
> 範圍：`lib/joinery/details.tsx` 12 個 `XxxDetail` function 重構
> 既有 helper：`lib/joinery/draw-primitives.tsx`（17 個 helper + 30+ 常數已 freeze）
> 配套文件：`iso-style-spec.md`（等角圖規範）、`redraw-spec.md`（Phase 2 重繪規範）
>
> **問題根因**：12 個 detail 各自寫 SVG width/height、各自算 `pxPerMm`、各自排 quadrant、各自選 font size。
> 結果：通榫畫得滿、舌槽小一半、半搭尺寸 label 飛出 quadrant、有的有 SectionMark 有的沒有。
>
> **目標**：抽出「Master Layout」+「Unified Scale Algo」+「Safe DimSide」三大共通機制，
> 12 個 detail 只負責畫「物件本身的 4 個 ReactNode」，其餘交給 master 統一處理。

---

## A. SVG Canvas 標準

### A.1 統一畫布尺寸

| 項目 | 值 | 理由 |
|---|---|---|
| **width** | `960px` | 既有 `redraw-spec.md` 已採用、現有部分 detail 已 hard-code 960，遷移成本最低 |
| **height** | `720px` | 比現有 680 加 40，預留 footer TitleBlock 60+10 padding；4 quadrant 各 335 仍夠用 |
| **viewBox** | `"0 0 960 720"` | 1:1 對應 px，所有子元件用 px 單位（mm 透過 scale 換算） |
| **xmlns** | `"http://www.w3.org/2000/svg"` | 顯式宣告（既有 detail 沒寫，輸出 .svg 檔給木工用會壞） |
| **preserveAspectRatio** | `"xMidYMid meet"` | 縮圖等比例置中，不變形 |

### A.2 Canvas Layout 切割（總高 720）

```
y=0    +---------------------------+---------------------------+   ← 頂端
       |                           |                           |
       |   Quadrant 1: 正視圖 FRONT |   Quadrant 2: 側視圖 SIDE  |   高 335
       |   (0,0) → (470, 335)      |   (490,0) → (960, 335)    |
y=335  +---------------------------+---------------------------+
       |                           |                           |
       |   Quadrant 3: 俯視圖 TOP   |   Quadrant 4: 等角圖 ISO   |   高 335
       |   (0,345) → (470, 680)    |   (490,345) → (960, 680)  |
y=680  +-------------------------------------------------------+
       |                                                       |
       |              TitleBlock (footer)                       |   高 50
y=720  +-------------------------------------------------------+
```

**理由**：4 quadrant 排列順序遵循**第一角投影法**（中華民國 CNS 與日本 JIS 標準）：
- **Q1**（左上）= 正視圖
- **Q2**（右上）= 側視圖（從正面右側看）
- **Q3**（左下）= 俯視圖（從正面上方看，畫在正視圖正下方）
- **Q4**（右下）= 等角圖（補充立體感）

> 註：歐美第三角投影法 Q2/Q3 順序相反。木頭仁是台灣木工教材慣例 → 用第一角法。
> 黃俊傑老師 CAD 圖（插肩榫-08）也用第一角，與此一致。

### A.3 Quadrant Bounding Box

```ts
export const CANVAS = {
  W: 960,
  H: 720,
  GAP: 20,         // quadrant 之間的水平/垂直間距
  FOOTER_H: 50,    // TitleBlock 區
  PADDING_OUTER: 0, // 整個 canvas 外緣（已含在 GAP 內）
} as const;

export const QUADRANT = {
  W: 470,          // (960 - GAP) / 2
  H: 335,          // (720 - FOOTER_H - GAP - 0) / 2 - 2.5 (floor)
  PADDING: 20,     // quadrant 內物件離邊界
  HEADER_H: 22,    // quadrant 頂部標題列高度（"正視圖 FRONT"）
  LABEL_RESERVE: 35, // 預留尺寸線 label 的外圈空間（top/bottom/left/right 都這寬）
} as const;
```

**Quadrant 編號→座標映射**（給 `MasterDetailLayout` 內部用）：

```ts
export const QUADRANT_POS = {
  Q1: { x: 0,                              y: 0 },              // 正視
  Q2: { x: QUADRANT.W + CANVAS.GAP,        y: 0 },              // 側視
  Q3: { x: 0,                              y: QUADRANT.H + CANVAS.GAP }, // 俯視
  Q4: { x: QUADRANT.W + CANVAS.GAP,        y: QUADRANT.H + CANVAS.GAP }, // 等角
  FOOTER: { x: 0,                          y: 2 * (QUADRANT.H + CANVAS.GAP) },
} as const;
```

---

## B. 4 Quadrant 規範

### B.1 每個 Quadrant 內部結構

```
+--------------------------------------------+
|  ←─── HEADER_H=22 ───→                     |  ← y=0~22 標題列「正視圖 FRONT」
|     "正視圖 FRONT"  (centered, 10px bold)   |
+--------------------------------------------+
|  ↑ PADDING=20                              |
|  ←-PADDING=20→                             |
|                                            |
|     +------------------------------+       |  ← 物件可用區 (USABLE)
|     |                              |       |     usableW = 470 - 2*20 - 2*35 = 360
|     |    OBJECT (drawn here)       |       |     usableH = 335 - 22 - 2*20 - 2*35 = 203
|     |                              |       |     ※ 預留上下左右 LABEL_RESERVE=35 給尺寸線
|     +------------------------------+       |
|                                            |
|  ↓ PADDING=20                              |
+--------------------------------------------+
```

### B.2 Quadrant Header（標題列）

```ts
function QuadrantHeader({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <text
      x={x + QUADRANT.W / 2}
      y={y + 16}
      fontSize={FONT.LABEL}      // 10px
      textAnchor="middle"
      fontWeight="bold"
      fill={COLOR.OUTLINE}
    >
      {label}
    </text>
  );
}
```

固定 4 個 label：`"正視圖 FRONT"`、`"側視圖 SIDE"`、`"俯視圖 TOP"`、`"等角圖 AXONOMETRIC"`。

### B.3 Quadrant 邊框（Optional Debug）

```ts
// 預設不畫；audit/debug mode 顯示 dashed 灰框幫對齊
function QuadrantFrame({ x, y, debug = false }) {
  if (!debug) return null;
  return <rect x={x} y={y} width={QUADRANT.W} height={QUADRANT.H}
    fill="none" stroke="#ddd" strokeWidth={0.5} strokeDasharray="2 2" />;
}
```

---

## C. 物件尺寸比例算法（**最關鍵**）

### C.1 問題

現況：12 個 detail 各自算 `pxPerMm`（如 `s = QUAD_H / maxMm`、`fitScale(maxMm, maxPx)` 等），結果：
- `through-tenon` 用 `maxMm = max(cw*4, mt+ct*5, tl*8)` → 物件偏大
- `dowel` 用 `maxMm = max(cw, mt+ct)` → 物件偏小
- `mitered-spline` 沒考慮 45° 對角線 → 飛出 quadrant

### C.2 統一算法

```ts
/** 目標：讓物件 bbox 最大維度 = quadrant 可用空間 × targetUsageRatio */
const TARGET_USAGE_RATIO = 0.75;    // 75% 利用率（保留 25% padding + 尺寸線空間）
const SCALE_MIN = 0.3;              // 最小 px/mm（防超大物件壓成米粒）
const SCALE_MAX = 3.0;              // 最大 px/mm（防超小物件撐爆 quadrant）

export function unifiedFitScale(
  bboxMm: { w: number; h: number; d?: number },
  quadrant: {
    w?: number;
    h?: number;
    padding?: number;
    labelReserve?: number;
    headerH?: number;
  } = {},
): number {
  const qw = quadrant.w ?? QUADRANT.W;
  const qh = quadrant.h ?? QUADRANT.H;
  const pad = quadrant.padding ?? QUADRANT.PADDING;
  const label = quadrant.labelReserve ?? QUADRANT.LABEL_RESERVE;
  const head = quadrant.headerH ?? QUADRANT.HEADER_H;

  // 可用區（扣 padding + 雙邊 labelReserve + header）
  const usableW = qw - 2 * pad - 2 * label;
  const usableH = qh - head - 2 * pad - 2 * label;

  // bbox 取最大維度（含 d 方向，等角圖用）
  const maxBboxMm = Math.max(bboxMm.w, bboxMm.h, bboxMm.d ?? 0, 1);

  // 兩個方向各算一次 scale，取較小（保證雙軸都進得了）
  const scaleByW = (usableW * TARGET_USAGE_RATIO) / Math.max(bboxMm.w, 1);
  const scaleByH = (usableH * TARGET_USAGE_RATIO) / Math.max(bboxMm.h, 1);
  const scale = Math.min(scaleByW, scaleByH);

  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale));
}
```

### C.3 三視圖必須共用同一 scale（重要！）

**三視圖（front/side/top）必須用同一個 `pxPerMm`**，這樣肩寬在三視圖才對齊。  
等角圖（iso）獨立算 scale（因為 cabinet projection 多了 z 方向）。

```ts
// detail function 內部用法
function ThroughTenonDetail(p: JoineryDetailParams) {
  const { tl, tw, tt, mt, ct, cw } = p;

  // 三視共用 bbox：取三視圖中最大的物件範圍
  const sharedBbox = {
    w: Math.max(cw * 4, tl * 4, mt * 4),   // 寬方向最遠 = 母件展開 4 倍 cw
    h: mt + ct * 4 + tl,                    // 高方向最遠 = 母件厚 + 公件柱身
  };
  const sharedScale = unifiedFitScale(sharedBbox);  // 三視共用

  // 等角圖獨立算（多 d 方向）
  const isoBbox = {
    w: cw + tl,
    h: mt + ct,
    d: cw,                                   // 深度 = 公件柱寬
  };
  const isoScale = unifiedFitScale(isoBbox);

  // ... 4 個 view 的 ReactNode 用各自 scale
}
```

### C.4 Helper API 完整簽名

```ts
/** 主算法 */
export function unifiedFitScale(
  bboxMm: { w: number; h: number; d?: number },
  quadrant?: { w?: number; h?: number; padding?: number; labelReserve?: number; headerH?: number },
): number;

/** 在 quadrant 內計算物件「居中」的左上角座標（給 caller render 物件時用） */
export function quadrantCenter(
  bboxMm: { w: number; h: number },
  scale: number,
  quadrant?: { w?: number; h?: number; headerH?: number },
): { cx: number; cy: number; objX: number; objY: number };
//   cx,cy = quadrant 中心；objX,objY = 物件左上角（讓物件居中放）
```

---

## D. 字級規範

### D.1 規格表

| 用途 | 常數 | 值 | 對應 helper |
|---|---|---|---|
| Quadrant 標題（如「正視圖 FRONT」）| `FONT.LABEL` | 10px bold | `QuadrantHeader` |
| 尺寸數字（DimLine 上的 mm）| `FONT.DIM` | 9px regular | `DimLine` `DimChain` `ScaleBar` |
| 警示文字（WarningCallout）| `FONT.CALLOUT` | 8px regular | `WarningCallout` `GrainArrow` |
| 標題欄圖名 | `FONT.TITLE` | 12px bold | `TitleBlock` |
| 剖面標記 A/B（A-A）| `FONT.LABEL` | 10px bold | `SectionMark` |
| Tooltip / 補充說明 | `FONT.CALLOUT` | 8px italic | (caller 自訂) |

### D.2 硬性規則

```ts
// ✓ 正確
<text fontSize={FONT.DIM}>{tw}</text>
<text fontSize={FONT.LABEL}>正視圖 FRONT</text>

// ✗ 禁止 hardcode
<text fontSize={9}>{tw}</text>
<text fontSize="10">正視</text>
```

builder 完工後 grep 自驗：

```bash
grep -nE 'fontSize=\{[0-9]+\}|fontSize="[0-9]+"' lib/joinery/details.tsx
# 預期 0 行（全用 FONT.XXX 常數）
```

---

## E. 線寬規範

### E.1 規格表

| 用途 | 常數 | 值 | 適用範圍 |
|---|---|---|---|
| 主輪廓（外圍實線）| `STROKE.OUTLINE` | 1.0px | `<rect>` `<polygon>` 物件外框 |
| 隱藏線（虛線）| `STROKE.HIDDEN` | 0.6px | `HiddenEdge` 紅虛線輪廓加粗例外 = 1.6px |
| 中心線（點劃線）| `STROKE.CENTER` | 0.5px | `CenterLine` 對稱軸/迴轉軸 |
| 尺寸線 | `STROKE.DIM` | 0.5px | `DimLine` `DimChain` 引出短線 |
| 剖面 hatching | `STROKE.SECTION` | 0.7px | `Hatching` 紅斜線 |
| Iso 可見輪廓 | `ISO_STROKE.OUTLINE_VISIBLE` | 1.4px | `IsoCuboid` 三面 polygon |
| Iso 內部邊 | `ISO_STROKE.EDGE_INTERIOR` | 0.8px | `IsoMortise` 內壁線 |
| Iso 隱藏 | `ISO_STROKE.HIDDEN_DASHED` | 0.6px | 等角圖背面虛線 |

### E.2 紅虛線加粗例外規則

某些情況「被遮輪廓」需要加粗紅虛線（如 blind-tenon 內的榫頭輪廓）：

```ts
<HiddenEdge
  d={`M ${x1} ${y1} L ${x2} ${y2}`}
  color={COLOR.DIM_TICK}    // 紅色 #c0282d
/>
// 內部 strokeWidth 寫死 STROKE.HIDDEN=0.6
// 若需加粗紅虛線（強調盲榫端面），caller 包一層 <g strokeWidth={1.6}>
```

### E.3 硬性規則

```bash
# builder 完工自驗
grep -nE 'strokeWidth=\{[0-9]\.?[0-9]*\}|strokeWidth="[0-9]\.?[0-9]*"' lib/joinery/details.tsx \
  | grep -v 'STROKE\.\|ISO_STROKE\.'
# 預期 0 行
```

---

## F. 顏色 Palette

### F.1 規格表

| 用途 | 常數 | 值 | 出現於 |
|---|---|---|---|
| 公榫填色 | `COLOR.TENON` | `#e6c89a` 米黃 | `<rect fill={COLOR.TENON}>` |
| 母榫填色 | `COLOR.MORTISE` | `#b08a4e` 深棕 | `<rect fill={COLOR.MORTISE}>` |
| 主輪廓 stroke | `COLOR.OUTLINE` | `#222` | 所有 outline |
| 尺寸線 | `COLOR.DIM` | `#0a4d8c` 藍 | `DimLine` |
| 紅虛線/警示 | `COLOR.DIM_TICK` | `#c0282d` 紅 | 被遮輪廓、警示 |
| 隱藏邊 | `COLOR.HIDDEN` | `#b59062` 淺棕 | `HiddenEdge` |
| 中心線 | `COLOR.CENTER` | `#666` 灰 | `CenterLine` |
| 剖面 hatching | `COLOR.SECTION_HATCH` | `#c0282d` 紅 | `Hatching` |
| 木紋方向 | `COLOR.GRAIN` | `#8b6b3a` 深棕 | `GrainArrow` |

### F.2 Iso 三面色階（已在 `ISO_FILL`）

```ts
TENON_FRONT: "#e6c89a"   // 正面（最亮）
TENON_TOP:   "#d9b889"   // 頂面（中）
TENON_SIDE:  "#c9a878"   // 側面（最暗）
MORTISE_FRONT: "#b08a4e"
MORTISE_TOP:   "#9d7842"
MORTISE_SIDE:  "#8a6936"
MORTISE_HOLE_INTERIOR: "#3a2a1c"
```

### F.3 硬性規則

```bash
# builder 完工自驗
grep -nE 'fill="#[0-9a-fA-F]+"|stroke="#[0-9a-fA-F]+"' lib/joinery/details.tsx \
  | grep -v 'fill="white"\|fill="none"\|fill="#fff"\|stroke="#000"'
# 預期 0 行（全用 COLOR.XXX 或 ISO_FILL.XXX）
```

例外白名單：`white`、`none`、`#fff`、`#000`、`url(#xxx)`（hatching 引用）。

---

## G. Label 防超出規則（safeDimSide）

### G.1 問題

`DimLine` 的 `side="top"` 會把 label 往上推 14px，但若物件就貼在 quadrant 頂部，label 會跑出 quadrant 邊界（甚至跑進上一個 quadrant）。

**現況**：12 個 detail 都自己選 `side`，沒人檢查 label 是否超出。

### G.2 Helper API

```ts
/**
 * 給定原本想要的 side、label 文字、label 位置，
 * 回傳實際安全的 side（必要時翻向）
 */
export function safeDimSide(
  rawSide: "top" | "bottom" | "left" | "right",
  labelText: string,
  pos: { x: number; y: number },              // label 標的中心點（DimLine 中點）
  quadrantBounds: { x: number; y: number; w: number; h: number },
  opts?: {
    fontSize?: number;       // 預設 FONT.DIM = 9
    safeMargin?: number;     // 預設 8px
  },
): "top" | "bottom" | "left" | "right";
```

### G.3 算法

```ts
// 估算 label bbox（中文字 ≈ fontSize × 1.0、數字英文 ≈ fontSize × 0.6）
function estimateLabelW(text: string, fontSize: number): number {
  const cjkCount = (text.match(/[一-鿿]/g) ?? []).length;
  const otherCount = text.length - cjkCount;
  return cjkCount * fontSize + otherCount * fontSize * 0.6;
}

// 算法：
// 1. 估 label bbox
// 2. 算原 side 下的 label 中心點（DimLine 偏移後 +14px）
// 3. 若超出 quadrantBounds 任何一邊 → 翻反方向
// 4. 還超出 → 退一級（top→right→bottom→left 順序找可行）
// 5. 4 個都不行 → 回 raw（讓它超出，但發 console.warn）
```

### G.4 Caller 範例

```ts
// 自動防超出版本
<DimLine
  x1={x1} y1={y1} x2={x2} y2={y2}
  label={`${tw}`}
  side={safeDimSide("top", `${tw}`, { x: (x1+x2)/2, y: y1 }, q1Bounds)}
/>
```

> **進階建議**：未來可在 `DimLine` 內部直接接 `safeDimSide`，但需要傳 `quadrantBounds` prop。Phase 2 暫時 caller 顯式呼叫。

---

## H. TitleBlock 統一

### H.1 位置與尺寸

```ts
// MasterDetailLayout 自動 render，detail 不用自己畫
<TitleBlock
  x={QUADRANT_POS.FOOTER.x}      // 0
  y={QUADRANT_POS.FOOTER.y}      // 680
  width={CANVAS.W}                // 960
  // height: 50 (內部 3 row × 16 + padding)
/>
```

### H.2 欄位

| 欄位 | 來源 | 範例 |
|---|---|---|
| 圖名 | `joineryNameZh` (參考 `JOINERY_LABEL`) | 「通榫」 |
| 工法代號 | `JoineryType` | 「through-tenon」 |
| 比例 | 自動算 = `1:Math.round(1/scale)` | 「1:2」 |
| 繪圖者 | 固定 | 「wrd-auto」 |
| 圖號 | `drawingNumber` prop | 「TT-30x20-25」（依 type 自訂格式）|
| 投影法 | 固定 | 「第一角法」 |

### H.3 既有 helper 升級需求

現有 `TitleBlock` 三 row（圖名 / 比例+繪圖 / 圖號）→ Phase 2 升級成 4 row 加「投影法」。  
**動作**：在 `draw-primitives.tsx` 加 `projection?: string` prop，預設 `"第一角法"`，不破壞既有 caller。

```ts
export function TitleBlock(props: {
  // ...既有 props
  projection?: string;      // 新增（預設「第一角法」）
}): JSX.Element;
```

### H.4 硬性規則

12 個 detail 函式**禁止自己畫 TitleBlock**，全交給 `MasterDetailLayout`。

```bash
# builder 自驗
grep -n 'TitleBlock' lib/joinery/details.tsx | grep -v 'MasterDetailLayout'
# 預期 0 行
```

---

## I. Master Layout 函式（核心抽象）

### I.1 API

```ts
import type { ReactNode, JSX } from "react";
import type { JoineryType } from "@/lib/types";

export interface MasterDetailLayoutProps {
  /** JoineryType（給 TitleBlock + 自動算圖號用） */
  type: JoineryType;
  /** 圖名（如「通榫」），來自 JOINERY_LABEL */
  joineryNameZh: string;
  /** 圖號（如 "TT-30x20-25"，由 caller 依 props 組） */
  drawingNumber: string;
  /** 第一角法比例（如 "1:2"），可省略由 master 用 sharedScale 自動算 */
  scale?: string;

  /** 4 個 view 的 ReactNode（caller 只負責畫物件，不用畫 quadrant frame/header） */
  frontView: ReactNode;
  sideView: ReactNode;
  topView: ReactNode;
  isoView: ReactNode;

  /** 警示訊息（會 render 在 footer TitleBlock 上方） */
  warnings?: string[];

  /** Debug：顯示 quadrant 灰框 */
  debug?: boolean;
}

export function MasterDetailLayout(props: MasterDetailLayoutProps): JSX.Element;
```

### I.2 內部行為

```tsx
export function MasterDetailLayout({
  type, joineryNameZh, drawingNumber, scale,
  frontView, sideView, topView, isoView,
  warnings = [], debug = false,
}: MasterDetailLayoutProps): JSX.Element {
  return (
    <svg
      width={CANVAS.W}
      height={CANVAS.H}
      viewBox={`0 0 ${CANVAS.W} ${CANVAS.H}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* 通用 hatching pattern，detail 直接 fill="url(#hatch-section)" 即可 */}
        <Hatching id="hatch-section" color={COLOR.SECTION_HATCH} />
      </defs>

      {/* Q1 正視 */}
      <g transform={`translate(${QUADRANT_POS.Q1.x} ${QUADRANT_POS.Q1.y})`}>
        <QuadrantFrame x={0} y={0} debug={debug} />
        <QuadrantHeader x={0} y={0} label="正視圖 FRONT" />
        <g transform={`translate(0, ${QUADRANT.HEADER_H})`}>{frontView}</g>
      </g>

      {/* Q2 側視 */}
      <g transform={`translate(${QUADRANT_POS.Q2.x} ${QUADRANT_POS.Q2.y})`}>
        <QuadrantFrame x={0} y={0} debug={debug} />
        <QuadrantHeader x={0} y={0} label="側視圖 SIDE" />
        <g transform={`translate(0, ${QUADRANT.HEADER_H})`}>{sideView}</g>
      </g>

      {/* Q3 俯視 */}
      <g transform={`translate(${QUADRANT_POS.Q3.x} ${QUADRANT_POS.Q3.y})`}>
        <QuadrantFrame x={0} y={0} debug={debug} />
        <QuadrantHeader x={0} y={0} label="俯視圖 TOP" />
        <g transform={`translate(0, ${QUADRANT.HEADER_H})`}>{topView}</g>
      </g>

      {/* Q4 等角 */}
      <g transform={`translate(${QUADRANT_POS.Q4.x} ${QUADRANT_POS.Q4.y})`}>
        <QuadrantFrame x={0} y={0} debug={debug} />
        <QuadrantHeader x={0} y={0} label="等角圖 AXONOMETRIC" />
        <g transform={`translate(0, ${QUADRANT.HEADER_H})`}>{isoView}</g>
      </g>

      {/* Footer TitleBlock + warnings */}
      {warnings.map((w, i) => (
        <WarningCallout
          key={i}
          x={QUADRANT_POS.FOOTER.x + 8}
          y={QUADRANT_POS.FOOTER.y - 20 - i * 16}
          text={w}
        />
      ))}
      <TitleBlock
        x={QUADRANT_POS.FOOTER.x}
        y={QUADRANT_POS.FOOTER.y}
        width={CANVAS.W}
        joineryType={type}
        joineryNameZh={joineryNameZh}
        scale={scale ?? "1:1"}
        drawnBy="wrd-auto"
        drawingNumber={drawingNumber}
        projection="第一角法"
      />
    </svg>
  );
}
```

### I.3 12 個 detail 改造後典型樣板

```tsx
function ThroughTenonDetail(p: JoineryDetailParams): JSX.Element {
  const { tl, tw, tt, mt, ct, cw } = p;

  // 1. 算共用 scale
  const sharedBbox = { w: cw * 4, h: mt + ct * 4 };
  const s = unifiedFitScale(sharedBbox);
  const PX = (mm: number) => mm * s;

  // 2. 算 quadrant 內物件居中位置
  const center = quadrantCenter(sharedBbox, s);

  // 3. 4 個 view 的 ReactNode（每個都是 quadrant 內部座標 0..QUADRANT.W）
  const front = (
    <g>
      {/* 母件、公件、楔片、尺寸線、中心線、剖面標記 */}
      {/* 用 PX(mm) 換算所有座標 */}
      {/* 用 safeDimSide 包 DimLine 防超出 */}
    </g>
  );
  const side = ( /* ... */ );
  const top = ( /* ... */ );

  const isoBbox = { w: cw + tl, h: mt + ct, d: cw };
  const iso = (
    <IsometricGroup originX={QUADRANT.W / 2} originY={QUADRANT.H / 2}
                    scale={unifiedFitScale(isoBbox)}>
      <IsoCuboid ... />
      <IsoTenon ... />
    </IsometricGroup>
  );

  return (
    <MasterDetailLayout
      type="through-tenon"
      joineryNameZh="通榫"
      drawingNumber={`TT-${tw}x${tt}-${mt}`}
      scale={`1:${Math.round(1 / s)}`}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `貫穿端應微凸 1mm 後修平`,
        `楔片厚 ≈ ${Math.round(tw * 0.12)}mm`,
      ]}
    />
  );
}
```

---

## J. 從現況遷移路徑

### J.1 現況盤點（grep 結果）

```
details.tsx 8047 行，12 個 XxxDetail（新版） + 12 個 LegacyXxxDetail（保底）
```

每個新版 `XxxDetail` 平均 350-400 行，包含：
- 自寫 SVG 容器（每個 ~3 行）
- 自算 `pxPerMm`（每個 ~5-10 行）
- 自畫 4 個 view 的 `<g>` block + `<rect>` Quadrant frame（每個 ~250 行）
- 自畫 TitleBlock + ScaleBar（每個 ~10 行）

### J.2 改造後行數

每個 detail：
- 算 sharedScale + isoScale：~10 行
- 4 個 view 的 ReactNode：~200-250 行（核心畫法不變、只是換 PX 算法）
- `<MasterDetailLayout>` 包起來：~15 行
- **總計**：~250-280 行（每個減 ~100 行）

### J.3 工作量估計

| 項目 | 行數變更 | 估時/檔案 | 12 type 總計 |
|---|---|---|---|
| 砍 SVG container + Quadrant frame | -30 行 | 5 min | 60 min |
| 砍自寫 pxPerMm，改用 unifiedFitScale | -10 行 | 10 min | 120 min |
| DimLine 包 safeDimSide | +0 行（換 wrap）| 15 min | 180 min |
| 砍自寫 TitleBlock，改 MasterDetailLayout 接管 | -10 行 | 5 min | 60 min |
| 4 view 內物件座標重算（Q 變 quadrant 局部座標）| 0 行 | 30 min | 360 min |
| audit 自驗 + playwright 截圖 | 0 行 | 10 min | 120 min |
| **每 type 合計** | **-50 行** | **~75 min** | **~15 hr (12 type)** |

新增 helper（在 `draw-primitives.tsx` 加）：
- `unifiedFitScale` (40 行)
- `quadrantCenter` (15 行)
- `safeDimSide` (50 行)
- `MasterDetailLayout` (80 行)
- `QuadrantHeader` `QuadrantFrame` (30 行)
- `CANVAS` `QUADRANT` `QUADRANT_POS` 常數 (20 行)
- 升級 `TitleBlock` 加 `projection` prop (5 行)
- **總計新增**：~240 行 helper

整體 net change：`+240 helper - 50*12 detail = -360 行`，details.tsx 從 8047 行降到 ~7700 行。

---

## K. 風險 + Rollback

### K.1 風險清單

| 風險 | 影響 | 緩解 |
|---|---|---|
| 改 helper（`TitleBlock` 加 prop）破壞既有 caller | 低（新 prop optional）| 預設值兼容 |
| 12 type 一次改完出大規模 bug | 高 | **分批改：先 1 type 試水（建議 `dowel` 最簡單），驗證後再 batch 4 type，最後 7 type** |
| 新 scale 算法跟舊 scale 視覺差太多 | 中 | 並排截圖對比，調 `TARGET_USAGE_RATIO` 0.7~0.8 |
| 等角圖 quadrant 變小（從原本部分 detail 沒等角）| 低 | 既有 detail 多數已有 iso，只是位置不同 |
| `safeDimSide` 翻向後 label 撞到物件 | 中 | Phase 2.5 補「label 內框 vs 物件 bbox 碰撞」（先不做） |

### K.2 Escape Hatch

**保留 `LegacyXxxDetail` 函式不動**（已在 details.tsx 存在），新版搞砸時一鍵切回：

```ts
// JoineryDetail switch 加 env flag
const RENDERERS: Partial<Record<JoineryType, (p: JoineryDetailParams) => React.ReactElement>> = {
  "through-tenon":
    process.env.NEXT_PUBLIC_USE_LEGACY_DETAIL === "1"
      ? LegacyThroughTenonDetail
      : ThroughTenonDetail,
  // ...
};
```

或更激進：每個新版 `XxxDetail` 函式內部開頭加 try/catch fallback：

```ts
function ThroughTenonDetail(p: JoineryDetailParams): JSX.Element {
  try {
    return UnifiedThroughTenonDetail(p);    // 新版
  } catch (e) {
    console.warn("[joinery] unified detail failed, fallback to legacy", e);
    return LegacyThroughTenonDetail(p);
  }
}
```

### K.3 漸進路線（建議 builder 採用）

1. **Step 1**：在 `draw-primitives.tsx` 加 7 個新 helper（`unifiedFitScale` 等）+ 升級 `TitleBlock`。  
   **不動 details.tsx**。跑 `tsc --noEmit` 驗證。
2. **Step 2**：選 `dowel`（最簡單、現有 ~350 行）改造。改完用 playwright 截圖跟 legacy 並排對比。木頭仁拍板。
3. **Step 3**：批次改 4 type（`through-tenon` `blind-tenon` `shouldered-tenon` `stub-joint`）— 同一家族最容易共用 layout pattern。
4. **Step 4**：批次改剩餘 7 type（`half-lap` `tongue-and-groove` `dovetail` `finger-joint` `mitered-spline` `pocket-hole` `screw`）。
5. **Step 5**：跑 audit `npm run audit:joints`，全綠後 commit。
6. **Step 6**：observation period 1 週後砍 `LegacyXxxDetail` 12 個函式（額外省 ~3000 行）。

---

## L. Builder 自驗 Checklist

完工後 builder 跑下列指令，全部 pass 才能 commit：

```bash
# 1. TypeScript
npm run tsc -- --noEmit

# 2. Lint
npm run lint

# 3. Hardcoded font/stroke/color 檢查
grep -nE 'fontSize=\{?[0-9]+\}?' lib/joinery/details.tsx | grep -v 'FONT\.\|MasterDetailLayout' | wc -l
# 預期 0

grep -nE 'strokeWidth=\{?[0-9]\.?[0-9]*\}?' lib/joinery/details.tsx | grep -v 'STROKE\.\|ISO_STROKE\.' | wc -l
# 預期 0

grep -nE 'fill="#[0-9a-fA-F]+"' lib/joinery/details.tsx | grep -vE 'fill="(white|none|#fff|#000)"|url\(#' | wc -l
# 預期 0

# 4. 12 type 都用 MasterDetailLayout
grep -c 'MasterDetailLayout' lib/joinery/details.tsx
# 預期 ≥ 12

# 5. Audit
npm run audit:joints
# 預期 120/120 全綠

# 6. Playwright 視覺驗證（每 type 一張）
# 跑 /design/stool 切到每種 joineryType，截圖比對 baseline
```

---

## M. 開放議題（Phase 2.5+）

1. **DimLine 內建 safeDimSide**：需要傳 quadrantBounds，要不要透過 React Context？
2. **多 view 之間的對齊輔助線**（front 的肩寬要跟 top 的肩寬畫一條對齊虛線）：建議 Phase 3 加 `<AlignmentGuide>` helper。
3. **ScaleBar 自動放置**：現在 caller 自選位置，建議 master 統一放在 Q4 右下角。
4. **多語系 label**（英文 / 日文版）：未來 i18n 化，目前固定中文。
5. **匯出獨立 .svg 檔**：木頭仁可能想下載細節圖印出來，需要 standalone svg + xmlns。

---

## N. 變更紀錄

| 日期 | 改動 | 作者 |
|---|---|---|
| 2026-05-09 | 初版建立 | architect agent |
