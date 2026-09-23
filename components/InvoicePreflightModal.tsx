"use client";

/**
 * 結帳前的「發票偏好」迷你 modal。
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type InvoiceType = "personal" | "company";
type CarrierType = "mobile" | "member";

const MOBILE_CARRIER_REGEX = /^\/[0-9A-Z+\-.]{7}$/;

/**
 * 手機條碼載具正規化：去掉所有空白、轉大寫、缺開頭斜線就補上。
 * 財政部的手機條碼是「/」+ 7 碼大寫英數（含 + - .），但使用者實際會打出來的是
 * 小寫、前後有空白、或忘了斜線。這些都應該被接受而不是擋在門口。
 */
export function normalizeCarrier(raw: string): string {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (!s) return "";
  return s.startsWith("/") ? s : "/" + s;
}
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
  const [needLogin, setNeedLogin] = useState(false);

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
      // ⚠️ 2026-09-04：原本直接拿使用者輸入去比對，而 regex 只收大寫 [0-9A-Z+-.]，
      // 手機鍵盤預設小寫 → 打 "/ab12cd3" 永遠過不了，畫面一直說格式錯，
      // 客人就卡死在這一頁、走不到綠界（真實客訴，訂單 WRMTMF5JZLHD9Y 因此從未送出）。
      // 現在先正規化（去空白＋轉大寫）再驗，並把正規化後的值寫回欄位。
      const normalized = normalizeCarrier(carrierNum);
      if (normalized !== carrierNum) setCarrierNum(normalized);
      if (!MOBILE_CARRIER_REGEX.test(normalized)) {
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
        if (carrierType === "mobile") body.carrierNum = normalizeCarrier(carrierNum);
      }
      /**
       * ⚠️ 2026-09-04：這支原本沒帶 credentials，而全站另外三個呼叫點都有帶
       * （InvoicePreferenceCard ×2、PricingPlanCard）。在 LINE / IG 這類
       * in-app browser 裡 cookie 最容易掉，客人就會看到紅字 unauthenticated
       * 而卡在發票那一頁、走不到綠界（真實客訴：訂單 WRMTMF5JZLHD9Y 從未送出）。
       *
       * 除了補上 credentials，再多送一份 Authorization: Bearer。
       * 瀏覽器端的 session 是活的（畫面能顯示方案就是證明），
       * 就算 cookie 沒被帶上去，後端仍可用這個 token 驗身分。
       */
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const { data } = await createClient().auth.getSession();
        const token = data.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // 拿不到就算了，後端還有 cookie 這條路
      }
      const res = await fetch("/api/invoice-preference", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 401 = 沒登入 / session 過期。給人話，不要把 error code 原封丟到使用者臉上。
        if (res.status === 401) {
          setNeedLogin(true);
          setError(t("errNeedLogin"));
          return;
        }
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
                  onChange={(e) => setCarrierNum(e.target.value.toUpperCase())}
                  onBlur={(e) => setCarrierNum(normalizeCarrier(e.target.value))}
                  placeholder={t("phCarrierNum")}
                  className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-2 font-mono"
                  maxLength={12}
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

        {needLogin && (
          <button
            type="button"
            onClick={() => {
              const next = window.location.pathname + window.location.search;
              window.location.href = `/login?next=${encodeURIComponent(next)}`;
            }}
            className="mt-3 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {t("btnGoLogin")}
          </button>
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
