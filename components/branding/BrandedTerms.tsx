"use client";

import { useBranding } from "./branding";

function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function twd(n: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

interface TermsProps {
  /** 訂金比例 0–1；0 或 1 表示不做拆分，沿用使用者原文字 */
  depositRate?: number;
  depositAmount?: number;
  balanceAmount?: number;
  /** 預估工作天（把交貨期裡的 ____ 填掉） */
  deliveryWorkdays?: number;
}

/** 付款條件 + 交貨售後 兩個資訊區塊 */
export function BrandedTermsBlocks({
  depositRate,
  depositAmount,
  balanceAmount,
  deliveryWorkdays,
}: TermsProps = {}) {
  const { data } = useBranding();

  // 1. 付款條件：去掉原本的訂金/尾款行，用計算出的值替換
  const userLines = splitLines(data.paymentTerms).filter(
    (l) => !/^(訂金|尾款)/.test(l),
  );
  const autoPaymentLines: string[] = [];
  if (
    typeof depositRate === "number" &&
    depositRate > 0 &&
    depositRate < 1 &&
    typeof depositAmount === "number" &&
    typeof balanceAmount === "number"
  ) {
    const depositPct = Math.round(depositRate * 100);
    autoPaymentLines.push(
      `訂金：簽約付款 ${depositPct}%（${twd(depositAmount)}）`,
      `尾款：交貨前付款 ${100 - depositPct}%（${twd(balanceAmount)}）`,
    );
  }
  const paymentBody = [...autoPaymentLines, ...userLines].join("\n");

  // 2. 交貨期：若原文字含 ____ 空格，填入實際工作天
  let deliveryText = data.deliveryTerms || "＿＿＿＿＿＿＿＿";
  if (
    typeof deliveryWorkdays === "number" &&
    deliveryWorkdays > 0 &&
    /[_＿]{2,}/.test(deliveryText)
  ) {
    deliveryText = deliveryText.replace(
      /[_＿]{2,}/,
      `約 ${deliveryWorkdays} 個工作`,
    );
  }

  return (
    <section className="mt-3 grid grid-cols-2 gap-3 text-[10px]">
      <div className="border border-zinc-300 rounded">
        <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
          付款條件 PAYMENT TERMS
        </div>
        <div className="p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-800">
          {paymentBody || "＿＿＿＿＿＿＿＿"}
        </div>
      </div>
      <div className="border border-zinc-300 rounded">
        <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
          交貨與售後 DELIVERY &amp; WARRANTY
        </div>
        <dl className="p-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-zinc-500">交貨期</dt>
          <dd className="text-zinc-900">{deliveryText}</dd>
          <dt className="text-zinc-500">保固</dt>
          <dd className="text-zinc-900">{data.warranty || "＿＿＿＿"}</dd>
          <dt className="text-zinc-500">售後服務</dt>
          <dd className="text-zinc-900">{data.afterSales || "＿＿＿＿"}</dd>
        </dl>
      </div>
    </section>
  );
}

/** 備註區塊 */
export function BrandedNotes() {
  const { data } = useBranding();
  const notes = splitLines(data.notes);

  if (notes.length === 0) return null;

  return (
    <section className="mt-2 p-2 border border-zinc-300 rounded text-[10px] leading-relaxed">
      <p className="font-semibold mb-1">備註 NOTES</p>
      <ul className="list-disc pl-4 space-y-0.5 text-zinc-700">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
