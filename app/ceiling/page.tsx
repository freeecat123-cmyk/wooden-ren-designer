/**
 * /ceiling — 木作天花板骨架施工模擬器
 *
 * 雙頭路由:訪客 / 無權限者看銷售頁,有權限者進工具。
 * admin 永遠可進。
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { CeilingDevClient } from "./CeilingDevClient";
import { CeilingMarketing } from "./CeilingMarketing";

export const metadata = {
  title: "木作天花板骨架施工模擬器 · 木頭仁",
  description:
    "畫房間 → 算角材、矽酸鈣板、吊筋 → 出 A4 估價單。木作天花板算料 30 秒搞定。",
};

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
