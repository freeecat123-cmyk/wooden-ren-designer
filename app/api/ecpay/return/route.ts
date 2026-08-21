/**
 * POST /api/ecpay/return
 *   綠界 ReturnURL — server-to-server 付款結果通知（一次性 + 定期定額首期共用）
 *
 * 收到後流程:
 *   1. 驗 CheckMacValue
 *   1.5 SimulatePaid === "1" → 綠界後台按的「模擬付款」,綠界不會撥款,
 *       直接回 1|OK 走人（不給權限、不開發票、不寄信）。見 lib/ecpay/simulated-payment.ts
 *   2. 透過 MerchantTradeNo 撈回 placeholder subscription
 *   3. RtnCode === "1" 視為成功:
 *        - 定期定額（params 含 PeriodType）→ expires_at = now + 31 天，存 gwsr
 *        - 一次性年付 → expires_at = now + 365 天
 *        - users.plan / subscription_status / subscription_expires_at 更新
 *        - payments insert status=success
 *   4. RtnCode !== "1" 視為失敗:
 *        - payments insert status=failed（subscription 維持 expired）
 *   5. 一律回 "1|OK"（200）— 否則綠界會狂重送
 *
 *   月扣定期定額第 2 期以後走 /api/ecpay/periodic-notify
 */
import { type NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCheckMacValue } from "@/lib/ecpay/check-mac-value";
import { ECPAY_HASH_IV, ECPAY_HASH_KEY } from "@/lib/ecpay/config";
import { isSimulatedPayment } from "@/lib/ecpay/simulated-payment";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escape";
import { getServerAdminEmails } from "@/lib/admin";
import { firstPaymentSuccessEmail, unlockSuccessEmail } from "@/lib/email/templates/payment-success";
import { planLabelFromUserPlan } from "@/lib/email/templates/subscription-expiry";
import { issueInvoiceForPayment } from "@/lib/ecpay/issue-invoice-for-payment";
import { voidOrAllowanceAfterRefund } from "@/lib/ecpay/invoice-after-refund";
import { requestRefund } from "@/lib/ecpay/refund";
import { terminateEcpayPeriodic } from "@/lib/ecpay/terminate";
import { calcProrateRefund, inferBillingPeriod } from "@/lib/pricing/prorate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseEcpayDate(s: string | undefined): string | null {
  if (!s) return null;
  // 綠界格式 "yyyy/MM/dd HH:mm:ss"（台北時間）
  const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  // 視為 UTC+8
  return new Date(
    `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`,
  ).toISOString();
}

/**
 * 判斷這筆是定期定額還是一次性付款。
 * 綠界定期定額回呼帶 PeriodType / PeriodAmount 欄位，一次性不會有。
 */
function isPeriodicReturn(params: Record<string, string>): boolean {
  return Boolean(params.PeriodType && params.PeriodAmount);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    params[k] = String(v);
  });

  if (!verifyCheckMacValue(params, ECPAY_HASH_KEY, ECPAY_HASH_IV)) {
    console.error("[ecpay/return] CheckMacValue 驗證失敗", {
      orderId: params.MerchantTradeNo,
    });
    return new Response("0|CheckMacValueInvalid", { status: 200 });
  }

  const orderId = params.MerchantTradeNo;
  const rtnCode = params.RtnCode;
  const tradeNo = params.TradeNo;
  const amount = Number(params.TradeAmt ?? 0);

  // 模擬付款:RtnCode 同樣是 1,但綠界不會撥款 → 一律不出貨。
  // 這一關必須擋在所有 DB 動作前面,因為底下每一條分支都是不可逆的:
  // tool_unlocks 是永久買斷、發票是財政部認得的真號碼。
  //
  // 仍然回 1|OK:綠界後台要收到 1|OK 才會顯示「模擬付款成功」,那正是使用者
  // 按這顆按鈕想確認的事(ReturnURL 通了)。回別的字串會被當失敗並持續重送。
  if (isSimulatedPayment(params)) {
    console.warn("[ecpay/return] 模擬付款(SimulatePaid=1):不出貨、不開發票、不寄信", {
      orderId,
      tradeNo,
      amount,
      rtnCode,
    });
    return new Response("1|OK");
  }

  const admin = createAdminClient();

  // 先嘗試 template / tool unlock 訂單（pending payment 含 raw_response.kind）
  // 兩種一次性買斷共用同一段邏輯,差別只在最後寫入哪張表。找不到再 fallback subscription。
  {
    const { data: pending } = await admin
      .from("payments")
      .select("id, user_id, amount, raw_response, status")
      .in("status", ["pending", "awaiting_payment"])
      .filter("raw_response->>orderId", "eq", orderId)
      .or("raw_response->>kind.eq.template_unlock,raw_response->>kind.eq.tool_unlock")
      .maybeSingle();
    const tplPending = pending;
    if (tplPending) {
      // CheckMacValue 已驗過,MerchantID 等等再驗
      if (params.MerchantID !== process.env.ECPAY_MERCHANT_ID) {
        return new Response("0|MerchantIDInvalid", { status: 200 });
      }
      if (rtnCode !== "1") {
        await admin
          .from("payments")
          .update({
            status: "failed",
            ecpay_trade_no: tradeNo ?? null,
            raw_response: { ...(tplPending.raw_response as object), ecpay: params },
          })
          .eq("id", tplPending.id);
        console.warn("[ecpay/return/template] 付款失敗", { orderId, rtnCode });
        return new Response("1|OK");
      }
      const expectedAmount = tplPending.amount as number;
      if (Number(amount) !== expectedAmount) {
        console.error("[ecpay/return/template] amount mismatch", {
          orderId, got: amount, expected: expectedAmount,
        });
        return new Response("0|AmountMismatch", { status: 200 });
      }
      const rawResp = tplPending.raw_response as Record<string, unknown>;
      const kind = rawResp.kind as string;

      /**
       * 🔴 客戶付了錢,這一步就是「把他買的東西給他」。
       *
       * ⛔ 原本寫成 `if (unlockErr && !...duplicate) console.error(...)` —— **只印一行 log 就往下走**:
       *    payment 照樣標 success、照樣開一張真發票、照樣寄「解鎖成功」信(信裡的按鈕還會把他帶到
       *    他買的那個工具頁),但他打開只會看到付費牆。錢收了、發票開了、東西沒給,
       *    而且**沒有任何地方留下記號**,除非他自己來抱怨,否則永遠不會有人發現。
       *
       * 現在改成:
       *   1. 失敗會重試(最常見的原因是資料庫瞬間抖動,重試就好了)
       *   2. 真的失敗 → 在 payment 上留記號 + 寄信通知管理員 + **不寄那封會騙人的成功信**
       *   3. 但**發票照開、payment 照標 success**:錢是真的收到了,不開票是另一個更麻煩的問題
       *   4. 仍然回 1|OK —— 這個檔開頭就寫明「否則綠界會狂重送」,不推翻既有設計
       *
       * (2026-08-21 稽核發現。查過正式站:3 筆買斷全都有對應解鎖,目前 0 位受害者。)
       */
      const grantUnlock = async (): Promise<{ ok: boolean; detail?: string }> => {
        const table = kind === "template_unlock" ? "template_unlocks" : "tool_unlocks";
        const row =
          kind === "template_unlock"
            ? {
                user_id: tplPending.user_id,
                category: rawResp.category as string,
                paid_amount: expectedAmount,
                ecpay_merchant_trade_no: orderId,
              }
            : {
                user_id: tplPending.user_id,
                tool: rawResp.tool as string,
                paid_amount: expectedAmount,
                ecpay_merchant_trade_no: orderId,
              };
        let last = "";
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { error } = await admin.from(table).insert(row);
          if (!error) return { ok: true };
          // duplicate = 綠界重送、之前那次已經寫進去了,這是成功不是失敗
          if (error.message?.includes("duplicate")) return { ok: true };
          last = error.message ?? String(error);
          console.error(`[ecpay/return/${kind}] 解鎖寫入失敗(第 ${attempt} 次)`, error);
          if (attempt < 3) await new Promise((r) => setTimeout(r, 300 * attempt));
        }
        return { ok: false, detail: last };
      };

      const unlockResult =
        kind === "template_unlock" || kind === "tool_unlock"
          ? await grantUnlock()
          : { ok: true as const };
      await admin
        .from("payments")
        .update({
          status: "success",
          ecpay_trade_no: tradeNo ?? null,
          invoice_status: "pending",
          raw_response: {
            ...(tplPending.raw_response as object),
            ecpay: params,
            // 解鎖沒寫成功時留下記號:admin 後台看得到,日後也查得出來是哪幾筆要補
            ...(unlockResult.ok
              ? {}
              : { _unlock_failed: { at: new Date().toISOString(), detail: unlockResult.detail } }),
          },
        })
        .eq("id", tplPending.id);

      // 背景開發票 + 寄付款成功信（不擋綠界 webhook 回應）
      const invoiceItemName = (rawResp.itemName as string) ?? "木頭仁 木作藍圖 範本買斷";
      const unlockCategory =
        kind === "template_unlock" ? (rawResp.category as string | undefined) : undefined;
      const unlockTool =
        kind === "tool_unlock" ? (rawResp.tool as string | undefined) : undefined;
      const siteBase =
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";
      const toolDestPaths: Record<string, string> = {
        ceiling: "/ceiling",
        floor: "/floor",
        "raised-floor": "/raised-floor",
        cnc: "/cnc",
      };
      const destinationUrl = unlockCategory
        ? `${siteBase}/design/${unlockCategory}`
        : unlockTool && toolDestPaths[unlockTool]
          ? `${siteBase}${toolDestPaths[unlockTool]}`
          : undefined;
      after(async () => {
        // 1. 開發票
        try {
          await issueInvoiceForPayment(admin, {
            paymentId: tplPending.id,
            userId: tplPending.user_id,
            amount: expectedAmount,
            itemName: invoiceItemName,
          });
        } catch (e) {
          console.warn("[ecpay/return:unlock:after] invoice 例外", e);
        }
        // 2. 寄信
        try {
          const { data: u } = await admin
            .from("users")
            .select("email")
            .eq("id", tplPending.user_id)
            .single();

          if (!unlockResult.ok) {
            /**
             * ⛔ 解鎖沒給成功 → **絕不能寄那封「解鎖成功」信**。
             *    那封信裡的按鈕會把客戶帶到他買的工具頁,而他打開只會看到付費牆
             *    ——「錢收了還騙他東西給了」比單純的失敗更傷。改成通知管理員手動補。
             */
            console.error("[ecpay/return:unlock] 解鎖失敗,改通知管理員", {
              orderId,
              userId: tplPending.user_id,
              email: u?.email,
              detail: unlockResult.detail,
            });
            const admins = getServerAdminEmails();
            if (admins.length > 0) {
              const lines = [
                "客戶付款成功,但解鎖沒有寫進資料庫,需要手動補。",
                "",
                `品項:${invoiceItemName}`,
                `金額:NT$${expectedAmount}`,
                `客戶:${u?.email ?? tplPending.user_id}`,
                `訂單編號:${orderId}`,
                `綠界交易編號:${tradeNo ?? "(無)"}`,
                `錯誤訊息:${unlockResult.detail ?? "(無)"}`,
                "",
                "發票已照常開立(錢是真的收到了);客戶尚未收到任何通知信。",
                "補完解鎖後請自行通知客戶。",
              ];
              // ⚠️ sendEmail 的 to 是單一字串(內部再包成陣列),逗號串接會變成一個無效地址,
              //    所以逐一寄。管理員通常只有 1~2 位。
              for (const adminEmail of admins) {
                await sendEmail({
                  to: adminEmail,
                  subject: `🔴 買斷解鎖失敗待手動補:${invoiceItemName}(${orderId})`,
                  text: lines.join("\n"),
                  html: `<pre style="font:14px/1.7 ui-monospace,Menlo,monospace">${escapeHtml(lines.join("\n"))}</pre>`,
                });
              }
            }
          } else if (u?.email) {
            const payload = unlockSuccessEmail({
              itemName: invoiceItemName,
              amount: expectedAmount,
              tradeNo,
              destinationUrl,
            });
            await sendEmail({
              to: u.email,
              subject: payload.subject,
              text: payload.text,
              html: payload.html,
            });
          }
        } catch (e) {
          console.warn("[ecpay/return:unlock:after] success email 例外", e);
        }
      });
      return new Response("1|OK");
    }
  }

  const { data: sub, error: subErr } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, status, expected_amount, period, replaced_subscription_id, coupon_code")
    .eq("ecpay_merchant_trade_no", orderId)
    .single();

  if (subErr || !sub) {
    console.error("[ecpay/return] 找不到 subscription", { orderId, subErr });
    return new Response("1|OK");
  }

  // 已處理過就不重複寫（綠界可能重送）+ idempotency by tradeNo
  // sub.status === active 還會被 sweep cron 改回 expired，replay 又會繞過 → 改用
  // payments.ecpay_trade_no 唯一索引擋（DB 層級 dedup）。先 select 看有沒有。
  if (sub.status === "active") {
    return new Response("1|OK");
  }
  if (tradeNo) {
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("ecpay_trade_no", tradeNo)
      .eq("status", "success")
      .maybeSingle();
    if (existing) {
      console.warn("[ecpay/return] replay attempt blocked", { orderId, tradeNo });
      return new Response("1|OK");
    }
  }
  // 驗 MerchantID 屬於本商家（必要欄位、缺欄位也 reject 避免 short-circuit bypass）
  if (params.MerchantID !== process.env.ECPAY_MERCHANT_ID) {
    console.error("[ecpay/return] MerchantID mismatch or missing", {
      got: params.MerchantID,
      expected: process.env.ECPAY_MERCHANT_ID,
    });
    return new Response("0|MerchantIDInvalid", { status: 200 });
  }

  if (rtnCode !== "1") {
    await admin.from("payments").insert({
      user_id: sub.user_id,
      subscription_id: sub.id,
      amount,
      status: "failed",
      ecpay_trade_no: tradeNo ?? null,
      raw_response: params as Record<string, unknown>,
    });
    console.warn("[ecpay/return] 付款失敗", { orderId, rtnCode, msg: params.RtnMsg });
    return new Response("1|OK");
  }

  // 驗金額：用 checkout 時寫進 sub.expected_amount 直接比對
  // （student tier 走 basePlan 不會被 hardcode price 表卡住）
  // expected_amount 缺值 → reject（舊資料或攻擊）
  if (!sub.expected_amount || Number(amount) !== sub.expected_amount) {
    console.error("[ecpay/return] amount mismatch", {
      orderId,
      got: amount,
      expected: sub.expected_amount,
      plan: sub.plan,
      period: sub.period,
    });
    return new Response("0|AmountMismatch", { status: 200 });
  }

  // 以 checkout 時寫的 sub.period 為準決定到期日 — 不從綠界回呼欄位反推。
  // 為什麼：ReturnURL 對「一次性付款」與「定期定額首期」回的欄位是一樣的
  // （都是普通信用卡欄位，不會帶 PeriodType），所以無法用回呼欄位區分；
  // 第 2 期以後才會走 PeriodReturnURL 帶 PeriodType。
  // 舊版用 isPeriodicReturn 判斷會把每一筆月付首期當成年付給 365 天，平台虧爆。
  //
  // sub.period 缺值 → fallback 用 isPeriodicReturn 為了相容 migration 之前的舊 row
  const periodic =
    sub.period === "monthly" ||
    (!sub.period && isPeriodicReturn(params));
  const days = periodic ? 31 : 365;
  const now = new Date();

  /**
   * 🧷 新到期日的**起算點**:如果他手上還有沒用完的權限,要從那天接續,不是從今天重算。
   *
   * ⛔ 原本一律 `now + days`。實際會發生的事:
   *   年繳個人版 3/1 付款(權限到隔年 3/1)→ 6/1 按「取消訂閱」。
   *   取消只把狀態改成 cancelled、**到期日原封不動**,而 permissions.ts 的
   *   ENTITLED_SUB_STATUSES 包含 'cancelled' → 他到隔年 3/1 前都還有權限,這是設計。
   *   6/15 他改變心意再買一次 → 到期日被寫成「今天 + 365 天」,
   *   **中間那 9 個月已經付過錢的權限直接蒸發**。
   *
   * ⚠️ 為什麼 checkout 沒擋下來:`hasActivePaidSub` 的條件是
   *    `currentStatus === "active"`,而取消後 users.subscription_status 是 'cancelled'
   *    → 這個判斷是 false → 「已經是同方案」的擋門與升級退款那條路**整段都不會執行**。
   *
   * ⚠️ 不可以跟升級退款重複補償:`replaced_subscription_id` 有值 = 走升級流程,
   *    webhook 會對舊訂閱按比例**退錢**給他(見 refundOldSubProrate)。
   *    那種情況已經用錢補過了,再送時間就是補兩次。
   */
  const { data: profileBefore } = await admin
    .from("users")
    .select("plan, subscription_status, subscription_expires_at")
    .eq("id", sub.user_id)
    .single();

  let baseTime = now.getTime();
  if (!sub.replaced_subscription_id && profileBefore) {
    const stillEntitled =
      (profileBefore.subscription_status === "active" ||
        profileBefore.subscription_status === "cancelled") &&
      profileBefore.subscription_expires_at != null &&
      new Date(profileBefore.subscription_expires_at).getTime() > now.getTime();
    // 只在「買的是他現在持有的同一個方案」時接續:同級距 = 同價值,單純延續。
    // 跨方案(例如取消個人版後改買專業版)接續等於免費送高階天數,那是另一個決定,先不動。
    const samePlan = profileBefore.plan === sub.plan;
    if (stillEntitled && samePlan) {
      baseTime = new Date(profileBefore.subscription_expires_at as string).getTime();
      console.log("[ecpay/return] 接續既有到期日,不從今天重算", {
        userId: sub.user_id,
        from: profileBefore.subscription_expires_at,
        addDays: days,
      });
    } else if (stillEntitled && !samePlan) {
      console.warn("[ecpay/return] 跨方案重新訂閱,既有未用天數未接續(需人工判斷是否補償)", {
        userId: sub.user_id,
        heldPlan: profileBefore.plan,
        newPlan: sub.plan,
        heldUntil: profileBefore.subscription_expires_at,
      });
    }
  }
  const expiresAt = new Date(baseTime + days * 86_400_000).toISOString();
  const paymentDate = parseEcpayDate(params.PaymentDate) ?? now.toISOString();

  const { error: upSubErr } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt,
      ecpay_periodic_no: periodic ? params.gwsr ?? null : null,
    })
    .eq("id", sub.id);
  if (upSubErr) console.error("[ecpay/return] 更新 subscription 失敗", upSubErr);

  const { error: upUserErr } = await admin
    .from("users")
    .update({
      plan: sub.plan,
      subscription_status: "active",
      subscription_expires_at: expiresAt,
    })
    .eq("id", sub.user_id);
  if (upUserErr) console.error("[ecpay/return] 更新 users 失敗", upUserErr);

  // Coupon 標 used（如果 sub 用了 coupon）
  if (sub.coupon_code) {
    const { error: couponErr } = await admin
      .from("survey_coupons")
      .update({ used: true, used_at: now.toISOString() })
      .eq("code", sub.coupon_code)
      .eq("used", false);
    if (couponErr) {
      console.error("[ecpay/return] 標 coupon used 失敗", { code: sub.coupon_code, error: couponErr });
    }
  }

  // ATM/超商先前可能已由 /payment-info 寫過一筆 awaiting_payment row（同 ecpay_trade_no）。
  // 有就 update 成 success，沒有（信用卡/LINE Pay 等同步付款）就 insert。
  let insertedPayment: { id: string } | null = null;
  const { data: existingRow } = tradeNo
    ? await admin
        .from("payments")
        .select("id, status")
        .eq("ecpay_trade_no", tradeNo)
        .maybeSingle()
    : { data: null };

  if (existingRow?.status === "awaiting_payment") {
    const { data: updated } = await admin
      .from("payments")
      .update({
        status: "success",
        ecpay_payment_date: paymentDate,
        raw_response: params as Record<string, unknown>,
        invoice_status: "pending",
      })
      .eq("id", existingRow.id)
      .select("id")
      .single();
    insertedPayment = updated ?? null;
  } else if (!existingRow) {
    const { data: inserted } = await admin
      .from("payments")
      .insert({
        user_id: sub.user_id,
        subscription_id: sub.id,
        amount,
        status: "success",
        ecpay_trade_no: tradeNo,
        ecpay_payment_date: paymentDate,
        raw_response: params as Record<string, unknown>,
        invoice_status: "pending",
      })
      .select("id")
      .single();
    insertedPayment = inserted ?? null;
  }
  // existingRow.status 已是 success → replay，insertedPayment 維持 null，
  // 下方 after() 會因 !insertedPayment?.id 自動跳過後處理。

  console.log("[ecpay/return] 付款完成,核心 DB 更新已收尾,背景跑後處理", {
    orderId,
    userId: sub.user_id,
    amount,
    expiresAt,
  });

  // ──────────────────────────────────────────────
  // 背景任務:invoice / refund / email
  // Hobby plan 10s timeout 不夠串著跑 3 個外部 API,改用 Next.js after() 在
  // response 送出後背景跑,Vercel 仍會等到任務完成才釋放 function 容器。
  //
  // Idempotency anchor:整段以 `insertedPayment?.id` 為閘——payments.ecpay_trade_no
  // 有 UNIQUE 索引,並發兩個 webhook 只有一個 insert 成功,另一個拿到 null。
  // 用這個當錨點 invoice / refund / email 都只跑一次。
  // ──────────────────────────────────────────────
  after(async () => {
    if (!insertedPayment?.id) {
      // race: 另一個並發 webhook 已 insert 過 payment,本次只是 ECPay 重送
      console.log("[ecpay/return:after] payment 已存在,跳過後處理", { orderId, tradeNo });
      return;
    }
    try {
      // 1. 開立綠界 B2C 電子發票
      try {
        await issueInvoiceForPayment(admin, {
          paymentId: insertedPayment.id,
          userId: sub.user_id,
          amount,
          itemName: `木頭仁 木作藍圖${planLabelFromUserPlan(sub.plan)}${periodic ? "月付" : "年付"}訂閱`,
        });
      } catch (e) {
        console.warn("[ecpay/return:after] invoice 例外(已記錄 failed)", e);
      }

      // 2. 升級流程後處理:cancel 舊定期定額 + 退舊版 prorate
      //    cancel 延後到這裡才做(以前在 checkout 立刻取消,user 中途放棄會卡住沒新方案
      //    又沒舊方案自動續)。現在 user 中途放棄 = 啥都沒變,個人版下次照樣自動扣。
      let upgradeRefundAmount = 0;
      if (sub.replaced_subscription_id) {
        await cancelOldEcpayPeriodic(admin, sub.replaced_subscription_id);
        upgradeRefundAmount = await handleUpgradeRefund(admin, sub.replaced_subscription_id, sub.id);
      }

      // 2.5 防禦性掃描:同 user 還有其他 active sub(歷史漏網、checkout 只取最新一筆
      //     當 replaced_subscription_id 的邊角 case)→ 一筆筆 terminate + 標 cancelled
      try {
        await sweepOtherActiveSubs(admin, sub.user_id, sub.id);
      } catch (e) {
        console.error("[ecpay/return:after] sweepOtherActiveSubs 例外", e);
      }

      // 3. 寄首次付款成功 email
      try {
        const { data: u } = await admin
          .from("users")
          .select("email")
          .eq("id", sub.user_id)
          .single();
        if (u?.email) {
          const payload = firstPaymentSuccessEmail({
            planLabel: planLabelFromUserPlan(sub.plan),
            amount,
            expiresAt,
            isMonthly: periodic,
            tradeNo,
            upgradeRefundAmount: upgradeRefundAmount > 0 ? upgradeRefundAmount : undefined,
          });
          await sendEmail({
            to: u.email,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
          });
        }
      } catch (e) {
        console.warn("[ecpay/return:after] payment email error", e);
      }

      console.log("[ecpay/return:after] 後處理完成", { orderId, upgradeRefundAmount });
    } catch (e) {
      // after() 整段 catch fallback,任何 unexpected throw 都不影響已回的 1|OK
      console.error("[ecpay/return:after] 例外(已回 1|OK 給綠界)", e);
    }
  });

  return new Response("1|OK");
}

/**
 * 升級時退舊版 prorate。
 * 撈舊 sub + 最近一筆 success payment,計算未使用比例,呼叫 ECPay AioChargeback。
 * 失敗只 log 不擋 webhook (新 sub 已啟用,退款失敗 admin 手動處理即可)。
 * 回傳實際退款金額,0 = 沒退/失敗。
 */
async function handleUpgradeRefund(
  admin: ReturnType<typeof createAdminClient>,
  oldSubId: string,
  newSubId: string,
): Promise<number> {
  try {
    const { data: oldSub } = await admin
      .from("subscriptions")
      .select("id, period, started_at, expires_at, ecpay_merchant_trade_no")
      .eq("id", oldSubId)
      .single();
    if (!oldSub?.ecpay_merchant_trade_no) {
      console.warn("[ecpay/return/upgrade-refund] old sub 找不到 merchant_trade_no", { oldSubId });
      return 0;
    }

    // 撈 success 或 refunded 狀態的 payment——refunded 也要撈到,才能判斷是否已退過
    // 避免並發 webhook 跑進來重複退款(雙退)。
    const { data: oldPayment } = await admin
      .from("payments")
      .select("id, amount, ecpay_trade_no, invoice_number, invoice_issued_at, status, user_id")
      .eq("subscription_id", oldSubId)
      .in("status", ["success", "refunded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!oldPayment?.ecpay_trade_no) {
      console.warn("[ecpay/return/upgrade-refund] 舊 sub 沒 success payment 可退", { oldSubId });
      return 0;
    }
    if (oldPayment.status === "refunded") {
      console.log("[ecpay/return/upgrade-refund] 舊 payment 已退過,跳過(防雙退)", {
        oldSubId,
        oldPaymentId: oldPayment.id,
      });
      return 0;
    }

    const refund = calcProrateRefund({
      paidAmount: Number(oldPayment.amount ?? 0),
      // ⛔ 原本是 `?? "monthly"`:`period` 欄位 2026-05-19 才加,那天以前的**年繳**戶是 NULL,
      //    被當成月繳會用 31 天當基準 → 算出來超過已付金額 → 夾成**全額退款**。
      //    改成從 started_at → expires_at 的實際天數推回來(見 lib/pricing/prorate.ts)。
      period: inferBillingPeriod(oldSub),
      expiresAt: oldSub.expires_at,
    });
    if (refund.refundAmount <= 0) {
      console.log("[ecpay/return/upgrade-refund] 沒未用天數,不退", { oldSubId, refund });
      return 0;
    }

    const result = await requestRefund({
      merchantTradeNo: oldSub.ecpay_merchant_trade_no,
      tradeNo: oldPayment.ecpay_trade_no,
      amount: refund.refundAmount,
    });
    if (!result.ok) {
      console.error("[ecpay/return/upgrade-refund] AioChargeback 失敗", { oldSubId, refund, result });
      return 0;
    }

    // 退款成功 → 處理發票:24h 內作廢、超過 24h 走折讓 Allowance。
    //   為什麼一定要處理:已退款但發票還有效 = 財政部看你開了發票卻沒收錢,差額會被當逃漏稅
    //   失敗只 log,不擋退款流程(發票事後 admin 可手動補作廢/補折讓)
    if (oldPayment.invoice_number && oldPayment.invoice_issued_at) {
      const { data: u } = await admin
        .from("users")
        .select("email")
        .eq("id", oldPayment.user_id)
        .maybeSingle();
      const r = await voidOrAllowanceAfterRefund(admin, {
        paymentId: oldPayment.id,
        invoiceNumber: oldPayment.invoice_number,
        invoiceIssuedAt: oldPayment.invoice_issued_at,
        refundAmount: refund.refundAmount,
        notifyEmail: u?.email ?? undefined,
        invalidReason: "升級自動退款作廢",
      });
      console.log("[ecpay/return/upgrade-refund] 發票處理結果", {
        invoiceNumber: oldPayment.invoice_number,
        mode: r.mode,
        ok: r.ok,
        ageHours: r.ageHours.toFixed(2),
        allowanceNumber: r.allowanceNumber,
        rtnMsg: r.rtnMsg,
      });
    }

    // 標記退款狀態
    await admin
      .from("payments")
      .update({ status: "refunded" })
      .eq("id", oldPayment.id);

    console.log("[ecpay/return/upgrade-refund] 升級自動退款成功", {
      oldSubId,
      newSubId,
      refundAmount: refund.refundAmount,
      remainingDays: refund.remainingDays,
    });
    return refund.refundAmount;
  } catch (e) {
    console.error("[ecpay/return/upgrade-refund] 例外", e);
    return 0;
  }
}

/**
 * 升級時取消舊定期定額。
 * 在 webhook 成功才呼叫,避免 user 中途關掉刷卡頁卻已被取消舊訂閱的情況。
 * 失敗只 log 不擋 webhook(新 sub 已啟用,雙扣風險低;真的雙扣 admin 手動處理)。
 */
async function cancelOldEcpayPeriodic(
  admin: ReturnType<typeof createAdminClient>,
  oldSubId: string,
): Promise<void> {
  try {
    const { data: oldSub } = await admin
      .from("subscriptions")
      .select("id, ecpay_merchant_trade_no, status")
      .eq("id", oldSubId)
      .single();
    if (!oldSub?.ecpay_merchant_trade_no) {
      console.warn("[ecpay/return/cancel-old] 舊 sub 沒 merchant_trade_no", { oldSubId });
      return;
    }
    if (oldSub.status === "cancelled" || oldSub.status === "expired") {
      // 已是取消/過期狀態,綠界端應該也沒在跑了,skip
      return;
    }
    const result = await terminateEcpayPeriodic(oldSub.ecpay_merchant_trade_no);
    if (!result.ok) {
      const benign =
        result.rtnCode &&
        (result.rtnMsg?.includes("不存在") || result.rtnMsg?.includes("已終止"));
      if (!benign) {
        console.error("[ecpay/return/cancel-old] terminate 失敗(雙扣風險!)", {
          oldSubId,
          result,
        });
        return;
      }
    }
    await admin.from("subscriptions").update({ status: "cancelled" }).eq("id", oldSubId);
    console.log("[ecpay/return/cancel-old] 舊 sub terminate + DB cancelled", { oldSubId });
  } catch (e) {
    console.error("[ecpay/return/cancel-old] 例外", e);
  }
}

/**
 * 防禦性掃描:除了 replaced_subscription_id 指定的舊 sub 外,如果同 user 還有
 * 其他 active sub(歷史漏網、checkout 只取最新一筆當 replaced 的邊角 case),
 * 逐筆 terminate ECPay + 標 cancelled。
 *
 * 失敗只 log 不擋 webhook(新 sub 已啟用,sweep 失敗 admin 可後續手動處理)。
 */
async function sweepOtherActiveSubs(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  newSubId: string,
): Promise<void> {
  const { data: others, error } = await admin
    .from("subscriptions")
    .select("id, ecpay_merchant_trade_no")
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("id", newSubId);
  if (error) {
    console.error("[ecpay/return/sweep] 撈其他 active 失敗", error);
    return;
  }
  if (!others || others.length === 0) return;

  console.warn("[ecpay/return/sweep] 發現其他 active sub(歷史漏網),清理中", {
    userId,
    count: others.length,
    ids: others.map((o) => o.id),
  });

  for (const old of others) {
    if (old.ecpay_merchant_trade_no) {
      const r = await terminateEcpayPeriodic(old.ecpay_merchant_trade_no);
      if (!r.ok) {
        const benign =
          r.rtnMsg?.includes("不存在") || r.rtnMsg?.includes("已終止");
        if (!benign) {
          console.error("[ecpay/return/sweep] terminate 失敗", {
            subId: old.id,
            r,
          });
          // 即使 terminate 失敗仍標 DB cancelled,避免下次 sweep 又掃到
        }
      }
    }
    await admin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", old.id);
  }
}
