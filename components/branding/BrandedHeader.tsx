"use client";

import { useBranding } from "./branding";

export function BrandedHeader() {
  const { data, hydrated } = useBranding();

  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hydrated && data.logoDataUrl ? data.logoDataUrl : "/logo.png"}
        alt={data.companyNameZh || "LOGO"}
        width={56}
        height={56}
        className="object-contain"
      />
      <div>
        <p className="text-[10px] tracking-[0.2em] text-zinc-500">
          {data.tagline || "WOODEN REN · 木頭仁木匠學院"}
        </p>
        <p className="text-lg font-bold">客製家具報價單</p>
        <p className="text-[10px] text-zinc-500">QUOTATION</p>
      </div>
    </div>
  );
}
