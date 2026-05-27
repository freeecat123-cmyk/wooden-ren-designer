/**
 * /raised-floor — 和室架高平台估價工具
 *
 * 雙頭路由:訪客 / 無權限者看銷售頁,有權限者進工具。
 * 權限門檻共用 /floor 的鑰匙(canUseFloorTool / 已解鎖 "floor")。
 * admin 永遠可進。
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { RaisedFloorClient } from "./RaisedFloorClient";
import { RaisedFloorMarketing } from "./RaisedFloorMarketing";

export const metadata = {
  title: "和室架高平台估價 · 木頭仁",
  description:
    "畫平台 → 算骨架、夾板、面材、防潮、踢腳 → 出 A4 客戶報價單。木工師傅、統包、DIY 自己做和室一次搞定。",
};

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

  // 已登入:plan 含 canUseFloorTool OR 已單買 "floor" 解鎖 → 工具,否則銷售頁
  const { data: profile } = await supabase
    .from("users")
    .select("plan,subscription_status,subscription_expires_at,student_expires_at")
    .eq("id", user.id)
    .single();
  const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseFloorTool");
  const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
  const boughtUnlock = unlockedTools.includes("floor");
  if (!planAllows && !boughtUnlock) {
    return <RaisedFloorMarketing status="loggedInNoAccess" />;
  }
  return <RaisedFloorClient />;
}
