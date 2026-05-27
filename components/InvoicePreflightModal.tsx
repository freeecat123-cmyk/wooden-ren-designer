"use client";

/**
 * 結帳前的「發票偏好」迷你 modal。
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

type InvoiceType = "personal" | "company";
type CarrierType = "mobile" | "member";

const MOBILE_CARRIER_REGEX = /^\/[0-9A-Z+\-.]{7}$/;
const TAX_ID_REGEX = /^\d{8}$/;

interface Props {
  open: boolean;
  onClose: () => void;
  /** 存完發票偏好後 callback,該叫者去 submit 原本的 checkout form */
  onSaved: () => void;
}

export function InvoicePreflightModal({ open, onClose, onSaved }: Props) {
  const t = useTranslations("invoiceModal");
  const [type, setType] = useState<InvoiceType>("personal");
  const [carrierType, setCarrierType] = useState<CarrierType>("member");
  const [carrierNum, setCarrierNum] = useState("");
  const [taxId, setTaxId] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  if (!open) return null;

  function validate(): boolean {
    setError(null);
    if (type === "company") {
      if (!TAX_ID_REGEX.test(taxId)) {
        setError(t("errTaxId"));
        return false;
      }
      if (!title.trim() || title.length > 60) {
        setError(t("errTitle"));
        return false;
      }
    } else if (carrierType === "mobile") {
      if (!MOBILE_CARRIER_REGEX.test(carrierNum)) {
        setError(t("errCarrier"));
        return false;
      }
    }
    return true;
  }

  function handlePrimary() {
    if (!validate()) return;
    if (type === "company" && !confirmStep) {
      setConfirmStep(true);
      return;
    }
    void doSave();
  }

  async function doSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = { type };
      if (type === "company") {
        body.taxId = taxId;
        body.title = title.trim();
      } else {
        body.carrierType = carrierType;
        if (carrierType === "mobile") body.carrierNum = carrierNum.toUpperCase();
      }
      const res = await fetch("/api/invoice-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : t("errStatusTpl", { code: res.status }));
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-zinc-900 text-lg mb-1">
          {confirmStep ? t("hConfirm") : t("hPick")}
        </h3>
        <p className="text-xs text-zinc-500 mb-4">
          {confirmStep ? t("subConfirm") : t("subPick")}
        </p>

        {confirmStep && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4 space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-xs text-zinc-600 w-16 shrink-0">{t("rowTaxId")}</span>
              <span className="font-mono text-lg font-semibold text-zinc-900 tabular-nums">{taxId}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-xs text-zinc-600 w-16 shrink-0">{t("rowTitle")}</span>
              <span className="text-sm font-medium text-zinc-900 break-all">{title}</span>
            </div>
          </div>
        )}

        {!confirmStep && (
        <>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setType("personal")}
            className={`px-3 py-2 rounded-lg text-sm font-medium ring-1 transition ${
              type === "personal"
                ? "bg-amber-50 text-amber-900 ring-amber-400"
                : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {t("btnPersonal")}
          </button>
          <button
            type="button"
            onClick={() => setType("company")}
            className={`px-3 py-2 rounded-lg text-sm font-medium ring-1 transition ${
              type === "company"
                ? "bg-amber-50 text-amber-900 ring-amber-400"
                : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {t("btnCompany")}
          </button>
        </div>

        {type === "personal" && (
          <>
            <label className="block text-xs text-zinc-600 mb-1">{t("lblCarrier")}</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setCarrierType("member")}
                className={`px-3 py-2 rounded-lg text-sm ring-1 ${
                  carrierType === "member"
                    ? "bg-zinc-900 text-white ring-zinc-900"
                    : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {t("carrierMember")}
              </button>
              <button
                type="button"
                onClick={() => setCarrierType("mobile")}
                className={`px-3 py-2 rounded-lg text-sm ring-1 ${
                  carrierType === "mobile"
                    ? "bg-zinc-900 text-white ring-zinc-900"
                    : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
                }`}
              >
                {t("carrierMobile")}
              </button>
            </div>
            {carrierType === "mobile" && (
              <>
                <label className="block text-xs text-zinc-600 mb-1">{t("lblCarrierNum")}</label>
                <input
                  type="text"
                  value={carrierNum}
                  onChange={(e) => setCarrierNum(e.target.value)}
                  placeholder={t("phCarrierNum")}
                  className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-2 font-mono"
                  maxLength={8}
                />
                <p className="text-[11px] text-zinc-500 mb-3">{t("carrierHint")}</p>
              </>
            )}
          </>
        )}

        {type === "company" && (
          <>
            <label className="block text-xs text-zinc-600 mb-1">{t("lblTaxId")}</label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ""))}
              placeholder={t("phTaxId")}
              className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-3 font-mono tabular-nums"
              maxLength={8}
              inputMode="numeric"
            />
            <label className="block text-xs text-zinc-600 mb-1">{t("lblTitle")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("phTitle")}
              className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-3"
              maxLength={60}
            />
          </>
        )}
        </>
        )}

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 mb-3">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={confirmStep ? () => setConfirmStep(false) : onClose}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {confirmStep ? t("btnEdit") : t("btnCancel")}
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={saving}
            className="text-sm px-4 py-1.5 rounded bg-zinc-900 text-white font-medium hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving
              ? t("btnSaving")
              : confirmStep
                ? t("btnConfirm")
                : type === "company"
                  ? t("btnNext")
                  : t("btnSavePersonal")}
          </button>
        </div>
      </div>
    </div>
  );
}
