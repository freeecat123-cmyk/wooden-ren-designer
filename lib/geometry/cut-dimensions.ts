import type { Dimensions, Part, Tenon } from "@/lib/types";

/**
 * Calculate the cut dimensions of a part.
 *
 * Rule: Tenons (公榫) extend beyond the visible/shoulder dimension and must be
 * added to the cut length. Mortises (母榫) are cavities and do NOT change the
 * cut dimensions.
 *
 * Tenon position determines which dimension grows:
 *  - start/end: length
 *  - left/right: width
 *  - top/bottom: thickness (rare; e.g. tongue on a panel edge)
 */
export function calculateCutDimensions(part: Part): Dimensions {
  // 若 part 有 joineryView.visible（榫接版專用幾何，例如 45° miter 延伸過 base 重疊區），
  // 那才是「實際下料尺寸」——組裝版 visible 只是簡化視覺，物理材料以 joineryView 為準。
  const phys = part.joineryView?.visible ?? part.visible;
  let length = phys.length;
  let width = phys.width;
  let thickness = phys.thickness;

  // 同一端可能有多支榫頭（雙榫頭 / 三榫頭，2026-09-07 技能檢定上層板每端兩支 20 寬），
  // 它們從同一個端面伸出去，切料只要加**那一端最長的那支**一次；逐支相加會把
  // 264+28+28 的板算成 376（實際 320）。每個 position 取 max。
  const maxByPosition = new Map<Tenon["position"], number>();
  for (const tenon of part.tenons) {
    maxByPosition.set(tenon.position, Math.max(maxByPosition.get(tenon.position) ?? 0, tenon.length));
  }
  for (const [position, len] of maxByPosition) {
    switch (position) {
      case "start":
      case "end":
        length += len;
        break;
      case "left":
      case "right":
        width += len;
        break;
      case "top":
      case "bottom":
        thickness += len;
        break;
    }
  }

  return { length, width, thickness };
}

/**
 * Sum of tenon protrusions for a single dimension axis. Used by SVG renderers
 * that need the shoulder positions independent of total cut length.
 */
export function tenonAllowance(
  tenons: Tenon[],
  axis: "length" | "width" | "thickness",
): { start: number; end: number } {
  const startPositions: Tenon["position"][] =
    axis === "length"
      ? ["start"]
      : axis === "width"
        ? ["left"]
        : ["bottom"];
  const endPositions: Tenon["position"][] =
    axis === "length"
      ? ["end"]
      : axis === "width"
        ? ["right"]
        : ["top"];

  // 同一端多支榫頭（雙榫頭）從同一端面伸出，取最長的那支，不相加（同 calculateCutDimensions）
  const start = tenons
    .filter((t) => startPositions.includes(t.position))
    .reduce((s, t) => Math.max(s, t.length), 0);
  const end = tenons
    .filter((t) => endPositions.includes(t.position))
    .reduce((s, t) => Math.max(s, t.length), 0);

  return { start, end };
}
