/**
 * /raised-floor — 和室架高平台估價工具
 *
 * 共用 /floor 的權限門檻(canUseFloorTool / 已解鎖 "floor")。
 * admin 永遠可進;無權限 → 導 /pricing?upgrade=floor。
 */
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { RaisedFloorClient } from "./RaisedFloorClient";

export const metadata = {
  title: "和室架高平台估價 · 木頭仁",
};

export default async function RaisedFloorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/raised-floor");

  // admin 永遠可進;其他人:plan 含 canUseFloorTool OR 已單買 "floor" 解鎖任一通過放行
  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseFloorTool");
    const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
    const boughtUnlock = unlockedTools.includes("floor");
    if (!planAllows && !boughtUnlock) {
      redirect("/pricing?upgrade=floor");
    }
  }
  return <RaisedFloorClient />;
}
