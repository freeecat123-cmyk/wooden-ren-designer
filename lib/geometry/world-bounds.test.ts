import { expect, it } from "vitest";
import type { Part } from "@/lib/types";
import { worldAABB, findOverlaps } from "./overlap";
import { partAabbAtY, precomputeSilhouettes } from "./y-slice";

const box: Part = {
  id: "box", nameZh: "Box", material: "maple", grainDirection: "length",
  visible: { length: 40, width: 20, thickness: 30 },
  origin: { x: 80, y: 10, z: 100 }, tenons: [], mortises: [],
};

it("keeps a translated box's world bounds at its real Z position", () => {
  expect(worldAABB(box)).toEqual({ min: { x: 60, y: 10, z: 90 }, max: { x: 100, y: 40, z: 110 } });
});

it("converts a side silhouette back to world Z without mirroring it", () => {
  for (const z of [-100, 100]) {
    const { front, side } = precomputeSilhouettes({ ...box, origin: { ...box.origin, z } });
    expect(partAabbAtY(front, side, 25)).toEqual({ x: [60, 100], z: [z - 10, z + 10] });
  }
});

it("preserves intersection depth under translation and rejects separated boxes", () => {
  const other = { ...box, id: "other", origin: { x: 90, y: 20, z: 105 } };
  const expected = { x: 30, y: 20, z: 15 };
  for (const dz of [-200, 0, 500]) {
    const parts = [box, other].map(p => ({ ...p, origin: { ...p.origin, z: p.origin.z + dz } }));
    expect(findOverlaps(parts)[0]?.intersectionMm).toEqual(expected);
  }
  expect(findOverlaps([box, { ...other, origin: { ...other.origin, z: -100 } }])).toEqual([]);
});
