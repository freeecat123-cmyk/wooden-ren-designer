import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bilingualAlternates } from "@/i18n/metadata";
import { routing, type Locale } from "@/i18n/routing";
import { FREE_UNLOCKED_CATEGORIES } from "@/lib/permissions";
import { FEATURED_TEMPLATE_CATEGORIES, FEATURED_TEMPLATE_CATEGORIES_EN } from "@/lib/templates/marketing";
import { AcademyPromoBanner } from "@/components/AcademyPromoBanner";

/**
 * /workbench — 免費「木工工作桌」落地頁（2026-09-04 木頭仁拍板）
 *
 * 定位：整站最重要的免費鉤子。「用推廣木工的名義免費送，讓大家一開始先有個目標：
 * 建立自己的工作空間。」首頁主按鈕、歡迎信第一封都指到這裡。
 *
 * 一頁式：為什麼免費送 → 能選什麼（五種流派 / 夾板疊層 / 桌高 / 工件固定）→
 * 免登入直接出圖（四種產出）→ 大按鈕進 /design/workbench（免費分類，不會被鎖：
 * lib/permissions.ts FREE_UNLOCKED_CATEGORIES）→ 另外兩個免費模板。
 *
 * ⛔ 不放 FAQ 區塊（木頭仁規矩：商品頁不寫 FAQ）。
 * 文案全部走 messages/{zh-TW,en}.json 的 workbenchLanding 命名空間。
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "workbenchLanding.metadata" });
  const alt = bilingualAlternates("/workbench", locale);
  return {
    title: t("title"),
    description: t("description"),
    alternates: alt,
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: alt.canonical,
      type: "website",
      images: [{ url: "/about-assets/hero-workbench.png", width: 1600, height: 1120 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: ["/about-assets/hero-workbench.png"],
    },
  };
}

const STYLE_KEYS = ["roubo", "apron", "well", "mft", "classroom"] as const;
const STYLE_ICONS: Record<(typeof STYLE_KEYS)[number], string> = {
  roubo: "🪵",
  apron: "🔩",
  well: "🧰",
  mft: "🕳️",
  classroom: "🎓",
};

const OUTPUT_KEYS = ["threeview", "bom", "parts", "cutplan"] as const;
const OUTPUT_ICONS: Record<(typeof OUTPUT_KEYS)[number], string> = {
  threeview: "📐",
  bom: "📋",
  parts: "🧩",
  cutplan: "🪚",
};

/** 另外兩個免費模板（跟 FREE_UNLOCKED_CATEGORIES 對齊；workbench 自己不列） */
const OTHER_FREE = [
  { category: "stool", key: "stool" },
  { category: "pencil-holder", key: "pencilHolder" },
] as const;

export default async function WorkbenchLanding({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "workbenchLanding" });

  // 免費保證：工作桌一定在 FREE_UNLOCKED_CATEGORIES 裡，否則這頁的承諾就是假的
  const isFree = FREE_UNLOCKED_CATEGORIES.includes("workbench");
  const otherFree = OTHER_FREE.filter((o) => FREE_UNLOCKED_CATEGORIES.includes(o.category));

  // /templates/workbench 完整介紹：英文站只有 marketing-en 有翻才顯示
  const hasGuide =
    locale === routing.defaultLocale
      ? FEATURED_TEMPLATE_CATEGORIES.includes("workbench")
      : (FEATURED_TEMPLATE_CATEGORIES_EN as readonly string[]).includes("workbench");

  const editorHref = "/design/workbench";

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
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 pt-14 sm:pt-20 pb-12 sm:pb-20">
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white ring-1 ring-emerald-300 text-emerald-800 text-xs font-semibold mb-5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t("hero.badge")}
              </div>
              <h1 className="font-serif-tc text-4xl sm:text-5xl md:text-[3.25rem] font-bold tracking-tight text-zinc-900 leading-[1.1]">
                {t("hero.h1Line1")}
                <br className="hidden sm:block" />
                <span className="text-amber-700">{t("hero.h1Highlight")}</span>
              </h1>
              <p className="mt-5 text-lg text-zinc-700 leading-relaxed max-w-xl">
                {t("hero.intro")}
              </p>
              <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3">
                <Link
                  href={editorHref}
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-amber-700 text-white text-lg font-bold shadow-lg shadow-amber-700/30 hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  {t("hero.cta")}
                </Link>
                {hasGuide && (
                  <Link
                    href="/templates/workbench"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-4"
                  >
                    {t("hero.readMore")}
                  </Link>
                )}
              </div>
              <p className="mt-4 text-sm text-zinc-500">{t("hero.ctaNote")}</p>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-4 sm:p-6">
                <div className="aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/40">
                  <Image
                    src="/about-assets/hero-workbench.png"
                    alt={t("hero.imgAlt")}
                    width={620}
                    height={465}
                    priority
                    style={{ objectFit: "contain", maxHeight: "92%", maxWidth: "92%" }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {t("hero.imgCaption")}
                  </span>
                  <span className="font-mono">designer.woodenren.com</span>
                </div>
              </div>
              {isFree && (
                <div
                  aria-hidden
                  className="hidden md:block absolute -bottom-5 -right-4 rotate-3 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-lg"
                >
                  {t("cta.note")}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ 為什麼免費送 ============ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <div className="text-xs font-bold tracking-widest text-amber-700 uppercase">{t("why.eyebrow")}</div>
        <h2 className="mt-2 font-serif-tc text-3xl sm:text-4xl font-bold text-zinc-900">{t("why.h2")}</h2>
        <div className="mt-6 space-y-4 text-lg text-zinc-700 leading-relaxed">
          <p>{t("why.p1")}</p>
          <p>{t("why.p2")}</p>
          <p className="font-semibold text-zinc-900">{t("why.p3")}</p>
        </div>
        <p className="mt-6 text-zinc-500 font-serif-tc">{t("why.sign")}</p>
      </section>

      {/* ============ 能選什麼 ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <div className="text-center">
            <div className="text-xs font-bold tracking-widest text-amber-700 uppercase">{t("choose.eyebrow")}</div>
            <h2 className="mt-2 font-serif-tc text-3xl sm:text-4xl font-bold text-zinc-900">{t("choose.h2")}</h2>
            <p className="mt-3 text-zinc-600 max-w-2xl mx-auto">{t("choose.intro")}</p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {STYLE_KEYS.map((key) => (
              <div
                key={key}
                className="rounded-2xl bg-white ring-1 ring-stone-200 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:ring-amber-300 transition-all"
              >
                <div className="text-3xl mb-3" aria-hidden>{STYLE_ICONS[key]}</div>
                <h3 className="font-bold text-lg text-zinc-900 mb-1.5">{t(`choose.styles.${key}.title`)}</h3>
                <p className="text-zinc-600 leading-relaxed text-sm">{t(`choose.styles.${key}.desc`)}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-300 p-5 shadow-sm">
              <div className="text-3xl mb-3" aria-hidden>🧱</div>
              <h3 className="font-bold text-lg text-amber-900 mb-1.5">{t("choose.plywood.title")}</h3>
              <p className="text-amber-900/80 leading-relaxed text-sm">{t("choose.plywood.desc")}</p>
            </div>
          </div>
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {(["height", "holding"] as const).map((key) => (
              <div key={key} className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 shadow-sm">
                <h3 className="font-bold text-lg text-zinc-900 mb-1.5">{t(`choose.${key}.title`)}</h3>
                <p className="text-zinc-600 leading-relaxed text-sm">{t(`choose.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 免登入直接出圖 ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
        <div className="text-center">
          <div className="text-xs font-bold tracking-widest text-emerald-700 uppercase">{t("outputs.eyebrow")}</div>
          <h2 className="mt-2 font-serif-tc text-3xl sm:text-4xl font-bold text-zinc-900">{t("outputs.h2")}</h2>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {OUTPUT_KEYS.map((key) => (
            <div key={key} className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 shadow-sm">
              <div className="text-3xl mb-3" aria-hidden>{OUTPUT_ICONS[key]}</div>
              <h3 className="font-bold text-lg text-zinc-900 mb-1.5">{t(`outputs.${key}.title`)}</h3>
              <p className="text-zinc-600 leading-relaxed text-sm">{t(`outputs.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ 大按鈕 ============ */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-16 sm:py-24 text-center">
          <h2 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">{t("cta.h2")}</h2>
          <p className="mt-5 text-amber-100 text-lg max-w-xl mx-auto leading-relaxed">{t("cta.body")}</p>
          <div className="mt-8">
            <Link
              href={editorHref}
              className="inline-flex items-center gap-2 px-10 py-5 rounded-full bg-white text-amber-800 text-xl font-bold shadow-xl hover:-translate-y-0.5 hover:bg-amber-50 transition-all"
            >
              {t("cta.button")}
            </Link>
          </div>
          <p className="mt-5 text-sm text-amber-100/80">{t("cta.note")}</p>
        </div>
      </section>

      {/* ============ 另外兩個免費模板 ============ */}
      {otherFree.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
            <div>
              <div className="text-xs font-bold tracking-widest text-amber-700 uppercase">{t("others.eyebrow")}</div>
              <h2 className="mt-2 font-serif-tc text-3xl sm:text-4xl font-bold text-zinc-900">{t("others.h2")}</h2>
            </div>
            <Link
              href="/templates"
              className="text-amber-700 hover:text-amber-900 font-semibold text-sm inline-flex items-center gap-1"
            >
              {t("others.seeAll")}
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl">
            {otherFree.map((o) => (
              <Link
                key={o.category}
                href={`/design/${o.category}`}
                className="group flex items-center gap-5 rounded-2xl bg-white ring-1 ring-stone-300 p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:ring-amber-500 transition-all"
              >
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center bg-gradient-to-br from-white to-stone-50 rounded-xl">
                  <Image
                    src={`/thumbs/v2/${o.category}.webp`}
                    alt={t(`others.${o.key}.title`)}
                    width={112}
                    height={84}
                    quality={75}
                    loading="lazy"
                    className="transition-transform group-hover:scale-[1.06]"
                    style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
                  />
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-[10px] font-bold">
                    FREE
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 group-hover:text-amber-900">{t(`others.${o.key}.title`)}</h3>
                  <p className="mt-1 text-sm text-zinc-600 leading-relaxed">{t(`others.${o.key}.desc`)}</p>
                  <span className="mt-2 inline-block text-sm font-semibold text-amber-700">{t("others.open")}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AcademyPromoBanner />
    </main>
  );
}
