import type { Metadata } from "next";
import Link from "next/link";
import { BrandingForm } from "@/components/branding/BrandingForm";

export const metadata: Metadata = {
  title: "報價單抬頭設定",
  description: "設定報價單上的公司名稱、LOGO、匯款帳戶、付款分期、條款等資料。",
};

export default function BrandingSettingsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">報價單抬頭設定</h1>
          <p className="text-xs text-zinc-500 mt-1">
            這些設定會套用到所有報價單。一次設好之後不用每次填。
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
        >
          ← 回首頁
        </Link>
      </header>

      <BrandingForm defaultOpen />
    </main>
  );
}
