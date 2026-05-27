"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { QuoteAccessGate } from "@/components/QuoteAccessGate";
import { formatTWD } from "@/lib/pricing/catalog";
import type { CustomerSummary } from "@/app/[locale]/customers/page";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CustomersClient({
  initial,
  loggedIn,
}: {
  initial: CustomerSummary[];
  loggedIn: boolean;
}) {
  const t = useTranslations("customersPage");
  if (!loggedIn) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">{t("h1")}</h1>
        <p className="text-zinc-600 text-sm">{t("loginRequired")}</p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        {t("backHome")}
      </Link>
      <QuoteAccessGate>
        <div className="mt-3 mb-2 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">{t("h1")}</h1>
          <Link
            href="/projects"
            className="text-sm text-amber-700 hover:underline"
          >
            {t("seeProjects")}
          </Link>
        </div>
        <p className="text-sm text-zinc-500 mb-6">{t("intro")}</p>

        {initial.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-8 text-center">
            <p className="text-zinc-600 text-sm mb-2">{t("emptyTitle")}</p>
            <p className="text-zinc-500 text-xs">{t("emptySub")}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {initial.map((c) => (
              <li
                key={c.name}
                className="rounded-2xl border-2 border-zinc-200 bg-white hover:border-zinc-300 transition"
              >
                <Link
                  href={`/projects/${c.latestProjectId}`}
                  className="block p-4 sm:p-5"
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1.5">
                    <h2 className="font-semibold text-zinc-900 text-lg">
                      {c.name}
                    </h2>
                    <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                      {t("projectsCountTpl", { n: c.projectCount })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-zinc-600">
                    {c.contact && (
                      <div>
                        <span className="text-zinc-400">{t("contactLbl")}</span>
                        {c.contact}
                      </div>
                    )}
                    {c.address && (
                      <div className="sm:col-span-2 truncate">
                        <span className="text-zinc-400">{t("addressLbl")}</span>
                        {c.address}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-100 flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="text-[11px] text-zinc-400">
                      {t("lastUpdatedTpl", { date: formatDate(c.lastUpdated) })}
                    </p>
                    {c.totalRevenue > 0 && (
                      <p className="text-sm font-mono text-zinc-700">
                        {t("totalLblPre")}<strong>{formatTWD(c.totalRevenue)}</strong>
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QuoteAccessGate>
    </main>
  );
}
