import { expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { findOverlaps } from "./overlap";
import type { FurnitureCategory } from "@/lib/types";

type Options = Record<string, string | number | boolean>;
export function revisedDesign(category: FurnitureCategory, options: Options = {}, version = "2") {
  const e = FURNITURE_CATALOG.find(e => e.category === category)!;
  return e.template!({ ...e.defaults, material: "maple", options: { ...Object.fromEntries(e.optionSchema!.map(s => [s.key, s.defaultValue])), ...options, constructionVersion: version } });
}
const cases: [FurnitureCategory, Options][] = [
  ["stool", { legShape: "curved-taper", ctTwoWay: true }],
  ["stool", { legShape: "curved-taper", ctTwoWay: true, lowerStretcherThickness: 24 }],
  ["desk", { legShape: "splayed-round-tapered" }],
  ["desk", { legShape: "splayed-round-tapered", legSize: 65 }],
  ["round-table", { legShape: "pedestal" }],
];
for (const [category, options] of cases) it(`machines intersections without changing blanks: ${category} ${JSON.stringify(options)}`, () => {
  const old = revisedDesign(category, options, "1");
  const revised = revisedDesign(category, options);
  expect(revised.parts.map(p => [p.id, p.visible, p.origin, p.rotation, p.shape])).toEqual(old.parts.map(p => [p.id, p.visible, p.origin, p.rotation, p.shape]));
  const parts = toBeginnerMode(revised).parts;
  expect(findOverlaps(parts)).toEqual([]);
  expect(findOverlaps(parts.map(p => ({ ...p, mortises: p.mortises.filter(m => !("constructionCut" in m)) })))).not.toEqual([]);
});

for (const options of [{ legSize: 45 }, { drawerStyle: "pedestal" }, { apronThickness: 20 }] as Options[]) {
  it(`keeps unsafe desk variants unresolved instead of hiding them: ${JSON.stringify(options)}`, () => {
    const revised = revisedDesign("desk", { legShape: "splayed-round-tapered", ...options });
    expect(revised.warnings?.some(w => w.includes("修訂加工未套用"))).toBe(true);
    expect(findOverlaps(toBeginnerMode(revised).parts).length).toBeGreaterThan(0);
  });
}
