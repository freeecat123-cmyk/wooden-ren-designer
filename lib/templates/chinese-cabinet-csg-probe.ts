// Run only in a killable child process: synchronous CSG cannot honor Vitest timers.
import assert from "node:assert/strict";
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { computeMeshVolume } from "three-bvh-csg";
import { chineseCabinet } from "./chinese-cabinet";
import { partExportGeometry } from "../export/three-d-export";
import { mortiseLocalBox } from "../render/svg-views";
import { subtractMortisesFromGeometry } from "../render/mortise-csg";

function occupied(mesh: Mesh, point: Vector3) {
  const hits = new Raycaster(point, new Vector3(0.217, 0.673, 0.537).normalize()).intersectObject(mesh);
  return hits.filter((h, i) => h.distance > 1e-7 && (i === 0 || Math.abs(h.distance - hits[i - 1].distance) > 1e-7)).length % 2 === 1;
}

const [hoofMm, hoofScale] = process.argv.slice(2).map(Number);
const cabinetPreset = process.argv[4];
const d = cabinetPreset
  ? chineseCabinet({ length: 1000, width: 550, height: 2000, material: "maple",
    options: { constructionVersion: "2", cabinetPreset, legShape: "box", splayAngle: 3, topBoxLayers: 2 } })
  : chineseCabinet({ length: 800, width: 400, height: 1500, material: "maple",
    options: { constructionVersion: "2", legShape: "inward-hoof", hoofMm, hoofScale } });
const material = new MeshBasicMaterial({ side: DoubleSide });
const label = cabinetPreset ? "板心槽 5mm" : "馬蹄避讓";
const receivers = d.parts.filter(p => p.mortises.some(m => m.label?.startsWith(label)));
assert.equal(receivers.length, cabinetPreset ? cabinetPreset === "top-cabinet" ? 12 : 6 : 8);
for (const part of receivers) {
  process.stderr.write(`CSG ${part.id}\n`);
  const stock = partExportGeometry(part).scale(0.01, 0.01, 0.01);
  const mortises = part.mortises.filter(m => m.cosmetic);
  const boxes = mortises.map(m => {
    const b = mortiseLocalBox(part, m);
    return { ...b, cx: b.cx * 0.01, cy: b.cy * 0.01, cz: b.cz * 0.01,
      hx: b.hx * 0.01, hy: b.hy * 0.01, hz: b.hz * 0.01 };
  });
  const cut = subtractMortisesFromGeometry(stock, boxes, undefined, { strict: true });
  const plain = new Mesh(stock, material), machined = new Mesh(cut, material);
  plain.updateMatrixWorld(); machined.updateMatrixWorld();
  assert.ok(computeMeshVolume(cut) > computeMeshVolume(stock) * 0.7, `${part.id} retained volume`);
  let witnessed = 0;
  for (let i = 0; i < mortises.length; i++) {
    if (!mortises[i].label?.startsWith(label)) continue;
    const box = boxes[i];
    const halfY = box.rotZ ? box.hx : box.hy;
    for (const fraction of [-0.95, -0.5, 0, 0.5, 0.95]) {
      const probe = new Vector3(box.cx, box.cy + fraction * halfY, box.cz);
      if (!occupied(plain, probe)) continue;
      witnessed++;
      assert.equal(occupied(machined, probe), false, `${part.id} cut ${i}/${fraction}`);
    }
  }
  assert.ok(witnessed > 0, `${part.id} witnesses`);
  const core = new Vector3(0, part.id.startsWith("skirt-") ? part.visible.thickness * 0.0045 : 0, 0);
  assert.ok(occupied(plain, core) && occupied(machined, core), `${part.id} core`);
  stock.dispose(); cut.dispose();
}
material.dispose();
process.stdout.write(`${receivers.length} receivers verified\n`);
