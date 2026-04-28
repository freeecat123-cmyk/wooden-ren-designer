"use client";

import { useState, type ChangeEvent } from "react";
import { DEFAULT_BRANDING, useBranding } from "./branding";

const MAX_LOGO_BYTES = 300_000; // 300KB，壓縮 base64 後寫入 localStorage

export function BrandingForm({
  defaultOpen = false,
}: { defaultOpen?: boolean } = {}) {
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
      <div className="mt-4 p-3 text-xs text-zinc-400 border border-dashed border-zinc-200 rounded">
        載入品牌設定…
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
      setLogoError("檔案要是圖片（png / jpg / svg）");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(
        `LOGO 超過 ${Math.round(MAX_LOGO_BYTES / 1024)}KB，建議先壓縮（256×256 以內）`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        update({ logoDataUrl: result });
      }
    };
    reader.onerror = () => setLogoError("讀檔失敗");
    reader.readAsDataURL(file);
  };

  const clearLogo = () => update({ logoDataUrl: "" });

  const isDefault =
    JSON.stringify(data) === JSON.stringify(DEFAULT_BRANDING);

  return (
    <section className="mt-3 rounded-lg border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50"
      >
        <span className="font-medium text-zinc-800">
          🏢 報價單抬頭設定（公司名稱 + LOGO）
        </span>
        <span className="text-xs text-zinc-500">
          {isDefault ? "尚未客製（使用預設）" : "已客製"} · {open ? "收合" : "展開"}
        </span>
      </button>

      {open && (
        <div className="border-t border-zinc-200 p-4 space-y-4">
          {/* 儲存狀態 + 立即儲存按鈕——sticky 在頂端，捲動時也看得到 */}
          <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-white border-b border-zinc-200 flex items-center justify-between gap-3 flex-wrap">
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
                ? "⏳ 儲存中…"
                : savePulse === "saved"
                  ? "✓ 已儲存"
                  : "💾 立即儲存"}
            </button>
          </div>
          <div>
            <label className="text-xs text-zinc-600 mb-1 block">
              公司 LOGO（建議 256×256 以內，png 透明背景）
            </label>
            <div className="flex items-center gap-3">
              {data.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.logoDataUrl}
                  alt="LOGO 預覽"
                  width={56}
                  height={56}
                  className="object-contain border border-zinc-200 rounded bg-zinc-50"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/logo.png"
                  alt="預設 LOGO"
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
                  className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-zinc-300 file:bg-white file:text-zinc-700 hover:file:bg-zinc-50"
                />
                {data.logoDataUrl && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="self-start text-xs text-red-600 hover:underline"
                  >
                    清除（回預設）
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
              label="公司中文名稱"
              value={data.companyNameZh}
              onChange={handleField("companyNameZh")}
              placeholder="例：木頭仁木匠學院"
            />
            <TextField
              label="公司英文 / 登記名稱"
              value={data.companyNameEn}
              onChange={handleField("companyNameEn")}
              placeholder="例：Wooden Ren Education Co., Ltd."
            />
            <TextField
              label="抬頭小字 (tagline)"
              value={data.tagline}
              onChange={handleField("tagline")}
              placeholder="例：WOODEN REN · 手作家具"
            />
            <TextField
              label="聯絡人"
              value={data.contact}
              onChange={handleField("contact")}
            />
            <TextField
              label="公司地址"
              value={data.address}
              onChange={handleField("address")}
              colSpan2
            />
            <TextField
              label="聯絡電話"
              value={data.phone}
              onChange={handleField("phone")}
            />
            <TextField
              label="統一編號"
              value={data.taxId}
              onChange={handleField("taxId")}
            />
            <TextField
              label="Email"
              value={data.email}
              onChange={handleField("email")}
              colSpan2
            />
          </div>

          {/* 對外公開網址：用於 LINE/Email 內的「完整報價單連結」 */}
          <div className="pt-3 mt-3 border-t border-zinc-100">
            <label className="flex flex-col text-xs">
              <span className="text-zinc-600 mb-1 flex items-center gap-2">
                對外公開網址（給客戶看的連結 base）
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
                      alert(
                        `❌ 你現在是 ${origin}，這是本機網址，客戶根本連不上你的電腦。\n\n請先到「線上版」（例如 https://你的網站.vercel.app）按一次這顆按鈕，之後在 localhost 編輯時就會用線上版 URL 了。\n\n如果你還沒有線上版網址，請手動輸入到下方欄位。`,
                      );
                      return;
                    }
                    update({ publicBaseUrl: origin });
                  }}
                  className="text-[10px] text-sky-700 hover:text-sky-900 hover:underline"
                  title="把現在這個瀏覽器分頁的網址當作公開網址（必須在線上版按，localhost 會被擋下）"
                >
                  📋 抓當前網址
                </button>
              </span>
              <input
                type="text"
                value={data.publicBaseUrl}
                onChange={handleField("publicBaseUrl")}
                placeholder="例：https://你的網站.vercel.app（留空則用當前 origin）"
                className="border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900 text-sm font-mono"
              />
              <span className="mt-0.5 text-[10px] text-zinc-400">
                寄 LINE/Email 給客戶時，「完整報價單連結」會用這個當前綴。在 localhost 編輯時必填，不然客戶連不上你電腦。
              </span>
            </label>
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-100">
            <p className="text-xs text-zinc-500 font-medium mb-2">
              報價單條款（可自行編輯，會套用在 A4 報價單）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextAreaField
                label="付款條件"
                value={data.paymentTerms}
                onChange={handleField("paymentTerms")}
                rows={4}
                colSpan2
                hint="開頭「訂金」「尾款」行會被上方訂金比例自動覆寫；匯款銀行/帳戶填下面欄位即可（會自動接到付款條件後面）"
              />
              <TextField
                label="匯款銀行"
                value={data.bankName}
                onChange={handleField("bankName")}
                placeholder="例：玉山銀行 暖暖分行（808）"
              />
              <TextField
                label="匯款帳戶"
                value={data.bankAccount}
                onChange={handleField("bankAccount")}
                placeholder="例：戶名 木頭仁 / 0123-456-789012"
              />
              <div className="md:col-span-2">
                <InstallmentsEditor
                  value={data.paymentInstallments}
                  onChange={(next) => update({ paymentInstallments: next })}
                />
              </div>
              <TextField
                label="交貨期"
                value={data.deliveryTerms}
                onChange={handleField("deliveryTerms")}
                colSpan2
                hint="文字中的 ＿＿ 空白會自動填入預估工作天"
              />
              <TextField
                label="保固"
                value={data.warranty}
                onChange={handleField("warranty")}
              />
              <TextField
                label="售後服務"
                value={data.afterSales}
                onChange={handleField("afterSales")}
              />
              <TextAreaField
                label="備註（一行一條）"
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
              onClick={reset}
              className="text-xs text-zinc-500 hover:text-zinc-800 hover:underline"
            >
              全部還原為預設
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
        <span className="mt-0.5 text-[10px] text-zinc-400">{hint}</span>
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
        <span className="mt-0.5 text-[10px] text-zinc-400">{hint}</span>
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
  if (savePulse === "saving") {
    return (
      <span className="text-xs text-amber-700 font-medium">
        ⏳ 同步雲端中…
      </span>
    );
  }
  if (savePulse === "saved") {
    return (
      <span className="text-xs text-emerald-700 font-medium">
        ✓ 已存到雲端
      </span>
    );
  }
  if (pendingPush) {
    return (
      <span className="text-xs text-amber-700">
        💾 已存本機 · 1.5 秒後自動同步雲端
      </span>
    );
  }
  if (syncedAt) {
    const ts = new Date(syncedAt).toLocaleTimeString();
    return (
      <span className="text-xs text-emerald-700">
        ✓ 已同步雲端 · {ts}（登入帳號跨裝置共用）
      </span>
    );
  }
  return (
    <span className="text-xs text-zinc-500">
      💾 設定存在本機；登入後會自動同步到雲端
    </span>
  );
}

const INSTALLMENT_PRESETS: Record<
  number,
  Array<{ label: string; ratio: number }>
> = {
  1: [{ label: "全額", ratio: 1 }],
  2: [
    { label: "訂金", ratio: 0.5 },
    { label: "尾款", ratio: 0.5 },
  ],
  3: [
    { label: "訂金", ratio: 0.3 },
    { label: "中期款", ratio: 0.4 },
    { label: "尾款", ratio: 0.3 },
  ],
  4: [
    { label: "訂金", ratio: 0.25 },
    { label: "備料款", ratio: 0.25 },
    { label: "木工完成款", ratio: 0.25 },
    { label: "尾款", ratio: 0.25 },
  ],
  5: [
    { label: "訂金", ratio: 0.2 },
    { label: "備料款", ratio: 0.2 },
    { label: "木工完成款", ratio: 0.2 },
    { label: "塗裝完成款", ratio: 0.2 },
    { label: "尾款", ratio: 0.2 },
  ],
};

function InstallmentsEditor({
  value,
  onChange,
}: {
  value: Array<{ label: string; ratio: number }>;
  onChange: (next: Array<{ label: string; ratio: number }>) => void;
}) {
  const enabled = value.length > 0;
  const totalPct = value.reduce((s, r) => s + r.ratio * 100, 0);
  const totalDelta = Math.abs(totalPct - 100);
  const totalOk = !enabled || totalDelta < 0.5;

  return (
    <div className="border border-zinc-200 rounded p-3 bg-zinc-50/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-700 font-medium">
          付款分期(覆寫上方訂金比例)
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-zinc-500">分</span>
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
                    onChange(INSTALLMENT_PRESETS[n].map((r) => ({ ...r })));
                  }
                }}
                className={`text-[11px] px-2 py-0.5 rounded border transition ${
                  active
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                }`}
              >
                {n === 0 ? "不分期" : `${n} 期`}
              </button>
            );
          })}
        </div>
      </div>
      {!enabled && (
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          目前用報價頁的訂金比例(depositRate)做 2 段拆分。設成 1–5 期後改用這裡的設定，每期自訂名稱與 % 數。
        </p>
      )}
      {enabled && (
        <>
          <div className="space-y-1.5">
            {value.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 font-mono w-6">
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
                  placeholder="期別名稱"
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
                <span className="text-xs text-zinc-500">%</span>
              </div>
            ))}
          </div>
          <p
            className={`mt-2 text-[10px] ${
              totalOk ? "text-zinc-500" : "text-rose-700 font-semibold"
            }`}
          >
            合計：{totalPct.toFixed(1)}%
            {!totalOk && `(差 ${(100 - totalPct).toFixed(1)}%——加總要 100%)`}
          </p>
        </>
      )}
    </div>
  );
}
