/**
 * POST /api/coupon/validate
 *   { code, plan, period } → 即時驗證 + 預覽折扣
 *
 * 給 /pricing UI 用：user 輸入 coupon 後即時顯示「半價、省 NT$XXX」。
 * 真正套用折扣在 /api/checkout 那邊再 validate 一次（避免 client 改 amount）。
 */
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPlanPrice, PLAN_PRICES, type CheckoutPlan, type BillingPeriod } from "@/lib/pricing/plans";
import { validateCoupon } from "@/lib/coupon/validate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }

  let body: { code?: string; plan?: string; period?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const code = body.code ?? "";
  const plan = body.plan ?? "";
  const period = body.period ?? "";

  if (!(plan in PLAN_PRICES)) {
    return NextResponse.json({ ok: false, error: "未知方案" }, { status: 400 });
  }
  if (period !== "monthly" && period !== "yearly") {
    return NextResponse.json({ ok: false, error: "未知計費週期" }, { status: 400 });
  }

  const amount = getPlanPrice(plan as CheckoutPlan, period as BillingPeriod);
  const admin = createAdminClient();
  const result = await validateCoupon({
    admin,
    userId: user.id,
    code,
    period: period as BillingPeriod,
    originalAmount: amount,
  });
  return NextResponse.json(result);
}
