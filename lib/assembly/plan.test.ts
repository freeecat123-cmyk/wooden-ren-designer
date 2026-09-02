import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, type FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import {
  MOVE_MS,
  STAGGER_MS,
  STEP_GAP_MS,
  TAIL_MS,
  easeInOutCubic,
  offsetsAt,
  planAssembly,
  stepIndexAt,
  travelMm,
} from "./plan";
import { buildWorldMortiseIndex, matchMortiseForTenon, partWorldCenter, tenonWorld } from "./joint-world";

function buildDefault(entry: FurnitureCatalogEntry): FurnitureDesign {
  const opts = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec: OptionSpec) => { acc[spec.key] = spec.defaultValue; return acc; },
    {},
  );
  return entry.template!({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: opts,
  });
}

const stoolEntry = FURNITURE_CATALOG.find((e) => e.category === "stool")!;

describe("travelMm（位移量 = clamp(0.4 × 最大外形, 80, 450)）", () => {
  const mk = (l: number, w: number, t: number) =>
    ({ overall: { length: l, width: w, thickness: t } }) as FurnitureDesign;
  it("300mm 家具 → 120mm", () => expect(travelMm(mk(300, 200, 100))).toBe(120));
  it("太小夾到 80mm", () => expect(travelMm(mk(100, 50, 50))).toBe(80));
  it("太大夾到 450mm", () => expect(travelMm(mk(2000, 600, 1800))).toBe(450));
  it("取三軸最大值不是 length", () => expect(travelMm(mk(100, 100, 1000))).toBe(400));
});

describe("easeInOutCubic", () => {
  it("端點 0 / 1、中點 0.5", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9);
  });
  it("p=0.7 → 1 − (0.6³)/2 = 0.892（手算）", () => {
    expect(easeInOutCubic(0.7)).toBeCloseTo(0.892, 9);
  });
});

describe("方凳（stool）的組裝順序", () => {
  const design = buildDefault(stoolEntry);
  const plan = planAssembly(design);
  const center = (id: string) => partWorldCenter(design.parts.find((p) => p.id === id)!);

  it("三步：四支腳 → 牙條 + 下橫撐 → 座板", () => {
    expect(plan.steps).toHaveLength(3);
    expect([...plan.steps[0].partIds].sort()).toEqual(["leg-1", "leg-2", "leg-3", "leg-4"]);
    expect([...plan.steps[1].partIds].sort()).toEqual(
      ["apron-back", "apron-front", "apron-left", "apron-right", "ls-back", "ls-front", "ls-left", "ls-right"],
    );
    expect(plan.steps[2].partIds).toEqual(["seat"]);
  });

  it("腳從自己那一側的外面水平合攏（from 的 x/z 跟腳的位置同號、y = 0）", () => {
    for (const id of ["leg-1", "leg-2", "leg-3", "leg-4"]) {
      const m = plan.moves[id];
      const c = center(id);
      expect(m.kind).toBe("radial");
      expect(Math.sign(m.from.x)).toBe(Math.sign(c.x));
      expect(Math.sign(m.from.z)).toBe(Math.sign(c.z));
      expect(m.from.y).toBe(0);
    }
  });

  it("牙條兩端榫頭方向打架 → 垂直於榫軸、從自己那側水平滑進，位移 = travelMm", () => {
    const travel = travelMm(design);
    const front = plan.moves["apron-front"];
    expect(front.kind).toBe("radial");
    expect(front.from.x).toBeCloseTo(0, 6);
    expect(front.from.y).toBe(0);
    // 前面是 −z（code 軸慣例 y 上 z 後）
    expect(front.from.z).toBeCloseTo(-travel, 6);
    const left = plan.moves["apron-left"];
    expect(left.from.x).toBeCloseTo(-travel, 6);
    expect(left.from.y).toBe(0);
    expect(left.from.z).toBeCloseTo(0, 6);
  });

  it("座板是母件（腳頂榫頭插進來）→ 沿榫軸反向從上方套下", () => {
    const seat = plan.moves["seat"];
    expect(seat.kind).toBe("tenon");
    expect(seat.from.x).toBeCloseTo(0, 6);
    expect(seat.from.z).toBeCloseTo(0, 6);
    expect(seat.from.y).toBeCloseTo(travelMm(design), 6);
  });

  it("時間軸手算：4 件 → 0..1260；停 250；8 件 → 1510..3250；停 250；1 件 → 3500..4400；尾 500 → 4900", () => {
    expect(MOVE_MS).toBe(900); expect(STAGGER_MS).toBe(120); expect(STEP_GAP_MS).toBe(250); expect(TAIL_MS).toBe(500);
    expect(plan.steps[0].startMs).toBe(0);
    expect(plan.steps[0].endMs).toBe(1260);
    expect(plan.steps[1].startMs).toBe(1510);
    expect(plan.steps[1].endMs).toBe(3250);
    expect(plan.steps[2].startMs).toBe(3500);
    expect(plan.steps[2].endMs).toBe(4400);
    expect(plan.totalMs).toBe(4900);
    // 步內第 i 件晚 i × 120ms 起跑
    const ids = plan.steps[1].partIds;
    expect(plan.moves[ids[3]].startMs).toBe(1510 + 3 * 120);
    expect(plan.moves[ids[3]].endMs).toBe(1510 + 3 * 120 + 900);
  });

  it("offsetsAt：t=0 全部在起點、t=結束全部到位、中途按 ease 收斂", () => {
    const at0 = offsetsAt(plan, 0);
    expect(at0.size).toBe(13);
    expect(at0.get("leg-1")).toEqual(plan.moves["leg-1"].from);
    expect(offsetsAt(plan, plan.totalMs).size).toBe(0);
    // leg-1 起跑 0ms，t=630 → p=0.7 → 剩 1 − 0.892 = 0.108
    const mid = offsetsAt(plan, 630).get("leg-1")!;
    expect(mid.x / plan.moves["leg-1"].from.x).toBeCloseTo(0.108, 9);
    expect(mid.z / plan.moves["leg-1"].from.z).toBeCloseTo(0.108, 9);
    // 座板還沒起跑（3500 才開始）→ 仍在起點
    expect(offsetsAt(plan, 3000).get("seat")).toEqual(plan.moves["seat"].from);
  });

  it("stepIndexAt", () => {
    expect(stepIndexAt(plan, 0)).toBe(0);
    expect(stepIndexAt(plan, 2000)).toBe(1);
    expect(stepIndexAt(plan, 4000)).toBe(2);
    expect(stepIndexAt(plan, 99999)).toBe(2);
  });

  it("joint-world：前牙條兩端榫頭各配到一支腳、榫頭朝 ±x", () => {
    const index = buildWorldMortiseIndex(design.parts);
    const apron = design.parts.find((p) => p.id === "apron-front")!;
    expect(apron.tenons.length).toBeGreaterThanOrEqual(2);
    const mothers = new Set<string>();
    for (const t of apron.tenons) {
      const tw = tenonWorld(apron, t);
      expect(Math.abs(tw.outUnit.x)).toBeCloseTo(1, 6);
      const mw = matchMortiseForTenon(apron, t, tw, index);
      expect(mw).not.toBeNull();
      expect(mw!.partId.startsWith("leg-")).toBe(true);
      mothers.add(mw!.partId);
    }
    expect(mothers.size).toBe(2);
  });
});

describe("餐椅：椅背立柱跟腳同一步、先於靠背橫料", () => {
  const entry = FURNITURE_CATALOG.find((e) => e.category === "dining-chair")!;
  const plan = planAssembly(buildDefault(entry));
  it("back-post 在第 0 步", () => {
    const posts = Object.values(plan.moves).filter((m) => m.partId.startsWith("back-post"));
    expect(posts.length).toBeGreaterThan(0);
    for (const m of posts) expect(m.stepIndex).toBe(0);
  });
  it("back-top-rail 在 back-post 之後", () => {
    const rail = plan.moves["back-top-rail"];
    expect(rail).toBeDefined();
    expect(rail.stepIndex).toBeGreaterThan(0);
  });
});

describe("全目錄預設值掃描（每一款都要排得出來）", () => {
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    it(`${entry.category}`, () => {
      const design = buildDefault(entry);
      const plan = planAssembly(design);
      // 每個零件恰好一筆 move
      const ids = design.parts.map((p) => p.id);
      expect(Object.keys(plan.moves).sort()).toEqual([...ids].sort());
      // 步驟不空、不重疊、單調遞增
      expect(plan.steps.length).toBeGreaterThan(0);
      let prevEnd = -Infinity;
      for (const s of plan.steps) {
        expect(s.partIds.length).toBeGreaterThan(0);
        expect(s.startMs).toBeGreaterThanOrEqual(prevEnd);
        expect(s.endMs).toBeGreaterThan(s.startMs);
        prevEnd = s.endMs;
        for (const id of s.partIds) expect(plan.moves[id].stepIndex).toBe(s.index);
      }
      // 位移有限、長度 = travelMm（方向是單位向量）
      const travel = travelMm(design);
      for (const m of Object.values(plan.moves)) {
        expect(Number.isFinite(m.from.x + m.from.y + m.from.z)).toBe(true);
        expect(Math.hypot(m.from.x, m.from.y, m.from.z)).toBeCloseTo(travel, 6);
      }
      // 動畫總長合理（最長的五斗櫃 56 件也要在 20 秒內）
      expect(plan.totalMs).toBeLessThanOrEqual(20000);
      expect(offsetsAt(plan, 0).size).toBe(ids.length);
      expect(offsetsAt(plan, plan.totalMs).size).toBe(0);
    });
  }
});
