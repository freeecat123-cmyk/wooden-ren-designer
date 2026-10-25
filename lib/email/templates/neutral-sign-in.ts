/**
 * 中性品牌（Furniture Blueprints）的登入／註冊連結信 —— 英文、無任何 Wooden Ren 字樣。
 * 由 app/api/auth/neutral-link 經 Gmail SMTP 寄出（取代 Supabase 內建的中文模板）。
 * 文案對齊登入頁 loginButton.sentBodySuffix（valid for 10 minutes）。
 */
import { NEUTRAL_BRAND_NAME } from "@/lib/brand-hosts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function neutralSignInEmail({ link, isNewUser }: { link: string; isNewUser: boolean }) {
  const B = NEUTRAL_BRAND_NAME;
  const subject = isNewUser ? `Confirm your email to start using ${B}` : `Your ${B} sign-in link`;
  const intro = isNewUser
    ? `Welcome! Click the button below to confirm your email and finish creating your ${B} account. No password needed.`
    : `Click the button below to sign in to ${B}. No password needed.`;
  const btn = `Sign in to ${B}`;
  const expiry = "This link is valid for 10 minutes and can only be used once.";
  const ignore = "If you didn't request this email, you can safely ignore it.";

  const text = [
    "Hi,",
    "",
    intro,
    "",
    `${btn}:`,
    link,
    "",
    expiry,
    ignore,
    "",
    `— ${B}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#27272a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
        <tr><td style="font-size:18px;font-weight:700;color:#18181b;padding-bottom:16px;">${esc(B)}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px;">Hi,<br><br>${esc(intro)}</td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${esc(link)}" style="display:inline-block;background:#b45309;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px;">${esc(btn)}</a>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.6;color:#52525b;padding-bottom:16px;">${esc(expiry)}<br>${esc(ignore)}</td></tr>
        <tr><td style="font-size:12px;line-height:1.6;color:#a1a1aa;word-break:break-all;">If the button doesn't work, copy this link into your browser:<br><a href="${esc(link)}" style="color:#a1a1aa;">${esc(link)}</a></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
