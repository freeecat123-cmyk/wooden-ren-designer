import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { bilingualAlternates } from "@/i18n/metadata";
import { routing, type Locale } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";
const LINE_OA_URL = "https://lin.ee/EaXGbJ1";
const SUPPORT_EMAIL = "wengbinren@gmail.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "help.metadata" });
  const alt = bilingualAlternates("/help", locale);
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

// 共用的 rich-text tag handlers — t.rich 需要 ReactNode 工廠
function richTags() {
  return {
    b: (chunks: ReactNode) => <strong>{chunks}</strong>,
    br: () => <br />,
    linkLogin: (chunks: ReactNode) => (
      <Link href="/login" className="underline">{chunks}</Link>
    ),
    linkSub: (chunks: ReactNode) => (
      <Link href="/my-subscription" className="underline">{chunks}</Link>
    ),
    linkPricing: (chunks: ReactNode) => (
      <Link href="/pricing" className="underline">{chunks}</Link>
    ),
    linkDesigns: (chunks: ReactNode) => (
      <Link href="/account/designs" className="underline">{chunks}</Link>
    ),
    linkRefund: (chunks: ReactNode) => (
      <Link href="/refund" className="underline">{chunks}</Link>
    ),
    linkEmail: (chunks: ReactNode) => (
      <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{chunks}</a>
    ),
  };
}

// 把 rich-text message 抽純文字（給 FAQ JSON-LD 用）。
// 簡單版：把所有 tag stripping 掉，保留 chunks 內容。
function stripTags(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function HelpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "help" });

  // FAQPage JSON-LD — 每個 Q&A 取原始 message string，strip tags → plain text
  // 結構性的 list 題目（billing.q2, refundSec.q1, refundSec.q2）特別處理
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { q: t("account.q1Q"), a: stripTags(t.raw("account.q1A") as string) },
      { q: t("account.q2Q"), a: stripTags(t.raw("account.q2A") as string) },
      { q: t("billing.q1Q"), a: stripTags(t.raw("billing.q1A") as string) },
      {
        q: t("billing.q2Q"),
        a: [
          t("billing.q2Intro"),
          t("billing.q2Step1"),
          t("billing.q2Step2"),
          t("billing.q2Step3"),
        ].join(" / "),
      },
      { q: t("billing.q3Q"), a: stripTags(t.raw("billing.q3A") as string) },
      { q: t("billing.q4Q"), a: stripTags(t.raw("billing.q4A") as string) },
      { q: t("invoice.q1Q"), a: stripTags(t.raw("invoice.q1A") as string) },
      { q: t("invoice.q2Q"), a: stripTags(t.raw("invoice.q2A") as string) },
      { q: t("invoice.q3Q"), a: stripTags(t.raw("invoice.q3A") as string) },
      { q: t("design.q1Q"), a: stripTags(t.raw("design.q1A") as string) },
      { q: t("design.q2Q"), a: stripTags(t.raw("design.q2A") as string) },
      { q: t("design.q3Q"), a: stripTags(t.raw("design.q3A") as string) },
      { q: t("pwa.q1Q"), a: stripTags(t.raw("pwa.q1A") as string) },
      {
        q: t("refundSec.q1Q"),
        a: [
          stripTags(t.raw("refundSec.q1Intro") as string),
          stripTags(t.raw("refundSec.q1ListIntro") as string),
          stripTags(t.raw("refundSec.q1Case1") as string),
          stripTags(t.raw("refundSec.q1Case2") as string),
          stripTags(t.raw("refundSec.q1Case3") as string),
          stripTags(t.raw("refundSec.q1Outro") as string),
        ].join(" "),
      },
      {
        q: t("refundSec.q2Q"),
        a: [
          t("refundSec.q2Intro"),
          stripTags(t.raw("refundSec.q2Tip1") as string),
          stripTags(t.raw("refundSec.q2Tip2") as string),
          stripTags(t.raw("refundSec.q2Tip3") as string),
        ].join(" "),
      },
    ].map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const tags = richTags();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 leading-relaxed text-zinc-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <header className="rounded-2xl bg-white ring-1 ring-amber-900/10 shadow-sm px-6 py-7">
        <h1 className="font-serif-tc text-3xl font-bold tracking-tight text-amber-950">
          {t("h1")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          {t("introPrefix")}
          <a
            className="text-amber-800 font-medium hover:underline mx-1"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          {t("introOr")}
          <a
            className="text-emerald-700 font-medium hover:underline mx-1"
            href={LINE_OA_URL}
            target="_blank"
            rel="noopener"
          >
            {t("lineOaLabel")}
          </a>
        </p>
      </header>

      {/* 帳號與登入 */}
      <Section emoji="🔑" title={t("account.title")}>
        <Qa q={t("account.q1Q")}>{t.rich("account.q1A", tags)}</Qa>
        <Qa q={t("account.q2Q")}>{t.rich("account.q2A", tags)}</Qa>
      </Section>

      {/* 訂閱與付款 */}
      <Section emoji="💳" title={t("billing.title")}>
        <Qa q={t("billing.q1Q")}>{t.rich("billing.q1A", tags)}</Qa>
        <Qa q={t("billing.q2Q")}>
          {t("billing.q2Intro")}
          <ol className="ml-5 list-decimal space-y-1 mt-2">
            <li>{t("billing.q2Step1")}</li>
            <li>{t("billing.q2Step2")}</li>
            <li>{t("billing.q2Step3")}</li>
          </ol>
        </Qa>
        <Qa q={t("billing.q3Q")}>{t.rich("billing.q3A", tags)}</Qa>
        <Qa q={t("billing.q4Q")}>{t.rich("billing.q4A", tags)}</Qa>
      </Section>

      {/* 電子發票 */}
      <Section emoji="🧾" title={t("invoice.title")}>
        <Qa q={t("invoice.q1Q")}>{t.rich("invoice.q1A", tags)}</Qa>
        <Qa q={t("invoice.q2Q")}>{t.rich("invoice.q2A", tags)}</Qa>
        <Qa q={t("invoice.q3Q")}>{t.rich("invoice.q3A", tags)}</Qa>
      </Section>

      {/* 設計與使用 */}
      <Section emoji="🪑" title={t("design.title")}>
        <Qa q={t("design.q1Q")}>{t.rich("design.q1A", tags)}</Qa>
        <Qa q={t("design.q2Q")}>{t.rich("design.q2A", tags)}</Qa>
        <Qa q={t("design.q3Q")}>{t.rich("design.q3A", tags)}</Qa>
      </Section>

      {/* 桌面 App 安裝 */}
      <Section emoji="📲" title={t("pwa.title")}>
        <Qa q={t("pwa.q1Q")}>{t.rich("pwa.q1A", tags)}</Qa>
      </Section>

      {/* 退費 */}
      <Section emoji="↩️" title={t("refundSec.title")}>
        <Qa q={t("refundSec.q1Q")}>
          {t.rich("refundSec.q1Intro", tags)}
          <br />
          <br />
          {t.rich("refundSec.q1ListIntro", tags)}
          <ul className="ml-5 list-disc space-y-1 mt-2">
            <li>{t.rich("refundSec.q1Case1", tags)}</li>
            <li>{t.rich("refundSec.q1Case2", tags)}</li>
            <li>{t.rich("refundSec.q1Case3", tags)}</li>
          </ul>
          <p className="mt-3">{t.rich("refundSec.q1Outro", tags)}</p>
        </Qa>
        <Qa q={t("refundSec.q2Q")}>
          {t("refundSec.q2Intro")}
          <ul className="ml-5 list-disc space-y-1 mt-2">
            <li>{t.rich("refundSec.q2Tip1", tags)}</li>
            <li>{t.rich("refundSec.q2Tip2", tags)}</li>
            <li>{t.rich("refundSec.q2Tip3", tags)}</li>
          </ul>
        </Qa>
      </Section>

      <section className="mt-12 rounded-2xl bg-amber-100/70 ring-1 ring-amber-400/40 p-6">
        <h2 className="font-serif-tc text-lg font-bold text-amber-950">
          {t("stillStuckH2")}
        </h2>
        <p className="text-sm text-amber-900 mt-2 leading-relaxed">
          {t("stillStuckBody")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5 text-sm">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-700 px-4 py-2 text-white font-semibold shadow-sm hover:bg-amber-800 hover:shadow active:scale-[0.98] transition-all"
          >
            {t("stillStuckEmail")}
          </a>
          <a
            href={LINE_OA_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-amber-800 font-semibold ring-1 ring-amber-300 hover:bg-amber-50 active:scale-[0.98] transition-all"
          >
            {t("stillStuckLine")}
          </a>
        </div>
      </section>

      <p className="mt-8 text-xs text-zinc-500 text-center">
        {t("footerLinksIntro")}
        <Link href="/" className="text-amber-800 hover:underline mx-1">
          {t("linkHome")}
        </Link>
        ·
        <Link href="/pricing" className="text-amber-800 hover:underline mx-1">
          {t("linkPricing")}
        </Link>
        ·
        <Link href="/my-subscription" className="text-amber-800 hover:underline mx-1">
          {t("linkSubscription")}
        </Link>
        ·
        <Link href="/refund" className="text-amber-800 hover:underline mx-1">
          {t("linkRefund")}
        </Link>
        ·
        <Link href="/privacy" className="text-amber-800 hover:underline mx-1">
          {t("linkPrivacy")}
        </Link>
        ·
        <Link href="/terms" className="text-amber-800 hover:underline mx-1">
          {t("linkTerms")}
        </Link>
      </p>
      <p className="mt-2 text-xs text-zinc-400 text-center">
        {SITE_URL.replace(/^https?:\/\//, "")}
      </p>
    </main>
  );
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-serif-tc text-xl font-bold text-amber-950 flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-base"
        >
          {emoji}
        </span>
        <span>{title}</span>
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Qa({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl ring-1 ring-amber-900/10 bg-white overflow-hidden transition-shadow hover:shadow-sm open:shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-semibold text-zinc-800 hover:bg-amber-50/70 flex items-center justify-between gap-3 transition-colors">
        <span>{q}</span>
        <span
          aria-hidden
          className="text-amber-700 shrink-0 transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-amber-900/10 px-4 py-3.5 text-sm text-zinc-700 leading-7 bg-amber-50/40">
        {children}
      </div>
    </details>
  );
}
