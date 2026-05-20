"use client";

/**
 * 結帳前的「發票偏好」迷你 modal。
 *
 * 觸發點:user 在 /pricing 點某方案結帳按鈕,如果偵測沒設過 invoice_preference,
 * 攔截 form submit 彈這個 modal,填完 → POST /api/invoice-preference → 自動 submit
 * 原本的 checkout form 跳綠界。
 *
 * 比 /my-subscription 的 InvoicePreferenceCard 簡化:只問必要欄位
 * (type / 公司戶補 taxId+title / 手機載具補 carrierNum),email 留給 server 預設用註冊信箱。
 */
import { useState } from "react";

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
  const [type, setType] = useState<InvoiceType>("personal");
  const [carrierType, setCarrierType] = useState<CarrierType>("member");
  const [carrierNum, setCarrierNum] = useState("");
  const [taxId, setTaxId] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 公司戶結帳前的二次確認：統編 / 抬頭 寫錯客服處理痛苦（24h 內可作廢重開,
  // 超過要走折讓單）。先驗 → 跳確認頁 → 用戶看清楚再 confirm → 才真存。
  const [confirmStep, setConfirmStep] = useState(false);

  if (!open) return null;

  function validate(): boolean {
    setError(null);
    if (type === "company") {
      if (!TAX_ID_REGEX.test(taxId)) {
        setError("統編需要 8 碼數字");
        return false;
      }
      if (!title.trim() || title.length > 60) {
        setError("公司抬頭必填(最多 60 字)");
        return false;
      }
    } else if (carrierType === "mobile") {
      if (!MOBILE_CARRIER_REGEX.test(carrierNum)) {
        setError("手機條碼格式錯,格式: / 開頭 + 7 碼大寫字母數字");
        return false;
      }
    }
    return true;
  }

  function handlePrimary() {
    if (!validate()) return;
    // 公司戶要二次確認；個人戶直接存
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
        setError(typeof j.error === "string" ? j.error : `存取失敗 ${res.status}`);
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
          {confirmStep ? "確認公司發票資料" : "先選發票類型"}
        </h3>
        <p className="text-xs text-zinc-500 mb-4">
          {confirmStep
            ? "發票一旦開立,24 小時內可作廢重開,超過要走折讓單。請確認以下無誤再送出。"
            : "付款完成後會自動開立電子發票寄到你的 email。設定後下次刷卡會自動套用,不會再問。"}
        </p>

        {confirmStep && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4 space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-xs text-zinc-600 w-16 shrink-0">統一編號</span>
              <span className="font-mono text-lg font-semibold text-zinc-900 tabular-nums">{taxId}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-xs text-zinc-600 w-16 shrink-0">公司抬頭</span>
              <span className="text-sm font-medium text-zinc-900 break-all">{title}</span>
            </div>
          </div>
        )}

        {/* type 切換 — confirm step 把編輯區藏起來,避免使用者改完忘了再 validate */}
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
            🧍 個人
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
            🏢 公司報帳
          </button>
        </div>

        {type === "personal" && (
          <>
            <label className="block text-xs text-zinc-600 mb-1">載具</label>
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
                會員載具(寄 email)
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
                手機條碼(共通載具)
              </button>
            </div>
            {carrierType === "mobile" && (
              <>
                <label className="block text-xs text-zinc-600 mb-1">
                  手機條碼(格式 /ABC1234,8 字)
                </label>
                <input
                  type="text"
                  value={carrierNum}
                  onChange={(e) => setCarrierNum(e.target.value)}
                  placeholder="/ABC1234"
                  className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-2 font-mono"
                  maxLength={8}
                />
                <p className="text-[11px] text-zinc-500 mb-3">
                  忘記了?去財政部電子發票整合服務平台 → 我的載具 → 共通性載具
                </p>
              </>
            )}
          </>
        )}

        {type === "company" && (
          <>
            <label className="block text-xs text-zinc-600 mb-1">公司統編(8 碼)</label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ""))}
              placeholder="12345678"
              className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm mb-3 font-mono tabular-nums"
              maxLength={8}
              inputMode="numeric"
            />
            <label className="block text-xs text-zinc-600 mb-1">公司抬頭</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="木頭仁木匠學院有限公司"
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
            {confirmStep ? "← 改一下" : "取消"}
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={saving}
            className="text-sm px-4 py-1.5 rounded bg-zinc-900 text-white font-medium hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving
              ? "儲存中…"
              : confirmStep
                ? "✓ 沒問題,送出"
                : type === "company"
                  ? "下一步 → 確認"
                  : "存好 · 去結帳"}
          </button>
        </div>
      </div>
    </div>
  );
}
