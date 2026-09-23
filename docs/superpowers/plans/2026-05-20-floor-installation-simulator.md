# 地板施工模擬器 `/floor` — 階段 1+2 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `wooden-ren-designer` 建立超耐磨/海島型木地板平鋪的房間排版+算料模擬器 `/floor`,完成階段 1(純引擎)與階段 2(畫布編輯器 UI)。

**Architecture:** 完全 mirror 既有 `/ceiling`。純引擎在 `lib/floor/`(幾何工具 → 排版 → 餘料優化 → BOM),測試用 `npx tsx` 自我斷言腳本(沿用 ceiling 慣例)。UI 在 `app/floor/`,階段 1 路由 admin 限定。所有單位為 **cm**。

**Tech Stack:** Next.js (App Router) / React / TypeScript / Supabase(權限)/ tsx(測試腳本)。

座標系:房間多邊形頂點單位 cm,原點左上,x 向右,y 向下,頂點順時針排列。

---

## 檔案結構

| 檔案 | 職責 |
|---|---|
| `lib/floor/types.ts` | 型別 + `DEFAULT_FLOOR_INPUT` |
| `lib/floor/geometry.ts` | 多邊形面積/周長/bbox/點包含/向內 offset/矩形∩多邊形裁切 |
| `lib/floor/geometry.test.ts` | geometry 自我斷言腳本(`npx tsx`) |
| `lib/floor/presets.ts` | 形狀範本(矩形/L/T/凸)頂點資料 |
| `lib/floor/layout.ts` | 排版引擎:房間+設定 → 地板片清單 |
| `lib/floor/cutting.ts` | 裁切餘料再利用優化 |
| `lib/floor/calc.ts` | 算料引擎:排版 → 完整 BOM + trace |
| `lib/floor/fixtures.ts` | 測試房間(矩形/L/T) |
| `lib/floor/calc.test.ts` | 排版+算料自我斷言腳本(`npx tsx`) |
| `lib/floor/FloorOverviewSvg.tsx` | 2D 俯視排版圖 |
| `lib/permissions.ts` | 新增 `canUseFloorTool` flag(修改) |
| `app/floor/page.tsx` | 路由,階段 1 admin 限定 |
| `app/floor/FloorDevClient.tsx` | Client UI:編輯器 + 設定表單 + BOM |
| `app/floor/FloorCanvasEditor.tsx` | 格線畫布拖拉編輯器 |

---

## Task 1: 型別定義

**Files:**
- Create: `lib/floor/types.ts`

- [ ] **Step 1: 建立 `lib/floor/types.ts`**

```typescript
/**
 * 地板施工模擬器(超耐磨/海島型平鋪)— 型別定義
 *
 * 全模組單位:cm(與 /ceiling 一致,避免 mm/cm 轉換錯誤)。
 * 例外:伸縮縫以 mm 輸入(業界慣用),內部立即 /10 轉 cm。
 *
 * 座標系:原點左上,x 右,y 下,房間頂點順時針。
 */

export interface Point {
  x: number;
  y: number;
}

/** 房間 = 正交多邊形(所有邊水平或垂直),頂點順時針 */
export interface RoomPolygon {
  vertices: Point[];
}

/** 鋪設方向:沿 bbox 長軸 / 短軸 */
export type FloorDirection = "long-axis" | "short-axis";

/** 錯縫策略 */
export type StaggerMode = "half" | "third" | "random";

/** 起鋪角 */
export type StartCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/** 損耗計法 */
export type WasteMode = "computed" | "empirical";

/** 收邊類型 */
export type SkirtingType = "skirting" | "trim" | "none";

export interface FloorInput {
  room: RoomPolygon;
  /** 地板片長(cm) */
  plankLengthCm: number;
  /** 地板片寬(cm) */
  plankWidthCm: number;
  direction: FloorDirection;
  stagger: StaggerMode;
  startCorner: StartCorner;
  /** 牆邊伸縮縫(mm) */
  expansionGapMm: number;
  wasteMode: WasteMode;
  /** 裁切餘料是否再利用 */
  reuseOffcuts: boolean;
  skirtingType: SkirtingType;
}

/** 一片排好的地板片 */
export interface PlacedPlank {
  /** 該片左上角(cm,房間座標) */
  x: number;
  y: number;
  /** 名目尺寸(cm)— 沿 run 軸為 length,沿 row 軸為 width */
  lengthCm: number;
  widthCm: number;
  /** full = 整片可用;cut = 需裁切;在版面外的片不會出現在清單 */
  kind: "full" | "cut";
  /** 第幾排(0 起) */
  row: number;
  /** 與房間可鋪區域的交集面積(cm²)*/
  usedAreaCm2: number;
  /** cut 片裁切後的有效長度(cm)= usedAreaCm2 / widthCm;full 片 = lengthCm */
  effectiveLengthCm: number;
}

export interface FloorLayout {
  planks: PlacedPlank[];
  rows: number;
  /** 鋪設可用區域(房間向內縮伸縮縫後) */
  layableRegion: RoomPolygon;
}

/** 一行材料 */
export interface FloorBomItem {
  category: "plank" | "skirting" | "underlay";
  nameZh: string;
  spec: string;
  /** 數量(片/條/—)*/
  count?: number;
  /** 總長(m)— skirting 用 */
  totalLengthM?: number;
  /** 總面積(m²)— underlay 用 */
  totalAreaM2?: number;
  note?: string;
}

export interface FloorBom {
  input: FloorInput;
  layout: FloorLayout;
  items: FloorBomItem[];
  auto: {
    roomAreaM2: number;
    pingShu: number;
    perimeterM: number;
  };
  trace: {
    fullPlankCount: number;
    /** 需裁切片數(餘料優化前的原始裁切片數) */
    cutPieceCount: number;
    /** 裁切片實際消耗的全新地板片數(餘料優化後) */
    cutPlankCount: number;
    totalPlankCount: number;
    wastePercent: number;
    plankRows: number;
    /** 餘料再利用紀錄 */
    offcutReuseLog: string[];
  };
}

export const DEFAULT_FLOOR_INPUT: FloorInput = {
  room: {
    // 預設 420×300 cm 矩形
    vertices: [
      { x: 0, y: 0 },
      { x: 420, y: 0 },
      { x: 420, y: 300 },
      { x: 0, y: 300 },
    ],
  },
  plankLengthCm: 120,
  plankWidthCm: 19,
  direction: "long-axis",
  stagger: "half",
  startCorner: "top-left",
  expansionGapMm: 10,
  wasteMode: "computed",
  reuseOffcuts: true,
  skirtingType: "skirting",
};
```

- [ ] **Step 2: 型別檢查**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/floor" || echo "floor clean"`
Expected: `floor clean`

- [ ] **Step 3: Commit**

```bash
git add lib/floor/types.ts
git commit -m "feat(floor): 地板模擬器型別定義"
```

---

## Task 2: 幾何工具 — 基本量測

**Files:**
- Create: `lib/floor/geometry.ts`
- Create: `lib/floor/geometry.test.ts`

- [ ] **Step 1: 寫失敗測試 `lib/floor/geometry.test.ts`**

```typescript
/**
 * geometry 自我斷言腳本 — 跑法:npx tsx lib/floor/geometry.test.ts
 * 全綠印 "✅ geometry: N passed";任何 assert 失敗 throw。
 */
import {
  polygonArea,
  polygonPerimeter,
  boundingBox,
  pointInPolygon,
  insetPolygon,
  clipRectToPolygon,
} from "./geometry";
import type { RoomPolygon } from "./types";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}
function approx(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) < eps;
}

const rect: RoomPolygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ],
};
// L 型:外接 400×300,右下挖掉 200×150
const lshape: RoomPolygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 150 },
    { x: 200, y: 150 },
    { x: 200, y: 300 },
    { x: 0, y: 300 },
  ],
};

assert(approx(polygonArea(rect), 120000), "rect area = 120000");
assert(approx(polygonArea(lshape), 90000), "L area = 400*300 - 200*150 = 90000");
assert(approx(polygonPerimeter(rect), 1400), "rect perimeter = 1400");
assert(approx(polygonPerimeter(lshape), 1400), "L perimeter = 1400");

const bb = boundingBox(lshape);
assert(bb.minX === 0 && bb.minY === 0 && bb.maxX === 400 && bb.maxY === 300, "L bbox");

assert(pointInPolygon({ x: 100, y: 100 }, lshape), "L 內部點");
assert(!pointInPolygon({ x: 300, y: 250 }, lshape), "L 挖空區點在外");
assert(!pointInPolygon({ x: 500, y: 100 }, lshape), "L 外部點");

console.log(`✅ geometry: ${passed} passed`);
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsx lib/floor/geometry.test.ts`
Expected: 失敗,`Cannot find module './geometry'`

- [ ] **Step 3: 建立 `lib/floor/geometry.ts`(基本量測 + 後續任務的裁切佔位)**

```typescript
/**
 * 正交多邊形幾何工具(地板模擬器)
 *
 * 房間為正交多邊形(所有邊水平或垂直),頂點順時針,單位 cm。
 * 裁切採 Sutherland-Hodgman(對矩形這種凸裁切窗有效,且日後可推廣非正交)。
 */
import type { Point, RoomPolygon } from "./types";

const EPS = 0.001;

/** 鞋帶公式,回傳絕對面積(cm²) */
export function polygonArea(poly: RoomPolygon): number {
  const v = poly.vertices;
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** 周長(cm) */
export function polygonPerimeter(poly: RoomPolygon): number {
  const v = poly.vertices;
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundingBox(poly: RoomPolygon): BBox {
  const xs = poly.vertices.map((p) => p.x);
  const ys = poly.vertices.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** 射線法:點是否在多邊形內(邊界視為內) */
export function pointInPolygon(pt: Point, poly: RoomPolygon): boolean {
  const v = poly.vertices;
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const a = v[i];
    const b = v[j];
    const intersect =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

// insetPolygon / clipRectToPolygon 在 Task 3 補上。
```

- [ ] **Step 4: 跑測試 — 此時 import 缺 `insetPolygon`/`clipRectToPolygon` 仍會失敗**

暫時把 test 檔頂部 import 的 `insetPolygon, clipRectToPolygon` 兩個名稱先移除、並註解掉用到它們的測試(Task 3 還原)。

Run: `cd ~/Desktop/wooden-ren-designer && npx tsx lib/floor/geometry.test.ts`
Expected: `✅ geometry: 9 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/floor/geometry.ts lib/floor/geometry.test.ts
git commit -m "feat(floor): 多邊形面積/周長/bbox/點包含"
```

---

## Task 3: 幾何工具 — 向內 offset 與矩形裁切

**Files:**
- Modify: `lib/floor/geometry.ts`
- Modify: `lib/floor/geometry.test.ts`

- [ ] **Step 1: 還原並擴充測試 `lib/floor/geometry.test.ts`**

把 Task 2 Step 4 移除/註解的 import 與測試還原,並在 `console.log` 前加入:

```typescript
// 向內 offset:矩形縮 10cm → 380×280
const inset = insetPolygon(rect, 10);
const ibb = boundingBox(inset);
assert(
  approx(ibb.minX, 10) && approx(ibb.minY, 10) &&
    approx(ibb.maxX, 390) && approx(ibb.maxY, 290),
  "rect inset 10cm",
);
assert(approx(polygonArea(inset), 380 * 280), "inset 面積 380*280");

// L 型 inset 10cm 仍為 6 頂點正交多邊形
const lInset = insetPolygon(lshape, 10);
assert(lInset.vertices.length === 6, "L inset 仍 6 頂點");

// 矩形 ∩ 多邊形裁切
const fully = clipRectToPolygon({ x: 50, y: 50, w: 100, h: 50 }, rect);
assert(approx(fully.usedAreaCm2, 5000), "完全在內 area=5000");
assert(fully.fullyInside, "完全在內 fullyInside=true");

const partial = clipRectToPolygon({ x: 350, y: 50, w: 100, h: 50 }, rect);
assert(approx(partial.usedAreaCm2, 50 * 50), "部分在內 area=2500");
assert(!partial.fullyInside && partial.usedAreaCm2 > 0, "部分在內");

const outside = clipRectToPolygon({ x: 500, y: 50, w: 100, h: 50 }, rect);
assert(approx(outside.usedAreaCm2, 0), "完全在外 area=0");

// L 型挖空區的矩形被裁掉
const inHole = clipRectToPolygon({ x: 250, y: 200, w: 100, h: 50 }, lshape);
assert(approx(inHole.usedAreaCm2, 0), "L 挖空區內矩形 area=0");
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsx lib/floor/geometry.test.ts`
Expected: 失敗,`insetPolygon is not a function`

- [ ] **Step 3: 在 `lib/floor/geometry.ts` 末端加入實作**

```typescript
/** 軸對齊矩形 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 正交多邊形向內 offset:每條邊往內部法線方向平移 gap。
 * 每個頂點是「一條水平邊」與「一條垂直邊」的交點,
 * offset 後新頂點 = 垂直邊提供 x、水平邊提供 y。
 */
export function insetPolygon(poly: RoomPolygon, gap: number): RoomPolygon {
  const v = poly.vertices;
  const n = v.length;
  // 每條邊 i 連接 v[i] → v[i+1]
  // 內部法線:取邊中點往候選法線方向走一小步,測 pointInPolygon
  const offsetEdges: { p1: Point; p2: Point }[] = [];
  for (let i = 0; i < n; i++) {
    const a = v[i];
    const b = v[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    // 兩個垂直方向
    const nx = -dy / len;
    const ny = dx / len;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const probe = { x: mid.x + nx * 0.5, y: mid.y + ny * 0.5 };
    const sign = pointInPolygon(probe, poly) ? 1 : -1;
    offsetEdges.push({
      p1: { x: a.x + nx * gap * sign, y: a.y + ny * gap * sign },
      p2: { x: b.x + nx * gap * sign, y: b.y + ny * gap * sign },
    });
  }
  // 新頂點 i = offsetEdges[i-1] 與 offsetEdges[i] 的交點(都是軸對齊線)
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = offsetEdges[(i - 1 + n) % n];
    const cur = offsetEdges[i];
    // prev 與 cur 一條水平一條垂直 → 交點 = 垂直線的 x + 水平線的 y
    const prevHoriz = Math.abs(prev.p1.y - prev.p2.y) < EPS;
    const x = prevHoriz ? cur.p1.x : prev.p1.x;
    const y = prevHoriz ? prev.p1.y : cur.p1.y;
    out.push({ x, y });
  }
  return { vertices: out };
}

interface ClipResult {
  usedAreaCm2: number;
  fullyInside: boolean;
}

/**
 * 矩形 ∩ 多邊形:Sutherland-Hodgman,以矩形 4 邊為裁切窗,裁切多邊形。
 * 回傳交集面積與是否「矩形完全落在多邊形內」。
 */
export function clipRectToPolygon(rect: Rect, poly: RoomPolygon): ClipResult {
  const clipEdges = [
    { inside: (p: Point) => p.x >= rect.x - EPS, isect: clipX(rect.x) },
    { inside: (p: Point) => p.x <= rect.x + rect.w + EPS, isect: clipX(rect.x + rect.w) },
    { inside: (p: Point) => p.y >= rect.y - EPS, isect: clipY(rect.y) },
    { inside: (p: Point) => p.y <= rect.y + rect.h + EPS, isect: clipY(rect.y + rect.h) },
  ];
  let pts: Point[] = poly.vertices.slice();
  for (const e of clipEdges) {
    const out: Point[] = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curIn = e.inside(cur);
      const prevIn = e.inside(prev);
      if (curIn) {
        if (!prevIn) out.push(e.isect(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(e.isect(prev, cur));
      }
    }
    pts = out;
    if (pts.length === 0) break;
  }
  const usedAreaCm2 = pts.length >= 3 ? polygonArea({ vertices: pts }) : 0;
  const rectArea = rect.w * rect.h;
  return {
    usedAreaCm2,
    fullyInside: usedAreaCm2 > rectArea - EPS,
  };
}

function clipX(xLine: number) {
  return (a: Point, b: Point): Point => {
    const t = (xLine - a.x) / (b.x - a.x);
    return { x: xLine, y: a.y + t * (b.y - a.y) };
  };
}
function clipY(yLine: number) {
  return (a: Point, b: Point): Point => {
    const t = (yLine - a.y) / (b.y - a.y);
    return { x: a.x + t * (b.x - a.x), y: yLine };
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsx lib/floor/geometry.test.ts`
Expected: `✅ geometry: 18 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/floor/geometry.ts lib/floor/geometry.test.ts
git commit -m "feat(floor): 向內 offset + 矩形∩多邊形裁切"
```

---

## Task 4: 形狀範本

**Files:**
- Create: `lib/floor/presets.ts`

- [ ] **Step 1: 建立 `lib/floor/presets.ts`**

```typescript
/**
 * 房間形狀範本 — 使用者點選後帶入頂點,再於畫布微調。
 * 所有範本頂點順時針、單位 cm。
 */
import type { RoomPolygon } from "./types";

export interface ShapePreset {
  id: "rect" | "l-shape" | "t-shape" | "convex";
  nameZh: string;
  build: () => RoomPolygon;
}

export const SHAPE_PRESETS: ShapePreset[] = [
  {
    id: "rect",
    nameZh: "矩形",
    build: () => ({
      vertices: [
        { x: 0, y: 0 },
        { x: 420, y: 0 },
        { x: 420, y: 300 },
        { x: 0, y: 300 },
      ],
    }),
  },
  {
    id: "l-shape",
    nameZh: "L 型",
    build: () => ({
      vertices: [
        { x: 0, y: 0 },
        { x: 420, y: 0 },
        { x: 420, y: 180 },
        { x: 220, y: 180 },
        { x: 220, y: 360 },
        { x: 0, y: 360 },
      ],
    }),
  },
  {
    id: "t-shape",
    nameZh: "T 型",
    build: () => ({
      vertices: [
        { x: 0, y: 0 },
        { x: 480, y: 0 },
        { x: 480, y: 180 },
        { x: 340, y: 180 },
        { x: 340, y: 360 },
        { x: 140, y: 360 },
        { x: 140, y: 180 },
        { x: 0, y: 180 },
      ],
    }),
  },
  {
    id: "convex",
    nameZh: "凸型",
    build: () => ({
      vertices: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 120 },
        { x: 420, y: 120 },
        { x: 420, y: 360 },
        { x: 0, y: 360 },
      ],
    }),
  },
];

export function getPreset(id: ShapePreset["id"]): RoomPolygon {
  const p = SHAPE_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown preset: ${id}`);
  return p.build();
}
```

- [ ] **Step 2: 型別檢查**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/floor" || echo "floor clean"`
Expected: `floor clean`

- [ ] **Step 3: Commit**

```bash
git add lib/floor/presets.ts
git commit -m "feat(floor): 房間形狀範本(矩形/L/T/凸)"
```

---

## Task 5: 排版引擎

**Files:**
- Create: `lib/floor/layout.ts`

- [ ] **Step 1: 建立 `lib/floor/layout.ts`**

```typescript
/**
 * 地板排版引擎(直鋪錯縫)
 *
 * 流程:
 *   1. 房間向內縮伸縮縫 → 可鋪區域 layableRegion
 *   2. 取 bbox,依 direction 決定 run 軸(地板片長度方向)
 *   3. 逐排鋪滿 bbox:每排寬 = plankWidthCm,排間依 stagger 偏移起點
 *   4. 每片矩形對 layableRegion 裁切 → full / cut / 丟棄
 *
 * ASSUMPTION(user 核對後鎖定):
 *   - 地板片固定矩形、同規格
 *   - run 軸為 bbox 較長(long-axis)或較短(short-axis)邊方向
 *   - cut 片有效長度 = 交集面積 / plankWidthCm(近似:視為單一橫切)
 */
import type { FloorInput, FloorLayout, PlacedPlank, RoomPolygon } from "./types";
import { boundingBox, clipRectToPolygon, insetPolygon } from "./geometry";

const EPS = 0.001;

/** 依 stagger 模式回傳第 row 排的起點偏移(cm) */
function staggerOffset(row: number, mode: FloorInput["stagger"], plankLen: number): number {
  if (mode === "half") return (row % 2) * (plankLen / 2);
  if (mode === "third") return (row % 3) * (plankLen / 3);
  // random:固定種子,結果可重現
  let seed = (row + 1) * 2654435761;
  seed = (seed ^ (seed >>> 15)) >>> 0;
  return (seed / 0xffffffff) * plankLen;
}

export function computeFloorLayout(input: FloorInput): FloorLayout {
  const gapCm = input.expansionGapMm / 10;
  const layableRegion: RoomPolygon =
    gapCm > 0 ? insetPolygon(input.room, gapCm) : input.room;
  const bb = boundingBox(layableRegion);
  const spanX = bb.maxX - bb.minX;
  const spanY = bb.maxY - bb.minY;

  // run 軸 = 地板片「長度」方向。long-axis → 沿 bbox 較長邊
  const runAlongX =
    input.direction === "long-axis" ? spanX >= spanY : spanX < spanY;

  const plankLen = input.plankLengthCm;
  const plankW = input.plankWidthCm;

  // rowSpan 是「排堆疊」方向的總長度
  const rowSpan = runAlongX ? spanY : spanX;
  const rows = Math.ceil(rowSpan / plankW - EPS);

  const planks: PlacedPlank[] = [];
  for (let r = 0; r < rows; r++) {
    const off = staggerOffset(r, input.stagger, plankLen);
    // 沿 run 軸從 bbox 起點 - off 開始,逐片 plankLen 步進直到蓋過 bbox
    const runStart = (runAlongX ? bb.minX : bb.minY) - off;
    const runEnd = runAlongX ? bb.maxX : bb.maxY;
    const rowPos = (runAlongX ? bb.minY : bb.minX) + r * plankW;
    for (let s = runStart; s < runEnd - EPS; s += plankLen) {
      const rect = runAlongX
        ? { x: s, y: rowPos, w: plankLen, h: plankW }
        : { x: rowPos, y: s, w: plankW, h: plankLen };
      const clip = clipRectToPolygon(rect, layableRegion);
      if (clip.usedAreaCm2 < EPS) continue; // 完全在外,丟棄
      planks.push({
        x: rect.x,
        y: rect.y,
        lengthCm: plankLen,
        widthCm: plankW,
        kind: clip.fullyInside ? "full" : "cut",
        row: r,
        usedAreaCm2: clip.usedAreaCm2,
        effectiveLengthCm: clip.fullyInside
          ? plankLen
          : clip.usedAreaCm2 / plankW,
      });
    }
  }

  return { planks, rows, layableRegion };
}
```

- [ ] **Step 2: 即席驗證**

Run:
```bash
cd ~/Desktop/wooden-ren-designer && npx tsx -e "
import { computeFloorLayout } from './lib/floor/layout';
import { DEFAULT_FLOOR_INPUT } from './lib/floor/types';
const l = computeFloorLayout(DEFAULT_FLOOR_INPUT);
const full = l.planks.filter(p=>p.kind==='full').length;
const cut = l.planks.filter(p=>p.kind==='cut').length;
console.log('rows', l.rows, 'full', full, 'cut', cut, 'total', l.planks.length);
if (l.rows <= 0 || l.planks.length === 0) throw new Error('layout 空');
console.log('✅ layout 產出非空');
"
```
Expected: 印出 `rows ... full ... cut ...` 與 `✅ layout 產出非空`(420×300 房間扣 1cm 縫,plank 120×19 → 約 22 排)。

- [ ] **Step 3: Commit**

```bash
git add lib/floor/layout.ts
git commit -m "feat(floor): 直鋪錯縫排版引擎"
```

---

## Task 6: 裁切餘料再利用

**Files:**
- Create: `lib/floor/cutting.ts`

- [ ] **Step 1: 建立 `lib/floor/cutting.ts`**

```typescript
/**
 * 裁切餘料再利用(1D,地板片用)
 *
 * 每片 cut 地板片需要一段「有效長度」。若先前裁切剩下的餘料
 *(plankLength - 已用長度)≥ 需求長度,就拿餘料拼,不開新片。
 * 否則開一片新地板片,其餘料進池。
 *
 * 貪婪 FFD 風:餘料池中找「最小但夠用」的餘料(best-fit),降低浪費。
 * sawKerf 鋸路(地板片裁切 ~2mm = 0.2cm)。
 *
 * ASSUMPTION:cut 片只橫切一刀,餘料 ≥ MIN_REUSE_CM 才回收。
 */

const SAW_KERF_CM = 0.2;
const MIN_REUSE_CM = 20; // 餘料短於此視為廢料不回收

export interface CuttingResult {
  /** 裁切片實際消耗的全新地板片數 */
  cutPlankCount: number;
  /** 人類可讀的再利用紀錄 */
  reuseLog: string[];
}

/**
 * @param cutLengths 每片 cut 地板片需要的有效長度(cm),由 layout 提供
 * @param plankLengthCm 全新地板片長度
 */
export function optimizeOffcuts(
  cutLengths: number[],
  plankLengthCm: number,
): CuttingResult {
  // 長的先排(FFD):大塊先吃掉,小餘料才好填縫
  const needs = [...cutLengths].sort((a, b) => b - a);
  const offcutPool: number[] = [];
  let cutPlankCount = 0;
  const reuseLog: string[] = [];

  for (const need of needs) {
    // best-fit:池中找最小但 ≥ need 的餘料
    let bestIdx = -1;
    for (let i = 0; i < offcutPool.length; i++) {
      if (offcutPool[i] >= need - 0.001) {
        if (bestIdx === -1 || offcutPool[i] < offcutPool[bestIdx]) bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const remain = offcutPool[bestIdx] - need - SAW_KERF_CM;
      reuseLog.push(
        `裁切片 ${need.toFixed(1)}cm 由餘料 ${offcutPool[bestIdx].toFixed(1)}cm 拼出`,
      );
      offcutPool.splice(bestIdx, 1);
      if (remain >= MIN_REUSE_CM) offcutPool.push(remain);
    } else {
      cutPlankCount++;
      const remain = plankLengthCm - need - SAW_KERF_CM;
      if (remain >= MIN_REUSE_CM) offcutPool.push(remain);
    }
  }
  return { cutPlankCount, reuseLog };
}
```

- [ ] **Step 2: 即席驗證**

Run:
```bash
cd ~/Desktop/wooden-ren-designer && npx tsx -e "
import { optimizeOffcuts } from './lib/floor/cutting';
// 4 段各需 50cm,plank 120cm:每片切 50 剩 ~69.8 可再拼一段 → 2 片
const r = optimizeOffcuts([50,50,50,50], 120);
console.log('cutPlankCount', r.cutPlankCount, r.reuseLog);
if (r.cutPlankCount !== 2) throw new Error('預期 2 片,得 ' + r.cutPlankCount);
console.log('✅ cutting 餘料再利用正確');
"
```
Expected: `cutPlankCount 2` 與 `✅ cutting 餘料再利用正確`。

- [ ] **Step 3: Commit**

```bash
git add lib/floor/cutting.ts
git commit -m "feat(floor): 裁切餘料再利用(best-fit FFD)"
```

---

## Task 7: 算料引擎(BOM)

**Files:**
- Create: `lib/floor/calc.ts`

- [ ] **Step 1: 建立 `lib/floor/calc.ts`**

```typescript
/**
 * 地板算料引擎 — 排版結果 → 完整 BOM + trace
 *
 * 公式:
 *   房間面積  = polygonArea / 10000 (m²)
 *   坪數      = 面積 / 3.305
 *   周長      = polygonPerimeter / 100 (m)
 *   損耗率 computed  = (總片名目面積 − 房間鋪用面積) / 房間鋪用面積
 *   損耗率 empirical = 固定 10%
 *
 * ASSUMPTION:
 *   - 收邊條/踢腳板長度 = 房間周長(門洞不自動扣,note 提醒)
 *   - 防潮墊面積 = 房間面積(平鋪需滿鋪)
 */
import type { FloorBom, FloorBomItem, FloorInput } from "./types";
import { polygonArea, polygonPerimeter } from "./geometry";
import { computeFloorLayout } from "./layout";
import { optimizeOffcuts } from "./cutting";

const EMPIRICAL_WASTE = 0.1;

export function computeFloorBom(input: FloorInput): FloorBom {
  const layout = computeFloorLayout(input);

  const fullPlanks = layout.planks.filter((p) => p.kind === "full");
  const cutPlanks = layout.planks.filter((p) => p.kind === "cut");
  const fullPlankCount = fullPlanks.length;
  const cutPieceCount = cutPlanks.length;

  const cutResult = input.reuseOffcuts
    ? optimizeOffcuts(cutPlanks.map((p) => p.effectiveLengthCm), input.plankLengthCm)
    : { cutPlankCount: cutPieceCount, reuseLog: [] as string[] };
  const cutPlankCount = cutResult.cutPlankCount;
  const totalPlankCount = fullPlankCount + cutPlankCount;

  const roomAreaCm2 = polygonArea(input.room);
  const roomAreaM2 = roomAreaCm2 / 10000;
  const pingShu = roomAreaM2 / 3.305;
  const perimeterM = polygonPerimeter(input.room) / 100;

  const plankNominalAreaCm2 =
    totalPlankCount * input.plankLengthCm * input.plankWidthCm;
  const usedAreaCm2 = layout.planks.reduce((s, p) => s + p.usedAreaCm2, 0);
  const wastePercent =
    input.wasteMode === "empirical"
      ? EMPIRICAL_WASTE * 100
      : usedAreaCm2 > 0
        ? ((plankNominalAreaCm2 - usedAreaCm2) / usedAreaCm2) * 100
        : 0;

  const items: FloorBomItem[] = [];

  items.push({
    category: "plank",
    nameZh: "地板片",
    spec: `${input.plankLengthCm}×${input.plankWidthCm} cm`,
    count: totalPlankCount,
    note:
      input.wasteMode === "empirical"
        ? `含經驗損耗 10%;建議進貨 ${Math.ceil(totalPlankCount * 1.1)} 片`
        : `整片 ${fullPlankCount} + 裁切 ${cutPlankCount}(實算損耗 ${wastePercent.toFixed(1)}%)`,
  });

  if (input.skirtingType !== "none") {
    items.push({
      category: "skirting",
      nameZh: input.skirtingType === "skirting" ? "踢腳板" : "收邊條",
      spec: "沿牆周長",
      totalLengthM: perimeterM,
      note: "未扣門洞,請依現場門口數量自行調整",
    });
  }

  items.push({
    category: "underlay",
    nameZh: "防潮墊",
    spec: "滿鋪",
    totalAreaM2: roomAreaM2,
  });

  return {
    input,
    layout,
    items,
    auto: { roomAreaM2, pingShu, perimeterM },
    trace: {
      fullPlankCount,
      cutPieceCount,
      cutPlankCount,
      totalPlankCount,
      wastePercent,
      plankRows: layout.rows,
      offcutReuseLog: cutResult.reuseLog,
    },
  };
}
```

- [ ] **Step 2: 型別檢查**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/floor" || echo "floor clean"`
Expected: `floor clean`

- [ ] **Step 3: Commit**

```bash
git add lib/floor/calc.ts
git commit -m "feat(floor): 算料引擎 BOM(片數/損耗/收邊/防潮墊)"
```

---

## Task 8: 測試 fixtures 與斷言腳本

**Files:**
- Create: `lib/floor/fixtures.ts`
- Create: `lib/floor/calc.test.ts`

- [ ] **Step 1: 建立 `lib/floor/fixtures.ts`**

```typescript
/**
 * 測試房間 fixtures — 給 calc.test.ts 與 UI 預設用。
 */
import type { FloorInput } from "./types";
import { DEFAULT_FLOOR_INPUT } from "./types";
import { getPreset } from "./presets";

export const FIXTURE_RECT: FloorInput = { ...DEFAULT_FLOOR_INPUT };

export const FIXTURE_L: FloorInput = {
  ...DEFAULT_FLOOR_INPUT,
  room: getPreset("l-shape"),
};

export const FIXTURE_T: FloorInput = {
  ...DEFAULT_FLOOR_INPUT,
  room: getPreset("t-shape"),
};
```

- [ ] **Step 2: 建立斷言腳本 `lib/floor/calc.test.ts`**

```typescript
/**
 * 排版+算料驗證腳本 — 跑法:npx tsx lib/floor/calc.test.ts
 *
 * 印出 fixtures 的完整 BOM 供 user 人眼核對,並用 assert 鎖住關鍵不變量:
 *   - 房間面積/周長與幾何計算一致
 *   - 總片數 = 整片 + 裁切片
 *   - L 型房間面積 < 同 bbox 矩形面積(挖空生效)
 *   - 防潮墊面積 = 房間面積
 */
import { computeFloorBom } from "./calc";
import { FIXTURE_RECT, FIXTURE_L, FIXTURE_T } from "./fixtures";
import { polygonArea } from "./geometry";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}
function approx(a: number, b: number, eps = 0.05) {
  return Math.abs(a - b) < eps;
}

for (const [name, input] of [
  ["矩形 420×300", FIXTURE_RECT],
  ["L 型", FIXTURE_L],
  ["T 型", FIXTURE_T],
] as const) {
  const bom = computeFloorBom(input);
  console.log(`\n=== ${name} ===`);
  console.log(
    `面積 ${bom.auto.roomAreaM2.toFixed(2)} m² / ${bom.auto.pingShu.toFixed(2)} 坪 / 周長 ${bom.auto.perimeterM.toFixed(2)} m`,
  );
  console.log(
    `地板片 整片 ${bom.trace.fullPlankCount} + 裁切 ${bom.trace.cutPlankCount} = ${bom.trace.totalPlankCount} 片(${bom.trace.plankRows} 排,損耗 ${bom.trace.wastePercent.toFixed(1)}%)`,
  );
  for (const it of bom.items) console.log(`  - ${it.nameZh} ${it.spec}`, it.note ?? "");

  assert(
    approx(bom.auto.roomAreaM2, polygonArea(input.room) / 10000),
    `${name} 面積一致`,
  );
  assert(
    bom.trace.totalPlankCount ===
      bom.trace.fullPlankCount + bom.trace.cutPlankCount,
    `${name} 總片數 = 整片 + 裁切`,
  );
  assert(bom.trace.plankRows > 0, `${name} 排數 > 0`);
  const underlay = bom.items.find((i) => i.category === "underlay");
  assert(
    approx(underlay?.totalAreaM2 ?? -1, bom.auto.roomAreaM2),
    `${name} 防潮墊面積 = 房間面積`,
  );
}

// L 型房間面積 < 矩形(挖空生效)
assert(
  computeFloorBom(FIXTURE_L).auto.roomAreaM2 <
    computeFloorBom(FIXTURE_RECT).auto.roomAreaM2,
  "L 型面積 < 矩形",
);

console.log(`\n✅ calc: ${passed} passed`);
```

- [ ] **Step 3: 跑斷言腳本**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsx lib/floor/calc.test.ts`
Expected: 印出三個 fixture 的 BOM,結尾 `✅ calc: 13 passed`

- [ ] **Step 4: Commit**

```bash
git add lib/floor/fixtures.ts lib/floor/calc.test.ts
git commit -m "test(floor): fixtures + 排版算料斷言腳本"
```

---

## Task 9: 權限 flag

**Files:**
- Modify: `lib/permissions.ts`

- [ ] **Step 1: 先看現況**

Run: `cd ~/Desktop/wooden-ren-designer && grep -n "canUseCeilingTool" lib/permissions.ts`
Expected: 列出 interface 宣告行 + 各 plan 物件的 `canUseCeilingTool: true/false` 行。

- [ ] **Step 2: 加入 `canUseFloorTool`**

在 `lib/permissions.ts` 中,**每一處** `canUseCeilingTool` 出現的下一行,複製一行把 `Ceiling` 換成 `Floor`、值完全相同。包含:
- interface 的 `canUseCeilingTool: boolean;` → 下一行加 `canUseFloorTool: boolean;`
- 每個 plan 物件(free/student 等為 `false`,pro 等為 `true`)的 `canUseCeilingTool: X,` → 下一行加 `canUseFloorTool: X,`(X 與該行相同)

- [ ] **Step 3: 型別檢查**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "permissions|canUseFloor" || echo "permissions clean"`
Expected: `permissions clean`

- [ ] **Step 4: Commit**

```bash
git add lib/permissions.ts
git commit -m "feat(floor): 新增 canUseFloorTool 權限 flag"
```

---

## Task 10: 路由(階段 1 admin 限定驗證頁)

**Files:**
- Create: `app/floor/page.tsx`
- Create: `app/floor/FloorDevClient.tsx`(本任務先做最小版,Task 13 擴充)

- [ ] **Step 1: 建立最小 `app/floor/FloorDevClient.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT } from "@/lib/floor/types";

export function FloorDevClient() {
  const bom = useMemo(() => computeFloorBom(DEFAULT_FLOOR_INPUT), []);
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-bold">地板施工模擬器(階段 1 驗證頁)</h1>
      <p className="mt-1 text-sm text-zinc-500">
        房間 {bom.auto.roomAreaM2.toFixed(2)} m² / {bom.auto.pingShu.toFixed(1)} 坪
      </p>
      <ul className="mt-4 space-y-1 text-sm">
        {bom.items.map((it, i) => (
          <li key={i}>
            {it.nameZh} — {it.spec}
            {it.count != null && ` ×${it.count}`}
            {it.totalLengthM != null && ` ${it.totalLengthM.toFixed(1)} m`}
            {it.totalAreaM2 != null && ` ${it.totalAreaM2.toFixed(1)} m²`}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-400">
        整片 {bom.trace.fullPlankCount} + 裁切 {bom.trace.cutPlankCount} ={" "}
        {bom.trace.totalPlankCount} 片({bom.trace.plankRows} 排)
      </p>
    </main>
  );
}
```

- [ ] **Step 2: 建立 `app/floor/page.tsx`(complete copy of ceiling gating)**

```tsx
/**
 * /floor — 地板施工模擬器
 *
 * 階段 1(目前):純算料引擎驗證頁,只限 admin 看。
 *   非 admin 進來 → 導 /pricing?upgrade=floor
 *   階段 4 才會接 canUseFloorTool 對外開放。
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { FloorDevClient } from "./FloorDevClient";

export const metadata = {
  title: "地板施工模擬器 · 木頭仁",
};

export default async function FloorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/floor");

  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    if (!canUseFeature(profile as UserPlanProfile | null, "canUseFloorTool")) {
      redirect("/pricing?upgrade=floor");
    }
  }
  return <FloorDevClient />;
}
```

- [ ] **Step 3: 型別檢查 + build 路由**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/floor" || echo "floor route clean"`
Expected: `floor route clean`

- [ ] **Step 4: Commit**

```bash
git add app/floor/page.tsx app/floor/FloorDevClient.tsx
git commit -m "feat(floor): /floor 路由 + 階段 1 admin 限定驗證頁"
```

---

## Task 11: 2D 俯視排版圖

**Files:**
- Create: `lib/floor/FloorOverviewSvg.tsx`

- [ ] **Step 1: 建立 `lib/floor/FloorOverviewSvg.tsx`**

```tsx
/**
 * 地板 2D 俯視排版圖。
 * 畫:房間外框、可鋪區域(虛線)、每片地板(整片/裁切片不同填色,裁切片標紅框)。
 */
import type { FloorBom } from "./types";
import { boundingBox } from "./geometry";

interface Props {
  bom: FloorBom;
  /** SVG 寬度 px,高度依房間比例 */
  width?: number;
}

export function FloorOverviewSvg({ bom, width = 520 }: Props) {
  const room = bom.input.room;
  const bb = boundingBox(room);
  const pad = 16;
  const roomW = bb.maxX - bb.minX;
  const roomH = bb.maxY - bb.minY;
  const scale = (width - pad * 2) / roomW;
  const height = roomH * scale + pad * 2;
  const tx = (x: number) => (x - bb.minX) * scale + pad;
  const ty = (y: number) => (y - bb.minY) * scale + pad;

  const roomPath =
    room.vertices.map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`).join(" ") +
    " Z";
  const layablePath =
    bom.layout.layableRegion.vertices
      .map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`)
      .join(" ") + " Z";

  return (
    <svg width={width} height={height} className="rounded border border-zinc-200">
      {/* 地板片 */}
      {bom.layout.planks.map((p, i) => (
        <rect
          key={i}
          x={tx(p.x)}
          y={ty(p.y)}
          width={p.widthCmToPx(p, scale, true)}
          height={p.widthCmToPx(p, scale, false)}
          fill={p.kind === "full" ? "#e7d8ae" : "#f3d9d4"}
          stroke={p.kind === "full" ? "#bd9955" : "#c0392b"}
          strokeWidth={0.6}
        />
      ))}
      {/* 可鋪區域虛線 */}
      <path d={layablePath} fill="none" stroke="#bd9955" strokeWidth={1} strokeDasharray="4 3" />
      {/* 房間外框 */}
      <path d={roomPath} fill="none" stroke="#333" strokeWidth={1.5} />
    </svg>
  );
}
```

注意:上面 `p.widthCmToPx(...)` 是佔位寫法,需改為直接算矩形寬高。把兩個 `width=`/`height=` 屬性改為:

```tsx
          width={p.lengthCm * scale}
          height={p.widthCm * scale}
```

— 但 `PlacedPlank` 的 `lengthCm` 是「run 軸」方向、`widthCm` 是「排堆疊」方向,而 run 軸可能是 X 或 Y。為正確繪製,改用以下判定:在 `FloorOverviewSvg` 內由 `bom.input.direction` + bbox 推 `runAlongX`(與 `layout.ts` 相同邏輯),`runAlongX` 時 `width=lengthCm*scale, height=widthCm*scale`,否則對調。

- [ ] **Step 2: 改正繪製尺寸**

把 Step 1 的 `<rect>` 寬高改為下列完整版本(在 component 內先算 `runAlongX`):

```tsx
  const layBb = boundingBox(bom.layout.layableRegion);
  const runAlongX =
    bom.input.direction === "long-axis"
      ? layBb.maxX - layBb.minX >= layBb.maxY - layBb.minY
      : layBb.maxX - layBb.minX < layBb.maxY - layBb.minY;
```

`<rect>` 的寬高:

```tsx
          width={(runAlongX ? p.lengthCm : p.widthCm) * scale}
          height={(runAlongX ? p.widthCm : p.lengthCm) * scale}
```

- [ ] **Step 3: 型別檢查**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "FloorOverviewSvg" || echo "svg clean"`
Expected: `svg clean`

- [ ] **Step 4: Commit**

```bash
git add lib/floor/FloorOverviewSvg.tsx
git commit -m "feat(floor): 2D 俯視排版圖 SVG"
```

---

## Task 12: 格線畫布編輯器

**Files:**
- Create: `app/floor/FloorCanvasEditor.tsx`

- [ ] **Step 1: 建立 `app/floor/FloorCanvasEditor.tsx`**

```tsx
"use client";

/**
 * 格線畫布房間編輯器:顯示房間正交多邊形,拖角點微調。
 * 角點吸附格線(預設 10cm)。拖動後即時把更新後的 RoomPolygon 回拋。
 *
 * v1 只支援「拖角點」與「吸附格線」;加/刪角點留待後續迭代。
 * 為維持正交不變量:拖某角點時,與它相鄰的兩角點各自跟著對齊
 *(共用水平邊的角點同步 y,共用垂直邊的角點同步 x)。
 */
import { useRef, useState } from "react";
import type { Point, RoomPolygon } from "@/lib/floor/types";
import { boundingBox } from "@/lib/floor/geometry";

interface Props {
  room: RoomPolygon;
  onChange: (room: RoomPolygon) => void;
  gridCm?: number;
  width?: number;
}

export function FloorCanvasEditor({
  room,
  onChange,
  gridCm = 10,
  width = 520,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const bb = boundingBox(room);
  const pad = 24;
  const span = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY, 100);
  const scale = (width - pad * 2) / span;
  const height = width;
  const tx = (x: number) => (x - bb.minX) * scale + pad;
  const ty = (y: number) => (y - bb.minY) * scale + pad;
  const snap = (v: number) => Math.round(v / gridCm) * gridCm;

  function pointerToRoom(e: React.PointerEvent): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: snap((e.clientX - rect.left - pad) / scale + bb.minX),
      y: snap((e.clientY - rect.top - pad) / scale + bb.minY),
    };
  }

  function handleMove(e: React.PointerEvent) {
    if (dragIdx == null) return;
    const np = pointerToRoom(e);
    const v = room.vertices.map((p) => ({ ...p }));
    const n = v.length;
    const prev = (dragIdx - 1 + n) % n;
    const next = (dragIdx + 1) % n;
    // 維持正交:與 prev 共用的邊、與 next 共用的邊
    // 判斷被拖角點原本與 prev 是水平或垂直邊
    const prevHoriz = Math.abs(v[dragIdx].y - v[prev].y) < 0.001;
    v[dragIdx] = np;
    if (prevHoriz) {
      v[prev].y = np.y; // 與 prev 共用水平邊 → 同步 y
      v[next].x = np.x; // 與 next 共用垂直邊 → 同步 x
    } else {
      v[prev].x = np.x;
      v[next].y = np.y;
    }
    onChange({ vertices: v });
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="touch-none rounded border border-zinc-200 bg-white"
      onPointerMove={handleMove}
      onPointerUp={() => setDragIdx(null)}
      onPointerLeave={() => setDragIdx(null)}
    >
      {/* 格線 */}
      {Array.from({ length: Math.ceil(span / gridCm) + 1 }).map((_, i) => {
        const c = bb.minX + i * gridCm;
        return (
          <g key={i}>
            <line x1={tx(c)} y1={pad} x2={tx(c)} y2={height - pad} stroke="#eee" />
            <line x1={pad} y1={ty(c)} x2={width - pad} y2={ty(c)} stroke="#eee" />
          </g>
        );
      })}
      {/* 房間外框 */}
      <path
        d={
          room.vertices
            .map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`)
            .join(" ") + " Z"
        }
        fill="#bd995522"
        stroke="#bd9955"
        strokeWidth={2}
      />
      {/* 角點 */}
      {room.vertices.map((p, i) => (
        <circle
          key={i}
          cx={tx(p.x)}
          cy={ty(p.y)}
          r={7}
          fill="#fff"
          stroke="#8a6d3b"
          strokeWidth={2}
          className="cursor-grab"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            setDragIdx(i);
          }}
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: 型別檢查**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "FloorCanvasEditor" || echo "editor clean"`
Expected: `editor clean`

- [ ] **Step 3: Commit**

```bash
git add app/floor/FloorCanvasEditor.tsx
git commit -m "feat(floor): 格線畫布房間編輯器(拖角點+吸附+正交維持)"
```

---

## Task 13: 完整 Client UI

**Files:**
- Modify: `app/floor/FloorDevClient.tsx`(全部改寫)

- [ ] **Step 1: 全部改寫 `app/floor/FloorDevClient.tsx`**

```tsx
"use client";

/**
 * /floor Client UI:房間編輯器 + 範本 + 設定表單 + 排版預覽 + BOM。
 * 任何輸入變更 → 即時 computeFloorBom 重算。
 */
import { useMemo, useState } from "react";
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT, type FloorInput, type RoomPolygon } from "@/lib/floor/types";
import { SHAPE_PRESETS, getPreset, type ShapePreset } from "@/lib/floor/presets";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { FloorCanvasEditor } from "./FloorCanvasEditor";

export function FloorDevClient() {
  const [input, setInput] = useState<FloorInput>(DEFAULT_FLOOR_INPUT);
  const bom = useMemo(() => computeFloorBom(input), [input]);

  const set = <K extends keyof FloorInput>(k: K, v: FloorInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));
  const setRoom = (room: RoomPolygon) => setInput((p) => ({ ...p, room }));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-bold">地板施工模擬器</h1>
      <p className="mt-1 text-sm text-zinc-500">
        超耐磨/海島型木地板平鋪 · 階段 1 驗證頁(admin 限定)
      </p>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* 左:房間編輯 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">房間形狀</h2>
          <div className="mb-2 flex gap-2">
            {SHAPE_PRESETS.map((preset: ShapePreset) => (
              <button
                key={preset.id}
                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                onClick={() => setRoom(getPreset(preset.id))}
              >
                {preset.nameZh}
              </button>
            ))}
          </div>
          <FloorCanvasEditor room={input.room} onChange={setRoom} />
        </section>

        {/* 右:設定 + 預覽 */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">排版設定</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <NumField label="地板片長 (cm)" value={input.plankLengthCm}
              onChange={(v) => set("plankLengthCm", v)} />
            <NumField label="地板片寬 (cm)" value={input.plankWidthCm}
              onChange={(v) => set("plankWidthCm", v)} />
            <NumField label="伸縮縫 (mm)" value={input.expansionGapMm}
              onChange={(v) => set("expansionGapMm", v)} />
            <SelField label="鋪設方向" value={input.direction}
              opts={[["long-axis", "沿長邊"], ["short-axis", "沿短邊"]]}
              onChange={(v) => set("direction", v as FloorInput["direction"])} />
            <SelField label="錯縫" value={input.stagger}
              opts={[["half", "1/2"], ["third", "1/3"], ["random", "亂縫"]]}
              onChange={(v) => set("stagger", v as FloorInput["stagger"])} />
            <SelField label="損耗計法" value={input.wasteMode}
              opts={[["computed", "實算"], ["empirical", "經驗+10%"]]}
              onChange={(v) => set("wasteMode", v as FloorInput["wasteMode"])} />
          </div>
          <div className="mt-3">
            <FloorOverviewSvg bom={bom} width={420} />
          </div>
        </section>
      </div>

      {/* BOM */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">材料清單</h2>
        <p className="text-sm text-zinc-600">
          房間 {bom.auto.roomAreaM2.toFixed(1)} m² / {bom.auto.pingShu.toFixed(1)} 坪 ·
          周長 {bom.auto.perimeterM.toFixed(1)} m
        </p>
        <table className="mt-2 w-full border-collapse text-sm">
          <tbody>
            {bom.items.map((it, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="py-1 font-medium">{it.nameZh}</td>
                <td className="py-1 text-zinc-500">{it.spec}</td>
                <td className="py-1 text-right">
                  {it.count != null && `${it.count} 片`}
                  {it.totalLengthM != null && `${it.totalLengthM.toFixed(1)} m`}
                  {it.totalAreaM2 != null && `${it.totalAreaM2.toFixed(1)} m²`}
                </td>
                <td className="py-1 pl-3 text-xs text-zinc-400">{it.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-zinc-400">
          整片 {bom.trace.fullPlankCount} + 裁切 {bom.trace.cutPlankCount} ={" "}
          {bom.trace.totalPlankCount} 片 · {bom.trace.plankRows} 排 · 損耗{" "}
          {bom.trace.wastePercent.toFixed(1)}%
        </p>
      </section>
    </main>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-zinc-500">{label}</span>
      <input
        type="number"
        className="rounded border border-zinc-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function SelField({
  label,
  value,
  opts,
  onChange,
}: {
  label: string;
  value: string;
  opts: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-zinc-500">{label}</span>
      <select
        className="rounded border border-zinc-300 px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: 型別檢查**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/floor" || echo "floor ui clean"`
Expected: `floor ui clean`

- [ ] **Step 3: Commit**

```bash
git add app/floor/FloorDevClient.tsx
git commit -m "feat(floor): 完整 Client UI(編輯器+設定+預覽+BOM)"
```

---

## Task 14: 整合驗證

**Files:** 無(僅驗證)

- [ ] **Step 1: 全專案型別檢查**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsc --noEmit -p tsconfig.json 2>&1 | tail -5`
Expected: 無 error(或僅既有非 floor 的 warning)。

- [ ] **Step 2: 兩支斷言腳本全綠**

Run: `cd ~/Desktop/wooden-ren-designer && npx tsx lib/floor/geometry.test.ts && npx tsx lib/floor/calc.test.ts`
Expected: `✅ geometry: 18 passed` 與 `✅ calc: 13 passed`。

- [ ] **Step 3: dev server 起頁面**

Run(背景):`cd ~/Desktop/wooden-ren-designer && npm run dev`
以 admin 帳號開 `http://localhost:3000/floor`,playwright 截圖肉眼確認:
- 房間編輯器顯示矩形、可拖角點
- 點「L 型」範本 → 房間變 L 形、預覽地板片重排
- BOM 表顯示地板片數 / 踢腳板 / 防潮墊
- 改錯縫下拉 → 預覽錯縫花樣改變

注意:若 dev server 卡住,見 memory「Next 16 middleware.ts dev mode hang」—— 暫時 `mv middleware.ts middleware.ts.disabled`,驗完還原。

- [ ] **Step 4: Commit(若 Step 3 有修正)**

```bash
git add -A
git commit -m "fix(floor): 整合驗證修正"
```

---

## 自我檢查紀錄

**Spec 覆蓋:** 型別(T1)、幾何(T2-3)、範本(T4)、排版引擎(T5)、餘料優化(T6)、BOM(T7)、測試(T8)、權限(T9)、路由(T10)、2D 預覽(T11)、畫布編輯器(T12)、完整 UI(T13)、整合(T14)。spec §3-10 全覆蓋;§9 階段 3/4(預覽美化、對 pro 開放)依 spec 屬後續計畫,不在此 plan。

**型別一致性:** `FloorInput` / `FloorLayout` / `PlacedPlank` / `FloorBom` 在 T1 定義,T5/T7/T11/T13 沿用同名屬性;`computeFloorLayout`(T5)、`optimizeOffcuts`(T6)、`computeFloorBom`(T7)簽名一致;`runAlongX` 推導邏輯在 layout.ts(T5)與 FloorOverviewSvg(T11)一致。

**待核對假設:** 見 spec §11(地板片預設尺寸、門洞扣除、餘料單刀切)— 實作後請使用者核對 `// ASSUMPTION` 標記處。
