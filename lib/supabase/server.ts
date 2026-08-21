/**
 * Server Component / Route Handler / Server Action 用的 Supabase client。
 * 從 Next.js cookies() 讀寫 session cookie。
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 中呼叫 setAll 會失敗（cookies 唯讀），
            // 那種情況通常已有 middleware 在維護 session，安全略過
          }
        },
      },
    },
  );
}

/**
 * SSR 頁面用的登入者讀取。**一定要驗簽**。
 *
 * ⛔ 這裡原本用 `supabase.auth.getSession()`，理由寫著「middleware.ts 已經每個 request
 *    跑一次 getUser() 集中驗證，所以 page 裡直接讀 cookie 就好，省 50-200ms TTFB」。
 *    **那個前提是錯的**（2026-08-21 稽核實查）：middleware.ts:142-149 有
 *      `if (!isHome) { ...; return passthrough; }`
 *    —— 除了 `/` 與 `/en` 兩條首頁路徑，middleware 直接 return，全檔只有一處 getUser()
 *    而且只為了「已登入就導去 /app」。也就是說 /design/[type]、/quote、/cut-plan、
 *    /print 這些真正在用 getSessionUser() 的頁面，**從來沒有任何一段程式驗過那個 JWT**。
 *
 * ⚠️ 為什麼這很嚴重：`getSession()` 在 server 端只解 cookie、**不驗簽章**（Supabase 官方
 *    文件明講 server 端要用 getUser()）。而呼叫端拿 `user.email` 去餵 isAdminEmail()
 *    決定 isAdmin、拿 `user.id` 去 createAdminClient()（繞過 RLS）查解鎖清單。
 *    自帶一份偽造的 auth cookie ⇒ 可以自稱任何 email（含管理員）與任何 user id。
 *
 * 代價：每次多一趟 auth server 驗簽（50-200ms）。付費牆與管理員判定建立在這上面，
 * 這個延遲換的是「不能被偽造」，值得。要省延遲請改快取驗證結果，不要改回不驗簽。
 *
 * 回傳 `null` = 未登入或驗簽失敗。
 */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * 後端 admin 操作（例如 webhook 處理綠界回呼、建立 subscription / payment 紀錄）
 * 用 service_role key，會繞過 RLS——只能在 server 端用，不要洩漏到 client
 */
export function createAdminClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js") as {
    createClient: typeof import("@supabase/supabase-js").createClient;
  };
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
