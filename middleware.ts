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
import { GEO_DEFAULTS_COOKIE, resolveGeoDefaults } from "./lib/geo-defaults";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * cnc.woodenren.com — CNC 刀路產生器的獨立門面。
 *
 * 同一個 Next app 服務兩個網域：登入、綠界金流、電子發票、退款、對帳那一整套
 * 原封不動沿用，只有「進來看到什麼」不同。另外開一個獨立站等於把付款基礎建設
 * 重做一次，那是這個專案花最多力氣做起來的部分，不值得為了換網域重寫。
 *
 * 三條規則：
 *  1. `/` 與 `/en` 直接吃 CNC 頁（rewrite，網址列保持乾淨的 cnc.woodenren.com）
 *  2. 買／登入流程會用到的路徑照常放行
 *  3. 其餘頁面 308 導回 designer 主站 —— 同一份內容掛在兩個網域，
 *     Google 會當成重複內容讓兩邊互相稀釋，SEO 是雙輸
 */
const CNC_HOST = "cnc.woodenren.com";
const MAIN_ORIGIN = "https://designer.woodenren.com";

/** CNC 網域上允許存在的路徑（比對時先剝掉 /en 前綴，兩種語言同一份規則）。 */
function allowedOnCncHost(pathname: string): boolean {
  const p = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return (
    p === "/" ||
    p === "/cnc" ||
    p === "/login" ||
    p === "/pricing" ||
    p === "/my-subscription" ||
    p.startsWith("/auth/")
  );
}

/**
 * 智慧語言偵測：根 `/` 路徑時，若使用者沒手動選過語言、且 Accept-Language 不是 zh-*，
 * 跳轉到 /en。避免英文行銷流量（Reddit / blog / pin）落到中文首頁秒跳走。
 *
 * 不跳轉的情況：
 * - 用戶 cookie 顯示已選過語言（NEXT_LOCALE 存在）
 * - Accept-Language 為空（多半是爬蟲，保留 zh-TW 為 canonical SEO）
 * - 主要語言以 zh 開頭（zh-TW / zh-CN / zh-HK / zh-SG）
 */
function shouldRedirectToEn(request: NextRequest): boolean {
  if (request.cookies.has("NEXT_LOCALE")) return false;
  const acceptLang = request.headers.get("accept-language") ?? "";
  if (!acceptLang.trim()) return false;
  const primary = acceptLang.split(",")[0]?.trim().toLowerCase() ?? "";
  if (primary.startsWith("zh")) return false;
  return true;
}

/**
 * 在 response 上設定 wr-geo-defaults cookie（若尚未存在）。
 * 由 Vercel 邊緣節點注入的 `x-vercel-ip-country` header 推測單位/幣別預設。
 * 不覆蓋既有 cookie → 使用者切換偏好後不會被 middleware 改回去。
 */
function ensureGeoDefaultsCookie(request: NextRequest, response: NextResponse) {
  if (request.cookies.has(GEO_DEFAULTS_COOKIE)) return;
  const country = request.headers.get("x-vercel-ip-country");
  const defaults = resolveGeoDefaults(country);
  response.cookies.set(GEO_DEFAULTS_COOKIE, JSON.stringify(defaults), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 年
    sameSite: "lax",
    httpOnly: false, // 需要讓 client hook 讀
  });
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── cnc.woodenren.com ────────────────────────────────────────────────
  // 放在最前面：這個網域上「首頁＝CNC 頁」，不該再走下面主站那套
  // （尤其 home 的「已登入 → 導去 /app 家具目錄」，會把 CNC 訪客彈去家具設計器）。
  if ((request.headers.get("host") ?? "").split(":")[0] === CNC_HOST) {
    if (!allowedOnCncHost(pathname)) {
      return NextResponse.redirect(
        new URL(pathname + request.nextUrl.search, MAIN_ORIGIN),
        308,
      );
    }
    if (pathname === "/" || pathname === "/en") {
      // 改寫 pathname 再交給 intl：直接回 rewrite 會跳過 locale 處理，
      // 而 /cnc 這頁住在 app/[locale]/cnc，沒有 locale 段就配不到路由。
      request.nextUrl.pathname = pathname === "/en" ? "/en/cnc" : "/cnc";
      return intlMiddleware(request);
    }
  }

  // 根 `/` 智慧語言跳轉（在 intl 處理之前；只針對 `/`，不包含 `/en` 或其他路徑）
  if (pathname === "/" && shouldRedirectToEn(request)) {
    return NextResponse.redirect(new URL("/en", request.url));
  }

  // 先讓 intl 處理 locale 偵測（可能會 redirect 或 rewrite）
  const intlResponse = intlMiddleware(request);

  const isHome = pathname === "/" || pathname === "/en";

  // 非 home 路徑：寫入 geo cookie（若需要）後直接回 intl 結果，不做 auth 檢查（省 50-200ms TTFB）
  if (!isHome) {
    const passthrough =
      intlResponse instanceof NextResponse ? intlResponse : NextResponse.next({ request });
    ensureGeoDefaultsCookie(request, passthrough);
    return passthrough;
  }

  // home 路徑才檢查 auth；用 intlResponse 當底以保留它寫入的 cookie
  const response =
    intlResponse instanceof NextResponse ? intlResponse : NextResponse.next({ request });

  ensureGeoDefaultsCookie(request, response);

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
