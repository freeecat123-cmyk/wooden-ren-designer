import { describe, it, expect } from "vitest";
import type { MachiningFace } from "@/lib/export/mortise-faces";
import { templateSheetSvg, PROOF_RULER_MM } from "./sheet";
import { PAPERS } from "./paper";

const A3 = PAPERS.find((p) => p.id === "A3")!;

const face: MachiningFace = {
  faceKey: "flat",
  faceLabelZh: "攤平面",
  outline: [
    { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 80 }, { x: 0, y: 80 },
  ],
  holes: [
    { kind: "rect", pts: [{ x: 20, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 40 }, { x: 20, y: 40 }], through: false, label: "榫眼" },
    { kind: "circle", cx: 300, cy: 40, r: 4, through: true, label: "螺絲孔" },
  ],
  tenons: [],
  w: 400,
  h: 80,
};

const base = {
  face,
  placement: { paper: A3, angleDeg: 0, swapped: false },
  partNo: "P-02",
  nameZh: "牙條",
  qty: 4,
};

describe("templateSheetSvg", () => {
  it("viewBox 就是紙張尺寸（mm）", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain('viewBox="0 0 420 297"');
  });

  it("紙張直放時 viewBox 長短邊對調", () => {
    const svg = templateSheetSvg({ ...base, placement: { paper: A3, angleDeg: 0, swapped: true } });
    expect(svg).toContain('viewBox="0 0 297 420"');
  });

  it("畫出輪廓、方榫孔與圓孔", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain("<path");
    expect(svg).toContain("<circle");
  });

  it("輪廓線寬 0.3mm（列印看得見，不是雷切的 0.1）", () => {
    expect(templateSheetSvg(base)).toContain('stroke-width="0.3"');
  });

  it("含 100mm 證明尺與標示", () => {
    const svg = templateSheetSvg(base);
    expect(PROOF_RULER_MM).toBe(100);
    expect(svg).toContain("100mm");
  });

  it("部件名稱與件號有出現", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain("牙條");
    expect(svg).toContain("P-02");
    expect(svg).toContain("×4");
  });

  it("絕不輸出 font-weight 500 或 600（svg2pdf 會讓中文變亂碼）", () => {
    const svg = templateSheetSvg(base);
    expect(svg).not.toMatch(/font-weight="(500|600)"/);
  });

  it("斜擺時輸出 rotate transform", () => {
    const svg = templateSheetSvg({ ...base, placement: { paper: A3, angleDeg: 21, swapped: false } });
    expect(svg).toContain("rotate(21");
  });

  it("圓孔要有中心十字，方便點中心", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain('data-mark="center-cross"');
  });
});
