import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";

/*
 * 🩸 組裝版（toBeginnerMode）會把榫頭榫眼全部拔掉 ⇒ 只跟榫接有關的選項在組裝版選了
 *    也沒任何變化。表單原本寫死 `s.key !== "legPenetratingTenon"` 把它藏起來，
 *    工作桌的 `legTopJoint`、方凳的 `seatPenetratingTenon`、中式櫃的 `postEndStyle`
 *    沒被加進名單 ⇒ 顯示著、選了沒作用 —— 木頭仁 2026-09-10「桌角的貫穿榫沒有作用」。
 *
 * 這支掃全目錄：凡是「榫接版有差、組裝版沒差」的選項都必須標 joineryOnly，
 * 以後新增的選項漏標就紅。
 */
type Spec = { key: string; type: string; defaultValue: unknown; joineryOnly?: boolean; choices?: Array<{ value: string }> };
type Entry = { category: string; joineryOnly?: boolean; optionSchema?: Spec[]; template: (input: object) => { parts: unknown[] }; defaults?: { length?: number; width?: number; height?: number } };

function scan() {
  const deadInAssembled = new Set<string>();
  const changesAssembled = new Set<string>();
  const errors: string[] = [];
  let pairs = 0;
  for (const e of FURNITURE_CATALOG as unknown as Entry[]) {
    if (e.joineryOnly) continue;
    const base = { category: e.category, length: e.defaults?.length ?? 1000, width: e.defaults?.width ?? 500, height: e.defaults?.height ?? 750, material: "pine" };
    for (const spec of e.optionSchema ?? []) {
      const alts: unknown[] = spec.type === "checkbox" ? [!spec.defaultValue]
        : spec.type === "select" ? (spec.choices ?? []).map((c) => c.value).filter((v) => v !== spec.defaultValue)
        : [];
      for (const alt of alts) {
        pairs++;
        try {
          const a = e.template({ ...base, options: { [spec.key]: alt } });
          const b = e.template({ ...base, options: { [spec.key]: spec.defaultValue } });
          const raw = JSON.stringify(a.parts) !== JSON.stringify(b.parts);
          const asm = JSON.stringify(toBeginnerMode(a as never).parts) !== JSON.stringify(toBeginnerMode(b as never).parts);
          if (asm) changesAssembled.add(`${e.category}.${spec.key}`);
          if (raw && !asm) deadInAssembled.add(`${e.category}.${spec.key}`);
        } catch (err) {
          errors.push(`${e.category}.${spec.key}=${String(alt)}: ${(err as Error).message}`);
        }
      }
    }
  }
  return { deadInAssembled, changesAssembled, errors, pairs };
}

const result = scan();
const flagged = new Set((FURNITURE_CATALOG as unknown as Entry[]).flatMap((e) =>
  (e.optionSchema ?? []).filter((s) => s.joineryOnly).map((s) => `${e.category}.${s.key}`)));

describe("只在榫接工法有作用的選項（joineryOnly）", () => {
  it("掃描本身有效：沒有建模失敗被吞掉，而且真的掃到上千組", () => {
    expect(result.errors).toEqual([]);
    expect(result.pairs).toBeGreaterThan(500);
  });

  it("正對照：已知在組裝版沒作用的那幾個一定要被掃到（掃描壞掉會回空集合）", () => {
    for (const known of ["workbench.legTopJoint", "workbench.legPenetratingTenon", "stool.seatPenetratingTenon", "chinese-cabinet.postEndStyle"]) {
      expect(result.deadInAssembled.has(known), known).toBe(true);
    }
  });

  it("組裝版選了沒作用的選項，全部都要標 joineryOnly（不然會顯示著、選了沒反應）", () => {
    const missing = [...result.deadInAssembled].filter((k) => !flagged.has(k));
    expect(missing).toEqual([]);
  });

  it("反向：標了 joineryOnly 的選項在組裝版不可以有任何作用（不然會把有用的選項藏掉）", () => {
    const wronglyHidden = [...flagged].filter((k) => result.changesAssembled.has(k));
    expect(wronglyHidden).toEqual([]);
  });

  it("表單不可以再用寫死 key 的方式藏選項 —— 那就是這次漏掉 legTopJoint 的原因", () => {
    // 先剝掉註解：註解裡會引用舊寫法講歷史，不能算「還寫死著」
    const page = readFileSync("app/[locale]/design/[type]/page.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(page).not.toMatch(/s\.key\s*!==\s*"legPenetratingTenon"/);
    expect(page).toMatch(/joineryMode\s*\|\|\s*!s\.joineryOnly/);
  });
}, 120_000);
