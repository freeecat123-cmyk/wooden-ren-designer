import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import {
  getRedis,
  SHORT_KEY_PREFIX,
  SHORT_TTL_SECONDS,
} from "@/lib/shorten/redis";

// base62（去掉視覺易混淆的 0/O/I/l），8 字元 ≈ 218 兆組合，碰撞機率近 0
const nanoid = customAlphabet(
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
  8,
);

/**
 * POST /api/quote/shorten
 * body: { path: "/design/low-table/quote/print?length=1000&..." }
 * resp: { code: "abc12345" }
 *
 * 把長 path 存進 Redis，回 8 字元短碼。短碼之後可用 /q/<code> 跳轉。
 */
export async function POST(req: Request) {
  let path: string;
  try {
    const body = await req.json();
    if (typeof body.path !== "string" || !body.path.startsWith("/")) {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }
    path = body.path;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // path 安全防護：只允許 /design/.../quote/print 路徑，避免被當開放 redirector 濫用
  if (!/^\/design\/[^/]+\/quote\/print(\?|$)/.test(path)) {
    return NextResponse.json({ error: "path not allowed" }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "shortener not configured" },
      { status: 503 },
    );
  }

  // 重試 3 次避免理論上的碰撞
  for (let i = 0; i < 3; i++) {
    const code = nanoid();
    const key = SHORT_KEY_PREFIX + code;
    // SET key value NX EX ttl —— NX 確保不覆蓋既有
    const ok = await redis.set(key, path, { nx: true, ex: SHORT_TTL_SECONDS });
    if (ok) {
      return NextResponse.json({ code });
    }
  }
  return NextResponse.json({ error: "id collision" }, { status: 500 });
}
