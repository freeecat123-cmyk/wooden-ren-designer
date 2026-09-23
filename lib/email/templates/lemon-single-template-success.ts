/**
 * Lemon Squeezy 單模板/工具買斷英文通知信
 * 觸發點：order_created webhook event(variant.kind=single-template / lifetime)
 * 目的：確認永久解鎖,告知去哪用。
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

interface UnlockSuccessInput {
  /** 解鎖類型:lifetime / template / tool */
  kind: "lifetime" | "template" | "tool";
  /** 顯示名稱(例如 "Stool" / "Ceiling Framing Calculator" / "Lifetime") */
  itemLabel: string;
  /** 金額 USD */
  amount: number;
  /** 該項目的進入連結 path(/en/design/<cat> 或 /en/ceiling 等) */
  itemHref: string;
}

export function lemonUnlockSuccessEmail(input: UnlockSuccessInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { kind, itemLabel, amount, itemHref } = input;
  const fullHref = itemHref.startsWith("http") ? itemHref : `${SITE_URL}${itemHref}`;
  const subUrl = `${SITE_URL}/en/my-subscription`;

  const subject =
    kind === "lifetime"
      ? `Lifetime access unlocked — welcome aboard`
      : kind === "tool"
        ? `${itemLabel} unlocked — start measuring`
        : `${itemLabel} template unlocked — start designing`;

  const kindDescription =
    kind === "lifetime"
      ? "Every template, every tool, every future feature — yours forever."
      : kind === "tool"
        ? "You now own this interior tool permanently. No subscription needed."
        : "You now own this furniture template permanently. No subscription needed.";

  const text = `Hi,

Your purchase on Furniture Blueprints went through.

Item: ${itemLabel}
Type: ${kind === "lifetime" ? "Lifetime — all templates and tools" : kind === "tool" ? "Interior tool buyout" : "Single template buyout"}
Charged: $${amount} USD

${kindDescription}

Open it: ${fullHref}
Your purchases: ${subUrl}

A few notes:
- This is a one-time payment — no recurring charge
- Your purchase is tied to your account email; sign in with the same email to access it
- Reply to this email if anything is unclear

Thanks for the support — go build something good.

— Wooden Ren
`;

  const bodyHtml = `
<p style="margin:0 0 12px">Your purchase on Furniture Blueprints went through.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
  <tr><td style="padding:6px 0;color:#6b7280">Item</td><td style="padding:6px 0;text-align:right"><b>${itemLabel}</b></td></tr>
  <tr><td style="padding:6px 0;color:#6b7280">Type</td><td style="padding:6px 0;text-align:right">${kind === "lifetime" ? "Lifetime — all templates and tools" : kind === "tool" ? "Interior tool buyout" : "Single template buyout"}</td></tr>
  <tr><td style="padding:6px 0;color:#6b7280">Charged</td><td style="padding:6px 0;text-align:right"><b>$${amount} USD</b></td></tr>
</table>
<p style="margin:16px 0 8px;color:#4b5563">${kindDescription}</p>
<p style="margin:24px 0 8px">
  <a href="${fullHref}" style="display:inline-block;padding:10px 20px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open it →</a>
  <a href="${subUrl}" style="display:inline-block;margin-left:8px;padding:10px 20px;background:#fff;color:#0f172a;text-decoration:none;border-radius:8px;border:1px solid #e5e7eb;font-weight:600">View purchases</a>
</p>
<p style="margin:16px 0;font-size:13px;color:#6b7280">This is a one-time payment. Sign in with the same email to access the unlock. Reply to this email if anything is unclear.</p>
<p style="margin:16px 0 0">Thanks for the support — go build something good.<br/>— Wooden Ren</p>
`;

  return { subject, text, html: htmlShell(subject, bodyHtml) };
}
