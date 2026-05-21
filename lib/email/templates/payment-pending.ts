/**
 * 取號成功 email：ATM/超商/條碼下單後，綠界 /payment-info webhook 觸發。
 * 內容是繳費資訊（虛擬帳號 / 超商代碼 / 條碼）+ 繳費期限。
 */
import { escapeHtml } from "../escape";
import type { PaymentInfo } from "../../ecpay/payment-info";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

function formatDateTime(iso: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // 顯示台北時間
  const t = new Date(new Date(iso).getTime() + 8 * 3600_000);
  return `${t.getUTCFullYear()}/${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

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

interface AwaitingPaymentInput {
  planLabel: string;
  amount: number;
  paymentInfo: PaymentInfo;
}

/** 依付款方式產生繳費說明的純文字行 + HTML 區塊 */
function describe(info: PaymentInfo): { textLines: string[]; html: string } {
  if (info.method === "atm") {
    return {
      textLines: [
        `付款方式：ATM 轉帳`,
        `銀行代碼：${info.bankCode}`,
        `虛擬帳號：${info.vAccount}`,
        `請用網路銀行或實體 ATM 轉帳至上述帳號。`,
      ],
      html: `<table style="width:100%;border-collapse:collapse;margin-top:8px">
<tr><td style="padding:8px 0;color:#6b7280">付款方式</td><td style="text-align:right;font-weight:600">ATM 轉帳</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">銀行代碼</td><td style="text-align:right;font-family:monospace;font-weight:600;border-top:1px solid #e5e7eb">${escapeHtml(info.bankCode ?? "")}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">虛擬帳號</td><td style="text-align:right;font-family:monospace;font-weight:600;font-size:16px;border-top:1px solid #e5e7eb">${escapeHtml(info.vAccount ?? "")}</td></tr>
</table>
<p style="font-size:13px;color:#6b7280;margin-top:8px">請用網路銀行或實體 ATM 轉帳至上述帳號。</p>`,
    };
  }
  if (info.method === "cvs") {
    return {
      textLines: [
        `付款方式：超商代碼繳費`,
        `繳費代碼：${info.paymentNo}`,
        `請至 7-11 / 全家 / 萊爾富 / OK 超商，用多媒體機輸入代碼繳費。`,
      ],
      html: `<table style="width:100%;border-collapse:collapse;margin-top:8px">
<tr><td style="padding:8px 0;color:#6b7280">付款方式</td><td style="text-align:right;font-weight:600">超商代碼繳費</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">繳費代碼</td><td style="text-align:right;font-family:monospace;font-weight:600;font-size:16px;border-top:1px solid #e5e7eb">${escapeHtml(info.paymentNo ?? "")}</td></tr>
</table>
<p style="font-size:13px;color:#6b7280;margin-top:8px">請至 7-11 / 全家 / 萊爾富 / OK 超商，用多媒體機輸入代碼繳費。</p>`,
    };
  }
  // barcode
  return {
    textLines: [
      `付款方式：超商條碼繳費`,
      `條碼一：${info.barcode1}`,
      `條碼二：${info.barcode2}`,
      `條碼三：${info.barcode3}`,
      `請至超商出示此三段條碼繳費（可於綠界頁面截圖條碼）。`,
    ],
    html: `<table style="width:100%;border-collapse:collapse;margin-top:8px">
<tr><td style="padding:8px 0;color:#6b7280">付款方式</td><td style="text-align:right;font-weight:600">超商條碼繳費</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">條碼一</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(info.barcode1 ?? "")}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">條碼二</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(info.barcode2 ?? "")}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">條碼三</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(info.barcode3 ?? "")}</td></tr>
</table>
<p style="font-size:13px;color:#6b7280;margin-top:8px">請至超商出示此三段條碼繳費（可於綠界頁面截圖條碼）。</p>`,
  };
}

export function awaitingPaymentEmail(input: AwaitingPaymentInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { planLabel, amount, paymentInfo } = input;
  const deadline = formatDateTime(paymentInfo.expireDate);
  const d = describe(paymentInfo);
  const subject = `訂單已成立，請於 ${deadline} 前完成繳費 — ${planLabel}`;
  const text = [
    `木頭仁 木作藍圖 — 訂單已成立`,
    ``,
    `方案：${planLabel}（年付）`,
    `應繳金額：NT$ ${amount}`,
    `繳費期限：${deadline}`,
    ``,
    ...d.textLines,
    ``,
    `完成繳費後訂閱會自動啟用，並寄出付款成功通知與電子發票。`,
    `也可在「我的訂閱」頁查看繳費資訊：${SITE_URL}/my-subscription`,
    ``,
    `木頭仁 木作藍圖`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p style="background:#fffbeb;border:2px solid #fbbf24;border-radius:8px;padding:12px;color:#92400e;font-weight:600">
⏳ 訂單已成立，尚未收到款項。請於 <strong>${deadline}</strong> 前完成繳費。
</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;color:#6b7280">方案</td><td style="text-align:right;font-weight:600">${escapeHtml(planLabel)}（年付）</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">應繳金額</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb">NT$ ${amount.toLocaleString()}</td></tr>
</table>
${d.html}
<p style="font-size:14px;color:#6b7280;margin-top:16px">完成繳費後訂閱會自動啟用，並寄出付款成功通知與電子發票。</p>
<p><a href="${SITE_URL}/my-subscription" style="display:inline-block;background:#d97706;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">查看我的訂閱 →</a></p>`,
  );
  return { subject, text, html };
}
