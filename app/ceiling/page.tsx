/**
 * /ceiling — 木作天花板骨架施工模擬器
 *
 * 階段 1(目前):純算料引擎驗證頁,只限 admin 看(getServerAdminEmails)。
 *   非 admin 進來 → 導 /?ceiling_denied=1
 *   階段 4 才會接 canUseCeilingTool permission flag + 對外開放。
 */

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";
import { CeilingDevClient } from "./CeilingDevClient";

export const metadata = {
  title: "木作天花板骨架施工模擬器 · 木頭仁",
};

export default async function CeilingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/ceiling");

  // admin 永遠可進(內部測試用),其他人:plan OR 工具單買斷 任一通過放行
  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    const planAllows = canUseFeature(profile as UserPlanProfile | null, "canUseCeilingTool");
    const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
    const boughtUnlock = unlockedTools.includes("ceiling");
    if (!planAllows && !boughtUnlock) {
      redirect("/pricing?upgrade=ceiling");
    }
  }
  return <CeilingDevClient />;
}
