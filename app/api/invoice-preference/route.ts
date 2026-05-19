/**
 * GET /api/invoice-preference  → 回目前儲存的偏好（給 UI 顯示）
 * POST /api/invoice-preference → 儲存使用者發票偏好
 *
 * Body shape:
 *   {
 *     type: 'personal' | 'company',
 *     taxId?: string,         // company 必填、8 碼數字
 *     title?: string,         // company 必填
 *     carrierType?: 'mobile' | 'member',  // personal only
 *     carrierNum?: string,    // mobile 必填、格式 /XXX+XXX 共 8 字
 *     email?: string,         // 缺省用 user.email
 *   }
 *
 * 寫進 users.invoice_preference jsonb。
 * 下次刷卡時 issue-invoice-for-payment 會自動讀取套用。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { type InvoicePreference } from "@/lib/ecpay/invoice-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOBILE_CARRIER_REGEX = /^\/[0-9A-Z+\-.]{7}$/; // 8 字、開頭 /
const TAX_ID_REGEX = /^\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(input: unknown): { ok: true; value: InvoicePreference } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "invalid_body" };
  const b = input as Record<string, unknown>;

  if (b.type !== "personal" && b.type !== "company") {
    return { ok: false, error: "invalid_type" };
  }

  const out: InvoicePreference = { type: b.type };

  if (b.type === "company") {
    if (typeof b.taxId !== "string" || !TAX_ID_REGEX.test(b.taxId)) {
      return { ok: false, error: "invalid_tax_id" };
    }
    if (typeof b.title !== "string" || b.title.trim().length === 0 || b.title.length > 60) {
      return { ok: false, error: "invalid_title" };
    }
    out.taxId = b.taxId;
    out.title = b.title.trim();
  } else {
    // personal
    if (b.carrierType === "mobile") {
      if (typeof b.carrierNum !== "string" || !MOBILE_CARRIER_REGEX.test(b.carrierNum)) {
        return { ok: false, error: "invalid_carrier_num" };
      }
      out.carrierType = "mobile";
      out.carrierNum = b.carrierNum;
    } else if (b.carrierType === "member" || !b.carrierType) {
      out.carrierType = "member";
    } else {
      return { ok: false, error: "invalid_carrier_type" };
    }
  }

  if (b.email !== undefined && b.email !== null && b.email !== "") {
    if (typeof b.email !== "string" || !EMAIL_REGEX.test(b.email)) {
      return { ok: false, error: "invalid_email" };
    }
    out.email = b.email;
  }

  return { ok: true, value: out };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("invoice_preference, email")
    .eq("id", user.id)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    preference: data?.invoice_preference ?? null,
    defaultEmail: data?.email ?? user.email ?? null,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const v = validate(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ invoice_preference: v.value })
    .eq("id", user.id);

  if (error) {
    console.error("[invoice-preference] update failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, preference: v.value });
}
