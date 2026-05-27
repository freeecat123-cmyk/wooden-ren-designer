/**
 * Lemon Squeezy 續扣失敗英文通知信
 * 觸發點：subscription_payment_failed webhook event
 * 目的：提醒使用者去 customer portal 更新卡片，避免 grace period 後自動 cancel
 *
 * LS dunning：失敗後 LS 會自己 retry 4 次（依 store 設定），同時 mark sub
 * 為 past_due。我們的責任 = 立即通知 user 更新卡，不讓他被靜默掉。
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
<p style="font-size:12px;color:#9ca3af;margin:0">Furniture Blueprints · <a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

interface FailedPaymentInput {
  /** 訂閱方案標籤，例如 "Pro Monthly" / "Pro Annual" */
  planLabel: string;
  /** 金額 USD（未扣成功） */
  amount: number;
  /** 失敗原因（LS 給的，可選） */
  reason?: string;
  /** 第幾次 retry（LS 多次重試前都會送這個事件，可選） */
  attemptNumber?: number;
}

export function lemonPaymentFailedEmail(input: FailedPaymentInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { planLabel, amount, reason, attemptNumber } = input;
  const portalUrl = `${SITE_URL}/api/lemon-squeezy/portal`;
  const accountUrl = `${SITE_URL}/en/my-subscription`;

  const subject = `Payment failed — please update your card for ${planLabel}`;

  const attemptLine = attemptNumber
    ? `This was attempt #${attemptNumber}. We'll keep trying for a few days, but if all retries fail your subscription will be cancelled.`
    : `We'll retry over the next few days, but if all attempts fail your subscription will be cancelled.`;

  const reasonLine = reason ? `\nDecline reason: ${reason}\n` : "";

  const text = [
    `Hi,`,
    ``,
    `We couldn't charge $${amount} for your ${planLabel} subscription.`,
    reasonLine,
    attemptLine,
    ``,
    `To keep your access uninterrupted, please update your payment method:`,
    `${portalUrl}`,
    ``,
    `Or view your subscription details:`,
    `${accountUrl}`,
    ``,
    `If you intended to cancel, you can ignore this email — access will end at the end of your current period.`,
    ``,
    `— The Furniture Blueprints team`,
    `Furniture Blueprints (by Wooden Ren)`,
    SITE_URL,
  ].join("\n");

  const reasonHtml = reason
    ? `<p style="margin:12px 0;font-size:14px;color:#7f1d1d;background:#fef2f2;padding:12px;border-radius:8px;border:1px solid #fecaca"><strong>Decline reason:</strong> ${escapeHtml(reason)}</p>`
    : "";

  const html = htmlShell(
    "Payment failed",
    `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">
       Hi,
     </p>
     <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
       We couldn&apos;t charge <strong>$${amount}</strong> for your <strong>${escapeHtml(planLabel)}</strong> subscription.
     </p>
     ${reasonHtml}
     <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#475569">
       ${attemptLine}
     </p>
     <div style="text-align:center;margin:24px 0">
       <a href="${portalUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
         Update payment method
       </a>
     </div>
     <p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#64748b">
       Or view your subscription:
       <a href="${accountUrl}" style="color:#0f172a">${accountUrl.replace(/^https?:\/\//, "")}</a>
     </p>
     <p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#94a3b8">
       If you intended to cancel, you can ignore this email — access will end at the end of your current period.
     </p>`,
  );

  return { subject, text, html };
}

// 跟 ECPay 模板共用同一個 escapeHtml,避免循環依賴直接內嵌
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
