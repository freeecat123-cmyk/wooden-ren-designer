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

    // 前端 quick validation
    if (state.type === "company") {
      if (!TAX_ID_REGEX.test(state.taxId)) {
        setError("統一編號必須是 8 碼數字");
        return;
      }
      if (state.title.trim().length === 0) {
        setError("公司抬頭不能空白");
        return;
      }
    } else if (state.carrierType === "mobile") {
      if (!MOBILE_CARRIER_REGEX.test(state.carrierNum)) {
        setError("手機條碼格式錯誤（例：/ABC+123，共 8 字）");
        return;
      }
    }
    if (state.email && !EMAIL_REGEX.test(state.email)) {
      setError("發票收件 email 格式錯誤");
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
        setError(json.error ?? "儲存失敗");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "網路錯誤");
    } finally {
      setSaving(false);
    }
  }, [state]);

  if (loading) {
    return (
      <div className="mt-6 rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500">
        發票設定載入中…
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">發票設定</h2>
        {saved && <span className="text-xs text-emerald-600">✓ 已儲存</span>}
      </div>
      <p className="mb-3 text-xs text-zinc-500 leading-relaxed">
        下次扣款時會依此設定自動開立電子發票。發票會寄到下方填寫的 email。
      </p>

      {/* Type tabs */}
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
          個人
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
          公司（報帳用）
        </button>
      </div>

      {/* Personal */}
      {state.type === "personal" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              載具類型
            </label>
            <div className="flex gap-2 flex-wrap">
              <label className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="carrierType"
                  checked={state.carrierType === "member"}
                  onChange={() => setState((s) => ({ ...s, carrierType: "member" }))}
                />
                綠界會員載具（預設）
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                <input
                  type="radio"
                  name="carrierType"
                  checked={state.carrierType === "mobile"}
                  onChange={() => setState((s) => ({ ...s, carrierType: "mobile" }))}
                />
                手機條碼載具
              </label>
            </div>
          </div>

          {state.carrierType === "mobile" && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                手機條碼（8 字、開頭 /）
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
              <p className="text-[10px] text-zinc-500 mt-1">
                財政部電子發票整合服務平台 → 個人申請的手機條碼
              </p>
            </div>
          )}
        </div>
      )}

      {/* Company */}
      {state.type === "company" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              統一編號（8 碼數字）
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
              placeholder="12345678"
              maxLength={8}
              className="w-full sm:w-64 rounded border border-zinc-300 px-2.5 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              公司抬頭
            </label>
            <input
              type="text"
              value={state.title}
              onChange={(e) =>
                setState((s) => ({ ...s, title: e.target.value.slice(0, 60) }))
              }
              placeholder="○○股份有限公司"
              maxLength={60}
              className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Email */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-zinc-700 mb-1">
          發票收件 Email
        </label>
        <input
          type="email"
          value={state.email}
          onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
          placeholder={defaultEmail ?? "your@email.com"}
          className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm"
        />
        <p className="text-[10px] text-zinc-500 mt-1">
          留空 = 使用註冊信箱（{defaultEmail ?? "未設定"}）
        </p>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 inline-flex items-center gap-1 rounded-lg bg-[#7c4f1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#5a3812] disabled:opacity-60"
      >
        {saving ? "儲存中…" : "儲存設定"}
      </button>
    </div>
  );
}
