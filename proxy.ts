import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * 每個 request 進來都跑一次 Supabase session refresh，確保 cookie 內的
 * access token 不會過期。Server Component / Route Handler 之後讀
 * `await createClient().auth.getUser()` 才會拿到最新 user。
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 不跑 middleware 的路徑：靜態檔、圖片、Next 內部 chunk
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
