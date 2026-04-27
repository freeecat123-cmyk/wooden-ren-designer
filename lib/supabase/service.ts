/**
 * Service-role Supabase client——僅在 server route handler 使用，
 * 用來繞過 RLS 對 whitelist / users 等表做寫入。
 *
 * **不要在 client component 引入這個檔案**——SUPABASE_SERVICE_ROLE_KEY
 * 是後端密鑰，洩漏會被別人寫入任何資料表。
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. " +
        "管理 API 需要 service-role key 才能繞過 RLS。",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
