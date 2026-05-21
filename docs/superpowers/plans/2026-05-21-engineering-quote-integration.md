# 工程報價整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓地板模擬器(`/floor`)與天花板模擬器(`/ceiling`)各自能產生一張正式 A4 工程報價單,共用一套以「每坪」為基準的工程報價核心。

**Architecture:** 新增 `lib/engineering-quote/` 共用報價核心(純計算,材料無關),地板/天花板各寫一個 adapter 把自家 BOM 轉成 `EngineeringQuoteInput`。報價編輯頁與 A4 列印頁是地板天花板共用的 React 元件,以 `quoteType` 參數切換平面圖。家具報價(`lib/pricing/quote.ts`、`app/design/[type]/quote`)完全不動。

**Tech Stack:** Next.js(App Router)、TypeScript、Tailwind、SVG;測試用 `npx tsx` 跑 assert 腳本(沿用 `lib/floor/calc.test.ts` 風格)。

**參考設計文件:** `docs/superpowers/specs/2026-05-21-engineering-quote-integration-design.md`

**任務依賴:** Task 1 → 2 → {3,4,5} → {6,7} → 8 → {9,10} → 11 → 12

---

## 檔案結構

| 檔案 | 職責 |
|---|---|
| `lib/engineering-quote/types.ts` | `EngineeringQuoteInput` / `EngineeringQuoteBreakdown` / `EngLineItem` 型別 |
| `lib/engineering-quote/defaults.ts` | `ENGINEERING_QUOTE_DEFAULTS` 費用參數預設值 |
| `lib/engineering-quote/calc.ts` | `computeEngineeringQuote()`、`computeValidUntil()` 純計算 |
| `lib/engineering-quote/calc.test.ts` | calc 驗證腳本 |
| `lib/engineering-quote/url-codec.ts` | `encodeState()` / `decodeState()` 同構 base64 編解碼 |
| `lib/engineering-quote/url-codec.test.ts` | 編解碼 round-trip 驗證 |
| `lib/floor/quote-adapter.ts` | `floorBomToEngInput()` |
| `lib/ceiling/quote-adapter.ts` | `ceilingBomToEngInput()` |
| `lib/engineering-quote/adapters.test.ts` | 兩個 adapter 驗證 |
| `components/engineering-quote/EngineeringQuoteForm.tsx` | 費用參數輸入表單 |
| `components/engineering-quote/EngineeringQuotePrint.tsx` | A4 列印版(共用) |
| `components/engineering-quote/EngineeringQuoteClient.tsx` | 報價編輯頁 client 元件 |
| `app/floor/quote/page.tsx` + `app/floor/quote/print/page.tsx` | 地板報價路由 |
| `app/ceiling/quote/page.tsx` + `app/ceiling/quote/print/page.tsx` | 天花板報價路由 |
| `app/floor/FloorDevClient.tsx`(改) | 加「產生報價單」按鈕 |
| `app/ceiling/CeilingDevClient.tsx`(改) | 加「產生報價單」按鈕 |

**對 spec 的微調(刻意):** spec 把 `validUntil` 放進 `EngineeringQuoteBreakdown`。為了讓 `computeEngineeringQuote` 維持純函式(不在內部呼叫 `new Date()`、好測試),改成獨立的 `computeValidUntil(validityDays, today?)` helper,由列印元件呼叫。`validUntil` 不進 breakdown。

---

## Task 1: 工程報價型別與預設值

**Files:**
- Create: `lib/engineering-quote/types.ts`
- Create: `lib/engineering-quote/defaults.ts`

- [ ] **Step 1: 建立型別檔**

Create `lib/engineering-quote/types.ts`:

```ts
/**
 * 工程報價(地板 / 天花板共用)。以「坪」為計價基準,與材料種類無關。
 * 家具報價走 lib/pricing/quote.ts,與本模組互不相干。
 */

export type EngQuoteType = "floor" | "ceiling";

/** 報價單上的一行品項 */
export interface EngLineItem {
  label: string;
  detail?: string;
  /** NT$;未報價時為 0,搭配 unpriced 旗標 */
  amount: number;
  /** true → 列印顯示「未報價」灰字 */
  unpriced?: boolean;
}

/** 工程報價輸入(adapter 產出 + 使用者在報價表單填的費用參數) */
export interface EngineeringQuoteInput {
  quoteType: EngQuoteType;
  /** 坪數,由 BOM 帶入,UI 唯讀 */
  pingShu: number;
  areaM2: number;

  /** 材料總成本(地板 = BOM 加總;天花板 = 每坪材料 × 坪數) */
  materialCost: number;
  /** 材料明細(顯示用) */
  materialLines: EngLineItem[];

  /** 每坪施工費(NT$/坪) */
  laborPricePerPing: number;

  /** 拆除清運 */
  demolitionMode: "lump" | "perPing";
  demolitionLump: number;
  demolitionPerPing: number;

  /** 運費(定額) */
  shippingCost: number;

  /** 雜項耗材 */
  consumablesMode: "lump" | "percent";
  consumablesLump: number;
  /** 對 materialCost 取百分比(0–1) */
  consumablesPercent: number;

  /** 天花板批土油漆(每坪);quoteType="floor" 時計算端強制為 0 */
  paintingPerPing: number;

  /** 毛利率 0–1 */
  marginRate: number;
  /** 營業稅率,預設 0.05 */
  vatRate: number;
  /** 折扣率 0–0.5 */
  discountRate: number;
  /** 訂金比例 0–1,預設 0.3 */
  depositRate: number;
  /** 報價有效天數 */
  validityDays: number;
}

/** 工程報價計算結果 */
export interface EngineeringQuoteBreakdown {
  materialCost: number;
  laborCost: number;
  demolitionCost: number;
  shippingCost: number;
  consumablesCost: number;
  /** floor 恆為 0 */
  paintingCost: number;
  costSubtotal: number;
  margin: number;
  subtotalExclVat: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  vat: number;
  total: number;
  depositAmount: number;
  balanceAmount: number;
  /** 完整品項表(材料明細 + 各費用行) */
  lines: EngLineItem[];
  /** 任一必要單價(材料 / 施工費)= 0 → true */
  hasUnpriced: boolean;
}
```

- [ ] **Step 2: 建立預設值檔**

Create `lib/engineering-quote/defaults.ts`:

```ts
/** 工程報價費用參數預設值(使用者可在報價表單調整)。
 *  數字為台灣裝潢市場保守估,使用者必調。 */
export const ENGINEERING_QUOTE_DEFAULTS = {
  laborPricePerPing: 0,
  demolitionMode: "lump" as "lump" | "perPing",
  demolitionLump: 0,
  demolitionPerPing: 0,
  shippingCost: 0,
  consumablesMode: "lump" as "lump" | "percent",
  consumablesLump: 0,
  consumablesPercent: 0.05,
  /** 天花板每坪材料費(adapter 用) */
  ceilingMaterialPerPing: 0,
  paintingPerPing: 0,
  marginRate: 0.2,
  vatRate: 0.05,
  discountRate: 0,
  depositRate: 0.3,
  validityDays: 30,
};
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep engineering-quote || echo "OK"`
Expected: `OK`(無輸出代表新檔無型別錯誤)

- [ ] **Step 4: Commit**

```bash
git add lib/engineering-quote/types.ts lib/engineering-quote/defaults.ts
git commit -m "feat(eng-quote): 工程報價型別與費用預設值"
```

---

## Task 2: computeEngineeringQuote 計算核心

**Files:**
- Create: `lib/engineering-quote/calc.test.ts`
- Create: `lib/engineering-quote/calc.ts`

- [ ] **Step 1: 寫失敗測試**

Create `lib/engineering-quote/calc.test.ts`:

```ts
/** 跑法:npx tsx lib/engineering-quote/calc.test.ts */
import { computeEngineeringQuote, computeValidUntil } from "./calc";
import type { EngineeringQuoteInput } from "./types";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}
function approx(a: number, b: number, eps = 0.5) {
  return Math.abs(a - b) < eps;
}

const base: EngineeringQuoteInput = {
  quoteType: "floor",
  pingShu: 10,
  areaM2: 33.06,
  materialCost: 30000,
  materialLines: [{ label: "地板片", amount: 30000 }],
  laborPricePerPing: 2000,
  demolitionMode: "lump",
  demolitionLump: 5000,
  demolitionPerPing: 0,
  shippingCost: 1500,
  consumablesMode: "lump",
  consumablesLump: 2000,
  consumablesPercent: 0,
  paintingPerPing: 0,
  marginRate: 0.2,
  vatRate: 0.05,
  discountRate: 0,
  depositRate: 0.3,
  validityDays: 30,
};

// 1. 地板基本加總
{
  const b = computeEngineeringQuote(base);
  // 材料30000 + 施工2000×10=20000 + 拆除5000 + 運費1500 + 雜項2000 = 58500
  assert(approx(b.costSubtotal, 58500), `costSubtotal=${b.costSubtotal}`);
  assert(approx(b.paintingCost, 0), "floor paintingCost=0");
  assert(approx(b.margin, 11700), `margin=${b.margin}`);
  assert(approx(b.subtotalExclVat, 70200), `subtotalExclVat=${b.subtotalExclVat}`);
  assert(approx(b.vat, 3510), `vat=${b.vat}`);
  assert(approx(b.total, 73710), `total=${b.total}`);
  assert(approx(b.depositAmount + b.balanceAmount, b.total), "訂金+尾款=總計");
  assert(b.hasUnpriced === false, "全有報價 hasUnpriced=false");
}

// 2. 天花板:批土油漆 + perPing 拆除 + percent 雜項
{
  const b = computeEngineeringQuote({
    ...base,
    quoteType: "ceiling",
    paintingPerPing: 800,
    demolitionMode: "perPing",
    demolitionPerPing: 600,
    consumablesMode: "percent",
    consumablesPercent: 0.05,
  });
  assert(approx(b.paintingCost, 8000), `painting 800×10=${b.paintingCost}`);
  assert(approx(b.demolitionCost, 6000), `demolition 600×10=${b.demolitionCost}`);
  assert(approx(b.consumablesCost, 1500), `consumables 5%×30000=${b.consumablesCost}`);
}

// 3. floor 即使 paintingPerPing>0 也不算
{
  const b = computeEngineeringQuote({ ...base, quoteType: "floor", paintingPerPing: 800 });
  assert(approx(b.paintingCost, 0), "floor 強制 paintingCost=0");
}

// 4. 折扣
{
  const b = computeEngineeringQuote({ ...base, discountRate: 0.1 });
  assert(approx(b.discountAmount, 7020), `discount 10%×70200=${b.discountAmount}`);
  assert(approx(b.subtotalAfterDiscount, 63180), `afterDiscount=${b.subtotalAfterDiscount}`);
}

// 5. 未報價偵測:施工費 = 0
{
  const b = computeEngineeringQuote({ ...base, laborPricePerPing: 0 });
  assert(b.hasUnpriced === true, "施工費=0 → hasUnpriced=true");
}

// 6. computeValidUntil
{
  const d = computeValidUntil(30, new Date("2026-05-21T00:00:00+08:00"));
  assert(d === "2026-06-20", `validUntil=${d}`);
}

console.log(`✅ engineering-quote calc: ${passed} passed`);
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx tsx lib/engineering-quote/calc.test.ts`
Expected: FAIL — 找不到 `./calc` 模組

- [ ] **Step 3: 寫計算實作**

Create `lib/engineering-quote/calc.ts`:

```ts
import type {
  EngineeringQuoteInput,
  EngineeringQuoteBreakdown,
  EngLineItem,
} from "./types";

/** 報價有效日 = 報價日 + validityDays(以台北日曆日計)。回傳 YYYY-MM-DD。 */
export function computeValidUntil(validityDays: number, today = new Date()): string {
  const target = new Date(today.getTime() + validityDays * 86400000);
  // en-CA locale 直接輸出 YYYY-MM-DD,時區鎖台北
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);
}

export function computeEngineeringQuote(
  input: EngineeringQuoteInput,
): EngineeringQuoteBreakdown {
  const r = (n: number) => Math.round(n);

  const materialCost = r(input.materialCost);
  const laborCost = r(input.laborPricePerPing * input.pingShu);
  const demolitionCost = r(
    input.demolitionMode === "lump"
      ? input.demolitionLump
      : input.demolitionPerPing * input.pingShu,
  );
  const shippingCost = r(input.shippingCost);
  const consumablesCost = r(
    input.consumablesMode === "lump"
      ? input.consumablesLump
      : input.materialCost * input.consumablesPercent,
  );
  const paintingCost = r(
    input.quoteType === "ceiling" ? input.paintingPerPing * input.pingShu : 0,
  );

  const costSubtotal =
    materialCost + laborCost + demolitionCost + shippingCost + consumablesCost + paintingCost;
  const margin = r(costSubtotal * input.marginRate);
  const subtotalExclVat = costSubtotal + margin;
  const discountAmount = r(subtotalExclVat * input.discountRate);
  const subtotalAfterDiscount = subtotalExclVat - discountAmount;
  const vat = r(subtotalAfterDiscount * input.vatRate);
  const total = subtotalAfterDiscount + vat;
  const depositAmount = r(total * input.depositRate);
  const balanceAmount = total - depositAmount;

  // 品項表:材料明細 + 各費用行
  const lines: EngLineItem[] = [...input.materialLines];
  lines.push({
    label: "施工費",
    detail: `每坪 NT$${input.laborPricePerPing.toLocaleString()} × ${input.pingShu} 坪`,
    amount: laborCost,
    unpriced: input.laborPricePerPing <= 0,
  });
  if (demolitionCost > 0) lines.push({ label: "拆除清運費", amount: demolitionCost });
  if (shippingCost > 0) lines.push({ label: "運費", amount: shippingCost });
  if (consumablesCost > 0) lines.push({ label: "雜項耗材", amount: consumablesCost });
  if (paintingCost > 0) {
    lines.push({
      label: "天花板批土油漆",
      detail: `每坪 NT$${input.paintingPerPing.toLocaleString()} × ${input.pingShu} 坪`,
      amount: paintingCost,
    });
  }

  const hasUnpriced =
    input.materialLines.some((l) => l.unpriced) || input.laborPricePerPing <= 0;

  return {
    materialCost,
    laborCost,
    demolitionCost,
    shippingCost,
    consumablesCost,
    paintingCost,
    costSubtotal,
    margin,
    subtotalExclVat,
    discountAmount,
    subtotalAfterDiscount,
    vat,
    total,
    depositAmount,
    balanceAmount,
    lines,
    hasUnpriced,
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx tsx lib/engineering-quote/calc.test.ts`
Expected: PASS — `✅ engineering-quote calc: 12 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/engineering-quote/calc.ts lib/engineering-quote/calc.test.ts
git commit -m "feat(eng-quote): computeEngineeringQuote 計算核心 + 測試"
```

---

## Task 3: URL 編解碼

模擬器 input 要透過 URL 傳到報價頁。編碼在 client(瀏覽器),解碼在 server(Node),需同構。

**Files:**
- Create: `lib/engineering-quote/url-codec.test.ts`
- Create: `lib/engineering-quote/url-codec.ts`

- [ ] **Step 1: 寫失敗測試**

Create `lib/engineering-quote/url-codec.test.ts`:

```ts
/** 跑法:npx tsx lib/engineering-quote/url-codec.test.ts */
import { encodeState, decodeState } from "./url-codec";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}

// 1. round-trip 物件
{
  const obj = { a: 1, b: "中文", c: [1, 2, 3], d: { x: true } };
  const enc = encodeState(obj);
  const dec = decodeState<typeof obj>(enc);
  assert(JSON.stringify(dec) === JSON.stringify(obj), "round-trip 一致");
}

// 2. 編碼字串 URL-safe(無 + / =)
{
  const enc = encodeState({ room: "x".repeat(200) });
  assert(!/[+/=]/.test(enc), `URL-safe: ${enc.slice(0, 20)}...`);
}

// 3. 壞字串 decode 丟錯
{
  let threw = false;
  try {
    decodeState("!!!not-base64!!!");
  } catch {
    threw = true;
  }
  assert(threw, "壞輸入 decode 丟錯");
}

console.log(`✅ url-codec: ${passed} passed`);
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx tsx lib/engineering-quote/url-codec.test.ts`
Expected: FAIL — 找不到 `./url-codec`

- [ ] **Step 3: 寫實作**

Create `lib/engineering-quote/url-codec.ts`:

```ts
/**
 * 同構 base64url 編解碼,用於把模擬器 input 塞進 URL 參數。
 * client 用 btoa/atob、server 用 Buffer。
 */

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return b64 + pad;
}

export function encodeState(obj: unknown): string {
  const json = JSON.stringify(obj);
  if (typeof window === "undefined") {
    return toBase64Url(Buffer.from(json, "utf8").toString("base64"));
  }
  // 瀏覽器:先 UTF-8 編碼再 btoa
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return toBase64Url(btoa(bin));
}

export function decodeState<T>(s: string): T {
  const b64 = fromBase64Url(s);
  let json: string;
  if (typeof window === "undefined") {
    json = Buffer.from(b64, "base64").toString("utf8");
  } else {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  }
  return JSON.parse(json) as T;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx tsx lib/engineering-quote/url-codec.test.ts`
Expected: PASS — `✅ url-codec: 3 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/engineering-quote/url-codec.ts lib/engineering-quote/url-codec.test.ts
git commit -m "feat(eng-quote): 同構 base64url URL 編解碼 + 測試"
```

---

## Task 4: 地板 adapter

把 `FloorBom` 轉成 `EngineeringQuoteInput`。

**Files:**
- Create: `lib/floor/quote-adapter.ts`
- Create: `lib/engineering-quote/adapters.test.ts`(本 task 先建,Task 5 再補天花板段)

**前置參考(已存在,勿改):**
- `lib/floor/calc.ts` 的 `computeFloorBom(input): FloorBom`
- `FloorBom` 結構:`auto.pingShu` / `auto.roomAreaM2`、`cost.total`、`items: FloorBomItem[]`(每項有 `nameZh`、`spec`、`note?`、`subtotal?`)
- `lib/floor/fixtures.ts` 的 `FIXTURE_RECT`
- `lib/engineering-quote/defaults.ts` 的 `ENGINEERING_QUOTE_DEFAULTS`

- [ ] **Step 1: 寫失敗測試**

Create `lib/engineering-quote/adapters.test.ts`:

```ts
/** 跑法:npx tsx lib/engineering-quote/adapters.test.ts */
import { computeFloorBom } from "../floor/calc";
import { FIXTURE_RECT } from "../floor/fixtures";
import { floorBomToEngInput } from "../floor/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS as D } from "./defaults";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}

// 地板 adapter
{
  const bom = computeFloorBom(FIXTURE_RECT);
  const input = floorBomToEngInput(bom, D);
  assert(input.quoteType === "floor", "quoteType=floor");
  assert(input.pingShu === bom.auto.pingShu, "pingShu 帶入");
  assert(input.areaM2 === bom.auto.roomAreaM2, "areaM2 帶入");
  assert(input.materialCost === bom.cost.total, "materialCost=BOM total");
  assert(input.materialLines.length === bom.items.length, "每個 BOM 品項一行");
  assert(input.paintingPerPing === 0, "地板 paintingPerPing=0");
  assert(input.marginRate === D.marginRate, "套用預設毛利率");
}

console.log(`✅ adapters(floor): ${passed} passed`);
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx tsx lib/engineering-quote/adapters.test.ts`
Expected: FAIL — 找不到 `../floor/quote-adapter`

- [ ] **Step 3: 寫地板 adapter**

Create `lib/floor/quote-adapter.ts`:

```ts
import type { FloorBom } from "./types";
import type { EngineeringQuoteInput, EngLineItem } from "../engineering-quote/types";
import type { ENGINEERING_QUOTE_DEFAULTS } from "../engineering-quote/defaults";

type EngOpts = typeof ENGINEERING_QUOTE_DEFAULTS;

/** FloorBom → EngineeringQuoteInput。費用參數由 opts(報價表單)帶入。 */
export function floorBomToEngInput(bom: FloorBom, opts: EngOpts): EngineeringQuoteInput {
  const materialLines: EngLineItem[] = bom.items.map((it) => ({
    label: it.nameZh,
    detail: [it.spec, it.note].filter(Boolean).join(" · ") || undefined,
    amount: it.subtotal ?? 0,
    unpriced: it.subtotal === undefined,
  }));

  return {
    quoteType: "floor",
    pingShu: bom.auto.pingShu,
    areaM2: bom.auto.roomAreaM2,
    materialCost: bom.cost.total,
    materialLines,
    laborPricePerPing: opts.laborPricePerPing,
    demolitionMode: opts.demolitionMode,
    demolitionLump: opts.demolitionLump,
    demolitionPerPing: opts.demolitionPerPing,
    shippingCost: opts.shippingCost,
    consumablesMode: opts.consumablesMode,
    consumablesLump: opts.consumablesLump,
    consumablesPercent: opts.consumablesPercent,
    paintingPerPing: 0,
    marginRate: opts.marginRate,
    vatRate: opts.vatRate,
    discountRate: opts.discountRate,
    depositRate: opts.depositRate,
    validityDays: opts.validityDays,
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx tsx lib/engineering-quote/adapters.test.ts`
Expected: PASS — `✅ adapters(floor): 7 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/floor/quote-adapter.ts lib/engineering-quote/adapters.test.ts
git commit -m "feat(eng-quote): 地板 BOM → 工程報價 adapter + 測試"
```

---

## Task 5: 天花板 adapter

**Files:**
- Create: `lib/ceiling/quote-adapter.ts`
- Modify: `lib/engineering-quote/adapters.test.ts`(補天花板段)

**前置參考(已存在,勿改):**
- `lib/ceiling/calc.ts` 的 `computeCeilingBom(input): CeilingBom`
- `CeilingBom` 結構:`auto.pingShu` / `auto.roomAreaM2`、`items: BomItem[]`(每項有 `nameZh`、`spec`、`count`)
- `lib/ceiling/types.ts` 的 `DEFAULT_CEILING_INPUT`

- [ ] **Step 1: 補失敗測試**

在 `lib/engineering-quote/adapters.test.ts` **頂部 import 區**(Task 4 既有 import 之後)加入三行靜態 import:

```ts
import { computeCeilingBom } from "../ceiling/calc";
import { DEFAULT_CEILING_INPUT } from "../ceiling/types";
import { ceilingBomToEngInput } from "../ceiling/quote-adapter";
```

再於檔案的 `console.log(...)` 那行**之前**插入測試區塊:

```ts
// 天花板 adapter
{
  const bom = computeCeilingBom(DEFAULT_CEILING_INPUT);
  const input = ceilingBomToEngInput(bom, 3000, D);
  assert(input.quoteType === "ceiling", "quoteType=ceiling");
  assert(input.pingShu === bom.auto.pingShu, "ceiling pingShu 帶入");
  assert(
    input.materialCost === Math.round(3000 * bom.auto.pingShu),
    `materialCost=每坪3000×${bom.auto.pingShu}=${input.materialCost}`,
  );
  assert(input.materialLines.length === 1, "天花板材料一行");
  assert(
    input.materialLines[0].detail !== undefined,
    "材料行 detail 附 BOM 數量摘要",
  );
}
```

並把檔尾的 `console.log` 訊息改為:

```ts
console.log(`✅ adapters: ${passed} passed`);
```

(全部用靜態 import + 同步測試區塊,不需 `async`/`await import`。)

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx tsx lib/engineering-quote/adapters.test.ts`
Expected: FAIL — 找不到 `../ceiling/quote-adapter`

- [ ] **Step 3: 寫天花板 adapter**

Create `lib/ceiling/quote-adapter.ts`:

```ts
import type { CeilingBom } from "./types";
import type { EngineeringQuoteInput, EngLineItem } from "../engineering-quote/types";
import type { ENGINEERING_QUOTE_DEFAULTS } from "../engineering-quote/defaults";

type EngOpts = typeof ENGINEERING_QUOTE_DEFAULTS;

/**
 * CeilingBom → EngineeringQuoteInput。
 * 天花板材料用「每坪材料費」估價(materialPerPing × 坪數),
 * BOM 逐項數量轉成材料行的 detail 摘要供師傅核對。
 */
export function ceilingBomToEngInput(
  bom: CeilingBom,
  materialPerPing: number,
  opts: EngOpts,
): EngineeringQuoteInput {
  const ping = bom.auto.pingShu;
  const materialCost = Math.round(materialPerPing * ping);

  const summary = bom.items
    .map((it) => `${it.nameZh} ${it.count}`)
    .join("、");

  const materialLines: EngLineItem[] = [
    {
      label: "天花板系統材料",
      detail: `每坪 NT$${materialPerPing.toLocaleString()} × ${ping} 坪(${summary})`,
      amount: materialCost,
      unpriced: materialPerPing <= 0,
    },
  ];

  return {
    quoteType: "ceiling",
    pingShu: ping,
    areaM2: bom.auto.roomAreaM2,
    materialCost,
    materialLines,
    laborPricePerPing: opts.laborPricePerPing,
    demolitionMode: opts.demolitionMode,
    demolitionLump: opts.demolitionLump,
    demolitionPerPing: opts.demolitionPerPing,
    shippingCost: opts.shippingCost,
    consumablesMode: opts.consumablesMode,
    consumablesLump: opts.consumablesLump,
    consumablesPercent: opts.consumablesPercent,
    paintingPerPing: opts.paintingPerPing,
    marginRate: opts.marginRate,
    vatRate: opts.vatRate,
    discountRate: opts.discountRate,
    depositRate: opts.depositRate,
    validityDays: opts.validityDays,
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx tsx lib/engineering-quote/adapters.test.ts`
Expected: PASS — `✅ adapters: 13 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/ceiling/quote-adapter.ts lib/engineering-quote/adapters.test.ts
git commit -m "feat(eng-quote): 天花板 BOM → 工程報價 adapter + 測試"
```

---

## Task 6: 費用參數輸入表單元件

報價編輯頁左側的費用參數表單。受控元件,把使用者填的費用參數(對應 `ENGINEERING_QUOTE_DEFAULTS` 形狀)往上拋。

**Files:**
- Create: `components/engineering-quote/EngineeringQuoteForm.tsx`

**前置參考:** 看 `app/floor/FloorRangeInput.tsx` 的數值輸入元件用法,沿用同款 input 樣式(`border-zinc-300 rounded text-xs`)。

- [ ] **Step 1: 寫元件**

Create `components/engineering-quote/EngineeringQuoteForm.tsx`:

```tsx
"use client";

import type { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";

export type EngQuoteOpts = typeof ENGINEERING_QUOTE_DEFAULTS;

interface Props {
  quoteType: "floor" | "ceiling";
  value: EngQuoteOpts;
  onChange: (next: EngQuoteOpts) => void;
}

/** 一欄數字輸入 */
function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-zinc-600">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
          value={value}
          min={0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
        {unit && <span className="text-zinc-400">{unit}</span>}
      </span>
    </label>
  );
}

export function EngineeringQuoteForm({ quoteType, value, onChange }: Props) {
  const set = <K extends keyof EngQuoteOpts>(k: K, v: EngQuoteOpts[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {quoteType === "ceiling" && (
          <NumField
            label="天花板每坪材料費"
            unit="元/坪"
            value={value.ceilingMaterialPerPing}
            onChange={(v) => set("ceilingMaterialPerPing", v)}
          />
        )}
        <NumField
          label="每坪施工費"
          unit="元/坪"
          value={value.laborPricePerPing}
          onChange={(v) => set("laborPricePerPing", v)}
        />
      </div>

      {/* 拆除清運 */}
      <div className="rounded border border-zinc-200 p-3">
        <div className="mb-2 text-xs font-semibold">拆除清運費</div>
        <div className="mb-2 flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={value.demolitionMode === "lump"}
              onChange={() => set("demolitionMode", "lump")}
            />
            定額
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={value.demolitionMode === "perPing"}
              onChange={() => set("demolitionMode", "perPing")}
            />
            每坪
          </label>
        </div>
        {value.demolitionMode === "lump" ? (
          <NumField
            label="拆除清運(定額)"
            unit="元"
            value={value.demolitionLump}
            onChange={(v) => set("demolitionLump", v)}
          />
        ) : (
          <NumField
            label="拆除清運(每坪)"
            unit="元/坪"
            value={value.demolitionPerPing}
            onChange={(v) => set("demolitionPerPing", v)}
          />
        )}
      </div>

      {/* 雜項耗材 */}
      <div className="rounded border border-zinc-200 p-3">
        <div className="mb-2 text-xs font-semibold">雜項耗材</div>
        <div className="mb-2 flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={value.consumablesMode === "lump"}
              onChange={() => set("consumablesMode", "lump")}
            />
            定額
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={value.consumablesMode === "percent"}
              onChange={() => set("consumablesMode", "percent")}
            />
            材料費 %
          </label>
        </div>
        {value.consumablesMode === "lump" ? (
          <NumField
            label="雜項耗材(定額)"
            unit="元"
            value={value.consumablesLump}
            onChange={(v) => set("consumablesLump", v)}
          />
        ) : (
          <NumField
            label="雜項耗材(材料費百分比)"
            unit="%"
            value={Math.round(value.consumablesPercent * 100)}
            onChange={(v) => set("consumablesPercent", v / 100)}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {quoteType === "ceiling" && (
          <NumField
            label="批土油漆"
            unit="元/坪"
            value={value.paintingPerPing}
            onChange={(v) => set("paintingPerPing", v)}
          />
        )}
        <NumField
          label="運費"
          unit="元"
          value={value.shippingCost}
          onChange={(v) => set("shippingCost", v)}
        />
        <NumField
          label="毛利率"
          unit="%"
          value={Math.round(value.marginRate * 100)}
          onChange={(v) => set("marginRate", v / 100)}
        />
        <NumField
          label="折扣率"
          unit="%"
          value={Math.round(value.discountRate * 100)}
          onChange={(v) => set("discountRate", Math.min(50, v) / 100)}
        />
        <NumField
          label="訂金比例"
          unit="%"
          value={Math.round(value.depositRate * 100)}
          onChange={(v) => set("depositRate", Math.min(100, v) / 100)}
        />
        <NumField
          label="報價有效天數"
          unit="天"
          value={value.validityDays}
          onChange={(v) => set("validityDays", v)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep EngineeringQuoteForm || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add components/engineering-quote/EngineeringQuoteForm.tsx
git commit -m "feat(eng-quote): 費用參數輸入表單元件"
```

---

## Task 7: A4 列印元件

地板天花板共用的 A4 報價單列印版。

**Files:**
- Create: `components/engineering-quote/EngineeringQuotePrint.tsx`

**前置參考(先讀這幾個檔了解用法,勿改):**
- `app/design/[type]/quote/print/page.tsx` —— 家具 A4 列印頁的版面骨架(兩頁、`.quote-page-break`、品牌區塊用法)。**照抄它的整體版面結構**,把家具品項表換成工程品項表、三視圖換成平面圖。
- `components/branding/BrandedHeader.tsx`、`BrandedSupplier.tsx`、`components/branding/BrandedTerms.tsx`(匯出 `BrandedTermsBlocks`)—— 直接重用。
- `lib/floor/FloorOverviewSvg.tsx` 的 `FloorOverviewSvg({ bom, width })`、`lib/ceiling/CeilingOverviewSvg.tsx` 的 `CeilingOverviewSvg({ bom })`。
- `lib/pricing/catalog.ts` 的 `formatTWD(amount)`。
- `app/globals.css` 既有的 `@media print` 規則(浮水印、page-break)。

- [ ] **Step 1: 寫元件**

Create `components/engineering-quote/EngineeringQuotePrint.tsx`:

```tsx
import { BrandedHeader } from "@/components/branding/BrandedHeader";
import { BrandedSupplier } from "@/components/branding/BrandedSupplier";
import { BrandedTermsBlocks } from "@/components/branding/BrandedTerms";
import { formatTWD } from "@/lib/pricing/catalog";
import { computeValidUntil } from "@/lib/engineering-quote/calc";
import type {
  EngineeringQuoteInput,
  EngineeringQuoteBreakdown,
} from "@/lib/engineering-quote/types";
import type { CustomerInfo } from "@/components/customer/customer";

interface Props {
  quoteType: "floor" | "ceiling";
  input: EngineeringQuoteInput;
  breakdown: EngineeringQuoteBreakdown;
  customer: CustomerInfo;
  /** 平面圖(由 page 傳入 FloorOverviewSvg / CeilingOverviewSvg) */
  overview: React.ReactNode;
  /** viewMode：customer 隱藏成本明細與毛利 */
  viewMode: "customer" | "internal";
}

export function EngineeringQuotePrint({
  quoteType,
  input,
  breakdown,
  customer,
  overview,
  viewMode,
}: Props) {
  const b = breakdown;
  const title = quoteType === "floor" ? "地板工程報價單" : "天花板工程報價單";
  const validUntil = computeValidUntil(input.validityDays);

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-zinc-800">
      {/* ===== 第 1 頁 ===== */}
      <BrandedHeader />
      <h1 className="my-3 text-center text-lg font-bold">{title}</h1>

      <div className="flex justify-between text-xs">
        <BrandedSupplier />
        <div className="text-right">
          <div className="font-semibold">客戶</div>
          <div>{customer.name || "—"}</div>
          {customer.contact && <div>{customer.contact}</div>}
          {customer.phone && <div>{customer.phone}</div>}
          {customer.address && <div>{customer.address}</div>}
          {customer.taxId && <div>統編 {customer.taxId}</div>}
        </div>
      </div>

      {/* 平面圖 + 坪數 */}
      <div className="my-4 flex items-center gap-4 rounded border border-zinc-200 p-3">
        <div className="shrink-0">{overview}</div>
        <div className="text-xs">
          <div>
            坪數 <span className="text-base font-bold">{input.pingShu.toFixed(2)}</span> 坪
          </div>
          <div className="text-zinc-500">面積 {input.areaM2.toFixed(2)} m²</div>
        </div>
      </div>

      {/* 工程品項表 */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-zinc-300 bg-zinc-50">
            <th className="py-1 text-left">項目</th>
            <th className="py-1 text-left">說明</th>
            <th className="py-1 text-right">金額</th>
          </tr>
        </thead>
        <tbody>
          {b.lines.map((ln, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-1">{ln.label}</td>
              <td className="py-1 text-zinc-500">{ln.detail ?? ""}</td>
              <td className="py-1 text-right">
                {ln.unpriced ? (
                  <span className="text-zinc-400">未報價</span>
                ) : (
                  formatTWD(ln.amount)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 總計 */}
      <div className="mt-3 ml-auto w-64 text-xs">
        {viewMode === "internal" && (
          <>
            <Row label="成本小計" value={formatTWD(b.costSubtotal)} />
            <Row label={`毛利`} value={formatTWD(b.margin)} />
          </>
        )}
        <Row label="未稅小計" value={formatTWD(b.subtotalExclVat)} />
        {b.discountAmount > 0 && (
          <Row label="折扣" value={`−${formatTWD(b.discountAmount)}`} />
        )}
        <Row label="營業稅 5%" value={formatTWD(b.vat)} />
        <Row label="總計" value={formatTWD(b.total)} bold />
        <Row label="訂金" value={formatTWD(b.depositAmount)} />
        <Row label="交貨尾款" value={formatTWD(b.balanceAmount)} />
      </div>

      {b.hasUnpriced && (
        <p className="mt-2 text-xs text-rose-600">⚠️ 部分品項未設定單價,此報價尚不完整。</p>
      )}
      <p className="mt-2 text-xs text-zinc-500">報價有效至 {validUntil}</p>

      {/* ===== 第 2 頁 ===== */}
      <div className="quote-page-break" />
      <BrandedTermsBlocks />
      <div className="mt-12 flex justify-between text-xs">
        <div>客戶簽章：________________</div>
        <div>承包商簽章：________________</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between border-b border-zinc-100 py-1 ${
        bold ? "border-zinc-400 font-bold" : ""
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
```

注意:若 `BrandedHeader` / `BrandedSupplier` / `BrandedTermsBlocks` 的實際 export 名稱或 props 與此處不同,以**讀到的實際檔案為準**調整 import。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep EngineeringQuotePrint || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add components/engineering-quote/EngineeringQuotePrint.tsx
git commit -m "feat(eng-quote): A4 工程報價單列印元件"
```

---

## Task 8: 報價編輯頁 client 元件

把費用表單、客戶表單、即時試算品項表、平面圖縮圖組起來。

**Files:**
- Create: `components/engineering-quote/EngineeringQuoteClient.tsx`

**前置參考:**
- `components/customer/CustomerForm.tsx` —— 客戶表單元件,直接重用(讀它的 props)。
- `lib/engineering-quote/calc.ts` 的 `computeEngineeringQuote`。
- `lib/engineering-quote/url-codec.ts` 的 `encodeState`。
- `lib/pricing/catalog.ts` 的 `formatTWD`。

- [ ] **Step 1: 寫元件**

Create `components/engineering-quote/EngineeringQuoteClient.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { EngineeringQuoteForm, type EngQuoteOpts } from "./EngineeringQuoteForm";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { encodeState } from "@/lib/engineering-quote/url-codec";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { formatTWD } from "@/lib/pricing/catalog";
import type { EngQuoteType } from "@/lib/engineering-quote/types";

interface Props {
  quoteType: EngQuoteType;
  /** 模擬器 input 的 base64(原樣傳給列印頁) */
  encodedSimInput: string;
  /** 平面圖縮圖 */
  overview: React.ReactNode;
  /** 由 server 用 adapter 算好的、與費用無關的基礎欄位 */
  base: {
    pingShu: number;
    areaM2: number;
    materialCost: number;
    materialLines: import("@/lib/engineering-quote/types").EngLineItem[];
  };
}

export function EngineeringQuoteClient({
  quoteType,
  encodedSimInput,
  overview,
  base,
}: Props) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [opts, setOpts] = useState<EngQuoteOpts>(ENGINEERING_QUOTE_DEFAULTS);

  // 天花板材料費隨 opts.ceilingMaterialPerPing 變動
  const materialCost =
    quoteType === "ceiling"
      ? Math.round(opts.ceilingMaterialPerPing * base.pingShu)
      : base.materialCost;
  const materialLines =
    quoteType === "ceiling"
      ? [
          {
            ...base.materialLines[0],
            amount: materialCost,
            unpriced: opts.ceilingMaterialPerPing <= 0,
          },
        ]
      : base.materialLines;

  const breakdown = useMemo(
    () =>
      computeEngineeringQuote({
        quoteType,
        pingShu: base.pingShu,
        areaM2: base.areaM2,
        materialCost,
        materialLines,
        laborPricePerPing: opts.laborPricePerPing,
        demolitionMode: opts.demolitionMode,
        demolitionLump: opts.demolitionLump,
        demolitionPerPing: opts.demolitionPerPing,
        shippingCost: opts.shippingCost,
        consumablesMode: opts.consumablesMode,
        consumablesLump: opts.consumablesLump,
        consumablesPercent: opts.consumablesPercent,
        paintingPerPing: opts.paintingPerPing,
        marginRate: opts.marginRate,
        vatRate: opts.vatRate,
        discountRate: opts.discountRate,
        depositRate: opts.depositRate,
        validityDays: opts.validityDays,
      }),
    [quoteType, base, materialCost, materialLines, opts],
  );

  function goPrint() {
    const params = new URLSearchParams();
    params.set("d", encodedSimInput);
    params.set("o", encodeState(opts));
    params.set("c", encodeState(customer));
    router.push(`/${quoteType}/quote/print?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-lg font-bold">
        {quoteType === "floor" ? "地板" : "天花板"}工程報價
      </h1>
      <div className="grid gap-6 md:grid-cols-2">
        {/* 左:輸入 */}
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">客戶資料</h2>
            <CustomerForm value={customer} onChange={setCustomer} />
          </section>
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">費用參數</h2>
            <EngineeringQuoteForm quoteType={quoteType} value={opts} onChange={setOpts} />
          </section>
        </div>

        {/* 右:試算 */}
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 p-4">
            <div className="mb-2 text-xs text-zinc-500">
              坪數 {base.pingShu.toFixed(2)} 坪 · 面積 {base.areaM2.toFixed(2)} m²
            </div>
            {overview}
          </section>
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">報價試算</h2>
            <table className="w-full text-xs">
              <tbody>
                {breakdown.lines.map((ln, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1">{ln.label}</td>
                    <td className="py-1 text-right">
                      {ln.unpriced ? (
                        <span className="text-zinc-400">未報價</span>
                      ) : (
                        formatTWD(ln.amount)
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-400 font-bold">
                  <td className="py-1">含稅總計</td>
                  <td className="py-1 text-right">{formatTWD(breakdown.total)}</td>
                </tr>
              </tbody>
            </table>
            {breakdown.hasUnpriced && (
              <p className="mt-2 text-xs text-rose-600">⚠️ 估價不完整(有品項未設單價)</p>
            )}
            <button
              onClick={goPrint}
              className="mt-4 w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white"
            >
              列印報價單
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
```

注意:`CustomerForm` 的實際 props 以讀到的檔案為準調整(若它不是 `value`/`onChange`,改成它的介面)。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep EngineeringQuoteClient || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add components/engineering-quote/EngineeringQuoteClient.tsx
git commit -m "feat(eng-quote): 報價編輯頁 client 元件"
```

---

## Task 9: 地板報價路由

**Files:**
- Create: `app/floor/quote/page.tsx`
- Create: `app/floor/quote/print/page.tsx`

**前置參考:**
- `app/floor/page.tsx` —— 照抄它的權限 gate(`canUseFloorTool`、admin、`redirect`)。
- `lib/floor/types.ts` 的 `DEFAULT_FLOOR_INPUT`、`FloorInput`。
- `lib/floor/calc.ts` 的 `computeFloorBom`。

- [ ] **Step 1: 報價編輯頁**

Create `app/floor/quote/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT, type FloorInput } from "@/lib/floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { floorBomToEngInput } from "@/lib/floor/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { EngineeringQuoteClient } from "@/components/engineering-quote/EngineeringQuoteClient";

export default async function FloorQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
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

  const { d } = await searchParams;
  let input: FloorInput = DEFAULT_FLOOR_INPUT;
  if (d) {
    try {
      input = decodeState<FloorInput>(d);
    } catch {
      input = DEFAULT_FLOOR_INPUT;
    }
  }

  const bom = computeFloorBom(input);
  const engInput = floorBomToEngInput(bom, ENGINEERING_QUOTE_DEFAULTS);

  return (
    <EngineeringQuoteClient
      quoteType="floor"
      encodedSimInput={d ?? ""}
      overview={<FloorOverviewSvg bom={bom} width={360} />}
      base={{
        pingShu: engInput.pingShu,
        areaM2: engInput.areaM2,
        materialCost: engInput.materialCost,
        materialLines: engInput.materialLines,
      }}
    />
  );
}
```

注意:`canUseFeature` / `UserPlanProfile` 的實際 import 路徑以 `app/floor/page.tsx` 讀到的為準。

- [ ] **Step 2: A4 列印頁**

Create `app/floor/quote/print/page.tsx`:

```tsx
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT, type FloorInput } from "@/lib/floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { floorBomToEngInput } from "@/lib/floor/quote-adapter";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { EngineeringQuotePrint } from "@/components/engineering-quote/EngineeringQuotePrint";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import type { EngQuoteOpts } from "@/components/engineering-quote/EngineeringQuoteForm";

export default async function FloorQuotePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; o?: string; c?: string; viewMode?: string }>;
}) {
  const { d, o, c, viewMode } = await searchParams;

  let input: FloorInput = DEFAULT_FLOOR_INPUT;
  if (d) {
    try {
      input = decodeState<FloorInput>(d);
    } catch {
      /* fallback 預設 */
    }
  }
  const opts: EngQuoteOpts = o
    ? { ...ENGINEERING_QUOTE_DEFAULTS, ...safeDecode<EngQuoteOpts>(o) }
    : ENGINEERING_QUOTE_DEFAULTS;
  const customer: CustomerInfo = c
    ? { ...EMPTY_CUSTOMER, ...safeDecode<CustomerInfo>(c) }
    : EMPTY_CUSTOMER;

  const bom = computeFloorBom(input);
  const engInput = floorBomToEngInput(bom, opts);
  const breakdown = computeEngineeringQuote(engInput);

  return (
    <EngineeringQuotePrint
      quoteType="floor"
      input={engInput}
      breakdown={breakdown}
      customer={customer}
      overview={<FloorOverviewSvg bom={bom} width={300} />}
      viewMode={viewMode === "internal" ? "internal" : "customer"}
    />
  );
}

function safeDecode<T>(s: string): Partial<T> {
  try {
    return decodeState<T>(s);
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: 型別檢查 + build 檢查**

Run: `npx tsc --noEmit 2>&1 | grep "app/floor/quote" || echo "OK"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add app/floor/quote/page.tsx app/floor/quote/print/page.tsx
git commit -m "feat(eng-quote): 地板報價編輯頁 + A4 列印路由"
```

---

## Task 10: 天花板報價路由

**Files:**
- Create: `app/ceiling/quote/page.tsx`
- Create: `app/ceiling/quote/print/page.tsx`

**前置參考:**
- `app/ceiling/page.tsx` —— 照抄它的權限 gate(`canUseCeilingTool`、admin)。
- `lib/ceiling/types.ts` 的 `DEFAULT_CEILING_INPUT`、`CeilingInput`。
- `lib/ceiling/calc.ts` 的 `computeCeilingBom`。
- `lib/ceiling/CeilingOverviewSvg.tsx` 的 `CeilingOverviewSvg({ bom })`。

- [ ] **Step 1: 報價編輯頁**

Create `app/ceiling/quote/page.tsx` —— 與 Task 9 Step 1 結構相同,把 floor 換 ceiling:

```tsx
import { redirect } from "next/navigation";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { computeCeilingBom } from "@/lib/ceiling/calc";
import { DEFAULT_CEILING_INPUT, type CeilingInput } from "@/lib/ceiling/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { ceilingBomToEngInput } from "@/lib/ceiling/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { CeilingOverviewSvg } from "@/lib/ceiling/CeilingOverviewSvg";
import { EngineeringQuoteClient } from "@/components/engineering-quote/EngineeringQuoteClient";

export default async function CeilingQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/ceiling");
  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    if (!canUseFeature(profile as UserPlanProfile | null, "canUseCeilingTool")) {
      redirect("/pricing?upgrade=ceiling");
    }
  }

  const { d } = await searchParams;
  let input: CeilingInput = DEFAULT_CEILING_INPUT;
  if (d) {
    try {
      input = decodeState<CeilingInput>(d);
    } catch {
      input = DEFAULT_CEILING_INPUT;
    }
  }

  const bom = computeCeilingBom(input);
  // 編輯頁初始 materialPerPing = 0,實際值由 client 的費用表單帶
  const engInput = ceilingBomToEngInput(bom, 0, ENGINEERING_QUOTE_DEFAULTS);

  return (
    <EngineeringQuoteClient
      quoteType="ceiling"
      encodedSimInput={d ?? ""}
      overview={<CeilingOverviewSvg bom={bom} />}
      base={{
        pingShu: engInput.pingShu,
        areaM2: engInput.areaM2,
        materialCost: engInput.materialCost,
        materialLines: engInput.materialLines,
      }}
    />
  );
}
```

注意:`app/ceiling/page.tsx` 若用的 permission key 不叫 `canUseCeilingTool`,以實際讀到的為準(memory 記載 ceiling 走 `canUseCeilingTool`/admin)。

- [ ] **Step 2: A4 列印頁**

Create `app/ceiling/quote/print/page.tsx`:

```tsx
import { computeCeilingBom } from "@/lib/ceiling/calc";
import { DEFAULT_CEILING_INPUT, type CeilingInput } from "@/lib/ceiling/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { ceilingBomToEngInput } from "@/lib/ceiling/quote-adapter";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { CeilingOverviewSvg } from "@/lib/ceiling/CeilingOverviewSvg";
import { EngineeringQuotePrint } from "@/components/engineering-quote/EngineeringQuotePrint";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import type { EngQuoteOpts } from "@/components/engineering-quote/EngineeringQuoteForm";

export default async function CeilingQuotePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; o?: string; c?: string; viewMode?: string }>;
}) {
  const { d, o, c, viewMode } = await searchParams;

  let input: CeilingInput = DEFAULT_CEILING_INPUT;
  if (d) {
    try {
      input = decodeState<CeilingInput>(d);
    } catch {
      /* fallback */
    }
  }
  const opts: EngQuoteOpts = o
    ? { ...ENGINEERING_QUOTE_DEFAULTS, ...safeDecode<EngQuoteOpts>(o) }
    : ENGINEERING_QUOTE_DEFAULTS;
  const customer: CustomerInfo = c
    ? { ...EMPTY_CUSTOMER, ...safeDecode<CustomerInfo>(c) }
    : EMPTY_CUSTOMER;

  const bom = computeCeilingBom(input);
  const engInput = ceilingBomToEngInput(bom, opts.ceilingMaterialPerPing, opts);
  const breakdown = computeEngineeringQuote(engInput);

  return (
    <EngineeringQuotePrint
      quoteType="ceiling"
      input={engInput}
      breakdown={breakdown}
      customer={customer}
      overview={<CeilingOverviewSvg bom={bom} />}
      viewMode={viewMode === "internal" ? "internal" : "customer"}
    />
  );
}

function safeDecode<T>(s: string): Partial<T> {
  try {
    return decodeState<T>(s);
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep "app/ceiling/quote" || echo "OK"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add app/ceiling/quote/page.tsx app/ceiling/quote/print/page.tsx
git commit -m "feat(eng-quote): 天花板報價編輯頁 + A4 列印路由"
```

---

## Task 11: 模擬器加「產生報價單」按鈕

**Files:**
- Modify: `app/floor/FloorDevClient.tsx`
- Modify: `app/ceiling/CeilingDevClient.tsx`

- [ ] **Step 1: 地板按鈕**

在 `app/floor/FloorDevClient.tsx`:
1. 頂部 import 區加:`import { encodeState } from "@/lib/engineering-quote/url-codec";` 與 `import { useRouter } from "next/navigation";`
2. 元件函式內、`input` state 宣告附近加:`const router = useRouter();`
3. 在結果面板(右側 sticky 區、`bom.trace.plankRows` 那段附近)加一顆按鈕:

```tsx
<button
  onClick={() =>
    router.push(`/floor/quote?d=${encodeURIComponent(encodeState(input))}`)
  }
  className="mt-3 w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white"
>
  🧾 產生報價單
</button>
```

放在右側結果面板內、損耗顯示行的下方(讀檔案找 `bom.trace.wastePercent` 那一行,按鈕加在它所在區塊的尾端)。

- [ ] **Step 2: 天花板按鈕**

在 `app/ceiling/CeilingDevClient.tsx`:
1. import 區加:`import { encodeState } from "@/lib/engineering-quote/url-codec";`(`useRouter` 若尚未 import 則一併加)
2. 元件內加 `const router = useRouter();`(若已有則略)
3. 在結果 / BOM 面板區塊尾端加同款按鈕:

```tsx
<button
  onClick={() =>
    router.push(`/ceiling/quote?d=${encodeURIComponent(encodeState(input))}`)
  }
  className="mt-3 w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white"
>
  🧾 產生報價單
</button>
```

說明:`computeCeilingBom(rawInput: CeilingInput)` 只吃 `CeilingInput`(見 `lib/ceiling/calc.ts:41`),BOM 與 fixtures 無關,所以只編碼 `input`。這與 Task 10 page 解碼 `CeilingInput` 一致。

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit 2>&1 | grep -E "FloorDevClient|CeilingDevClient" || echo "OK"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add app/floor/FloorDevClient.tsx app/ceiling/CeilingDevClient.tsx
git commit -m "feat(eng-quote): 地板/天花板模擬器加「產生報價單」按鈕"
```

---

## Task 12: 全案驗證

**Files:** 無(只驗證)

- [ ] **Step 1: 跑所有工程報價測試**

Run:
```bash
npx tsx lib/engineering-quote/calc.test.ts
npx tsx lib/engineering-quote/url-codec.test.ts
npx tsx lib/engineering-quote/adapters.test.ts
```
Expected: 三個都印 `✅ ... passed`,無 `❌`。

- [ ] **Step 2: 跑既有地板 / 天花板測試確認沒被影響**

Run:
```bash
npx tsx lib/floor/calc.test.ts
npx tsx lib/ceiling/calc.test.ts
```
Expected: 維持原本全過(`✅`)。

- [ ] **Step 3: 全專案型別檢查**

Run: `npx tsc --noEmit`
Expected: 無 `engineering-quote` / `app/floor/quote` / `app/ceiling/quote` / `components/engineering-quote` 相關錯誤。(專案既有的無關錯誤 —— 例如 `scripts/verify-bottom-chamfer-geom.ts` —— 不在本案範圍,不需處理。)

- [ ] **Step 4: 家具報價迴歸確認**

Run: `git diff --name-only main -- lib/pricing app/design`
Expected: **無輸出** —— 證明家具報價路徑完全沒被動到。

- [ ] **Step 5: build 冒煙測試**

Run: `npx next build 2>&1 | tail -20`
Expected: build 成功,出現 `/floor/quote`、`/floor/quote/print`、`/ceiling/quote`、`/ceiling/quote/print` 四條新路由。

- [ ] **Step 6: 最終 commit(若 build 過程產生需修正的小問題)**

```bash
git add -A
git commit -m "chore(eng-quote): 全案驗證修正" || echo "無修正,略過"
```

---

## 完成後

- 全部 12 task 完成後,工程報價功能即可用:`/floor` 與 `/ceiling` 各有「🧾 產生報價單」鈕 → 報價編輯頁 → A4 列印。
- 家具報價(`lib/pricing/quote.ts`、`/design/[type]/quote`)完全未動。
- 部署:`git push origin main`(Vercel 自動部署)—— 由使用者確認後再推。
