# STL 匯出優化 階段 2：攤平排版匯出 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 執行前先用 superpowers:using-git-worktrees 開隔離工作區（與並行 session 隔離）。

**Goal:** 新增「攤平排版 STL」匯出——所有零件攤平躺平、互不重疊排在虛擬列印床上，匯成單一 STL，免支撐免拆。

**Architecture:** 新模組 `lib/export/flat-layout.ts` 負責「攤平姿態」（`orientFlat`）與「排版」（`packShelves`）兩個純函式，再由 `buildFlatLayoutGroup` 組成 three.js Group。每件零件的幾何沿用 `three-d-export.ts` 既有的 part→geometry 邏輯（抽成共用 `partExportGeometry`）。既有「組裝姿態整件 STL」完全不動。

**Tech Stack:** TypeScript、three.js（`BufferGeometry`、`BoxGeometry`、`Group`、`Mesh`）、React。測試比照專案慣例：`.test.ts` 用 `npx tsx` 跑 assert 腳本。

**前置：** spec `docs/superpowers/specs/2026-05-20-stl-export-optimization-design.md` 第 ④ 節；階段 1（commit `756a365`，`export-checks.ts` + 自檢）已上線。

**鐵律：** 既有 `downloadSTL` / `downloadOBJ`（組裝姿態整件）行為 100% 不變。攤平是**新增**的並存匯出。

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `lib/export/flat-layout.ts` | 新增。`orientFlat`（單件攤平姿態）、`packShelves`（shelf packing 排版）、`buildFlatLayoutGroup`（組成 Group）、常數。 |
| `lib/export/flat-layout.test.ts` | 新增。`npx tsx` assert 測試腳本。 |
| `lib/export/three-d-export.ts` | 修改。抽出共用 `partExportGeometry(part)`；新增 `downloadFlatLayoutSTL`。 |
| `components/ThreeDExportButton.tsx` | 修改。加「🛏️ 攤平 STL」按鈕。 |

---

## Task 1：抽出共用 `partExportGeometry`

把 `buildGroup` 內「part → geometry」的邏輯抽成可重用的 exported 函式，讓 `flat-layout.ts` 共用同一套，不重複 `toShapeSpec` + `buildShapeGeometry` + box fallback。

**Files:**
- Modify: `lib/export/three-d-export.ts`

- [ ] **Step 1: 加 `BufferGeometry` import 與 `partExportGeometry`**

`lib/export/three-d-export.ts` 第一行 import 目前是：
```ts
import { BoxGeometry, Euler, Group, Mesh, MeshBasicMaterial } from "three";
```
改成（加 `BufferGeometry`）：
```ts
import { BoxGeometry, BufferGeometry, Euler, Group, Mesh, MeshBasicMaterial } from "three";
```

在 `buildGroup` 函式**之前**（緊接在 `toShapeSpec` 函式的結尾 `}` 之後）插入：
```ts
/**
 * 把單一零件轉成匯出用 geometry（mm 單位）：有對應 shape 走 buildShapeGeometry，
 * 否則 fallback 方塊。組裝匯出與攤平匯出共用，確保兩者幾何一致。
 */
export function partExportGeometry(part: Part): BufferGeometry {
  const sizeMm: [number, number, number] = [
    part.visible.length,
    part.visible.thickness,
    part.visible.width,
  ];
  const spec = toShapeSpec(part.shape);
  const shapeGeom = spec ? buildShapeGeometry(spec, sizeMm) : null;
  return shapeGeom ?? new BoxGeometry(sizeMm[0], sizeMm[1], sizeMm[2]);
}
```

- [ ] **Step 2: 改 `buildGroup` 改用 `partExportGeometry`**

`buildGroup` 內目前每個 part 的這段：
```ts
    // size 走 mm（buildShapeGeometry 單位由 caller 決定，匯出器一律 mm）
    const sizeMm: [number, number, number] = [
      p.visible.length,
      p.visible.thickness,
      p.visible.width,
    ];
    const spec = toShapeSpec(p.shape);
    const shapeGeom = spec ? buildShapeGeometry(spec, sizeMm) : null;
    const geom = shapeGeom ?? new BoxGeometry(sizeMm[0], sizeMm[1], sizeMm[2]);
```
整段換成一行：
```ts
    const geom = partExportGeometry(p);
```
其餘 `buildGroup` 內容（`mesh`、`worldExtents`、`mesh.position`、`mesh.rotation`、`root.add`）完全不動。

- [ ] **Step 3: 型別檢查 — 確認重構不破壞既有匯出**

Run: `npx tsc --noEmit 2>&1 | grep -E "three-d-export" || echo "目標檔 0 error"`
Expected: `目標檔 0 error`

- [ ] **Step 4: 行為不變檢查**

Run: `npx tsx -e "import('./lib/export/three-d-export.ts').then(m => { const g = m.buildGroup; console.log(typeof g === 'function' ? 'buildGroup 仍 export ✅' : 'FAIL'); })"`
Expected: `buildGroup 仍 export ✅`
（`partExportGeometry` 只是抽取，`buildGroup` 對外行為不變——同樣的 size、同樣的 shape 分派。）

- [ ] **Step 5: Commit**

```bash
git add lib/export/three-d-export.ts
git commit -m "refactor(export): 抽出共用 partExportGeometry（組裝/攤平匯出共用）"
```

---

## Task 2：排版純函式 `packShelves`

**Files:**
- Create: `lib/export/flat-layout.ts`
- Test: `lib/export/flat-layout.test.ts`

- [ ] **Step 1: 寫 failing test**

建立 `lib/export/flat-layout.test.ts`：
```ts
/**
 * lib/export/flat-layout.ts 驗證腳本
 * 跑法：npx tsx lib/export/flat-layout.test.ts
 */
import { packShelves } from "./flat-layout";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

// --- packShelves ---
// 3 件各 100×50，床寬 250、間隔 10：前 2 件同列（0..210 < 250），第 3 件換列
const p = packShelves(
  [
    { w: 100, d: 50 },
    { w: 100, d: 50 },
    { w: 100, d: 50 },
  ],
  250,
  10,
);
check("第 1 件中心 x=50 z=25", p[0].x === 50 && p[0].z === 25);
check("第 2 件中心 x=160 z=25（同列）", p[1].x === 160 && p[1].z === 25);
check("第 3 件換列 x=50 z=85", p[2].x === 50 && p[2].z === 85);

// 順序：回傳順序對應輸入順序（內部依大小排但輸出位置回填原 index）
const p2 = packShelves([{ w: 200, d: 30 }, { w: 40, d: 30 }], 250, 10);
check("回傳對應輸入順序、件數一致", p2.length === 2);
check("窄件與寬件不重疊（x 不同）", p2[0].x !== p2[1].x);

// --- 收尾 ---
if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx tsx lib/export/flat-layout.test.ts`
Expected: FAIL — `Cannot find module './flat-layout'`。

- [ ] **Step 3: 建立 `flat-layout.ts` 並實作 `packShelves`**

建立 `lib/export/flat-layout.ts`：
```ts
import { BufferGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import type { FurnitureDesign } from "@/lib/types";
import { partExportGeometry } from "./three-d-export";

/** 攤平排版零件間隔（mm，縮放前） */
export const LAYOUT_GAP_MM = 8;
/** 虛擬列印床寬度（mm）——只決定 shelf packing 何時換列，不阻擋超寬件 */
export const LAYOUT_BED_MM = 250;

export interface PackItem {
  /** footprint X 寬（mm） */
  w: number;
  /** footprint Z 深（mm） */
  d: number;
}

export interface PackPos {
  /** 中心 X（mm） */
  x: number;
  /** 中心 Z（mm） */
  z: number;
}

/**
 * Shelf packing：矩形 footprint 由左至右排，cursor 超過 bedWidth 換列。
 * 較長邊大的先排（較穩）。回傳陣列順序對應輸入順序。
 */
export function packShelves(
  items: PackItem[],
  bedWidth: number,
  gap: number,
): PackPos[] {
  const order = items
    .map((_, i) => i)
    .sort(
      (a, b) =>
        Math.max(items[b].w, items[b].d) - Math.max(items[a].w, items[a].d),
    );
  const pos: PackPos[] = new Array(items.length);
  let cursorX = 0;
  let rowZ = 0;
  let rowDepth = 0;
  for (const i of order) {
    const it = items[i];
    // 此列已有件、且再放會超過床寬 → 換列
    if (cursorX > 0 && cursorX + it.w > bedWidth) {
      rowZ += rowDepth + gap;
      cursorX = 0;
      rowDepth = 0;
    }
    pos[i] = { x: cursorX + it.w / 2, z: rowZ + it.d / 2 };
    cursorX += it.w + gap;
    rowDepth = Math.max(rowDepth, it.d);
  }
  return pos;
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx tsx lib/export/flat-layout.test.ts`
Expected: PASS — 5 個 check 全綠、印「全部通過」。

- [ ] **Step 5: Commit**

```bash
git add lib/export/flat-layout.ts lib/export/flat-layout.test.ts
git commit -m "feat(export): packShelves 攤平排版 shelf packing"
```

---

## Task 3：攤平姿態 `orientFlat`

**Files:**
- Modify: `lib/export/flat-layout.ts`
- Test: `lib/export/flat-layout.test.ts`

- [ ] **Step 1: 加 failing test**

在 `flat-layout.test.ts` 的 import 區，把：
```ts
import { packShelves } from "./flat-layout";
```
改成：
```ts
import { packShelves, orientFlat } from "./flat-layout";
import { BoxGeometry } from "three";
```

在 `// --- 收尾 ---` **之前**插入：
```ts
// --- orientFlat ---
// 方塊 300×18×200（X×Y×Z）：Y 最小（18）→ 已攤平、不轉
const d1 = orientFlat(new BoxGeometry(300, 18, 200));
check("Y 最薄→不轉，footprint 300×200 高 18", d1.footprintX === 300 && d1.footprintZ === 200 && d1.height === 18);

// 方塊 400×35×20：Z 最小（20）→ 繞 X 轉，Z→Y
const d2 = orientFlat(new BoxGeometry(400, 35, 20));
check("Z 最薄→轉平，footprint 400×35 高 20", d2.footprintX === 400 && d2.footprintZ === 35 && d2.height === 20);

// 方塊 35×400×35：X 最小（與 Z 並列，取 X）→ 繞 Z 轉，X→Y
const d3 = orientFlat(new BoxGeometry(35, 400, 35));
check("長軸在 Y→轉平，高度=35（最薄）", d3.height === 35 && Math.max(d3.footprintX, d3.footprintZ) === 400);
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx tsx lib/export/flat-layout.test.ts`
Expected: FAIL — `orientFlat` 尚未 export。

- [ ] **Step 3: 在 `flat-layout.ts` 實作 `orientFlat`**

在 `flat-layout.ts` 的 `packShelves` 函式**之後**追加：
```ts
export interface FlatDims {
  /** 攤平後 footprint X 長度（mm） */
  footprintX: number;
  /** 攤平後 footprint Z 長度（mm） */
  footprintZ: number;
  /** 攤平後高度＝最薄維度，沿 Y（mm） */
  height: number;
}

/**
 * 把零件 geometry 就地旋轉成「最薄維度沿 Y 軸（朝上）」的攤平姿態。
 * 旋轉一律 90° 的整數倍。回傳攤平後的 XZ footprint 與高度。
 *
 * 注意：忽略零件在家具裡的裝配 rotation——攤平是製造姿態，只看 geometry 本身。
 */
export function orientFlat(geom: BufferGeometry): FlatDims {
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  if (sx <= sy && sx <= sz) {
    // X 最薄 → 繞 Z 轉 +90°：+X 軸轉到 +Y
    geom.rotateZ(Math.PI / 2);
  } else if (sz <= sy && sz <= sx) {
    // Z 最薄 → 繞 X 轉 -90°：+Z 軸轉到 +Y
    geom.rotateX(-Math.PI / 2);
  }
  // Y 最薄 → 已是攤平姿態，不旋轉
  geom.computeBoundingBox();
  const b = geom.boundingBox!;
  return {
    footprintX: b.max.x - b.min.x,
    footprintZ: b.max.z - b.min.z,
    height: b.max.y - b.min.y,
  };
}
```

`BufferGeometry` 已在 `flat-layout.ts` 檔頭 import（Task 2 Step 3），無需再加。

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx tsx lib/export/flat-layout.test.ts`
Expected: PASS — 8 個 check 全綠。

- [ ] **Step 5: Commit**

```bash
git add lib/export/flat-layout.ts lib/export/flat-layout.test.ts
git commit -m "feat(export): orientFlat 零件攤平姿態（最薄維度朝上）"
```

---

## Task 4：組成 `buildFlatLayoutGroup`

**Files:**
- Modify: `lib/export/flat-layout.ts`
- Test: `lib/export/flat-layout.test.ts`

- [ ] **Step 1: 加 failing test**

在 `flat-layout.test.ts` 的 import 區把：
```ts
import { packShelves, orientFlat } from "./flat-layout";
import { BoxGeometry } from "three";
```
改成：
```ts
import { packShelves, orientFlat, buildFlatLayoutGroup } from "./flat-layout";
import { BoxGeometry, Box3, Mesh } from "three";
import type { FurnitureDesign } from "@/lib/types";
```

在 `// --- 收尾 ---` **之前**插入：
```ts
// --- buildFlatLayoutGroup ---
const flatDesign = {
  category: "stool",
  parts: [
    { id: "a", nameZh: "板A", visible: { length: 200, width: 150, thickness: 18 } },
    { id: "b", nameZh: "板B", visible: { length: 200, width: 150, thickness: 18 } },
    { id: "glass", nameZh: "玻璃", visual: true, visible: { length: 10, width: 10, thickness: 2 } },
  ],
} as unknown as FurnitureDesign;

const group = buildFlatLayoutGroup(flatDesign, 1);
const meshes: Mesh[] = [];
group.traverse((o) => {
  if ((o as Mesh).isMesh) meshes.push(o as Mesh);
});
check("攤平 group 跳過 visual 件、剩 2 件", meshes.length === 2);

// 兩件世界 AABB 不重疊（group 已套 Z-up 旋轉 + scale=1）
group.updateMatrixWorld(true);
const box0 = new Box3().setFromObject(meshes[0]);
const box1 = new Box3().setFromObject(meshes[1]);
const overlap =
  box0.max.x > box1.min.x + 1e-6 &&
  box1.max.x > box0.min.x + 1e-6 &&
  box0.max.y > box1.min.y + 1e-6 &&
  box1.max.y > box0.min.y + 1e-6;
check("兩件攤平後互不重疊", !overlap);

// 攤平後所有件坐在床面（Z-up 後最低點 z ≈ 0）
const minZ = Math.min(box0.min.z, box1.min.z);
check("零件底面坐列印床 z≈0", Math.abs(minZ) < 1e-3);
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx tsx lib/export/flat-layout.test.ts`
Expected: FAIL — `buildFlatLayoutGroup` 尚未 export。

- [ ] **Step 3: 在 `flat-layout.ts` 實作 `buildFlatLayoutGroup`**

在 `flat-layout.ts` 的 `orientFlat` 函式**之後**追加：
```ts
/**
 * 建出「攤平排版」的零件 Group——每件攤平躺平、shelf packing 排在虛擬列印床上，
 * 全部底面坐 Z=0。供 downloadFlatLayoutSTL 匯出單一 STL 用。
 *
 * 與 buildGroup（組裝姿態）並存、互不影響。
 */
export function buildFlatLayoutGroup(
  design: FurnitureDesign,
  scale: number,
): Group {
  const root = new Group();
  const mat = new MeshBasicMaterial();

  // 1) 每件建幾何 + 攤平姿態
  const entries: Array<{ geom: BufferGeometry; dims: FlatDims; name: string }> = [];
  for (const part of design.parts) {
    if (part.visual) continue;
    const geom = partExportGeometry(part);
    const dims = orientFlat(geom);
    entries.push({ geom, dims, name: part.nameZh || part.id });
  }

  // 2) shelf packing
  const positions = packShelves(
    entries.map((e) => ({ w: e.dims.footprintX, d: e.dims.footprintZ })),
    LAYOUT_BED_MM,
    LAYOUT_GAP_MM,
  );

  // 3) 擺放：每件中心對齊排版座標、底面坐 Y=0
  for (let i = 0; i < entries.length; i++) {
    const { geom, name } = entries[i];
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    const mesh = new Mesh(geom, mat);
    mesh.name = name;
    mesh.position.set(positions[i].x - cx, -bb.min.y, positions[i].z - cz);
    root.add(mesh);
  }

  // Y up → Z up（slicer 慣例），與 buildGroup 一致
  root.rotation.x = -Math.PI / 2;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  return root;
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx tsx lib/export/flat-layout.test.ts`
Expected: PASS — 11 個 check 全綠。

- [ ] **Step 5: Commit**

```bash
git add lib/export/flat-layout.ts lib/export/flat-layout.test.ts
git commit -m "feat(export): buildFlatLayoutGroup 攤平排版單一 group"
```

---

## Task 5：`downloadFlatLayoutSTL` + UI 按鈕

**Files:**
- Modify: `lib/export/three-d-export.ts`
- Modify: `components/ThreeDExportButton.tsx`

- [ ] **Step 1: 在 `three-d-export.ts` 加 `downloadFlatLayoutSTL`**

在 `three-d-export.ts` 既有 import 區加：
```ts
import { buildFlatLayoutGroup } from "./flat-layout";
```

在 `downloadSTL` 函式**之後**插入：
```ts
/**
 * 匯出「攤平排版」STL——所有零件攤平躺平、互不重疊排在虛擬列印床上，
 * 適合直接送切片器免支撐列印。與 downloadSTL（組裝姿態）並存。
 */
export function downloadFlatLayoutSTL(design: FurnitureDesign, scale: number = DEFAULT_SCALE) {
  const group = buildFlatLayoutGroup(design, scale);
  warnIfInvalid(group);
  const data = new STLExporter().parse(group, { binary: true }) as DataView;
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "model/stl" });
  triggerDownload(blob, `${safeStem(design, scale)}_flat.stl`);
}
```

注意：`warnIfInvalid`、`triggerDownload`、`safeStem`、`STLExporter`、`DEFAULT_SCALE` 都已在 `three-d-export.ts` 內定義/import（階段 1 已建）。檔名加 `_flat` 後綴與組裝姿態 STL 區別。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "three-d-export|flat-layout" || echo "目標檔 0 error"`
Expected: `目標檔 0 error`

- [ ] **Step 3: 在 `ThreeDExportButton.tsx` 加「攤平 STL」按鈕**

`components/ThreeDExportButton.tsx` 的 import：
```ts
import { downloadSTL, downloadOBJ, validateDesignExport } from "@/lib/export/three-d-export";
```
改成（加 `downloadFlatLayoutSTL`）：
```ts
import { downloadSTL, downloadOBJ, downloadFlatLayoutSTL, validateDesignExport } from "@/lib/export/three-d-export";
```

在 `📐 OBJ` 那顆 `<button>` 的閉合 `</button>` **之後**、外層 `</div>`（包按鈕那層 flex）**之前**，插入：
```tsx
        <button
          type="button"
          onClick={() => downloadFlatLayoutSTL(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title="所有零件攤平排開、免支撐——適合直接送切片器列印"
        >
          🛏️ 攤平 STL
        </button>
```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "ThreeDExportButton" || echo "目標檔 0 error"`
Expected: `目標檔 0 error`

- [ ] **Step 5: Commit**

```bash
git add lib/export/three-d-export.ts components/ThreeDExportButton.tsx
git commit -m "feat(export): 攤平排版 STL 匯出 + 🛏️ 攤平 STL 按鈕"
```

---

## Task 6：階段 2 驗收

**Files:** 無（驗證任務）

- [ ] **Step 1: 全量型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "lib/export|ThreeDExportButton" || echo "本階段檔案 0 error"`
Expected: `本階段檔案 0 error`（node_modules / 其他既有舊 error 可忽略）。

- [ ] **Step 2: 重跑單元測試**

Run: `npx tsx lib/export/flat-layout.test.ts && npx tsx lib/export/export-checks.test.ts`
Expected: 兩支都印「全部通過」。

- [ ] **Step 3: 真家具攤平驗證**

Run（用真模板建一個設計、跑攤平、檢查零件 AABB 互不重疊）：
```bash
npx tsx -e "
import { FURNITURE_CATALOG } from './lib/templates/index.ts';
import { buildFlatLayoutGroup } from './lib/export/flat-layout.ts';
import { Box3, Mesh } from 'three';
const entry = FURNITURE_CATALOG['square-stool'];
const design = entry.build(entry.defaults);
const g = buildFlatLayoutGroup(design, 1);
g.updateMatrixWorld(true);
const boxes = [];
g.traverse(o => { if (o.isMesh) { const b = new Box3().setFromObject(o); boxes.push({ n: o.name, b }); } });
let overlaps = 0;
for (let i = 0; i < boxes.length; i++) for (let j = i+1; j < boxes.length; j++) {
  const a = boxes[i].b, c = boxes[j].b;
  if (a.max.x > c.min.x + 1e-3 && c.max.x > a.min.x + 1e-3 && a.max.y > c.min.y + 1e-3 && c.max.y > a.min.y + 1e-3) overlaps++;
}
console.log('square-stool 攤平：' + boxes.length + ' 件、重疊對數 ' + overlaps);
if (overlaps > 0) process.exit(1);
"
```
Expected: 印出件數、`重疊對數 0`。
（若 `FURNITURE_CATALOG` 的 API（`entry.build` / `entry.defaults`）與此不符，先 `grep -n "FURNITURE_CATALOG" lib/templates/index.ts` 與 `scripts/audit-overlaps.ts` 確認正確用法後比照調整——`audit-overlaps.ts` 已經在跑全 catalog，是可靠範本。）

- [ ] **Step 4: 視覺驗證（playwright，best-effort）**

依專案記憶：Next 16 dev 若 middleware 卡住，先 `mv middleware.ts middleware.ts.disabled` 起 dev、完成後還原；worktree 缺 `.env.local` 要從主 repo 複製；dev server 用非預設 port（如 `-p 3007`）。

1. 起 dev，開一個家具設計頁，找到 3D 匯出列。
2. 確認新增「🛏️ 攤平 STL」按鈕在「📐 OBJ」之後、可點。
3. 點「🛏️ 攤平 STL」→ 確認下載到 `<category>_<ratio>_<date>_flat.stl`。
4. 若 dev server 起不來，跳過此步、註明，靠 tsc + 單元測試 + Step 3 的真模板驗證。

- [ ] **Step 5: 收尾**

階段 2 完成。執行者依 superpowers:finishing-a-development-branch 把 worktree 分支合併回 `main` 並 push（Vercel 自動部署）。

---

## Self-Review 紀錄

- **Spec coverage：** spec 第 ④ 節——`buildFlatLayoutGroup`（Task 4）、攤平姿態最薄軸朝上（Task 3 `orientFlat`）、shelf packing + `LAYOUT_GAP_MM`/床寬（Task 2 `packShelves`，常數 8 / 250）、單一 STL 輸出（Task 5 `downloadFlatLayoutSTL`）、UI「🛏️ 攤平 STL」按鈕（Task 5）、組裝 STL 保留不動（Task 1 只抽取不改行為、Task 5 為新增函式）。自由曲面件用 bbox 攤平＝`orientFlat` 對任何 geometry 一視同仁，已涵蓋。全覆蓋。
- **Placeholder scan：** 無 TBD；Task 6 Step 3 的 fallback 指示（grep 確認 catalog API）屬「依現況校正」非 placeholder。
- **Type consistency：** `PackItem`/`PackPos`/`FlatDims`、`packShelves`/`orientFlat`/`buildFlatLayoutGroup`/`partExportGeometry`/`downloadFlatLayoutSTL`、`LAYOUT_GAP_MM`/`LAYOUT_BED_MM` 跨 Task 命名一致。`buildFlatLayoutGroup(design, scale)` 與 `downloadFlatLayoutSTL(design, scale)` 簽名一致。

## 後續

- 階段 3（3MF 格式）於階段 2 上線後出獨立計畫。
