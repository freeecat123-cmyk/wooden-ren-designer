import { bilingualAlternates } from "@/i18n/metadata";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RefundClient } from "./RefundClient";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "refund" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: bilingualAlternates("/refund", locale),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/refund",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function RefundPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "refund" });
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold tracking-tight">{t("h1")}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t("lastUpdated")}</p>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec1H")}</h2>
        <p>
          {t("sec1P1Pre")}
          <strong>{t("sec1P1MidStrong")}</strong>
          {t("sec1P1MidPlain")}
          {t("sec1P1EmStart")}
          <em>{t("sec1P1Em")}</em>
          {t("sec1P1EmEnd")}
        </p>
        <p>
          {t("sec1P2Pre")}
          <strong>{t("sec1P2Strong")}</strong>
          {t("sec1P2Suffix")}
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec2H")}</h2>
        <p>{t("sec2P")}</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>{t("sec2Li1")}</li>
          <li>{t("sec2Li2")}</li>
          <li>{t("sec2Li3")}</li>
        </ul>
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
        <ol className="ml-5 list-decimal space-y-2">
          <li>
            {t("sec4Li1Pre")}
            <a className="underline" href="mailto:wengbinren@gmail.com">
              {t("sec4Li1Email")}
            </a>
            {t("sec4Li1Suffix")}
          </li>
          <li>{t("sec4Li2")}</li>
          <li>{t("sec4Li3")}</li>
          <li>
            {t("sec4Li4Pre")}
            <strong>{t("sec4Li4Strong")}</strong>
            {t("sec4Li4Suffix")}
          </li>
        </ol>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("sec5H")}</h2>
        <p>
          {t("sec5Company")}
          <br />
          {t("sec5AddrLabel")}
          {t("sec5Addr")}
          <br />
          {t("sec5EmailLabel")}
          <a className="underline" href="mailto:wengbinren@gmail.com">
            wengbinren@gmail.com
          </a>
        </p>
      </section>

      <RefundClient />
    </main>
  );
}
