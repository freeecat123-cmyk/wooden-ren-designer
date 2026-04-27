"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  getEffectivePlan,
  getPlanFeatures,
  type PlanFeatures,
  type PlanId,
  type UserPlanProfile,
} from "@/lib/permissions";

interface UserPlanState {
  profile: UserPlanProfile | null;
  plan: PlanId;
  features: PlanFeatures;
  isLoading: boolean;
  isPaid: boolean;
  isLoggedIn: boolean;
  /** users 表 id（同 auth.uid()）— 寫入 designs / customers 等表時用 */
  userId: string | null;
}

/**
 * 拉取目前登入使用者的方案資料並回傳 derived feature flags。
 * 未登入 → 一律當免費版（features 維持 free 預設值，UI 用 isLoggedIn 判斷登入流程）。
 */
export function useUserPlan(): UserPlanState {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserPlanProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("plan, subscription_status, subscription_expires_at")
        .eq("id", user.id)
        .single();
      if (cancelled) return;
      if (error) {
        // 第一次登入 trigger 可能延遲；fallback 視為免費版
        setProfile(null);
      } else {
        setProfile(data as UserPlanProfile);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const plan = getEffectivePlan(profile);
  const features = getPlanFeatures(profile);
  return {
    profile,
    plan,
    features,
    isLoading: authLoading || loading,
    isPaid: !!user && plan !== "free",
    isLoggedIn: !!user,
    userId: user?.id ?? null,
  };
}
