import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import {
  calculateQuote,
  generateQuoteNumber,
  addWorkdays,
} from "@/lib/pricing/quote";
import { MATERIAL_PRICE_PER_BDFT, formatTWD } from "@/lib/pricing/catalog";
import { BrandingForm } from "@/components/branding/BrandingForm";
import { BrandedTermsBlocks } from "@/components/branding/BrandedTerms";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import { CsvExportButton } from "@/components/CsvExportButton";
import { QuoteLaborForm } from "@/components/quote/QuoteLaborForm";
import { QuoteShareActions } from "@/components/quote/QuoteShareActions";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { QuoteHistory } from "@/components/QuoteHistory";
import { QuoteAccessGate } from "@/components/QuoteAccessGate";
import { parseOptionsFromQuery } from "@/lib/templates/parse-options";
import { CompactThreeViews } from "@/lib/render/svg-views";

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<{
    length?: string;
    width?: string;
    height?: string;
    material?: string;
    hourlyRate?: string;
    equipmentRate?: string;
    consumables?: string;
    finishingCost?: string;
    shippingCost?: string;
    installationCost?: string;
    hardwareCost?: string;
    marginRate?: string;
    vatRate?: string;
    quantity?: string;
    discountRate?: string;
    expiryDays?: string;
    depositRate?: string;
    bufferDays?: string;
    termIncludeShipping?: string;
    termIncludeInstallation?: string;
    overrideUnitPrice?: string;
    laborHoursOverride?: string;
    primaryMaterialPricePerBdft?: string;
    plywoodPricePerBdft?: string;
    mdfPricePerBdft?: string;
    customerName?: string;
    customerContact?: string;
    customerPhone?: string;
    customerAddress?: string;
    customerTaxId?: string;
    customerEmail?: string;
    viewMode?: string;
    quotedAt?: string;
  }>;
}

function parseNum(s: string | undefined, fallback: number): number {
  const n = s ? parseFloat(s) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 可空單價解析：
 *   undefined（沒傳 param）    → fallback（預填初始值）
 *   空字串（使用者清空欄位）    → null（併入主材）
 *   0 或負數                   → null（使用者打 0 等同不另計）
 *   有值                       → 數字
 */
function parseOptNum(
  s: string | undefined,
  fallback: number | null,
): number | null {
  if (s === undefined) return fallback;
  if (s.trim() === "") return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return null;
  return n;
}

export default async function QuotePage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  const length = parseInt(sp.length ?? "") || entry.defaults.length;
  const width = parseInt(sp.width ?? "") || entry.defaults.width;
  const height = parseInt(sp.height ?? "") || entry.defaults.height;
  const material = (sp.material as MaterialId) ?? "maple";

  const catalogPrimaryPrice = MATERIAL_PRICE_PER_BDFT[material] ?? 300;

  const laborOpts = {
    hourlyRate: parseNum(sp.hourlyRate, LABOR_DEFAULTS.hourlyRate),
    equipmentRate: parseNum(sp.equipmentRate, LABOR_DEFAULTS.equipmentRate),
    consumables: parseNum(sp.consumables, LABOR_DEFAULTS.consumables),
    finishingCost: parseNum(sp.finishingCost, LABOR_DEFAULTS.finishingCost),
    shippingCost: parseNum(sp.shippingCost, LABOR_DEFAULTS.shippingCost),
    installationCost: parseNum(sp.installationCost, LABOR_DEFAULTS.installationCost),
    hardwareCost: parseNum(sp.hardwareCost, LABOR_DEFAULTS.hardwareCost),
    marginRate: parseNum(sp.marginRate, LABOR_DEFAULTS.marginRate),
    vatRate: parseNum(sp.vatRate, LABOR_DEFAULTS.vatRate),
    quantity: parseNum(sp.quantity, LABOR_DEFAULTS.quantity),
    discountRate: parseNum(sp.discountRate, LABOR_DEFAULTS.discountRate),
    expiryDays: parseNum(sp.expiryDays, LABOR_DEFAULTS.expiryDays),
    depositRate: parseNum(sp.depositRate, LABOR_DEFAULTS.depositRate),
    bufferDays: parseNum(sp.bufferDays, LABOR_DEFAULTS.bufferDays),
    overrideUnitPrice: parseNum(sp.overrideUnitPrice, LABOR_DEFAULTS.overrideUnitPrice),
    laborHoursOverride: parseNum(sp.laborHoursOverride, LABOR_DEFAULTS.laborHoursOverride),
    primaryMaterialPricePerBdft: parseNum(
      sp.primaryMaterialPricePerBdft,
      catalogPrimaryPrice,
    ),
    plywoodPricePerBdft: parseOptNum(
      sp.plywoodPricePerBdft,
      LABOR_DEFAULTS.plywoodPricePerBdft,
    ),
    mdfPricePerBdft: parseOptNum(
      sp.mdfPricePerBdft,
      LABOR_DEFAULTS.mdfPricePerBdft,
    ),
  };

  // 模板 options（legStyle / 倒角 / 內縮腳…）必須一起讀，否則 quote 頁
  // 重建 design 用 defaults，跟設計頁顯示的版本不一樣。
  const optionSchema = entry.optionSchema ?? [];
  const options = parseOptionsFromQuery(
    optionSchema,
    sp as Record<string, string | string[] | undefined>,
  );

  const design = entry.template({ length, width, height, material, options });
  const quote = calculateQuote(design, laborOpts);

  const customer: CustomerInfo = {
    name: sp.customerName ?? "",
    contact: sp.customerContact ?? "",
    phone: sp.customerPhone ?? "",
    address: sp.customerAddress ?? "",
    taxId: sp.customerTaxId ?? "",
    email: sp.customerEmail ?? "",
  };

  // quotedAt: 從 URL 派生（穩定）；沒帶就用今天。share 時 QuoteShareActions
  // 會把當下 quotedAt 寫進 URL，客人收到的連結 expiry 不會漂移。
  const quotedAtRaw = sp.quotedAt && /^\d{4}-\d{2}-\d{2}$/.test(sp.quotedAt) ? sp.quotedAt : null;
  const today = quotedAtRaw ? new Date(quotedAtRaw + "T00:00:00") : new Date();
  const todayIso = today.toISOString().slice(0, 10);
  // quoteNo 加客戶+規格 hash 防同日撞號
  const contextForNo = `${customer.name}|${length}x${width}x${height}|${material}`;
  const quoteNo = generateQuoteNumber(design.id, contextForNo, today);
  const viewMode: "customer" | "internal" =
    sp.viewMode === "internal" ? "internal" : "customer";
  const termIncludeShipping = sp.termIncludeShipping === "1";
  const termIncludeInstallation = sp.termIncludeInstallation === "1";

  // designQuery 必須含 template options，否則 QuoteLaborForm 隱藏 input 漏帶，
  // 客戶從 LINE 連結點進去的 print 頁會用 default options 重建設計（價格也會錯）。
  const designParams = new URLSearchParams();
  designParams.set("length", String(length));
  designParams.set("width", String(width));
  designParams.set("height", String(height));
  designParams.set("material", material);
  for (const spec of optionSchema) {
    designParams.set(spec.key, String(options[spec.key]));
  }
  const designQuery = designParams.toString();
  const laborQuery = `hourlyRate=${laborOpts.hourlyRate}&equipmentRate=${laborOpts.equipmentRate}&consumables=${laborOpts.consumables}&finishingCost=${laborOpts.finishingCost}&shippingCost=${laborOpts.shippingCost}&installationCost=${laborOpts.installationCost}&hardwareCost=${laborOpts.hardwareCost}&marginRate=${laborOpts.marginRate}&vatRate=${laborOpts.vatRate}&quantity=${laborOpts.quantity}&discountRate=${laborOpts.discountRate}&expiryDays=${laborOpts.expiryDays}&depositRate=${laborOpts.depositRate}&bufferDays=${laborOpts.bufferDays}&overrideUnitPrice=${laborOpts.overrideUnitPrice}&laborHoursOverride=${laborOpts.laborHoursOverride}&primaryMaterialPricePerBdft=${laborOpts.primaryMaterialPricePerBdft}&plywoodPricePerBdft=${laborOpts.plywoodPricePerBdft ?? ""}&mdfPricePerBdft=${laborOpts.mdfPricePerBdft ?? ""}`;
  const customerQuery = new URLSearchParams({
    customerName: customer.name,
    customerContact: customer.contact,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    customerTaxId: customer.taxId,
    customerEmail: customer.email,
  }).toString();
  const termQuery = `termIncludeShipping=${termIncludeShipping ? "1" : "0"}&termIncludeInstallation=${termIncludeInstallation ? "1" : "0"}`;
  const fullQuery = `${designQuery}&${laborQuery}&${customerQuery}&viewMode=${viewMode}&${termQuery}&quotedAt=${todayIso}`;

  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + Math.round(laborOpts.expiryDays));
  const expiryIso = expiry.toISOString().slice(0, 10);
  const deliveryIso = addWorkdays(today, quote.estimatedWorkdays)
    .toISOString()
    .slice(0, 10);

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href={`/design/${type}?${designQuery}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← 回{entry.nameZh}設計
      </Link>

      <QuoteAccessGate>
      <header className="mt-2 mb-4 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {entry.nameZh}
            <span className="ml-2 text-sm font-normal text-zinc-500">客製報價</span>
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {length} × {width} × {height} mm · {MATERIALS[material].nameZh}
            <span className="ml-2 text-zinc-400">#{quoteNo}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle current={viewMode} />
          <QuoteShareActions
            design={design}
            type={type}
            furnitureNameZh={entry.nameZh}
            dimensionsLabel={`${length} × ${width} × ${height} mm`}
            materialName={MATERIALS[material].nameZh}
          />
        </div>
      </header>

      {/* 三視圖預覽：放在 header 下方，給客戶/木頭仁立即視覺確認 */}
      <section className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
        <div className="text-[10px] text-zinc-500 mb-2 font-medium tracking-wider">
          📐 設計預覽（三視圖）
        </div>
        <div className="max-h-40 overflow-hidden">
          <CompactThreeViews design={design} />
        </div>
      </section>

      {/* 主視覺：表單 ↔ 總價卡 並排 */}
      <section className="grid lg:grid-cols-[3fr_2fr] gap-4">
        <QuoteLaborForm
          type={type}
          designQuery={designQuery}
          defaults={laborOpts}
          primaryMaterialName={MATERIALS[material].nameZh}
          initialCustomer={customer}
          terms={{ termIncludeShipping, termIncludeInstallation }}
          viewMode={viewMode}
          quotedAt={todayIso}
        />

        {/* 右側：總價摘要卡（lg 以上 sticky） */}
        <aside className="lg:sticky lg:top-4 self-start space-y-3">
          <div className="rounded-xl border-2 border-zinc-900 bg-white overflow-hidden shadow-sm">
            <div className="bg-zinc-900 text-white px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider opacity-70">
                {laborOpts.vatRate > 0 ? "含稅總計" : "總計"}
              </div>
              <div className="mt-0.5 text-3xl font-mono font-bold">
                {formatTWD(quote.total)}
              </div>
              {quote.quantity > 1 && (
                <div className="text-[10px] opacity-70 mt-0.5">
                  {quote.quantity} 件 · 單件 {formatTWD(quote.unitPriceExclVat)}（未稅）
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-zinc-200 border-b border-zinc-200">
              <div className="p-3">
                <div className="text-[10px] text-emerald-700 font-medium">
                  訂金（{(laborOpts.depositRate * 100).toFixed(0)}%）
                </div>
                <div className="mt-0.5 text-base font-mono font-semibold text-emerald-900">
                  {formatTWD(quote.depositAmount)}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[10px] text-zinc-600 font-medium">
                  尾款（{((1 - laborOpts.depositRate) * 100).toFixed(0)}%）
                </div>
                <div className="mt-0.5 text-base font-mono font-semibold text-zinc-900">
                  {formatTWD(quote.balanceAmount)}
                </div>
              </div>
            </div>
            <div className="p-3 bg-sky-50">
              <div className="text-[10px] text-sky-700 font-medium">預計交期</div>
              <div className="mt-0.5 text-base font-mono font-semibold text-sky-900">
                {deliveryIso}
              </div>
              <div className="text-[10px] text-sky-700 mt-0.5">
                實做 {quote.buildWorkdays} 天
                {quote.quantity > 1 && `（${quote.quantity} 件合計）`}
                {quote.bufferDays > 0 && ` + 乾燥/出貨 ${quote.bufferDays} 天`}
                {" · "}工時 {quote.laborHours.toFixed(1)}h（6hr/天）
              </div>
            </div>
            {/* 有效期：併入 sticky 卡片底部，手機版也看得到 */}
            <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-200 text-[10px] text-zinc-600 flex items-center justify-between">
              <span>📅 報價有效至 {expiryIso}</span>
              <span className="text-zinc-400">({laborOpts.expiryDays} 天)</span>
            </div>
          </div>
        </aside>
      </section>

      {/* Sanity 警告：工時=0 / 毛利為負（議價低於成本） */}
      {(quote.laborHours < 1 || (laborOpts.overrideUnitPrice > 0 && quote.margin < 0)) && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          <div className="font-semibold mb-0.5">⚠️ 報價檢查</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {quote.laborHours < 1 && (
              <li>工時極低（{quote.laborHours.toFixed(1)}h）— 可能 template 估算異常，建議手動覆寫工時</li>
            )}
            {laborOpts.overrideUnitPrice > 0 && quote.margin < 0 && (
              <li>議價 {formatTWD(laborOpts.overrideUnitPrice)} 低於成本 {formatTWD(quote.costSubtotal)}，賠 {formatTWD(-quote.margin)}/件</li>
            )}
          </ul>
        </div>
      )}

      {/* 成本明細（折疊）— 僅內部模式可見，客戶版完全隱藏 */}
      {viewMode === "internal" && (
      <details open className="mt-6 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800">
            📊 成本明細（內部）— 材料 + 工資 + 毛利 拆解
          </span>
          <span className="text-xs text-zinc-400 flex items-center gap-3">
            <CsvExportButton design={design} />
            <span>展開 / 收合</span>
          </span>
        </summary>
        <table className="w-full text-sm border-t border-zinc-200">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left p-3">項目</th>
              <th className="text-left p-3">計算方式</th>
              <th className="text-right p-3 w-40">金額</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="p-3 font-medium">{line.label}</td>
                <td className="p-3 text-zinc-600 text-xs">{line.detail}</td>
                <td className="p-3 text-right font-mono">
                  {formatTWD(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-50">
            <tr className="border-t-2 border-zinc-300">
              <td className="p-3 font-medium" colSpan={2}>
                單件成本小計
              </td>
              <td className="p-3 text-right font-mono">
                {formatTWD(quote.costSubtotal)}
              </td>
            </tr>
            <tr>
              <td className="p-3 text-zinc-600" colSpan={2}>
                {laborOpts.overrideUnitPrice > 0 ? (
                  <span>
                    毛利
                    <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 rounded">
                      議價後實際 {((quote.margin / quote.costSubtotal) * 100).toFixed(1)}%
                    </span>
                  </span>
                ) : (
                  `毛利（${Math.round(laborOpts.marginRate * 100)}%）`
                )}
              </td>
              <td
                className={`p-3 text-right font-mono ${
                  quote.margin < 0 ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {quote.margin < 0 ? "" : "+ "}
                {formatTWD(quote.margin)}
              </td>
            </tr>
            <tr className="border-t border-zinc-300">
              <td className="p-3 font-semibold" colSpan={2}>
                單件未稅報價
              </td>
              <td className="p-3 text-right font-mono font-semibold">
                {formatTWD(quote.unitPriceExclVat)}
              </td>
            </tr>
            {quote.quantity > 1 && (
              <tr>
                <td className="p-3 text-zinc-600" colSpan={2}>
                  數量 × {quote.quantity}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatTWD(quote.subtotalBeforeDiscount)}
                </td>
              </tr>
            )}
            {quote.discountAmount > 0 && (
              <tr>
                <td className="p-3 text-red-600" colSpan={2}>
                  折扣（{(laborOpts.discountRate * 100).toFixed(0)}% off）
                </td>
                <td className="p-3 text-right font-mono text-red-600">
                  − {formatTWD(quote.discountAmount)}
                </td>
              </tr>
            )}
            {(quote.quantity > 1 || quote.discountAmount > 0) && (
              <tr className="border-t border-zinc-300">
                <td className="p-3 font-semibold" colSpan={2}>
                  報價（未稅）
                </td>
                <td className="p-3 text-right font-mono font-semibold text-lg">
                  {formatTWD(quote.subtotalExclVat)}
                </td>
              </tr>
            )}
            {laborOpts.vatRate > 0 && (
              <>
                <tr>
                  <td className="p-3 text-zinc-600" colSpan={2}>
                    營業稅（{(laborOpts.vatRate * 100).toFixed(0)}%）
                  </td>
                  <td className="p-3 text-right font-mono">
                    + {formatTWD(quote.vat)}
                  </td>
                </tr>
                <tr className="border-t-2 border-zinc-900 bg-zinc-900 text-white">
                  <td className="p-3 font-bold" colSpan={2}>
                    含稅總計
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-lg">
                    {formatTWD(quote.total)}
                  </td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </details>
      )}

      {/* 付款條件 / 保固 / 售後（從 BrandingData 渲染，與 print 一致） */}
      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
        <BrandedTermsBlocks
          depositRate={laborOpts.depositRate}
          depositAmount={quote.depositAmount}
          balanceAmount={quote.balanceAmount}
          deliveryWorkdays={quote.estimatedWorkdays}
        />
      </div>

      {/* 不含項目醒目警示（不可折疊，避免客戶錯誤期待） */}
      <div className="mt-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
        <div className="text-xs font-semibold text-amber-900 mb-1.5">
          ⚠️ 本報價不含
        </div>
        <ul className="list-disc pl-5 space-y-0.5 text-xs text-amber-900 leading-relaxed">
          <li>跨區運費（基隆以外）</li>
          <li>現場安裝、上牆、水平調整</li>
          <li>五金件：滑軌、鉸鏈、把手、鎖具（如有需求另計）</li>
          <li>確認下訂後變更設計／尺寸／材質：每次需重新報價並酌收變更費</li>
        </ul>
      </div>

      {/* 公司抬頭 / 付款條件（折疊） */}
      <BrandingForm />

      {/* 最近報價（自帶 details，預設折疊） */}
      <QuoteHistory
        current={{
          customerName: customer.name,
          furnitureName: entry.nameZh,
          query: fullQuery,
          total: quote.total,
          quoteNo,
        }}
      />

      {/* 報價說明（折疊） */}
      <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-amber-900 font-medium hover:bg-amber-100">
          ℹ️ 報價說明（材料計法、工時來源）
        </summary>
        <ul className="px-4 pb-3 pt-1 list-disc pl-9 space-y-0.5 text-xs text-amber-900 leading-relaxed">
          <li>材料以「板才」計（1 板才 = 1&quot; × 12&quot; × 12&quot; ≈ 2,360 cm³ ≈ 8.5 台才），已含切料損耗（小件 25%、一般家具 10%）</li>
          <li>工時從製作工序與倒角加工自動加總；如案件難度高/客戶有特殊要求，可在表單「工時覆寫」直接打總工時</li>
          <li>一個工作天以實際產出 6 小時計（扣除溝通、整理工作台、換刀、休息等隱形時間）</li>
          <li>本工具估算值僅供參考，實際報價請師傅依現場條件微調</li>
        </ul>
      </details>
      </QuoteAccessGate>
    </main>
  );
}

