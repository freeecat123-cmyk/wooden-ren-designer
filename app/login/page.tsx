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
    <main className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group">
            <img
              src="/brand-logo.png"
              alt="木頭仁 木作藍圖"
              width={88}
              height={88}
              className="rounded-2xl shadow-md ring-1 ring-amber-900/15 group-hover:shadow-lg transition-shadow"
            />
            <h1 className="font-serif-tc text-2xl font-bold text-amber-900">
              木頭仁 木作藍圖
            </h1>
          </Link>
          <p className="text-sm text-zinc-600 mt-2">
            登入後可儲存設計、生成報價、分享連結
          </p>
        </div>
        <div className="bg-white rounded-2xl ring-1 ring-amber-900/10 p-6 sm:p-8 shadow-lg shadow-amber-900/5">
          <LoginPageClient next={next} />
        </div>
        <p className="text-center text-xs text-zinc-500 mt-6 leading-relaxed">
          首次使用 = 自動註冊。不用設密碼，用 Google 帳號或 Email 收信件登入。
          <br />
          需要協助？
          <a
            href="https://lin.ee/EaXGbJ1"
            target="_blank"
            rel="noopener"
            className="text-emerald-700 font-medium hover:underline ml-1"
          >
            LINE 官方加好友
          </a>
        </p>
      </div>
    </main>
  );
}
