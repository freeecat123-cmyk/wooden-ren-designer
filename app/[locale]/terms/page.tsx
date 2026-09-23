import { bilingualAlternates } from "@/i18n/metadata";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/terms", locale),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/terms",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "terms" });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold tracking-tight">{t("h1")}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t("lastUpdated")}</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec1H")}</h2>
        <p>
          {t("sec1Pre")}
          <strong>{t("sec1Strong")}</strong>
          {t("sec1Suffix")}
          <a className="underline" href="mailto:wengbinren@gmail.com">
            wengbinren@gmail.com
          </a>
          {t("sec1Period")}
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec2H")}</h2>
        <p>{t("sec2P1")}</p>
        <p>{t("sec2P2")}</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec3H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>{t("sec3Li1")}</li>
          <li>{t("sec3Li2")}</li>
          <li>{t("sec3Li3")}</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec4H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>{t("sec4Li1")}</li>
          <li>{t("sec4Li2")}</li>
          <li>
            {t("sec4Li3Pre")}
            <a className="underline" href="mailto:wengbinren@gmail.com">
              wengbinren@gmail.com
            </a>
            {t("sec4Li3Suffix")}
          </li>
          <li>
            <strong>{t("sec4Li4Strong")}</strong>
            {t("sec4Li4")}
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec5H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>{t("sec5Li1")}</li>
          <li>
            {t("sec5Li2Pre")}
            <strong>{t("sec5Li2Strong")}</strong>
            {t("sec5Li2Suffix")}
          </li>
          <li>{t("sec5Li3")}</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec6H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            {t("sec6Li1Pre")}
            <strong>{t("sec6Li1Strong")}</strong>
            {t("sec6Li1Suffix")}
          </li>
          <li>{t("sec6Li2")}</li>
          <li>{t("sec6Li3")}</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec7H")}</h2>
        <p>{t("sec7P")}</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec8H")}</h2>
        <p>{t("sec8P")}</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec9H")}</h2>
        <p>
          {t("sec9Pre")}
          <strong>{t("sec9Strong")}</strong>
          {t("sec9Suffix")}
        </p>
      </section>

      <p className="mt-10 text-sm text-zinc-500">
        {t("footerPre")}
        <a className="underline" href="mailto:wengbinren@gmail.com">
          wengbinren@gmail.com
        </a>
        {t("footerSuffix")}
      </p>
    </main>
  );
}
