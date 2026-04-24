import { NextResponse } from "next/server";
import { getRedis, SHORT_KEY_PREFIX } from "@/lib/shorten/redis";

/**
 * GET /q/[code]
 * 從 Redis 讀短碼對應的 path，302 redirect 過去。找不到回 404 頁。
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  if (!/^[A-Za-z0-9]{4,16}$/.test(code)) {
    return new NextResponse("Invalid code", { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return new NextResponse("Shortener not configured", { status: 503 });
  }

  const path = await redis.get<string>(SHORT_KEY_PREFIX + code);
  if (!path) {
    return new NextResponse(
      `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>報價單已過期</title><style>body{font-family:system-ui;max-width:480px;margin:80px auto;padding:0 20px;color:#333;text-align:center}</style></head><body><h1>📄 報價單已過期或不存在</h1><p>這份報價單的連結已超過 30 天有效期，或從未被建立過。</p><p>請聯絡建立報價的師傅重新發送一份新的連結。</p></body></html>`,
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  return NextResponse.redirect(new URL(path, _req.url), 302);
}
