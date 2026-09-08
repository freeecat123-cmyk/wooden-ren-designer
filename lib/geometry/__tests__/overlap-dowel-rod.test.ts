/**
 * 圓木釘插在圓孔裡不是穿模：對手是圓料時，這件上的圓孔（不限 cosmetic）也算 cut coverage。
 * 2026-09-07 丙級第一題把木釘做成零件後，穿模稽核先報了 16 組（8 支 × 橫檔/側板）。
 */
import { describe, it, expect } from "vitest";
import { findOverlaps } from "@/lib/geometry/overlap";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { FURNITURE_CATALOG } from "@/lib/templates";
import type { Part } from "@/lib/types";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-c1")!;
const build = () => entry.template!({ ...entry.defaults, material: "pine" });

describe("木釘零件 × 圓孔", () => {
  it("預設考題：8 支木釘、0 穿模", () => {
    const d = build();
    expect(d.parts.filter((p) => p.visual === "dowel")).toHaveLength(8);
    expect(findOverlaps(d.parts)).toHaveLength(0);
  });
  it("側板沒鑽孔 → 同一組木釘要報穿模（證明是孔在放行）", () => {
    const d = build();
    const parts = d.parts.map((p) => p.id === "side-left" ? { ...p, mortises: p.mortises.filter((m) => m.shape !== "round") } : p);
    expect(findOverlaps(parts).length).toBe(4);
  });
  it("木釘往外挪 5mm（超出孔）→ 報穿模", () => {
    const d = build();
    const parts = d.parts.map((p) => p.id === "dowel-l-back-1" ? { ...p, origin: { ...p.origin, x: p.origin.x - 5 } } : p);
    expect(findOverlaps(parts).map((o) => [o.a, o.b].sort().join("×"))).toEqual(["dowel-l-back-1×side-left"]);
  });
  it("純榫卯題沒有組裝版：toBeginnerMode 原樣回傳（榫眼不能拆，拆了木釘就穿模）", () => {
    const d = build();
    expect(d.joineryOnly).toBe(true);
    const b = toBeginnerMode(d);
    expect(b.parts.map((p) => p.mortises.length)).toEqual(d.parts.map((p) => p.mortises.length));
    expect(b.parts.map((p) => p.tenons.length)).toEqual(d.parts.map((p) => p.tenons.length));
    expect(findOverlaps(b.parts)).toHaveLength(0);
    // 對照：拿掉旗標就會被拆
    const stripped = toBeginnerMode({ ...d, joineryOnly: undefined });
    expect(stripped.parts.find((p) => p.id === "shelf")!.tenons).toHaveLength(0);
  });
});

describe("clearedByRoundHole 的邊界（審查員 2026-09-08）", () => {
  const host = (m: Partial<Part["mortises"][number]>): Part => ({
    id: "host", nameZh: "母件", material: "pine", grainDirection: "length",
    visible: { length: 100, width: 50, thickness: 18 }, origin: { x: 0, y: 0, z: 0 }, tenons: [],
    mortises: [{ origin: { x: 50, y: 9, z: 0 }, depth: 18, length: 8, width: 8, through: false, shape: "round", ...m }],
  } as Part);
  const rod = (dia: number, len = 30, x = 50 + len / 2 - 18): Part => ({
    id: "rod", nameZh: "木釘", material: "pine", grainDirection: "length",
    visible: { length: len, width: dia, thickness: dia }, origin: { x, y: 9 - dia / 2, z: 0 },
    shape: { kind: "round", axis: "x" }, visual: "dowel", tenons: [], mortises: [],
  } as Part);
  it("Ø8 插 Ø8 盲孔 18 深 → 放行", () => expect(findOverlaps([host({}), rod(8)])).toHaveLength(0));
  it("Ø9 插 Ø8 孔 → 報穿模（直徑差 1mm 不能放）", () => expect(findOverlaps([host({}), rod(9)]).length).toBe(1));
  it("8×20 長孔（shape round）：Ø8 過、Ø20 不過", () => {
    expect(findOverlaps([host({ length: 20, width: 8 }), rod(8)])).toHaveLength(0);
    expect(findOverlaps([host({ length: 20, width: 8 }), rod(20, 30, 50 + 15 - 18)]).length).toBe(1);
  });
  it("通孔：圓棒穿出另一面也放行", () => {
    const h = host({ through: true, depth: 100, origin: { x: 50, y: 9, z: 0 } });
    expect(findOverlaps([h, rod(8, 120, 0)])).toHaveLength(0);
  });
});
