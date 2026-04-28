import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { UsersAdminClient } from "@/components/admin/UsersAdminClient";

export const metadata = {
  title: "用戶清單 · 木頭仁 admin",
};

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }

  return <UsersAdminClient />;
}
