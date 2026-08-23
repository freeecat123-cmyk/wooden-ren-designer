import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { buildCutPieces } from "./index";

/**
 * 材料單上的每一件，台灣市面都要買得到。
 *
 * 買不到 = 使用者拿著裁切單去木材行，老闆說「沒有這種東西」。
 * 2026-08-23 掃描抓到 4 件：圓桌面 1000×1000、壁掛背板 1200×1200
 * （都缺 panelPieces 拼板宣告），以及 6 款櫃子的 3mm「實木」背板
 * （3mm 實木板不存在，§T1 那是薄合板規格）。
 */

// §T3 集成材：松木 600×1800 / 800×1800，橡木 600×1800 / 800×2400
const GLUED_PANEL = { maxLength: 2400, maxWidth: 800 };
// §T4 角料：最寬 1×6 = 180mm，最長 12 尺 = 3636mm
const SOLID_STICK = { maxLength: 3636, maxWidth: 180 };
// §T3 板材：4×8 呎
const SHEET = { maxLength: 2440, maxWidth: 1220 };
/** 實木最薄可用厚度：再薄只有合板做得到（§T1，1 分 = 3mm 是薄合板） */
const MIN_SOLID_THICKNESS = 6;

const entries = (FURNITURE_CATALOG as any[]).filter((e) => e.template);

describe("材料單上的料，台灣買得到", () => {
  for (const e of entries) {
    it(`${e.category}`, () => {
      const lim = e.limits ?? {};
      const base: any = (e.optionSchema ?? []).reduce(
        (a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const sizes = [
        { t: "預設", L: e.defaults.length, W: e.defaults.width, H: e.defaults.height },
        { t: "最大", L: lim.maxLength ?? e.defaults.length, W: lim.maxWidth ?? e.defaults.width, H: lim.maxHeight ?? e.defaults.height },
      ];
      const offenders: string[] = [];
      for (const sz of sizes) {
        let d: any;
        try { d = toBeginnerMode(e.template({ length: sz.L, width: sz.W, height: sz.H, material: "maple", options: base })); }
        catch { continue; }
        const { lumberGroups, sheetGroups } = buildCutPieces(d);

        for (const [, ps] of sheetGroups) for (const p of ps as any[]) {
          const [a, b] = [p.length, p.width].sort((x, y) => y - x);
          if (a > SHEET.maxLength || b > SHEET.maxWidth)
            offenders.push(`[${sz.t}] 板材「${p.partNameZh}」${Math.round(a)}×${Math.round(b)} > 4×8 呎板`);
        }

        for (const [, ps] of lumberGroups) for (const p of ps as any[]) {
          const [a, b, c] = [p.length, p.width, p.thickness].sort((x, y) => y - x);
          const okPanel = a <= GLUED_PANEL.maxLength && b <= GLUED_PANEL.maxWidth;
          const okStick = a <= SOLID_STICK.maxLength && b <= SOLID_STICK.maxWidth;
          if (!okPanel && !okStick)
            offenders.push(`[${sz.t}] 實木「${p.partNameZh}」${Math.round(a)}×${Math.round(b)} — 集成材與角料都買不到（缺拼板宣告？）`);
          if (c < MIN_SOLID_THICKNESS)
            offenders.push(`[${sz.t}] 實木「${p.partNameZh}」厚 ${c}mm < ${MIN_SOLID_THICKNESS}mm — 這麼薄只有合板做得到`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

describe("拼板要沿面寬拆，不是沿板厚（軸不能寫死）", () => {
  /**
   * 2026-08-23 bug：`splitWidth = cut.width / pieces` 假設 width 就是面寬。
   * 立著的壁掛背板 visible={length:1200, width:18, thickness:1200}，
   * 結果把 18mm 板厚切成 5 份變 3.6mm，1200mm 面寬完全沒拆 → 照樣排不下。
   */
  const mkDesign = (visible: any) => ({
    id: "t", category: "desk", nameZh: "t", primaryMaterial: "maple",
    defaultJoinery: "mortise-tenon", overall: { length: 1, width: 1, height: 1 },
    parts: [{
      id: "p", nameZh: "拼板件", material: "maple", grainDirection: "length",
      visible, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
      tenons: [], mortises: [], panelPieces: 4,
    }],
  }) as any;

  const dims = (d: any) => {
    const [[, ps]] = [...buildCutPieces(d).lumberGroups];
    return ps.map((p: any) => [p.length, p.width, p.thickness]);
  };

  it("躺平的面板：1200×800×18 拆 4 片 → 每片 1200×200×18", () => {
    expect(dims(mkDesign({ length: 1200, width: 800, thickness: 18 }))).toEqual(
      Array(4).fill([1200, 200, 18]));
  });

  it("立著的面板：板厚在 width，也要拆出一模一樣的結果", () => {
    expect(dims(mkDesign({ length: 1200, width: 18, thickness: 800 }))).toEqual(
      Array(4).fill([1200, 200, 18]));
  });

  it("板厚在 length 也一樣（三個軸都試過）", () => {
    expect(dims(mkDesign({ length: 18, width: 1200, thickness: 800 }))).toEqual(
      Array(4).fill([1200, 200, 18]));
  });

  it("拆完總材積不變（拼板只是換算法，不是變出材料）", () => {
    const one = buildCutPieces(mkDesign({ length: 1200, width: 800, thickness: 18 }));
    const vol = [...one.lumberGroups].flatMap(([, ps]) => ps)
      .reduce((s, p: any) => s + p.length * p.width * p.thickness, 0);
    expect(vol).toBeCloseTo(1200 * 800 * 18, 3);
  });
});
