import { describe, expect, it } from "vitest";
import { Box3, BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { Brush, computeMeshVolume, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { FurnitureDesign, Part, TenonPosition } from "@/lib/types";
import { buildGroup, partExportGeometry } from "./three-d-export";
import { buildFlatLayoutGroup } from "./flat-layout";
import { tenonLocalBox } from "@/lib/render/svg-views";
import { buildOrdinaryTenonGeometry, buildDovetailCutBrushes, dovetailCutsForPart, partMachiningMatrix,
  subtractDovetailReceiverGeometry } from "@/lib/render/mortise-csg";
import { buildDovetailEndsGeometry } from "@/lib/render/part-geometry";
import { tray } from "@/lib/templates/tray";

const stock = (): Part => ({ id: "rail", nameZh: "rail", material: "white-oak", grainDirection: "length",
  visible: { length: 100, thickness: 40, width: 60 }, origin: { x: 0, y: 0, z: 0 },
  tenons: [{ position: "end", type: "blind-tenon", length: 10, width: 20, thickness: 12 }], mortises: [],
} as Part);
const mode = "joinery-accurate" as const;
const design = (parts: Part[]) => ({ category: "stool", parts }) as FurnitureDesign;
describe("supported dimensional joinery export", () => {
  it("honors the renderer's joineryView stock and origin override only in supported mode", () => {
    const p = stock(); p.joineryView = { visible: { length: 120, thickness: 40, width: 60 }, origin: { x: 40, y: 20, z: 10 } };
    const group = buildGroup(design([p]), 1, mode);
    expect(computeMeshVolume((group.children[0] as Mesh).geometry)).toBeCloseTo(290400, 1);
    const bounds = new Box3().setFromObject(group);
    expect(bounds.min.x).toBeCloseTo(-20, 3);
    expect(bounds.max.x).toBeCloseTo(110, 3);
    expect(computeMeshVolume(partExportGeometry(p, "mortise-accurate"))).toBeCloseTo(240000, 1);
  });
  it("matches the shared renderer's dimensional cuts on both real tray receivers", () => {
    const model = tray({ length: 400, width: 280, height: 60, material: "white-oak",
      options: { trayUse: "custom", cornerJoinery: "dovetail", bottomAttach: "surface", withHandle: false } });
    const cuts = buildDovetailCutBrushes(model.parts, 1, 0);
    const assembled = buildGroup(model, 1, mode);
    const flat = buildFlatLayoutGroup(model, 1, mode);
    for (const id of ["wall-left", "wall-right"]) {
      const index = model.parts.findIndex(p => p.id === id), part = model.parts[index];
      const stockGeometry = partExportGeometry(part, "mortise-accurate");
      const reference = subtractDovetailReceiverGeometry(stockGeometry, partMachiningMatrix(part), dovetailCutsForPart(part, cuts)!, 1);
      const actual = (assembled.children[index] as Mesh).geometry;
      expect(computeMeshVolume(actual)).toBeCloseTo(computeMeshVolume(reference), 0);
      expect(computeMeshVolume(actual)).toBeLessThan(computeMeshVolume(stockGeometry) - 1);
      expect(computeMeshVolume((flat.children[index] as Mesh).geometry)).toBeCloseTo(computeMeshVolume(actual), 0);
    }
  });
  it.each(["start", "end", "top", "bottom", "left", "right"] as TenonPosition[])("unions a full-size %s tenon with its stock", position => {
    const p = stock(); p.tenons[0].position = position;
    expect(computeMeshVolume(partExportGeometry(p, mode))).toBeCloseTo(242400, 1);
    expect(computeMeshVolume(partExportGeometry(p, "mortise-accurate"))).toBeCloseTo(240000, 1);
    expect(computeMeshVolume(partExportGeometry(p))).toBeCloseTo(240000, 1);
  });
  it("adds a round top tenon with the renderer's 24-segment cross-section", () => {
    const p = stock(); p.visible = { length: 40, thickness: 100, width: 40 };
    p.shape = { kind: "round", axis: "y" }; p.tenons[0].position = "top";
    const base = computeMeshVolume(partExportGeometry(p, "mortise-accurate"));
    expect(computeMeshVolume(partExportGeometry(p, mode)) - base).toBeCloseTo(12 * 6 ** 2 * Math.sin(Math.PI / 12) * 10, 1);
  });
  it("shares renderer tenon geometry, removing only its documented 0.5mm visual shrink", () => {
    const p = stock(); const t = p.tenons[0]; const b = tenonLocalBox(p, t);
    const rendered = buildOrdinaryTenonGeometry(t.position, b, false);
    expect(computeMeshVolume(rendered) / 0.01 ** 3).toBeCloseTo(10 * 19 * 11, 2);
    const dimensional = buildOrdinaryTenonGeometry(t.position, b, false, 1, 0);
    expect(computeMeshVolume(dimensional)).toBeCloseTo(10 * 20 * 12, 2);
    expect(computeMeshVolume(partExportGeometry(p, mode)) - 240000).toBeCloseTo(computeMeshVolume(dimensional), 1);
    const roundBox = { hx: 10, hy: 5, hz: 6 };
    expect(computeMeshVolume(buildOrdinaryTenonGeometry("top", roundBox, true)) / 0.01 ** 3)
      .toBeCloseTo(12 * 5.5 ** 2 * Math.sin(Math.PI / 12) * 10, 1);
  });
  it.each([buildGroup, buildFlatLayoutGroup])("keeps joined part volume through assembly/flat and scale", build => {
    const p = stock(); p.rotation = { x: 0.2, y: 0.4, z: 0.6 };
    const group = build(design([p]), 0.1, mode);
    expect(group.children).toHaveLength(1);
    expect(computeMeshVolume(group.children[0] as Mesh)).toBeCloseTo(242.4, 2);
  });
  it("fails closed on compound-axis, special-profile and unsupported tenon type", () => {
    const p = stock(); p.tenons[0].axis = { x: 1, y: 0.1, z: 0 };
    expect(() => partExportGeometry(p, mode)).toThrow(/tenon/i);
    delete p.tenons[0].axis; p.shape = { kind: "tapered", bottomScale: 0.7 };
    expect(() => partExportGeometry(p, mode)).toThrow(/tenon/i);
    delete p.shape; p.tenons[0].type = "dovetail";
    expect(() => partExportGeometry(p, mode)).toThrow(/tenon/i);
  });
  it("derives a dovetail receiver from actual tail geometry, without changing old modes", () => {
    const tail = stock(); tail.id = "wall-front"; tail.tenons = [];
    tail.visible = { length: 100, thickness: 40, width: 10 };
    tail.shape = { kind: "dovetail-ends", segmentCount: 5, phase: 0, angleDeg: 8, pinDepth: 10, halfPin: true };
    const side = stock(); side.id = "wall-right"; side.tenons = [];
    side.visible = { length: 10, thickness: 40, width: 60 }; side.origin.x = 45;
    const parts = [tail, side];
    const old = buildGroup(design(parts), 1, "mortise-accurate").children[1] as Mesh;
    const next = buildGroup(design(parts), 1, mode).children[1] as Mesh;
    expect(computeMeshVolume(old.geometry)).toBeCloseTo(24000, 1);
    expect(computeMeshVolume(next.geometry)).toBeLessThan(23900);
    expect(computeMeshVolume(next.geometry)).toBeGreaterThan(20000);
    // Three 2mm pins across the 10mm width. Four flank triangles with
    // 0.9mm tip expansion: pin area = 10*6 + 4*(10*0.9/2) = 78mm2.
    expect(computeMeshVolume(next.geometry)).toBeCloseTo(24000 - 78 * 40, 1);
    const flat = buildFlatLayoutGroup(design(parts), 1, mode).children[1] as Mesh;
    expect(computeMeshVolume(flat.geometry)).toBeCloseTo(computeMeshVolume(next.geometry), 1);
    expect(() => partExportGeometry(side, mode)).toThrow(/context/i);
    // Independent pre-extraction renderer sequence: actual dovetail builder,
    // visual +0.2mm tip allowance, world-baked brushes and SUBTRACTION.
    const material = new MeshBasicMaterial();
    const cutterGeo = buildDovetailEndsGeometry([1, 0.4, 0.1], 5, 0, 8, 0.1, true);
    cutterGeo.deleteAttribute("uv");
    cutterGeo.scale(1.004, 1, 1).applyMatrix4(partMachiningMatrix(tail, 0.01));
    cutterGeo.computeVertexNormals();
    const receiverGeo = new BoxGeometry(0.1, 0.4, 0.6);
    receiverGeo.deleteAttribute("uv");
    receiverGeo.applyMatrix4(partMachiningMatrix(side, 0.01));
    const a = new Brush(receiverGeo, material), b = new Brush(cutterGeo, material);
    a.updateMatrixWorld(); b.updateMatrixWorld();
    const evaluator = new Evaluator(); evaluator.useGroups = false; evaluator.attributes = ["position", "normal"];
    const original = evaluator.evaluate(a, b, SUBTRACTION);
    const sharedCutters = buildDovetailCutBrushes(parts);
    const shared = subtractDovetailReceiverGeometry(new BoxGeometry(0.1, 0.4, 0.6), partMachiningMatrix(side, 0.01), dovetailCutsForPart(side, sharedCutters)!);
    expect(computeMeshVolume(shared)).toBeCloseTo(computeMeshVolume(original.geometry), 7);
    // Dimensional export deliberately does not inherit the visual tip allowance.
    const fullSizeCutters = buildDovetailCutBrushes(parts, 1, 0);
    const renderedAtDimensions = subtractDovetailReceiverGeometry(new BoxGeometry(10, 40, 60), partMachiningMatrix(side), dovetailCutsForPart(side, fullSizeCutters)!, 1);
    expect(computeMeshVolume(renderedAtDimensions)).toBeCloseTo(computeMeshVolume(next.geometry), 1);
    expect(dovetailCutsForPart({ ...side, id: "wall-right-lid" }, sharedCutters)).toEqual([]);
    const broken = buildGroup(design([{ ...tail, shape: undefined }, side]), 1, mode).children[1] as Mesh;
    expect(computeMeshVolume(broken.geometry)).not.toBeCloseTo(20880, 1);
  });
});
