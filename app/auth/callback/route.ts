import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Google OAuth 流程：
 * 1. LoginButton 呼叫 supabase.auth.signInWithOAuth → 跳到 Google
 * 2. Google 授權後重導回此 route，URL 帶 ?code=xxx
 * 3. 這裡用 code 換 session，寫進 cookie
 * 4. 重導回原本要去的頁面（next 參數）或首頁
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 處理 Vercel preview / production 部署時的 X-Forwarded-Host header
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) return NextResponse.redirect(`${origin}${next}`);
      if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}${next}`);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 失敗時導到錯誤頁（先導回首頁，未來可加 /auth/error）
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
