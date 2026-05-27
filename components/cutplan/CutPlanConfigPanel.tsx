"use client";

import { useTranslations } from "next-intl";
import type { NestConfig } from "@/lib/cutplan";

export function CutPlanConfigPanel({
  value,
  onChange,
}: {
  value: NestConfig;
  onChange: (next: NestConfig) => void;
}) {
  const t = useTranslations("cutPlanConfig");
  const patch = (partial: Partial<NestConfig>) =>
    onChange({ ...value, ...partial });

  return (
    <section className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">{t("h")}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-600 mb-1">{t("kerfLbl")}</p>
          <input
            type="number"
            value={value.kerf}
            onChange={(e) => patch({ kerf: Number(e.target.value) || 0 })}
            className="w-24 px-2 py-1 border rounded text-sm"
          />
          <p className="text-[11px] text-zinc-400 mt-1">{t("kerfHint")}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-1">{t("minWasteLbl")}</p>
          <input
            type="number"
            value={value.minWasteMm}
            onChange={(e) => patch({ minWasteMm: Number(e.target.value) || 0 })}
            className="w-24 px-2 py-1 border rounded text-sm"
          />
          <p className="text-[11px] text-zinc-400 mt-1">{t("minWasteHint")}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">{t("footer")}</p>
    </section>
  );
}
