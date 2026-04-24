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
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import { CsvExportButton } from "@/components/CsvExportButton";
import { QuoteLaborForm } from "@/components/quote/QuoteLaborForm";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { QuoteHistory } from "@/components/QuoteHistory";
import { LineShareButton } from "@/components/LineShareButton";
import { EmailShareButton } from "@/components/EmailShareButton";

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

  const design = entry.template({ length, width, height, material });
  const quote = calculateQuote(design, laborOpts);
  const quoteNo = generateQuoteNumber(design.id);

  const customer: CustomerInfo = {
    name: sp.customerName ?? "",
    contact: sp.customerContact ?? "",
    phone: sp.customerPhone ?? "",
    address: sp.customerAddress ?? "",
    taxId: sp.customerTaxId ?? "",
    email: sp.customerEmail ?? "",
  };
  const viewMode: "customer" | "internal" =
    sp.viewMode === "internal" ? "internal" : "customer";
  const termIncludeShipping = sp.termIncludeShipping === "1";
  const termIncludeInstallation = sp.termIncludeInstallation === "1";

  const designQuery = `length=${length}&width=${width}&height=${height}&material=${material}`;
  const laborQuery = `hourlyRate=${laborOpts.hourlyRate}&equipmentRate=${laborOpts.equipmentRate}&consumables=${laborOpts.consumables}&finishingCost=${laborOpts.finishingCost}&shippingCost=${laborOpts.shippingCost}&installationCost=${laborOpts.installationCost}&hardwareCost=${laborOpts.hardwareCost}&marginRate=${laborOpts.marginRate}&vatRate=${laborOpts.vatRate}&quantity=${laborOpts.quantity}&discountRate=${laborOpts.discountRate}&expiryDays=${laborOpts.expiryDays}&depositRate=${laborOpts.depositRate}&bufferDays=${laborOpts.bufferDays}&overrideUnitPrice=${laborOpts.overrideUnitPrice}&primaryMaterialPricePerBdft=${laborOpts.primaryMaterialPricePerBdft}&plywoodPricePerBdft=${laborOpts.plywoodPricePerBdft ?? ""}&mdfPricePerBdft=${laborOpts.mdfPricePerBdft ?? ""}`;
  const customerQuery = new URLSearchParams({
    customerName: customer.name,
    customerContact: customer.contact,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    customerTaxId: customer.taxId,
    customerEmail: customer.email,
  }).toString();
  const termQuery = `termIncludeShipping=${termIncludeShipping ? "1" : "0"}&termIncludeInstallation=${termIncludeInstallation ? "1" : "0"}`;
  const fullQuery = `${designQuery}&${laborQuery}&${customerQuery}&viewMode=${viewMode}&${termQuery}`;

  const today = new Date();
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + Math.round(laborOpts.expiryDays));
  const expiryIso = expiry.toISOString().slice(0, 10);
  const deliveryIso = addWorkdays(today, quote.estimatedWorkdays)
    .toISOString()
    .slice(0, 10);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <Link
        href={`/design/${type}?${designQuery}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← 回{entry.nameZh}設計
      </Link>

      <header className="mt-3 mb-6 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">客製家具報價</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {entry.nameZh} · {length} × {width} × {height} mm ·{" "}
            {MATERIALS[material].nameZh}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewModeToggle current={viewMode} />
          <LineShareButton
            customerName={customer.name}
            furnitureName={entry.nameZh}
            dimensions={`${length} × ${width} × ${height} mm`}
            materialName={MATERIALS[material].nameZh}
            total={quote.total}
            depositAmount={quote.depositAmount}
            balanceAmount={quote.balanceAmount}
            depositRate={laborOpts.depositRate}
            deliveryDate={deliveryIso}
            expiryDate={expiryIso}
            quoteNo={quoteNo}
            printPath={`/design/${type}/quote/print?${fullQuery}`}
          />
          <EmailShareButton
            toEmail={customer.email}
            customerName={customer.name}
            furnitureName={entry.nameZh}
            dimensions={`${length} × ${width} × ${height} mm`}
            materialName={MATERIALS[material].nameZh}
            total={quote.total}
            depositAmount={quote.depositAmount}
            balanceAmount={quote.balanceAmount}
            depositRate={laborOpts.depositRate}
            deliveryDate={deliveryIso}
            expiryDate={expiryIso}
            quoteNo={quoteNo}
            printPath={`/design/${type}/quote/print?${fullQuery}`}
          />
          <Link
            href={`/design/${type}/quote/print?${fullQuery}`}
            target="_blank"
            className="px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
          >
            🧾 列印 / PDF
          </Link>
        </div>
      </header>

      <QuoteHistory
        current={{
          customerName: customer.name,
          furnitureName: entry.nameZh,
          query: fullQuery,
          total: quote.total,
          quoteNo,
        }}
      />

      <QuoteLaborForm
        type={type}
        designQuery={designQuery}
        defaults={laborOpts}
        primaryMaterialName={MATERIALS[material].nameZh}
        initialCustomer={customer}
        terms={{ termIncludeShipping, termIncludeInstallation }}
      />

      <BrandingForm />

      <CsvExportButton design={design} />

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
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
      </section>

      <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-[10px] text-emerald-700 font-medium">訂金（下訂時收）</div>
          <div className="mt-1 text-lg font-mono font-semibold text-emerald-900">
            {formatTWD(quote.depositAmount)}
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5">
            {(laborOpts.depositRate * 100).toFixed(0)}% of {formatTWD(quote.total)}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-3">
          <div className="text-[10px] text-zinc-700 font-medium">尾款（交貨時收）</div>
          <div className="mt-1 text-lg font-mono font-semibold text-zinc-900">
            {formatTWD(quote.balanceAmount)}
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">
            {((1 - laborOpts.depositRate) * 100).toFixed(0)}% 餘額
          </div>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="text-[10px] text-sky-700 font-medium">預計交期</div>
          <div className="mt-1 text-lg font-mono font-semibold text-sky-900">
            {addWorkdays(new Date(), quote.estimatedWorkdays).toISOString().slice(0, 10)}
          </div>
          <div className="text-[10px] text-sky-700 mt-0.5">
            約 {quote.estimatedWorkdays} 個工作天（工時 {quote.laborHours.toFixed(1)}h ÷ 8 + 緩衝 {laborOpts.bufferDays}）
          </div>
        </div>
      </section>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold mb-1">報價說明</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>材料以「板才」計（1 板才 = 1&quot; × 12&quot; × 12&quot; ≈ 2,360 cm³ ≈ 8.5 台才），已含 10% 切料損耗</li>
          <li>工時從製作工序自動加總，依難度與零件數估算</li>
          <li>本工具估算值僅供參考，實際報價請師傅依現場條件微調</li>
          <li>不含跨區運費、現場安裝、五金（滑軌/鉸鏈）另計</li>
        </ul>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        報價單編號：{quoteNo}
      </p>
    </main>
  );
}

