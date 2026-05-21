/**
 * /floor — 地板施工模擬器
 *
 * admin 永遠可進;其他人依 canUseFloorTool 權限(個人版以上開放),
 * 無權限 → 導 /pricing?upgrade=floor。
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
