import { expect, it } from "vitest";
import { shelfClearanceMortises } from "./shelf-clearance";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import type { Part } from "@/lib/types";
import { findOverlaps } from "./overlap";
import { teaTable, teaTableOptions } from "@/lib/templates/tea-table";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";

const shelf: Part = { id: "shelf", nameZh: "棚條", material: "maple", grainDirection: "length", visible: { length: 472, width: 60, thickness: 18 }, origin: { x: 0, y: 170, z: -109 }, tenons: [], mortises: [] };
const leg: Part = { ...shelf, id: "leg", visible: { length: 50, width: 50, thickness: 375 }, origin: { x: -225, y: 0, z: -150 } };
it("cuts the 36x14mm corner intersection plus 0.5mm internal clearance", () => {
  const [cut] = shelfClearanceMortises(shelf, [leg]);
  expect(cut.length).toBe(36.5);
  expect(cut.width).toBe(14.5);
  expect(cut.depth).toBe(18);
  expect(cut.origin).toEqual({ x: -217.75, y: 0, z: -22.75 });
  const box = mortiseLocalBox(shelf, cut);
  expect(box.hx * 2).toBe(36.5); expect(box.hz * 2).toBe(14.5); expect(box.hy * 2).toBe(18);
});
it("does not cut a leg outside the shelf or below it", () => {
  expect(shelfClearanceMortises(shelf, [{ ...leg, origin: { x: 600, y: 0, z: 600 } }])).toEqual([]);
  expect(shelfClearanceMortises(shelf, [{ ...leg, visible: { ...leg.visible, thickness: 170 } }])).toEqual([]);
});
it("preserves the cut footprint when the assembly is turned 90 degrees", () => {
  const rotatedShelf = { ...shelf, rotation: { x: 0, y: Math.PI / 2, z: 0 }, origin: { x: -109, y: 170, z: 0 } };
  const rotatedLeg = { ...leg, origin: { x: -150, y: 0, z: 225 } };
  const [cut] = shelfClearanceMortises(rotatedShelf, [rotatedLeg]);
  expect(cut.length).toBeCloseTo(36.5); expect(cut.width).toBeCloseTo(14.5);
  expect(mortiseLocalBox(rotatedShelf, cut).depthAxis).toBe("y");
});
it("removes only fully cleared collisions and catches missing or undersized cuts", () => {
  const cuts = shelfClearanceMortises(shelf, [leg]);
  expect(findOverlaps([shelf, leg])).toHaveLength(1);
  expect(findOverlaps([{ ...shelf, mortises: cuts }, leg])).toEqual([]);
  expect(findOverlaps([{ ...shelf, mortises: cuts.map(m => ({ ...m, length: 10 })) }, leg])).toHaveLength(1);
  expect(findOverlaps([{ ...shelf, mortises: cuts.map(m => ({ ...m, shape: "round" as const })) }, leg])).toHaveLength(1);
});

for (const variant of ["box", "tapered", "curved-taper", "curved-taper+ctTwoWay", "curved-taper+ctLowerCove", "curved-taper+ctTwoWay+ctLowerCove"]) {
  for (const shelfOrientation of ["length", "width"]) {
    it(`clears real tea-table slats: ${variant}, ${shelfOrientation}`, () => {
      const [legShape, ...flags] = variant.split("+");
      const options = Object.fromEntries(teaTableOptions.map(spec => [spec.key, spec.defaultValue]));
      Object.assign(options, { legShape, shelfOrientation }, Object.fromEntries(flags.map(flag => [flag, true])));
      const design = toBeginnerMode(teaTable({ length: 500, width: 350, height: 400, material: "maple", options }));
      const slats = design.parts.filter(part => part.id.startsWith("shelf-slat-"));
      expect(slats.length).toBeGreaterThan(0);
      expect(slats.flatMap(part => part.mortises)).toHaveLength(4);
      for (const slat of slats) {
        expect(slat.visible).toEqual({ length: shelfOrientation === "length" ? 472 : 322, width: 60, thickness: 18 });
      }
      const isLegSlat = (a: string, b: string) => [a, b].some(id => id.startsWith("leg-")) && [a, b].some(id => id.startsWith("shelf-slat-"));
      expect(findOverlaps(design.parts).filter(pair => isLegSlat(pair.a, pair.b))).toEqual([]);
      const uncut = design.parts.map(part => part.id.startsWith("shelf-slat-") ? { ...part, mortises: [] } : part);
      expect(findOverlaps(uncut).filter(pair => isLegSlat(pair.a, pair.b))).toHaveLength(4);
    });
  }
}
