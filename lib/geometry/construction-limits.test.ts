import { expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { constructionCutBox, constructionLimits, type ConstructionMortise } from "./construction-cuts";
import type { FurnitureCategory, Part } from "@/lib/types";
import { findOverlaps } from "./overlap";

const cases: [FurnitureCategory, Record<string, string | number | boolean>][] = [
  ["stool", { legShape: "curved-taper", ctTwoWay: true }],
  ["desk", { legShape: "splayed-round-tapered" }],
  ["round-table", { legShape: "pedestal" }],
];
function parts(category: FurnitureCategory, options: Record<string, string | number | boolean>) {
  const e = FURNITURE_CATALOG.find(e => e.category === category)!;
  return e.template!({ ...e.defaults, material: "maple", options: { ...Object.fromEntries(e.optionSchema!.map(s => [s.key, s.defaultValue])), ...options, constructionVersion: "2" } }).parts.filter(p => p.mortises.some(m => constructionCutBox(m)));
}
for (const [category, options] of cases) it(`${category}: all slots are exterior-accessible and retain continuous load paths`, () => {
  for (const part of parts(category, options)) {
    const limit = constructionLimits(part);
    expect(limit.issues, part.id).toEqual([]);
    expect(limit.accessibleCuts).toBe(part.mortises.filter(m => constructionCutBox(m)).length);
    expect(limit.minWebMm).toBeGreaterThanOrEqual(6);
    expect(limit.maxDepthMm).toBeGreaterThan(0);
    if (category === "stool") expect(limit.maxDepthMm).toBeLessThan(1.7);
    if (part.id.startsWith("leg-")) expect(limit.maxDepthMm).toBeLessThanOrEqual(part.visible.length * 0.6);
    if (category === "round-table") {
      expect(limit.minWebMm).toBe(45);
      expect(limit.maxDepthMm).toBeCloseTo(35.25);
      expect(limit.maxDepthMm).toBeLessThan(part.visible.thickness * 0.2);
    }
  }
});

it("rejects sealed cavities, severed posts, missing hubs and oversized rail rebates", () => {
  for (const [category, options] of cases) for (const part of parts(category, options)) {
    const m = part.mortises.find(m => constructionCutBox(m)) as ConstructionMortise;
    const broken = (box: ConstructionMortise["constructionCut"]["box"]): Part => {
      const mortise: ConstructionMortise = { ...m, constructionCut: { version: 2, box } };
      return { ...part, mortises: [mortise] };
    };
    const closed = broken({ cx: 0, cy: 0, cz: 0, hx: 0.5, hy: 0.5, hz: 0.5, depthAxis: "y" });
    expect(constructionLimits(closed).issues).toContain("Enclosed cutter has no verified exterior opening");
    const severed = broken({ cx: 0, cy: 0, cz: 0, hx: part.visible.length, hy: part.visible.thickness, hz: part.visible.width, depthAxis: "y" });
    expect(constructionLimits(severed).issues.some(s => /spine|hub|section/.test(s))).toBe(true);
  }
});

it("rejects opposing-face aggregate cuts even when every individual cut passes", () => {
  const original = parts("stool", { legShape: "curved-taper", ctTwoWay: true })[0];
  const source = original.mortises.find(m => constructionCutBox(m)) as ConstructionMortise;
  const slot = (cy: number, hy: number): ConstructionMortise => ({ ...source,
    constructionCut: { version: 2, box: { cx: 0, cy, cz: 0, hx: 10, hy, hz: 20, depthAxis: "y" } },
  });
  const stock: Part = { ...original, shape: undefined, rotation: undefined,
    visible: { length: 100, thickness: 20, width: 40 }, mortises: [] };
  for (const depth of [8, 10]) {
    const cuts = [slot(10 - depth / 2, depth / 2), slot(-10 + depth / 2, depth / 2)];
    for (const cut of cuts) expect(constructionLimits({ ...stock, mortises: [cut] }).issues).toEqual([]);
    const combined = constructionLimits({ ...stock, mortises: cuts });
    expect(combined.issues).toContain("Combined corner cuts remove more than 50% of a rail section");
    expect(combined.minWebMm).toBeCloseTo(20 - 2 * depth);
    const obstacle: Part = { ...stock, id: "broken-control-obstacle", visible: { length: 10, thickness: 20, width: 20 } };
    expect(findOverlaps([{ ...stock, mortises: cuts }, obstacle])).toHaveLength(1);
  }
  const safe = constructionLimits({ ...stock, mortises: [slot(7.5, 2.5), slot(-7.5, 2.5)] });
  expect(safe.issues).toEqual([]);
  expect(safe.minWebMm).toBe(10);
  const adjacent = [slot(5, 5), slot(-5, 5)];
  adjacent[0].constructionCut.box.cx = -10;
  adjacent[1].constructionCut.box.cx = 10;
  expect(constructionLimits({ ...stock, mortises: adjacent }).issues)
    .toContain("Combined corner cuts leave less than 6mm continuous web");
});

it("rejects a CNC depth axis pointing at a closed face of an otherwise open slot", () => {
  const part = parts("desk", { legShape: "splayed-round-tapered" }).find(p => p.id === "leg-1")!;
  const source = part.mortises.find(m => constructionCutBox(m)) as ConstructionMortise;
  expect(source.constructionCut.box.depthAxis).toBe("x");
  const wrong: ConstructionMortise = { ...source, constructionCut: { version: 2,
    box: { ...source.constructionCut.box, depthAxis: "z" } } };
  expect(constructionLimits({ ...part, mortises: [wrong] }).issues)
    .toContain("Selected machining face has no verified exterior opening");
});

it.each([0, 3])("checks Z=%s boundaries where opposite half-depth slots meet with zero web", seam => {
  const original = parts("stool", { legShape: "curved-taper", ctTwoWay: true })[0];
  const source = original.mortises.find(m => constructionCutBox(m)) as ConstructionMortise;
  const stock: Part = { ...original, shape: undefined, rotation: undefined,
    visible: { length: 100, thickness: 20, width: 40 }, mortises: [] };
  const cuts = [-1, 1].map(sign => ({ ...source, constructionCut: { version: 2 as const,
    box: { cx: 0, cy: sign * 5, cz: (sign * 20 + seam) / 2,
      hx: 10, hy: 5, hz: (20 - sign * seam) / 2, depthAxis: "y" as const } } }));
  for (const cut of cuts) {
    const single = constructionLimits({ ...stock, mortises: [cut] });
    expect(single.issues).toEqual([]);
    expect(single.minWebMm).toBe(10);
  }
  const combined = constructionLimits({ ...stock, mortises: cuts });
  expect(combined.minWebMm).toBe(0);
  expect(combined.issues).toContain("Combined corner cuts leave less than 6mm continuous web");
  const safeCuts = cuts.map(cut => ({ ...cut, constructionCut: { ...cut.constructionCut,
    box: { ...cut.constructionCut.box, cy: Math.sign(cut.constructionCut.box.cy) * 7.5, hy: 2.5 } } }));
  const safe = constructionLimits({ ...stock, mortises: safeCuts });
  expect(safe.issues).toEqual([]);
  expect(safe.minWebMm).toBe(10);
});
