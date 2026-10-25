/**
 * 中性網域登入信（app/api/auth/neutral-link）用的純邏輯：email 驗證、60 秒冷卻、連結網址組裝。
 * 拆出來是為了測試（route.ts 只能 export HTTP method）。
 */
import { getRedis } from "@/lib/shorten/redis";
import { isNeutralHost, neutralOrigin, normalizeHost } from "@/lib/brand-hosts";
import { sanitizeNext } from "@/lib/safe-next";

export const NEUTRAL_LINK_COOLDOWN_SECONDS = 60;

/** 寬鬆但擋得住垃圾的 email 格式檢查（真正有沒有這個信箱由寄信結果決定） */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return null;
  if (!/^[^\s@<>()[\]\\,;:"]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(e)) {
    return null;
  }
  const [local] = e.split("@");
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return null;
  }
  return e;
}

/**
 * 冷卻：同一 key 在 NEUTRAL_LINK_COOLDOWN_SECONDS 內只能過一次。
 *
 * 優先用 Upstash Redis（SET NX EX，跨 serverless instance 有效）；
 * 沒設 Redis 或 Redis 壞掉就退回記憶體 Map ——
 * ⚠️ 記憶體版只在同一個 instance 內有效（Vercel 會開多個 instance、冷啟動會清空），
 *    只能擋同一台連點，擋不住分散攻擊；正式環境請確保 UPSTASH_REDIS_REST_* 有設。
 */
const memory = new Map<string, number>();

export function __resetCooldownMemoryForTest() {
  memory.clear();
}

function claimInMemory(key: string, now: number): boolean {
  const until = memory.get(key);
  if (until && until > now) return false;
  memory.set(key, now + NEUTRAL_LINK_COOLDOWN_SECONDS * 1000);
  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v <= now) memory.delete(k);
  }
  return true;
}

export async function claimCooldown(key: string, now: number = Date.now()): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const r = await redis.set(`nl:${key}`, "1", { nx: true, ex: NEUTRAL_LINK_COOLDOWN_SECONDS });
      return r === "OK";
    } catch (err) {
      console.error("[neutral-link] Redis 失敗，改用記憶體冷卻", err);
    }
  }
  return claimInMemory(key, now);
}

/** 同一 IP、同一 email 都要通過冷卻才放行。IP 先查，避免換 email 狂打 */
export async function checkNeutralLinkRateLimit(ip: string, email: string): Promise<boolean> {
  if (!(await claimCooldown(`ip:${ip}`))) return false;
  return claimCooldown(`email:${email}`);
}

/**
 * 信裡連結的網址前綴。
 * - Host 在中性白名單：用該網域（⛔ 不信任白名單外的 Host）
 * - 本機（非 production）：用 request 本身的 origin，方便 localhost 點連結測試
 * - Vercel Preview（VERCEL_ENV=preview + BRAND_FORCE_NEUTRAL=1）：用 preview 網址本身
 */
export function linkOrigin(reqUrl: string, host: string | null): string {
  if (isNeutralHost(host)) return neutralOrigin(host);
  if (process.env.NODE_ENV !== "production") return new URL(reqUrl).origin;
  const h = normalizeHost(host);
  if (process.env.VERCEL_ENV === "preview" && h.endsWith(".vercel.app")) return `https://${h}`;
  return neutralOrigin(null);
}

/** callback 只接受這幾種 type（generateLink 回傳的 verification_type） */
export const OTP_LINK_TYPES = ["magiclink", "signup", "email"] as const;
export type OtpLinkType = (typeof OTP_LINK_TYPES)[number];

export function isOtpLinkType(t: string | null | undefined): t is OtpLinkType {
  return !!t && (OTP_LINK_TYPES as readonly string[]).includes(t);
}

/** /auth/callback?token_hash=...&type=...&next=... */
export function buildCallbackLink(origin: string, tokenHash: string, type: OtpLinkType, next: string | null): string {
  const u = new URL("/auth/callback", origin);
  u.searchParams.set("token_hash", tokenHash);
  u.searchParams.set("type", type);
  u.searchParams.set("next", sanitizeNext(next));
  return u.toString();
}
