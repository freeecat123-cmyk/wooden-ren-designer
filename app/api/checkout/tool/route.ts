/**
 * POST /api/checkout/tool
 *   表單欄位: tool (ceiling | floor)
 *
 * 同 /api/checkout/template 模式,差別:
 *   - 標的是工具不是範本
 *   - 寫進 payments.raw_response.kind = "tool_unlock"
 *   - webhook 收到後 insert tool_unlocks
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  buildAioParams,
  buildAutoSubmitHtml,
  generateOrderId,
  getAioUrl,
} from "@/lib/ecpay/create-order";
import { assertEcpayConfigured } from "@/lib/ecpay/config";
import { TOOL_UNLOCK_PRICES, TOOL_LABEL_ZH, isValidTool } from "@/lib/pricing/tool-unlock";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertEcpayConfigured();
  } catch {
    const fallback = new URL(`/pricing?error=payment_not_configured`, req.url);
    return NextResponse.redirect(fallback, 303);
  }

  const form = await req.formData();
  const tool = String(form.get("tool") ?? "");
  if (!isValidTool(tool)) {
    return NextResponse.json({ error: "invalid-tool" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = encodeURIComponent(`/pricing?unlock_tool=${tool}`);
    const loginUrl = new URL(`/login?next=${next}`, req.url);
    return NextResponse.redirect(loginUrl, 303);
  }

  if (isAdminEmail(user.email, getServerAdminEmails())) {
    const url = new URL(`/pricing?tool_notice=admin`, req.url);
    return NextResponse.redirect(url, 303);
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("tool_unlocks")
    .select("id")
    .eq("user_id", user.id)
    .eq("tool", tool)
    .maybeSingle();
  if (existing) {
    const url = new URL(`/pricing?tool_notice=owned`, req.url);
    return NextResponse.redirect(url, 303);
  }

  const amount = TOOL_UNLOCK_PRICES[tool];
  const orderId = generateOrderId();
  const itemName = `${TOOL_LABEL_ZH[tool]} 永久買斷`;

  await admin.from("payments").insert({
    user_id: user.id,
    amount,
    status: "pending",
    raw_response: {
      kind: "tool_unlock",
      orderId,
      tool,
      amount,
      itemName,
    } as Record<string, unknown>,
  });

  const params = buildAioParams({
    orderId,
    amount,
    itemName,
    description: `${TOOL_LABEL_ZH[tool]} 永久使用權`,
    email: user.email ?? undefined,
  });
  const html = buildAutoSubmitHtml(getAioUrl(), params);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
