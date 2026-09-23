"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { categoryLabel } from "@/lib/templates/labels";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { materialName } from "@/lib/materials";

export function AskMasterButton({
  category,
  defaults,
}: {
  category: FurnitureCategory;
  defaults: { length: number; width: number; height: number };
}) {
  const t = useTranslations("askMaster");
  const tFurn = useTranslations("furniture");
  const locale = useLocale();
  const sp = useSearchParams();
  const [copied, setCopied] = useState(false);

  const buildQuestion = (): string => {
    const tmplName = (() => {
      try {
        return tFurn(category);
      } catch {
        return categoryLabel(category, locale);
      }
    })();

    const length = sp?.get("length") ?? defaults.length;
    const width = sp?.get("width") ?? defaults.width;
    const height = sp?.get("height") ?? defaults.height;
    const materialId = (sp?.get("material") ?? "douglas-fir") as MaterialId;
    const matName = materialName(materialId, locale);
    const legShape = sp?.get("legShape");
    const legSize = sp?.get("legSize");
    const apronWidth = sp?.get("apronWidth");
    const splayAngle = sp?.get("splayAngle");
    const backStyle = sp?.get("backStyle");
    const seatProfile = sp?.get("seatProfile");
    const joinery = sp?.get("joineryMode");

    const parts: string[] = [];
    parts.push(t("introTpl", { name: tmplName }));
    parts.push(t("dimTpl", { l: length, w: width, h: height }));
    parts.push(t("matTpl", { name: matName }));
    if (legShape) {
      if (legSize) {
        parts.push(t("legShapeWithSizeTpl", { shape: legShape, size: legSize }));
      } else {
        parts.push(t("legShapeTpl", { shape: legShape }));
      }
    }
    if (apronWidth) parts.push(t("apronTpl", { h: apronWidth }));
    if (splayAngle && splayAngle !== "0") parts.push(t("splayTpl", { angle: splayAngle }));
    if (backStyle) parts.push(t("backStyleTpl", { style: backStyle }));
    if (seatProfile && seatProfile !== "flat") parts.push(t("seatProfileTpl", { profile: seatProfile }));
    if (joinery === "true") parts.push(t("joineryNote"));

    parts.push("");
    parts.push(t("tail"));
    return parts.join("\n");
  };

  const handleClick = async () => {
    const question = buildQuestion();
    try {
      await navigator.clipboard.writeText(question);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      window.prompt(t("fallbackPromptTitle"), question);
    }
    window.open("https://t.me/woodenren_bot", "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-emerald-50 hover:ring-emerald-400 transition"
      title={t("btnTitle")}
    >
      <span>💬</span>
      <span>{copied ? t("btnCopied") : t("btnIdle")}</span>
    </button>
  );
}
