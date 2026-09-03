/**
 * 生命週期自動信的分類規則（純函式，無 DB，給 cron route 與測試共用）。
 *
 * 規則（2026-09-03 定）：
 *   共通：只寄 plan=free 且 subscription_status ≠ active、有 email 的人；
 *         每人每個 email_key 只寄一次（sent 集合）。
 *   new_d1     LAUNCH 之後註冊、滿 24h、沒存過設計
 *   new_d3     LAUNCH 之後註冊、滿 3 天
 *   new_d7     LAUNCH 之後註冊、滿 7 天
 *   reengage_1 LAUNCH 之前註冊、從沒有任何 subscription
 *   reengage_2 reengage_1 寄出滿 7 天仍 free
 *   winback    有 expired/cancelled 的 subscription、最近一筆到期超過 14 天
 *
 * 2026-09-03 晚加三封：
 *   post_purchase_photo 最近一次購買（付款成功 / 範本買斷 / 工具買斷）落在 6～8 天前。
 *                       ⚠️ 這封不看 plan（付費的人才會收），排最前。
 *   checkout_abandoned  最近一筆 pending 結帳在 24～72h 前，之後沒有任何購買；free 且沒 active。
 *   viewed_template_<c> 3～10 天前看過付費範本 c（最近的那款）、沒買斷 c、free 且沒 active、
 *                       這個人從沒收過任何 viewed_template_*（每人只寄一款）、
 *                       且 3 天內沒收過別封（避免連日轟炸）。排在舊六封之後當補位。
 *
 * 同一輪一個人最多挑一封（依上列優先序），避免同天收兩封。
 */
import {
  VIEWED_TEMPLATE_PREFIX,
  type LifecycleEmailKey,
  type LifecycleSendKey,
} from "./templates/lifecycle";

export const LIFECYCLE_LAUNCH_ISO = "2026-09-03T00:00:00+08:00";
const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface LifecycleUser {
  id: string;
  email: string | null;
  plan: string | null;
  subscription_status: string | null;
  created_at: string;
}

export interface TemplateView {
  category: string;
  viewedAt: string;
}

export interface LifecycleContext {
  now: number;
  /** 這個人存過設計 */
  hasDesign: boolean;
  /** 這個人有過任何 subscription 紀錄 */
  hasAnySubscription: boolean;
  /** 最近一筆 expired/cancelled subscription 的 expires_at（ISO），沒有就 null */
  lastEndedSubscriptionExpiresAt: string | null;
  /** 已寄過的 email_key（含 viewed_template_<c>）→ sent_at ISO */
  sent: Partial<Record<LifecycleSendKey, string>>;
  /** 最近一次購買時間（payments success / template_unlocks / tool_unlocks 取最大），沒有就 null */
  lastPurchaseAt?: string | null;
  /** 最近一筆 pending 結帳的 created_at，沒有就 null */
  lastPendingCheckoutAt?: string | null;
  /** 看過的付費範本（任意順序） */
  templateViews?: TemplateView[];
  /** 已買斷的範本 category */
  unlockedCategories?: string[];
}

const ms = (iso: string) => new Date(iso).getTime();

function lastSentAt(sent: LifecycleContext["sent"]): number | null {
  let max: number | null = null;
  for (const v of Object.values(sent)) {
    if (!v) continue;
    const t = ms(v);
    if (Number.isFinite(t) && (max === null || t > max)) max = t;
  }
  return max;
}

export function pickLifecycleEmail(
  u: LifecycleUser,
  ctx: LifecycleContext,
  launchIso: string = LIFECYCLE_LAUNCH_ISO,
): LifecycleSendKey | null {
  if (!u.email) return null;
  const now = ctx.now;
  const not = (k: LifecycleSendKey) => !ctx.sent[k];

  // 1) 買後 7 天要照片：不看 plan
  if (ctx.lastPurchaseAt && not("post_purchase_photo")) {
    const since = now - ms(ctx.lastPurchaseAt);
    if (since >= 6 * DAY && since <= 8 * DAY) return "post_purchase_photo";
  }

  if (u.plan !== "free") return null;
  if (u.subscription_status === "active") return null;

  // 2) 結帳沒付：24～72h 前有 pending，之後沒買
  if (ctx.lastPendingCheckoutAt && not("checkout_abandoned")) {
    const pend = ms(ctx.lastPendingCheckoutAt);
    const since = now - pend;
    const boughtAfter = ctx.lastPurchaseAt ? ms(ctx.lastPurchaseAt) >= pend : false;
    if (since >= 24 * HOUR && since <= 72 * HOUR && !boughtAfter) return "checkout_abandoned";
  }

  const launch = new Date(launchIso).getTime();
  const created = new Date(u.created_at).getTime();
  const age = now - created;

  if (created >= launch) {
    if (age >= DAY && !ctx.hasDesign && not("new_d1")) return "new_d1";
    if (age >= 3 * DAY && not("new_d3")) return "new_d3";
    if (age >= 7 * DAY && not("new_d7")) return "new_d7";
  } else if (!ctx.hasAnySubscription) {
    if (not("reengage_1")) return "reengage_1";
    const r1 = ctx.sent.reengage_1;
    if (r1 && now - ms(r1) >= 7 * DAY && not("reengage_2")) {
      return "reengage_2";
    }
  }

  if (ctx.lastEndedSubscriptionExpiresAt && not("winback")) {
    const ended = ms(ctx.lastEndedSubscriptionExpiresAt);
    if (now - ended >= 14 * DAY) return "winback";
  }

  // 3) 看過付費範本沒買：補位，每人一款、3 天內沒收過別封
  const viewedKey = pickViewedTemplateKey(ctx);
  if (viewedKey) return viewedKey;

  return null;
}

/** 從 templateViews 挑「3～10 天前看過、沒買斷、最近的那款」；沒有就 null。 */
export function pickViewedTemplateKey(ctx: LifecycleContext): LifecycleSendKey | null {
  const views = ctx.templateViews ?? [];
  if (!views.length) return null;
  if (Object.keys(ctx.sent).some((k) => k.startsWith(VIEWED_TEMPLATE_PREFIX))) return null;
  const last = lastSentAt(ctx.sent);
  if (last !== null && ctx.now - last < 3 * DAY) return null;
  const unlocked = new Set(ctx.unlockedCategories ?? []);
  let best: TemplateView | null = null;
  for (const v of views) {
    if (!v.category || unlocked.has(v.category)) continue;
    const since = ctx.now - ms(v.viewedAt);
    if (since < 3 * DAY || since > 10 * DAY) continue;
    if (!best || ms(v.viewedAt) > ms(best.viewedAt)) best = v;
  }
  return best ? (`${VIEWED_TEMPLATE_PREFIX}${best.category}` as LifecycleSendKey) : null;
}

export type { LifecycleEmailKey, LifecycleSendKey };
