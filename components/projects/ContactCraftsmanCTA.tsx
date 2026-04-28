import type { OwnerBranding } from "@/lib/projects/fetch-quote-data";

/**
 * 客戶版報價單最下方的「跟師傅聊聊」CTA。
 * 點 LINE / 電話 / Email 直接到師傅的聯絡方式，免去客戶切平台找號碼。
 *
 * 為什麼是 server component：本身就是純 render，沒必要 client 化。
 */
export function ContactCraftsmanCTA({
  branding,
  quoteNo,
  customerName,
}: {
  branding: OwnerBranding;
  quoteNo: string;
  customerName: string | null;
}) {
  const phone = branding.phone?.trim();
  const email = branding.email?.trim();
  const sender = branding.companyNameZh || "工作室";
  const greeting = customerName ? `${customerName} 您好，` : "您好，";

  // 沒任何聯絡方式就不顯示，避免空 CTA
  if (!phone && !email) return null;

  const inquiryBody = `${greeting}\n\n我看了您寄來的報價單（單號 ${quoteNo}），想跟您討論一下：\n\n（請在這裡寫下您的問題）\n\n謝謝！`;

  // 將電話的非數字字元清掉做 tel:link，但顯示原文
  const phoneTel = phone?.replace(/[^\d+]/g, "") ?? "";

  return (
    <section className="mt-8 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 sm:p-6 print:hidden">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-lg">💬</span>
        <h2 className="text-base font-semibold text-amber-900">
          有任何問題，直接跟師傅討論
        </h2>
      </div>
      <p className="text-xs text-amber-900/80 leading-relaxed mb-4">
        想調整尺寸？想換木材？想看更多細節？想問交期？任何問題都歡迎聯絡。
      </p>
      <div className="flex flex-wrap gap-2">
        {phone && (
          <a
            href={`tel:${phoneTel}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            📞 撥打電話
            <span className="text-xs opacity-80 font-mono">{phone}</span>
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent(`報價詢問（單號 ${quoteNo}）`)}&body=${encodeURIComponent(inquiryBody)}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700"
          >
            📧 寄信給師傅
            <span className="text-xs opacity-80">{email}</span>
          </a>
        )}
      </div>
      <p className="mt-4 text-[10px] text-amber-900/60">
        本報價由 {sender} 透過木頭仁設計生成器產出
      </p>
    </section>
  );
}
