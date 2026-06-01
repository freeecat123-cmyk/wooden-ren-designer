/**
 * /ceiling — 訪客銷售頁(雙語 i18n)
 *
 * 渲染條件:未登入 OR 已登入但沒解鎖。
 * 已登入有權限者由 page.tsx 直送 <CeilingDevClient />。
 */
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShareButtons } from "@/components/ShareButtons";

type UserStatus = "guest" | "loggedInNoAccess";

interface Props {
  status: UserStatus;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

type PainItem = { emoji: string; title: string; body: string };
type FeatureItem = { emoji: string; title: string; body: string };
type ParamItem = { label: string; desc: string };
type OutputItem = { icon: string; title: string; body: string };
type ShowcaseItem = { img: string; label: string; desc: string };
type AudienceItem = { emoji: string; title: string; body: string };
type ScenarioItem = { tag: string; body: string };
type FaqItem = { q: string; a: string };
type RelatedItem = { href: string; emoji: string; title: string; body: string };
type TierBlock = {
  badge: string;
  title: string;
  price: string;
  unit: string;
  features: string[];
  cta: string;
};

export async function CeilingMarketing({ status }: Props) {
  const t = await getTranslations("ceilingMarketing");
  const locale = await getLocale();
  const isEn = locale === "en";

  const primaryHref =
    status === "guest" ? "/login?next=/ceiling" : "/pricing?upgrade=ceiling";
  const primaryLabel =
    status === "guest" ? t("hero.ctaGuest") : t("hero.ctaUpgrade");
  const pageUrl = `${SITE_URL}/ceiling`;

  const painItems = t.raw("painSection.items") as PainItem[];
  const featureItems = t.raw("featureSection.items") as FeatureItem[];
  const paramItems = t.raw("paramsSection.items") as ParamItem[];
  const outputItems = t.raw("outputsSection.items") as OutputItem[];
  const showcaseItems = t.raw("showcaseSection.items") as ShowcaseItem[];
  const audienceItems = t.raw("audienceSection.items") as AudienceItem[];
  const notForItems = t.raw("audienceSection.notForItems") as string[];
  const scenarioItems = t.raw("scenariosSection.items") as ScenarioItem[];
  const faqItems = t.raw("faqSection.items") as FaqItem[];
  const relatedItems = t.raw("relatedSection.items") as RelatedItem[];
  const tierSingle = t.raw("pricingSection.tierSingle") as TierBlock;
  const tierPersonal = t.raw("pricingSection.tierPersonal") as TierBlock;
  const tierPro = t.raw("pricingSection.tierPro") as TierBlock;

  // JSON-LD 價格鎖 locale，對齊實際付款系統（ZH→ECPay TWD、EN→LemonSqueezy USD）。
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: t("schema.productName"),
    description: t("schema.productDescription"),
    image: `${SITE_URL}/thumbs/v2/ceiling.webp`,
    brand: { "@type": "Brand", name: t("schema.brandName") },
    offers: {
      "@type": "Offer",
      price: isEn ? "9" : "390",
      priceCurrency: isEn ? "USD" : "TWD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}${isEn ? "/en" : ""}/pricing`,
    },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("schema.breadcrumbHome"), item: SITE_URL },
      { "@type": "ListItem", position: 2, name: t("schema.breadcrumbTemplates"), item: `${SITE_URL}/templates` },
      { "@type": "ListItem", position: 3, name: t("schema.breadcrumbCurrent"), item: pageUrl },
    ],
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="bg-white">
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
        <Link href="/" className="hover:text-amber-700">{t("breadcrumb.home")}</Link>
        <span className="mx-2">/</span>
        <Link href="/templates" className="hover:text-amber-700">{t("breadcrumb.templates")}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 font-medium">{t("breadcrumb.current")}</span>
      </nav>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-stone-100 border-b border-stone-200">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-200/40 blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-20">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-900 text-xs font-bold">
                  {t("hero.badgeInterior")}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white ring-1 ring-stone-300 text-zinc-700 text-xs font-bold">
                  {t("hero.badgePlan")}
                </span>
              </div>
              <h1 className="font-serif-tc text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 leading-[1.15]">
                {t("hero.h1")}
              </h1>
              <p className="mt-4 text-xl text-amber-800 font-semibold leading-relaxed">
                {t("hero.leadLine1")}
                <br className="hidden sm:inline" />
                {t("hero.leadLine2")}
              </p>
              <p className="mt-3 text-zinc-600 leading-relaxed">
                {t("hero.body")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={primaryHref}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-700 text-white font-semibold shadow-lg shadow-amber-700/30 hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  {primaryLabel} →
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
                >
                  {t("hero.ctaSecondary")}
                </Link>
              </div>
              <p className="mt-4 text-xs text-zinc-500">
                {t("hero.footnote")}
              </p>
              <div className="mt-5">
                <ShareButtons url={pageUrl} title={t("hero.shareTitle")} />
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-amber-200 shadow-2xl overflow-hidden p-8">
                <div className="aspect-[5/4] flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 rounded-2xl">
                  <svg
                    viewBox="0 0 200 160"
                    className="w-[88%] h-[88%]"
                    aria-label={t("hero.diagramAria")}
                  >
                    {/* slab */}
                    <rect x={10} y={10} width={180} height={10} fill="#999" />
                    {/* hangers */}
                    {[40, 80, 120, 160].map((x) => (
                      <line key={x} x1={x} y1={20} x2={x} y2={58} stroke="#666" strokeWidth={2} />
                    ))}
                    {/* main batten */}
                    <rect x={20} y={56} width={160} height={6} fill="#bd9955" />
                    {/* sub battens */}
                    {[30, 60, 90, 120, 150, 180].map((x) => (
                      <rect key={x} x={x - 3} y={62} width={6} height={6} fill="#a67d3f" />
                    ))}
                    {/* fiber-cement board */}
                    <rect x={14} y={68} width={172} height={6} fill="#e7d8ae" stroke="#bd9955" strokeWidth={1.2} />
                    {/* seams */}
                    {[60, 120].map((x) => (
                      <line key={x} x1={x} y1={68} x2={x} y2={74} stroke="#fff" strokeWidth={1.2} />
                    ))}
                    {/* labels */}
                    <text x={100} y={90} textAnchor="middle" fontSize={9} fill="#666" fontFamily="sans-serif">{t("hero.diagramLabel1")}</text>
                    <text x={100} y={104} textAnchor="middle" fontSize={9} fill="#999" fontFamily="sans-serif">{t("hero.diagramLabel2")}</text>
                    {/* room plan hint */}
                    <rect x={28} y={118} width={144} height={30} rx={2} fill="none" stroke="#bd9955" strokeWidth={1.2} strokeDasharray="3 2" />
                    <text x={100} y={138} textAnchor="middle" fontSize={9} fill="#bd9955" fontFamily="sans-serif">{t("hero.diagramLabel3")}</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ pain points ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-3">
            {t("painSection.h2")}
          </h2>
          <p className="text-center text-zinc-500 mb-10">
            {t("painSection.sub")}
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {painItems.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-6 hover:ring-amber-400 hover:bg-amber-50/40 transition-all"
              >
                <div className="text-3xl mb-2">{p.emoji}</div>
                <div className="font-bold text-zinc-900 mb-1.5">{p.title}</div>
                <div className="text-sm text-zinc-600 leading-relaxed">{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ features ============ */}
      <section className="bg-gradient-to-b from-stone-50 to-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-3">
            {t("featureSection.h2")}
          </h2>
          <p className="text-center text-zinc-500 mb-10">
            {t("featureSection.sub")}
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featureItems.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 shadow-sm hover:shadow-lg hover:ring-amber-400 hover:-translate-y-0.5 transition-all"
              >
                <div className="text-3xl mb-2">{f.emoji}</div>
                <div className="font-bold text-zinc-900 mb-1.5">{f.title}</div>
                <div className="text-sm text-zinc-600 leading-relaxed">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ params ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
            {t("paramsSection.h2")}
          </h2>
          <p className="text-zinc-500 mb-7">
            {t("paramsSection.sub")}
          </p>
          <div className="space-y-3">
            {paramItems.map((p) => (
              <div
                key={p.label}
                className="rounded-xl bg-stone-50 ring-1 ring-stone-200 p-5 hover:ring-amber-300 transition-colors"
              >
                <div className="font-bold text-zinc-900 mb-1">{p.label}</div>
                <div className="text-sm text-zinc-600 leading-relaxed">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ outputs ============ */}
      <section className="bg-gradient-to-b from-white to-amber-50/30 border-b border-amber-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-3">
            {t("outputsSection.h2")}
          </h2>
          <p className="text-zinc-500 mb-7">
            {t("outputsSection.sub")}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {outputItems.map((o) => (
              <div key={o.title} className="rounded-xl bg-white ring-1 ring-stone-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">{o.icon}</div>
                  <div>
                    <div className="font-bold text-zinc-900 mb-0.5">{o.title}</div>
                    <div className="text-xs text-zinc-600 leading-relaxed">{o.body}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ showcase ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
            {t("showcaseSection.h2")}
          </h2>
          <p className="text-center text-zinc-500 mb-9">
            {t("showcaseSection.sub")}
          </p>
          <div className="grid md:grid-cols-2 gap-5">
            {showcaseItems.map((s) => (
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
                  <div className="font-bold text-zinc-900 mb-0.5">{s.label}</div>
                  <div className="text-xs text-zinc-600 leading-relaxed">{s.desc}</div>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-400">
            {t("showcaseSection.footnote")}
          </p>
        </div>
      </section>

      {/* ============ audience ============ */}
      <section className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-10">
            {t("audienceSection.h2")}
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {audienceItems.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl bg-white ring-1 ring-stone-200 p-6 flex gap-4 items-start"
              >
                <div className="text-3xl shrink-0">{p.emoji}</div>
                <div>
                  <div className="font-bold text-zinc-900 mb-1">{p.title}</div>
                  <div className="text-sm text-zinc-600 leading-relaxed">{p.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-white ring-1 ring-stone-200 p-6">
            <div className="font-semibold text-zinc-900 mb-2">
              {t("audienceSection.notForTitle")}
            </div>
            <ul className="text-sm text-zinc-600 space-y-1.5 list-disc pl-5">
              {notForItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ scenarios ============ */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-7">
            {t("scenariosSection.h2")}
          </h2>
          <div className="space-y-3">
            {scenarioItems.map((s) => (
              <div key={s.tag} className="rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-800 text-xs font-bold mb-3">
                  {s.tag}
                </div>
                <p className="text-zinc-700 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 mb-8 text-center">
            {t("faqSection.h2")}
          </h2>
          <div className="space-y-3">
            {faqItems.map((f) => (
              <details
                key={f.q}
                className="rounded-xl bg-white ring-1 ring-stone-200 hover:ring-amber-300 transition-all group"
              >
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 text-zinc-900 font-semibold">
                  <span>{f.q}</span>
                  <span className="text-amber-700 text-sm shrink-0 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <div className="px-5 pb-4 -mt-1 text-sm text-zinc-600 leading-relaxed">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ pricing tiers ============ */}
      <section className="bg-gradient-to-b from-amber-50/30 to-white border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
            {t("pricingSection.h2")}
          </h2>
          <p className="text-center text-zinc-500 text-sm mb-9">
            {t("pricingSection.sub")}
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <PricingTier
              badge={tierSingle.badge}
              title={tierSingle.title}
              price={tierSingle.price}
              unit={tierSingle.unit}
              features={tierSingle.features}
              cta={{ label: tierSingle.cta, href: "/pricing?upgrade=ceiling" }}
            />
            <PricingTier
              badge={tierPersonal.badge}
              title={tierPersonal.title}
              price={tierPersonal.price}
              unit={tierPersonal.unit}
              features={tierPersonal.features}
              cta={{ label: tierPersonal.cta, href: "/pricing" }}
              highlight
            />
            <PricingTier
              badge={tierPro.badge}
              title={tierPro.title}
              price={tierPro.price}
              unit={tierPro.unit}
              features={tierPro.features}
              cta={{ label: tierPro.cta, href: "/pricing" }}
            />
          </div>
          <p className="mt-6 text-center text-xs text-zinc-500">
            {t("pricingSection.footnoteText")}
            <Link href="/pricing" className="ml-1 text-amber-700 hover:text-amber-900 underline underline-offset-2">
              {t("pricingSection.footnoteLink")}
            </Link>
          </p>
        </div>
      </section>

      {/* ============ related tools ============ */}
      <section className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-zinc-900 text-center mb-2">
            {t("relatedSection.h2")}
          </h2>
          <p className="text-center text-zinc-500 text-sm mb-9">
            {t("relatedSection.sub")}
          </p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {relatedItems.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="group flex flex-col rounded-2xl bg-white ring-1 ring-stone-200 p-6 hover:ring-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="text-3xl mb-3">{r.emoji}</div>
                <div className="font-bold text-zinc-900 group-hover:text-amber-900 mb-1.5">
                  {r.title}
                </div>
                <p className="text-xs text-zinc-600 leading-snug">{r.body}</p>
                <div className="mt-3 text-xs font-semibold text-amber-700 group-hover:text-amber-900 inline-flex items-center gap-1">
                  {t("relatedSection.cta")}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ final CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 via-amber-800 to-stone-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20 text-center">
          <h2 className="font-serif-tc text-2xl sm:text-4xl font-bold mb-4">
            {t("finalCta.h2")}
          </h2>
          <p className="text-amber-100 text-base sm:text-lg mb-8 leading-relaxed">
            {t("finalCta.bodyLine1")}
            <br />
            {t("finalCta.bodyLine2")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-amber-900 font-bold shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all"
            >
              {primaryLabel} →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white/10 text-white font-semibold ring-1 ring-white/30 hover:bg-white/20 transition-all"
            >
              {t("finalCta.ctaSecondary")}
            </Link>
          </div>
          <p className="mt-6 text-sm text-amber-200/80">
            {t("finalCta.footnote")}
          </p>
        </div>
      </section>
    </main>
  );
}

function PricingTier({
  badge,
  title,
  price,
  unit,
  features,
  cta,
  highlight = false,
}: {
  badge: string;
  title: string;
  price: string;
  unit: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
}) {
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
          highlight ? "bg-amber-700 text-white" : "bg-zinc-700 text-white"
        }`}
      >
        {badge}
      </div>
      <h3 className="font-bold text-zinc-900 mb-2 mt-1">{title}</h3>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold text-zinc-900 tabular-nums">{price}</span>
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
      <Link
        href={cta.href}
        className={`block w-full text-center px-3 py-2 rounded-full font-semibold text-xs transition-all ${
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
