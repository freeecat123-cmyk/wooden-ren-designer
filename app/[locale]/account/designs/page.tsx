import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MyDesignsClient } from "@/components/MyDesignsClient";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "myDesigns" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/account/designs" },
  };
}

export default function MyDesignsPage() {
  return <MyDesignsClient />;
}
