/**
 * GET /api/lifetime/status
 *   終身買斷還剩幾個名額（公開、不需登入）。pricing 頁用它決定顯示購買區塊還是「已額滿」。
 *   讀失敗回 503：頁面看到 503 就先不顯示購買鈕，不會誤報有名額。
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { LIFETIME_PRICE, getLifetimeStatus } from "@/lib/pricing/lifetime";
import { countLifetimeTaken } from "@/lib/pricing/lifetime-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = getLifetimeStatus(await countLifetimeTaken(createAdminClient()));
    return NextResponse.json(
      { price: LIFETIME_PRICE, quota: status.quota, remaining: status.remaining, available: status.available },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[lifetime/status] 算名額失敗", e);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
