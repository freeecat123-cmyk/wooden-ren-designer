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
  /** 匹配到的母件名稱（去重） */
  motherPartNames: string[];
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
  const motherNamesByKey: Map<string, Set<string>> = new Map();

  for (const part of design.parts) {
    for (const mortise of part.mortises) {
      for (const other of design.parts) {
        if (other.id === part.id) continue;
        for (const tenon of other.tenons) {
          const lengthMatch = Math.abs(tenon.length - mortise.depth) < 3;
          const wideTol = Math.max(5, tenon.width * 0.1);
          const wideMatch =
            Math.abs(tenon.width - mortise.length) < wideTol ||
            Math.abs(tenon.width - mortise.width) < wideTol;
          const thinMatch =
            Math.abs(tenon.thickness - mortise.width) < 3 ||
            Math.abs(tenon.thickness - mortise.length) < 3;
          if (lengthMatch && wideMatch && thinMatch) {
            const k = tenonKey(tenon);
            motherThicknessByKey.set(
              k,
              Math.min(
                part.visible.length,
                part.visible.width,
                part.visible.thickness,
              ),
            );
            // Strip instance numbers anywhere (椅腳 1 → 椅腳, 抽屜1 左側板 →
            // 抽屜 左側板) and collapse double spaces. With 4 identical legs
            // or 4 drawers this keeps the display compact.
            const displayName = part.nameZh
              .replace(/\d+/g, "")
              .replace(/\s+/g, " ")
              .trim();
            if (!motherNamesByKey.has(k)) motherNamesByKey.set(k, new Set());
            motherNamesByKey.get(k)!.add(displayName);
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
        // Prefer explicit matches; if none, guess by picking parts whose
        // smallest dim roughly equals the fallback mother thickness —
        // these are the most plausible mating pieces even when the
        // template author didn't declare reciprocal mortises.
        const explicit = motherNamesByKey.get(key);
        let motherPartNames: string[];
        if (explicit && explicit.size > 0) {
          motherPartNames = Array.from(explicit);
        } else {
          const targetThick = motherThickness;
          const candidates = design.parts
            .filter((q) => q.id !== part.id)
            .filter((q) => {
              const qDims = [q.visible.length, q.visible.width, q.visible.thickness];
              const qMin = Math.min(...qDims);
              return Math.abs(qMin - targetThick) < 3;
            })
            .map((q) => q.nameZh.replace(/\d+/g, "").replace(/\s+/g, " ").trim());
          const uniq = Array.from(new Set(candidates));
          motherPartNames = uniq.length > 0 ? uniq : [];
        }
        seen.set(key, {
          type: tenon.type,
          tenon,
          partId: part.id,
          partNameZh: part.nameZh,
          estimatedMotherThickness: motherThickness,
          childThickness,
          childWidth,
          count: 1,
          motherPartNames,
        });
      }
    }
  }

  return Array.from(seen.values());
}
