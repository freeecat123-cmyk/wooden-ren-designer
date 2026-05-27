import { redirect } from "next/navigation";

/**
 * /design 沒有對應頁面（家具設計入口走 /design/[type]）。
 * 直接打 /design 時 302 回 /app 家具目錄。
 */
export default function DesignIndex() {
  redirect("/app");
}
