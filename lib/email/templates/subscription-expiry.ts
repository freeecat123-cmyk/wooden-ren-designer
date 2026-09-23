/**
 * 訂閱到期相關 email template — 純字串（不依 React Email、避免 build 加套件）。
 *
 * 三種 case：
 *   - `expiring-soon`：到期前 7 天提醒
 *   - `grace-period`：剛到期、進入 3 天寬限期
 *   - `downgraded`：超過寬限期已被降為 free
 *
 * locale 'en' 走英文版（給 LemonSqueezy 串接後的 /en 訂戶用）。
 */

import { PLAN_NAME_ZH, type CheckoutPlan } from "@/lib/pricing/plans";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

interface BaseInput {
  /** 目前方案 label（用於主旨 + 內文，已 localized） */
  planLabel: string;
  /** 到期日 ISO */
  expiresAt: string;
  /** 'zh-TW'（預設）或 'en' */
  locale?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function htmlShell(title: string, bodyHtml: string, locale: string): string {
  const footer = locale === "en"
    ? "Wooden Ren Furniture Design Tool"
    : "木頭仁家具工程圖工具";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="font-size:20px;margin:0 0 16px;color:#0f172a">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af;margin:0">${footer} · <a href="${SITE_URL}" style="color:#9ca3af">${SITE_URL.replace(/^https?:\/\//, "")}</a></p>
</div></body></html>`;
}

const pathPrefix = (locale: string) => (locale === "en" ? "/en" : "");

export function expiringSoonEmail(
  input: BaseInput & { daysLeft: number },
): { subject: string; text: string; html: string } {
  const { planLabel, expiresAt, daysLeft } = input;
  const locale = input.locale === "en" ? "en" : "zh-TW";
  const isEn = locale === "en";
  const p = pathPrefix(locale);

  if (isEn) {
    const subject = `Subscription ending soon: ${planLabel} — ${daysLeft} days left`;
    const text = [
      `Hi,`,
      ``,
      `Your "${planLabel}" subscription expires on ${formatDate(expiresAt)} (${daysLeft} days left).`,
      ``,
      `Monthly plans auto-renew — no action needed.`,
      `Annual or change plan: ${SITE_URL}${p}/pricing`,
      `Subscription status: ${SITE_URL}${p}/my/subscription`,
      ``,
      `Wooden Ren Blueprint`,
    ].join("\n");
    const html = htmlShell(
      subject,
      `<p>Hi,</p>
<p>Your "<strong>${planLabel}</strong>" subscription expires on <strong>${formatDate(expiresAt)}</strong> (<strong>${daysLeft} days</strong> left).</p>
<p style="background:#fefce8;border:1px solid #facc15;border-radius:8px;padding:12px;color:#854d0e;font-size:14px">
Monthly plans auto-renew — no action needed.
</p>
<p>Annual or change plan: <a href="${SITE_URL}${p}/pricing" style="color:#059669">View plans →</a></p>
<p>Subscription status: <a href="${SITE_URL}${p}/my/subscription" style="color:#059669">My subscription</a></p>`,
      locale,
    );
    return { subject, text, html };
  }

  // zh-TW
  const subject = `訂閱即將到期：${planLabel} 還剩 ${daysLeft} 天`;
  const text = [
    `你好，`,
    ``,
    `你的「${planLabel}」訂閱將於 ${formatDate(expiresAt)} 到期(剩 ${daysLeft} 天)。`,
    ``,
    `月扣方案會自動續扣，無需操作。`,
    `年付或想換方案：${SITE_URL}/pricing`,
    `查看訂閱狀態：${SITE_URL}/my/subscription`,
    ``,
    `木頭仁 木作藍圖`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p>你好，</p>
<p>你的「<strong>${planLabel}</strong>」訂閱將於 <strong>${formatDate(expiresAt)}</strong> 到期(剩 <strong>${daysLeft} 天</strong>)。</p>
<p style="background:#fefce8;border:1px solid #facc15;border-radius:8px;padding:12px;color:#854d0e;font-size:14px">
月扣方案會自動續扣，無需操作。
</p>
<p>年付或想換方案：<a href="${SITE_URL}/pricing" style="color:#059669">查看方案 →</a></p>
<p>查看訂閱狀態：<a href="${SITE_URL}/my/subscription" style="color:#059669">我的訂閱</a></p>`,
    locale,
  );
  return { subject, text, html };
}

export function gracePeriodEmail(
  input: BaseInput & { graceDaysLeft: number },
): { subject: string; text: string; html: string } {
  const { planLabel, expiresAt, graceDaysLeft } = input;
  const locale = input.locale === "en" ? "en" : "zh-TW";
  const isEn = locale === "en";
  const p = pathPrefix(locale);

  if (isEn) {
    const subject = `⚠️ Subscription expired: ${graceDaysLeft}-day grace period — renew now`;
    const text = [
      `Hi,`,
      ``,
      `Your "${planLabel}" subscription expired on ${formatDate(expiresAt)} and you're in the grace period (${graceDaysLeft} days left).`,
      ``,
      `Paid features still work — renew within ${graceDaysLeft} days or your plan will be auto-downgraded to free.`,
      ``,
      `Common causes: expired card, insufficient credit, bank verification failure.`,
      ``,
      `Renew now: ${SITE_URL}${p}/pricing`,
      `Subscription status: ${SITE_URL}${p}/my/subscription`,
      ``,
      `Wooden Ren Blueprint`,
    ].join("\n");
    const html = htmlShell(
      subject,
      `<p>Hi,</p>
<p>Your "<strong>${planLabel}</strong>" subscription expired on <strong>${formatDate(expiresAt)}</strong> and you're in the grace period.</p>
<p style="background:#fef2f2;border:2px solid #f87171;border-radius:8px;padding:14px;color:#991b1b">
<strong style="font-size:15px">⚠️ ${graceDaysLeft} days left in grace period</strong><br/>
Paid features still work — renew within ${graceDaysLeft} days or your plan will be auto-downgraded to free.
</p>
<p style="font-size:14px;color:#6b7280">Common causes: expired card, insufficient credit, bank verification failure.</p>
<p><a href="${SITE_URL}${p}/pricing" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Renew now →</a></p>`,
      locale,
    );
    return { subject, text, html };
  }

  const subject = `⚠️ 訂閱已到期：寬限期剩 ${graceDaysLeft} 天請續訂`;
  const text = [
    `你好，`,
    ``,
    `你的「${planLabel}」訂閱已於 ${formatDate(expiresAt)} 到期，目前在寬限期內(剩 ${graceDaysLeft} 天)。`,
    ``,
    `付費功能仍可使用，請於 ${graceDaysLeft} 天內續訂、否則自動降為免費版。`,
    ``,
    `常見原因：信用卡到期、額度不足、銀行驗證失敗。`,
    ``,
    `立即續訂：${SITE_URL}/pricing`,
    `訂閱狀態：${SITE_URL}/my/subscription`,
    ``,
    `木頭仁 木作藍圖`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p>你好，</p>
<p>你的「<strong>${planLabel}</strong>」訂閱已於 <strong>${formatDate(expiresAt)}</strong> 到期，目前在寬限期內。</p>
<p style="background:#fef2f2;border:2px solid #f87171;border-radius:8px;padding:14px;color:#991b1b">
<strong style="font-size:15px">⚠️ 寬限期剩 ${graceDaysLeft} 天</strong><br/>
付費功能仍可使用，請於 ${graceDaysLeft} 天內續訂、否則自動降為免費版。
</p>
<p style="font-size:14px;color:#6b7280">常見原因：信用卡到期、額度不足、銀行驗證失敗。</p>
<p><a href="${SITE_URL}/pricing" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">立即續訂 →</a></p>`,
    locale,
  );
  return { subject, text, html };
}

export function downgradedEmail(
  input: BaseInput,
): { subject: string; text: string; html: string } {
  const { planLabel, expiresAt } = input;
  const locale = input.locale === "en" ? "en" : "zh-TW";
  const isEn = locale === "en";
  const p = pathPrefix(locale);

  if (isEn) {
    const subject = `Subscription expired — downgraded to free`;
    const text = [
      `Hi,`,
      ``,
      `Your "${planLabel}" subscription expired on ${formatDate(expiresAt)}, the grace period has passed, and the account was auto-downgraded to free.`,
      ``,
      `To restore paid features: ${SITE_URL}${p}/pricing`,
      ``,
      `Wooden Ren Blueprint`,
    ].join("\n");
    const html = htmlShell(
      subject,
      `<p>Hi,</p>
<p>Your "<strong>${planLabel}</strong>" subscription expired on <strong>${formatDate(expiresAt)}</strong>, the grace period has passed, and the account was auto-downgraded to free.</p>
<p style="background:#f3f4f6;border:1px solid #9ca3af;border-radius:8px;padding:12px;color:#374151;font-size:14px">
Your existing designs are still saved, but saving / sharing / quoting paid features are disabled.
</p>
<p><a href="${SITE_URL}${p}/pricing" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Restore paid features →</a></p>`,
      locale,
    );
    return { subject, text, html };
  }

  const subject = `訂閱已過期 — 已降為免費版`;
  const text = [
    `你好，`,
    ``,
    `你的「${planLabel}」訂閱於 ${formatDate(expiresAt)} 到期、且寬限期已過，系統已自動降為免費版。`,
    ``,
    `要恢復付費功能：${SITE_URL}/pricing`,
    ``,
    `木頭仁 木作藍圖`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p>你好，</p>
<p>你的「<strong>${planLabel}</strong>」訂閱於 <strong>${formatDate(expiresAt)}</strong> 到期、且寬限期已過，系統已自動降為免費版。</p>
<p style="background:#f3f4f6;border:1px solid #9ca3af;border-radius:8px;padding:12px;color:#374151;font-size:14px">
你現有的設計都還在，但儲存/分享/報價等付費功能無法使用。
</p>
<p><a href="${SITE_URL}/pricing" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">恢復付費功能 →</a></p>`,
    locale,
  );
  return { subject, text, html };
}

/** Plan label localizer — pass user plan + locale, get back the right-language label. */
const PLAN_NAME_EN: Record<string, string> = {
  personal: "Personal",
  pro: "Professional",
  student: "Student",
  lifetime: "Lifetime",
  free: "Free",
};

export function planLabelFromUserPlan(plan: string | null | undefined, locale: string = "zh-TW"): string {
  if (!plan) return locale === "en" ? "Paid plan" : "付費版";
  if (locale === "en" && plan in PLAN_NAME_EN) return PLAN_NAME_EN[plan];
  // zh-TW
  const map: Record<string, string> = {
    personal: "個人版",
    pro: "專業版",
    student: "學員版",
    lifetime: "終身版",
    free: "免費版",
  };
  if (plan in map) return map[plan];
  if (plan in PLAN_NAME_ZH) return PLAN_NAME_ZH[plan as CheckoutPlan];
  return plan;
}
