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
      `Welcome to the Wooden Ren furniture design tool. First thing to do: draw your own workbench.`,
      `Every woodworker's first project should be their bench — everything after it gets built on top. The workbench template is free, no payment needed:`,
      `${SITE_URL}/en/workbench`,
      ``,
      `Enter your height, pick a style (Roubo slab-top, apron, tool-well, MFT grid or classroom bench), and you get:`,
      `- 3D + three-view drawings + part drawings`,
      `- Cut list and stock layout`,
      `- Vise, dog holes and holdfast holes placed for you`,
      ``,
      `Free plan: 3 templates (square stool, pencil holder, workbench).`,
      `Paid plans: all 28 furniture templates + advanced features.`,
      ``,
      `Draw your workbench: ${SITE_URL}/en/workbench`,
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
<p>Welcome to <strong>Wooden Ren Blueprint</strong>. First thing to do: <strong>draw your own workbench</strong>.</p>
<p>Every woodworker's first project should be their bench — everything after it gets built on top. The workbench template is free, no payment needed:<br/>
<a href="${SITE_URL}/en/workbench" target="_blank" rel="noopener" style="color:#059669;font-weight:600">${SITE_URL.replace(/^https?:\/\//, "")}/en/workbench</a></p>
<p>Enter your height, pick a style (Roubo slab-top, apron, tool-well, MFT grid or classroom bench), and you get:</p>
<ul style="padding-left:20px;line-height:1.7">
<li>3D + three-view drawings + part drawings</li>
<li>Cut list and stock layout</li>
<li>Vise, dog holes and holdfast holes placed for you</li>
</ul>
<p style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;color:#166534;font-size:14px">
Free plan: 3 templates (square stool, pencil holder, workbench). Paid plans: all furniture templates + advanced features.
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
  <a href="${SITE_URL}/en/workbench" target="_blank" rel="noopener" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:8px">Draw your workbench →</a>
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
    `歡迎加入木頭仁木作藍圖。第一件事：先把你的工作桌畫出來。`,
    `每個木工的第一件作品，都該是自己的工作桌——之後每件家具都在它上面做出來。工作桌模板我免費送，不用付錢：`,
    `${SITE_URL}/workbench`,
    ``,
    `填身高、選流派（厚板桌、裙板桌、工具槽桌、20mm 孔陣桌、教室雙面桌），直接出：`,
    `- 3D + 三視圖 + 零件圖`,
    `- 材料單、裁切圖`,
    `- 前鉗、狗孔、holdfast 孔自動排好`,
    ``,
    `免費版可以用 3 個範本（方凳、筆筒、木工工作桌）。`,
    `付費方案開放全部 28 種家具 + 進階功能。`,
    ``,
    `畫工作桌：${SITE_URL}/workbench`,
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
<p>歡迎加入<strong>木頭仁木作藍圖</strong>。第一件事：<strong>先把你的工作桌畫出來</strong>。</p>
<p>每個木工的第一件作品，都該是自己的工作桌——之後每件家具都在它上面做出來。工作桌模板我免費送，不用付錢：<br/>
<a href="${SITE_URL}/workbench" target="_blank" rel="noopener" style="color:#059669;font-weight:600">${SITE_URL.replace(/^https?:\/\//, "")}/workbench</a></p>
<p>填身高、選流派（厚板桌、裙板桌、工具槽桌、20mm 孔陣桌、教室雙面桌），直接出：</p>
<ul style="padding-left:20px;line-height:1.7">
<li>3D + 三視圖 + 零件圖</li>
<li>材料單、裁切圖</li>
<li>前鉗、狗孔、holdfast 孔自動排好</li>
</ul>
<p style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;color:#166534;font-size:14px">
免費版可以用 3 個範本（方凳、筆筒、木工工作桌）。付費方案開放全部家具 + 進階功能。
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
  <a href="${SITE_URL}/workbench" target="_blank" rel="noopener" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-right:8px">免費畫工作桌 →</a>
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
