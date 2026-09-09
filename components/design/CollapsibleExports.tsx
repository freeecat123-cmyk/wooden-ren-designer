"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * 輸出區展開時約 380px，在手機上把 3D 和材料表都擠掉 —— 木頭仁 2026-09-09
 * 「輸出的部分可以折疊嗎」。
 *
 * 預設收合，展開狀態記在 localStorage：常用的人展開一次就一直是展開的。
 *
 * ⚠️ 兩個踩過的坑：
 * 1. 初始值不可以在 render 時讀 localStorage（SSR 讀不到 → hydration 不一致），
 *    一律先收合、mount 後再套使用者上次的選擇。
 * 2. 不要用受控的 `open` prop + React 的 `onToggle`：<details> 是瀏覽器自己
 *    切換的，實測 open 變了但 onToggle 沒跑 ⇒ 記不住。改綁原生 toggle 事件。
 */
const STORAGE_KEY = "studio-exports-open";

export default function CollapsibleExports({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) === "1";
      details.open = saved;
      setOpen(saved);
    } catch { /* 無痕模式 */ }
    const onToggle = () => {
      setOpen(details.open);
      try { window.localStorage.setItem(STORAGE_KEY, details.open ? "1" : "0"); } catch { /* 無痕模式 */ }
    };
    details.addEventListener("toggle", onToggle);
    return () => details.removeEventListener("toggle", onToggle);
  }, []);

  return <details ref={ref} className="border-t border-zinc-200 bg-white" data-studio-exports data-studio-output>
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-3 text-sm text-zinc-700 hover:bg-zinc-50">
      <span className="text-xs text-zinc-400 transition-transform" data-exports-caret aria-hidden="true"
        style={{ transform: open ? "rotate(90deg)" : "none" }}>▶</span>
      {label}
    </summary>
    <div className="flex flex-wrap items-center gap-2 p-2 pt-0">{children}</div>
  </details>;
}
