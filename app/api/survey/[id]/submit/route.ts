/**
 * POST /api/survey/[id]/submit
 *
 * 流程：
 *   1. 驗證 user 登入
 *   2. 撈 survey config（lib/survey/configs.ts）
 *   3. validateAnswers 檢查格式 / required
 *   4. 防重填：unique (user_id, survey_id) 已擋，這裡先 query 給友善錯誤
 *   5. 產 coupon code（若 config.couponReward 設）
 *   6. 寫 survey_responses + survey_coupons（同 transaction 心態，雖無真 atomic）
 *   7. 寄感謝 email 附 coupon code
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getSurvey, validateAnswers, generateCouponCode } from "@/lib/survey/configs";
import { sendEmail } from "@/lib/email/send";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const config = getSurvey(id);
  if (!config) {
    return NextResponse.json({ error: "問卷不存在" }, { status: 404 });
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  let body: { answers: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const validation = validateAnswers(config, body.answers ?? {});
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const svc = getServiceSupabase();

  // 防重填
  const { data: existing } = await svc
    .from("survey_responses")
    .select("coupon_code")
    .eq("user_id", user.id)
    .eq("survey_id", id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadySubmitted: true,
      couponCode: existing.coupon_code,
    });
  }

  // 產 coupon
  let couponCode: string | null = null;
  if (config.couponReward) {
    couponCode = generateCouponCode(config.id);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.couponReward.expiresInDays);
    const { error: couponErr } = await svc.from("survey_coupons").insert({
      code: couponCode,
      survey_id: config.id,
      user_id: user.id,
      discount_percent: config.couponReward.discountPercent,
      expires_at: expiresAt.toISOString(),
    });
    if (couponErr) {
      console.error("[survey] coupon insert failed", couponErr);
      // coupon 沒發成不擋 response 寫入
      couponCode = null;
    }
  }

  /**
   * 🧷 答案大小上限。
   *
   * ⛔ 原本把 `body.answers` 原封寫進 jsonb,**沒有大小也沒有欄位白名單**。
   *    已登入使用者 POST `{answers:{<必填題正常填>, pad:"A".repeat(4000000)}}` → 驗證通過
   *    → 寫入一列約 4MB 的 jsonb。`unique(user_id, survey_id)` 只擋同帳號重複,
   *    多開幾個免費帳號就能持續灌大列。(2026-08-21 稽核發現。)
   *
   * ⚠️ 用序列化後的長度判斷,而不是逐欄位白名單:問卷題目會變,白名單一定會漏更新;
   *    大小上限則跟題目無關,不會過期。32KB 對正常問卷綽綽有餘。
   */
  const ANSWERS_MAX_BYTES = 32 * 1024;
  const answersSize = new TextEncoder().encode(JSON.stringify(body.answers ?? {})).length;
  if (answersSize > ANSWERS_MAX_BYTES) {
    console.warn("[survey/submit] 答案過大,拒收", { userId: user.id, size: answersSize });
    return NextResponse.json({ error: "answers_too_large" }, { status: 413 });
  }

  // 寫 response
  const { error: respErr } = await svc.from("survey_responses").insert({
    user_id: user.id,
    survey_id: config.id,
    answers: body.answers,
    coupon_code: couponCode,
  });
  if (respErr) {
    // ⚠️ 不要把 Postgres 原始訊息回給前端(會洩漏欄位名 / 約束名 / 內部結構)。
    console.error("[survey/submit] 寫入失敗", { userId: user.id, error: respErr.message });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // 寄感謝信（失敗不擋 response，已寫進 DB 算成功）
  if (user.email) {
    const discount = config.couponReward?.discountPercent ?? 0;
    const expireDays = config.couponReward?.expiresInDays ?? 7;
    void sendEmail({
      to: user.email,
      subject: `謝謝你填問卷！你的 ${discount}% off 折扣 code 來了`,
      text: [
        `謝謝你花時間填問卷。`,
        ``,
        `你的專屬折扣 code:${couponCode ?? "(未發放)"}`,
        `折扣:個人版「年付方案」${discount}% off（NT$3,900 → NT$1,950）`,
        `有效期:${expireDays} 天`,
        ``,
        `※ 此 coupon 只能用於「年付」方案，月付不適用。`,
        ``,
        `現在去升級:https://designer.woodenren.com/pricing`,
        ``,
        `木頭仁`,
      ].join("\n"),
      html: `
        <p>謝謝你花時間填問卷。</p>
        <p>你的專屬折扣 code:</p>
        <div style="font-family: monospace; font-size: 28px; font-weight: bold; padding: 16px 24px; background: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px; display: inline-block; margin: 12px 0;">
          ${couponCode ?? "(未發放)"}
        </div>
        <p>折扣:個人版<strong>年付方案</strong> <strong>${discount}% off</strong>（NT$3,900 → <strong>NT$1,950</strong>）<br>有效期:${expireDays} 天</p>
        <p style="color: #92400e; font-size: 13px; background: #fef3c7; padding: 8px 12px; border-radius: 6px;">※ 此 coupon 只能用於「年付」方案，月付不適用。</p>
        <p><a href="https://designer.woodenren.com/pricing" style="display:inline-block; padding: 12px 24px; background: #b45309; color: white; text-decoration: none; border-radius: 8px;">現在去升級 →</a></p>
        <p style="color: #71717a; font-size: 14px;">— 木頭仁</p>
      `,
    }).catch((e) => console.error("[survey] thank-you email failed", e));
  }

  return NextResponse.json({ ok: true, couponCode });
}
