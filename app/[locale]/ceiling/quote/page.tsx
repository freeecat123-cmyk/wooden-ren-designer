import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { computeCeilingBom } from "@/lib/ceiling/calc";
import { DEFAULT_CEILING_INPUT, type CeilingInput } from "@/lib/ceiling/types";
import { decodeState } from "@/lib/engineering-quote/url-codec";
import { ceilingBomToEngInput } from "@/lib/ceiling/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { CeilingOverviewSvg } from "@/lib/ceiling/CeilingOverviewSvg";
import { EngineeringQuoteClient } from "@/components/engineering-quote/EngineeringQuoteClient";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.ceilingQuote" });
  return { title: t("metaTitle") };
}

export default async function CeilingQuotePage({
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
      href: `/login?next=${encodeURIComponent("/ceiling/quote")}`,
      locale,
    });
    return null;
  }

  // admin 永遠可進，其他人依 canUseCeilingTool permission
  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    /**
     * ⛔ 原本只看方案,沒查買斷紀錄 → **買斷了 ceiling 工具的客人,
     *    進到工具內的「產生報價單」照樣被踢到 /pricing**(工具本體進得去、
     *    報價頁進不去)。錢收了功能沒給,是客訴級的。
     *    姊妹頁 /raised-floor/quote 本來就有查(那支是對的),這兩支漏了。
     *    (2026-08-24 大軍稽核抓到)
     */
    const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseCeilingTool");
    const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
    const boughtUnlock = unlockedTools.includes("ceiling");
    if (!planAllows && !boughtUnlock) {
      redirect({ href: "/pricing?upgrade=ceiling", locale });
    }
  }

  const { d } = await searchParams;
  let input: CeilingInput = DEFAULT_CEILING_INPUT;
  if (d) {
    try {
      input = decodeState<CeilingInput>(d);
    } catch {
      input = DEFAULT_CEILING_INPUT;
    }
  }

  const bom = computeCeilingBom(input, locale);
  // 編輯頁初始 materialPerPing = 0，實際值由 client 的費用表單帶
  const engInput = ceilingBomToEngInput(bom, 0, ENGINEERING_QUOTE_DEFAULTS, locale);

  return (
    <EngineeringQuoteClient
      quoteType="ceiling"
      encodedSimInput={d ?? ""}
      overview={<CeilingOverviewSvg bom={bom} locale={locale} />}
      base={{
        pingShu: engInput.pingShu,
        areaM2: engInput.areaM2,
        materialCost: engInput.materialCost,
        materialLines: engInput.materialLines,
      }}
    />
  );
}
