/**
 * /api/refund
 *
 * POST：2026-05-23 後關閉。木作藍圖屬數位虛擬商品，不接受線上自助退費申請。
 *       退費案由木頭仁本人 email 收信後人工處理（admin 可在 /admin/refunds
 *       手動建退費記錄走人工流程）。
 *
 * GET：保留，給 /refund 頁顯示使用者過去人工處理過的退費紀錄歸檔。
 */
import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error: "online_refund_disabled",
      message:
        "線上自助退費申請已停用。木作藍圖為數位虛擬商品，退費請 email 至 wengbinren@gmail.com 由本人人工處理。",
    },
    { status: 410 },
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_logged_in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("refund_requests")
    .select(
      "id, payment_id, amount_requested, reason, status, admin_note, created_at, reviewed_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
