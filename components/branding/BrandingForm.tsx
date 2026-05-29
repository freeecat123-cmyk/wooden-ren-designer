"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { DEFAULT_BRANDING, DEFAULT_BRANDING_EN, useBranding } from "./branding";

const MAX_LOGO_BYTES = 300_000;

export function BrandingForm({
  defaultOpen = false,
}: { defaultOpen?: boolean } = {}) {
  const t = useTranslations("brandingForm");
  const locale = useLocale();
  const { data, hydrated, syncedAt, pendingPush, update, reset, flush } =
    useBranding();
  const [logoError, setLogoError] = useState<string>("");
  const [open, setOpen] = useState(defaultOpen);
  const [savePulse, setSavePulse] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  const handleManualSave = async () => {
    setSavePulse("saving");
    await flush();
    setSavePulse("saved");
    setTimeout(() => setSavePulse("idle"), 1500);
  };

  if (!hydrated) {
    return (
      <div className="mt-4 p-3 text-xs text-zinc-600 border border-dashed border-zinc-200 rounded">
        {t("loadingBranding")}
      </div>
    );
  }

  const handleField =
    (key: keyof typeof data) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      update({ [key]: e.target.value });
    };

  const handleLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    setLogoError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(t("logoErrType"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(t("logoErrSizeTpl", { limit: Math.round(MAX_LOGO_BYTES / 1024) }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        update({ logoDataUrl: result });
      }
    };
    reader.onerror = () => setLogoError(t("logoErrRead"));
    reader.readAsDataURL(file);
  };

  const clearLogo = () => update({ logoDataUrl: "" });

  const def = locale === "en" ? DEFAULT_BRANDING_EN : DEFAULT_BRANDING;
  const isDefault = JSON.stringify(data) === JSON.stringify(def);

  return (
    <section className="mt-3 rounded-lg border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50"
      >
        <span className="font-medium text-zinc-800">{t("headerH")}</span>
        <span className="text-xs text-zinc-700">
          {isDefault ? t("notCustomized") : t("customized")} ·{" "}
          {open ? t("collapse") : t("expand")}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-200 p-4 space-y-4">
          <div className="-mx-4 px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-3 flex-wrap">
            <SaveStatusBadge
              pendingPush={pendingPush}
              syncedAt={syncedAt}
              savePulse={savePulse}
            />
            <button
              type="button"
              onClick={handleManualSave}
              disabled={savePulse === "saving"}
              className={`text-xs px-3 py-1.5 rounded border transition ${
                savePulse === "saved"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-700 disabled:opacity-50"
              }`}
            >
              {savePulse === "saving"
                ? t("saving")
                : savePulse === "saved"
                  ? t("saved")
                  : t("saveNow")}
            </button>
          </div>
          <div>
            <label className="text-xs text-zinc-600 mb-1 block">{t("logoLabel")}</label>
            <div className="flex items-center gap-3">
              {data.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.logoDataUrl}
                  alt={t("logoAltPreview")}
                  width={56}
                  height={56}
                  className="object-contain border border-zinc-200 rounded bg-zinc-50"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/logo.png"
                  alt={t("logoAltDefault")}
                  width={56}
                  height={56}
                  className="object-contain border border-zinc-200 rounded bg-zinc-50 opacity-60"
                />
              )}
              <div className="flex flex-col gap-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogo}
                  className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-zinc-300 file:bg-white file:text-zinc-700 file:cursor-pointer hover:file:bg-zinc-50"
                />
                {data.logoDataUrl && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="self-start text-xs text-red-600 hover:underline"
                  >
                    {t("logoClear")}
                  </button>
                )}
              </div>
            </div>
            {logoError && (
              <p className="mt-1.5 text-xs text-red-600">{logoError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label={t("fieldCompanyZh")}
              value={data.companyNameZh}
              onChange={handleField("companyNameZh")}
              placeholder={t("phCompanyZh")}
            />
            <TextField
              label={t("fieldCompanyEn")}
              value={data.companyNameEn}
              onChange={handleField("companyNameEn")}
              placeholder={t("phCompanyEn")}
            />
            <TextField
              label={t("fieldTagline")}
              value={data.tagline}
              onChange={handleField("tagline")}
              placeholder={t("phTagline")}
            />
            <TextField
              label={t("fieldContact")}
              value={data.contact}
              onChange={handleField("contact")}
            />
            <TextField
              label={t("fieldAddress")}
              value={data.address}
              onChange={handleField("address")}
              colSpan2
            />
            <TextField
              label={t("fieldPhone")}
              value={data.phone}
              onChange={handleField("phone")}
            />
            <TextField
              label={t("fieldTaxId")}
              value={data.taxId}
              onChange={handleField("taxId")}
            />
            <TextField
              label={t("fieldEmail")}
              value={data.email}
              onChange={handleField("email")}
              colSpan2
            />
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-100">
            <label className="flex flex-col text-xs">
              <span className="text-zinc-600 mb-1 flex items-center gap-2">
                {t("publicUrlLabel")}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window === "undefined") return;
                    const origin = window.location.origin;
                    if (
                      /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
                        origin,
                      )
                    ) {
                      alert(t("captureLocalAlertTpl", { origin }));
                      return;
                    }
                    update({ publicBaseUrl: origin });
                  }}
                  className="text-[10px] text-sky-700 hover:text-sky-900 hover:underline"
                  title={t("captureCurrentTitle")}
                >
                  {t("captureCurrentUrl")}
                </button>
              </span>
              <input
                type="text"
                value={data.publicBaseUrl}
                onChange={handleField("publicBaseUrl")}
                placeholder={t("phPublicUrl")}
                className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-sm font-mono"
              />
              <span className="mt-0.5 text-[10px] text-zinc-600">
                {t("publicUrlHint")}
              </span>
            </label>
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-100">
            <p className="text-xs text-zinc-700 font-medium mb-2">{t("termsH")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextAreaField
                label={t("fieldPaymentTerms")}
                value={data.paymentTerms}
                onChange={handleField("paymentTerms")}
                rows={4}
                colSpan2
                hint={t("paymentTermsHint")}
              />
              <TextField
                label={t("fieldBankName")}
                value={data.bankName}
                onChange={handleField("bankName")}
                placeholder={t("phBankName")}
              />
              <TextField
                label={t("fieldBankAccount")}
                value={data.bankAccount}
                onChange={handleField("bankAccount")}
                placeholder={t("phBankAccount")}
              />
              <div className="md:col-span-2">
                <InstallmentsEditor
                  value={data.paymentInstallments}
                  onChange={(next) => update({ paymentInstallments: next })}
                />
              </div>
              <TextField
                label={t("fieldWarranty")}
                value={data.warranty}
                onChange={handleField("warranty")}
              />
              <TextField
                label={t("fieldAfterSales")}
                value={data.afterSales}
                onChange={handleField("afterSales")}
              />
              <TextAreaField
                label={t("fieldNotes")}
                value={data.notes}
                onChange={handleField("notes")}
                rows={5}
                colSpan2
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("confirmReset"))) {
                  reset();
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-800 hover:underline"
            >
              {t("resetAll")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  colSpan2,
  hint,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  colSpan2?: boolean;
  hint?: string;
}) {
  return (
    <label
      className={`flex flex-col text-xs ${
        colSpan2 ? "md:col-span-2" : ""
      }`}
    >
      <span className="text-zinc-600 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-sm"
      />
      {hint && (
        <span className="mt-0.5 text-[10px] text-zinc-600">{hint}</span>
      )}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
  colSpan2,
  hint,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  colSpan2?: boolean;
  hint?: string;
}) {
  return (
    <label
      className={`flex flex-col text-xs ${
        colSpan2 ? "md:col-span-2" : ""
      }`}
    >
      <span className="text-zinc-600 mb-1">{label}</span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows ?? 3}
        className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-sm font-sans leading-relaxed resize-y"
      />
      {hint && (
        <span className="mt-0.5 text-[10px] text-zinc-600">{hint}</span>
      )}
    </label>
  );
}

function SaveStatusBadge({
  pendingPush,
  syncedAt,
  savePulse,
}: {
  pendingPush: boolean;
  syncedAt: number | null;
  savePulse: "idle" | "saving" | "saved";
}) {
  const t = useTranslations("brandingForm");
  if (savePulse === "saving") {
    return (
      <span className="text-xs text-amber-700 font-medium">
        {t("statusSyncing")}
      </span>
    );
  }
  if (savePulse === "saved") {
    return (
      <span className="text-xs text-emerald-700 font-medium">
        {t("statusSyncedSaved")}
      </span>
    );
  }
  if (pendingPush) {
    return (
      <span className="text-xs text-amber-700">
        {t("statusPendingPush")}
      </span>
    );
  }
  if (syncedAt) {
    const ts = new Date(syncedAt).toLocaleTimeString();
    return (
      <span className="text-xs text-emerald-700">
        {t("statusSyncedAtTpl", { time: ts })}
      </span>
    );
  }
  return (
    <span className="text-xs text-zinc-700">
      {t("statusLocalOnly")}
    </span>
  );
}

function buildInstallmentPresets(
  t: ReturnType<typeof useTranslations<"brandingForm.installments">>,
): Record<number, Array<{ label: string; ratio: number }>> {
  return {
    1: [{ label: t("presetFull"), ratio: 1 }],
    2: [
      { label: t("presetDeposit"), ratio: 0.5 },
      { label: t("presetBalance"), ratio: 0.5 },
    ],
    3: [
      { label: t("presetDeposit"), ratio: 0.3 },
      { label: t("presetMid"), ratio: 0.4 },
      { label: t("presetBalance"), ratio: 0.3 },
    ],
    4: [
      { label: t("presetDeposit"), ratio: 0.25 },
      { label: t("presetMaterial"), ratio: 0.25 },
      { label: t("presetWoodDone"), ratio: 0.25 },
      { label: t("presetBalance"), ratio: 0.25 },
    ],
    5: [
      { label: t("presetDeposit"), ratio: 0.2 },
      { label: t("presetMaterial"), ratio: 0.2 },
      { label: t("presetWoodDone"), ratio: 0.2 },
      { label: t("presetFinishDone"), ratio: 0.2 },
      { label: t("presetBalance"), ratio: 0.2 },
    ],
  };
}

function InstallmentsEditor({
  value,
  onChange,
}: {
  value: Array<{ label: string; ratio: number }>;
  onChange: (next: Array<{ label: string; ratio: number }>) => void;
}) {
  const t = useTranslations("brandingForm.installments");
  const PRESETS = buildInstallmentPresets(t);
  const enabled = value.length > 0;
  const totalPct = value.reduce((s, r) => s + r.ratio * 100, 0);
  const totalDelta = Math.abs(totalPct - 100);
  const totalOk = !enabled || totalDelta < 0.5;

  return (
    <div className="border border-zinc-200 rounded p-3 bg-zinc-50/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-700 font-medium">{t("h")}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-zinc-700">{t("dividerLbl")}</span>
          {([0, 1, 2, 3, 4, 5] as const).map((n) => {
            const active = n === 0 ? !enabled : value.length === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  if (n === 0) {
                    onChange([]);
                  } else {
                    onChange(PRESETS[n].map((r) => ({ ...r })));
                  }
                }}
                className={`text-[11px] px-2 py-0.5 rounded border transition ${
                  active
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                }`}
              >
                {n === 0 ? t("noInstall") : t("nPeriodsTpl", { n })}
              </button>
            );
          })}
        </div>
      </div>
      {!enabled && (
        <p className="text-[10px] text-zinc-600 leading-relaxed">{t("intro")}</p>
      )}
      {enabled && (
        <>
          <div className="space-y-1.5">
            {value.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600 font-mono w-6">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => {
                    const next = value.slice();
                    next[idx] = { ...row, label: e.target.value };
                    onChange(next);
                  }}
                  placeholder={t("labelPh")}
                  className="flex-1 border border-zinc-300 rounded px-2 py-1 bg-white text-zinc-900 text-sm"
                />
                <input
                  type="number"
                  value={Math.round(row.ratio * 1000) / 10}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    if (!Number.isFinite(pct)) return;
                    const next = value.slice();
                    next[idx] = { ...row, ratio: pct / 100 };
                    onChange(next);
                  }}
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-16 border border-zinc-300 rounded px-2 py-1 bg-white text-zinc-900 text-sm text-right"
                />
                <span className="text-xs text-zinc-700">%</span>
              </div>
            ))}
          </div>
          <p
            className={`mt-2 text-[10px] ${
              totalOk ? "text-zinc-700" : "text-rose-700 font-semibold"
            }`}
          >
            {t("totalTpl", { pct: totalPct.toFixed(1) })}
            {!totalOk && t("deltaTpl", { delta: (100 - totalPct).toFixed(1) })}
          </p>
        </>
      )}
    </div>
  );
}
