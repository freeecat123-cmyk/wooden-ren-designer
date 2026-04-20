import type { FurnitureDesign, JoineryType, Tenon } from "@/lib/types";

export interface JoineryUsage {
  type: JoineryType;
  tenon: Tenon;
  /** 哪個零件上的這個榫頭 */
  partId: string;
  partNameZh: string;
  /** 推測的母件厚度（取設計裡所有同類型零件的中位數厚度） */
  estimatedMotherThickness: number;
  /** 公件（扛榫頭的那支）自身的斷面厚度（取零件最小邊） */
  childThickness: number;
  /** 公件（扛榫頭的那支）自身的斷面寬度（取零件中間邊） */
  childWidth: number;
  /** 重複次數（同樣參數的榫卯出現幾次） */
  count: number;
}

/**
 * Walk a design and extract unique joinery configurations for detail rendering.
 * Configurations are deduplicated by (type + length + width + thickness).
 */
export function extractJoineryUsages(design: FurnitureDesign): JoineryUsage[] {
  // Estimate mother thickness per joinery type by looking at parts with mortises
  // of the matching size. Fallback: average part thickness.
  const motherThicknessByType: Map<JoineryType, number> = new Map();

  for (const part of design.parts) {
    for (const mortise of part.mortises) {
      // Find a tenon in another part that fits this mortise
      for (const other of design.parts) {
        if (other.id === part.id) continue;
        for (const tenon of other.tenons) {
          if (
            Math.abs(tenon.length - mortise.depth) < 2 &&
            (Math.abs(tenon.width - mortise.length) < 2 ||
              Math.abs(tenon.width - mortise.width) < 2)
          ) {
            // Mother thickness for the detail drawing is the part's smallest
            // visible dim (the cross-section the tenon penetrates). For a leg
            // that's legSize, for a top/seat it's panel thickness — NOT the
            // part's full length.
            motherThicknessByType.set(
              tenon.type,
              Math.min(
                part.visible.length,
                part.visible.width,
                part.visible.thickness,
              ),
            );
          }
        }
      }
    }
  }

  const seen = new Map<string, JoineryUsage>();
  for (const part of design.parts) {
    for (const tenon of part.tenons) {
      const key = `${tenon.type}-${tenon.length}-${tenon.width}-${tenon.thickness}`;
      const motherThickness =
        motherThicknessByType.get(tenon.type) ?? tenon.length;
      // The tenon-carrier part's cross-section: min = "thickness", next = "width"
      const dims = [part.visible.length, part.visible.width, part.visible.thickness].sort(
        (a, b) => a - b,
      );
      const childThickness = dims[0];
      const childWidth = dims[1];
      const existing = seen.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(key, {
          type: tenon.type,
          tenon,
          partId: part.id,
          partNameZh: part.nameZh,
          estimatedMotherThickness: motherThickness,
          childThickness,
          childWidth,
          count: 1,
        });
      }
    }
  }

  return Array.from(seen.values());
}
