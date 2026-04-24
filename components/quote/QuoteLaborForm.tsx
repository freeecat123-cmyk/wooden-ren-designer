"use client";

import { useRouter } from "next/navigation";
import { useRef, useCallback, useState } from "react";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { LABOR_BOUNDS } from "@/lib/pricing/labor";
import type { CustomerInfo } from "@/components/customer/customer";

const PRESETS = [
  {
    label: "標準接案",
    emoji: "🪑",
    values: { marginRate: "0.30", hourlyRate: "500", equipmentRate: "50", discountRate: "0", overrideUnitPrice: "0" },
  },
  {
    label: "競標低利",
    emoji: "📉",
    values: { marginRate: "0.15", hourlyRate: "500", equipmentRate: "50", discountRate: "0", overrideUnitPrice: "0" },
  },
  {
    label: "精品高利",
    emoji: "✨",
    values: { marginRate: "0.45", hourlyRate: "650", equipmentRate: "80", discountRate: "0", overrideUnitPrice: "0" },
  },
] as const;

type Defaults = {
  hourlyRate: number;
  equipmentRate: number;
  consumables: number;
  finishingCost: number;
  shippingCost: number;
  installationCost: number;
  hardwareCost: number;
  marginRate: number;
  vatRate: number;
  quantity: number;
  discountRate: number;
  expiryDays: number;
  depositRate: number;
  bufferDays: number;
  overrideUnitPrice: number;
  primaryMaterialPricePerBdft: number;
  plywoodPricePerBdft: number | null;
  mdfPricePerBdft: number | null;
};

export function QuoteLaborForm({
  type,
  designQuery,
  defaults,
  primaryMaterialName,
  initialCustomer,
  terms,
}: {
  type: string;
  designQuery: string;
  defaults: Defaults;
  primaryMaterialName: string;
  initialCustomer: CustomerInfo;
  terms: { termIncludeShipping: boolean; termIncludeInstallation: boolean };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pending, setPending] = useState(false);

  const pushURL = useCallback(() => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const params = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      params.set(k, v as string);
    }
    // Unchecked checkboxes are absent from FormData — remove them so server sees no value
    formRef.current.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      if (!cb.checked) params.delete(cb.name);
    });
    setPending(false);
    router.replace(`/design/${type}/quote?${params.toString()}`);
  }, [type, router]);

  const handleChange = useCallback(() => {
    setPending(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(pushURL, 600);
  }, [pushURL]);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    Object.entries(preset.values).forEach(([k, v]) => params.set(k, v));
    router.replace(`/design/${type}/quote?${params.toString()}`);
  };

  const designParams = Object.fromEntries(new URLSearchParams(designQuery)) as Record<string, string>;

  return (
    <form
      ref={formRef}
      onChange={handleChange}
      method="get"
      action={`/design/${type}/quote`}
      className="rounded-lg border border-zinc-200 bg-white p-4"
    >
      {Object.entries(designParams).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {/* 快速預設 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500 font-medium">快速套入：</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="text-xs px-3 py-1 rounded-full border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition-colors"
          >
            {p.emoji} {p.label}
          </button>
        ))}
        {pending && (
          <span className="text-xs text-zinc-400 ml-1 animate-pulse">更新中…</span>
        )}
      </div>

      <div className="mb-4 pb-4 border-b border-zinc-100">
        <CustomerForm initial={initialCustomer} />
      </div>

      <fieldset className="mb-3 p-3 rounded-md bg-emerald-50 border-2 border-emerald-300">
        <legend className="text-sm text-emerald-800 font-semibold px-2">
          ✅ 附加條款（會印到 PDF 備註區）
        </legend>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="termIncludeShipping"
              value="1"
              defaultChecked={terms.termIncludeShipping}
              className="w-5 h-5"
            />
            <span className="font-medium">🚚 報價含運費</span>
            <span className="text-[10px] text-zinc-500">（不勾會印「運費另計」）</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="termIncludeInstallation"
              value="1"
              defaultChecked={terms.termIncludeInstallation}
              className="w-5 h-5"
            />
            <span className="font-medium">🔧 含現場安裝</span>
            <span className="text-[10px] text-zinc-500">（不勾會印「不含安裝」）</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="mb-3 p-2 rounded bg-amber-50 border border-amber-200">
        <legend className="text-xs text-amber-800 mb-1 font-medium px-1">
          💰 議價覆寫（留 0 = 沿用成本加成）
        </legend>
        <div className="grid grid-cols-1">
          <NumField
            name="overrideUnitPrice"
            label="單件最終價 NT$（未稅）"
            value={defaults.overrideUnitPrice}
            min={LABOR_BOUNDS.overrideUnitPrice.min}
            max={LABOR_BOUNDS.overrideUnitPrice.max}
            step={LABOR_BOUNDS.overrideUnitPrice.step}
            hint="例：客戶砍到 NT$25,000，填 25000 → 成本明細保留、毛利自動反算"
          />
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend className="text-xs text-zinc-500 mb-1.5 font-medium">
          數量 / 折扣 / 有效期 / 訂金 / 交期
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <NumField name="quantity" label="數量" value={defaults.quantity} min={LABOR_BOUNDS.quantity.min} max={LABOR_BOUNDS.quantity.max} step={LABOR_BOUNDS.quantity.step} />
          <NumField name="discountRate" label="折扣率（0–50%）" value={defaults.discountRate} min={LABOR_BOUNDS.discountRate.min} max={LABOR_BOUNDS.discountRate.max} step={LABOR_BOUNDS.discountRate.step} decimal hint="0.05 = 95 折；0 表示無折扣" />
          <NumField name="expiryDays" label="有效期（天）" value={defaults.expiryDays} min={LABOR_BOUNDS.expiryDays.min} max={LABOR_BOUNDS.expiryDays.max} step={LABOR_BOUNDS.expiryDays.step} />
          <NumField name="depositRate" label="訂金比例" value={defaults.depositRate} min={LABOR_BOUNDS.depositRate.min} max={LABOR_BOUNDS.depositRate.max} step={LABOR_BOUNDS.depositRate.step} decimal hint="0.5 = 50%；0 表示不收訂金" />
          <NumField name="bufferDays" label="塗裝/出貨緩衝（天）" value={defaults.bufferDays} min={LABOR_BOUNDS.bufferDays.min} max={LABOR_BOUNDS.bufferDays.max} step={LABOR_BOUNDS.bufferDays.step} hint="乾燥+出貨，併入交期" />
        </div>
      </fieldset>

      {/* 進階成本設定（折疊） */}
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-zinc-500 hover:text-zinc-800 flex items-center gap-1.5 transition-colors"
        >
          <span>{showAdvanced ? "▲" : "▼"}</span>
          <span>進階成本設定（材料單價、工資）</span>
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
            <fieldset>
              <legend className="text-xs text-zinc-500 mb-1.5 font-medium">
                材料單價（NT$/板才）
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumField name="primaryMaterialPricePerBdft" label={`${primaryMaterialName}（主材）`} value={defaults.primaryMaterialPricePerBdft} min={LABOR_BOUNDS.primaryMaterialPricePerBdft.min} max={LABOR_BOUNDS.primaryMaterialPricePerBdft.max} step={LABOR_BOUNDS.primaryMaterialPricePerBdft.step} />
                <NumField name="plywoodPricePerBdft" label="夾板（背板/抽屜底）" value={defaults.plywoodPricePerBdft} min={LABOR_BOUNDS.plywoodPricePerBdft.min} max={LABOR_BOUNDS.plywoodPricePerBdft.max} step={LABOR_BOUNDS.plywoodPricePerBdft.step} optional hint="留空則併入主材" />
                <NumField name="mdfPricePerBdft" label="中纖板（抽屜側背）" value={defaults.mdfPricePerBdft} min={LABOR_BOUNDS.mdfPricePerBdft.min} max={LABOR_BOUNDS.mdfPricePerBdft.max} step={LABOR_BOUNDS.mdfPricePerBdft.step} optional hint="留空則併入主材" />
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs text-zinc-500 mb-1.5 font-medium">
                工資 / 其他
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <NumField name="hourlyRate" label="師傅時薪 (NT$/hr)" value={defaults.hourlyRate} min={LABOR_BOUNDS.hourlyRate.min} max={LABOR_BOUNDS.hourlyRate.max} step={LABOR_BOUNDS.hourlyRate.step} />
                <NumField name="equipmentRate" label="設備折舊 (NT$/hr)" value={defaults.equipmentRate} min={LABOR_BOUNDS.equipmentRate.min} max={LABOR_BOUNDS.equipmentRate.max} step={LABOR_BOUNDS.equipmentRate.step} />
                <NumField name="consumables" label="耗材 (NT$)" value={defaults.consumables} min={LABOR_BOUNDS.consumables.min} max={LABOR_BOUNDS.consumables.max} step={LABOR_BOUNDS.consumables.step} />
                <NumField name="finishingCost" label="塗裝費 (NT$)" value={defaults.finishingCost} min={LABOR_BOUNDS.finishingCost.min} max={LABOR_BOUNDS.finishingCost.max} step={LABOR_BOUNDS.finishingCost.step} />
                <NumField name="hardwareCost" label="五金 (NT$)" value={defaults.hardwareCost} min={LABOR_BOUNDS.hardwareCost.min} max={LABOR_BOUNDS.hardwareCost.max} step={LABOR_BOUNDS.hardwareCost.step} />
                <NumField name="shippingCost" label="運費 (NT$)" value={defaults.shippingCost} min={LABOR_BOUNDS.shippingCost.min} max={LABOR_BOUNDS.shippingCost.max} step={LABOR_BOUNDS.shippingCost.step} />
                <NumField name="installationCost" label="安裝費 (NT$)" value={defaults.installationCost} min={LABOR_BOUNDS.installationCost.min} max={LABOR_BOUNDS.installationCost.max} step={LABOR_BOUNDS.installationCost.step} />
                <NumField name="marginRate" label="毛利率" value={defaults.marginRate} min={LABOR_BOUNDS.marginRate.min} max={LABOR_BOUNDS.marginRate.max} step={LABOR_BOUNDS.marginRate.step} decimal />
                <NumField name="vatRate" label="營業稅率" value={defaults.vatRate} min={LABOR_BOUNDS.vatRate.min} max={LABOR_BOUNDS.vatRate.max} step={LABOR_BOUNDS.vatRate.step} decimal />
              </div>
            </fieldset>
          </div>
        )}
      </div>

      <button
        type="submit"
        className="mt-1 px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
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
  const display = value == null ? "" : decimal ? value.toFixed(2) : String(value);
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-600 mb-1">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={display}
        min={optional ? 0 : min}
        max={max}
        step={step}
        inputMode="decimal"
        placeholder={optional ? "（不填 / 0＝併入主材）" : undefined}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
      />
      {hint && <span className="mt-0.5 text-[10px] text-zinc-400">{hint}</span>}
    </label>
  );
}
