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

  // 寫 response
  const { error: respErr } = await svc.from("survey_responses").insert({
    user_id: user.id,
    survey_id: config.id,
    answers: body.answers,
    coupon_code: couponCode,
  });
  if (respErr) {
    return NextResponse.json({ error: respErr.message }, { status: 500 });
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
        `折扣:個人版第一個月 ${discount}% off`,
        `有效期:${expireDays} 天`,
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
        <p>折扣:個人版第一個月 <strong>${discount}% off</strong><br>有效期:${expireDays} 天</p>
        <p><a href="https://designer.woodenren.com/pricing" style="display:inline-block; padding: 12px 24px; background: #b45309; color: white; text-decoration: none; border-radius: 8px;">現在去升級 →</a></p>
        <p style="color: #71717a; font-size: 14px;">— 木頭仁</p>
      `,
    }).catch((e) => console.error("[survey] thank-you email failed", e));
  }

  return NextResponse.json({ ok: true, couponCode });
}
