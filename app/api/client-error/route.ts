/**
 * 收使用者瀏覽器端炸掉的錯誤，寫進 public.client_errors。
 *
 * 為什麼要有：2026-09-07 有客人按「回報問題」寄來一封空信，我們完全查不到他遇到什麼，
 * 因為這個站當時沒有任何錯誤記錄。現在就算對方一個字都沒寫，也查得到那個時間點炸了什麼。
 *
 * 看紀錄：/admin/errors
 *
 * ⚠️ 這個 endpoint 是公開的（錯誤本來就發生在還沒登入的人身上也要收），所以：
 *    - 同 origin 才收，擋掉外面亂打
 *    - 每個 IP 每天上限，擋掉無限迴圈的頁面把資料表灌爆
 *    - 欄位一律截斷，不信任任何長度
 */
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { checkIpRateLimit } from "@/lib/api/ip-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(["error", "rejection", "boundary"]);
const cut = (v: unknown, n: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

export async function POST(request: Request) {
  // 同 origin 才收
  const origin = request.headers.get("origin");
  if (origin && new URL(request.url).origin !== origin) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = await checkIpRateLimit({ prefix: "client-error", ip, perDay: 50 });
  if (!limit.ok) return Response.json({ ok: true, dropped: "rate_limited" });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const message = cut(body.message, 500);
  if (!message) return Response.json({ ok: false }, { status: 400 });

  const stack = cut(body.stack, 4000);
  const path = cut(body.path, 300);
  const kindRaw = cut(body.kind, 20) ?? "error";
  const kind = KINDS.has(kindRaw) ? kindRaw : "error";

  // 同一個錯誤要併成一列：訊息 + stack 第一行 + 路徑
  const fingerprint = createHash("sha256")
    .update([message, stack?.split("\n")[1] ?? "", path ?? ""].join("|"))
    .digest("hex")
    .slice(0, 32);

  const supabase = createAdminClient();

  // 先試著累加既有那一列；沒有才新增。
  // （不用 upsert 是因為要 seen_count = seen_count + 1，upsert 做不到累加。）
  const { data: existing } = await supabase
    .from("client_errors")
    .select("id, seen_count")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("client_errors")
      .update({ seen_count: existing.seen_count + 1, last_seen_at: new Date().toISOString() })
      .eq("id", existing.id);
    return Response.json({ ok: true });
  }

  await supabase.from("client_errors").insert({
    fingerprint,
    message,
    stack,
    kind,
    path,
    user_agent: cut(request.headers.get("user-agent"), 300),
    build: cut(body.build, 40),
  });

  return Response.json({ ok: true });
}
