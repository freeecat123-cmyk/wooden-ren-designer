/**
 * 穿模稽核的 cut coverage 要認得 quad 形狀的零件：
 * 技能檢定家具木工丙級側板（四邊各不相同）背緣開 6mm 溝嵌夾板，溝是 cosmetic 方盒，
 * 跟外形是不是矩形無關。2026-09-07 前 overlap.ts 只認 box/mitered-ends/chamfered-edges/dovetail-ends，
 * quad 一律不算 cut → 夾板入溝被當穿模。
 */
import { describe, it, expect } from "vitest";
import { findOverlaps } from "@/lib/geometry/overlap";
import { sidePanelQuad } from "@/lib/render/quad-profile";
import type { Part } from "@/lib/types";

/** 跟 cert-c1 同一組：左側板（quad）＋ 6mm 夾板背板嵌進背緣 6 深溝 */
function build(withCut: boolean): Part[] {
  const side: Part = {
    id: "side-left", nameZh: "左側板", material: "pine", grainDirection: "width",
    visible: { length: 120, width: 350, thickness: 18 },
    origin: { x: -141, y: 0, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    shape: { kind: "quad", corners: sidePanelQuad({ lx: 120, lz: 350, bottomDepth: 95, topDropFront: 30, bottomRiseFront: 15, backSide: "max" }) },
    tenons: [],
    mortises: withCut ? [{
      origin: { x: 60 - 3, y: 18, z: -175 + 176.5 }, depth: 6, length: 6, width: 187, through: false, cosmetic: true, label: "夾板背板入溝（6 深）",
    }] : [],
  } as Part;
  const ply: Part = {
    id: "back-panel", nameZh: "夾板背板", material: "pine", grainDirection: "length",
    visible: { length: 276, width: 187, thickness: 6 },
    origin: { x: 0, y: 80, z: -57 },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [], mortises: [],
  } as Part;
  return [side, ply];
}

describe("quad 側板的 cosmetic 溝槽也算 cut coverage", () => {
  it("有溝 → 夾板嵌進去不算穿模", () => {
    expect(findOverlaps(build(true))).toHaveLength(0);
  });
  it("沒溝 → 同一組零件要報穿模（證明是溝在放行，不是 quad 被整個跳過）", () => {
    const ov = findOverlaps(build(false));
    expect(ov).toHaveLength(1);
    expect([ov[0].a, ov[0].b].sort()).toEqual(["back-panel", "side-left"]);
  });
});
