"use client";

import { BrandedHeader } from "@/components/branding/BrandedHeader";
import { BrandedSupplier } from "@/components/branding/BrandedSupplier";
import { BrandedTermsBlocks } from "@/components/branding/BrandedTerms";
import { formatTWD } from "@/lib/pricing/catalog";
import { computeValidUntil } from "@/lib/engineering-quote/calc";
import type {
  EngineeringQuoteInput,
  EngineeringQuoteBreakdown,
} from "@/lib/engineering-quote/types";
import type { CustomerInfo } from "@/components/customer/customer";

interface Props {
  quoteType: "floor" | "ceiling";
  input: EngineeringQuoteInput;
  breakdown: EngineeringQuoteBreakdown;
  customer: CustomerInfo;
  /** 平面圖(由 page 傳入 FloorOverviewSvg / CeilingOverviewSvg) */
  overview: React.ReactNode;
  /** viewMode：customer 隱藏成本明細與毛利 */
  viewMode: "customer" | "internal";
}

export function EngineeringQuotePrint({
  quoteType,
  input,
  breakdown,
  customer,
  overview,
  viewMode,
}: Props) {
  const b = breakdown;
  const title = quoteType === "floor" ? "地板工程報價單" : "天花板工程報價單";
  const validUntil = computeValidUntil(input.validityDays);

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-zinc-800">
      {/* ===== 第 1 頁 ===== */}
      <BrandedHeader />
      <h1 className="my-3 text-center text-lg font-bold">{title}</h1>

      <div className="flex justify-between text-xs">
        <BrandedSupplier />
        <div className="text-right">
          <div className="font-semibold">客戶</div>
          <div>{customer.name || "—"}</div>
          {customer.contact && <div>{customer.contact}</div>}
          {customer.phone && <div>{customer.phone}</div>}
          {customer.address && <div>{customer.address}</div>}
          {customer.taxId && <div>統編 {customer.taxId}</div>}
          {customer.email && <div>{customer.email}</div>}
        </div>
      </div>

      {/* 平面圖 + 坪數 */}
      <div className="my-4 flex items-center gap-4 rounded border border-zinc-200 p-3">
        <div className="shrink-0">{overview}</div>
        <div className="text-xs">
          <div>
            坪數 <span className="text-base font-bold">{input.pingShu.toFixed(2)}</span> 坪
          </div>
          <div className="text-zinc-500">面積 {input.areaM2.toFixed(2)} m²</div>
        </div>
      </div>

      {/* 工程品項表 */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-zinc-300 bg-zinc-50">
            <th className="py-1 text-left">項目</th>
            <th className="py-1 text-left">說明</th>
            <th className="py-1 text-right">金額</th>
          </tr>
        </thead>
        <tbody>
          {b.lines.map((ln, i) => (
            <tr key={`${ln.label}-${i}`} className="border-b border-zinc-100">
              <td className="py-1">{ln.label}</td>
              <td className="py-1 text-zinc-500">{ln.detail ?? ""}</td>
              <td className="py-1 text-right">
                {ln.unpriced ? (
                  <span className="text-zinc-400">未報價</span>
                ) : (
                  formatTWD(ln.amount)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 總計 */}
      <div className="mt-3 ml-auto w-64 text-xs">
        {viewMode === "internal" && (
          <>
            <Row label="成本小計" value={formatTWD(b.costSubtotal)} />
            <Row label={`毛利`} value={formatTWD(b.margin)} />
          </>
        )}
        <Row label="未稅小計" value={formatTWD(b.subtotalExclVat)} />
        {b.discountAmount > 0 && (
          <Row label="折扣" value={`−${formatTWD(b.discountAmount)}`} />
        )}
        <Row label={`營業稅 ${Math.round(input.vatRate * 100)}%`} value={formatTWD(b.vat)} />
        <Row label="總計" value={formatTWD(b.total)} bold />
        <Row label="訂金" value={formatTWD(b.depositAmount)} />
        <Row label="交貨尾款" value={formatTWD(b.balanceAmount)} />
      </div>

      {b.hasUnpriced && (
        <p className="mt-2 text-xs text-rose-600">⚠️ 部分品項未設定單價,此報價尚不完整。</p>
      )}
      <p className="mt-2 text-xs text-zinc-500">報價有效至 {validUntil}</p>

      {/* ===== 第 2 頁 ===== */}
      <div className="quote-page-break" />
      {/* deliveryWorkdays 不傳:工程報價無工時模型,不估施工天數(spec 範圍外) */}
      <BrandedTermsBlocks
        depositRate={input.depositRate}
        depositAmount={b.depositAmount}
        balanceAmount={b.balanceAmount}
        totalAmount={b.total}
      />
      <div className="mt-12 flex justify-between text-xs">
        <div>客戶簽章：________________</div>
        <div>承包商簽章：________________</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between border-b border-zinc-100 py-1 ${
        bold ? "border-zinc-400 font-bold" : ""
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
