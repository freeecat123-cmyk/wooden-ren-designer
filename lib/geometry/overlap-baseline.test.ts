import { expect, it } from "vitest";
import { overlapRegressions } from "./overlap-baseline";
import type { Overlap } from "./overlap";

const joint: Overlap = { a: "rail", b: "leg", intersectionMm: { x: 8, y: 40, z: 18 }, worstAxis: "x" };
it("accepts unchanged and reduced known intersections", () => {
  expect(overlapRegressions([joint], [joint])).toEqual([]);
  expect(overlapRegressions([{ ...joint, a: "leg", b: "rail", intersectionMm: { x: 4, y: 40, z: 18 } }], [joint])).toEqual([]);
  expect(overlapRegressions([], [joint])).toEqual([]);
});
it("detects a replacement pair even when the total count is unchanged", () => {
  expect(overlapRegressions([{ ...joint, a: "shelf" }], [joint])).toEqual(["shelf × leg: new pair"]);
});
it("detects 0.1mm growth on any axis even when total volume decreases", () => {
  expect(overlapRegressions([{ ...joint, intersectionMm: { x: 8.1, y: 2, z: 2 } }], [joint])).toEqual(["rail × leg: increased x overlap"]);
});
it("rejects a non-finite measurement", () => {
  expect(overlapRegressions([{ ...joint, intersectionMm: { x: NaN, y: 40, z: 18 } }], [joint])).toHaveLength(1);
});
