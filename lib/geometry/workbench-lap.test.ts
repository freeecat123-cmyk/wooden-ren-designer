import { expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { findOverlaps } from "./overlap";

const lapCases: Record<string, string | number | boolean>[] = [
  {}, { plyTopLayers: 2, legLayers: 3 }, { plyTopLayers: 4, legLayers: 5 },
  { withApron: true, lowerStretcherArrangement: "h-frame", knockdown: "bolt" },
  { frontVise: "leg", legLayers: 3, withUnderShelf: true },
  { benchStyle: "apron" }, { topSplit: "center-well", drawerCount: 2 },
];
for (const overrides of lapCases) {
  it(`recognizes actual plywood lap notches: ${JSON.stringify(overrides)}`, () => {
    const entry = FURNITURE_CATALOG.find(e => e.category === "workbench")!;
    const options = { ...Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue])), materialStyle: "plywood", ...overrides };
    const design = toBeginnerMode(entry.template!({ ...entry.defaults, material: "maple", options }));
    const parts = design.parts.filter(p => /^(leg-\d+|ls-.+|apron-.+)$/.test(p.id));
    expect(findOverlaps(parts)).toEqual([]);
    const uncut = parts.map(p => ({ ...p, mortises: p.mortises.filter(m => !(m.label ?? "").startsWith("搭接槽")) }));
    expect(findOverlaps(uncut).length).toBeGreaterThanOrEqual(8);
    const shallow = parts.map(p => ({ ...p, mortises: p.mortises.map(m => (m.label ?? "").startsWith("搭接槽") ? { ...m, depth: m.depth / 2 } : m) }));
    expect(findOverlaps(shallow).length).toBeGreaterThanOrEqual(8);
  });
}
