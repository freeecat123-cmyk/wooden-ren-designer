import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { computeCeilingBom } from "@/lib/ceiling/calc";
import { DEFAULT_CEILING_INPUT, type CeilingInput } from "@/lib/ceiling/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { ceilingBomToEngInput } from "@/lib/ceiling/quote-adapter";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { ENGINEERING_QUOTE_DEFAULTS, sanitizeEngQuoteOpts } from "@/lib/engineering-quote/defaults";
import { CeilingOverviewSvg } from "@/lib/ceiling/CeilingOverviewSvg";
import { EngineeringQuotePrint } from "@/components/engineering-quote/EngineeringQuotePrint";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import type { EngQuoteOpts } from "@/components/engineering-quote/EngineeringQuoteForm";

/**
 * ⛔ 報價單網址一律 noindex ＋ no-referrer。
 *
 * 這個網址把**客戶的個人資料直接寫在查詢字串裡**（`customerName` /
 * `customerPhone` / `customerAddress` / `customerEmail`，或裝潢工具的 `c=`
 * base64 包），而且頁面上就印著客戶姓名、地址、每一項金額。木匠會把這條連結
 * 貼給客戶 —— 一旦出現在對方的網站／論壇／轉寄信裡，Google 就有路徑爬到它。
 *
 * ⚠️ `app/robots.ts` 的 `Disallow: /design/<款>/quote` **不夠**，而且裝潢工具那組
 *    （`/ceiling/quote`、`/floor/quote`、`/raised-floor/quote`）robots.txt 根本沒列：
 *    ① 被 Disallow 的網址 Google 不爬 → 讀不到 noindex，有外部連結時仍可能以
 *       「無描述」形式把網址本身收錄進去，而網址本身就含客戶姓名。
 *    ② robots.txt 完全管不到 Referer 標頭 —— 頁上任何外連都會把整條
 *       含客戶資料的網址送給對方的伺服器。`referrer: "no-referrer"` 才管得到。
 *    同一招 `shared-design/[token]` 與 `projects/<id>/quote` 已經在用。（2026-10-17）
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.ceilingQuotePrint" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
  };
}

export default async function CeilingQuotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ d?: string; o?: string; c?: string; viewMode?: string }>;
}) {
  const { locale } = await params;
  const { d, o, c, viewMode } = await searchParams;

  let input: CeilingInput = DEFAULT_CEILING_INPUT;
  if (d) {
    try {
      input = decodeState<CeilingInput>(d);
    } catch {
      /* fallback 預設 */
    }
  }
  const opts: EngQuoteOpts = o
    // ⛔ 網址帶進來的報價參數一律洗過再用 —— 這張單是要交到客戶手上的。
    //    decodeState 只做 base64 + JSON.parse、零驗證，直接攤平會印出
    //    總價 −73,198 / 訂金比總價多 3 倍 / 整張 NaN。（2026-08-23）
    ? sanitizeEngQuoteOpts(safeDecode<EngQuoteOpts>(o))
    : ENGINEERING_QUOTE_DEFAULTS;
  const customer: CustomerInfo = c
    ? { ...EMPTY_CUSTOMER, ...safeDecode<CustomerInfo>(c) }
    : EMPTY_CUSTOMER;

  const bom = computeCeilingBom(input, locale);
  const engInput = ceilingBomToEngInput(bom, opts.ceilingMaterialPerPing, opts, locale);
  const breakdown = computeEngineeringQuote(engInput, locale);

  return (
    <EngineeringQuotePrint
      quoteType="ceiling"
      input={engInput}
      breakdown={breakdown}
      customer={customer}
      overview={<CeilingOverviewSvg bom={bom} locale={locale} />}
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
