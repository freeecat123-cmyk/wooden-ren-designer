/**
 * 台北時區（UTC+8）日期工具
 *
 * Vercel server 在 UTC，直接 `date.toISOString().slice(0,10)` 會在
 * 台灣早上 0-8 點跑成「昨天」、下午 4 點後又會比預期前一天──
 * 是過去「LINE 分享案號跟畫面顯示對不上」「印刷頁日期錯」這類 bug 的根源。
 *
 * 一律改用 Intl.DateTimeFormat 指定 Asia/Taipei 取本地日期。
 */

/** 回傳台北時區的 YYYY-MM-DD */
export function taipeiIsoDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const d = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${d}`;
}

/** 回傳台北時區的 YYYYMMDD（無分隔，給單號用） */
export function taipeiYMD(date: Date = new Date()): string {
  return taipeiIsoDate(date).replace(/-/g, "");
}
