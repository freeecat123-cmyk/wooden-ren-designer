/**
 * 專案報價單號：Q-YYYYMMDD-XXXX（XXXX 從專案 id 衍生穩定後綴）
 * 不寫入 DB——同一專案任何時間生成都一致，不需要存欄位。
 *
 * 用台北時區算日期，避免 Vercel UTC server 與台灣使用者跨日不一致。
 */
import { taipeiYMD } from "@/lib/utils/date-tw";

export function projectQuoteNumber(projectId: string, today: Date): string {
  const ymd = taipeiYMD(today);
  // 取 project id 末 4 碼（uuid 末段最隨機），轉大寫
  const tail = projectId.replace(/-/g, "").slice(-4).toUpperCase();
  return `Q-${ymd}-${tail}`;
}
