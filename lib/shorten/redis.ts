import { Redis } from "@upstash/redis";

let cached: Redis | null = null;

/**
 * 取得 Upstash Redis client。從環境變數 UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN 讀。沒設環境變數時回 null，呼叫端要 fallback。
 */
export function getRedis(): Redis | null {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  cached = new Redis({ url, token });
  return cached;
}

/** Redis key prefix —— 短碼存 wrd:short:<code> = path */
export const SHORT_KEY_PREFIX = "wrd:short:";

/** 短碼有效期（秒），預設 30 天 */
export const SHORT_TTL_SECONDS = 30 * 24 * 60 * 60;
