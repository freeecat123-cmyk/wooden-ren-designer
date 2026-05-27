import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PricingClient } from "@/components/PricingClient";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (locale !== routing.defaultLocale) {
    const t = await getTranslations({ locale, namespace: "pricingStub.metadata" });
    return {
      title: t("title"),
      description: t("description"),
      alternates: { canonical: `/${locale}/pricing` },
    };
  }

  return {
    title: "方案與訂閱｜木頭仁 木作藍圖",
    description:
      "個人 390、專業 890、學員 2 年免費。月付 / 年付兩種選擇，從免費試用到接案專業版。木頭仁木匠學院出品。",
    alternates: { canonical: "/pricing" },
    openGraph: {
      title: "方案與訂閱｜木頭仁 木作藍圖",
      description:
        "個人 390、專業 890、學員 2 年免費。月付 / 年付兩種選擇，從免費試用到接案專業版。",
      url: "/pricing",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);

  // 中文版：原 PricingClient（含 ECPay 完整金流流程）
  if (locale === routing.defaultLocale) {
    return <PricingClient />;
  }

  // 非中文版：USD 金流（LemonSqueezy）尚未串接，顯示 stub「等候名單」訊息
  // Phase 4 完成後會替換成真正的 LemonSqueezy 訂閱介面。
  const t = await getTranslations({ locale, namespace: "pricingStub" });

  return (
    <main className="min-h-[calc(100vh-120px)] mx-auto max-w-2xl px-6 py-16 text-zinc-800">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 ring-1 ring-amber-300 text-amber-800 text-xs font-semibold mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {t("badge")}
      </div>
      <h1 className="font-serif-tc text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 leading-tight">
        {t("h1")}
      </h1>
      <p className="mt-5 text-zinc-700 leading-relaxed">{t("intro")}</p>
      <p className="mt-3 text-zinc-700 leading-relaxed">{t("intro2")}</p>

      <div className="mt-10 rounded-2xl bg-amber-50/60 ring-1 ring-amber-200 p-6 sm:p-7">
        <div className="text-amber-900 font-semibold mb-2">{t("highlights")}</div>
        <div className="font-bold text-zinc-900 mb-3">{t("h1Free")}</div>
        <ul className="space-y-2 text-sm text-zinc-700">
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{t("f1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{t("f2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{t("f3")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
            <span>{t("f4")}</span>
          </li>
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 transition-colors"
        >
          {t("ctaTryFree")}
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center px-6 py-3 rounded-lg bg-white text-zinc-800 font-semibold ring-1 ring-stone-300 hover:ring-amber-500 hover:text-amber-800 transition-all"
        >
          {t("ctaContact")}
        </Link>
      </div>

      <p className="mt-10 text-sm text-zinc-500 leading-relaxed border-t border-zinc-200 pt-6">
        {t.rich("tw", {
          link: (chunks) => (
            <a href="/pricing" className="underline hover:text-amber-800">
              {chunks}
            </a>
          ),
        })}
      </p>
    </main>
  );
}
