import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectQuoteData } from "@/lib/projects/fetch-quote-data";
import { rebuildDesignFromItem } from "@/lib/projects/rebuild-design";
import {
  effectiveBillableMaterial,
  formatTWD,
  MATERIAL_PRICE_PER_BDFT,
  MM3_PER_BDFT,
  SHEET_GOOD_PRICE_PER_BDFT,
} from "@/lib/pricing/catalog";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { MATERIALS } from "@/lib/materials";
import { QuoteAccessGate } from "@/components/QuoteAccessGate";
import { PrintButton } from "@/components/print/PrintButton";
import type { ProjectItemRow } from "@/lib/projects/types";
import type { MaterialId } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "採購清單 · 木頭仁工程圖生成器" };

const ACCESSORY_SET = new Set([
  "pencil-holder",
  "bookend",
  "photo-frame",
  "tray",
  "dovetail-box",
  "wine-rack",
  "coat-rack",
]);

function wasteRate(category: string): number {
  return ACCESSORY_SET.has(category) ? 0.25 : 0.1;
}

function priceFor(mat: string): number {
  if (mat in MATERIAL_PRICE_PER_BDFT)
    return MATERIAL_PRICE_PER_BDFT[mat as MaterialId];
  if (mat in SHEET_GOOD_PRICE_PER_BDFT)
    return (SHEET_GOOD_PRICE_PER_BDFT as Record<string, number>)[mat] ?? 300;
  return 300;
}

function materialName(mat: string): string {
  const m = (MATERIALS as Record<string, { nameZh: string }>)[mat];
  return m?.nameZh ?? mat;
}

interface MaterialAggregate {
  material: string;
  volumeMm3: number;
  partCount: number;
  withWaste: number;
  bdft: number;
  price: number;
  amount: number;
  /** 出現於哪些家具（讓木工知道這料哪幾件用到） */
  usedIn: string[];
}

export default async function ProjectPurchasePage({ params }: PageProps) {
  const { id } = await params;
  const data = await fetchProjectQuoteData(id, null);
  if (!data) notFound();
  const { project: p, items: list } = data;

  const aggregate = new Map<string, MaterialAggregate>();
  let totalParts = 0;
  let unbuilt = 0;

  for (const it of list as ProjectItemRow[]) {
    const design = rebuildDesignFromItem(it);
    if (!design) {
      unbuilt += 1;
      continue;
    }
    const wr = wasteRate(design.category);
    const partVolByMat = new Map<string, { vol: number; count: number }>();
    for (const part of design.parts) {
      if (part.visual === "glass") continue;
      const cut = calculateCutDimensions(part);
      const vol = cut.length * cut.width * cut.thickness;
      const mat = effectiveBillableMaterial(part);
      const existing = partVolByMat.get(mat) ?? { vol: 0, count: 0 };
      existing.vol += vol;
      existing.count += 1;
      partVolByMat.set(mat, existing);
      totalParts += 1;
    }

    for (const [mat, { vol, count }] of partVolByMat) {
      const withWaste = vol * (1 + wr) * it.quantity;
      const agg = aggregate.get(mat) ?? {
        material: mat,
        volumeMm3: 0,
        partCount: 0,
        withWaste: 0,
        bdft: 0,
        price: priceFor(mat),
        amount: 0,
        usedIn: [],
      };
      agg.volumeMm3 += vol * it.quantity;
      agg.partCount += count * it.quantity;
      agg.withWaste += withWaste;
      agg.bdft = agg.withWaste / MM3_PER_BDFT;
      agg.amount = Math.round(agg.bdft * agg.price);
      if (!agg.usedIn.includes(it.name)) agg.usedIn.push(it.name);
      aggregate.set(mat, agg);
    }
  }

  const sorted = [...aggregate.values()].sort((a, b) => b.amount - a.amount);
  const totalBdft = sorted.reduce((s, x) => s + x.bdft, 0);
  const totalAmount = sorted.reduce((s, x) => s + x.amount, 0);
  const filename = `採購清單_${p.customer_name || p.name}.pdf`;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 print:py-0">
      <div className="flex items-baseline justify-between mb-4 print:hidden">
        <Link
          href={`/projects/${id}`}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← 回專案
        </Link>
        <PrintButton suggestedFilename={filename} />
      </div>

      <QuoteAccessGate>
        <article className="rounded-2xl border-2 border-zinc-200 bg-white p-6 sm:p-8 print:border-0 print:p-0">
          <header className="pb-5 border-b border-zinc-200 mb-5">
            <p className="text-[10px] tracking-[0.2em] text-zinc-500">
              MATERIAL PURCHASE LIST
            </p>
            <h1 className="text-2xl font-bold text-zinc-900 mt-1">
              採購清單
            </h1>
            <p className="text-sm text-zinc-600 mt-1">
              {p.name}
              {p.customer_name && (
                <span className="text-zinc-400"> · {p.customer_name}</span>
              )}
            </p>
            <p className="text-[10px] text-zinc-400 mt-2">
              已含切料損耗（一般 10%、小物 25%）
            </p>
          </header>

          {sorted.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-12">
              尚未加入家具項目，無法產生採購清單。
            </p>
          ) : (
            <>
              <table className="w-full text-sm border-collapse mb-5">
                <thead>
                  <tr className="border-b-2 border-zinc-300 text-xs text-zinc-500 text-left">
                    <th className="py-2 pr-2 font-medium">木材</th>
                    <th className="py-2 px-2 font-medium text-right">零件</th>
                    <th className="py-2 px-2 font-medium text-right">板才</th>
                    <th className="py-2 px-2 font-medium text-right">單價</th>
                    <th className="py-2 pl-2 font-medium text-right">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr
                      key={row.material}
                      className="border-b border-zinc-100 align-top"
                    >
                      <td className="py-2 pr-2">
                        <div className="font-medium text-zinc-900">
                          {materialName(row.material)}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                          用於：{row.usedIn.join("、")}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs">
                        {row.partCount} 片
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {row.bdft.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-zinc-500">
                        {formatTWD(row.price)}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold">
                        {formatTWD(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-zinc-50">
                  <tr className="border-t-2 border-zinc-300">
                    <td className="py-3 px-2 font-semibold" colSpan={2}>
                      合計
                    </td>
                    <td className="py-3 px-2 text-right font-mono font-semibold">
                      {totalBdft.toFixed(2)}
                    </td>
                    <td />
                    <td className="py-3 pl-2 text-right font-mono font-bold text-base">
                      {formatTWD(totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900 leading-relaxed">
                <p>
                  <strong>📐 採購重點：</strong>
                  木料行通常賣 8 尺、10 尺、12 尺長料。建議帶上每件家具的「最長零件長度」採購，
                  避免買回來不夠長。
                </p>
                <p className="mt-1">
                  <strong>💰 估價說明：</strong>
                  以系統 catalog 單價計算，實際價格依木料行報價。打折議價、整批優惠請另議。
                </p>
                {unbuilt > 0 && (
                  <p className="mt-1 text-red-700">
                    ⚠️ 有 {unbuilt} 件家具無法重建（範本可能有更新），未列入此清單。
                  </p>
                )}
              </div>

              <div className="mt-6 text-[10px] text-zinc-400 text-center">
                合計 {totalParts.toLocaleString()} 個零件 · {sorted.length} 種木材
              </div>
            </>
          )}
        </article>
      </QuoteAccessGate>
    </main>
  );
}
