import { describe, it, expect } from "vitest";
import type { Part } from "@/lib/types";
import { pickTemplateFaces } from "./face";
import { partMachiningFaces } from "@/lib/export/mortise-faces";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { MaterialId, OptionSpec } from "@/lib/types";

/** 最小可用零件：400×80×20 的橫撐，兩端各一個公榫。 */
function makePart(over: Partial<Part> = {}): Part {
  return {
    id: "apron-front",
    nameZh: "牙條",
    material: "pine",
    grainDirection: "length",
    visible: { length: 400, width: 80, thickness: 20 },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [],
    ...over,
  };
}

/** 兩個入榫軸不同的母榫 → 相鄰兩個加工面（凳腳的典型情況）。 */
function twoFacePart(): Part {
  return makePart({
    mortises: [
      // 第一個母榫：入榫軸 Z（靠近 ±40），產生左/右端面（80×20）
      { origin: { x: 100, y: 10, z: 2 }, depth: 8, length: 30, width: 8, through: false },
      // 第二個母榫：入榫軸 X（靠近 200），產生正/背面（400×20）
      { origin: { x: 2, y: 10, z: 40 }, depth: 12, length: 20, width: 6, through: false },
    ],
  });
}

describe("pickTemplateFaces", () => {
  it("單一攤平面時就是那面（400×80，不是 400×20 或 80×20）", () => {
    const faces = pickTemplateFaces(makePart());
    expect(faces).toHaveLength(1);
    const long = Math.max(faces[0].w, faces[0].h);
    const short = Math.min(faces[0].w, faces[0].h);
    expect(long).toBeCloseTo(400, 0);
    expect(short).toBeCloseTo(80, 0);
  });

  it("完全沒有榫卯的零件也要回一個可用的面", () => {
    const faces = pickTemplateFaces(makePart({ tenons: [], mortises: [] }));
    expect(faces).toHaveLength(1);
    expect(faces[0].outline.length).toBeGreaterThanOrEqual(3);
    expect(faces[0].w).toBeGreaterThan(0);
    expect(faces[0].h).toBeGreaterThan(0);
  });

  it("有母榫時，孔位要跟著回傳", () => {
    const part = makePart({
      mortises: [
        { origin: { x: 20, y: 0, z: 30 }, depth: 15, length: 40, width: 10, through: false },
      ],
    });
    const faces = pickTemplateFaces(part);
    expect(faces.reduce((s, f) => s + f.holes.length, 0)).toBeGreaterThan(0);
  });

  /**
   * 舊版這裡斷言的是「挑出面積最大的那一面」——那個意圖已經被推翻。
   * 只留面積最大的一面 = 另一面的榫孔在整包樣板裡完全不存在（全 catalog 實測
   * 291 個孔被靜默丟掉），合約改成「每個加工面各一張」，所以改成守「一個都不能少」。
   */
  it("多個加工面時，每一面都要回傳，一個榫孔都不能掉", () => {
    const part = twoFacePart();
    const all = partMachiningFaces(part);

    // 前提：這個 fixture 必須真的產生多個面，否則下面等於沒測到。
    // 用斷言而不是 if，未來幾何邏輯改動導致只剩一個面時會直接失敗，
    // 逼人回頭修 fixture，而不是靜默退化成弱測試。
    expect(all.length).toBeGreaterThan(1);

    const picked = pickTemplateFaces(part);
    expect(picked).toHaveLength(all.length);
    expect(new Set(picked.map((f) => f.faceKey))).toEqual(new Set(all.map((f) => f.faceKey)));

    const totalHoles = (fs: typeof all) => fs.reduce((s, f) => s + f.holes.length, 0);
    expect(totalHoles(picked)).toBe(totalHoles(all));
    expect(totalHoles(picked)).toBeGreaterThan(0);
  });

  it("排序：孔＋榫數量降冪優先，其次面積降冪", () => {
    const picked = pickTemplateFaces(twoFacePart());
    const marks = picked.map((f) => f.holes.length + (f.tenons?.length ?? 0));
    for (let i = 1; i < picked.length; i++) {
      expect(marks[i]).toBeLessThanOrEqual(marks[i - 1]);
      if (marks[i] === marks[i - 1]) {
        expect(picked[i].w * picked[i].h).toBeLessThanOrEqual(picked[i - 1].w * picked[i - 1].h);
      }
    }
  });

  it("反推母榫與真母榫描述同一個接合時只留真的（凳腳實測：4 個孔不是 8 個）", () => {
    // 反推母榫（deriveMortisesByPart）會對每一個真母榫再算一次，於是同一個孔被畫兩遍。
    // 全 catalog 實測：孔數 312 → 514，多出的 202 個裡 130 對完全重合、5 對錯開
    // 1.50~1.53mm（傾斜零件的 AABB 反推必然偏移）。印在 1:1 樣板上就是兩個相距
    // 1.5mm 的中心十字，下鑿的人不知道該信哪一個。
    // 用真實範本測，不用手捏 fixture —— 手捏的座標對不對本身就要靠猜。
    const entry = getTemplate("stool") as FurnitureCatalogEntry;
    const options = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
      (acc, spec: OptionSpec) => { acc[spec.key] = spec.defaultValue; return acc; }, {});
    const design = entry.template!({
      length: entry.defaults.length, width: entry.defaults.width,
      height: entry.defaults.height, material: "maple" as MaterialId, options,
    });
    const leg = design.parts.find((p) => p.id === "leg-1")!;
    expect(leg.mortises).toHaveLength(4);

    const derived = deriveMortisesByPart(design.parts).get(leg.id) ?? [];
    expect(derived.length).toBeGreaterThan(0); // 前提：真的有反推孔，否則這條測試等於沒測

    const faces = pickTemplateFaces(leg, derived);
    const holes = faces.reduce((n, f) => n + f.holes.length, 0);
    expect(holes).toBe(4); // 正面 榫孔1/榫孔3 + 右端 榫孔2/榫孔4

    // 同一面上不得再有兩個中心貼在一起的孔
    for (const f of faces) {
      const cs = f.holes.map((h) => {
        if (h.kind === "circle" && h.cx != null && h.cy != null) return { x: h.cx, y: h.cy };
        const pts = h.pts ?? [];
        return pts.length
          ? { x: pts.reduce((a, q) => a + q.x, 0) / pts.length, y: pts.reduce((a, q) => a + q.y, 0) / pts.length }
          : null;
      }).filter(Boolean) as Array<{ x: number; y: number }>;
      for (let i = 0; i < cs.length; i++) {
        for (let j = i + 1; j < cs.length; j++) {
          expect(Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y)).toBeGreaterThan(5);
        }
      }
    }
  });

  it("零件沒有真母榫時，反推母榫要保留（那正是它存在的理由）", () => {
    const part = makePart({ mortises: [] });
    const derived = [
      {
        lb: { cx: 100, cy: 10, cz: 2, hx: 15, hy: 4, hz: 4, depthAxis: "z" as const },
        through: false,
        label: "榫孔",
      },
    ] as unknown as Parameters<typeof pickTemplateFaces>[1];

    const withDerived = pickTemplateFaces(part, derived);
    const withoutDerived = pickTemplateFaces(part, []);
    const n = (fs: typeof withDerived) => fs.reduce((s, f) => s + f.holes.length, 0);
    expect(n(withDerived)).toBeGreaterThan(n(withoutDerived));
  });

  it("面積平手時排孔多的那面在前（舊版嚴格大於會留住排序第一個＝孔較少的面）", () => {
    // 上下同尺寸、孔數不同的板（斗櫃底板的縮小版）：頂面 1 孔、底面 3 孔，面積完全相同。
    // partMachiningFaces 的 ORDER 把 top 排在 bottom 前面，舊版嚴格大於會留住 top（1 孔）。
    const panel = makePart({
      id: "panel-bottom",
      visible: { length: 300, width: 200, thickness: 18 },
      mortises: [
        // y 靠近 18 → 頂面；靠近 0 → 底面（through:false 只落在最近那一面）
        { origin: { x: -100, y: 17, z: 0 }, depth: 6, length: 20, width: 10, through: false },
        { origin: { x: 0, y: 1, z: 0 }, depth: 6, length: 20, width: 10, through: false },
        { origin: { x: 50, y: 1, z: 40 }, depth: 6, length: 20, width: 10, through: false },
        { origin: { x: 100, y: 1, z: -40 }, depth: 6, length: 20, width: 10, through: false },
      ],
    });
    const all = partMachiningFaces(panel);
    expect(all.length).toBe(2);
    const areas = all.map((f) => f.w * f.h);
    expect(areas[0]).toBeCloseTo(areas[1], 6); // fixture 前提：面積必須平手

    const picked = pickTemplateFaces(panel);
    expect(picked[0].holes.length).toBe(Math.max(...all.map((f) => f.holes.length)));
    expect(picked[0].holes.length).toBeGreaterThan(picked[1].holes.length);
  });
});
