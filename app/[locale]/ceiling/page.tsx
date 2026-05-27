/**
 * /ceiling — 木作天花板骨架施工模擬器
 *
 * 雙頭路由:訪客 / 無權限者看銷售頁,有權限者進工具。
 * admin 永遠可進。
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { bilingualAlternates } from "@/i18n/metadata";
import { CeilingDevClient } from "./CeilingDevClient";
import { CeilingMarketing } from "./CeilingMarketing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.ceiling" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/ceiling", locale),
  };
}

export default async function CeilingPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>;
}) {
  const { intro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <CeilingMarketing status="guest" />;

  if (intro === "1") {
    return <CeilingMarketing status="loggedInNoAccess" />;
  }

  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return <CeilingDevClient />;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan,subscription_status,subscription_expires_at,student_expires_at")
    .eq("id", user.id)
    .single();
  const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseCeilingTool");
  const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
  const boughtUnlock = unlockedTools.includes("ceiling");
  if (!planAllows && !boughtUnlock) {
    return <CeilingMarketing status="loggedInNoAccess" />;
  }
  return <CeilingDevClient />;
}
