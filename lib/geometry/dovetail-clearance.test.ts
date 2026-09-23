import { expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { findOverlaps } from "./overlap";
import { BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { buildShapeGeometry, type ShapeSpec } from "@/lib/render/part-geometry";
import { buildDovetailCutBrushes, dovetailCutsForPart, subtractDovetailReceiverGeometry } from "@/lib/render/mortise-csg";
import { constructionMatrix, constructionStockBounds } from "./construction-cuts";

it("recognizes actual receiver subtraction, not arbitrary box-wall names", () => {
  const e = FURNITURE_CATALOG.find(e => e.category === "dovetail-box")!;
  const d = toBeginnerMode(e.template!({ ...e.defaults, material: "maple" }));
  expect(findOverlaps(d.parts)).toEqual([]);
  const front = d.parts.find(p => p.id === "wall-front")!;
  const left = d.parts.find(p => p.id === "wall-left")!;
  expect(findOverlaps([{ ...front, shape: undefined }, left])).toHaveLength(1);
  expect(findOverlaps([front, { ...left, id: "not-a-receiver" }])).toHaveLength(1);
  expect(findOverlaps([{ ...front, id: "wall-front-lid" }, left])).toHaveLength(1);
});

it("all four receiver CSG meshes exclude actual tails; missing/shifted cuts restore shared wood", () => {
  const e = FURNITURE_CATALOG.find(e => e.category === "dovetail-box")!;
  const d = toBeginnerMode(e.template!({ ...e.defaults, material: "maple" }));
  const inside = (mesh: Mesh, point: Vector3) => {
    const hits = new Raycaster(point, new Vector3(0.813, 0.217, 0.417).normalize()).intersectObject(mesh);
    return hits.filter((hit, i) => i === 0 || Math.abs(hit.distance - hits[i - 1].distance) > 1e-5).length % 2 === 1;
  };
  for (const tail of d.parts.filter(p => p.shape?.kind === "dovetail-ends")) {
    for (const receiver of d.parts.filter(p => ["wall-left", "wall-right"].includes(p.id))) {
      for (const mode of ["correct", "missing", "shifted"]) {
        const brushes = buildDovetailCutBrushes([tail], 1);
        if (mode === "shifted") brushes[0].brush.geometry.translate(0, 0, 50);
        const base = new BoxGeometry(receiver.visible.length, receiver.visible.thickness, receiver.visible.width);
        const cuts = dovetailCutsForPart(receiver, brushes)!;
        const receiverGeometry = mode === "missing" ? base.clone().applyMatrix4(constructionMatrix(receiver))
          : subtractDovetailReceiverGeometry(base, constructionMatrix(receiver), cuts, 1);
        base.dispose();
        const tailGeometry = buildShapeGeometry(tail.shape as ShapeSpec, [tail.visible.length, tail.visible.thickness, tail.visible.width])!;
        tailGeometry.applyMatrix4(constructionMatrix(tail));
        const a = new Mesh(tailGeometry, new MeshBasicMaterial({ side: DoubleSide }));
        const b = new Mesh(receiverGeometry, new MeshBasicMaterial({ side: DoubleSide }));
        a.updateMatrixWorld(); b.updateMatrixWorld();
        try {
          const box = constructionStockBounds(tail).intersect(constructionStockBounds(receiver));
          let common = 0, tailWood = 0;
          for (const x of [0.12, 0.43, 0.74]) for (const y of [0.12, 0.27, 0.43, 0.58, 0.74, 0.89]) for (const z of [0.12, 0.43, 0.74]) {
            const p = new Vector3(box.min.x + x * (box.max.x - box.min.x), box.min.y + y * (box.max.y - box.min.y), box.min.z + z * (box.max.z - box.min.z));
            if (inside(a, p)) { tailWood++; if (inside(b, p)) common++; }
          }
          expect(tailWood).toBeGreaterThan(0);
          if (mode === "correct") expect(common).toBe(0);
          else expect(common).toBeGreaterThan(0);
        } finally {
          for (const mesh of [a, b]) { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); }
          for (const { brush } of brushes) { brush.geometry.dispose(); (brush.material as MeshBasicMaterial).dispose(); }
        }
      }
    }
  }
});
