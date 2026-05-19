/**
 * 學員白名單匯入 → 自動升 student 後寄給該 user 的通知信。
 * 觸發點:`POST /api/admin/whitelist` 把 plan='free' 的 user 升 'student' 時。
 */
import { escapeHtml } from "../escape";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

function htmlShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="font-size:22px;margin:0 0 16px;color:#0f172a">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">木頭仁 木作藍圖 · <a href="${SITE_URL}" style="color:#9ca3af" target="_blank" rel="noopener">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

export function studentEnrolledEmail(input: {
  email: string;
  expiresAt: Date | string;
}): { subject: string; text: string; html: string } {
  const expires = typeof input.expiresAt === "string" ? new Date(input.expiresAt) : input.expiresAt;
  const expiresStr = expires.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });

  const subject = "你已加入木匠學院學員方案 — 木頭仁 木作藍圖";

  const text = [
    `你好,`,
    ``,
    `${input.email} 已經被加進木匠學院學員白名單,`,
    `木頭仁 木作藍圖 自動升級成 學員版,可用到 ${expiresStr}。`,
    ``,
    `學員版包含:`,
    `- 26 種家具範本全解鎖(原本免費版只有 3 種)`,
    `- 無限儲存設計(原本免費版上限 3 件)`,
    `- 工程圖 PDF 列印 / A4 工程圖紙下載`,
    `- 報價單 / 材料單 / 裁切圖`,
    `- 木作天花板骨架施工模擬器`,
    `- 設計師模式(自由尺寸到 mm 級)`,
    ``,
    `登入網址: ${SITE_URL}/login`,
    `(用同一個 Google email 登入即可)`,
    ``,
    `到期前 7 天會再寄一封提醒信。`,
    `有問題歡迎回信告訴我。`,
    ``,
    `木頭仁`,
  ].join("\n");

  const html = htmlShell(
    "你已加入木匠學院學員方案",
    `<p>你好,</p>
<p><strong>${escapeHtml(input.email)}</strong> 已經被加進木匠學院學員白名單,
木頭仁 木作藍圖 自動升級成 <strong>學員版</strong>,可用到
<strong>${escapeHtml(expiresStr)}</strong>。</p>

<h3 style="font-size:15px;margin:20px 0 8px;color:#374151">學員版包含</h3>
<ul style="padding-left:18px;line-height:1.7;color:#374151;font-size:14px">
  <li>26 種家具範本全解鎖(原本免費版只有 3 種)</li>
  <li>無限儲存設計(原本免費版上限 3 件)</li>
  <li>工程圖 PDF 列印 / A4 工程圖紙下載</li>
  <li>報價單 / 材料單 / 裁切圖</li>
  <li>木作天花板骨架施工模擬器</li>
  <li>設計師模式(自由尺寸到 mm 級)</li>
</ul>

<p style="margin:20px 0">
  <a href="${SITE_URL}/login" target="_blank" rel="noopener"
     style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
    馬上登入
  </a>
</p>
<p style="font-size:13px;color:#6b7280">用同一個 Google email 登入即可。</p>

<p style="font-size:13px;color:#6b7280;margin-top:20px">
  到期前 7 天會再寄一封提醒信。有問題歡迎回信告訴我。
</p>
<p style="font-size:13px;color:#374151;margin-top:16px">— 木頭仁</p>`,
  );

  return { subject, text, html };
}
