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
/**
 * 限制 next= 只能是本站相對路徑（防 open redirect 釣魚）。
 * 拒絕：
 * - 非 / 開頭（next=evil.com）
 * - // 開頭（next=//evil.com → 瀏覽器當成 https://evil.com）
 * - /\ 反斜線變體（next=/\evil.com）
 * - 含 protocol（next=javascript: 或 next=https://evil.com）
 */
function sanitizeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return "/"; // /javascript:... 之類
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));
  // 從 next 推 locale prefix → /en 訪客的錯誤頁也保持 EN
  const localePrefix = next.startsWith("/en/") || next === "/en" ? "/en" : "";

  if (!code) {
    return NextResponse.redirect(`${origin}${localePrefix}/auth/error?reason=missing`);
  }

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
            .select("email, name, welcome_email_sent_at, locale")
            .eq("id", user.id)
            .single();
          if (u && !u.welcome_email_sent_at) {
            const payload = welcomeEmail({ name: u.name, locale: u.locale ?? "zh-TW" });
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

  // 失敗：判斷 Supabase 錯誤類別，給對應 reason 讓錯誤頁顯示合適文案
  const msg = error?.message?.toLowerCase() ?? "";
  const reason =
    msg.includes("expired") || msg.includes("invalid")
      ? "expired"
      : msg.includes("used") || msg.includes("already")
      ? "used"
      : "unknown";
  return NextResponse.redirect(`${origin}${localePrefix}/auth/error?reason=${reason}`);
}
