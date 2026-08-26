"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * ⚠️ 動這支之前先讀 [[feedback-frameloop-demand-invalidate]]。
 *
 * 2026-05-12 為了修「選零件時其他零件不變半透明」的 GPU 上傳競態，Canvas 從
 * `demand` 改成 `always`，並留下一句「等真碰到效能問題再回頭考慮」。
 * 2026-08-26 木頭仁回報手機很慢，實測靜置時主執行緒 41% 都在跑這個重繪迴圈
 * （場景全靜態、沒有任何 useFrame、OrbitControls 也沒開 damping）。
 *
 * 這支不是把 `demand` 改回去 —— 當年失敗的版本是「改完只補一次 invalidate()」，
 * 單幀還是搶不贏 GPU 上傳。這裡改成：**任何變動後整整 ACTIVE_MS 都維持 always**
 * （約 90 幀），競態不可能再發生；只有在「沒人碰、什麼都沒變」時才降到 demand。
 */

/** 變動後維持連續重繪的時間。要遠大於單幀，才蓋得住當年的 GPU 上傳競態。 */
const ACTIVE_MS = 1500;

export function useSmartFrameloop(
  containerRef: RefObject<HTMLElement | null>,
  /** 任一值變動就重新進入連續重繪（材質/選取/爆炸/場景…） */
  deps: unknown[],
): "always" | "demand" {
  const [mode, setMode] = useState<"always" | "demand">("always");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 看得到 && 分頁在前景，兩者皆真才允許進入 always
  const renderableRef = useRef(true);

  const wake = useRef(() => {});
  wake.current = () => {
    if (!renderableRef.current) return;
    setMode("always");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMode("demand"), ACTIVE_MS);
  };

  // 任一 dep 變動 → 重新進入連續重繪
  useEffect(() => {
    wake.current();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let visible = true;
    let foreground = document.visibilityState !== "hidden";

    const sync = () => {
      const renderable = visible && foreground;
      renderableRef.current = renderable;
      if (renderable) wake.current();
      else {
        if (timerRef.current) clearTimeout(timerRef.current);
        setMode("demand");
      }
    };

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        sync();
      },
      { rootMargin: "100px" },
    );
    io.observe(el);

    const onVisibility = () => {
      foreground = document.visibilityState !== "hidden";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // 使用者實際在操作 3D（轉動 / 縮放 / 點選）→ 立刻回到連續重繪
    const onInteract = () => wake.current();
    const opts = { passive: true } as const;
    el.addEventListener("pointerdown", onInteract, opts);
    el.addEventListener("pointermove", onInteract, opts);
    el.addEventListener("pointerup", onInteract, opts);
    el.addEventListener("wheel", onInteract, opts);
    el.addEventListener("touchmove", onInteract, opts);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("pointerdown", onInteract);
      el.removeEventListener("pointermove", onInteract);
      el.removeEventListener("pointerup", onInteract);
      el.removeEventListener("wheel", onInteract);
      el.removeEventListener("touchmove", onInteract);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [containerRef]);

  return mode;
}
