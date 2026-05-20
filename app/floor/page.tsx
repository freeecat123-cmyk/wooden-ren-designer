/**
 * /floor — 地板施工模擬器
 *
 * 階段 1(目前):純算料引擎驗證頁,只限 admin 看。
 *   非 admin 進來 → 導 /pricing?upgrade=floor
 *   階段 4 才會接 canUseFloorTool 對外開放。
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { FloorDevClient } from "./FloorDevClient";

export const metadata = {
  title: "地板施工模擬器 · 木頭仁",
};

export default async function FloorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/floor");

  // admin 永遠可進(內部測試用),其他人依 canUseFloorTool permission
  if (!isAdminEmail(user.email, getServerAdminEmails())) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    if (!canUseFeature(profile as UserPlanProfile | null, "canUseFloorTool")) {
      redirect("/pricing?upgrade=floor");
    }
  }
  return <FloorDevClient />;
}
