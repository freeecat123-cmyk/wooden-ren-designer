/**
 * 全模板共用幾何 / 榫卯常數。
 *
 * 這份檔案的目的是把散落各家具模板的 magic number 集中到一處，
 * 讓「為什麼是 6mm」「為什麼是 2/3」這些設計決策有單一引用源。
 *
 * 規則：
 * - 命名要把單位寫在後面（_MM、_RATIO）
 * - 每個常數都有 一行 // 說明來源（傳統工法 / 設計慣例 / 經驗值）
 * - 不放跟特定家具強耦合的常數（例如 BENCH_DEFAULT_LENGTH）
 *
 * Knowledge cross-ref：完整知識在 wood-master/knowledge/joinery.md §2-§4、
 * books_workshop_manuals.md §1（Tage Frid 接合系統）、
 * books_chinese_classics.md §3（明式榫卯）。
 */

// ═══════════════════════════════════════════════════════════════════
// 榫卯比例（Fine Woodworking / Popular Woodworking 共識）
// ═══════════════════════════════════════════════════════════════════

/** 公榫頭厚度 ÷ 母件（柱腳）厚度 — 經典 1/3 規則，避免母件被掏太空斷裂。
 *  Source: wood-master/knowledge/joinery.md §2.1（榫頭厚度=母材1/3）+
 *  books_workshop_manuals.md §1.2（Tage Frid mortise-tenon proportions）。 */
export const TENON_THICKNESS_RATIO = 1 / 3;

/** 公榫頭尺寸 ÷ 母件斷面 — 通榫從上方插入的版本，留四面肩。
 *  Source: wood-master/knowledge/joinery.md §2.3（通榫加楔片強度最高）。 */
export const THROUGH_TENON_RATIO = 2 / 3;

/** 公榫頭長度 ÷ 母件厚度 — 盲榫深度（不貫穿）的標準比。
 *  Source: wood-master/knowledge/joinery.md §2.2（盲榫深度=母材2/3）。 */
export const BLIND_TENON_DEPTH_RATIO = 2 / 3;

/** 榫頭上下肩部最小寬度（每邊各內縮 mm）— 太薄母件會崩。
 *  Source: wood-master/knowledge/joinery.md §2.4（肩留 6mm 是經驗下限）。 */
export const MIN_SHOULDER_MM = 6;

/** 鳩尾肩部留量（每邊各內縮 mm，避免邊角崩）。
 *  Source: wood-master/knowledge/joinery.md §3（鳩尾製作 SOP）+
 *  books_chinese_classics.md §3.10（穿帶/鳩尾邊角處理）。 */
export const DOVETAIL_SHOULDER_MM = 2;

/** 鳩尾在厚度方向的內縮（每邊各 mm，公母咬合裕度） */
export const DOVETAIL_THICKNESS_INSET_MM = 1;

/** 企口榫舌頭厚度 ÷ 板厚（標準比例，18mm 板 → 6mm 舌）。
 *  Source: wood-master/knowledge/joinery.md §5（企口/T&G 工法）。 */
export const TONGUE_GROOVE_TONGUE_RATIO = 1 / 3;

/** 鳩尾角度：軟木 1:6（≈9.5°）、硬木 1:8（≈7.1°）。
 *  Source: wood-master/knowledge/joinery.md §3.1 + books_workshop_manuals.md §1.5。
 *  使用：軟木椴木/松木選 SOFT、橡木/胡桃/櫻桃選 HARD。 */
export const DOVETAIL_ANGLE_SOFT = 1 / 6;
export const DOVETAIL_ANGLE_HARD = 1 / 8;

// ═══════════════════════════════════════════════════════════════════
// 牙板 / 橫撐 預設位置（傳統家具測量）
// ═══════════════════════════════════════════════════════════════════

/** 牙板頂面距桌面下緣的預設下沉量（mm，藏邊條視覺乾淨） */
export const APRON_OFFSET_DEFAULT_MM = 20;

/** 下橫撐距地面的高度比（× 腿高），台日家具常見 1/4 高度 */
export const LOWER_STRETCHER_HEIGHT_RATIO = 0.25;

// ═══════════════════════════════════════════════════════════════════
// 層板 / 抽屜 / 框架預設量
// ═══════════════════════════════════════════════════════════════════

/** 層板邊緣與外框預設間隙（mm，方便取放、避免摩擦） */
export const SHELF_CLEARANCE_MM = 10;

/** 預設層板厚度（夾板系統用，板材常見規格） */
export const DEFAULT_SHELF_THICKNESS_MM = 18;

/** 抽屜底板槽距外牆的內縮量（mm，槽接位置） */
export const DRAWER_BOTTOM_GROOVE_INSET_MM = 4;

/** 抽屜兩側與櫃體側板的滑軌間隙（mm，每邊） */
export const DRAWER_SLIDE_GAP_MM = 12;

// ═══════════════════════════════════════════════════════════════════
// 椅子 / 椅背 比例
// ═══════════════════════════════════════════════════════════════════

/** 椅背 slat / ladder 相對椅寬的內縮量（每邊各 mm，含腳粗在內） */
export const CHAIR_BACK_INSET_MM = 40;

/** 椅腳對地最小傾斜角（度）— 後腳曲線的最小斜度，視覺穩定 */
export const CHAIR_BACK_LEG_TILT_DEG = 10;

// ═══════════════════════════════════════════════════════════════════
// 圓系列幾何
// ═══════════════════════════════════════════════════════════════════

/** 圓桌面板拼板膠合縫的最小寬度（mm，太小會被刨刀挑掉）*/
export const ROUND_TOP_PLANK_MIN_WIDTH_MM = 60;

/** 圓桌外斜腳（splayed）跟桌面圓周的內縮係數（避免腳超出桌面）*/
export const ROUND_LEG_RADIUS_INSET_RATIO = 0.85;
