"use client";

import { useTranslations } from "next-intl";
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
  /** 報價總額——當 BrandingData.paymentInstallments 設了多期時，用來算每期金額 */
  totalAmount?: number;
  /** 預估工作天（把交貨期裡的 ____ 填掉） */
  deliveryWorkdays?: number;
}

/** 付款條件 + 交貨售後 兩個資訊區塊 */
export function BrandedTermsBlocks({
  depositRate,
  depositAmount,
  balanceAmount,
  totalAmount,
  deliveryWorkdays,
}: TermsProps = {}) {
  const t = useTranslations("branded");
  const { data } = useBranding();
  const longDashes = t("dashesPlaceholder");
  const shortDashes = t("dashesShort");

  const userLines = splitLines(data.paymentTerms).filter(
    (l) => !/^(訂金|中期款|尾款|匯款銀行|帳戶|Deposit|Mid|Balance|Bank|Account)/i.test(l),
  );
  const autoPaymentLines: string[] = [];
  if (
    data.paymentInstallments.length > 0 &&
    typeof totalAmount === "number" &&
    totalAmount > 0
  ) {
    for (const inst of data.paymentInstallments) {
      const pct = Math.round(inst.ratio * 1000) / 10;
      const amt = Math.round(totalAmount * inst.ratio);
      autoPaymentLines.push(
        t("installmentLineTpl", {
          label: inst.label || t("installmentLabelFallback"),
          pct,
          amount: twd(amt),
        }),
      );
    }
  } else if (
    typeof depositRate === "number" &&
    depositRate > 0 &&
    depositRate < 1 &&
    typeof depositAmount === "number" &&
    typeof balanceAmount === "number"
  ) {
    const depositPct = Math.round(depositRate * 100);
    autoPaymentLines.push(
      t("depositLineTpl", { pct: depositPct, amount: twd(depositAmount) }),
      t("balanceLineTpl", { pct: 100 - depositPct, amount: twd(balanceAmount) }),
    );
  }
  const bankLines: string[] = [];
  if (data.bankName.trim()) bankLines.push(t("bankNameTpl", { bank: data.bankName }));
  if (data.bankAccount.trim()) bankLines.push(t("bankAccountTpl", { account: data.bankAccount }));
  const paymentBody = [...autoPaymentLines, ...userLines, ...bankLines].join("\n");

  let deliveryText = data.deliveryTerms || longDashes;
  if (
    typeof deliveryWorkdays === "number" &&
    deliveryWorkdays > 0 &&
    /[_＿]{2,}/.test(deliveryText)
  ) {
    deliveryText = deliveryText.replace(
      /[_＿]{2,}/,
      t("deliveryWorkdaysTpl", { n: deliveryWorkdays }),
    );
  }

  return (
    <section className="mt-3 grid grid-cols-2 gap-3 text-[10px]">
      <div className="border border-zinc-300 rounded">
        <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
          {t("termsPaymentH")}
        </div>
        <div className="p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-800">
          {paymentBody || longDashes}
        </div>
      </div>
      <div className="border border-zinc-300 rounded">
        <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
          {t("termsDeliveryH")}
        </div>
        <dl className="p-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-zinc-500">{t("termsDeliveryLbl")}</dt>
          <dd className="text-zinc-900">{deliveryText}</dd>
          <dt className="text-zinc-500">{t("termsWarrantyLbl")}</dt>
          <dd className="text-zinc-900">{data.warranty || shortDashes}</dd>
          <dt className="text-zinc-500">{t("termsAfterSalesLbl")}</dt>
          <dd className="text-zinc-900">{data.afterSales || shortDashes}</dd>
        </dl>
      </div>
    </section>
  );
}

interface NotesProps {
  /** 會放在使用者自訂備註之前的自動條款（由 quote 頁 checkbox 控制） */
  prependNotes?: string[];
}

/** 備註區塊 */
export function BrandedNotes({ prependNotes = [] }: NotesProps = {}) {
  const t = useTranslations("branded");
  const { data } = useBranding();
  const userNotes = splitLines(data.notes);
  const notes = [...prependNotes, ...userNotes];

  if (notes.length === 0) return null;

  return (
    <section className="mt-2 p-2 border border-zinc-300 rounded text-[10px] leading-relaxed">
      <p className="font-semibold mb-1">{t("notesH")}</p>
      <ul className="list-disc pl-4 space-y-0.5 text-zinc-700">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
