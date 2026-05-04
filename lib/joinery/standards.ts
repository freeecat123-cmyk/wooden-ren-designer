import type { JoineryType } from "@/lib/types";

/**
 * 直榫（盲榫 / 通榫 / 帶肩榫）標準幾何
 *
 * 依據：docs/drafting-math.md §B2 榫卯尺寸標準比例
 *
 * 規則（硬軟木統一，避免設計者要記材料規則）：
 *  - 榫厚 t = T / 3              （T = 公榫件斷面厚）
 *  - 榫寬 w = W − 2 × 肩寬       （W = 公榫件斷面寬）
 *  - 肩寬 = 5mm（4 邊全肩，固定不自適應）
 *  - 盲榫長 L = max(2/3 × M, 25mm)
 *  - 通榫長 = M                  （M = 母件厚，穿透）
 *
 * 配合公差渲染畫 0 縫（手作實際 0.1mm 由木工自己對）。
 */

export const SHOULDER_MM = 5 as const;
export const MIN_BLIND_TENON_LEN = 25 as const;
export const MIN_TENON_THICKNESS = 6 as const;
export const MIN_TENON_WIDTH = 15 as const;
/** 自動判定：母件厚 ≤ AUTO_THROUGH_THRESHOLD → 通榫；> 此值 → 盲榫 (length = round(M × 2/3)) */
export const AUTO_THROUGH_THRESHOLD_MM = 25 as const;

/**
 * 依母件厚度自動決定榫類型：
 *   - 母厚 ≤ 25mm → through-tenon（榫長 = 母厚，穿透）
 *   - 母厚 > 25mm → blind-tenon（榫長 = round(母厚 × 2/3)）
 */
export function autoTenonType(motherThickness: number): "through-tenon" | "blind-tenon" {
  return motherThickness <= AUTO_THROUGH_THRESHOLD_MM ? "through-tenon" : "blind-tenon";
}
export const STANDARD_SHOULDER_ON: ReadonlyArray<"top" | "bottom" | "left" | "right"> = [
  "top",
  "bottom",
  "left",
  "right",
];

export interface StandardTenonInput {
  type: JoineryType;
  /** 公榫件斷面厚（榫厚 = childThickness / 3） */
  childThickness: number;
  /** 公榫件斷面寬（榫寬 = childWidth − 2 × 肩） */
  childWidth: number;
  /** 母件厚（盲榫長 = 2/3 × M、通榫長 = M） */
  motherThickness: number;
}

export interface StandardTenonOutput {
  /** 凸出長 */
  length: number;
  /** 沿公件 width 方向的榫寬 */
  width: number;
  /** 沿公件 thickness 方向的榫厚 */
  thickness: number;
  /** 4 邊各退這個值（每邊 5mm） */
  shoulder: number;
  shoulderOn: Array<"top" | "bottom" | "left" | "right">;
}

export function standardTenon(i: StandardTenonInput): StandardTenonOutput {
  const shoulder = SHOULDER_MM;

  // 榫厚 = T/3，clamp 到 [MIN_TENON_THICKNESS, T - 2*肩]（不能比兩肩之間還薄、不能太細）
  const thicknessRaw = Math.round(i.childThickness / 3);
  const thicknessMax = Math.max(MIN_TENON_THICKNESS, i.childThickness - 2 * shoulder);
  const thickness = Math.max(MIN_TENON_THICKNESS, Math.min(thicknessMax, thicknessRaw));

  // 榫寬 = W - 2*肩，clamp 到 >= MIN_TENON_WIDTH
  const widthRaw = i.childWidth - 2 * shoulder;
  const width = Math.max(MIN_TENON_WIDTH, widthRaw);

  // 榫長
  const length =
    i.type === "through-tenon"
      ? i.motherThickness
      : Math.max(
          MIN_BLIND_TENON_LEN,
          Math.round((i.motherThickness * 2) / 3),
        );

  return {
    length,
    width,
    thickness,
    shoulder,
    shoulderOn: [...STANDARD_SHOULDER_ON],
  };
}
