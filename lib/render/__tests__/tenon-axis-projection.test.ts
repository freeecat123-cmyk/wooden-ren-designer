import { describe, it, expect } from "vitest";
import { tenonLocalBox } from "../svg-views";
import type { Part } from "@/lib/types";

const basePart = (): Part => ({
  id: "test-apron", nameZh: "test", material: "white-oak",
  grainDirection: "length",
  visible: { length: 400, width: 60, thickness: 20 },
  origin: { x: 0, y: 0, z: 0 },
  tenons: [], mortises: [],
});

describe("tenonLocalBox with axis override", () => {
  it("falls back to position-derived box when axis absent", () => {
    const p = basePart();
    const box = tenonLocalBox(p, {
      position: "end", type: "shouldered-tenon",
      length: 20, width: 30, thickness: 12,
    });
    expect(box.cx).toBeGreaterThan(0); // end tenon centred at +length/2 along x
  });

  it("offsets the box along the axis when axis is present", () => {
    const p = basePart();
    const tenonNoAxis = tenonLocalBox(p, {
      position: "end", type: "shouldered-tenon",
      length: 20, width: 30, thickness: 12,
    });
    const tenonTilted = tenonLocalBox(p, {
      position: "end", type: "shouldered-tenon",
      length: 20, width: 30, thickness: 12,
      axis: { x: 0.9848, y: -0.1736, z: 0 }, // ~10° tilt downward
    });
    // Center moves slightly down (cy lower) and slightly back in x
    expect(tenonTilted.cy).toBeLessThan(tenonNoAxis.cy);
    expect(tenonTilted.cx).toBeLessThan(tenonNoAxis.cx);
    expect(tenonTilted.cx).toBeGreaterThan(tenonNoAxis.cx * 0.9);
  });
});
