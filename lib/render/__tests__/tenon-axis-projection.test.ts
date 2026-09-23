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

  it("ignores axis for part-local position (axis is world-frame)", () => {
    // Regression: 2af8c14 applied tenon.axis as part-local offset → bug
    // (world-frame vector mis-applied caused tenon to drift after part.rotation).
    // Fix: axis only affects orientation/annotation, never part-local position.
    const p = basePart();
    const tenonNoAxis = tenonLocalBox(p, {
      position: "end", type: "shouldered-tenon",
      length: 20, width: 30, thickness: 12,
    });
    const tenonTilted = tenonLocalBox(p, {
      position: "end", type: "shouldered-tenon",
      length: 20, width: 30, thickness: 12,
      axis: { x: 0.9848, y: -0.1736, z: 0 },
    });
    // 兩者 part-local box 應完全相同（axis 純用作標籤/orientation 資訊）
    expect(tenonTilted.cx).toBe(tenonNoAxis.cx);
    expect(tenonTilted.cy).toBe(tenonNoAxis.cy);
    expect(tenonTilted.cz).toBe(tenonNoAxis.cz);
  });
});
