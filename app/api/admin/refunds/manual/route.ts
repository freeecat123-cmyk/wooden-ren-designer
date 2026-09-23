/**
 * /api/admin/refunds/manual
 *
 * GET ?user_email=xxx@yyy 或 ?payment_id=uuid
 *   admin 查詢付款紀錄：列出該使用者的近期 success / awaiting_payment / refunded 付款，
 *   附帶付款方式（信用卡 / ATM / 超商 / 條碼）+ 訂單編號 + 金額 + 是否已有退費單，
 *   讓 admin 用來判斷該退哪一筆。
 *
 * POST { payment_id, amount?, reason? }
 *   admin 為某筆付款建立退費單（status='pending'）。
 *   建好之後走原本的 PATCH /api/admin/refunds/[id] 流程審核（信用卡走自動退、
 *   ATM/超商走手動匯款分支）。
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

async function ensureAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    return isAdminEmail(user?.email, getServerAdminEmails());
  } catch {
    return false;
  }
}

function classifyMethod(payment: {
  payment_info: { method?: string } | null;
  raw_response: Record<string, unknown> | null;
}): "credit_card" | "atm" | "cvs" | "barcode" | "unknown" {
  // 1. payment_info.method（ATM/CVS/Barcode 在 payment-info webhook 寫入）
  const m = payment.payment_info?.method;
  if (m === "atm" || m === "cvs" || m === "barcode") return m;
  // 2. raw_response.PaymentType（訂閱、信用卡直接走 return webhook 時的頂層欄位）
  // 3. raw_response.ecpay.PaymentType（unlock 訂單 webhook 把綠界 params nest 在 .ecpay 下）
  const raw = payment.raw_response ?? {};
  const ecpayNested = (raw.ecpay as Record<string, unknown> | undefined) ?? {};
  const pt =
    (raw.PaymentType as string | undefined) ??
    (ecpayNested.PaymentType as string | undefined) ??
    "";
  if (pt.startsWith("Credit_")) return "credit_card";
  if (pt.startsWith("ATM_")) return "atm";
  if (pt.startsWith("CVS_")) return "cvs";
  if (pt.startsWith("BARCODE_")) return "barcode";
  return "unknown";
}

const METHOD_LABEL: Record<string, string> = {
  credit_card: "信用卡",
  atm: "ATM 虛擬帳戶",
  cvs: "超商代碼",
  barcode: "超商條碼",
  unknown: "未知",
};

export async function GET(req: Request) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const userEmail = url.searchParams.get("user_email")?.trim().toLowerCase();
  const paymentId = url.searchParams.get("payment_id")?.trim();

  if (!userEmail && !paymentId) {
    return NextResponse.json(
      { error: "missing_user_email_or_payment_id" },
      { status: 400 },
    );
  }

  const svc = getServiceSupabase();

  let userId: string | null = null;
  let foundEmail: string | null = null;
  if (userEmail) {
    const { data: u } = await svc
      .from("users")
      .select("id, email")
      .ilike("email", userEmail)
      .maybeSingle();
    if (!u) {
      return NextResponse.json({ error: "user_not_found", data: [] }, { status: 200 });
    }
    userId = u.id;
    foundEmail = u.email;
  }

  // 只列「已付款 success」的——未付款（awaiting_payment）沒錢可退，不算退費案
  let query = svc
    .from("payments")
    .select("id, user_id, amount, status, ecpay_trade_no, payment_info, raw_response, invoice_number, invoice_status, created_at")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(20);
  if (paymentId) query = query.eq("id", paymentId);
  else if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const paymentIds = (data ?? []).map((r) => r.id);
  const { data: existingRefunds } = paymentIds.length
    ? await svc
        .from("refund_requests")
        .select("id, payment_id, status")
        .in("payment_id", paymentIds)
    : { data: [] };
  const refundByPaymentId = new Map<string, { id: string; status: string }>();
  for (const r of existingRefunds ?? []) {
    refundByPaymentId.set(r.payment_id as string, { id: r.id, status: r.status });
  }

  // 這個 lookup 專給「ATM/超商/條碼手動退費」用——信用卡有自動退款路徑，
  // 不該混進來干擾 admin 判斷。過濾掉 credit_card（但保留 unknown 以防舊資料漏判）。
  const rows = (data ?? [])
    .map((p) => {
      const method = classifyMethod(p);
      const raw = p.raw_response as Record<string, unknown> | null;
      const orderId =
        (raw?.MerchantTradeNo as string | undefined) ??
        (raw?.orderId as string | undefined) ??
        null;
      const itemName = (raw?.itemName as string | undefined) ?? null;
      return {
        payment_id: p.id,
        user_id: p.user_id,
        amount: p.amount,
        status: p.status,
        method,
        method_label: METHOD_LABEL[method],
        order_id: orderId,
        ecpay_trade_no: p.ecpay_trade_no,
        item_name: itemName,
        invoice_number: p.invoice_number,
        invoice_status: p.invoice_status,
        created_at: p.created_at,
        existing_refund: refundByPaymentId.get(p.id) ?? null,
      };
    })
    .filter((r) => r.method !== "credit_card");

  return NextResponse.json({ ok: true, user_email: foundEmail, data: rows });
}

export async function POST(req: Request) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { payment_id?: string; amount?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.payment_id) {
    return NextResponse.json({ error: "missing_payment_id" }, { status: 400 });
  }
  const svc = getServiceSupabase();
  const { data: payment } = await svc
    .from("payments")
    .select("id, user_id, amount, status")
    .eq("id", body.payment_id)
    .single();
  if (!payment) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  // 只能對「已付款 success」建退費單
  if (payment.status !== "success") {
    return NextResponse.json(
      { error: "payment_not_refundable", current_status: payment.status,
        message: "只有已付款（success）的訂單可建退費單。awaiting_payment 是未付款的 ATM/超商待繳訂單，沒錢可退。" },
      { status: 400 },
    );
  }

  // 防重複
  const { data: existing } = await svc
    .from("refund_requests")
    .select("id, status")
    .eq("payment_id", payment.id)
    .in("status", ["pending", "approved", "refunded"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "duplicate_refund_request", existing },
      { status: 409 },
    );
  }

  const amount = body.amount && body.amount > 0 && body.amount <= payment.amount
    ? body.amount
    : payment.amount;
  const reason = (body.reason ?? "admin 手動建立（使用者 email 來信申請）").trim();

  const { data: inserted, error: insErr } = await svc
    .from("refund_requests")
    .insert({
      user_id: payment.user_id,
      payment_id: payment.id,
      amount_requested: amount,
      reason,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json(
      { error: "insert_failed", detail: insErr?.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, refund_request_id: inserted.id });
}
