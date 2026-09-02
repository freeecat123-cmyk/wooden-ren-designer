import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, type FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import {
  MOVE_MS,
  STAGGER_MS,
  STEP_GAP_MS,
  TAIL_MS,
  SCREW_MS,
  debugJoints,
  easeInOutCubic,
  familyKey,
  offsetsAt,
  planAssembly,
  stepIndexAt,
  sweepHits,
  travelMm,
  type AssemblyPlan,
} from "./plan";
import { buildWorldMortiseIndex, matchMortiseForTenon, tenonWorld } from "./joint-world";

function buildDefault(entry: FurnitureCatalogEntry, over: Record<string, string | number | boolean> = {}): FurnitureDesign {
  const opts = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec: OptionSpec) => { acc[spec.key] = spec.defaultValue; return acc; },
    {},
  );
  Object.assign(opts, over);
  return entry.template!({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: opts,
  });
}
const entry = (c: string) => FURNITURE_CATALOG.find((e) => e.category === c)!;
/** 某零件「自己那一筆」非螺絲 move（子組件整組滑入的那筆另外算） */
const ownMove = (plan: AssemblyPlan, id: string) =>
  plan.moves.filter((m) => m.kind !== "screw" && m.partIds.includes(id));
const stepOf = (plan: AssemblyPlan, id: string) => Math.min(...ownMove(plan, id).map((m) => m.stepIndex));

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

describe("familyKey：抽屜 / 門 / 掀蓋一個單位", () => {
  it("抽屜五塊板同家族；把手不算（最後才裝）", () => {
    expect(familyKey("z1-drawer-2-side-left")).toBe("z1-drawer-2");
    expect(familyKey("z1-drawer-2-face-pull")).toBe("");
    expect(familyKey("z1-drawer-1-face")).toBe("z1-drawer-1");
  });
  it("掀蓋式木盒的 lid + wall-*-lid + lid-hinge", () => {
    expect(familyKey("lid")).toBe("lid-group");
    expect(familyKey("wall-front-lid")).toBe("lid-group");
    expect(familyKey("lid-hinge-1")).toBe("lid-group");
  });
  it("腳 / 牙條沒有家族", () => {
    expect(familyKey("leg-1")).toBe("");
    expect(familyKey("apron-front")).toBe("");
  });
});

describe("方凳：木工的組法（一面框 → 前後牙條 → 另一面框整組滑上 → 座板）", () => {
  const design = buildDefault(entry("stool"));
  const plan = planAssembly(design);
  const travel = travelMm(design);

  it("9 步、順序正確", () => {
    expect(plan.steps).toHaveLength(9);
    const seq = plan.steps.map((s) => [...s.partIds].sort().join(","));
    expect(seq).toEqual([
      "leg-1",
      "apron-left,ls-left",
      "leg-3",
      "apron-back,apron-front,ls-back,ls-front",
      "leg-2",
      "apron-right,ls-right",
      "leg-4",
      "apron-right,leg-2,leg-4,ls-right",
      "seat",
    ]);
  });

  it("牙條只沿榫的軸向插入（左牙條沿 z 滑進 leg-1、前後牙條沿 x），位移 = travelMm", () => {
    const left = ownMove(plan, "apron-left")[0];
    expect(left.kind).toBe("join");
    expect(left.from.x).toBeCloseTo(0, 6);
    expect(left.from.y).toBeCloseTo(0, 6);
    expect(Math.abs(left.from.z)).toBeCloseTo(travel, 6);
    const front = ownMove(plan, "apron-front")[0];
    expect(front.from.y).toBeCloseTo(0, 6);
    expect(front.from.z).toBeCloseTo(0, 6);
    expect(Math.abs(front.from.x)).toBeCloseTo(travel, 6);
  });

  it("右框整組（2 腳 + 2 牙條）沿 x 一起滑入，框裡的牙條先在爆炸位置沿 z 插好", () => {
    const frame = plan.moves.find((m) => m.kind === "join" && m.partIds.length === 4)!;
    expect([...frame.partIds].sort()).toEqual(["apron-right", "leg-2", "leg-4", "ls-right"]);
    expect(Math.abs(frame.from.x)).toBeCloseTo(travel, 6);
    // 右牙條有兩筆 move：自己插進 leg-2（z 向）＋ 跟著框滑入（x 向）
    const mine = ownMove(plan, "apron-right");
    expect(mine).toHaveLength(2);
    const own = mine.find((m) => m.partIds.length === 1)!;
    expect(Math.abs(own.from.z)).toBeCloseTo(travel, 6);
    expect(own.endMs).toBeLessThanOrEqual(frame.startMs);
    // 框滑入前，右牙條的總位移 = 框的位移（自己那筆已到位）
    const t = frame.startMs;
    const off = offsetsAt(plan, t).get("apron-right")!;
    expect(off.x).toBeCloseTo(frame.from.x, 6);
    expect(off.z).toBeCloseTo(0, 6);
  });

  it("座板最後從上方壓下（腳頂榫頭是 y 向）", () => {
    const seat = ownMove(plan, "seat")[0];
    expect(seat.stepIndex).toBe(8);
    expect(seat.from.y).toBeCloseTo(travel, 6);
    expect(seat.from.x).toBeCloseTo(0, 6);
    expect(seat.from.z).toBeCloseTo(0, 6);
  });

  it("時間軸手算（外層 800/100/200；子組件內 480/120）", () => {
    expect(MOVE_MS).toBe(800); expect(STAGGER_MS).toBe(100); expect(STEP_GAP_MS).toBe(200); expect(TAIL_MS).toBe(500);
    // 0 leg-1 0..800 | 1 左牙條×2 1000..1900 | 2 leg-3 2100..2900 | 3 前後×4 3100..4200
    // 右框內部（depth 1，480ms/120ms 間隔）：4 leg-2 4400..4880 | 5 右牙條×2 5000..5580 | 6 leg-4 5700..6180
    // 7 右框 6300..7100 | 8 座板 7300..8100 | 尾 500 → 8600
    const se = plan.steps.map((s) => [s.startMs, s.endMs]);
    expect(se).toEqual([
      [0, 800], [1000, 1900], [2100, 2900], [3100, 4200],
      [4400, 4880], [5000, 5580], [5700, 6180],
      [6300, 7100], [7300, 8100],
    ]);
    expect(plan.totalMs).toBe(8600);
  });

  it("offsetsAt：t=0 全部在起點、結束全到位、中途按 ease 收斂；stepIndexAt", () => {
    expect(offsetsAt(plan, 0).size).toBe(13);
    expect(offsetsAt(plan, plan.totalMs).size).toBe(0);
    const leg1 = ownMove(plan, "leg-1")[0];
    const mid = offsetsAt(plan, 560).get("leg-1")!;   // p=0.7 → 剩 0.108
    expect(mid.z / leg1.from.z).toBeCloseTo(0.108, 9);
    expect(stepIndexAt(plan, 0)).toBe(0);
    expect(stepIndexAt(plan, 3500)).toBe(3);
    expect(stepIndexAt(plan, 99999)).toBe(8);
  });

  it("組裝版：每個榫接合上後鎖螺絲，螺絲在合上之後才出現；榫接版沒有螺絲", () => {
    expect(plan.screws).toHaveLength(0);
    const withScrews = planAssembly(design, { screws: true });
    expect(withScrews.screws.length).toBeGreaterThan(0);
    const screwMoves = withScrews.moves.filter((m) => m.kind === "screw");
    expect(screwMoves).toHaveLength(withScrews.screws.length);
    for (const sm of screwMoves) {
      const step = withScrews.steps[sm.stepIndex];
      const joinEnd = Math.max(...withScrews.moves.filter((m) => m.stepIndex === sm.stepIndex && m.kind !== "screw").map((m) => m.endMs));
      expect(sm.startMs).toBeGreaterThanOrEqual(joinEnd);
      expect(sm.endMs - sm.startMs).toBe(SCREW_MS);
      expect(step.endMs).toBeGreaterThanOrEqual(sm.endMs);
    }
    // 螺絲頭在母件外面：頭到榫頭根面的距離 = 母件沿軸厚度（腳 35mm 見方 → 35）
    const sc = withScrews.screws.find((x) => x.id.startsWith("screw:apron-left>"))!;
    expect(sc.lengthMm).toBeGreaterThan(30);
    expect(sc.appearMs).toBe(withScrews.moves.find((m) => m.partIds[0] === sc.id)!.startMs);
  });

  it("joint-world：前牙條兩端榫頭各配到一支腳", () => {
    const index = buildWorldMortiseIndex(design.parts);
    const apron = design.parts.find((p) => p.id === "apron-front")!;
    const mothers = new Set<string>();
    for (const t of apron.tenons) {
      const tw = tenonWorld(apron, t);
      const mw = matchMortiseForTenon(apron, t, tw, index);
      expect(mw).not.toBeNull();
      mothers.add(mw!.partId);
    }
    expect(mothers.size).toBe(2);
  });
});

describe("餐桌：側牙條的榫眼在腳頂下 31mm，以前被判成頂面榫眼配不到（2026-09-02 修）", () => {
  const design = buildDefault(entry("dining-table"));
  it("所有榫頭都配得到母件", () => {
    const js = debugJoints(design);
    expect(js.filter((j) => j.kind === "tenon-UNMATCHED")).toEqual([]);
  });
  it("順序：一面側框 → 前後牙條 → 另一側框整組 → 桌面", () => {
    const plan = planAssembly(design);
    const seq = plan.steps.map((s) => [...s.partIds].sort().join(","));
    expect(seq[0]).toBe("leg-1");
    expect(seq[1]).toBe("apron-left");
    expect(seq[2]).toBe("leg-3");
    expect(seq[3]).toBe("apron-back,apron-front");
    expect(seq[seq.length - 2]).toBe("apron-right,leg-2,leg-4");
    expect(seq[seq.length - 1]).toBe("top");
  });
});

describe("鳩尾木盒：公榫板只能從母板端面套上；滑蓋從缺口那側滑入；底板是底座", () => {
  const design = buildDefault(entry("dovetail-box"));
  const plan = planAssembly(design, { screws: true });
  const travel = travelMm(design);
  it("鳩尾接合推得出來（前後壁是公榫板，插入方向 = 板面法線）", () => {
    const js = debugJoints(design).filter((j) => j.kind === "dovetail");
    expect(js.map((j) => `${j.child}>${j.mother}`).sort()).toEqual(
      ["wall-back>wall-left", "wall-back>wall-right", "wall-front>wall-left", "wall-front>wall-right"],
    );
    for (const j of js) {
      expect(j.axes).toHaveLength(1);
      expect(Math.abs(j.axes[0].z)).toBeCloseTo(1, 6);
    }
  });
  it("前壁沿 z（板面法線）從正面套上，不是沿板長方向", () => {
    const front = ownMove(plan, "wall-front")[0];
    expect(front.from.x).toBeCloseTo(0, 6);
    expect(front.from.z).toBeCloseTo(-travel, 6);
  });
  it("滑蓋水平滑入（從左邊缺口，−x），不是從上面放", () => {
    const lid = ownMove(plan, "lid")[0];
    expect(lid.from.y).toBeCloseTo(0, 6);
    expect(lid.from.x).toBeCloseTo(-travel, 6);
    expect(stepOf(plan, "lid")).toBe(plan.steps.length - 1);
  });
  it("底板第一步（壁立其上）；鳩尾 / 滑蓋不鎖螺絲", () => {
    expect(plan.steps[0].partIds).toEqual(["bottom"]);
    expect(plan.screws).toHaveLength(0);
  });
});

describe("五斗櫃：抽屜在外面組好整組從正面滑入；層板不從背板穿過來", () => {
  const design = buildDefault(entry("chest-of-drawers"));
  const plan = planAssembly(design);
  it("每個抽屜家族有一筆整組滑入的 move，方向 −z（正面），且在自己零件之後", () => {
    const fams = new Set(design.parts.map((p) => familyKey(p.id)).filter((f) => f.startsWith("z")));
    expect(fams.size).toBeGreaterThan(0);
    for (const f of fams) {
      const ids = design.parts.filter((p) => familyKey(p.id) === f).map((p) => p.id).sort();
      const unit = plan.moves.find((m) => m.kind === "join" && [...m.partIds].sort().join() === ids.join());
      expect(unit, f).toBeDefined();
      expect(unit!.from.z, f).toBeLessThan(0);
      expect(Math.abs(unit!.from.z), f).toBeCloseTo(travelMm(design), 6);
      for (const id of ids) {
        const own = plan.moves.filter((m) => m.kind !== "screw" && m.partIds.includes(id) && m !== unit);
        for (const m of own) expect(m.endMs, id).toBeLessThanOrEqual(unit!.startMs);
      }
    }
  });
  it("把手在所有抽屜都進櫃體之後才裝、從正面裝上", () => {
    const pulls = design.parts.filter((p) => /-pull$/.test(p.id)).map((p) => p.id);
    expect(pulls.length).toBeGreaterThan(0);
    const lastNonPull = Math.max(...design.parts.filter((p) => !/-pull$/.test(p.id)).map((p) => stepOf(plan, p.id)));
    for (const id of pulls) {
      expect(stepOf(plan, id), id).toBeGreaterThan(lastNonPull);
      expect(ownMove(plan, id)[0].from.z, id).toBeLessThan(0);
    }
  });

  it("層板 / 隔板不會從 +z（背板那側）進來", () => {
    for (const p of design.parts) {
      if (!/divider|boundary|shelf/.test(p.id)) continue;
      for (const m of ownMove(plan, p.id)) expect(m.from.z, p.id).toBeLessThanOrEqual(1e-6);
    }
  });
});

describe("sweepHits：AABB 掃掠（手算）", () => {
  const box = (x0: number, x1: number, y0 = 0, y1 = 10, z0 = 0, z1 = 10) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });
  const g = box(0, 10);
  it("往 +x 掃 20 → 掃過的區間 [0,30]，撞到 [15,25] 的板", () => {
    expect(sweepHits(g, { x: 1, y: 0, z: 0 }, 20, [box(15, 25)])).toBe(true);
  });
  it("往 −x 掃 → 掃過 [−20,10]，碰不到 [15,25]", () => {
    expect(sweepHits(g, { x: -1, y: 0, z: 0 }, 20, [box(15, 25)])).toBe(false);
  });
  it("貼面（[10,20] 剛好貼著）不算撞；縮 0.5mm 容差", () => {
    expect(sweepHits(g, { x: 0, y: 1, z: 0 }, 20, [box(10, 20)])).toBe(false);
  });
  it("靜止時就交疊的（滑蓋卡在槽裡的壁）不算撞", () => {
    expect(sweepHits(g, { x: 1, y: 0, z: 0 }, 20, [box(8, 30)])).toBe(false);
  });
});

describe("錨件規則：id 最小的腳永遠當底座（把 leg-1 / leg-2 對調後第一步還是 leg-1）", () => {
  it("stool", () => {
    const design = buildDefault(entry("stool"));
    const swapped: FurnitureDesign = {
      ...design,
      parts: design.parts.map((p) => (p.id === "leg-1" ? { ...p, id: "leg-2" } : p.id === "leg-2" ? { ...p, id: "leg-1" } : p)),
    };
    const plan = planAssembly(swapped);
    expect(plan.steps[0].partIds).toEqual(["leg-1"]);
  });
});

describe("全目錄預設值掃描（每一款都要排得出來）", () => {
  for (const e of FURNITURE_CATALOG) {
    if (!e.template) continue;
    it(`${e.category}`, () => {
      const design = buildDefault(e);
      const plan = planAssembly(design, { screws: true });
      const ids = design.parts.map((p) => p.id);
      // 每個零件至少一筆 move、且都被某一步涵蓋；螺絲只在 moves 裡
      for (const id of ids) expect(plan.partMoves[id]?.length ?? 0, id).toBeGreaterThan(0);
      const stepped = new Set(plan.steps.flatMap((s) => s.partIds));
      expect([...stepped].sort()).toEqual([...ids].sort());
      // 步驟不空、不重疊、單調遞增
      let prevEnd = -Infinity;
      for (const s of plan.steps) {
        expect(s.partIds.length).toBeGreaterThan(0);
        expect(s.startMs).toBeGreaterThanOrEqual(prevEnd);
        expect(s.endMs).toBeGreaterThan(s.startMs);
        prevEnd = s.endMs;
      }
      // 位移有限、每筆非螺絲 move 長度 = travelMm；螺絲 40mm
      const travel = travelMm(design);
      for (const m of plan.moves) {
        expect(Number.isFinite(m.from.x + m.from.y + m.from.z)).toBe(true);
        expect(Math.hypot(m.from.x, m.from.y, m.from.z)).toBeCloseTo(m.kind === "screw" ? 40 : travel, 6);
      }
      // 沒有互鎖硬拆
      expect(plan.moves.filter((m) => m.kind === "forced")).toEqual([]);
      expect(plan.totalMs).toBeLessThanOrEqual(60000);
      expect(offsetsAt(plan, 0).size).toBe(ids.length + plan.screws.length);
      expect(offsetsAt(plan, plan.totalMs).size).toBe(0);
    });
  }
});
