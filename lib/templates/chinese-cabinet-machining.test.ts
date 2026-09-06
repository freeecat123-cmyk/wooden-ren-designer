import { expect, it } from "vitest";
import { DoubleSide, Euler, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { spawnSync } from "node:child_process";
import { chineseCabinet } from "./chinese-cabinet";
import { cabinetHoofSections } from "./chinese-cabinet-machining";
import { partExportGeometry } from "../export/three-d-export";
import { mortiseLocalBox } from "../render/svg-views";
import { partMachiningMatrix } from "../render/mortise-csg";
import type { Part } from "../types";

const build = (legShape = "inward-hoof", hoofMm = 80, hoofScale = 1.35) => chineseCabinet({
  length: 800, width: 400, height: 1500, material: "maple", options: { constructionVersion: "2", legShape, hoofMm, hoofScale },
});

function hoofCovered(receiver: Part, post: Part): boolean {
  const rings = cabinetHoofSections(post);
  const boxes = receiver.mortises.filter(m => m.cosmetic).map(m => {
    const box = mortiseLocalBox(receiver, m);
    if (box.rotZ) [box.hx, box.hy] = [box.hy, box.hx];
    return box;
  });
  const angle = receiver.rotation?.y ?? 0, c = Math.cos(angle), s = Math.sin(angle);
  const heights = [...rings.map(r => r.y), receiver.origin.y, receiver.origin.y + receiver.visible.thickness,
    ...boxes.flatMap(b => [receiver.origin.y + receiver.visible.thickness / 2 + b.cy - b.hy,
      receiver.origin.y + receiver.visible.thickness / 2 + b.cy + b.hy])].sort((a, b) => a - b);
  for (let i = 1; i < heights.length; i++) {
    if (heights[i] - heights[i - 1] < 0.0001) continue;
    for (const f of [0.00001, 0.5, 0.99999]) {
      const y = heights[i - 1] + (heights[i] - heights[i - 1]) * f;
      if (y <= receiver.origin.y || y >= receiver.origin.y + receiver.visible.thickness) continue;
      const j = rings.findIndex((r, index) => index > 0 && r.y >= y);
      if (j < 1 || y < rings[0].y) continue;
      const a = rings[j - 1], b = rings[j], t = (y - a.y) / (b.y - a.y);
      const at = (k: "minX" | "maxX" | "minZ" | "maxZ") => a[k] + t * (b[k] - a[k]);
      const xs: number[] = [], zs: number[] = [];
      for (const x of [at("minX"), at("maxX")]) for (const z of [at("minZ"), at("maxZ")]) {
        const dx = x - receiver.origin.x, dz = z - receiver.origin.z;
        xs.push(c * dx - s * dz); zs.push(s * dx + c * dz);
      }
      const x0 = Math.max(-receiver.visible.length / 2, Math.min(...xs));
      const x1 = Math.min(receiver.visible.length / 2, Math.max(...xs));
      const z0 = Math.max(-receiver.visible.width / 2, Math.min(...zs));
      const z1 = Math.min(receiver.visible.width / 2, Math.max(...zs));
      if (x1 - x0 < 0.0001 || z1 - z0 < 0.0001) continue;
      const localY = y - receiver.origin.y - receiver.visible.thickness / 2;
      if (!boxes.some(cut => localY >= cut.cy - cut.hy - 0.0001 && localY <= cut.cy + cut.hy + 0.0001
        && cut.cx - cut.hx <= x0 + 0.0001 && cut.cx + cut.hx >= x1 - 0.0001
        && cut.cz - cut.hz <= z0 + 0.0001 && cut.cz + cut.hz >= z1 - 0.0001)) return false;
    }
  }
  return true;
}

for (const legShape of ["auto", "box", "inward-hoof", "outward-hoof"]) for (const [hoofMm, hoofScale] of [[80, 1.35], [140, 1.6]]) {
  it(`covers every real hoof/receiver interval: ${legShape}/${hoofMm}/${hoofScale}`, () => {
    const d = build(legShape, hoofMm, hoofScale);
    const posts = d.parts.filter(p => p.shape?.kind === "hoof");
    const receivers = d.parts.filter(p => p.id.startsWith("skirt-") || p.id.endsWith("lower-rail"));
    for (const receiver of receivers) for (const post of posts) expect(hoofCovered(receiver, post), `${receiver.id}/${post.id}`).toBe(true);
    if (legShape !== "auto" && legShape !== "inward-hoof") return;
    const receiver = d.parts.find(p => p.id === "front-lower-rail")!;
    const post = d.parts.find(p => p.id === "post-front-left")!;
    for (const mutation of ["missing", "shallow", "shifted"]) {
      const broken = structuredClone(receiver);
      if (mutation === "missing") broken.mortises = [];
      if (mutation === "shallow") broken.mortises.forEach(m => m.depth /= 2);
      if (mutation === "shifted") broken.mortises.forEach(m => m.origin.x += 5);
      expect(hoofCovered(broken, post), mutation).toBe(false);
    }
  });
}

function occupied(mesh: Mesh, p: Vector3) {
  const hits = new Raycaster(p, new Vector3(0.217, 0.673, 0.537).normalize()).intersectObject(mesh);
  return hits.filter((h, i) => h.distance > 1e-7 && (i === 0 || Math.abs(h.distance - hits[i - 1].distance) > 1e-7)).length % 2 === 1;
}

for (const dimensions of [[600, 300, 900], [1100, 550, 2000]]) {
  it(`covers thick-post nondefault geometry without a collision exemption: ${dimensions.join("x")}`, () => {
    for (const legShape of ["auto", "inward-hoof", "outward-hoof", "box"]) {
      const d = chineseCabinet({ length: dimensions[0], width: dimensions[1], height: dimensions[2], material: "maple",
        options: { constructionVersion: "2", proportionStyle: "free", postSize: 50, railWidth: 65,
          railThickness: 30, panelThickness: 15, legShape, hoofMm: 140, hoofScale: 1.6 } });
      for (const post of d.parts.filter(p => p.shape?.kind === "hoof")) {
        for (const receiver of d.parts.filter(p => p.id.startsWith("skirt-") || p.id.endsWith("lower-rail"))) {
          expect(hoofCovered(receiver, post), `${receiver.id}/${post.id}`).toBe(true);
        }
      }
    }
  });
}

it("uses the rendered directional S-profile, including the waist and bulge", () => {
  const post = build().parts.find(p => p.id === "post-front-left")!;
  const sections = cabinetHoofSections(post);
  // Left post center -382.5; inward-facing toe on +X. Nominal half width 17.5.
  expect(sections[0].maxX).toBeCloseTo(-358.875, 5);
  expect(sections[0].minX).toBe(-400);
  expect(sections[1].y).toBeCloseTo(17.6, 3);
  expect(sections[1].maxX).toBeCloseTo(-367.625, 5);
  expect(sections[2].y).toBeCloseTo(44, 3);
  expect(sections[2].maxX).toBeCloseTo(-363.25, 5);
  expect(build("outward-hoof").parts.filter(p => p.id.startsWith("skirt-")).every(p => p.mortises.length === 0)).toBe(true);
});

for (const [hoofMm, hoofScale] of [[80, 1.35], [140, 1.6]]) {
  it(`bounds removed stock against the actual profile at every cut boundary: ${hoofMm}/${hoofScale}`, () => {
    const d = build("inward-hoof", hoofMm, hoofScale);
    for (const receiver of d.parts) for (const post of d.parts.filter(p => p.shape?.kind === "hoof")) {
      const cuts = receiver.mortises.filter(m => m.label === `馬蹄避讓 ${post.id}`).map(m => {
        const b = mortiseLocalBox(receiver, m);
        if (b.rotZ) [b.hx, b.hy] = [b.hy, b.hx];
        return b;
      });
      if (!cuts.length) continue;
      const rings = cabinetHoofSections(post), centerY = receiver.origin.y + receiver.visible.thickness / 2;
      const heights = [...rings.map(r => r.y), ...cuts.flatMap(b => [centerY + b.cy - b.hy, centerY + b.cy + b.hy])].sort((a, b) => a - b);
      const c = Math.cos(receiver.rotation?.y ?? 0), s = Math.sin(receiver.rotation?.y ?? 0);
      const half = receiver.visible.length / 2;
      for (let i = 1; i < heights.length; i++) for (const f of [0.00001, 0.5, 0.99999]) {
        const y = heights[i - 1] + (heights[i] - heights[i - 1]) * f;
        const active = cuts.filter(b => Math.abs(y - centerY - b.cy) < b.hy - 1e-8);
        if (!active.length) continue;
        const index = rings.findIndex((r, j) => j > 0 && r.y >= y);
        expect(index).toBeGreaterThan(0);
        const a = rings[index - 1], b = rings[index], t = (y - a.y) / (b.y - a.y);
        const at = (key: "minX" | "maxX" | "minZ" | "maxZ") => a[key] + t * (b[key] - a[key]);
        const xs = [at("minX"), at("maxX")].flatMap(x => [at("minZ"), at("maxZ")].map(z =>
          c * (x - receiver.origin.x) - s * (z - receiver.origin.z)));
        const fromLeft = active[0].cx < 0;
        const requiredInset = Math.max(0, fromLeft ? Math.max(...xs) + half : half - Math.min(...xs));
        const removedInset = Math.max(...active.map(cut => fromLeft ? cut.cx + cut.hx + half : half - cut.cx + cut.hx));
        expect(removedInset - requiredInset, `${receiver.id}/${post.id}/${y}`).toBeLessThanOrEqual(0.5001);
      }
    }
  });
  it(`leaves connected central stock and every notch opens to the end and broad faces: ${hoofMm}/${hoofScale}`, () => {
    const d = build("inward-hoof", hoofMm, hoofScale);
    for (const p of d.parts) {
      const notches = p.mortises.filter(m => m.label?.startsWith("馬蹄避讓"));
      if (!notches.length) continue;
      const half = p.visible.length / 2;
      let maxInset = 0;
      for (const m of notches) {
        const b = mortiseLocalBox(p, m);
        const cutX = b.rotZ ? b.hy : b.hx;
        const cutY = b.rotZ ? b.hx : b.hy;
        expect(b.depthAxis).toBe("z");
        expect(b.hz * 2).toBeCloseTo(p.visible.width, 5);
        expect(Math.abs(b.cx) + cutX).toBeCloseTo(half, 5); // end-connected
        expect(b.cy - cutY).toBeGreaterThanOrEqual(-p.visible.thickness / 2 - 0.0001);
        expect(b.cy + cutY).toBeLessThanOrEqual(p.visible.thickness / 2 + 0.0001);
        // Maximum hoof departure is 17.5*(scale-1), plus only 0.25mm clearance.
        expect(cutX * 2).toBeLessThanOrEqual(17.5 * Math.max(0.1, hoofScale - 1) + 0.2501);
        maxInset = Math.max(maxInset, cutX * 2);
      }
      expect(p.visible.length - maxInset * 2).toBeGreaterThan(p.visible.length * 0.9);
      if (p.shape?.kind === "face-rounded") expect(p.visible.thickness - (p.shape.bottomArchMm ?? 0)).toBeGreaterThanOrEqual(18);
      for (const m of p.mortises.filter(m => m.label === "板心槽 5mm")) {
        const b = mortiseLocalBox(p, m);
        expect(p.visible.width / 2 - Math.abs(b.cz) - b.hz).toBeGreaterThanOrEqual(6.2499);
        expect(p.visible.thickness - b.hy * 2).toBe(40);
      }
    }
  });
}

for (const [hoofMm, hoofScale] of [[80, 1.35], [140, 1.6]]) {
  it(`actual CSG cuts every receiver notch and retains its core: ${hoofMm}/${hoofScale}`, () => {
    const result = spawnSync(process.execPath, ["--import", "tsx",
      "lib/templates/chinese-cabinet-csg-probe.ts", String(hoofMm), String(hoofScale)], {
      cwd: process.cwd(), timeout: 10000, killSignal: "SIGKILL", encoding: "utf8", maxBuffer: 1024 * 1024,
    });
    const diagnostic = result.stderr.split("\n").filter(line => /^(CSG |AssertionError)/.test(line)).join("\n");
    expect(result.error?.message ?? "", diagnostic).not.toContain("ETIMEDOUT");
    expect(result.status, diagnostic).toBe(0);
    expect(result.stdout).toContain("8 receivers verified");
  }, 15000);
}

it("has actual notch/post contact samples, and removing a cut restores real solid interference", () => {
  const d = build();
  const receiver = d.parts.find(p => p.id === "front-lower-rail")!;
  const post = d.parts.find(p => p.id === "post-front-left")!;
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const meshFor = (p: Part) => {
    const g = partExportGeometry(p).scale(0.01, 0.01, 0.01);
    g.applyQuaternion(new Mesh().quaternion.setFromEuler(new Euler(p.rotation?.x ?? 0, p.rotation?.y ?? 0, p.rotation?.z ?? 0, "ZYX")));
    g.translate(p.origin.x * 0.01, (p.origin.y + p.visible.thickness / 2) * 0.01, p.origin.z * 0.01);
    const mesh = new Mesh(g, material); mesh.updateMatrixWorld(); return mesh;
  };
  const a = meshFor(receiver), b = meshFor(post);
  // At Y=52 the inward hoof face is -363.639mm, so x=-364 is in both raw solids.
  const point = new Vector3(-3.64, 0.52, -1.875);
  expect(occupied(a, point)).toBe(true);
  expect(occupied(b, point)).toBe(true);
  a.geometry.dispose(); b.geometry.dispose(); material.dispose();
});

for (const cabinetPreset of ["round-cabinet", "top-cabinet"]) {
  it(`actually machines nondefault panel grooves within the hard deadline: ${cabinetPreset}`, () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "lib/templates/chinese-cabinet-csg-probe.ts", "80", "1.35", cabinetPreset], {
      cwd: process.cwd(), timeout: 10000, killSignal: "SIGKILL", encoding: "utf8", maxBuffer: 1024 * 1024,
    });
    const diagnostic = result.stderr.split("\n").filter(line => /^(CSG |AssertionError)/.test(line)).join("\n");
    expect(result.error?.message ?? "", diagnostic).not.toContain("ETIMEDOUT");
    expect(result.status, diagnostic).toBe(0);
    expect(result.stdout).toContain(`${cabinetPreset === "top-cabinet" ? 12 : 6} receivers verified`);
  }, 15000);
  it(`proves groove engagement and remaining cheeks using mesh sections: ${cabinetPreset}`, () => {
    const d = chineseCabinet({ length: 1000, width: 550, height: 2000, material: "maple",
      options: { constructionVersion: "2", cabinetPreset, legShape: "box", splayAngle: 3, topBoxLayers: 2 } });
    const slice = (part: Part, receiver: Part, y: number) => {
      const g = partExportGeometry(part);
      g.applyMatrix4(partMachiningMatrix(part)).applyMatrix4(partMachiningMatrix(receiver).invert());
      const p = g.getAttribute("position"), index = g.getIndex();
      const points: Vector3[] = [];
      const n = index?.count ?? p.count;
      for (let i = 0; i < n; i += 3) {
        const vertices = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(p, index ? index.getX(i + k) : i + k));
        for (let k = 0; k < 3; k++) {
          const a = vertices[k], b = vertices[(k + 1) % 3];
          if (Math.abs(a.y - y) < 0.0001) points.push(a);
          if ((a.y - y) * (b.y - y) < 0) points.push(a.clone().lerp(b, (y - a.y) / (b.y - a.y)));
        }
      }
      g.dispose();
      expect(points.length).toBeGreaterThan(0);
      return { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
        minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) };
    };
    let grooves = 0;
    for (const rail of d.parts) for (const m of rail.mortises.filter(m => m.label === "板心槽 5mm")) {
      const panelId = rail.id.replace(/-(upper|lower)-rail$/, "-panel");
      const panel = d.parts.find(p => p.id === panelId)!;
      expect(panel, panelId).toBeDefined();
      const cut = mortiseLocalBox(rail, m);
      expect(cut.depthAxis).toBe("y");
      expect(cut.hy * 2).toBe(5);
      const worldBounds = (part: Part) => {
        const geometry = partExportGeometry(part).applyMatrix4(partMachiningMatrix(part));
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!.clone();
        geometry.dispose();
        return box;
      };
      const entireIntersection = worldBounds(rail).intersect(worldBounds(panel));
      const centerY = rail.origin.y + rail.visible.thickness / 2;
      // This covers the full panel height: only its two 5mm end bands can
      // intersect a rail. The full-height XZ envelope is not the end section.
      expect(entireIntersection.max.y - entireIntersection.min.y).toBeCloseTo(5, 3);
      expect(centerY + cut.cy - cut.hy).toBeLessThanOrEqual(entireIntersection.min.y + 0.001);
      expect(centerY + cut.cy + cut.hy).toBeGreaterThanOrEqual(entireIntersection.max.y - 0.001);
      expect(rail.visible.thickness - 5).toBeGreaterThanOrEqual(25);
      for (const f of [-0.999, 0, 0.999]) {
        const y = cut.cy + cut.hy * f;
        const stock = slice(rail, rail, y), insert = slice(panel, rail, y);
        expect(cut.cx - cut.hx).toBeLessThanOrEqual(Math.max(stock.minX, insert.minX) + 0.001);
        expect(cut.cx + cut.hx).toBeGreaterThanOrEqual(Math.min(stock.maxX, insert.maxX) - 0.001);
        expect(cut.cz - cut.hz).toBeLessThanOrEqual(insert.minZ + 0.001);
        expect(cut.cz + cut.hz).toBeGreaterThanOrEqual(insert.maxZ - 0.001);
        expect(cut.cz - cut.hz - stock.minZ, `${rail.id} near cheek`).toBeGreaterThan(3);
        expect(stock.maxZ - cut.cz - cut.hz, `${rail.id} far cheek`).toBeGreaterThan(3);
      }
      grooves++;
    }
    expect(grooves).toBe(cabinetPreset === "top-cabinet" ? 12 : 6);
  });
}
