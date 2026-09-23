import { describe, expect, it } from "vitest";
import { BoxGeometry, Mesh, Raycaster, Vector3 } from "three";
import { computeMeshVolume } from "three-bvh-csg";
import type { FurnitureDesign, Part } from "@/lib/types";
import type { ConstructionMortise } from "@/lib/geometry/construction-cuts";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { subtractMortisesFromGeometry } from "@/lib/render/mortise-csg";
import { buildGroup, partExportGeometry } from "./three-d-export";
import { buildFlatLayoutGroup } from "./flat-layout";

const stock = (): Part => {
  const mortise: ConstructionMortise = {
    // Deliberately not the face-derived location: explicit coordinates must win.
    origin: { x: 0, y: 0, z: 0 }, depth: 4, length: 8, width: 6,
    shape: "rect", cosmetic: true, through: false,
    constructionCut: { version: 2, box: { cx: 20, cy: 8, cz: 5, hx: 4, hy: 2, hz: 3, depthAxis: "y" } },
  };
  return { id: "construction-stock", nameZh: "stock", material: "white-oak", grainDirection: "length",
    visible: { length: 100, thickness: 20, width: 60 }, origin: { x: 20, y: 40, z: 10 },
    rotation: { x: 0.3, y: 0.4, z: 0.1 }, tenons: [], mortises: [mortise] } as Part;
};
describe("explicit construction-cut export integration", () => {
  it.each(["mortise-accurate", "joinery-accurate"] as const)("%s preserves the full explicit box and renderer volume", mode => {
    const p = stock(), m = p.mortises[0] as ConstructionMortise;
    const box = mortiseLocalBox(p, m);
    expect(box).toEqual(m.constructionCut.box);
    const preview = subtractMortisesFromGeometry(new BoxGeometry(1, 0.2, 0.6), [{ ...box,
      cx: box.cx * 0.01, cy: box.cy * 0.01, cz: box.cz * 0.01,
      hx: box.hx * 0.01, hy: box.hy * 0.01, hz: box.hz * 0.01 }], ["rect"]);
    const exported = partExportGeometry(p, mode);
    expect(computeMeshVolume(exported)).toBeCloseTo(120000 - 8 * 4 * 6, 1);
    const hit = new Raycaster(new Vector3(20, 50, 5), new Vector3(0, -1, 0)).intersectObject(new Mesh(exported))[0];
    expect(hit.distance).toBeCloseTo(44, 4);
    expect(computeMeshVolume(exported)).toBeCloseTo(computeMeshVolume(preview) / 0.01 ** 3, 1);
    const model = { category: "stool", parts: [p] } as FurnitureDesign;
    for (const build of [buildGroup, buildFlatLayoutGroup]) {
      expect(computeMeshVolume(build(model, 0.1, mode).children[0] as Mesh)).toBeCloseTo(119.808, 2);
    }
    expect(computeMeshVolume(partExportGeometry(p))).toBeCloseTo(120000, 1);
  });
  it("fails closed instead of reverting malformed explicit cuts to face heuristics", () => {
    const p = stock(); (p.mortises[0] as ConstructionMortise).constructionCut.box.hx = NaN;
    expect(() => partExportGeometry(p, "mortise-accurate")).toThrow(/construction/i);
    expect(() => partExportGeometry(p, "joinery-accurate")).toThrow(/construction/i);
  });
});
