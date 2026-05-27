import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const metadata = {
  title: "後台儀表板 · 木頭仁 admin",
};

/**
 * /admin 是後台首頁——儀表板。
 * proxy.ts 已 middleware 層擋下非 admin，這裡再做一次保險。
 */
export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }

  return <AdminDashboardClient />;
}
