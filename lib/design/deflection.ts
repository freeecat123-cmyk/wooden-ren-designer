/**
 * 板材撓度檢查
 *
 * 主要對象：書架/櫃內層板，跨距太長 + 板太薄會明顯下垂。
 * 公式：簡支樑均佈載重 δ = 5·w·L⁴ / (384·E·I)，I = b·h³/12
 * 容許值：L/240（一般家具標準）
 *
 * 詳細數據與公式 docs/drafting-math.md §M。
 */

import type { MaterialId } from "@/lib/types";

/** 各材料彈性模數 E (MPa) — 來自 USDA Wood Handbook 與 §M2 */
const ELASTIC_MODULUS_MPA: Record<string, number> = {
  "taiwan-cypress": 10000,
  teak: 12000,
  "white-oak": 12500,
  walnut: 11500,
  "douglas-fir": 13400,
  maple: 12600,
  ash: 12000,
  beech: 14000,
  pine: 9500,
  "blockboard-primary": 6500,
  "plywood-primary": 8000,
  "mdf-primary": 3700,
};

/** 預設書本均佈載重 30 kg/m，轉成 N/mm */
const DEFAULT_LOAD_N_PER_MM = (30 * 9.81) / 1000;

/** 容許撓度比 — 一般家具 L/240 */
const DEFLECTION_RATIO = 240;

export interface DeflectionWarning {
  partId: string;
  partName: string;
  level: "WARN" | "ERROR";
  span: number;            // L (mm)
  thickness: number;       // h (mm)
  deflection: number;      // δ (mm)
  limit: number;           // L/240 (mm)
  message: string;
  suggest: string;
}

interface ShelfPart {
  id: string;
  nameZh: string;
  material: MaterialId | string;
  visible: { length: number; width: number; thickness: number };
}

/**
 * 計算單個層板的撓度（簡支樑均佈載重）
 * δ = 5·w·L⁴ / (384·E·I)，I = b·h³/12
 */
function calculateDeflection(
  spanMm: number,
  widthMm: number,
  thicknessMm: number,
  E_mpa: number,
  loadNPerMm: number,
): number {
  const I = (widthMm * thicknessMm ** 3) / 12;       // mm^4
  const w = loadNPerMm * widthMm / 1000;              // 線載荷依板寬縮放（很寬的板承書多）
  const delta = (5 * w * spanMm ** 4) / (384 * E_mpa * I);
  return delta;
}

/**
 * 掃描設計中疑似為層板/橫板的部件，計算撓度警告。
 * 判定條件：part.id 含 "shelf" 或 "top" 或 "bottom"，且寬厚比明顯（板狀），
 *          且跨距 ≥ 300mm（短於 30cm 不擔心）。
 */
export function checkShelfDeflection(parts: ShelfPart[]): DeflectionWarning[] {
  const warnings: DeflectionWarning[] = [];

  for (const part of parts) {
    if (!isShelfLike(part.id)) continue;

    const span = part.visible.length;
    const width = part.visible.width;
    const thickness = part.visible.thickness;
    if (span < 300) continue;
    if (thickness > width || thickness > span) continue; // 不是板狀

    const E = ELASTIC_MODULUS_MPA[part.material as string] ?? 10000;
    const delta = calculateDeflection(span, width, thickness, E, DEFAULT_LOAD_N_PER_MM);
    const limit = span / DEFLECTION_RATIO;
    const ratio = delta / limit;

    if (ratio < 0.7) continue; // OK，不警告

    const suggestT = suggestThicker(span, width, E, DEFAULT_LOAD_N_PER_MM, limit);
    if (ratio < 1.0) {
      warnings.push({
        partId: part.id,
        partName: part.nameZh,
        level: "WARN",
        span, thickness, deflection: Number(delta.toFixed(1)), limit: Number(limit.toFixed(1)),
        message: `${part.nameZh} 跨距 ${span} mm 偏長，預計下垂 ${delta.toFixed(1)} mm`,
        suggest: `建議加厚到 ${suggestT} mm，或中央加橫撐切半跨距（撓度 ÷16）`,
      });
    } else {
      warnings.push({
        partId: part.id,
        partName: part.nameZh,
        level: "ERROR",
        span, thickness, deflection: Number(delta.toFixed(1)), limit: Number(limit.toFixed(1)),
        message: `${part.nameZh} 會明顯下垂！預估 ${delta.toFixed(1)} mm（容許 ${limit.toFixed(1)} mm）`,
        suggest: `改厚 ${suggestT} mm，或中央加一根橫撐`,
      });
    }
  }

  return warnings;
}

function isShelfLike(id: string): boolean {
  return /shelf|under-shelf|board|top|bottom|panel/i.test(id);
}

/** 反向求達到 L/240 所需的板厚 */
function suggestThicker(
  span: number,
  width: number,
  E: number,
  loadNPerMm: number,
  limit: number,
): number {
  // δ = 5·w·L⁴ / (384·E·I)，I = b·h³/12
  // h³ = 5·w·L⁴ / (384·E·b·δ_max/12) → h³ = 60·w·L⁴ / (384·E·b·δ_max)
  const w = loadNPerMm * width / 1000;
  const h3 = (60 * w * span ** 4) / (384 * E * width * limit);
  const h = Math.cbrt(h3);
  // round 到下一個市售規格
  const standards = [12, 15, 18, 24, 25, 30, 38];
  for (const s of standards) {
    if (s >= h) return s;
  }
  return Math.ceil(h);
}
