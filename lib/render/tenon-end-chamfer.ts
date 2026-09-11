import type { TenonPosition } from "@/lib/types";

/** Centered local-mm rings: shoulder, bevel start, and exposed tip. */
export function tenonEndChamferPoints(position: TenonPosition,
  box: { hx: number; hy: number; hz: number }, chamfer: number): Array<[number, number, number]> | undefined {
  if ((position !== "start" && position !== "end") || !Number.isFinite(chamfer) || chamfer <= 0) return;
  const { hx, hy, hz } = box;
  const c = Math.min(chamfer, hx, hy * 0.95, hz * 0.95);
  const sign = position === "end" ? 1 : -1;
  return ([-hx, hx - c, hx] as const).flatMap((x, i) => {
    const inset = i === 2 ? c : 0;
    return ([-1, 1] as const).flatMap(y => ([-1, 1] as const).map(z =>
      [sign * x, y * (hy - inset), z * (hz - inset)] as [number, number, number]));
  });
}
