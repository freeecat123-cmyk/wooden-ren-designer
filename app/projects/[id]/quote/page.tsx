import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatTWD } from "@/lib/pricing/catalog";
import { getTemplate } from "@/lib/templates";
import { MATERIALS } from "@/lib/materials";
import { BrandedHeader } from "@/components/branding/BrandedHeader";
import { PrintButton } from "@/components/print/PrintButton";
import { CopyShareLinkButton } from "@/components/projects/CopyShareLinkButton";
import { QuoteAccessGate } from "@/components/QuoteAccessGate";
import {
  PROJECT_STATUS_LABEL,
  type ProjectItemRow,
  type ProjectRow,
} from "@/lib/projects/types";
import type { FurnitureCategory } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function ProjectQuotePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: items }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase
      .from("project_items")
      .select("*")
      .eq("project_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (!project) notFound();

  const p = project as ProjectRow;
  const list = (items ?? []) as ProjectItemRow[];

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

  const today = new Date().toISOString().slice(0, 10);
  const filename = `報價_${p.customer_name || p.name}_${today}.pdf`;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:py-0">
      <QuoteAccessGate>
      <div className="flex items-baseline justify-between mb-4 print:hidden">
        <Link
          href={`/projects/${id}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← 回專案編輯
        </Link>
        <div className="flex items-center gap-2">
          <CopyShareLinkButton projectId={id} />
          <Link
            href={`/projects/${id}/quote/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            🖨️ 列印頁
          </Link>
          <PrintButton suggestedFilename={filename} />
        </div>
      </div>

      <article className="rounded-2xl border-2 border-zinc-200 bg-white p-6 sm:p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4 pb-5 border-b border-zinc-200 mb-5">
          <BrandedHeader />
          <div className="text-right text-xs text-zinc-500">
            <p>報價日期：{today}</p>
            <p className="mt-0.5">
              狀態：{PROJECT_STATUS_LABEL[p.status]}
            </p>
          </div>
        </header>

        <section className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">{p.name}</h1>
          {p.design_concept && (
            <p className="mt-1 text-sm text-zinc-600 italic">
              「{p.design_concept}」
            </p>
          )}
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <dt className="text-zinc-500">客戶</dt>
              <dd className="text-zinc-900 mt-0.5">{p.customer_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">聯絡</dt>
              <dd className="text-zinc-900 mt-0.5">
                {p.customer_contact || "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-zinc-500">案場地址</dt>
              <dd className="text-zinc-900 mt-0.5">
                {p.project_address || "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mb-6">
          {grouped.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
              尚未加入任何家具項目。
            </div>
          )}
          {grouped.map(([room, roomItems]) => (
            <div key={room} className="mb-5">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                <span>📐</span>
                <span>{room}</span>
                <span className="text-xs text-zinc-400 font-normal">
                  ({roomItems.length} 件)
                </span>
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-300 text-xs text-zinc-500 text-left">
                    <th className="py-2 pr-2 font-medium">品項</th>
                    <th className="py-2 px-2 font-medium">規格 / 材質</th>
                    <th className="py-2 px-2 font-medium text-right w-16">
                      數量
                    </th>
                    <th className="py-2 px-2 font-medium text-right w-28">
                      單價
                    </th>
                    <th className="py-2 pl-2 font-medium text-right w-28">
                      小計
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roomItems.map((it) => {
                    const unit = it.unit_price_override ?? 0;
                    const lineTotal = unit * it.quantity;
                    return (
                      <tr
                        key={it.id}
                        className="border-b border-zinc-100 align-top"
                      >
                        <td className="py-2 pr-2">
                          <div className="font-medium text-zinc-900">
                            {it.name}
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {categoryLabel(it.furniture_type)}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-xs text-zinc-600">
                          {dimensionLabel(it)}
                          <br />
                          <span className="text-zinc-500">
                            {materialLabel(it)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {it.quantity}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {unit > 0 ? formatTWD(unit) : "—"}
                        </td>
                        <td className="py-2 pl-2 text-right font-mono font-semibold">
                          {lineTotal > 0 ? formatTWD(lineTotal) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </section>

        <section className="rounded-xl border-2 border-zinc-900 overflow-hidden">
          <div className="bg-zinc-900 text-white px-5 py-4 flex items-baseline justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-70">
                整套報價
              </div>
              <div className="text-xs opacity-70 mt-0.5">{count} 件</div>
            </div>
            <div className="text-3xl font-mono font-bold">
              {formatTWD(subtotal)}
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-zinc-200">
            <div className="p-4">
              <div className="text-[10px] text-emerald-700 font-medium">
                訂金（{Math.round(p.deposit_rate * 100)}%）
              </div>
              <div className="mt-0.5 text-lg font-mono font-semibold text-emerald-900">
                {formatTWD(deposit)}
              </div>
            </div>
            <div className="p-4">
              <div className="text-[10px] text-zinc-600 font-medium">
                尾款（{Math.round((1 - p.deposit_rate) * 100)}%）
              </div>
              <div className="mt-0.5 text-lg font-mono font-semibold text-zinc-900">
                {formatTWD(balance)}
              </div>
            </div>
          </div>
        </section>

        {p.notes && (
          <section className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 whitespace-pre-wrap">
            <div className="font-semibold mb-1">備註</div>
            {p.notes}
          </section>
        )}

        <footer className="mt-8 pt-5 border-t border-zinc-200 text-[11px] text-zinc-500 leading-relaxed">
          <p>
            付款條件：簽約付訂金 {Math.round(p.deposit_rate * 100)}%，交貨前付清尾款。
          </p>
          <p className="mt-1">
            報價以本單載明品項為準；變更設計、尺寸、材質須重新報價。
          </p>
          <p className="mt-1">本報價自寄出日起 14 日內有效。</p>
        </footer>
      </article>
      </QuoteAccessGate>
    </main>
  );
}
