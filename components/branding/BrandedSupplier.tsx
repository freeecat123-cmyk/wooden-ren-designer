"use client";

import { useTranslations } from "next-intl";
import { useBranding } from "./branding";

export function BrandedSupplier() {
  const t = useTranslations("branded");
  const { data } = useBranding();
  const DASH = t("dashesPlaceholder");

  return (
    <div className="border border-zinc-300 rounded">
      <div className="bg-zinc-100 px-3 py-1.5 text-[10px] font-semibold tracking-wider border-b border-zinc-300">
        {t("supplierH")}
      </div>
      <dl className="p-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        <Row k={t("fieldCompany")} v={data.companyNameEn || DASH} />
        <Row k={t("fieldChinese")} v={data.companyNameZh || DASH} />
        <Row k={t("fieldAddress")} v={data.address || DASH} />
        <Row k={t("fieldPhone")} v={data.phone || DASH} />
        <Row k={t("fieldTaxId")} v={data.taxId || DASH} />
        <Row k={t("fieldContact")} v={data.contact || DASH} />
        {data.email && <Row k={t("fieldEmail")} v={data.email} />}
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
  const t = useTranslations("branded");
  const { data } = useBranding();
  const company = data.companyNameEn || t("footerCompanyFallback");
  return (
    <footer className="mt-6 pt-3 border-t border-zinc-200 text-center text-[9px] text-zinc-500">
      {t("footerCopyright", { company })}
    </footer>
  );
}

export function BrandedSignature({ todayStr }: { todayStr: string }) {
  const t = useTranslations("branded");
  const { data } = useBranding();
  const company = data.companyNameZh || t("signatureCompanyFallback");
  return (
    <div className="mt-1 flex justify-between text-zinc-600">
      <span>{company}</span>
      <span>{t("signatureDateTpl", { date: todayStr })}</span>
    </div>
  );
}
