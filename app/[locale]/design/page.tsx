import { redirect } from "@/i18n/navigation";

/**
 * /design 沒有對應頁面（家具設計入口走 /design/[type]）。
 * 直接打 /design 時 302 回 /app 家具目錄。
 */
export default async function DesignIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/app", locale });
}
