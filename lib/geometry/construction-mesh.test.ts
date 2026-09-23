import { expect, it } from "vitest";
import { Box3, BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import type { FurnitureCategory, Part } from "@/lib/types";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { buildShapeGeometry, type ShapeSpec } from "@/lib/render/part-geometry";
import { subtractMortisesFromGeometry } from "@/lib/render/mortise-csg";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { constructionCutBox, constructionMatrix, constructionStockBounds } from "./construction-cuts";
import { findOverlaps } from "./overlap";

function design(category: FurnitureCategory, options: Record<string, string | number | boolean>) {
  const e = FURNITURE_CATALOG.find(e => e.category === category)!;
  return toBeginnerMode(e.template!({ ...e.defaults, material: "maple", options: { ...Object.fromEntries(e.optionSchema!.map(s => [s.key, s.defaultValue])), ...options, constructionVersion: "2" } }));
}
function mesh(part: Part, mode: "cut" | "missing" | "shifted" | "shallow") {
  const shape = part.shape?.kind === "splayed-round-tapered" ? { ...part.shape, dx: part.shape.dxMm, dz: part.shape.dzMm } : part.shape;
  const size: [number, number, number] = [part.visible.length, part.visible.thickness, part.visible.width];
  const base = buildShapeGeometry(shape as ShapeSpec, size) ?? new BoxGeometry(...size);
  const cutters = part.mortises.filter(m => constructionCutBox(m)).map(m => {
    const b = mortiseLocalBox(part, m);
    return { ...b, ...(mode === "shifted" ? { cx: b.cx + part.visible.length * 2 } : {}), ...(mode === "shallow" ? { hx: b.hx * 0.1, hy: b.hy * 0.1, hz: b.hz * 0.1 } : {}) };
  });
  const g = subtractMortisesFromGeometry(base, mode === "missing" ? [] : cutters, cutters.map(() => "rect"), { strict: true, unitsPerMm: 1 });
  if (g !== base) base.dispose();
  g.applyMatrix4(constructionMatrix(part));
  const mesh = new Mesh(g, new MeshBasicMaterial({ side: DoubleSide }));
  mesh.updateMatrixWorld();
  return mesh;
}
function inside(mesh: Mesh, p: Vector3) {
  // Horizontal rays avoid the internal caps of the multi-segment lathe mesh.
  const hits = new Raycaster(p, new Vector3(0.973, 0, 0.231).normalize()).intersectObject(mesh);
  return hits.filter((hit, i) => i === 0 || Math.abs(hit.distance - hits[i - 1].distance) > 1e-5).length % 2 === 1;
}
function commonWood(a: Mesh, b: Mesh, box: Box3) {
  let count = 0;
  for (const x of [0.15, 0.4, 0.65, 0.85]) for (const y of [0.15, 0.4, 0.65, 0.85]) for (const z of [0.15, 0.4, 0.65, 0.85]) {
    const p = new Vector3(box.min.x + x * (box.max.x - box.min.x), box.min.y + y * (box.max.y - box.min.y), box.min.z + z * (box.max.z - box.min.z));
    if (inside(a, p) && inside(b, p)) count++;
  }
  return count;
}
for (const [category, options] of [
  ["stool", { legShape: "curved-taper", ctTwoWay: true }],
  ["desk", { legShape: "splayed-round-tapered" }],
  ["round-table", { legShape: "pedestal" }],
] as [FurnitureCategory, Record<string, string | number | boolean>][]) {
  it(`${category}: real CSG clears every former collision; missing, shifted and undersized tools fail`, () => {
    const parts = design(category, options).parts;
    const oldPairs = findOverlaps(parts.map(p => ({ ...p, mortises: p.mortises.filter(m => !constructionCutBox(m)) })));
    expect(oldPairs.length).toBeGreaterThan(0);
    for (const mode of ["cut", "missing", "shifted", "shallow"] as const) {
      const meshes = new Map(parts.map(p => [p.id, mesh(p, mode)]));
      try {
        let badPairs = 0;
        for (const pair of oldPairs) {
          const a = parts.find(p => p.id === pair.a)!, b = parts.find(p => p.id === pair.b)!;
          const overlap = constructionStockBounds(a).intersect(constructionStockBounds(b));
          const count = commonWood(meshes.get(a.id)!, meshes.get(b.id)!, overlap);
          if (count > 0) badPairs++;
          if (mode === "cut") expect(count, `${a.id}/${b.id}`).toBe(0);
        }
        if (mode !== "cut") expect(badPairs).toBeGreaterThan(0);
        for (const p of parts.filter(p => p.mortises.some(m => constructionCutBox(m)))) {
          const g = meshes.get(p.id)!.geometry;
          expect(g.getAttribute("position").count).toBeGreaterThan(0);
          expect(Array.from(g.getAttribute("position").array).every(Number.isFinite)).toBe(true);
        }
      } finally { for (const m of meshes.values()) { m.geometry.dispose(); (m.material as MeshBasicMaterial).dispose(); } }
    }
  });
}

it("actual multi-slot meshes retain the protected post spines and pedestal hub", () => {
  for (const [category, options] of [
    ["desk", { legShape: "splayed-round-tapered" }],
    ["round-table", { legShape: "pedestal" }],
  ] as [FurnitureCategory, Record<string, string>][]) {
    for (const part of design(category, options).parts.filter(p => p.shape?.kind === "splayed-round-tapered" || p.id === "pedestal-column")) {
      const solid = mesh(part, "cut");
      try {
        const height = part.visible.thickness;
        for (let i = 0; i < 37; i++) {
          const fraction = (i + 0.37) / 37;
          const shape = part.shape;
          const radius = shape?.kind === "splayed-round-tapered"
            ? part.visible.length / 2 * (shape.bottomScale + (1 - shape.bottomScale) * fraction) : 0;
          const cx = shape?.kind === "splayed-round-tapered" ? shape.dxMm * (1 - fraction) + Math.sign(shape.dxMm || part.origin.x) * radius * 0.65 / Math.SQRT2 : 0;
          const cz = shape?.kind === "splayed-round-tapered" ? shape.dzMm * (1 - fraction) + Math.sign(shape.dzMm || part.origin.z) * radius * 0.65 / Math.SQRT2 : 0;
          const half = radius ? radius * 0.15 : part.visible.length * 0.15;
          for (const sx of [-0.99, 0, 0.99]) for (const sz of [-0.99, 0, 0.99]) {
            const point = new Vector3(cx + sx * half, height * (fraction - 0.5), cz + sz * half).applyMatrix4(constructionMatrix(part));
            expect(inside(solid, point), `${part.id} retained web at ${fraction}`).toBe(true);
          }
        }
      } finally { solid.geometry.dispose(); (solid.material as MeshBasicMaterial).dispose(); }
    }
  }
});
