import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isPaidUser } from "@/lib/userProfile";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getTemplate, getEntryName } from "@/lib/templates";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS, materialName } from "@/lib/materials";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import { taipeiIsoDate } from "@/lib/utils/date-tw";
import {
  calculateQuote,
  generateQuoteNumber,
  addWorkdays,
} from "@/lib/pricing/quote";
import { MATERIAL_PRICE_PER_BDFT, formatTWD } from "@/lib/pricing/catalog";
import { estimateWeight } from "@/lib/design/shipping";
import { BrandedTermsBlocks } from "@/components/branding/BrandedTerms";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import { CsvExportButton } from "@/components/CsvExportButton";
import { QuoteLaborForm } from "@/components/quote/QuoteLaborForm";
import { QuoteShareActions } from "@/components/quote/QuoteShareActions";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { QuoteHistory } from "@/components/QuoteHistory";
import { QuoteAccessGate } from "@/components/QuoteAccessGate";
import { parseOptionsFromQuery } from "@/lib/templates/parse-options";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { ZoomableThreeViews } from "@/components/quote/ZoomableThreeViews";

interface PageProps {
  params: Promise<{ locale: string; type: string }>;
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
    designerMarkupRate?: string;
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
    joineryMode?: string;
    beginnerMode?: string;
    deliveryDaysOverride?: string;
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
  const { locale, type } = await params;
  const t = await getTranslations({ locale, namespace: "quote" });
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  // server-side paid gate：未登入導 /login、未付費導 /pricing
  // 不能只靠 client-side QuoteAccessGate（DevTools 砍 blur class 就破）
  // session 取自 cookie（middleware 已驗 JWT），免 HTTP roundtrip。
  const user = await getSessionUser();
  const supabase = await createClient();
  if (!user) {
    const next = `/design/${type}/quote`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!(await isPaidUser(user.id))) {
    redirect(`/pricing?locked=${encodeURIComponent(type)}`);
  }

  const length = parseInt(sp.length ?? "") || entry.defaults.length;
  const width = parseInt(sp.width ?? "") || entry.defaults.width;
  const height = parseInt(sp.height ?? "") || entry.defaults.height;
  // validate against MATERIALS keys——URL 帶 ?material=oak 之類非 catalog id 不能直接吃，
  // 不然下面 MATERIALS[material].nameZh 會 crash。
  const rawMaterial = sp.material;
  const material: MaterialId =
    rawMaterial && rawMaterial in MATERIALS
      ? (rawMaterial as MaterialId)
      : ("pine" as MaterialId);

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
    quantity: parseNum(sp.quantity, LABOR_DEFAULTS.quantity),
    discountRate: parseNum(sp.discountRate, LABOR_DEFAULTS.discountRate),
    expiryDays: parseNum(sp.expiryDays, LABOR_DEFAULTS.expiryDays),
    depositRate: parseNum(sp.depositRate, LABOR_DEFAULTS.depositRate),
    bufferDays: parseNum(sp.bufferDays, LABOR_DEFAULTS.bufferDays),
    overrideUnitPrice: parseNum(sp.overrideUnitPrice, LABOR_DEFAULTS.overrideUnitPrice),
    laborHoursOverride: parseNum(sp.laborHoursOverride, LABOR_DEFAULTS.laborHoursOverride),
    deliveryDaysOverride: parseNum(sp.deliveryDaysOverride, LABOR_DEFAULTS.deliveryDaysOverride),
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

  // 預設組裝版（無榫卯）；URL 帶 joineryMode=true（或 beginnerMode=false）才出榫接版
  const joineryMode =
    sp.joineryMode === "true" ||
    sp.joineryMode === "1" ||
    sp.beginnerMode === "false";
  const rawDesign = entry.template({ length, width, height, material, options });
  const design = joineryMode ? rawDesign : toBeginnerMode(rawDesign);
  const quote = calculateQuote(design, laborOpts, locale);
  const finalDeliveryWorkdays =
    laborOpts.deliveryDaysOverride > 0
      ? laborOpts.deliveryDaysOverride
      : quote.estimatedWorkdays;

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
  // 用台北時區算日期，避免 Vercel UTC server 跑成「昨天/明天」
  const todayIso = taipeiIsoDate(today);
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
  const laborQuery = `hourlyRate=${laborOpts.hourlyRate}&equipmentRate=${laborOpts.equipmentRate}&consumables=${laborOpts.consumables}&finishingCost=${laborOpts.finishingCost}&shippingCost=${laborOpts.shippingCost}&installationCost=${laborOpts.installationCost}&hardwareCost=${laborOpts.hardwareCost}&marginRate=${laborOpts.marginRate}&designerMarkupRate=${laborOpts.designerMarkupRate}&vatRate=${laborOpts.vatRate}&quantity=${laborOpts.quantity}&discountRate=${laborOpts.discountRate}&expiryDays=${laborOpts.expiryDays}&depositRate=${laborOpts.depositRate}&bufferDays=${laborOpts.bufferDays}&overrideUnitPrice=${laborOpts.overrideUnitPrice}&laborHoursOverride=${laborOpts.laborHoursOverride}&primaryMaterialPricePerBdft=${laborOpts.primaryMaterialPricePerBdft}&plywoodPricePerBdft=${laborOpts.plywoodPricePerBdft ?? ""}&mdfPricePerBdft=${laborOpts.mdfPricePerBdft ?? ""}`;
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
  const expiryIso = taipeiIsoDate(expiry);
  const deliveryIso = taipeiIsoDate(addWorkdays(today, quote.estimatedWorkdays));

  const entryName = getEntryName(entry, locale);
  const matName = materialName(material, locale);

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href={`/design/${type}?${designQuery}`}
        className="text-sm text-zinc-700 hover:underline"
      >
        {t("backLink", { name: entryName })}
      </Link>

      <QuoteAccessGate>
      <header className="mt-2 mb-4 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {entryName}
            <span className="ml-2 text-sm font-normal text-zinc-700">{t("customQuote")}</span>
          </h1>
          <p className="mt-0.5 text-xs text-zinc-700">
            {length} × {width} × {height} mm · {matName}
            <span className="ml-1.5 text-zinc-600" title={t("weightTitle")}>{t("weightApprox", { kg: estimateWeight(design) })}</span>
            <span className="ml-2 text-zinc-600">#{quoteNo}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle current={viewMode} />
          <QuoteShareActions
            design={design}
            type={type}
            furnitureNameZh={entryName}
            dimensionsLabel={`${length} × ${width} × ${height} mm`}
            materialName={matName}
          />
        </div>
      </header>

      {/* 三視圖預覽：點擊放大，給客戶/木頭仁立即視覺確認 */}
      <section className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
        <div className="text-[10px] text-zinc-700 mb-2 font-medium tracking-wider flex items-center justify-between">
          <span>{t("previewTitle")}</span>
          <span className="text-zinc-600 normal-case">{t("previewHint")}</span>
        </div>
        <ZoomableThreeViews design={design} joineryMode={joineryMode} />
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
          autoLaborHours={quote.autoLaborHours}
        />

        {/* 右側：總價摘要卡（lg 以上 sticky） */}
        <aside className="lg:sticky lg:top-4 self-start space-y-3">
          <div className="rounded-xl border-2 border-zinc-900 bg-white overflow-hidden shadow-sm">
            <div className="bg-zinc-900 text-white px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider opacity-70">
                {laborOpts.vatRate > 0 ? t("totalWithVat") : t("totalNoVat")}
              </div>
              <div className="mt-0.5 text-3xl font-mono font-bold">
                {formatTWD(quote.total)}
              </div>
              {quote.quantity > 1 && (
                <div className="text-[10px] opacity-70 mt-0.5">
                  {t("unitPriceLine", { qty: quote.quantity, price: formatTWD(quote.unitPriceExclVat) })}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-zinc-200 border-b border-zinc-200">
              <div className="p-3">
                <div className="text-[10px] text-emerald-700 font-medium">
                  {t("deposit", { pct: (laborOpts.depositRate * 100).toFixed(0) })}
                </div>
                <div className="mt-0.5 text-base font-mono font-semibold text-emerald-900">
                  {formatTWD(quote.depositAmount)}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[10px] text-zinc-600 font-medium">
                  {t("balance", { pct: ((1 - laborOpts.depositRate) * 100).toFixed(0) })}
                </div>
                <div className="mt-0.5 text-base font-mono font-semibold text-zinc-900">
                  {formatTWD(quote.balanceAmount)}
                </div>
              </div>
            </div>
            <div className="p-3 bg-sky-50">
              <div className="text-[10px] text-sky-700 font-medium">{t("deliveryEst")}</div>
              <div className="mt-0.5 text-base font-mono font-semibold text-sky-900">
                {deliveryIso}
              </div>
              <div className="text-[10px] text-sky-700 mt-0.5">
                {t("buildDays", { n: quote.buildWorkdays })}
                {quote.quantity > 1 && t("qtyCombined", { n: quote.quantity })}
                {quote.bufferDays > 0 && t("bufferDays", { n: quote.bufferDays })}
                {t("laborHours", { hours: quote.laborHours.toFixed(1) })}
              </div>
            </div>
            {/* 有效期：併入 sticky 卡片底部，手機版也看得到 */}
            <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-200 text-[10px] text-zinc-600 flex items-center justify-between">
              <span>{t("expiryNote", { date: expiryIso })}</span>
              <span className="text-zinc-600">{t("expiryDays", { days: laborOpts.expiryDays })}</span>
            </div>
          </div>
        </aside>
      </section>

      {/* Sanity 警告：工時=0 / 毛利為負（議價低於成本） */}
      {(quote.laborHours < 1 || (laborOpts.overrideUnitPrice > 0 && quote.margin < 0)) && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          <div className="font-semibold mb-0.5">{t("sanityH")}</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {quote.laborHours < 1 && (
              <li>{t("lowHoursWarn", { hours: quote.laborHours.toFixed(1) })}</li>
            )}
            {laborOpts.overrideUnitPrice > 0 && quote.margin < 0 && (
              <li>{t("negMarginWarn", { price: formatTWD(laborOpts.overrideUnitPrice), cost: formatTWD(quote.costSubtotal), loss: formatTWD(-quote.margin) })}</li>
            )}
          </ul>
        </div>
      )}

      {/* 成本明細（折疊）— 僅內部模式可見，客戶版完全隱藏 */}
      {viewMode === "internal" && (
      <details open className="mt-6 rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800">
            {t("internalDetailH")}
          </span>
          <span className="text-xs text-zinc-600 flex items-center gap-3">
            <CsvExportButton design={design} />
            <span>{t("expandCollapse")}</span>
          </span>
        </summary>
        <table className="w-full text-sm border-t border-zinc-200">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left p-3">{t("thItem")}</th>
              <th className="text-left p-3">{t("thMethod")}</th>
              <th className="text-right p-3 w-40">{t("thAmount")}</th>
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
                {t("subtotalPerUnit")}
              </td>
              <td className="p-3 text-right font-mono">
                {formatTWD(quote.costSubtotal)}
              </td>
            </tr>
            <tr>
              <td className="p-3 text-zinc-600" colSpan={2}>
                {laborOpts.overrideUnitPrice > 0 ? (
                  <span>
                    {t("margin")}
                    <span className="ml-1 text-[10px] text-amber-700 bg-amber-100 px-1 rounded">
                      {t("marginAfterQuote", { pct: ((quote.margin / quote.costSubtotal) * 100).toFixed(1) })}
                    </span>
                  </span>
                ) : (
                  t("marginPct", { pct: Math.round(laborOpts.marginRate * 100) })
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
            {quote.designerMarkupRate > 0 && (
              <tr className="bg-amber-50/50">
                <td className="p-3 text-amber-900" colSpan={2}>
                  {t("designerMarkup", { pct: Math.round(quote.designerMarkupRate * 100) })}
                  <span className="ml-1 text-[10px] text-amber-700">
                    {t("designerMarkupHint", { price: formatTWD(quote.makerUnitPriceExclVat) })}
                  </span>
                </td>
                <td className="p-3 text-right font-mono text-amber-900">
                  + {formatTWD(quote.designerMarkupAmount)}
                </td>
              </tr>
            )}
            <tr className="border-t border-zinc-300">
              <td className="p-3 font-semibold" colSpan={2}>
                {t("unitPriceExclVat")}
              </td>
              <td className="p-3 text-right font-mono font-semibold">
                {formatTWD(quote.unitPriceExclVat)}
              </td>
            </tr>
            {quote.quantity > 1 && (
              <tr>
                <td className="p-3 text-zinc-600" colSpan={2}>
                  {t("qtyMultiplier", { n: quote.quantity })}
                </td>
                <td className="p-3 text-right font-mono">
                  {formatTWD(quote.subtotalBeforeDiscount)}
                </td>
              </tr>
            )}
            {quote.discountAmount > 0 && (
              <tr>
                <td className="p-3 text-red-600" colSpan={2}>
                  {t("discount", { pct: (laborOpts.discountRate * 100).toFixed(0) })}
                </td>
                <td className="p-3 text-right font-mono text-red-600">
                  − {formatTWD(quote.discountAmount)}
                </td>
              </tr>
            )}
            {(quote.quantity > 1 || quote.discountAmount > 0) && (
              <tr className="border-t border-zinc-300">
                <td className="p-3 font-semibold" colSpan={2}>
                  {t("subtotalExclVat")}
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
                    {t("vat", { pct: (laborOpts.vatRate * 100).toFixed(0) })}
                  </td>
                  <td className="p-3 text-right font-mono">
                    + {formatTWD(quote.vat)}
                  </td>
                </tr>
                <tr className="border-t-2 border-zinc-900 bg-zinc-900 text-white">
                  <td className="p-3 font-bold" colSpan={2}>
                    {t("totalWithVat")}
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
          totalAmount={quote.total}
          deliveryWorkdays={finalDeliveryWorkdays}
        />
      </div>

      {/* 不含項目醒目警示（依表單已含項目動態移除）*/}
      {(() => {
        const exclusions: string[] = [];
        if (laborOpts.shippingCost <= 0 && !termIncludeShipping) {
          exclusions.push(t("exclusionShipping"));
        }
        if (laborOpts.installationCost <= 0 && !termIncludeInstallation) {
          exclusions.push(t("exclusionInstall"));
        }
        if (laborOpts.hardwareCost <= 0) {
          exclusions.push(t("exclusionHardware"));
        }
        exclusions.push(t("exclusionChange"));
        if (exclusions.length === 1) {
          // 只剩變更費那一條的話，這個區塊還是要存在但低調點
          return (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
              <span className="font-medium">{t("termsOnly")}</span>{exclusions[0]}
            </div>
          );
        }
        return (
          <div className="mt-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
            <div className="text-xs font-semibold text-amber-900 mb-1.5">
              {t("exclusionsH")}
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-xs text-amber-900 leading-relaxed">
              {exclusions.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* 公司抬頭 / 匯款 / 分期 / 條款設定——獨立頁，這裡只放連結 */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span className="text-zinc-600">
          {t("brandingNote")}
        </span>
        <Link
          href="/settings/branding"
          target="_blank"
          className="px-3 py-1.5 rounded border border-zinc-700 bg-white text-xs text-zinc-700 hover:bg-zinc-100"
        >
          {t("brandingBtn")}
        </Link>
      </div>

      {/* 最近報價（自帶 details，預設折疊） */}
      <QuoteHistory
        current={{
          customerName: customer.name,
          furnitureName: entryName,
          query: fullQuery,
          total: quote.total,
          quoteNo,
        }}
      />

      {/* 報價說明（折疊） */}
      <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-amber-900 font-medium hover:bg-amber-100">
          {t("helpH")}
        </summary>
        <ul className="px-4 pb-3 pt-1 list-disc pl-9 space-y-0.5 text-xs text-amber-900 leading-relaxed">
          <li>{t("helpItem1")}</li>
          <li>{t("helpItem2")}</li>
          <li>{t("helpItem3")}</li>
          <li>{t("helpItem4")}</li>
        </ul>
      </details>
      </QuoteAccessGate>
    </main>
  );
}

