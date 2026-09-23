"use client";

import { useTranslations } from "next-intl";
import { useBranding } from "./branding";

export function BrandedHeader() {
  const t = useTranslations("branded");
  const { data, hydrated } = useBranding();

  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hydrated && data.logoDataUrl ? data.logoDataUrl : "/logo.png"}
        alt={data.companyNameZh || t("logoAltFallback")}
        width={56}
        height={56}
        className="object-contain"
      />
      <div>
        <p className="text-[10px] tracking-[0.2em] text-zinc-500">
          {data.tagline || t("taglineDefault")}
        </p>
        <p className="text-lg font-bold">{t("headerTitleZh")}</p>
        <p className="text-[10px] text-zinc-500">{t("headerTitleEn")}</p>
      </div>
    </div>
  );
}
