/**
 * 家具風格預設參數。
 *
 * 用戶在 wrd UI 選一個風格 → 自動套對應的腳形、邊緣、工法、推薦木種。
 * 取代「使用者要自己懂每個風格選什麼」。
 *
 * Source: 完整風格知識在 wood-master/knowledge/books_furniture_styles.md
 * 各章 + books_chinese_classics.md（明式）+ books_chairmaking.md（Windsor）。
 *
 * 規則：
 * - 每個 preset 對應一個明確風格，不要混搭
 * - material 是建議優先序（首選 → 次選），不限定
 * - legShape / edgeStyle 用 wrd 既有的 enum 值，不發明新值
 * - 不適合所有家具類型的 preset 用 applicableTo 限定
 */

import type { MaterialId } from "@/lib/types";

export interface StylePreset {
  /** 風格 key，跨檔引用用 */
  id: string;
  /** 顯示名 */
  nameZh: string;
  nameEn: string;

  /** 一段話描述視覺特徵（給 UI 預覽 / tooltip 用） */
  visualHint: string;

  /** 建議用木種（首選 → 次選），對應 lib/materials/index.ts MaterialId */
  materials: MaterialId[];

  /** 預設腳形（對應 _helpers.ts RECT_LEG_SHAPE_CHOICES 的 value） */
  legShape: "box" | "tapered" | "strong-taper" | "splayed" | "splayed-length" | "splayed-width" | "round";

  /** 腳邊緣處理（mm）— 0=直角，3-5 細倒，8 起明顯八角 */
  legEdgeMm: number;
  /** 座板/桌面邊緣處理（mm） */
  topEdgeMm: number;
  /** 邊緣樣式 */
  edgeStyle: "chamfered" | "rounded";

  /** 預設榫接型（影響材料單 + 工序） */
  defaultJoinery: "blind-tenon" | "through-tenon" | "shouldered-tenon" | "stub-joint" | "dowel" | "screw";

  /** 椅腳 splay 角度（度，0 = 直腳） */
  splayAngleDeg?: number;

  /** 適用家具類型（不填 = 所有類型）。對應 FurnitureCategory */
  applicableTo?: string[];

  /** Source 引用：哪一份 wood-master 知識檔的哪一段 */
  source: string;
}

// ═══════════════════════════════════════════════════════════════════
// 風格預設集
// ═══════════════════════════════════════════════════════════════════

export const STYLE_PRESETS: Record<string, StylePreset> = {
  // ─── Shaker（夏克）：宗教簡約主義 ─────────────────────────────────
  shaker: {
    id: "shaker",
    nameZh: "Shaker（夏克）",
    nameEn: "Shaker",
    visualHint: "極簡、無裝飾、直線、櫻桃/楓木淺色、through-tenon 加楔片",
    materials: ["maple", "ash", "walnut"], // 美國 Shaker 用 cherry / maple / pine
    legShape: "tapered",
    legEdgeMm: 1, // 微倒邊不壓腿
    topEdgeMm: 3,
    edgeStyle: "chamfered",
    defaultJoinery: "through-tenon",
    source: "books_furniture_styles.md §2",
  },

  // ─── Mid-Century Modern（北歐 / 丹麥）─────────────────────────────
  midCentury: {
    id: "midCentury",
    nameZh: "Mid-Century（北歐）",
    nameEn: "Mid-Century Modern",
    visualHint: "外斜腳、柚木/胡桃木、Y 椅 / shell chair 風、扶手有機曲線",
    materials: ["walnut", "teak", "white-oak"],
    legShape: "splayed",
    legEdgeMm: 5, // 細倒邊
    topEdgeMm: 8, // 圓潤蛋形邊
    edgeStyle: "rounded",
    defaultJoinery: "blind-tenon",
    splayAngleDeg: 5,
    source: "books_furniture_styles.md §5（Wegner / Eames）",
  },

  // ─── Mission / Arts & Crafts（Stickley）───────────────────────────
  mission: {
    id: "mission",
    nameZh: "Mission（美式工藝）",
    nameEn: "Mission / Arts & Crafts",
    visualHint: "白橡徑切（quartersawn）+ through-tenon 加楔、粗腳直線、機械感重",
    materials: ["white-oak"],
    legShape: "box",
    legEdgeMm: 0, // 直角，工業氣
    topEdgeMm: 3,
    edgeStyle: "chamfered",
    defaultJoinery: "through-tenon",
    source: "books_furniture_styles.md §4（Stickley + Greene & Greene）",
  },

  // ─── 明式（中國傳統）─────────────────────────────────────────────
  ming: {
    id: "ming",
    nameZh: "明式（中國傳統）",
    nameEn: "Ming Style",
    visualHint: "圓潤線腳、抱肩榫 / 夾頭榫、紅木深色、不上顯眼五金",
    materials: ["walnut", "taiwan-cypress"], // 替代黃花梨/紫檀，台灣本土用紅檜/相思
    legShape: "round",
    legEdgeMm: 3,
    topEdgeMm: 5,
    edgeStyle: "rounded",
    defaultJoinery: "shouldered-tenon",
    source: "books_chinese_classics.md §1-§4",
  },

  // ─── Windsor（西方傳統椅匠）──────────────────────────────────────
  windsor: {
    id: "windsor",
    nameZh: "Windsor（傳統椅匠）",
    nameEn: "Windsor",
    visualHint: "外斜圓腳（前 7°/後 13°）+ 蒸彎弓背 + 直料 spindle 椅背 + milk paint",
    materials: ["white-oak", "ash", "maple"], // 座板=白松、腿=橡/白蠟、bow=白蠟
    legShape: "splayed",
    legEdgeMm: 0, // 圓料無邊
    topEdgeMm: 12, // 座板 saddle 挖型，邊緣大圓
    edgeStyle: "rounded",
    defaultJoinery: "blind-tenon",
    splayAngleDeg: 10,
    applicableTo: ["dining-chair", "round-stool", "bench"],
    source: "books_chairmaking.md §3-§4（Galbert / Buchanan）",
  },

  // ─── 工業風 / Loft ───────────────────────────────────────────────
  industrial: {
    id: "industrial",
    nameZh: "工業風（Loft）",
    nameEn: "Industrial",
    visualHint: "粗木板桌面 + 黑鐵腳（木工只負責桌面）、邊緣方正",
    materials: ["pine", "douglas-fir", "white-oak"],
    legShape: "box",
    legEdgeMm: 0,
    topEdgeMm: 0, // 直角強調粗獷感
    edgeStyle: "chamfered",
    defaultJoinery: "screw", // 鐵腳螺絲鎖
    source: "books_furniture_styles.md §9（quick-ID 對照表）",
  },

  // ─── 日式禪風（和家具）─────────────────────────────────────────
  japanese: {
    id: "japanese",
    nameZh: "日式禪風（和家具）",
    nameEn: "Japanese / Wa-furniture",
    visualHint: "檜木 / 杉木淺色、低矮、線腳極簡、面板大但不裝飾",
    materials: ["taiwan-cypress", "douglas-fir", "ash"], // 檜木 / 杉木對應
    legShape: "box",
    legEdgeMm: 1, // 防扎手即可
    topEdgeMm: 3,
    edgeStyle: "chamfered",
    defaultJoinery: "blind-tenon", // 隠し （藏榫）
    source: "books_japanese_techniques.md §6（宮大工仕口）",
  },

  // ─── 古典歐式（Chippendale / 英式 18 世紀）─────────────────────
  chippendale: {
    id: "chippendale",
    nameZh: "古典歐式（Chippendale）",
    nameEn: "Chippendale / 18th C. English",
    visualHint: "ball-and-claw foot、cabriole 曲腿、深色桃花心木 / 胡桃、線腳 ovolo + cyma",
    materials: ["walnut", "white-oak"],
    legShape: "tapered", // 簡化版；真要 cabriole 需另刻
    legEdgeMm: 8, // 明顯倒邊塑造線腳
    topEdgeMm: 12,
    edgeStyle: "rounded",
    defaultJoinery: "shouldered-tenon",
    source: "books_furniture_styles.md §3",
  },
};

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/** 取得風格選項給 UI select 用 */
export function getStyleChoices(applicableTo?: string) {
  return Object.values(STYLE_PRESETS)
    .filter((p) => !p.applicableTo || !applicableTo || p.applicableTo.includes(applicableTo))
    .map((p) => ({ value: p.id, label: p.nameZh }));
}

/** 套用風格 preset：給定風格 id，回傳一組可塞 URL params 的 key-value */
export function applyStylePreset(styleId: string): Record<string, string | number> | null {
  const preset = STYLE_PRESETS[styleId];
  if (!preset) return null;
  const params: Record<string, string | number> = {
    legShape: preset.legShape,
    legEdge: preset.legEdgeMm,
    legEdgeStyle: preset.edgeStyle,
    seatEdge: preset.topEdgeMm, // 椅/凳叫 seatEdge
    seatEdgeStyle: preset.edgeStyle,
    material: preset.materials[0], // 首選材
  };
  if (preset.splayAngleDeg !== undefined) {
    params.splayAngle = preset.splayAngleDeg;
  }
  return params;
}
