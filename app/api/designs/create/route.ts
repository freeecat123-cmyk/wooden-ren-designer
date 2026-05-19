/**
 * POST /api/designs/create
 *
 * 把 SaveDesignButton 從「client 直 supabase.from('designs').insert」搬到
 * server route(audit #18)。雖然 RLS 已經擋了 free category 白名單 + count 上限,
 * server route 多一層好處:
 *   1. 更乾淨的 error message(不暴露 DB column 名)
 *   2. server-side rate limit / logging 可以掛
 *   3. params jsonb 可以做 schema validation 避免被塞髒資料
 *   4. 跟其他付費 gate(/admin/* /api/admin/* )一致都走 server
 *
 * Body:
 *   { furnitureType: string, name: string, params: Record<string, unknown> }
 *
 * Returns:
 *   201 { id, name }
 *   401 unauthenticated
 *   400 invalid_body / invalid_furniture_type / invalid_params
 *   403 plan_locked_category / max_designs_reached
 *   500 db_error
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  getPlanFeatures,
  canAccessCategory,
  type UserPlanProfile,
} from "@/lib/permissions";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import type { FurnitureCategory } from "@/lib/types";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LEN = 80;
const MAX_PARAMS_BYTES = 32 * 1024; // 32KB 限制 jsonb 大小,擋暴力塞 payload

function validate(body: unknown):
  | { ok: true; furnitureType: FurnitureCategory; name: string; params: Record<string, unknown> }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "invalid_body" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.furnitureType !== "string" || !b.furnitureType) {
    return { ok: false, status: 400, error: "invalid_furniture_type" };
  }
  // 必須是已知 template (擋 user 自己亂傳 category 繞 FREE_UNLOCKED_CATEGORIES)
  if (!getTemplate(b.furnitureType as FurnitureCategory)) {
    return { ok: false, status: 400, error: "invalid_furniture_type" };
  }

  if (typeof b.name !== "string") {
    return { ok: false, status: 400, error: "invalid_name" };
  }
  const name = b.name.trim();
  if (name.length === 0 || name.length > MAX_NAME_LEN) {
    return { ok: false, status: 400, error: "invalid_name" };
  }

  if (!b.params || typeof b.params !== "object" || Array.isArray(b.params)) {
    return { ok: false, status: 400, error: "invalid_params" };
  }
  // 粗略防 payload 暴力:序列化後不能超過 MAX_PARAMS_BYTES
  let serialized: string;
  try {
    serialized = JSON.stringify(b.params);
  } catch {
    return { ok: false, status: 400, error: "invalid_params" };
  }
  if (serialized.length > MAX_PARAMS_BYTES) {
    return { ok: false, status: 400, error: "params_too_large" };
  }

  return {
    ok: true,
    furnitureType: b.furnitureType as FurnitureCategory,
    name,
    params: b.params as Record<string, unknown>,
  };
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. Validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const v = validate(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: v.status });
  }

  // 3. Plan check — 拉 profile,看 category 能不能存
  const admin = createAdminClient();
  const { data: profileData } = await admin
    .from("users")
    .select("plan, subscription_status, subscription_expires_at, student_expires_at, student_activated_at")
    .eq("id", user.id)
    .single();
  const profile = profileData as UserPlanProfile | null;
  const isAdmin = isAdminEmail(user.email, getServerAdminEmails());

  if (!isAdmin && !canAccessCategory(profile, v.furnitureType)) {
    return NextResponse.json(
      { error: "plan_locked_category", message: "此家具範本需付費方案" },
      { status: 403 },
    );
  }

  // 4. Count check — 超過 maxDesigns 擋
  const features = getPlanFeatures(profile);
  if (features.maxDesigns !== Infinity) {
    const { count } = await admin
      .from("designs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (count !== null && count >= features.maxDesigns) {
      return NextResponse.json(
        {
          error: "max_designs_reached",
          message: `免費版只能儲存 ${features.maxDesigns} 件設計(你已有 ${count} 件)`,
          max: features.maxDesigns,
          count,
        },
        { status: 403 },
      );
    }
  }

  // 5. Insert
  const { data: inserted, error: insertErr } = await admin
    .from("designs")
    .insert({
      user_id: user.id,
      furniture_type: v.furnitureType,
      name: v.name,
      params: v.params,
    })
    .select("id, name")
    .single();

  if (insertErr) {
    console.error("[designs/create] insert failed", insertErr);
    return NextResponse.json(
      { error: "db_error", message: insertErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json(inserted, { status: 201 });
}
