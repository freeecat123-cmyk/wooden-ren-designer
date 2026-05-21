import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT, type FloorInput } from "@/lib/floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { floorBomToEngInput } from "@/lib/floor/quote-adapter";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { EngineeringQuotePrint } from "@/components/engineering-quote/EngineeringQuotePrint";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import type { EngQuoteOpts } from "@/components/engineering-quote/EngineeringQuoteForm";

export const metadata = {
  title: "地板工程報價單 · 木頭仁",
};

export default async function FloorQuotePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; o?: string; c?: string; viewMode?: string }>;
}) {
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
    ? { ...ENGINEERING_QUOTE_DEFAULTS, ...safeDecode<EngQuoteOpts>(o) }
    : ENGINEERING_QUOTE_DEFAULTS;
  const customer: CustomerInfo = c
    ? { ...EMPTY_CUSTOMER, ...safeDecode<CustomerInfo>(c) }
    : EMPTY_CUSTOMER;

  const bom = computeFloorBom(input);
  const engInput = floorBomToEngInput(bom, opts);
  const breakdown = computeEngineeringQuote(engInput);

  return (
    <EngineeringQuotePrint
      quoteType="floor"
      input={engInput}
      breakdown={breakdown}
      customer={customer}
      overview={<FloorOverviewSvg bom={bom} width={300} />}
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
