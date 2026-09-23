"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { STYLE_PRESETS } from "@/lib/knowledge/style-presets";
import { MATERIALS, materialName } from "@/lib/materials";
import type { MaterialId } from "@/lib/types";

export function StyleMismatchWarning() {
  const t = useTranslations("styleMismatch");
  const locale = useLocale();
  const sp = useSearchParams();
  const styleId = sp?.get("style");
  const materialId = sp?.get("material") as MaterialId | null;

  if (!styleId || !materialId) return null;
  const preset = STYLE_PRESETS[styleId];
  if (!preset) return null;
  if (preset.materials.includes(materialId)) return null;

  const presetMaterialNames = preset.materials
    .map((m) => (MATERIALS[m] ? materialName(m, locale) : m))
    .join(" / ");
  const currentMaterialName = MATERIALS[materialId]
    ? materialName(materialId, locale)
    : materialId;

  const presetName = locale === "en" && preset.nameEn ? preset.nameEn : preset.nameZh;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2.5">
      <div className="flex items-start gap-2 text-xs text-amber-900">
        <span className="text-base leading-none">⚠️</span>
        <div className="flex-1">
          <span className="font-medium">{presetName}</span>
          <span> {t("presetNameLbl")} </span>
          <span className="font-medium">{presetMaterialNames}</span>
          <span>{t("currentLblPre")} </span>
          <span className="font-medium text-amber-800">{currentMaterialName}</span>
          <span> {t("deviateSufTpl", { name: presetName })}</span>
          <div className="mt-1 text-[11px] text-amber-700">
            {t("sourcePre")}{preset.source}
          </div>
        </div>
      </div>
    </div>
  );
}
