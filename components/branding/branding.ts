"use client";

import { useEffect, useState } from "react";

export interface BrandingData {
  companyNameZh: string;
  companyNameEn: string;
  tagline: string;
  address: string;
  phone: string;
  taxId: string;
  contact: string;
  email: string;
  /** base64 data URL；空字串表示使用預設 /logo.png */
  logoDataUrl: string;
}

export const DEFAULT_BRANDING: BrandingData = {
  companyNameZh: "木頭仁木匠學院",
  companyNameEn: "Wooden Ren Education Co., Ltd.",
  tagline: "WOODEN REN · 木頭仁木匠學院",
  address: "基隆市暖暖區東勢街 6-34 號 4 樓",
  phone: "",
  taxId: "",
  contact: "木頭仁",
  email: "",
  logoDataUrl: "",
};

const STORAGE_KEY = "wooden-ren-designer:branding:v1";

export function loadBranding(): BrandingData {
  if (typeof window === "undefined") return DEFAULT_BRANDING;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BRANDING;
    const parsed = JSON.parse(raw) as Partial<BrandingData>;
    return { ...DEFAULT_BRANDING, ...parsed };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBranding(data: BrandingData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useBranding(): {
  data: BrandingData;
  hydrated: boolean;
  update: (patch: Partial<BrandingData>) => void;
  reset: () => void;
} {
  const [data, setData] = useState<BrandingData>(DEFAULT_BRANDING);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(loadBranding());
    setHydrated(true);
  }, []);

  const update = (patch: Partial<BrandingData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      saveBranding(next);
      return next;
    });
  };

  const reset = () => {
    setData(DEFAULT_BRANDING);
    saveBranding(DEFAULT_BRANDING);
  };

  return { data, hydrated, update, reset };
}
