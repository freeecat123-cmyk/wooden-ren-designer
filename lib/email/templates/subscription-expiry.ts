/**
 * 訂閱到期相關 email template — 純字串（不依 React Email、避免 build 加套件）。
 *
 * 三種 case：
 *   - `expiring-soon`：到期前 7 天提醒
 *   - `grace-period`：剛到期、進入 3 天寬限期
 *   - `downgraded`：超過寬限期已被降為 free
 */

import { PLAN_NAME_ZH, type CheckoutPlan } from "@/lib/pricing/plans";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

interface BaseInput {
  /** 目前方案 zh label（用於主旨 + 內文） */
  planLabel: string;
  /** 到期日 ISO */
  expiresAt: string;
}

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

export function expiringSoonEmail(
  input: BaseInput & { daysLeft: number },
): { subject: string; text: string; html: string } {
  const { planLabel, expiresAt, daysLeft } = input;
  const subject = `訂閱即將到期：${planLabel} 還剩 ${daysLeft} 天`;
  const text = [
    `你好，`,
    ``,
    `你的「${planLabel}」訂閱將於 ${formatDate(expiresAt)} 到期（剩 ${daysLeft} 天）。`,
    ``,
    `月扣方案會自動續扣，無需操作。`,
    `年付或想換方案：${SITE_URL}/pricing`,
    `查看訂閱狀態：${SITE_URL}/my/subscription`,
    ``,
    `木頭仁工程圖`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p>你好，</p>
<p>你的「<strong>${planLabel}</strong>」訂閱將於 <strong>${formatDate(expiresAt)}</strong> 到期（剩 <strong>${daysLeft} 天</strong>）。</p>
<p style="background:#fefce8;border:1px solid #facc15;border-radius:8px;padding:12px;color:#854d0e;font-size:14px">
月扣方案會自動續扣，無需操作。
</p>
<p>年付或想換方案：<a href="${SITE_URL}/pricing" style="color:#059669">查看方案 →</a></p>
<p>查看訂閱狀態：<a href="${SITE_URL}/my/subscription" style="color:#059669">我的訂閱</a></p>`,
  );
  return { subject, text, html };
}

export function gracePeriodEmail(
  input: BaseInput & { graceDaysLeft: number },
): { subject: string; text: string; html: string } {
  const { planLabel, expiresAt, graceDaysLeft } = input;
  const subject = `⚠️ 訂閱已到期：寬限期剩 ${graceDaysLeft} 天請續訂`;
  const text = [
    `你好，`,
    ``,
    `你的「${planLabel}」訂閱已於 ${formatDate(expiresAt)} 到期，目前在寬限期內（剩 ${graceDaysLeft} 天）。`,
    ``,
    `付費功能仍可使用，請於 ${graceDaysLeft} 天內續訂、否則自動降為免費版。`,
    ``,
    `常見原因：信用卡到期、額度不足、銀行驗證失敗。`,
    ``,
    `立即續訂：${SITE_URL}/pricing`,
    `訂閱狀態：${SITE_URL}/my/subscription`,
    ``,
    `木頭仁工程圖`,
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
  );
  return { subject, text, html };
}

export function downgradedEmail(
  input: BaseInput,
): { subject: string; text: string; html: string } {
  const { planLabel, expiresAt } = input;
  const subject = `訂閱已過期 — 已降為免費版`;
  const text = [
    `你好，`,
    ``,
    `你的「${planLabel}」訂閱於 ${formatDate(expiresAt)} 到期、且寬限期已過，系統已自動降為免費版。`,
    ``,
    `要恢復付費功能：${SITE_URL}/pricing`,
    ``,
    `木頭仁工程圖`,
  ].join("\n");
  const html = htmlShell(
    subject,
    `<p>你好，</p>
<p>你的「<strong>${planLabel}</strong>」訂閱於 <strong>${formatDate(expiresAt)}</strong> 到期、且寬限期已過，系統已自動降為免費版。</p>
<p style="background:#f3f4f6;border:1px solid #9ca3af;border-radius:8px;padding:12px;color:#374151;font-size:14px">
你現有的設計都還在，但儲存/分享/報價等付費功能無法使用。
</p>
<p><a href="${SITE_URL}/pricing" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">恢復付費功能 →</a></p>`,
  );
  return { subject, text, html };
}

/** 取 plan 中文 label。對 'pro'/'personal' 直接 map，否則 fallback */
export function planLabelFromUserPlan(plan: string | null | undefined): string {
  if (!plan) return "付費版";
  // CheckoutPlan keys 沒 'student'/'lifetime'，user.plan 可能有
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
