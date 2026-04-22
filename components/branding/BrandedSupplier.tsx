"use client";

import { useBranding } from "./branding";

const DASH = "＿＿＿＿＿＿＿＿";

export function BrandedSupplier() {
  const { data } = useBranding();

  return (
    <div className="border border-zinc-300 rounded">
      <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
        供應商 FROM
      </div>
      <dl className="p-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        <Row k="公司" v={data.companyNameEn || DASH} />
        <Row k="中文" v={data.companyNameZh || DASH} />
        <Row k="地址" v={data.address || DASH} />
        <Row k="電話" v={data.phone || DASH} />
        <Row k="統編" v={data.taxId || DASH} />
        <Row k="聯絡人" v={data.contact || DASH} />
        {data.email && <Row k="email" v={data.email} />}
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-zinc-900 font-mono break-all">{v}</dd>
    </>
  );
}

export function BrandedFooter() {
  const { data } = useBranding();
  const company = data.companyNameEn || "Wooden Ren Education Co., Ltd.";
  return (
    <footer className="mt-6 pt-3 border-t border-zinc-200 text-center text-[9px] text-zinc-500">
      © 2026 {company} · 本報價單由家具設計生成器自動產出
    </footer>
  );
}

export function BrandedSignature({ todayStr }: { todayStr: string }) {
  const { data } = useBranding();
  const company = data.companyNameZh || "木頭仁木匠學院";
  return (
    <div className="mt-1 flex justify-between text-zinc-600">
      <span>{company}</span>
      <span>日期：{todayStr}</span>
    </div>
  );
}
