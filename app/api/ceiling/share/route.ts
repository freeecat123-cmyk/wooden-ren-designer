import { NextResponse, type NextRequest } from "next/server";
import { customAlphabet } from "nanoid";
import { getRedis, SHORT_TTL_SECONDS } from "@/lib/shorten/redis";
import { checkIpRateLimit, getClientIp } from "@/lib/api/ip-rate-limit";

const nanoid = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
  8,
);

const CEILING_KEY_PREFIX = "wrd:ceiling:";
const MAX_PAYLOAD_BYTES = 16 * 1024; // 16KB 給 ceiling input
const CEILING_SHARE_PER_DAY = 30;

/**
 * POST /api/ceiling/share — body: { input: CeilingInput }
 *   存案場 input,回 8 字元短碼。30 天 TTL。
 *
 * GET /api/ceiling/share?code=xxx — 讀短碼對應的 input(JSON)
 */

export async function POST(req: NextRequest) {
  const rl = await checkIpRateLimit({
    prefix: "share:ceiling",
    ip: getClientIp(req),
    perDay: CEILING_SHARE_PER_DAY,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let input: unknown;
  try {
    const body = await req.json();
    input = body.input;
    if (!input || typeof input !== "object") {
      return NextResponse.json({ error: "input required" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "share not configured" }, { status: 503 });
  }

  const payload = JSON.stringify(input);
  if (payload.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: "payload too large", max: MAX_PAYLOAD_BYTES },
      { status: 413 },
    );
  }
  for (let i = 0; i < 3; i++) {
    const code = nanoid();
    const key = CEILING_KEY_PREFIX + code;
    const ok = await redis.set(key, payload, { nx: true, ex: SHORT_TTL_SECONDS });
    if (ok) {
      return NextResponse.json({ code });
    }
  }
  return NextResponse.json({ error: "id collision" }, { status: 500 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code || !/^[A-Za-z0-9]{4,16}$/.test(code)) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "share not configured" }, { status: 503 });
  }

  const data = await redis.get<string>(CEILING_KEY_PREFIX + code);
  if (!data) {
    return NextResponse.json({ error: "not found or expired" }, { status: 404 });
  }

  try {
    // Upstash 可能回 string 或 object,統一處理
    const input = typeof data === "string" ? JSON.parse(data) : data;
    return NextResponse.json({ input });
  } catch {
    return NextResponse.json({ error: "corrupt data" }, { status: 500 });
  }
}
