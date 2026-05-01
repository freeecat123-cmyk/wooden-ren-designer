"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory } from "@/lib/types";

/**
 * 分享當前設計：複製完整 URL 到剪貼簿。
 *
 * URL 已含所有設計參數（next-router 自動寫入 searchParams），
 * 配合 app/design/[type]/opengraph-image.tsx 動態產 1200×630 縮圖，
 * 學員貼到 FB / IG / LINE 會自動帶預覽圖 → 免費廣告。
 */
export function ShareDesignButton({
  category,
  defaults,
}: {
  category: FurnitureCategory;
  defaults: { length: number; width: number; height: number };
}) {
  const sp = useSearchParams();
  const [state, setState] = useState<"idle" | "copied" | "shared">("idle");

  const buildUrl = (): string => {
    if (typeof window === "undefined") return "";
    const params = sp?.toString() ?? "";
    const path = `/design/${category}${params ? `?${params}` : ""}`;
    return new URL(path, window.location.origin).toString();
  };

  const buildTitle = (): string => {
    const tmpl = getTemplate(category);
    const name = tmpl?.nameZh ?? category;
    const length = sp?.get("length") ?? defaults.length;
    const width = sp?.get("width") ?? defaults.width;
    const height = sp?.get("height") ?? defaults.height;
    return `我用木頭仁家具設計器做了一張${name} ${length}×${width}×${height}mm`;
  };

  const handleClick = async () => {
    const url = buildUrl();
    const title = buildTitle();
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: { title: string; url: string }) => Promise<void> }).share({ title, url });
        setState("shared");
        setTimeout(() => setState("idle"), 2500);
        return;
      } catch {
        // 使用者取消 share dialog → 退回複製
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      window.prompt("複製這個連結：", url);
    }
  };

  const label = state === "copied" ? "✓ 已複製連結" : state === "shared" ? "✓ 已分享" : "分享設計";

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-sky-50 hover:ring-sky-400 transition"
      title="複製當前設計連結，貼到 FB / IG / LINE 會自動帶預覽圖"
    >
      <span>🔗</span>
      <span>{label}</span>
    </button>
  );
}
