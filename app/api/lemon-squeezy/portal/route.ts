/**
 * GET /api/lemon-squeezy/portal
 *
 * 反查使用者的 LS subscription，從 LS API 拿 customer_portal URL 後 302 跳轉。
 * 顧客在那邊可以：更新卡 / 取消訂閱 / 看歷史發票。
 *
 * 認證：要 Supabase login user。
 */

import { type NextRequest, NextResponse } from "next/server";
import { lemonSqueezy, LemonSqueezyError } from "@/lib/lemon-squeezy/client";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LemonSubscriptionResponse {
  data: {
    attributes: {
      urls?: {
        update_payment_method?: string;
        customer_portal?: string;
      };
    };
  };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  // 找這個 user 最新的 LS subscription（active 優先）
  const admin = createAdminClient();
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("lemonsqueezy_subscription_id, status")
    .eq("user_id", user.id)
    .eq("payment_provider", "lemonsqueezy")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (subErr || !sub?.lemonsqueezy_subscription_id) {
    return NextResponse.json(
      { error: "No active Lemon Squeezy subscription found" },
      { status: 404 },
    );
  }

  // 從 LS API 拿 portal URL
  try {
    const lsSub = await lemonSqueezy.get<LemonSubscriptionResponse>(
      `/subscriptions/${sub.lemonsqueezy_subscription_id}`,
    );
    const portalUrl =
      lsSub.data.attributes.urls?.customer_portal ??
      lsSub.data.attributes.urls?.update_payment_method;
    if (!portalUrl) {
      return NextResponse.json(
        { error: "LS subscription has no portal URL" },
        { status: 502 },
      );
    }
    return NextResponse.redirect(portalUrl, 303);
  } catch (err) {
    const msg =
      err instanceof LemonSqueezyError
        ? `LS API ${err.status}: ${err.body.slice(0, 200)}`
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("[ls/portal]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
