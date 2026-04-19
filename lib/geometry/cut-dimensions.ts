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
  let length = part.visible.length;
  let width = part.visible.width;
  let thickness = part.visible.thickness;

  for (const tenon of part.tenons) {
    switch (tenon.position) {
      case "start":
      case "end":
        length += tenon.length;
        break;
      case "left":
      case "right":
        width += tenon.length;
        break;
      case "top":
      case "bottom":
        thickness += tenon.length;
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

  const start = tenons
    .filter((t) => startPositions.includes(t.position))
    .reduce((s, t) => s + t.length, 0);
  const end = tenons
    .filter((t) => endPositions.includes(t.position))
    .reduce((s, t) => s + t.length, 0);

  return { start, end };
}
