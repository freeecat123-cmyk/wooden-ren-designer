import { expect, it } from "vitest";
import { BoxGeometry, BufferGeometry, DoubleSide, Euler, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { buildShapeGeometry, type ShapeSpec } from "@/lib/render/part-geometry";
import { subtractMortisesFromGeometry } from "@/lib/render/mortise-csg";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { projectPartSilhouette, worldExtents } from "@/lib/render/geometry";
import type { FurnitureCategory, Part } from "@/lib/types";
import { findOverlaps } from "./overlap";
import { separatedFromTurnedColumn } from "./turned-column-clearance";

function build(category: FurnitureCategory, options: Record<string, string | number | boolean> = {}) {
  const e = FURNITURE_CATALOG.find(e => e.category === category)!;
  return toBeginnerMode(e.template!({ ...e.defaults, material: "maple", options }));
}
function geometry(part: Part) {
  const size: [number, number, number] = [part.visible.length, part.visible.thickness, part.visible.width];
  const shape = part.shape?.kind === "splayed-round-tapered"
    ? { ...part.shape, dx: part.shape.dxMm, dz: part.shape.dzMm } : part.shape;
  return buildShapeGeometry(shape as ShapeSpec, size) ?? new BoxGeometry(...size);
}
function worldVertices(part: Part) {
  const g = geometry(part), a = g.getAttribute("position");
  const r = new Euler(part.rotation?.x ?? 0, part.rotation?.y ?? 0, part.rotation?.z ?? 0, "ZYX");
  const offset = new Vector3(part.origin.x, part.origin.y + worldExtents(part).yExt / 2, part.origin.z);
  const result = Array.from({ length: a.count }, (_, i) => new Vector3().fromBufferAttribute(a, i).applyEuler(r).add(offset));
  g.dispose();
  return result;
}
function occupied(g: BufferGeometry, p: Vector3) {
  const mat = new MeshBasicMaterial({ side: DoubleSide }), mesh = new Mesh(g, mat);
  mesh.updateMatrixWorld();
  const hits = new Raycaster(p, new Vector3(0.973, 0.117, 0.199).normalize()).intersectObject(mesh);
  const distances = hits.map(h => h.distance).filter((d, i, all) => i === 0 || Math.abs(d - all[i - 1]) > 1e-6);
  mat.dispose();
  return distances.length % 2 === 1;
}

it("deadman relief removes the rear cheek only; missing/shallow/shifted cutters remain solid", () => {
  const d = build("workbench", { deadman: true, withUnderShelf: true, lowerStretcherArrangement: "box-frame", constructionVersion: "2" });
  const board = d.parts.find(p => p.id === "deadman-board")!;
  const relief = board.mortises.find(m => m.label === "滑板後側避層板槽")!;
  const b = mortiseLocalBox(board, relief);
  // 18mm shelf - 14mm ridge/board offset + 0.5 clearance = 4.5mm high.
  expect([b.cx, b.cz, b.hx, b.hy, b.hz]).toEqual([0, 16, 90, 2.25, 4]);
  for (const patch of ["correct", "missing", "shallow", "shifted"] as const) {
    const cutter = { ...b, ...(patch === "shallow" ? { hy: 0.5 } : {}), ...(patch === "shifted" ? { cz: -16 } : {}) };
    const base = geometry(board);
    const cut = subtractMortisesFromGeometry(base, patch === "missing" ? [] : [cutter], ["rect"], { unitsPerMm: 1, strict: true });
    try {
      for (const x of [-80, 0, 80]) {
        expect(occupied(cut, new Vector3(x, -board.visible.thickness / 2 + 3.5, 17))).toBe(patch !== "correct");
        expect(occupied(cut, new Vector3(x, -board.visible.thickness / 2 + 8, 17))).toBe(true);
        expect(occupied(cut, new Vector3(x, -board.visible.thickness / 2 + 3.5, -17))).toBe(patch !== "shifted");
      }
    } finally { if (cut !== base) cut.dispose(); base.dispose(); }
  }
});

it("front/back dovetail wall rebate meshes are empty at the lid; removed cuts are solid", () => {
  const d = build("dovetail-box");
  for (const wall of d.parts.filter(p => ["wall-front", "wall-back"].includes(p.id))) {
    const b = mortiseLocalBox(wall, wall.mortises.find(m => m.label === "滑蓋槽")!);
    for (const missing of [false, true]) {
      const base = geometry(wall);
      const cut = subtractMortisesFromGeometry(base, missing ? [] : [b], ["rect"], { unitsPerMm: 1, strict: true });
      try {
        for (const x of [-80, 0, 80]) expect(occupied(cut, new Vector3(x, b.cy, b.cz))).toBe(missing);
        expect(occupied(cut, new Vector3(0, 0, 0))).toBe(true);
      } finally { if (cut !== base) cut.dispose(); base.dispose(); }
    }
  }
});

it("all six radial hook meshes lie outside the column's 30mm top cylinder, all inward controls intersect", () => {
  const d = build("coat-rack");
  const column = d.parts.find(p => p.id === "column")!;
  const columnVertices = worldVertices(column).filter(v => v.y >= 1625 && v.y <= 1664.01);
  expect(columnVertices.length).toBeGreaterThan(32);
  expect(Math.max(...columnVertices.map(v => Math.hypot(v.x, v.z)))).toBeCloseTo(30, 4);
  for (const hook of d.parts.filter(p => p.id.startsWith("hook-"))) {
    const normal = new Vector3(hook.origin.x, 0, hook.origin.z).normalize();
    const vertices = worldVertices(hook);
    expect(Math.min(...vertices.map(v => v.dot(normal)))).toBeCloseTo(30, 4);
    for (const view of ["front", "side", "top"] as const) {
      const silhouette = projectPartSilhouette(hook, view);
      expect(silhouette.length).toBeGreaterThan(2);
      expect(silhouette.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    }
    const shifted = { ...hook, origin: { ...hook.origin, x: hook.origin.x - 10 * normal.x, z: hook.origin.z - 10 * normal.z } };
    expect(separatedFromTurnedColumn(column, shifted, 1625, 1643)).toBe(false);
    expect(findOverlaps([column, shifted])).toHaveLength(1);
    const inside = worldVertices(shifted).some(v => Math.hypot(v.x, v.z) < 29 && v.y > 1625 && v.y < 1643);
    expect(inside).toBe(true);
  }
});

it("does not ignore the turned bulge, unknown shapes, off-axis rotations, or pedestal feet", () => {
  const d = build("coat-rack");
  const column = d.parts.find(p => p.id === "column")!;
  const hook = d.parts.find(p => p.id === "hook-2")!;
  const bulge = { ...hook, origin: { ...hook.origin, y: 1510 } };
  expect(separatedFromTurnedColumn(column, bulge, 1510, 1528)).toBe(false);
  expect(findOverlaps([column, bulge])).toHaveLength(1);
  for (const part of [
    { ...hook, shape: { kind: "splayed", dxMm: 100, dzMm: 100 } as const },
    { ...hook, rotation: { ...hook.rotation!, x: 0.2 } },
  ]) expect(separatedFromTurnedColumn(column, part, 1625, 1643)).toBe(false);
  expect(findOverlaps(build("round-table", { legShape: "pedestal" }).parts)).toHaveLength(4);
  // Direct-template fallback adds H-side stretchers; schema-filled audit does not.
  expect(findOverlaps(build("desk", { legShape: "splayed-round-tapered" }).parts)).toHaveLength(16);
  expect(findOverlaps(build("stool", { legShape: "curved-taper", ctTwoWay: true }).parts)).toHaveLength(4);
});

it("legacy and revised coat-rack feet meshes are separated from the bottom column envelope", () => {
  for (const constructionVersion of ["1", "2"]) for (const footCount of [3, 4]) {
    const d = build("coat-rack", { constructionVersion, footCount });
    const column = d.parts.find(p => p.id === "column")!;
    for (const foot of d.parts.filter(p => p.id.startsWith("foot-"))) {
      const normal = new Vector3(foot.origin.x, 0, foot.origin.z).normalize();
      const vertices = worldVertices(foot);
      // Foot wood is beyond radius 30; lathe's entire lower 5% is <= 28.5.
      expect(Math.min(...vertices.map(v => v.dot(normal)))).toBeGreaterThanOrEqual(30 - 1e-4);
      expect(Math.max(...vertices.map(v => v.y))).toBeLessThan(0.05 * column.visible.thickness);
      expect(findOverlaps([column, foot])).toEqual([]);
      const moved = { ...foot, origin: { ...foot.origin, x: 0, z: 0 } };
      expect(separatedFromTurnedColumn(column, moved, 0, 48)).toBe(false);
      expect(findOverlaps([column, moved])).toHaveLength(1);
    }
  }
});

it("unresolved stool, desk and pedestal warnings contain actual wood, not just overlapping silhouettes", () => {
  for (const [category, options, ids, point] of [
    ["stool", { legShape: "curved-taper", ctTwoWay: true }, ["ls-front", "ls-left"], [-155.5, 106.5, -155.5]],
    ["desk", { legShape: "splayed-round-tapered" }, ["leg-1", "apron-front", "apron-left"], [-570, 675, -274]],
    ["round-table", { legShape: "pedestal" }, ["pedestal-column", "pedestal-foot-right"], [50, 15, 0]],
  ] as [FurnitureCategory, Record<string, string | number | boolean>, string[], [number, number, number]][]) {
    const d = build(category, options);
    for (const id of ids) {
      const p = d.parts.find(p => p.id === id)!;
      const r = new Euler(p.rotation?.x ?? 0, p.rotation?.y ?? 0, p.rotation?.z ?? 0, "ZYX");
      const local = new Vector3(...point).sub(new Vector3(p.origin.x, p.origin.y + worldExtents(p).yExt / 2, p.origin.z));
      // Inverse world transform, independent of silhouette/AABB classification.
      const g = geometry(p);
      const mesh = new Mesh(g);
      mesh.setRotationFromEuler(r);
      local.applyQuaternion(mesh.quaternion.clone().invert());
      try { expect(occupied(g, local), `${category}:${id}`).toBe(true); }
      finally { g.dispose(); (mesh.material as MeshBasicMaterial).dispose(); }
    }
  }
});
