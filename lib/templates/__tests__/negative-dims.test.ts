import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";

/**
 * 迴歸防護：任何家具、任何數字選項推到 min / max，都不准產出「零或負尺寸」的零件。
 *
 * 為什麼要有這個：負尺寸零件不會丟例外，會安安靜靜流進裁切單、報價、3D 匯出。
 * 使用者看到的是「這片板長 -21mm」或是整片消失。2026-08-21 全站掃描時
 * 28 款裡有 14 款中招，成因分四類（腳內縮 / 抽屜欄數 / 門扇數 / 門框料寬）。
 *
 * ⚠️ 這個數字只能變少。變多 = 有人加了沒夾上限的滑桿。
 */
describe("零件尺寸永遠是正的（全模板 × 全數字選項極值）", () => {
  const entries = (FURNITURE_CATALOG as any[]).filter((e) => e.template);

  it("目錄有 29 款且每款都有 template（確認掃描範圍沒縮水）", () => {
    expect(entries.length).toBe(29);
  });

  for (const e of entries) {
    it(`${e.category}：所有數字選項推到極值都不產生非正尺寸零件`, () => {
      const specs = (e.optionSchema ?? []) as any[];
      const base: any = specs.reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const offenders: string[] = [];
      for (const s of specs) {
        if (s.type !== "number") continue;
        for (const v of [s.min, s.max]) {
          if (v == null) continue;
          let design: any;
          try {
            design = e.template({
              length: e.defaults.length,
              width: e.defaults.width,
              height: e.defaults.height,
              material: "maple",
              options: { ...base, [s.key]: v },
            });
          } catch {
            continue; // 丟例外是另一條線的問題，這裡只管尺寸
          }
          for (const p of design.parts as any[]) {
            if (p.visible.length <= 0 || p.visible.width <= 0 || p.visible.thickness <= 0) {
              offenders.push(
                `${s.key}=${v} → ${p.id} (${p.visible.length}×${p.visible.width}×${p.visible.thickness})`,
              );
            }
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  /**
   * 兩個選項同時推極值。單推一個沒事、兩個一起就爆的組合實測有 10 組
   * （腳寬覆寫 + 大內縮、分層高度互相吃掉內高…），單選項掃描完全看不到。
   */
  for (const e of entries) {
    it(`${e.category}：任兩個數字選項同時推極值也不產生非正尺寸零件`, () => {
      const specs = (e.optionSchema ?? []).filter((s: any) => s.type === "number") as any[];
      const base: any = (e.optionSchema ?? []).reduce(
        (a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const offenders: string[] = [];
      for (const a of specs) for (const b of specs) {
        if (a.key >= b.key) continue;
        for (const va of [a.min, a.max]) for (const vb of [b.min, b.max]) {
          if (va == null || vb == null) continue;
          let d: any;
          try {
            d = e.template({
              length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
              material: "maple", options: { ...base, [a.key]: va, [b.key]: vb },
            });
          } catch { continue; }
          for (const p of d.parts as any[]) {
            if (p.visible.length <= 0 || p.visible.width <= 0 || p.visible.thickness <= 0) {
              offenders.push(`${a.key}=${va} + ${b.key}=${vb} → ${p.id}`);
            }
          }
        }
      }
      expect(offenders.slice(0, 5)).toEqual([]);
    });
  }
});
