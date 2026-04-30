/**
 * 椅子幾何 / 人體工學常數。
 *
 * 來源：彙整自 wood-master/knowledge/ 內多份書系的椅匠經驗：
 * - books_workshop_manuals.md §4.1（FWW Best of Tables and Chairs：5° 後傾、
 *   105° 椅背、扶手 200mm）
 * - books_chairmaking.md §3（Galbert / Curtis Buchanan Windsor sight line）
 * - books_chinese_classics.md §2.1（明式椅座高 50cm 的禮儀邏輯）
 * - books_furniture_styles.md §5（Wegner Y 椅幾何）
 * - hand_tools.md §6.2.1（工作台 vs 椅高的肘部 100mm 法則）
 *
 * 規則：
 * - 數字單位寫進 key（_MM、_DEG、_RATIO）
 * - 每塊都有 Source 行，bot 答題時可以 grep 對到 wood-master 段
 * - 用 `as const` 收口，不允許運行時修改
 */

// ═══════════════════════════════════════════════════════════════════
// 餐椅 / 一般椅 (Dining chair, regular chair)
// Source: books_workshop_manuals.md §4.1（FWW Side-Chair Geometry）
// ═══════════════════════════════════════════════════════════════════

export const DINING_CHAIR = {
  /** 座面距地高（mm）— FWW 共識 440-460，亞洲身高建議 440-450 */
  seatHeightMm: 450,
  seatHeightRangeMm: [430, 470] as const,

  /** 座面後傾角（度）— 5° 是標準，太多會滑出，太少坐不久 */
  seatBackTiltDeg: 5,
  seatBackTiltRangeDeg: [3, 8] as const,

  /** 椅背相對垂直的後傾角（度）— 105° 是 FWW/Galbert 共識
   *  100° 太挺、110° 太懶散 */
  backrestAngleDeg: 105,
  backrestAngleRangeDeg: [100, 108] as const,

  /** 扶手高（從座面起算 mm）— 西方 200mm、明式高位扶手 220-240mm
   *  Source: books_workshop_manuals.md §4.1 + books_chinese_classics.md §2.1 */
  armrestAboveSeatMm: 200,

  /** 座深（mm）— 350-450 範圍，亞洲身高建議 380-420 */
  seatDepthMm: 400,
  seatDepthRangeMm: [350, 450] as const,

  /** 座寬（mm）— 一般 400-450，胖椅至 500 */
  seatWidthMm: 420,
  seatWidthRangeMm: [380, 500] as const,
} as const;

// ═══════════════════════════════════════════════════════════════════
// 凳子 (Stool — square / round)
// Source: 木匠學院教學經驗 + books_workshop_manuals.md §4
// ═══════════════════════════════════════════════════════════════════

export const STOOL = {
  /** 矮凳（沙發前的腳凳）座高 mm */
  ottomanHeightMm: 350,
  /** 一般凳（餐桌配套）座高 mm — 同餐椅 */
  regularHeightMm: 450,
  /** 工作台前坐高凳座高 mm */
  workbenchHeightMm: 600,
} as const;

// ═══════════════════════════════════════════════════════════════════
// 吧檯椅 (Bar stool / counter stool)
// Source: books_chairmaking.md §3 + 業界慣例
// ═══════════════════════════════════════════════════════════════════

export const BAR_STOOL = {
  /** 對應吧檯桌面 900mm 的 counter stool 座高 */
  counterStoolSeatHeightMm: 650,
  /** 對應吧檯桌面 1050mm 的標準 bar stool 座高 */
  barStoolSeatHeightMm: 750,
  /** 對應吧檯桌面 1100-1150mm 的 tall stool 座高 */
  tallBarStoolSeatHeightMm: 800,

  /** 腳踏離地高 mm — 「座面下 400-450」是業界經驗
   *  座 750 → 腳踏 300-350；座 800 → 腳踏 350-400 */
  footrestBelowSeatMm: 400,
  footrestBelowSeatRangeMm: [350, 450] as const,

  /** 腳踏離座面距離 — 計算工具：footrestY = seatY - footrestBelowSeatMm */
} as const;

// ═══════════════════════════════════════════════════════════════════
// 外斜腳 splay 角度（Galbert sight line / resultant angle）
// Source: books_chairmaking.md §3.3（Galbert sight line + resultant angle 公式）
// 椅子腳外斜角度從「垂直起算」算起，不是從「水平」
// ═══════════════════════════════════════════════════════════════════

export const SPLAY_ANGLE = {
  /** 一般凳/方凳預設外斜角度（度） — 5° 適度外斜，視覺穩定不誇張 */
  stoolDefaultDeg: 5,
  /** 凳上限（度）— 15° 已是極限，再大底盤過大 */
  stoolMaxDeg: 15,
  /** 吧檯椅上限（度）— 12° 已偏激進，吧檯椅高重心高，不能太斜 */
  barStoolMaxDeg: 12,
  /** Windsor 椅前腳 splay（度）— 7° 是傳統 */
  windsorFrontDeg: 7,
  /** Windsor 椅後腳 splay（度）— 12-15° 比前腳大，視覺穩 */
  windsorBackDeg: 13,
} as const;

// ═══════════════════════════════════════════════════════════════════
// 桌子 / 工作台 高度（給跟椅子搭配用）
// Source: hand_tools.md §6.2.1（工作台手肘下 100mm 法則）
// ═══════════════════════════════════════════════════════════════════

export const TABLE = {
  /** 餐桌標準高（mm）— 760 是國際標準，亞洲 720-750 也常見 */
  diningHeightMm: 750,

  /** 書桌 / 辦公桌高（mm）— 比餐桌略低，腿空間夠 */
  deskHeightMm: 730,

  /** 茶几高（mm）— 一般 400-450，搭沙發座高 400 */
  teaTableHeightMm: 420,

  /** 邊几高（mm）— 與沙發扶手齊平 */
  sideTableHeightMm: 600,

  /** 吧檯桌面高（mm）— 對應 bar stool */
  barCounterMm: 900,
  barTableMm: 1050,

  /** 工作台高度公式 — 站姿手肘下 100mm
   *  Source: books_english_classics.md §4.1（Schwarz pinky knuckle 公式）+
   *  hand_tools.md §6.2.1。
   *  170cm → 800mm 工作台；175cm → 825mm；180cm → 850mm */
  workbenchByElbowFn: (heightMm: number) => Math.round(heightMm * 0.49),
} as const;

// ═══════════════════════════════════════════════════════════════════
// 椅子 vs 桌子搭配（人體工學）
// Source: books_workshop_manuals.md §4.1 + books_chairmaking.md §3
// ═══════════════════════════════════════════════════════════════════

/** 椅座到桌面下緣的合理距離 mm — 250-300，太小腿擠，太大手肘抬。 */
export const SEAT_TO_TABLE_GAP_MM = 280;

/** 給定桌高，回推合理椅高（mm） */
export function recommendedSeatHeightFromTable(tableHeightMm: number): number {
  return tableHeightMm - SEAT_TO_TABLE_GAP_MM;
}

/** 給定吧檯高，回推合理 stool 高（mm） */
export function recommendedStoolHeightFromCounter(counterMm: number): number {
  // counter 900 → stool 650；bar 1050 → stool 750；同樣 250-300 gap
  return counterMm - 250;
}
