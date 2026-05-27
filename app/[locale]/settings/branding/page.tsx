import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrandingForm } from "@/components/branding/BrandingForm";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settingsBranding" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function BrandingSettingsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settingsBranding" });
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{t("h1")}</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {t("hint")}
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
        >
          {t("backHome")}
        </Link>
      </header>

      <BrandingForm defaultOpen />
    </main>
  );
}
