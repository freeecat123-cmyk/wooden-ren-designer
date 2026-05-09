"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * 3D 透視（X-ray）模式切換：隱藏門 + 抽屜面板，看內部層板/隔板/後板。
 * URL 參數 `?xray=1` 控制（server re-render 套用）。
 */
export function XrayToggle({ current }: { current: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (current) {
      params.delete("xray");
    } else {
      params.set("xray", "1");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? "/"), { scroll: false });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50/50">
      <span className="text-[11px] text-zinc-600">透視</span>
      <button
        type="button"
        onClick={toggle}
        title="隱藏門 + 抽屜面板，看內部結構"
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
          current
            ? "bg-amber-600 text-white"
            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
        }`}
      >
        {current ? "🔍 透視中（門/抽屜隱藏）" : "🔲 開啟透視（隱藏門/抽屜）"}
      </button>
    </div>
  );
}
