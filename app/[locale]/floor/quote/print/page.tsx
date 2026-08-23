import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT, type FloorInput } from "@/lib/floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { floorBomToEngInput } from "@/lib/floor/quote-adapter";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { ENGINEERING_QUOTE_DEFAULTS, sanitizeEngQuoteOpts } from "@/lib/engineering-quote/defaults";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { EngineeringQuotePrint } from "@/components/engineering-quote/EngineeringQuotePrint";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import type { EngQuoteOpts } from "@/components/engineering-quote/EngineeringQuoteForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.floorQuotePrint" });
  return { title: t("metaTitle") };
}

export default async function FloorQuotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ d?: string; o?: string; c?: string; viewMode?: string }>;
}) {
  const { locale } = await params;
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
    // ⛔ 網址帶進來的報價參數一律洗過再用 —— 這張單是要交到客戶手上的。
    //    decodeState 只做 base64 + JSON.parse、零驗證，直接攤平會印出
    //    總價 −73,198 / 訂金比總價多 3 倍 / 整張 NaN。（2026-08-23）
    ? sanitizeEngQuoteOpts(safeDecode<EngQuoteOpts>(o))
    : ENGINEERING_QUOTE_DEFAULTS;
  const customer: CustomerInfo = c
    ? { ...EMPTY_CUSTOMER, ...safeDecode<CustomerInfo>(c) }
    : EMPTY_CUSTOMER;

  const bom = computeFloorBom(input, locale);
  const engInput = floorBomToEngInput(bom, opts, locale);
  const breakdown = computeEngineeringQuote(engInput, locale);

  return (
    <EngineeringQuotePrint
      quoteType="floor"
      input={engInput}
      breakdown={breakdown}
      customer={customer}
      overview={<FloorOverviewSvg bom={bom} width={300} locale={locale} />}
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
