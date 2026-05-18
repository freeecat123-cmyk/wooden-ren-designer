import { describe, it, expect } from "vitest";
import { computeCompoundSplayNormal } from "../_helpers";

const closeTo = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe("computeCompoundSplayNormal", () => {
  it("returns +X axis for X-apron when splayAngle=0", () => {
    const n = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: +1, cornerSz: -1, splayAngleDeg: 0,
    });
    expect(closeTo(n.x, 1)).toBe(true);
    expect(closeTo(n.y, 0)).toBe(true);
    expect(closeTo(n.z, 0)).toBe(true);
  });

  it("tilts X-apron tenon along +X with downward Y component for compound splay", () => {
    const n = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: +1, cornerSz: -1, splayAngleDeg: 8,
    });
    expect(n.x).toBeGreaterThan(0.95);
    expect(n.y).toBeLessThan(0);
    expect(closeTo(n.z, 0, 1e-6)).toBe(true);
    const mag = Math.hypot(n.x, n.y, n.z);
    expect(closeTo(mag, 1, 1e-9)).toBe(true);
  });

  it("mirrors X component sign at opposite corner", () => {
    const right = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: +1, cornerSz: -1, splayAngleDeg: 8,
    });
    const left = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: -1, cornerSz: -1, splayAngleDeg: 8,
    });
    expect(closeTo(right.x, -left.x, 1e-9)).toBe(true);
    expect(closeTo(right.y, left.y, 1e-9)).toBe(true);
  });

  it("Z-apron has Z component, no X component", () => {
    const n = computeCompoundSplayNormal({
      apronAxis: "z", cornerSx: -1, cornerSz: +1, splayAngleDeg: 8,
    });
    expect(closeTo(n.x, 0, 1e-6)).toBe(true);
    expect(n.z).toBeGreaterThan(0.95);
    expect(n.y).toBeLessThan(0);
  });

  it("degenerates to single-axis when cornerSz=0", () => {
    const n = computeCompoundSplayNormal({
      apronAxis: "x", cornerSx: +1, cornerSz: 0, splayAngleDeg: 8,
    });
    expect(n.x).toBeGreaterThan(0.95);
    expect(closeTo(n.z, 0, 1e-6)).toBe(true);
  });
});
