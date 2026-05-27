import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FURNITURE_CATALOG, getEntryName } from "@/lib/templates";
import { FREE_UNLOCKED_CATEGORIES } from "@/lib/permissions";
import { FEATURED_TEMPLATE_CATEGORIES } from "@/lib/templates/marketing";
import { getSessionUser } from "@/lib/supabase/server";
import {
  TEMPLATE_UNLOCK_PRICES,
} from "@/lib/pricing/template-unlock";
import { AcademyPromoBanner } from "@/components/AcademyPromoBanner";
import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * 首頁 = 行銷 Landing（給新訪客）
 *
 * 已登入用戶會被 middleware 直接導 /app（家具目錄）；這邊用 next-intl 的
 * redirect 保留 locale（zh-TW 用戶 → /app，en 用戶 → /en/app）。
 *
 * 8 大區塊：Hero / 痛點 / 三大產出 / 模板 / 情境 / 定價 / FAQ / 底部 CTA
 *
 * Phase 2：所有可見字串走 messages/{zh-TW,en}.json；
 *   - server component → getTranslations()
 *   - 中文 free 徽章 / 樣板名等資料 (e.nameZh) 仍走原中文 — Phase 3 才翻 templates
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "landing.metadata",
  });
  const canonicalPath = locale === routing.defaultLocale ? "/" : `/${locale}`;
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

// 主力 10 模板（依計畫；按出現順序排）
const FEATURED_TYPES = [
  "stool",
  "pencil-holder",
  "side-table",
  "dining-chair",
  "desk",
  "open-bookshelf",
  "bed",
  "chest-of-drawers",
  "media-console",
  "wardrobe",
] as const;

// 文案 key 表 — 對應 messages JSON 結構，避免 render 內塞太多字串
const PAIN_KEYS = ["drawing", "material", "quote"] as const;
const PAIN_ICONS: Record<(typeof PAIN_KEYS)[number], string> = {
  drawing: "📐",
  material: "📏",
  quote: "🪚",
};

const OUTPUT_KEYS = ["drawings", "cutplan", "quote"] as const;
const OUTPUT_IMAGES: Record<(typeof OUTPUT_KEYS)[number], string> = {
  drawings: "/about-assets/feat-threeview.png",
  cutplan: "/about-assets/feat-cutplan-full.png",
  quote: "/about-assets/feat-quote.png",
};

const SCENARIO_KEYS = [
  "morning",
  "workshop",
  "classroom",
  "customer",
  "midnight",
  "kid",
] as const;
const SCENARIO_ICONS: Record<(typeof SCENARIO_KEYS)[number], string> = {
  morning: "☕",
  workshop: "🪚",
  classroom: "🎓",
  customer: "💬",
  midnight: "🌙",
  kid: "🎂",
};

const FAQ_KEYS = ["free", "cad", "tier", "cancel", "cnc"] as const;

export default async function Landing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);

  // 已登入用戶 → 直接送進 locale 對應的 /app
  const user = await getSessionUser();
  if (user) redirect({ href: "/app", locale });

  const t = await getTranslations({ locale, namespace: "landing" });
  const tD = await getTranslations({ locale, namespace: "difficulty" });

  const featuredEntries = FEATURED_TYPES.map((tType) =>
    FURNITURE_CATALOG.find((f) => f.category === tType),
  ).filter((e): e is NonNullable<typeof e> => Boolean(e));

  return (
    <main>
      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-stone-100">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-amber-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-32 w-[24rem] h-[24rem] rounded-full bg-emerald-200/30 blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {t("hero.badge")}
              </div>
              <h1 className="font-serif-tc text-4xl sm:text-5xl md:text-[3.25rem] font-bold tracking-tight text-zinc-900 leading-[1.1]">
                {t("hero.h1Line1")}
                <br className="hidden sm:block" />
                <span className="text-amber-700">{t("hero.h1Highlight")}</span>
              </h1>
              <p className="mt-5 text-lg text-zinc-700 leading-relaxed max-w-xl">
                {t("hero.subtitleA")}
                <br />
                {t("hero.subtitleB")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={locale === routing.defaultLocale ? "/app" : `/${locale}/app`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-700 text-white font-semibold shadow-lg shadow-amber-700/30 hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  {t("hero.ctaPrimary")}
                </Link>
                <Link
                  href={
                    locale === routing.defaultLocale
                      ? "/pricing"
                      : `/${locale}/pricing`
                  }
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
                >
                  {t("hero.ctaSecondary")}
                </Link>
              </div>
              <p className="mt-4 text-sm text-zinc-500">{t("hero.note")}</p>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-4 sm:p-6">
                <div className="aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/40">
                  <Image
                    src="/about-assets/hero-3d.png"
                    alt={t("hero.heroAlt")}
                    width={620}
                    height={465}
                    priority
                    style={{ objectFit: "contain", maxHeight: "92%", maxWidth: "92%" }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {t("hero.heroCaption")}
                  </span>
                  <span className="font-mono">designer.woodenren.com</span>
                </div>
              </div>
              <div
                aria-hidden
                className="hidden md:block absolute -bottom-5 -right-4 rotate-3 px-3 py-1.5 rounded-full bg-amber-700 text-white text-xs font-bold shadow-lg"
              >
                {t("hero.heroBadgeFast")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 痛點區 ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
          {t("pain.h2")}
        </h2>
        <p className="mt-3 text-center text-zinc-600">{t("pain.subtitle")}</p>
        <div className="mt-12 grid sm:grid-cols-3 gap-5">
          {PAIN_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="text-4xl mb-3">{PAIN_ICONS[key]}</div>
              <h3 className="font-bold text-lg text-zinc-900 mb-2">
                {t(`pain.${key}.title`)}
              </h3>
              <p className="text-zinc-600 leading-relaxed text-sm">
                {t(`pain.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 三大產出 ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
            {t("outputs.h2")}
          </h2>
          <p className="mt-3 text-center text-zinc-600">{t("outputs.subtitle")}</p>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {OUTPUT_KEYS.map((key) => (
              <div
                key={key}
                className="rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="relative aspect-video bg-gradient-to-br from-stone-50 to-amber-50/30 overflow-hidden">
                  <Image
                    src={OUTPUT_IMAGES[key]}
                    alt={t(`outputs.${key}.title`)}
                    fill
                    sizes="(min-width:768px) 33vw, 100vw"
                    className="object-contain p-3"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg text-zinc-900 mb-2">
                    {t(`outputs.${key}.title`)}
                  </h3>
                  <p className="text-zinc-600 leading-relaxed text-sm">
                    {t(`outputs.${key}.body`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 模板輪播 ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <div>
            <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-zinc-900">
              {t("templates.h2")}
            </h2>
            <p className="mt-2 text-zinc-600">{t("templates.subtitle")}</p>
          </div>
          <Link
            href={
              locale === routing.defaultLocale ? "/templates" : `/${locale}/templates`
            }
            className="text-amber-700 hover:text-amber-900 font-semibold text-sm inline-flex items-center gap-1"
          >
            {t("templates.seeAll")}
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4">
          {featuredEntries.map((e) => {
            const free = FREE_UNLOCKED_CATEGORIES.includes(e.category);
            const hasDetail = FEATURED_TEMPLATE_CATEGORIES.includes(e.category);
            const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
            const href = hasDetail
              ? `${prefix}/templates/${e.category}`
              : `${prefix}/app`;
            return (
              <Link
                key={e.category}
                href={href}
                className="group relative block overflow-hidden rounded-xl bg-white ring-1 ring-stone-300 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:ring-amber-500 transition-all"
              >
                {free && (
                  <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-[10px] font-bold shadow-sm">
                    {t("templates.freeBadge")}
                  </div>
                )}
                <div className="relative aspect-square flex items-center justify-center bg-gradient-to-br from-white to-stone-50">
                  <Image
                    src={`/thumbs/v2/${e.category}.webp`}
                    alt={t("templates.previewAlt", { name: getEntryName(e, locale) })}
                    width={240}
                    height={180}
                    quality={75}
                    loading="lazy"
                    sizes="(min-width:768px) 20vw, (min-width:640px) 33vw, 50vw"
                    className="transition-transform group-hover:scale-[1.06]"
                    style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
                  />
                </div>
                <div className="px-3 py-2.5 border-t border-amber-100 bg-amber-50">
                  <span className="text-sm font-semibold text-zinc-900 group-hover:text-amber-900 truncate block">
                    {getEntryName(e, locale)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ============ 6 情境 ============ */}
      <section className="bg-gradient-to-b from-white to-amber-50/30 border-y border-amber-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
            {t("scenarios.h2")}
          </h2>
          <p className="mt-3 text-center text-zinc-600">{t("scenarios.subtitle")}</p>
          <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {SCENARIO_KEYS.map((key) => (
              <div
                key={key}
                className="group rounded-2xl bg-white ring-1 ring-stone-200 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:ring-amber-300 transition-all"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <span
                    aria-hidden
                    className="text-3xl leading-none group-hover:scale-110 transition-transform"
                  >
                    {SCENARIO_ICONS[key]}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-800 text-xs font-bold">
                    {t(`scenarios.${key}.tag`)}
                  </span>
                </div>
                <p className="text-zinc-700 leading-relaxed text-sm">
                  {t(`scenarios.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 定價精簡 ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
          {t("pricing.h2")}
        </h2>
        <p className="mt-3 text-center text-zinc-600">{t("pricing.subtitle")}</p>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          <PricingCard
            tier={t("pricing.free.tier")}
            price="0"
            unit=""
            highlight={false}
            features={[
              t("pricing.free.f1"),
              t("pricing.free.f2"),
              t("pricing.free.f3"),
              t("pricing.free.f4"),
            ]}
            popularLabel={t("pricing.popular")}
            cta={{
              label: t("pricing.free.cta"),
              href: locale === routing.defaultLocale ? "/app" : `/${locale}/app`,
            }}
          />
          <PricingCard
            tier={t("pricing.personal.tier")}
            price="390"
            unit={t("pricing.perMonth")}
            highlight={true}
            features={[
              t("pricing.personal.f1"),
              t("pricing.personal.f2"),
              t("pricing.personal.f3"),
              t("pricing.personal.f4"),
            ]}
            popularLabel={t("pricing.popular")}
            cta={{
              label: t("pricing.personal.cta"),
              href:
                locale === routing.defaultLocale ? "/pricing" : `/${locale}/pricing`,
            }}
          />
          <PricingCard
            tier={t("pricing.pro.tier")}
            price="890"
            unit={t("pricing.perMonth")}
            highlight={false}
            features={[
              t("pricing.pro.f1"),
              t("pricing.pro.f2"),
              t("pricing.pro.f3"),
              t("pricing.pro.f4"),
            ]}
            popularLabel={t("pricing.popular")}
            cta={{
              label: t("pricing.pro.cta"),
              href:
                locale === routing.defaultLocale ? "/pricing" : `/${locale}/pricing`,
            }}
          />
        </div>
        <p className="mt-6 text-center text-sm text-zinc-500">
          {t("pricing.yearNote")}
        </p>

        {/* 單範本永久買斷 */}
        <div className="mt-10 rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="md:max-w-md">
              <h3 className="font-serif-tc text-xl sm:text-2xl font-bold text-zinc-900">
                {t("pricing.custom.title")}
              </h3>
              <p className="mt-2 text-zinc-700 text-sm leading-relaxed">
                {t("pricing.custom.body")}
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
                    NT$ {TEMPLATE_UNLOCK_PRICES[d]}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 text-center md:text-right">
            <Link
              href={
                locale === routing.defaultLocale ? "/pricing" : `/${locale}/pricing`
              }
              className="text-sm font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-4"
            >
              {t("pricing.custom.seeAll")}
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold text-center text-zinc-900">
            {t("faq.h2")}
          </h2>
          <div className="mt-10 space-y-3">
            {FAQ_KEYS.map((key) => (
              <details
                key={key}
                className="group rounded-2xl bg-white ring-1 ring-stone-200 p-5 shadow-sm open:shadow-md transition-shadow"
              >
                <summary className="cursor-pointer font-semibold text-zinc-900 list-none flex items-center justify-between gap-3">
                  <span>{t(`faq.${key}Q`)}</span>
                  <span className="text-amber-700 group-open:rotate-45 transition-transform text-xl shrink-0">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-zinc-600 leading-relaxed text-sm whitespace-pre-line">
                  {t(`faq.${key}A`)}
                </p>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href={locale === routing.defaultLocale ? "/help" : `/${locale}/help`}
              className="text-amber-700 hover:text-amber-900 font-semibold text-sm"
            >
              {t("faq.seeAll")}
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 底部 CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-16 sm:py-24 text-center">
          <h2 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
            {t("bottomCta.h2Line1")}
            <br className="sm:hidden" />
            <span className="text-amber-200"> {t("bottomCta.h2Highlight")}</span>
          </h2>
          <p className="mt-5 text-amber-100 text-lg max-w-xl mx-auto leading-relaxed">
            {t("bottomCta.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={locale === routing.defaultLocale ? "/app" : `/${locale}/app`}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-amber-800 font-bold shadow-xl hover:-translate-y-0.5 hover:bg-amber-50 transition-all"
            >
              {t("bottomCta.ctaPrimary")}
            </Link>
            <Link
              href={locale === routing.defaultLocale ? "/about" : `/${locale}/about`}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white/10 text-white font-semibold ring-1 ring-white/30 hover:bg-white/20 transition-all"
            >
              {t("bottomCta.ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>

      <AcademyPromoBanner />
    </main>
  );
}

function PricingCard({
  tier,
  price,
  unit,
  highlight,
  features,
  popularLabel,
  cta,
}: {
  tier: string;
  price: string;
  unit: string;
  highlight: boolean;
  features: string[];
  popularLabel: string;
  cta: { label: string; href: string };
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 shadow-sm transition-shadow ${
        highlight
          ? "bg-amber-50 ring-2 ring-amber-500 shadow-lg shadow-amber-700/10"
          : "bg-white ring-1 ring-stone-200"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-700 text-white text-xs font-bold shadow-md">
          {popularLabel}
        </div>
      )}
      <div className="font-bold text-lg text-zinc-900 mb-2">{tier}</div>
      <div className="flex items-baseline gap-1 mb-5">
        <span className="text-zinc-500 text-sm">NT$</span>
        <span className="text-4xl font-bold text-zinc-900 tabular-nums">
          {price}
        </span>
        <span className="text-zinc-500 text-sm">{unit}</span>
      </div>
      <ul className="space-y-2 mb-6 min-h-[10rem]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-700">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={`block text-center px-4 py-2.5 rounded-full font-semibold text-sm transition-all ${
          highlight
            ? "bg-amber-700 text-white shadow-md hover:bg-amber-800"
            : "bg-white text-zinc-800 ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800"
        }`}
      >
        {cta.label}
      </Link>
    </div>
  );
}
