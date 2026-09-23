"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";
import { createClient } from "@/lib/supabase/client";

/**
 * 註冊完成事件：OAuth callback 是 server route 打不到 client analytics，
 * 所以在 client 監聽 SIGNED_IN；user.created_at 在 5 分鐘內 = 剛註冊。
 * 同一瀏覽器只打一次（sessionStorage 標記），避免 token refresh 重複觸發。
 */
export function SignupTracker() {
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session?.user?.created_at) return;
      const ageMs = Date.now() - new Date(session.user.created_at).getTime();
      if (ageMs > 5 * 60_000) return;
      try {
        const key = `signup_tracked:${session.user.id}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // storage 不可用就照打
      }
      track("signup", { provider: session.user.app_metadata?.provider ?? "unknown" });
    });
    return () => subscription.unsubscribe();
  }, []);
  return null;
}
