/**
 * POST /api/ecpay/periodic-notify
 *   綠界 PeriodReturnURL — 信用卡定期定額「第 2 期以後」自動扣款通知。
 *
 * 首期扣款結果走 /api/ecpay/return（同 ReturnURL）。
 *
 * 收到後流程:
 *   1. 驗 CheckMacValue
 *   2. 透過 MerchantTradeNo 撈回 subscription
 *   3. RtnCode === "1" 視為成功:
 *        - subscriptions.expires_at += 31 天
 *        - users.subscription_expires_at 同步
 *        - payments insert status=success（這期金額）
 *   4. RtnCode !== "1" 視為失敗:
 *        - payments insert status=failed
 *        - 若 TotalSuccessTimes 已達上限 or 綠界主動停 → status=expired
 *   5. 一律回 "1|OK"
 */
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCheckMacValue } from "@/lib/ecpay/check-mac-value";
import { ECPAY_HASH_IV, ECPAY_HASH_KEY } from "@/lib/ecpay/config";
import { isSimulatedPayment, isAdminSimulation } from "@/lib/ecpay/simulated-payment";
import { after } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { periodicChargeSuccessEmail } from "@/lib/email/templates/payment-success";
import { planLabelFromUserPlan } from "@/lib/email/templates/subscription-expiry";
import { issueInvoiceForPayment } from "@/lib/ecpay/issue-invoice-for-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseEcpayDate(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return new Date(
    `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`,
  ).toISOString();
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = String(v);
  });

  if (!verifyCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV)) {
    console.error("[ecpay/periodic-notify] CheckMacValue 驗證失敗", {
      orderId: params.MerchantTradeNo,
    });
    return new Response("0|CheckMacValueInvalid", { status: 200 });
  }

  const orderId = params.MerchantTradeNo;
  const rtnCode = params.RtnCode;
  const tradeNo = params.TradeNo ?? params.gwsr ?? null;
  const amount = Number(params.amount ?? params.TradeAmt ?? 0);
  const totalSuccessTimes = Number(params.TotalSuccessTimes ?? 0);

  // 同 /api/ecpay/return:模擬付款不撥款,不能延期也不能開發票。
  // 這裡沒有實測過綠界的定期定額通知會不會帶 SimulatePaid,擋著是防禦性的——
  // 沒帶這個欄位時這段完全不影響原有流程(admin 的 simulate-periodic 也不帶,照舊能用)。
  if (isSimulatedPayment(params)) {
    console.warn("[ecpay/periodic-notify] 模擬付款(SimulatePaid=1):不續期、不開發票、不寄信", {
      orderId,
      tradeNo,
      amount,
      rtnCode,
    });
    return new Response("1|OK");
  }

  const admin = createAdminClient();
  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, status, expires_at, expected_amount")
    .eq("ecpay_merchant_trade_no", orderId)
    .single();

  if (subErr || !sub) {
    console.error("[ecpay/periodic-notify] 找不到 subscription", {
      orderId,
      subErr,
    });
    return new Response("1|OK");
  }

  // 訂閱已 cancelled → 不要反 active（避免「取消後綠界仍扣款」被自動續扣）
  // 仍記一筆 payment 供退款追蹤、但不延長 users.subscription_status
  if (sub.status === "cancelled") {
    console.warn("[ecpay/periodic-notify] 已取消的訂閱仍收到扣款通知，記錄但不續期", {
      orderId,
      userId: sub.user_id,
      amount,
    });
    if (rtnCode === "1") {
      await admin.from("payments").insert({
        user_id: sub.user_id,
        subscription_id: sub.id,
        amount,
        status: "success",
        ecpay_trade_no: tradeNo,
        raw_response: { ...params, _note: "post_cancel_charge" } as Record<
          string,
          unknown
        >,
      });
    }
    return new Response("1|OK");
  }

  // 驗 MerchantID 屬於本商家（必要欄位、缺欄位也 reject 避免 short-circuit bypass）
  if (params.MerchantID !== process.env.ECPAY_MERCHANT_ID) {
    console.error("[ecpay/periodic-notify] MerchantID mismatch or missing", {
      got: params.MerchantID,
      expected: process.env.ECPAY_MERCHANT_ID,
    });
    return new Response("0|MerchantIDInvalid", { status: 200 });
  }

  // idempotency: 同 trade_no 已經成功處理過 → skip（webhook replay 防護）
  if (rtnCode === "1" && tradeNo) {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("ecpay_trade_no", tradeNo)
      .eq("status", "success")
      .maybeSingle();
    if (existing) {
      console.warn("[ecpay/periodic-notify] replay attempt blocked", {
        orderId,
        tradeNo,
      });
      return new Response("1|OK");
    }
  }

  // 驗金額：用 checkout 時寫進 sub.expected_amount 直接比對
  // （student tier 走 basePlan 不會被 hardcode price 表卡住）
  if (rtnCode === "1") {
    if (!sub.expected_amount || Number(amount) !== sub.expected_amount) {
      console.error("[ecpay/periodic-notify] amount mismatch", {
        orderId,
        got: amount,
        expected: sub.expected_amount,
        plan: sub.plan,
      });
      return new Response("0|AmountMismatch", { status: 200 });
    }
  }

  // 失敗：記一筆 failed payment；若綠界明確標 cancel/stop 把 subscription 改 expired
  if (rtnCode !== "1") {
    await admin.from("payments").insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount,
      status: "failed",
      ecpay_trade_no: tradeNo,
      raw_response: params as Record<string, unknown>,
    });

    // RtnCode 10100073/10100248 等代表綠界停止扣款；保險起見只要不是 1 都記錄
    console.warn("[ecpay/periodic-notify] 月扣失敗", {
      orderId,
      rtnCode,
      msg: params.RtnMsg,
      totalSuccessTimes,
    });
    return new Response("1|OK");
  }

  // Race condition 防護：先 INSERT payment（UNIQUE on ecpay_trade_no 擋並發 dup）
  // 只有 insert 成功才延長 subscription，避免兩個並發 webhook 各讀 expires_at
  // 各自 +31d update（最後贏的 update value 一樣）但實際只應扣一次。
  /**
   * ⚠️ admin 後台「模擬月扣」打進來的:DB 照跑(那正是要測的),
   *    但**絕不可以開發票或寄信** —— 那是一筆不存在的錢。
   *    只有通過上面的 CheckMacValue 驗簽才會走到這裡,所以這個旗標是可信的。
   */
  const adminSim = isAdminSimulation(params);

  const paymentDate = parseEcpayDate(params.process_date) ?? new Date().toISOString();
  const { data: insertedPayment, error: payInsErr } = await admin
    .from("payments")
    .insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount,
      status: "success",
      ecpay_trade_no: tradeNo,
      ecpay_payment_date: paymentDate,
      raw_response: (adminSim
        ? { ...params, _admin_simulation: true }
        : params) as Record<string, unknown>,
      /**
       * 模擬扣款不開票 → 用 NULL,不是自創狀態字串。
       * ⚠️ `invoice_status` 有 CHECK 限制(pending/issued/failed/invalid/allowanced,
       *    見 migrations/20260519_invoice_integration.sql:22)。塞不在清單裡的值會讓
       *    **整筆 insert 失敗**,而 supabase-js 不會 throw、只回 error 物件 → route 會把它
       *    當成「重送」直接 return,模擬工具反而完全不動。這正是
       *    migrations/20260519_payments_refunded_status.sql 開頭記載過的同一個坑。
       * NULL 也不會被補開票的流程撈到:那支的條件是 invoice_status in ('pending','failed')。
       */
      invoice_status: adminSim ? null : "pending",
    })
    .select("id")
    .single();

  if (payInsErr) {
    // UNIQUE 衝突 = 重送、已處理過 → return OK 不延期
    console.warn("[ecpay/periodic-notify] payment insert blocked（可能 replay）", {
      orderId,
      tradeNo,
      error: payInsErr.message,
    });
    return new Response("1|OK");
  }

  // 成功：延長 31 天（從現有到期日 + 31 天，不從 now，保證連續性）
  const baseDate = sub.expires_at
    ? new Date(sub.expires_at).getTime()
    : Date.now();
  const newExpiresAt = new Date(baseDate + 31 * 86_400_000).toISOString();

  /**
   * ⚠️ 續扣成功 = 這個人現在是**付費中**，三個地方都要一起還原，少一個就對不起來。
   *
   * 原本只寫了 expires_at 與 subscription_status，**沒有寫回 users.plan**。
   * 實際會發生的事（2026-08-21 稽核，四個環節都逐一驗過）：
   *   1. 第 2 期扣款失敗 → expires_at 停住
   *   2. 寬限期過後 /api/cron/subscription-sweep:58-64 把 users.plan 改成 'free'
   *   3. 第 3 期扣款**成功**，錢真的入帳 → 這裡只補 status 與到期日，plan 仍是 'free'
   *   4. lib/permissions.ts:179 的 getEffectivePlan 最後一行 `return profile.plan`
   *      → 回 'free'，整站功能鎖住
   * 客戶付了錢、收到「扣款成功」信、拿到發票，打開網站什麼都不能用。
   * 而且 sweep 的查詢帶 `.not("plan","in","(free,lifetime)")`，之後**再也不會撈到他**，
   * 狀態永久卡死，只能人工處理。
   *
   * 同理 subscriptions.status 也要從 'expired' 還原成 'active'：對帳工具只掃 status='active'，
   * 不還原的話這筆持續扣款中的訂閱會從對帳範圍裡消失。
   *
   * ⚠️ 不影響已取消的訂閱：status === "cancelled" 在上面第 92 行就 return 了，走不到這裡。
   */
  const { error: upSubErr } = await admin
    .from("subscriptions")
    .update({ expires_at: newExpiresAt, status: "active" })
    .eq("id", sub.id);
  if (upSubErr) console.error("[ecpay/periodic-notify] 更新 subscription 失敗", upSubErr);

  const { error: upUserErr } = await admin
    .from("users")
    .update({
      plan: sub.plan,
      subscription_status: "active",
      subscription_expires_at: newExpiresAt,
    })
    .eq("id", sub.user_id);
  if (upUserErr) console.error("[ecpay/periodic-notify] 更新 users 失敗", upUserErr);

  console.log("[ecpay/periodic-notify] 月扣成功(核心 DB 完成,背景跑後處理)", {
    orderId,
    times: totalSuccessTimes,
    amount,
    newExpiresAt,
  });

  // Hobby plan 10s timeout 不夠串著跑 invoice + email,改 after() 背景
  after(async () => {
    try {
      if (adminSim) {
        console.log("[ecpay/periodic-notify:after] admin 模擬扣款:跳過發票與通知信", {
          orderId,
          paymentId: insertedPayment?.id,
        });
        return;
      }
      // 1. 開立月扣這期 B2C 發票
      if (insertedPayment?.id) {
        try {
          await issueInvoiceForPayment(admin, {
            paymentId: insertedPayment.id,
            userId: sub.user_id,
            amount,
            itemName: `木頭仁 木作藍圖${planLabelFromUserPlan(sub.plan)}月付訂閱(第 ${totalSuccessTimes} 期)`,
          });
        } catch (e) {
          console.warn("[ecpay/periodic-notify:after] invoice 例外", e);
        }
      }
      // 2. 寄月扣扣款成功 email
      try {
        const { data: u } = await admin
          .from("users")
          .select("email")
          .eq("id", sub.user_id)
          .single();
        if (u?.email) {
          const payload = periodicChargeSuccessEmail({
            planLabel: planLabelFromUserPlan(sub.plan),
            amount,
            expiresAt: newExpiresAt,
            isMonthly: true,
            tradeNo,
          });
          await sendEmail({
            to: u.email,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
          });
        }
      } catch (e) {
        console.warn("[ecpay/periodic-notify:after] payment email error", e);
      }
      console.log("[ecpay/periodic-notify:after] 後處理完成", { orderId });
    } catch (e) {
      console.error("[ecpay/periodic-notify:after] 例外(已回 1|OK)", e);
    }
  });

  return new Response("1|OK");
}
