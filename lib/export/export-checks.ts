import type { FurnitureDesign } from "@/lib/types";

/** 低於此值的零件在一般 FDM 印表機（0.4mm 噴嘴）幾乎印不出來 */
export const MIN_PRINTABLE_MM = 0.8;

export interface MinThicknessResult {
  /** 最薄零件縮放後的最小維度（mm）；無零件時為 Infinity */
  thinnestMm: number;
  /** 該零件中文名（nameZh 優先，否則 id）；無零件時為空字串 */
  partName: string;
}

/**
 * 找出設計中「最薄」的零件——取每個非 visual 零件三維中的最小值，
 * 全體再取最小，乘上匯出比例。用來提醒使用者選的比例會不會印不出來。
 */
export function analyzeMinThickness(
  design: FurnitureDesign,
  scale: number,
): MinThicknessResult {
  let thinnest = Infinity;
  let partName = "";
  for (const part of design.parts) {
    if (part.visual) continue;
    const dim = Math.min(
      part.visible.length,
      part.visible.thickness,
      part.visible.width,
    );
    if (dim < thinnest) {
      thinnest = dim;
      partName = part.nameZh || part.id;
    }
  }
  return { thinnestMm: thinnest * scale, partName };
}
