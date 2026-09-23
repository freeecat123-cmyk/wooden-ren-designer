import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reason?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "authError" });
  return {
    title: t("metaTitle"),
    robots: { index: false },
  };
}

type Reason = "expired" | "used" | "missing" | "unknown";

export default async function AuthErrorPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "authError" });
  const sp = await searchParams;
  const validReasons: Reason[] = ["expired", "used", "missing", "unknown"];
  const reason: Reason = (sp.reason && (validReasons as string[]).includes(sp.reason)
    ? (sp.reason as Reason)
    : "unknown");

  const title = t(`${reason}Title` as const);
  const body = t(`${reason}Body` as const);
  // 只有部分 reason 有 hint
  const hint = reason === "missing" ? "" : t(`${reason}Hint` as const);

  return (
    <main className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-6 sm:p-8">
        <div className="text-3xl mb-3">🔐</div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-2">
          {title}
        </h1>
        <p className="text-sm text-zinc-700 leading-relaxed">{body}</p>
        {hint && (
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{hint}</p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Link
            href="/login"
            className="flex-1 inline-block text-center px-4 py-2.5 rounded-lg font-medium text-sm bg-amber-700 text-white hover:bg-amber-800 transition-colors"
          >
            {t("btnRelogin")}
          </Link>
          <Link
            href="/"
            className="flex-1 inline-block text-center px-4 py-2.5 rounded-lg font-medium text-sm bg-white text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 transition-colors"
          >
            {t("btnHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
