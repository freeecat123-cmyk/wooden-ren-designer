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

  /** 腳粗細（mm，正方腳邊長）— 風格的關鍵視覺驅動。
   *  細：30-35（Shaker / Mid-Century 簡約）
   *  中：40-45（一般）
   *  粗：50-60（Mission / Industrial / Chippendale 厚實感） */
  legSizeMm: number;

  /** 腳邊緣處理（mm）— 0=直角，3-5 細倒，8 起明顯八角 */
  legEdgeMm: number;
  /** 座板/桌面邊緣處理（mm） */
  topEdgeMm: number;
  /** 邊緣樣式 */
  edgeStyle: "chamfered" | "rounded";

  /** 牙條/橫撐高（mm）— 影響視覺比例。細：50-60，粗：80+ */
  apronWidthMm?: number;

  /** 椅背樣式（dining-chair 用）— 對應 backStyle 選項：
   *  slats（直條式，Shaker / 北歐）
   *  ladder（橫檔式，Shaker rocking / 鄉村）
   *  splat（中板式，Chippendale / 古典英式）
   *  windsor（圓棒，Windsor / 美式傳統） */
  backStyle?: "slats" | "ladder" | "splat" | "windsor";

  /** 座面挖型（影響椅 / 凳的座板）：
   *  flat / saddle（馬鞍）/ scooped（單凹）/ waterfall（瀑布前緣）/ dished */
  seatProfile?: "flat" | "saddle" | "scooped" | "waterfall" | "dished";

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
    visualHint: "極簡、無裝飾、細料漸縮腳、櫻桃/楓木淺色、through-tenon 加楔片、椅背用 ladder（橫檔）",
    materials: ["maple", "ash", "walnut"],
    legShape: "tapered",
    legSizeMm: 30, // 細腳——Shaker 招牌
    legEdgeMm: 1,
    topEdgeMm: 3,
    edgeStyle: "chamfered",
    apronWidthMm: 50, // 細牙條
    backStyle: "ladder", // Shaker rocking chair 招牌
    seatProfile: "flat",
    defaultJoinery: "through-tenon",
    source: "books_furniture_styles.md §2",
  },

  // ─── Mid-Century Modern（北歐 / 丹麥）─────────────────────────────
  midCentury: {
    id: "midCentury",
    nameZh: "Mid-Century（北歐）",
    nameEn: "Mid-Century Modern",
    visualHint: "外斜腳 5°、細料、柚木/胡桃木、Y 椅風直條椅背、座面微凹有機曲線",
    materials: ["walnut", "teak", "white-oak"],
    legShape: "splayed",
    legSizeMm: 32, // 略細
    legEdgeMm: 5,
    topEdgeMm: 8,
    edgeStyle: "rounded",
    apronWidthMm: 55,
    backStyle: "slats", // 直條，Wegner 風
    seatProfile: "scooped", // Wegner shell chair 微凹
    defaultJoinery: "blind-tenon",
    splayAngleDeg: 5,
    source: "books_furniture_styles.md §5（Wegner / Eames）",
  },

  // ─── Mission / Arts & Crafts（Stickley）───────────────────────────
  mission: {
    id: "mission",
    nameZh: "Mission（美式工藝）",
    nameEn: "Mission / Arts & Crafts",
    visualHint: "白橡徑切 + through-tenon 加楔、粗腳 50mm 直線方料、寬牙條 80mm、椅背直條密集",
    materials: ["white-oak"],
    legShape: "box",
    legSizeMm: 50, // 粗腳——Stickley 招牌
    legEdgeMm: 0,
    topEdgeMm: 3,
    edgeStyle: "chamfered",
    apronWidthMm: 80, // 寬牙條
    backStyle: "slats", // Stickley 直條密集
    seatProfile: "flat",
    defaultJoinery: "through-tenon",
    source: "books_furniture_styles.md §4（Stickley + Greene & Greene）",
  },

  // ─── 明式（中國傳統）─────────────────────────────────────────────
  ming: {
    id: "ming",
    nameZh: "明式（中國傳統）",
    nameEn: "Ming Style",
    visualHint: "圓料腳、抱肩榫、深色紅木、中板式椅背（圈椅靠背板）、座高偏高",
    materials: ["walnut", "taiwan-cypress"],
    legShape: "round",
    legSizeMm: 38, // 圓料中等粗
    legEdgeMm: 3,
    topEdgeMm: 5,
    edgeStyle: "rounded",
    apronWidthMm: 65,
    backStyle: "splat", // 中板式（明式圈椅靠背板）
    seatProfile: "flat",
    defaultJoinery: "shouldered-tenon",
    source: "books_chinese_classics.md §1-§4",
  },

  // ─── Windsor（西方傳統椅匠）──────────────────────────────────────
  windsor: {
    id: "windsor",
    nameZh: "Windsor（傳統椅匠）",
    nameEn: "Windsor",
    visualHint: "圓料外斜腳 10°、Windsor spindle 圓棒椅背、座板 saddle 挖型大圓邊、milk paint 著色",
    materials: ["white-oak", "ash", "maple"],
    legShape: "splayed",
    legSizeMm: 28, // 圓料偏細（spindle 細料感）
    legEdgeMm: 0,
    topEdgeMm: 12, // 座板大圓邊（saddle）
    edgeStyle: "rounded",
    apronWidthMm: 0, // Windsor 沒牙條（直接腳上座板）
    backStyle: "windsor", // 圓棒 spindle
    seatProfile: "saddle", // Windsor 招牌座面
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
    visualHint: "厚實粗料 60mm、松木/道格拉斯杉、直角無倒邊、無牙條（鐵腳模擬）、極簡椅背",
    materials: ["pine", "douglas-fir", "white-oak"],
    legShape: "box",
    legSizeMm: 60, // 粗腳
    legEdgeMm: 0,
    topEdgeMm: 0,
    edgeStyle: "chamfered",
    apronWidthMm: 0, // 沒牙條
    backStyle: "ladder", // 工業簡單橫檔
    seatProfile: "flat",
    defaultJoinery: "screw",
    source: "books_furniture_styles.md §9（quick-ID 對照表）",
  },

  // ─── 日式禪風（和家具）─────────────────────────────────────────
  japanese: {
    id: "japanese",
    nameZh: "日式禪風（和家具）",
    nameEn: "Japanese / Wa-furniture",
    visualHint: "檜木淺色、細料 35mm 方腳、極簡無椅背或低矮椅背、無顯著倒邊、藏榫",
    materials: ["taiwan-cypress", "douglas-fir", "ash"],
    legShape: "box",
    legSizeMm: 35,
    legEdgeMm: 1,
    topEdgeMm: 3,
    edgeStyle: "chamfered",
    apronWidthMm: 45, // 細牙條（和家具特徵）
    backStyle: "slats", // 簡單直條
    seatProfile: "flat",
    defaultJoinery: "blind-tenon",
    source: "books_japanese_techniques.md §6（宮大工仕口）",
  },

  // ─── 古典歐式（Chippendale / 英式 18 世紀）─────────────────────
  chippendale: {
    id: "chippendale",
    nameZh: "古典歐式（Chippendale）",
    nameEn: "Chippendale / 18th C. English",
    visualHint: "粗料 45mm 漸縮腳、深色胡桃、寬牙條 90mm、中板式椅背（splat）、線腳大圓邊",
    materials: ["walnut", "white-oak"],
    legShape: "tapered",
    legSizeMm: 45,
    legEdgeMm: 8,
    topEdgeMm: 12,
    edgeStyle: "rounded",
    apronWidthMm: 90, // 寬牙條塑古典氣
    backStyle: "splat", // 中板式（Chippendale 招牌）
    seatProfile: "flat",
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

/** 套用風格 preset：給定風格 id，回傳一組可塞 URL params 的 key-value。
 *
 *  StylePresetButtons 會把這些 key 跟當前模板的 optionSchema 取交集——
 *  也就是「模板沒這個欄位的就跳過」，避免汙染 URL。所以這裡儘量把所有
 *  風格相關欄位都列出來，讓不同模板各取所需。 */
export function applyStylePreset(styleId: string): Record<string, string | number> | null {
  const preset = STYLE_PRESETS[styleId];
  if (!preset) return null;
  const params: Record<string, string | number> = {
    // 腳形 / 粗細 / 邊緣（影響 stool / chair / table）
    legShape: preset.legShape,
    legSize: preset.legSizeMm,
    legEdge: preset.legEdgeMm,
    legEdgeStyle: preset.edgeStyle,
    // 座板 / 桌面邊緣
    seatEdge: preset.topEdgeMm,
    seatEdgeStyle: preset.edgeStyle,
    topEdge: preset.topEdgeMm, // 桌類用 topEdge（如 dining-table）
    topEdgeStyle: preset.edgeStyle,
    // 主材
    material: preset.materials[0],
    // 邊緣樣式適用所有
    stretcherEdgeStyle: preset.edgeStyle,
  };
  if (preset.apronWidthMm !== undefined) {
    params.apronWidth = preset.apronWidthMm;
  }
  if (preset.backStyle !== undefined) {
    params.backStyle = preset.backStyle;
  }
  if (preset.seatProfile !== undefined) {
    params.seatProfile = preset.seatProfile;
  }
  if (preset.splayAngleDeg !== undefined) {
    params.splayAngle = preset.splayAngleDeg;
  }
  return params;
}
