import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { computeFloorBom } from "@/lib/floor/calc";
import { DEFAULT_FLOOR_INPUT, type FloorInput } from "@/lib/floor/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { floorBomToEngInput } from "@/lib/floor/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { FloorOverviewSvg } from "@/lib/floor/FloorOverviewSvg";
import { EngineeringQuoteClient } from "@/components/engineering-quote/EngineeringQuoteClient";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";

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
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.floorQuote" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
  };
}

export default async function FloorQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({
      href: `/login?next=${encodeURIComponent("/floor/quote")}`,
      locale,
    });
    return null;
  }

  // admin 永遠可進，其他人依 canUseFloorTool permission
  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    /**
     * ⛔ 原本只看方案,沒查買斷紀錄 → **買斷了 floor 工具的客人,
     *    進到工具內的「產生報價單」照樣被踢到 /pricing**(工具本體進得去、
     *    報價頁進不去)。錢收了功能沒給,是客訴級的。
     *    姊妹頁 /raised-floor/quote 本來就有查(那支是對的),這兩支漏了。
     *    (2026-08-24 大軍稽核抓到)
     */
    const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseFloorTool");
    const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
    const boughtUnlock = unlockedTools.includes("floor");
    if (!planAllows && !boughtUnlock) {
      redirect({ href: "/pricing?upgrade=floor", locale });
    }
  }

  const { d } = await searchParams;
  let input: FloorInput = DEFAULT_FLOOR_INPUT;
  if (d) {
    try {
      input = decodeState<FloorInput>(d);
    } catch {
      input = DEFAULT_FLOOR_INPUT;
    }
  }

  const bom = computeFloorBom(input, locale);
  const engInput = floorBomToEngInput(bom, ENGINEERING_QUOTE_DEFAULTS, locale);

  return (
    <EngineeringQuoteClient
      quoteType="floor"
      encodedSimInput={d ?? ""}
      overview={<FloorOverviewSvg bom={bom} width={360} locale={locale} />}
      base={{
        pingShu: engInput.pingShu,
        areaM2: engInput.areaM2,
        materialCost: engInput.materialCost,
        materialLines: engInput.materialLines,
      }}
    />
  );
}
