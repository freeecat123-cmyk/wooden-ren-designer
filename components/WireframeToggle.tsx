"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function WireframeToggle({ current }: { current: boolean }) {
  const t = useTranslations("wireframeToggle");
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
      <span className="text-[11px] text-zinc-600 mr-1.5">{t("lbl")}</span>
      <button
        type="button"
        onClick={toggle}
        className={`px-2 py-1 rounded text-[11px] transition-colors ${
          current
            ? "bg-amber-600 text-white"
            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
        }`}
        title={current ? t("onTitle") : t("offTitle")}
      >
        {current ? t("onLabel") : t("offLabel")}
      </button>
    </div>
  );
}
