import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FURNITURE_CATALOG, getTemplate } from "@/lib/templates";
import { FREE_UNLOCKED_CATEGORIES } from "@/lib/permissions";
import {
  FEATURED_TEMPLATE_CATEGORIES,
  getTemplateMarketing,
} from "@/lib/templates/marketing";
import { getHighlights } from "@/lib/templates/highlights";
import { getGallery } from "@/lib/templates/gallery";
import type { FurnitureCategory } from "@/lib/types";

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
  params: Promise<{ type: string }>;
}

export async function generateStaticParams() {
  return FEATURED_TEMPLATE_CATEGORIES.map((c) => ({ type: c }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { type } = await params;
  const marketing = getTemplateMarketing(type as FurnitureCategory);
  const entry = getTemplate(type as FurnitureCategory);
  if (!marketing || !entry) {
    return { title: "找不到範本介紹" };
  }
  const ogImage = `${SITE_URL}/api/og?type=${encodeURIComponent(type)}`;
  return {
    title: marketing.seoTitle,
    description: marketing.seoDescription,
    keywords: marketing.keywords,
    alternates: { canonical: `/templates/${type}` },
    openGraph: {
      type: "article",
      locale: "zh_TW",
      title: marketing.seoTitle,
      description: marketing.seoDescription,
      url: `${SITE_URL}/templates/${type}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: entry.nameZh }],
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
  const { type } = await params;
  const marketing = getTemplateMarketing(type as FurnitureCategory);
  const entry = getTemplate(type as FurnitureCategory);

  if (!marketing || !entry) notFound();

  const isFree = FREE_UNLOCKED_CATEGORIES.includes(entry.category);
  const highlights = getHighlights(entry.category);
  const gallery = getGallery(entry.category);
  const relatedEntries = marketing.related
    .map((c) => FURNITURE_CATALOG.find((f) => f.category === c))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .slice(0, 3);

  // JSON-LD Product schema
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${entry.nameZh} 設計範本`,
    description: marketing.seoDescription,
    image: `${SITE_URL}/thumbs/v2/${type}.webp`,
    brand: {
      "@type": "Brand",
      name: "木頭仁木匠學院",
    },
    offers: {
      "@type": "Offer",
      price: isFree ? "0" : "390",
      priceCurrency: "TWD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/pricing`,
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首頁", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "範本介紹",
        item: `${SITE_URL}/templates`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: entry.nameZh,
        item: `${SITE_URL}/templates/${type}`,
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

      {/* ============ Breadcrumb ============ */}
      <nav className="max-w-6xl mx-auto px-5 sm:px-6 pt-6 pb-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-amber-700">首頁</Link>
        <span className="mx-2">/</span>
        <Link href="/templates" className="hover:text-amber-700">範本介紹</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 font-medium">{entry.nameZh}</span>
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
                    免費模板
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white ring-1 ring-stone-300 text-zinc-700 text-xs font-bold">
                  {entry.difficulty === "beginner" ? "入門" : entry.difficulty === "intermediate" ? "中階" : "進階"}
                </span>
              </div>
              <h1 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
                {entry.nameZh}
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
                  {isFree ? "免費試做" : "開始設計"} →
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
                >
                  {isFree ? "升級全部模板" : "查看方案"}
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-6">
                <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30">
                  <Image
                    src={`/thumbs/v2/${entry.category}.webp`}
                    alt={`${entry.nameZh} 3D 預覽`}
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
              {entry.nameZh} 設計細節
            </h2>
            <p className="text-center text-zinc-500 mb-9">
              這支模板獨有的視覺重點
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
            設計重點
          </h2>
          <p className="text-center text-zinc-500 mb-9">
            這支模板的演算法幫你顧到的事
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
          這支模板能幫你做什麼
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
            這支模板適合誰
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-white ring-1 ring-emerald-200 p-6">
              <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                <span className="text-xl">✓</span> 推薦給你
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
                  <span className="text-xl">×</span> 不適合
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
          你可以調整這些參數
        </h2>
        <p className="text-zinc-500 mb-7">
          演算法自動算尺寸、榫卯、材料用量。
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
            輸入完成，自動產出
          </h2>
          <p className="text-zinc-500 mb-7">
            5 件事一次出齊，列印 A4 直接帶進工坊。
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: "📐", title: "三視圖", body: "前 / 側 / 俯三向自動標尺寸" },
              { icon: "🪵", title: "透視圖", body: "3D 可旋轉、可拆解、看內部結構" },
              { icon: "🔧", title: "榫卯細節", body: "每個榫接點放大圖、尺寸標註" },
              { icon: "📊", title: "材料單", body: "每片木料尺寸、台才換算、邊料試算" },
              { icon: "✂️", title: "切割圖", body: "排料最佳化、邊料最少" },
              { icon: "📄", title: "A4 PDF", body: "一鍵列印帶進工坊" },
            ].map((o) => (
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
          實際輸出畫面
        </h2>
        <p className="text-center text-zinc-500 mb-9">
          點下「開始設計」5 分鐘內，你會拿到這些東西。
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            {
              img: "/about-assets/feat-threeview.png",
              label: "工程三視圖",
              desc: "前 / 側 / 俯三向尺寸全自動標註",
            },
            {
              img: "/about-assets/feat-cutplan-full.png",
              label: "排板裁切圖",
              desc: "演算法排料、邊料最少，材料行直接照鋸",
            },
            {
              img: "/about-assets/feat-cutlist.png",
              label: "切料清單",
              desc: "每片木料尺寸、含台才換算、可列印帶進工坊",
            },
            {
              img: "/about-assets/feat-steps.png",
              label: "製作工序",
              desc: "從備料、開料、組裝到塗裝，每步都標時間",
            },
            {
              img: "/about-assets/feat-quote.png",
              label: "客製報價單",
              desc: "板材 × 厚度 × 塗裝 × 工時自動算（專業版）",
            },
            {
              img: "/about-assets/hero-3d.png",
              label: "3D 透視預覽",
              desc: "可旋轉、可拆解、可看內部榫卯結構",
            },
          ].map((s) => (
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
          ※ 以上是實際產品畫面，套到「{entry.nameZh}」會依你的尺寸自動生成
        </p>
      </section>

      {/* ============ 使用情境 ============ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-7">
          什麼時候會用到
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
              {marketing.presets.length} 種預設變體
            </h2>
            <p className="text-zinc-500 mb-7">
              一鍵切換不同風格、不用每次從頭調參數。
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
          常見問題
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

      {/* ============ 相關模板 ============ */}
      {relatedEntries.length > 0 && (
        <section className="bg-stone-50 border-y border-stone-200">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
            <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-7 text-center">
              你可能也想看
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {relatedEntries.map((r) => {
                const rHasDetail = FEATURED_TEMPLATE_CATEGORIES.includes(
                  r.category,
                );
                const rIsFree = FREE_UNLOCKED_CATEGORIES.includes(r.category);
                return (
                  <Link
                    key={r.category}
                    href={rHasDetail ? `/templates/${r.category}` : `/design/${r.category}`}
                    className="group block rounded-2xl bg-white ring-1 ring-stone-200 overflow-hidden hover:ring-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all"
                  >
                    <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-white to-stone-50 relative">
                      {rIsFree && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300 text-emerald-800 text-[10px] font-bold">
                          免費
                        </span>
                      )}
                      <Image
                        src={`/thumbs/v2/${r.category}.webp`}
                        alt={`${r.nameZh} 3D 預覽`}
                        width={240}
                        height={180}
                        quality={75}
                        loading="lazy"
                        sizes="(min-width:640px) 320px, 100vw"
                        className="transition-transform group-hover:scale-[1.06]"
                        style={{ objectFit: "contain", maxHeight: "84%", maxWidth: "84%" }}
                      />
                    </div>
                    <div className="p-3 border-t border-amber-100 bg-amber-50">
                      <div className="font-semibold text-zinc-900 group-hover:text-amber-900">
                        {r.nameZh}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ============ 底部 CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <h2 className="font-serif-tc text-3xl sm:text-4xl font-bold leading-tight">
            開始設計這張 {entry.nameZh}
          </h2>
          <p className="mt-5 text-amber-100 max-w-xl mx-auto leading-relaxed">
            {isFree
              ? "免費模板，不用註冊不用付費，直接開始。"
              : "訂閱個人版 NT$390/月，解鎖全 26 模板＋裝潢工具。"}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={`/design/${entry.category}`}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-amber-800 font-bold shadow-lg hover:-translate-y-0.5 hover:bg-amber-50 transition-all"
            >
              {isFree ? "免費試做 →" : "開始設計 →"}
            </Link>
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white/10 text-white font-semibold ring-1 ring-white/30 hover:bg-white/20 transition-all"
            >
              看其他範本
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
