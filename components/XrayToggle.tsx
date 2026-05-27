"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export type XrayMode = "off" | "face" | "full";

export function XrayToggle({ current }: { current: XrayMode }) {
  const t = useTranslations("xrayToggle");
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
      <span className="text-[11px] text-zinc-600 mr-1.5">{t("lbl")}</span>
      <Btn mode="off" label={t("offLabel")} title={t("offTitle")} />
      <Btn mode="face" label={t("faceLabel")} title={t("faceTitle")} />
      <Btn mode="full" label={t("fullLabel")} title={t("fullTitle")} />
    </div>
  );
}
