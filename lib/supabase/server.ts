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
