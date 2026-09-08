import { expect, it } from "vitest";
import { certB1Assembly, certB1FrontProfile } from "./cert-b1";
import { buildEdgeProfileGeometry } from "@/lib/render/part-geometry";
import { projectPartSilhouette } from "@/lib/render/geometry";
import { readFileSync } from "node:fs";
import { mortiseLocalBox } from "@/lib/render/svg-views";

it("builds the fixed exam envelope and individual drawer boards", () => {
  const d = certB1Assembly();
  expect(d.overall).toEqual({ length: 450, width: 450, thickness: 450 });
  expect(d.parts.some(p => p.visual === "glass")).toBe(false);
  for (const id of ["drawer-front", "drawer-back", "drawer-side-left", "drawer-side-right", "drawer-bottom", "front-rail"]) {
    expect(d.parts.find(p => p.id === id), id).toBeDefined();
  }
  expect(d.parts.find(p => p.id === "drawer-front")?.visible).toEqual({ length: 340, width: 103, thickness: 18 });
  expect(d.parts.find(p => p.id === "drawer-back")?.visible.width).toBe(80);
  expect(d.parts.find(p => p.id === "drawer-side-left")?.visible.width).toBe(100);
  expect(d.parts.find(p => p.id === "drawer-bottom")?.visible.thickness).toBe(4);
});

it("keeps drawer clearance, functional grooves and the centered finger hole", () => {
  const d = certB1Assembly();
  const front = d.parts.find(p => p.id === "drawer-front")!;
  expect(front.origin).toEqual({ x: 0, y: 327, z: -186 });
  expect(front.mortises.some(m => m.shape === "round" && m.length === 20 && m.through)).toBe(true);
  for (const p of d.parts.filter(p => p.id.startsWith("drawer-side"))) {
    expect(p.origin.y).toBe(327);
    expect(p.mortises.map(m => m.depth).sort()).toEqual([7, 8]);
  }
  expect(d.parts.find(p => p.id === "drawer-bottom")?.origin.y).toBe(338);
});

it("uses a tangent R15 S transition after each 70mm flat shoulder", () => {
  const points = certB1FrontProfile();
  expect(points).toContainEqual([-173, 30]);
  expect(points).toContainEqual([-103, 30]);
  expect(points).toContainEqual([103, 30]);
  expect(points).toContainEqual([173, 30]);
  expect(points.some(([x, z]) => Math.abs(x) < 75 && z === 10)).toBe(true);
  expect(Math.min(...points.map(p => p[1]))).toBe(-30);
  expect(Math.max(...points.map(p => p[1]))).toBe(30);
});

it("preserves the actual curved profile in the mesh and front projection", () => {
  const p = certB1Assembly().parts.find(p => p.id === "front-rail")!;
  const g = buildEdgeProfileGeometry([346, 18, 60], "kunmen", 20, 4, 1, 1, certB1FrontProfile());
  g.computeBoundingBox();
  expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBe(346);
  const silhouette = projectPartSilhouette(p, "front");
  expect(silhouette.length).toBe(certB1FrontProfile().length);
  expect(silhouette.every(v => Number.isFinite(v.x) && Number.isFinite(v.y))).toBe(true);
  const positions = g.getAttribute("position");
  expect(Array.from({ length: positions.count }, (_, i) => [positions.getX(i), positions.getZ(i)])
    .some(([x, z]) => Math.abs(x + 103) < 0.001 && Math.abs(z - 30) < 0.001)).toBe(true);
  g.dispose();
});

it("scales explicit profile points into preview units without changing export millimeters", () => {
  const preview = readFileSync("components/PerspectiveView.tsx", "utf8");
  expect(preview).toContain("profilePoints: part.shape.profilePoints?.map(([x, z]) => [x * SCALE, z * SCALE])");
  expect(readFileSync("lib/export/three-d-export.ts", "utf8")).toContain("profilePoints: shape.profilePoints");
});

it("cuts the rail top rebate 4mm downward and 6mm inward", () => {
  const p = certB1Assembly().parts.find(p => p.id === "front-rail")!;
  const b = mortiseLocalBox(p, p.mortises[0]);
  expect([b.cx, b.cy, b.cz, b.hx, b.hy, b.hz]).toEqual([0, -6, -28, 173, 3, 2]);
});
