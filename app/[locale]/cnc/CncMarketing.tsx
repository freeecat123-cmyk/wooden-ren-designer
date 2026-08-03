/**
 * /cnc — 訪客 / 無權限銷售頁（雙語 i18n，命名空間 cncMarketing）
 *
 * 渲染條件：未登入 OR 已登入但沒解鎖（訂閱個人版以上 或 單買 cnc）。
 * 有權限者由 page.tsx 直送 <CncClient />（iframe 工具本體）。
 */
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ShareButtons } from "@/components/ShareButtons";

type UserStatus = "guest" | "loggedInNoAccess";

interface Props {
  status: UserStatus;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

type IconItem = { emoji?: string; icon?: string; title: string; body: string };
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
  highlight?: boolean;
};

function TierCard({
  tier,
  href,
}: {
  tier: TierBlock;
  href: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl p-6 ring-1 ${
        tier.highlight
          ? "bg-amber-50 ring-amber-400 shadow-lg shadow-amber-700/10"
          : "bg-white ring-stone-200"
      }`}
    >
      <span
        className={`self-start inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
          tier.highlight
            ? "bg-amber-600 text-white"
            : "bg-stone-100 text-zinc-600 ring-1 ring-stone-300"
        }`}
      >
        {tier.badge}
      </span>
      <h3 className="mt-3 font-serif-tc text-lg font-bold text-zinc-900">
        {tier.title}
      </h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-amber-800">{tier.price}</span>
        <span className="text-sm text-zinc-500">{tier.unit}</span>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-zinc-700 flex-1">
        {tier.features.map((f, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-amber-600 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-6 inline-flex justify-center px-5 py-2.5 rounded-full font-semibold transition-all ${
          tier.highlight
            ? "bg-amber-700 text-white hover:bg-amber-800"
            : "bg-white text-zinc-800 ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800"
        }`}
      >
        {tier.cta}
      </Link>
    </div>
  );
}

export async function CncMarketing({ status }: Props) {
  const t = await getTranslations("cncMarketing");
  const locale = await getLocale();
  const isEn = locale === "en";

  const primaryHref =
    status === "guest" ? "/login?next=/cnc" : "/pricing?upgrade=cnc";
  const primaryLabel =
    status === "guest" ? t("hero.ctaGuest") : t("hero.ctaUpgrade");
  const pageUrl = `${SITE_URL}${isEn ? "/en" : ""}/cnc`;

  const painItems = t.raw("painSection.items") as IconItem[];
  const featureItems = t.raw("featureSection.items") as IconItem[];
  const outputItems = t.raw("outputsSection.items") as IconItem[];
  const audienceItems = t.raw("audienceSection.items") as IconItem[];
  const notForItems = t.raw("audienceSection.notForItems") as string[];
  const scenarioItems = t.raw("scenariosSection.items") as ScenarioItem[];
  const faqItems = t.raw("faqSection.items") as FaqItem[];
  const relatedItems = t.raw("relatedSection.items") as RelatedItem[];
  const tierSingle = t.raw("pricingSection.tierSingle") as TierBlock;
  const tierPersonal = t.raw("pricingSection.tierPersonal") as TierBlock;
  const tierPro = t.raw("pricingSection.tierPro") as TierBlock;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: t("schema.productName"),
    description: t("schema.productDescription"),
    brand: { "@type": "Brand", name: t("schema.brandName") },
    offers: {
      "@type": "Offer",
      price: isEn ? "9.99" : "499",
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
    <main className="bg-white text-zinc-900">
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
                  {t("hero.badge1")}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white ring-1 ring-stone-300 text-zinc-700 text-xs font-bold">
                  {t("hero.badge2")}
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
              <p className="mt-3 text-zinc-600 leading-relaxed">{t("hero.body")}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={primaryHref}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-700 text-white font-semibold shadow-lg shadow-amber-700/30 hover:bg-amber-800 hover:-translate-y-0.5 transition-all"
                >
                  {primaryLabel} →
                </Link>
                <Link
                  href="/pricing?upgrade=cnc"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
                >
                  {t("hero.ctaSecondary")}
                </Link>
              </div>
              <p className="mt-4 text-xs text-zinc-500">{t("hero.footnote")}</p>
              <div className="mt-5">
                <ShareButtons url={pageUrl} title={t("hero.shareTitle")} />
              </div>
            </div>

            {/* 流程示意：SVG/DXF → 排刀路 → G-code */}
            <div className="relative">
              <div className="rounded-3xl bg-white ring-1 ring-stone-200 shadow-xl p-6 sm:p-8">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { k: "diagramLabel1", emoji: "📐" },
                    { k: "diagramLabel2", emoji: "🛠️" },
                    { k: "diagramLabel3", emoji: "📄" },
                  ].map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center text-2xl">
                        {d.emoji}
                      </div>
                      <span className="text-xs font-medium text-zinc-600 leading-tight">
                        {t(`hero.${d.k}`)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-xl bg-zinc-900 p-4 font-mono text-[11px] leading-relaxed text-emerald-300 overflow-hidden">
                  <div className="text-zinc-500">( woodenren cnc | 3-axis CNC )</div>
                  <div>G21 G90 G94</div>
                  <div>M6 T1&nbsp;&nbsp;( 換 6mm 平刀 )</div>
                  <div>M3 S12000</div>
                  <div>G0 X12.500 Y8.000</div>
                  <div>G1 Z-1.500 F300</div>
                  <div className="text-zinc-500">…</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Pain ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-zinc-900">
          {t("painSection.h2")}
        </h2>
        <div className="mt-10 grid sm:grid-cols-3 gap-5">
          {painItems.map((p, i) => (
            <div key={i} className="rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-6">
              <div className="text-3xl">{p.emoji}</div>
              <h3 className="mt-3 font-bold text-zinc-900">{p.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Features ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-zinc-900">
            {t("featureSection.h2")}
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featureItems.map((f, i) => (
              <div key={i} className="rounded-2xl bg-white ring-1 ring-stone-200 p-6">
                <div className="text-2xl">{f.emoji}</div>
                <h3 className="mt-3 font-bold text-zinc-900">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Outputs ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-zinc-900">
          {t("outputsSection.h2")}
        </h2>
        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {outputItems.map((o, i) => (
            <div key={i} className="flex gap-4 rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-6">
              <div className="text-2xl shrink-0">{o.icon}</div>
              <div>
                <h3 className="font-bold text-zinc-900">{o.title}</h3>
                <p className="mt-1 text-sm text-zinc-600 leading-relaxed">{o.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Audience ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-zinc-900">
            {t("audienceSection.h2")}
          </h2>
          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {audienceItems.map((a, i) => (
              <div key={i} className="rounded-2xl bg-white ring-1 ring-stone-200 p-6">
                <div className="text-2xl">{a.emoji}</div>
                <h3 className="mt-3 font-bold text-zinc-900">{a.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{a.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl bg-white ring-1 ring-stone-200 p-6 max-w-2xl mx-auto">
            <h3 className="font-bold text-zinc-700">{t("audienceSection.notForTitle")}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-500">
              {notForItems.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0">·</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ Scenarios ============ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-zinc-900">
          {t("scenariosSection.h2")}
        </h2>
        <div className="mt-10 grid sm:grid-cols-2 gap-5">
          {scenarioItems.map((s, i) => (
            <div key={i} className="rounded-2xl bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-200 p-6">
              <span className="inline-flex px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                {s.tag}
              </span>
              <p className="mt-3 text-sm text-zinc-700 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Pricing ============ */}
      <section className="bg-stone-50 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-zinc-900">
            {t("pricingSection.h2")}
          </h2>
          <p className="mt-3 text-center text-zinc-600">{t("pricingSection.sub")}</p>
          <div className="mt-10 grid md:grid-cols-3 gap-5 items-stretch">
            <TierCard tier={tierSingle} href="/pricing?upgrade=cnc" />
            <TierCard tier={{ ...tierPersonal, highlight: true }} href="/pricing" />
            <TierCard tier={tierPro} href="/pricing" />
          </div>
          <p className="mt-6 text-center text-sm text-zinc-500">
            {t("pricingSection.footnoteText")}
            <Link href="/pricing" className="ml-1 text-amber-700 hover:text-amber-900 underline underline-offset-2">
              {t("pricingSection.footnoteLink")}
            </Link>
          </p>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-zinc-900">
          {t("faqSection.h2")}
        </h2>
        <div className="mt-10 space-y-3">
          {faqItems.map((f, i) => (
            <details key={i} className="group rounded-2xl bg-stone-50 ring-1 ring-stone-200 p-5">
              <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold text-zinc-800 list-none">
                {f.q}
                <span className="text-amber-700 text-sm shrink-0 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ============ Related ============ */}
      <section className="bg-stone-50 border-t border-stone-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold text-center text-zinc-900">
            {t("relatedSection.h2")}
          </h2>
          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {relatedItems.map((r, i) => (
              <Link
                key={i}
                href={r.href}
                className="group rounded-2xl bg-white ring-1 ring-stone-200 p-6 hover:ring-amber-400 hover:-translate-y-0.5 transition-all"
              >
                <div className="text-2xl">{r.emoji}</div>
                <h3 className="mt-3 font-bold text-zinc-900 group-hover:text-amber-800">{r.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{r.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Final CTA ============ */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-16 text-center">
          <h2 className="font-serif-tc text-2xl sm:text-3xl font-bold">{t("finalCta.h2")}</h2>
          <p className="mt-3 text-amber-100 leading-relaxed">{t("finalCta.body")}</p>
          <Link
            href={primaryHref}
            className="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full bg-white text-amber-800 font-bold shadow-lg hover:-translate-y-0.5 transition-all"
          >
            {t("finalCta.cta")} →
          </Link>
        </div>
      </section>
    </main>
  );
}
