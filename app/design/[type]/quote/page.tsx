import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { LABOR_DEFAULTS, LABOR_BOUNDS } from "@/lib/pricing/labor";
import {
  calculateQuote,
  generateQuoteNumber,
  addWorkdays,
} from "@/lib/pricing/quote";
import { MATERIAL_PRICE_PER_BDFT, formatTWD } from "@/lib/pricing/catalog";
import { BrandingForm } from "@/components/branding/BrandingForm";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import { CsvExportButton } from "@/components/CsvExportButton";
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

      <LaborForm
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

function LaborForm({
  type,
  designQuery,
  defaults,
  primaryMaterialName,
  initialCustomer,
  terms,
}: {
  type: string;
  designQuery: string;
  defaults: {
    hourlyRate: number;
    equipmentRate: number;
    consumables: number;
    finishingCost: number;
    shippingCost: number;
    installationCost: number;
    hardwareCost: number;
    marginRate: number;
    vatRate: number;
    quantity: number;
    discountRate: number;
    expiryDays: number;
    depositRate: number;
    bufferDays: number;
    overrideUnitPrice: number;
    primaryMaterialPricePerBdft: number;
    plywoodPricePerBdft: number | null;
    mdfPricePerBdft: number | null;
  };
  primaryMaterialName: string;
  initialCustomer: CustomerInfo;
  terms: { termIncludeShipping: boolean; termIncludeInstallation: boolean };
}) {
  // Preserve design query string via hidden inputs
  const designParams = Object.fromEntries(
    new URLSearchParams(designQuery),
  ) as Record<string, string>;

  return (
    <form
      method="get"
      action={`/design/${type}/quote`}
      className="rounded-lg border border-zinc-200 bg-white p-4"
    >
      {Object.entries(designParams).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="mb-4 pb-4 border-b border-zinc-100">
        <CustomerForm initial={initialCustomer} />
      </div>
      <fieldset className="mb-3 p-3 rounded-md bg-emerald-50 border-2 border-emerald-300">
        <legend className="text-sm text-emerald-800 font-semibold px-2">
          ✅ 附加條款（會印到 PDF 備註區）
        </legend>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="termIncludeShipping"
              value="1"
              defaultChecked={terms.termIncludeShipping}
              className="w-5 h-5"
            />
            <span className="font-medium">🚚 報價含運費</span>
            <span className="text-[10px] text-zinc-500">
              （不勾會印「運費另計」）
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="termIncludeInstallation"
              value="1"
              defaultChecked={terms.termIncludeInstallation}
              className="w-5 h-5"
            />
            <span className="font-medium">🔧 含現場安裝</span>
            <span className="text-[10px] text-zinc-500">
              （不勾會印「不含安裝」）
            </span>
          </label>
        </div>
      </fieldset>
      <fieldset className="mb-3 p-2 rounded bg-amber-50 border border-amber-200">
        <legend className="text-xs text-amber-800 mb-1 font-medium px-1">
          💰 議價覆寫（留 0 = 沿用成本加成）
        </legend>
        <div className="grid grid-cols-1">
          <NumField
            name="overrideUnitPrice"
            label="單件最終價 NT$（未稅）"
            value={defaults.overrideUnitPrice}
            min={LABOR_BOUNDS.overrideUnitPrice.min}
            max={LABOR_BOUNDS.overrideUnitPrice.max}
            step={LABOR_BOUNDS.overrideUnitPrice.step}
            hint="例：客戶砍到 NT$25,000，填 25000 → 成本明細保留、毛利自動反算"
          />
        </div>
      </fieldset>
      <fieldset className="mb-3">
        <legend className="text-xs text-zinc-500 mb-1.5 font-medium">
          數量 / 折扣 / 有效期 / 訂金 / 交期
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <NumField
            name="quantity"
            label="數量"
            value={defaults.quantity}
            min={LABOR_BOUNDS.quantity.min}
            max={LABOR_BOUNDS.quantity.max}
            step={LABOR_BOUNDS.quantity.step}
          />
          <NumField
            name="discountRate"
            label="折扣率（0–50%）"
            value={defaults.discountRate}
            min={LABOR_BOUNDS.discountRate.min}
            max={LABOR_BOUNDS.discountRate.max}
            step={LABOR_BOUNDS.discountRate.step}
            decimal
            hint="0.05 = 95 折；0 表示無折扣"
          />
          <NumField
            name="expiryDays"
            label="有效期（天）"
            value={defaults.expiryDays}
            min={LABOR_BOUNDS.expiryDays.min}
            max={LABOR_BOUNDS.expiryDays.max}
            step={LABOR_BOUNDS.expiryDays.step}
          />
          <NumField
            name="depositRate"
            label="訂金比例"
            value={defaults.depositRate}
            min={LABOR_BOUNDS.depositRate.min}
            max={LABOR_BOUNDS.depositRate.max}
            step={LABOR_BOUNDS.depositRate.step}
            decimal
            hint="0.5 = 50%；0 表示不收訂金"
          />
          <NumField
            name="bufferDays"
            label="塗裝/出貨緩衝（天）"
            value={defaults.bufferDays}
            min={LABOR_BOUNDS.bufferDays.min}
            max={LABOR_BOUNDS.bufferDays.max}
            step={LABOR_BOUNDS.bufferDays.step}
            hint="乾燥+出貨，併入交期"
          />
        </div>
      </fieldset>
      <fieldset className="mb-3">
        <legend className="text-xs text-zinc-500 mb-1.5 font-medium">
          材料單價（NT$/板才）
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumField
            name="primaryMaterialPricePerBdft"
            label={`${primaryMaterialName}（主材）`}
            value={defaults.primaryMaterialPricePerBdft}
            min={LABOR_BOUNDS.primaryMaterialPricePerBdft.min}
            max={LABOR_BOUNDS.primaryMaterialPricePerBdft.max}
            step={LABOR_BOUNDS.primaryMaterialPricePerBdft.step}
          />
          <NumField
            name="plywoodPricePerBdft"
            label="夾板（背板/抽屜底）"
            value={defaults.plywoodPricePerBdft}
            min={LABOR_BOUNDS.plywoodPricePerBdft.min}
            max={LABOR_BOUNDS.plywoodPricePerBdft.max}
            step={LABOR_BOUNDS.plywoodPricePerBdft.step}
            optional
            hint="留空則併入主材"
          />
          <NumField
            name="mdfPricePerBdft"
            label="中纖板（抽屜側背）"
            value={defaults.mdfPricePerBdft}
            min={LABOR_BOUNDS.mdfPricePerBdft.min}
            max={LABOR_BOUNDS.mdfPricePerBdft.max}
            step={LABOR_BOUNDS.mdfPricePerBdft.step}
            optional
            hint="留空則併入主材"
          />
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs text-zinc-500 mb-1.5 font-medium">
          工資 / 其他
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <NumField
            name="hourlyRate"
            label="師傅時薪 (NT$/hr)"
            value={defaults.hourlyRate}
            min={LABOR_BOUNDS.hourlyRate.min}
            max={LABOR_BOUNDS.hourlyRate.max}
            step={LABOR_BOUNDS.hourlyRate.step}
          />
          <NumField
            name="equipmentRate"
            label="設備折舊 (NT$/hr)"
            value={defaults.equipmentRate}
            min={LABOR_BOUNDS.equipmentRate.min}
            max={LABOR_BOUNDS.equipmentRate.max}
            step={LABOR_BOUNDS.equipmentRate.step}
          />
          <NumField
            name="consumables"
            label="耗材 (NT$)"
            value={defaults.consumables}
            min={LABOR_BOUNDS.consumables.min}
            max={LABOR_BOUNDS.consumables.max}
            step={LABOR_BOUNDS.consumables.step}
          />
          <NumField
            name="finishingCost"
            label="塗裝費 (NT$)"
            value={defaults.finishingCost}
            min={LABOR_BOUNDS.finishingCost.min}
            max={LABOR_BOUNDS.finishingCost.max}
            step={LABOR_BOUNDS.finishingCost.step}
          />
          <NumField
            name="hardwareCost"
            label="五金 (NT$)"
            value={defaults.hardwareCost}
            min={LABOR_BOUNDS.hardwareCost.min}
            max={LABOR_BOUNDS.hardwareCost.max}
            step={LABOR_BOUNDS.hardwareCost.step}
          />
          <NumField
            name="shippingCost"
            label="運費 (NT$)"
            value={defaults.shippingCost}
            min={LABOR_BOUNDS.shippingCost.min}
            max={LABOR_BOUNDS.shippingCost.max}
            step={LABOR_BOUNDS.shippingCost.step}
          />
          <NumField
            name="installationCost"
            label="安裝費 (NT$)"
            value={defaults.installationCost}
            min={LABOR_BOUNDS.installationCost.min}
            max={LABOR_BOUNDS.installationCost.max}
            step={LABOR_BOUNDS.installationCost.step}
          />
          <NumField
            name="marginRate"
            label="毛利率"
            value={defaults.marginRate}
            min={LABOR_BOUNDS.marginRate.min}
            max={LABOR_BOUNDS.marginRate.max}
            step={LABOR_BOUNDS.marginRate.step}
            decimal
          />
          <NumField
            name="vatRate"
            label="營業稅率"
            value={defaults.vatRate}
            min={LABOR_BOUNDS.vatRate.min}
            max={LABOR_BOUNDS.vatRate.max}
            step={LABOR_BOUNDS.vatRate.step}
            decimal
          />
        </div>
      </fieldset>
      <button
        type="submit"
        className="mt-3 px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
      >
        重新計算
      </button>
    </form>
  );
}

function NumField({
  name,
  label,
  value,
  min,
  max,
  step,
  decimal,
  optional,
  hint,
}: {
  name: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  decimal?: boolean;
  optional?: boolean;
  hint?: string;
}) {
  const display =
    value == null ? "" : decimal ? value.toFixed(2) : String(value);
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-600 mb-1">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={display}
        // optional 欄位不設 min——允許 0 / 清空，觸發「併入主材」邏輯
        min={optional ? 0 : min}
        max={max}
        step={step}
        inputMode="decimal"
        placeholder={optional ? "（不填 / 0＝併入主材）" : undefined}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
      />
      {hint && (
        <span className="mt-0.5 text-[10px] text-zinc-400">{hint}</span>
      )}
    </label>
  );
}
