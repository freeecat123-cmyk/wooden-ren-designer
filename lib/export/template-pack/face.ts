// 選出零件要拿來當樣板的那一面 —— 攤平躺在工作台上、面積最大的那面。
import type { Part } from "@/lib/types";
import { partMachiningFaces, type MachiningFace, type DerivedMortise } from "@/lib/export/mortise-faces";
import { partFlatOutline } from "@/lib/export/parts-svg";

/**
 * 面積最大的加工面 = 攤平面。
 * 零件沒有任何榫卯時 partMachiningFaces 可能回空陣列，
 * 此時退回 partFlatOutline（純外形），包成同樣的 MachiningFace 形狀，
 * 讓下游 sheet.ts 只要處理一種型別。
 */
export function pickTemplateFace(part: Part, derived: DerivedMortise[] = []): MachiningFace {
  const faces = partMachiningFaces(part, derived);
  let best: MachiningFace | null = null;
  for (const f of faces) {
    if (!best || f.w * f.h > best.w * best.h) best = f;
  }
  if (best) return best;

  const flat = partFlatOutline(part);
  return {
    faceKey: "flat",
    faceLabelZh: "攤平面",
    outline: flat.pts,
    holes: [],
    tenons: [],
    w: flat.w,
    h: flat.h,
  };
}
