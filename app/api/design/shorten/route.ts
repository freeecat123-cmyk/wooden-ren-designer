import { NextResponse, type NextRequest } from "next/server";
import { customAlphabet } from "nanoid";
import {
  getRedis,
  SHORT_KEY_PREFIX,
  SHORT_TTL_SECONDS,
} from "@/lib/shorten/redis";
import { checkIpRateLimit, getClientIp } from "@/lib/api/ip-rate-limit";

const MAX_PATH_LENGTH = 2048;
const SHORTEN_PER_DAY = 30;

// base62（去掉視覺易混淆的 0/O/I/l），8 字元 ≈ 218 兆組合，碰撞機率近 0
const nanoid = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
  8,
);

/**
 * POST /api/design/shorten
 * body: { path: "/design/stool?length=450&..." }
 * resp: { code: "abc12345" }
 *
 * 把設計 path 存進 Redis，回 8 字元短碼。短碼之後可用 /q/<code> 跳轉。
 * 限制 /design/* 路徑防止被當開放 redirector 濫用。
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  // IP rate limit：30/IP/日，避免被當作填滿 Upstash 配額的攻擊
  const rl = await checkIpRateLimit({
    prefix: "shorten:design",
    ip: getClientIp(req),
    perDay: SHORTEN_PER_DAY,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: CORS_HEADERS },
    );
  }

  let path: string;
  try {
    const body = await req.json();
    if (typeof body.path !== "string" || !body.path.startsWith("/")) {
      return NextResponse.json(
        { error: "path required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    if (body.path.length > MAX_PATH_LENGTH) {
      return NextResponse.json(
        { error: "path too long", max: MAX_PATH_LENGTH },
        { status: 413, headers: CORS_HEADERS },
      );
    }
    path = body.path;
  } catch {
    return NextResponse.json(
      { error: "invalid json" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // 只允許 /design/* 路徑，防止被當開放 redirector 濫用
  if (!/^\/design\/[^/]+(\?|$|\/[^/]+(\?|$))/.test(path)) {
    return NextResponse.json(
      { error: "path not allowed" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "shortener not configured" },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  // 重試 3 次避免理論上的碰撞
  for (let i = 0; i < 3; i++) {
    const code = nanoid();
    const key = SHORT_KEY_PREFIX + code;
    // SET key value NX EX ttl —— NX 確保不覆蓋既有
    const ok = await redis.set(key, path, { nx: true, ex: SHORT_TTL_SECONDS });
    if (ok) {
      return NextResponse.json({ code }, { headers: CORS_HEADERS });
    }
  }
  return NextResponse.json(
    { error: "id collision" },
    { status: 500, headers: CORS_HEADERS },
  );
}
