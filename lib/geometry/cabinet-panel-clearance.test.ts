import { expect, it } from "vitest";
import { chineseCabinet } from "../templates/chinese-cabinet";
import { clearedByCabinetPanelGrooves } from "./cabinet-panel-clearance";
import { mortiseLocalBox } from "../render/svg-views";
import type { ConstructionMortise } from "./construction-cuts";

for (const dimensions of [[900, 500, 1800], [1000, 550, 2000]]) for (const splayAngle of [1, 3]) {
  it(`proves full-height raked panel engagement: ${dimensions.join("x")}/${splayAngle}`, () => {
    const d = chineseCabinet({ length: dimensions[0], width: dimensions[1], height: dimensions[2], material: "maple",
      options: { constructionVersion: "2", cabinetPreset: "round-cabinet", splayAngle, legShape: "box" } });
    let checked = 0;
    for (const rail of d.parts.filter(p => p.mortises.some(m => m.label === "板心槽 5mm"))) {
      const panel = d.parts.find(p => p.id === rail.id.replace(/-(upper|lower)-rail$/, "-panel"))!;
      expect(clearedByCabinetPanelGrooves(rail, panel), rail.id).toBe(true);
      expect(clearedByCabinetPanelGrooves({ ...rail, id: "arbitrary-receiver" }, { ...panel, id: "arbitrary-insert" })).toBe(true);
      const source = rail.mortises.find(m => m.label === "板心槽 5mm")!;
      const box = mortiseLocalBox(rail, source);
      const disconnected: ConstructionMortise[] = [-1, 1].map(sign => ({ ...source, shape: "rect", depth: 1.5,
        origin: { ...source.origin, y: box.cy + sign * 1.75 + rail.visible.thickness / 2 },
        constructionCut: { version: 2, box: { cx: box.cx, cy: box.cy + sign * 1.75, cz: box.cz,
          hx: box.hx, hy: 0.75, hz: box.hz, depthAxis: "y" } },
      }));
      expect(clearedByCabinetPanelGrooves({ ...rail, mortises: disconnected }, panel), `${rail.id}/uncut middle`).toBe(false);
      for (const mutation of ["missing", "shallow", "shifted", "narrow"]) {
        const broken = structuredClone(rail);
        if (mutation === "missing") broken.mortises = [];
        else for (const m of broken.mortises) {
          if (mutation === "shallow") m.depth = 4;
          if (mutation === "shifted") m.origin.z += 2;
          if (mutation === "narrow") m.width = 5;
        }
        expect(clearedByCabinetPanelGrooves(broken, panel), `${rail.id}/${mutation}`).toBe(false);
      }
      checked++;
    }
    expect(checked).toBe(6);
  });
}
