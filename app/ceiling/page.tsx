/**
 * /ceiling — 木作天花板骨架施工模擬器
 *
 * 階段 1(目前):純算料引擎驗證頁,只限 admin 看(getServerAdminEmails)。
 *   非 admin 進來 → 導 /?ceiling_denied=1
 *   階段 4 才會接 canUseCeilingTool permission flag + 對外開放。
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { CeilingDevClient } from "./CeilingDevClient";

export const metadata = {
  title: "木作天花板骨架施工模擬器 · 木頭仁",
};

export default async function CeilingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?ceiling_denied=1");
  }
  return <CeilingDevClient />;
}
