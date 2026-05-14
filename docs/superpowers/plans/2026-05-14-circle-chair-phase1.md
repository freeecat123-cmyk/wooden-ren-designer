# 明式圈椅 Phase 1（直線化框架版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 wrd 新增 `circle-chair` 家具種類，產出一把結構正確、可調基本尺寸、三視圖+3D 出圖、材料單列滿 34 件的「直線化近似版」明式圈椅。

**Architecture:** 照 wrd「加新家具 4 步 SOP」走。新檔 `lib/templates/circle-chair.ts`（`OptionSpec[]` + builder），builder 內部拆 6 個 sub-function 分組組 `Part[]`。Phase 1 **完全用現有 shape**（`box` / `arch-bent` / `face-rounded` / `splayed-round-tapered` / `round`）近似曲線件——不新增 shape kind。椅圈 5 段各用 `arch-bent` 拼成多邊近似圈；S 曲線件用現有 shape 湊。後腿/前腳一木連做用單一 `arch-bent` 件（彎度集中上段）。

**Tech Stack:** Next.js + TypeScript；`lib/types/index.ts` 型別；`lib/templates/_helpers.ts` / `_validators.ts` 共用 helper；`@/lib/joinery/standards` 榫規格；驗證走 `scripts/audit-overlaps.ts` + `scripts/audit-joints.ts` + `npx tsc --noEmit` + playwright 截圖（**此 repo 無 unit test 框架——audit script 就是測試**）。

**參考文件：**
- 設計 spec：`docs/superpowers/specs/2026-05-14-circle-chair-design.md`（零件清單、尺寸、4-phase 定義）
- 製圖數學：`docs/drafting-math.md` §A10（butt-joint 慣例）、§O（人體工學座高/扶手高）、§V（椅子穩定性）、§K（明清派系比例）
- pattern 範本：`lib/templates/round-stool.ts`（座板+4 腿+橫撐的完整寫法）、`lib/templates/bench.ts` L401-510（windsor「圓料+彎弧」分支）

**前置：** 已在分支 `feat/circle-chair`（spec commit `9e8319a`）。先確認 `git branch --show-current` = `feat/circle-chair`、`npm install` 已跑、`npm run dev` 可起。

**幾何值說明：** 下列 task 給的 origin / bendMm / 截面尺寸是**起始值**，依 memory `feedback_self_iterate` + `feedback_wrd_self_verify_playwright`，每個 task 收尾用 playwright 截圖比對、微調到視覺正確再 commit。spec §3 的「淨料尺寸」中，椅圈三段的「寬」（200/120/110）是**毛料挖弧寬**，P1 用成品截面寬（~45–55mm），不是毛料寬。

---

## File Structure

| 檔案 | 動作 | 責任 |
|---|---|---|
| `lib/types/index.ts` | Modify L10-39 | `FurnitureCategory` union 加 `"circle-chair"` |
| `lib/templates/circle-chair.ts` | Create | `circleChairOptions: OptionSpec[]` + `circleChair: FurnitureTemplate`。builder 內拆 `buildSeatFrame` / `buildLegs` / `buildStretchers` / `buildArmRail` / `buildSCurveMembers` / `buildCornerBraces` 六個 sub-function |
| `lib/templates/index.ts` | Modify L6-33（import）+ L46-328（catalog array） | 註冊一筆 `FurnitureCatalogEntry` |
| `lib/knowledge/style-detail-packs.ts` | Modify | SOP step 3 產出的 detail pack merge 進來（Task 10） |

---

## Task 1: 註冊 category + stub template（先打通端對端）

**Files:**
- Modify: `lib/types/index.ts:10-39`
- Create: `lib/templates/circle-chair.ts`
- Modify: `lib/templates/index.ts`

- [ ] **Step 1: `FurnitureCategory` union 加字串**

`lib/types/index.ts` L31 `| "bed"` 之後、L32 `// 小物件` 之前加一行：

```ts
  | "bed"
  | "circle-chair"
  // 小物件 (accessories)
```

- [ ] **Step 2: 建 stub template 檔**

Create `lib/templates/circle-chair.ts`：

```ts
import type { FurnitureDesign, FurnitureTemplate, OptionSpec, Part } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { applyStandardChecks } from "./_validators";

export const circleChairOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "seatHeight", label: "座面高 (mm)", defaultValue: 480, min: 420, max: 520, step: 5, unit: "mm", help: "地面到座板上緣（人體工學 §O）" },
];

/**
 * 明式圈椅（circle-chair）— Phase 1 直線化框架版
 * input.length = 座寬、input.width = 座深、input.height = 椅圈總高
 * 預設 610 × 497 × 720mm（台南魯班學堂工作圖實尺）
 */
export const circleChair: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const o = circleChairOptions;
  const seatHeight = getOption<number>(input, opt(o, "seatHeight"));

  const parts: Part[] = [];

  // STUB：先放一塊座板佔位，後續 task 換成完整零件
  parts.push({
    id: "seat-panel",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length: 446, width: 332, thickness: 15 },
    origin: { x: 0, y: seatHeight - 15, z: 0 },
    shape: { kind: "box" },
    tenons: [],
    mortises: [],
  });

  const design: FurnitureDesign = {
    id: `circle-chair-${input.length}x${input.height}`,
    category: "circle-chair",
    nameZh: "明式圈椅",
    overall: { length: input.length, width: input.width, thickness: input.height },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `明式圈椅（Phase 1 框架版）座寬 ${input.length}mm × 座深 ${input.width}mm × 椅圈高 ${input.height}mm。`,
  };
  applyStandardChecks(design, {
    minLength: 550, minWidth: 440, minHeight: 650,
    maxLength: 750, maxWidth: 600, maxHeight: 1150,
  });
  return design;
};
```

- [ ] **Step 3: 註冊到 catalog**

`lib/templates/index.ts` import 區（L33 `import { coatRack, ... }` 後）加：

```ts
import { circleChair, circleChairOptions } from "./circle-chair";
```

`FURNITURE_CATALOG` array 內、`dining-chair` entry（L167-176）之後加：

```ts
  {
    category: "circle-chair",
    nameZh: "明式圈椅",
    description: "明式圈椅——5 段楔釘榫攢接椅圈、後腿一木連做、S 形靠背板。台南魯班學堂工作圖實作",
    difficulty: "advanced",
    template: circleChair,
    defaults: { length: 610, width: 497, height: 720 },
    limits: { length: 750, width: 600, height: 1150 },
    optionSchema: circleChairOptions,
  },
```

- [ ] **Step 4: type check**

Run: `npx tsc --noEmit`
Expected: 無錯誤（新 category 已加進 union、template 簽名正確）

- [ ] **Step 5: audit-overlaps（圈椅必須出現且乾淨）**

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: 輸出表格內出現 `circle-chair` 列、status `✅`（stub 只有一塊板，0 overlaps）；結尾 `✅ All non-allowlisted cases clean`、exit 0

- [ ] **Step 6: 公開路徑能載入**

啟 `npm run dev`，playwright 開 `http://localhost:3000/design/circle-chair?_shoot=1`
Expected: 頁面正常載入、不 404、3D 顯示一塊浮空的座板、表單有「座面高」欄位

- [ ] **Step 7: Commit**

```bash
git add lib/types/index.ts lib/templates/circle-chair.ts lib/templates/index.ts
git commit -m "feat(circle-chair): register category + stub template"
```

---

## Task 2: OptionSpec[] — 完整表單參數

**Files:**
- Modify: `lib/templates/circle-chair.ts`（`circleChairOptions` + import）

- [ ] **Step 1: 擴充 `circleChairOptions`**

把 `circleChairOptions` 換成（import 區加 `_helpers` 的 edge factory）：

```ts
import { legEdgeOption, legEdgeStyleOption, stretcherEdgeOption, stretcherEdgeStyleOption, seatEdgeOption, seatEdgeStyleOption } from "./_helpers";

export const circleChairOptions: OptionSpec[] = [
  // 基本尺寸（spec §8.1：只開座面高，其餘走 catalog defaults length/width/height）
  { group: "top", type: "number", key: "seatHeight", label: "座面高 (mm)", defaultValue: 480, min: 420, max: 520, step: 5, unit: "mm", help: "地面到座板上緣（人體工學 §O）" },
  // 風格 preset（spec §8.2）
  { group: "misc", type: "select", key: "stylePreset", label: "風格", defaultValue: "ming-plain", wide: true, choices: [
    { value: "ming-plain", label: "明式素圈椅（工作圖原型・胡桃木）" },
    { value: "huanghuali-slim", label: "黃花梨細秀款（截面收細・淺色硬木）" },
    { value: "jichimu-stout", label: "雞翅木壯實款（截面飽滿・深色木紋）" },
  ] },
  // 教材兩種做法（spec §8.3）
  { group: "structure", type: "select", key: "footRailJoint", label: "管腳棖榫型", defaultValue: "square-tenon", choices: [
    { value: "square-tenon", label: "椿榫（規矩方榫）" },
    { value: "duck-bill", label: "鴨母嘴（斜口勾掛榫）" },
  ], help: "魯班學堂教材提供兩種做法供對照" },
  { group: "structure", type: "select", key: "seatCornerStructure", label: "椅盤轉角", defaultValue: "structure-1", choices: [
    { value: "structure-1", label: "第一種結構" },
    { value: "structure-2", label: "第二種結構" },
  ], help: "魯班學堂教材提供兩種椅盤攢框轉角做法" },
  // 倒角（走 _helpers factory，不手寫）
  seatEdgeOption("top", 3),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 2),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
];
```

- [ ] **Step 2: type check**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 3: 表單渲染確認**

playwright 開 `/design/circle-chair?_shoot=1`，截圖表單區
Expected: 表單出現「座面高」「風格」（3 選項）「管腳棖榫型」「椅盤轉角」「倒角」相關欄位，無 console error

- [ ] **Step 4: Commit**

```bash
git add lib/templates/circle-chair.ts
git commit -m "feat(circle-chair): full OptionSpec — seat height, presets, 教材選項, edges"
```

---

## Task 3: 椅盤（座面框）6 件

**Files:**
- Modify: `lib/templates/circle-chair.ts`（加 `buildSeatFrame` sub-function + builder 呼叫）

**零件**（spec §3 材料單，淨料 mm）：

| id | nameZh | visible (L×W×T) | shape | 說明 |
|---|---|---|---|---|
| `seat-rail-front` | 前大邊 | 615×91×39 | `box` | 沿 X，origin z = -(座深/2 - 抹頭厚/2) |
| `seat-rail-back` | 後大邊 | 615×91×39 | `box` | 沿 X，origin z = +(座深/2 - ...) |
| `seat-rail-left` | 左抹頭 | 497×91×39 | `box` | 沿 Z，`rotation: { x:0, y:Math.PI/2, z:0 }` |
| `seat-rail-right` | 右抹頭 | 497×91×39 | `box` | 沿 Z，同上 |
| `seat-panel` | 座板 | 446×332×15 | `chamfered-top`（seatEdge>0）或 `box` | `panelPieces: 2`（可拼板），origin y = 座框頂面下沉裝板槽位 |
| `seat-thru-batten` | 穿帶 | 346×35×35 | `box` | 沿 Z（前後向），座板下方居中 |

- [ ] **Step 1: 寫 `buildSeatFrame`**

在 builder 之前加 sub-function（座標：origin = 底部中心，y = 零件底面；座框頂面 = `seatHeight`）：

```ts
function buildSeatFrame(args: {
  material: import("@/lib/types").MaterialId;
  seatWidth: number;   // input.length
  seatDepth: number;   // input.width
  seatHeight: number;
  seatChamferMm: number;
  seatEdgeStyle: string;
}): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, seatChamferMm, seatEdgeStyle } = args;
  const RAIL_W = 91, RAIL_T = 39, PANEL_T = 15, BATTEN = 35;
  const railBottomY = seatHeight - RAIL_W; // 大邊/抹頭 visible.width 借作高度
  const parts: Part[] = [];

  // 前後大邊（沿 X）
  for (const sz of [-1, 1] as const) {
    parts.push({
      id: sz < 0 ? "seat-rail-front" : "seat-rail-back",
      nameZh: sz < 0 ? "前大邊" : "後大邊",
      material,
      grainDirection: "length",
      visible: { length: seatWidth - 2 * RAIL_T, width: RAIL_W, thickness: RAIL_T },
      origin: { x: 0, y: railBottomY, z: sz * (seatDepth / 2 - RAIL_T / 2) },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }
  // 左右抹頭（沿 Z，繞 Y 轉 90°）
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "seat-rail-left" : "seat-rail-right",
      nameZh: sx < 0 ? "左抹頭" : "右抹頭",
      material,
      grainDirection: "length",
      visible: { length: seatDepth - 2 * RAIL_T, width: RAIL_W, thickness: RAIL_T },
      origin: { x: sx * (seatWidth / 2 - RAIL_T / 2), y: railBottomY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" },
      tenons: [],
      mortises: [],
    });
  }
  // 座板（落在框內、頂面比座框頂低 6mm 模擬裝板槽）
  parts.push({
    id: "seat-panel",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length: seatWidth - 2 * RAIL_T - 8, width: seatDepth - 2 * RAIL_T - 8, thickness: PANEL_T },
    origin: { x: 0, y: seatHeight - 6 - PANEL_T, z: 0 },
    panelPieces: 2,
    shape: seatChamferMm > 0
      ? { kind: "chamfered-top", chamferMm: seatChamferMm, style: seatEdgeStyle === "rounded" ? "rounded" : "chamfered" }
      : { kind: "box" },
    tenons: [],
    mortises: [],
  });
  // 穿帶（座板下方、沿 Z 居中）
  parts.push({
    id: "seat-thru-batten",
    nameZh: "穿帶",
    material,
    grainDirection: "length",
    visible: { length: seatDepth - 2 * RAIL_T, width: BATTEN, thickness: BATTEN },
    origin: { x: 0, y: seatHeight - 6 - PANEL_T - BATTEN, z: 0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    shape: { kind: "box" },
    tenons: [],
    mortises: [],
  });
  return parts;
}
```

- [ ] **Step 2: builder 呼叫 + 移除 stub**

builder 內把 Task 1 的 stub `parts.push({ id: "seat-panel", ... })` 整段刪掉，改成：

```ts
  const seatChamferMm = (() => { const v = getOption<number>(input, opt(o, "seatEdge")); return v > 0 ? v : 0; })();
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  parts.push(...buildSeatFrame({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
    seatChamferMm, seatEdgeStyle,
  }));
```

- [ ] **Step 3: type check**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 4: audit-overlaps**

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: `circle-chair` 列 `✅` 0 overlaps（攢邊框 4 根 + 座板 + 穿帶不互相穿模）。若 ❌ NEW：檢查座板/穿帶有沒有卡進大邊（調 visible 收 8mm 的縫）

- [ ] **Step 5: playwright 視覺驗證**

開 `/design/circle-chair?_shoot=1`，截 3D + 三視圖
Expected: 看到一個方形座框 + 內嵌座板，4 根框料端面對接成矩形，穿帶藏在座板下。三視圖俯視看到攢邊框 + 座板。

- [ ] **Step 6: Commit**

```bash
git add lib/templates/circle-chair.ts
git commit -m "feat(circle-chair): seat frame — 攢邊框 4 根 + 座板 + 穿帶"
```

---

## Task 4: 四腿（一木連做近似）4 件

**Files:**
- Modify: `lib/templates/circle-chair.ts`（加 `buildLegs` + builder 呼叫）

**零件**（P1 近似：圓料、整支從地面穿過座盤往上延；前腳上段彎成鵝脖、後腿上段後傾接椅圈）：

| id | nameZh | visible (L×W×T) | shape | 說明 |
|---|---|---|---|---|
| `leg-front-l` / `leg-front-r` | 前左腳 / 前右腳（含鵝脖） | Ø50×Ø50×715 | `arch-bent`（bendMm 集中上段，模擬鵝脖前彎）；P1 也可先用 `splayed-round-tapered` 純斜 | 一木連做：地面 → 穿座盤 → 鵝脖頂接椅圈 |
| `leg-rear-l` / `leg-rear-r` | 後左腳 / 後右腳（一木連做） | Ø36×Ø36×985 | `arch-bent`（bendMm 集中上段，模擬後傾）；P1 可先 `splayed-round-tapered` | 一木連做：地面 → 穿座盤 → 頂端接椅圈 |

**關鍵**：腿是 `round` 系列 → 母件曲面，所有接腿榫**強制盲榫**（memory `feedback_round_only_no_square` + `_validators.validateRoundLegJoinery`）。`arch-bent` 件**不可旋轉**才能讓 local Z = 世界 Z；前腳鵝脖往前（-Z）彎、後腿往後（+Z）彎，用 `bendMm` 正負號控制。

- [ ] **Step 1: 寫 `buildLegs`**

```ts
function buildLegs(args: {
  material: import("@/lib/types").MaterialId;
  seatWidth: number; seatDepth: number; seatHeight: number;
  ringHeight: number;          // input.height（椅圈總高）
}): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, ringHeight } = args;
  const FRONT_D = 50, REAR_D = 36;
  // 腿中心離座框：前腿在前緣、後腿在後緣，內縮一個腿半徑
  const legXOff = seatWidth / 2 - FRONT_D / 2 - 6;
  const legZOffFront = -(seatDepth / 2 - FRONT_D / 2 - 6);
  const legZOffRear = seatDepth / 2 - REAR_D / 2 - 6;
  const parts: Part[] = [];

  // 前腳（含鵝脖）：地面 → 鵝脖頂；P1 用 arch-bent，bendMm 負 = 往 -Z（前）彎
  for (const sx of [-1, 1] as const) {
    const frontLegTop = seatHeight + 180; // 鵝脖頂大約座面上 180mm 接椅圈前段
    parts.push({
      id: sx < 0 ? "leg-front-l" : "leg-front-r",
      nameZh: `前${sx < 0 ? "左" : "右"}腳（含鵝脖）`,
      material,
      grainDirection: "length",
      visible: { length: FRONT_D, width: FRONT_D, thickness: frontLegTop },
      origin: { x: sx * legXOff, y: 0, z: legZOffFront },
      shape: { kind: "arch-bent", bendMm: -28 }, // 上段往前彎模擬鵝脖
      tenons: [],
      mortises: [],
    });
  }
  // 後腳（一木連做穿座盤接椅圈）：bendMm 正 = 往 +Z（後）彎
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "leg-rear-l" : "leg-rear-r",
      nameZh: `後${sx < 0 ? "左" : "右"}腳`,
      material,
      grainDirection: "length",
      visible: { length: REAR_D, width: REAR_D, thickness: ringHeight },
      origin: { x: sx * legXOff, y: 0, z: legZOffRear },
      shape: { kind: "arch-bent", bendMm: 22 }, // 上段後傾
      tenons: [],
      mortises: [],
    });
  }
  return parts;
}
```

- [ ] **Step 2: builder 呼叫**

```ts
  parts.push(...buildLegs({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
    ringHeight: input.height,
  }));
```

- [ ] **Step 3: type check**

Run: `npx tsc --noEmit`
Expected: 無錯誤。若 `arch-bent` 不接受負 `bendMm`：查 `lib/types/index.ts:276-279` 確認允許負值（註解寫明「bendMm < 0 → 向 -Z 凸」，允許）

- [ ] **Step 4: audit-overlaps**

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: `circle-chair` `✅`。腿穿過座盤的 overlap：因 `useButtJointConvention: true` 且 id 以 `leg-` 開頭——若被判 NEW，確認 audit-overlaps 對「腿穿水平框」的 filter（agent 報告 §5.3 提到 `back-` 開頭才放行）。若腿穿座盤被擋，把腿 id 改前綴或在 `SHAPE_AWARE_CASES` 加 `circle-chair` allowlist 並註明原因

- [ ] **Step 5: playwright 視覺驗證**

開 `/design/circle-chair?_shoot=1`，截 3D + 正視 + 側視
Expected: 4 隻圓腿從地面穿過座盤往上延；側視看到前腳上段微微往前彎（鵝脖雛形）、後腿往後傾。腳底落地。

- [ ] **Step 6: Commit**

```bash
git add lib/templates/circle-chair.ts
git commit -m "feat(circle-chair): 4 legs — 前腳含鵝脖 + 後腿一木連做（arch-bent 近似）"
```

---

## Task 5: 橫撐 + 步步高管腳棖 8 件

**Files:**
- Modify: `lib/templates/circle-chair.ts`（加 `buildStretchers` + builder 呼叫）

**零件**（spec §3）：

| id | nameZh | visible (L×W×T) | 離地高 | 說明 |
|---|---|---|---|---|
| `decor-rail-front` / `-back` | 前/後橫飾棖 | 535×48×21 | 座框下緊貼 | 沿 X，origin y ≈ seatHeight-91-21 |
| `decor-rail-left` / `-right` | 左/右橫飾棖 | 410×48×21 | 同上 | 沿 Z，繞 Y 轉 90° |
| `foot-rail-front` | 前腳棖（踏腳棖） | 595×65×36 | ~75 | 沿 X，最低、最粗 |
| `foot-rail-side-l` / `-r` | 左/右步步高側棖 | 416×27×27 | ~120 | 沿 Z |
| `foot-rail-back` | 步步高後棖 | 572×27×27 | ~150 | 沿 X，最高（步步高：前低→側中→後高） |

- [ ] **Step 1: 寫 `buildStretchers`**

```ts
function buildStretchers(args: {
  material: import("@/lib/types").MaterialId;
  seatWidth: number; seatDepth: number; seatHeight: number;
}): Part[] {
  const { material, seatWidth, seatDepth, seatHeight } = args;
  const parts: Part[] = [];
  const decorY = seatHeight - 91 - 21; // 橫飾棖緊貼座框底
  const FRONT_D = 50, REAR_D = 36;
  const xSpanFront = seatWidth - 2 * FRONT_D;
  const zSpan = seatDepth - 2 * FRONT_D;

  // 橫飾棖（前後沿 X、左右沿 Z）
  for (const sz of [-1, 1] as const) {
    parts.push({
      id: sz < 0 ? "decor-rail-front" : "decor-rail-back",
      nameZh: sz < 0 ? "前橫飾棖" : "後橫飾棖",
      material, grainDirection: "length",
      visible: { length: xSpanFront, width: 48, thickness: 21 },
      origin: { x: 0, y: decorY, z: sz * (seatDepth / 2 - FRONT_D / 2 - 4) },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "decor-rail-left" : "decor-rail-right",
      nameZh: sx < 0 ? "左橫飾棖" : "右橫飾棖",
      material, grainDirection: "length",
      visible: { length: zSpan, width: 48, thickness: 21 },
      origin: { x: sx * (seatWidth / 2 - FRONT_D / 2 - 4), y: decorY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }
  // 步步高管腳棖：前 75 / 側 120 / 後 150（離地，棖底面）
  parts.push({
    id: "foot-rail-front", nameZh: "前腳棖（踏腳棖）",
    material, grainDirection: "length",
    visible: { length: xSpanFront, width: 65, thickness: 36 },
    origin: { x: 0, y: 75, z: -(seatDepth / 2 - FRONT_D / 2 - 4) },
    shape: { kind: "box" }, tenons: [], mortises: [],
  });
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "foot-rail-side-l" : "foot-rail-side-r",
      nameZh: `${sx < 0 ? "左" : "右"}步步高側棖`,
      material, grainDirection: "length",
      visible: { length: zSpan, width: 27, thickness: 27 },
      origin: { x: sx * (seatWidth / 2 - FRONT_D / 2 - 4), y: 120, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }
  parts.push({
    id: "foot-rail-back", nameZh: "步步高後棖",
    material, grainDirection: "length",
    visible: { length: xSpanFront, width: 27, thickness: 27 },
    origin: { x: 0, y: 150, z: seatDepth / 2 - REAR_D / 2 - 4 },
    shape: { kind: "box" }, tenons: [], mortises: [],
  });
  return parts;
}
```

- [ ] **Step 2: builder 呼叫**

```ts
  parts.push(...buildStretchers({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
  }));
```

- [ ] **Step 3: type check** — Run: `npx tsc --noEmit` — Expected: 無錯誤

- [ ] **Step 4: audit-overlaps** — Run: `npx tsx scripts/audit-overlaps.ts` — Expected: `circle-chair` `✅`。步步高三段不同高（75/120/150），不會在腿同高開眼，不互撞

- [ ] **Step 5: playwright 視覺驗證**

開 `/design/circle-chair?_shoot=1`，截側視 + 3D
Expected: 側視看到管腳棖前低後高的「步步高」階梯排列；橫飾棖緊貼座框下方；前腳棖明顯較粗

- [ ] **Step 6: Commit**

```bash
git add lib/templates/circle-chair.ts
git commit -m "feat(circle-chair): 橫飾棖 4 根 + 步步高管腳棖 4 根"
```

---

## Task 6: 椅圈 5 段（arch-bent 近似）

**Files:**
- Modify: `lib/templates/circle-chair.ts`（加 `buildArmRail` + builder 呼叫）

**零件**（spec §3；P1 用 5 段 `arch-bent` 拼成多邊近似馬蹄圈，截面用成品寬非毛料寬）：

| id | nameZh | visible (L×W×T) | 旋轉 / 位置 | 說明 |
|---|---|---|---|---|
| `arm-rail-back` | 椅圈上靠桿 | 625×55×36 | 沿 X，不旋轉，`arch-bent` bendMm 正（後弧往 +Z 凸） | 後正中段 |
| `arm-rail-mid-l` / `-r` | 椅圈中桿 ×2 | 410×50×36 | 斜置（繞 Y 旋轉 ±~45°） | 連接後段與左右桿 |
| `arm-rail-side-l` / `-r` | 椅圈左右桿 ×2 | 350×45×36 | 沿 Z（繞 Y 轉 ±90°），`arch-bent` 模擬扶手外撇 | 兩端鱔魚頭扶手 |

**關鍵**：`arch-bent` 只能單軸彎，連續馬蹄圈 P1 用「5 段各自 arch-bent + 旋轉擺位」拼多邊近似。椅圈所在高度 = `input.height - 36`（椅圈頂 = 椅圈總高）。中桿/左右桿有旋轉 → `arch-bent` 彎曲方向會跟著轉，P1 接受這個近似（P3 才換 `swept-curve` 真曲線）。

- [ ] **Step 1: 寫 `buildArmRail`**

```ts
function buildArmRail(args: {
  material: import("@/lib/types").MaterialId;
  seatWidth: number; seatDepth: number; ringHeight: number;
}): Part[] {
  const { material, seatWidth, seatDepth, ringHeight } = args;
  const RAIL_T = 36;
  const ringY = ringHeight - RAIL_T;        // 椅圈底面 Y
  const ringBackZ = seatDepth / 2 + 30;     // 後弧段中心 Z（略偏後）
  const parts: Part[] = [];

  // 後正中段（上靠桿）：沿 X、不旋轉、arch-bent 往 +Z 後凸
  parts.push({
    id: "arm-rail-back", nameZh: "椅圈上靠桿",
    material, grainDirection: "length",
    visible: { length: seatWidth * 0.62, width: 55, thickness: RAIL_T },
    origin: { x: 0, y: ringY, z: ringBackZ },
    shape: { kind: "arch-bent", bendMm: 70 },
    tenons: [], mortises: [],
  });
  // 中桿 ×2：繞 Y 斜置 ±45°，連接後段到側段
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "arm-rail-mid-l" : "arm-rail-mid-r",
      nameZh: "椅圈中桿",
      material, grainDirection: "length",
      visible: { length: 410, width: 50, thickness: RAIL_T },
      origin: { x: sx * seatWidth * 0.42, y: ringY, z: seatDepth * 0.32 },
      rotation: { x: 0, y: sx * Math.PI / 4, z: 0 },
      shape: { kind: "arch-bent", bendMm: 30 },
      tenons: [], mortises: [],
    });
  }
  // 左右桿 ×2（鱔魚頭扶手）：繞 Y 轉 ±90°，沿 Z 向前
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "arm-rail-side-l" : "arm-rail-side-r",
      nameZh: "椅圈左右桿",
      material, grainDirection: "length",
      visible: { length: 350, width: 45, thickness: RAIL_T },
      origin: { x: sx * (seatWidth / 2 - 10), y: ringY, z: -seatDepth * 0.05 },
      rotation: { x: 0, y: sx * Math.PI / 2, z: 0 },
      shape: { kind: "arch-bent", bendMm: -40 },
      tenons: [], mortises: [],
    });
  }
  return parts;
}
```

- [ ] **Step 2: builder 呼叫**

```ts
  parts.push(...buildArmRail({
    material, seatWidth: input.length, seatDepth: input.width, ringHeight: input.height,
  }));
```

- [ ] **Step 3: type check** — Run: `npx tsc --noEmit` — Expected: 無錯誤

- [ ] **Step 4: audit-overlaps**

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: `circle-chair` `✅` 或 `⚠️ design-residue`。椅圈 5 段在接點處本來就要相接——若接點 overlap 被判 NEW，調 5 段的 origin/length 讓端面對接（butt-joint），或接受 design-residue 並 allowlist。**`audit-floating-parts` 對有 rotation 的椅圈段無效（agent 報告 §5.5），椅圈擺位靠 playwright 肉眼驗。**

- [ ] **Step 5: playwright 視覺驗證（重點 task）**

開 `/design/circle-chair?_shoot=1`，截俯視 + 3D + 正視
Expected: 俯視看到 5 段拼成近似馬蹄/ㄇ 形椅圈，開口朝前，兩端是往前外撇的扶手。3D 椅圈浮在座面上方、由腿支撐的高度。**這是 P1 最需要微調的部分**——5 段的 origin/rotation/bendMm 對著俯視圖反覆調到接點接得上、整圈順。

- [ ] **Step 6: Commit**

```bash
git add lib/templates/circle-chair.ts
git commit -m "feat(circle-chair): 椅圈 5 段（arch-bent 多邊近似馬蹄圈）"
```

---

## Task 7: S 曲線三件（聯幫棍 ×2 + 靠背板）

**Files:**
- Modify: `lib/templates/circle-chair.ts`（加 `buildSCurveMembers` + builder 呼叫）

**零件**（spec §3、§6 C 組）：

| id | nameZh | visible (L×W×T) | shape | 說明 |
|---|---|---|---|---|
| `side-spindle-l` / `-r` | 聯幫棍 ×2 | 380×50×30 | `splayed-round-tapered`（dzMm 給前傾位移近似弓形） | 椅圈左右桿與座框之間的彎棍 |
| `back-splat` | 靠背板 | 500×185×40 | `face-rounded` + `bendMm` + `bendAxis:"z"` | 素獨板 S 形，下接後大邊、上接椅圈後段 |

- [ ] **Step 1: 寫 `buildSCurveMembers`**

```ts
function buildSCurveMembers(args: {
  material: import("@/lib/types").MaterialId;
  seatWidth: number; seatDepth: number; seatHeight: number; ringHeight: number;
}): Part[] {
  const { material, seatWidth, seatDepth, seatHeight, ringHeight } = args;
  const parts: Part[] = [];
  const ringY = ringHeight - 36;

  // 聯幫棍 ×2：座框側邊 → 椅圈左右桿；P1 用斜圓料近似弓形
  for (const sx of [-1, 1] as const) {
    const spindleH = ringY - seatHeight;
    parts.push({
      id: sx < 0 ? "side-spindle-l" : "side-spindle-r",
      nameZh: "聯幫棍",
      material, grainDirection: "length",
      visible: { length: 50, width: 30, thickness: spindleH },
      origin: { x: sx * (seatWidth / 2 - 25), y: seatHeight, z: -seatDepth * 0.08 },
      shape: { kind: "splayed-round-tapered", bottomScale: 1.1, dxMm: 0, dzMm: 38 },
      tenons: [], mortises: [],
    });
  }
  // 靠背板：素獨板 S 形，下接後大邊、上接椅圈後段
  const splatBottomY = seatHeight;
  const splatH = ringY - splatBottomY;
  parts.push({
    id: "back-splat",
    nameZh: "靠背板",
    material, grainDirection: "length",
    visible: { length: 185, width: splatH, thickness: 40 },
    origin: { x: 0, y: splatBottomY, z: seatDepth / 2 - 20 },
    rotation: { x: 0, y: 0, z: 0 },
    shape: { kind: "face-rounded", cornerR: 12, bendMm: 32, bendAxis: "z" },
    tenons: [], mortises: [],
  });
  return parts;
}
```

- [ ] **Step 2: builder 呼叫**

```ts
  parts.push(...buildSCurveMembers({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight, ringHeight: input.height,
  }));
```

- [ ] **Step 3: type check** — Run: `npx tsc --noEmit` — Expected: 無錯誤（確認 `face-rounded` 接受 `bendMm`+`bendAxis`，見 `lib/types/index.ts:290-292`）

- [ ] **Step 4: audit-overlaps** — Run: `npx tsx scripts/audit-overlaps.ts` — Expected: `circle-chair` `✅` 或 `⚠️ design-residue`（靠背板/聯幫棍上下端接椅圈與座框，接點 overlap 可接受）

- [ ] **Step 5: playwright 視覺驗證**

開 `/design/circle-chair?_shoot=1`，截側視 + 3D
Expected: 側視看到靠背板在後方呈 S 形微彎、聯幫棍在側邊連接椅圈與座面。3D 看到背板填在後腿之間、椅圈下方。

- [ ] **Step 6: Commit**

```bash
git add lib/templates/circle-chair.ts
git commit -m "feat(circle-chair): S 曲線三件 — 聯幫棍 ×2 + S 形靠背板"
```

---

## Task 8: 角牙 8 件（box 佔位）

**Files:**
- Modify: `lib/templates/circle-chair.ts`（加 `buildCornerBraces` + builder 呼叫）

**零件**（spec §3、§6 F 組；P1 用 `box` 佔位，終態 `face-rounded` 壼門/雲紋）：

| id | nameZh | visible (L×W×T) | 數量 | 位置 |
|---|---|---|---|---|
| `corner-brace-front-l` / `-r` | 前腳角牙 | 115×55×10 | 2 | 前腳與座框前大邊夾角 |
| `decor-brace-{1..6}` | 橫飾棖角牙 | 76×60×10 | 6 | 橫飾棖與腿的夾角（前 2 + 左右各 2） |

- [ ] **Step 1: 寫 `buildCornerBraces`**

```ts
function buildCornerBraces(args: {
  material: import("@/lib/types").MaterialId;
  seatWidth: number; seatDepth: number; seatHeight: number;
}): Part[] {
  const { material, seatWidth, seatDepth, seatHeight } = args;
  const parts: Part[] = [];
  const FRONT_D = 50;

  // 前腳角牙 ×2：前腳內側、貼座框前大邊底
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "corner-brace-front-l" : "corner-brace-front-r",
      nameZh: "前腳角牙",
      material, grainDirection: "length",
      visible: { length: 115, width: 55, thickness: 10 },
      origin: { x: sx * (seatWidth / 2 - FRONT_D - 60), y: seatHeight - 91 - 55, z: -(seatDepth / 2 - FRONT_D / 2 - 6) },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  }
  // 橫飾棖角牙 ×6：前 2 + 左右各 2，貼橫飾棖與腿夾角
  const decorY = seatHeight - 91 - 21 - 30;
  const braceSpots: Array<{ x: number; z: number; rotY: number }> = [
    { x: -(seatWidth / 2 - FRONT_D - 40), z: -(seatDepth / 2 - FRONT_D / 2 - 6), rotY: 0 },
    { x:  (seatWidth / 2 - FRONT_D - 40), z: -(seatDepth / 2 - FRONT_D / 2 - 6), rotY: 0 },
    { x: -(seatWidth / 2 - FRONT_D / 2 - 6), z: -(seatDepth / 2 - FRONT_D - 40), rotY: Math.PI / 2 },
    { x: -(seatWidth / 2 - FRONT_D / 2 - 6), z:  (seatDepth / 2 - FRONT_D - 40), rotY: Math.PI / 2 },
    { x:  (seatWidth / 2 - FRONT_D / 2 - 6), z: -(seatDepth / 2 - FRONT_D - 40), rotY: Math.PI / 2 },
    { x:  (seatWidth / 2 - FRONT_D / 2 - 6), z:  (seatDepth / 2 - FRONT_D - 40), rotY: Math.PI / 2 },
  ];
  braceSpots.forEach((spot, i) => {
    parts.push({
      id: `decor-brace-${i + 1}`,
      nameZh: "橫飾棖角牙",
      material, grainDirection: "length",
      visible: { length: 76, width: 60, thickness: 10 },
      origin: { x: spot.x, y: decorY, z: spot.z },
      rotation: { x: 0, y: spot.rotY, z: 0 },
      shape: { kind: "box" }, tenons: [], mortises: [],
    });
  });
  return parts;
}
```

- [ ] **Step 2: builder 呼叫**

```ts
  parts.push(...buildCornerBraces({
    material, seatWidth: input.length, seatDepth: input.width, seatHeight,
  }));
```

- [ ] **Step 3: type check** — Run: `npx tsc --noEmit` — Expected: 無錯誤

- [ ] **Step 4: audit-overlaps** — Run: `npx tsx scripts/audit-overlaps.ts` — Expected: `circle-chair` `✅` 或 `⚠️ design-residue`（角牙嵌在腿/棖夾角，貼合面 overlap 可接受）

- [ ] **Step 5: 零件數驗證 + playwright**

開 `/design/circle-chair?_shoot=1`，看材料單
Expected: 材料單列出 **34 件**（6 椅盤 + 4 腿 + 8 橫撐棖 + 5 椅圈 + 3 S 曲線 + 8 角牙），分組顯示。3D 看到腿與棖夾角有小角牙片。

- [ ] **Step 6: Commit**

```bash
git add lib/templates/circle-chair.ts
git commit -m "feat(circle-chair): 角牙 8 件（前腳角牙 ×2 + 橫飾棖角牙 ×6）"
```

---

## Task 9: preset + 教材選項 wiring + builder 收尾

**Files:**
- Modify: `lib/templates/circle-chair.ts`（builder 主體 + import `_validators`）

- [ ] **Step 1: 加 preset 參數表 + 套用**

builder 開頭讀 `stylePreset` / `footRailJoint` / `seatCornerStructure`，加 preset → 截面倍率表：

```ts
  const stylePreset = getOption<string>(input, opt(o, "stylePreset"));
  const footRailJoint = getOption<string>(input, opt(o, "footRailJoint"));
  const seatCornerStructure = getOption<string>(input, opt(o, "seatCornerStructure"));

  // 風格 preset：只改截面倍率（spec §8.2），曲線/比例不動
  const PRESET: Record<string, { sectionScale: number; legScale: number }> = {
    "ming-plain":       { sectionScale: 1.0,  legScale: 1.0 },
    "huanghuali-slim":  { sectionScale: 0.85, legScale: 0.88 },
    "jichimu-stout":    { sectionScale: 1.15, legScale: 1.18 },
  };
  const preset = PRESET[stylePreset] ?? PRESET["ming-plain"];
```

把 `preset.sectionScale` 傳進 `buildArmRail` / `buildSCurveMembers`（乘在截面 width/thickness 上）、`preset.legScale` 傳進 `buildLegs`（乘在 `FRONT_D`/`REAR_D` 上）。`footRailJoint` / `seatCornerStructure` P1 只進 `notes` 字串（幾何不變，P4 才影響榫卯細節圖）。

- [ ] **Step 2: builder 收尾——validators + notes**

builder 結尾（`return design` 之前）改成：

```ts
  const design: FurnitureDesign = {
    id: `circle-chair-${input.length}x${input.height}`,
    category: "circle-chair",
    nameZh: "明式圈椅",
    overall: { length: input.length, width: input.width, thickness: input.height },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `明式圈椅（Phase 1 框架版）座寬 ${input.length} × 座深 ${input.width} × 椅圈高 ${input.height}mm，座面高 ${seatHeight}mm。風格：${stylePreset}。管腳棖榫型：${footRailJoint === "duck-bill" ? "鴨母嘴" : "椿榫"}。椅盤轉角：${seatCornerStructure === "structure-2" ? "第二種結構" : "第一種結構"}。椅圈 5 段楔釘榫攢接、後腿一木連做穿椅盤。`,
  };
  const w = validateRoundLegJoinery(design);
  if (w.length) design.warnings = [...(design.warnings ?? []), ...w];
  applyStandardChecks(design, {
    minLength: 550, minWidth: 440, minHeight: 650,
    maxLength: 750, maxWidth: 600, maxHeight: 1150,
  });
  return design;
```

import 區補 `validateRoundLegJoinery`：

```ts
import { validateRoundLegJoinery, applyStandardChecks } from "./_validators";
```

- [ ] **Step 3: type check** — Run: `npx tsc --noEmit` — Expected: 無錯誤

- [ ] **Step 4: audit 全套** — Run: `npx tsx scripts/audit-overlaps.ts && npx tsx scripts/audit-joints.ts` — Expected: 兩個都 `circle-chair` 非 NEW failure、exit 0

- [ ] **Step 5: playwright 三 preset 驗證**

依序開（dev server）：
- `/design/circle-chair?_shoot=1&stylePreset=ming-plain`
- `/design/circle-chair?_shoot=1&stylePreset=huanghuali-slim`
- `/design/circle-chair?_shoot=1&stylePreset=jichimu-stout`
Expected: 三張 3D 截圖看得出截面粗細差異（細秀款最瘦、壯實款最粗），整體比例不變

- [ ] **Step 6: Commit**

```bash
git add lib/templates/circle-chair.ts
git commit -m "feat(circle-chair): 3 風格 preset + 教材選項 wiring + validators 收尾"
```

---

## Task 10: SOP step 3 — gen-style-pack

**Files:**
- Modify: `lib/knowledge/style-detail-packs.ts`

**前置：** 需 `ANTHROPIC_API_KEY`（local `.env.local`）。memory `project_anthropic_billing`：使用者 API credit 常空——若 `gen-style-pack` 因 credit 失敗，**此 task 標記 blocked、跳過，不擋 Phase 1 其他驗收**（base style coverage SOP step 2 是自動的，少 detail pack 只是 8 風格細部差異較小，不影響結構正確性）。

- [ ] **Step 1: 跑 gen-style-pack**

Run: `npm run gen-style-pack circle-chair`
Expected: 產出 `/tmp/style-pack-circle-chair.json` + 印出建議 merge 的 diff。若報 API credit 錯誤 → 標記此 task blocked、跳到 Task 11

- [ ] **Step 2: 人工審改 + merge**

把 JSON 段 paste 進 `lib/knowledge/style-detail-packs.ts`（每個 style 物件下加 `"circle-chair": {...}` 格），審一遍 key 是否合理（對應 `circleChairOptions` 的 key）

- [ ] **Step 3: type check + pack-keys audit**

Run: `npx tsc --noEmit && npx tsx scripts/audit-pack-keys.ts`
Expected: 無錯誤、無 dead key（pack 裡的 key 都存在於 `circleChairOptions`）

- [ ] **Step 4: Commit**

```bash
git add lib/knowledge/style-detail-packs.ts
git commit -m "feat(circle-chair): style detail packs (SOP step 3)"
```

---

## Task 11: 全套 audit + playwright 終驗 + Phase 1 收尾

**Files:** 無（純驗證）

- [ ] **Step 1: 全套 audit**

Run: `npm run audit`
Expected: 5 個 audit（overlaps / joints / joinery-dims / pack-keys / dead-checkboxes）全 exit 0，`circle-chair` 無 NEW failure

- [ ] **Step 2: type check** — Run: `npx tsc --noEmit` — Expected: 無錯誤

- [ ] **Step 3: playwright 完整截圖驗證**

dev server 開，截以下並肉眼確認：
- `/design/circle-chair?_shoot=1` — 預設：3D + 三視圖（正/側/俯）
- 三視圖俯視：看得到馬蹄形椅圈 + 座框
- 三視圖側視：看得到步步高管腳棖階梯 + 靠背板後傾 + 鵝脖前彎
- 材料單：34 件、分組顯示、椅圈列 5 段
- 改尺寸 `?length=680&width=540&height=780` — 確認等比縮放、不破圖

- [ ] **Step 4: 確認 Phase 1 驗收標準（spec §5 P1 交付物）**

逐項打勾：
- [ ] 18 種零件 / 34 件全到位
- [ ] 結構正確（座框 + 4 腿 + 步步高棖 + 椅圈 + S 曲線件 + 角牙）
- [ ] 可調基本尺寸（座寬/座深/椅圈高/座面高）
- [ ] 三視圖 + 3D 出圖
- [ ] 材料單列滿 34 件含 5 段椅圈
- [ ] `npm run audit` 全綠
- [ ] SOP 4 步走完（Task 1-3 註冊、Task 2 自動 base style、Task 10 detail pack、圈椅非櫃桌不需 windsor null）

- [ ] **Step 5: 最終 commit（若 Step 3 微調過幾何）**

```bash
git add lib/templates/circle-chair.ts
git commit -m "fix(circle-chair): Phase 1 幾何微調收尾（playwright 驗證後）"
```

- [ ] **Step 6: 更新 memory + spec 狀態**

- 更新 `memory/project_wrd_circle_chair.md`：Phase 1 完成、HEAD commit、待 Phase 2 plan
- 更新 `MEMORY.md` 對應索引行

---

## Self-Review 註記

**Spec coverage（對 spec §5 P1 交付物）：** 18 種零件 → Task 3-8 全涵蓋；可調尺寸 → Task 2；三視圖+3D → 既有 render pipeline 自動涵蓋（新 category 進 catalog 即可）；材料單 34 件 → Task 8 Step 5 驗；audit 0 → 每 task Step 4；SOP 4 步 → Task 1/10。preset + 教材選項（spec §8）→ Task 2 + Task 9。

**已知簡化（P1 刻意，spec §5 已載明）：** 椅圈是 `arch-bent` 多邊近似非真連續曲線；S 曲線件用現有 shape 湊；榫卯只有資料結構不渲染細節圖（P4）；角牙是 box 佔位（終態 face-rounded）。這些是 Phase 1 範圍內的刻意近似，P2/P3/P4 各自的 plan 處理。

**幾何值待調：** 所有 origin / bendMm / rotation 是起始值，Task 6（椅圈擺位）最需要 playwright 反覆微調——這是 furniture template 工作的常態（memory `feedback_self_iterate`）。

**型別一致性：** sub-function 全部回傳 `Part[]`、builder `parts.push(...)`；`buildSeatFrame`/`buildLegs`/`buildStretchers`/`buildArmRail`/`buildSCurveMembers`/`buildCornerBraces` 命名一致；`material` 型別用 `import("@/lib/types").MaterialId`。
