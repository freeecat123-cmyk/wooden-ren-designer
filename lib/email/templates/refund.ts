/**
 * 退費相關 email — 4 種：
 *   - 收到申請（給 user）
 *   - 收到申請（給 admin）
 *   - 申請通過（給 user）
 *   - 申請拒絕（給 user）
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

function htmlShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="font-size:20px;margin:0 0 16px;color:#0f172a">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">木頭仁 木作藍圖 · <a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

export function refundReceivedToUserEmail(input: {
  amount: number;
  reason: string;
}): { subject: string; text: string; html: string } {
  const { amount, reason } = input;
  const subject = "已收到您的退費申請";
  const text = [
    `你好，`,
    ``,
    `我們已收到您的退費申請：`,
    ``,
    `申請金額：NT$ ${amount}`,
    `原因：${reason}`,
    ``,
    `我們會在 7 個工作日內審核並回覆。如有額外資訊需要補充、請直接回信此封 email。`,
    ``,
    `查看申請狀態：${SITE_URL}/refund`,
    ``,
    `木頭仁 木作藍圖`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p>你好，</p>
<p>我們已收到您的退費申請：</p>
<table style="width:100%;border-collapse:collapse;margin-top:12px">
<tr><td style="padding:8px 0;color:#6b7280">申請金額</td><td style="text-align:right;font-weight:600">NT$ ${amount.toLocaleString()}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">原因</td><td style="text-align:right;border-top:1px solid #e5e7eb;font-size:14px">${reason}</td></tr>
</table>
<p style="margin-top:16px">我們會在 <strong>7 個工作日內</strong>審核並回覆。</p>
<p style="font-size:14px;color:#6b7280">需要補充資訊請直接回信。</p>
<p><a href="${SITE_URL}/refund" style="color:#059669">查看申請狀態 →</a></p>`,
  );
  return { subject, text, html };
}

export function refundReceivedToAdminEmail(input: {
  userEmail: string;
  amount: number;
  reason: string;
}): { subject: string; text: string; html: string } {
  const { userEmail, amount, reason } = input;
  const subject = `📩 退費申請：${userEmail} NT$ ${amount}`;
  const text = [
    `新退費申請`,
    ``,
    `User：${userEmail}`,
    `金額：NT$ ${amount}`,
    `原因：${reason}`,
    ``,
    `去 admin 審核：${SITE_URL}/admin/refunds`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p>新退費申請</p>
<table style="width:100%;border-collapse:collapse;margin-top:12px">
<tr><td style="padding:8px 0;color:#6b7280">User</td><td style="text-align:right;font-family:monospace">${userEmail}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">金額</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb">NT$ ${amount.toLocaleString()}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">原因</td><td style="text-align:right;border-top:1px solid #e5e7eb;font-size:14px">${reason}</td></tr>
</table>
<p style="margin-top:16px"><a href="${SITE_URL}/admin/refunds" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">去 admin 審核 →</a></p>`,
  );
  return { subject, text, html };
}

export function refundApprovedEmail(input: {
  amount: number;
  adminNote: string;
}): { subject: string; text: string; html: string } {
  const { amount, adminNote } = input;
  const subject = `退費申請已通過：NT$ ${amount} 處理中`;
  const text = [
    `你好，`,
    ``,
    `您的退費申請已通過審核：`,
    ``,
    `退費金額：NT$ ${amount}`,
    adminNote ? `處理說明：${adminNote}` : "",
    "",
    "綠界會依原付款管道（信用卡 / ATM）退回，款項到帳時間依各發卡銀行而定，",
    "通常為 3〜30 個工作日。",
    "",
    "請注意金流手續費（綠界 + 發卡銀行）屬第三方收取且不予退還，",
    "退費金額已扣除手續費。",
    ``,
    `木頭仁 木作藍圖`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = htmlShell(
    subject,
    `<p>你好，</p>
<p style="background:#ecfdf5;border:2px solid #34d399;border-radius:8px;padding:12px;color:#065f46;font-weight:600">
✅ 退費申請已通過 — NT$ ${amount.toLocaleString()}
</p>
${adminNote ? `<p style="font-size:14px;color:#374151"><strong>處理說明：</strong>${adminNote}</p>` : ""}
<p>綠界會依原付款管道（信用卡 / ATM）退回，款項到帳時間依各發卡銀行而定，通常為 <strong>3〜30 個工作日</strong>。</p>
<p style="font-size:13px;color:#6b7280;background:#f9fafb;padding:10px;border-radius:6px">
※ 金流手續費（綠界 + 發卡銀行）屬第三方收取且不予退還，退費金額已扣除手續費。
</p>`,
  );
  return { subject, text, html };
}

export function refundRejectedEmail(input: {
  amount: number;
  adminNote: string;
}): { subject: string; text: string; html: string } {
  const { amount, adminNote } = input;
  const subject = "退費申請未通過";
  const text = [
    `你好，`,
    ``,
    `經審核後，您的退費申請（NT$ ${amount}）未能通過。`,
    ``,
    adminNote ? `說明：${adminNote}` : "",
    "",
    "如對審核結果有疑問，請直接回信此封 email 與我們討論。",
    ``,
    `木頭仁 木作藍圖`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = htmlShell(
    subject,
    `<p>你好，</p>
<p style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px;color:#991b1b">
經審核後，您的退費申請（NT$ ${amount.toLocaleString()}）<strong>未能通過</strong>。
</p>
${adminNote ? `<p style="font-size:14px;color:#374151"><strong>說明：</strong>${adminNote}</p>` : ""}
<p style="font-size:14px;color:#6b7280">如對審核結果有疑問，請直接回信此封 email 與我們討論。</p>`,
  );
  return { subject, text, html };
}
