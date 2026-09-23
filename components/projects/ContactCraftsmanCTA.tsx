import { getLocale, getTranslations } from "next-intl/server";
import type { OwnerBranding } from "@/lib/projects/fetch-quote-data";

/**
 * 客戶版報價單最下方的「跟師傅聊聊」CTA。
 */
export async function ContactCraftsmanCTA({
  branding,
  quoteNo,
  customerName,
}: {
  branding: OwnerBranding;
  quoteNo: string;
  customerName: string | null;
}) {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "contactCraftsman" });
  const phone = branding.phone?.trim();
  const email = branding.email?.trim();
  const sender = branding.companyNameZh || t("studio");
  const greeting = customerName
    ? t("greetingTpl", { name: customerName })
    : t("greetingFallback");

  if (!phone && !email) return null;

  const inquiryBody = t("inquiryBodyTpl", { greeting, no: quoteNo });
  const phoneTel = phone?.replace(/[^\d+]/g, "") ?? "";

  return (
    <section className="mt-8 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 sm:p-6 print:hidden">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-lg">💬</span>
        <h2 className="text-base font-semibold text-amber-900">{t("h")}</h2>
      </div>
      <p className="text-xs text-amber-900/80 leading-relaxed mb-4">{t("intro")}</p>
      <div className="flex flex-wrap gap-2">
        {phone && (
          <a
            href={`tel:${phoneTel}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            {t("phoneBtn")}
            <span className="text-xs opacity-80 font-mono">{phone}</span>
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent(t("inquirySubjectTpl", { no: quoteNo }))}&body=${encodeURIComponent(inquiryBody)}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
          >
            {t("emailBtn")}
            <span className="text-xs opacity-80">{email}</span>
          </a>
        )}
      </div>
      <p className="mt-4 text-[10px] text-amber-900/60">
        {t("footerTpl", { sender })}
      </p>
    </section>
  );
}
