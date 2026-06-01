import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/supabase/server";
import { isPaidUser } from "@/lib/userProfile";
import { getTemplate, getEntryName, getEntryDescription } from "@/lib/templates";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS, materialName } from "@/lib/materials";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import { taipeiIsoDate } from "@/lib/utils/date-tw";
import {
  calculateQuote,
  generateQuoteNumber,
  addWorkdays,
} from "@/lib/pricing/quote";
import { MATERIAL_PRICE_PER_BDFT, formatMoney } from "@/lib/pricing/catalog";
import { getCurrencyFromCookies } from "@/lib/units/server-currency";
import { PrintButton } from "@/components/print/PrintButton";
import { BrandedHeader } from "@/components/branding/BrandedHeader";
import {
  BrandedFooter,
  BrandedSignature,
  BrandedSupplier,
} from "@/components/branding/BrandedSupplier";
import {
  BrandedNotes,
  BrandedTermsBlocks,
} from "@/components/branding/BrandedTerms";
import { ZoomableThreeViews } from "@/components/quote/ZoomableThreeViews";
import { QrCode } from "@/components/print/QrCode";
import { parseOptionsFromQuery } from "@/lib/templates/parse-options";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { getUnitFromCookies } from "@/lib/units/server-unit";
import { formatDimensions } from "@/lib/units/format";

interface PageProps {
  params: Promise<{ locale: string; type: string }>;
  searchParams: Promise<Record<string, string>>;
}

function parseNum(s: string | undefined, fallback: number): number {
  const n = s ? parseFloat(s) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

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

export default async function QuotePrintPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, type } = await params;
  const tp = await getTranslations({ locale, namespace: "quote.print" });
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  const length = parseInt(sp.length ?? "") || entry.defaults.length;
  const width = parseInt(sp.width ?? "") || entry.defaults.width;
  const height = parseInt(sp.height ?? "") || entry.defaults.height;
  const material = (sp.material as MaterialId) ?? "pine";

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
    designerMarkupRate: parseNum(sp.designerMarkupRate, LABOR_DEFAULTS.designerMarkupRate),
    vatRate: parseNum(sp.vatRate, LABOR_DEFAULTS.vatRate),
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
    quantity: parseNum(sp.quantity, LABOR_DEFAULTS.quantity),
    discountRate: parseNum(sp.discountRate, LABOR_DEFAULTS.discountRate),
    expiryDays: parseNum(sp.expiryDays, LABOR_DEFAULTS.expiryDays),
    depositRate: parseNum(sp.depositRate, LABOR_DEFAULTS.depositRate),
    bufferDays: parseNum(sp.bufferDays, LABOR_DEFAULTS.bufferDays),
    overrideUnitPrice: parseNum(sp.overrideUnitPrice, LABOR_DEFAULTS.overrideUnitPrice),
    laborHoursOverride: parseNum(sp.laborHoursOverride, LABOR_DEFAULTS.laborHoursOverride),
    deliveryDaysOverride: parseNum(sp.deliveryDaysOverride, LABOR_DEFAULTS.deliveryDaysOverride),
  };

  // 模板 options（legStyle / 倒角 / 內縮腳…）必須一起讀，
  // 否則客戶看到的是 default-options 版本，跟使用者編輯的不一致。
  const optionSchema = entry.optionSchema ?? [];
  const options = parseOptionsFromQuery(optionSchema, sp);

  // 預設組裝版（無榫卯）；URL 帶 joineryMode=true（或 beginnerMode=false）才出榫接版
  const joineryMode =
    sp.joineryMode === "true" ||
    sp.joineryMode === "1" ||
    sp.beginnerMode === "false";
  const rawDesign = entry.template({ length, width, height, material, options });
  const design = joineryMode ? rawDesign : toBeginnerMode(rawDesign);
  const unit = await getUnitFromCookies(locale);
  const currency = await getCurrencyFromCookies();
  const fmt = (n: number) => formatMoney(n, currency);
  const quote = calculateQuote(design, laborOpts, locale, unit);
  const finalDeliveryWorkdays =
    laborOpts.deliveryDaysOverride > 0
      ? laborOpts.deliveryDaysOverride
      : quote.estimatedWorkdays;
  // quotedAt 優先從 URL 帶（客戶收到的連結都該帶這欄），fallback 才用今天
  const quotedAtRaw = sp.quotedAt && /^\d{4}-\d{2}-\d{2}$/.test(sp.quotedAt) ? sp.quotedAt : null;
  const today = quotedAtRaw ? new Date(quotedAtRaw + "T00:00:00") : new Date();
  const todayStr = taipeiIsoDate(today);
  const customerName = sp.customerName ?? "";
  const contextForNo = `${customerName}|${length}x${width}x${height}|${material}`;
  const quoteNo = generateQuoteNumber(design.id, contextForNo, today);
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + Math.round(laborOpts.expiryDays));
  const expiryStr = taipeiIsoDate(expiry);
  const deliveryStr = taipeiIsoDate(addWorkdays(today, quote.estimatedWorkdays));

  const customerContact = sp.customerContact ?? "";
  const customerPhone = sp.customerPhone ?? "";
  const customerAddress = sp.customerAddress ?? "";
  const customerTaxId = sp.customerTaxId ?? "";
  const customerEmail = sp.customerEmail ?? "";
  const DASH = "＿＿＿＿＿＿＿＿＿＿";

  // viewMode=internal 含成本拆解（毛利 / 工時 / 報廢率），只給付費 user 看。
  // 客戶分享連結（/q/<code>）或匿名 curl 一律 force customer view，避免內部成本外洩。
  const wantsInternal = sp.viewMode === "internal";
  let viewMode: "customer" | "internal" = "customer";
  if (wantsInternal) {
    const user = await getSessionUser();
    if (user && (await isPaidUser(user.id))) {
      viewMode = "internal";
    }
  }

  const termNotes: string[] = [];
  if (sp.termIncludeShipping === "1") {
    termNotes.push(tp("termShippingIncluded"));
  } else {
    termNotes.push(tp("termShippingExcluded"));
  }
  if (sp.termIncludeInstallation === "1") {
    termNotes.push(tp("termInstallIncluded"));
  } else {
    termNotes.push(tp("termInstallExcluded"));
  }

  const entryName = getEntryName(entry, locale);
  const entryDesc = getEntryDescription(entry, locale) ?? "";
  const matName = materialName(material, locale);
  const pdfFilename = `${customerName || tp("pdfFilenameFallback")}_${entryName}_${todayStr}`.replace(
    /[\\/:*?"<>|]/g,
    "_",
  );
  const isEn = locale === "en";

  if (isEn) {
    return (
      <main className="max-w-[210mm] mx-auto bg-white text-zinc-900 relative quote-print-compact">
        <div className="no-print sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-zinc-600">{tp("previewHint")}</p>
          <PrintButton suggestedFilename={pdfFilename} />
        </div>

        <section data-print-page className="px-10 py-8 text-[12px] leading-relaxed">
          <header className="border-b-2 border-zinc-900 pb-3">
            <h1 className="text-2xl font-bold">{entryName} — Material estimate</h1>
            <p className="mt-1 text-[11px] text-zinc-600">
              {formatDimensions(length, width, height, unit)} · {matName} · {todayStr}
            </p>
          </header>

          <section className="mt-4 print-keep">
            <ZoomableThreeViews design={design} />
          </section>

          <section className="mt-5 rounded border-2 border-zinc-900 overflow-hidden">
            <div className="bg-zinc-900 text-white px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider opacity-70">Estimated material cost</div>
              <div className="mt-1 text-3xl font-mono font-bold">{fmt(quote.materialCost)}</div>
              <div className="mt-1 text-[10px] opacity-70">
                {quote.totalBdft.toFixed(1)} bd-ft · solid wood + sheet goods, 10% cutting waste included
              </div>
            </div>
            <div className="px-4 py-2 bg-amber-50 text-[10px] text-amber-900">
              DIY estimate. Lumber cost only — excludes hardware, fasteners, finish, glue, blades, and your time.
              Pricing baseline is Taiwan retail; US/EU softwood prices are typically 40–60% of this number.
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-[13px] font-semibold mb-2">Bill of materials ({design.parts.length} parts)</h3>
            <table className="w-full text-[11px] border border-zinc-400">
              <thead className="bg-zinc-100">
                <tr className="border-b border-zinc-400">
                  <th className="text-left p-2 border-r border-zinc-300">Part</th>
                  <th className="text-left p-2 border-r border-zinc-300">Material</th>
                  <th className="text-right p-2">L × W × T</th>
                </tr>
              </thead>
              <tbody>
                {design.parts.map((part, i) => (
                  <tr key={part.id ?? i} className="border-b border-zinc-200">
                    <td className="p-2 border-r border-zinc-300">{part.nameEn ?? part.nameZh}</td>
                    <td className="p-2 border-r border-zinc-300 text-zinc-600">{materialName(part.material ?? material, locale)}</td>
                    <td className="p-2 text-right font-mono">
                      {formatDimensions(part.visible.length, part.visible.width, part.visible.thickness, unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <footer className="mt-6 pt-3 border-t border-zinc-300 text-[10px] text-zinc-500">
            Generated by designer.woodenren.com · For personal DIY use.
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="max-w-[210mm] mx-auto bg-white text-zinc-900 relative quote-print-compact">
      <div className="no-print sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          {tp("previewHint")}
        </p>
        <PrintButton suggestedFilename={pdfFilename} />
      </div>

      <div className="print-watermark" aria-hidden>
        <span>{tp("watermark")}</span>
      </div>

      <section
        data-print-page
        className="px-10 py-6 flex flex-col text-[12px] leading-relaxed"
      >
        {currency === "USD" && (
          <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-900">
            USD amounts converted from TWD at the rate baked into this build (≈32 TWD per USD). Actual charge in TWD may vary slightly with your bank&apos;s rate.
          </div>
        )}
        {/* Header — branding + quote meta */}
        <header className="flex justify-between items-start border-b-2 border-zinc-900 pb-3 gap-4">
          <BrandedHeader />
          <div className="flex items-start gap-3">
            <div className="text-right text-[11px]">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-zinc-500">{tp("metaQuoteNo")}</dt>
                <dd className="font-mono font-semibold text-right">{quoteNo}</dd>
                <dt className="text-zinc-500">{tp("metaIssueDate")}</dt>
                <dd className="font-mono text-right">{todayStr}</dd>
                <dt className="text-zinc-500">{tp("metaExpiry")}</dt>
                <dd className="font-mono text-right">{expiryStr}</dd>
                <dt className="text-zinc-500">{tp("metaDelivery")}</dt>
                <dd className="font-mono text-right">
                  {deliveryStr}
                  <span className="text-zinc-400 text-[10px]">
                    {tp("metaDeliveryDays", { days: quote.estimatedWorkdays })}
                  </span>
                </dd>
              </div>
            </div>
            <QrCode size={110} />
          </div>
        </header>

        {/* Supplier / Customer info */}
        <section className="grid grid-cols-2 gap-4 mt-4">
          <BrandedSupplier />
          <InfoBlock
            title={tp("customerTo")}
            rows={[
              [tp("fieldCompany"), customerName || DASH],
              [tp("fieldContact"), customerContact || DASH],
              [tp("fieldPhone"), customerPhone || DASH],
              [tp("fieldAddress"), customerAddress || DASH],
              [tp("fieldTaxId"), customerTaxId || DASH],
              [tp("fieldEmail"), customerEmail || DASH],
            ]}
          />
        </section>

        {/* Product thumbnail — 三視圖縮圖讓客戶看到實體（側併排、小尺寸） */}
        <section className="mt-4 print-keep">
          <div className="flex items-baseline justify-between mb-1.5">
            <h3 className="text-[11px] font-semibold text-zinc-700">{tp("designSection")}</h3>
            <span className="text-[9px] text-zinc-400">
              {tp("designId", { id: design.id })}
            </span>
          </div>
          <ZoomableThreeViews design={design} />
          <p className="mt-1 text-[9px] text-zinc-400">
            {tp("designCaption")}
          </p>
        </section>

        {/* Product line item */}
        <section className="mt-3">
          <table className="w-full text-[11px] border border-zinc-400">
            <thead className="bg-zinc-100">
              <tr className="border-b border-zinc-400">
                <th className="text-left p-2 border-r border-zinc-300">
                  {tp("thItem")}
                </th>
                <th className="text-left p-2 border-r border-zinc-300">
                  {tp("thSpec")}
                </th>
                <th className="text-center p-2 border-r border-zinc-300 w-12">
                  {tp("thQty")}
                </th>
                <th className="text-right p-2 w-28">{tp("thAmount")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-300">
                <td className="p-2 border-r border-zinc-300 align-top">
                  <div className="font-semibold">{entryName}</div>
                  <div className="text-[10px] text-zinc-500">
                    {entryDesc}
                  </div>
                </td>
                <td className="p-2 border-r border-zinc-300 align-top text-[10px]">
                  <div>
                    {tp("specDimension", { dims: formatDimensions(length, width, height, unit) })}
                  </div>
                  <div>{tp("specMaterial", { name: matName })}</div>
                  <div>{tp("specPartCount", { n: design.parts.length })}</div>
                </td>
                <td className="text-center p-2 border-r border-zinc-300 align-top font-semibold">
                  {quote.quantity}
                </td>
                <td className="text-right p-2 font-mono align-top">
                  {quote.quantity > 1 ? (
                    <>
                      <div>{tp("amountPerUnit", { price: fmt(quote.unitPriceExclVat) })}</div>
                      <div className="font-semibold">
                        {tp("amountEquals", { price: fmt(quote.subtotalBeforeDiscount) })}
                      </div>
                    </>
                  ) : (
                    fmt(quote.unitPriceExclVat)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Cost breakdown — 只在「內部版」顯示，客戶版隱藏避免被殺價 */}
        {viewMode === "internal" && (
          <section className="mt-4">
            <h3 className="text-[11px] font-semibold mb-1 text-zinc-700">
              {tp("internalDetailH")}
            </h3>
            <table className="w-full text-[10px] border border-zinc-300">
              <tbody>
                {quote.lines.map((line, i) => (
                  <tr key={i} className="border-b border-zinc-200">
                    <td className="p-1.5 pl-3 w-28 text-zinc-600">
                      {line.label}
                    </td>
                    <td className="p-1.5 text-zinc-500">{line.detail}</td>
                    <td className="p-1.5 pr-3 text-right font-mono w-28">
                      {fmt(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Totals */}
        <section className="mt-2 ml-auto w-80 text-[11px]">
          <table className="w-full">
            <tbody>
              {viewMode === "internal" && (
                <>
                  <tr className="border-t border-zinc-300">
                    <td className="py-1 text-zinc-600">{tp("rowCostPerUnit")}</td>
                    <td className="py-1 text-right font-mono">
                      {fmt(quote.costSubtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-zinc-600">
                      {tp("rowMargin", { pct: Math.round(laborOpts.marginRate * 100) })}
                    </td>
                    <td className="py-1 text-right font-mono">
                      + {fmt(quote.margin)}
                    </td>
                  </tr>
                  {quote.designerMarkupRate > 0 && (
                    <tr>
                      <td className="py-1 text-amber-800">
                        {tp("rowDesignerMarkup", { pct: Math.round(quote.designerMarkupRate * 100) })}
                      </td>
                      <td className="py-1 text-right font-mono text-amber-800">
                        + {fmt(quote.designerMarkupAmount)}
                      </td>
                    </tr>
                  )}
                </>
              )}
              {viewMode === "customer" && (
                <tr className="border-t border-zinc-300">
                  <td className="py-1 text-zinc-600">
                    {tp("rowUnitQuote")}
                  </td>
                  <td className="py-1 text-right font-mono">
                    {fmt(quote.unitPriceExclVat)}
                  </td>
                </tr>
              )}
              {quote.quantity > 1 && (
                <tr>
                  <td className="py-1 text-zinc-600">
                    {tp("rowQtyMultiplier", { n: quote.quantity })}
                  </td>
                  <td className="py-1 text-right font-mono">
                    {fmt(quote.subtotalBeforeDiscount)}
                  </td>
                </tr>
              )}
              {quote.discountAmount > 0 && (
                <tr>
                  <td className="py-1 text-red-700">
                    {tp("rowDiscount", { pct: (laborOpts.discountRate * 100).toFixed(0) })}
                  </td>
                  <td className="py-1 text-right font-mono text-red-700">
                    − {fmt(quote.discountAmount)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-zinc-400 font-semibold">
                <td className="py-2">{tp("rowSubtotalExclVat")}</td>
                <td className="py-2 text-right font-mono">
                  {fmt(quote.subtotalExclVat)}
                </td>
              </tr>
              {laborOpts.vatRate > 0 && (
                <>
                  <tr>
                    <td className="py-1 text-zinc-600">
                      {tp("rowVat", { pct: (laborOpts.vatRate * 100).toFixed(0) })}
                    </td>
                    <td className="py-1 text-right font-mono">
                      + {fmt(quote.vat)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-zinc-900 font-bold bg-zinc-900 text-white">
                    <td className="py-2 pl-2">{tp("rowGrandTotal")}</td>
                    <td className="py-2 pr-2 text-right font-mono text-base">
                      {fmt(quote.total)}
                    </td>
                  </tr>
                </>
              )}
              {laborOpts.depositRate > 0 && laborOpts.depositRate < 1 && (
                <>
                  <tr>
                    <td className="pt-3 py-1 text-emerald-700">
                      {tp("rowDeposit", { pct: (laborOpts.depositRate * 100).toFixed(0) })}
                    </td>
                    <td className="pt-3 py-1 text-right font-mono text-emerald-700">
                      {fmt(quote.depositAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-zinc-600">
                      {tp("rowBalance", { pct: ((1 - laborOpts.depositRate) * 100).toFixed(0) })}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {fmt(quote.balanceAmount)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </section>

        {/* ── 從付款條件之後換到第 2 頁，避免擠在報價細節下方 ── */}
        <div className="quote-page-break" />

        {/* Terms & conditions — 取自 branding localStorage，可在 quote 頁編輯 */}
        <BrandedTermsBlocks
          depositRate={laborOpts.depositRate}
          depositAmount={quote.depositAmount}
          balanceAmount={quote.balanceAmount}
          totalAmount={quote.total}
          deliveryWorkdays={finalDeliveryWorkdays}
        />
        <BrandedNotes prependNotes={termNotes} />

        {/* Signatures */}
        <section className="mt-8 pt-4 grid grid-cols-2 gap-6 text-[11px]">
          <div>
            <div className="h-14 border-b border-zinc-400" />
            <div className="mt-1 flex justify-between text-zinc-600">
              <span>{tp("signCustomer")}</span>
              <span>{tp("signDate")}</span>
            </div>
          </div>
          <div>
            <div className="h-14 border-b border-zinc-400 flex items-end justify-end pr-4">
              <span className="text-[10px] text-zinc-400">{tp("companySeal")}</span>
            </div>
            <BrandedSignature todayStr={todayStr} />
          </div>
        </section>

        <BrandedFooter />
      </section>
    </main>
  );
}

function InfoBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="border border-zinc-300 rounded">
      <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
        {title}
      </div>
      <dl className="p-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="text-zinc-900 font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
