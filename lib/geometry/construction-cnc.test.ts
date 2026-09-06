import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { partMachiningFaces } from "@/lib/export/mortise-faces";
import { projectPartSilhouette, type OrthoView } from "@/lib/render/geometry";
import { constructionCutBox, type ConstructionMortise } from "./construction-cuts";
import type { FurnitureCategory } from "@/lib/types";

const cases: [FurnitureCategory, Record<string, string | boolean>][] = [
  ["stool", { legShape: "curved-taper", ctTwoWay: true }],
  ["desk", { legShape: "splayed-round-tapered" }],
  ["round-table", { legShape: "pedestal" }],
];
for (const [category, options] of cases) for (const frame of ["blank", "shaped"] as const) {
  it(`${category} ${frame}: CNC slot bounds equal physical local cutter projection`, () => {
    const entry = FURNITURE_CATALOG.find(e => e.category === category)!;
    const design = entry.template!({ ...entry.defaults, material: "maple", options: {
      ...Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue])), ...options, constructionVersion: "2",
    } });
    let checked = 0;
    for (const original of design.parts) for (const mortise of original.mortises) {
      const b = constructionCutBox(mortise);
      if (!b) continue;
      // Isolate each operation and omit tenon outline extensions so the datum
      // is independently recoverable from the unchanged stock silhouette.
      const part = { ...original, tenons: [], mortises: [mortise] };
      const faces = partMachiningFaces(part, [], frame);
      const axis = b.depthAxis;
      const view: OrthoView = axis === "y" ? "top" : axis === "z" ? "front" : "side";
      const center = axis === "y" ? b.cy : axis === "z" ? b.cz : b.cx;
      const faceKey = axis === "y" ? (center > 0 ? "top" : "bottom") : axis === "z" ? (center > 0 ? "front" : "back") : (center > 0 ? "right" : "left");
      const local = { ...part, origin: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, shape: frame === "blank" ? undefined : part.shape };
      const outline = projectPartSilhouette(local, view);
      const minU = Math.min(...outline.map(p => p.x)), maxU = Math.max(...outline.map(p => p.x));
      const maxV = Math.max(...outline.map(p => p.y));
      const u = axis === "x" ? [-b.cz - b.hz, -b.cz + b.hz] : [-b.cx - b.hx, -b.cx + b.hx];
      const v = axis === "y" ? [b.cz - b.hz, b.cz + b.hz] : [b.cy - b.hy + part.visible.thickness / 2, b.cy + b.hy + part.visible.thickness / 2];
      const xs = u.map(n => center > 0 ? n - minU : maxU - n), ys = v.map(n => maxV - n);
      const expected = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const face = faces.find(f => f.faceKey === faceKey)!;
      expect(face, `${part.id} ${faceKey}`).toBeDefined();
      const pts = face.holes[0].pts!;
      const actual = [Math.min(...pts.map(p => p.x)), Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.x)), Math.max(...pts.map(p => p.y))];
      actual.forEach((n, i) => expect(n, `${part.id} ${faceKey} bound ${i}`).toBeCloseTo(expected[i], 6));
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
}

it("preserves the pre-fix legacy CNC output, including shaped splay compensation", () => {
  const entry = FURNITURE_CATALOG.find(e => e.category === "desk")!;
  const design = entry.template!({ ...entry.defaults, material: "maple", options: {
    ...Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue])), legShape: "splayed-round-tapered", constructionVersion: "1",
  } });
  const hashes = {
    blank: "863ad5b8ad43b38099516cf1176e4d30e1b3934cd9e269493c0b4305a2a49f20",
    shaped: "4e17506766fd4f23f86f938117cf497b070eb3a9b572825114a00c5dba6e6014",
  };
  for (const frame of ["blank", "shaped"] as const) {
    expect(createHash("sha256").update(JSON.stringify(design.parts.map(p => partMachiningFaces(p, [], frame)))).digest("hex")).toBe(hashes[frame]);
  }
});

it("does not bypass legacy compensation for invalid construction tags", () => {
  const entry = FURNITURE_CATALOG.find(e => e.category === "desk")!;
  const design = entry.template!({ ...entry.defaults, material: "maple", options: {
    ...Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue])), legShape: "splayed-round-tapered", constructionVersion: "2",
  } });
  const part = design.parts.find(p => p.id === "leg-1")!;
  const valid = part.mortises.find(m => constructionCutBox(m)) as ConstructionMortise;
  const { constructionCut, ...legacy } = valid;
  const faces = (m: typeof legacy) => partMachiningFaces({ ...part, tenons: [], mortises: [m] }, [], "shaped");
  expect(faces(valid)).not.toEqual(faces(legacy));
  for (const tag of [
    { ...constructionCut, version: 1 },
    { ...constructionCut, box: { ...constructionCut.box, hx: NaN } },
  ]) {
    const invalid = { ...legacy, constructionCut: tag };
    expect(constructionCutBox(invalid)).toBeNull();
    expect(faces(invalid)).toEqual(faces(legacy));
  }
});
