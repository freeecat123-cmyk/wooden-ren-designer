"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type XrayMode = "off" | "face" | "full";

/**
 * 3D 透視（X-ray）模式切換：
 * - off: 顯示全部
 * - face: 只藏面板（drawer-face + 全門）→ 看得到抽屜箱體
 * - full: 藏整個抽屜 + 全門 → 看櫃內全空
 *
 * URL 參數 `?xray=face|full` 控制（off 時 delete）。
 */
export function XrayToggle({ current }: { current: XrayMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setMode = (mode: XrayMode) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (mode === "off") {
      params.delete("xray");
    } else {
      params.set("xray", mode);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? "/"), { scroll: false });
  };

  const Btn = ({ mode, label, title }: { mode: XrayMode; label: string; title: string }) => {
    const active = current === mode;
    return (
      <button
        type="button"
        onClick={() => setMode(mode)}
        title={title}
        className={`px-2 py-1 rounded text-[11px] transition-colors ${
          active
            ? "bg-amber-600 text-white"
            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-200 bg-zinc-50/50">
      <span className="text-[11px] text-zinc-600 mr-1.5">透視</span>
      <Btn mode="off" label="🔲 關閉" title="顯示全部" />
      <Btn mode="face" label="🪞 只藏面板" title="藏門 + 抽屜面板，看得到抽屜箱體" />
      <Btn mode="full" label="🔍 全部隱藏" title="藏整個抽屜 + 門，看櫃內全空" />
    </div>
  );
}
