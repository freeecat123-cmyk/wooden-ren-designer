import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
type Context = { params: Promise<{ id: string }> };

async function authorize(id: string) {
  if (!uuid(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return user.id;
}

export async function GET(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const owner = await authorize(id);
  if (owner instanceof NextResponse) return owner;
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return NextResponse.json({ error: "invalid_offset" }, { status: 400 });
  const db = createAdminClient();
  const { data: current, error: currentError } = await db.from("designs").select("id").eq("id", id).eq("user_id", owner).maybeSingle();
  if (currentError) return NextResponse.json({ error: "db_error" }, { status: 500 });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data, error } = await db.from("design_versions")
    .select("id, name, furniture_type, params, created_at")
    .eq("design_id", id).eq("user_id", owner)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 20);
  if (error) {
    console.error("[design versions] list failed", error.code);
    return NextResponse.json({ error: "history_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ versions: (data ?? []).slice(0, 20), hasMore: (data?.length ?? 0) > 20 }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const owner = await authorize(id);
  if (owner instanceof NextResponse) return owner;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body || !uuid(body.versionId) || typeof body.expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
    return NextResponse.json({ error: "invalid_restore" }, { status: 400 });
  }
  const db = createAdminClient();
  const { data: version, error } = await db.from("design_versions")
    .select("params, name, furniture_type").eq("id", body.versionId).eq("design_id", id).eq("user_id", owner).maybeSingle();
  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });
  if (!version) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // The existing database trigger snapshots the displaced design in this same transaction.
  const { data: restored, error: updateError } = await db.from("designs")
    .update({ params: version.params, name: version.name, furniture_type: version.furniture_type })
    .eq("id", id).eq("user_id", owner).eq("updated_at", body.expectedUpdatedAt)
    .select("id, updated_at, params, furniture_type").maybeSingle();
  if (updateError) {
    console.error("[design versions] restore failed", updateError.code);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!restored) return NextResponse.json({ error: "design_conflict" }, { status: 409 });
  return NextResponse.json(restored, { headers: { "Cache-Control": "private, no-store" } });
}
