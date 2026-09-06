import type { Part } from "@/lib/types";
import { buildDovetailCutBrushes, dovetailCutsForPart } from "@/lib/render/mortise-csg";

/** Uses the actual renderer's cutter routing, not a furniture exception.
 * Dovetail stock has a centered interval at every Y/Z cross-section. The
 * renderer's 0.2mm outward X scaling contains that interval, hence A intersect
 * (B minus scaled A) is empty. Restrict to a positive central body. */
export function clearedByRenderedDovetail(tail: Part, receiver: Part): boolean {
  const shape = tail.shape;
  if (shape?.kind !== "dovetail-ends" || !Number.isFinite(shape.pinDepth)
    || shape.pinDepth <= 0 || shape.pinDepth >= tail.visible.length / 2
    || !Number.isFinite(shape.angleDeg) || shape.angleDeg < 0 || shape.angleDeg > 20
    || !Number.isInteger(shape.segmentCount) || shape.segmentCount < 1) return false;
  const cutters = buildDovetailCutBrushes([tail]);
  try { return (dovetailCutsForPart(receiver, cutters)?.length ?? 0) === 1; }
  finally {
    for (const { brush } of cutters) {
      brush.geometry.dispose();
      for (const material of Array.isArray(brush.material) ? brush.material : [brush.material]) material.dispose();
    }
  }
}
