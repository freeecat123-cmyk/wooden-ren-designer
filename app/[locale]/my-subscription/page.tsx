import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MySubscriptionClient } from "@/components/MySubscriptionClient";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "mySubscription" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/my-subscription" },
  };
}

export default function MySubscriptionPage() {
  return <MySubscriptionClient />;
}
