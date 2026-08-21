import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "../index";
import type { FurnitureCatalogEntry, OptionSpec, MaterialId } from "../../types";

/**
 * 🧷 弧肩斜腳(curved-taper)的「牙條高」必須是**夾上限**,不是無條件覆寫。
 *
 * ⭐為什麼要有這支測試:
 *   `_builders/simple-table.ts` 原本寫 `apronWidth = isCurvedTaper ? ctBlockHeight : (...)`,
 *   把使用者在 UI 調的牙條高整個丟掉。而走這個共用 builder 的 7 款模板,「牙條高」欄位
 *   **並沒有隱藏** —— 看得到、拖得動、數字會變,產出卻完全不理你 ＝ 死控制項。
 *   square-stool 那批(2026-08-03)已改成夾上限,共用 builder 這邊漏了,一路活到
 *   2026-08-21 稽核才抓到。**因為當時沒有任何一支測試釘住這個行為。**
 *
 * ⚠️這支測試同時擋兩個反方向的退化:
 *   ①「又改回無條件覆寫」→ 案例②③ 會紅
 *   ②「乾脆把夾上限拿掉」→ 案例④ 會紅(榫眼會掉出腳的全寬實體區、切到已收弧的斜面)
 */

/** 走 _builders/simple-table 且 UI 有「牙條高」欄位的模板。tea-table 無此欄位故不列入。 */
const VIA_SIMPLE_TABLE = ["bench", "side-table", "low-table", "dining-table", "desk"] as const;

function entryOf(category: string): FurnitureCatalogEntry {
  const e = (FURNITURE_CATALOG as FurnitureCatalogEntry[]).find((x) => x.category === category);
  if (!e) throw new Error(`catalog 找不到 ${category}`);
  return e;
}

function specDefault(entry: FurnitureCatalogEntry, key: string): number {
  const s = (entry.optionSchema ?? []).find((o: OptionSpec) => o.key === key);
  return Number(s?.defaultValue);
}

function build(entry: FurnitureCatalogEntry, override: Record<string, unknown>) {
  const options = (entry.optionSchema ?? []).reduce<Record<string, unknown>>(
    (acc, s: OptionSpec) => ((acc[s.key] = s.defaultValue), acc),
    {},
  );
  return entry.template!({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: { ...options, ...override },
  });
}

/** 牙條零件的實際高度(visible.width)。取第一片,四片同高。 */
function apronHeight(design: ReturnType<NonNullable<FurnitureCatalogEntry["template"]>>): number {
  const p = design.parts.find((x) => /牙條|牙板/.test(x.nameZh ?? ""));
  if (!p) throw new Error("找不到牙條零件");
  return p.visible.width;
}

function apronTopY(design: ReturnType<NonNullable<FurnitureCatalogEntry["template"]>>): number {
  const p = design.parts.find((x) => /牙條|牙板/.test(x.nameZh ?? ""))!;
  return p.origin.y + p.visible.width;
}

describe.each(VIA_SIMPLE_TABLE)("弧肩斜腳的牙條高 — %s", (category) => {
  const entry = entryOf(category);
  const ctBlock = specDefault(entry, "ctBlockHeight");
  const apronDefault = specDefault(entry, "apronWidth");

  it("① 前提:預設牙條高比接撐段高還高(否則本檔其他案例驗不到東西)", () => {
    expect(apronDefault).toBeGreaterThan(ctBlock);
  });

  it("② 全預設時的牙條高＝接撐段高(⚠️這條釘住『修正不得改動既有設定』)", () => {
    expect(apronHeight(build(entry, { legShape: "curved-taper" }))).toBe(ctBlock);
  });

  it("③ 使用者把牙條高調到比接撐段矮 → 要照他的數字走,不能被吃掉", () => {
    const low = ctBlock - 10;
    expect(apronHeight(build(entry, { legShape: "curved-taper", apronWidth: low }))).toBe(low);
  });

  it("④ 使用者把牙條高調到比接撐段高 → 仍要夾回接撐段高(榫眼不能掉出全寬實體區)", () => {
    const hi = ctBlock + 60;
    expect(apronHeight(build(entry, { legShape: "curved-taper", apronWidth: hi }))).toBe(ctBlock);
  });

  it("⑤ 不管牙條高多少,牙條頂面都貼齊同一個高度(改高度不該讓它浮起來或陷進去)", () => {
    const top = apronTopY(build(entry, { legShape: "curved-taper" }));
    for (const w of [ctBlock - 10, ctBlock, ctBlock + 60]) {
      expect(apronTopY(build(entry, { legShape: "curved-taper", apronWidth: w }))).toBe(top);
    }
  });

  it("⑥ 非弧肩斜腳不受影響:直腳時牙條高就是使用者設的值", () => {
    expect(apronHeight(build(entry, { apronWidth: ctBlock + 60 }))).toBe(ctBlock + 60);
  });
});
