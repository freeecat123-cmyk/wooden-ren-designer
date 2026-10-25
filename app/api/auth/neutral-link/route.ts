/**
 * 中性網域（Furniture Blueprints）的 email 登入／註冊連結 —— 由網站自己寄，不走 Supabase 內建寄信。
 *
 * 為什麼：Supabase Auth 的信件模板全站共用（中文、署名木頭仁、寄件人 noreply@woodenren.com），
 * 中文站還在用不能改。中性網域改成：
 *   1. service role 呼叫 auth.admin.generateLink({ type: "magiclink" })
 *      —— 使用者不存在時 Supabase 會自動建立帳號並回 verification_type = "signup"
 *         （實測 2026-10-25），等同主站 signInWithOtp 預設 shouldCreateUser: true 的行為。
 *   2. 拿 hashed_token 自己組連結 → /auth/callback?token_hash=...&type=...&next=...
 *      （callback 用 verifyOtp 換 session；不用 action_link，因為那條走 implicit flow
 *        把 token 放在 #hash，server 端 callback 讀不到。）
 *   3. 用 Gmail SMTP（furnitureblueprints@gmail.com）寄英文信。
 *
 * ⛔ 只在中性網域運作，其他 Host 一律 404（主站的登入完全不經過這裡）。
 */
import { NextResponse } from "next/server";
import { brandFromHeaders } from "@/lib/brand-hosts";
import { getClientIp } from "@/lib/api/ip-rate-limit";
import {
  buildCallbackLink,
  checkNeutralLinkRateLimit,
  isOtpLinkType,
  linkOrigin,
  normalizeEmail,
} from "@/lib/auth/neutral-link";
import { getServiceSupabase } from "@/lib/supabase/service";
import { neutralSmtpConfigured, sendNeutralEmail } from "@/lib/email/neutral-smtp";
import { neutralSignInEmail } from "@/lib/email/templates/neutral-sign-in";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (brandFromHeaders(req.headers) !== "neutral") {
    return new NextResponse("Not Found", { status: 404 });
  }

  let body: { email?: unknown; next?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const next = typeof body.next === "string" ? body.next : null;

  if (!neutralSmtpConfigured()) {
    // 沒設 SMTP 就別先在 Supabase 產連結（產了也寄不出去）
    console.error("[neutral-link] NEUTRAL_SMTP_USER / NEUTRAL_SMTP_PASS 未設");
    return NextResponse.json({ error: "email_disabled" }, { status: 503 });
  }

  if (!(await checkNeutralLinkRateLimit(getClientIp(req), email))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { data, error } = await getServiceSupabase().auth.admin.generateLink({ type: "magiclink", email });
  const props = data?.properties;
  if (error || !props?.hashed_token || !isOtpLinkType(props.verification_type)) {
    console.error("[neutral-link] generateLink 失敗", { msg: error?.message, status: error?.status });
    const status = error?.status && error.status >= 400 && error.status < 500 ? 400 : 502;
    return NextResponse.json({ error: "link_failed" }, { status });
  }
  console.log("[neutral-link] generateLink ok", { type: props.verification_type });

  const link = buildCallbackLink(
    linkOrigin(req.url, req.headers.get("host")),
    props.hashed_token,
    props.verification_type,
    next,
  );
  const mail = neutralSignInEmail({ link, isNewUser: props.verification_type === "signup" });
  const sent = await sendNeutralEmail({ to: email, ...mail });
  if (!sent.ok) return NextResponse.json({ error: "send_failed" }, { status: 502 });

  return NextResponse.json({ ok: true });
}
