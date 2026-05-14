# 3D 木紋走向視覺化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 3D 透視圖能一眼看出每塊零件的木紋走向——強化既有 shader 的順紋條紋（永遠開），再加一個可開關的雙向箭頭疊層（`?grain=1`）。

**Architecture:** 兩個獨立階段。Stage 1 改 `wood-shader.ts` 的 fragment shader，加一個沿 grain 軸的順紋條紋分量。Stage 2 走 URL 參數 `?grain=1`（與既有 `?wf=1`、`?scene=` 同模式），新增 `GrainArrow` R3F 元件、`GrainArrowToggle` UI、並把 `showGrainArrows` prop 從 `page.tsx` 穿到 `PerspectiveView` 的每個零件。

**Tech Stack:** Next.js 16 + React + TypeScript、Three.js、@react-three/fiber、GLSL（onBeforeCompile shader injection）。本專案無單元測試框架，驗證靠 `npx tsc --noEmit` + `scripts/verify-*.ts` + Playwright。

**參考文件:** spec 在 `docs/superpowers/specs/2026-05-14-3d-grain-direction-design.md`；木紋結構規則見 `docs/drafting-math.md §L`。

**慣例提醒:** `<Part>` 拿到的 `size` 是 `[length, thickness, width]` 各乘 `SCALE`（three-units），即 local X=長、Y=厚、Z=寬。`grainDirection="length"` → 紋沿 local X、`"width"` → 沿 local Z（與 `wood-shader.ts` 的 `woodCompileX`/`woodCompileZ` 同慣例）。commit 一律加 `-c commit.gpgsign=false`（本機未設 gpg）。

---

## File Structure

| 動作 | 檔案 | 責任 |
|---|---|---|
| 改 | `components/wood-shader.ts` | Stage 1：fragment shader 加順紋條紋分量 |
| 建 | `components/GrainArrow.tsx` | `grainArrowPlacement()` 純函式 + `<GrainArrow>` R3F 元件 |
| 建 | `scripts/verify-grain-arrow.ts` | `grainArrowPlacement()` 的回歸驗證腳本 |
| 建 | `components/GrainArrowToggle.tsx` | toggle 鈕，仿 `SceneThemeToggle` 寫 `?grain=` |
| 改 | `components/PerspectiveView.tsx` | 新增 `showGrainArrows` prop；零件 map 與 tenon map 內掛 `<GrainArrow>` |
| 改 | `components/LazyPerspectiveView.tsx` | 新增並向下穿 `showGrainArrows` prop |
| 改 | `app/design/[type]/page.tsx` | 解析 `?grain=1`、傳 prop、渲染 `<GrainArrowToggle>` |

---

## Task 1: Stage 1 — 強化 wood-shader 順紋條紋

**Files:**
- Modify: `components/wood-shader.ts:91-114`（`makeGrainFragment` 的 fragment 字串尾段）

獨立階段，不依賴任何 Stage 2 工作。現有 `makeGrainFragment` 回傳的 GLSL 在 step 10 結束後直接 `diffuseColor.rgb *= dimming;`。在 step 10 與該乘法之間插入一個 step 11：純粹沿 grain 軸（`gx`）的高頻條紋，跨 grain 軸（`wz`）幾乎不變 → 視覺上是一條條順著纖維跑的細暗紋。不動既有年輪（ring）邏輯。

- [ ] **Step 1: 加順紋條紋分量到 fragment shader**

在 `components/wood-shader.ts` 的 `makeGrainFragment` 函式內，找到這兩行（檔案約 line 112-114）：

```glsl
// 10. 中尺度斑紋
dimming -= (wd_fbm(vec2(gx * 0.02, wz * 0.05)) - 0.5) * 0.08;
diffuseColor.rgb *= dimming;`;
```

改成（在 `diffuseColor.rgb *= dimming;` 之前插入 step 11）：

```glsl
// 10. 中尺度斑紋
dimming -= (wd_fbm(vec2(gx * 0.02, wz * 0.05)) - 0.5) * 0.08;
// 11. 順紋方向條紋——沿 grain 軸（gx）高頻、跨 grain 軸（wz）近乎不變，
//     視覺上是一條條順著纖維跑的細暗紋，讓木紋走向不靠年輪也看得出來。
//     振幅 0.16，與上面各擾動項同量級，不蓋掉年輪拱形的擬真感。
float grainStreak = wd_fbm(vec2(gx * 0.13, wz * 0.006));
dimming -= smoothstep(0.52, 0.78, grainStreak) * 0.16;
diffuseColor.rgb *= dimming;`;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "wood-shader" || echo "✅ wood-shader 無 type error"`
Expected: `✅ wood-shader 無 type error`（GLSL 在字串裡，tsc 只檢查 TS 語法）

- [ ] **Step 3: Commit**

```bash
git add components/wood-shader.ts
git -c commit.gpgsign=false commit -m "feat(3d): wood-shader 加順紋方向條紋

既有 shader 的年輪拱形方向感弱，加一個沿 grain 軸高頻、跨 grain 軸近乎
不變的條紋分量，讓木紋走向不靠年輪也一眼看出。不動年輪邏輯。"
```

---

## Task 2: GrainArrow 元件 + grainArrowPlacement 純函式

**Files:**
- Create: `components/GrainArrow.tsx`
- Create: `scripts/verify-grain-arrow.ts`

`grainArrowPlacement()` 是純函式：吃 `grainDirection` + `shape.kind` + `size`（three-units），回傳箭頭要沿哪個 local 軸、多長、貼在哪個面的法線方向。`<GrainArrow>` 用它 + 一個 memo 過的雙向箭頭幾何來渲染。

- [ ] **Step 1: 寫驗證腳本（會失敗）**

Create `scripts/verify-grain-arrow.ts`:

```ts
import { strict as assert } from "node:assert";
import { grainArrowPlacement } from "../components/GrainArrow";

// 方料、紋沿長邊：箭頭沿 local X，長度 = size[0] * 0.8，貼在 Y 法線面
const a = grainArrowPlacement("length", "box", [4, 0.18, 3]);
assert.equal(a.axis, "x");
assert.ok(Math.abs(a.length - 3.2) < 1e-9, `expected 3.2, got ${a.length}`);
assert.equal(a.normalAxis, "y");

// 方料、紋沿寬邊：箭頭沿 local Z
const b = grainArrowPlacement("width", undefined, [4, 0.18, 3]);
assert.equal(b.axis, "z");
assert.ok(Math.abs(b.length - 2.4) < 1e-9, `expected 2.4, got ${b.length}`);
assert.equal(b.normalAxis, "y");

// 圓料：沒有平面，紋沿圓柱長軸 local Y，偏移沿 X（柱面外）
const c = grainArrowPlacement("length", "round", [0.5, 4, 0.5]);
assert.equal(c.axis, "y");
assert.ok(Math.abs(c.length - 3.2) < 1e-9, `expected 3.2, got ${c.length}`);
assert.equal(c.normalAxis, "x");

// 車旋件也走圓料路徑
const d = grainArrowPlacement("length", "lathe-turned", [0.6, 5, 0.6]);
assert.equal(d.axis, "y");

// grainDirection undefined → fallback 當 length
const e = grainArrowPlacement(undefined, "box", [2, 0.2, 1]);
assert.equal(e.axis, "x");

console.log("✅ grainArrowPlacement OK");
```

- [ ] **Step 2: 跑驗證腳本確認失敗**

Run: `npx tsx scripts/verify-grain-arrow.ts`
Expected: FAIL — `Cannot find module '../components/GrainArrow'`（檔案還沒建）

- [ ] **Step 3: 建 GrainArrow.tsx**

Create `components/GrainArrow.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { Euler, CylinderGeometry, ConeGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ShapeSpec } from "@/lib/types";

/**
 * 木紋走向箭頭。?grain=1 時每個木製零件疊一支沿 grain 軸的雙向箭頭。
 *
 * 慣例：<Part> 的 size = [length, thickness, width]（three-units），
 * 即 local X=長、Y=厚、Z=寬。grainDirection="length" → 紋沿 X、
 * "width" → 沿 Z（與 wood-shader 的 woodCompileX/Z 同慣例）。
 * 圓料/車旋件沒有平面，紋沿圓柱長軸 local Y。
 */

/** shape.kind 屬於「圓柱狀」的——沒有平面可貼，箭頭走圓柱長軸 */
const ROUND_SHAPE_KINDS = new Set<string>([
  "round",
  "round-tapered",
  "splayed-round-tapered",
  "shaker",
  "lathe-turned",
]);

export interface GrainArrowPlacement {
  /** 箭頭沿哪個 local 軸 */
  axis: "x" | "y" | "z";
  /** 箭頭總長（three-units）= 該軸零件長度 × 0.8 */
  length: number;
  /** 箭頭貼在哪個 local 軸的面上（往該方向 +offset 浮出避免 z-fighting） */
  normalAxis: "x" | "y" | "z";
}

/** 純函式：依 grainDirection + shape + size 算出箭頭的軸 / 長度 / 貼面法線。 */
export function grainArrowPlacement(
  grainDirection: "length" | "width" | undefined,
  shapeKind: ShapeSpec["kind"] | undefined,
  size: [number, number, number],
): GrainArrowPlacement {
  // 圓料 / 車旋件：紋沿圓柱長軸（local Y），箭頭浮在柱面外（沿 X 偏移）
  if (shapeKind && ROUND_SHAPE_KINDS.has(shapeKind)) {
    return { axis: "y", length: size[1] * 0.8, normalAxis: "x" };
  }
  // 方料：grainDirection "width" → local Z；其餘（含 undefined）→ local X
  if (grainDirection === "width") {
    return { axis: "z", length: size[2] * 0.8, normalAxis: "y" };
  }
  return { axis: "x", length: size[0] * 0.8, normalAxis: "y" };
}

/** 建一支沿 +X 的雙向箭頭（細軸 + 兩端錐頭），合成單一 BufferGeometry。 */
function buildDoubleArrowGeometry(length: number): BufferGeometry {
  const shaftR = Math.max(length * 0.012, 0.01); // 最小可見下限
  const headLen = Math.min(length * 0.2, 0.25);
  const headR = shaftR * 3.2;
  const shaftLen = Math.max(length - 2 * headLen, length * 0.1);

  // CylinderGeometry 預設軸沿 Y → rotateZ 90° 轉成沿 X
  const shaft = new CylinderGeometry(shaftR, shaftR, shaftLen, 10);
  shaft.rotateZ(Math.PI / 2);

  // ConeGeometry 預設尖端朝 +Y → 旋轉成朝 ±X，再平移到兩端
  const headPos = new ConeGeometry(headR, headLen, 12);
  headPos.rotateZ(-Math.PI / 2);
  headPos.translate(length / 2 - headLen / 2, 0, 0);

  const headNeg = new ConeGeometry(headR, headLen, 12);
  headNeg.rotateZ(Math.PI / 2);
  headNeg.translate(-(length / 2 - headLen / 2), 0, 0);

  const merged = mergeGeometries([shaft, headPos, headNeg], false);
  shaft.dispose();
  headPos.dispose();
  headNeg.dispose();
  return merged ?? shaft;
}

/** 把箭頭幾何（沿 +X）轉到目標 local 軸的旋轉。 */
function localRotationForAxis(axis: "x" | "y" | "z"): Euler {
  if (axis === "z") return new Euler(0, Math.PI / 2, 0); // +X → +Z
  if (axis === "y") return new Euler(0, 0, Math.PI / 2); // +X → +Y
  return new Euler(0, 0, 0); // 已沿 +X
}

export function GrainArrow({
  position,
  rotation,
  size,
  grainDirection,
  shapeKind,
}: {
  /** 零件世界座標（與 <Part> 同一組 px,py,pz） */
  position: [number, number, number];
  /** 零件旋轉（與 <Part> 同一顆 Euler） */
  rotation: Euler;
  /** 零件 size [length, thickness, width]，已乘 SCALE */
  size: [number, number, number];
  grainDirection?: "length" | "width";
  shapeKind?: ShapeSpec["kind"];
}) {
  const { axis, length, normalAxis } = grainArrowPlacement(
    grainDirection,
    shapeKind,
    size,
  );
  const geometry = useMemo(() => buildDoubleArrowGeometry(length), [length]);
  const localRot = useMemo(() => localRotationForAxis(axis), [axis]);

  // 沿貼面法線往外浮一點點，避免 z-fighting
  const GAP = 0.02;
  const offset: [number, number, number] =
    normalAxis === "y"
      ? [0, size[1] / 2 + GAP, 0]
      : [size[0] / 2 + GAP, 0, 0];

  return (
    <group position={position} rotation={rotation}>
      <group position={offset} rotation={localRot}>
        <mesh geometry={geometry} renderOrder={3}>
          <meshStandardMaterial
            color="#27272a"
            emissive="#27272a"
            emissiveIntensity={0.15}
            roughness={0.6}
            metalness={0}
          />
        </mesh>
      </group>
    </group>
  );
}
```

- [ ] **Step 4: 跑驗證腳本確認通過**

Run: `npx tsx scripts/verify-grain-arrow.ts`
Expected: `✅ grainArrowPlacement OK`

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "GrainArrow|verify-grain" || echo "✅ 無 type error"`
Expected: `✅ 無 type error`

- [ ] **Step 6: Commit**

```bash
git add components/GrainArrow.tsx scripts/verify-grain-arrow.ts
git -c commit.gpgsign=false commit -m "feat(3d): GrainArrow 元件 + grainArrowPlacement 純函式

雙向箭頭幾何（細軸+兩端錐頭）+ 依 grainDirection/shape/size 算箭頭軸向、
長度、貼面的純函式。verify-grain-arrow.ts 鎖回歸。"
```

---

## Task 3: 把 showGrainArrows prop 從 page.tsx 穿到 PerspectiveView

**Files:**
- Modify: `components/PerspectiveView.tsx:1840-1875`（`PerspectiveView` 簽名）
- Modify: `components/LazyPerspectiveView.tsx:36-78`（`LazyPerspectiveView` 簽名 + 傳遞）
- Modify: `app/design/[type]/page.tsx:216`（解析 `?grain=1`）、`:376,441,447`（傳 prop）

純接線，這一步還不渲染箭頭——只是讓 prop 一路通到 `PerspectiveView`。

- [ ] **Step 1: PerspectiveView 加 showGrainArrows prop**

`components/PerspectiveView.tsx`，在 `PerspectiveView` 的解構參數（約 line 1850）`wireframeMode = false,` 後加一行：

```tsx
  wireframeMode = false,
  showGrainArrows = false,
}: {
```

並在型別區塊（約 line 1874，`wireframeMode?: boolean;` 後）加：

```tsx
  /** 線框模式：所有零件渲染成骨架，看內部結構 */
  wireframeMode?: boolean;
  /** 木紋走向箭頭疊層：?grain=1 時每個木製零件疊一支雙向箭頭 */
  showGrainArrows?: boolean;
}) {
```

- [ ] **Step 2: LazyPerspectiveView 加 prop 並向下傳**

`components/LazyPerspectiveView.tsx`，解構參數（約 line 41）加 `showGrainArrows = false,`：

```tsx
  noSync = false,
  wireframeMode = false,
  showGrainArrows = false,
}: {
```

型別區塊（約 line 56，`wireframeMode?: boolean;` 後）加：

```tsx
  /** 線框模式：所有零件渲染骨架 */
  wireframeMode?: boolean;
  /** 木紋走向箭頭疊層 */
  showGrainArrows?: boolean;
}) {
```

`<PerspectiveViewLazy>` 的 props（約 line 72，`wireframeMode={wireframeMode}` 後）加：

```tsx
      wireframeMode={wireframeMode}
      showGrainArrows={showGrainArrows}
    />
```

- [ ] **Step 3: page.tsx 解析 ?grain=1**

`app/design/[type]/page.tsx`，在 `const wireframeMode = sp.wf === "1" || sp.wf === "true";`（line 216）後加：

```tsx
  const wireframeMode = sp.wf === "1" || sp.wf === "true";
  // 木紋走向箭頭疊層：?grain=1 → 3D 每個木製零件疊雙向箭頭
  const showGrainArrows = sp.grain === "1" || sp.grain === "true";
```

- [ ] **Step 4: page.tsx 三個 LazyPerspectiveView 都傳 prop**

`app/design/[type]/page.tsx` 有三處 `<LazyPerspectiveView ... />`。各加 `showGrainArrows={showGrainArrows}`：

line 376（desktop 主視圖）：
```tsx
            <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} xrayMode={xrayMode} wireframeMode={wireframeMode} showGrainArrows={showGrainArrows} noSync />
```

line 441（材料區 desktop 預覽）：
```tsx
                <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} xrayMode={xrayMode} showGrainArrows={showGrainArrows} />
```

line 447（mobile PIP）：
```tsx
            <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} xrayMode={xrayMode} showGrainArrows={showGrainArrows} compactMode />
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "PerspectiveView|LazyPerspectiveView|design/\[type\]/page" || echo "✅ 無 type error"`
Expected: `✅ 無 type error`

- [ ] **Step 6: Commit**

```bash
git add components/PerspectiveView.tsx components/LazyPerspectiveView.tsx "app/design/[type]/page.tsx"
git -c commit.gpgsign=false commit -m "feat(3d): 接線 showGrainArrows prop（page → Lazy → PerspectiveView）

解析 ?grain=1，prop 一路穿到 PerspectiveView。此 commit 還不渲染箭頭。"
```

---

## Task 4: 主零件 map 內渲染 GrainArrow

**Files:**
- Modify: `components/PerspectiveView.tsx:2489-2521`（`design.parts.map(...)` 內 `<group key={part.id}>`）

主零件迴圈裡，每個 `<group key={part.id}>` 已含 `<Part>` + `{tenonMeshes}` + `{auditOverlay}`。在 `<Part>` 之後加一個 `<GrainArrow>`，條件：`showGrainArrows` 且非玻璃非銅件。`<GrainArrow>` 拿與 `<Part>` 同一組 `position` / `rotation` / `size`。

- [ ] **Step 1: import GrainArrow**

`components/PerspectiveView.tsx` 頂部（約 line 16，`woodCompileX` import 附近）加：

```tsx
import { GrainArrow } from "@/components/GrainArrow";
```

- [ ] **Step 2: 主 map 內渲染 GrainArrow**

`components/PerspectiveView.tsx` 約 line 2517，找到：

```tsx
                isSelected={isSelected}
                isDimmed={isDimmed}
                wireframe={wireframeMode}
              />
              {tenonMeshes}
              {auditOverlay}
            </group>
```

改成（在 `<Part>` 與 `{tenonMeshes}` 之間插入 `<GrainArrow>`）：

```tsx
                isSelected={isSelected}
                isDimmed={isDimmed}
                wireframe={wireframeMode}
              />
              {showGrainArrows && part.visual !== "glass" && part.visual !== "brass-antique" && (
                <GrainArrow
                  position={[px, py, pz]}
                  rotation={new Euler(
                    part.rotation?.x ?? 0,
                    part.rotation?.y ?? 0,
                    part.rotation?.z ?? 0,
                    "ZYX",
                  )}
                  size={[
                    part.visible.length * SCALE,
                    part.visible.thickness * SCALE,
                    part.visible.width * SCALE,
                  ]}
                  grainDirection={part.grainDirection}
                  shapeKind={shape?.kind}
                />
              )}
              {tenonMeshes}
              {auditOverlay}
            </group>
```

> 註：`px, py, pz`、`shape`、`SCALE` 都在這個 map 的 scope 內已存在（`<Part>` 用的就是它們）。`shape` 可能為 `undefined`（box 預設），`shape?.kind` 傳 `undefined` 時 `grainArrowPlacement` 走方料路徑，正確。

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "PerspectiveView" || echo "✅ 無 type error"`
Expected: `✅ 無 type error`

- [ ] **Step 4: 啟 dev server 手動確認**

Run（背景）: `npm run dev`
開 `http://localhost:3000/design/open-bookshelf?grain=1` — 應看到每個層板/側板/頂底板上有一支深色雙向箭頭，沿木紋方向。開 `?grain=` 拿掉則無箭頭。

- [ ] **Step 5: Commit**

```bash
git add components/PerspectiveView.tsx
git -c commit.gpgsign=false commit -m "feat(3d): 主零件渲染木紋走向箭頭

showGrainArrows 且非玻璃非銅件時，每個零件疊一支 GrainArrow。"
```

---

## Task 5: GrainArrowToggle UI + 放進設計頁

**Files:**
- Create: `components/GrainArrowToggle.tsx`
- Modify: `app/design/[type]/page.tsx:375,440`（`<SceneThemeToggle>` 旁加 `<GrainArrowToggle>`）

仿 `components/SceneThemeToggle.tsx`：client component，點擊切換 URL 的 `?grain=` 參數。

- [ ] **Step 1: 建 GrainArrowToggle.tsx**

Create `components/GrainArrowToggle.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * 3D 木紋走向箭頭切換器。
 *
 * 透過 URL 參數 `?grain=1` 控制。預設關（只看強化過的擬真木紋）；
 * 打開後每個木製零件疊一支雙向箭頭，明確標出纖維走向，教學 / 精確檢查用。
 */
export function GrainArrowToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active =
    searchParams?.get("grain") === "1" || searchParams?.get("grain") === "true";

  const onToggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (active) {
      params.delete("grain");
    } else {
      params.set("grain", "1");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50/50">
      <span className="text-[11px] text-zinc-600 mr-1.5">木紋走向</span>
      <button
        type="button"
        onClick={onToggle}
        title="顯示 / 隱藏木紋走向箭頭"
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
          active
            ? "bg-zinc-900 text-white"
            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
        }`}
      >
        <span aria-hidden>↔</span>
        {active ? "箭頭已開" : "顯示箭頭"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: page.tsx import GrainArrowToggle**

`app/design/[type]/page.tsx`，在 `import { SceneThemeToggle }`（約 line 30）後加：

```tsx
import { GrainArrowToggle } from "@/components/GrainArrowToggle";
```

- [ ] **Step 3: 兩處 SceneThemeToggle 旁加 GrainArrowToggle**

line 375（desktop 主視圖）— 找到：
```tsx
            <SceneThemeToggle current={sceneId} />
            <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} xrayMode={xrayMode} wireframeMode={wireframeMode} showGrainArrows={showGrainArrows} noSync />
```
改成：
```tsx
            <SceneThemeToggle current={sceneId} />
            <GrainArrowToggle />
            <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} xrayMode={xrayMode} wireframeMode={wireframeMode} showGrainArrows={showGrainArrows} noSync />
```

line 440（材料區 desktop 預覽）— 找到：
```tsx
                <SceneThemeToggle current={sceneId} />
                <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} xrayMode={xrayMode} showGrainArrows={showGrainArrows} />
```
改成：
```tsx
                <SceneThemeToggle current={sceneId} />
                <GrainArrowToggle />
                <LazyPerspectiveView design={design} sceneTheme={sceneTheme} joineryMode={joineryMode} auditMode={auditMode} explodeMm={explodeMm} xrayMode={xrayMode} showGrainArrows={showGrainArrows} />
```

> 註：mobile PIP（line 447）不放 toggle——它是滾動浮窗，沒有工具列空間；它仍會吃到 URL 的 `?grain=` 參數，跟著主視圖一起亮。

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "GrainArrowToggle|design/\[type\]/page" || echo "✅ 無 type error"`
Expected: `✅ 無 type error`

- [ ] **Step 5: 手動確認 toggle**

dev server 開 `http://localhost:3000/design/open-bookshelf` — 3D 上方應有「木紋走向」toggle，點「顯示箭頭」→ URL 變 `?grain=1` 且箭頭出現，再點 → 箭頭消失。

- [ ] **Step 6: Commit**

```bash
git add components/GrainArrowToggle.tsx "app/design/[type]/page.tsx"
git -c commit.gpgsign=false commit -m "feat(3d): 木紋走向箭頭 toggle

仿 SceneThemeToggle，?grain=1 開關。放在 desktop 主視圖與材料區預覽的
場景列旁；mobile PIP 吃 URL 參數跟著亮。"
```

---

## Task 6: 榫頭也渲染 GrainArrow（joineryMode）

**Files:**
- Modify: `components/PerspectiveView.tsx`（`tenonMeshes` 組裝處，約 line 2374-2440）

> **這是全 plan 最低價值的任務。** 榫頭的木紋依結構律永遠沿榫頭長軸（`docs/drafting-math.md §L` P0-2），箭頭資訊量低，且榫頭很小。spec 有列入（使用者選了「全部木製零件」含榫頭），故照做，但若 review 階段覺得太擠，這個 task 可整包砍掉不影響其他功能。

榫頭由 `t.position` 決定長軸：`start`/`end` → local X、`top`/`bottom` → local Y、`left`/`right` → local Z。榫頭的 `<mesh>` 已有自己算好的 local 中心 `(lcx+ex, lcy+ey, lcz+ez)` 與半長 `hx,hy,hz`。在每個榫頭 `<mesh>` 旁加一支 `<GrainArrow>`，沿該長軸。

- [ ] **Step 1: 找到 tenon mesh 的 return**

`components/PerspectiveView.tsx` 約 line 2374 之後，`switch (t.position)` 結束後會有建立榫頭 `<mesh>` 的 JSX（在 `tenonMeshes` 陣列裡 push 或 map 出來）。先讀懂該段：每個榫頭算出 local 中心 `lcx+ex, lcy+ey, lcz+ez`、半長 `hx, hy, hz`，外層套 `<Part>` 同一顆 `rotation`。

- [ ] **Step 2: 算榫頭 grain 軸 + size，加 GrainArrow**

在榫頭 `<mesh>` 的 JSX 同層（同一個 `key` 的 fragment / group 內），緊接著加：

```tsx
{showGrainArrows && (
  <GrainArrow
    position={[
      (px ?? 0) + (lcx + ex) * SCALE_OR_1,
      (py ?? 0) + (lcy + ey) * SCALE_OR_1,
      (pz ?? 0) + (lcz + ez) * SCALE_OR_1,
    ]}
    rotation={tenonRotation}
    size={[hx * 2, hy * 2, hz * 2]}
    grainDirection={
      t.position === "start" || t.position === "end"
        ? "length"
        : t.position === "left" || t.position === "right"
          ? "width"
          : "length"
    }
    shapeKind={undefined}
  />
)}
```

> **接手注意**：Step 1 讀懂該段後，把上面的 `px/py/pz`、`SCALE_OR_1`、`tenonRotation`、`lcx/ex` 等換成該段實際的變數名與座標慣例——榫頭可能是在 part-local 座標下用一個外層 `<group rotation>` 包起來，也可能已轉成 world。**關鍵不變量**：`<GrainArrow>` 的 `position`+`rotation` 要讓箭頭落在榫頭 mesh 的同一個位置與朝向；`size` 要是榫頭的 `[長, 厚, 寬]` three-units。`top`/`bottom` 榫頭長軸是 Y——`grainArrowPlacement` 對方料只認 length(X)/width(Z)，所以 `top`/`bottom` 暫時當 `"length"` 處理（榫頭多為 start/end，top/bottom 少見；若實際出現再於 GrainArrow 加 Y 軸方料分支）。

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "PerspectiveView" || echo "✅ 無 type error"`
Expected: `✅ 無 type error`

- [ ] **Step 4: 手動確認**

dev server 開 `http://localhost:3000/design/square-stool?joineryMode=true&grain=1` — 榫頭（紅色凸出件）上應各有一支小箭頭沿榫頭長軸。

- [ ] **Step 5: Commit**

```bash
git add components/PerspectiveView.tsx
git -c commit.gpgsign=false commit -m "feat(3d): joineryMode 榫頭也渲染木紋走向箭頭

榫頭木紋沿榫頭長軸（§L P0-2），由 t.position 推軸向。"
```

---

## Task 7: 視覺驗證（Playwright + shader 前後比對）

**Files:** 無（純驗證）

- [ ] **Step 1: 確認 dev server 在跑**

Run: `lsof -i:3000 -sTCP:LISTEN -t >/dev/null && echo running || npm run dev`

- [ ] **Step 2: Stage 2 箭頭 — desktop 截圖**

用 Playwright MCP：
- navigate `http://localhost:3000/design/open-bookshelf`（混合紋向零件），resize 1280×800，截圖 `grain-off-desktop.png`
- navigate `http://localhost:3000/design/open-bookshelf?grain=1`，截圖 `grain-on-desktop.png`
- 確認：箭頭出現在每個層板/側板/頂底板上，方向沿木紋（側板的箭頭應垂直、層板的水平），無穿模、無 z-fighting 閃爍

- [ ] **Step 3: Stage 2 箭頭 — mobile viewport + 圓料**

- resize 390×844，navigate `http://localhost:3000/design/open-bookshelf?grain=1`，截圖 `grain-on-mobile.png`，確認 mobile 版面沒被箭頭破壞、PIP 也吃到參數
- navigate `http://localhost:3000/design/round-stool?grain=1`，截圖 `grain-round.png`，確認圓腳的箭頭沿圓柱長軸、浮在柱面外

- [ ] **Step 4: Stage 1 shader — 前後比對**

- navigate `http://localhost:3000/design/dining-table`，截圖 `shader-after.png`
- 與 Task 1 之前的視覺記憶 / `git stash` 比對：順紋條紋是否明顯、年輪拱形是否仍保留。若可行，`git stash` 暫退 Task 1 的 shader 改動截 `shader-before.png` 再 `git stash pop` 比對

- [ ] **Step 5: 回報**

把 5 張截圖的觀察整理回報。截圖檔留 untracked（不 commit，比照 repo 慣例）。若發現箭頭位置 / 方向 / 圓料 offset 有誤 → 回對應 task 修。

---

## Self-Review

**1. Spec coverage:**
- Stage 1 強化順紋條紋 → Task 1 ✓
- Stage 2 `?grain=1` URL 參數 → Task 3 Step 3 ✓
- 雙向箭頭、沿 grain 軸、長度 80% → Task 2（`grainArrowPlacement` + `buildDoubleArrowGeometry`）✓
- 玻璃 / 銅件跳過 → Task 4 Step 2 條件 `part.visual !== "glass" && part.visual !== "brass-antique"` ✓
- 最顯眼面 + 往外 offset 避免 z-fighting → Task 2（`normalAxis` + `GAP`）✓
- 圓料 / 車旋件沿圓柱長軸 → Task 2（`ROUND_SHAPE_KINDS`）✓
- 顏色深炭灰 `#27272a` + 低 emissive + renderOrder → Task 2（material）✓
- 爆炸視圖箭頭跟零件位移 → Task 4 用同一組 `position`（已含 explode 後的座標）✓
- 榫接模式榫頭各拿箭頭 → Task 6 ✓
- Toggle UI 仿 SceneThemeToggle，放 3D 視圖上方 → Task 5 ✓
- 三個 LazyPerspectiveView 都吃 prop → Task 3 Step 4 ✓
- 測試：tsc + verify script + Playwright 兩 viewport → Task 7 ✓
- 不需 audit-overlaps（未動 lib/templates/*）→ 正確，plan 無此步 ✓

**2. Placeholder scan:** Task 6 Step 2 有「接手注意」段落要求工程師依實際變數名調整——這不是 placeholder，是因為 tenon mesh 座標慣例需讀 code 才能定；已給明確不變量（position+rotation 對齊 mesh、size 為榫頭三維）與 fallback 規則。其餘步驟都是完整可貼的 code。

**3. Type consistency:**
- `showGrainArrows` 在 Task 3（PerspectiveView / LazyPerspectiveView / page.tsx）、Task 4、Task 5 名稱一致 ✓
- `grainArrowPlacement` 簽名 `(grainDirection, shapeKind, size)` 在 Task 2 定義、verify script、`<GrainArrow>` 內呼叫一致 ✓
- `<GrainArrow>` props `position / rotation / size / grainDirection / shapeKind` 在 Task 2 定義、Task 4 / Task 6 使用一致 ✓
- `GrainArrowPlacement` interface 欄位 `axis / length / normalAxis` 一致 ✓
