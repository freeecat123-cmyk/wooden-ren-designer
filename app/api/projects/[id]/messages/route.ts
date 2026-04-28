import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

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

  const token = body.token?.trim();
  const senderName = body.senderName?.trim() || null;
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
