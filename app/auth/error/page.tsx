import Link from "next/link";

export const metadata = {
  title: "登入失敗 ｜ 木頭仁 木作藍圖",
  robots: { index: false },
};

const REASONS: Record<string, { title: string; body: string; hint?: string }> = {
  expired: {
    title: "登入連結已失效",
    body: "你點的這個 Magic Link 已經過期或被使用過了。",
    hint: "為了安全，登入連結通常 10 分鐘內有效，且只能使用一次。",
  },
  used: {
    title: "登入連結已被使用",
    body: "這個登入連結之前已經點過了，每個連結只能使用一次。",
    hint: "請重新請求一封新的登入信。",
  },
  missing: {
    title: "缺少登入驗證碼",
    body: "請從信箱裡的登入連結點進來，不要直接打網址。",
  },
  unknown: {
    title: "登入時發生錯誤",
    body: "系統處理你的登入時發生未預期的錯誤。",
    hint: "請再試一次，若持續發生請從首頁聯絡我們。",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const sp = await searchParams;
  const reason = sp.reason && REASONS[sp.reason] ? sp.reason : "unknown";
  const r = REASONS[reason];

  return (
    <main className="max-w-md mx-auto px-6 py-16 sm:py-24">
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-6 sm:p-8">
        <div className="text-3xl mb-3">🔐</div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-2">
          {r.title}
        </h1>
        <p className="text-sm text-zinc-700 leading-relaxed">{r.body}</p>
        {r.hint && (
          <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{r.hint}</p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Link
            href="/login"
            className="flex-1 inline-block text-center px-4 py-2.5 rounded-lg font-medium text-sm bg-amber-700 text-white hover:bg-amber-800 transition-colors"
          >
            重新登入
          </Link>
          <Link
            href="/"
            className="flex-1 inline-block text-center px-4 py-2.5 rounded-lg font-medium text-sm bg-white text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100 transition-colors"
          >
            回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}
