import { redirect } from "next/navigation";

/**
 * /design 沒有對應頁面（家具設計入口走 /design/[type]）。
 * 直接打 /design 之前會 404，現在 302 回首頁讓使用者選家具種類。
 */
export default function DesignIndex() {
  redirect("/");
}
