/**
 * `next=` 參數的清洗：只允許本站相對路徑。
 *
 * 這份邏輯原本只寫在 app/auth/callback/route.ts 裡，但 `next=` 有兩個消費者
 * —— OAuth 回呼與 /login 頁本身 —— 而後者當時直接把原始值餵給 redirect()，
 * 等於整套防護只裝在一半的門上。安全判斷跟權限判斷一樣，只准有一份定義。
 */

/**
 * 限制 next= 只能是本站相對路徑（防 open redirect 釣魚）。
 * 拒絕：
 * - 非 / 開頭（next=evil.com）
 * - // 開頭（next=//evil.com → 瀏覽器當成 https://evil.com）
 * - /\ 反斜線變體（next=/\evil.com）
 * - 含 protocol（next=javascript: 或 next=https://evil.com）
 */
export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return "/"; // /javascript:... 之類
  return raw;
}
