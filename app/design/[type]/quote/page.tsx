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
import { MATERIAL_PRICE_PER_BDFT, formatTWD } from "@/lib/pricing/catalog";
import { BrandingForm } from "@/components/branding/BrandingForm";

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
    finishingCost?: string;
    marginRate?: string;
    vatRate?: string;
    primaryMaterialPricePerBdft?: string;
    plywoodPricePerBdft?: string;
    mdfPricePerBdft?: string;
  }>;
}

function parseNum(s: string | undefined, fallback: number): number {
  const n = s ? parseFloat(s) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 可空單價解析：
 *   undefined（沒傳 param）    → fallback（預填初始值）
 *   空字串（使用者清空欄位）    → null（併入主材）
 *   0 或負數                   → null（使用者打 0 等同不另計）
 *   有值                       → 數字
 */
function parseOptNum(
  s: string | undefined,
  fallback: number | null,
): number | null {
  if (s === undefined) return fallback;
  if (s.trim() === "") return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return null;
  return n;
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

  const catalogPrimaryPrice = MATERIAL_PRICE_PER_BDFT[material] ?? 2000;

  const laborOpts = {
    hourlyRate: parseNum(sp.hourlyRate, LABOR_DEFAULTS.hourlyRate),
    equipmentRate: parseNum(sp.equipmentRate, LABOR_DEFAULTS.equipmentRate),
    consumables: parseNum(sp.consumables, LABOR_DEFAULTS.consumables),
    finishingCost: parseNum(sp.finishingCost, LABOR_DEFAULTS.finishingCost),
    marginRate: parseNum(sp.marginRate, LABOR_DEFAULTS.marginRate),
    vatRate: parseNum(sp.vatRate, LABOR_DEFAULTS.vatRate),
    primaryMaterialPricePerBdft: parseNum(
      sp.primaryMaterialPricePerBdft,
      catalogPrimaryPrice,
    ),
    plywoodPricePerBdft: parseOptNum(
      sp.plywoodPricePerBdft,
      LABOR_DEFAULTS.plywoodPricePerBdft,
    ),
    mdfPricePerBdft: parseOptNum(
      sp.mdfPricePerBdft,
      LABOR_DEFAULTS.mdfPricePerBdft,
    ),
  };

  const design = entry.template({ length, width, height, material });
  const quote = calculateQuote(design, laborOpts);
  const quoteNo = generateQuoteNumber(design.id);

  const designQuery = `length=${length}&width=${width}&height=${height}&material=${material}`;
  const laborQuery = `hourlyRate=${laborOpts.hourlyRate}&equipmentRate=${laborOpts.equipmentRate}&consumables=${laborOpts.consumables}&finishingCost=${laborOpts.finishingCost}&marginRate=${laborOpts.marginRate}&vatRate=${laborOpts.vatRate}&primaryMaterialPricePerBdft=${laborOpts.primaryMaterialPricePerBdft}&plywoodPricePerBdft=${laborOpts.plywoodPricePerBdft ?? ""}&mdfPricePerBdft=${laborOpts.mdfPricePerBdft ?? ""}`;
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
        primaryMaterialName={MATERIALS[material].nameZh}
      />

      <BrandingForm />

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
          <li>材料以「板才」計（1 板才 = 1&quot; × 12&quot; × 12&quot; ≈ 2,360 cm³ ≈ 8.5 台才），已含 10% 切料損耗</li>
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
  primaryMaterialName,
}: {
  type: string;
  designQuery: string;
  defaults: {
    hourlyRate: number;
    equipmentRate: number;
    consumables: number;
    finishingCost: number;
    marginRate: number;
    vatRate: number;
    primaryMaterialPricePerBdft: number;
    plywoodPricePerBdft: number | null;
    mdfPricePerBdft: number | null;
  };
  primaryMaterialName: string;
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
      <fieldset className="mb-3">
        <legend className="text-xs text-zinc-500 mb-1.5 font-medium">
          材料單價（NT$/板才）
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumField
            name="primaryMaterialPricePerBdft"
            label={`${primaryMaterialName}（主材）`}
            value={defaults.primaryMaterialPricePerBdft}
            min={LABOR_BOUNDS.primaryMaterialPricePerBdft.min}
            max={LABOR_BOUNDS.primaryMaterialPricePerBdft.max}
            step={LABOR_BOUNDS.primaryMaterialPricePerBdft.step}
          />
          <NumField
            name="plywoodPricePerBdft"
            label="夾板（背板/抽屜底）"
            value={defaults.plywoodPricePerBdft}
            min={LABOR_BOUNDS.plywoodPricePerBdft.min}
            max={LABOR_BOUNDS.plywoodPricePerBdft.max}
            step={LABOR_BOUNDS.plywoodPricePerBdft.step}
            optional
            hint="留空則併入主材"
          />
          <NumField
            name="mdfPricePerBdft"
            label="中纖板（抽屜側背）"
            value={defaults.mdfPricePerBdft}
            min={LABOR_BOUNDS.mdfPricePerBdft.min}
            max={LABOR_BOUNDS.mdfPricePerBdft.max}
            step={LABOR_BOUNDS.mdfPricePerBdft.step}
            optional
            hint="留空則併入主材"
          />
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs text-zinc-500 mb-1.5 font-medium">
          工資 / 其他
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
            name="finishingCost"
            label="塗裝費 (NT$)"
            value={defaults.finishingCost}
            min={LABOR_BOUNDS.finishingCost.min}
            max={LABOR_BOUNDS.finishingCost.max}
            step={LABOR_BOUNDS.finishingCost.step}
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
        </div>
      </fieldset>
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
  optional,
  hint,
}: {
  name: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  decimal?: boolean;
  optional?: boolean;
  hint?: string;
}) {
  const display =
    value == null ? "" : decimal ? value.toFixed(2) : String(value);
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-600 mb-1">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={display}
        // optional 欄位不設 min——允許 0 / 清空，觸發「併入主材」邏輯
        min={optional ? 0 : min}
        max={max}
        step={step}
        inputMode="decimal"
        placeholder={optional ? "（不填 / 0＝併入主材）" : undefined}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
      />
      {hint && (
        <span className="mt-0.5 text-[10px] text-zinc-400">{hint}</span>
      )}
    </label>
  );
}
