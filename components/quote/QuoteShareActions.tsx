"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FurnitureDesign } from "@/lib/types";
import {
  calculateQuote,
  generateQuoteNumber,
  addWorkdays,
} from "@/lib/pricing/quote";
import { LABOR_DEFAULTS, type LaborDefaults } from "@/lib/pricing/labor";
import { taipeiIsoDate } from "@/lib/utils/date-tw";
import { MATERIAL_PRICE_PER_BDFT } from "@/lib/pricing/catalog";
import { loadBranding } from "@/components/branding/branding";
import { QrCode } from "@/components/print/QrCode";

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

type CopiedState = "line" | "link" | null;

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
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
}

export function QuoteShareActions({
  design,
  type,
  furnitureNameZh,
  dimensionsLabel,
  materialName,
}: Props) {
  const t = useTranslations("quoteShareActions");
  const [copied, setCopied] = useState<CopiedState>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);

  // 共用：拿到當下表單狀態 + 解析 origin + 短碼。沒設 publicBaseUrl 會 alert 並回 null。
  const prepareShareUrl = async () => {
    const state = readFormState(design);
    if (!state) {
      alert(t("alertNoForm"));
      return null;
    }
    const origin = resolvePublicOrigin(t);
    if (!origin) return null;
    const longPath = `/design/${type}/quote/print?${state.params.toString()}`;
    const printUrl = await shortenIfPossible(origin, longPath);
    const contextForNo = `${state.customer.name}|${design.id}|${(state.params.get("material") ?? "")}`;
    const quoteNo = generateQuoteNumber(design.id, contextForNo, new Date(state.todayIso + "T00:00:00"));
    return { ...state, printUrl, quoteNo, origin };
  };

  const handleLine = async () => {
    const ctx = await prepareShareUrl();
    if (!ctx) return;
    const { customer, quote, opts, deliveryIso, expiryIso, printUrl, quoteNo } = ctx;
    const message = buildLineMessage(t, {
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
    await copyToClipboard(message);
    setCopied("line");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyLink = async () => {
    const ctx = await prepareShareUrl();
    if (!ctx) return;
    await copyToClipboard(ctx.printUrl);
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleQr = async () => {
    if (qrUrl) {
      setQrUrl(null);
      return;
    }
    setQrBusy(true);
    const ctx = await prepareShareUrl();
    setQrBusy(false);
    if (!ctx) return;
    setQrUrl(ctx.printUrl);
  };

  const handleEmail = async () => {
    const ctx = await prepareShareUrl();
    if (!ctx) return;
    const { customer, quote, opts, deliveryIso, expiryIso, printUrl, quoteNo } = ctx;
    if (!customer.email || !customer.email.includes("@")) {
      alert(t("alertNoEmail"));
      return;
    }
    const { subject, body } = buildEmailContent(t, {
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
      alert(t("alertNoForm"));
      return;
    }
    const url = `/design/${type}/quote/print?${state.params.toString()}`;
    window.open(url, "_blank");
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleLine}
          className={`px-3 py-1.5 rounded text-xs transition-colors text-white ${
            copied === "line" ? "bg-emerald-600" : "bg-green-500 hover:bg-green-600"
          }`}
          title={t("btnLineTitle")}
        >
          {copied === "line" ? t("btnLineCopied") : t("btnLine")}
        </button>
        <button
          type="button"
          onClick={handleEmail}
          className="px-3 py-1.5 rounded text-xs text-white bg-sky-600 hover:bg-sky-700"
          title={t("btnEmailTitle")}
        >
          {t("btnEmail")}
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className={`px-3 py-1.5 rounded text-xs transition-colors text-white ${
            copied === "link" ? "bg-emerald-600" : "bg-zinc-600 hover:bg-zinc-700"
          }`}
          title={t("btnCopyLinkTitle")}
        >
          {copied === "link" ? t("btnLineCopied") : t("btnCopyLink")}
        </button>
        <button
          type="button"
          onClick={handleQr}
          disabled={qrBusy}
          className="px-3 py-1.5 rounded text-xs text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
          title={t("btnQrTitle")}
        >
          {qrBusy ? t("btnQrBusy") : qrUrl ? t("btnQrClose") : t("btnQr")}
        </button>
        <button
          type="button"
          onClick={handlePdf}
          className="px-3 py-1.5 bg-zinc-900 text-white rounded text-xs hover:bg-zinc-700"
          title={t("btnPdfTitle")}
        >
          {t("btnPdf")}
        </button>
      </div>
      {qrUrl && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white border-2 border-violet-300 rounded-lg shadow-xl p-3">
          <QrCode url={qrUrl} size={180} showCaption={false} />
          <div className="mt-2 max-w-[180px] text-[10px] text-zinc-500 text-center font-mono break-all">
            {qrUrl}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── 短網址（可選，沒接 Upstash 就 fallback 長 URL） ─────────────── */

/**
 * 嘗試把長 path 換成短碼網址。失敗時 fallback 用原本的長 URL，不阻擋分享動作。
 * 失敗情境：API 503（伺服器沒設 UPSTASH 環境變數）、network error。
 */
async function shortenIfPossible(origin: string, longPath: string): Promise<string> {
  // 故意打到 publicOrigin（origin 參數）的 API，而非 window.location.origin。
  // 在 localhost 編輯時，window.location.origin 是 localhost:3000，但 localhost
  // dev server 沒設 UPSTASH 環境變數會回 503，所以要打到線上版（Vercel）的 API。
  try {
    const res = await fetch(`${origin}/api/quote/shorten`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: longPath }),
    });
    if (!res.ok) return `${origin}${longPath}`;
    const data = (await res.json()) as { code?: string };
    if (!data.code) return `${origin}${longPath}`;
    return `${origin}/q/${data.code}`;
  } catch {
    return `${origin}${longPath}`;
  }
}

/* ─────────────── 公開連結 base URL 解析 ─────────────── */

/**
 * 解析「分享出去的連結」應該用哪個 origin。
 * 優先用 Branding 設定的 publicBaseUrl，否則用 window.location.origin。
 * 如果偵測到 localhost / 私有 IP 且沒設 publicBaseUrl → 警告並回 null。
 */
function isLocalOrigin(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
    url,
  );
}

function resolvePublicOrigin(t: (key: string, vals?: Record<string, string | number>) => string): string | null {
  const branding = loadBranding();
  const explicit = branding.publicBaseUrl.trim().replace(/\/$/, "");

  // publicBaseUrl 本身是 localhost → 等於沒設，繼續往下檢查
  if (explicit && !isLocalOrigin(explicit)) return explicit;

  if (explicit && isLocalOrigin(explicit)) {
    alert(t("alertLocalBaseUrl", { url: explicit }));
    return null;
  }

  const origin = window.location.origin;
  if (isLocalOrigin(origin)) {
    alert(t("alertLocalOrigin"));
    return null;
  }
  return origin;
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
    designerMarkupRate: parseNum(get("designerMarkupRate"), LABOR_DEFAULTS.designerMarkupRate),
    vatRate: parseNum(get("vatRate"), LABOR_DEFAULTS.vatRate),
    quantity: parseNum(get("quantity"), LABOR_DEFAULTS.quantity),
    discountRate: parseNum(get("discountRate"), LABOR_DEFAULTS.discountRate),
    expiryDays: parseNum(get("expiryDays"), LABOR_DEFAULTS.expiryDays),
    depositRate: parseNum(get("depositRate"), LABOR_DEFAULTS.depositRate),
    bufferDays: parseNum(get("bufferDays"), LABOR_DEFAULTS.bufferDays),
    overrideUnitPrice: parseNum(get("overrideUnitPrice"), LABOR_DEFAULTS.overrideUnitPrice),
    laborHoursOverride: parseNum(get("laborHoursOverride"), LABOR_DEFAULTS.laborHoursOverride),
    deliveryDaysOverride: parseNum(get("deliveryDaysOverride"), LABOR_DEFAULTS.deliveryDaysOverride),
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

  // quotedAt 鎖定：從 form 拿；沒有就用今天，並把它「凍結」到 params 裡，
  // 讓寄出去的連結帶著這個日期，客人那邊 expiry 不會漂移。
  const quotedAtFromForm = get("quotedAt");
  const todayIso =
    quotedAtFromForm && /^\d{4}-\d{2}-\d{2}$/.test(quotedAtFromForm)
      ? quotedAtFromForm
      : taipeiIsoDate();
  const today = new Date(todayIso + "T00:00:00");
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + Math.round(opts.expiryDays));
  const expiryIso = taipeiIsoDate(expiry);
  const deliveryIso = taipeiIsoDate(addWorkdays(today, quote.estimatedWorkdays));

  // 組出當下完整 URL params（給 print page 用）；checkbox 沒勾的要從 params 移除
  const params = new URLSearchParams();
  for (const [k, v] of data.entries()) {
    params.set(k, v as string);
  }
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    if (!cb.checked) params.delete(cb.name);
  });
  // 確保短連結帶 quotedAt，給客人的有效期就鎖死了
  params.set("quotedAt", todayIso);

  return { opts, customer, quote, todayIso, expiryIso, deliveryIso, params };
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

type T = (key: string, vals?: Record<string, string | number>) => string;

function buildLineMessage(t: T, c: ShareContent): string {
  const greeting = c.customerName
    ? t("lineGreetingTpl", { name: c.customerName })
    : t("lineGreetingFallback");
  const hasSplit = c.depositRate > 0 && c.depositRate < 1;
  return [
    t("lineTitle"),
    ``,
    greeting,
    t("lineIntro"),
    ``,
    t("lineItemTpl", { name: c.furnitureName }),
    t("lineDimensionsTpl", { value: c.dimensions }),
    t("lineMaterialTpl", { name: c.materialName }),
    ``,
    t("lineTotalTpl", { total: twd(c.total) }),
    ...(hasSplit
      ? [
          t("lineDepositTpl", {
            pct: Math.round(c.depositRate * 100),
            amount: twd(c.depositAmount),
          }),
          t("lineBalanceTpl", { amount: twd(c.balanceAmount) }),
        ]
      : []),
    ``,
    t("lineDeliveryTpl", { date: c.deliveryDate }),
    t("lineExpiryTpl", { date: c.expiryDate }),
    ``,
    t("lineUrlLabel"),
    c.printUrl,
    ``,
    t("lineQuoteNoTpl", { no: c.quoteNo }),
    t("lineSignoff"),
    t("lineFrom"),
  ].join("\n");
}

function buildEmailContent(t: T, c: ShareContent): { subject: string; body: string } {
  const greeting = c.customerName
    ? t("lineGreetingTpl", { name: c.customerName })
    : t("lineGreetingFallback");
  const hasSplit = c.depositRate > 0 && c.depositRate < 1;
  const subject = t("emailSubjectTpl", {
    no: c.quoteNo,
    name: c.furnitureName,
    dim: c.dimensions,
  });
  const body = [
    greeting,
    ``,
    t("emailIntro"),
    ``,
    t("emailDivider"),
    t("emailItemTpl", { name: c.furnitureName }),
    t("emailDimTpl", { value: c.dimensions }),
    t("emailMaterialTpl", { name: c.materialName }),
    ``,
    t("emailTotalTpl", { total: twd(c.total) }),
    ...(hasSplit
      ? [
          t("emailDepositTpl", {
            pct: Math.round(c.depositRate * 100),
            amount: twd(c.depositAmount),
          }),
          t("emailBalanceTpl", { amount: twd(c.balanceAmount) }),
        ]
      : []),
    ``,
    t("emailDeliveryTpl", { date: c.deliveryDate }),
    t("emailExpiryTpl", { date: c.expiryDate }),
    t("emailDivider"),
    ``,
    t("emailLinkIntro"),
    c.printUrl,
    ``,
    t("emailSignoff"),
    ``,
    t("lineQuoteNoTpl", { no: c.quoteNo }),
    ``,
    t("emailFrom"),
  ].join("\n");
  return { subject, body };
}
