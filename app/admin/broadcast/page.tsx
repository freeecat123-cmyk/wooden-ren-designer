import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { BroadcastClient } from "@/components/admin/BroadcastClient";

export const metadata = {
  title: "批次寄信 · 木頭仁 admin",
};

export default async function AdminBroadcastPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }
  return <BroadcastClient />;
}
