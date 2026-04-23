"use client";

import { useBranding } from "./branding";

function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** 付款條件 + 交貨售後 兩個資訊區塊 */
export function BrandedTermsBlocks() {
  const { data } = useBranding();
  const paymentLines = splitLines(data.paymentTerms);

  return (
    <section className="mt-6 grid grid-cols-2 gap-4 text-[10px]">
      <div className="border border-zinc-300 rounded">
        <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
          付款條件 PAYMENT TERMS
        </div>
        <div className="p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-800">
          {data.paymentTerms ||
            paymentLines.join("\n") ||
            "＿＿＿＿＿＿＿＿"}
        </div>
      </div>
      <div className="border border-zinc-300 rounded">
        <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
          交貨與售後 DELIVERY &amp; WARRANTY
        </div>
        <dl className="p-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-zinc-500">交貨期</dt>
          <dd className="text-zinc-900">
            {data.deliveryTerms || "＿＿＿＿＿＿＿＿"}
          </dd>
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
    <section className="mt-4 p-3 border border-zinc-300 rounded text-[10px] leading-relaxed">
      <p className="font-semibold mb-1">備註 NOTES</p>
      <ul className="list-disc pl-4 space-y-0.5 text-zinc-700">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
