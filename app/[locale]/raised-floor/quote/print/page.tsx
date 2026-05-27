/**
 * /raised-floor/quote/print — A4 列印用報價單
 *
 * Server component:解 URL ?d/?o/?c/?viewMode → 算 BOM + EngineeringQuote →
 * 餵給共用列印元件 EngineeringQuotePrint(已含 第1頁 品項+三視圖 / 第2頁 付款條件+簽章)。
 *
 * 不做權限檢查:能拿到 URL 的人才會打開,reuse 上層 /raised-floor/quote 的 gate。
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { computeRaisedFloorBom } from "@/lib/raised-floor/calc";
import {
  DEFAULT_RAISED_FLOOR_INPUT,
  type RaisedFloorInput,
} from "@/lib/raised-floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { raisedFloorBomToEngInput } from "@/lib/raised-floor/quote-adapter";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { RaisedFloorOverviewSvg } from "@/lib/raised-floor/RaisedFloorOverviewSvg";
import { EngineeringQuotePrint } from "@/components/engineering-quote/EngineeringQuotePrint";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import type { EngQuoteOpts } from "@/components/engineering-quote/EngineeringQuoteForm";
import { RaisedFloorPrintShell } from "./RaisedFloorPrintShell";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    d?: string;
    o?: string;
    c?: string;
    viewMode?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "raisedFloorQuote" });
  return { title: t("printMetaTitle") };
}

export default async function RaisedFloorQuotePrintPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { d, o, c, viewMode } = await searchParams;

  let input: RaisedFloorInput = DEFAULT_RAISED_FLOOR_INPUT;
  if (d) {
    try {
      input = decodeState<RaisedFloorInput>(d);
    } catch {
      /* fallback 預設 */
    }
  }

  const opts: EngQuoteOpts = o
    ? { ...ENGINEERING_QUOTE_DEFAULTS, ...safeDecode<EngQuoteOpts>(o) }
    : ENGINEERING_QUOTE_DEFAULTS;

  const customer: CustomerInfo = c
    ? { ...EMPTY_CUSTOMER, ...safeDecode<CustomerInfo>(c) }
    : EMPTY_CUSTOMER;

  const bom = computeRaisedFloorBom(input, locale);
  const engInput = raisedFloorBomToEngInput(bom, opts, locale);
  const breakdown = computeEngineeringQuote(engInput, locale);

  // 回設定頁 — 帶回原始 d/o/c 不失焦
  const backParams = new URLSearchParams();
  if (d) backParams.set("d", d);
  const backHref = `/raised-floor/quote?${backParams.toString()}`;

  const mode: "customer" | "internal" =
    viewMode === "internal" ? "internal" : "customer";

  return (
    <RaisedFloorPrintShell customerName={customer.name} backHref={backHref}>
      <EngineeringQuotePrint
        quoteType="floor"
        input={engInput}
        breakdown={breakdown}
        customer={customer}
        overview={
          <div className="w-[300px]">
            <RaisedFloorOverviewSvg bom={bom} width={300} />
          </div>
        }
        viewMode={mode}
      />
    </RaisedFloorPrintShell>
  );
}

function safeDecode<T>(s: string): Partial<T> {
  try {
    return decodeState<T>(s);
  } catch {
    return {};
  }
}
