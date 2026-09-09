/**
 * 零件名去流水號要保留規格數字。
 * 🩸2026-09-09：裁切計算器把「抽屜底板（4mm 合板）」印成「抽屜底板（mm 合板）」——舊規則 `.replace(/\d+/g,"")`
 * 一律吃掉數字。全 catalog 有 16 種名稱被吃壞（木釘 Ø8×30、夾板背板（6mm）、鑄鐵快速鉗本體（7 吋）…）。
 */
import { describe, it, expect } from "vitest";
import { stripInstanceNumbers } from "@/lib/cutplan/piece-spec";

describe("stripInstanceNumbers", () => {
  it("拿掉流水號", () => {
    expect(stripInstanceNumbers("椅腳 1")).toBe("椅腳");
    expect(stripInstanceNumbers("下層抽屜1 面板")).toBe("下層抽屜 面板");
    expect(stripInstanceNumbers("層板 12")).toBe("層板");
  });
  it("保留規格數字（接單位、Ø／× 規格串、小數）", () => {
    expect(stripInstanceNumbers("抽屜底板（4mm 合板）")).toBe("抽屜底板（4mm 合板）");
    expect(stripInstanceNumbers("夾板背板（6mm）")).toBe("夾板背板（6mm）");
    expect(stripInstanceNumbers("木釘 Ø8×30（背橫檔）")).toBe("木釘 Ø8×30（背橫檔）");
    expect(stripInstanceNumbers("鑄鐵快速鉗本體（7 吋）")).toBe("鑄鐵快速鉗本體（7 吋）");
    expect(stripInstanceNumbers("盒蓋（鑲板下沉 5mm）")).toBe("盒蓋（鑲板下沉 5mm）");
    expect(stripInstanceNumbers("Drawer bottom (4mm plywood)")).toBe("Drawer bottom (4mm plywood)");
  });
});
