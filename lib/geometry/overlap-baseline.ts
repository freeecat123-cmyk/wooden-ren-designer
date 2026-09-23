import type { Overlap } from "./overlap";

export type OverlapBaseline = Record<string, Overlap[]>;
const pairKey = (overlap: Overlap) => JSON.stringify([overlap.a, overlap.b].sort());

/** A known case only exempts its recorded pairs, never an entire template. */
export function overlapRegressions(current: Overlap[], baseline: Overlap[]): string[] {
  const known = new Map(baseline.map(overlap => [pairKey(overlap), overlap]));
  return current.flatMap(overlap => {
    const previous = known.get(pairKey(overlap));
    if (!previous) return [`${overlap.a} × ${overlap.b}: new pair`];
    const increased = (["x", "y", "z"] as const).filter(axis =>
      !Number.isFinite(overlap.intersectionMm[axis]) || overlap.intersectionMm[axis] > previous.intersectionMm[axis] + 0.05,
    );
    return increased.length ? [`${overlap.a} × ${overlap.b}: increased ${increased.join(",")} overlap`] : [];
  });
}
