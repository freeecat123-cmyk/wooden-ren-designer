/**
 * /raised-floor/quote — 和室架高平台工程報價(預覽/設定頁)
 *
 * 共用 /floor 的權限門檻(canUseFloorTool / 已解鎖 "floor")。
 * URL query: ?d=<base64 RaisedFloorInput>
 */
import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { computeRaisedFloorBom, withRealPlywoodCount } from "@/lib/raised-floor/calc";
import {
  DEFAULT_RAISED_FLOOR_INPUT,
  type RaisedFloorInput,
} from "@/lib/raised-floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { raisedFloorBomToEngInput } from "@/lib/raised-floor/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { RaisedFloorOverviewSvg } from "@/lib/raised-floor/RaisedFloorOverviewSvg";
import { RaisedFloorQuoteClient } from "./RaisedFloorQuoteClient";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ d?: string }>;
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
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
  };
}

export default async function RaisedFloorQuotePage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({
      href: `/login?next=${encodeURIComponent("/raised-floor/quote")}`,
      locale,
    });
    return null;
  }

  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    const planAllows = canUseFeature(
      profile as UserPlanProfile | null,
      "canUseFloorTool",
    );
    const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
    const boughtUnlock = unlockedTools.includes("raised-floor");
    if (!planAllows && !boughtUnlock) {
      redirect({ href: "/pricing?upgrade=raised-floor", locale });
    }
  }

  const { d } = await searchParams;
  let input: RaisedFloorInput = DEFAULT_RAISED_FLOOR_INPUT;
  if (d) {
    try {
      input = decodeState<RaisedFloorInput>(d);
    } catch {
      input = DEFAULT_RAISED_FLOOR_INPUT;
    }
  }

  const bom = withRealPlywoodCount(computeRaisedFloorBom(input, locale));
  const engInput = raisedFloorBomToEngInput(bom, ENGINEERING_QUOTE_DEFAULTS, locale);

  return (
    <RaisedFloorQuoteClient
      encodedSimInput={d ?? ""}
      overview={
        <div className="w-full max-w-sm">
          <RaisedFloorOverviewSvg bom={bom} width={360} locale={locale} />
        </div>
      }
      base={{
        pingShu: engInput.pingShu,
        areaM2: engInput.areaM2,
        materialCost: engInput.materialCost,
        materialLines: engInput.materialLines,
      }}
    />
  );
}
