/**
 * Edge middleware：
 *  1. 所有 request 走 updateSession 刷新 Supabase session cookie
 *  2. /admin/* 與 /api/admin/* 額外做 admin email allowlist 檢查
 *     （per-page redirect 是第二道防線、middleware 是第一道、新加 admin 頁
 *     即使忘了寫 isAdminEmail check 也會被擋）
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

async function getSessionUserEmail(
  request: NextRequest,
  response: NextResponse,
): Promise<string | null> {
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
  return user?.email ?? null;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminPage && !isAdminApi) return response;

  const email = await getSessionUserEmail(request, response);
  if (!isAdminEmail(email, getServerAdminEmails())) {
    if (isAdminApi) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
