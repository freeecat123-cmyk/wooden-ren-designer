/**
 * Lemon Squeezy 訂閱開通英文通知信
 * 觸發點：subscription_created webhook event
 * 目的：跟 LS 自家 invoice 並行,給 user 一封木頭仁品牌的歡迎信,
 *       明確告知:1) 訂閱已啟動 2) 可進設計器 3) 哪裡管理訂閱
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

interface SubscriptionActivatedInput {
  /** 方案標籤,例如 "Pro Monthly" / "Pro Annual" */
  planLabel: string;
  /** 下次續扣日(ISO) */
  renewsAt: string;
  /** 金額 USD */
  amount: number;
}

export function lemonSubscriptionActivatedEmail(input: SubscriptionActivatedInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { planLabel, renewsAt, amount } = input;
  const appUrl = `${SITE_URL}/en/app`;
  const subUrl = `${SITE_URL}/en/my-subscription`;
  const renewsDate = new Date(renewsAt).toISOString().slice(0, 10);

  const subject = `Welcome — your ${planLabel} subscription is active`;

  const text = `Hi,

Your ${planLabel} subscription on Furniture Blueprints is now active.

Plan: ${planLabel}
Charged: $${amount} USD
Next renewal: ${renewsDate}

What you've unlocked:
- All 27 furniture templates with engineering drawings, cut lists, BOMs
- The ceiling / floor / raised-platform interior tools
- Client quote system (Pro plan only): A4 quotes, customer database, STL/CNC export
- Designer mode: no size cap

Start designing: ${appUrl}
Manage subscription: ${subUrl}

A few notes:
- We charge in USD via Lemon Squeezy (your bank converts at the day's rate)
- Cancel anytime from the subscription page — you keep access until ${renewsDate}
- Reply to this email if anything breaks; we read every message

Thanks for the support — go build something good.

— Wooden Ren
`;

  const bodyHtml = `
<p style="margin:0 0 12px">Your <b>${planLabel}</b> subscription on Furniture Blueprints is now active.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
  <tr><td style="padding:6px 0;color:#6b7280">Plan</td><td style="padding:6px 0;text-align:right"><b>${planLabel}</b></td></tr>
  <tr><td style="padding:6px 0;color:#6b7280">Charged</td><td style="padding:6px 0;text-align:right"><b>$${amount} USD</b></td></tr>
  <tr><td style="padding:6px 0;color:#6b7280">Next renewal</td><td style="padding:6px 0;text-align:right">${renewsDate}</td></tr>
</table>
<p style="margin:16px 0 8px"><b>What you've unlocked</b></p>
<ul style="margin:0 0 16px;padding-left:20px;color:#4b5563">
  <li>All 27 furniture templates with engineering drawings, cut lists, BOMs</li>
  <li>The ceiling / floor / raised-platform interior tools</li>
  <li>Client quote system (Pro plan only): A4 quotes, customer database, STL/CNC export</li>
  <li>Designer mode: no size cap</li>
</ul>
<p style="margin:24px 0 8px">
  <a href="${appUrl}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Start designing →</a>
  <a href="${subUrl}" style="display:inline-block;margin-left:8px;padding:10px 20px;background:#fff;color:#0f172a;text-decoration:none;border-radius:8px;border:1px solid #e5e7eb;font-weight:600">Manage subscription</a>
</p>
<p style="margin:16px 0;font-size:13px;color:#6b7280">Cancel anytime from the subscription page — you keep access until ${renewsDate}. Reply to this email if anything breaks; we read every message.</p>
<p style="margin:16px 0 0">Thanks for the support — go build something good.<br/>— Wooden Ren</p>
`;

  return { subject, text, html: htmlShell(subject, bodyHtml) };
}
