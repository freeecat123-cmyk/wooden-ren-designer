import { expect, it } from "vitest";
import type { Part } from "@/lib/types";
import { findOverlaps } from "./overlap";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { buildNotchedCornersGeometry } from "@/lib/render/part-geometry";
import { DoubleSide, FrontSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";

const shelf: Part = { id: "shelf", nameZh: "Shelf", material: "maple", grainDirection: "length", visible: { length: 400, width: 200, thickness: 18 }, origin: { x: 0, y: 100, z: 0 }, tenons: [], mortises: [], shape: { kind: "notched-corners", notchLengthMm: 40, notchWidthMm: 30 } };
const leg: Part = { id: "leg", nameZh: "Leg", material: "maple", grainDirection: "length", visible: { length: 40, width: 30, thickness: 200 }, origin: { x: 180, y: 0, z: 85 }, tenons: [], mortises: [] };

it("recognizes all four actual corner cutouts", () => {
  for (const x of [-180, 180]) for (const z of [-85, 85]) {
    expect(findOverlaps([shelf, { ...leg, origin: { x, y: 0, z } }])).toEqual([]);
  }
});
it("still detects missing, undersized and centrally placed cuts", () => {
  expect(findOverlaps([{ ...shelf, shape: undefined }, leg])).toHaveLength(1);
  expect(findOverlaps([{ ...shelf, shape: { kind: "notched-corners", notchLengthMm: 20, notchWidthMm: 30 } }, leg])).toHaveLength(1);
  expect(findOverlaps([shelf, { ...leg, origin: { x: 0, y: 0, z: 0 } }])).toHaveLength(1);
});
it("keeps ambiguous oversized cutouts flagged", () => {
  const oversized: Part = { ...shelf, shape: { kind: "notched-corners", notchLengthMm: 400, notchWidthMm: 200 } };
  expect(findOverlaps([oversized, leg])).toHaveLength(1);
});

it("matches the actual 3D mesh: empty corners and solid center", () => {
  const geometry = buildNotchedCornersGeometry([400, 18, 200], 40, 30);
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  try {
    for (const x of [-180, 180]) for (const z of [-85, 85]) {
      expect(new Raycaster(new Vector3(x, 50, z), new Vector3(0, -1, 0)).intersectObject(mesh)).toHaveLength(0);
    }
    expect(new Raycaster(new Vector3(0, 50, 0), new Vector3(0, -1, 0)).intersectObject(mesh).length).toBeGreaterThan(0);
    material.side = FrontSide;
    for (const sign of [-1, 1]) {
      const hits = new Raycaster(new Vector3(0, sign * 50, 0), new Vector3(0, -sign, 0)).intersectObject(mesh);
      expect(hits[0]?.point.y).toBeCloseTo(sign * 9);
    }
    const positions = geometry.getAttribute("position");
    const indices = geometry.getIndex()!;
    let capArea = 0;
    for (let i = 0; i < indices.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(positions, indices.getX(i + offset)));
      if (a.y === b.y && b.y === c.y) capArea += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    expect(capArea).toBeCloseTo(150400);
  } finally { geometry.dispose(); material.dispose(); }
});

for (const overrides of [
  { deadman: true, lowerStretcherArrangement: "box-frame" },
  { topSplit: "gap", frontVise: "leg", knockdown: "bolt" },
  { legDepth: 75, withApron: true },
  { materialStyle: "plywood", frontVise: "leg", legLayers: 3 },
]) {
  it(`recognizes real workbench shelf cuts: ${JSON.stringify(overrides)}`, () => {
    const entry = FURNITURE_CATALOG.find(e => e.category === "workbench")!;
    const options = Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue]));
    Object.assign(options, overrides, { withUnderShelf: true });
    const design = toBeginnerMode(entry.template!({ ...entry.defaults, material: "maple", options }));
    const shelf = design.parts.find(p => p.id === "under-shelf")!;
    expect(shelf.shape?.kind).toBe("notched-corners");
    const parts = [shelf, ...design.parts.filter(p => /^leg-\d+$/.test(p.id))];
    expect(parts).toHaveLength(5);
    expect(findOverlaps(parts)).toEqual([]);
    expect(findOverlaps(parts.map(p => p.id === shelf.id ? { ...p, shape: undefined } : p))).toHaveLength(4);
  });
}
