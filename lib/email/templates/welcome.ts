/**
 * 新註冊歡迎信。OAuth callback 偵測 user.welcome_email_sent_at IS NULL 時寄。
 *
 * locale: 來自 profile.locale（'zh-TW' 或 'en'）；未指定預設 zh-TW。
 */
import { escapeHtml } from "../escape";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

const LINE_OA_URL = "https://lin.ee/EaXGbJ1";

function htmlShell(title: string, bodyHtml: string, locale: string): string {
  const footer = locale === "en"
    ? "Wooden Ren Furniture Design Tool"
    : "木頭仁家具工程圖工具";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="font-size:22px;margin:0 0 16px;color:#0f172a">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">${footer} · <a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

export function welcomeEmail(input: { name?: string | null; locale?: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const locale = input.locale === "en" ? "en" : "zh-TW";
  const isEn = locale === "en";
  const greetingText = input.name ? `${input.name}` : (isEn ? "Hi" : "你好");
  const greetingHtml = escapeHtml(greetingText);

  if (isEn) {
    const subject = "Welcome to Wooden Ren Blueprint";
    const text = [
      `Hi ${greetingText},`,
      ``,
      `Welcome to the Wooden Ren furniture design tool. I built it for my own woodworking workflow:`,
      `- Quickly produce furniture dimensions + 3-views + engineering drawings`,
      `- Quotes, cut lists, and stock layouts`,
      `- Share design links with clients`,
      ``,
      `Free plan: 3 practice templates (square stool, pencil holder, side table).`,
      `Paid plans: all 28 furniture templates + advanced features.`,
      ``,
      `Get started: ${SITE_URL}/en`,
      `See plans: ${SITE_URL}/en/pricing`,
      ``,
      `📌 Subscription notes:`,
      `- Monthly plans auto-renew every 30 days — cancel before billing to stop.`,
      `- To cancel, visit ${SITE_URL}/en/my-subscription and click "Cancel subscription" (you keep access through the current period).`,
      `- Annual plans don't auto-renew — we'll send a reminder 7 days before expiry.`,
      ``,
      `Questions:`,
      `- Reply to this email (it reaches me directly)`,
      `- LINE official account: ${LINE_OA_URL}`,
      ``,
      `Wooden Ren`,
    ].join("\n");
    const html = htmlShell(
      subject,
      `<p>Hi ${greetingHtml},</p>
<p>Welcome to <strong>Wooden Ren Blueprint</strong>. I built it for my own woodworking workflow:</p>
<ul style="padding-left:20px;line-height:1.7">
<li>Quickly produce furniture dimensions + 3-views + engineering drawings</li>
<li>Quotes, cut lists, and stock layouts</li>
<li>Share design links with clients</li>
</ul>
<p style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;color:#166534;font-size:14px">
Free plan: 3 practice templates (square stool, pencil holder, side table). Paid plans: all furniture templates + advanced features.
</p>
<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px;color:#92400e;font-size:14px;margin-top:12px">
<p style="margin:0 0 8px;font-weight:600">📌 Subscription notes</p>
<ul style="padding-left:20px;line-height:1.7;margin:0">
<li><strong>Monthly plans auto-renew</strong> every 30 days — cancel before billing to stop.</li>
<li>To cancel, visit <a href="${SITE_URL}/en/my-subscription" style="color:#92400e;text-decoration:underline">My subscription</a> and click "Cancel subscription" (you keep access through the current period).</li>
<li>Annual plans don't auto-renew — we'll send a reminder 7 days before expiry.</li>
</ul>
</div>
<p style="margin:20px 0">
  <a href="${SITE_URL}/en" target="_blank" rel="noopener" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:8px">Get started →</a>
  <a href="${SITE_URL}/en/pricing" target="_blank" rel="noopener" style="display:inline-block;background:#fff;color:#059669;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid #059669">See plans</a>
</p>
<p style="color:#374151;font-size:14px;margin-top:24px"><strong>Questions:</strong></p>
<ul style="padding-left:20px;line-height:1.8;color:#6b7280;font-size:14px">
<li>Reply to this email (it reaches me directly)</li>
<li>LINE official account: <a href="${LINE_OA_URL}" target="_blank" rel="noopener" style="color:#059669">add as friend</a></li>
</ul>
<p style="margin:0;color:#374151">Wooden Ren</p>`,
      locale,
    );
    return { subject, text, html };
  }

  // zh-TW (default)
  const subject = "歡迎使用木頭仁 木作藍圖";
  const text = [
    `${greetingText}，`,
    ``,
    `歡迎加入木頭仁家具工程圖。這是我自己做木工時用來：`,
    `- 快速產出家具尺寸 + 三視圖 + 工程圖`,
    `- 報價、材料單、裁切圖`,
    `- 跟客戶分享設計連結`,
    ``,
    `免費版可以用 3 種練習小物（方凳、筆筒、書擋）。`,
    `付費方案開放全部 28 種家具 + 進階功能。`,
    ``,
    `馬上開始：${SITE_URL}`,
    `看付費方案：${SITE_URL}/pricing`,
    ``,
    `📌 訂閱小提醒：`,
    `- 月扣方案會自動續扣（每 30 天一次），到期前要主動取消才會停。`,
    `- 想停扣請到 ${SITE_URL}/my-subscription 按「取消訂閱」（仍可用到本期末）。`,
    `- 年付不會自動續，到期前 7 天會收提醒信。`,
    ``,
    `有問題聯絡：`,
    `- 直接回信（這封 email 回我這）`,
    `- LINE 官方帳號：${LINE_OA_URL}`,
    ``,
    `木頭仁`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p>${greetingHtml}，</p>
<p>歡迎加入<strong>木頭仁家具工程圖</strong>。這是我自己做木工時用來：</p>
<ul style="padding-left:20px;line-height:1.7">
<li>快速產出家具尺寸 + 三視圖 + 工程圖</li>
<li>報價、材料單、裁切圖</li>
<li>跟客戶分享設計連結</li>
</ul>
<p style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;color:#166534;font-size:14px">
免費版可以用 3 種練習小物（方凳、筆筒、書擋）。付費方案開放全部家具 + 進階功能。
</p>
<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px;color:#92400e;font-size:14px;margin-top:12px">
<p style="margin:0 0 8px;font-weight:600">📌 訂閱小提醒</p>
<ul style="padding-left:20px;line-height:1.7;margin:0">
<li><strong>月扣方案會自動續扣</strong>（每 30 天一次），到期前要主動取消才會停。</li>
<li>想停扣請到 <a href="${SITE_URL}/my-subscription" style="color:#92400e;text-decoration:underline">我的訂閱</a> 按「取消訂閱」（仍可用到本期末）。</li>
<li>年付不會自動續，到期前 7 天會收提醒信。</li>
</ul>
</div>
<p style="margin:20px 0">
  <a href="${SITE_URL}" target="_blank" rel="noopener" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:8px">馬上開始 →</a>
  <a href="${SITE_URL}/pricing" target="_blank" rel="noopener" style="display:inline-block;background:#fff;color:#059669;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid #059669">看付費方案</a>
</p>
<p style="color:#374151;font-size:14px;margin-top:24px"><strong>有問題聯絡：</strong></p>
<ul style="padding-left:20px;line-height:1.8;color:#6b7280;font-size:14px">
<li>直接回信（這封 email 回我這）</li>
<li>LINE 官方帳號：<a href="${LINE_OA_URL}" target="_blank" rel="noopener" style="color:#059669">點此加好友</a></li>
</ul>
<p style="margin:0;color:#374151">木頭仁</p>`,
    locale,
  );
  return { subject, text, html };
}
