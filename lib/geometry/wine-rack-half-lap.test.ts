import { expect, it } from "vitest";
import { Euler, Vector3 } from "three";
import { wineRack, wineRackOptions } from "@/lib/templates/wine-rack";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { worldExtents } from "@/lib/render/geometry";
import type { Part } from "@/lib/types";
import { findOverlaps } from "./overlap";

type Bounds = { min: number[]; max: number[] };

// Exact for these quarter-turn rectangular parts, not arbitrary curved solids.
function worldBox(part: Part, center: number[], half: number[]): Bounds {
  const r = part.rotation;
  // Match PerspectiveView's explicit Euler order, not Three.js's default.
  const rotation = new Euler(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0, "ZYX");
  const offset = new Vector3(part.origin.x, part.origin.y + worldExtents(part).yExt / 2, part.origin.z);
  const corners: number[][] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    corners.push(new Vector3(center[0] + x * half[0], center[1] + y * half[1], center[2] + z * half[2]).applyEuler(rotation).add(offset).toArray());
  }
  return { min: [0, 1, 2].map(axis => Math.min(...corners.map(p => p[axis]))), max: [0, 1, 2].map(axis => Math.max(...corners.map(p => p[axis]))) };
}

function partBox(part: Part): Bounds {
  return worldBox(part, [0, 0, 0], [part.visible.length / 2, part.visible.thickness / 2, part.visible.width / 2]);
}

function cuts(part: Part): Bounds[] {
  return part.mortises.filter(m => m.cosmetic && m.through && m.shape !== "round" && !m.rotX && !m.rotY && !m.rotZ).map(m => {
    const b = mortiseLocalBox(part, m);
    return worldBox(part, [b.cx, b.cy, b.cz], [b.hx, b.hy, b.hz]);
  });
}

function validatePair(shelf: Part, divider: Part) {
  const a = partBox(shelf), b = partBox(divider);
  const overlap = { min: a.min.map((v, i) => Math.max(v, b.min[i])), max: a.max.map((v, i) => Math.min(v, b.max[i])) };
  expect(overlap.max.every((v, i) => v > overlap.min[i])).toBe(true);
  const coversXY = (cut: Bounds) => [0, 1].every(i => cut.min[i] <= overlap.min[i] + 1e-6 && cut.max[i] >= overlap.max[i] - 1e-6);
  const ac = cuts(shelf).filter(coversXY), bc = cuts(divider).filter(coversXY);
  expect(ac).toHaveLength(1);
  expect(bc).toHaveLength(1);
  const halves = [ac[0], bc[0]].sort((x, y) => x.min[2] - y.min[2]);
  const middle = (overlap.min[2] + overlap.max[2]) / 2;
  expect(halves[0].min[2]).toBeCloseTo(overlap.min[2], 6);
  expect(halves[0].max[2]).toBeCloseTo(middle, 6);
  expect(halves[1].min[2]).toBeCloseTo(middle, 6);
  expect(halves[1].max[2]).toBeCloseTo(overlap.max[2], 6);
}

function build(legShape = "box", bottlesWide = 4, bottlesTall = 3, panelThickness = 15) {
  const options = Object.fromEntries(wineRackOptions.map(spec => [spec.key, spec.defaultValue]));
  Object.assign(options, { legShape, bottlesWide, bottlesTall, panelThickness });
  const design = toBeginnerMode(wineRack({ length: 600, width: 280, height: 600, material: "maple", options }));
  return { shelves: design.parts.filter(p => p.id.startsWith("shelf-h-")), dividers: design.parts.filter(p => p.id.startsWith("divider-v-")) };
}

for (const legShape of ["box", "tapered", "round", "round-tapered", "bracket", "plinth", "panel-side"]) {
  for (const [wide, tall, thickness] of [[4, 3, 15], [2, 2, 12], [8, 6, 25]]) {
    it(`has complementary world-space cuts: ${legShape}, ${wide}x${tall}, ${thickness}mm`, () => {
      const { shelves, dividers } = build(legShape, wide, tall, thickness);
      expect(shelves).toHaveLength(tall - 1);
      expect(dividers).toHaveLength(wide - 1);
      for (const shelf of shelves) for (const divider of dividers) validatePair(shelf, divider);
      expect(findOverlaps([...shelves, ...dividers])).toEqual([]);
    });
  }
}

it("rejects a missing, vertically shifted, or same-side divider cut", () => {
  const { shelves, dividers } = build();
  const shelf = shelves[0], divider = dividers[0];
  expect(findOverlaps([shelf, { ...divider, mortises: [] }])).toHaveLength(1);
  expect(() => validatePair(shelf, { ...divider, mortises: [] })).toThrow();
  for (const mode of ["shift", "same-side"]) {
    const mortises = divider.mortises.map(m => ({ ...m, origin: { ...m.origin, ...(mode === "shift" ? { z: m.origin.z + 7.5 } : { x: -m.origin.x }) } }));
    expect(() => validatePair(shelf, { ...divider, mortises })).toThrow();
    expect(findOverlaps([shelf, { ...divider, mortises }])).toHaveLength(1);
  }
});
