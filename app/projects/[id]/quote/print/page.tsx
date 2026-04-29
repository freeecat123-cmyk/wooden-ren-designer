import { notFound } from "next/navigation";
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
  PROJECT_STATUS_LABEL,
  type ProjectItemRow,
} from "@/lib/projects/types";
import type { FurnitureCategory } from "@/lib/types";
import { fetchProjectQuoteData } from "@/lib/projects/fetch-quote-data";
import { rebuildDesignFromItem } from "@/lib/projects/rebuild-design";
import { projectQuoteNumber } from "@/lib/projects/quote-number";
import { taipeiIsoDate } from "@/lib/utils/date-tw";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

function categoryLabel(type: string): string {
  const slug = type.replace(/_/g, "-") as FurnitureCategory;
  return getTemplate(slug)?.nameZh ?? type;
}

function dimensionLabel(item: ProjectItemRow): string {
  const p = item.params as Record<string, unknown>;
  if ([p.length, p.width, p.height].every((v) => typeof v === "number")) {
    return `${p.length}×${p.width}×${p.height} mm`;
  }
  return "—";
}

function materialLabel(item: ProjectItemRow): string {
  const p = item.params as Record<string, unknown>;
  const key = typeof p.material === "string" ? p.material : "";
  return key
    ? (MATERIALS as Record<string, { nameZh: string }>)[key]?.nameZh ?? key
    : "—";
}

export default async function ProjectQuotePrintPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { token } = await searchParams;
  const data = await fetchProjectQuoteData(id, token ?? null);
  if (!data) notFound();

  const { project: p, items: list, branding, publicAccess } = data;

  let subtotal = 0;
  let count = 0;
  for (const it of list) {
    const unit = it.unit_price_override ?? 0;
    subtotal += unit * it.quantity;
    count += it.quantity;
  }
  const deposit = Math.round(subtotal * p.deposit_rate);
  const balance = subtotal - deposit;

  const grouped = (() => {
    const map = new Map<string, ProjectItemRow[]>();
    for (const it of list) {
      const room = it.room?.trim() || "未分組";
      const arr = map.get(room) ?? [];
      arr.push(it);
      map.set(room, arr);
    }
    return [...map.entries()];
  })();

  const today = new Date();
  const todayIso = taipeiIsoDate(today);
  const quoteNo = projectQuoteNumber(id, today);
  const filename = `報價_${p.customer_name || p.name}_${quoteNo}.pdf`;

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
          <p>報價日期：{todayIso}</p>
          {!publicAccess && (
            <p className="mt-0.5">狀態：{PROJECT_STATUS_LABEL[p.status]}</p>
          )}
        </div>
      </header>

      <section className="mb-5">
        <h1 className="text-xl font-bold">{p.name}</h1>
        {p.design_concept && (
          <p className="mt-1 text-[12px] text-zinc-700 italic">
            「{p.design_concept}」
          </p>
        )}
        <table className="mt-3 w-full text-[11px]">
          <tbody>
            <tr>
              <td className="text-zinc-500 w-16 py-1">客戶</td>
              <td className="py-1">{p.customer_name || "—"}</td>
              <td className="text-zinc-500 w-16 py-1">聯絡</td>
              <td className="py-1">{p.customer_contact || "—"}</td>
            </tr>
            <tr>
              <td className="text-zinc-500 py-1">案場</td>
              <td colSpan={3} className="py-1">
                {p.project_address || "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {grouped.map(([room, roomItems]) => (
        <section key={room} className="mb-5">
          <h2 className="text-[12px] font-semibold mb-2 border-b border-zinc-300 pb-0.5">
            {room}（{roomItems.length} 件）
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
                        {dimensionLabel(it)} · {materialLabel(it)}
                      </div>
                    </div>
                    <div className="text-right text-[11px]">
                      {it.quantity > 1 && (
                        <div className="text-zinc-500">
                          {formatTWD(unit)} × {it.quantity}
                        </div>
                      )}
                      <div className="font-mono font-semibold text-[13px]">
                        {lineTotal > 0 ? formatTWD(lineTotal) : "—"}
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
              整套報價
            </span>
            <span className="text-[10px] opacity-70">{count} 件</span>
          </div>
          <div className="text-2xl font-mono font-bold">
            {formatTWD(subtotal)}
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-zinc-300 text-[11px]">
          <div className="p-3">
            <div className="text-zinc-600">
              訂金（{Math.round(p.deposit_rate * 100)}%）
            </div>
            <div className="mt-0.5 text-base font-mono font-semibold">
              {formatTWD(deposit)}
            </div>
          </div>
          <div className="p-3">
            <div className="text-zinc-600">
              尾款（{Math.round((1 - p.deposit_rate) * 100)}%）
            </div>
            <div className="mt-0.5 text-base font-mono font-semibold">
              {formatTWD(balance)}
            </div>
          </div>
        </div>
      </section>

      {p.notes && (
        <section className="mt-4 border border-zinc-300 p-3 text-[11px] whitespace-pre-wrap">
          <div className="font-semibold mb-0.5">備註</div>
          {p.notes}
        </section>
      )}

      <footer className="mt-6 pt-3 border-t border-zinc-300 text-[10px] text-zinc-600 leading-relaxed">
        <p>
          付款條件：簽約付訂金 {Math.round(p.deposit_rate * 100)}%，交貨前付清尾款。
        </p>
        <p>報價以本單載明品項為準；變更設計、尺寸、材質須重新報價。</p>
        <p>本報價自寄出日起 14 日內有效。</p>
      </footer>
    </>
  );

  return (
    <main className="max-w-[800px] mx-auto px-8 py-8 text-zinc-900 print:p-0">
      {publicAccess ? body : <QuoteAccessGate>{body}</QuoteAccessGate>}
    </main>
  );
}
