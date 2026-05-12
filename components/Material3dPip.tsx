"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

/**
 * 材料單區的浮動 3D 縮圖（PIP）。
 *
 * 為什麼不用 position:sticky：
 *   <details> 容器在不同瀏覽器下對 sticky 子元素的 containing block
 *   行為不一致（Safari pre-15 已知會失效）。改用 IntersectionObserver
 *   偵測材料區是否在 viewport 內，再渲染 fixed 位置的 PIP，desktop /
 *   mobile / 各 details 狀態都通。
 *
 * 用法：
 *   <Material3dPip>
 *     <LazyPerspectiveView ... />
 *   </Material3dPip>
 *   ... 然後在材料清單外層加 data-pip-area
 */
export function Material3dPip({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const target = document.querySelector("[data-pip-area]");
    if (!target) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setVisible(e.isIntersecting);
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0 },
    );
    obs.observe(target);
    observerRef.current = obs;
    return () => obs.disconnect();
  }, []);

  if (!visible) return null;
  return (
    <div
      className="
        fixed z-40
        right-2 top-2 w-44 sm:w-56
        lg:right-4 lg:bottom-4 lg:top-auto lg:w-80
        rounded-lg border border-zinc-300 bg-white shadow-2xl overflow-hidden
        transition-opacity
      "
    >
      <div className="px-2 py-1 border-b border-zinc-200 text-[10px] font-semibold text-zinc-600 flex items-center gap-1.5">
        <span className="w-0.5 h-3 bg-amber-500 rounded-full" />
        3D 同步高亮
      </div>
      <div className="aspect-[4/3]">{children}</div>
    </div>
  );
}
