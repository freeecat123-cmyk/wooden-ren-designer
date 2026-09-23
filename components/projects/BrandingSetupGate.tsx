"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBranding } from "@/components/branding/branding";
import { BrandingForm } from "@/components/branding/BrandingForm";

export function BrandingSetupGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("brandingGate");
  const { hydrated, syncedAt } = useBranding();
  const [showForm, setShowForm] = useState(false);

  if (!hydrated) {
    return (
      <div className="text-center py-12 text-sm text-zinc-500">{t("loading")}</div>
    );
  }

  if (syncedAt) {
    return <>{children}</>;
  }

  return (
    <div className="my-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 sm:p-8">
      <div className="text-3xl mb-2">🪵</div>
      <h2 className="text-lg font-bold text-amber-900 mb-2">{t("h")}</h2>
      <p className="text-sm text-amber-900 leading-relaxed mb-4">
        {t("body1")}
        <strong>{t("bodyStrong")}</strong>
        {t("body2")}
        <br />
        {t("body3")}
      </p>
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-lg bg-[#8b4513] text-white text-sm font-medium hover:bg-[#6f370f]"
        >
          {t("openBtn")}
        </button>
      )}
      {showForm && (
        <div className="mt-4 rounded-lg bg-white p-4 border border-amber-200">
          <BrandingForm />
          <p className="text-xs text-zinc-500 mt-3">{t("afterSaveHint")}</p>
        </div>
      )}
    </div>
  );
}
