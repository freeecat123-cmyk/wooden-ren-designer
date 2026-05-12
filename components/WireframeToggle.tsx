"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * 3D 線框模式切換：勾起來所有零件渲染成線框骨架，看得到所有 edge / 內部結構。
 * URL 參數 `?wf=1` 控制。
 */
export function WireframeToggle({ current }: { current: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (current) params.delete("wf");
    else params.set("wf", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? "/"), { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50/50">
      <span className="text-[11px] text-zinc-600 mr-1.5">線框</span>
      <button
        type="button"
        onClick={toggle}
        className={`px-2 py-1 rounded text-[11px] transition-colors ${
          current
            ? "bg-amber-600 text-white"
            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
        }`}
        title={current ? "點擊回到實心模式" : "點擊切換成線框骨架（看得到內部結構）"}
      >
        {current ? "🕸️ 線框 ON" : "🕸️ 線框"}
      </button>
    </div>
  );
}
