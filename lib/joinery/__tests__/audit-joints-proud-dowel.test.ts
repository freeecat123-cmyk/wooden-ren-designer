/**
 * 榫接稽核的兩條新規則（2026-09-07，技能檢定家具木工丙級 01200-100301 帶進來的）：
 *  1. **凸出的貫穿榫**：through-tenon 穿過通孔後沒有第三件，多出來的長度是露在外面的榫頭 → 算對到。
 *     盲榫比通孔長仍然是錯（會頂穿）。
 *  2. **木釘接**：兩件各一顆同直徑圓孔、沒有榫頭零件 → 互相配對算對到；落單的圓孔照樣報。
 */
import { describe, it, expect } from "vitest";
import { auditJoints } from "@/lib/joinery/audit-joints";
import type { FurnitureDesign, Part } from "@/lib/types";

function part(id: string, extra: Partial<Part>): Part {
  return {
    id, nameZh: id, material: "pine", grainDirection: "length",
    visible: { length: 100, width: 50, thickness: 18 },
    origin: { x: 0, y: 0, z: 0 }, tenons: [], mortises: [],
    ...extra,
  } as Part;
}
function design(parts: Part[]): FurnitureDesign {
  return { id: "t", category: "stool", nameZh: "t", overall: { length: 1, width: 1, thickness: 1 }, parts, defaultJoinery: "through-tenon", primaryMaterial: "pine" } as FurnitureDesign;
}
const throughHole = { origin: { x: 0, y: 18, z: 0 }, depth: 18, length: 20, width: 18, through: true };

describe("凸出的貫穿榫", () => {
  it("through-tenon 長 28 穿過深 18 的通孔、後面沒東西 → 兩邊都對到", () => {
    const r = auditJoints(design([
      part("rail", { tenons: [{ position: "start", type: "through-tenon", length: 28, width: 20, thickness: 18 }] }),
      part("side", { mortises: [{ ...throughHole }] }),
    ]));
    expect(r.unmatchedTenons).toEqual([]);
    expect(r.unmatchedMortises).toEqual([]);
  });
  it("blind-tenon 比通孔長 → 還是要報（會頂穿）", () => {
    const r = auditJoints(design([
      part("rail", { tenons: [{ position: "start", type: "blind-tenon", length: 28, width: 20, thickness: 18 }] }),
      part("side", { mortises: [{ ...throughHole }] }),
    ]));
    expect(r.unmatchedTenons).toHaveLength(1);
  });
  it("through-tenon 但斷面對不上 → 報", () => {
    const r = auditJoints(design([
      part("rail", { tenons: [{ position: "start", type: "through-tenon", length: 28, width: 30, thickness: 18 }] }),
      part("side", { mortises: [{ ...throughHole }] }),
    ]));
    expect(r.unmatchedTenons).toHaveLength(1);
    expect(r.unmatchedMortises).toHaveLength(1);
  });
});

describe("木釘接（圓孔對圓孔）", () => {
  const hole = (depth: number) => ({ origin: { x: 0, y: 18, z: 0 }, depth, length: 8, width: 8, through: false, shape: "round" as const });
  it("橫檔端面 Ø8 深 18 ＋ 側板 Ø8 深 12 → 一組木釘接，兩顆都不報", () => {
    const r = auditJoints(design([
      part("rail", { mortises: [hole(18)] }),
      part("side", { mortises: [hole(12)] }),
    ]));
    expect(r.unmatchedMortises).toEqual([]);
  });
  it("三顆圓孔只配得成一組，落單那顆要報", () => {
    const r = auditJoints(design([
      part("rail", { mortises: [hole(18)] }),
      part("side", { mortises: [hole(12), hole(12)] }),
    ]));
    expect(r.unmatchedMortises).toHaveLength(1);
  });
  it("同一件上的兩顆圓孔不能互相配（木釘要接兩件）", () => {
    const r = auditJoints(design([part("rail", { mortises: [hole(18), hole(18)] })]));
    expect(r.unmatchedMortises).toHaveLength(2);
  });
  it("直徑不同不配", () => {
    const r = auditJoints(design([
      part("rail", { mortises: [hole(18)] }),
      part("side", { mortises: [{ ...hole(12), length: 10, width: 10 }] }),
    ]));
    expect(r.unmatchedMortises).toHaveLength(2);
  });
});

describe("木釘接配對先看開口位置（2026-09-09 乙級第一題）", () => {
  // A 件孔在 P1、P2；B 件孔在 P1、P3；C 件孔在 P2、P3。只看直徑的貪婪法：A 的兩顆先把 B 的兩顆吃掉，C 兩顆落單。
  const hole = (x: number, z: number) => ({ origin: { x, y: 18, z }, depth: 15, length: 8, width: 8, through: false, shape: "round" as const });
  it("三件互相木釘接，每顆孔都配到同位置的伴", () => {
    const r = auditJoints(design([
      part("A", { origin: { x: 0, y: 0, z: 0 }, mortises: [hole(-40, 0), hole(40, 0)] }),
      part("B", { origin: { x: 0, y: 18, z: 0 }, mortises: [{ ...hole(-40, 0), origin: { x: -40, y: 0, z: 0 } }, { ...hole(0, 20), origin: { x: 0, y: 0, z: 20 } }] }),
      part("C", { origin: { x: 0, y: 18, z: 0 }, mortises: [{ ...hole(40, 0), origin: { x: 40, y: 0, z: 0 } }, hole(0, 20)] }),
    ]));
    expect(r.unmatchedMortises).toEqual([]);
  });
});
