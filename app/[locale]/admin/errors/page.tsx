import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";
import { getServerAdminEmails, isAdminEmail } from "@/lib/admin";

export const metadata = { title: "錯誤記錄 · 木頭仁 admin" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  error: "程式爆掉",
  rejection: "背景工作失敗",
  boundary: "整頁掛掉",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

export default async function AdminErrorsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email, getServerAdminEmails())) {
    redirect("/?admin_denied=1");
  }

  const { data: rows } = await getServiceSupabase()
    .from("client_errors")
    .select("id, message, stack, kind, path, user_agent, build, seen_count, first_seen_at, last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(200);

  const errors = rows ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">錯誤記錄</h1>
      <p className="mt-2 text-sm text-zinc-600">
        使用者瀏覽器上真的炸掉的東西，自動收進來的——不用等他們回報。
        同一個錯誤會併成一列，右邊是發生次數。
      </p>

      {errors.length === 0 ? (
        <p className="mt-10 rounded-lg border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          目前沒有任何錯誤紀錄 🎉
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {errors.map((e) => (
            <li key={e.id as string} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  {KIND_LABEL[e.kind as string] ?? (e.kind as string)}
                </span>
                <span className="font-medium break-all">{e.message as string}</span>
                <span className="ml-auto whitespace-nowrap text-sm text-zinc-500">
                  發生 {e.seen_count as number} 次
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                最近 {when(e.last_seen_at as string)}　·　最早 {when(e.first_seen_at as string)}
                {e.path ? <>　·　頁面 <code>{e.path as string}</code></> : null}
                {e.build ? <>　·　版本 {e.build as string}</> : null}
              </div>
              {e.user_agent ? (
                <div className="mt-1 text-xs text-zinc-400 break-all">{e.user_agent as string}</div>
              ) : null}
              {e.stack ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500">看詳細位置</summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-3 text-xs leading-relaxed">
                    {e.stack as string}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
