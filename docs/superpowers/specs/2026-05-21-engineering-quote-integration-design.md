# 工程報價整合設計 — 地板/天花板模擬器接入報價系統

- 日期:2026-05-21
- 範圍:把地板模擬器(`/floor`)與天花板模擬器(`/ceiling`)整合進報價系統,
  讓兩者都能各自產生一張正式 A4 報價單。
- 採用方案:**方案 C — 工程報價共用模組,家具報價完全不動**。

## 1. 背景與現況

| 項目 | 現況 |
|---|---|
| 家具報價 | `lib/pricing/quote.ts` 的 `calculateQuote(design)` → 完整 A4 報價單;緊耦合 `FurnitureDesign`(零件/材料/類別)。**本案不動此路徑。** |
| 地板模擬器 | `computeFloorBom()` 已有基礎材料估價(地板片/踢腳板/防潮墊 各自每坪單價),`FloorBom.cost` 有 `total` 與 `hasUnpriced`。無工資/毛利/稅/客戶/A4。`auto.pingShu` 已算坪數。狀態用 `useState`,無 URL 序列化。 |
| 天花板模擬器 | `computeCeilingBom()` 有 BOM(角材/吊筋/矽酸鈣板),**完全無價格欄位**。`auto.pingShu` 已算坪數。已有 `customer` 狀態 + `/api/ceiling/share` 分享碼系統。 |
| 權限 | 地板 = `canUseFloorTool`(個人版以上);天花板 = `canUseCeilingTool` / admin。 |

## 2. 需求(經使用者確認)

1. **整合形式**:各自獨立報價單 — 地板、天花板各有「產生報價單」鈕,
   套同一套 A4 報價單模板(客戶/品牌/條款/訂金尾款),品項換成各自工程。
2. **施工費模型**:每坪施工費(裝潢慣例)— 使用者輸入每坪工錢 × 坪數;
   材料與施工費分開計。
3. **天花板材料價**:每坪材料估價 — 整個天花板材料用「每坪材料費」一個數字。
4. **附加品項**:除「材料 + 每坪施工費 + 毛利 + 營業稅」外,另含
   拆除清運費、運費、雜項耗材、天花板批土油漆。

## 3. 架構

家具報價與工程報價的成本模型本質不同(工時 vs 每坪),不共用 calculator。
地板與天花板的成本模型**完全相同**,共用一個工程報價模組。

```
lib/engineering-quote/          ← 地板 + 天花板共用報價核心
├── types.ts                    EngineeringQuoteInput / EngineeringQuoteBreakdown / EngLineItem
├── calc.ts                     computeEngineeringQuote(input): EngineeringQuoteBreakdown
├── defaults.ts                 ENGINEERING_QUOTE_DEFAULTS
└── calc.test.ts                tsx 驗證腳本

lib/floor/quote-adapter.ts      floorBomToEngInput(bom, opts): EngineeringQuoteInput
lib/ceiling/quote-adapter.ts    ceilingBomToEngInput(bom, materialPerPing, opts): EngineeringQuoteInput

components/engineering-quote/
├── EngineeringQuoteClient.tsx  報價編輯頁(client component)
├── EngineeringQuoteForm.tsx    費用參數輸入(每坪施工費/拆除/運費/雜項/毛利/折扣/有效期)
└── EngineeringQuotePrint.tsx   A4 列印版(地板天花板共用)

app/floor/quote/page.tsx
app/floor/quote/print/page.tsx
app/ceiling/quote/page.tsx
app/ceiling/quote/print/page.tsx
```

`lib/pricing/quote.ts` 與 `app/design/[type]/quote/**` **完全不動**(零迴歸風險)。

## 4. 資料模型

### 4.1 EngineeringQuoteInput

與材料無關、以坪為基準:

```ts
type EngQuoteType = "floor" | "ceiling";

interface EngLineItem {
  label: string;
  detail?: string;
  amount: number;          // NT$;未報價時為 0,搭配 unpriced 旗標
  unpriced?: boolean;      // true → 列印顯示「未報價」灰字
}

interface EngineeringQuoteInput {
  quoteType: EngQuoteType;
  pingShu: number;                 // 坪數,由 BOM 帶入,UI 唯讀
  areaM2: number;

  // 材料:地板 = BOM 加總;天花板 = 每坪材料 × 坪數
  materialCost: number;
  materialLines: EngLineItem[];     // 材料明細(顯示用)

  // 每坪施工費
  laborPricePerPing: number;

  // 拆除清運
  demolitionMode: "lump" | "perPing";
  demolitionLump: number;
  demolitionPerPing: number;

  // 運費(定額)
  shippingCost: number;

  // 雜項耗材
  consumablesMode: "lump" | "percent";
  consumablesLump: number;
  consumablesPercent: number;       // 對 materialCost 取百分比

  // 天花板批土油漆(每坪);quoteType="floor" 時固定 0、不出現此行
  paintingPerPing: number;

  marginRate: number;               // 毛利率 0–1
  vatRate: number;                  // 營業稅率,預設 0.05
  discountRate: number;             // 折扣率 0–0.5
  depositRate: number;              // 訂金比例,預設 0.3
  validityDays: number;             // 報價有效天數
}
```

### 4.2 EngineeringQuoteBreakdown

```ts
interface EngineeringQuoteBreakdown {
  materialCost: number;
  laborCost: number;          // laborPricePerPing × pingShu
  demolitionCost: number;
  shippingCost: number;
  consumablesCost: number;
  paintingCost: number;       // floor 恆為 0
  costSubtotal: number;
  margin: number;             // costSubtotal × marginRate
  subtotalExclVat: number;    // costSubtotal + margin
  discountAmount: number;     // subtotalExclVat × discountRate
  subtotalAfterDiscount: number;
  vat: number;                // subtotalAfterDiscount × vatRate
  total: number;
  depositAmount: number;      // total × depositRate
  balanceAmount: number;      // total − depositAmount
  validUntil: string;         // 報價日 + validityDays(台北日期)
  lines: EngLineItem[];        // 完整品項表(材料明細 + 各費用行)
  hasUnpriced: boolean;        // 任一必要單價 = 0 → true
}
```

### 4.3 計算順序(`computeEngineeringQuote`)

```
materialCost
+ laborCost          = laborPricePerPing × pingShu
+ demolitionCost     = mode==="lump" ? demolitionLump : demolitionPerPing × pingShu
+ shippingCost
+ consumablesCost    = mode==="lump" ? consumablesLump : materialCost × consumablesPercent
+ paintingCost       = quoteType==="ceiling" ? paintingPerPing × pingShu : 0
= costSubtotal
+ margin             = costSubtotal × marginRate
= subtotalExclVat
− discountAmount     = subtotalExclVat × discountRate
= subtotalAfterDiscount
+ vat                = subtotalAfterDiscount × vatRate
= total
depositAmount        = round(total × depositRate)
balanceAmount        = total − depositAmount
```

**不做數量 × N** — 工程是單一案場、按坪計,沒有件數概念。

## 5. Adapter

### 5.1 floorBomToEngInput(bom: FloorBom, opts)

- `pingShu` = `bom.auto.pingShu`、`areaM2` = `bom.auto.roomAreaM2`
- `materialCost` = `bom.cost.total`(地板片 + 踢腳板 + 防潮墊)
- `materialLines` = 由 `bom.items` 轉出(每項 label/detail/subtotal,subtotal 未設 → `unpriced`)
- `paintingPerPing` = 0
- 其餘費用參數由 `opts`(使用者在報價表單輸入)帶入

### 5.2 ceilingBomToEngInput(bom: CeilingBom, materialPerPing, opts)

- `pingShu` = `bom.auto.pingShu`、`areaM2` = `bom.auto.roomAreaM2`
- `materialCost` = `materialPerPing × pingShu`
- `materialLines` = 一行「天花板系統材料 每坪 NT$X × N 坪」,
  `detail` 附 BOM 數量摘要(角材 N 支、吊筋 N 組、矽酸鈣板 N 張)供核對
- 其餘由 `opts` 帶入

## 6. 流程與 UI

### 6.1 產生報價單

`/floor`、`/ceiling` 各加一顆「🧾 產生報價單」按鈕:
- 把當前模擬器 input 以 `base64(JSON)` 編碼進 URL 參數 `?d=...`
- 導到 `/floor/quote?d=...` 或 `/ceiling/quote?d=...`
- 不需新 API、不需 DB(報價頁無狀態,純由 URL 還原)

### 6.2 報價編輯頁(`/floor/quote`、`/ceiling/quote`)

- server component 解析 `?d=` → 還原 input → 算 BOM → 套 adapter
- render `<EngineeringQuoteClient>`:
  - 左:客戶表單(重用 `components/customer` 的 `CustomerInfo` / `EMPTY_CUSTOMER`)
    + `<EngineeringQuoteForm>` 費用參數輸入
  - 右:即時試算工程品項表 + 平面圖縮圖(`FloorOverviewSvg` / `CeilingOverviewSvg`)
  - 「列印報價單」按鈕 → 導到 `/quote/print`,URL 帶齊三類參數:
    `?d=`(模擬器 input,base64 JSON)、費用參數(每坪施工費/拆除/運費/雜項/
    毛利/折扣/有效期,逐欄帶)、客戶欄位(`customerName` 等,沿用家具報價的
    URL query 慣例)
- 權限 gate:沿用各自模擬器(floor=`canUseFloorTool`、ceiling=`canUseCeilingTool`/admin)

### 6.3 A4 列印頁(`/floor/quote/print`、`/ceiling/quote/print`)

server component 解析 URL 三類參數 → 還原 BOM + adapter + 費用參數 + 客戶 →
thin wrapper → render 共用 `<EngineeringQuotePrint>`(列印頁無狀態,純由 URL 還原):
- 第 1 頁:品牌表頭(`BrandedHeader`)+ 供應商 + 客戶 TO + 平面圖 + 坪數
  + 工程品項表 + 總計
- 第 2 頁(`.quote-page-break`):`BrandedTermsBlocks` 條款 + 簽章 + footer
- 平面圖以 `quoteType` 切換 `FloorOverviewSvg` / `CeilingOverviewSvg`

## 7. 邊界處理

- **價格未設(=0)**:該品項 `unpriced=true`,列印顯示「未報價」灰字;
  `hasUnpriced` 為 true 時總計區加註「⚠️ 估價不完整」(沿用地板現有模式)。
- **坪數唯讀**:由 BOM `auto.pingShu` 帶入,UI 不可手改(避免與算料脫鉤)。
- **地板無批土油漆**:`quoteType="floor"` 時 `paintingCost=0` 且品項表不出現該行。
- **viewMode**:`?viewMode=customer|internal` 沿用家具報價語意 —
  客戶版隱藏成本明細與毛利,內部版全拆解。
- **空房間 / 坪數 0**:adapter 回傳的 input pingShu 可能為 0 →
  各 ×坪數 項為 0,報價頁正常顯示但 `hasUnpriced` 提示。

## 8. 測試

- `lib/engineering-quote/calc.test.ts`(tsx 腳本,沿用 floor/ceiling 既有測試風格):
  - 總計 = 各項加總(材料+施工+拆除+運費+雜項+批土+毛利−折扣+稅)
  - 訂金 + 尾款 = 總計
  - 毛利率 / 稅率 / 折扣率套用正確
  - `quoteType="floor"` → `paintingCost` 恆為 0
  - 拆除 lump/perPing 兩模式、雜項 lump/percent 兩模式各驗一次
- 兩個 adapter 各跑一次 fixture(floor 用 `FIXTURE_RECT`,ceiling 用其既有 fixture):
  驗證 `materialCost`、`pingShu`、`materialLines` 正確轉出。
- `npx tsc --noEmit` 0 錯誤。

## 9. 不在本案範圍(YAGNI)

- 不改家具報價(`lib/pricing/quote.ts`、`/design/[type]/quote`)。
- 不做家具+地板+天花板的混合整案報價單。
- 不做數量 × N。
- 不新增 DB 表或 share API(報價頁無狀態,純 URL 還原);
  天花板既有 `/api/ceiling/share` 維持原樣、與報價交接無關。
- 報價歷史(`QuoteHistory`)是否接工程報價 → 後續再評估,本案不做。
