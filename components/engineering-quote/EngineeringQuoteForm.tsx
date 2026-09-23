"use client";

import { useTranslations } from "next-intl";
import type { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";

export type EngQuoteOpts = typeof ENGINEERING_QUOTE_DEFAULTS;

interface Props {
  quoteType: "floor" | "ceiling";
  value: EngQuoteOpts;
  onChange: (next: EngQuoteOpts) => void;
}

function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-zinc-600">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
          value={value}
          min={0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
        {unit && <span className="text-zinc-400">{unit}</span>}
      </span>
    </label>
  );
}

export function EngineeringQuoteForm({ quoteType, value, onChange }: Props) {
  const t = useTranslations("engQuoteForm");
  const set = <K extends keyof EngQuoteOpts>(k: K, v: EngQuoteOpts[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${quoteType === "ceiling" ? "grid-cols-2" : "grid-cols-1"}`}>
        {quoteType === "ceiling" && (
          <NumField
            label={t("fieldCeilingMaterial")}
            unit={t("unitPerPing")}
            value={value.ceilingMaterialPerPing}
            onChange={(v) => set("ceilingMaterialPerPing", v)}
          />
        )}
        <NumField
          label={t("fieldLabor")}
          unit={t("unitPerPing")}
          value={value.laborPricePerPing}
          onChange={(v) => set("laborPricePerPing", v)}
        />
      </div>

      <div className="rounded border border-zinc-200 p-3">
        <div className="mb-2 text-xs font-semibold">{t("demolitionH")}</div>
        <div className="mb-2 flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="demolitionMode"
              checked={value.demolitionMode === "lump"}
              onChange={() => set("demolitionMode", "lump")}
            />
            {t("modeLump")}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="demolitionMode"
              checked={value.demolitionMode === "perPing"}
              onChange={() => set("demolitionMode", "perPing")}
            />
            {t("modePerPing")}
          </label>
        </div>
        {value.demolitionMode === "lump" ? (
          <NumField
            label={t("fieldDemolitionLump")}
            unit={t("unitNtd")}
            value={value.demolitionLump}
            onChange={(v) => set("demolitionLump", v)}
          />
        ) : (
          <NumField
            label={t("fieldDemolitionPerPing")}
            unit={t("unitPerPing")}
            value={value.demolitionPerPing}
            onChange={(v) => set("demolitionPerPing", v)}
          />
        )}
      </div>

      <div className="rounded border border-zinc-200 p-3">
        <div className="mb-2 text-xs font-semibold">{t("consumablesH")}</div>
        <div className="mb-2 flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="consumablesMode"
              checked={value.consumablesMode === "lump"}
              onChange={() => set("consumablesMode", "lump")}
            />
            {t("modeLump")}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="consumablesMode"
              checked={value.consumablesMode === "percent"}
              onChange={() => set("consumablesMode", "percent")}
            />
            {t("modePercent")}
          </label>
        </div>
        {value.consumablesMode === "lump" ? (
          <NumField
            label={t("fieldConsumablesLump")}
            unit={t("unitNtd")}
            value={value.consumablesLump}
            onChange={(v) => set("consumablesLump", v)}
          />
        ) : (
          <NumField
            label={t("fieldConsumablesPercent")}
            unit={t("unitPct")}
            value={Math.round(value.consumablesPercent * 100)}
            onChange={(v) => set("consumablesPercent", v / 100)}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {quoteType === "ceiling" && (
          <NumField
            label={t("fieldPainting")}
            unit={t("unitPerPing")}
            value={value.paintingPerPing}
            onChange={(v) => set("paintingPerPing", v)}
          />
        )}
        <NumField
          label={t("fieldShipping")}
          unit={t("unitNtd")}
          value={value.shippingCost}
          onChange={(v) => set("shippingCost", v)}
        />
        <NumField
          label={t("fieldMargin")}
          unit={t("unitPct")}
          value={Math.round(value.marginRate * 100)}
          onChange={(v) => set("marginRate", v / 100)}
        />
        <NumField
          label={t("fieldDiscount")}
          unit={t("unitPct")}
          value={Math.round(value.discountRate * 100)}
          onChange={(v) => set("discountRate", Math.min(50, v) / 100)}
        />
        <NumField
          label={t("fieldDeposit")}
          unit={t("unitPct")}
          value={Math.round(value.depositRate * 100)}
          onChange={(v) => set("depositRate", Math.min(100, v) / 100)}
        />
        <NumField
          label={t("fieldValidity")}
          unit={t("unitDays")}
          value={value.validityDays}
          onChange={(v) => set("validityDays", v)}
        />
      </div>
    </div>
  );
}
