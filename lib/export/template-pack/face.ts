// 選出零件要拿來當樣板的那些面 —— 每個「入榫面」各一張樣板。
import type { Part } from "@/lib/types";
import { partMachiningFaces, type MachiningFace, type DerivedMortise } from "@/lib/export/mortise-faces";
import { partFlatOutline } from "@/lib/export/parts-svg";

/**
 * 回傳這個零件所有要出樣板的加工面。
 *
 * 為什麼是「全部」而不是「面積最大那一面」：partMachiningFaces 的合約就是
 * 「每個入榫面各一張」——一隻桌腳常常兩個相鄰內側面各有一個榫孔接不同牙板。
 * 舊版只留面積最大的一面，全 catalog 實測有 38 個零件群組是多加工面，
 * 291 個榫孔被靜默丟掉、圖上不留任何痕跡（使用者會照著半套孔位鑿，鑿完才發現）。
 *
 * 排序：孔＋榫數量降冪 → 面積降冪。資訊最多的面排第一，件號拿到 a、
 * 索引也先列它。Array.sort 在 V8 是穩定排序，完全平手時維持
 * partMachiningFaces 的 front→back→left→right→top→bottom 順序，輸出可重現。
 *
 * 零件完全沒有榫卯時 partMachiningFaces 回空陣列，退回 partFlatOutline
 * （純外形），包成同樣的 MachiningFace 形狀，讓下游 sheet.ts 只處理一種型別。
 */
export function pickTemplateFaces(part: Part, derived: DerivedMortise[] = []): MachiningFace[] {
  const faces = partMachiningFaces(part, derived);
  if (faces.length > 0) {
    const marks = (f: MachiningFace) => f.holes.length + (f.tenons?.length ?? 0);
    return [...faces].sort((a, b) => (marks(b) - marks(a)) || (b.w * b.h - a.w * a.h));
  }

  const flat = partFlatOutline(part);
  return [
    {
      faceKey: "flat",
      faceLabelZh: "攤平面",
      outline: flat.pts,
      holes: [],
      tenons: [],
      w: flat.w,
      h: flat.h,
    },
  ];
}
