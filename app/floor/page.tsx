/**
 * /floor — 地板施工模擬器
 *
 * 雙頭路由:訪客 / 無權限者看銷售頁,有權限者進工具。
 * admin 永遠可進。
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { FloorDevClient } from "./FloorDevClient";
import { FloorMarketing } from "./FloorMarketing";

export const metadata = {
  title: "地板施工模擬器 · 木頭仁",
  description:
    "畫房間 → 直鋪 / 錯縫 / 人字拼自動排版 → 算片數損耗估價。木地板算料 30 秒搞定。",
};

export default async function FloorPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>;
}) {
  const { intro } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <FloorMarketing status="guest" />;

  if (intro === "1") {
    return <FloorMarketing status="loggedInNoAccess" />;
  }

  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return <FloorDevClient />;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan,subscription_status,subscription_expires_at,student_expires_at")
    .eq("id", user.id)
    .single();
  const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseFloorTool");
  const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
  const boughtUnlock = unlockedTools.includes("floor");
  if (!planAllows && !boughtUnlock) {
    return <FloorMarketing status="loggedInNoAccess" />;
  }
  return <FloorDevClient />;
}
