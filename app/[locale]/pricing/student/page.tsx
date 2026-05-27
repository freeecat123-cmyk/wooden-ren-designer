import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentPricingClient } from "@/components/StudentPricingClient";
import { routing } from "@/i18n/routing";

/**
 * /pricing/student — 學員續用方案隱藏頁
 * 公開 pricing 頁不顯示這頁，只有木頭仁傳給學員的人才會進來。
 * robots noindex 避免搜尋引擎收錄。
 *
 * 國際版規則：學員方案是台灣業務（木匠學院綁定），英文版完全沒這頁。
 * /en/pricing/student → notFound() 回 404。
 */
export const metadata: Metadata = {
  title: "學員專屬續用方案｜木頭仁 木作藍圖",
  description: "木匠學院學員 2 年免費期結束後續用方案 — 個人 NT$ 219、專業 NT$ 690 / 月。",
  robots: { index: false, follow: false },
  alternates: { canonical: "/pricing/student" },
};

export default async function StudentPricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== routing.defaultLocale) notFound();
  return <StudentPricingClient />;
}
