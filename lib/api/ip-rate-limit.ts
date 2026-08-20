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

  // Redis 壞掉時放行，不要把例外往上丟。
  //
  // 2026-08-20 正式站事故：Upstash 連不上 → incr 拋錯 → 這裡沒有 try/catch →
  // /api/pdf-font、/api/design/shorten、/api/quote/shorten、/api/ceiling/share
  // 四個 endpoint 的每一個 POST 都變成 500，連參數格式都還沒檢查就掛了。
  //
  // 限流器的職責是「擋過量」，不是「決定服務生死」。它壞掉時讓路，跟上面
  // 「沒設環境變數就放行」是同一個取捨；代價是 Redis 故障期間不設防，
  // 但這幾支保護的是短碼與字型子集，濫用成本遠低於整個功能不能用。
  // 一定要 console.error，否則 Redis 掛了不會有人知道。
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // 第一次設 25hr TTL 多給 buffer 到隔日換 key
      await redis.expire(key, 60 * 60 * 25);
    }
    return {
      ok: count <= opts.perDay,
      remaining: Math.max(0, opts.perDay - count),
    };
  } catch (err) {
    console.error(`[ip-rate-limit] Redis 失敗，本次放行（prefix=${opts.prefix}）：`, err);
    return { ok: true, remaining: opts.perDay };
  }
}
