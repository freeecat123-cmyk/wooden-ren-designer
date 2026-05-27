/**
 * Composed middleware: next-intl locale detection + 已登入用戶 home → /app 重導。
 *
 * 1. next-intl middleware：偵測 URL locale prefix，設定 cookie，預設 zh-TW 不前綴
 *    （localePrefix: 'as-needed'）。對 `/about` 解析為 zh-TW，對 `/en/about` 解析為 en。
 *
 * 2. Home redirect：已登入用戶訪問 `/`（zh-TW home）或 `/en`（en home）→ 302 導
 *    `/app` 或 `/en/app`（家具目錄）。matcher 仍要排除 API / 靜態檔。
 *
 * api/* 含綠界 callback 等是 locale-agnostic，不走這個 middleware（被 matcher 排除）。
 */
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // 先讓 intl 處理 locale 偵測（可能會 redirect 或 rewrite）
  const intlResponse = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const isHome = pathname === "/" || pathname === "/en";

  // 非 home 路徑：直接回 intl 的結果，不做 auth 檢查（省 50-200ms TTFB）
  if (!isHome) return intlResponse;

  // home 路徑才檢查 auth；用 intlResponse 當底以保留它寫入的 cookie
  const response =
    intlResponse instanceof NextResponse ? intlResponse : NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const target = pathname === "/en" ? "/en/app" : "/app";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}

export const config = {
  // 排除 API、Next 內部路徑、靜態檔，以及兩條 locale-agnostic 的頂層 route handler：
  //   - /auth/callback：Supabase OAuth 回呼 URL（已寫死在 Supabase Dashboard，不能加 locale 前綴）
  //   - /q/*：短網址（印在 PDF/QR 上，必須精確 /q/CODE 才能用）
  //
  // 若不排除這兩條，next-intl 會 rewrite 成 /zh-TW/auth/callback 或 /zh-TW/q/xxx，
  // 而那些路徑在新結構下不存在（已從 [locale] 搬回頂層），結果 404 整套 auth 流程壞掉。
  matcher: [
    "/((?!api|auth/callback|q/|_next|_vercel|.*\\..*).*)",
  ],
};
