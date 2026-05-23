/**
 * 付款成功 email：首次付款 + 月扣定期成功。
 *
 * 兩種版本：
 *   - firstPaymentSuccessEmail：首次付款（綠界 /return webhook 觸發）
 *   - periodicChargeSuccessEmail：月扣每月成功扣款（綠界 /periodic-notify 觸發）
 */
import { escapeHtml } from "../escape";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function htmlShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="font-size:20px;margin:0 0 16px;color:#0f172a">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">木頭仁家具工程圖工具 · <a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

interface PaymentInput {
  planLabel: string;
  amount: number;
  expiresAt: string;
  /** 是否月扣（true = 月扣首次、false = 年付一次性） */
  isMonthly: boolean;
  /** 綠界 trade_no（給 user 對帳用） */
  tradeNo?: string | null;
  /** 升級時退舊版未用 prorate 的金額(NT$),0 / undefined 就不顯示 */
  upgradeRefundAmount?: number;
}

export function firstPaymentSuccessEmail(input: PaymentInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { planLabel, amount, expiresAt, isMonthly, tradeNo, upgradeRefundAmount } = input;
  const hasRefund = (upgradeRefundAmount ?? 0) > 0;
  const periodLabel = isMonthly ? "月付" : "年付";
  const subject = `付款成功：${planLabel} ${periodLabel} ${amount} 元`;
  const text = [
    `付款成功通知`,
    ``,
    `方案：${planLabel}（${periodLabel}）`,
    `金額：NT$ ${amount}`,
    `有效期：到 ${formatDate(expiresAt)}`,
    tradeNo ? `綠界交易單號：${tradeNo}` : "",
    hasRefund ? `\n升級舊版未使用部分已自動退款 NT$ ${upgradeRefundAmount} 回原信用卡(3-7 個工作日入帳)` : "",
    "",
    isMonthly
      ? "下個月會自動扣款，無需操作。要取消請至訂閱頁。"
      : "年付方案不會自動續、到期前 7 天會收到提醒信。",
    "",
    `查看訂閱狀態：${SITE_URL}/my/subscription`,
    `開始使用：${SITE_URL}`,
    ``,
    `木頭仁 木作藍圖`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = htmlShell(
    subject,
    `<p style="background:#ecfdf5;border:2px solid #34d399;border-radius:8px;padding:12px;color:#065f46;font-weight:600">
✅ 已收到付款，方案立即生效
</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;color:#6b7280">方案</td><td style="text-align:right;font-weight:600">${planLabel}（${periodLabel}）</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">金額</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb">NT$ ${amount.toLocaleString()}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">有效期</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb">${formatDate(expiresAt)}</td></tr>
${tradeNo ? `<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">綠界單號</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(tradeNo)}</td></tr>` : ""}
</table>
${hasRefund ? `<p style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:12px;color:#9a3412;margin-top:16px;font-size:14px">💰 升級舊版未使用部分已自動退款 <strong>NT$ ${upgradeRefundAmount}</strong> 回原信用卡(3-7 個工作日入帳)</p>` : ""}
<p style="font-size:14px;color:#6b7280;margin-top:16px">
${
  isMonthly
    ? "下個月會自動扣款，無需操作。<a href='" +
      SITE_URL +
      "/my/subscription' style='color:#059669'>取消訂閱請至訂閱頁</a>。"
    : "年付方案不會自動續、到期前 7 天會收到提醒信。"
}
</p>
<p><a href="${SITE_URL}" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">開始使用 →</a></p>`,
  );
  return { subject, text, html };
}

interface UnlockSuccessInput {
  /** e.g. "餐椅（進階）永久買斷" 或 "天花板施工模擬器 永久買斷" */
  itemName: string;
  amount: number;
  tradeNo?: string | null;
  /** 解鎖後的連結，例如 designer.woodenren.com/design/dining-chair */
  destinationUrl?: string;
}

export function unlockSuccessEmail(input: UnlockSuccessInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { itemName, amount, tradeNo, destinationUrl } = input;
  const subject = `付款成功：${itemName} NT$${amount}`;
  const ctaUrl = destinationUrl ?? SITE_URL;
  const text = [
    `付款成功通知`,
    ``,
    `品項：${itemName}`,
    `金額：NT$ ${amount}`,
    tradeNo ? `綠界交易單號：${tradeNo}` : "",
    ``,
    `已永久解鎖，沒有到期日。`,
    `電子發票會另寄一封通知到此信箱。`,
    ``,
    `去使用：${ctaUrl}`,
    ``,
    `木頭仁 木作藍圖`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = htmlShell(
    subject,
    `<p style="background:#ecfdf5;border:2px solid #34d399;border-radius:8px;padding:12px;color:#065f46;font-weight:600">
✅ 已收到付款，已永久解鎖
</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;color:#6b7280">品項</td><td style="text-align:right;font-weight:600">${escapeHtml(itemName)}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">金額</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb">NT$ ${amount.toLocaleString()}</td></tr>
${tradeNo ? `<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">綠界單號</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(tradeNo)}</td></tr>` : ""}
</table>
<p style="font-size:14px;color:#6b7280;margin-top:16px">永久解鎖，沒有到期日。電子發票會另寄一封通知到此信箱。</p>
<p><a href="${ctaUrl}" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">去使用 →</a></p>`,
  );
  return { subject, text, html };
}

export function periodicChargeSuccessEmail(input: PaymentInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { planLabel, amount, expiresAt, tradeNo } = input;
  const subject = `月扣扣款成功：${planLabel} ${amount} 元`;
  const text = [
    `月扣扣款成功通知`,
    ``,
    `方案：${planLabel}（月扣）`,
    `金額：NT$ ${amount}`,
    `本期有效到：${formatDate(expiresAt)}`,
    tradeNo ? `綠界交易單號：${tradeNo}` : "",
    "",
    "下個月會自動扣款，無需操作。",
    "",
    `要取消請至：${SITE_URL}/my/subscription`,
    ``,
    `木頭仁 木作藍圖`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = htmlShell(
    subject,
    `<p>本月扣款已成功，訂閱繼續有效。</p>
<table style="width:100%;border-collapse:collapse;margin-top:16px">
<tr><td style="padding:8px 0;color:#6b7280">方案</td><td style="text-align:right;font-weight:600">${planLabel}（月扣）</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">本期金額</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb">NT$ ${amount.toLocaleString()}</td></tr>
<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">本期有效到</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5e7eb">${formatDate(expiresAt)}</td></tr>
${tradeNo ? `<tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb">綠界單號</td><td style="text-align:right;font-family:monospace;border-top:1px solid #e5e7eb">${escapeHtml(tradeNo)}</td></tr>` : ""}
</table>
<p style="font-size:13px;color:#6b7280;margin-top:16px">
下個月會自動扣款，無需操作。<a href="${SITE_URL}/my/subscription" style="color:#059669">取消訂閱請至訂閱頁</a>。
</p>`,
  );
  return { subject, text, html };
}
