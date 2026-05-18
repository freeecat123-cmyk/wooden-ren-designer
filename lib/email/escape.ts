/**
 * HTML-escape user input before interpolating into email HTML templates。
 *
 * 必須用於：任何從 user/body/Google OAuth metadata 拿來的字串、
 * 插進 `<p>${val}</p>` 之前。
 *
 * 例：
 *   - users.name（Google 顯示名，可塞 `<a href=phish>`）
 *   - refund_requests.reason（user body）
 *   - refund_requests.admin_note（admin body、轉寄給 user）
 *   - userEmail（少數收件人輸入錯亂或被竄改）
 */
export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
