"use client";

/**
 * 客戶資料（單筆報價用）。不同於 branding（公司長久設定），客戶資料隨報價變動。
 * 近期客戶存 localStorage 做自動完成（不影響當筆 URL 編碼）。
 */

export interface CustomerInfo {
  name: string;
  contact: string;
  phone: string;
  address: string;
  taxId: string;
  email: string;
}

export const EMPTY_CUSTOMER: CustomerInfo = {
  name: "",
  contact: "",
  phone: "",
  address: "",
  taxId: "",
  email: "",
};

const HISTORY_KEY = "wooden-ren-designer:customers:v1";
const MAX_HISTORY = 20;

export function loadCustomerHistory(): CustomerInfo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveCustomer(c: CustomerInfo): void {
  if (typeof window === "undefined") return;
  const name = c.name.trim();
  if (!name) return; // 空客戶不存
  const existing = loadCustomerHistory();
  // 以 name 當 key，重複出現就移到最前
  const dedup = existing.filter((e) => e.name.trim() !== name);
  dedup.unshift(c);
  const next = dedup.slice(0, MAX_HISTORY);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}
