import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates/welcome";

/**
 * Google OAuth 流程：
 * 1. LoginButton 呼叫 supabase.auth.signInWithOAuth → 跳到 Google
 * 2. Google 授權後重導回此 route，URL 帶 ?code=xxx
 * 3. 這裡用 code 換 session，寫進 cookie
 * 4. 首次登入（welcome_email_sent_at IS NULL）寄歡迎信
 * 5. 重導回原本要去的頁面（next 參數）或首頁
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 偵測是否新註冊：users.welcome_email_sent_at IS NULL → 寄歡迎信
      // （非 await 給 user redirect，避免 email 延遲卡住跳轉）
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email) {
          const admin = createAdminClient();
          const { data: u } = await admin
            .from("users")
            .select("email, name, welcome_email_sent_at")
            .eq("id", user.id)
            .single();
          if (u && !u.welcome_email_sent_at) {
            const payload = welcomeEmail({ name: u.name });
            void sendEmail({
              to: u.email,
              subject: payload.subject,
              text: payload.text,
              html: payload.html,
            }).then(async (res) => {
              if (res.ok) {
                await admin
                  .from("users")
                  .update({ welcome_email_sent_at: new Date().toISOString() })
                  .eq("id", user.id);
              }
            });
          }
        }
      } catch (e) {
        // 寄信失敗不該擋 OAuth 流程
        console.warn("[auth/callback] welcome email error", e);
      }

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
