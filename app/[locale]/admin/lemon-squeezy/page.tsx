import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { LemonSqueezyLogClient } from "@/components/admin/LemonSqueezyLogClient";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("lemonsqueezyTitle") };
}

export default async function AdminLemonSqueezyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }
  return <LemonSqueezyLogClient />;
}
