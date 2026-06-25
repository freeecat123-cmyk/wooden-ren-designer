import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory } from "@/lib/types";

/**
 * 更新 / 刪除自己的 design。
 *
 * 為什麼走 server API 而不直接 client supabase？
 * 雖然 designs 表 RLS（schema.sql:163-172）已用 auth.uid() = user_id 限制
 * UPDATE/DELETE 只能動自己列，但同時走 server 端 user.id 比對是 defense-in-depth：
 * - 即使未來 RLS migration 漏掉或被改錯，server 端仍會擋。
 * - 集中改名 / 刪除的權限邏輯，方便未來加 audit log、活動專案保護等規則。
 */

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

const MAX_NAME_LEN = 100;
const MAX_PARAMS_BYTES = 32 * 1024;

function validateParams(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (JSON.stringify(value).length > MAX_PARAMS_BYTES) return null;
  } catch {
    return null;
  }
  return value as Record<string, unknown>;
}

async function getAuthedUserOr401(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  return { userId: user.id };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const auth = await getAuthedUserOr401();
  if (auth instanceof NextResponse) return auth;

  let body: { name?: unknown; furnitureType?: unknown; params?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: {
    name?: string;
    furniture_type?: FurnitureCategory;
    params?: Record<string, unknown>;
  } = {};

  if ("name" in body) {
    const raw = typeof body.name === "string" ? body.name.trim() : "";
    if (!raw) {
      return NextResponse.json({ error: "empty_name" }, { status: 400 });
    }
    if (raw.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "name_too_long" }, { status: 400 });
    }
    patch.name = raw;
  }

  if ("furnitureType" in body) {
    if (typeof body.furnitureType !== "string" || !getTemplate(body.furnitureType as FurnitureCategory)) {
      return NextResponse.json({ error: "invalid_furniture_type" }, { status: 400 });
    }
    patch.furniture_type = body.furnitureType as FurnitureCategory;
  }

  if ("params" in body) {
    const nextParams = validateParams(body.params);
    if (!nextParams) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }
    patch.params = nextParams;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("designs")
    .update(patch, { count: "exact" })
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }
  if (count === 0) {
    return NextResponse.json({ error: "not_found_or_forbidden" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...patch });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const auth = await getAuthedUserOr401();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("designs")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }
  if (count === 0) {
    return NextResponse.json({ error: "not_found_or_forbidden" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
