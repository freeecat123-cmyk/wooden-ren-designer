"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * 3D 木紋走向箭頭切換器。
 *
 * 透過 URL 參數 `?grain=1` 控制。預設關（只看強化過的擬真木紋）；
 * 打開後每個木製零件疊一支雙向箭頭，明確標出纖維走向，教學 / 精確檢查用。
 */
export function GrainArrowToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active =
    searchParams?.get("grain") === "1" || searchParams?.get("grain") === "true";

  const onToggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (active) {
      params.delete("grain");
    } else {
      params.set("grain", "1");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50/50">
      <span className="text-[11px] text-zinc-600 mr-1.5">木紋走向</span>
      <button
        type="button"
        onClick={onToggle}
        title="顯示 / 隱藏木紋走向箭頭"
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
          active
            ? "bg-zinc-900 text-white"
            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
        }`}
      >
        <span aria-hidden>↔</span>
        {active ? "箭頭已開" : "顯示箭頭"}
      </button>
    </div>
  );
}
