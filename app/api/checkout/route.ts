/**
 * POST /api/checkout
 *   表單欄位: plan (personal|pro|student_personal|student_pro)
 *            period (monthly|yearly)
 *
 * 流程:
 *   1. 確認登入；未登入 303 導到首頁帶 login=required
 *   2. student_* 方案：檢查使用者是 student 或在 whitelist
 *   3. 建立 subscription(row, status=expired 當 pending placeholder)
 *      ＋ ecpay_merchant_trade_no = 我們產的 orderId
 *   4. 組綠界 AioCheckOut 參數 + CheckMacValue
 *   5. 回 auto-submit HTML，瀏覽器 POST 到綠界
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  PLAN_NAME_ZH,
  PLAN_PRICES,
  comparePlanUpgrade,
  getBasePlan,
  getPlanPrice,
  isStudentOnly,
  type BillingPeriod,
  type CheckoutPlan,
} from "@/lib/pricing/plans";
import {
  buildAioParams,
  buildAutoSubmitHtml,
  buildPeriodicParams,
  generateOrderId,
  getAioUrl,
} from "@/lib/ecpay/create-order";
import { assertEcpayConfigured } from "@/lib/ecpay/config";
import { validateCoupon } from "@/lib/coupon/validate";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidPlan(p: string): p is CheckoutPlan {
  return p in PLAN_PRICES;
}
function isValidPeriod(p: string): p is BillingPeriod {
  return p === "monthly" || p === "yearly";
}

export async function POST(req: NextRequest) {
  try {
    assertEcpayConfigured();
  } catch (e) {
    console.error("[checkout] ECPay 未設定", e);
    const fallback = new URL(`/pricing?error=payment_not_configured`, req.url);
    return NextResponse.redirect(fallback, 303);
  }

  const form = await req.formData();
  const plan = String(form.get("plan") ?? "");
  const period = String(form.get("period") ?? "monthly");
  const couponRaw = String(form.get("coupon") ?? "").trim();

  if (!isValidPlan(plan) || !isValidPeriod(period)) {
    return NextResponse.json({ error: "invalid_plan_or_period" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL("/?login=required", req.url);
    return NextResponse.redirect(loginUrl, 303);
  }

  if (isAdminEmail(user.email, getServerAdminEmails())) {
    return NextResponse.json(
      { error: "admin_no_purchase", message: "管理員帳號已享有全部功能,無需購買" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // ──────────────────────────────────────────────────────────────
  // 升級/降級偵測:user 有 active sub 時不能直接買第二份(會被綠界雙扣)
  // ──────────────────────────────────────────────────────────────
  const { data: currentUser } = await admin
    .from("users")
    .select("plan, subscription_status")
    .eq("id", user.id)
    .single();
  const currentPlan = currentUser?.plan as string | null;
  const currentStatus = currentUser?.subscription_status as string | null;
  const hasActivePaidSub =
    currentStatus === "active" &&
    currentPlan &&
    currentPlan !== "free" &&
    currentPlan !== "lifetime"; // lifetime 沒有定期定額,不會雙扣

  const targetBasePlan = getBasePlan(plan);
  const relation = comparePlanUpgrade(currentPlan, targetBasePlan);
  let replacedSubId: string | null = null; // 升級時記下被取代的舊 sub.id,寫進新 sub 給 webhook 退費用

  if (hasActivePaidSub) {
    if (relation === "same") {
      return NextResponse.json(
        {
          error: "already_on_plan",
          message: `你目前已經是${PLAN_NAME_ZH[plan]}訂閱中。若要切換月付 / 年付,請先到「我的訂閱」點取消(本期權限保留到到期日),等本期到期變回免費後再重新購買。`,
        },
        { status: 400 },
      );
    }
    if (relation === "downgrade") {
      return NextResponse.json(
        {
          error: "downgrade_not_supported",
          message: "降級請先到「我的訂閱」點取消(本期權限保留到到期日),等本期到期變回免費後再購買新方案。",
        },
        { status: 400 },
      );
    }
    // relation === "upgrade":只「記錄」舊 sub id 進 replaced_subscription_id,
    // 真正 cancel 舊定期定額延後到 webhook 收到新 sub 付款成功才做。
    //
    // 為什麼:之前在 checkout 立刻 cancel,如果 user 中途關掉綠界刷卡頁,
    // 舊定期定額已被取消但新的沒成立 → 下次帳單日不會自動扣 → user 沒升級成 pro
    // 又少了個人版自動續期。
    //
    // 改成延後 cancel 後:user 中途放棄 = 啥都沒變,個人版下次照樣自動扣。
    // 風險:新 pro 付款成功到 webhook cancel 舊 sub 之間有短暫窗口同時兩個
    // active,但 ECPay 不會在這 5-30 秒內又自動扣老 sub,實務上安全。
    if (relation === "upgrade") {
      const { data: oldSub } = await admin
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (oldSub?.id) {
        replacedSubId = oldSub.id;
        console.log("[checkout/upgrade] marked old sub for deferred-cancel", {
          userId: user.id,
          oldPlan: currentPlan,
          newPlan: targetBasePlan,
          replacedSubId,
        });
      }
    }
  }

  // 學員方案資格驗證
  if (isStudentOnly(plan)) {
    const [{ data: u }, { data: w }] = await Promise.all([
      admin.from("users").select("plan").eq("id", user.id).single(),
      user.email
        ? admin.from("whitelist").select("id").eq("email", user.email).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (u?.plan !== "student" && !w) {
      return NextResponse.json({ error: "student_only" }, { status: 403 });
    }
  }

  const baseAmount = getPlanPrice(plan, period);

  // Coupon 套用（年付限定，月付定期定額無法只折首期）
  let amount = baseAmount;
  let appliedCouponCode: string | null = null;
  if (couponRaw) {
    const couponResult = await validateCoupon({
      admin,
      userId: user.id,
      code: couponRaw,
      period,
      originalAmount: baseAmount,
    });
    if (!couponResult.ok) {
      return NextResponse.json(
        { error: "coupon_invalid", message: couponResult.error },
        { status: 400 },
      );
    }
    amount = couponResult.discountedAmount;
    appliedCouponCode = couponResult.coupon.code;
  }

  const basePlan = getBasePlan(plan);
  const periodLabel = period === "yearly" ? "年付" : "月付";
  const orderId = generateOrderId();
  const couponSuffix = appliedCouponCode ? ` 折扣 ${appliedCouponCode}` : "";
  const itemName = `木頭仁 木作藍圖${PLAN_NAME_ZH[plan]}(${periodLabel})${couponSuffix}`;

  // 預先插入 subscription row 當 placeholder；status=expired，付款成功 webhook 改 active。
  // expected_amount = 預期收款金額（跨 student tier 都正確），webhook 用這個比對防 tampering。
  // replaced_subscription_id = 升級時設,webhook 收到付款成功後會自動退舊版未用部分 prorate
  const { error: subErr } = await admin.from("subscriptions").insert({
    user_id: user.id,
    plan: basePlan,
    status: "expired",
    started_at: new Date().toISOString(),
    expires_at: null,
    ecpay_merchant_trade_no: orderId,
    expected_amount: amount,
    period,
    replaced_subscription_id: replacedSubId,
    coupon_code: appliedCouponCode,
  });
  if (subErr) {
    console.error("[checkout] insert subscription failed", subErr);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // 紀錄 pending payment（webhook 收到 RtnCode=1 後再寫 success 那筆）
  await admin.from("payments").insert({
    user_id: user.id,
    amount,
    status: "pending",
    raw_response: {
      kind: "checkout_initiated",
      orderId,
      plan,
      period,
      itemName,
    } as Record<string, unknown>,
  });

  // 月付走信用卡定期定額（每月自動扣）；年付走一次性付款
  const orderInput = {
    orderId,
    amount,
    itemName,
    description: `${PLAN_NAME_ZH[plan]} ${periodLabel}訂閱`,
    email: user.email ?? undefined,
  };
  const params =
    period === "monthly"
      ? buildPeriodicParams({ ...orderInput, periodAmount: amount })
      : buildAioParams(orderInput);
  const html = buildAutoSubmitHtml(getAioUrl(), params);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
