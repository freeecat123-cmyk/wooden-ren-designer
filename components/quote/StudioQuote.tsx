"use client";

import { useId, useMemo, useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { LABOR_BOUNDS, LABOR_DEFAULTS, sanitizeLaborOpts, type LaborDefaults } from "@/lib/pricing/labor";
import { calculateQuote } from "@/lib/pricing/quote";
import { MATERIAL_PRICE_PER_BDFT, formatMoney } from "@/lib/pricing/catalog";
import { formatDimensions } from "@/lib/units/format";
import { useCurrency } from "@/hooks/useCurrency";
import { useUnit } from "@/hooks/useUnit";
import { partName } from "@/lib/templates/part-names";
import { materialName } from "@/lib/materials";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";

type Props = { design: FurnitureDesign; locale: string; quoteHref: string; allowed: boolean };
type Field = keyof LaborDefaults;
const FIELDS: { key: Field; en: string; zh: string; percent?: boolean; unit?: string }[] = [
  { key: "primaryMaterialPricePerBdft", en: "Primary material", zh: "主材單價", unit: "TWD/bd-ft" },
  { key: "hourlyRate", en: "Hourly labor rate", zh: "加工時薪", unit: "TWD/hr" },
  { key: "equipmentRate", en: "Equipment rate", zh: "設備折舊", unit: "TWD/hr" },
  { key: "consumables", en: "Consumables", zh: "耗材", unit: "TWD" },
  { key: "finishingCost", en: "Finishing", zh: "塗裝費", unit: "TWD" },
  { key: "hardwareCost", en: "Hardware", zh: "五金", unit: "TWD" },
  { key: "shippingCost", en: "Shipping", zh: "運費", unit: "TWD" },
  { key: "installationCost", en: "Installation", zh: "安裝費", unit: "TWD" },
  { key: "quantity", en: "Quantity", zh: "數量" },
  { key: "marginRate", en: "Cost markup", zh: "毛利加成", percent: true },
  { key: "vatRate", en: "Tax", zh: "營業稅", percent: true },
  { key: "plywoodPricePerBdft", en: "Plywood", zh: "夾板單價", unit: "TWD/bd-ft" },
  { key: "mdfPricePerBdft", en: "MDF", zh: "中纖板單價", unit: "TWD/bd-ft" },
  { key: "laborHoursOverride", en: "Labor hours override (0 = auto)", zh: "工時覆寫（0 為自動）", unit: "hr" },
  { key: "overrideUnitPrice", en: "Unit price override (0 = auto)", zh: "單價覆寫（0 為自動）", unit: "TWD" },
  { key: "designerMarkupRate", en: "Designer markup", zh: "設計師加成", percent: true },
  { key: "discountRate", en: "Discount", zh: "折扣", percent: true },
  { key: "depositRate", en: "Deposit", zh: "訂金", percent: true },
  { key: "bufferDays", en: "Buffer days", zh: "緩衝天數" },
  { key: "deliveryDaysOverride", en: "Delivery days override (0 = auto)", zh: "交貨天數覆寫（0 為自動）" },
  { key: "expiryDays", en: "Valid for (days)", zh: "報價有效天數" },
];

function readOptions(design: FurnitureDesign, query: URLSearchParams, edits: Partial<Record<Field, string>>) {
  const defaults: LaborDefaults = {
    ...LABOR_DEFAULTS,
    primaryMaterialPricePerBdft: MATERIAL_PRICE_PER_BDFT[design.primaryMaterial] ?? 300,
  };
  const raw = { ...defaults };
  for (const { key } of FIELDS) {
    const value = edits[key] ?? query.get(key);
    if ((key === "plywoodPricePerBdft" || key === "mdfPricePerBdft") && value != null &&
      (value.trim() === "" || (Number.isFinite(Number(value)) && Number(value) <= 0))) {
      raw[key] = null;
      continue;
    }
    // Resolve absent/non-finite material prices here: LABOR_DEFAULTS has no primary price.
    const parsed = value == null || value.trim() === "" ? defaults[key] : Number(value);
    Object.assign(raw, { [key]: parsed == null || Number.isFinite(parsed) ? parsed : defaults[key] });
  }
  return sanitizeLaborOpts({ ...raw });
}

export function StudioQuote(props: Props) {
  // The server owns entitlement checks; do not even calculate a client-side locked quote.
  if (!props.allowed) return null;
  return <AllowedQuote {...props} />;
}

function AllowedQuote({ design, locale, quoteHref }: Props) {
  const en = locale === "en";
  const currency = useCurrency();
  const unit = useUnit();
  const id = useId();
  // The parent keeps this slot mounted while hidden. Only quote edits live here;
  // every render still consumes the latest authoritative model and output URL.
  const [edits, setEdits] = useState<Partial<Record<Field, string>>>({});
  const [drafts, setDrafts] = useState<Partial<Record<Field, string>>>({});
  const [adjusted, setAdjusted] = useState<Field | null>(null);
  const target = new URL(quoteHref, "https://studio.invalid");
  const options = readOptions(design, target.searchParams, edits);
  const optionKey = JSON.stringify(options);
  const quote = useMemo(() => calculateQuote(design, JSON.parse(optionKey) as LaborDefaults, locale, unit), [design, optionKey, locale, unit]);
  for (const { key } of FIELDS) target.searchParams.set(key, options[key] == null ? "" : String(options[key]));
  const fullHref = /^https?:\/\//.test(quoteHref) ? target.href : `${target.pathname}${target.search}${target.hash}`;
  const fmt = (value: number) => formatMoney(value, currency);
  const totalLabel = en ? "Total including tax" : "含稅總計";

  const renderField = ({ key, en: english, zh, percent, unit: suffix }: typeof FIELDS[number]) => {
    const multiplier = percent ? 100 : 1;
    const value = options[key];
    const display = value == null ? "" : String(Number((value * multiplier).toFixed(6)));
    const bounds = LABOR_BOUNDS[key];
    const optional = key === "plywoodPricePerBdft" || key === "mdfPricePerBdft";
    return <label key={key} className="flex min-w-0 flex-col gap-1 text-sm text-zinc-700">
      <span className="break-words">{en ? english : zh}{percent ? " (%)" : suffix ? ` (${suffix})` : ""}</span>
      <input type="number" name={key} value={drafts[key] ?? display}
        min={optional ? 0 : bounds.min * multiplier} max={bounds.max * multiplier} step={bounds.step * multiplier}
        inputMode="decimal" placeholder={optional ? (en ? "Use primary material" : "併入主材") : undefined}
        aria-describedby={adjusted === key ? `${id}-adjusted` : undefined}
        className="min-w-0 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:outline-2 focus:outline-emerald-700"
        onChange={event => {
          const raw = event.target.value;
          setDrafts(current => ({ ...current, [key]: raw }));
          setEdits(current => ({ ...current, [key]: raw === "" ? "" : String(Number(raw) / multiplier) }));
          setAdjusted(null);
        }}
        onBlur={event => {
          const raw = event.target.value;
          if (raw !== display && (raw === "" || Number(raw) !== Number(display))) setAdjusted(key);
          setDrafts(current => { const next = { ...current }; delete next[key]; return next; });
        }} />
    </label>;
  };

  const summary = [
    [en ? "Cost per item" : "單件成本", fmt(quote.costSubtotal)],
    [en ? "Maker margin per item" : "單件毛利", fmt(quote.margin)],
    [en ? "Designer markup per item" : "單件設計師加成", fmt(quote.designerMarkupAmount)],
    [en ? "Unit price before tax" : "單件未稅價", fmt(quote.unitPriceExclVat)],
    [en ? "Quantity" : "數量", String(quote.quantity)],
    [en ? "Subtotal before discount" : "折扣前小計", fmt(quote.subtotalBeforeDiscount)],
    [en ? "Discount" : "折扣金額", fmt(quote.discountAmount)],
    [en ? "Subtotal before tax" : "未稅小計", fmt(quote.subtotalExclVat)],
    [en ? "Tax" : "營業稅", fmt(quote.vat)],
    [en ? "Deposit" : "訂金", fmt(quote.depositAmount)],
    [en ? "Balance" : "尾款", fmt(quote.balanceAmount)],
    [en ? "Labor hours per item" : "單件工時", `${quote.laborHours.toFixed(1)} hr`],
    [en ? "Delivery workdays" : "交貨工作天", String(options.deliveryDaysOverride > 0 ? options.deliveryDaysOverride : quote.estimatedWorkdays)],
  ];

  if (en) return <section aria-label="Material estimate" className="min-w-0 space-y-5 bg-white p-4 text-zinc-900">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
      <h2 className="text-xl font-semibold">Material estimate</h2>
      <a href={fullHref} data-studio-output className="text-sm font-medium text-emerald-700 underline underline-offset-4">Full estimate</a>
    </header>
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>
      {FIELDS.filter(field => ["primaryMaterialPricePerBdft", "plywoodPricePerBdft", "mdfPricePerBdft"].includes(field.key)).map(renderField)}
    </div>
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-y border-zinc-200 py-4">
      <span>Estimated material cost</span><output role="status" aria-label="Estimated material cost" className="text-xl font-semibold tabular-nums text-emerald-700">{fmt(quote.materialCost)}</output>
    </div>
    <p className="text-sm text-zinc-600">{quote.totalBdft.toFixed(1)} bd-ft, including 10% cutting waste. Lumber only; hardware, finishes and labor are excluded.</p>
    <table className="w-full table-fixed text-sm">
      <caption className="pb-3 text-left font-semibold">Bill of materials</caption>
      <thead><tr className="border-b border-zinc-200"><th className="py-2 text-left">Part</th><th className="py-2 text-left">Material</th><th className="py-2 text-right">Cut dimensions</th></tr></thead>
      <tbody>{design.parts.filter(part => part.visual === undefined).map(part => {
        const cut = calculateCutDimensions(part);
        return <tr key={part.id} className="border-b border-zinc-100"><th scope="row" className="break-words py-3 pr-2 text-left font-normal">{partName(part, locale)}</th>
          <td className="break-words py-3 pr-2">{part.materialOverride === "plywood" ? "Plywood" : part.materialOverride === "mdf" ? "MDF" : materialName(part.material, locale)}</td>
          <td className="break-words py-3 text-right">{formatDimensions(cut.length, cut.width, cut.thickness, unit)}</td></tr>;
      })}</tbody>
    </table>
  </section>;

  return <section aria-label={en ? "Embedded quote" : "設計報價"} className="min-w-0 bg-white p-4 text-zinc-900" style={{ letterSpacing: 0 }}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">{en ? "Quote" : "報價"}</h2>
        <p className="break-words text-sm text-zinc-500">{formatDimensions(design.overall.length, design.overall.width, design.overall.thickness, unit)}</p>
      </div>
      <a href={fullHref} data-studio-output className="text-sm font-medium text-emerald-700 underline underline-offset-4">{en ? "Full quote" : "完整報價單"}</a>
    </header>
    <fieldset className="min-w-0 border-0 py-4">
      <legend className="pt-4 text-base font-semibold">{en ? "Costs and quantity" : "成本與數量"}</legend>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>{FIELDS.slice(0, 11).map(renderField)}</div>
      <details className="mt-4 border-t border-zinc-200 pt-3">
        <summary className="cursor-pointer text-sm font-medium">{en ? "Additional quote settings" : "進階報價設定"}</summary>
        <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))" }}>{FIELDS.slice(11).map(renderField)}</div>
      </details>
      {adjusted && <p id={`${id}-adjusted`} role="alert" className="mt-3 text-sm text-zinc-700">{en ? "Input adjusted to its allowed range or default." : "輸入值已調整為允許範圍或預設值。"}</p>}
    </fieldset>
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="border-t border-zinc-200 py-3 text-left text-base font-semibold">{en ? "Cost breakdown per item" : "單件成本明細"}</caption>
      <thead><tr className="border-b border-zinc-200 text-left"><th scope="col" className="py-2">{en ? "Item" : "項目"}</th><th scope="col" className="w-28 py-2 text-right">{en ? "Amount" : "金額"}</th></tr></thead>
      <tbody>{quote.lines.map((line, index) => <tr key={index} className="border-b border-zinc-100">
        <th scope="row" className="break-words py-3 pr-3 text-left font-normal"><span>{line.label}</span><span className="mt-1 block text-xs text-zinc-500">{line.detail}</span></th>
        <td className="break-words py-3 text-right align-top tabular-nums">{fmt(line.amount)}</td>
      </tr>)}</tbody>
    </table>
    <dl className="mt-4 grid gap-2 text-sm">{summary.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="min-w-0 break-words text-zinc-600">{label}</dt><dd className="shrink-0 tabular-nums">{value}</dd></div>)}</dl>
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-zinc-200 pt-4 font-semibold">
      <span>{totalLabel}</span><output role="status" aria-label={totalLabel} className="text-xl tabular-nums text-emerald-700">{fmt(quote.total)}</output>
    </div>
  </section>;
}
