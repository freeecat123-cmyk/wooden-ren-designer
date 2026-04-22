import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { LABOR_DEFAULTS, LABOR_BOUNDS } from "@/lib/pricing/labor";
import {
  calculateQuote,
  generateQuoteNumber,
} from "@/lib/pricing/quote";
import { formatTWD } from "@/lib/pricing/catalog";

interface PageProps {
  params: Promise<{ type: string }>;
  searchParams: Promise<{
    length?: string;
    width?: string;
    height?: string;
    material?: string;
    hourlyRate?: string;
    equipmentRate?: string;
    consumables?: string;
    marginRate?: string;
    vatRate?: string;
    plywoodPricePerTsai?: string;
    mdfPricePerTsai?: string;
  }>;
}

function parseNum(s: string | undefined, fallback: number): number {
  const n = s ? parseFloat(s) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export default async function QuotePage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const sp = await searchParams;

  const entry = getTemplate(type as FurnitureCategory);
  if (!entry || !entry.template) notFound();

  const length = parseInt(sp.length ?? "") || entry.defaults.length;
  const width = parseInt(sp.width ?? "") || entry.defaults.width;
  const height = parseInt(sp.height ?? "") || entry.defaults.height;
  const material = (sp.material as MaterialId) ?? "taiwan-cypress";

  const laborOpts = {
    hourlyRate: parseNum(sp.hourlyRate, LABOR_DEFAULTS.hourlyRate),
    equipmentRate: parseNum(sp.equipmentRate, LABOR_DEFAULTS.equipmentRate),
    consumables: parseNum(sp.consumables, LABOR_DEFAULTS.consumables),
    marginRate: parseNum(sp.marginRate, LABOR_DEFAULTS.marginRate),
    vatRate: parseNum(sp.vatRate, LABOR_DEFAULTS.vatRate),
    plywoodPricePerTsai: parseNum(
      sp.plywoodPricePerTsai,
      LABOR_DEFAULTS.plywoodPricePerTsai,
    ),
    mdfPricePerTsai: parseNum(
      sp.mdfPricePerTsai,
      LABOR_DEFAULTS.mdfPricePerTsai,
    ),
  };

  const design = entry.template({ length, width, height, material });
  const quote = calculateQuote(design, laborOpts);
  const quoteNo = generateQuoteNumber(design.id);

  const designQuery = `length=${length}&width=${width}&height=${height}&material=${material}`;
  const laborQuery = `hourlyRate=${laborOpts.hourlyRate}&equipmentRate=${laborOpts.equipmentRate}&consumables=${laborOpts.consumables}&marginRate=${laborOpts.marginRate}&vatRate=${laborOpts.vatRate}&plywoodPricePerTsai=${laborOpts.plywoodPricePerTsai}&mdfPricePerTsai=${laborOpts.mdfPricePerTsai}`;
  const fullQuery = `${designQuery}&${laborQuery}`;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <Link
        href={`/design/${type}?${designQuery}`}
        className="text-sm text-zinc-500 hover:underline"
      >
        ← 回{entry.nameZh}設計
      </Link>

      <header className="mt-3 mb-8 flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">客製家具報價</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {entry.nameZh} · {length} × {width} × {height} mm ·{" "}
            {MATERIALS[material].nameZh}
          </p>
        </div>
        <Link
          href={`/design/${type}/quote/print?${fullQuery}`}
          target="_blank"
          className="px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
        >
          🧾 列印報價單 / 存成 PDF
        </Link>
      </header>

      <LaborForm
        type={type}
        designQuery={designQuery}
        defaults={laborOpts}
      />

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left p-3">項目</th>
              <th className="text-left p-3">計算方式</th>
              <th className="text-right p-3 w-40">金額</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="p-3 font-medium">{line.label}</td>
                <td className="p-3 text-zinc-600 text-xs">{line.detail}</td>
                <td className="p-3 text-right font-mono">
                  {formatTWD(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-50">
            <tr className="border-t-2 border-zinc-300">
              <td className="p-3 font-medium" colSpan={2}>
                成本小計
              </td>
              <td className="p-3 text-right font-mono">
                {formatTWD(quote.costSubtotal)}
              </td>
            </tr>
            <tr>
              <td className="p-3 text-zinc-600" colSpan={2}>
                毛利（{Math.round(laborOpts.marginRate * 100)}%）
              </td>
              <td className="p-3 text-right font-mono text-emerald-700">
                + {formatTWD(quote.margin)}
              </td>
            </tr>
            <tr className="border-t border-zinc-300">
              <td className="p-3 font-semibold" colSpan={2}>
                報價（未稅）
              </td>
              <td className="p-3 text-right font-mono font-semibold text-lg">
                {formatTWD(quote.subtotalExclVat)}
              </td>
            </tr>
            {laborOpts.vatRate > 0 && (
              <>
                <tr>
                  <td className="p-3 text-zinc-600" colSpan={2}>
                    營業稅（{(laborOpts.vatRate * 100).toFixed(0)}%）
                  </td>
                  <td className="p-3 text-right font-mono">
                    + {formatTWD(quote.vat)}
                  </td>
                </tr>
                <tr className="border-t-2 border-zinc-900 bg-zinc-900 text-white">
                  <td className="p-3 font-bold" colSpan={2}>
                    含稅總計
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-lg">
                    {formatTWD(quote.total)}
                  </td>
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </section>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
        <p className="font-semibold mb-1">報價說明</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>材料以「才」計（1 才 = 30.3mm × 30.3mm × 303mm），已含 10% 切料損耗</li>
          <li>工時從製作工序自動加總，依難度與零件數估算</li>
          <li>本工具估算值僅供參考，實際報價請師傅依現場條件微調</li>
          <li>不含跨區運費、現場安裝、五金（滑軌/鉸鏈）另計</li>
        </ul>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        報價單編號：{quoteNo}
      </p>
    </main>
  );
}

function LaborForm({
  type,
  designQuery,
  defaults,
}: {
  type: string;
  designQuery: string;
  defaults: typeof LABOR_DEFAULTS;
}) {
  // Preserve design query string via hidden inputs
  const designParams = Object.fromEntries(
    new URLSearchParams(designQuery),
  ) as Record<string, string>;

  return (
    <form
      method="get"
      action={`/design/${type}/quote`}
      className="rounded-lg border border-zinc-200 bg-white p-4"
    >
      {Object.entries(designParams).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <NumField
          name="hourlyRate"
          label="師傅時薪 (NT$/hr)"
          value={defaults.hourlyRate}
          min={LABOR_BOUNDS.hourlyRate.min}
          max={LABOR_BOUNDS.hourlyRate.max}
          step={LABOR_BOUNDS.hourlyRate.step}
        />
        <NumField
          name="equipmentRate"
          label="設備折舊 (NT$/hr)"
          value={defaults.equipmentRate}
          min={LABOR_BOUNDS.equipmentRate.min}
          max={LABOR_BOUNDS.equipmentRate.max}
          step={LABOR_BOUNDS.equipmentRate.step}
        />
        <NumField
          name="consumables"
          label="耗材 (NT$)"
          value={defaults.consumables}
          min={LABOR_BOUNDS.consumables.min}
          max={LABOR_BOUNDS.consumables.max}
          step={LABOR_BOUNDS.consumables.step}
        />
        <NumField
          name="marginRate"
          label="毛利率"
          value={defaults.marginRate}
          min={LABOR_BOUNDS.marginRate.min}
          max={LABOR_BOUNDS.marginRate.max}
          step={LABOR_BOUNDS.marginRate.step}
          decimal
        />
        <NumField
          name="vatRate"
          label="營業稅率"
          value={defaults.vatRate}
          min={LABOR_BOUNDS.vatRate.min}
          max={LABOR_BOUNDS.vatRate.max}
          step={LABOR_BOUNDS.vatRate.step}
          decimal
        />
        <NumField
          name="plywoodPricePerTsai"
          label="夾板 (NT$/才)"
          value={defaults.plywoodPricePerTsai}
          min={LABOR_BOUNDS.plywoodPricePerTsai.min}
          max={LABOR_BOUNDS.plywoodPricePerTsai.max}
          step={LABOR_BOUNDS.plywoodPricePerTsai.step}
        />
        <NumField
          name="mdfPricePerTsai"
          label="中纖板 (NT$/才)"
          value={defaults.mdfPricePerTsai}
          min={LABOR_BOUNDS.mdfPricePerTsai.min}
          max={LABOR_BOUNDS.mdfPricePerTsai.max}
          step={LABOR_BOUNDS.mdfPricePerTsai.step}
        />
      </div>
      <button
        type="submit"
        className="mt-3 px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
      >
        重新計算
      </button>
    </form>
  );
}

function NumField({
  name,
  label,
  value,
  min,
  max,
  step,
  decimal,
}: {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimal?: boolean;
}) {
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-600 mb-1">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={decimal ? value.toFixed(2) : value}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
      />
    </label>
  );
}
