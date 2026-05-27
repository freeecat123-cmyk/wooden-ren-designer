import { bilingualAlternates } from "@/i18n/metadata";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/privacy", locale),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/privacy",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold tracking-tight">{t("h1")}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t("lastUpdated")}</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec1H")}</h2>
        <p>
          {t("sec1P1Pre")}
          <strong>{t("sec1P1Strong")}</strong>
          {t("sec1P1Suffix")}
          <a className="underline" href="mailto:wengbinren@gmail.com">
            wengbinren@gmail.com
          </a>
          {t("sec1P1Period")}
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec2H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>{t("sec2Li1Strong")}</strong>
            {t("sec2Li1")}
          </li>
          <li>
            <strong>{t("sec2Li2Strong")}</strong>
            {t("sec2Li2")}
          </li>
          <li>
            <strong>{t("sec2Li3Strong")}</strong>
            {t("sec2Li3")}
            <strong>{t("sec2Li3Strong2")}</strong>
            {t("sec2Li3Suffix")}
          </li>
          <li>
            <strong>{t("sec2Li4Strong")}</strong>
            {t("sec2Li4")}
          </li>
          <li>
            <strong>{t("sec2Li5Strong")}</strong>
            {t("sec2Li5")}
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec3H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>{t("sec3Li1")}</li>
          <li>{t("sec3Li2")}</li>
          <li>{t("sec3Li3")}</li>
          <li>{t("sec3Li4")}</li>
        </ul>
        <p>
          {t.rich("sec3P", {
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec4H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>{t("sec4Li1Strong")}</strong>
            {t("sec4Li1Suffix")}
          </li>
          <li>
            <strong>{t("sec4Li2Strong")}</strong>
            {t("sec4Li2Suffix")}
          </li>
          <li>
            <strong>{t("sec4Li3Strong")}</strong>
            {t("sec4Li3Suffix")}
          </li>
          <li>
            <strong>{t("sec4Li4Strong")}</strong>
            {t("sec4Li4Suffix")}
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec5H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>{t("sec5Li1")}</li>
          <li>
            {t("sec5Li2Pre")}
            <code>{t("sec5Li2Code")}</code>
            {t("sec5Li2Suffix")}
          </li>
          <li>
            {t.rich("sec5Li3", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec6H")}</h2>
        <p>{t("sec6P1")}</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>{t("sec6Li1")}</li>
          <li>{t("sec6Li2")}</li>
          <li>{t("sec6Li3")}</li>
        </ul>
        <p>
          {t("sec6P2Pre")}
          <a className="underline" href="mailto:wengbinren@gmail.com">
            wengbinren@gmail.com
          </a>
          {t("sec6P2Suffix")}
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec7H")}</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>{t("sec7Li1")}</li>
          <li>{t("sec7Li2")}</li>
          <li>{t("sec7Li3")}</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec8H")}</h2>
        <p>{t("sec8P")}</p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec9H")}</h2>
        <p>{t("sec9P")}</p>
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
