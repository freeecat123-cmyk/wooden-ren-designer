/**
 * 管理員權限工具——共用 helper。
 *
 * ADMIN_EMAILS 從 server env 讀取（NEXT_PUBLIC_ADMIN_EMAILS 同步給 client，
 * 客戶端只用來判斷「該不該顯示後台連結」這類非安全敏感的 UI；真正的權限
 * 還是由 server route handler / middleware 用 server-side 變數驗證）。
 *
 * 環境變數設定（.env.local）：
 *   ADMIN_EMAILS=wengbinren@gmail.com,other@woodenren.com
 *   NEXT_PUBLIC_ADMIN_EMAILS=wengbinren@gmail.com,other@woodenren.com   # 可同上，給 client UI 判斷
 */

const FALLBACK_ADMIN = "wengbinren@gmail.com";

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Server-only：從 process.env.ADMIN_EMAILS 讀；空值 fallback 到木頭仁本人 email */
export function getServerAdminEmails(): string[] {
  const list = parseList(process.env.ADMIN_EMAILS);
  if (list.length > 0) return list;
  return [FALLBACK_ADMIN];
}

/** Client + Server：給 UI 用。空值同樣 fallback。 */
export function getPublicAdminEmails(): string[] {
  const list = parseList(process.env.NEXT_PUBLIC_ADMIN_EMAILS);
  if (list.length > 0) return list;
  return [FALLBACK_ADMIN];
}

export function isAdminEmail(email: string | null | undefined, list: string[]): boolean {
  if (!email) return false;
  return list.includes(email.toLowerCase());
}
