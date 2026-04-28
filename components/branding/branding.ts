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
  /** 匯款銀行（含分行） */
  bankName: string;
  /** 匯款帳戶（戶名 + 帳號） */
  bankAccount: string;
  /**
   * 付款分期設定（1–5 期）。空陣列表示不啟用——回退到舊版 depositRate 二段式。
   * ratio 是 0–1 小數（0.5 = 50%）；label 是「訂金」「中期款」「尾款」之類顯示名稱。
   */
  paymentInstallments: Array<{ label: string; ratio: number }>;
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
  bankName: "",
  bankAccount: "",
  paymentInstallments: [],
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

/**
 * Sync 策略：
 *   1. mount → 立即用 localStorage 顯示（避免閃白）
 *   2. async 抓 Supabase user_branding；有資料就覆蓋並寫回 localStorage
 *   3. 之後每次 update：
 *      - 立即更新 state + localStorage（不等網路）
 *      - debounce 1.5s 推到 Supabase
 *
 * 未登入時跳過 Supabase 部分，純 localStorage 模式（保留舊行為）。
 */
const SYNC_DEBOUNCE_MS = 1500;

export function useBranding(): {
  data: BrandingData;
  hydrated: boolean;
  syncedAt: number | null;
  update: (patch: Partial<BrandingData>) => void;
  reset: () => void;
} {
  const [data, setData] = useState<BrandingData>(DEFAULT_BRANDING);
  const [hydrated, setHydrated] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. 開機：先吃 localStorage（同步），再非同步抓 Supabase
  useEffect(() => {
    setData(loadBranding());
    setHydrated(true);

    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id ?? null;
        userIdRef.current = uid;
        if (!uid || cancelled) return;
        const { data: row } = await supabase
          .from("user_branding")
          .select("data, updated_at")
          .eq("user_id", uid)
          .maybeSingle();
        if (cancelled) return;
        if (row?.data) {
          const merged = { ...DEFAULT_BRANDING, ...(row.data as Partial<BrandingData>) };
          setData(merged);
          saveBranding(merged);
          setSyncedAt(Date.now());
        }
      } catch {
        // 沒網 / 沒登入 → 純 local 模式
      }
    })();

    return () => {
      cancelled = true;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  const schedulePush = (next: BrandingData) => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      const uid = userIdRef.current;
      if (!uid) return;
      try {
        const supabase = createClient();
        await supabase.from("user_branding").upsert(
          { user_id: uid, data: next, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
        setSyncedAt(Date.now());
      } catch {
        // 失敗就靜悄悄；下次 update 會再試。資料還在 localStorage，不會掉。
      }
    }, SYNC_DEBOUNCE_MS);
  };

  const update = (patch: Partial<BrandingData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      saveBranding(next);
      schedulePush(next);
      return next;
    });
  };

  const reset = () => {
    setData(DEFAULT_BRANDING);
    saveBranding(DEFAULT_BRANDING);
    schedulePush(DEFAULT_BRANDING);
  };

  return { data, hydrated, syncedAt, update, reset };
}
