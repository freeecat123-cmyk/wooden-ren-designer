import fs from "node:fs";
import path from "node:path";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FURNITURE_CATALOG, getTemplate } from "@/lib/templates";
import { FREE_UNLOCKED_CATEGORIES } from "@/lib/permissions";
import {
  FEATURED_TEMPLATE_CATEGORIES,
  getTemplateMarketing,
} from "@/lib/templates/marketing";
import { getHighlights } from "@/lib/templates/highlights";
import { getGallery } from "@/lib/templates/gallery";
import { ShareButtons } from "@/components/ShareButtons";
import { getUnlockPrice } from "@/lib/pricing/template-unlock";
import type { FurnitureCategory } from "@/lib/types";
import { routing } from "@/i18n/routing";

/**
 * /templates/[type] — 單模板介紹頁
 *
 * 主力 10 模板各有獨立 SEO 介紹頁（資料在 lib/templates/marketing.ts）。
 * 沒列在 FEATURED_TEMPLATE_CATEGORIES 的 type → notFound()。
 *
 * Sections: Hero / 能做什麼 / 適合誰 / 參數 / 情境 / Preset (if any) /
 *           FAQ / 相關模板 / 底部 CTA + JSON-LD Product schema
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

interface PageProps {
  params: Promise<{ locale: string; type: string }>;
}

export async function generateStaticParams() {
  return FEATURED_TEMPLATE_CATEGORIES.map((c) => ({ type: c }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, type } = await params;
  const marketing = getTemplateMarketing(type as FurnitureCategory, locale);
  const entry = getTemplate(type as FurnitureCategory);
  if (!marketing || !entry) {
    const t = await getTranslations({ locale, namespace: "templateDetail" });
    return { title: t("metadataTitleFallback") };
  }
  const ogImage = `${SITE_URL}/api/og?type=${encodeURIComponent(type)}${locale !== routing.defaultLocale ? `&locale=${locale}` : ""}`;
  const isDefault = locale === routing.defaultLocale;
  const pathPrefix = isDefault ? "" : `/${locale}`;
  return {
    title: marketing.seoTitle,
    description: marketing.seoDescription,
    keywords: marketing.keywords,
    alternates: { canonical: `${pathPrefix}/templates/${type}` },
    openGraph: {
      type: "article",
      locale: locale === "en" ? "en" : "zh_TW",
      title: marketing.seoTitle,
      description: marketing.seoDescription,
      url: `${SITE_URL}${pathPrefix}/templates/${type}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: locale === "en" && entry.nameEn ? entry.nameEn : entry.nameZh }],
    },
    twitter: {
      card: "summary_large_image",
      title: marketing.seoTitle,
      description: marketing.seoDescription,
      images: [ogImage],
    },
  };
}

export default async function TemplateDetail({ params }: PageProps) {
  const { locale, type } = await params;
  const marketing = getTemplateMarketing(type as FurnitureCategory, locale);
  const entry = getTemplate(type as FurnitureCategory);

  if (!marketing || !entry) notFound();

  const t = await getTranslations({ locale, namespace: "templateDetail" });
  const isFree = FREE_UNLOCKED_CATEGORIES.includes(entry.category);
  const highlights = getHighlights(entry.category);
  const gallery = getGallery(entry.category);
  const unlockPrice = isFree ? null : getUnlockPrice(entry.category);
  const isEn = locale === "en";
  const entryName = isEn && entry.nameEn ? entry.nameEn : entry.nameZh;
  const difficultyKey =
    entry.difficulty === "beginner"
      ? "difficultyBeginner"
      : entry.difficulty === "intermediate"
        ? "difficultyIntermediate"
        : "difficultyAdvanced";
  const difficultyLabel = t(difficultyKey);
  const outputItems = t.raw("outputs") as { icon: string; title: string; body: string }[];
  const showcaseLabels = t.raw("showcase") as { label: string; desc: string }[];
  const relatedEntries = marketing.related
    .map((c) => FURNITURE_CATALOG.find((f) => f.category === c))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .slice(0, 3);

  // JSON-LD Product schema
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: t("schemaProductName", { name: entryName }),
    description: marketing.seoDescription,
    image: `${SITE_URL}/thumbs/v2/${type}.webp`,
    brand: {
      "@type": "Brand",
      name: t("schemaBrand"),
    },
    offers: {
      "@type": "Offer",
      price: isFree ? "0" : isEn ? "9" : "390",
      priceCurrency: isEn ? "USD" : "TWD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}${isEn ? "/en" : ""}/pricing`,
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("breadcrumbHome"), item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: t("breadcrumbTemplates"),
        item: `${SITE_URL}${isEn ? "/en" : ""}/templates`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: entryName,
        item: `${SITE_URL}${isEn ? "/en" : ""}/templates/${type}`,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: marketing.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const howToSchema = marketing.howToSteps && marketing.howToSteps.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: t("schemaHowToName", { name: entryName }),
        description: marketing.tagline,
        image: `${SITE_URL}/thumbs/v2/${type}.webp`,
        step: marketing.howToSteps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      }
    : null;

  return (
    <main className="bg-[#fafaf7]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {howToSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
        />
      )}

      {/* ============ Breadcrumb ============ */}
      <nav className="max-w-6xl mx-auto px-5 sm:px-6 pt-6 pb-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-amber-700">{t("breadcrumbHome")}</Link>
        <span className="mx-2">/</span>
        <Link href="/templates" className="hover:text-amber-700">{t("breadcrumbTemplates")}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 font-medium">{entryName}</span>
      </nav>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-stone-100 border-b border-stone-200">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-200/40 blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-16">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <div className="flex flex-wrap gap-2 mb-5">
                {isFree && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-xs font-bold">
                    {t("freeBadge")}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white ring-1 ring-stone-300 text-zinc-700 text-xs font-bold">
                  {difficultyLabel}
                </span>
              </div>
              <h1 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
                {entryName}
              </h1>
              <p className="mt-4 text-xl text-amber-800 font-semibold leading-relaxed">
                {marketing.tagline}
              </p>
              {marketing.subTagline && (
                <p className="mt-2 text-zinc-600 leading-relaxed">
                  {marketing.subTagline}
                </p>
              )}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={`/design/${entry.category}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-700 text-white font-semibold shadow-lg shadow-amber-700/30 hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  {isFree ? t("heroCtaTryFree") : t("heroCtaStartDesign")} →
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
                >
                  {isFree ? t("heroCtaUnlockAll") : t("heroCtaViewPlans")}
                </Link>
              </div>
              <div className="mt-5">
                <ShareButtons
                  url={`${SITE_URL}/templates/${type}`}
                  title={t("shareTitle", { name: entryName, tagline: marketing.tagline })}
                />
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-6">
                <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30">
                  <Image
                    src={`/thumbs/v2/${entry.category}.webp`}
                    alt={t("preview3dAlt", { name: entryName })}
                    width={520}
                    height={520}
                    priority
                    style={{ objectFit: "contain", maxHeight: "88%", maxWidth: "88%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 設計細節透視（gallery） ============ */}
      {gallery && (
        <section className="bg-gradient-to-b from-stone-50 to-white border-b border-stone-200">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
            <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
              {t("galleryH2", { name: entryName })}
            </h2>
            <p className="text-center text-zinc-500 mb-9">
              {t("gallerySubtitle")}
            </p>
            <div
              className={`grid gap-5 ${gallery.length === 1 ? "max-w-3xl mx-auto" : gallery.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}
            >
              {gallery.map((g) => (
                <figure
                  key={g.src}
                  className="rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:ring-amber-400 transition-all"
                >
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-stone-50 to-amber-50/20 overflow-hidden">
                    <Image
                      src={g.src}
                      alt={g.label}
                      fill
                      sizes={gallery.length === 1 ? "(min-width:768px) 768px, 100vw" : "(min-width:768px) 50vw, 100vw"}
                      className="object-contain p-2"
                    />
                  </div>
                  <figcaption className="p-5 border-t border-amber-100 bg-amber-50">
                    <div className="font-bold text-zinc-900 mb-1">
                      {g.label}
                    </div>
                    {g.desc && (
                      <div className="text-sm text-zinc-600 leading-relaxed">
                        {g.desc}
                      </div>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ 設計重點 Highlights ============ */}
      {highlights && highlights.length > 0 && (
        <section className="max-w-5xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
            {t("highlightsH2")}
          </h2>
          <p className="text-center text-zinc-500 mb-9">
            {t("highlightsSubtitle")}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {highlights.map((h) => (
              <div
                key={h.title}
                className="flex items-start gap-3 rounded-2xl bg-white ring-1 ring-stone-200 p-4 hover:ring-amber-300 hover:shadow-md transition-all"
              >
                <div className="text-3xl shrink-0 leading-none mt-0.5">
                  {h.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-zinc-900 text-sm leading-snug">
                    {h.title}
                  </div>
                  {h.desc && (
                    <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      {h.desc}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ 能幫你做什麼 ============ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-5">
          {t("whatItDoesH2")}
        </h2>
        <div className="prose prose-zinc max-w-none">
          {marketing.whatItDoes.split("\n\n").map((p, i) => (
            <p key={i} className="text-zinc-700 leading-loose text-[17px] mb-4">
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* ============ 適合 / 不適合 ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-7">
            {t("fitForH2")}
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-white ring-1 ring-emerald-200 p-6">
              <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                <span className="text-xl">✓</span> {t("fitForGood")}
              </h3>
              <ul className="space-y-2">
                {marketing.fitFor.good.map((g) => (
                  <li key={g} className="text-sm text-zinc-700 leading-relaxed">
                    · {g}
                  </li>
                ))}
              </ul>
            </div>
            {marketing.fitFor.notFor && marketing.fitFor.notFor.length > 0 && (
              <div className="rounded-2xl bg-white ring-1 ring-stone-300 p-6">
                <h3 className="font-bold text-zinc-600 mb-3 flex items-center gap-2">
                  <span className="text-xl">×</span> {t("fitForNotFor")}
                </h3>
                <ul className="space-y-2">
                  {marketing.fitFor.notFor.map((n) => (
                    <li key={n} className="text-sm text-zinc-600 leading-relaxed">
                      · {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ 可調參數 ============ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
          {t("paramsH2")}
        </h2>
        <p className="text-zinc-500 mb-7">
          {t("paramsSubtitle")}
        </p>
        <div className="space-y-3">
          {marketing.parameters.map((p) => (
            <div
              key={p.label}
              className="rounded-xl bg-white ring-1 ring-stone-200 p-5 hover:ring-amber-300 transition-colors"
            >
              <div className="font-bold text-zinc-900 mb-1">{p.label}</div>
              <div className="text-sm text-zinc-600 leading-relaxed">
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 自動產出 ============ */}
      <section className="bg-gradient-to-b from-white to-amber-50/30 border-y border-amber-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
            {t("outputsH2")}
          </h2>
          <p className="text-zinc-500 mb-7">
            {t("outputsSubtitle")}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {outputItems.map((o) => (
              <div
                key={o.title}
                className="rounded-xl bg-white ring-1 ring-stone-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">{o.icon}</div>
                  <div>
                    <div className="font-bold text-zinc-900 mb-0.5">
                      {o.title}
                    </div>
                    <div className="text-xs text-zinc-600 leading-relaxed">
                      {o.body}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 實際輸出畫面（共用截圖） ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
          {t("showcaseH2")}
        </h2>
        <p className="text-center text-zinc-500 mb-9">
          {t("showcaseSubtitle", { name: entryName })}
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          {(() => {
            // 沒有模板專屬截圖時 fall back 到 /about-assets/feat-*.png（罕見：
            // 某些模板預設尺寸排板會超過原料）
            const tpl = (key: string, fallback: string) => {
              const specific = `/showcase/${entry.category}-${key}.png`;
              const exists = fs.existsSync(path.join(process.cwd(), "public", specific));
              return exists ? specific : fallback;
            };
            return [
              { img: tpl("threeview", "/about-assets/feat-threeview.png"), ...showcaseLabels[0] },
              { img: tpl("cutplan", "/about-assets/feat-cutplan-full.png"), ...showcaseLabels[1] },
              { img: tpl("cutlist", "/about-assets/feat-cutlist.png"), ...showcaseLabels[2] },
              { img: tpl("steps", "/about-assets/feat-steps.png"), ...showcaseLabels[3] },
              { img: tpl("3d", "/about-assets/hero-3d.png"), ...showcaseLabels[4] },
            ];
          })().map((s) => (
            <figure
              key={s.label}
              className="group rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:ring-amber-400 transition-all"
            >
              <div className="relative aspect-[4/3] bg-gradient-to-br from-stone-50 to-amber-50/20 overflow-hidden">
                <Image
                  src={s.img}
                  alt={s.label}
                  fill
                  sizes="(min-width:768px) 50vw, 100vw"
                  className="object-contain p-2 group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <figcaption className="p-4 border-t border-amber-100 bg-amber-50">
                <div className="font-bold text-zinc-900 mb-0.5">
                  {s.label}
                </div>
                <div className="text-xs text-zinc-600 leading-relaxed">
                  {s.desc}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">
          {t("showcaseFootnote")}
        </p>
      </section>

      {/* ============ 使用情境 ============ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-7">
          {t("scenariosH2")}
        </h2>
        <div className="space-y-3">
          {marketing.scenarios.map((s) => (
            <div
              key={s.tag}
              className="rounded-2xl bg-white ring-1 ring-stone-200 p-5"
            >
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-800 text-xs font-bold mb-3">
                {s.tag}
              </div>
              <p className="text-zinc-700 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Preset 變體（如果有） ============ */}
      {marketing.presets && marketing.presets.length > 0 && (
        <section className="bg-stone-50 border-y border-stone-200">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
            <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
              {t("presetsH2", { count: marketing.presets.length })}
            </h2>
            <p className="text-zinc-500 mb-7">
              {t("presetsSubtitle")}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {marketing.presets.map((p) => (
                <div
                  key={p.name}
                  className="rounded-xl bg-white ring-1 ring-stone-200 p-4"
                >
                  <div className="font-bold text-zinc-900 mb-1">{p.name}</div>
                  <div className="text-sm text-zinc-600 leading-relaxed">
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ FAQ ============ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-7">
          {t("faqH2")}
        </h2>
        <div className="space-y-3">
          {marketing.faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl bg-white ring-1 ring-stone-200 p-5 open:shadow-md transition-shadow"
            >
              <summary className="cursor-pointer font-semibold text-zinc-900 list-none flex items-center justify-between gap-3">
                <span>{f.q}</span>
                <span className="text-amber-700 group-open:rotate-45 transition-transform text-xl shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-3 text-zinc-700 leading-relaxed whitespace-pre-line">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ============ 如何取得這支模板（定價對應表） ============ */}
      <section className="bg-gradient-to-b from-amber-50/30 to-white border-y border-amber-100">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
            {t("pricingH2", { name: entryName })}
          </h2>
          <p className="text-center text-zinc-500 text-sm mb-9">
            {isFree
              ? t("pricingSubtitleFree")
              : t("pricingSubtitlePaid", { difficulty: difficultyLabel })}
          </p>

          {isFree ? (
            <div className="max-w-2xl mx-auto rounded-2xl bg-white ring-2 ring-emerald-400 p-7 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-xs font-bold">
                  {t("freeBadgeForever")}
                </span>
                <span className="text-zinc-400 text-sm">{t("freeBadgeUnlimited")}</span>
              </div>
              <h3 className="font-bold text-xl text-zinc-900 mb-3">
                {t("freeTitle", { name: entryName })}
              </h3>
              <ul className="space-y-2 mb-6 text-sm text-zinc-700">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
                  <span>{t("freeFeature1")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
                  <span>{t("freeFeature2")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
                  <span>{t("freeFeature3")}</span>
                </li>
              </ul>
              <Link
                href={`/design/${entry.category}`}
                className="block text-center px-6 py-3.5 rounded-full bg-amber-700 text-white font-bold shadow-md hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
              >
                {t("freeCta")}
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {/* 單範本買斷 — 直接 POST 到 ECPay（未登入會 redirect 到 /login） */}
              {unlockPrice && (
                <PricingOption
                  badge={t("tierSingleBadge")}
                  title={t("tierSingleTitle")}
                  price={
                    isEn
                      ? entry.difficulty === "beginner"
                        ? "$4.99"
                        : entry.difficulty === "intermediate"
                          ? "$9.99"
                          : "$14.99"
                      : `NT$${unlockPrice}`
                  }
                  unit={t("tierSingleUnit")}
                  features={[
                    t("tierSingleFeature1"),
                    t("tierSingleFeature2"),
                    t("tierSingleFeature3"),
                  ]}
                  cta={{
                    label: t("tierSingleCta"),
                    action: "/api/checkout/template",
                    hiddenField: { name: "category", value: entry.category },
                  }}
                  highlight={false}
                />
              )}
              {/* 個人版 */}
              <PricingOption
                badge={t("tierPersonalBadge")}
                title={t("tierPersonalTitle")}
                price={t("tierPersonalPrice")}
                unit={t("tierPersonalUnit")}
                features={[
                  t("tierPersonalFeature1"),
                  t("tierPersonalFeature2"),
                  t("tierPersonalFeature3"),
                ]}
                cta={{ label: t("tierPersonalCta"), href: "/pricing" }}
                highlight={true}
              />
              {/* 專業版 */}
              <PricingOption
                badge={t("tierProBadge")}
                title={t("tierProTitle")}
                price={t("tierProPrice")}
                unit={t("tierProUnit")}
                features={[
                  t("tierProFeature1"),
                  t("tierProFeature2"),
                  t("tierProFeature3"),
                ]}
                cta={{ label: t("tierProCta"), href: "/pricing" }}
                highlight={false}
              />
            </div>
          )}

          {!isFree && (
            <p className="mt-6 text-center text-xs text-zinc-500">
              {t("pricingFootnoteText")}
              <Link href="/pricing" className="ml-1 text-amber-700 hover:text-amber-900 underline underline-offset-2">
                {t("pricingFootnoteLink")}
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ============ 相關模板 ============ */}
      {relatedEntries.length > 0 && (
        <section className="bg-stone-50 border-y border-stone-200">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
            <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
              {t("relatedH2")}
            </h2>
            <p className="text-center text-zinc-500 text-sm mb-9">
              {t("relatedSubtitle")}
            </p>
            <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {relatedEntries.map((r) => {
                const rHasDetail = FEATURED_TEMPLATE_CATEGORIES.includes(
                  r.category,
                );
                const rIsFree = FREE_UNLOCKED_CATEGORIES.includes(r.category);
                const rMarketing = getTemplateMarketing(r.category, locale);
                const rHasEnDetail = rHasDetail && (locale !== "en" || Boolean(rMarketing));
                const rDifficultyKey =
                  r.difficulty === "beginner"
                    ? "difficultyBeginner"
                    : r.difficulty === "intermediate"
                      ? "difficultyIntermediate"
                      : "difficultyAdvanced";
                const rDifficulty = t(rDifficultyKey);
                const rDisplayName = isEn ? (r.nameEn ?? r.nameZh) : r.nameZh;
                return (
                  <Link
                    key={r.category}
                    href={rHasEnDetail ? `/templates/${r.category}` : `/design/${r.category}`}
                    className="group flex flex-col rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden hover:ring-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-white to-stone-50 relative">
                      <div className="absolute top-2 right-2 z-10 flex gap-1.5">
                        {rIsFree && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-[10px] font-bold">
                            {t("relatedFreeBadge")}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded-full bg-white/95 ring-1 ring-stone-300 text-zinc-600 text-[10px] font-bold">
                          {rDifficulty}
                        </span>
                      </div>
                      <Image
                        src={`/thumbs/v2/${r.category}.webp`}
                        alt={t("preview3dAlt", { name: rDisplayName })}
                        width={240}
                        height={180}
                        quality={75}
                        loading="lazy"
                        sizes="(min-width:640px) 320px, 100vw"
                        className="transition-transform group-hover:scale-[1.06]"
                        style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
                      />
                    </div>
                    <div className="p-4 border-t border-amber-100 bg-amber-50 flex-1 flex flex-col">
                      <div className="font-bold text-zinc-900 group-hover:text-amber-900 mb-1">
                        {rDisplayName}
                      </div>
                      {rMarketing?.tagline && (
                        <p className="text-xs text-zinc-600 leading-snug line-clamp-2">
                          {rMarketing.tagline}
                        </p>
                      )}
                      {rHasEnDetail && (
                        <div className="mt-3 text-xs font-semibold text-amber-700 group-hover:text-amber-900 inline-flex items-center gap-1">
                          {t("relatedFullGuide")}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/templates"
                className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-semibold"
              >
                {t("relatedViewAll")}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ============ 底部 CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold leading-tight">
            {t("bottomCtaH2", { name: entryName })}
          </h2>
          <p className="mt-5 text-amber-100 max-w-xl mx-auto leading-relaxed">
            {isFree ? t("bottomCtaBodyFree") : t("bottomCtaBodyPaid")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={`/design/${entry.category}`}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-amber-800 font-bold shadow-lg hover:-translate-y-0.5 hover:bg-amber-50 transition-all"
            >
              {isFree ? t("bottomCtaTryFree") : t("bottomCtaStartDesign")}
            </Link>
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white/10 text-white font-semibold ring-1 ring-white/30 hover:bg-white/20 transition-all"
            >
              {t("bottomCtaBrowse")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

type PricingCta =
  | { label: string; href: string }
  | { label: string; action: string; hiddenField?: { name: string; value: string } };

function PricingOption({
  badge,
  title,
  price,
  unit,
  features,
  cta,
  highlight,
}: {
  badge: string;
  title: string;
  price: string;
  unit: string;
  features: string[];
  cta: PricingCta;
  highlight: boolean;
}) {
  const ctaClass = `block w-full text-center px-3 py-2 rounded-full font-semibold text-xs transition-all ${
    highlight
      ? "bg-amber-700 text-white shadow-md hover:bg-amber-800"
      : "bg-white text-zinc-800 ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800"
  }`;

  return (
    <div
      className={`relative rounded-2xl p-5 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 ${
        highlight
          ? "bg-amber-50 ring-2 ring-amber-500 shadow-amber-700/10"
          : "bg-white ring-1 ring-stone-200"
      }`}
    >
      <div
        className={`absolute -top-2.5 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
          highlight
            ? "bg-amber-700 text-white"
            : "bg-zinc-700 text-white"
        }`}
      >
        {badge}
      </div>
      <h3 className="font-bold text-zinc-900 mb-2 mt-1">{title}</h3>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold text-zinc-900 tabular-nums">
          {price}
        </span>
        <span className="text-zinc-500 text-xs">{unit}</span>
      </div>
      <ul className="space-y-1.5 mb-5 min-h-[5rem]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-zinc-700 leading-relaxed">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {"action" in cta ? (
        <form method="POST" action={cta.action}>
          {cta.hiddenField && (
            <input type="hidden" name={cta.hiddenField.name} value={cta.hiddenField.value} />
          )}
          <button type="submit" className={ctaClass}>
            {cta.label}
          </button>
        </form>
      ) : (
        <Link href={cta.href} className={ctaClass}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
