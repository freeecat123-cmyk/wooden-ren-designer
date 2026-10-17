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
import { computeRaisedFloorBom, withRealPlywoodCount } from "@/lib/raised-floor/calc";
import {
  DEFAULT_RAISED_FLOOR_INPUT,
  type RaisedFloorInput,
} from "@/lib/raised-floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { raisedFloorBomToEngInput } from "@/lib/raised-floor/quote-adapter";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { ENGINEERING_QUOTE_DEFAULTS, sanitizeEngQuoteOpts } from "@/lib/engineering-quote/defaults";
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
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "raisedFloorQuote" });
  return {
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
 title: t("printMetaTitle") };
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
    // ⛔ 網址帶進來的報價參數一律洗過再用 —— 這張單是要交到客戶手上的。
    //    decodeState 只做 base64 + JSON.parse、零驗證，直接攤平會印出
    //    總價 −73,198 / 訂金比總價多 3 倍 / 整張 NaN。（2026-08-23）
    ? sanitizeEngQuoteOpts(safeDecode<EngQuoteOpts>(o))
    : ENGINEERING_QUOTE_DEFAULTS;

  const customer: CustomerInfo = c
    ? { ...EMPTY_CUSTOMER, ...safeDecode<CustomerInfo>(c) }
    : EMPTY_CUSTOMER;

  const bom = withRealPlywoodCount(computeRaisedFloorBom(input, locale));
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
            <RaisedFloorOverviewSvg bom={bom} width={300} locale={locale} />
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
