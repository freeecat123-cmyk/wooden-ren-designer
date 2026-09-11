import { describe, expect, it } from "vitest";
import { buildOrdinaryTenonGeometry } from "../mortise-csg";
import { tenonEndChamferPoints } from "../tenon-end-chamfer";
import { certC1 } from "@/lib/templates/cert-c1";
import { partExportGeometry } from "@/lib/export/three-d-export";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreeViewLayout } from "../svg-views";
import { hashPart } from "../part-drawing/grouping";
import { deriveBuildSteps } from "@/lib/steps/derive";
import { translateSteps } from "@/lib/steps/translations";

describe("Class C exposed tip bevel", () => {
  for (const position of ["start", "end"] as const) {
    it(`${position}: retains the shoulder and length, removes 3mm at the tip`, () => {
      const sign = position === "end" ? 1 : -1;
      const points = tenonEndChamferPoints(position, { hx: 14, hy: 9, hz: 10 }, 3)!;
      expect(points.slice(0, 4).every(([x,y,z]) => x === -sign * 14 && Math.abs(y) === 9 && Math.abs(z) === 10)).toBe(true);
      expect(points.slice(8).every(([x,y,z]) => x === sign * 14 && Math.abs(y) === 6 && Math.abs(z) === 7)).toBe(true);
      const g = buildOrdinaryTenonGeometry(position, { hx: 14, hy: 9, hz: 10 }, false, 1, 0, 3);
      g.computeBoundingBox();
      expect(g.boundingBox!.min.toArray()).toEqual([-14, -9, -10]);
      expect(g.boundingBox!.max.toArray()).toEqual([14, 9, 10]);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(p.getX(i) - sign * 14) < 0.001) {
          expect(Math.abs(p.getY(i))).toBeCloseTo(6);
          expect(Math.abs(p.getZ(i))).toBeCloseTo(7);
        }
      }
      g.dispose();
    });
  }
  it("flush practice tenons have no bevel inside the mortise", () => {
    const d = certC1({ length: 320, width: 120, height: 350, material: "pine", options: {tenonProud: 0} });
    expect(d.parts.find(p => p.id === "shelf")!.tenons.every(t => t.endChamferMm === 0)).toBe(true);
  });
  it("dimensional joinery export retains bevels and finite vertices", () => {
    const d = certC1({ length: 320, width: 120, height: 350, material: "pine" });
    const shelf = d.parts.find(p => p.id === "shelf")!;
    const g = partExportGeometry(shelf, "joinery-accurate", d.parts);
    const p = g.getAttribute("position");
    expect(p.count).toBeGreaterThan(0);
    expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x).toBeCloseTo(160);
    expect(g.boundingBox!.min.x).toBeCloseTo(-160);
    g.dispose();
  });
  it("orthographic output includes tip outlines and no invalid coordinates", () => {
    const d = certC1({ length: 320, width: 120, height: 350, material: "pine" });
    const html = renderToStaticMarkup(createElement(ThreeViewLayout, { design: d, joineryMode: true }));
    expect(html).toContain('data-tenon-end-chamfer="3"');
    expect(html).not.toMatch(/NaN|Infinity/);
    const plain = { ...d, parts: d.parts.map(p => ({ ...p, tenons: p.tenons.map(t => ({ ...t, endChamferMm: 0 })) })) };
    expect(renderToStaticMarkup(createElement(ThreeViewLayout, { design: plain, joineryMode: true }))).not.toContain("data-tenon-end-chamfer");
  });
  it("R3 lip still supports dimensional joinery export", () => {
    const d = certC1({ length: 320, width: 120, height: 350, material: "pine" });
    const lip = d.parts.find(p => p.id === "front-lip")!;
    const g = partExportGeometry(lip, "joinery-accurate", d.parts);
    expect(Array.from(g.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x).toBeCloseTo(144);
    expect(g.boundingBox!.min.x).toBeCloseTo(-144);
    g.dispose();
  });
  it("missing-back warning is localized and default source discrepancies remain explicit", () => {
    const d = certC1({ length: 320, width: 120, height: 350, material: "pine", locale: "en", options: { withPanel: false } });
    expect(d.warnings?.join(" ")).toContain("Plywood back removed");
    expect(d.notes).toContain("Ø2.4×15");
    expect(d.notes).toContain("Ø3×15");
  });
  it("part grouping and work estimates distinguish bevelled from plain tips", () => {
    const d = certC1({ length: 320, width: 120, height: 350, material: "pine" });
    const shelf = d.parts.find(p => p.id === "shelf")!;
    const plain = { ...shelf, tenons: shelf.tenons.map(t => ({ ...t, endChamferMm: 0 })) };
    expect(hashPart(shelf)).not.toBe(hashPart(plain));
    const steps = deriveBuildSteps(d);
    const step = steps.find(s => s.id === "exposed-tenon-tip-chamfer")!;
    expect(step.estimatedMinutes).toBe(20);
    expect(step.partIds).toEqual(["shelf"]);
    expect(translateSteps(steps, d, "en").find(s => s.id === step.id)?.description).toContain("3×45°");
    const half = { ...d, parts: [{ ...shelf, tenons: shelf.tenons.slice(0, 2) }] };
    expect(deriveBuildSteps(half).find(s => s.id === step.id)?.estimatedMinutes).toBe(10);
    expect(deriveBuildSteps({ ...d, parts: [plain] }).some(s => s.id === step.id)).toBe(false);
  });
});
