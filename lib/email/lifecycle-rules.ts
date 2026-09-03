/**
 * 生命週期自動信的分類規則（純函式，無 DB，給 cron route 與測試共用）。
 *
 * 規則（2026-09-03 定）：
 *   共通：只寄 plan=free 且 subscription_status ≠ active、有 email 的人；
 *         每人每個 email_key 只寄一次（alreadySent 集合）。
 *   new_d1     LAUNCH 之後註冊、滿 24h、沒存過設計
 *   new_d3     LAUNCH 之後註冊、滿 3 天
 *   new_d7     LAUNCH 之後註冊、滿 7 天
 *   reengage_1 LAUNCH 之前註冊、從沒有任何 subscription
 *   reengage_2 reengage_1 寄出滿 7 天仍 free
 *   winback    有 expired/cancelled 的 subscription、最近一筆到期超過 14 天
 *
 * 同一輪一個人最多挑一封（依上列優先序），避免同天收兩封。
 */
import type { LifecycleEmailKey } from "./templates/lifecycle";

export const LIFECYCLE_LAUNCH_ISO = "2026-09-03T00:00:00+08:00";
const DAY = 86_400_000;

export interface LifecycleUser {
  id: string;
  email: string | null;
  plan: string | null;
  subscription_status: string | null;
  created_at: string;
}

export interface LifecycleContext {
  now: number;
  /** 這個人存過設計 */
  hasDesign: boolean;
  /** 這個人有過任何 subscription 紀錄 */
  hasAnySubscription: boolean;
  /** 最近一筆 expired/cancelled subscription 的 expires_at（ISO），沒有就 null */
  lastEndedSubscriptionExpiresAt: string | null;
  /** 已寄過的 email_key → sent_at ISO */
  sent: Partial<Record<LifecycleEmailKey, string>>;
}

export function pickLifecycleEmail(
  u: LifecycleUser,
  ctx: LifecycleContext,
  launchIso: string = LIFECYCLE_LAUNCH_ISO,
): LifecycleEmailKey | null {
  if (!u.email) return null;
  if (u.plan !== "free") return null;
  if (u.subscription_status === "active") return null;

  const now = ctx.now;
  const launch = new Date(launchIso).getTime();
  const created = new Date(u.created_at).getTime();
  const age = now - created;
  const not = (k: LifecycleEmailKey) => !ctx.sent[k];

  if (created >= launch) {
    if (age >= DAY && !ctx.hasDesign && not("new_d1")) return "new_d1";
    if (age >= 3 * DAY && not("new_d3")) return "new_d3";
    if (age >= 7 * DAY && not("new_d7")) return "new_d7";
  } else if (!ctx.hasAnySubscription) {
    if (not("reengage_1")) return "reengage_1";
    const r1 = ctx.sent.reengage_1;
    if (r1 && now - new Date(r1).getTime() >= 7 * DAY && not("reengage_2")) {
      return "reengage_2";
    }
  }

  if (ctx.lastEndedSubscriptionExpiresAt && not("winback")) {
    const ended = new Date(ctx.lastEndedSubscriptionExpiresAt).getTime();
    if (now - ended >= 14 * DAY) return "winback";
  }
  return null;
}
