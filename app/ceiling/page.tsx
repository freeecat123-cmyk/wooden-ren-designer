/**
 * /ceiling — 木作天花板骨架施工模擬器
 *
 * 階段 1(目前):純算料引擎驗證頁,只限 admin 看(getServerAdminEmails)。
 *   非 admin 進來 → 導 /?ceiling_denied=1
 *   階段 4 才會接 canUseCeilingTool permission flag + 對外開放。
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { CeilingDevClient } from "./CeilingDevClient";

export const metadata = {
  title: "木作天花板骨架施工模擬器 · 木頭仁",
};

/** 階段 4 dev 內部白名單(永遠繞過 permission,給開發用) */
const CEILING_DEV_EXTRA_ALLOWLIST = new Set([
  "freeecat123@gmail.com",
  "freeecat123@woodenren.com",
]);

export default async function CeilingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/ceiling");

  const email = user.email?.toLowerCase();
  const adminList = getServerAdminEmails().map((e) => e.toLowerCase());
  const isAdminOrDev =
    !!email && (adminList.includes(email) || CEILING_DEV_EXTRA_ALLOWLIST.has(email));

  // admin/dev 永遠可進,其他人依 canUseCeilingTool permission
  if (!isAdminOrDev) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan,subscription_status,subscription_expires_at,student_expires_at")
      .eq("id", user.id)
      .single();
    if (!canUseFeature(profile as UserPlanProfile | null, "canUseCeilingTool")) {
      redirect("/pricing?upgrade=ceiling");
    }
  }
  return <CeilingDevClient />;
}
