import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { EcpayLogClient } from "@/components/admin/EcpayLogClient";

export const metadata = {
  title: "綠界日誌 · 木頭仁 admin",
};

export default async function EcpayLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }

  return <EcpayLogClient />;
}
