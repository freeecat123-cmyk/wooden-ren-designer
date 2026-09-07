/**
 * 圓木釘插在圓孔裡不是穿模：對手是圓料時，這件上的圓孔（不限 cosmetic）也算 cut coverage。
 * 2026-09-07 丙級第一題把木釘做成零件後，穿模稽核先報了 16 組（8 支 × 橫檔/側板）。
 */
import { describe, it, expect } from "vitest";
import { findOverlaps } from "@/lib/geometry/overlap";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { FURNITURE_CATALOG } from "@/lib/templates";

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
