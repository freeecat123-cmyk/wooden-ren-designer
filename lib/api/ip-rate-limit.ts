/**
 * IP-based daily rate limit helper（Upstash Redis）。
 *
 * 通用模式：給 endpoint 設一個 prefix + perDay 限額，回 ok/remaining。
 * 沒設 Upstash env 時直接回 ok=true（local dev、不擋 cron）。
 *
 * 使用：
 *   const ip = getClientIp(req);
 *   const rl = await checkIpRateLimit({ prefix: "refund", ip, perDay: 3 });
 *   if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
 */
import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/shorten/redis";

export function getClientIp(req: NextRequest | Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export interface RateLimitOptions {
  /** Redis key 前綴，例如 "refund" / "shorten"。 */
  prefix: string;
  ip: string;
  /** 每日上限 */
  perDay: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

export async function checkIpRateLimit(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { ok: true, remaining: opts.perDay };
  const today = new Date().toISOString().slice(0, 10);
  const key = `rl:${opts.prefix}:${today}:${opts.ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    // 第一次設 25hr TTL 多給 buffer 到隔日換 key
    await redis.expire(key, 60 * 60 * 25);
  }
  return {
    ok: count <= opts.perDay,
    remaining: Math.max(0, opts.perDay - count),
  };
}
