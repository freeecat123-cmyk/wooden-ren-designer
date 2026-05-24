/**
 * Next.js root middleware
 *
 * 唯一職責：已登入用戶訪問 `/`（行銷 landing）→ 302 導 `/app`（家具目錄）。
 *
 * matcher 只 match exact `/`，**完全不會碰到**：
 *   - /api/*（含綠界 callback /api/ecpay/{return,periodic-notify,payment-info}）
 *   - /my-subscription（綠界 ClientBackURL）
 *   - /pricing /design /app 等其他頁面
 *
 * 不做 auth gate，不做 session refresh（那由 layout.tsx 的 getUser 處理）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

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
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  // Exact match `/` 才執行。子路徑不會觸發。
  matcher: ["/"],
};
