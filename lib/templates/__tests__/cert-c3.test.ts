/**
 * 丙級第三題 cert-c3：官方數字逐項、側板五角、連接木釘露在縫裡、12 支木釘、0 穿模。
 */
import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { findOverlaps, worldAABB } from "@/lib/geometry/overlap";
import { projectPartPolygon } from "@/lib/render/geometry";
import { planAssembly } from "@/lib/assembly/plan";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-c3")!;
const base = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue])) as Record<string, string | number | boolean>;
const build = (o: Record<string, string | number | boolean> = {}, size = entry.defaults) =>
  entry.template!({ length: size.length, width: size.width, height: size.height, material: "pine", options: { ...base, ...o } });
const r1 = (n: number) => Math.round(n * 10) / 10;

describe("cert-c3 官方尺寸", () => {
  const d = build();
  const box = (id: string) => worldAABB(d.parts.find((p) => p.id === id)!);
  it("寬 300、深 240（後片 115＋縫 10＋前片 115）、高後 230／前 105", () => {
    expect(d.overall).toEqual({ length: 300, width: 240, thickness: 230 });
    const bl = box("side-back-left"), fl = box("side-front-left");
    expect([bl.min.z, bl.max.z]).toEqual([5, 120]);      // 背在 +z（app 慣例）
    expect([fl.min.z, fl.max.z]).toEqual([-120, -5]);
    expect(bl.max.y).toBe(230);
    // 前片前端高 105：側視 x＝−世界 z，前緣 z=−120 → x=120
    const poly = projectPartPolygon(d.parts.find((p) => p.id === "side-front-left")!, "side").map((p) => [r1(p.x), r1(p.y)]);
    expect(poly.some(([x, y]) => x === 120 && y === 105)).toBe(true);
  });
  it("後片側視是五角形：頂端平 18（z −120→−102 都是 230）再直線斜到縫", () => {
    const poly = projectPartPolygon(d.parts.find((p) => p.id === "side-back-left")!, "side").map((p) => `${r1(p.x)},${r1(p.y)}`);
    expect(poly).toHaveLength(5);
    expect(poly).toContain("-120,230");
    expect(poly).toContain("-102,230");
    // 斜線：230 → 105 跨 222mm，在 z=+5（側視 x=−5）處＝230 − 125·97/222 = 175.4（手算）
    expect(poly).toContain("-5,175.4");
  });
  it("後橫板 18×50 貼背緣、頂端離頂 25、底距底板頂 117；底板離地 20、厚 18、深 105／95", () => {
    const r = box("rail-back"), bb = box("board-back"), bf = box("board-front");
    expect([r.min.y, r.max.y, r.min.z, r.max.z]).toEqual([155, 205, 102, 120]);
    expect([bb.min.y, bb.max.y, r1(bb.max.z - bb.min.z)]).toEqual([20, 38, 105]);
    expect([bf.min.y, bf.max.y, r1(bf.max.z - bf.min.z)]).toEqual([20, 38, 95]);
    expect(r.min.y - bb.max.y).toBe(117);
  });
  it("後底板雙貫穿榫 12 寬、離背 15–27 與 83–95、齊平（總寬 300）", () => {
    const b = d.parts.find((p) => p.id === "board-back")!;
    expect(b.tenons.map((t) => [t.type, t.width, t.length])).toEqual(Array(4).fill(["through-tenon", 12, 18]));
    const centers = b.tenons.filter((t) => t.position === "start").map((t) => r1(120 - (t.offsetWidth! + b.origin.z)));   // 離背
    expect(centers.sort((a, c) => a - c)).toEqual([21, 89]);
  });
  it("12 支木釘：後橫板 4、前底板 4、連接 4；連接木釘沿 z 跨縫、縫裡露 10", () => {
    const dowels = d.parts.filter((p) => p.visual === "dowel");
    expect(dowels).toHaveLength(12);
    // 前底板離縫 10：後緣 z=−15、前端 z=−110（離前緣 10）
    const bf = box("board-front"); expect([bf.max.z, bf.min.z]).toEqual([-15, -110]);
    const link = box("dowel-l-link-1");
    expect([link.min.z, link.max.z]).toEqual([-15, 15]);
    expect([link.min.y, link.max.y]).toEqual([25, 33]);   // 離地 29
    expect(box("dowel-l-link-2").min.y).toBe(125);        // 離地 129
  });
  it("夾板背板 288×141×6（入側板 rebate 12 寬、上進橫板 12、下進底板 12）與背緣齊平；橫板、底板各有 6×12 缺口；預設 0 穿模", () => {
    const p = d.parts.find((x) => x.id === "back-panel")!;
    expect(p.visible).toEqual({ length: 288, width: 141, thickness: 6 });
    expect(box("back-panel").min.y).toBe(26); expect(box("back-panel").max.y).toBe(167);
    expect(d.parts.find((x) => x.id === "rail-back")!.mortises.filter((m) => m.cosmetic)).toHaveLength(1);
    expect(d.parts.find((x) => x.id === "board-back")!.mortises.filter((m) => m.cosmetic)).toHaveLength(1);
    expect(box("back-panel").max.z).toBe(120);
    expect(findOverlaps(d.parts)).toHaveLength(0);
  });
  it("組裝：連接木釘沿 z、其餘木釘沿 x", () => {
    const plan = planAssembly(d);
    for (const m of plan.moves) {
      if (!m.partIds.every((id) => id.startsWith("dowel-"))) continue;   // 跟整側一起滑入的那步不算
      const ids = m.partIds;
      if (ids.every((id) => /link/.test(id))) { expect(m.from.x).toBe(0); expect(m.from.y).toBe(0); }
      else if (ids.every((id) => !/link/.test(id))) { expect(m.from.y).toBe(0); expect(m.from.z).toBe(0); }
    }
  });
});

describe("cert-c3 選項與極值", () => {
  it("縫改 4：連接木釘各入 13；縫改 20：各入 5 並出聲", () => {
    const a = build({ sideGap: 4 });
    expect(a.parts.find((p) => p.id === "side-back-left")!.mortises.find((m) => /連接/.test(m.label ?? ""))!.depth).toBe(13);
    const b = build({ sideGap: 20 });
    expect(b.warnings?.some((w) => /只剩 5.0mm/.test(w))).toBe(true);
    expect(build({ sideGap: 14 }).warnings?.some((w) => /只剩/.test(w))).toBe(false);   // 入 8＝一個直徑，剛好不出聲
    expect(findOverlaps(a.parts)).toHaveLength(0);
    expect(findOverlaps(b.parts)).toHaveLength(0);
  });
  it("無背板：側板溝與底板缺口一起拿掉", () => {
    const d = build({ withBack: false });
    expect(d.parts.some((p) => p.id === "back-panel")).toBe(false);
    expect(d.parts.find((p) => p.id === "side-back-left")!.mortises.some((m) => m.cosmetic)).toBe(false);
    expect(d.parts.find((p) => p.id === "board-back")!.mortises).toHaveLength(0);
    expect(d.parts.find((p) => p.id === "rail-back")!.mortises.some((m) => m.cosmetic)).toBe(false);
  });
  it("極大 600×400×500、極小 10×10×10（夾到 96×230×230）：無負尺寸、0 穿模、每支木釘都被兩件母件包住", () => {
    for (const size of [{ length: 600, width: 400, height: 500 }, { length: 10, width: 10, height: 10 }, { length: 300, width: 240, height: 180 }]) {
      const d = build({}, size);
      expect(d.parts.every((p) => p.visible.length > 0 && p.visible.width > 0 && p.visible.thickness > 0)).toBe(true);
      expect(findOverlaps(d.parts)).toHaveLength(0);
      const hosts = d.parts.filter((p) => p.visual !== "dowel").map((p) => worldAABB(p));
      for (const dw of d.parts.filter((p) => p.visual === "dowel")) {
        const b = worldAABB(dw);
        const ends = [{ ...b, ...(dw.shape as any).axis === "z" ? { min: { ...b.min, z: b.min.z }, max: { ...b.max, z: b.min.z + 1 } } : { min: { ...b.min, x: b.min.x }, max: { ...b.max, x: b.min.x + 1 } } },
                      { ...b, ...(dw.shape as any).axis === "z" ? { min: { ...b.min, z: b.max.z - 1 } } : { min: { ...b.min, x: b.max.x - 1 } } }];
        for (const e of ends) {
          const inside = hosts.some((h) => e.min.x >= h.min.x - 0.01 && e.max.x <= h.max.x + 0.01 && e.min.y >= h.min.y - 0.01 && e.max.y <= h.max.y + 0.01 && e.min.z >= h.min.z - 0.01 && e.max.z <= h.max.z + 0.01);
          expect(inside, `${dw.id} @ ${JSON.stringify(size)}`).toBe(true);
        }
      }
    }
    expect(build({}, { length: 300, width: 240, height: 180 }).overall.thickness).toBe(230);
  });
});
