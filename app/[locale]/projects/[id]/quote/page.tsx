import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatTWD } from "@/lib/pricing/catalog";
import { getTemplate } from "@/lib/templates";
import { MATERIALS } from "@/lib/materials";
import {
  OwnerBrandedHeader,
  OwnerContactBlock,
} from "@/components/projects/OwnerBrandedHeader";
import { ContactCraftsmanCTA } from "@/components/projects/ContactCraftsmanCTA";
import { MessageThread } from "@/components/projects/MessageThread";
import { ExpiryBanner } from "@/components/projects/ExpiryBanner";
import { PrintButton } from "@/components/print/PrintButton";
import { CopyShareLinkButton } from "@/components/projects/CopyShareLinkButton";
import { ProjectQuoteShareActions } from "@/components/projects/ProjectQuoteShareActions";
import { CompactThreeViews } from "@/lib/render/svg-views";
import { QuoteAccessGate } from "@/components/QuoteAccessGate";
import {
  type ProjectItemRow,
} from "@/lib/projects/types";
import type { FurnitureCategory } from "@/lib/types";
import { fetchProjectQuoteData } from "@/lib/projects/fetch-quote-data";
import { rebuildDesignFromItem } from "@/lib/projects/rebuild-design";
import { projectQuoteNumber } from "@/lib/projects/quote-number";
import { taipeiIsoDate } from "@/lib/utils/date-tw";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ token?: string }>;
}

function categoryLabel(type: string): string {
  const slug = type.replace(/_/g, "-") as FurnitureCategory;
  return getTemplate(slug)?.nameZh ?? type;
}

function dimensionLabel(item: ProjectItemRow, dash: string): string {
  const p = item.params as Record<string, unknown>;
  if ([p.length, p.width, p.height].every((v) => typeof v === "number")) {
    return `${p.length}×${p.width}×${p.height} mm`;
  }
  return dash;
}

function materialLabel(item: ProjectItemRow, dash: string): string {
  const p = item.params as Record<string, unknown>;
  const key = typeof p.material === "string" ? p.material : "";
  return key
    ? (MATERIALS as Record<string, { nameZh: string }>)[key]?.nameZh ?? key
    : dash;
}

export default async function ProjectQuotePage({
  params,
  searchParams,
}: PageProps) {
  const { locale, id } = await params;
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "projectQuote" });
  const tStatus = await getTranslations({ locale, namespace: "projectDetailClient.projectStatus" });
  const data = await fetchProjectQuoteData(id, token ?? null);
  if (!data) notFound();

  const { project: p, items: list, branding, messages, publicAccess } = data;
  const dash = t("dash");

  let subtotal = 0;
  let count = 0;
  for (const it of list) {
    const unit = it.unit_price_override ?? 0;
    subtotal += unit * it.quantity;
    count += it.quantity;
  }
  const deposit = Math.round(subtotal * p.deposit_rate);
  const balance = subtotal - deposit;

  const ungroupedLabel = t("ungrouped");
  const grouped = (() => {
    const map = new Map<string, ProjectItemRow[]>();
    for (const it of list) {
      const room = it.room?.trim() || ungroupedLabel;
      const arr = map.get(room) ?? [];
      arr.push(it);
      map.set(room, arr);
    }
    return [...map.entries()];
  })();

  const today = new Date();
  const todayIso = taipeiIsoDate(today);
  const quoteNo = projectQuoteNumber(id, today);
  const filename = t("filenameTpl", {
    name: p.customer_name || p.name,
    no: quoteNo,
  });
  const printHref = `/projects/${id}/quote/print${token ? `?token=${token}` : ""}`;

  const body = (
    <>
      <div className="flex items-baseline justify-between mb-4 print:hidden">
        {publicAccess ? (
          <span className="text-xs text-zinc-400">{t("customerView")}</span>
        ) : (
          <Link
            href={`/projects/${id}`}
            className="text-sm text-zinc-500 hover:underline"
          >
            {t("backToEdit")}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!publicAccess && <CopyShareLinkButton projectId={id} />}
          <ProjectQuoteShareActions
            projectId={id}
            quoteNo={quoteNo}
            customerName={p.customer_name ?? null}
            projectName={p.name}
            total={subtotal}
            token={publicAccess ? token ?? null : null}
          />
          <Link
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            {t("printPageBtn")}
          </Link>
          <PrintButton suggestedFilename={filename} />
        </div>
      </div>

      <ExpiryBanner expiresAt={p.expires_at} publicAccess={publicAccess} />

      <article className="rounded-2xl border-2 border-zinc-200 bg-white p-6 sm:p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 pb-5 border-b border-zinc-200 mb-5">
          <div className="space-y-2">
            <OwnerBrandedHeader branding={branding} />
            <OwnerContactBlock branding={branding} />
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p className="font-mono text-zinc-700">{quoteNo}</p>
            <p className="mt-0.5">{t("quoteDateLbl", { date: todayIso })}</p>
            {!publicAccess && (
              <p className="mt-0.5">
                {t("statusLbl", { label: tStatus(p.status) })}
              </p>
            )}
          </div>
        </header>

        <section className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">{p.name}</h1>
          {p.design_concept && (
            <p className="mt-1 text-sm text-zinc-600 italic">
              {t("designConceptQuote", { text: p.design_concept })}
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <dt className="text-zinc-500">{t("fieldCustomer")}</dt>
              <dd className="text-zinc-900 mt-0.5">{p.customer_name || dash}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{t("fieldContact")}</dt>
              <dd className="text-zinc-900 mt-0.5">
                {p.customer_contact || dash}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-zinc-500">{t("fieldAddress")}</dt>
              <dd className="text-zinc-900 mt-0.5">
                {p.project_address || dash}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mb-6">
          {grouped.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
              {t("noItems")}
            </div>
          )}
          {grouped.map(([room, roomItems]) => (
            <div key={room} className="mb-6">
              <h2 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2 border-b border-zinc-200 pb-1.5">
                <span>📐</span>
                <span>{room}</span>
                <span className="text-xs text-zinc-400 font-normal">
                  {t("roomCountTpl", { n: roomItems.length })}
                </span>
              </h2>
              <div className="space-y-4">
                {roomItems.map((it) => {
                  const unit = it.unit_price_override ?? 0;
                  const lineTotal = unit * it.quantity;
                  const design = rebuildDesignFromItem(it);
                  return (
                    <div
                      key={it.id}
                      className="rounded-lg border border-zinc-200 p-3 sm:p-4"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-900">
                            {it.name}
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {categoryLabel(it.furniture_type)} ·{" "}
                            {dimensionLabel(it, dash)} ·{" "}
                            {materialLabel(it, dash)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-zinc-500">
                            {it.quantity > 1 && (
                              <span>
                                {t("lineUnitTimesQtyTpl", {
                                  price: formatTWD(unit),
                                  qty: it.quantity,
                                })}
                              </span>
                            )}
                          </div>
                          <div className="text-lg font-mono font-bold text-zinc-900">
                            {lineTotal > 0 ? formatTWD(lineTotal) : dash}
                          </div>
                        </div>
                      </div>
                      {design && (
                        <div className="mt-2">
                          <CompactThreeViews design={design} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border-2 border-zinc-900 overflow-hidden">
          <div className="bg-zinc-900 text-white px-5 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-70">
                {t("sectionTotalKicker")}
              </div>
              <div className="text-xs opacity-70 mt-0.5">
                {t("totalUnitsTpl", { n: count })}
              </div>
            </div>
            <div className="text-3xl font-mono font-bold">
              {formatTWD(subtotal)}
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-zinc-200">
            <div className="p-4">
              <div className="text-[10px] text-emerald-700 font-medium">
                {t("depositPct", { pct: Math.round(p.deposit_rate * 100) })}
              </div>
              <div className="mt-0.5 text-lg font-mono font-semibold text-emerald-900">
                {formatTWD(deposit)}
              </div>
            </div>
            <div className="p-4">
              <div className="text-[10px] text-zinc-600 font-medium">
                {t("balancePct", { pct: Math.round((1 - p.deposit_rate) * 100) })}
              </div>
              <div className="mt-0.5 text-lg font-mono font-semibold text-zinc-900">
                {formatTWD(balance)}
              </div>
            </div>
          </div>
        </section>

        {p.notes && (
          <section className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 whitespace-pre-wrap">
            <div className="font-semibold mb-1">{t("notesH")}</div>
            {p.notes}
          </section>
        )}

        <footer className="mt-8 pt-5 border-t border-zinc-200 text-[11px] text-zinc-500 leading-relaxed">
          <p>
            {t("footerPayTerms", { pct: Math.round(p.deposit_rate * 100) })}
          </p>
          <p className="mt-1">{t("footerRepriceNote")}</p>
          <p className="mt-1">{t("footerValidity")}</p>
        </footer>
      </article>

      {publicAccess && (
        <>
          <ContactCraftsmanCTA
            branding={branding}
            quoteNo={quoteNo}
            customerName={p.customer_name}
          />
          <MessageThread
            projectId={id}
            initialMessages={messages}
            mode="customer"
            token={token ?? undefined}
          />
        </>
      )}
    </>
  );

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:py-0">
      {publicAccess ? body : <QuoteAccessGate>{body}</QuoteAccessGate>}
    </main>
  );
}
