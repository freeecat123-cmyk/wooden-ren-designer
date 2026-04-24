"use client";

import { useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import {
  calculateQuote,
  generateQuoteNumber,
  addWorkdays,
} from "@/lib/pricing/quote";
import { LABOR_DEFAULTS, type LaborDefaults } from "@/lib/pricing/labor";
import { MATERIAL_PRICE_PER_BDFT } from "@/lib/pricing/catalog";

/**
 * 分享按鈕列（LINE / Email / PDF）。
 *
 * 為什麼存在：原本三顆按鈕直接收 SSR 計算好的 quote/customer 當 props，
 * 表單在 debounce 期間或剛套用客戶 chip 時，按鈕讀的是「上一次 URL 的 quote」，
 * 寄出去的內容跟畫面不符。
 *
 * 修法：按鈕點擊時直接從 form DOM 抓 FormData，client 端重跑 calculateQuote，
 * 完全不依賴 SSR props——永遠用「當下表單值」執行分享動作。
 */

const FORM_ID = "quote-labor-form";

interface Props {
  design: FurnitureDesign;
  type: string;
  furnitureNameZh: string;
  dimensionsLabel: string;
  materialName: string;
}

export function QuoteShareActions({
  design,
  type,
  furnitureNameZh,
  dimensionsLabel,
  materialName,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleLine = async () => {
    const state = readFormState(design);
    if (!state) {
      alert("找不到報價表單，請重新整理頁面");
      return;
    }
    const { customer, quote, opts, deliveryIso, expiryIso, params } = state;
    const origin = window.location.origin;
    const printUrl = `${origin}/design/${type}/quote/print?${params.toString()}`;
    const quoteNo = generateQuoteNumber(design.id);
    const message = buildLineMessage({
      customerName: customer.name,
      furnitureName: furnitureNameZh,
      dimensions: dimensionsLabel,
      materialName,
      total: quote.total,
      depositAmount: quote.depositAmount,
      balanceAmount: quote.balanceAmount,
      depositRate: opts.depositRate,
      deliveryDate: deliveryIso,
      expiryDate: expiryIso,
      quoteNo,
      printUrl,
    });
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmail = () => {
    const state = readFormState(design);
    if (!state) {
      alert("找不到報價表單，請重新整理頁面");
      return;
    }
    const { customer, quote, opts, deliveryIso, expiryIso, params } = state;
    if (!customer.email || !customer.email.includes("@")) {
      alert("客戶還沒填 Email。請在下方「客戶資料」欄填入 email 後再試。");
      return;
    }
    const origin = window.location.origin;
    const printUrl = `${origin}/design/${type}/quote/print?${params.toString()}`;
    const quoteNo = generateQuoteNumber(design.id);
    const { subject, body } = buildEmailContent({
      customerName: customer.name,
      furnitureName: furnitureNameZh,
      dimensions: dimensionsLabel,
      materialName,
      total: quote.total,
      depositAmount: quote.depositAmount,
      balanceAmount: quote.balanceAmount,
      depositRate: opts.depositRate,
      deliveryDate: deliveryIso,
      expiryDate: expiryIso,
      quoteNo,
      printUrl,
    });
    const mailto = `mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const handlePdf = () => {
    const state = readFormState(design);
    if (!state) {
      alert("找不到報價表單，請重新整理頁面");
      return;
    }
    const url = `/design/${type}/quote/print?${state.params.toString()}`;
    window.open(url, "_blank");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleLine}
        className={`px-3 py-1.5 rounded text-xs transition-colors text-white ${
          copied ? "bg-emerald-600" : "bg-green-500 hover:bg-green-600"
        }`}
        title="複製格式化的 LINE 訊息"
      >
        {copied ? "✅ 已複製" : "💬 複製 LINE 訊息"}
      </button>
      <button
        type="button"
        onClick={handleEmail}
        className="px-3 py-1.5 rounded text-xs text-white bg-sky-600 hover:bg-sky-700"
        title="開啟郵件客戶端寄給客戶 Email"
      >
        📧 寄 Email
      </button>
      <button
        type="button"
        onClick={handlePdf}
        className="px-3 py-1.5 bg-zinc-900 text-white rounded text-xs hover:bg-zinc-700"
        title="開新分頁列印 / 存 PDF"
      >
        🧾 列印 / PDF
      </button>
    </>
  );
}

/* ─────────────── 從 form DOM 讀取當下狀態 + 重算 quote ─────────────── */

function parseNum(s: string | null | undefined, fallback: number): number {
  const n = s ? parseFloat(s) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseOptNum(
  s: string | null | undefined,
  fallback: number | null,
): number | null {
  if (s === undefined || s === null) return fallback;
  if (s.trim() === "") return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return fallback;
  if (n <= 0) return null;
  return n;
}

function readFormState(design: FurnitureDesign) {
  const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
  if (!form) return null;
  const data = new FormData(form);
  const get = (k: string) => data.get(k) as string | null;

  const catalogPrimary = MATERIAL_PRICE_PER_BDFT[design.primaryMaterial] ?? 300;

  const opts: LaborDefaults = {
    hourlyRate: parseNum(get("hourlyRate"), LABOR_DEFAULTS.hourlyRate),
    equipmentRate: parseNum(get("equipmentRate"), LABOR_DEFAULTS.equipmentRate),
    consumables: parseNum(get("consumables"), LABOR_DEFAULTS.consumables),
    finishingCost: parseNum(get("finishingCost"), LABOR_DEFAULTS.finishingCost),
    shippingCost: parseNum(get("shippingCost"), LABOR_DEFAULTS.shippingCost),
    installationCost: parseNum(get("installationCost"), LABOR_DEFAULTS.installationCost),
    hardwareCost: parseNum(get("hardwareCost"), LABOR_DEFAULTS.hardwareCost),
    marginRate: parseNum(get("marginRate"), LABOR_DEFAULTS.marginRate),
    vatRate: parseNum(get("vatRate"), LABOR_DEFAULTS.vatRate),
    quantity: parseNum(get("quantity"), LABOR_DEFAULTS.quantity),
    discountRate: parseNum(get("discountRate"), LABOR_DEFAULTS.discountRate),
    expiryDays: parseNum(get("expiryDays"), LABOR_DEFAULTS.expiryDays),
    depositRate: parseNum(get("depositRate"), LABOR_DEFAULTS.depositRate),
    bufferDays: parseNum(get("bufferDays"), LABOR_DEFAULTS.bufferDays),
    overrideUnitPrice: parseNum(get("overrideUnitPrice"), LABOR_DEFAULTS.overrideUnitPrice),
    primaryMaterialPricePerBdft: parseNum(get("primaryMaterialPricePerBdft"), catalogPrimary),
    plywoodPricePerBdft: parseOptNum(get("plywoodPricePerBdft"), LABOR_DEFAULTS.plywoodPricePerBdft),
    mdfPricePerBdft: parseOptNum(get("mdfPricePerBdft"), LABOR_DEFAULTS.mdfPricePerBdft),
  };

  const customer = {
    name: get("customerName") ?? "",
    contact: get("customerContact") ?? "",
    phone: get("customerPhone") ?? "",
    address: get("customerAddress") ?? "",
    taxId: get("customerTaxId") ?? "",
    email: get("customerEmail") ?? "",
  };

  const quote = calculateQuote(design, opts);

  const today = new Date();
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + Math.round(opts.expiryDays));
  const expiryIso = expiry.toISOString().slice(0, 10);
  const deliveryIso = addWorkdays(today, quote.estimatedWorkdays)
    .toISOString()
    .slice(0, 10);

  // 組出當下完整 URL params（給 print page 用）；checkbox 沒勾的要從 params 移除
  const params = new URLSearchParams();
  for (const [k, v] of data.entries()) {
    params.set(k, v as string);
  }
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    if (!cb.checked) params.delete(cb.name);
  });

  return { opts, customer, quote, expiryIso, deliveryIso, params };
}

/* ─────────────── 訊息與 Email 格式 ─────────────── */

function twd(n: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

interface ShareContent {
  customerName: string;
  furnitureName: string;
  dimensions: string;
  materialName: string;
  total: number;
  depositAmount: number;
  balanceAmount: number;
  depositRate: number;
  deliveryDate: string;
  expiryDate: string;
  quoteNo: string;
  printUrl: string;
}

function buildLineMessage(c: ShareContent): string {
  const greeting = c.customerName ? `${c.customerName} 您好，` : "您好，";
  const hasSplit = c.depositRate > 0 && c.depositRate < 1;
  return [
    `【木頭仁客製家具報價】`,
    ``,
    greeting,
    `以下是您的報價資訊：`,
    ``,
    `📐 品項：${c.furnitureName}`,
    `📏 尺寸：${c.dimensions}`,
    `🪵 木材：${c.materialName}`,
    ``,
    `💰 報價總計（含稅）：${twd(c.total)}`,
    ...(hasSplit
      ? [
          `　├─ 訂金（下訂時付 ${Math.round(c.depositRate * 100)}%）：${twd(c.depositAmount)}`,
          `　└─ 尾款（交貨時付）：${twd(c.balanceAmount)}`,
        ]
      : []),
    ``,
    `📅 預計交期：${c.deliveryDate}`,
    `⏰ 報價有效至：${c.expiryDate}`,
    ``,
    `🔗 詳細報價單：`,
    c.printUrl,
    ``,
    `報價單號：${c.quoteNo}`,
    `如需調整或有問題歡迎回覆，謝謝！`,
    `— 木頭仁木作`,
  ].join("\n");
}

function buildEmailContent(c: ShareContent): { subject: string; body: string } {
  const greeting = c.customerName ? `${c.customerName} 您好，` : "您好，";
  const hasSplit = c.depositRate > 0 && c.depositRate < 1;
  const subject = `客製家具報價 ${c.quoteNo}｜${c.furnitureName} ${c.dimensions}`;
  const body = [
    greeting,
    ``,
    `感謝您的詢問，以下是您的客製家具報價：`,
    ``,
    `━━━━━━━━━━━━━━━`,
    `品項：${c.furnitureName}`,
    `尺寸：${c.dimensions}`,
    `木材：${c.materialName}`,
    ``,
    `報價總計（含稅）：${twd(c.total)}`,
    ...(hasSplit
      ? [
          `　訂金（下訂時付 ${Math.round(c.depositRate * 100)}%）：${twd(c.depositAmount)}`,
          `　尾款（交貨時付）：${twd(c.balanceAmount)}`,
        ]
      : []),
    ``,
    `預計交期：${c.deliveryDate}`,
    `報價有效至：${c.expiryDate}`,
    `━━━━━━━━━━━━━━━`,
    ``,
    `完整報價單（含三視圖、條款、備註）請點：`,
    c.printUrl,
    ``,
    `若需調整設計或有任何問題，歡迎回信討論。`,
    ``,
    `報價單號：${c.quoteNo}`,
    ``,
    `— 木頭仁木作`,
  ].join("\n");
  return { subject, body };
}
