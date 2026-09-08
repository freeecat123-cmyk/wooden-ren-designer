/**
 * 丙級第二題 cert-c2：官方數字要一 mm 不差、門要真的繞樞軸轉、木釘要是零件。
 */
import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { findOverlaps, worldAABB } from "@/lib/geometry/overlap";
import { planAssembly } from "@/lib/assembly/plan";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-c2")!;
const base = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue]));
const build = (o: Record<string, string | number | boolean> = {}) => entry.template!({ ...entry.defaults, material: "pine", options: { ...base, ...o } as Record<string, string | number | boolean> });
const noDoorPanel = (ov: ReturnType<typeof findOverlaps>) =>
  ov.filter((o) => !(/front-door-1-panel/.test(o.a + o.b) && /rail|stile/.test(o.a + o.b)));
const r1 = (n: number) => Math.round(n * 10) / 10;

describe("cert-c2 官方尺寸", () => {
  const d = build();
  const box = (id: string) => worldAABB(d.parts.find((p) => p.id === id)!);
  it("側板 120×350×18、背緣 300（quad 四角）", () => {
    const s = d.parts.find((p) => p.id === "side-left")!;
    expect(s.visible).toEqual({ length: 120, width: 350, thickness: 18 });
    expect((s.shape as any).corners).toEqual([[-60, -145], [60, -175], [20, 175], [-60, 155]]);   // 背緣 local −x（世界 +z）
  });
  it("頂板頂面深 91.6（頂面離背頂 20）、底板底面深 60.9（底面離背底 15）；兩片板都是頂面比底面長 2", () => {
    const t = box("top-board"), b = box("bottom-board");
    const bevel = 18 * Math.tan(Math.atan2(40, 350));   // 2.06
    expect(r1(t.max.z - t.min.z)).toBe(91.6); expect(t.max.y).toBe(300);
    expect(r1(b.max.z - b.min.z)).toBe(r1(60.9 + bevel)); expect(b.min.y).toBe(35);   // 料深 63.0，底面 60.9
    const tc = (d.parts.find((p) => p.id === "top-board")!.shape as any).corners;
    const bc = (d.parts.find((p) => p.id === "bottom-board")!.shape as any).corners;
    // corners 順序 (−y,−z)(+y,−z)(+y,+z)(−y,+z)：前端在 −z，+y（頂面）要比 −y（底面）多伸 bevel
    expect(tc[0][1] - tc[1][1]).toBeCloseTo(bevel, 2);
    expect(bc[0][1] - bc[1][1]).toBeCloseTo(bevel, 2);
  });
  it("門：長 315、框 40×18、鑲板 200×253×6（門每側留 1 縫）、門頂沿門方向離前上角 15", () => {
    const stile = d.parts.find((p) => p.id === "front-door-1-stile-left")!;
    expect(stile.visible).toEqual({ length: 315, width: 40, thickness: 18 });
    const panel = d.parts.find((p) => p.id === "front-door-1-panel")!;
    expect(panel.visible).toEqual({ length: 200, width: 253, thickness: 6 });
    // 門頂外角＝側板前上角沿門方向下 15 再退到門面：y = 350 − 15·cosθ + recess·cosθ·sinθ；AABB max y 是內側角（再高 18·sinθ）
    const th = Math.atan2(40, 350), recess = 22.686 - 18 / Math.cos(th);
    const outerTopY = 350 - 15 * Math.cos(th) + recess * Math.cos(th) * Math.sin(th);
    expect(r1(box("front-door-1-rail-top").max.y - 18 * Math.sin(th))).toBe(r1(outerTopY));
  });
  it("木釘 10 支（頂 4、底 4、樞軸 2），全部是 visual=dowel", () => {
    const dowels = d.parts.filter((p) => p.visual === "dowel");
    expect(dowels).toHaveLength(10);
    expect(dowels.filter((p) => /pivot/.test(p.id))).toHaveLength(2);
  });
  it("預設 0 穿模（門鑲板入框槽除外）、樞軸孔對得上木釘", () => {
    expect(noDoorPanel(findOverlaps(d.parts))).toHaveLength(0);
  });
  it("夾板兩片都切得出官方 300×260", () => {
    for (const id of ["back-panel", "front-door-1-panel"]) {
      const p = d.parts.find((x) => x.id === id)!;
      expect(Math.max(p.visible.length, p.visible.width)).toBeLessThanOrEqual(300);
      expect(Math.min(p.visible.length, p.visible.width)).toBeLessThanOrEqual(260);
    }
  });
});

describe("cert-c2 門的開啟", () => {
  it("開 90°：門底往前上方掀，樞軸木釘不動，零件尺寸不變", () => {
    const closed = build(), open = build({ doorOpen: 90 });
    const bc = worldAABB(closed.parts.find((p) => p.id === "front-door-1-rail-bottom")!);
    const bo = worldAABB(open.parts.find((p) => p.id === "front-door-1-rail-bottom")!);
    expect(bo.min.y).toBeGreaterThan(bc.max.y);   // 下橫檔跑到上面
    expect(bo.min.z).toBeLessThan(bc.min.z - 200); // 而且往前（−z）伸出去
    const pc = worldAABB(closed.parts.find((p) => p.id === "dowel-l-pivot")!);
    const po = worldAABB(open.parts.find((p) => p.id === "dowel-l-pivot")!);
    expect(po).toEqual(pc);
    expect(open.parts.map((p) => p.visible)).toEqual(closed.parts.map((p) => p.visible));
    expect(noDoorPanel(findOverlaps(open.parts))).toHaveLength(0);
  });
  it("超過 100° 出聲（頂板前上角會碰到上橫檔）", () => {
    expect(build({ doorOpen: 100 }).warnings?.some((w) => /超過 100°/.test(w)) ?? false).toBe(false);
    expect(build({ doorOpen: 110 }).warnings?.some((w) => /超過 100°/.test(w))).toBe(true);
  });
});

describe("cert-c2 組裝動畫", () => {
  it("門是一個家族整組滑入；樞軸木釘只沿 x 進出", () => {
    const plan = planAssembly(build());
    const pivots = plan.moves.filter((m) => m.partIds.some((id) => /pivot/.test(id)));
    expect(pivots.length).toBeGreaterThan(0);
    for (const m of pivots) { expect(m.from.y).toBe(0); expect(m.from.z).toBe(0); }
    const doorStep = plan.steps.find((s) => s.partIds.filter((id) => id.startsWith("front-door-1-")).length === 5);
    expect(doorStep).toBeTruthy();
  });
});

describe("cert-c2 主尺寸極值（審查員 2026-09-08 抓到的兩個盲區）", () => {
  it("高度 600：底板要跟著門面走，不穿模", () => {
    const d = entry.template!({ length: 300, width: 120, height: 600, material: "pine", options: base as Record<string, string | number | boolean> });
    expect(noDoorPanel(findOverlaps(d.parts))).toHaveLength(0);
    // 底面深＝前緣在底板底面高度的深度 − 門內縮 22.686 − 0.414 縫：80 + 40·35/600 − 23.1 = 59.23；料深再加斜切 18·(40/600)=1.2 → 60.43（手算）
    const b = worldAABB(d.parts.find((p) => p.id === "bottom-board")!);
    expect(r1(b.max.z - b.min.z)).toBe(60.4);
  });
  it("寬度拉到 20：夾到下限 154，沒有負尺寸零件、0 穿模", () => {
    const d = entry.template!({ length: 20, width: 120, height: 350, material: "pine", options: base as Record<string, string | number | boolean> });
    expect(d.overall.length).toBe(154);
    expect(d.parts.every((p) => p.visible.length > 0 && p.visible.width > 0 && p.visible.thickness > 0)).toBe(true);
    expect(noDoorPanel(findOverlaps(d.parts))).toHaveLength(0);
    expect(d.warnings?.some((w) => /尺寸太小/.test(w))).toBe(true);
  });
  it("極大 600×300×600：0 穿模", () => {
    const d = entry.template!({ length: 600, width: 300, height: 600, material: "pine", options: base as Record<string, string | number | boolean> });
    expect(noDoorPanel(findOverlaps(d.parts))).toHaveLength(0);
  });
});
