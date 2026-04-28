"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  /**
   * 對外公開網址（例：https://woodenren-designer.vercel.app）。
   * 寄 LINE/Email 給客戶時，「完整報價單連結」會用這個當 base，避免在 localhost
   * 編輯時寄出 localhost URL 給客戶。空字串 = 使用 window.location.origin。
   */
  publicBaseUrl: string;
  // ── 報價單條款（使用者自訂，存 localStorage）──
  /** 付款條件（多行文字） */
  paymentTerms: string;
  /** 交貨期（一行） */
  deliveryTerms: string;
  /** 保固 */
  warranty: string;
  /** 售後服務 */
  afterSales: string;
  /** 備註（多行，每行一條，以 \n 分隔） */
  notes: string;
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
  publicBaseUrl: "",
  paymentTerms:
    "訂金：簽約付款 50%\n尾款：交貨前付款 50%\n匯款銀行：＿＿＿＿\n帳戶：＿＿＿＿",
  deliveryTerms: "簽約後 ____ 天內，工坊自取／另議運費",
  warranty: "一年（非人為損害）",
  afterSales: "",
  notes: [
    "木材依實際乾燥度、紋理挑選會有 ±3% 尺寸與色差誤差。",
    "客製樣式確認後如欲修改設計，需重新報價；確認下訂並開工後變更：每次酌收變更費 NT$ 1,000 起。",
    "如需開立發票（營業稅 5%），請於下訂時告知。",
  ].join("\n"),
};

const STORAGE_KEY = "wooden-ren-designer:branding:v1";

export interface BrandingPreset {
  id: string;
  label: string;
  description: string;
  patch: Partial<BrandingData>;
}

export const BRANDING_PRESETS: BrandingPreset[] = [
  {
    id: "studio",
    label: "🪵 木匠工作室",
    description: "個人 / 小型工作室接案，輕鬆口吻、客製為主",
    patch: {
      tagline: "手作家具・接單客製",
      paymentTerms:
        "訂金：簽約付款 50%\n尾款：交貨前付款 50%\n匯款銀行：＿＿＿＿\n帳戶：＿＿＿＿",
      deliveryTerms: "簽約後 ____ 天內，工坊自取／另議運費",
      warranty: "一年（非人為損害）",
      afterSales: "終身榫卯維修；木皮磨損費另計",
      notes: [
        "木材依實際乾燥度、紋理挑選會有 ±3% 尺寸與色差誤差。",
        "客製樣式確認後如欲修改設計，需重新報價。",
        "如需開立發票（營業稅 5%），請於下訂時告知。",
      ].join("\n"),
    },
  },
  {
    id: "factory",
    label: "🏭 接案工廠",
    description: "正式工廠 / 量產接單，條款偏保守，含驗收與發票",
    patch: {
      tagline: "客製家具・量產代工",
      paymentTerms:
        "訂金：簽約付款 30%\n中期款：木工完成 40%\n尾款：交貨驗收 30%\n匯款銀行：＿＿＿＿\n帳戶：＿＿＿＿",
      deliveryTerms: "簽約後 ____ 個工作天內交貨，運費另計",
      warranty: "結構保固 2 年（非人為損害）；五金 1 年",
      afterSales: "保固期內免費維修，逾期工料費另計",
      notes: [
        "本報價含材料、加工、組裝、表面塗裝；不含拆裝、現場校正、上樓費。",
        "木材依實際乾燥度、紋理挑選會有 ±3% 尺寸與色差誤差。",
        "確認下訂並開工後變更：每次酌收變更費 NT$ 1,000 起。",
        "報價含 5% 營業稅，開立統一發票。",
      ].join("\n"),
    },
  },
  {
    id: "academy",
    label: "🎓 教學示範",
    description: "課堂 / 工作坊使用，條款簡化、重點在材料說明",
    patch: {
      tagline: "課堂教學示範報價",
      paymentTerms: "課程費用以課程頁公告為準，本報價單僅供材料估算參考",
      deliveryTerms: "課程當天現場領取材料包",
      warranty: "教學示範用，不適用一般保固",
      afterSales: "課堂內提供操作指導，課後榫卯問題可於社團發問",
      notes: [
        "本報價單為教學參考，實際成本以材料行公告為準。",
        "木材依實際乾燥度、紋理挑選會有 ±3% 尺寸與色差誤差。",
        "學員自行加購材料另議。",
      ].join("\n"),
    },
  },
];

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
