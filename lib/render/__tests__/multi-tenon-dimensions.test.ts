import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { certC1 } from "@/lib/templates/cert-c1";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { rawStockSize } from "../part-drawing/raw-stock";
import { T1Dimensions } from "../part-drawing/annotation";
import type { Part, Tenon } from "@/lib/types";

const design = certC1({ length: 320, width: 120, height: 350, material: "pine", options: {} });
const shelf = design.parts.find(p => p.tenons.filter(t => t.position === "start").length === 2)!;

it("adds each end once when estimating the Class C double-tenon shelf stock", () => {
  expect(shelf).toBeDefined();
  expect(calculateCutDimensions(shelf).length).toBe(320);
  expect(rawStockSize(shelf).L).toBe(332);
});

it.each(["front", "top"] as const)("labels the shelf cut length as 320 in %s view", view => {
  const ctx = { vbX: 0, vbY: 0, vbW: 500, vbH: 500,
    partLocalToSvg: (x: number, y: number, z: number) => ({ x: 200 + x, y: 200 - (view === "top" ? z : y) }) };
  const html = renderToStaticMarkup(createElement(T1Dimensions, { part: shelf, view, ctx }));
  expect(html).toContain("含榫 320");
  expect(html).not.toContain("376");
});

it.each([
  ["start", "end", "L", 276], ["left", "right", "W", 116], ["bottom", "top", "T", 44],
] as const)("takes the longest of multiple tenons on %s/%s", (start, end, axis, expected) => {
  const tenons = [start, start, end, end].map((position, i) => ({
    position, type: "blind-tenon", length: [10, 20, 5, 12][i], width: 5, thickness: 5,
  } as Tenon));
  const part = { ...shelf, shape: undefined, visible: { length: 232, width: 80, thickness: 10 }, tenons } as Part;
  expect(rawStockSize(part)[axis]).toBe(expected);
});
