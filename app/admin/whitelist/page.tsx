import { WhitelistAdminClient } from "@/components/admin/WhitelistAdminClient";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const metadata = {
  title: "白名單管理 · 木頭仁 admin",
};

/**
 * 白名單後台。proxy.ts 已 middleware 層擋下非 admin，
 * 但 server component 再做一次保險（middleware 萬一因 matcher 規則漏放）。
 */
export default async function WhitelistAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }

  return <WhitelistAdminClient />;
}
