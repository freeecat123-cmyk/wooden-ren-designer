/**
 * 新註冊歡迎信。OAuth callback 偵測 user.welcome_email_sent_at IS NULL 時寄。
 */
import { escapeHtml } from "../escape";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

const LINE_OA_URL = "https://lin.ee/EaXGbJ1";

function htmlShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="font-size:22px;margin:0 0 16px;color:#0f172a">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">木頭仁家具工程圖工具 · <a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

export function welcomeEmail(input: { name?: string | null }): {
  subject: string;
  text: string;
  html: string;
} {
  // greeting 進 html 必 escape（Google 顯示名可塞 `<script>` 或釣魚連結）
  // text 版本不需 escape（plain text 不會被 render）
  const greetingText = input.name ? `${input.name}` : "你好";
  const greetingHtml = escapeHtml(greetingText);
  const subject = "歡迎使用木頭仁 木作藍圖";
  const text = [
    `${greetingText}，`,
    ``,
    `歡迎加入木頭仁家具工程圖。這是我自己做木工時用來：`,
    `- 快速產出家具尺寸 + 三視圖 + 工程圖`,
    `- 報價、材料單、裁切圖`,
    `- 跟客戶分享設計連結`,
    ``,
    `免費版可以用 3 種入門家具（方凳、茶几、筆筒）。`,
    `付費方案開放全部 28 種家具 + 進階功能。`,
    ``,
    `馬上開始：${SITE_URL}`,
    `看付費方案：${SITE_URL}/pricing`,
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
免費版可以用 3 種入門家具（方凳、茶几、筆筒）。付費方案開放全部 28 種家具 + 進階功能。
</p>
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
  );
  return { subject, text, html };
}
