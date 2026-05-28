"use client";

import { useLocale, useTranslations } from "next-intl";
import { BrandedHeader } from "@/components/branding/BrandedHeader";
import { BrandedSupplier } from "@/components/branding/BrandedSupplier";
import { BrandedTermsBlocks } from "@/components/branding/BrandedTerms";
import { formatMoney } from "@/lib/pricing/catalog";
import { useCurrency } from "@/hooks/useCurrency";
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
  /** 平面圖（由 page 傳入 FloorOverviewSvg / CeilingOverviewSvg） */
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
  const t = useTranslations("engQuotePrint");
  const locale = useLocale();
  const currency = useCurrency();
  const fmt = (n: number) => formatMoney(n, currency);
  const b = breakdown;
  const title = quoteType === "floor" ? t("titleFloor") : t("titleCeiling");
  const validUntil = computeValidUntil(input.validityDays);
  const DASH = "—";

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-zinc-800">
      <BrandedHeader />
      <h1 className="my-3 text-center text-lg font-bold">{title}</h1>
      {locale === "en" && currency === "USD" && (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-900">
          USD amounts converted from TWD at the rate baked into this build (≈32 TWD per USD). Actual charge in TWD may vary slightly with your bank&apos;s rate.
        </div>
      )}

      <div className="flex justify-between text-xs">
        <BrandedSupplier />
        <div className="text-right">
          <div className="font-semibold">{t("customerH")}</div>
          <div>{customer.name || DASH}</div>
          {customer.contact && <div>{customer.contact}</div>}
          {customer.phone && <div>{customer.phone}</div>}
          {customer.address && <div>{customer.address}</div>}
          {customer.taxId && <div>{t("taxIdPrefix")} {customer.taxId}</div>}
          {customer.email && <div>{customer.email}</div>}
        </div>
      </div>

      <div className="my-4 flex items-center gap-4 rounded border border-zinc-200 p-3">
        <div className="shrink-0">{overview}</div>
        <div className="text-xs">
          <div>
            {t("pingTpl")} <span className="text-base font-bold">{input.pingShu.toFixed(2)}</span> {t("ping")}
          </div>
          <div className="text-zinc-500">{t("areaTpl")} {input.areaM2.toFixed(2)} m²</div>
        </div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-zinc-300 bg-zinc-50">
            <th className="py-1 text-left">{t("thItem")}</th>
            <th className="py-1 text-left">{t("thDetail")}</th>
            <th className="py-1 text-right">{t("thAmount")}</th>
          </tr>
        </thead>
        <tbody>
          {b.lines.map((ln, i) => (
            <tr key={`${ln.label}-${i}`} className="border-b border-zinc-100">
              <td className="py-1">{ln.label}</td>
              <td className="py-1 text-zinc-500">{ln.detail ?? ""}</td>
              <td className="py-1 text-right">
                {ln.unpriced ? (
                  <span className="text-zinc-400">{t("unpriced")}</span>
                ) : (
                  fmt(ln.amount)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 ml-auto w-64 text-xs">
        {viewMode === "internal" && (
          <>
            <Row label={t("rowCostSubtotal")} value={fmt(b.costSubtotal)} />
            <Row label={t("rowMargin")} value={fmt(b.margin)} />
          </>
        )}
        <Row label={t("rowSubtotalExclVat")} value={fmt(b.subtotalExclVat)} />
        {b.discountAmount > 0 && (
          <Row label={t("rowDiscount")} value={`−${fmt(b.discountAmount)}`} />
        )}
        <Row
          label={t("rowVatTpl", { pct: Math.round(input.vatRate * 100) })}
          value={fmt(b.vat)}
        />
        <Row label={t("rowTotal")} value={fmt(b.total)} bold />
        <Row label={t("rowDeposit")} value={fmt(b.depositAmount)} />
        <Row label={t("rowBalance")} value={fmt(b.balanceAmount)} />
      </div>

      {b.hasUnpriced && (
        <p className="mt-2 text-xs text-rose-600">{t("unpricedWarn")}</p>
      )}
      <p className="mt-2 text-xs text-zinc-500">{t("validUntilTpl", { date: validUntil })}</p>

      <div className="quote-page-break" />
      <BrandedTermsBlocks
        depositRate={input.depositRate}
        depositAmount={b.depositAmount}
        balanceAmount={b.balanceAmount}
        totalAmount={b.total}
      />
      <div className="mt-12 flex justify-between text-xs">
        <div>{t("signCustomer")}</div>
        <div>{t("signContractor")}</div>
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
