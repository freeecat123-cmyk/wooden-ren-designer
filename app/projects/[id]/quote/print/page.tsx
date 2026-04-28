import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatTWD } from "@/lib/pricing/catalog";
import { getTemplate } from "@/lib/templates";
import { MATERIALS } from "@/lib/materials";
import { BrandedHeader } from "@/components/branding/BrandedHeader";
import { PrintButton } from "@/components/print/PrintButton";
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

export default async function ProjectQuotePrintPage({ params }: PageProps) {
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
    <main className="max-w-[800px] mx-auto px-8 py-8 text-zinc-900 print:p-0">
      <div className="print:hidden mb-4 flex justify-end">
        <PrintButton suggestedFilename={filename} />
      </div>

      <header className="flex items-start justify-between gap-4 pb-4 border-b-2 border-zinc-900 mb-5">
        <BrandedHeader />
        <div className="text-right text-[11px] text-zinc-600">
          <p>報價日期：{today}</p>
          <p className="mt-0.5">狀態：{PROJECT_STATUS_LABEL[p.status]}</p>
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
        <section key={room} className="mb-4">
          <h2 className="text-[12px] font-semibold mb-1 border-b border-zinc-300 pb-0.5">
            {room}（{roomItems.length} 件）
          </h2>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-600 text-left">
                <th className="py-1 pr-2 font-medium w-[28%]">品項</th>
                <th className="py-1 px-2 font-medium">規格 / 材質</th>
                <th className="py-1 px-2 font-medium text-right w-12">數量</th>
                <th className="py-1 px-2 font-medium text-right w-24">單價</th>
                <th className="py-1 pl-2 font-medium text-right w-24">小計</th>
              </tr>
            </thead>
            <tbody>
              {roomItems.map((it) => {
                const unit = it.unit_price_override ?? 0;
                const lineTotal = unit * it.quantity;
                return (
                  <tr key={it.id} className="border-b border-zinc-100 align-top">
                    <td className="py-1.5 pr-2">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-[10px] text-zinc-500">
                        {categoryLabel(it.furniture_type)}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-zinc-700">
                      {dimensionLabel(it)}
                      <br />
                      <span className="text-zinc-500">
                        {materialLabel(it)}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      {it.quantity}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      {unit > 0 ? formatTWD(unit) : "—"}
                    </td>
                    <td className="py-1.5 pl-2 text-right font-mono font-semibold">
                      {lineTotal > 0 ? formatTWD(lineTotal) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <section className="mt-6 border-2 border-zinc-900 rounded">
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
    </main>
  );
}
