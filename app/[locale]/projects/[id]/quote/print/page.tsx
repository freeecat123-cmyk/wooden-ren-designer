import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatTWD } from "@/lib/pricing/catalog";
import { getTemplate } from "@/lib/templates";
import { MATERIALS } from "@/lib/materials";
import {
  OwnerBrandedHeader,
  OwnerContactBlock,
} from "@/components/projects/OwnerBrandedHeader";
import { PrintButton } from "@/components/print/PrintButton";
import { ZoomableThreeViews } from "@/components/quote/ZoomableThreeViews";
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

export default async function ProjectQuotePrintPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, id } = await params;
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "projectQuote" });
  const tStatus = await getTranslations({ locale, namespace: "projectDetailClient.projectStatus" });
  const data = await fetchProjectQuoteData(id, token ?? null);
  if (!data) notFound();

  const { project: p, items: list, branding, publicAccess } = data;
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

  const body = (
    <>
      <div className="print:hidden mb-4 flex justify-end">
        <PrintButton suggestedFilename={filename} />
      </div>

      <header className="flex items-start justify-between gap-4 pb-4 border-b-2 border-zinc-900 mb-5">
        <div className="space-y-1.5">
          <OwnerBrandedHeader branding={branding} />
          <OwnerContactBlock branding={branding} />
        </div>
        <div className="text-right text-[11px] text-zinc-600">
          <p className="font-mono text-zinc-700">{quoteNo}</p>
          <p>{t("quoteDateLbl", { date: todayIso })}</p>
          {!publicAccess && (
            <p className="mt-0.5">
              {t("statusLbl", { label: tStatus(p.status) })}
            </p>
          )}
        </div>
      </header>

      <section className="mb-5">
        <h1 className="text-xl font-bold">{p.name}</h1>
        {p.design_concept && (
          <p className="mt-1 text-[12px] text-zinc-700 italic">
            {t("designConceptQuote", { text: p.design_concept })}
          </p>
        )}
        <table className="mt-3 w-full text-[11px]">
          <tbody>
            <tr>
              <td className="text-zinc-500 w-16 py-1">{t("fieldCustomer")}</td>
              <td className="py-1">{p.customer_name || dash}</td>
              <td className="text-zinc-500 w-16 py-1">{t("fieldContact")}</td>
              <td className="py-1">{p.customer_contact || dash}</td>
            </tr>
            <tr>
              <td className="text-zinc-500 py-1">{t("fieldAddressShort")}</td>
              <td colSpan={3} className="py-1">
                {p.project_address || dash}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {grouped.map(([room, roomItems]) => (
        <section key={room} className="mb-5">
          <h2 className="text-[12px] font-semibold mb-2 border-b border-zinc-300 pb-0.5">
            {t("roomCountParenTpl", { name: room, n: roomItems.length })}
          </h2>
          <div className="space-y-3">
            {roomItems.map((it) => {
              const unit = it.unit_price_override ?? 0;
              const lineTotal = unit * it.quantity;
              const design = rebuildDesignFromItem(it);
              return (
                <div
                  key={it.id}
                  className="border border-zinc-300 rounded p-2.5 break-inside-avoid"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                    <div>
                      <div className="font-semibold text-[12px]">{it.name}</div>
                      <div className="text-[10px] text-zinc-600">
                        {categoryLabel(it.furniture_type)} ·{" "}
                        {dimensionLabel(it, dash)} ·{" "}
                        {materialLabel(it, dash)}
                      </div>
                    </div>
                    <div className="text-right text-[11px]">
                      {it.quantity > 1 && (
                        <div className="text-zinc-500">
                          {t("lineUnitTimesQtyTpl", {
                            price: formatTWD(unit),
                            qty: it.quantity,
                          })}
                        </div>
                      )}
                      <div className="font-mono font-semibold text-[13px]">
                        {lineTotal > 0 ? formatTWD(lineTotal) : dash}
                      </div>
                    </div>
                  </div>
                  {design && <ZoomableThreeViews design={design} />}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mt-6 border-2 border-zinc-900 rounded break-inside-avoid">
        <div className="bg-zinc-900 text-white px-4 py-2.5 flex items-baseline justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider opacity-70 mr-2">
              {t("sectionTotalKicker")}
            </span>
            <span className="text-[10px] opacity-70">
              {t("totalUnitsTpl", { n: count })}
            </span>
          </div>
          <div className="text-2xl font-mono font-bold">
            {formatTWD(subtotal)}
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-zinc-300 text-[11px]">
          <div className="p-3">
            <div className="text-zinc-600">
              {t("depositPct", { pct: Math.round(p.deposit_rate * 100) })}
            </div>
            <div className="mt-0.5 text-base font-mono font-semibold">
              {formatTWD(deposit)}
            </div>
          </div>
          <div className="p-3">
            <div className="text-zinc-600">
              {t("balancePct", { pct: Math.round((1 - p.deposit_rate) * 100) })}
            </div>
            <div className="mt-0.5 text-base font-mono font-semibold">
              {formatTWD(balance)}
            </div>
          </div>
        </div>
      </section>

      {p.notes && (
        <section className="mt-4 border border-zinc-300 p-3 text-[11px] whitespace-pre-wrap">
          <div className="font-semibold mb-0.5">{t("notesH")}</div>
          {p.notes}
        </section>
      )}

      <footer className="mt-6 pt-3 border-t border-zinc-300 text-[10px] text-zinc-600 leading-relaxed">
        <p>{t("footerPayTerms", { pct: Math.round(p.deposit_rate * 100) })}</p>
        <p>{t("footerRepriceNote")}</p>
        <p>{t("footerValidity")}</p>
      </footer>
    </>
  );

  return (
    <main className="max-w-[800px] mx-auto px-8 py-8 text-zinc-900 print:p-0">
      {publicAccess ? body : <QuoteAccessGate>{body}</QuoteAccessGate>}
    </main>
  );
}
