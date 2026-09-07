import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, type FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";
import { ctStretcherOutwardShift } from "./_helpers";

function build(entry: FurnitureCatalogEntry, over: Record<string, string | number | boolean>): FurnitureDesign {
  const opts = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec: OptionSpec) => { acc[spec.key] = spec.defaultValue; return acc; },
    {},
  );
  Object.assign(opts, over);
  return entry.template!({
    length: entry.defaults.length, width: entry.defaults.width, height: entry.defaults.height,
    material: "maple" as MaterialId, options: opts,
  });
}
const xRange = (p: FurnitureDesign["parts"][number]) => {
  const e = worldExtents(p);
  return [p.origin.x - e.xExt / 2, p.origin.x + e.xExt / 2] as const;
};

describe("§A11.9 弧肩斜腳左右下橫撐外挪量（手算）", () => {
  it("貼齊腳外面的配置：need 0.76、room 0 → 0（不准出腳）", () => {
    // 方凳預設：legW 35、t 20、lsAxis 165、legCenter 157.5、scale → recession 15.76
    const scale = 1 - (2 * 15.76) / 35;
    expect(ctStretcherOutwardShift({ legW: 35, scaleAtY: scale, stretcherThickness: 20, stretcherAxis: 165, legCenter: 157.5 })).toBe(0);
  });
  it("坐腳中線的舊配置：need 8.26、room 7.5 → 7.5", () => {
    const scale = 1 - (2 * 15.76) / 35;
    expect(ctStretcherOutwardShift({ legW: 35, scaleAtY: scale, stretcherThickness: 20, stretcherAxis: 157.5, legCenter: 157.5 })).toBeCloseTo(7.5, 9);
  });
  it("腳沒收窄（scale 1）→ 0", () => {
    expect(ctStretcherOutwardShift({ legW: 35, scaleAtY: 1, stretcherThickness: 20, stretcherAxis: 157.5, legCenter: 157.5 })).toBe(0);
  });
});

describe("弧肩斜腳：左右下橫撐不能凸出腳的外面（2026-09-02 木頭仁回報）", () => {
  const cases: Array<[string, Record<string, string | number | boolean>]> = [
    ["stool", { legShape: "curved-taper" }],
    ["stool", { legShape: "curved-taper", ctTwoWay: true }],
    ["stool", { legShape: "curved-taper", lowerStretcherStaggerMm: 20 }],
    ["dining-table", { legShape: "curved-taper" }],
    ["dining-chair", { legShape: "curved-taper" }],
  ];
  for (const [cat, over] of cases) {
    it(`${cat} ${JSON.stringify(over)}`, () => {
      const entry = FURNITURE_CATALOG.find((e) => e.category === cat)!;
      const d = build(entry, over);
      const legs = d.parts.filter((p) => /^leg-/.test(p.id));
      const stretchers = d.parts.filter((p) => /^ls-(left|right)$/.test(p.id) || /^(left|right)-lower-stretcher$/.test(p.id) || /lower-stretcher-(left|right)/.test(p.id));
      if (stretchers.length === 0) return;   // 這款沒有左右下橫撐
      const legOuter = Math.max(...legs.map((l) => Math.abs(l.origin.x) + worldExtents(l).xExt / 2));
      for (const s of stretchers) {
        const [x0, x1] = xRange(s);
        const outer = Math.max(Math.abs(x0), Math.abs(x1));
        expect(outer, `${s.id} 外面 ${outer} vs 腳外面 ${legOuter}`).toBeLessThanOrEqual(legOuter + 1e-6);
      }
    });
  }
});
