import { bilingualAlternates } from "@/i18n/metadata";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LemonSubscriptionClient } from "@/components/LemonSubscriptionClient";
import { MySubscriptionClient } from "@/components/MySubscriptionClient";
import { routing } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "mySubscription" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/my-subscription", locale),
  };
}

export default async function MySubscriptionPage({ params }: PageProps) {
  const { locale } = await params;
  // 中文版：原 ECPay 版（ATM/CVS/Barcode 取號等流程）
  if (locale === routing.defaultLocale) {
    return <MySubscriptionClient />;
  }
  // 國際版：Lemon Squeezy 版（customer portal 連結）
  return <LemonSubscriptionClient />;
}
