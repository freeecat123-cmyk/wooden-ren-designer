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

  const { data: existing, error: existingErr } = await admin
    .from("tool_unlocks")
    .select("id")
    .eq("user_id", user.id)
    .eq("tool", tool)
    .maybeSingle();
  /**
   * ⛔ 原本只解構 data、把 error 丟掉。supabase-js 查詢失敗不會 throw,
   *    而是回 `{ data: null, error }` → existing 變成 null → 判定「還沒買過」
   *    → **對已經買過的人再收一次 499**。
   * 「查不到」跟「沒有」是兩件事:查詢壞掉時要讓結帳失敗,不是放行。
   *
   * 姊妹路由 checkout/template 已經這樣修了(同一輪),這支漏掉。
   * 更糟的是畫面上「已擁有」的灰色按鈕也是查同一張表 —— DB 抽風時那個按鈕
   * 會變回「立即購買」,客人很自然就按下去。(2026-08-24)
   */
  if (existingErr) {
    console.error("[checkout/tool] 查既有解鎖失敗,拒絕開單(不能當成沒買過)", {
      userId: user.id,
      tool,
      error: existingErr.message,
    });
    return NextResponse.json(
      { error: "unavailable", message: "系統忙碌中,請稍後再試一次(不會重複扣款)。" },
      { status: 503 },
    );
  }
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
