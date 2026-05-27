import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { routing, type Locale } from "@/i18n/routing";
import { LoginPageClient } from "./LoginPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login.metadata" });
  return { title: t("title"), description: t("description") };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);

  const sp = await searchParams;
  const next = sp.next ?? "/";

  // 已登入 → 直接跳到 next
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }

  const t = await getTranslations({ locale, namespace: "login" });

  return (
    <main className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group">
            <img
              src={locale === "en" ? "/brand-logo-en.png" : "/brand-logo.png"}
              alt={t("brandAlt")}
              width={88}
              height={88}
              className="rounded-2xl shadow-md ring-1 ring-amber-900/15 group-hover:shadow-lg transition-shadow"
            />
            <h1 className="font-serif-tc text-2xl font-bold text-amber-900">
              {t("brandName")}
            </h1>
          </Link>
          <p className="text-sm text-zinc-600 mt-2">{t("subtitle")}</p>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-amber-900/10 p-6 sm:p-8 shadow-lg shadow-amber-900/5">
          <LoginPageClient next={next} />
        </div>
        <p className="text-center text-xs text-zinc-500 mt-6 leading-relaxed">
          {t("footnote")}
          <br />
          {t("helpPrefix")}
          <a
            href="https://lin.ee/EaXGbJ1"
            target="_blank"
            rel="noopener"
            className="text-emerald-700 font-medium hover:underline ml-1"
          >
            {t("lineLabel")}
          </a>
        </p>
      </div>
    </main>
  );
}
