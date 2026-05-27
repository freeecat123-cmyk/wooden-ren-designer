import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import {
  FURNITURE_CATALOG,
  type FurnitureCatalogEntry,
  getEntryName,
  getEntryDescription,
} from "@/lib/templates";
import { FREE_UNLOCKED_CATEGORIES } from "@/lib/permissions";
import {
  FEATURED_TEMPLATE_CATEGORIES,
  getTemplateMarketing,
} from "@/lib/templates/marketing";
import type { FurnitureCategory } from "@/lib/types";

type FilterKey = "all" | "free" | "beginner" | "intermediate" | "advanced";

function matchFilter(item: FurnitureCatalogEntry, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "free") return FREE_UNLOCKED_CATEGORIES.includes(item.category);
  return item.difficulty === filter;
}

const FILTER_KEYS: FilterKey[] = ["all", "free", "beginner", "intermediate", "advanced"];
const FILTER_EMOJI: Record<FilterKey, string | undefined> = {
  all: undefined,
  free: "🆓",
  beginner: "🟢",
  intermediate: "🟡",
  advanced: "🔴",
};

const CATEGORY_GROUPS: Array<{
  id: "seating" | "table" | "cabinet" | "small" | "large";
  emoji: string;
  match: (c: FurnitureCategory) => boolean;
}> = [
  {
    id: "seating",
    emoji: "🪑",
    match: (c) =>
      c === "stool" || c === "bench" || c === "dining-chair" ||
      c === "bar-stool" || c === "round-stool",
  },
  {
    id: "table",
    emoji: "🪵",
    match: (c) =>
      c === "tea-table" || c === "side-table" || c === "low-table" ||
      c === "dining-table" || c === "desk" ||
      c === "round-tea-table" || c === "round-table",
  },
  {
    id: "cabinet",
    emoji: "🗄️",
    match: (c) =>
      c === "open-bookshelf" || c === "chest-of-drawers" ||
      c === "shoe-cabinet" || c === "display-cabinet" ||
      c === "wardrobe" || c === "media-console" || c === "nightstand",
  },
  {
    id: "small",
    emoji: "🧰",
    match: (c) =>
      c === "pencil-holder" || c === "photo-frame" ||
      c === "tray" || c === "dovetail-box" || c === "wine-rack",
  },
  {
    id: "large",
    emoji: "🛏️",
    match: (c) =>
      c === "bed" || c === "coat-rack" || c === "chinese-cabinet",
  },
];

const DEV_SET = new Set<FurnitureCategory>([
  "chinese-cabinet", "bed", "coat-rack",
]);

interface InteriorTool {
  id: "ceiling" | "floor" | "raised-floor";
  href: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

const INTERIOR_TOOLS: InteriorTool[] = [
  { id: "ceiling", href: "/ceiling", difficulty: "intermediate" },
  { id: "floor", href: "/floor", difficulty: "intermediate" },
  { id: "raised-floor", href: "/raised-floor", difficulty: "intermediate" },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "templates.metadata" });
  const isDefault = locale === routing.defaultLocale;
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: isDefault ? "/templates" : `/${locale}/templates`,
    },
  };
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ filter?: string }>;
}

export default async function TemplatesIndex({ params, searchParams }: PageProps) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "templates" });
  const tDiff = await getTranslations({ locale, namespace: "difficulty" });

  const sp = (await searchParams) ?? {};
  const activeFilter: FilterKey = FILTER_KEYS.includes(sp.filter as FilterKey)
    ? (sp.filter as FilterKey)
    : "all";
  const featuredSet = new Set<string>(FEATURED_TEMPLATE_CATEGORIES);
  const filteredCatalog = FURNITURE_CATALOG.filter((e) =>
    matchFilter(e, activeFilter),
  );
  const visibleCount = filteredCatalog.length;

  // 裝潢工具是 TW-only 業務（建材市場、單位、語境都是台灣），/en 不顯示
  const showInteriorTools =
    locale === routing.defaultLocale &&
    (activeFilter === "all" || activeFilter === "intermediate");

  return (
    <main className="bg-[#fafaf7]">
      {/* ============ Header ============ */}
      <section className="bg-gradient-to-br from-amber-50 via-white to-stone-100 border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {t("header.badge")}
          </div>
          <h1 className="font-serif-tc text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900">
            {locale === routing.defaultLocale ? t("header.h1") : t("header.h1En")}
          </h1>
          <p className="mt-5 text-zinc-700 max-w-2xl mx-auto leading-relaxed text-lg">
            {t("header.subtitle1")}
            <br />
            {locale === routing.defaultLocale && (
              <>
                {t("header.subtitle2")}
                <br />
              </>
            )}
            {t("header.subtitle3")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-700 text-white font-semibold shadow-md hover:bg-amber-800 transition-colors"
            >
              {t("header.ctaPrimary")}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-colors"
            >
              {t("header.ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 篩選 + 快速跳轉 sticky bar ============ */}
      <div className="sticky top-14 z-30 bg-[#fafaf7]/95 backdrop-blur-sm border-b border-stone-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-2.5 space-y-2">
          {/* 篩選 chip 列（免費 / 難度） */}
          <nav className="overflow-x-auto scrollbar-thin">
            <div className="inline-flex gap-1.5 min-w-max items-center">
              <span className="text-xs text-zinc-400 font-medium pr-1">
                {t("filter.label")}
              </span>
              {FILTER_KEYS.map((key) => {
                const active = activeFilter === key;
                const href = key === "all" ? "/templates" : `/templates?filter=${key}`;
                const emoji = FILTER_EMOJI[key];
                return (
                  <Link
                    key={key}
                    href={href}
                    scroll={false}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                      active
                        ? "bg-amber-700 text-white shadow-sm ring-1 ring-amber-700"
                        : "bg-white text-zinc-700 ring-1 ring-stone-300 hover:ring-amber-400 hover:text-amber-800"
                    }`}
                  >
                    {emoji && <span aria-hidden>{emoji}</span>}
                    <span>{t(`filter.${key}`)}</span>
                  </Link>
                );
              })}
              <span className="ml-3 text-xs text-zinc-500 tabular-nums shrink-0">
                {t("filter.count", { count: visibleCount })}
              </span>
            </div>
          </nav>
          {/* 分類 anchor 跳轉列 */}
          <nav className="overflow-x-auto scrollbar-thin">
            <div className="inline-flex gap-2 min-w-max items-center">
              <span className="text-xs text-zinc-400 font-medium pr-1">
                {t("jumpTo")}
              </span>
              {showInteriorTools && (
                <a
                  href="#interior-tools"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-xs font-medium text-zinc-700 ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  <span aria-hidden>🏠</span>
                  <span>{t("group.interiorTools")}</span>
                  <span className="text-zinc-400 tabular-nums">{INTERIOR_TOOLS.length}</span>
                </a>
              )}
              {CATEGORY_GROUPS.map((g) => {
                const count = filteredCatalog.filter((e) => g.match(e.category)).length;
                if (count === 0) return null;
                return (
                  <a
                    key={g.id}
                    href={`#${g.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-xs font-medium text-zinc-700 ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 hover:-translate-y-0.5 transition-all"
                  >
                    <span aria-hidden>{g.emoji}</span>
                    <span>{t(`group.${g.id}`)}</span>
                    <span className="text-zinc-400 tabular-nums">{count}</span>
                  </a>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* ============ Groups ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-14">
        {visibleCount === 0 && activeFilter !== "intermediate" && (
          <div className="text-center py-20 text-zinc-500">
            {t("empty.title")}
            <Link href="/templates" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
              {t("empty.clear")}
            </Link>
          </div>
        )}
        {showInteriorTools && (
          <div id="interior-tools" className="scroll-mt-40">
            <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-1 flex items-center gap-2">
              <span aria-hidden>🏠</span>
              {t("group.interiorTools")}
            </h2>
            <p className="text-zinc-500 text-sm mb-6">
              {t("group.interiorToolsCount", { count: INTERIOR_TOOLS.length })}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {INTERIOR_TOOLS.map((tool) => (
                <InteriorToolCard
                  key={tool.id}
                  tool={tool}
                  name={t(`interior.${camel(tool.id)}Name`)}
                  tagline={t(`interior.${camel(tool.id)}Tagline`)}
                  difficultyLabel={tDiff(tool.difficulty)}
                  ctaIntro={t("interior.ctaIntro")}
                  ctaStart={t("interior.ctaStart")}
                />
              ))}
            </div>
          </div>
        )}
        {CATEGORY_GROUPS.map((g) => {
          const items = filteredCatalog.filter((e) => g.match(e.category));
          if (items.length === 0) return null;
          return (
            <div
              key={g.id}
              id={g.id}
              className="scroll-mt-40"
            >
              <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-1 flex items-center gap-2">
                <span aria-hidden>{g.emoji}</span>
                {t(`group.${g.id}`)}
              </h2>
              <p className="text-zinc-500 text-sm mb-6">
                {t("group.itemsCount", { count: items.length })}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const isFree = FREE_UNLOCKED_CATEGORIES.includes(item.category);
                  const isDev = DEV_SET.has(item.category);
                  const hasDetail = featuredSet.has(item.category);
                  const name = getEntryName(item, locale);
                  // /en 沒有 [type] 介紹頁（marketing.ts 未翻），不顯示「了解更多」
                  const showDetailLink = hasDetail && locale === routing.defaultLocale;
                  const marketing = locale === routing.defaultLocale
                    ? getTemplateMarketing(item.category)
                    : null;
                  const tagline =
                    marketing?.tagline ?? getEntryDescription(item, locale) ?? "";
                  return (
                    <TemplateCard
                      key={item.category}
                      categorySlug={item.category}
                      name={name}
                      tagline={tagline}
                      isFree={isFree}
                      isDev={isDev}
                      showDetailLink={showDetailLink}
                      previewAlt={t("card.previewAlt", { name })}
                      labels={{
                        free: t("badge.free"),
                        wip: t("badge.wip"),
                        learnMore: t("card.learnMore"),
                        startDesign: t("card.startDesign"),
                        comingSoon: t("card.comingSoon"),
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* ============ Bottom CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold leading-tight">
            {t("bottomCta.h2")}
          </h2>
          <p className="mt-4 text-amber-100 max-w-xl mx-auto leading-relaxed">
            {t("bottomCta.subtitle")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-amber-800 font-bold shadow-lg hover:-translate-y-0.5 hover:bg-amber-50 transition-all"
            >
              {t("bottomCta.ctaPrimary")}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white/10 text-white font-semibold ring-1 ring-white/30 hover:bg-white/20 transition-all"
            >
              {t("bottomCta.ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function camel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function InteriorToolCard({
  tool,
  name,
  tagline,
  difficultyLabel,
  ctaIntro,
  ctaStart,
}: {
  tool: InteriorTool;
  name: string;
  tagline: string;
  difficultyLabel: string;
  ctaIntro: string;
  ctaStart: string;
}) {
  return (
    <div className="group relative rounded-2xl bg-white ring-1 ring-amber-300 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:ring-amber-500 transition-all">
      <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
        <span className="px-1.5 py-0.5 rounded-full bg-amber-700 text-white text-[10px] font-bold shadow-sm">
          🏠
        </span>
      </div>
      <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-white to-stone-50">
        {tool.id === "ceiling" ? (
          <Image
            src="/thumbs/v2/ceiling.webp"
            alt={`${name} 3D`}
            width={240}
            height={180}
            quality={75}
            loading="lazy"
            sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
            className="transition-transform group-hover:scale-[1.06]"
            style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
          />
        ) : tool.id === "floor" ? (
          <svg viewBox="0 0 120 120" className="w-[78%] h-[78%] transition-transform group-hover:scale-[1.06]" aria-hidden>
            {[0, 1, 2, 3, 4].map((r) => (
              <g key={r}>
                {[-1, 0, 1, 2, 3].map((c) => (
                  <rect
                    key={c}
                    x={c * 44 + (r % 2) * 22}
                    y={8 + r * 22}
                    width={42}
                    height={20}
                    rx={2}
                    fill="#e7d8ae"
                    stroke="#bd9955"
                    strokeWidth={1.2}
                  />
                ))}
              </g>
            ))}
          </svg>
        ) : (
          <svg viewBox="0 0 120 120" className="w-[78%] h-[78%] transition-transform group-hover:scale-[1.06]" aria-hidden>
            <rect x={14} y={28} width={92} height={14} rx={1} fill="#e7d8ae" stroke="#bd9955" strokeWidth={1.2} />
            {[18, 44, 70, 96].map((x) => (
              <rect key={x} x={x - 3} y={42} width={6} height={42} fill="#bd9955" />
            ))}
            <line x1={10} y1={84} x2={110} y2={84} stroke="#999" strokeWidth={1.5} />
            {[36, 52, 68].map((y) => (
              <line key={y} x1={14} y1={y} x2={106} y2={y} stroke="#c9a86b" strokeWidth={0.8} strokeDasharray="2 2" />
            ))}
          </svg>
        )}
      </div>
      <div className="p-4 border-t border-amber-100 bg-amber-50">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-bold text-lg text-zinc-900">{name}</h3>
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-900 text-[10px] font-bold">
            {difficultyLabel}
          </span>
        </div>
        <p className="text-xs text-zinc-600 leading-snug mb-3 min-h-[2.5em] line-clamp-2">
          {tagline}
        </p>
        <div className="flex gap-2">
          <Link
            href={`${tool.href}?intro=1`}
            className="flex-1 text-center px-3 py-2 rounded-full bg-white text-amber-800 font-semibold text-sm ring-1 ring-amber-300 hover:bg-amber-100 transition-colors"
          >
            {ctaIntro}
          </Link>
          <Link
            href={tool.href}
            className="flex-1 text-center px-3 py-2 rounded-full bg-amber-700 text-white font-semibold text-sm shadow-sm hover:bg-amber-800 transition-colors"
          >
            {ctaStart}
          </Link>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  categorySlug,
  name,
  tagline,
  isFree,
  isDev,
  showDetailLink,
  previewAlt,
  labels,
}: {
  categorySlug: string;
  name: string;
  tagline: string;
  isFree: boolean;
  isDev: boolean;
  showDetailLink: boolean;
  previewAlt: string;
  labels: {
    free: string;
    wip: string;
    learnMore: string;
    startDesign: string;
    comingSoon: string;
  };
}) {
  return (
    <div className="group relative rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
        {isFree && (
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-[10px] font-bold shadow-sm">
            {labels.free}
          </span>
        )}
        {isDev && (
          <span className="px-1.5 py-0.5 rounded-full bg-zinc-900/90 text-white text-[10px] font-bold shadow-sm">
            {labels.wip}
          </span>
        )}
      </div>
      <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-white to-stone-50">
        <Image
          src={`/thumbs/v2/${categorySlug}.webp`}
          alt={previewAlt}
          width={240}
          height={180}
          quality={75}
          loading="lazy"
          sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
          className="transition-transform group-hover:scale-[1.06]"
          style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
        />
      </div>
      <div className="p-4 border-t border-amber-100 bg-amber-50">
        <h3 className="font-bold text-lg text-zinc-900 mb-1">{name}</h3>
        {tagline ? (
          <p className="text-xs text-zinc-600 leading-snug mb-3 min-h-[2.5em] line-clamp-2">
            {tagline}
          </p>
        ) : (
          <p className="text-xs text-zinc-400 leading-snug mb-3 min-h-[2.5em]">
            {isDev ? labels.comingSoon : ""}
          </p>
        )}
        <div className="flex gap-2">
          {showDetailLink ? (
            <Link
              href={`/templates/${categorySlug}`}
              className="flex-1 text-center px-3 py-2 rounded-full bg-white text-amber-800 font-semibold text-sm ring-1 ring-amber-300 hover:bg-amber-100 transition-colors"
            >
              {labels.learnMore}
            </Link>
          ) : null}
          {!isDev ? (
            <Link
              href={`/design/${categorySlug}`}
              className="flex-1 text-center px-3 py-2 rounded-full bg-amber-700 text-white font-semibold text-sm shadow-sm hover:bg-amber-800 transition-colors"
            >
              {labels.startDesign}
            </Link>
          ) : (
            <span className="flex-1 text-center px-3 py-2 rounded-full bg-stone-200 text-stone-500 font-semibold text-sm cursor-not-allowed">
              {labels.comingSoon}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
