import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { RefundsAdminClient } from "@/components/admin/RefundsAdminClient";

export const metadata = {
  title: "退費審核 · 木頭仁 admin",
};

export default async function AdminRefundsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }
  return <RefundsAdminClient />;
}
