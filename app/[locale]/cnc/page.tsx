/**
 * /cnc — CNC 刀路產生器（SVG/DXF → G-code）
 *
 * 雙頭路由：訪客 / 無權限者看銷售頁，有權限者進工具（iframe 載入 /api/cnc-tool）。
 * 權限＝admin／訂閱個人版以上／單買 NT$499 買斷／7 天免費試用期內，
 * 判定全部委給 lib/cnc/access.ts（見該檔說明：這個判斷有四個呼叫點，只准有一份定義）。
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolveCncAccess } from "@/lib/cnc/access";
import { bilingualAlternates } from "@/i18n/metadata";
import { CncClient } from "./CncClient";
import { CncMarketing } from "./CncMarketing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.cnc" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/cnc", locale),
  };
}

export default async function CncPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string; trial?: string }>;
}) {
  const { intro, trial } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 訪客：一律銷售頁，且主打「免費試用 7 天」（他還沒有帳號，資格必然還在）
  if (!user) return <CncMarketing status="guest" trialAvailable />;

  const access = await resolveCncAccess(supabase, user);

  // ?intro=1 = 有權限的人想回頭看銷售頁（分享／看方案），不要把他彈進工具
  if (intro === "1" || !access.allowed) {
    return (
      <CncMarketing
        status="loggedInNoAccess"
        trialAvailable={!access.trialUsed && !access.allowed}
        trialEndedAt={access.reason === "trialExpired" ? access.trialEndsAt : null}
        notice={trial === "used" ? "used" : trial === "error" ? "error" : null}
      />
    );
  }

  return <CncClient />;
}
