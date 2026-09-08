/**
 * 自由四邊形輪廓（shape.kind="quad"）：3D 幾何、三視圖投影、輪廓取樣三條路要吃同一個算式。
 *
 * 🩸2026-09-07 技能檢定家具木工丙級 01200-100301 側板：背緣垂直 350、上緣往前降 30、
 * 底緣往前升 15、深 120→95。梯形做不出來（四邊各不同），而斜切正是考點，不能將就。
 */
import { describe, it, expect } from "vitest";
import { quadPoint, sidePanelQuad } from "@/lib/render/quad-profile";
import { buildQuadGeometry } from "@/lib/render/part-geometry";
import { certC1, certC1Options } from "@/lib/templates/cert-c1";
import type { MaterialId } from "@/lib/types";

const EXAM = sidePanelQuad({ lx: 120, lz: 350, bottomDepth: 95, topDropFront: 30, bottomRiseFront: 15 });

describe("sidePanelQuad：檢定側板四角（手算對照，不是抄程式輸出）", () => {
  it("背上 (−60,−175)、前上 (60,−145)、前下 (35,160)、背下 (−60,175)", () => {
    expect(EXAM[0]).toEqual([-60, -175]);   // 背緣頂：深度 −60、高度頂 −175
    expect(EXAM[1]).toEqual([60, -145]);    // 前緣頂：上緣往前降 30 → −175+30
    expect(EXAM[2]).toEqual([35, 160]);     // 前緣底：95−60＝35、底緣往前升 15 → 175−15
    expect(EXAM[3]).toEqual([-60, 175]);    // 背緣底
  });
  it("背緣兩點 x 相同＝整條垂直（這是考題最重要的一條邊）", () => {
    expect(EXAM[0][0]).toBe(EXAM[3][0]);
  });
  it("上緣深 120、底緣深 95、全高 350（前後緣高差＝30+15）", () => {
    expect(EXAM[1][0] - EXAM[0][0]).toBe(120);
    expect(EXAM[2][0] - EXAM[3][0]).toBe(95);
    expect(EXAM[3][1] - EXAM[0][1]).toBe(350);
    expect(EXAM[2][1] - EXAM[1][1]).toBe(350 - 30 - 15);
  });
  it("不給斜度＝一般直角梯形；再不收窄＝矩形", () => {
    const trap = sidePanelQuad({ lx: 120, lz: 350, bottomDepth: 95 });
    expect(trap[1]).toEqual([60, -175]);
    expect(trap[2]).toEqual([35, 175]);
    const rect = sidePanelQuad({ lx: 120, lz: 350, bottomDepth: 120 });
    expect(rect).toEqual([[-60, -175], [60, -175], [60, 175], [-60, 175]]);
  });
});

describe("quadPoint：角點精確回傳，中間雙線性", () => {
  it("四個角 (±1,±1) 剛好對到四個 corner", () => {
    expect(quadPoint(EXAM, -1, -1)).toEqual([-60, -175]);
    expect(quadPoint(EXAM, 1, -1)).toEqual([60, -145]);
    expect(quadPoint(EXAM, 1, 1)).toEqual([35, 160]);
    expect(quadPoint(EXAM, -1, 1)).toEqual([-60, 175]);
  });
  it("背緣中點仍在 x=−60（垂直邊上任何一點都不會跑掉）", () => {
    expect(quadPoint(EXAM, -1, 0)[0]).toBe(-60);
    expect(quadPoint(EXAM, -1, 0.37)[0]).toBe(-60);
  });
  it("前緣中點 x 在 35 與 60 之間線性", () => {
    const [x] = quadPoint(EXAM, 1, 0);
    expect(x).toBeCloseTo((60 + 35) / 2, 9);
  });
});

describe("3D 幾何：8 個頂點就是四角 × 上下兩面", () => {
  it("頂點 x/z 集合＝四角，y=±厚/2", () => {
    const g = buildQuadGeometry([120, 18, 350], EXAM);
    const pos = g.getAttribute("position");
    expect(pos.count).toBe(8);
    const seen = new Set<string>();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.array[i * 3], y = pos.array[i * 3 + 1], z = pos.array[i * 3 + 2];
      expect(Math.abs(y)).toBeCloseTo(9, 6);
      seen.add(`${x},${z}`);
    }
    expect(seen).toEqual(new Set(EXAM.map(([x, z]) => `${x},${z}`)));
  });
});

describe("cert-c1 範本：預設值＝考題原尺寸，且圖面判讀的數字全部進到零件", () => {
  function build(o: Record<string, number | boolean> = {}) {
    const base: Record<string, unknown> = {};
    for (const s of certC1Options) base[s.key] = (s as { defaultValue: unknown }).defaultValue;
    return certC1({ length: 320, width: 120, height: 350, material: "pine" as MaterialId,
      options: { ...base, ...o } as Record<string, string | number | boolean> });
  }
  const d = build();
  const byId = (id: string) => d.parts.find((p) => p.id === id)!;

  it("總尺寸 320 × 120 × 350、預設不出警告", () => {
    expect(d.overall).toEqual({ length: 320, width: 120, thickness: 350 });
    expect(d.warnings ?? []).toEqual([]);
  });
  it("側板：120×350×18，quad 形狀，背緣在 local +x（實測旋轉後 local x 鏡像到世界 z）", () => {
    const s = byId("side-left");
    expect(s.visible).toEqual({ length: 120, width: 350, thickness: 18 });
    const want = sidePanelQuad({ lx: 120, lz: 350, bottomDepth: 95, topDropFront: 30, bottomRiseFront: 15, backSide: "max" });
    expect(s.shape).toEqual({ kind: "quad", corners: want });
    expect(byId("side-right").shape).toEqual(s.shape);
    // 背緣兩點都在 +60（垂直），前緣頂 −60 降 30、前緣底 −60+95=35 升 15
    expect(want[1]).toEqual([60, -175]);
    expect(want[2]).toEqual([60, 175]);
    expect(want[0]).toEqual([-60, -145]);
    expect(want[3]).toEqual([60 - 95, 160]);   // 前下角：背緣 +60 往前 95 → −35，底緣升 15 → 160
  });
  it("榫眼開在內面：左側板 local y=18、右側板 local y=0（旋轉後 local y→世界 x 同號）", () => {
    expect(byId("side-left").mortises.every((m) => m.origin.y === 18)).toBe(true);
    expect(byId("side-right").mortises.every((m) => m.origin.y === 0)).toBe(true);
  });
  it("背橫檔 18×50、頂端離頂 15（底在 285）；木釘距頂 30、40", () => {
    const r = byId("rail-back-top");
    expect(r.visible).toEqual({ length: 264, width: 50, thickness: 18 });
    expect(r.origin.y).toBe(350 - 15 - 50);
    expect(r.origin.z).toBe(-60 + 9);
    expect(r.mortises).toHaveLength(4);
  });
  it("上層板 18×100，頂面在 285（離頂 65）；每端雙貫穿榫 20 寬、長 18+10", () => {
    const s = byId("shelf");
    expect(s.visible).toEqual({ length: 264, width: 100, thickness: 18 });
    expect(s.origin.y + 18).toBe(285);
    expect(s.tenons).toHaveLength(4);
    for (const t of s.tenons) {
      expect(t.type).toBe("through-tenon");
      expect(t.length).toBe(28);
      expect(t.width).toBe(20);
    }
    // 雙榫頭中心：離背 30 與 80 → 世界 z −30、+20；層板中心 z=−10 → 偏移 −20、+30
    const offs = s.tenons.filter((t) => t.position === "start").map((t) => t.offsetWidth).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(offs).toEqual([-20, 30]);
  });
  it("下橫檔 18×80，頂面離地 80；木釘離背 20、65", () => {
    const r = byId("rail-lower");
    expect(r.visible).toEqual({ length: 264, width: 80, thickness: 18 });
    expect(r.origin.y + 18).toBe(80);
    expect(r.origin.z).toBe(-60 + 40);
    const zs = r.mortises.filter((m) => m.origin.x < 0).map((m) => m.origin.z + r.origin.z + 60).sort((a, b) => a - b);
    expect(zs).toEqual([20, 65]);
  });
  it("前擋條 12×18，底離地 15，前面離側板前緣 3", () => {
    const l = byId("front-lip");
    expect(l.visible).toEqual({ length: 264, width: 12, thickness: 18 });
    expect(l.origin.y).toBe(15);
    expect(l.origin.z + 6).toBe(-60 + 95 - 3);
    expect(l.tenons).toHaveLength(2);
  });
  it("夾板背板 6mm：層板下緣 267 → 下橫檔上緣 80（187 高）、寬 264+6+6、貼背緣", () => {
    const p = byId("back-panel");
    expect(p.materialOverride).toBe("plywood");
    expect(p.visible).toEqual({ length: 276, width: 187, thickness: 6 });
    expect(p.origin.y).toBe(80);
    expect(p.origin.z).toBe(-60 + 3);
  });
  it("側板每片 8 個榫眼：木釘 2+2、貫穿榫眼 2、前擋條短榫眼 1、背板入溝 1（cosmetic）；貫穿的才 through", () => {
    const m = byId("side-left").mortises;
    expect(m).toHaveLength(8);
    expect(m.filter((x) => x.through)).toHaveLength(2);
    expect(m.filter((x) => x.shape === "round")).toHaveLength(4);
    expect(m.filter((x) => x.cosmetic)).toHaveLength(1);
    // 離背 d 的東西在 local x = 60 − d：背橫檔木釘在 60−9=51、貫穿榫眼中心在 60−30=30 與 60−80=−20
    expect(m.find((x) => x.label?.includes("背橫檔"))!.origin.x).toBe(51);
    expect(m.filter((x) => x.through).map((x) => x.origin.x).sort((a, b) => a - b)).toEqual([-20, 30]);
  });
  it("榫頭凸出改 0 → 總寬還是滑桿值、榫長 18、並出聲；取消背板少一件", () => {
    const flush = build({ tenonProud: 0 });
    expect(flush.parts.find((p) => p.id === "shelf")!.tenons[0].length).toBe(18);
    expect((flush.warnings ?? []).some((w) => w.includes("凸出"))).toBe(true);
    expect(build({ withPanel: false }).parts.some((p) => p.id === "back-panel")).toBe(false);
  });
});
