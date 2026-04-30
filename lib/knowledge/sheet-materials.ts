/**
 * 板材規格（標稱厚度 vs 實厚 + 計價）。
 *
 * Source: wood-master/knowledge/wood_species.md §3-§4（板材章節）+
 * books_taiwan_local.md §8（裝修慣例 / 台尺換算）。
 *
 * 重點知識：
 * - 「6 分板」標稱 18mm，實厚通常 17.5mm（夾板 / 木芯板）
 * - 板材按 2400×1200mm 「片」計價，不按面積；裁了還是算一片
 * - 1 分 = 3mm，1 寸 = 30mm，1 台尺 = 303mm（不是英呎 305mm）
 */

// ═══════════════════════════════════════════════════════════════════
// 標稱厚度 → 實厚對照
// Source: wood_species.md §4.4（板材厚度 + 標稱 vs 實厚）
// ═══════════════════════════════════════════════════════════════════

/** 業界常見「分」厚度對照表
 *  舌頭：標稱（業界叫法 / mm）/ 實厚（夾板 / 木芯板量過實際 mm）/ 用途 */
export const SHEET_THICKNESS = [
  { fen: 1, nominalMm: 3,  actualMm: 2.7,  use: "薄面 / 抽屜底（薄夾板）" },
  { fen: 2, nominalMm: 6,  actualMm: 5.5,  use: "抽屜底 / 背板 / 鳩尾盒底" },
  { fen: 3, nominalMm: 9,  actualMm: 8.5,  use: "背板 / 抽屜底（一般櫃）" },
  { fen: 4, nominalMm: 12, actualMm: 11.5, use: "抽屜側 / 隔板（小櫃）" },
  { fen: 5, nominalMm: 15, actualMm: 14.5, use: "層板 / 抽屜側（中櫃）" },
  { fen: 6, nominalMm: 18, actualMm: 17.5, use: "櫃身板 / 桌面（最常用）" },
  { fen: 8, nominalMm: 24, actualMm: 23.5, use: "桌面 / 厚層板（重物）" },
  { fen: 10, nominalMm: 30, actualMm: 29.0, use: "厚實桌面 / 工作台板" },
] as const;

/** 給「幾分」回傳標稱 mm */
export function fenToMm(fen: number): number {
  return fen * 3;
}

/** 給標稱 mm，回傳實厚（如有對照）*/
export function nominalToActualMm(nominalMm: number): number {
  const found = SHEET_THICKNESS.find((s) => s.nominalMm === nominalMm);
  return found?.actualMm ?? nominalMm;
}

// ═══════════════════════════════════════════════════════════════════
// 板材規格尺寸 + 計價單位
// Source: books_taiwan_local.md §8.2（按片計價）
// ═══════════════════════════════════════════════════════════════════

/** 標準板材規格（mm × mm）— 台灣業界 99% 用 2400×1200，不是國際 4×8 呎 */
export const SHEET_SIZE = {
  /** 台灣 / 大陸通用，2400 × 1200 mm */
  standardLengthMm: 2400,
  standardWidthMm: 1200,

  /** 美規 4×8 呎 = 1219 × 2438 mm（接近但不等於台規）*/
  imperialLengthMm: 2438,
  imperialWidthMm: 1219,
} as const;

/** 給家具用料總面積，回傳「需幾片 2400×1200 板」(無條件進位）。
 *  簡化：忽略 nesting 效率；實際裁切會多 5-15% loss。 */
export function sheetsNeeded(totalAreaMm2: number, sheetLossRate: number = 0.10): number {
  const sheetArea = SHEET_SIZE.standardLengthMm * SHEET_SIZE.standardWidthMm;
  return Math.ceil((totalAreaMm2 * (1 + sheetLossRate)) / sheetArea);
}

// ═══════════════════════════════════════════════════════════════════
// 台灣傳統單位換算（業界口頭值）
// Source: books_taiwan_local.md §8.1, §8.3, §8.4
// ═══════════════════════════════════════════════════════════════════

export const TW_UNITS = {
  /** 1 分 = 3mm（板材厚度用）*/
  fenToMm: 3,
  /** 1 寸 = 30mm */
  inchToMm: 30,
  /** 1 台尺 = 303mm（家具尺寸 / 床架 / 桌椅長寬用） */
  taiChiToMm: 303,
  /** 1 台寸 = 30.3mm（精細，差別小幾乎不在乎） */
  taiInchToMm: 30.3,
  /** 1 才 = 1 寸 × 1 寸 × 1 台尺 = 30 × 30 × 303 mm³ ≈ 272700 mm³
   *  木材計價單位：(長尺 × 寬寸 × 厚寸) = 才數 */
  caiVolumeMm3: 30 * 30 * 303,
  /** 1 坪 = 3.3058 m² ≈ 3.3 平方公尺（裝修空間用）*/
  pingToM2: 3.3058,
} as const;

/** 木材才數計算：長(尺) × 寬(寸) × 厚(寸) */
export function woodCai(lengthTaiChi: number, widthInch: number, thicknessInch: number): number {
  return lengthTaiChi * widthInch * thicknessInch;
}

/** 給 mm 長度，回傳台尺數（小數，業界口頭通常四捨五入到 0.5）*/
export function mmToTaiChi(mm: number): number {
  return Math.round((mm / TW_UNITS.taiChiToMm) * 2) / 2;
}

// ═══════════════════════════════════════════════════════════════════
// 床架傳統規格（台尺單位）
// Source: books_taiwan_local.md §8.3（業界尺寸表）
// ═══════════════════════════════════════════════════════════════════

/** 業界常用的床架/家具尺寸（台尺 → mm）*/
export const TW_BED_SIZES = {
  /** 單人床 3.5 尺 = 1060mm */
  single: 1060,
  /** 雙人床 5 尺 = 1515mm */
  double: 1515,
  /** 雙人加大 6 尺 = 1818mm */
  queen: 1818,
  /** 雙人特大 6.5 尺 = 1970mm */
  king: 1970,
  /** 神桌 7 尺 2 = 2180mm（傳統廟宇 / 神桌）*/
  shrine7_2: 2180,
} as const;
