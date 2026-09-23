/**
 * 白名單匯入 → 自動開通「專業版（1 年）」後寄給該 user 的通知信。
 * 觸發點:`POST /api/admin/whitelist` 把 plan='free' 的 user 升 'pro' 時。
 */
import { escapeHtml } from "../escape";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

function htmlShell(title: string, bodyHtml: string, locale: string): string {
  const footer = locale === "en" ? "Wooden Ren Blueprint" : "木頭仁 木作藍圖";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="font-size:22px;margin:0 0 16px;color:#0f172a">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">${footer} · <a href="${SITE_URL}" style="color:#9ca3af" target="_blank" rel="noopener">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

export function proAccessEmail(input: {
  email: string;
  expiresAt: Date | string;
  locale?: string;
}): { subject: string; text: string; html: string } {
  const locale = input.locale === "en" ? "en" : "zh-TW";
  const isEn = locale === "en";
  const expires = typeof input.expiresAt === "string" ? new Date(input.expiresAt) : input.expiresAt;
  const expiresStr = expires.toLocaleDateString(isEn ? "en-US" : "zh-TW", { year: "numeric", month: "long", day: "numeric" });

  if (isEn) {
    const subject = "Your Wooden Ren Blueprint Pro plan is active (1 year)";
    const text = [
      `Hi,`,
      ``,
      `${input.email} has been granted Pro access to Wooden Ren Blueprint.`,
      `Your account is now upgraded to the Pro plan, valid through ${expiresStr} (1 year).`,
      ``,
      `Pro plan includes:`,
      `- All furniture templates unlocked (free plan only has 3)`,
      `- Unlimited saved designs (free plan caps at 3)`,
      `- PDF print + A4 shop drawings download`,
      `- Client quote system, customer management`,
      `- Cut lists, cut layout, ceiling / floor / raised-floor simulators`,
      `- STL / OBJ export`,
      `- Designer Mode (custom sizes down to mm, no size cap)`,
      ``,
      `Sign in: ${SITE_URL}/en/login`,
      `(use the same Google email)`,
      ``,
      `We'll send a reminder 7 days before expiry. Reply to this email with any questions.`,
      ``,
      `Wooden Ren`,
    ].join("\n");
    const html = htmlShell(
      "Your Pro plan is active (1 year)",
      `<p>Hi,</p>
<p><strong>${escapeHtml(input.email)}</strong> has been granted Pro access to Wooden Ren Blueprint.
Your account is now upgraded to the <strong>Pro</strong> plan, valid through
<strong>${escapeHtml(expiresStr)}</strong> (1 year).</p>
<h3 style="font-size:15px;margin:20px 0 8px;color:#374151">Pro plan includes</h3>
<ul style="padding-left:18px;line-height:1.7;color:#374151;font-size:14px">
  <li>All furniture templates unlocked (free plan: 3)</li>
  <li>Unlimited saved designs (free plan caps at 3)</li>
  <li>PDF print / A4 shop drawings download</li>
  <li>Client quote system + customer management</li>
  <li>Cut lists, cut layout, ceiling / floor / raised-floor simulators</li>
  <li>STL / OBJ export</li>
  <li>Designer Mode (custom sizes down to mm, no size cap)</li>
</ul>
<p style="margin:20px 0">
  <a href="${SITE_URL}/en/login" target="_blank" rel="noopener"
     style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
    Sign in now
  </a>
</p>
<p style="font-size:13px;color:#6b7280">Use the same Google email.</p>
<p style="font-size:13px;color:#6b7280;margin-top:20px">
  We'll send a reminder 7 days before expiry. Reply with any questions.
</p>
<p style="font-size:13px;color:#374151;margin-top:16px">— Wooden Ren</p>`,
      locale,
    );
    return { subject, text, html };
  }

  // zh-TW
  const subject = "你已開通木作藍圖專業版（1 年）— 木頭仁 木作藍圖";
  const text = [
    `你好,`,
    ``,
    `${input.email} 已開通 木頭仁 木作藍圖 專業版,`,
    `帳號自動升級成 專業版,可用到 ${expiresStr}（1 年）。`,
    ``,
    `專業版包含:`,
    `- 全部家具範本解鎖(原本免費版只有 3 種)`,
    `- 無限儲存設計(原本免費版上限 3 件)`,
    `- 工程圖 PDF 列印 / A4 工程圖紙下載`,
    `- 客戶報價系統 / 客戶管理`,
    `- 材料單 / 裁切圖 / 天花板・地板・架高地板施工模擬器`,
    `- STL / OBJ 模型輸出`,
    `- 設計師模式(自由尺寸到 mm 級、無尺寸上限)`,
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
    "你已開通木作藍圖專業版（1 年）",
    `<p>你好,</p>
<p><strong>${escapeHtml(input.email)}</strong> 已開通 木頭仁 木作藍圖 專業版,
帳號自動升級成 <strong>專業版</strong>,可用到
<strong>${escapeHtml(expiresStr)}</strong>（1 年）。</p>

<h3 style="font-size:15px;margin:20px 0 8px;color:#374151">專業版包含</h3>
<ul style="padding-left:18px;line-height:1.7;color:#374151;font-size:14px">
  <li>全部家具範本解鎖(原本免費版只有 3 種)</li>
  <li>無限儲存設計(原本免費版上限 3 件)</li>
  <li>工程圖 PDF 列印 / A4 工程圖紙下載</li>
  <li>客戶報價系統 / 客戶管理</li>
  <li>材料單 / 裁切圖 / 天花板・地板・架高地板施工模擬器</li>
  <li>STL / OBJ 模型輸出</li>
  <li>設計師模式(自由尺寸到 mm 級、無尺寸上限)</li>
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
    locale,
  );

  return { subject, text, html };
}
