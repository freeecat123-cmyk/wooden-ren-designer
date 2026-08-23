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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.ceilingQuotePrint" });
  return { title: t("metaTitle") };
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
