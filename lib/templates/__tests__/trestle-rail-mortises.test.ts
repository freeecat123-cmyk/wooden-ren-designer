import { expect, it } from "vitest";
import { diningTable } from "../dining-table";
import { mortiseLocalBox } from "@/lib/render/svg-views";

it.each([50, 70, 90])("keeps %s mm trestle leg sockets inside the rail and on its underside", legSize => {
  const design = diningTable({ length: 1800, width: 900, height: 750, material: "pine",
    options: { legShape: "trestle", legSize } });
  const rails = design.parts.filter(p => p.id.endsWith("top-rail"));
  expect(rails).toHaveLength(2);
  for (const rail of rails) for (const m of rail.mortises) {
    const box = mortiseLocalBox(rail, m);
    expect(box.depthAxis).toBe("y");
    expect(box.cy - box.hy).toBeCloseTo(-rail.visible.thickness / 2);
    expect(box.hy * 2).toBeCloseTo(m.depth);
    expect(m.origin.y).toBeGreaterThanOrEqual(0);
    expect(m.origin.y).toBeLessThanOrEqual(rail.visible.thickness);
  }
});
