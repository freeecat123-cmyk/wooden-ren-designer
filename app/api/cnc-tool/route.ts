/**
 * GET /api/cnc-tool — 硬 gating 的 CNC 刀路工具本體
 *
 * /cnc 銷售頁的 <CncClient> 用 <iframe src="/api/cnc-tool"> 載入工具；這裡再驗
 * 一次權限（defense in depth）——沒權限的人直接導回銷售頁 /cnc，拿不到這份 1MB HTML。
 *
 * 工具 HTML 放在非公開的 lib/cnc/cnc-tool.html（不在 /public，無法直接下載），
 * 由 next.config outputFileTracingIncludes 帶進部署，這裡 readFile 吐出。
 *
 * ⚠️ 這道門只擋「拿不拿得到檔案」。試用期的人拿得到，而工具是純離線單檔 HTML，
 *    存檔就能一直用 —— 所以工具內部另有一道授權檢查（見 /api/cnc-license）。
 *    兩道門解決的是不同問題，缺一不可。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveCncAccess } from "@/lib/cnc/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const salesPage = new URL("/cnc", req.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(salesPage, 302);

  const access = await resolveCncAccess(supabase, user);
  if (!access.allowed) return NextResponse.redirect(salesPage, 302);

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
