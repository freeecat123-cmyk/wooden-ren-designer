import { NextResponse } from "next/server";
import { getRedis, SHORT_KEY_PREFIX } from "@/lib/shorten/redis";

const EXPIRED_COPY = {
  en: {
    lang: "en",
    title: "Quote expired",
    h1: "📄 This quote has expired or does not exist",
    p1: "This quote link is past its 30-day validity window, or was never created.",
    p2: "Please contact the carpenter who sent it to share a fresh link.",
  },
  zh: {
    lang: "zh-TW",
    title: "報價單已過期",
    h1: "📄 報價單已過期或不存在",
    p1: "這份報價單的連結已超過 30 天有效期，或從未被建立過。",
    p2: "請聯絡建立報價的師傅重新發送一份新的連結。",
  },
} as const;

function pickLocale(acceptLanguage: string | null): "en" | "zh" {
  if (!acceptLanguage) return "zh";
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("zh")) return "zh";
  if (first.startsWith("en")) return "en";
  return "zh";
}

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
    const c = EXPIRED_COPY[pickLocale(_req.headers.get("accept-language"))];
    return new NextResponse(
      `<!doctype html><html lang="${c.lang}"><head><meta charset="utf-8"><title>${c.title}</title><style>body{font-family:system-ui;max-width:480px;margin:80px auto;padding:0 20px;color:#333;text-align:center}</style></head><body><h1>${c.h1}</h1><p>${c.p1}</p><p>${c.p2}</p></body></html>`,
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  return NextResponse.redirect(new URL(path, _req.url), 302);
}
