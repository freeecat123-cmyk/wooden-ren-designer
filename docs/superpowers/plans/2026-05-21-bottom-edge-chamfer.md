# 桌面 / 椅面 下緣倒角選項 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 desk（桌面）與 dining-chair / square-stool / bar-stool / bench / round-stool（座板）能對板材**下緣**獨立加倒角，且只在腳內縮（不會撞桌腳/椅腳/牙條）時開放。

**Architecture:** 新增共用選項 `seatEdgeBottom`，透過既有 `seatEdgeShape()`（方形板，底層 `buildChamferedTopGeometry` 已支援 `bottomChamferMm`）與 `round` shape（圓座板，需擴 lathe profile）渲染。顯示閘門用 `dependsOn legInset != 0`；數值靜默夾限到 `min(值, legInset)` 保證不切進接合區。

**Tech Stack:** TypeScript / Next.js / Three.js。本 repo 無模板單元測試，每個 task 以 `npx tsc --noEmit` 驗證型別，最後用 `scripts/audit-overlaps.ts`（baseline 139/149 clean）+ Playwright 截圖驗收。

**設計文件:** `docs/superpowers/specs/2026-05-21-bottom-edge-chamfer-design.md`

---

## File Structure

- `lib/templates/_helpers.ts` — 新 helper `seatEdgeBottomOption()`；改 `seatEdgeShape()` 第 3 參數
- `lib/templates/_builders/simple-table.ts` — `SimpleTableOpts` 加 `seatEdgeBottom?`（desk / bench 共用此 builder）
- `lib/templates/desk.ts` `bench.ts` `dining-chair.ts` `square-stool.ts` `bar-stool.ts` `round-stool.ts` — 各加選項 + 串接
- `lib/render/part-geometry.ts` — `round` shape 加 `bottomChamferMm` + lathe profile 下緣倒角
- `lib/render/svg-views.tsx` — `round` 帶下緣倒角時三視圖前/側視走 polygon

---

### Task 1: `_helpers.ts` — 新 helper + `seatEdgeShape()` 簽章

**Files:**
- Modify: `lib/templates/_helpers.ts`
- Modify: `lib/templates/_builders/simple-table.ts:256`（簽章相容）
- Modify: `lib/templates/square-stool.ts:183`（簽章相容）

- [ ] **Step 1: 加 `seatEdgeBottomOption()`**

在 `lib/templates/_helpers.ts` 的 `seatEdgeStyleOption()` 函式（結尾在 `dependsOn: { key: "seatEdge", notIn: [0] }, }; }` 那段）之後，插入：

```ts
/** 下緣倒角尺寸選項：座板 / 桌面「下緣」獨立倒角量。
 *  跟上緣 seatEdgeOption 並列；倒角樣式共用 seatEdgeStyle。
 *  template 應加 dependsOn { key:"legInset", notIn:[0] }——腳齊邊時牙條貼邊、
 *  下緣倒角會切到接合區，故只在腳內縮時開放。實際值由 template 夾限到 legInset。 */
export function seatEdgeBottomOption(
  group: OptionGroup = "top",
  defaultValue: number = 0,
): OptionSpec {
  return {
    group,
    type: "number",
    key: "seatEdgeBottom",
    label: "下緣倒角尺寸 (mm)",
    defaultValue,
    min: 0,
    max: 30,
    step: 1,
    unit: "mm",
    help: "座板／桌面「下緣」的倒角量。腳內縮後下緣外露才可調；倒角量會自動限制在腳內縮量內，不會切到牙條。樣式跟上緣共用",
  };
}
```

- [ ] **Step 2: 改 `seatEdgeShape()` 第 3 參數**

把 `lib/templates/_helpers.ts` 現有的 `seatEdgeShape()` 整段：

```ts
export function seatEdgeShape(
  v: string | number | undefined,
  style?: string,
  bothSides?: boolean,
): { kind: "chamfered-top"; chamferMm: number; bottomChamferMm?: number; style?: "chamfered" | "rounded" } | undefined {
  const mm = parseSeatChamferMm(v);
  if (mm <= 0) return undefined;
  return {
    kind: "chamfered-top",
    chamferMm: mm,
    bottomChamferMm: bothSides ? mm : undefined,
    style: style === "rounded" ? "rounded" : "chamfered",
  };
}
```

替換為：

```ts
export function seatEdgeShape(
  v: string | number | undefined,
  style?: string,
  bottomV?: string | number,
): { kind: "chamfered-top"; chamferMm: number; bottomChamferMm?: number; style?: "chamfered" | "rounded" } | undefined {
  const mm = parseSeatChamferMm(v);
  const bottomMm = parseSeatChamferMm(bottomV);
  if (mm <= 0 && bottomMm <= 0) return undefined;
  return {
    kind: "chamfered-top",
    chamferMm: mm,
    bottomChamferMm: bottomMm > 0 ? bottomMm : undefined,
    style: style === "rounded" ? "rounded" : "chamfered",
  };
}
```

同時把 `seatEdgeShape` 上方的 JSDoc 第 3 行 `bothSides=true 時底面也倒角...` 改為：
`bottomV 給下緣倒角 mm 值（0/undefined = 下緣不倒）。上下任一 > 0 就回 chamfered-top。`

- [ ] **Step 3: 修 simple-table.ts 呼叫（保持行為不變）**

`lib/templates/_builders/simple-table.ts:256` 現有：

```ts
        : (seatScoopShape(opts.seatProfile ?? "flat") ?? seatEdgeShape(opts.seatEdge ?? "square", opts.seatEdgeStyle, legInset > 0 || topOverhang > 0)),
```

改為（把舊的 `bothSides` 布林換成等效的 mm 值——有 overhang 時下緣鏡射上緣量）：

```ts
        : (seatScoopShape(opts.seatProfile ?? "flat") ?? seatEdgeShape(opts.seatEdge ?? "square", opts.seatEdgeStyle, (legInset > 0 || topOverhang > 0) ? (opts.seatEdge ?? "square") : 0)),
```

- [ ] **Step 4: 修 square-stool.ts 呼叫（保持行為不變）**

`lib/templates/square-stool.ts:183` 現有：

```ts
      : seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle, legInset > 0),
```

改為：

```ts
      : seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle, legInset > 0 ? seatEdge : 0),
```

- [ ] **Step 5: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/templates/_helpers.ts lib/templates/_builders/simple-table.ts lib/templates/square-stool.ts
git commit -m "refactor(helpers): seatEdgeShape 第3參數改下緣 mm 值 + 加 seatEdgeBottomOption"
```

---

### Task 2: `simple-table.ts` — 加 `seatEdgeBottom` builder 選項

**Files:**
- Modify: `lib/templates/_builders/simple-table.ts`

- [ ] **Step 1: `SimpleTableOpts` 加欄位**

在 `lib/templates/_builders/simple-table.ts` 的 `seatEdgeStyle?: string;` 那行（約 line 91，JSDoc「座板邊緣樣式」之後）之後插入：

```ts
  /** 桌面 / 座板「下緣」倒角量（mm）。undefined = 沿用 legInset/topOverhang
   *  自動鏡射上緣的舊行為；有傳值（含 0）就以明確值為準。 */
  seatEdgeBottom?: number;
```

- [ ] **Step 2: 套用到 top part shape**

把 Task 1 Step 3 改過的那行：

```ts
        : (seatScoopShape(opts.seatProfile ?? "flat") ?? seatEdgeShape(opts.seatEdge ?? "square", opts.seatEdgeStyle, (legInset > 0 || topOverhang > 0) ? (opts.seatEdge ?? "square") : 0)),
```

替換為：

```ts
        : (seatScoopShape(opts.seatProfile ?? "flat") ?? seatEdgeShape(
            opts.seatEdge ?? "square",
            opts.seatEdgeStyle,
            opts.seatEdgeBottom !== undefined
              ? opts.seatEdgeBottom
              : ((legInset > 0 || topOverhang > 0) ? (opts.seatEdge ?? "square") : 0),
          )),
```

- [ ] **Step 3: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: audit 不回歸**

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: `✅ All non-allowlisted cases clean (139/149)`（與 baseline 相同；尚無 template 傳 `seatEdgeBottom`，行為不變）

- [ ] **Step 5: Commit**

```bash
git add lib/templates/_builders/simple-table.ts
git commit -m "feat(simple-table): SimpleTableOpts 加 seatEdgeBottom 下緣倒角選項"
```

---

### Task 3: `desk.ts` — 桌面下緣倒角

**Files:**
- Modify: `lib/templates/desk.ts`

- [ ] **Step 1: import**

`lib/templates/desk.ts` 的 `_helpers` import 是多行式（line 9 `  seatEdgeOption,`）。在 `  seatEdgeOption,` 那行下方加一行：

```ts
  seatEdgeBottomOption,
```

- [ ] **Step 2: 加選項**

`desk.ts` line 32-33 現有：

```ts
  { ...seatEdgeOption("top", 5), dependsOn: { key: "liveEdge", notIn: [true] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { all: [{ key: "seatEdge", notIn: [0] }, { key: "liveEdge", notIn: [true] }] } },
```

替換為（中間插入下緣選項；style 的 dependsOn 改成「上或下任一 ≠ 0」）：

```ts
  { ...seatEdgeOption("top", 5), dependsOn: { key: "liveEdge", notIn: [true] } },
  { ...seatEdgeBottomOption("top"), dependsOn: { all: [{ key: "legInset", notIn: [0] }, { key: "liveEdge", notIn: [true] }] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { all: [{ any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] }, { key: "liveEdge", notIn: [true] }] } },
```

- [ ] **Step 3: body 讀值 + 夾限**

`desk.ts` line 130-131 現有 `const seatEdge = ...` / `const seatEdgeStyle = ...`。在 `const seatEdgeStyle` 那行之後插入：

```ts
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
```

`legInset` 已在 line 168 宣告（`const legInset = getOption<number>(input, opt(o, "legInset"));`）。在 line 168 之後插入夾限：

```ts
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
```

- [ ] **Step 4: 傳進 builder**

`desk.ts` 傳給 `simpleTable(...)` 的 opts 物件裡有 `seatEdge,` / `seatEdgeStyle,`（約 line 203-204）。在 `seatEdgeStyle,` 那行之後插入：

```ts
    seatEdgeBottom: seatEdgeBottomClamped,
```

- [ ] **Step 5: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/templates/desk.ts
git commit -m "feat(desk): 桌面下緣倒角選項（腳內縮時開放，夾限 legInset）"
```

---

### Task 4: `bench.ts` — 長凳座板下緣倒角

**Files:**
- Modify: `lib/templates/bench.ts`

- [ ] **Step 1: import**

`lib/templates/bench.ts` 的 `_helpers` import 多行式（line 7 `  seatEdgeOption,`）。在 `  seatEdgeOption,` 下方加一行：

```ts
  seatEdgeBottomOption,
```

- [ ] **Step 2: 加選項**

`bench.ts` line 32-33 現有：

```ts
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
```

替換為：

```ts
  seatEdgeOption("top", 5),
  { ...seatEdgeBottomOption("top"), dependsOn: { key: "legInset", notIn: [0] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] } },
```

- [ ] **Step 3: body 讀值 + 夾限**

`bench.ts` line 85-86 現有 `const seatEdge = ...` / `const seatEdgeStyle = ...`。在 `const seatEdgeStyle` 那行之後插入：

```ts
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
```

`legInset` 已在 line 107 宣告。在 line 107 之後插入：

```ts
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
```

- [ ] **Step 4: 傳進 builder**

`bench.ts` 傳給 builder 的 opts 物件有 `seatEdge,` / `seatEdgeStyle,`（約 line 142-143）。在 `seatEdgeStyle,` 那行之後插入：

```ts
    seatEdgeBottom: seatEdgeBottomClamped,
```

- [ ] **Step 5: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/templates/bench.ts
git commit -m "feat(bench): 長凳座板下緣倒角選項"
```

---

### Task 5: `dining-chair.ts` — 餐椅椅面下緣倒角

**Files:**
- Modify: `lib/templates/dining-chair.ts`

- [ ] **Step 1: import**

`lib/templates/dining-chair.ts` line 8 是單行 import。把 `..., seatEdgeOption, seatEdgeStyleOption, ...` 中的 `seatEdgeOption,` 改成 `seatEdgeOption, seatEdgeBottomOption,`。

- [ ] **Step 2: 加選項**

`dining-chair.ts` line 30-31 現有：

```ts
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
```

替換為：

```ts
  seatEdgeOption("top", 5),
  { ...seatEdgeBottomOption("top"), dependsOn: { key: "legInset", notIn: [0] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] } },
```

- [ ] **Step 3: body 讀值 + 夾限**

`dining-chair.ts` line 120-121 現有 `const seatEdge = ...` / `const seatEdgeStyle = ...`。在 `const seatEdgeStyle` 那行之後插入：

```ts
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
```

`legInset` 已在 line 113 宣告。在 line 113 之後插入：

```ts
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
```

- [ ] **Step 4: 套用到座板 shape**

`dining-chair.ts` line 514 現有：

```ts
        : seatEdgeShape(seatEdge, seatEdgeStyle);
```

替換為：

```ts
        : seatEdgeShape(seatEdge, seatEdgeStyle, seatEdgeBottomClamped);
```

（上方 `seatFrontWaterfall` 三元的 waterfall 分支自帶 `bottomChamferMm`，不動。）

- [ ] **Step 5: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/templates/dining-chair.ts
git commit -m "feat(dining-chair): 餐椅椅面下緣倒角選項"
```

---

### Task 6: `square-stool.ts` — 方凳座板下緣倒角

**Files:**
- Modify: `lib/templates/square-stool.ts`

- [ ] **Step 1: import**

`lib/templates/square-stool.ts` line 8 單行 import。把 `seatEdgeOption,` 改成 `seatEdgeOption, seatEdgeBottomOption,`。

- [ ] **Step 2: 加選項**

`square-stool.ts` line 22-23 現有：

```ts
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
```

替換為：

```ts
  seatEdgeOption("top", 5),
  { ...seatEdgeBottomOption("top"), dependsOn: { key: "legInset", notIn: [0] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] } },
```

- [ ] **Step 3: body 讀值 + 夾限**

`square-stool.ts` line 79-80 現有 `const seatEdge = ...` / `const seatEdgeStyle = ...`。在 `const seatEdgeStyle` 那行之後插入：

```ts
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
```

`legInset` 已在 line 74 宣告。在 line 74 之後插入：

```ts
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
```

- [ ] **Step 4: 套用到座板 shape**

`square-stool.ts` line 183（Task 1 Step 4 已改成 `legInset > 0 ? seatEdge : 0`）現有：

```ts
      : seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle, legInset > 0 ? seatEdge : 0),
```

替換為（自動下緣倒角改由明確選項控制）：

```ts
      : seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle, seatEdgeBottomClamped),
```

- [ ] **Step 5: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/templates/square-stool.ts
git commit -m "feat(square-stool): 方凳座板下緣倒角改明確選項控制"
```

---

### Task 7: `bar-stool.ts` — 吧台椅座板下緣倒角

**Files:**
- Modify: `lib/templates/bar-stool.ts`

- [ ] **Step 1: import**

`lib/templates/bar-stool.ts` line 8 單行 import。把 `seatEdgeOption,` 改成 `seatEdgeOption, seatEdgeBottomOption,`。

- [ ] **Step 2: 加選項**

`bar-stool.ts` line 24-25 現有：

```ts
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
```

替換為：

```ts
  seatEdgeOption("top", 5),
  { ...seatEdgeBottomOption("top"), dependsOn: { key: "legInset", notIn: [0] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] } },
```

- [ ] **Step 3: body 讀值 + 夾限**

`bar-stool.ts` line 90-91 現有 `const seatEdge = ...` / `const seatEdgeStyle = ...`。在 `const seatEdgeStyle` 那行之後插入：

```ts
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
```

`legInset` 已在 line 85 宣告。在 line 85 之後插入：

```ts
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
```

- [ ] **Step 4: 套用到座板 shape**

`bar-stool.ts` line 441 現有：

```ts
      const edge = seatEdgeShape(seatEdge, seatEdgeStyle);
```

替換為：

```ts
      const edge = seatEdgeShape(seatEdge, seatEdgeStyle, seatEdgeBottomClamped);
```

- [ ] **Step 5: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/templates/bar-stool.ts
git commit -m "feat(bar-stool): 吧台椅座板下緣倒角選項"
```

---

### Task 8: `part-geometry.ts` — `round` shape 下緣倒角

**Files:**
- Modify: `lib/render/part-geometry.ts`

⚠️ 動 `part-geometry.ts` 圓料幾何前先 grep `docs/drafting-math.md` §A1（silhouette/projection）。本 task 只擴 lathe profile、不改投影軸，§A1 確認即可。

- [ ] **Step 1: `round` shape 型別加欄位**

`lib/render/part-geometry.ts:53` 現有：

```ts
  | { kind: "round"; chamferMm?: number; chamferStyle?: "chamfered" | "rounded"; axis?: "x" | "y" | "z" }
```

替換為：

```ts
  | { kind: "round"; chamferMm?: number; bottomChamferMm?: number; chamferStyle?: "chamfered" | "rounded"; axis?: "x" | "y" | "z" }
```

- [ ] **Step 2: 改 `round` 分支 lathe profile**

`part-geometry.ts` 約 line 2013-2044，`round` 分支內 `const chamfer = shape.chamferMm ?? 0;` 到 `return lathe; }` 整段。現有：

```ts
    const chamfer = shape.chamferMm ?? 0;
    const rotation: [number, number, number] =
      ax === "x" ? [0, 0, Math.PI / 2] : ax === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    if (chamfer > 0) {
      const h = height;
      const cap = Math.min(chamfer, radius * 0.5, h * 0.5);
      const innerR = Math.max(0.5, radius - cap);
      const styleSegs = shape.chamferStyle === "rounded" ? 6 : 1;
      const points: Vector2[] = [
        new Vector2(0, -h / 2),
        new Vector2(radius, -h / 2),
        new Vector2(radius, h / 2 - cap),
      ];
      if (styleSegs === 1) {
        points.push(new Vector2(innerR, h / 2));
      } else {
        for (let i = 1; i <= styleSegs; i++) {
          const t = (i / styleSegs) * (Math.PI / 2);
          points.push(
            new Vector2(innerR + cap * Math.cos(t), h / 2 - cap + cap * Math.sin(t)),
          );
        }
      }
      points.push(new Vector2(0, h / 2));
      const lathe = new LatheGeometry(points, 48);
      if (rotation[0] || rotation[1] || rotation[2]) {
        lathe.rotateX(rotation[0]);
        lathe.rotateY(rotation[1]);
        lathe.rotateZ(rotation[2]);
      }
      return lathe;
    }
```

替換為（加下緣倒角段；profile 由底面中心 → 下緣 → 側面 → 上緣 → 頂面中心）：

```ts
    const chamfer = shape.chamferMm ?? 0;
    const bottomChamfer = shape.bottomChamferMm ?? 0;
    const rotation: [number, number, number] =
      ax === "x" ? [0, 0, Math.PI / 2] : ax === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    if (chamfer > 0 || bottomChamfer > 0) {
      const h = height;
      const styleSegs = shape.chamferStyle === "rounded" ? 6 : 1;
      const points: Vector2[] = [new Vector2(0, -h / 2)];
      // 下緣倒角：底面外緣 (innerRBot,-h/2) → 斜上到側面 (radius,-h/2+capBot)
      if (bottomChamfer > 0) {
        const capBot = Math.min(bottomChamfer, radius * 0.5, h * 0.5);
        const innerRBot = Math.max(0.5, radius - capBot);
        points.push(new Vector2(innerRBot, -h / 2));
        if (styleSegs === 1) {
          points.push(new Vector2(radius, -h / 2 + capBot));
        } else {
          for (let i = 1; i <= styleSegs; i++) {
            const t = (i / styleSegs) * (Math.PI / 2);
            points.push(
              new Vector2(
                innerRBot + capBot * Math.sin(t),
                -h / 2 + capBot - capBot * Math.cos(t),
              ),
            );
          }
        }
      } else {
        points.push(new Vector2(radius, -h / 2));
      }
      // 上緣倒角：側面 (radius,h/2-cap) → 斜入到頂面 (innerR,h/2)
      if (chamfer > 0) {
        const cap = Math.min(chamfer, radius * 0.5, h * 0.5);
        const innerR = Math.max(0.5, radius - cap);
        points.push(new Vector2(radius, h / 2 - cap));
        if (styleSegs === 1) {
          points.push(new Vector2(innerR, h / 2));
        } else {
          for (let i = 1; i <= styleSegs; i++) {
            const t = (i / styleSegs) * (Math.PI / 2);
            points.push(
              new Vector2(innerR + cap * Math.cos(t), h / 2 - cap + cap * Math.sin(t)),
            );
          }
        }
      } else {
        points.push(new Vector2(radius, h / 2));
      }
      points.push(new Vector2(0, h / 2));
      const lathe = new LatheGeometry(points, 48);
      if (rotation[0] || rotation[1] || rotation[2]) {
        lathe.rotateX(rotation[0]);
        lathe.rotateY(rotation[1]);
        lathe.rotateZ(rotation[2]);
      }
      return lathe;
    }
```

- [ ] **Step 3: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add lib/render/part-geometry.ts
git commit -m "feat(part-geometry): round shape 支援 bottomChamferMm 下緣倒角"
```

---

### Task 9: `round-stool.ts` — 圓凳座板下緣倒角

**Files:**
- Modify: `lib/templates/round-stool.ts`

- [ ] **Step 1: import**

`lib/templates/round-stool.ts` line 9 單行 import。把 `seatEdgeOption,` 改成 `seatEdgeOption, seatEdgeBottomOption,`。

- [ ] **Step 2: 加選項**

`round-stool.ts` line 14-15 現有：

```ts
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
```

替換為（`legInset` 範圍 20–200 恆 > 0，故下緣選項永遠可見、不加 dependsOn）：

```ts
  seatEdgeOption("top", 5),
  seatEdgeBottomOption("top"),
  { ...seatEdgeStyleOption("top"), dependsOn: { any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] } },
```

- [ ] **Step 3: body 讀值 + 夾限**

`round-stool.ts` line 62-63 現有 `const seatEdge = ...` / `const seatEdgeStyle = ...`。在 `const seatEdgeStyle` 那行之後插入：

```ts
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
```

`legInset` 已在 line 71 宣告。在 line 71 之後插入：

```ts
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
```

- [ ] **Step 4: 套用到圓座板 shape**

`round-stool.ts` 約 line 112 現有 `const seatChamferMm = parseSeatChamferMm(seatEdge);`。在這行之後插入：

```ts
  const seatBottomChamferMm = Math.min(seatEdgeBottomClamped, seatThickness * 0.45);
```

接著 `round-stool.ts` 約 line 119-128 的 `shape:` 區塊現有：

```ts
    shape:
      seatChamferMm > 0
        ? {
            kind: "round",
            chamferMm: seatChamferMm,
            chamferStyle: seatEdgeStyle === "rounded" ? "rounded" : "chamfered",
          }
        : { kind: "round" },
```

替換為：

```ts
    shape:
      seatChamferMm > 0 || seatBottomChamferMm > 0
        ? {
            kind: "round",
            chamferMm: seatChamferMm,
            bottomChamferMm: seatBottomChamferMm > 0 ? seatBottomChamferMm : undefined,
            chamferStyle: seatEdgeStyle === "rounded" ? "rounded" : "chamfered",
          }
        : { kind: "round" },
```

- [ ] **Step 5: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/templates/round-stool.ts
git commit -m "feat(round-stool): 圓凳座板下緣倒角選項"
```

---

### Task 10: `svg-views.tsx` — 圓座板下緣倒角三視圖

**Files:**
- Modify: `lib/render/svg-views.tsx:1710-1711`

`round` 帶上緣 `chamferMm` 時，三視圖前/側視走 polygon path 才畫得出倒角斜面（`isRoundWithChamfer` 旗標）。只有下緣倒角（`chamferMm=0`、`bottomChamferMm>0`）時也要走 polygon。

⚠️ 動 `svg-views.tsx` 前先 grep `docs/drafting-math.md` §A（三視圖）。

- [ ] **Step 1: 擴 `isRoundWithChamfer` 偵測**

`lib/render/svg-views.tsx:1710-1711` 現有：

```ts
        const isRoundWithChamfer =
          part.shape?.kind === "round" && (part.shape.chamferMm ?? 0) > 0;
```

替換為：

```ts
        const isRoundWithChamfer =
          part.shape?.kind === "round" &&
          ((part.shape.chamferMm ?? 0) > 0 || (part.shape.bottomChamferMm ?? 0) > 0);
```

- [ ] **Step 2: 驗證型別**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: 視覺驗證（圓凳三視圖）**

啟 dev server（`npm run dev`），用 Playwright 開圓凳設計頁，`seatEdge=0`、`seatEdgeBottom=12`，截前視圖。
Expected: 圓座板**下緣**外角有可見的 12mm 倒角斜面（不是直角矩形）。
若 polygon 投影只畫出上緣、下緣仍是直角：grep `geometry.ts` 的 `projectPartPolygon` 內 `round` chamfer 處理（搜 `chamferMm`），比照上緣斜面補一段下緣斜面投影，引用 `docs/drafting-math.md` §A 編號。

- [ ] **Step 4: Commit**

```bash
git add lib/render/svg-views.tsx
git commit -m "feat(svg-views): 圓座板僅下緣倒角時三視圖走 polygon"
```

---

### Task 11: 整體驗收

**Files:** 無（驗證用）

- [ ] **Step 1: 型別全綠**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: audit 不回歸**

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: `✅ All non-allowlisted cases clean (139/149)`（不得低於 baseline 139）

- [ ] **Step 3: 3D 視覺驗收**

啟 dev server，用 Playwright 對下列各家具設定 `legInset` 一個 > 0 的值 + 下緣倒角 > 0，截 3D 透視圖：

- desk（legInset 例：50；下緣倒角 10）
- dining-chair（legInset 30；下緣倒角 8）
- square-stool（legInset 30；下緣倒角 8）
- bar-stool（legInset 30；下緣倒角 8）
- bench（legInset 40；下緣倒角 10）
- round-stool（legInset 40 預設；下緣倒角 12）

Expected: 每張座板/桌面的**下緣外緣**肉眼可見倒角斜面；無零件穿模。

- [ ] **Step 4: 閘門驗收**

Playwright 開 desk 設計頁，`legInset = 0`。
Expected: 「下緣倒角尺寸 (mm)」選項**不顯示**；桌面下緣維持直角。
把 `legInset` 調 > 0 → 選項出現。

- [ ] **Step 5: 完成**

無 commit（純驗證）。若任何步驟失敗，回對應 Task 修正。

---

## 備註

- **行為改變（預期內）**：square-stool 原本「腳內縮即自動下緣倒角（量=上緣）」改成由明確的「下緣倒角尺寸」選項控制，預設 0。其他走 `simpleTable` 的桌類（dining-table / side-table / low-table / tea-table）未加此選項，`opts.seatEdgeBottom` 為 undefined → 維持舊的 overhang 自動鏡射行為，無回歸。
- **倒角樣式**：上下緣共用 `seatEdgeStyle`；6 個模板的 style 選項 dependsOn 已改成「上或下任一 ≠ 0」就顯示。
