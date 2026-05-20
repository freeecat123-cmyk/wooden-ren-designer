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
 * 高頻 SSR 頁面用的「免 HTTP roundtrip」session 讀取。
 *
 * 為什麼：`supabase.auth.getUser()` 每次都打 Supabase auth server 驗 JWT
 * 簽章（50-200ms TTFB）。但 middleware.ts 已經每個 request 跑一次 getUser()
 * 集中驗證並 refresh cookie，後續同一個 request 在 page 裡 cookie 已是
 * 有效狀態——直接從 cookie 解 session 即可，不再二次 HTTP。
 *
 * 適用：唯讀 SSR 頁面（/design/[type]、/quote、/cut-plan 等）。
 * 不適用：寫入操作、敏感 API endpoint、Server Action——那邊用 getUser()
 * 保持 defense-in-depth。
 *
 * 回傳 `null` = 未登入。session.user 直接給 id / email。
 */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
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
