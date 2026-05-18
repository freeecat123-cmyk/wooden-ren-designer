import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LoginPageClient } from "./LoginPageClient";

export const metadata = {
  title: "登入 ｜ 木頭仁 木作藍圖",
  description: "用 Google 或 Email 登入木頭仁 木作藍圖",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next ?? "/";

  // 已登入 → 直接跳到 next
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }

  return (
    <main className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12 bg-zinc-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold text-zinc-900">木頭仁 木作藍圖</h1>
          </Link>
          <p className="text-sm text-zinc-600 mt-2">
            登入後可儲存設計、生成報價、分享連結
          </p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-zinc-200 p-6 sm:p-8 shadow-sm">
          <LoginPageClient next={next} />
        </div>
        <p className="text-center text-xs text-zinc-500 mt-6">
          首次使用 = 自動註冊。沒密碼、用 Google 或 Email magic link 登入。
          <br />
          需要協助？
          <a
            href="https://lin.ee/EaXGbJ1"
            target="_blank"
            rel="noopener"
            className="text-emerald-700 hover:underline ml-1"
          >
            LINE 官方加好友
          </a>
        </p>
      </div>
    </main>
  );
}
