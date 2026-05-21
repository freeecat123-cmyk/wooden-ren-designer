"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EMPTY_CUSTOMER, type CustomerInfo } from "@/components/customer/customer";
import { CustomerForm } from "@/components/customer/CustomerForm";
import { EngineeringQuoteForm, type EngQuoteOpts } from "./EngineeringQuoteForm";
import { computeEngineeringQuote } from "@/lib/engineering-quote/calc";
import { encodeState } from "@/lib/engineering-quote/url-codec";
import { ENGINEERING_QUOTE_DEFAULTS } from "@/lib/engineering-quote/defaults";
import { formatTWD } from "@/lib/pricing/catalog";
import type { EngQuoteType } from "@/lib/engineering-quote/types";

interface Props {
  quoteType: EngQuoteType;
  /** 模擬器 input 的 base64(原樣傳給列印頁) */
  encodedSimInput: string;
  /** 平面圖縮圖 */
  overview: React.ReactNode;
  /** 由 server 用 adapter 算好的、與費用無關的基礎欄位 */
  base: {
    pingShu: number;
    areaM2: number;
    materialCost: number;
    materialLines: import("@/lib/engineering-quote/types").EngLineItem[];
  };
}

export function EngineeringQuoteClient({
  quoteType,
  encodedSimInput,
  overview,
  base,
}: Props) {
  const router = useRouter();
  const customerFormRef = useRef<HTMLFormElement>(null);
  const [opts, setOpts] = useState<EngQuoteOpts>(ENGINEERING_QUOTE_DEFAULTS);

  // 天花板材料費隨 opts.ceilingMaterialPerPing 變動
  const materialCost =
    quoteType === "ceiling"
      ? Math.round(opts.ceilingMaterialPerPing * base.pingShu)
      : base.materialCost;
  const materialLines =
    quoteType === "ceiling"
      ? [
          {
            ...base.materialLines[0],
            amount: materialCost,
            unpriced: opts.ceilingMaterialPerPing <= 0,
          },
        ]
      : base.materialLines;

  const breakdown = useMemo(
    () =>
      computeEngineeringQuote({
        quoteType,
        pingShu: base.pingShu,
        areaM2: base.areaM2,
        materialCost,
        materialLines,
        laborPricePerPing: opts.laborPricePerPing,
        demolitionMode: opts.demolitionMode,
        demolitionLump: opts.demolitionLump,
        demolitionPerPing: opts.demolitionPerPing,
        shippingCost: opts.shippingCost,
        consumablesMode: opts.consumablesMode,
        consumablesLump: opts.consumablesLump,
        consumablesPercent: opts.consumablesPercent,
        paintingPerPing: opts.paintingPerPing,
        marginRate: opts.marginRate,
        vatRate: opts.vatRate,
        discountRate: opts.discountRate,
        depositRate: opts.depositRate,
        validityDays: opts.validityDays,
      }),
    [quoteType, base, materialCost, materialLines, opts],
  );

  function goPrint() {
    const formEl = customerFormRef.current;
    const fd = formEl ? new FormData(formEl) : new FormData();
    const customer: CustomerInfo = {
      name: String(fd.get("customerName") ?? ""),
      contact: String(fd.get("customerContact") ?? ""),
      phone: String(fd.get("customerPhone") ?? ""),
      address: String(fd.get("customerAddress") ?? ""),
      taxId: String(fd.get("customerTaxId") ?? ""),
      email: String(fd.get("customerEmail") ?? ""),
    };
    const params = new URLSearchParams();
    params.set("d", encodedSimInput);
    params.set("o", encodeState(opts));
    params.set("c", encodeState(customer));
    router.push(`/${quoteType}/quote/print?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-lg font-bold">
        {quoteType === "floor" ? "地板" : "天花板"}工程報價
      </h1>
      <div className="grid gap-6 md:grid-cols-2">
        {/* 左:輸入 */}
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">客戶資料</h2>
            {/* 不原生提交的 form:CustomerForm 是 uncontrolled,goPrint 時用 FormData 讀實際輸入值 */}
            <form ref={customerFormRef} onSubmit={(e) => e.preventDefault()}>
              <CustomerForm initial={EMPTY_CUSTOMER} />
            </form>
          </section>
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">費用參數</h2>
            <EngineeringQuoteForm quoteType={quoteType} value={opts} onChange={setOpts} />
          </section>
        </div>

        {/* 右:試算 */}
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 p-4">
            <div className="mb-2 text-xs text-zinc-500">
              坪數 {base.pingShu.toFixed(2)} 坪 · 面積 {base.areaM2.toFixed(2)} m²
            </div>
            {overview}
          </section>
          <section className="rounded-lg border border-zinc-200 p-4">
            <h2 className="mb-3 text-sm font-semibold">報價試算</h2>
            <table className="w-full text-xs">
              <tbody>
                {breakdown.lines.map((ln, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    <td className="py-1">{ln.label}</td>
                    <td className="py-1 text-right">
                      {ln.unpriced ? (
                        <span className="text-zinc-400">未報價</span>
                      ) : (
                        formatTWD(ln.amount)
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-400 font-bold">
                  <td className="py-1">含稅總計</td>
                  <td className="py-1 text-right">{formatTWD(breakdown.total)}</td>
                </tr>
              </tbody>
            </table>
            {breakdown.hasUnpriced && (
              <p className="mt-2 text-xs text-rose-600">⚠️ 估價不完整(有品項未設單價)</p>
            )}
            <button
              onClick={goPrint}
              className="mt-4 w-full rounded bg-[#bd9955] py-2 text-sm font-semibold text-white"
            >
              列印報價單
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
