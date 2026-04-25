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
  /** 母件斷面形狀（"round" 表示母件是圓 / 蓋圓 / 夏克風腳） */
  motherShape: "box" | "round";
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
  const motherShapeByKey: Map<string, "box" | "round"> = new Map();

  for (const part of design.parts) {
    for (const mortise of part.mortises) {
      for (const other of design.parts) {
        if (other.id === part.id) continue;
        // Skip mirror-pair matches: two parts with identical visible dims
        // are almost certainly mirrored (左側板/右側板). Their tenons/
        // mortises have the same numbers and would spuriously match each
        // other if we only used dimensional matching.
        const mirror =
          Math.abs(part.visible.length - other.visible.length) < 1 &&
          Math.abs(part.visible.width - other.visible.width) < 1 &&
          Math.abs(part.visible.thickness - other.visible.thickness) < 1;
        if (mirror) continue;
        for (const tenon of other.tenons) {
          const lengthMatch = Math.abs(tenon.length - mortise.depth) < 3;
          // Cross-section must match in a CONSISTENT orientation (wide edge
          // of the tenon maps to ONE specific edge of the mortise). Allowing
          // either axis to match the wide dim independently accepts false
          // positives — e.g., an internal divider passing extracted against
          // the top/bottom panel's side-panel groove purely because the
          // thin dim happened to be 6mm either way.
          // Fixed 9mm tolerance: excludes the 10mm false-positive gap
          // between a divider tongue (innerD-10) and the top/bottom
          // panel's side-mortise (innerD). Still accepts legitimate
          // 8mm slacks (side panel tongue + drawer-bottom tongue).
          const wideTol = 9;
          const thinTol = 3;
          const optionA =
            Math.abs(tenon.width - mortise.length) < wideTol &&
            Math.abs(tenon.thickness - mortise.width) < thinTol;
          const optionB =
            Math.abs(tenon.width - mortise.width) < wideTol &&
            Math.abs(tenon.thickness - mortise.length) < thinTol;
          if (lengthMatch && (optionA || optionB)) {
            const k = tenonKey(tenon);
            motherThicknessByKey.set(
              k,
              Math.min(
                part.visible.length,
                part.visible.width,
                part.visible.thickness,
              ),
            );
            // 偵測母件斷面形狀：圓 / 蓋圓 / 夏克風腳 = round
            const motherKind = part.shape?.kind;
            if (
              motherKind === "round" ||
              motherKind === "round-tapered" ||
              motherKind === "shaker"
            ) {
              motherShapeByKey.set(k, "round");
            } else if (!motherShapeByKey.has(k)) {
              motherShapeByKey.set(k, "box");
            }
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
        // Prefer explicit matches. If none, leave motherPartNames empty —
        // the UI will show the generic '母件' label. Earlier versions
        // heuristically listed every part with a similar thickness,
        // which produced noisy strings like
        // '頂板 / 底板 / 左側板 / 右側板 / 層板' for a simple leg tenon.
        const explicit = motherNamesByKey.get(key);
        const motherPartNames = explicit && explicit.size > 0
          ? Array.from(explicit)
          : [];
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
          motherShape: motherShapeByKey.get(key) ?? "box",
        });
      }
    }
  }

  return Array.from(seen.values());
}
