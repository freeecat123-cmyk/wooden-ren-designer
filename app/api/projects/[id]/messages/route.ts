import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { checkIpRateLimit, getClientIp } from "@/lib/api/ip-rate-limit";

interface PostBody {
  token?: string;
  senderName?: string;
  content?: string;
}

/**
 * 客戶端（無帳號）發訊息：驗證 share_token，用 admin client 寫入。
 * 師傅端發訊息直接走 client supabase + RLS，不打這個 endpoint。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  /**
   * 🧷 限流 + 欄位長度上限。
   *
   * ⛔ 這支完全沒限流。`share_token` 是印在**公開報價連結 query string** 上、
   *    永不過期也沒有撤銷機制的值(lib/projects/fetch-quote-data.ts:81),
   *    任何拿到那條連結的人(含被轉寄、referrer 外洩)都可以無限次 POST:
   *    一秒幾十則灌爆師傅的專案對話。而 `senderName` **沒有任何長度上限**,
   *    可以塞到 Vercel body 上限 4.5MB。(2026-08-21 稽核發現。)
   *
   * ⚠️ 用既有的 `checkIpRateLimit`(Redis 壞掉時放行,見該檔註解的取捨)。
   *    留言是正常互動,額度給寬一點:每 IP 每日 200 則。
   */
  const rl = await checkIpRateLimit({
    prefix: "project-messages",
    ip: getClientIp(req),
    perDay: 200,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const token = body.token?.trim();
  const senderName = body.senderName?.trim().slice(0, 60) || null;
  const content = body.content?.trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }
  if (!content || content.length === 0) {
    return NextResponse.json({ error: "Empty content" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Content too long" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("share_token", token)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const { error } = await admin.from("project_messages").insert({
    project_id: projectId,
    sender_role: "customer",
    sender_name: senderName,
    content,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
