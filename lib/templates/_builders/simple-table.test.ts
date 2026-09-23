import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "../index";
import type { FurnitureCatalogEntry } from "../index";
import type { OptionSpec, MaterialId, FurnitureDesign } from "../../types";
import { curvedTaperCoveSpan } from "@/lib/render/part-geometry";

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
  const e = (FURNITURE_CATALOG as readonly FurnitureCatalogEntry[]).find(
    (x: FurnitureCatalogEntry) => x.category === category,
  );
  if (!e) throw new Error(`catalog 找不到 ${category}`);
  return e;
}

function specDefault(entry: FurnitureCatalogEntry, key: string): number {
  const s = (entry.optionSchema ?? []).find((o: OptionSpec) => o.key === key);
  return Number(s?.defaultValue);
}

type OptVal = string | number | boolean;

function build(entry: FurnitureCatalogEntry, override: Record<string, OptVal>) {
  const options = (entry.optionSchema ?? []).reduce<Record<string, OptVal>>(
    (acc: Record<string, OptVal>, s: OptionSpec) => ((acc[s.key] = s.defaultValue as OptVal), acc),
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
function apronHeight(design: FurnitureDesign): number {
  const p = design.parts.find((x: FurnitureDesign["parts"][number]) => /牙條|牙板/.test(x.nameZh ?? ""));
  if (!p) throw new Error("找不到牙條零件");
  return p.visible.width;
}

function apronTopY(design: FurnitureDesign): number {
  const p = design.parts.find((x: FurnitureDesign["parts"][number]) => /牙條|牙板/.test(x.nameZh ?? ""))!;
  return p.origin.y + p.visible.width;
}

describe.each(VIA_SIMPLE_TABLE)("弧肩斜腳的牙條高 — %s", (category) => {
  const entry = entryOf(category);
  const ctBlock = specDefault(entry, "ctBlockHeight");
  /**
   * 弧肩在接撐段底以下佔掉的高度 —— 牙條底緣必須讓開它。
   * 用跟 builder / 幾何**同一支**函式算,不要在測試裡自己寫一份公式
   * (自己寫的話,實作改了測試也跟著「對」,等於沒防護)。
   */
  const COVE = curvedTaperCoveSpan(
    specDefault(entry, "legSize"),
    entry.defaults.height,
    ctBlock,
    specDefault(entry, "ctShoulder"),
  );
  const apronDefault = specDefault(entry, "apronWidth");

  it("① 前提:預設牙條高比接撐段高還高(否則本檔其他案例驗不到東西)", () => {
    expect(apronDefault).toBeGreaterThan(ctBlock);
  });

  /**
   * ⚠️ 這條 2026-08-25 從「＝接撐段高」改成「＝接撐段高 − 弧肩內收」。
   *
   * 不是放水,是**木頭仁實測後要求的**:接撐段 40 / 弧肩內收 8 時,
   * 他要手動把牙條高調到 32 才「剛剛好」。差的正好是弧肩那一段 ——
   * 弧的上端是水平切線,牙條底緣貼著接撐段底就等於架在刀口上
   * (1mm 內腳就縮 3.8mm)。
   *
   * ⇒ 規則改成:牙條底緣必須讓開弧肩。這會讓 5 款走這支 builder 的家具
   *    (長凳/邊桌/矮桌/餐桌/書桌)預設牙條高 40 → 32。**這是刻意的外觀改動。**
   */
  it("② 全預設時牙條高就是使用者設的值（接撐段自己長高去容納）", () => {
    expect(apronHeight(build(entry, { legShape: "curved-taper" }))).toBe(specDefault(entry, "apronWidth"));
  });

  it("③ 使用者把牙條高調到比接撐段矮 → 要照他的數字走,不能被吃掉", () => {
    const low = ctBlock - 10;
    expect(apronHeight(build(entry, { legShape: "curved-taper", apronWidth: low }))).toBe(low);
  });

  /**
   * ⚠️ 2026-08-25 反轉:規則從「把牙條砍到接撐段」改成「**接撐段長高去容納牙條**」。
   *    (木頭仁「牙條高度又卡住了」—— 餐桌預設牙條 100 被砍成 32、書桌 90 → 32。)
   *    牙條高是使用者的設計決定,接撐段跟著它長。
   */
  it("④ 把牙條高調高 → 照他的數字做,接撐段自己長高", () => {
    const hi = ctBlock + 60;
    expect(apronHeight(build(entry, { legShape: "curved-taper", apronWidth: hi }))).toBe(hi);
  });

  it("⑦ 真的夾到時（牙條高過腳高 90%）要出聲", () => {
    const legH = entry.defaults.height;
    const d: any = build(entry, { legShape: "curved-taper", apronWidth: Math.round(legH * 1.5) });
    const w = (d.warnings ?? []).find((x: string) => /牙條高|牙板高/.test(x));
    expect(w, "夾了卻沒有任何警告 = 使用者會以為滑桿壞了").toBeTruthy();
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
