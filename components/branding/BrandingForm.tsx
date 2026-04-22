"use client";

import { useState, type ChangeEvent } from "react";
import { DEFAULT_BRANDING, useBranding } from "./branding";

const MAX_LOGO_BYTES = 300_000; // 300KB，壓縮 base64 後寫入 localStorage

export function BrandingForm() {
  const { data, hydrated, update, reset } = useBranding();
  const [logoError, setLogoError] = useState<string>("");
  const [open, setOpen] = useState(false);

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
    <section className="mt-4 rounded-lg border border-zinc-200 bg-white">
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

          <div className="flex items-center gap-3 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={reset}
              className="text-xs text-zinc-500 hover:text-zinc-800 hover:underline"
            >
              全部還原為預設
            </button>
            <span className="text-xs text-zinc-400">
              設定會存在這台裝置（localStorage），換裝置要重新輸入一次
            </span>
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
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  colSpan2?: boolean;
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
    </label>
  );
}
