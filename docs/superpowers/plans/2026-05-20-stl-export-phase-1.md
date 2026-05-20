# STL 匯出優化 階段 1：列印安全 + 收尾 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 匯出 STL/OBJ 前主動偵測「印不出來的薄件」與「破面/非流形」幾何，並把過時的 dev-gate / 字眼收乾淨。

**Architecture:** 新增純函式模組 `lib/export/export-checks.ts`（最薄件分析 + 幾何流形自檢），由 `three-d-export.ts` 在匯出時呼叫做 console 警告，由 `ThreeDExportButton.tsx` 反應式顯示 UI 警告。不改動既有匯出行為，只增加「事前偵測」這層。

**Tech Stack:** TypeScript、three.js（`BufferGeometry`、`mergeVertices`）、React、Next.js。測試比照專案慣例：`.test.ts` 用 `npx tsx` 跑 assert 腳本。

**前置：** spec `docs/superpowers/specs/2026-05-20-stl-export-optimization-design.md`；commit `7041b5e`（共用幾何模組）已落地。

**鐵律：** 既有「組裝姿態整件 STL」匯出行為 100% 不變——本階段只新增偵測層。

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `lib/export/export-checks.ts` | 新增。純函式：`analyzeMinThickness`、`validateGeometry`、`validateGroup`。只依賴 `three` 與型別，不 import `three-d-export`（避免循環依賴）。 |
| `lib/export/export-checks.test.ts` | 新增。`npx tsx` assert 測試腳本。 |
| `lib/export/three-d-export.ts` | 修改。`downloadSTL`/`downloadOBJ` 匯出時呼叫 `validateGroup` 做 console 警告；新增 `validateDesignExport(design)`；更新過時註解。 |
| `components/ThreeDExportButton.tsx` | 修改。最薄件警告 chip + 幾何自檢提示 + 移除 OBJ 的 dev gate + 更新過時字眼。 |

---

## Task 1：最薄件分析 `analyzeMinThickness`

**Files:**
- Create: `lib/export/export-checks.ts`
- Test: `lib/export/export-checks.test.ts`

- [ ] **Step 1: 寫 failing test**

建立 `lib/export/export-checks.test.ts`：

```ts
/**
 * lib/export/export-checks.ts 驗證腳本
 * 跑法：npx tsx lib/export/export-checks.test.ts
 */
import type { FurnitureDesign } from "@/lib/types";
import { analyzeMinThickness } from "./export-checks";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

// --- analyzeMinThickness ---
const fakeDesign = {
  parts: [
    { id: "leg", nameZh: "腳", visible: { length: 400, width: 35, thickness: 35 } },
    { id: "seat", nameZh: "座板", visible: { length: 300, width: 300, thickness: 18 } },
    { id: "drawer-bottom", nameZh: "抽屜底板", visible: { length: 280, width: 200, thickness: 3 } },
    { id: "glass", nameZh: "玻璃", visual: true, visible: { length: 5, width: 5, thickness: 1 } },
  ],
} as unknown as FurnitureDesign;

const r1 = analyzeMinThickness(fakeDesign, 1);
check("最薄件取最小維度（抽屜底板 3mm）", r1.thinnestMm === 3 && r1.partName === "抽屜底板");

const r2 = analyzeMinThickness(fakeDesign, 0.1);
check("套用 scale 0.1（3mm → 0.3mm）", Math.abs(r2.thinnestMm - 0.3) < 1e-9);

check("跳過 visual 五金件（玻璃不算）", analyzeMinThickness(fakeDesign, 1).partName !== "玻璃");

const empty = { parts: [] } as unknown as FurnitureDesign;
check("空零件回 Infinity", analyzeMinThickness(empty, 1).thinnestMm === Infinity);

// --- 收尾 ---
if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx tsx lib/export/export-checks.test.ts`
Expected: FAIL — `Cannot find module './export-checks'`（檔案還沒建）。

- [ ] **Step 3: 建立 `export-checks.ts` 並實作 `analyzeMinThickness`**

建立 `lib/export/export-checks.ts`：

```ts
import type { FurnitureDesign } from "@/lib/types";

/** 低於此值的零件在一般 FDM 印表機（0.4mm 噴嘴）幾乎印不出來 */
export const MIN_PRINTABLE_MM = 0.8;

export interface MinThicknessResult {
  /** 最薄零件縮放後的最小維度（mm）；無零件時為 Infinity */
  thinnestMm: number;
  /** 該零件中文名（nameZh 優先，否則 id）；無零件時為空字串 */
  partName: string;
}

/**
 * 找出設計中「最薄」的零件——取每個非 visual 零件三維中的最小值，
 * 全體再取最小，乘上匯出比例。用來提醒使用者選的比例會不會印不出來。
 */
export function analyzeMinThickness(
  design: FurnitureDesign,
  scale: number,
): MinThicknessResult {
  let thinnest = Infinity;
  let partName = "";
  for (const part of design.parts) {
    if (part.visual) continue;
    const dim = Math.min(
      part.visible.length,
      part.visible.thickness,
      part.visible.width,
    );
    if (dim < thinnest) {
      thinnest = dim;
      partName = part.nameZh || part.id;
    }
  }
  return { thinnestMm: thinnest * scale, partName };
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx tsx lib/export/export-checks.test.ts`
Expected: PASS — 4 個 `analyzeMinThickness` check 全綠、印「全部通過」。

- [ ] **Step 5: Commit**

```bash
git add lib/export/export-checks.ts lib/export/export-checks.test.ts
git commit -m "feat(export): analyzeMinThickness 偵測最薄零件"
```

---

## Task 2：幾何流形自檢 `validateGeometry`

**Files:**
- Modify: `lib/export/export-checks.ts`
- Test: `lib/export/export-checks.test.ts`

- [ ] **Step 1: 加 failing test**

在 `export-checks.test.ts` 的 import 區加：

```ts
import { validateGeometry, validateGroup } from "./export-checks";
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from "three";
```

在「--- 收尾 ---」**之前**插入：

```ts
// --- validateGeometry ---
// 封閉方塊（原生 BoxGeometry 角點頂點是分開的，validateGeometry 內部會先 mergeVertices）
const boxV = validateGeometry(new BoxGeometry(10, 10, 10));
check("BoxGeometry 是水密流形", boxV.ok && boxV.nonManifoldEdges === 0 && boxV.nanVertices === 0);

// 單一開放三角面 → 3 條邊各只被 1 面共用 → 3 條非流形邊
const openTri = new BufferGeometry();
openTri.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 10, 0, 0, 0, 10, 0], 3));
const triV = validateGeometry(openTri);
check("開放三角面有 3 條非流形邊", triV.nonManifoldEdges === 3 && !triV.ok);

// NaN 頂點
const nanGeo = new BufferGeometry();
nanGeo.setAttribute("position", new Float32BufferAttribute([0, 0, 0, NaN, 0, 0, 0, 10, 0], 3));
check("偵測到 NaN 頂點", validateGeometry(nanGeo).nanVertices >= 1);

// --- validateGroup ---
const goodGroup = new Group();
const m = new MeshBasicMaterial();
const okMesh = new Mesh(new BoxGeometry(5, 5, 5), m);
okMesh.name = "好零件";
goodGroup.add(okMesh);
check("validateGroup：全封閉零件 ok", validateGroup(goodGroup).ok);

const badGroup = new Group();
const badTri = new BufferGeometry();
badTri.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
const badMesh = new Mesh(badTri, m);
badMesh.name = "破面零件";
badGroup.add(badMesh);
const badResult = validateGroup(badGroup);
check(
  "validateGroup：破面零件回報 badParts",
  !badResult.ok && badResult.badParts.length === 1 && badResult.badParts[0].partName === "破面零件",
);
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `npx tsx lib/export/export-checks.test.ts`
Expected: FAIL — `validateGeometry` / `validateGroup` 尚未 export。

- [ ] **Step 3: 在 `export-checks.ts` 實作 `validateGeometry` + `validateGroup`**

在 `export-checks.ts` 檔頭加 import：

```ts
import { BufferGeometry, Group, Mesh, Vector3 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
```

在檔尾加：

```ts
/** 三角面面積小於此值視為退化面（zero-area） */
const DEGENERATE_AREA_EPS = 1e-6;

export interface GeometryValidation {
  ok: boolean;
  nanVertices: number;
  degenerateTris: number;
  /** 被「不等於 2 個三角面」共用的邊數——破洞或自交的徵兆 */
  nonManifoldEdges: number;
}

/**
 * 檢查單一零件 geometry 是否為水密流形實體。
 *
 * 重要：原生幾何（BoxGeometry 等）同一角點的頂點是分開存的，
 * 必須先 mergeVertices 依座標合併，否則每條邊都會被誤判成非流形。
 */
export function validateGeometry(geom: BufferGeometry): GeometryValidation {
  const merged = mergeVertices(geom);
  const pos = merged.getAttribute("position");
  const index = merged.getIndex();

  let nanVertices = 0;
  for (let i = 0; i < pos.count; i++) {
    if (
      Number.isNaN(pos.getX(i)) ||
      Number.isNaN(pos.getY(i)) ||
      Number.isNaN(pos.getZ(i))
    ) {
      nanVertices++;
    }
  }

  const triCount = index ? index.count / 3 : pos.count / 3;
  const vi = (t: number, c: number): number =>
    index ? index.getX(t * 3 + c) : t * 3 + c;

  let degenerateTris = 0;
  const edgeCount = new Map<string, number>();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();

  for (let t = 0; t < triCount; t++) {
    const i0 = vi(t, 0);
    const i1 = vi(t, 1);
    const i2 = vi(t, 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() / 2;
    if (area < DEGENERATE_AREA_EPS) {
      degenerateTris++;
      continue; // 退化面不計入邊統計
    }
    const edges: Array<[number, number]> = [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ];
    for (const [u, v] of edges) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }

  let nonManifoldEdges = 0;
  for (const count of edgeCount.values()) {
    if (count !== 2) nonManifoldEdges++;
  }

  merged.dispose();
  return {
    ok: nanVertices === 0 && degenerateTris === 0 && nonManifoldEdges === 0,
    nanVertices,
    degenerateTris,
    nonManifoldEdges,
  };
}

export interface GroupValidation {
  ok: boolean;
  badParts: Array<{ partName: string } & GeometryValidation>;
}

/**
 * 對一個已組好的 three.js Group 逐 mesh 跑 validateGeometry，
 * 回報所有不通過的零件。
 */
export function validateGroup(group: Group): GroupValidation {
  const badParts: GroupValidation["badParts"] = [];
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const v = validateGeometry(mesh.geometry as BufferGeometry);
    if (!v.ok) badParts.push({ partName: mesh.name || "(未命名零件)", ...v });
  });
  return { ok: badParts.length === 0, badParts };
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `npx tsx lib/export/export-checks.test.ts`
Expected: PASS — 全部 9 個 check 綠、印「全部通過」。

- [ ] **Step 5: Commit**

```bash
git add lib/export/export-checks.ts lib/export/export-checks.test.ts
git commit -m "feat(export): validateGeometry/validateGroup 幾何流形自檢"
```

---

## Task 3：匯出器接自檢 + 更新過時註解

**Files:**
- Modify: `lib/export/three-d-export.ts`

- [ ] **Step 1: 加 import 與 `validateDesignExport`**

在 `lib/export/three-d-export.ts` 既有 import 區（`import { type ShapeSpec, buildShapeGeometry } ...` 那行下方）加：

```ts
import { validateGroup, type GroupValidation } from "./export-checks";
```

在 `buildGroup` 函式結尾的 `}` **之後**、`triggerDownload` 之前加：

```ts
/**
 * 建出零件 Group 並跑幾何自檢——給 UI 事前顯示「破面零件」提示用。
 * 流形性與比例無關，固定用 scale=1 建。
 */
export function validateDesignExport(design: FurnitureDesign): GroupValidation {
  return validateGroup(buildGroup(design, 1));
}

/** 匯出時對 group 跑自檢，有問題的零件印 console 警告（非阻擋）。 */
function warnIfInvalid(group: Group) {
  const v = validateGroup(group);
  if (v.ok) return;
  for (const p of v.badParts) {
    console.warn(
      `[3D 匯出] 零件「${p.partName}」幾何異常：` +
        `NaN 頂點 ${p.nanVertices}、退化面 ${p.degenerateTris}、非流形邊 ${p.nonManifoldEdges}`,
    );
  }
}
```

- [ ] **Step 2: 在 `downloadSTL` / `downloadOBJ` 呼叫 `warnIfInvalid`**

把 `downloadSTL` 改成（在 `buildGroup` 之後加一行）：

```ts
export function downloadSTL(design: FurnitureDesign, scale: number = DEFAULT_SCALE) {
  const group = buildGroup(design, scale);
  warnIfInvalid(group);
  const data = new STLExporter().parse(group, { binary: true }) as DataView;
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "model/stl" });
  triggerDownload(blob, `${safeStem(design, scale)}.stl`);
}
```

把 `downloadOBJ` 改成：

```ts
export function downloadOBJ(design: FurnitureDesign, scale: number = DEFAULT_SCALE) {
  const group = buildGroup(design, scale);
  warnIfInvalid(group);
  const data = new OBJExporter().parse(group);
  const blob = new Blob([data], { type: "model/obj" });
  triggerDownload(blob, `${safeStem(design, scale)}.obj`);
}
```

- [ ] **Step 3: 更新過時註解**

`three-d-export.ts` 檔內若有提到「退化盒體」「shape kind 尚未完整」之類的舊註解，改寫成現況（形狀建模已共用 `part-geometry.ts`、不再是盒體）。實際以 grep 為準：

Run: `grep -n "退化\|盒體\|shape kind" lib/export/three-d-export.ts`
把找到的過時敘述改成正確現況；若無則跳過此步。

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "three-d-export|export-checks" || echo "目標檔 0 error"`
Expected: `目標檔 0 error`

- [ ] **Step 5: Commit**

```bash
git add lib/export/three-d-export.ts
git commit -m "feat(export): 匯出時跑幾何自檢 console 警告 + 清過時註解"
```

---

## Task 4：`ThreeDExportButton` UI — 最薄警告 + 自檢提示 + 解鎖 OBJ

**Files:**
- Modify: `components/ThreeDExportButton.tsx`

- [ ] **Step 1: 改寫 `ThreeDExportButton.tsx`**

整份檔案改成下列內容（在現有基礎上：加 `useMemo` 算最薄件與自檢、加警告列、移除 `SHOW_OBJ` gate、標題去「簡化盒體」）：

```tsx
"use client";

import { useMemo, useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { downloadSTL, downloadOBJ, validateDesignExport } from "@/lib/export/three-d-export";
import { analyzeMinThickness, MIN_PRINTABLE_MM } from "@/lib/export/export-checks";

interface Props {
  design: FurnitureDesign;
}

// 預設 1:10——家用 3D 列印機 200mm 床能放整件方凳/椅。
const SCALES: Array<{ label: string; value: number }> = [
  { label: "1:1 原寸（SketchUp / 工業列印 / CNC）", value: 1 },
  { label: "1:2（局部試做、榫接驗證）", value: 0.5 },
  { label: "1:5（提案打樣、桌面展示）", value: 0.2 },
  { label: "1:10 預設（家用 3D 列印 200mm 床放得下）", value: 0.1 },
  { label: "1:20（建築模型、櫃體縮影）", value: 0.05 },
  { label: "1:25（建築模型常用）", value: 0.04 },
  { label: "1:50（整間家具擺設）", value: 0.02 },
  { label: "1:100（空間規劃示意）", value: 0.01 },
];
const DEFAULT_IDX = 3;

export function ThreeDExportButton({ design }: Props) {
  const [scaleIdx, setScaleIdx] = useState(DEFAULT_IDX);
  const scale = SCALES[scaleIdx].value;

  // 最薄件警告——scale 變動即時重算（純數值、便宜）
  const minThk = useMemo(() => analyzeMinThickness(design, scale), [design, scale]);
  const tooThin = minThk.thinnestMm < MIN_PRINTABLE_MM;

  // 幾何自檢——只跟 design 有關（與比例無關），design 變才重算
  const validation = useMemo(() => validateDesignExport(design), [design]);

  return (
    <div className="px-4 py-2.5 border-t border-amber-100 bg-amber-50/40 flex flex-col gap-1.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-500 font-medium">3D 列印檔</span>
        <select
          value={scaleIdx}
          onChange={(e) => setScaleIdx(Number(e.target.value))}
          className="px-2 py-1 border border-zinc-300 rounded-md bg-white text-zinc-700 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
          title="輸出比例。1:10 預設適合家用 3D 列印"
        >
          {SCALES.map((s, i) => (
            <option key={s.value} value={i}>{s.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => downloadSTL(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title="3D 列印 / 切片器（Cura、PrusaSlicer）"
        >
          🖨️ STL
        </button>
        <button
          type="button"
          onClick={() => downloadOBJ(design, scale)}
          className="px-2.5 py-1 border border-zinc-300 rounded-md bg-white hover:border-amber-300 hover:bg-amber-50 text-zinc-700 transition-colors"
          title="SketchUp / Blender / 通用 3D 軟體"
        >
          📐 OBJ
        </button>
      </div>
      {tooThin && (
        <p className="text-amber-700">
          ⚠️ 最薄件 {minThk.thinnestMm.toFixed(1)}mm（{minThk.partName}），
          一般 3D 印表機印不出來，建議改用更大的比例。
        </p>
      )}
      {!validation.ok && (
        <p className="text-rose-600">
          ⚠️ 偵測到 {validation.badParts.length} 個零件幾何異常
          （{validation.badParts.map((p) => p.partName).join("、")}），
          匯出檔在切片器可能需要修復。
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "ThreeDExportButton" || echo "目標檔 0 error"`
Expected: `目標檔 0 error`

- [ ] **Step 3: 視覺驗證（playwright）**

依專案記憶：Next 16 dev 若 middleware 卡住，先 `mv middleware.ts middleware.ts.disabled` 起 dev，完成後還原。

1. `npm run dev` 起本機。
2. 開一個含薄板件的家具（如 `chest-of-drawers` 抽屜櫃），找到 3D 視覺面板下方的匯出列。
3. 比例選 `1:100`，截圖——應出現琥珀色「⚠️ 最薄件 …mm」警告。
4. 比例選回 `1:1`，截圖——警告應消失。
5. 確認 `📐 OBJ` 按鈕在（dev 與 production 都顯示）、標題是「3D 列印檔」無「簡化盒體」。
6. 正常家具不應出現紅色「幾何異常」提示（出現的話表示某 `build*Geometry` 有破面，記錄零件名回報，不在本階段修）。

- [ ] **Step 4: Commit**

```bash
git add components/ThreeDExportButton.tsx
git commit -m "feat(export): 最薄件警告 + 幾何自檢提示 + OBJ 解鎖上正式版"
```

---

## Task 5：階段驗收

- [ ] **Step 1: 全量型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "lib/export|ThreeDExportButton" || echo "本階段檔案 0 error"`
Expected: `本階段檔案 0 error`（node_modules / SizePresetButtons / SceneThemeToggle 等既有舊 error 可忽略）。

- [ ] **Step 2: 重跑單元測試**

Run: `npx tsx lib/export/export-checks.test.ts`
Expected: PASS — 印「全部通過」。

- [ ] **Step 3: 迴歸——確認既有匯出沒壞**

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: overlap 數字與 baseline 一致（141/151 clean），本階段未動模板。

- [ ] **Step 4: Push**

```bash
git push
```

確認 Vercel 部署成功、`designer.woodenren.com` 開得起來。

---

## Self-Review 紀錄

- **Spec coverage：** spec 階段 1 三項——① 最薄件警告（Task 1 + Task 4）、② manifold 自檢（Task 2 + Task 3 + Task 4）、③ 收尾 OBJ 解鎖 + 字眼（Task 3 Step 3 + Task 4）。全覆蓋。
- **Placeholder scan：** 無 TBD；Task 3 Step 3 的註解改寫以 grep 結果為準（屬「依現況調整」非 placeholder）。
- **Type consistency：** `MinThicknessResult`、`GeometryValidation`、`GroupValidation`、`MIN_PRINTABLE_MM`、`analyzeMinThickness`、`validateGeometry`、`validateGroup`、`validateDesignExport` 跨 Task 命名一致。

## 後續階段

- 階段 2（攤平排版匯出）、階段 3（3MF）於階段 1 上線後各自出獨立計畫。
