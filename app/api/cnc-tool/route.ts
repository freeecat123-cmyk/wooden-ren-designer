/**
 * GET /api/cnc-tool — 硬 gating 的 CNC 刀路工具本體
 *
 * /cnc 銷售頁的 <CncClient> 用 <iframe src="/api/cnc-tool"> 載入工具；這裡再驗
 * 一次權限（defense in depth）——沒訂閱（個人版以上）也沒單買 cnc 的人直接導回
 * 銷售頁 /cnc，拿不到這份 1MB HTML。
 *
 * 工具 HTML 放在非公開的 lib/cnc/cnc-tool.html（不在 /public，無法直接下載），
 * 由 next.config outputFileTracingIncludes 帶進部署，這裡 readFile 吐出。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";
import { canUseFeature, type UserPlanProfile } from "@/lib/permissions";
import { fetchUnlockedTools } from "@/lib/tool-unlocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function serveTool(): Promise<Response> {
  const html = await readFile(
    path.join(process.cwd(), "lib/cnc/cnc-tool.html"),
    "utf-8",
  );
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // gated 內容，不要被 CDN 當公開資源快取
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const salesPage = new URL("/cnc", req.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(salesPage, 302);

  if (isAdminEmail(user.email, getServerAdminEmails())) return serveTool();

  const { data: profile } = await supabase
    .from("users")
    .select("plan,subscription_status,subscription_expires_at,student_expires_at")
    .eq("id", user.id)
    .single();
  const planAllows = canUseFeature(
    profile as UserPlanProfile | null,
    "canUseCncTool",
  );
  const unlockedTools = await fetchUnlockedTools(createAdminClient(), user.id);
  const boughtUnlock = unlockedTools.includes("cnc");
  if (!planAllows && !boughtUnlock) {
    return NextResponse.redirect(salesPage, 302);
  }
  return serveTool();
}
