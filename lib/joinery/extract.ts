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
  // Estimate mother thickness for each UNIQUE joinery config (type + dims).
  // Different t&g joints in the same design can have different mother
  // thicknesses (case side = 18 vs drawer side = 14), so we can't just
  // key by type.
  const tenonKey = (t: { type: JoineryType; length: number; width: number; thickness: number }) =>
    `${t.type}-${t.length}-${t.width}-${t.thickness}`;
  const motherThicknessByKey: Map<string, number> = new Map();

  for (const part of design.parts) {
    for (const mortise of part.mortises) {
      for (const other of design.parts) {
        if (other.id === part.id) continue;
        for (const tenon of other.tenons) {
          const lengthMatch = Math.abs(tenon.length - mortise.depth) < 3;
          // Wide edge (tenon.width ↔ mortise.length OR mortise.width) — allow
          // 10% slack because drawer-bottom grooves have wider mortises than
          // their tongues.
          const wideTol = Math.max(5, tenon.width * 0.1);
          const wideMatch =
            Math.abs(tenon.width - mortise.length) < wideTol ||
            Math.abs(tenon.width - mortise.width) < wideTol;
          // Thin edge (tenon.thickness ↔ mortise.width OR mortise.length)
          const thinMatch =
            Math.abs(tenon.thickness - mortise.width) < 3 ||
            Math.abs(tenon.thickness - mortise.length) < 3;
          // Require all three to match (length + both cross-section dims) so
          // a spurious mortise elsewhere in the design doesn't get picked —
          // e.g., a case back panel must not resolve against a drawer-side
          // groove just because their tenon-length and thickness happen to
          // be close.
          if (lengthMatch && wideMatch && thinMatch) {
            // Mother thickness for the detail drawing is the grooved/drilled
            // part's smallest visible dim — the cross-section the tenon
            // actually penetrates (not the part's full length).
            motherThicknessByKey.set(
              tenonKey(tenon),
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

  // Collect panel-like parts' smallest cross-section for fallback.
  // "Panel-like" = longest / shortest > 3 (so it looks like a panel, not a stick).
  const panelThicknesses: number[] = [];
  for (const part of design.parts) {
    const dims = [part.visible.length, part.visible.width, part.visible.thickness];
    const shortest = Math.min(...dims);
    const longest = Math.max(...dims);
    if (longest / shortest > 3) panelThicknesses.push(shortest);
  }
  panelThicknesses.sort((a, b) => a - b);

  // Fallback when no explicit mortise matches this tenon. Prefer the LARGEST
  // panel that can physically accommodate the tenon (depth > tenonLength):
  // typical case is a back panel or similar whose groove is implied on the
  // case's main panels (18mm stock), not the smaller drawer-side stock (14mm).
  function fallbackMother(tenonLength: number): number {
    const candidates = panelThicknesses.filter((t) => t > tenonLength + 1);
    if (candidates.length === 0) {
      return panelThicknesses[panelThicknesses.length - 1] ?? tenonLength * 2;
    }
    return candidates[candidates.length - 1]; // largest (panelThicknesses is ascending)
  }

  const seen = new Map<string, JoineryUsage>();
  for (const part of design.parts) {
    for (const tenon of part.tenons) {
      const key = tenonKey(tenon);
      const motherThickness =
        motherThicknessByKey.get(key) ?? fallbackMother(tenon.length);
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
