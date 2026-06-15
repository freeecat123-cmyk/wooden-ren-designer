import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bilingualAlternates } from "@/i18n/metadata";
import { routing, type Locale } from "@/i18n/routing";
import { InstallCTA } from "@/components/InstallCTA";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "installPage.metadata" });
  const alt = bilingualAlternates("/install", locale);
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

export default async function InstallPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "installPage" });

  const benefits = ["benefit1", "benefit2", "benefit3"] as const;
  const iosSteps = ["iosStep1", "iosStep2", "iosStep3"] as const;
  const androidSteps = ["androidStep1", "androidStep2", "androidStep3"] as const;
  const desktopSteps = ["desktopStep1", "desktopStep2"] as const;
  const faqs = ["faq1", "faq2", "faq3"] as const;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      {/* Hero */}
      <header className="rounded-2xl bg-gradient-to-br from-amber-50 to-stone-100 ring-1 ring-amber-900/10 shadow-sm px-6 py-9 text-center">
        <div className="text-5xl" aria-hidden>
          📲
        </div>
        <h1 className="mt-3 font-serif-tc text-3xl font-bold tracking-tight text-amber-950">
          {t("h1")}
        </h1>
        <p className="mt-3 mx-auto max-w-xl text-zinc-600">{t("intro")}</p>
        <div className="mt-6 flex justify-center">
          <InstallCTA />
        </div>
        <p className="mt-3 text-xs text-zinc-500">{t("freeNote")}</p>
      </header>

      {/* Why install */}
      <section className="mt-8">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950">
          {t("whyH2")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {benefits.map((k) => (
            <li
              key={k}
              className="rounded-xl bg-white ring-1 ring-amber-900/10 shadow-sm px-4 py-4"
            >
              <div className="text-2xl" aria-hidden>
                {t(`${k}Icon`)}
              </div>
              <p className="mt-2 font-semibold text-amber-950 text-sm">
                {t(`${k}Title`)}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{t(`${k}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* iOS */}
      <section className="mt-8 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-6">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
          <span aria-hidden>🍎</span>
          {t("iosH2")}
        </h2>
        <ol className="mt-4 space-y-2 list-decimal list-inside text-zinc-700">
          {iosSteps.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-amber-800 bg-amber-100 rounded px-3 py-2 leading-relaxed">
          {t("iosWarn")}
        </p>
      </section>

      {/* Android */}
      <section className="mt-6 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-6">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
          <span aria-hidden>🤖</span>
          {t("androidH2")}
        </h2>
        <ol className="mt-4 space-y-2 list-decimal list-inside text-zinc-700">
          {androidSteps.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ol>
      </section>

      {/* Desktop */}
      <section className="mt-6 rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-6">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
          <span aria-hidden>💻</span>
          {t("desktopH2")}
        </h2>
        <ol className="mt-4 space-y-2 list-decimal list-inside text-zinc-700">
          {desktopSteps.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section className="mt-8">
        <h2 className="font-serif-tc text-xl font-bold text-amber-950">
          {t("faqH2")}
        </h2>
        <div className="mt-4 space-y-3">
          {faqs.map((k) => (
            <details
              key={k}
              className="group rounded-xl bg-white ring-1 ring-amber-900/10 shadow-sm px-5 py-4"
            >
              <summary className="cursor-pointer font-semibold text-amber-950 list-none flex items-center justify-between gap-3">
                {t(`${k}Q`)}
                <span
                  aria-hidden
                  className="text-amber-500 transition-transform group-open:rotate-45"
                >
                  ＋
                </span>
              </summary>
              <p className="mt-2 text-sm text-zinc-600">{t(`${k}A`)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-10 rounded-2xl bg-amber-900 px-6 py-8 text-center text-amber-50">
        <h2 className="font-serif-tc text-2xl font-bold">{t("finalH2")}</h2>
        <p className="mt-2 text-amber-100/90">{t("finalBody")}</p>
        <Link
          href="/app"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-6 py-3 font-semibold text-amber-950 hover:bg-white transition-colors"
        >
          {t("finalBtn")}
        </Link>
      </section>
    </main>
  );
}
