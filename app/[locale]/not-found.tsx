import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl">🪚</div>
      <h1 className="mt-4 text-2xl font-semibold">這個頁面不存在</h1>
      <p className="mt-2 text-zinc-600">
        你可能點到失效連結，或路徑打錯了。回首頁挑一個家具開始設計吧。
      </p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-zinc-900 px-6 py-3 text-white hover:bg-zinc-700"
      >
        回首頁
      </Link>
    </main>
  );
}
