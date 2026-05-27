/**
 * /raised-floor — 和室架高平台估價工具
 *
 * 雙頭路由:訪客 / 無權限者看銷售頁,有權限者進工具。
 * 權限門檻:canUseRaisedFloorTool plan flag OR 已單買 "raised-floor" 解鎖。
 * admin 永遠可進。
 *
 * (2026-05-27 之前共用 /floor 的鑰匙當 fallback,但 raised-floor 進 ToolId
 * 後改用獨立 flag,讓單買 raised-floor 也能開鎖。)
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { bilingualAlternates } from "@/i18n/metadata";
import { RaisedFloorClient } from "./RaisedFloorClient";
import { RaisedFloorMarketing } from "./RaisedFloorMarketing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "engineeringToolPages.raisedFloor" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/raised-floor", locale),
  };
}

export default async function RaisedFloorPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>;
}) {
  const { intro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 訪客 → 銷售頁
  if (!user) return <RaisedFloorMarketing status="guest" />;

  // ?intro=1 強制顯示介紹頁（讓 admin/付費用戶也能從 /templates「了解更多」進來）
  if (intro === "1") {
    return <RaisedFloorMarketing status="loggedInNoAccess" />;
  }

  // admin 直通工具
  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return <RaisedFloorClient />;
  }

  // 已登入:plan 含 canUseRaisedFloorTool OR 已單買 "raised-floor" 解鎖 → 工具
  const { data: profile } = await supabase
    .from("users")
    .select("plan,subscription_status,subscription_expires_at,student_expires_at")
    .eq("id", user.id)
    .single();
  const planAllows = canUseFeature(
    profile as UserPlanProfile | null,
    "canUseRaisedFloorTool",
  );
  const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
  const boughtUnlock = unlockedTools.includes("raised-floor");
  if (!planAllows && !boughtUnlock) {
    return <RaisedFloorMarketing status="loggedInNoAccess" />;
  }
  return <RaisedFloorClient />;
}
