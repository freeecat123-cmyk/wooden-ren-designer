import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bilingualAlternates } from "@/i18n/metadata";
import { routing, type Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact.metadata" });
  const alt = bilingualAlternates("/contact", locale);
  return {
    title: t("title"),
    description: t("description"),
    alternates: alt,
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: alt.canonical,
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <header className="rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-7">
        <h1 className="font-serif-tc text-3xl font-bold tracking-tight text-amber-950">
          {t("h1")}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">{t("lastUpdated")}</p>
      </header>

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-6 space-y-3">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
          {t("companyH2")}
        </h2>
        <ul className="ml-5 list-disc space-y-2 marker:text-amber-500">
          <li>{t("companyName")}</li>
          <li>{t("companyAddress")}</li>
          <li>{t("companyOwner")}</li>
          <li>
            {t("officialSiteLabel")}
            <a
              className="text-amber-800 hover:underline"
              href="https://woodenren.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              woodenren.com
            </a>
          </li>
          <li>
            {t("designerSiteLabel")}
            <a
              className="text-amber-800 hover:underline"
              href="https://designer.woodenren.com"
            >
              designer.woodenren.com
            </a>
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-6 space-y-3">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
          {t("supportH2")}
        </h2>
        <ul className="ml-5 list-disc space-y-2 marker:text-amber-500">
          <li>
            {t("supportEmailLabel")}
            <a
              className="text-amber-800 hover:underline"
              href="mailto:wengbinren@gmail.com"
            >
              wengbinren@gmail.com
            </a>
          </li>
          <li>{t("supportHours")}</li>
          <li>{t("supportSla")}</li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-6 space-y-3">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
          {t("topicsH2")}
        </h2>
        <ul className="ml-5 list-disc space-y-2 marker:text-amber-500">
          <li>{t("topicBilling")}</li>
          <li>
            {t.rich("topicRefund", {
              link: (chunks) => (
                <Link className="text-amber-800 hover:underline mx-1" href="/refund">
                  {chunks}
                </Link>
              ),
            })}
          </li>
          <li>{t("topicOther")}</li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-6 space-y-3">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
          {t("socialH2")}
        </h2>
        <ul className="ml-5 list-disc space-y-2 marker:text-amber-500">
          <li>
            {t("ytLabel")}
            <a
              className="text-amber-800 hover:underline"
              href="https://www.youtube.com/@woodenren"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("ytHandle")}
            </a>
          </li>
          <li>
            {t("academyLabel")}
            <a
              className="text-amber-800 hover:underline"
              href="https://woodenrenclass.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              woodenrenclass.com
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
