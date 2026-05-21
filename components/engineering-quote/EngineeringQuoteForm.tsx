"use client";

import type { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";

export type EngQuoteOpts = typeof ENGINEERING_QUOTE_DEFAULTS;

interface Props {
  quoteType: "floor" | "ceiling";
  value: EngQuoteOpts;
  onChange: (next: EngQuoteOpts) => void;
}

/** 一欄數字輸入 */
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
  const set = <K extends keyof EngQuoteOpts>(k: K, v: EngQuoteOpts[K]) =>
    onChange({ ...value, [k]: v });

  // 注意:vatRate(營業稅 5%)為法定固定值,不開放 UI 編輯。
  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${quoteType === "ceiling" ? "grid-cols-2" : "grid-cols-1"}`}>
        {quoteType === "ceiling" && (
          <NumField
            label="天花板每坪材料費"
            unit="元/坪"
            value={value.ceilingMaterialPerPing}
            onChange={(v) => set("ceilingMaterialPerPing", v)}
          />
        )}
        <NumField
          label="每坪施工費"
          unit="元/坪"
          value={value.laborPricePerPing}
          onChange={(v) => set("laborPricePerPing", v)}
        />
      </div>

      {/* 拆除清運 */}
      <div className="rounded border border-zinc-200 p-3">
        <div className="mb-2 text-xs font-semibold">拆除清運費</div>
        <div className="mb-2 flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="demolitionMode"
              checked={value.demolitionMode === "lump"}
              onChange={() => set("demolitionMode", "lump")}
            />
            定額
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="demolitionMode"
              checked={value.demolitionMode === "perPing"}
              onChange={() => set("demolitionMode", "perPing")}
            />
            每坪
          </label>
        </div>
        {value.demolitionMode === "lump" ? (
          <NumField
            label="拆除清運(定額)"
            unit="元"
            value={value.demolitionLump}
            onChange={(v) => set("demolitionLump", v)}
          />
        ) : (
          <NumField
            label="拆除清運(每坪)"
            unit="元/坪"
            value={value.demolitionPerPing}
            onChange={(v) => set("demolitionPerPing", v)}
          />
        )}
      </div>

      {/* 雜項耗材 */}
      <div className="rounded border border-zinc-200 p-3">
        <div className="mb-2 text-xs font-semibold">雜項耗材</div>
        <div className="mb-2 flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="consumablesMode"
              checked={value.consumablesMode === "lump"}
              onChange={() => set("consumablesMode", "lump")}
            />
            定額
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="consumablesMode"
              checked={value.consumablesMode === "percent"}
              onChange={() => set("consumablesMode", "percent")}
            />
            材料費 %
          </label>
        </div>
        {value.consumablesMode === "lump" ? (
          <NumField
            label="雜項耗材(定額)"
            unit="元"
            value={value.consumablesLump}
            onChange={(v) => set("consumablesLump", v)}
          />
        ) : (
          <NumField
            label="雜項耗材(材料費百分比)"
            unit="%"
            value={Math.round(value.consumablesPercent * 100)}
            onChange={(v) => set("consumablesPercent", v / 100)}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {quoteType === "ceiling" && (
          <NumField
            label="批土油漆"
            unit="元/坪"
            value={value.paintingPerPing}
            onChange={(v) => set("paintingPerPing", v)}
          />
        )}
        <NumField
          label="運費"
          unit="元"
          value={value.shippingCost}
          onChange={(v) => set("shippingCost", v)}
        />
        <NumField
          label="毛利率"
          unit="%"
          value={Math.round(value.marginRate * 100)}
          onChange={(v) => set("marginRate", v / 100)}
        />
        <NumField
          label="折扣率"
          unit="%"
          value={Math.round(value.discountRate * 100)}
          onChange={(v) => set("discountRate", Math.min(50, v) / 100)}
        />
        <NumField
          label="訂金比例"
          unit="%"
          value={Math.round(value.depositRate * 100)}
          onChange={(v) => set("depositRate", Math.min(100, v) / 100)}
        />
        <NumField
          label="報價有效天數"
          unit="天"
          value={value.validityDays}
          onChange={(v) => set("validityDays", v)}
        />
      </div>
    </div>
  );
}
