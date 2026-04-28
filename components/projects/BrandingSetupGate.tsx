"use client";

import { useState } from "react";
import { useBranding } from "@/components/branding/branding";
import { BrandingForm } from "@/components/branding/BrandingForm";

/**
 * 木工把報價單寄給客戶前，必須先設好公司名 / LOGO。
 * 否則客戶會看到木頭仁的預設品牌，超尷尬。
 *
 * 訊號：useBranding 的 syncedAt 為 null 代表 user_branding 表沒這筆，視為尚未設定。
 * 已存過至少一次（即使內容跟預設一樣）就放行。
 */
export function BrandingSetupGate({ children }: { children: React.ReactNode }) {
  const { hydrated, syncedAt } = useBranding();
  const [showForm, setShowForm] = useState(false);

  if (!hydrated) {
    return (
      <div className="text-center py-12 text-sm text-zinc-500">載入中…</div>
    );
  }

  if (syncedAt) {
    return <>{children}</>;
  }

  return (
    <div className="my-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 sm:p-8">
      <div className="text-3xl mb-2">🪵</div>
      <h2 className="text-lg font-bold text-amber-900 mb-2">
        先設定你的工作室抬頭
      </h2>
      <p className="text-sm text-amber-900 leading-relaxed mb-4">
        報價單會帶上你的公司名 / LOGO / 聯絡資訊寄給客戶。
        <strong>沒設定前，客戶看到的會是木頭仁的預設品牌</strong>，這對你的專業度大扣分。
        <br />
        花 2 分鐘設好，所有報價單都自動帶入你的品牌。
      </p>
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f]"
        >
          ⚙️ 開始設定我的工作室抬頭
        </button>
      )}
      {showForm && (
        <div className="mt-4 rounded-lg bg-white p-4 border border-amber-200">
          <BrandingForm />
          <p className="text-xs text-zinc-500 mt-3">
            填好任意欄位後會自動儲存。儲存後重新整理本頁就會放行。
          </p>
        </div>
      )}
    </div>
  );
}
