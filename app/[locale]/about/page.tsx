import type { Metadata } from "next";
import Image from "next/image";
import { Fragment } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  TEMPLATE_UNLOCK_PRICES,
} from "@/lib/pricing/template-unlock";
import { AcademyPromoBanner } from "@/components/AcademyPromoBanner";
import { Link } from "@/i18n/navigation";
import { bilingualAlternates } from "@/i18n/metadata";
import { routing, type Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about.metadata" });
  const alt = bilingualAlternates("/about", locale);
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
    twitter: {
      card: "summary_large_image",
      title: t("twitterTitle"),
      description: t("twitterDescription"),
      images: ["/og.png"],
    },
  };
}

/** 裝潢專區 — 7 件最常用櫃體（nameZh 改走 furniture.* messages） */
const INTERIOR_CABINETS = [
  "wardrobe",
  "shoe-cabinet",
  "media-console",
  "open-bookshelf",
  "display-cabinet",
  "nightstand",
  "chest-of-drawers",
] as const;

/** Hero 下方 thumb mosaic 用 — 挑視覺好認的 12 件 */
const MOSAIC_THUMBS = [
  "stool",
  "dining-chair",
  "tea-table",
  "desk",
  "open-bookshelf",
  "shoe-cabinet",
  "wardrobe",
  "wine-rack",
  "pencil-holder",
  "dovetail-box",
  "bookend",
  "tray",
];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "about" });
  const tF = await getTranslations({ locale, namespace: "furniture" });
  const tD = await getTranslations({ locale, namespace: "difficulty" });

  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const isEn = locale === "en";

  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
      {/* ============ Hero ============ */}
      <section className="relative text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 w-[34rem] max-w-full h-72 rounded-full bg-amber-200/35 blur-3xl"
        />
        <Image
          src={locale === "en" ? "/brand-logo-en.png" : "/brand-logo-text.png"}
          alt={t("hero.logoAlt")}
          width={locale === "en" ? 512 : 1254}
          height={locale === "en" ? 512 : 1254}
          className="relative mx-auto mb-7 sm:mb-9 rounded-3xl shadow-xl ring-1 ring-amber-200/60 w-40 h-40 sm:w-56 sm:h-56"
          priority
        />
        <div className="relative inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {t("hero.badge")}
        </div>
        <h1 className="relative font-serif-tc text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.18]">
          {t("hero.h1Line1")}
          <br />
          <span className="text-amber-700">{t("hero.h1Highlight")}</span>
        </h1>
        <p className="relative mt-5 max-w-2xl mx-auto text-lg text-zinc-700 leading-relaxed">
          {t.rich("hero.intro", {
            b: (chunks) => <strong className="text-zinc-900">{chunks}</strong>,
          })}
        </p>

        {/* Social proof bar */}
        <div className="relative mt-7 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl bg-white/70 ring-1 ring-amber-200 py-3.5 px-7 shadow-sm text-sm text-zinc-600">
          <span className="inline-flex items-baseline gap-1.5">
            <strong className="font-serif-tc text-xl text-amber-800">
              {t("hero.statSubsCount")}
            </strong>
            <span>{t("hero.statSubsLabel")}</span>
          </span>
          <span aria-hidden className="w-px h-5 bg-amber-200" />
          <span className="inline-flex items-baseline gap-1.5">
            <strong className="font-serif-tc text-xl text-amber-800">
              {t("hero.statStudentsCount")}
            </strong>
            <span>{t("hero.statStudentsLabel")}</span>
          </span>
          <span aria-hidden className="w-px h-5 bg-amber-200" />
          <span className="inline-flex items-baseline gap-1.5">
            <strong className="font-serif-tc text-xl text-amber-800">
              {t("hero.statTemplatesCount")}
            </strong>
            <span>{t("hero.statTemplatesLabel")}</span>
          </span>
        </div>

        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center px-7 py-3 rounded-xl bg-amber-700 text-white font-semibold shadow-md shadow-amber-700/25 transition-all duration-200 hover:bg-amber-800 hover:-translate-y-0.5 hover:shadow-lg"
          >
            {t("hero.ctaPrimary")}
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center px-7 py-3 rounded-xl bg-white text-zinc-900 font-semibold ring-1 ring-stone-300 transition-all duration-200 hover:bg-amber-50 hover:ring-amber-500 hover:-translate-y-0.5"
          >
            {t("hero.ctaSecondary")}
          </Link>
        </div>
        {/* Hero 三聯主視覺 */}
        <HeroTriptych
          labels={{
            inputBadge: t("triptych.inputBadge"),
            outputBadge: t("triptych.outputBadge"),
            panel1Label: t("triptych.panel1Label"),
            panel1Sub: t("triptych.panel1Sub"),
            panel1Alt: t("triptych.panel1Alt"),
            panel2Label: t("triptych.panel2Label"),
            panel2Sub: t("triptych.panel2Sub"),
            panel2Alt: t("triptych.panel2Alt"),
            panel3Label: t("triptych.panel3Label"),
            panel3Sub: t("triptych.panel3Sub"),
            panel3Alt: t("triptych.panel3Alt"),
            isEn,
          }}
        />
        <p className="mt-3 text-xs text-zinc-500 text-center">
          {t("hero.triptychCaption")}
        </p>
      </section>

      {/* ============ Thumb mosaic ============ */}
      <section className="mt-16 sm:mt-20">
        <p className="text-center text-zinc-600 mb-6 text-sm sm:text-base">
          {t.rich("mosaic.intro", {
            b: (chunks) => <strong className="text-zinc-900">{chunks}</strong>,
          })}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
          {MOSAIC_THUMBS.map((slug) => (
            <div
              key={slug}
              className="aspect-square rounded-lg bg-gradient-to-br from-zinc-50 to-zinc-100 ring-1 ring-zinc-200 flex items-center justify-center p-2"
            >
              <Image
                src={`/thumbs/v2/${slug}.webp`}
                alt=""
                width={120}
                height={120}
                quality={70}
                loading="lazy"
                style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%" }}
              />
            </div>
          ))}
        </div>
        <p className="text-center text-zinc-500 text-xs mt-4">
          {t.rich("mosaic.outro", {
            link: (chunks) => (
              <Link href="/" className="underline hover:text-zinc-900">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>

      {/* ============ 痛點 ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>{t("pain.eyebrow")}</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
          {t("pain.h2")}
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-zinc-700 leading-relaxed text-center">
          {t("pain.intro")}
        </p>
        <div className="mt-10 grid sm:grid-cols-3 gap-4 sm:gap-6">
          <PainPoint
            emoji="📐"
            title={t("pain.drawing.title")}
            desc={t("pain.drawing.desc")}
          />
          <PainPoint
            emoji="🪵"
            title={t("pain.material.title")}
            desc={t("pain.material.desc")}
          />
          <PainPoint
            emoji="🔨"
            title={t("pain.process.title")}
            desc={t("pain.process.desc")}
          />
        </div>
        <p className="mt-10 text-center text-lg text-amber-800 font-semibold">
          {t("pain.conclusion")}
        </p>
      </section>

      {/* ============ 三步驟 ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>{t("steps.eyebrow")}</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-12">
          {t("steps.h2")}
        </h2>
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          <StepCard
            no="1"
            title={t("steps.step1Title")}
            desc={t("steps.step1Desc")}
            visual={<StepVisualCatalog />}
          />
          <StepCard
            no="2"
            title={t("steps.step2Title")}
            desc={t("steps.step2Desc")}
            visual={<StepVisualSliders alt={t("steps.step2Alt")} src={isEn ? "/about-assets/en/step-design.png" : "/about-assets/step-design.png"} />}
          />
          <StepCard
            no="3"
            title={t("steps.step3Title")}
            desc={t("steps.step3Desc")}
            visual={<StepVisualPdf alt={t("steps.step3Alt")} src={isEn ? "/about-assets/en/feat-threeview.png" : "/about-assets/feat-threeview.png"} />}
          />
        </div>
      </section>

      {/* ============ 能做什麼 ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>{t("outputs.eyebrow")}</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-3">
          {t("outputs.h2")}
        </h2>
        <p className="text-center text-zinc-600 mb-10">{t("outputs.intro")}</p>

        <div className="grid md:grid-cols-2 gap-5 sm:gap-6 mb-6">
          <ImageFeatureCard
            src={isEn ? "/about-assets/en/feat-threeview.png" : "/about-assets/feat-threeview.png"}
            title={t("outputs.threeview.title")}
            desc={t("outputs.threeview.desc")}
          />
          <ImageFeatureCard
            src={isEn ? "/about-assets/en/feat-cutlist.png" : "/about-assets/feat-cutlist.png"}
            title={t("outputs.cutlist.title")}
            desc={t("outputs.cutlist.desc")}
          />
          <ImageFeatureCard
            src={isEn ? "/about-assets/en/feat-cutlist.png" : "/about-assets/feat-cutplan-full.png"}
            title={t("outputs.cutplan.title")}
            desc={t("outputs.cutplan.desc")}
          />
          <ImageFeatureCard
            src={isEn ? "/about-assets/en/feat-steps.png" : "/about-assets/feat-steps.png"}
            title={t("outputs.process.title")}
            desc={t("outputs.process.desc")}
          />
          <ImageFeatureCard
            src={isEn ? "/about-assets/en/feat-threeview.png" : "/about-assets/feat-quote.png"}
            title={t("outputs.quote.title")}
            desc={t("outputs.quote.desc")}
          />
          <ImageFeatureCard
            src={isEn ? "/about-assets/en/hero-3d.png" : "/about-assets/hero-3d.png"}
            title={t("outputs.perspective.title")}
            desc={t("outputs.perspective.desc")}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <FeatureCard emoji="🔩" title={t("outputs.joinery.title")} desc={t("outputs.joinery.desc")} />
          <FeatureCard emoji="🛠️" title={t("outputs.tools.title")} desc={t("outputs.tools.desc")} />
          <FeatureCard emoji="🎲" title={t("outputs.stl.title")} desc={t("outputs.stl.desc")} />
        </div>
      </section>

      {/* ============ 裝潢專區 ============ */}
      <section className="mt-20 sm:mt-24">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-700 text-white text-xs font-semibold mb-4">
          {t("decor.tag")}
        </div>
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
          {t("decor.h2")}
        </h2>
        <p className="text-zinc-700 leading-relaxed mb-8 max-w-2xl">{t("decor.intro")}</p>

        {/* 主打：天花板骨架 */}
        <div className="block rounded-2xl bg-gradient-to-br from-amber-50 to-stone-100 ring-1 ring-amber-200 p-6 sm:p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl bg-white ring-1 ring-amber-200 flex items-center justify-center p-3 shrink-0">
              <Image
                src="/thumbs/v2/ceiling.webp"
                alt={t("decor.ceilingAlt")}
                width={160}
                height={160}
                quality={75}
                loading="lazy"
                style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%" }}
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-600 text-white font-semibold">
                  {t("decor.ceilingPlanBadge")}
                </span>
                <span className="text-xs text-amber-800 font-medium">
                  {t("decor.ceilingLive")}
                </span>
              </div>
              <h3 className="font-bold text-zinc-900 text-xl mb-2">
                {t("decor.ceilingTitle")}
              </h3>
              <p className="text-zinc-700 leading-relaxed text-sm sm:text-base">
                {t("decor.ceilingDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* 7 件裝潢櫃體 */}
        <h3 className="font-bold text-zinc-900 text-lg mb-3">
          {t("decor.cabinetsTitle", { count: INTERIOR_CABINETS.length })}
        </h3>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3 mb-2">
          {INTERIOR_CABINETS.map((slug) => (
            <div
              key={slug}
              title={tF(slug)}
              className="block aspect-square rounded-lg bg-white ring-1 ring-zinc-200 flex items-center justify-center p-2"
            >
              <Image
                src={`/thumbs/v2/${slug}.webp`}
                alt={tF(slug)}
                width={120}
                height={120}
                quality={70}
                loading="lazy"
                style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%" }}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          {INTERIOR_CABINETS.map((slug) => tF(slug)).join(" · ")}
        </p>
      </section>

      {/* ============ 適合誰 ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>{t("persona.eyebrow")}</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-12">
          {t("persona.h2")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <PersonaCard emoji="🪚" title={t("persona.diy.title")} desc={t("persona.diy.desc")} />
          <PersonaCard emoji="👷" title={t("persona.pro.title")} desc={t("persona.pro.desc")} />
          <PersonaCard
            emoji="🔨"
            title={t("persona.interior.title")}
            desc={t("persona.interior.desc")}
          />
          <PersonaCard
            emoji="🎨"
            title={t("persona.designer.title")}
            desc={t("persona.designer.desc")}
          />
          <PersonaCard
            emoji="🎓"
            title={t("persona.student.title")}
            desc={t("persona.student.desc")}
          />
        </div>
      </section>

      {/* ============ 木頭仁是誰 ============ */}
      <section className="mt-20 sm:mt-24 rounded-2xl bg-gradient-to-br from-amber-50 to-stone-100 ring-1 ring-amber-200 p-8 sm:p-12">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <Image
            src={locale === "en" ? "/brand-logo-en.png" : "/brand-logo.png"}
            alt={t("hero.logoAlt")}
            width={locale === "en" ? 512 : 160}
            height={locale === "en" ? 512 : 160}
            className="rounded-2xl shadow-md ring-1 ring-amber-200 shrink-0 w-40 h-40"
          />
          <div className="flex-1 text-center md:text-left">
            <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900">
              {t("bio.h2")}
            </h2>
            <p className="mt-4 text-zinc-800 leading-relaxed text-lg">
              {t.rich("bio.p1", {
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <p className="mt-3 text-zinc-800 leading-relaxed">
              {t("bio.p2")}
              <br />
              <span className="text-amber-900 italic">{t("bio.quote")}</span>
            </p>
            <p className="mt-3 text-zinc-700 leading-relaxed">
              {t.rich("bio.p3", {
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 justify-center md:justify-start">
              <a
                href="https://www.youtube.com/@WoodenRen"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("bio.ytAria")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
              >
                <span aria-hidden>▶</span> {t("bio.ytLabel")}
              </a>
              <a
                href="https://www.facebook.com/woodenren99/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("bio.fbAria")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                <span aria-hidden className="font-bold">f</span> {t("bio.fbLabel")}
              </a>
              <a
                href="https://www.instagram.com/wooden_ren/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("bio.igAria")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 hover:opacity-90"
              >
                <span aria-hidden>📷</span> {t("bio.igLabel")}
              </a>
              <a
                href="https://woodenrenclass.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("bio.academyAria")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50"
              >
                <span aria-hidden>🎓</span> {t("bio.academyLabel")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 方案 CTA ============ */}
      <section className="mt-20 sm:mt-24">
        <Eyebrow>{t("plans.eyebrow")}</Eyebrow>
        <h2 className="mt-4 font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center">
          {t("plans.h2")}
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-zinc-700 leading-relaxed text-center">
          {t("plans.intro")}
        </p>

        <div className="mt-10 grid md:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
          <MiniPlanCard
            name={t("plans.free.name")}
            price={t("plans.free.price")}
            unit={t("plans.free.unit")}
            features={[t("plans.free.f1"), t("plans.free.f2"), t("plans.free.f3")]}
            cta={t("plans.free.cta")}
            ctaHref={`${prefix}/`}
            highlight={false}
            popularLabel={t("plans.popular")}
          />
          <MiniPlanCard
            name={t("plans.personal.name")}
            price={t("plans.personal.price")}
            unit={t("plans.personal.unit")}
            features={[
              t("plans.personal.f1"),
              t("plans.personal.f2"),
              t("plans.personal.f3"),
            ]}
            cta={t("plans.personal.cta")}
            ctaHref={`${prefix}/pricing`}
            highlight
            popularLabel={t("plans.popular")}
          />
          <MiniPlanCard
            name={t("plans.pro.name")}
            price={t("plans.pro.price")}
            unit={t("plans.pro.unit")}
            features={[t("plans.pro.f1"), t("plans.pro.f2"), t("plans.pro.f3")]}
            cta={t("plans.pro.cta")}
            ctaHref={`${prefix}/pricing`}
            highlight={false}
            popularLabel={t("plans.popular")}
          />
        </div>

        {/* 單範本永久買斷 */}
        <div className="mt-8 max-w-4xl mx-auto rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="md:max-w-sm">
              <h3 className="font-serif-tc text-xl font-bold text-zinc-900">
                {t("plans.customTitle")}
              </h3>
              <p className="mt-2 text-zinc-700 text-sm leading-relaxed">
                {t("plans.customBody")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 md:flex md:gap-3">
              {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                <div
                  key={d}
                  className="rounded-xl bg-white ring-1 ring-stone-200 px-4 py-3 text-center"
                >
                  <div className="text-xs text-zinc-500">{tD(d)}</div>
                  <div className="mt-1 font-bold text-zinc-900">
                    {isEn
                      ? d === "beginner"
                        ? "$4.99"
                        : d === "intermediate"
                          ? "$9.99"
                          : "$14.99"
                      : `NT$ ${TEMPLATE_UNLOCK_PRICES[d]}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 text-center md:text-right">
            <Link
              href="/pricing"
              className="text-sm font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-4"
            >
              {t("plans.customSeeAll")}
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600">✓</span> {t("plans.perkNoCC")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600">✓</span> {t("plans.perkCancel")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600">✓</span> {t("plans.perkRetention")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-600">✓</span> {t("plans.perkYearMath")}
          </span>
        </div>

        <p className="mt-6 text-xs text-zinc-500 text-center">
          {t.rich("plans.needHelp", {
            link1: (chunks) => (
              <Link href="/help" className="underline hover:text-zinc-900">
                {chunks}
              </Link>
            ),
            link2: (chunks) => (
              <Link href="/contact" className="underline hover:text-zinc-900">
                {chunks}
              </Link>
            ),
          })}
        </p>

        {/* 問題回報指引 */}
        <div className="mt-8 max-w-xl mx-auto rounded-xl bg-amber-50 ring-1 ring-amber-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-12 h-12 rounded-full bg-white ring-1 ring-amber-300 shadow-sm flex items-center justify-center">
              <Image
                src="/logo-mark.png"
                alt={t("plans.bugLogoAlt")}
                width={36}
                height={36}
                style={{ objectFit: "contain" }}
              />
            </div>
            <p className="text-sm text-zinc-800 leading-relaxed">
              {t.rich("plans.bugReport", {
                b: (chunks) => <strong>{chunks}</strong>,
                dim: (chunks) => <span className="text-zinc-500">{chunks}</span>,
              })}
            </p>
          </div>
        </div>
      </section>

      <AcademyPromoBanner />
    </main>
  );
}

/** Hero 三聯主視覺 */
function HeroTriptych({
  labels,
}: {
  labels: {
    inputBadge: string;
    outputBadge: string;
    panel1Label: string;
    panel1Sub: string;
    panel1Alt: string;
    panel2Label: string;
    panel2Sub: string;
    panel2Alt: string;
    panel3Label: string;
    panel3Sub: string;
    panel3Alt: string;
    isEn?: boolean;
  };
}) {
  const prefix = labels.isEn ? "/about-assets/en" : "/about-assets";
  const panels = [
    {
      src: `${prefix}/hero-3d.png`,
      alt: labels.panel1Alt,
      label: labels.panel1Label,
      sub: labels.panel1Sub,
    },
    {
      src: `${prefix}/feat-threeview.png`,
      alt: labels.panel2Alt,
      label: labels.panel2Label,
      sub: labels.panel2Sub,
    },
    {
      src: `${prefix}/feat-cutlist.png`,
      alt: labels.panel3Alt,
      label: labels.panel3Label,
      sub: labels.panel3Sub,
    },
  ];

  return (
    <div className="mt-10 sm:mt-12">
      <div className="mb-4 flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-600">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-900 text-white font-semibold">
          {labels.inputBadge}
        </span>
        <span aria-hidden className="text-amber-700 font-bold">→</span>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-700 text-white font-semibold">
          {labels.outputBadge}
        </span>
      </div>

      <div className="grid md:grid-cols-[1.4fr_auto_1fr_auto_1fr] gap-3 sm:gap-4 items-center">
        {panels.map((p, i) => {
          const isLast = i === panels.length - 1;
          return (
            <Fragment key={p.src}>
              <HeroPanel {...p} primary={i === 0} />
              {!isLast && (
                <span
                  aria-hidden
                  className="hidden md:flex justify-center text-amber-700 text-2xl font-bold"
                >
                  →
                </span>
              )}
              {!isLast && (
                <span
                  aria-hidden
                  className="md:hidden flex justify-center text-amber-700 text-2xl font-bold py-1"
                >
                  ↓
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function HeroPanel({
  src,
  alt,
  label,
  sub,
  primary,
}: {
  src: string;
  alt: string;
  label: string;
  sub: string;
  primary: boolean;
}) {
  return (
    <div
      className={`group rounded-xl overflow-hidden ring-1 transition hover:-translate-y-1 hover:shadow-lg ${
        primary
          ? "bg-gradient-to-br from-amber-50 to-stone-100 ring-amber-300 shadow-md"
          : "bg-white ring-zinc-200 shadow-sm hover:ring-amber-300"
      }`}
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-zinc-50 to-zinc-100 overflow-hidden">
        <Image
          src={src}
          alt={alt}
          width={800}
          height={600}
          priority={primary}
          quality={primary ? 88 : 80}
          sizes={
            primary
              ? "(min-width:1024px) 480px, 100vw"
              : "(min-width:1024px) 320px, 100vw"
          }
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 text-center">
        <div
          className={`text-sm sm:text-base font-bold ${
            primary ? "text-amber-900" : "text-zinc-900"
          }`}
        >
          {label}
        </div>
        <div className="text-[11px] sm:text-xs text-zinc-600 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function MiniPlanCard({
  name,
  price,
  unit,
  features,
  cta,
  ctaHref,
  highlight,
  popularLabel,
}: {
  name: string;
  price: string;
  unit: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight: boolean;
  popularLabel: string;
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 ${
        highlight
          ? "bg-amber-50 ring-2 ring-amber-500 shadow-md hover:shadow-lg"
          : "bg-white ring-1 ring-stone-200 hover:ring-amber-300 hover:shadow-md"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shadow-sm">
          {popularLabel}
        </span>
      )}
      <div className="text-center">
        <h3 className="font-semibold text-zinc-900 text-lg">{name}</h3>
        <div className="mt-3 flex items-baseline justify-center">
          <span className="font-serif-tc text-4xl font-bold text-amber-800">{price}</span>
          <span className="ml-1 text-sm text-zinc-500">{unit}</span>
        </div>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-zinc-700">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={ctaHref}
        className={`mt-6 block text-center py-2.5 rounded-lg font-semibold text-sm transition ${
          highlight
            ? "bg-amber-700 text-white hover:bg-amber-800 shadow-sm"
            : "bg-zinc-900 text-white hover:bg-zinc-800"
        }`}
      >
        {cta}
      </a>
    </div>
  );
}

/** section 小標籤 */
function Eyebrow({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-800 text-xs font-semibold tracking-wide">
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {children}
      </span>
    </div>
  );
}

function PainPoint({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="group rounded-xl bg-white ring-1 ring-stone-200 shadow-sm p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:ring-amber-300">
      <div className="w-12 h-12 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center text-2xl mb-3">
        {emoji}
      </div>
      <h3 className="font-semibold text-zinc-900 mb-1">{title}</h3>
      <p className="text-sm text-zinc-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({
  no,
  title,
  desc,
  visual,
}: {
  no: string;
  title: string;
  desc: string;
  visual?: React.ReactNode;
}) {
  return (
    <div className="group relative rounded-2xl bg-white ring-1 ring-stone-200 shadow-sm p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:ring-amber-300 hover:shadow-lg">
      <div className="absolute -top-4 left-6 w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-white font-serif-tc font-bold text-lg flex items-center justify-center shadow-md ring-2 ring-white">
        {no}
      </div>
      {visual && (
        <div className="mt-3 mb-4 h-32 rounded-lg bg-gradient-to-br from-zinc-50 to-zinc-100 ring-1 ring-zinc-200/60 overflow-hidden flex items-center justify-center">
          {visual}
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-amber-900 transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{desc}</p>
    </div>
  );
}

function StepVisualCatalog() {
  const thumbs = ["stool", "tea-table", "open-bookshelf", "pencil-holder"];
  return (
    <div className="grid grid-cols-2 gap-1.5 p-2 w-full h-full">
      {thumbs.map((s) => (
        <div
          key={s}
          className="rounded bg-white ring-1 ring-zinc-200 flex items-center justify-center p-1"
        >
          <Image
            src={`/thumbs/v2/${s}.webp`}
            alt=""
            width={56}
            height={56}
            quality={70}
            loading="lazy"
            style={{ objectFit: "contain", maxHeight: "100%", maxWidth: "100%" }}
          />
        </div>
      ))}
    </div>
  );
}

function StepVisualSliders({ alt, src = "/about-assets/step-design.png" }: { alt: string; src?: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={600}
      height={300}
      quality={75}
      loading="lazy"
      sizes="(min-width:768px) 320px, 100vw"
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
    />
  );
}

function StepVisualEmoji({ emoji }: { emoji: string }) {
  return (
    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-amber-50 to-stone-100">
      <span className="text-6xl sm:text-7xl" aria-hidden>{emoji}</span>
    </div>
  );
}

function StepVisualPdf({ alt, src = "/about-assets/feat-threeview.png" }: { alt: string; src?: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={600}
      height={300}
      quality={75}
      loading="lazy"
      sizes="(min-width:768px) 320px, 100vw"
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
    />
  );
}

function FeatureCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="group rounded-xl bg-amber-50/60 ring-1 ring-amber-200 p-5 transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:ring-amber-300 hover:shadow-md">
      <div className="w-10 h-10 rounded-lg bg-white ring-1 ring-amber-200 flex items-center justify-center text-xl mb-2.5">
        {emoji}
      </div>
      <h3 className="font-semibold text-zinc-900 mb-1 text-sm">{title}</h3>
      <p className="text-xs text-zinc-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function ImageFeatureCard({
  src,
  title,
  desc,
}: {
  src: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="group rounded-xl bg-white ring-1 ring-stone-200 shadow-sm overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:ring-amber-400 hover:shadow-lg">
      <div className="aspect-[16/9] bg-gradient-to-br from-zinc-50 to-zinc-100 overflow-hidden">
        <Image
          src={src}
          alt={title}
          width={800}
          height={450}
          quality={78}
          loading="lazy"
          sizes="(min-width:768px) 480px, 100vw"
          className="transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-zinc-900 mb-1.5 group-hover:text-amber-900 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-zinc-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function PersonaCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="group rounded-xl bg-white ring-1 ring-stone-200 shadow-sm p-6 transition-all duration-200 hover:-translate-y-1 hover:ring-amber-300 hover:shadow-md">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-12 h-12 rounded-xl bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center text-2xl shrink-0">
          {emoji}
        </span>
        <h3 className="font-semibold text-zinc-900 text-lg">{title}</h3>
      </div>
      <p className="text-sm text-zinc-700 leading-relaxed">{desc}</p>
    </div>
  );
}
