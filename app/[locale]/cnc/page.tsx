/**
 * /cnc — CNC 刀路產生器（SVG/DXF → Carvera Air G-code）
 *
 * 雙頭路由：訪客 / 無權限者看銷售頁，有權限者進工具（iframe 載入 /api/cnc-tool）。
 * admin 永遠可進。權限＝訂閱個人版以上 canUseCncTool，或單買 cnc 永久解鎖。
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
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
  searchParams: Promise<{ intro?: string }>;
}) {
  const { intro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <CncMarketing status="guest" />;

  if (intro === "1") {
    return <CncMarketing status="loggedInNoAccess" />;
  }

  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return <CncClient />;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan,subscription_status,subscription_expires_at,student_expires_at")
    .eq("id", user.id)
    .single();
  const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseCncTool");
  const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
  const boughtUnlock = unlockedTools.includes("cnc");
  if (!planAllows && !boughtUnlock) {
    return <CncMarketing status="loggedInNoAccess" />;
  }
  return <CncClient />;
}
