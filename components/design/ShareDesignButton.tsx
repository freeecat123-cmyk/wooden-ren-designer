"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { categoryLabel } from "@/lib/templates/labels";
import type { FurnitureCategory } from "@/lib/types";

export function ShareDesignButton({
  category,
  defaults,
}: {
  category: FurnitureCategory;
  defaults: { length: number; width: number; height: number };
}) {
  const t = useTranslations("shareDesign");
  const tFurn = useTranslations("furniture");
  const locale = useLocale();
  const sp = useSearchParams();
  const [state, setState] = useState<"idle" | "copied" | "shared">("idle");

  const categoryName = (): string => {
    try {
      return tFurn(category);
    } catch {
      return categoryLabel(category, locale);
    }
  };

  const buildUrl = (): string => {
    if (typeof window === "undefined") return "";
    const params = sp?.toString() ?? "";
    const path = `/design/${category}${params ? `?${params}` : ""}`;
    return new URL(path, window.location.origin).toString();
  };

  const buildTitle = (): string => {
    const name = categoryName();
    const length = sp?.get("length") ?? defaults.length;
    const width = sp?.get("width") ?? defaults.width;
    const height = sp?.get("height") ?? defaults.height;
    return t("messageTpl", { name, l: length, w: width, h: height });
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
      window.prompt(t("copyPrompt"), url);
    }
  };

  const label = state === "copied" ? t("copied") : state === "shared" ? t("shared") : t("idle");

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-white text-zinc-800 ring-1 ring-amber-200 shadow-sm hover:bg-amber-50 hover:ring-amber-400 hover:shadow transition-all"
      title={t("title")}
    >
      <span>🔗</span>
      <span>{label}</span>
    </button>
  );
}
