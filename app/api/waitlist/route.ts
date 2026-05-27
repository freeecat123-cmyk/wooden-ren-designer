/**
 * Waitlist signup endpoint — public POST.
 *
 * 用 service role key 從 server 寫入 public.waitlist；前端只走 /api/waitlist。
 * 同一 email + locale 視為重複（unique index 擋掉），回 200 + already=true。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const source = (body.source ?? "en-coming-soon").slice(0, 64);
  const locale = (body.locale ?? "en").slice(0, 16);

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const ipCountry =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  const { error } = await supabase
    .from("waitlist")
    .insert({ email, locale, source, user_agent: userAgent, ip_country: ipCountry });

  if (error) {
    // 23505 = unique violation = 已在名單上
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    console.error("[waitlist] insert failed", JSON.stringify(error), String(error));
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, already: false });
}
