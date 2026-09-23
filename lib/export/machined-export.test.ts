import { afterEach, describe, expect, it, vi } from "vitest";
import { BoxGeometry, BufferGeometry, DoubleSide, Euler, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { unzipSync } from "fflate";
import { Evaluator } from "three-bvh-csg";
import type { FurnitureDesign, Part } from "@/lib/types";
import { buildGroup, partExportGeometry, downloadSTL, downloadOBJ, download3MF, downloadFlatLayoutSTL } from "./three-d-export";
import { buildFlatLayoutGroup } from "./flat-layout";
import { subtractMortisesFromGeometry } from "@/lib/render/mortise-csg";

function volume(g: BufferGeometry) {
  const p = g.getAttribute("position"), idx = g.getIndex();
  let v = 0;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i);
    b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1);
    c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2);
    v += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(v);
}
const stock = (): Part => ({ id: "stock", nameZh: "stock", material: "white-oak", grainDirection: "length",
  visible: { length: 100, thickness: 20, width: 60 }, origin: { x: 130, y: 40, z: 70 },
  tenons: [], mortises: [{ origin: { x: 10, y: 20, z: 0 }, depth: 10, length: 20, width: 10, through: false, cosmetic: true }],
} as Part);
const design = (p: Part) => ({ category: "stool", parts: [p] }) as FurnitureDesign;
const accurate = "mortise-accurate" as const;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("dimensionally accurate mortise export", () => {
  it("subtracts a 20 x 10 x 10 pocket; default remains solid stock", () => {
    expect(volume(partExportGeometry(stock()))).toBeCloseTo(120000, 1);
    expect(volume(partExportGeometry(stock(), accurate))).toBeCloseTo(118000, 1);
  });
  it("subtracts a rotated rectangular through cut", () => {
    const p = stock();
    Object.assign(p.mortises[0], { depth: 20, through: true, rotY: Math.PI / 4 });
    expect(volume(partExportGeometry(p, accurate))).toBeCloseTo(116000, 1);
  });
  it("makes a shallow round pocket along its declared depth, not its largest extent", () => {
    const p = stock();
    Object.assign(p.mortises[0], { shape: "round", length: 20, width: 20, depth: 3 });
    // Renderer uses an inscribed 24-segment cylinder.
    const removed = 12 * 100 * Math.sin(Math.PI / 12) * 3;
    expect(volume(partExportGeometry(p, accurate))).toBeCloseTo(120000 - removed, 1);
  });
  it.each(["x", "y", "z"] as const)("cuts round holes along local %s", axis => {
    const p = stock();
    const depth = { x: 100, y: 20, z: 60 }[axis];
    Object.assign(p.mortises[0], { shape: "round", length: 6, width: 6, depth, through: true,
      origin: { x: axis === "x" ? 50 : 0, y: axis === "y" ? 20 : 10, z: axis === "z" ? 30 : 0 } });
    expect(volume(partExportGeometry(p, accurate))).toBeCloseTo(120000 - 12 * 9 * Math.sin(Math.PI / 12) * depth, 1);
  });
  it("exports all six round holes rather than renderer-only dark plugs", () => {
    const p = stock();
    p.mortises = [-35, -21, -7, 7, 21, 35].map(x => ({ shape: "round", length: 6, width: 6, depth: 20,
      through: true, cosmetic: true, origin: { x, y: 20, z: 0 } }));
    expect(volume(partExportGeometry(p, accurate))).toBeCloseTo(120000 - 6 * 12 * 9 * Math.sin(Math.PI / 12) * 20, 1);
  });
  it("retains the renderer's rotX slice-width correction at millimeter scale", () => {
    const p = stock();
    Object.assign(p.mortises[0], { depth: 20, through: true, rotX: 0.2 });
    expect(volume(partExportGeometry(p, accurate))).toBeCloseTo(116000, 1);
  });
  it.each([buildGroup, buildFlatLayoutGroup])("preserves thin stock and scale for %s", (build) => {
    const p = stock(); p.visible.thickness = 3; p.mortises = [];
    for (const scale of [1, 0.1, 0.01]) {
      const mesh = build(design(p), scale, accurate).children[0] as Mesh;
      expect(volume(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld))).toBeCloseTo(18000 * scale ** 3, 3);
    }
    const mesh = build(design(p), 0.1).children[0] as Mesh;
    expect(volume(mesh.geometry)).toBeCloseTo(48000, 1);
  });
  it("fails closed on malformed dimensions and cuts", () => {
    const p = stock(); p.mortises[0].depth = NaN;
    expect(() => partExportGeometry(p, accurate)).toThrow();
    p.mortises = []; p.visible.length = 0;
    expect(() => partExportGeometry(p, accurate)).toThrow();
  });
  it("does not silently discard a rotation unsupported by the local-box convention", () => {
    const p = stock(); p.mortises[0].rotZ = 0.2;
    expect(() => partExportGeometry(p, accurate)).toThrow(/rotation/);
    p.mortises[0].rotZ = Infinity;
    expect(() => partExportGeometry(p, accurate)).toThrow();
  });
  it("rejects invalid scales and unknown modes", () => {
    expect(() => buildGroup(design(stock()), 0, accurate)).toThrow();
    expect(() => buildFlatLayoutGroup(design(stock()), NaN, accurate)).toThrow();
    expect(() => partExportGeometry(stock(), "wrong" as typeof accurate)).toThrow();
  });
  it("detects missing and shallow cut negative controls", () => {
    const p = stock(); p.mortises = [];
    expect(volume(partExportGeometry(p, accurate))).not.toBeCloseTo(118000, 1);
    const q = stock(); q.mortises[0].depth = 5;
    expect(volume(partExportGeometry(q, accurate))).not.toBeCloseTo(118000, 1);
  });
  it("places rotated cuts correctly in world space (missing/shifted cuts fail the ray oracle)", () => {
    const p = stock(); p.rotation = { x: 0.2, y: 0.5, z: 0.3 };
    Object.assign(p.mortises[0], { depth: 20, through: true, rotY: Math.PI / 4 });
    const hitCount = (part: Part) => {
      const mesh = buildGroup(design(part), 0.1, accurate).children[0] as Mesh;
      mesh.material = new MeshBasicMaterial({ side: DoubleSide });
      // Point along the rotated long axis, inside the cut but outside its unrotated Z span.
      const offset = new Vector3(8, 0, 0).applyEuler(new Euler(0, Math.PI / 4, 0));
      const start = new Vector3(10 + offset.x, 50, offset.z).applyMatrix4(mesh.matrixWorld);
      const direction = new Vector3(0, -1, 0).transformDirection(mesh.matrixWorld);
      return new Raycaster(start, direction).intersectObject(mesh).length;
    };
    expect(hitCount(p)).toBe(0);
    expect(hitCount({ ...p, mortises: [] })).toBeGreaterThan(0);
    expect(hitCount({ ...p, mortises: [{ ...p.mortises[0], rotY: 0 }] })).toBeGreaterThan(0);
    expect(hitCount({ ...p, mortises: [{ ...p.mortises[0], origin: { x: -20, y: 20, z: 0 } }] })).toBeGreaterThan(0);
  });
  it("shared CSG is unit aware and leaves stock untouched", () => {
    for (const unit of [1, 0.01]) {
      const base = new BoxGeometry(100 * unit, 20 * unit, 60 * unit);
      const result = subtractMortisesFromGeometry(base, [{ cx: 10 * unit, cy: 5 * unit, cz: 0,
        hx: 10 * unit, hy: 5 * unit, hz: 5 * unit, depthAxis: "y" }], ["rect"], { strict: true, unitsPerMm: unit });
      expect(volume(result) / unit ** 3).toBeCloseTo(118000, 1);
      expect(volume(base) / unit ** 3).toBeCloseTo(120000, 1);
    }
  });
  it("does not swallow CSG failure or accept unsupported shapes/axis", () => {
    const p = stock();
    p.shape = { kind: "tilt-z", topShiftMm: 10, baseHeightMm: 20 };
    expect(() => partExportGeometry(p, accurate)).toThrow(/unsupported/);
    delete p.shape; p.mortises[0].axis = { x: 1, y: 0, z: 0 };
    expect(() => partExportGeometry(p, accurate)).toThrow(/world-axis/);
    delete p.mortises[0].axis;
    vi.spyOn(Evaluator.prototype, "evaluate").mockImplementation(() => { throw new Error("injected failure"); });
    expect(() => partExportGeometry(p, accurate)).toThrow(/CSG failed/);
  });
  it.each([["stl", downloadSTL], ["obj", downloadOBJ], ["3mf", download3MF], ["flat", downloadFlatLayoutSTL]] as const)("%s downloads actual cut geometry and mode-specific filename", async (format, download) => {
    let blob: Blob | undefined;
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn(), removeChild: vi.fn() } });
    vi.spyOn(URL, "createObjectURL").mockImplementation(b => { blob = b as Blob; return "blob:test"; });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    download(design(stock()), 0.1, accurate);
    expect(anchor.download).toContain("mortise-only");
    expect(anchor.click).toHaveBeenCalledOnce();
    if (format === "stl" || format === "flat") {
      expect(volume(new STLLoader().parse(await blob!.arrayBuffer()))).toBeCloseTo(118, 2);
    } else if (format === "obj") {
      const mesh = new OBJLoader().parse(await blob!.text()).children[0] as Mesh;
      expect(volume(mesh.geometry)).toBeCloseTo(118, 2);
    } else {
      const files = unzipSync(new Uint8Array(await blob!.arrayBuffer()));
      const xml = new TextDecoder().decode(files["3D/3dmodel.model"]);
      // The XML serializer has its own numerical tests; here verify the ZIP contains
      // the exact selected-mode world mesh, never a rebuilt printable stock mesh.
      const { groupToModelXml } = await import("./three-mf");
      expect(xml).toBe(groupToModelXml(buildGroup(design(stock()), 0.1, accurate)));
      expect(xml).not.toBe(groupToModelXml(buildGroup(design(stock()), 0.1)));
    }
  });
});
