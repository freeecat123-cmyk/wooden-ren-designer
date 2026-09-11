import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG } from "../index";

const entry = FURNITURE_CATALOG.find(item => item.category === "tray")!;
const limits = entry.limits!;
const generate = (dimensions: { length: number; width: number; height: number }) =>
  entry.template!({ ...dimensions, material: "pine" });
const rangeWarnings = (dimensions: { length: number; width: number; height: number }) =>
  (generate(dimensions).warnings ?? []).filter(text => text.includes("超過合理範圍"));

describe("tray range matches catalog controls", () => {
  it("accepts its own default dimensions", () => {
    expect(rangeWarnings(entry.defaults)).toEqual([]);
  });
  it("accepts the catalog limits", () => {
    expect(rangeWarnings(limits)).toEqual([]);
  });
  it.each(["length", "width", "height"] as const)("warns beyond %s limit", axis => {
    expect(rangeWarnings({ ...limits, [axis]: limits[axis] + 1 })).toHaveLength(1);
  });
});
