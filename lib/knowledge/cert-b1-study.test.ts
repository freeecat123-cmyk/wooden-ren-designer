import { expect, it } from "vitest";
import { certB1Study } from "./cert-b1-study";

it("builds the reference envelope without pretending to be a fabrication template", () => {
  const d = certB1Study();
  expect(d.overall).toEqual({ length: 450, width: 450, thickness: 450 });
  expect(d.parts).toHaveLength(6);
  expect(d.warnings?.length).toBeGreaterThan(0);
  expect(d.parts.every(p => p.tenons.length === 0 && p.mortises.length === 0)).toBe(true);
});

it("places rectangular legs inside the 410mm frame with an 18mm top", () => {
  const d = certB1Study();
  const legs = d.parts.filter(p => p.id.startsWith("study-leg"));
  expect(legs).toHaveLength(4);
  expect(Math.min(...legs.map(p => p.origin.x - p.visible.length / 2))).toBe(-205);
  expect(Math.max(...legs.map(p => p.origin.x + p.visible.length / 2))).toBe(205);
  expect(Math.min(...legs.map(p => p.origin.z - p.visible.thickness / 2))).toBe(-205);
  expect(Math.max(...legs.map(p => p.origin.z + p.visible.thickness / 2))).toBe(205);
  expect(legs.every(p => p.visible.width === 432 && p.rotation?.x === Math.PI / 2)).toBe(true);
});
