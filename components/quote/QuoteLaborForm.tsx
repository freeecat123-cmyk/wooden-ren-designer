"use client";

import { useRouter } from "next/navigation";
import { useRef, useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { LABOR_BOUNDS } from "@/lib/pricing/labor";
import type { CustomerInfo } from "@/components/customer/customer";

type Defaults = {
  hourlyRate: number;
  equipmentRate: number;
  consumables: number;
  finishingCost: number;
  shippingCost: number;
  installationCost: number;
  hardwareCost: number;
  marginRate: number;
  designerMarkupRate: number;
  vatRate: number;
  quantity: number;
  discountRate: number;
  expiryDays: number;
  depositRate: number;
  bufferDays: number;
  overrideUnitPrice: number;
  laborHoursOverride: number;
  deliveryDaysOverride: number;
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
  viewMode,
  quotedAt,
  autoLaborHours,
}: {
  type: string;
  designQuery: string;
  defaults: Defaults;
  primaryMaterialName: string;
  initialCustomer: CustomerInfo;
  terms: { termIncludeShipping: boolean; termIncludeInstallation: boolean };
  viewMode: "customer" | "internal";
  quotedAt: string;
  autoLaborHours: number;
}) {
  const t = useTranslations("quoteLaborForm");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pending, setPending] = useState(false);

  const PRESETS = [
    {
      label: t("presetStandard"),
      emoji: "🪑",
      values: { marginRate: "0.30", hourlyRate: "500", equipmentRate: "50", discountRate: "0", overrideUnitPrice: "0" },
    },
    {
      label: t("presetLow"),
      emoji: "📉",
      values: { marginRate: "0.15", hourlyRate: "500", equipmentRate: "50", discountRate: "0", overrideUnitPrice: "0" },
    },
    {
      label: t("presetHigh"),
      emoji: "✨",
      values: { marginRate: "0.45", hourlyRate: "650", equipmentRate: "80", discountRate: "0", overrideUnitPrice: "0" },
    },
  ] as const;

  const pushURL = useCallback((customerOverride?: CustomerInfo) => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const params = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      params.set(k, v as string);
    }
    formRef.current.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
      if (!cb.checked) params.delete(cb.name);
    });
    if (customerOverride) {
      params.set("customerName", customerOverride.name);
      params.set("customerContact", customerOverride.contact);
      params.set("customerPhone", customerOverride.phone);
      params.set("customerAddress", customerOverride.address);
      params.set("customerTaxId", customerOverride.taxId);
      params.set("customerEmail", customerOverride.email);
    }
    setPending(false);
    router.replace(`/${locale}/design/${type}/quote?${params.toString()}`, { scroll: false });
  }, [type, router]);

  const handleChange = useCallback(() => {
    setPending(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => pushURL(), 600);
  }, [pushURL]);

  const handleCustomerApply = useCallback(
    (next: CustomerInfo) => {
      clearTimeout(timerRef.current);
      pushURL(next);
    },
    [pushURL],
  );

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    Object.entries(preset.values).forEach(([k, v]) => params.set(k, v));
    router.replace(`/${locale}/design/${type}/quote?${params.toString()}`, { scroll: false });
  };

  const designParams = Object.fromEntries(new URLSearchParams(designQuery)) as Record<string, string>;

  return (
    <form
      id="quote-labor-form"
      ref={formRef}
      onChange={handleChange}
      method="get"
      action={`/${locale}/design/${type}/quote`}
      className="rounded-lg border border-zinc-200 bg-white p-4"
    >
      {Object.entries(designParams).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="viewMode" value={viewMode} />
      <input type="hidden" name="quotedAt" value={quotedAt} />

      <CustomerForm initial={initialCustomer} onApply={handleCustomerApply} />

      <fieldset className="mt-5 pt-4 border-t border-zinc-200">
        <div className="flex items-baseline justify-between mb-2">
          <legend className="text-xs text-zinc-700 font-medium">
            {t("termsLegend")}
          </legend>
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span>{t("presetLabel")}</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2 py-0.5 rounded-full border border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition-colors text-[11px] text-zinc-700"
              >
                {p.emoji} {p.label}
              </button>
            ))}
            {pending && (
              <span className="text-zinc-600 animate-pulse ml-1">{t("pending")}</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NumField
            name="overrideUnitPrice"
            label={t("fieldOverridePrice")}
            value={defaults.overrideUnitPrice}
            min={LABOR_BOUNDS.overrideUnitPrice.min}
            max={LABOR_BOUNDS.overrideUnitPrice.max}
            step={LABOR_BOUNDS.overrideUnitPrice.step}
            hint={t("fieldOverridePriceHint")}
            optionalPlaceholder={t("optionalPlaceholder")}
          />
          <NumField
            name="quantity"
            label={t("fieldQuantity")}
            value={defaults.quantity}
            min={LABOR_BOUNDS.quantity.min}
            max={LABOR_BOUNDS.quantity.max}
            step={LABOR_BOUNDS.quantity.step}
            optionalPlaceholder={t("optionalPlaceholder")}
          />
          <NumField
            name="discountRate"
            label={t("fieldDiscountRate")}
            value={defaults.discountRate}
            min={LABOR_BOUNDS.discountRate.min}
            max={LABOR_BOUNDS.discountRate.max}
            step={LABOR_BOUNDS.discountRate.step}
            percent
            hint={t("fieldDiscountRateHint")}
            optionalPlaceholder={t("optionalPlaceholder")}
          />
          <NumField
            name="depositRate"
            label={t("fieldDepositRate")}
            value={defaults.depositRate}
            min={LABOR_BOUNDS.depositRate.min}
            max={LABOR_BOUNDS.depositRate.max}
            step={LABOR_BOUNDS.depositRate.step}
            percent
            optionalPlaceholder={t("optionalPlaceholder")}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              name="termIncludeShipping"
              value="1"
              defaultChecked={terms.termIncludeShipping}
              className="w-4 h-4"
            />
            <span>{t("termShipping")}</span>
            <span className="text-[10px] text-zinc-600">{t("termPdfNote")}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              name="termIncludeInstallation"
              value="1"
              defaultChecked={terms.termIncludeInstallation}
              className="w-4 h-4"
            />
            <span>{t("termInstall")}</span>
            <span className="text-[10px] text-zinc-600">{t("termPdfNote")}</span>
          </label>
        </div>
      </fieldset>

      <div className="mt-4 pt-3 border-t border-zinc-100">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-zinc-700 hover:text-zinc-800 flex items-center gap-1.5 transition-colors"
        >
          <span>{showAdvanced ? "▲" : "▼"}</span>
          <span>{t("advancedToggle")}</span>
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4">
            <fieldset>
              <legend className="text-xs text-zinc-700 mb-1.5 font-medium">
                {t("validityLegend")}
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumField name="expiryDays" label={t("fieldExpiryDays")} value={defaults.expiryDays} min={LABOR_BOUNDS.expiryDays.min} max={LABOR_BOUNDS.expiryDays.max} step={LABOR_BOUNDS.expiryDays.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField
                  name="deliveryDaysOverride"
                  label={t("fieldDeliveryDays")}
                  value={defaults.deliveryDaysOverride}
                  min={LABOR_BOUNDS.deliveryDaysOverride.min}
                  max={LABOR_BOUNDS.deliveryDaysOverride.max}
                  step={LABOR_BOUNDS.deliveryDaysOverride.step}
                  hint={autoLaborHours > 0 ? t("fieldDeliveryDaysHintAuto") : t("fieldDeliveryDaysHintNoAuto")}
                  optionalPlaceholder={t("optionalPlaceholder")}
                />
                <NumField name="bufferDays" label={t("fieldBufferDays")} value={defaults.bufferDays} min={LABOR_BOUNDS.bufferDays.min} max={LABOR_BOUNDS.bufferDays.max} step={LABOR_BOUNDS.bufferDays.step} hint={t("fieldBufferDaysHint")} optionalPlaceholder={t("optionalPlaceholder")} />
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs text-zinc-700 mb-1.5 font-medium">
                {t("materialLegend")}
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumField name="primaryMaterialPricePerBdft" label={t("primaryMaterialLabelTpl", { name: primaryMaterialName })} value={defaults.primaryMaterialPricePerBdft} min={LABOR_BOUNDS.primaryMaterialPricePerBdft.min} max={LABOR_BOUNDS.primaryMaterialPricePerBdft.max} step={LABOR_BOUNDS.primaryMaterialPricePerBdft.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="plywoodPricePerBdft" label={t("fieldPlywood")} value={defaults.plywoodPricePerBdft} min={LABOR_BOUNDS.plywoodPricePerBdft.min} max={LABOR_BOUNDS.plywoodPricePerBdft.max} step={LABOR_BOUNDS.plywoodPricePerBdft.step} optional hint={t("matOptionalHint")} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="mdfPricePerBdft" label={t("fieldMdf")} value={defaults.mdfPricePerBdft} min={LABOR_BOUNDS.mdfPricePerBdft.min} max={LABOR_BOUNDS.mdfPricePerBdft.max} step={LABOR_BOUNDS.mdfPricePerBdft.step} optional hint={t("matOptionalHint")} optionalPlaceholder={t("optionalPlaceholder")} />
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs text-zinc-700 mb-1.5 font-medium">
                {t("laborLegend")}
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumField name="hourlyRate" label={t("fieldHourlyRate")} value={defaults.hourlyRate} min={LABOR_BOUNDS.hourlyRate.min} max={LABOR_BOUNDS.hourlyRate.max} step={LABOR_BOUNDS.hourlyRate.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="laborHoursOverride" label={t("fieldHoursOverrideTpl", { hours: autoLaborHours.toFixed(1) })} value={defaults.laborHoursOverride} min={LABOR_BOUNDS.laborHoursOverride.min} max={LABOR_BOUNDS.laborHoursOverride.max} step={LABOR_BOUNDS.laborHoursOverride.step} decimal hint={t("fieldHoursOverrideHintTpl", { hours: autoLaborHours.toFixed(1) })} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="equipmentRate" label={t("fieldEquipment")} value={defaults.equipmentRate} min={LABOR_BOUNDS.equipmentRate.min} max={LABOR_BOUNDS.equipmentRate.max} step={LABOR_BOUNDS.equipmentRate.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="consumables" label={t("fieldConsumables")} value={defaults.consumables} min={LABOR_BOUNDS.consumables.min} max={LABOR_BOUNDS.consumables.max} step={LABOR_BOUNDS.consumables.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="finishingCost" label={t("fieldFinishing")} value={defaults.finishingCost} min={LABOR_BOUNDS.finishingCost.min} max={LABOR_BOUNDS.finishingCost.max} step={LABOR_BOUNDS.finishingCost.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="hardwareCost" label={t("fieldHardware")} value={defaults.hardwareCost} min={LABOR_BOUNDS.hardwareCost.min} max={LABOR_BOUNDS.hardwareCost.max} step={LABOR_BOUNDS.hardwareCost.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="shippingCost" label={t("fieldShipping")} value={defaults.shippingCost} min={LABOR_BOUNDS.shippingCost.min} max={LABOR_BOUNDS.shippingCost.max} step={LABOR_BOUNDS.shippingCost.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="installationCost" label={t("fieldInstall")} value={defaults.installationCost} min={LABOR_BOUNDS.installationCost.min} max={LABOR_BOUNDS.installationCost.max} step={LABOR_BOUNDS.installationCost.step} optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="marginRate" label={t("fieldMargin")} value={defaults.marginRate} min={LABOR_BOUNDS.marginRate.min} max={LABOR_BOUNDS.marginRate.max} step={LABOR_BOUNDS.marginRate.step} percent optionalPlaceholder={t("optionalPlaceholder")} />
                <NumField name="vatRate" label={t("fieldVat")} value={defaults.vatRate} min={LABOR_BOUNDS.vatRate.min} max={LABOR_BOUNDS.vatRate.max} step={LABOR_BOUNDS.vatRate.step} percent optionalPlaceholder={t("optionalPlaceholder")} />
              </div>
            </fieldset>
            <fieldset className="rounded-lg border-2 border-amber-200 bg-amber-50/40 p-3">
              <legend className="text-xs text-amber-900 px-1.5 font-semibold">
                {t("designerLegend")}
              </legend>
              <p className="text-[10px] text-amber-700 mb-2 leading-relaxed">
                {t("designerHelp")}
                <br />
                {t("designerHelp2")}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumField
                  name="designerMarkupRate"
                  label={t("fieldDesignerMarkup")}
                  value={defaults.designerMarkupRate}
                  min={LABOR_BOUNDS.designerMarkupRate.min}
                  max={LABOR_BOUNDS.designerMarkupRate.max}
                  step={LABOR_BOUNDS.designerMarkupRate.step}
                  percent
                  hint={t("fieldDesignerMarkupHint")}
                  optionalPlaceholder={t("optionalPlaceholder")}
                />
              </div>
            </fieldset>
          </div>
        )}
      </div>
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
  percent,
  optionalPlaceholder,
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
  /** percent 模式：value 是 0-1 fraction，UI 顯示 × 100 帶 % 後綴；submit
   *  仍寫 fraction（hidden input） */
  percent?: boolean;
  optionalPlaceholder?: string;
}) {
  if (percent) {
    return <PercentField name={name} label={label} value={value} min={min} max={max} step={step} hint={hint} />;
  }
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
        placeholder={optional ? optionalPlaceholder : undefined}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-base"
      />
      {hint && <span className="mt-0.5 text-[10px] text-zinc-600">{hint}</span>}
    </label>
  );
}

function PercentField({
  name,
  label,
  value,
  min,
  max,
  step,
  hint,
}: {
  name: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  hint?: string;
}) {
  const [frac, setFrac] = useState<number>(value ?? 0);
  const displayPct = (frac * 100).toFixed(frac * 100 < 10 ? 1 : 0);
  const minPct = min * 100;
  const maxPct = max * 100;
  const stepPct = Math.max(0.5, step * 100);
  return (
    <label className="flex flex-col text-xs">
      <span className="text-zinc-600 mb-1">{label}</span>
      <div className="relative">
        <input
          type="number"
          defaultValue={displayPct}
          min={minPct}
          max={maxPct}
          step={stepPct}
          inputMode="decimal"
          onChange={(e) => {
            const pct = Number(e.target.value);
            if (Number.isFinite(pct)) setFrac(pct / 100);
          }}
          className="border border-zinc-300 rounded px-2 pr-7 py-1.5 bg-white text-zinc-900 text-base w-full"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-sm pointer-events-none">%</span>
      </div>
      <input type="hidden" name={name} value={frac} />
      {hint && <span className="mt-0.5 text-[10px] text-zinc-600">{hint}</span>}
    </label>
  );
}
