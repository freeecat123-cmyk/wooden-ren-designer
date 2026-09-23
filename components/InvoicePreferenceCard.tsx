"use client";

/**
 * 發票偏好設定卡片（嵌進 /my-subscription）
 *
 * - 個人：手機條碼載具 / 綠界會員載具
 * - 公司：統編 + 抬頭（給需要報帳的客戶）
 * - email 預設用註冊信箱，可改
 *
 * 儲存後下次刷卡 issue-invoice-for-payment 會自動套用。
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type InvoiceType = "personal" | "company";
type CarrierType = "mobile" | "member";

interface PreferenceState {
  type: InvoiceType;
  taxId: string;
  title: string;
  carrierType: CarrierType;
  carrierNum: string;
  email: string;
}

const DEFAULT_STATE: PreferenceState = {
  type: "personal",
  taxId: "",
  title: "",
  carrierType: "member",
  carrierNum: "",
  email: "",
};

const MOBILE_CARRIER_REGEX = /^\/[0-9A-Z+\-.]{7}$/;
const TAX_ID_REGEX = /^\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InvoicePreferenceCard() {
  const t = useTranslations("invoicePref");
  const [state, setState] = useState<PreferenceState>(DEFAULT_STATE);
  const [defaultEmail, setDefaultEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/invoice-preference", { credentials: "include" });
        if (!r.ok) {
          setLoading(false);
          return;
        }
        const json = await r.json();
        setDefaultEmail(json.defaultEmail);
        if (json.preference) {
          const p = json.preference;
          setState({
            type: p.type ?? "personal",
            taxId: p.taxId ?? "",
            title: p.title ?? "",
            carrierType: p.carrierType ?? "member",
            carrierNum: p.carrierNum ?? "",
            email: p.email ?? "",
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(async () => {
    setError(null);
    setSaved(false);

    if (state.type === "company") {
      if (!TAX_ID_REGEX.test(state.taxId)) {
        setError(t("errTaxId"));
        return;
      }
      if (state.title.trim().length === 0) {
        setError(t("errTitle"));
        return;
      }
    } else if (state.carrierType === "mobile") {
      if (!MOBILE_CARRIER_REGEX.test(state.carrierNum)) {
        setError(t("errCarrier"));
        return;
      }
    }
    if (state.email && !EMAIL_REGEX.test(state.email)) {
      setError(t("errEmail"));
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = { type: state.type };
      if (state.type === "company") {
        body.taxId = state.taxId;
        body.title = state.title.trim();
      } else {
        body.carrierType = state.carrierType;
        if (state.carrierType === "mobile") body.carrierNum = state.carrierNum;
      }
      if (state.email) body.email = state.email;

      const r = await fetch("/api/invoice-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json.error ?? t("errSaveFallback"));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errNetwork"));
    } finally {
      setSaving(false);
    }
  }, [state, t]);

  if (loading) {
    return (
      <div className="mt-6 rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">{t("h")}</h2>
        {saved && <span className="text-xs text-emerald-600">{t("saved")}</span>}
      </div>
      <p className="mb-3 text-xs text-zinc-500 leading-relaxed">{t("intro")}</p>

      <div className="mb-3 inline-flex rounded-lg bg-zinc-100 p-0.5">
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, type: "personal" }))}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            state.type === "personal"
              ? "bg-white shadow text-zinc-900"
              : "text-zinc-600"
          }`}
        >
          {t("tabPersonal")}
        </button>
        <button
          type="button"
          onClick={() => setState((s) => ({ ...s, type: "company" }))}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            state.type === "company"
              ? "bg-white shadow text-zinc-900"
              : "text-zinc-600"
          }`}
        >
          {t("tabCompany")}
        </button>
      </div>

      {state.type === "personal" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              {t("lblCarrierType")}
            </label>
            <div className="flex gap-2 flex-wrap">
              <label className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="carrierType"
                  checked={state.carrierType === "member"}
                  onChange={() => setState((s) => ({ ...s, carrierType: "member" }))}
                />
                {t("carrierMember")}
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="carrierType"
                  checked={state.carrierType === "mobile"}
                  onChange={() => setState((s) => ({ ...s, carrierType: "mobile" }))}
                />
                {t("carrierMobile")}
              </label>
            </div>
          </div>

          {state.carrierType === "mobile" && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {t("lblCarrierNum")}
              </label>
              <input
                type="text"
                value={state.carrierNum}
                onChange={(e) =>
                  setState((s) => ({ ...s, carrierNum: e.target.value.toUpperCase() }))
                }
                placeholder="/ABC+123"
                maxLength={8}
                className="w-full sm:w-64 rounded border border-zinc-300 px-2.5 py-1.5 text-sm font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-1">{t("carrierHint")}</p>
            </div>
          )}
        </div>
      )}

      {state.type === "company" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              {t("lblTaxId")}
            </label>
            <input
              type="text"
              value={state.taxId}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  taxId: e.target.value.replace(/\D/g, "").slice(0, 8),
                }))
              }
              placeholder={t("phTaxId")}
              maxLength={8}
              className="w-full sm:w-64 rounded border border-zinc-300 px-2.5 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              {t("lblTitle")}
            </label>
            <input
              type="text"
              value={state.title}
              onChange={(e) =>
                setState((s) => ({ ...s, title: e.target.value.slice(0, 60) }))
              }
              placeholder={t("phTitle")}
              maxLength={60}
              className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          {t("lblEmail")}
        </label>
        <input
          type="email"
          value={state.email}
          onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
          placeholder={defaultEmail ?? "your@email.com"}
          className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm"
        />
        <p className="text-[10px] text-zinc-500 mt-1">
          {t("emailHintTpl", { default: defaultEmail ?? t("emailHintMissing") })}
        </p>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 inline-flex items-center gap-1 rounded-lg bg-[#7c4f1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#5a3812] disabled:opacity-60"
      >
        {saving ? t("saving") : t("saveBtn")}
      </button>
    </div>
  );
}
