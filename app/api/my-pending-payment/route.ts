/**
 * GET /api/my-pending-payment
 *   回登入使用者最新一筆「已取號待繳費」且未過期的 payment。
 *   給 /my-subscription 顯示繳費資訊卡片用。回 { pending: {...} | null }。
 */
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ pending: null });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("payments")
    .select("amount, payment_info, created_at")
    .eq("user_id", user.id)
    .eq("status", "awaiting_payment")
    .order("created_at", { ascending: false })
    .limit(5);

  const now = Date.now();
  const pending =
    (rows ?? [])
      .map((r) => ({
        amount: r.amount as number,
        paymentInfo: r.payment_info as {
          method: string;
          expireDate: string;
          [k: string]: unknown;
        } | null,
      }))
      .find(
        (r) =>
          r.paymentInfo &&
          typeof r.paymentInfo.expireDate === "string" &&
          new Date(r.paymentInfo.expireDate).getTime() > now,
      ) ?? null;

  return NextResponse.json({ pending });
}
