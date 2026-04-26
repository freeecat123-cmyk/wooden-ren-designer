/**
 * 瀏覽器端 / Client Component 用的 Supabase client。
 * 認證 session 從 cookie 讀，跟 server 共享狀態。
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
