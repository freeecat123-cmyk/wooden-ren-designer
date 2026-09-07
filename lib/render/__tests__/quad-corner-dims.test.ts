/**
 * ⭐測試檔要 .ts（vitest include 沒有 .tsx），所以用 createElement 不用 JSX。
 * quad 側板的零件圖要標斜切尺寸（技能檢定丙級第一題：底深 95、頂緣前端降 30、底緣前端升 15）。
 * 看板面的視圖才標；看側邊（四角投影成一條線）不標；真矩形不標。
 */
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuadCornerDims, ShapeSpecificAnnotation } from "@/lib/render/part-drawing/annotation";
import { sidePanelQuad } from "@/lib/render/quad-profile";
import type { Part } from "@/lib/types";

const side: Part = {
  id: "side-left", nameZh: "左側板", material: "pine", grainDirection: "width",
  visible: { length: 120, width: 350, thickness: 18 },
  origin: { x: 0, y: 0, z: 0 }, tenons: [], mortises: [],
  shape: { kind: "quad", corners: sidePanelQuad({ lx: 120, lz: 350, bottomDepth: 95, topDropFront: 30, bottomRiseFront: 15, backSide: "max" }) },
} as Part;
/** 看板面：local x → svg x、local z → svg y */
const faceCtx = { vbX: 0, vbY: 0, vbW: 400, vbH: 400, partLocalToSvg: (x: number, _y: number, z: number) => ({ x: 200 + x, y: 200 + z }) };
/** 看側邊：local z → svg y、x 全部壓平 */
const edgeCtx = { ...faceCtx, partLocalToSvg: (_x: number, y: number, z: number) => ({ x: 200 + y, y: 200 + z }) };
const labels = (html: string) => [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe("QuadCornerDims", () => {
  it("看板面：標 95／30／15 三個尺寸，沒有 25、沒有 120", () => {
    const html = renderToStaticMarkup(h(ShapeSpecificAnnotation, { ctx: faceCtx, part: side, view: "top" }));
    expect(labels(html).sort()).toEqual(["15", "30", "95"]);
  });
  it("看側邊：投影成一條線 → 不標", () => {
    expect(renderToStaticMarkup(h(QuadCornerDims, { ctx: edgeCtx, part: side, view: "front" }))).toBe("");
  });
  it("真矩形的 quad → 不標", () => {
    const rect = { ...side, shape: { kind: "quad" as const, corners: [[-60, -175], [60, -175], [60, 175], [-60, 175]] as [[number, number], [number, number], [number, number], [number, number]] } };
    expect(renderToStaticMarkup(h(QuadCornerDims, { ctx: faceCtx, part: rect, view: "top" }))).toBe("");
  });
  it("變異：底升改 0 → 只剩 95 跟 30", () => {
    const p = { ...side, shape: { kind: "quad" as const, corners: sidePanelQuad({ lx: 120, lz: 350, bottomDepth: 95, topDropFront: 30, bottomRiseFront: 0, backSide: "max" }) } };
    expect(labels(renderToStaticMarkup(h(QuadCornerDims, { ctx: faceCtx, part: p, view: "top" }))).sort()).toEqual(["30", "95"]);
  });
});
