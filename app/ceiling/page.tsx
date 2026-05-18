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
import { CeilingDevClient } from "./CeilingDevClient";

export const metadata = {
  title: "木作天花板骨架施工模擬器 · 木頭仁",
};

/**
 * Ceiling 開發頁額外白名單(階段 1-3 dev 期擴給 freeecat 內部帳號)
 * 階段 4 開放給付費用戶後此白名單可拿掉。
 */
const CEILING_DEV_EXTRA_ALLOWLIST = new Set([
  "freeecat123@gmail.com",
  "freeecat123@woodenren.com",
]);

export default async function CeilingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  const adminList = getServerAdminEmails().map((e) => e.toLowerCase());
  const allowed =
    !!email && (adminList.includes(email) || CEILING_DEV_EXTRA_ALLOWLIST.has(email));
  if (!allowed) {
    redirect("/?ceiling_denied=1");
  }
  return <CeilingDevClient />;
}
