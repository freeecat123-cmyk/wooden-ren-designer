import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

/**
 * 每個 request 進來都跑一次 Supabase session refresh，確保 cookie 內的
 * access token 不會過期。Server Component / Route Handler 之後讀
 * `await createClient().auth.getUser()` 才會拿到最新 user。
 *
 * 額外：對 /admin/** 路徑做 admin email 檢查，非 admin → 導回首頁。
 */
export async function proxy(request: NextRequest) {
  const baseResponse = await updateSession(request);

  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin")) {
    // 用 ssr server client 拿 user（讀同一份 cookie）
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // middleware 階段不需要寫 cookie 回去（updateSession 已處理）
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isAdminEmail(user?.email, getServerAdminEmails())) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("admin_denied", "1");
      return NextResponse.redirect(url);
    }
  }

  return baseResponse;
}

export const config = {
  matcher: [
    // 不跑 middleware 的路徑：靜態檔、圖片、Next 內部 chunk
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
