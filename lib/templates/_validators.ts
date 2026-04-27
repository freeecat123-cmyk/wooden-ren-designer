import type { FurnitureDesign } from "@/lib/types";

/**
 * 檢查圓腳家具的榫接合規性。
 *
 * 規則：圓腳（shape ∈ round / round-tapered / shaker / lathe-turned）的母件不能有
 * through-tenon（貫穿榫）。原因：圓腳側面是曲面，鑿穿榫眼時公榫
 * 會在曲面上斜出，加工難、結構差、外觀醜。
 *
 * 回傳 warning 字串陣列，可 push 進 design.warnings 給 UI 顯示。
 */
export function validateRoundLegJoinery(design: FurnitureDesign): string[] {
  const warnings: string[] = [];
  for (const part of design.parts) {
    const k = part.shape?.kind;
    const isRoundLeg = k === "round" || k === "round-tapered" || k === "shaker" || k === "lathe-turned";
    if (!isRoundLeg) continue;
    for (const m of part.mortises) {
      if (m.through) {
        warnings.push(
          `「${part.nameZh}」是圓腳但 mortise 設為 through（貫穿榫）` +
            `——圓腳側面是曲面，鑿穿榫眼會在曲面上斜出，請改用 blind / shouldered / stub-joint。`,
        );
        break; // 同一隻腳只報一次
      }
    }
  }
  return warnings;
}

/**
 * 通用幾何合理性檢查。
 *
 * 各模板可在 return 前呼叫並傳入自己關心的 rules，回傳 warning 陣列。
 * 不會阻擋設計產出，只在 UI 上提示。
 *
 * 用法：
 *   const w = validateBasicGeometry(design, {
 *     minOverallHeight: 100,
 *     wallThickness: 12,
 *     outerSpan: { length: outerL, width: outerW },
 *   });
 *   design.warnings = [...(design.warnings ?? []), ...w];
 */
export interface BasicGeometryRules {
  /** 整體高度最低值（mm）—— 高度低於這個會警告 */
  minOverallHeight?: number;
  /** 整體長度最低值（mm） */
  minOverallLength?: number;
  /** 整體寬度最低值（mm） */
  minOverallWidth?: number;
  /** 壁厚 / 板厚（櫃箱類用）—— 會跟 outerSpan 比對 */
  wallThickness?: number;
  /** 外尺寸（櫃箱用）— 用來檢查 wallThickness × 2 < outerSpan */
  outerSpan?: { length: number; width: number };
  /** 至少要有這幾個零件（id 子字串比對）*/
  requireParts?: string[];
  /** 期待 parts 數量在這範圍 */
  partCountRange?: { min?: number; max?: number };
}

export function validateBasicGeometry(
  design: FurnitureDesign,
  rules: BasicGeometryRules = {},
): string[] {
  const warnings: string[] = [];
  const { overall } = design;

  if (rules.minOverallHeight !== undefined && overall.thickness < rules.minOverallHeight) {
    warnings.push(
      `整體高度 ${overall.thickness}mm 低於合理下限 ${rules.minOverallHeight}mm——` +
        `可能無法正常使用，請增加高度。`,
    );
  }
  if (rules.minOverallLength !== undefined && overall.length < rules.minOverallLength) {
    warnings.push(
      `整體長度 ${overall.length}mm 低於合理下限 ${rules.minOverallLength}mm。`,
    );
  }
  if (rules.minOverallWidth !== undefined && overall.width < rules.minOverallWidth) {
    warnings.push(
      `整體寬度 ${overall.width}mm 低於合理下限 ${rules.minOverallWidth}mm。`,
    );
  }

  if (rules.wallThickness !== undefined && rules.outerSpan) {
    const { wallThickness, outerSpan } = rules;
    if (wallThickness * 2 >= outerSpan.length) {
      warnings.push(
        `壁厚 ${wallThickness}mm × 2 = ${wallThickness * 2}mm 已超過或等於外長 ${outerSpan.length}mm，內部空間 ≤ 0。`,
      );
    }
    if (wallThickness * 2 >= outerSpan.width) {
      warnings.push(
        `壁厚 ${wallThickness}mm × 2 = ${wallThickness * 2}mm 已超過或等於外寬 ${outerSpan.width}mm，內部空間 ≤ 0。`,
      );
    }
  }

  if (rules.requireParts) {
    for (const idFragment of rules.requireParts) {
      if (!design.parts.some((p) => p.id.includes(idFragment))) {
        warnings.push(`預期應有零件 "${idFragment}" 但 parts 內沒看到。`);
      }
    }
  }

  if (rules.partCountRange) {
    const { min, max } = rules.partCountRange;
    if (min !== undefined && design.parts.length < min) {
      warnings.push(`零件數 ${design.parts.length} 少於預期下限 ${min}。`);
    }
    if (max !== undefined && design.parts.length > max) {
      warnings.push(`零件數 ${design.parts.length} 多於預期上限 ${max}。`);
    }
  }

  return warnings;
}

/**
 * 把 warnings 合併到 design.warnings（避免到處重複寫 spread 語法）。
 */
export function appendWarnings(design: FurnitureDesign, ...lists: string[][]): void {
  const all = lists.flat().filter(Boolean);
  if (all.length === 0) return;
  design.warnings = [...(design.warnings ?? []), ...all];
}

/**
 * 凳 / 椅類結構穩定性檢查。
 *
 * 規則（基於常見木工規範）：
 *   - 腳粗 < 高度/15 → 太細，坐久會晃
 *   - 座板厚 < 跨距/40 → 中央會凹陷
 *   - 下橫撐離地 < 80mm → 容易踢腳、清地面難
 *   - 高度 > 500mm 但沒下橫撐 → 強烈建議加（晃動風險高）
 *
 * 模板尾端呼叫，回傳警告陣列加進 design.warnings。
 */
export interface StoolStructureRules {
  legSize: number;
  height: number;
  seatThickness?: number;
  /** 座板對角跨距（mm）。沒帶就跳過跨距檢查 */
  seatSpan?: number;
  /** 下橫撐離地高（mm）。沒下橫撐就傳 undefined */
  lowerStretcherHeight?: number;
  /** 是否有任何下橫撐結構（H-frame / X-cross / 任何加強橫撐） */
  hasLowerStretcher?: boolean;
}

export function validateStoolStructure(rules: StoolStructureRules): string[] {
  const warnings: string[] = [];
  const { legSize, height } = rules;

  // 腳粗 vs 高度（一般木工建議 1:12 ~ 1:15）
  const minLegSize = Math.ceil(height / 15);
  if (legSize < minLegSize) {
    warnings.push(
      `腳粗 ${legSize}mm 對 ${height}mm 高的凳子可能太細（建議至少 ${minLegSize}mm，` +
        `比例 1:15）——坐久會晃，建議加粗或加下橫撐結構補強。`,
    );
  }

  // 座板厚 vs 跨距（每 40mm 跨距至少 1mm 厚）
  if (rules.seatThickness !== undefined && rules.seatSpan !== undefined) {
    const minThick = Math.ceil(rules.seatSpan / 40);
    if (rules.seatThickness < minThick) {
      warnings.push(
        `座板厚 ${rules.seatThickness}mm 對 ${rules.seatSpan}mm 跨距偏薄（建議至少 ${minThick}mm）——` +
          `承重時中央會明顯下凹。建議加厚或加中央橫木支撐。`,
      );
    }
  }

  // 下橫撐離地太低
  if (
    rules.lowerStretcherHeight !== undefined &&
    rules.lowerStretcherHeight > 0 &&
    rules.lowerStretcherHeight < 80
  ) {
    warnings.push(
      `下橫撐離地僅 ${rules.lowerStretcherHeight}mm（< 80mm），坐下時容易踢到、清掃地面也麻煩。` +
        `建議拉高到 100-150mm。`,
    );
  }

  // 高凳沒下橫撐
  if (height > 500 && rules.hasLowerStretcher === false) {
    warnings.push(
      `凳高 ${height}mm 超過 500mm 但沒加下橫撐——高凳結構不穩定，建議勾選「加下橫撐」。`,
    );
  }

  return warnings;
}

/**
 * 一行套用標準幾何檢查的 wrapper。
 * 模板尾端 return 前呼叫即可，避免每個模板都寫一遍 spread / 條件判斷。
 *
 *   applyStandardChecks(design, { minLength: 250, minWidth: 250, minHeight: 350 });
 *   return design;
 */
export function applyStandardChecks(
  design: FurnitureDesign,
  mins: { minLength?: number; minWidth?: number; minHeight?: number },
): void {
  appendWarnings(
    design,
    validateBasicGeometry(design, {
      minOverallLength: mins.minLength,
      minOverallWidth: mins.minWidth,
      minOverallHeight: mins.minHeight,
    }),
  );
}
