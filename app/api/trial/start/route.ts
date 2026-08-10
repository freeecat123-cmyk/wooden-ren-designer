/**
 * POST /api/trial/start — 開始 CNC 刀路產生器的 7 天免費試用
 *
 * 銷售頁的主 CTA 用 <form method="post"> 打這裡（不靠 JS，webview 內也能用）。
 * 成功後導回 /cnc，此時 resolveCncAccess 會放行 → 直接進工具。
 *
 * 試用資格一個帳號一次，判定與寫入都在 lib/cnc/access.ts 的 startCncTrial()。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startCncTrial } from "@/lib/cnc/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未登入：先登入再回來按一次。試用要綁帳號，否則清 cookie 就能無限試用。
  if (!user) {
    const next = encodeURIComponent("/cnc");
    return NextResponse.redirect(new URL(`/login?next=${next}`, req.url), 303);
  }

  const result = await startCncTrial(supabase, user);
  const url = new URL("/cnc", req.url);
  if (!result.ok) {
    // alreadyEntitled 不帶參數：他本來就能用，導回去就是直接進工具，不需要解釋什麼
    if (result.code === "alreadyUsed") url.searchParams.set("trial", "used");
    if (result.code === "failed") url.searchParams.set("trial", "error");
  }
  return NextResponse.redirect(url, 303);
}
