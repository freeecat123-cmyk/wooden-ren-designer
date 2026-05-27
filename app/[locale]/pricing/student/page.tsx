import type { Metadata } from "next";
import { StudentPricingClient } from "@/components/StudentPricingClient";

/**
 * /pricing/student — 學員續用方案隱藏頁
 * 公開 pricing 頁不顯示這頁，只有木頭仁傳給學員的人才會進來。
 * robots noindex 避免搜尋引擎收錄。
 */
export const metadata: Metadata = {
  title: "學員專屬續用方案｜木頭仁 木作藍圖",
  description: "木匠學院學員 2 年免費期結束後續用方案 — 個人 NT$ 219、專業 NT$ 690 / 月。",
  robots: { index: false, follow: false },
  alternates: { canonical: "/pricing/student" },
};

export default function StudentPricingPage() {
  return <StudentPricingClient />;
}
