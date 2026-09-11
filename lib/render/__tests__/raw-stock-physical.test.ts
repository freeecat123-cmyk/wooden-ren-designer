import { expect, it } from "vitest";
import { tray } from "@/lib/templates/tray";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { rawStockSize } from "../part-drawing/raw-stock";
import type { Part } from "@/lib/types";

it.each([0, 15, 30])("uses physical wall stock for a tray splayed at %s degrees", wallSplay => {
  const design = tray({ length: 400, width: 300, height: 70, material: "pine",
    options: { cornerJoinery: "miter", wallSplay } });
  const walls = design.parts.filter(p => p.shape?.kind === "mitered-ends");
  expect(walls).toHaveLength(4);
  if (wallSplay > 0) expect(walls.every(p => p.joineryView!.visible!.length > p.visible.length)).toBe(true);
  for (const wall of walls) {
    const cut = calculateCutDimensions(wall);
    expect(rawStockSize(wall)).toEqual({
      L: Math.round(cut.length + 12), W: Math.round(cut.width + 4), T: Math.round(cut.thickness + 2),
    });
  }
});

it("uses physical dimensions before adding tenons and trimming allowances", () => {
  const part: Part = { id: "physical", nameZh: "physical", material: "pine", grainDirection: "length",
    visible: { length: 100, width: 30, thickness: 10 }, origin: { x: 0, y: 0, z: 0 },
    joineryView: { visible: { length: 120, width: 40, thickness: 20 } },
    tenons: [{ position: "end", type: "blind-tenon", length: 10, width: 10, thickness: 10 }], mortises: [] };
  expect(rawStockSize(part)).toEqual({ L: 142, W: 44, T: 22 });
  expect(rawStockSize({ ...part, joineryView: undefined })).toEqual({ L: 122, W: 34, T: 12 });
});
