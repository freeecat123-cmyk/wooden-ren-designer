import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import { taipeiIsoDate } from "@/lib/utils/date-tw";
import {
  calculateQuote,
  generateQuoteNumber,
  addWorkdays,
} from "@/lib/pricing/quote";
import { MATERIAL_PRICE_PER_BDFT, formatTWD } from "@/lib/pricing/catalog";
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

interface PageProps {
  params: Promise<{ type: string }>;
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
  const quote = calculateQuote(design, laborOpts);
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

  const viewMode: "customer" | "internal" =
    sp.viewMode === "internal" ? "internal" : "customer";

  const termNotes: string[] = [];
  if (sp.termIncludeShipping === "1") {
    termNotes.push("本報價含運費。");
  } else {
    termNotes.push("運費另計，依實際送貨地點報價。");
  }
  if (sp.termIncludeInstallation === "1") {
    termNotes.push("本報價含現場安裝（工坊北北基區域內）。");
  } else {
    termNotes.push("不含現場安裝；如需到府組裝請另議。");
  }

  const pdfFilename = `${customerName || "報價單"}_${entry.nameZh}_${todayStr}`.replace(
    /[\\/:*?"<>|]/g,
    "_",
  );

  return (
    <main className="max-w-[210mm] mx-auto bg-white text-zinc-900 relative quote-print-compact">
      <div className="no-print sticky top-0 z-10 bg-zinc-50 border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          A4 報價單預覽 — 按下按鈕後在系統對話框選擇「另存為 PDF」
        </p>
        <PrintButton suggestedFilename={pdfFilename} />
      </div>

      <div className="print-watermark" aria-hidden>
        <span>木頭仁 · woodenren.com</span>
      </div>

      <section
        data-print-page
        className="px-10 py-6 flex flex-col text-[12px] leading-relaxed"
      >
        {/* Header — branding + quote meta */}
        <header className="flex justify-between items-start border-b-2 border-zinc-900 pb-3 gap-4">
          <BrandedHeader />
          <div className="flex items-start gap-3">
            <div className="text-right text-[11px]">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-zinc-500">報價單號</dt>
                <dd className="font-mono font-semibold text-right">{quoteNo}</dd>
                <dt className="text-zinc-500">開立日期</dt>
                <dd className="font-mono text-right">{todayStr}</dd>
                <dt className="text-zinc-500">有效期限</dt>
                <dd className="font-mono text-right">{expiryStr}</dd>
                <dt className="text-zinc-500">預計交期</dt>
                <dd className="font-mono text-right">
                  {deliveryStr}
                  <span className="text-zinc-400 text-[10px]">
                    {" "}（約 {quote.estimatedWorkdays} 工作天）
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
            title="客戶 TO"
            rows={[
              ["公司／姓名", customerName || DASH],
              ["聯絡人", customerContact || DASH],
              ["電話", customerPhone || DASH],
              ["送貨地址", customerAddress || DASH],
              ["統編", customerTaxId || DASH],
              ["email", customerEmail || DASH],
            ]}
          />
        </section>

        {/* Product thumbnail — 三視圖縮圖讓客戶看到實體（側併排、小尺寸） */}
        <section className="mt-4 print-keep">
          <div className="flex items-baseline justify-between mb-1.5">
            <h3 className="text-[11px] font-semibold text-zinc-700">設計圖</h3>
            <span className="text-[9px] text-zinc-400">
              設計編號：{design.id}
            </span>
          </div>
          <ZoomableThreeViews design={design} />
          <p className="mt-1 text-[9px] text-zinc-400">
            三視圖顯示家具尺寸與比例，實際成品木紋、色差依天然木材狀態而定。
          </p>
        </section>

        {/* Product line item */}
        <section className="mt-3">
          <table className="w-full text-[11px] border border-zinc-400">
            <thead className="bg-zinc-100">
              <tr className="border-b border-zinc-400">
                <th className="text-left p-2 border-r border-zinc-300">
                  品項
                </th>
                <th className="text-left p-2 border-r border-zinc-300">
                  規格
                </th>
                <th className="text-center p-2 border-r border-zinc-300 w-12">
                  數量
                </th>
                <th className="text-right p-2 w-28">金額 NT$</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-300">
                <td className="p-2 border-r border-zinc-300 align-top">
                  <div className="font-semibold">{entry.nameZh}</div>
                  <div className="text-[10px] text-zinc-500">
                    {entry.description}
                  </div>
                </td>
                <td className="p-2 border-r border-zinc-300 align-top text-[10px]">
                  <div>
                    尺寸 {length} × {width} × {height} mm
                  </div>
                  <div>木材：{MATERIALS[material].nameZh}</div>
                  <div>零件數：{design.parts.length} 件</div>
                </td>
                <td className="text-center p-2 border-r border-zinc-300 align-top font-semibold">
                  {quote.quantity}
                </td>
                <td className="text-right p-2 font-mono align-top">
                  {quote.quantity > 1 ? (
                    <>
                      <div>{formatTWD(quote.unitPriceExclVat)} / 件</div>
                      <div className="font-semibold">
                        = {formatTWD(quote.subtotalBeforeDiscount)}
                      </div>
                    </>
                  ) : (
                    formatTWD(quote.unitPriceExclVat)
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
              成本明細（內部存檔用）
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
                      {formatTWD(line.amount)}
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
                    <td className="py-1 text-zinc-600">單件成本</td>
                    <td className="py-1 text-right font-mono">
                      {formatTWD(quote.costSubtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-zinc-600">
                      毛利（{Math.round(laborOpts.marginRate * 100)}%）
                    </td>
                    <td className="py-1 text-right font-mono">
                      + {formatTWD(quote.margin)}
                    </td>
                  </tr>
                  {quote.designerMarkupRate > 0 && (
                    <tr>
                      <td className="py-1 text-amber-800">
                        🎨 設計師加成（{Math.round(quote.designerMarkupRate * 100)}%）
                      </td>
                      <td className="py-1 text-right font-mono text-amber-800">
                        + {formatTWD(quote.designerMarkupAmount)}
                      </td>
                    </tr>
                  )}
                </>
              )}
              {viewMode === "customer" && (
                <tr className="border-t border-zinc-300">
                  <td className="py-1 text-zinc-600">
                    單件報價
                  </td>
                  <td className="py-1 text-right font-mono">
                    {formatTWD(quote.unitPriceExclVat)}
                  </td>
                </tr>
              )}
              {quote.quantity > 1 && (
                <tr>
                  <td className="py-1 text-zinc-600">
                    × {quote.quantity} 件
                  </td>
                  <td className="py-1 text-right font-mono">
                    {formatTWD(quote.subtotalBeforeDiscount)}
                  </td>
                </tr>
              )}
              {quote.discountAmount > 0 && (
                <tr>
                  <td className="py-1 text-red-700">
                    折扣（{(laborOpts.discountRate * 100).toFixed(0)}% off）
                  </td>
                  <td className="py-1 text-right font-mono text-red-700">
                    − {formatTWD(quote.discountAmount)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-zinc-400 font-semibold">
                <td className="py-2">報價（未稅）</td>
                <td className="py-2 text-right font-mono">
                  {formatTWD(quote.subtotalExclVat)}
                </td>
              </tr>
              {laborOpts.vatRate > 0 && (
                <>
                  <tr>
                    <td className="py-1 text-zinc-600">
                      營業稅（{(laborOpts.vatRate * 100).toFixed(0)}%）
                    </td>
                    <td className="py-1 text-right font-mono">
                      + {formatTWD(quote.vat)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-zinc-900 font-bold bg-zinc-900 text-white">
                    <td className="py-2 pl-2">含稅總計 TOTAL</td>
                    <td className="py-2 pr-2 text-right font-mono text-base">
                      {formatTWD(quote.total)}
                    </td>
                  </tr>
                </>
              )}
              {laborOpts.depositRate > 0 && laborOpts.depositRate < 1 && (
                <>
                  <tr>
                    <td className="pt-3 py-1 text-emerald-700">
                      訂金（下訂時付 {(laborOpts.depositRate * 100).toFixed(0)}%）
                    </td>
                    <td className="pt-3 py-1 text-right font-mono text-emerald-700">
                      {formatTWD(quote.depositAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-zinc-600">
                      尾款（交貨時付 {((1 - laborOpts.depositRate) * 100).toFixed(0)}%）
                    </td>
                    <td className="py-1 text-right font-mono">
                      {formatTWD(quote.balanceAmount)}
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
              <span>客戶簽章</span>
              <span>日期：＿＿＿＿ / ＿＿ / ＿＿</span>
            </div>
          </div>
          <div>
            <div className="h-14 border-b border-zinc-400 flex items-end justify-end pr-4">
              <span className="text-[10px] text-zinc-400">（本公司用印）</span>
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
