import { expect, it } from "vitest";
import { BoxGeometry, DoubleSide, Euler, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { computeMeshVolume } from "three-bvh-csg";
import { subtractMortisesFromGeometry } from "@/components/PerspectiveView";
import { wineRack, wineRackOptions } from "@/lib/templates/wine-rack";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { worldExtents } from "@/lib/render/geometry";
import type { Part } from "@/lib/types";
import { worldAABB } from "./overlap";

const SCALE = 0.01;
function meshIntersectionSamples(a: Part, b: Part): number {
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const meshes = [a, b].map(part => {
    const base = new BoxGeometry(part.visible.length * SCALE, part.visible.thickness * SCALE, part.visible.width * SCALE);
    const boxes = part.mortises.map(m => {
      const c = mortiseLocalBox(part, m);
      return { cx: c.cx * SCALE, cy: c.cy * SCALE, cz: c.cz * SCALE, hx: c.hx * SCALE, hy: c.hy * SCALE, hz: c.hz * SCALE };
    });
    const cut = subtractMortisesFromGeometry(base, boxes);
    const stock = part.visible.length * part.visible.thickness * part.visible.width;
    const removed = part.mortises.reduce((sum, m) => sum + m.length * m.width * m.depth, 0);
    expect(Math.abs(computeMeshVolume(cut) / SCALE ** 3 - (stock - removed))).toBeLessThan(1);
    if (cut !== base) base.dispose();
    const r = part.rotation;
    cut.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0, "ZYX")));
    cut.translate(part.origin.x * SCALE, (part.origin.y + worldExtents(part).yExt / 2) * SCALE, part.origin.z * SCALE);
    cut.deleteAttribute("uv");
    const mesh = new Mesh(cut, material);
    mesh.updateMatrixWorld();
    return mesh;
  });
  const boxA = worldAABB(a), boxB = worldAABB(b);
  const axes = ["x", "y", "z"] as const;
  const min = axes.map(axis => Math.max(boxA.min[axis], boxB.min[axis]));
  const max = axes.map(axis => Math.min(boxA.max[axis], boxB.max[axis]));
  const inside = (mesh: Mesh, point: Vector3) => {
    const hits = new Raycaster(point, new Vector3(0.217, 0.673, 0.537).normalize()).intersectObject(mesh);
    const distinct = hits.filter((hit, i) => hit.distance > 1e-8 && (i === 0 || Math.abs(hit.distance - hits[i - 1].distance) > 1e-8));
    return distinct.length % 2 === 1;
  };
  try {
    // Probe rendered solids, not a second boolean operation on exactly coplanar
    // touching faces, which can produce open intersection surfaces in the kernel.
    let occupiedByBoth = 0;
    for (const x of [0.137, 0.389, 0.613, 0.881]) for (const y of [0.137, 0.389, 0.613, 0.881]) for (const z of [0.137, 0.389, 0.613, 0.881]) {
      const point = new Vector3(...[x, y, z].map((t, i) => (min[i] + (max[i] - min[i]) * t) * SCALE) as [number, number, number]);
      if (meshes.every(mesh => inside(mesh, point))) occupiedByBoth++;
    }
    return occupiedByBoth;
  } finally { meshes.forEach(m => m.geometry.dispose()); material.dispose(); }
}

for (const [wide, tall, thickness] of [[2, 2, 12], [4, 3, 15], [8, 6, 25]]) {
  it(`actual renderer CSG leaves no intersecting solid: ${wide}x${tall}, ${thickness}mm`, () => {
    const options = Object.fromEntries(wineRackOptions.map(s => [s.key, s.defaultValue]));
    Object.assign(options, { bottlesWide: wide, bottlesTall: tall, panelThickness: thickness });
    const design = toBeginnerMode(wineRack({ length: 600, width: 280, height: 600, material: "maple", options }));
    const shelf = design.parts.find(p => p.id === "shelf-h-1")!;
    const divider = design.parts.find(p => p.id === "divider-v-c1")!;
    expect(meshIntersectionSamples(shelf, divider)).toBe(0);
    // Exactly half the 64 interior probes collide when one half-lap is absent.
    expect(meshIntersectionSamples(shelf, { ...divider, mortises: [] })).toBe(32);
    const sameSide = { ...divider, mortises: divider.mortises.map(m => ({ ...m, origin: { ...m.origin, x: -m.origin.x } })) };
    expect(meshIntersectionSamples(shelf, sameSide)).toBe(32);
  });
}
