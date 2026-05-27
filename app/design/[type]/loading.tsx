export default function DesignLoading() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-32 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-700" />
      <h2 className="mt-6 text-lg font-medium text-zinc-700">正在生成 3D 模型⋯</h2>
      <p className="mt-2 text-sm text-zinc-500">第一次載入需要幾秒鐘，請稍候。</p>
    </main>
  );
}
