# 1:1 實尺樣板列印 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者在設計頁按一個鈕,下載一包 1:1 實尺樣板 PDF,列印後貼在木料上照著描輪廓、點榫孔中心。

**Architecture:** 完全複用 CNC 匯出管線的幾何(`partMachiningFaces` 給輪廓 + 榫孔 + 公榫,同一個 mm 座標框)。新增三層純函式:選紙與旋轉擺放(`fit.ts`)、選面(`face.ts`)、樣板 SVG 字串產生器(`sheet.ts`)。再用 `jsPDF` + `svg2pdf.js` 把 SVG 字串轉成精準紙張尺寸的 PDF,中文字型由 `/api/pdf-font` 即時子集化後嵌入,最後用既有的 `zipStore` 依紙張分檔打包。

**Tech Stack:** TypeScript / Next.js(App Router)/ vitest / jsPDF 4.x / svg2pdf.js 2.x / subset-font / Noto Sans TC(SIL OFL)

**Spec:** `docs/superpowers/specs/2026-08-19-print-pack-design.md`(第三版)

## Global Constraints

這些是全案通用規則,每個 task 的要求都隱含包含本節。數值一律照抄,不要自行調整。

- **紙張表**(mm,長邊 × 短邊):A4 297×210 / A3 420×297 / B3 500×353 / A2 594×420 / A1 841×594 / A0 1189×841
- **每邊留白 5mm**。可用區 = `paper.w - 10` × `paper.h - 10`
- **兩段式紙張上限**:面板類(`categorizePart` 回 `case` / `divider` / `seat` / `door`)上限 **A2**;其餘(`leg` / `apron` / `drawer` / `misc`)上限 **A0**
- **塞不下不拼接**,回 `null`,由呼叫端歸類為「退回既有比例零件圖」
- **`font-weight` 只能是 400 或 700**。`svg2pdf` 遇到 500 / 600 會靜默改用 Helvetica,中文變亂碼且不報錯
- **隱藏容器必須用 `position:absolute; left:-99999px`**,絕不可用 `display:none` —— `svg2pdf` 依賴 `getBBox()`,元素未參與版面時回傳 0
- **輪廓 stroke 寬 0.3mm**。`parts-svg.ts` 的 `CUT_STROKE_MM = 0.1` 是雷切 hairline 慣例,列印看不清楚,樣板不沿用
- **不得修改** `app/[locale]/design/[type]/print/` 與 `lib/render/part-drawing/` 的版面(唯一例外是 Task 4 的字重正規化)
- API route 一律 `export const runtime = "nodejs"`(專案慣例)
- 測試指令:`npx vitest run <path>`(package.json 沒有 `test` script)
- vitest 只收 `**/*.test.ts`,**不收 `.test.tsx`**。測試檔一律 `.test.ts`
- 註解沿用專案慣例寫繁體中文
- 路徑別名 `@/` → 專案根目錄

---

### Task 1: 紙張表與旋轉擺放演算法

**Files:**
- Create: `lib/export/template-pack/paper.ts`
- Create: `lib/export/template-pack/fit.ts`
- Test: `lib/export/template-pack/fit.test.ts`

**Interfaces:**
- Consumes: `PartCategory` from `@/lib/render/categorize-part`
- Produces:
  - `PAPERS: readonly PaperSpec[]`
  - `interface PaperSpec { id: string; label: string; w: number; h: number }`
  - `interface Placement { paper: PaperSpec; angleDeg: number; swapped: boolean }`
  - `ladderFor(category: PartCategory): PaperSpec[]`
  - `placeOnLadder(w: number, h: number, ladder: PaperSpec[]): Placement | null`

- [ ] **Step 1: 寫紙張表**

`lib/export/template-pack/paper.ts`:

```ts
// 1:1 樣板用紙張表。尺寸為 mm，一律「長邊 × 短邊」。
import type { PartCategory } from "@/lib/render/categorize-part";

export interface PaperSpec {
  id: string;
  label: string;
  /** 長邊 mm */
  w: number;
  /** 短邊 mm */
  h: number;
}

export const PAPERS: readonly PaperSpec[] = [
  { id: "A4", label: "A4", w: 297, h: 210 },
  { id: "A3", label: "A3", w: 420, h: 297 },
  { id: "B3", label: "B3", w: 500, h: 353 },
  { id: "A2", label: "A2", w: 594, h: 420 },
  { id: "A1", label: "A1", w: 841, h: 594 },
  { id: "A0", label: "A0", w: 1189, h: 841 },
] as const;

/** 每邊留白 mm。 */
export const SHEET_MARGIN_MM = 5;

/** 面板類（categorizePart 回這幾種）紙張上限 A2；其餘 A0。 */
const PANEL_CATEGORIES: ReadonlySet<PartCategory> = new Set<PartCategory>([
  "case",
  "divider",
  "seat",
  "door",
]);

export function isPanelCategory(category: PartCategory): boolean {
  return PANEL_CATEGORIES.has(category);
}

/**
 * 依零件分類回傳可用的紙張階梯。
 * 面板類截到 A2 —— B3 短邊只有 353mm，方凳座板 350×350、餐椅椅面 420×400
 * 都卡在短邊過不了，斜擺救不了正方形（spec §5.1）。
 */
export function ladderFor(category: PartCategory): PaperSpec[] {
  const cap = isPanelCategory(category) ? "A2" : "A0";
  const out: PaperSpec[] = [];
  for (const p of PAPERS) {
    out.push(p);
    if (p.id === cap) break;
  }
  return out;
}
```

- [ ] **Step 2: 寫失敗的測試**

`lib/export/template-pack/fit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ladderFor } from "./paper";
import { placeOnLadder } from "./fit";

describe("ladderFor", () => {
  it("面板類截到 A2", () => {
    expect(ladderFor("seat").map((p) => p.id)).toEqual(["A4", "A3", "B3", "A2"]);
  });
  it("非面板類開到 A0", () => {
    expect(ladderFor("leg").map((p) => p.id)).toEqual([
      "A4", "A3", "B3", "A2", "A1", "A0",
    ]);
  });
});

describe("placeOnLadder", () => {
  it("方凳牙條 280×60 水平擺進 A4", () => {
    const r = placeOnLadder(280, 60, ladderFor("apron"));
    expect(r?.paper.id).toBe("A4");
    expect(r?.angleDeg).toBe(0);
  });

  it("方凳凳腳 425×35 在 A3 上必須斜擺才進得去", () => {
    const r = placeOnLadder(425, 35, ladderFor("leg"));
    expect(r?.paper.id).toBe("A3");
    expect(r?.angleDeg).toBeGreaterThan(0);
    expect(r?.angleDeg).toBeLessThanOrEqual(30);
  });

  it("方凳座板 350×350 落在 A2（B3 短邊 353 扣留白後不夠）", () => {
    const r = placeOnLadder(350, 350, ladderFor("seat"));
    expect(r?.paper.id).toBe("A2");
  });

  it("餐椅椅面 420×400 落在 A2", () => {
    expect(placeOnLadder(420, 400, ladderFor("seat"))?.paper.id).toBe("A2");
  });

  it("書桌桌面板 1200×600 超過面板上限 → null", () => {
    expect(placeOnLadder(1200, 600, ladderFor("case"))).toBeNull();
  });

  it("邊桌桌面板 450×450 超過 A2 短邊 → null", () => {
    expect(placeOnLadder(450, 450, ladderFor("seat"))).toBeNull();
  });

  it("餐椅曲線後腿 900×120 斜擺留在 A1，不用上 A0", () => {
    const r = placeOnLadder(900, 120, ladderFor("leg"));
    expect(r?.paper.id).toBe("A1");
  });

  it("邊界：剛好等於可用區時算塞得下", () => {
    // A4 可用區 287×200
    expect(placeOnLadder(287, 200, ladderFor("misc"))?.paper.id).toBe("A4");
  });

  it("邊界：超過 0.5mm 就要換紙", () => {
    expect(placeOnLadder(287.5, 200, ladderFor("misc"))?.paper.id).toBe("A3");
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run lib/export/template-pack/fit.test.ts`
Expected: FAIL —— `Failed to resolve import "./fit"`

- [ ] **Step 4: 寫實作**

`lib/export/template-pack/fit.ts`:

```ts
// 1:1 樣板的選紙與擺放。允許把零件轉角度（含斜擺）以塞進較小的紙。
import { PAPERS, SHEET_MARGIN_MM, type PaperSpec } from "./paper";

export interface Placement {
  paper: PaperSpec;
  /** 內容要旋轉的角度（度，0 = 水平擺）。 */
  angleDeg: number;
  /** true = 紙張直放（短邊在下），false = 橫放。 */
  swapped: boolean;
}

/** 掃描步進（度）。1° 已足夠，再細沒有實際效益。 */
const ANGLE_STEP = 1;

/**
 * 找出零件 w×h 在單張紙上塞得下的最小角度。
 * 判定用旋轉後的軸對齊外框：
 *   bw = w·cosθ + h·sinθ
 *   bh = w·sinθ + h·cosθ
 * 紙張直放橫放都試（swapped）。
 */
function placeOnPaper(w: number, h: number, paper: PaperSpec): Placement | null {
  const W = paper.w - SHEET_MARGIN_MM * 2;
  const H = paper.h - SHEET_MARGIN_MM * 2;
  // 浮點容差：287 = 287 這種剛好相等的情況要算塞得下
  const EPS = 1e-6;
  for (let deg = 0; deg <= 90; deg += ANGLE_STEP) {
    const t = (deg * Math.PI) / 180;
    const bw = w * Math.cos(t) + h * Math.sin(t);
    const bh = w * Math.sin(t) + h * Math.cos(t);
    if (bw <= W + EPS && bh <= H + EPS) return { paper, angleDeg: deg, swapped: false };
    if (bw <= H + EPS && bh <= W + EPS) return { paper, angleDeg: deg, swapped: true };
  }
  return null;
}

/**
 * 沿紙張階梯由小到大找第一個塞得下的擺法。
 * 整條階梯都塞不下回 null —— 呼叫端據此把該零件歸類為「退回比例零件圖」。
 */
export function placeOnLadder(
  w: number,
  h: number,
  ladder: readonly PaperSpec[] = PAPERS,
): Placement | null {
  for (const paper of ladder) {
    const hit = placeOnPaper(w, h, paper);
    if (hit) return hit;
  }
  return null;
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run lib/export/template-pack/fit.test.ts`
Expected: PASS（11 個 test 全過）

- [ ] **Step 6: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 0 個新錯誤

- [ ] **Step 7: Commit**

```bash
git add lib/export/template-pack/paper.ts lib/export/template-pack/fit.ts lib/export/template-pack/fit.test.ts
git commit -m "feat(樣板): 紙張表與旋轉擺放演算法

面板類上限 A2、其餘 A0，每邊留白 5mm。掃 0-90 度找第一個塞得下的角度，
紙張直放橫放都試。凳腳 425x35 在 A3 水平擺不下，斜擺才進得去。"
```

---

### Task 2: 選面 —— 決定攤平哪一面

**Files:**
- Create: `lib/export/template-pack/face.ts`
- Test: `lib/export/template-pack/face.test.ts`

**Interfaces:**
- Consumes: `partMachiningFaces`、`MachiningFace`、`DerivedMortise` from `@/lib/export/mortise-faces`;`partFlatOutline` from `@/lib/export/parts-svg`;`Part` from `@/lib/types`
- Produces: `pickTemplateFace(part: Part, derived?: DerivedMortise[]): MachiningFace`

**背景:** `partMachiningFaces()` 回傳該零件所有加工面,每個面都帶 `outline` / `holes` / `tenons` / `w` / `h`,而且已歸一化到同一個 SVG mm 框(左上原點、Y 向下)。樣板要的就是**面積最大的那一面**——那是零件攤平躺在工作台上的樣子。零件完全沒有榫卯時 `partMachiningFaces` 可能回空陣列,要退回 `partFlatOutline`。

- [ ] **Step 1: 寫失敗的測試**

`lib/export/template-pack/face.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Part } from "@/lib/types";
import { pickTemplateFace } from "./face";

/** 最小可用零件：400×80×20 的橫撐，兩端各一個公榫。 */
function makePart(over: Partial<Part> = {}): Part {
  return {
    id: "apron-front",
    nameZh: "牙條",
    material: "pine",
    grainDirection: "length",
    visible: { length: 400, width: 80, thickness: 20 },
    tenons: [],
    mortises: [],
    ...over,
  } as Part;
}

describe("pickTemplateFace", () => {
  it("挑出面積最大的面（400×80 那面，不是 400×20 或 80×20）", () => {
    const face = pickTemplateFace(makePart());
    const long = Math.max(face.w, face.h);
    const short = Math.min(face.w, face.h);
    expect(long).toBeCloseTo(400, 0);
    expect(short).toBeCloseTo(80, 0);
  });

  it("完全沒有榫卯的零件也要回一個可用的面", () => {
    const face = pickTemplateFace(makePart({ tenons: [], mortises: [] }));
    expect(face.outline.length).toBeGreaterThanOrEqual(3);
    expect(face.w).toBeGreaterThan(0);
    expect(face.h).toBeGreaterThan(0);
  });

  it("有母榫時，孔位要跟著回傳", () => {
    const part = makePart({
      mortises: [
        { origin: { x: 20, y: 0, z: 30 }, depth: 15, length: 40, width: 10, through: false },
      ],
    });
    const face = pickTemplateFace(part);
    expect(face.holes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run lib/export/template-pack/face.test.ts`
Expected: FAIL —— `Failed to resolve import "./face"`

- [ ] **Step 3: 寫實作**

`lib/export/template-pack/face.ts`:

```ts
// 選出零件要拿來當樣板的那一面 —— 攤平躺在工作台上、面積最大的那面。
import type { Part } from "@/lib/types";
import { partMachiningFaces, type MachiningFace, type DerivedMortise } from "@/lib/export/mortise-faces";
import { partFlatOutline } from "@/lib/export/parts-svg";

/**
 * 面積最大的加工面 = 攤平面。
 * 零件沒有任何榫卯時 partMachiningFaces 可能回空陣列，
 * 此時退回 partFlatOutline（純外形），包成同樣的 MachiningFace 形狀，
 * 讓下游 sheet.ts 只要處理一種型別。
 */
export function pickTemplateFace(part: Part, derived: DerivedMortise[] = []): MachiningFace {
  const faces = partMachiningFaces(part, derived);
  let best: MachiningFace | null = null;
  for (const f of faces) {
    if (!best || f.w * f.h > best.w * best.h) best = f;
  }
  if (best) return best;

  const flat = partFlatOutline(part);
  return {
    faceKey: "flat",
    faceLabelZh: "攤平面",
    outline: flat.pts,
    holes: [],
    tenons: [],
    w: flat.w,
    h: flat.h,
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run lib/export/template-pack/face.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/export/template-pack/face.ts lib/export/template-pack/face.test.ts
git commit -m "feat(樣板): 選面 — 取面積最大的加工面，無榫卯時退回純外形"
```

---

### Task 3: 樣板 SVG 字串產生器

**Files:**
- Create: `lib/export/template-pack/sheet.ts`
- Test: `lib/export/template-pack/sheet.test.ts`

**Interfaces:**
- Consumes: `MachiningFace`(Task 2)、`Placement` / `PaperSpec`(Task 1)
- Produces:
  - `interface TemplateSheetInput { face: MachiningFace; placement: Placement; partNo: string; nameZh: string; qty: number }`
  - `templateSheetSvg(input: TemplateSheetInput): string`
  - `PROOF_RULER_MM = 100`

**樣板內容(spec §2):** 輪廓 + 榫孔 / 公榫 + 部件名稱寫在輪廓內 + 100mm 證明尺。**沒有**尺寸標註、三視圖、標題欄。

- [ ] **Step 1: 寫失敗的測試**

`lib/export/template-pack/sheet.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { MachiningFace } from "@/lib/export/mortise-faces";
import { templateSheetSvg, PROOF_RULER_MM } from "./sheet";
import { PAPERS } from "./paper";

const A3 = PAPERS.find((p) => p.id === "A3")!;

const face: MachiningFace = {
  faceKey: "flat",
  faceLabelZh: "攤平面",
  outline: [
    { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 80 }, { x: 0, y: 80 },
  ],
  holes: [
    { kind: "rect", pts: [{ x: 20, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 40 }, { x: 20, y: 40 }], through: false, label: "榫眼" },
    { kind: "circle", cx: 300, cy: 40, r: 4, through: true, label: "螺絲孔" },
  ],
  tenons: [],
  w: 400,
  h: 80,
};

const base = {
  face,
  placement: { paper: A3, angleDeg: 0, swapped: false },
  partNo: "P-02",
  nameZh: "牙條",
  qty: 4,
};

describe("templateSheetSvg", () => {
  it("viewBox 就是紙張尺寸（mm）", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain('viewBox="0 0 420 297"');
  });

  it("紙張直放時 viewBox 長短邊對調", () => {
    const svg = templateSheetSvg({ ...base, placement: { paper: A3, angleDeg: 0, swapped: true } });
    expect(svg).toContain('viewBox="0 0 297 420"');
  });

  it("畫出輪廓、方榫孔與圓孔", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain("<path");
    expect(svg).toContain("<circle");
  });

  it("輪廓線寬 0.3mm（列印看得見，不是雷切的 0.1）", () => {
    expect(templateSheetSvg(base)).toContain('stroke-width="0.3"');
  });

  it("含 100mm 證明尺與標示", () => {
    const svg = templateSheetSvg(base);
    expect(PROOF_RULER_MM).toBe(100);
    expect(svg).toContain("100mm");
  });

  it("部件名稱與件號有出現", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain("牙條");
    expect(svg).toContain("P-02");
    expect(svg).toContain("×4");
  });

  it("絕不輸出 font-weight 500 或 600（svg2pdf 會讓中文變亂碼）", () => {
    const svg = templateSheetSvg(base);
    expect(svg).not.toMatch(/font-weight="(500|600)"/);
  });

  it("斜擺時輸出 rotate transform", () => {
    const svg = templateSheetSvg({ ...base, placement: { paper: A3, angleDeg: 21, swapped: false } });
    expect(svg).toContain("rotate(21");
  });

  it("圓孔要有中心十字，方便點中心", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain('data-mark="center-cross"');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run lib/export/template-pack/sheet.test.ts`
Expected: FAIL —— `Failed to resolve import "./sheet"`

- [ ] **Step 3: 寫實作**

`lib/export/template-pack/sheet.ts`:

```ts
// 一個零件 → 一張 1:1 樣板 SVG（字串）。viewBox 單位 = mm = 紙面座標。
// 內容只有：輪廓、榫孔／公榫、部件名稱、100mm 證明尺。沒有尺寸標註、沒有三視圖。
import type { MachiningFace, FaceHole } from "@/lib/export/mortise-faces";
import { outlinePathD } from "@/lib/export/parts-svg";
import type { Placement } from "./fit";

/** 輪廓線寬 mm。比 CNC 的 0.1mm hairline 粗，列印才看得見。 */
const STROKE_MM = 0.3;
/** 證明尺長度 mm。 */
export const PROOF_RULER_MM = 100;
/** 名稱要塞進輪廓內所需的最小可用寬度 mm；不足就改放輪廓外。 */
const LABEL_MIN_WIDTH_MM = 12;

export interface TemplateSheetInput {
  face: MachiningFace;
  placement: Placement;
  partNo: string;
  nameZh: string;
  qty: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function holeMarkup(h: FaceHole): string {
  const t = `<title>${esc(h.label + (h.through ? "（通）" : "（盲）"))}</title>`;
  if (h.kind === "circle" && h.cx != null && h.cy != null && h.r != null) {
    const cross = Math.max(h.r * 0.8, 1.5);
    return [
      `<circle cx="${r2(h.cx)}" cy="${r2(h.cy)}" r="${r2(h.r)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}">${t}</circle>`,
      `<g data-mark="center-cross" stroke="#000" stroke-width="${STROKE_MM / 2}">`,
      `<line x1="${r2(h.cx - cross)}" y1="${r2(h.cy)}" x2="${r2(h.cx + cross)}" y2="${r2(h.cy)}"/>`,
      `<line x1="${r2(h.cx)}" y1="${r2(h.cy - cross)}" x2="${r2(h.cx)}" y2="${r2(h.cy + cross)}"/>`,
      `</g>`,
    ].join("");
  }
  if (!h.pts) return "";
  const cx = h.pts.reduce((s, p) => s + p.x, 0) / h.pts.length;
  const cy = h.pts.reduce((s, p) => s + p.y, 0) / h.pts.length;
  return [
    `<path d="${outlinePathD(h.pts)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}">${t}</path>`,
    `<g data-mark="center-cross" stroke="#000" stroke-width="${STROKE_MM / 2}">`,
    `<line x1="${r2(cx - 2)}" y1="${r2(cy)}" x2="${r2(cx + 2)}" y2="${r2(cy)}"/>`,
    `<line x1="${r2(cx)}" y1="${r2(cy - 2)}" x2="${r2(cx)}" y2="${r2(cy + 2)}"/>`,
    `</g>`,
  ].join("");
}

export function templateSheetSvg(input: TemplateSheetInput): string {
  const { face, placement, partNo, nameZh, qty } = input;
  const { paper, angleDeg, swapped } = placement;
  const pageW = swapped ? paper.h : paper.w;
  const pageH = swapped ? paper.w : paper.h;

  // 旋轉後外框，用來把內容置中。
  //
  // SVG rotate(θ) 以原點為軸、y 軸向下，(x,y) → (x·cosθ − y·sinθ, x·sinθ + y·cosθ)。
  // face 佔 [0,w]×[0,h]，四角轉完後：
  //   min x = −h·sinθ   max x = w·cosθ      → bw = w·cosθ + h·sinθ
  //   min y = 0          max y = w·sinθ + h·cosθ → bh = w·sinθ + h·cosθ
  // 也就是旋轉後 bbox 的左上角落在 (−h·sinθ, 0)，所以要把它平移回 (offX, offY)
  // 就得多補 +h·sinθ。transform 順序 translate ∘ rotate＝先轉再移。
  const t = (angleDeg * Math.PI) / 180;
  const bw = face.w * Math.cos(t) + face.h * Math.sin(t);
  const bh = face.w * Math.sin(t) + face.h * Math.cos(t);
  const offX = (pageW - bw) / 2;
  const offY = (pageH - bh) / 2;
  const tx = offX + face.h * Math.sin(t);
  const ty = offY;
  const transform = `translate(${r2(tx)} ${r2(ty)}) rotate(${r2(angleDeg)})`;

  const geometry = [
    `<path d="${outlinePathD(face.outline)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}"/>`,
    ...(face.tenons ?? []).map(
      (tn) =>
        `<path d="${outlinePathD(tn.pts)}" fill="none" stroke="#000" stroke-width="${STROKE_MM}"><title>${esc(tn.label + "（公榫）")}</title></path>`,
    ),
    ...face.holes.map(holeMarkup),
  ].join("\n    ");

  // 名稱：輪廓夠寬就放輪廓中央，太窄就放正上方 3mm
  const inside = face.h >= LABEL_MIN_WIDTH_MM;
  const labelY = inside ? face.h / 2 + 2 : -3;
  const labelText = `${partNo} ${nameZh}${qty > 1 ? ` ×${qty}` : ""}`;
  const label =
    `<text x="${r2(face.w / 2)}" y="${r2(labelY)}" font-family="PackCJK" font-size="6" font-weight="700"` +
    ` fill="#000" text-anchor="middle">${esc(labelText)}</text>`;

  // 100mm 證明尺，固定畫在紙面左下角，不隨內容旋轉
  const rx = 10;
  const ry = pageH - 10;
  const ruler = [
    `<g data-mark="proof-ruler" stroke="#000" stroke-width="${STROKE_MM}" fill="none">`,
    `<line x1="${rx}" y1="${ry}" x2="${rx + PROOF_RULER_MM}" y2="${ry}"/>`,
    `<line x1="${rx}" y1="${ry - 2.5}" x2="${rx}" y2="${ry + 2.5}"/>`,
    `<line x1="${rx + PROOF_RULER_MM}" y1="${ry - 2.5}" x2="${rx + PROOF_RULER_MM}" y2="${ry + 2.5}"/>`,
    `</g>`,
    `<text x="${rx + PROOF_RULER_MM / 2}" y="${r2(ry - 4)}" font-family="PackCJK" font-size="4"`,
    ` font-weight="400" fill="#000" text-anchor="middle">此線實長 100mm — 列印請選「實際大小」</text>`,
  ].join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">`,
    `  <g transform="${transform}">`,
    `    ${geometry}`,
    `    ${label}`,
    `  </g>`,
    `  ${ruler}`,
    `</svg>`,
    "",
  ].join("\n");
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run lib/export/template-pack/sheet.test.ts`
Expected: PASS（9 個 test 全過）

- [ ] **Step 5: 目視驗證旋轉是否真的置中**

寫一次性腳本 `/tmp/preview-sheet.cjs`,用 Playwright 把三張樣板(0°、21°、直放)存成 PNG 看:

```js
const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const svgs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
  for (const [name, svg] of Object.entries(svgs)) {
    await p.setContent('<style>body{margin:0;background:#fff}svg{width:1400px;height:auto}</style>' + svg);
    await p.screenshot({ path: `/tmp/sheet-${name}.png`, fullPage: true });
  }
  await b.close();
})();
```

檢查:輪廓完整落在紙內、沒有被裁掉、證明尺在左下角、名稱看得到。
若旋轉後內容跑出紙外,修 `transform` 的 `innerDx` 推導後重跑本步驟。

- [ ] **Step 6: Commit**

```bash
git add lib/export/template-pack/sheet.ts lib/export/template-pack/sheet.test.ts
git commit -m "feat(樣板): 樣板 SVG 產生器 — 輪廓+榫孔+中心十字+名稱+100mm 證明尺

線寬 0.3mm（雷切的 0.1mm 列印看不見）。字重只用 400/700，
避免 svg2pdf 遇到中間值靜默改用 Helvetica 讓中文變亂碼。"
```

---

### Task 4: 字重正規化(防中文亂碼)

**Files:**
- Modify: `lib/render/part-drawing/annotation.tsx`(6 處)
- Modify: `lib/render/part-drawing/paper-sheet.tsx:234`
- Modify: `lib/render/svg-views.tsx:1630`
- Test: `lib/export/template-pack/font-weight.test.ts`

**背景:** 這是全案唯一允許動到既有零件圖的地方。實測證實 `font-weight="600"` 會讓標題欄的「凳腳 1」變成 `Qó•s`、「松木」變成 `g~g(`。退回零件圖的那條路會經過這些版面,所以必須修。改 600 → 700 只是字重變粗一階,不動任何座標。

- [ ] **Step 1: 寫失敗的測試**

`lib/export/template-pack/font-weight.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** 會被轉成 PDF 的 SVG 來源目錄。 */
const SCANNED = ["lib/render", "components/print", "lib/export/template-pack"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("PDF 字重限制", () => {
  it("不得出現 400/700 以外的 font-weight", () => {
    const offenders: string[] = [];
    for (const root of SCANNED) {
      for (const file of walk(root)) {
        const src = readFileSync(file, "utf8");
        src.split("\n").forEach((line, i) => {
          if (/fontWeight=\{(?!400|700)\d+\}|font-weight="(?!400|700)\d+"/.test(line)) {
            offenders.push(`${file}:${i + 1}`);
          }
        });
      }
    }
    // svg2pdf 只認 400/700，中間值會靜默改用 Helvetica → 中文變亂碼且不報錯
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run lib/export/template-pack/font-weight.test.ts`
Expected: FAIL —— 列出 8 個位置(annotation.tsx ×6、paper-sheet.tsx ×1、svg-views.tsx ×1)

- [ ] **Step 3: 全部改成 700**

```bash
sed -i 's/fontWeight={600}/fontWeight={700}/g' lib/render/part-drawing/annotation.tsx lib/render/part-drawing/paper-sheet.tsx lib/render/svg-views.tsx
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run lib/export/template-pack/font-weight.test.ts`
Expected: PASS

- [ ] **Step 5: 確認零件圖沒被改壞**

Run: `npm run dev`,開 `http://localhost:3000/design/stool`,點開 P-01 零件圖。
Expected: 標題欄六格文字都在、字略粗一階、**座標與版面完全沒有位移**。
截圖存證後再 commit。

- [ ] **Step 6: Commit**

```bash
git add lib/render/part-drawing/annotation.tsx lib/render/part-drawing/paper-sheet.tsx lib/render/svg-views.tsx lib/export/template-pack/font-weight.test.ts
git commit -m "fix(製圖): 字重 600 改 700，避免轉 PDF 時中文變亂碼

svg2pdf 只認 font-weight 400/700，中間值會靜默掉回 Helvetica。
實測：600 的標題欄「凳腳 1」輸出成 Qó•s、「松木」輸出成 g~g(。
只改字重不動座標，加測試防迴歸。"
```

---

### Task 5: 中文字型子集 API

**Files:**
- Create: `app/api/pdf-font/route.ts`
- Create: `lib/fonts/NotoSansTC-Regular.ttf`(下載,不進 git-lfs,直接放)
- Modify: `next.config.ts`(`outputFileTracingIncludes` 加一筆)
- Test: `app/api/pdf-font/route.test.ts`

**Interfaces:**
- Produces: `POST /api/pdf-font`,body `{ chars: string }`,回 `application/octet-stream`(子集 TTF)

**背景:** 實測標楷體 5,060KB 子集化後 70KB。全字庫留伺服器端,前端只拿子集。`next.config.ts` 已有現成前例:`/api/cnc-tool` 用 `outputFileTracingIncludes` 帶上 1MB 的 HTML。

- [ ] **Step 1: 裝依賴並取得字型**

```bash
npm i jspdf svg2pdf.js subset-font
mkdir -p lib/fonts
curl -L -o lib/fonts/NotoSansTC-Regular.ttf \
  "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf"
```

注意:`subset-font` 的 `targetFormat: "truetype"` 可吃 OTF 輸入。若上述 URL 失效,到
`https://fonts.google.com/noto/specimen/Noto+Sans+TC` 下載 Regular 靜態檔。授權為 SIL OFL,可散布。

- [ ] **Step 2: 寫失敗的測試**

`app/api/pdf-font/route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/pdf-font", () => {
  it("回傳子集 TTF，且明顯小於全字庫", async () => {
    const req = new Request("http://localhost/api/pdf-font", {
      method: "POST",
      body: JSON.stringify({ chars: "凳腳牙條座板松木榫眼P-01×4" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(buf.byteLength).toBeLessThan(500_000);
  });

  it("chars 空字串回 400", async () => {
    const req = new Request("http://localhost/api/pdf-font", {
      method: "POST",
      body: JSON.stringify({ chars: "" }),
    });
    expect((await POST(req)).status).toBe(400);
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run app/api/pdf-font/route.test.ts`
Expected: FAIL —— 找不到 `./route`

- [ ] **Step 4: 寫實作**

`app/api/pdf-font/route.ts`:

```ts
// 依「本次實際要渲染的字元」即時子集化中文字型，供前端嵌進 PDF。
// 全字庫只留伺服器端；實測 5,060KB 的字型子集後約 70KB。
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import subsetFont from "subset-font";

export const runtime = "nodejs";

const FONT_PATH = join(process.cwd(), "lib/fonts/NotoSansTC-Regular.ttf");
/** 一律附帶的基本字元，省得每次都要前端帶。 */
const ALWAYS = "0123456789.,-×:()／mm";

export async function POST(req: Request) {
  let chars = "";
  try {
    const body = (await req.json()) as { chars?: string };
    chars = body.chars ?? "";
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!chars.trim()) return new Response("chars required", { status: 400 });

  const wanted = Array.from(new Set((chars + ALWAYS).split(""))).sort().join("");
  const etag = createHash("sha1").update(wanted).digest("hex");

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  const full = await readFile(FONT_PATH);
  const sub = await subsetFont(full, wanted, { targetFormat: "truetype" });

  return new Response(new Uint8Array(sub), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      ETag: etag,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
```

- [ ] **Step 5: 讓部署帶上字型檔**

`next.config.ts` 的 `outputFileTracingIncludes` 加一筆(照 `/api/cnc-tool` 的寫法):

```ts
  outputFileTracingIncludes: {
    "/api/wood-master": ["./lib/wood-master/knowledge/**/*.md"],
    "/api/cnc-tool": ["./lib/cnc/cnc-tool.html"],
    // 字型全字庫只在伺服器端用（子集化），Vercel 預設不會 trace 到，明確列出。
    "/api/pdf-font": ["./lib/fonts/*.ttf"],
  },
```

- [ ] **Step 6: 跑測試確認通過**

Run: `npx vitest run app/api/pdf-font/route.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/pdf-font lib/fonts next.config.ts package.json package-lock.json
git commit -m "feat(樣板): 中文字型即時子集 API

全字庫留伺服器端，前端只拿本次用到的字元子集（實測 5060KB → 70KB）。
以字元集合 hash 當 ETag 長效快取。字型檔靠 outputFileTracingIncludes
帶上部署，照 /api/cnc-tool 既有前例。"
```

---

### Task 6: SVG → PDF 轉換管線

**Files:**
- Create: `lib/export/template-pack/pdf.ts`
- Test: `lib/export/template-pack/pdf.test.ts`(只測純函式部分)

**Interfaces:**
- Consumes: `templateSheetSvg`(Task 3)、`/api/pdf-font`(Task 5)
- Produces:
  - `collectChars(svgs: string[]): string`
  - `fetchFontSubset(svgs: string[]): Promise<string>`(回 base64 TTF)
  - `svgsToPdf(svgs: string[], pageWmm: number, pageHmm: number, fontB64: string): Promise<Uint8Array>`

- [ ] **Step 1: 寫失敗的測試(純函式)**

`lib/export/template-pack/pdf.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { collectChars } from "./pdf";

describe("collectChars", () => {
  it("抽出所有文字節點的字元，去重", () => {
    const svg = '<svg><text>凳腳</text><text>凳腳 P-01</text></svg>';
    const got = collectChars([svg]);
    expect(got).toContain("凳");
    expect(got).toContain("腳");
    expect(got).toContain("P");
    // 去重：凳只出現一次
    expect(got.split("").filter((c) => c === "凳").length).toBe(1);
  });

  it("不把標籤名稱當成文字", () => {
    expect(collectChars(['<svg><path d="M 0 0"/></svg>'])).not.toContain("d");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run lib/export/template-pack/pdf.test.ts`
Expected: FAIL

- [ ] **Step 3: 寫實作**

`lib/export/template-pack/pdf.ts`:

```ts
// SVG 字串 → PDF。用 jsPDF + svg2pdf.js，紙張尺寸精準到 mm。
// 兩個實測踩過的坑寫在下面，改動前先讀。

/** 從 SVG 字串抽出所有 <text>/<tspan> 的文字內容字元（去重）。 */
export function collectChars(svgs: string[]): string {
  const set = new Set<string>();
  for (const svg of svgs) {
    for (const m of svg.matchAll(/<(?:text|tspan)\b[^>]*>([\s\S]*?)<\/(?:text|tspan)>/g)) {
      for (const ch of m[1].replace(/<[^>]*>/g, "")) set.add(ch);
    }
  }
  return Array.from(set).join("");
}

/** 向伺服器要這批 SVG 用得到的字型子集，回 base64。 */
export async function fetchFontSubset(svgs: string[]): Promise<string> {
  const res = await fetch("/api/pdf-font", {
    method: "POST",
    body: JSON.stringify({ chars: collectChars(svgs) }),
  });
  if (!res.ok) throw new Error(`字型子集失敗：${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

/**
 * 同一種紙張的多張 SVG → 一份多頁 PDF。
 *
 * ⚠️ 隱藏容器必須用 left:-99999px，不可用 display:none ——
 *    svg2pdf 依賴 getBBox()，元素沒有參與版面時回傳 0，整張圖會崩掉。
 * ⚠️ SVG 內的 font-family 必須是 "PackCJK"（sheet.ts 已這樣寫），
 *    否則 svg2pdf 會去找 helvetica，中文變亂碼。
 */
export async function svgsToPdf(
  svgs: string[],
  pageWmm: number,
  pageHmm: number,
  fontB64: string,
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js");

  const doc = new jsPDF({
    unit: "mm",
    format: [pageWmm, pageHmm],
    orientation: pageWmm >= pageHmm ? "landscape" : "portrait",
  });
  doc.addFileToVFS("PackCJK.ttf", fontB64);
  doc.addFont("PackCJK.ttf", "PackCJK", "normal");
  doc.addFont("PackCJK.ttf", "PackCJK", "bold");
  doc.setFont("PackCJK");

  const box = document.createElement("div");
  box.style.cssText = "position:absolute;left:-99999px;top:0";
  document.body.appendChild(box);
  try {
    for (let i = 0; i < svgs.length; i++) {
      if (i > 0) doc.addPage([pageWmm, pageHmm], pageWmm >= pageHmm ? "landscape" : "portrait");
      box.innerHTML = svgs[i];
      const el = box.querySelector("svg");
      if (!el) throw new Error("SVG 解析失敗");
      await svg2pdf(el, doc, { x: 0, y: 0, width: pageWmm, height: pageHmm });
      // 讓出主執行緒，零件多時 UI 才不會卡死
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    box.remove();
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run lib/export/template-pack/pdf.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/export/template-pack/pdf.ts lib/export/template-pack/pdf.test.ts
git commit -m "feat(樣板): SVG → PDF 管線（jsPDF + svg2pdf）

隱藏容器用 left:-99999px 而非 display:none —— svg2pdf 依賴 getBBox()，
元素不參與版面時回傳 0。每張之間讓出主執行緒避免 UI 卡死。"
```

---

### Task 7: 索引封面與「退回零件圖」清單

**Files:**
- Create: `lib/export/template-pack/index-sheet.ts`
- Test: `lib/export/template-pack/index-sheet.test.ts`

**Interfaces:**
- Consumes: `Placement`(Task 1)
- Produces:
  - `interface PackRow { partNo: string; nameZh: string; qty: number; wmm: number; hmm: number; placement: Placement | null }`
  - `indexSheetSvg(title: string, rows: PackRow[]): string`

- [ ] **Step 1: 寫失敗的測試**

`lib/export/template-pack/index-sheet.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { indexSheetSvg, type PackRow } from "./index-sheet";
import { PAPERS } from "./paper";

const A3 = PAPERS.find((p) => p.id === "A3")!;

const rows: PackRow[] = [
  { partNo: "P-01", nameZh: "凳腳", qty: 4, wmm: 425, hmm: 35,
    placement: { paper: A3, angleDeg: 21, swapped: false } },
  { partNo: "P-04", nameZh: "座板", qty: 1, wmm: 1200, hmm: 600, placement: null },
];

describe("indexSheetSvg", () => {
  it("A4 直式", () => {
    expect(indexSheetSvg("方凳", rows)).toContain('viewBox="0 0 210 297"');
  });
  it("列出件號、件名、紙張與角度", () => {
    const svg = indexSheetSvg("方凳", rows);
    expect(svg).toContain("P-01");
    expect(svg).toContain("凳腳");
    expect(svg).toContain("A3");
    expect(svg).toContain("21");
  });
  it("塞不下的零件標明退回零件圖", () => {
    expect(indexSheetSvg("方凳", rows)).toContain("見零件圖");
  });
  it("含列印設定提醒", () => {
    expect(indexSheetSvg("方凳", rows)).toContain("實際大小");
  });
  it("不得出現 font-weight 500/600", () => {
    expect(indexSheetSvg("方凳", rows)).not.toMatch(/font-weight="(500|600)"/);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run lib/export/template-pack/index-sheet.test.ts`
Expected: FAIL

- [ ] **Step 3: 寫實作**

`lib/export/template-pack/index-sheet.ts`:

```ts
// 列印包索引封面（A4 直式）。到輸出中心可以核張數，也避免漏印。
import type { Placement } from "./fit";

export interface PackRow {
  partNo: string;
  nameZh: string;
  qty: number;
  wmm: number;
  hmm: number;
  /** null = 1:1 塞不下最大的紙 → 退回比例零件圖 */
  placement: Placement | null;
}

const W = 210;
const H = 297;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function indexSheetSvg(title: string, rows: PackRow[]): string {
  const cols = [14, 40, 78, 100, 140];
  const head = ["件號", "件名", "數量", "攤平尺寸", "印在哪張紙"];
  const lines: string[] = [];

  lines.push(
    `<text x="14" y="24" font-family="PackCJK" font-size="9" font-weight="700" fill="#000">${esc(title)} — 1:1 實尺樣板索引</text>`,
  );
  lines.push(
    `<text x="14" y="33" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">列印時務必選「實際大小 / 100%」，不要選「縮放至頁面大小」，否則樣板不是實尺。</text>`,
  );
  lines.push(
    `<text x="14" y="39" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">每張樣板左下角有一條 100mm 證明尺，印出來量一下就知道有沒有被縮放。</text>`,
  );
  lines.push(`<line x1="14" y1="46" x2="196" y2="46" stroke="#000" stroke-width="0.5"/>`);

  head.forEach((h, i) => {
    lines.push(
      `<text x="${cols[i]}" y="53" font-family="PackCJK" font-size="4.5" font-weight="700" fill="#000">${esc(h)}</text>`,
    );
  });

  let y = 62;
  for (const r of rows) {
    const where = r.placement
      ? `${r.placement.paper.label}${r.placement.swapped ? " 直放" : ""}${r.placement.angleDeg > 0 ? ` 斜 ${r.placement.angleDeg}°` : ""}`
      : "太大 → 見零件圖";
    const cells = [
      r.partNo,
      r.nameZh,
      `×${r.qty}`,
      `${Math.round(r.wmm)}×${Math.round(r.hmm)}`,
      where,
    ];
    cells.forEach((c, i) => {
      lines.push(
        `<text x="${cols[i]}" y="${y}" font-family="PackCJK" font-size="4.5" font-weight="400" fill="#000">${esc(c)}</text>`,
      );
    });
    y += 7;
    if (y > H - 20) break;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">`,
    lines.join("\n  "),
    `</svg>`,
    "",
  ].join("\n");
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run lib/export/template-pack/index-sheet.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/export/template-pack/index-sheet.ts lib/export/template-pack/index-sheet.test.ts
git commit -m "feat(樣板): 索引封面 — 每件印在哪張紙、什麼角度，太大的標明見零件圖"
```

---

### Task 8: 組包與下載

**Files:**
- Create: `lib/export/template-pack/pack.ts`
- Test: `lib/export/template-pack/pack.test.ts`

**Interfaces:**
- Consumes: 全部前面的 task
- Produces:
  - `interface PackPlan { rows: PackRow[]; byPaper: Map<string, Array<{ placement: Placement; row: PackRow; svg: string }>> }`
  - `buildPackPlan(design: FurnitureDesign): PackPlan`
  - `downloadTemplatePack(design: FurnitureDesign, onProgress?: (done: number, total: number) => void): Promise<void>`

- [ ] **Step 1: 寫失敗的測試(只測 plan,不測下載)**

`lib/export/template-pack/pack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureCategory, FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { buildPackPlan } from "./pack";

/**
 * 用範本預設值建一個 design。
 * entry.template 本身就是 builder 函式（不是帶 .build 的物件），
 * options 取 optionSchema 的 defaultValue —— 跟 scripts/audit-overlaps.ts 同一套。
 */
function buildDefaultDesign(category: FurnitureCategory): FurnitureDesign {
  const entry = getTemplate(category) as FurnitureCatalogEntry | undefined;
  if (!entry?.template) throw new Error(`找不到範本：${category}`);
  const options = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec: OptionSpec) => {
      acc[spec.key] = spec.defaultValue;
      return acc;
    },
    {},
  );
  return entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options,
  });
}

describe("buildPackPlan", () => {
  it("方凳：每個零件都有一列，凳腳落在 A3", () => {
    const plan = buildPackPlan(buildDefaultDesign("stool"));
    expect(plan.rows.length).toBeGreaterThan(0);
    const leg = plan.rows.find((r) => r.nameZh.includes("腳"));
    expect(leg?.placement?.paper.id).toBe("A3");
  });

  it("依紙張分組，同一種紙的零件收在同一組", () => {
    const plan = buildPackPlan(buildDefaultDesign("stool"));
    const total = Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0);
    const placeable = plan.rows.filter((r) => r.placement).length;
    expect(total).toBe(placeable);
  });

  it("書桌桌面板太大 → placement 為 null（退回零件圖）", () => {
    const plan = buildPackPlan(buildDefaultDesign("desk"));
    const topRow = plan.rows.find((r) => Math.max(r.wmm, r.hmm) > 1000);
    expect(topRow).toBeDefined();
    expect(topRow?.placement).toBeNull();
  });
});
```

> 註:`OptionSpec` 若不在 `@/lib/types`,改從 `@/lib/templates` 匯入(依 `scripts/audit-overlaps.ts`
> 的實際 import 路徑為準)。斷言內容不變。

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run lib/export/template-pack/pack.test.ts`
Expected: FAIL

- [ ] **Step 3: 寫實作**

`lib/export/template-pack/pack.ts`:

```ts
// 把一個設計組成一包 1:1 樣板 PDF（依紙張分檔），用既有的 zipStore 打包。
import type { FurnitureDesign } from "@/lib/types";
import { groupPartsForDrawing, groupDisplayName } from "@/lib/render/part-drawing/grouping";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { categorizePart } from "@/lib/render/categorize-part";
import { zipStore } from "@/lib/export/zip-store";
import { ladderFor } from "./paper";
import { placeOnLadder, type Placement } from "./fit";
import { pickTemplateFace } from "./face";
import { templateSheetSvg } from "./sheet";
import { indexSheetSvg, type PackRow } from "./index-sheet";
import { fetchFontSubset, svgsToPdf } from "./pdf";

export interface PackPlan {
  rows: PackRow[];
  /** key = paper.id + (swapped ? "-P" : "") */
  byPaper: Map<string, Array<{ placement: Placement; row: PackRow; svg: string }>>;
}

export function buildPackPlan(design: FurnitureDesign): PackPlan {
  const groups = groupPartsForDrawing(design);
  const derivedMap = deriveMortisesByPart(design.parts);
  const rows: PackRow[] = [];
  const byPaper: PackPlan["byPaper"] = new Map();

  groups.forEach((g, i) => {
    const part = g.representative;
    const face = pickTemplateFace(part, derivedMap.get(part.id) ?? []);
    const placement = placeOnLadder(face.w, face.h, ladderFor(categorizePart(part.id)));
    const row: PackRow = {
      partNo: `P-${String(i + 1).padStart(2, "0")}`,
      nameZh: groupDisplayName(g, "zh-TW"),
      qty: Math.min(g.count, 99),
      wmm: face.w,
      hmm: face.h,
      placement,
    };
    rows.push(row);
    if (!placement) return;
    const key = `${placement.paper.id}${placement.swapped ? "-P" : ""}`;
    const svg = templateSheetSvg({
      face,
      placement,
      partNo: row.partNo,
      nameZh: row.nameZh,
      qty: row.qty,
    });
    if (!byPaper.has(key)) byPaper.set(key, []);
    byPaper.get(key)!.push({ placement, row, svg });
  });

  return { rows, byPaper };
}

// design.nameZh 在型別上是必填 string，直接用即可。
function safeStem(design: FurnitureDesign): string {
  return design.nameZh.replace(/[\\/:*?"<>|]/g, "_");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadTemplatePack(
  design: FurnitureDesign,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const plan = buildPackPlan(design);
  const allSvgs: string[] = [];
  for (const list of plan.byPaper.values()) for (const it of list) allSvgs.push(it.svg);
  const indexSvg = indexSheetSvg(safeStem(design), plan.rows);
  allSvgs.push(indexSvg);

  // 一次要好整包會用到的所有字元，避免每份 PDF 各打一次 API
  const fontB64 = await fetchFontSubset(allSvgs);

  const files: Record<string, Uint8Array> = {};
  const total = plan.byPaper.size + 1;
  let done = 0;

  files["00_索引.pdf"] = await svgsToPdf([indexSvg], 210, 297, fontB64);
  onProgress?.(++done, total);

  let n = 1;
  for (const [key, list] of plan.byPaper) {
    const { paper, swapped } = list[0].placement;
    const pw = swapped ? paper.h : paper.w;
    const ph = swapped ? paper.w : paper.h;
    const name = `${String(n).padStart(2, "0")}_樣板_${key}.pdf`;
    files[name] = await svgsToPdf(list.map((x) => x.svg), pw, ph, fontB64);
    n++;
    onProgress?.(++done, total);
  }

  const zip = zipStore(files);
  const ab = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(new Blob([ab], { type: "application/zip" }), `${safeStem(design)}_實尺樣板_${date}.zip`);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run lib/export/template-pack/pack.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/export/template-pack/pack.ts lib/export/template-pack/pack.test.ts
git commit -m "feat(樣板): 組包與下載 — 依紙張分檔、索引封面、zip 打包"
```

---

### Task 9: UI 進入點與權限

**Files:**
- Create: `components/TemplatePackButton.tsx`
- Modify: `app/[locale]/design/[type]/page.tsx`(在 `<ThreeDExportButton design={design} />` 那一行之後加入)
- Modify: `messages/zh-TW.json`、`messages/en.json`

**Interfaces:**
- Consumes: `downloadTemplatePack`、`buildPackPlan`(Task 8)

- [ ] **Step 1: 寫元件**

`components/TemplatePackButton.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { buildPackPlan, downloadTemplatePack } from "@/lib/export/template-pack/pack";

export function TemplatePackButton({ design }: { design: FurnitureDesign }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const plan = useMemo(() => buildPackPlan(design), [design]);
  const sheetCount = Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0);
  const fallbackCount = plan.rows.filter((r) => !r.placement).length;
  const papers = Array.from(plan.byPaper.keys()).join("、");

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await downloadTemplatePack(design, (d, t) => setProgress([d, t]));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "產生失敗，請重試");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="rounded border border-zinc-300 p-3 text-sm">
      <div className="font-semibold mb-1">1:1 實尺樣板</div>
      <p className="text-zinc-600 mb-2">
        列印後貼在木料上照著描輪廓、點榫孔中心。共 {sheetCount} 張（{papers}）
        {fallbackCount > 0 && `，另有 ${fallbackCount} 件太大，請改印零件圖`}。
      </p>
      <button
        type="button"
        onClick={go}
        disabled={busy || sheetCount === 0}
        className="rounded bg-[#A47A64] px-3 py-1.5 text-white disabled:opacity-50"
      >
        {busy
          ? progress
            ? `產生中 ${progress[0]}/${progress[1]}`
            : "產生中…"
          : "下載實尺樣板"}
      </button>
      {err && <p className="mt-2 text-red-600">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 掛進設計頁**

在 `app/[locale]/design/[type]/page.tsx` 的 `<ThreeDExportButton design={design} />`(約 560 行)後面加:

```tsx
              <TemplatePackButton design={design} />
```

並在檔頭 import:

```tsx
import { TemplatePackButton } from "@/components/TemplatePackButton";
```

- [ ] **Step 3: 加權限 gate**

樣板是可下載的 PDF 圖紙,語意上對應 `PlanFeatures.canDownloadPdf`(註解就是「可下載 PDF(列印頁的
列印按鈕)」)。照同頁 `ThreeDExportButton`(約 559 行)的既有寫法包起來,未付費顯示升級提示:

```tsx
            {isAdmin || getPlanFeatures(profile).canDownloadPdf ? (
              <TemplatePackButton design={design} />
            ) : (
              <Link
                href={`/pricing?locked=${type}`}
                className="block rounded border border-zinc-300 p-3 text-sm text-zinc-600 hover:border-[#A47A64]"
              >
                升級後可下載 1:1 實尺樣板 →
              </Link>
            )}
```

`isAdmin`、`profile`、`type`、`getPlanFeatures` 在該檔案作用域內都已存在,`Link` 也已 import。

- [ ] **Step 4: 實機驗證**

Run: `npm run dev`
1. 開 `http://localhost:3000/design/stool`,按「下載實尺樣板」
2. 解開 zip,應有 `00_索引.pdf` + 依紙張分的樣板 PDF
3. 用 Adobe Reader 或 Chrome 開 A3 那份,**選「實際大小」列印**
4. 拿尺量紙上的證明尺 → 必須是 100mm ± 0.5mm
5. 量凳腳輪廓長度 → 必須是 425mm ± 0.5mm

- [ ] **Step 5: Commit**

```bash
git add components/TemplatePackButton.tsx "app/[locale]/design/[type]/page.tsx" messages/
git commit -m "feat(樣板): 設計頁加入實尺樣板下載入口（含張數預估與進度）"
```

---

### Task 10: 實尺與中文的自動回歸測試

**Files:**
- Create: `scripts/verify-template-pdf.cjs`
- Modify: `package.json`(加 `verify:template` script)

**背景:** 這套手法在規劃階段已實測可行,並且就是靠它抓到 `font-weight` 亂碼 bug 的。

- [ ] **Step 1: 寫驗證腳本**

`scripts/verify-template-pdf.cjs`:

```js
// 產一包樣板 → 解 zip → pdf.js 光柵化 → 驗證：
//   (1) 沒有 page error
//   (2) PDF 內中文字串完整（不是 Helvetica 亂碼）
//   (3) 100mm 證明尺的實際長度誤差 < 0.5mm
// 用法：node scripts/verify-template-pdf.cjs http://localhost:3000/design/stool
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const ROOT = process.cwd();
const PDFJS_DIR = path.join(ROOT, "node_modules/pdfjs-dist/build");

/** 解 STORED（未壓縮）zip —— zipStore 產出的就是這種。回 { 檔名: Buffer }。 */
function unzipStored(buf) {
  const out = {};
  let i = 0;
  while (i < buf.length - 4) {
    if (buf.readUInt32LE(i) !== 0x04034b50) { i++; continue; }
    const method = buf.readUInt16LE(i + 8);
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nameLen).toString("utf8");
    const dataStart = i + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error(`不是 STORED：${name}`);
    out[name] = buf.slice(dataStart, dataStart + size);
    i = dataStart + size;
  }
  return out;
}

(async () => {
  const url = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ acceptDownloads: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(8000);

  const [dl] = await Promise.all([
    p.waitForEvent("download", { timeout: 180000 }),
    p.getByRole("button", { name: /下載實尺樣板/ }).click(),
  ]);
  const zipBuf = fs.readFileSync(await dl.path());
  const files = unzipStored(zipBuf);
  console.log("zip 內容：", Object.keys(files).join(", "));
  if (errs.length) { console.error("PAGE ERRORS:", errs); process.exit(1); }

  // 挑第一份樣板 PDF（非索引）
  const sheetName = Object.keys(files).find((n) => n.includes("樣板"));
  if (!sheetName) { console.error("找不到樣板 PDF"); process.exit(1); }

  // 起本地 http server 供 pdf.js 模組載入（file:// 會被 CORS 擋）
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    const fp = rel === "blank.html" ? null : path.join(PDFJS_DIR, path.basename(rel));
    if (!fp) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<canvas id=c></canvas>"); }
    fs.readFile(fp, (e, d) => {
      if (e) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(d);
    });
  });
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;

  const p2 = await b.newPage();
  await p2.goto(`http://localhost:${port}/blank.html`);
  const result = await p2.evaluate(async ([b64, port]) => {
    const pdfjs = await import(`http://localhost:${port}/pdf.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/pdf.worker.mjs`;
    const raw = atob(b64);
    const u8 = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
    const doc = await pdfjs.getDocument({ data: u8 }).promise;
    const page = await doc.getPage(1);

    const SCALE = 4;
    const vp = page.getViewport({ scale: SCALE });
    const c = document.getElementById("c");
    c.width = vp.width; c.height = vp.height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const text = (await page.getTextContent()).items.map((i) => i.str).join("|");

    // 證明尺畫在 y = pageH-10mm、x = 10..110mm。掃該處上下各 3mm 的帶狀區，
    // 找最長的水平深色連續段。
    const pxPerMm = SCALE * 72 / 25.4;
    const pageHmm = vp.height / pxPerMm;
    const yc = Math.round((pageHmm - 10) * pxPerMm);
    const band = Math.round(3 * pxPerMm);
    let best = 0;
    for (let y = yc - band; y <= yc + band; y++) {
      if (y < 0 || y >= c.height) continue;
      const row = ctx.getImageData(0, y, c.width, 1).data;
      let run = 0;
      for (let x = 0; x < c.width; x++) {
        const dark = row[x * 4] < 128 && row[x * 4 + 1] < 128 && row[x * 4 + 2] < 128;
        run = dark ? run + 1 : 0;
        if (run > best) best = run;
      }
    }
    return { text, rulerMm: best / pxPerMm, pageHmm };
  }, [files[sheetName].toString("base64"), port]);

  await b.close(); srv.close();

  console.log("抽出的文字：", result.text);
  console.log("量到的證明尺長度：", result.rulerMm.toFixed(2), "mm");

  const cjkOk = /[一-鿿]/.test(result.text);
  const rulerOk = Math.abs(result.rulerMm - 100) < 0.5;

  if (!cjkOk) { console.error("✕ PDF 內找不到中文 —— 字型嵌入或字重可能有問題"); process.exit(1); }
  if (!rulerOk) { console.error(`✕ 證明尺 ${result.rulerMm.toFixed(2)}mm，超出 100±0.5mm`); process.exit(1); }
  console.log("✓ 中文完整、實尺正確");
})().catch((e) => {
  console.error("ERR", e.stack || e.message);
  process.exit(1);
});
```

> 註:此腳本需要 `pdfjs-dist`。若尚未安裝:`npm i -D pdfjs-dist`

- [ ] **Step 2: 加 script**

`package.json` 的 `scripts` 加:

```json
    "verify:template": "node scripts/verify-template-pdf.cjs http://localhost:3000/design/stool",
```

- [ ] **Step 3: 跑一次**

先 `npm run dev`,另一個終端跑 `npm run verify:template`。
Expected: 印出 zip 大小,`OK — 無 page error`

- [ ] **Step 4: 全套測試**

Run: `npx vitest run lib/export/template-pack app/api/pdf-font`
Expected: 全部 PASS

Run: `npx tsc --noEmit`
Expected: 0 個新錯誤

Run: `npx tsx scripts/audit-overlaps.ts`
Expected: 0 overlaps(確認 Task 4 的字重改動沒動到幾何)

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-template-pdf.cjs package.json
git commit -m "test(樣板): 實尺與中文完整性的自動驗證腳本"
```
