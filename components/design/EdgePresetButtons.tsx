"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OptionSpec } from "@/lib/types";

interface Preset {
  emoji: string;
  label: string;
  /** 座板 / 桌面外露邊緣 mm */
  seatMm: number;
  /** 腳 4 條長邊 mm */
  legMm: number;
  /** 牙板 / 橫撐 4 條長邊 mm */
  stretcherMm: number;
  style: "chamfered" | "rounded";
  hint: string;
}

const PRESETS: Preset[] = [
  {
    emoji: "🟦",
    label: "直角",
    seatMm: 0,
    legMm: 0,
    stretcherMm: 0,
    style: "chamfered",
    hint: "不倒角，工序最少",
  },
  {
    emoji: "✋",
    label: "微倒 R1",
    seatMm: 1,
    legMm: 1,
    stretcherMm: 1,
    style: "chamfered",
    hint: "全部 1mm 微倒，防扎手 + 防漆膜瓷化崩角",
  },
  {
    emoji: "🪑",
    label: "手感 R5",
    seatMm: 5,
    legMm: 3,
    stretcherMm: 3,
    style: "rounded",
    hint: "座板 R5、腳/橫撐 R3 圓角，常見好坐手感",
  },
  {
    emoji: "🛋️",
    label: "圓潤 R12",
    seatMm: 12,
    legMm: 6,
    stretcherMm: 6,
    style: "rounded",
    hint: "座板 R12 大圓邊、腳/橫撐 R6，手感最圓潤",
  },
];

/**
 * 一鍵套用倒角規格。直接改 URL params（不依賴 DesignFormShell 的 onChange），
 * Next router.replace 後表單會用新值重 render。
 *
 * 只在當前模板有這 3 個 key 時才顯示對應 preset 行為——某些模板（如圓凳）
 * 沒有 stretcherEdge 也照樣可用。
 */
export function EdgePresetButtons({ optionSchema }: { optionSchema: OptionSpec[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const keys = new Set(optionSchema.map((s) => s.key));

  const hasSeat = keys.has("seatEdge");
  const hasLeg = keys.has("legEdge");
  const hasStretcher = keys.has("stretcherEdge");
  if (!hasSeat && !hasLeg && !hasStretcher) return null;

  const apply = (p: Preset) => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    if (hasSeat) next.set("seatEdge", String(p.seatMm));
    if (hasLeg) next.set("legEdge", String(p.legMm));
    if (hasStretcher) next.set("stretcherEdge", String(p.stretcherMm));
    if (keys.has("seatEdgeStyle")) next.set("seatEdgeStyle", p.style);
    if (keys.has("legEdgeStyle")) next.set("legEdgeStyle", p.style);
    if (keys.has("stretcherEdgeStyle")) next.set("stretcherEdgeStyle", p.style);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-rose-50 ring-1 ring-amber-200">
      <div className="text-xs text-zinc-700 font-medium mb-2 flex items-center gap-1.5">
        <span>🎨</span>
        <span>倒角一鍵套用</span>
        <span className="text-[10px] text-zinc-500 font-normal">
          （影響座板 / 腳 / 橫撐外露邊）
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => apply(p)}
            className="px-3 py-1.5 rounded-md bg-white text-zinc-800 text-xs ring-1 ring-zinc-300 hover:bg-amber-100 hover:ring-amber-400 transition"
            title={p.hint}
          >
            {p.emoji} {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
