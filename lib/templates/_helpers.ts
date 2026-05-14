/**
 * Shared geometry helpers used across furniture templates.
 */

import type { Part, OptionSpec, OptionGroup, FurnitureTemplateInput } from "@/lib/types";
import { getOption, opt } from "@/lib/types";

/**
 * Four corner positions (centered on origin) for a leg of given size.
 * `inset` shifts legs inward from the outer edge on all sides.
 */
export function corners(
  length: number,
  width: number,
  legSize: number,
  inset = 0,
) {
  const halfL = length / 2 - legSize / 2 - inset;
  const halfW = width / 2 - legSize / 2 - inset;
  return [
    { x: -halfL, z: -halfW },
    { x: halfL, z: -halfW },
    { x: -halfL, z: halfW },
    { x: halfL, z: halfW },
  ];
}

// =============================================================================
// 圓系列 + 矩形外斜腳家具的共用幾何計算
// =============================================================================

const DEG_TO_RAD = Math.PI / 180;

/**
 * 外斜腳的偏移計算。給定腿高與外斜角度，回傳：
 *   - splayMm：腳底沿水平方向偏移總距離（mm）
 *   - splayDx, splayDz：分到 X、Z 軸的偏移分量（4 角對稱外斜時各 √2 分之一）
 *   - apronTilt：牙板/橫撐應該跟著旋轉的角度（rad），等於 atan(tan(α)/√2)
 *
 * 數學說明：
 *   腳是一個沿著對角線往外斜的向量。腳底中心相對於腳頂的位移：
 *     |Δr| = legHeight × tan(α)
 *   分到 X、Z 兩軸（45° 對角）：
 *     Δx = Δz = |Δr| / √2
 *   牙板要保持兩端貼到對應的腳，所以牙板沿其長軸方向的傾斜角：
 *     apronTilt = atan(Δx / legHeight) = atan(tan(α) / √2)
 *   （注意：牙板斜的「真實角度」比腳的外斜角還小，因為牙板是 X 或 Z 軸而非對角線）
 */
export function computeSplayGeometry(legHeight: number, splayAngleDeg: number) {
  const splayMm = legHeight * Math.tan(splayAngleDeg * DEG_TO_RAD);
  const splayDx = splayMm / Math.SQRT2;
  const splayDz = splayMm / Math.SQRT2;
  const apronTilt =
    splayAngleDeg > 0
      ? Math.atan(Math.tan(splayAngleDeg * DEG_TO_RAD) / Math.SQRT2)
      : 0;
  return { splayMm, splayDx, splayDz, apronTilt };
}

/**
 * Leg shape enum key → 中文標籤。所有家具模板共用一份。
 *
 * 原本散在 round-stool / round-tea-table / round-table / dining-table 各有一份。
 * 現在合併。各模板選 leg shape 時直接用這個字典就好。
 */
export const LEG_SHAPE_LABEL: Record<string, string> = {
  // 直系
  box: "直方腳",
  // 方錐系
  tapered: "方錐腳",
  "strong-taper": "方錐漸縮",
  inverted: "倒錐腳",
  // 斜腳系（矩形）
  splayed: "對角斜腳",
  "splayed-length": "單向斜腳（沿長邊）",
  "splayed-width": "單向斜腳（沿寬邊）",
  hoof: "馬蹄腳",
  // 古典方腿
  "fluted-square": "古典方腿（4 面凹槽）",
  // 圓系
  round: "圓腳",
  "round-taper-down": "圓錐腳",
  "round-taper-up": "倒圓錐腳",
  "heavy-round-taper": "重型圓錐腳",
  shaker: "夏克風腳",
  "lathe-turned": "車旋腳",
  // 外斜系
  "splayed-tapered": "外斜方錐腳",
  "splayed-round-taper-down": "外斜圓錐腳",
  "splayed-round-taper-up": "外斜倒圓錐腳",
};

export function legShapeLabel(s: string): string {
  return LEG_SHAPE_LABEL[s] ?? s;
}

// =============================================================================
// 椅凳類共用 — 矩形腳樣式 + 座板邊緣處理 + 椅背/扶手選項
// =============================================================================

/** 矩形腳系列（適用方凳/長凳/餐椅/吧檯椅）。圓系列另外處理。 */
export const RECT_LEG_SHAPE_CHOICES = [
  { value: "box", label: "直方腳（最簡單）" },
  { value: "tapered", label: "錐形腳（下方收窄）" },
  { value: "strong-taper", label: "方錐漸縮（大幅下收）" },
  { value: "inverted", label: "倒錐腳（下方更粗）" },
  { value: "splayed", label: "斜腳（四角對角外傾）" },
  { value: "splayed-length", label: "斜腳（沿長邊單向外傾）" },
  { value: "splayed-width", label: "斜腳（沿寬邊單向外傾）" },
];

/**
 * 對應各 leg shape 的 bottomScale。Apron / stretcher 計算 buttHalf 時要乘
 * `legScaleAt(Y, legHeight, bottomScale)`，否則 tapered 腳的橫撐長度用了
 * 「腳頂寬」算，會跟腳的實際內面對不上（drafting-math.md §A11）。
 *
 * 與 rectLegShape 內部 mapping 對齊；新增 tapered 變體要兩處同步。
 */
export function legBottomScale(legShape: string): number {
  if (legShape === "tapered") return 0.6;
  if (legShape === "strong-taper") return 0.4;
  if (legShape === "inverted") return 1.25;
  // shaker 不加：上 25% 是方頂（scale=1，apron 在這），底下才縮到 0.6；
  // legScaleAt 是線性公式無法表達 step → 走預設 1，apron/stretcher 補償會用方頂值。

  // 圓家具 round-stool / round-tea-table / round-table 變體（與 template
  // 內部 shape mapping 對齊）：
  if (legShape === "round-taper-down") return 0.6;
  if (legShape === "round-taper-up") return 1.4;
  if (legShape === "heavy-round-taper") return 0.4;
  if (legShape === "splayed-tapered") return 0.6;
  if (legShape === "splayed-round-taper-down") return 0.6;
  if (legShape === "splayed-round-taper-up") return 1.4;
  return 1; // box / splayed / splayed-length / splayed-width 不縮 cross-section
}

/**
 * 腳在世界 y 高度 Y 處的 cross-section scale（相對 legSize）。Y=0 = 腳底；
 * Y=legHeight = 腳頂。
 *
 * 等效公式：scale = bottomScale + (1 − bottomScale) × Y/legHeight
 *         = 1 − bottomFactor × (1 − bottomScale)，
 *         其中 bottomFactor = 1 − Y/legHeight（同 apronCenterShift 慣例）
 */
export function legScaleAt(
  Y: number,
  legHeight: number,
  bottomScale: number,
): number {
  if (legHeight <= 0) return 1;
  if (bottomScale === 1) return 1;
  const t = Math.max(0, Math.min(1, Y / legHeight));
  return bottomScale + (1 - bottomScale) * t;
}

// shaker 腳：上 25% 方頂、下 75% 圓錐到 0.6（與 PerspectiveView buildLegGeometry 對齊）
const SHAKER_SQUARE_FRAC = 0.25;
const SHAKER_BOTTOM_SCALE = 0.6;

/**
 * legShape-aware scale at Y。給「指定 leg shape」對應的真實 cross-section scale。
 * - shaker：piecewise（方頂段 = 1，圓錐段線性 1 → 0.6）
 * - 其他 tapered 變體：走 legScaleAt(Y, legHeight, legBottomScale(legShape))
 *
 * 用於 round-stool / round-tea-table / round-table 算 lower stretcher 的腳寬，
 * 否則 shaker 在圓錐區用「全寬腳」算 → 橫撐 visible.length 太短，跟腳有縫。
 */
export function legProfileScaleAt(
  legShape: string,
  Y: number,
  legHeight: number,
): number {
  if (legHeight <= 0) return 1;
  if (legShape === "shaker") {
    const t = Math.max(0, Math.min(1, Y / legHeight));
    if (t >= 1 - SHAKER_SQUARE_FRAC) return 1;  // 方頂區
    const taperT = t / (1 - SHAKER_SQUARE_FRAC);  // 圓錐區歸一化
    return SHAKER_BOTTOM_SCALE + (1 - SHAKER_BOTTOM_SCALE) * taperT;
  }
  return legScaleAt(Y, legHeight, legBottomScale(legShape));
}

/**
 * 矩形腳 shape mapping。給 corner 座標 c 與 shape key，回傳 Part.shape。
 * 用 { kind: ... } 形式跟現有 dining-chair / bar-stool 一致。
 *
 * splayedFrontOnly = true：只前腳外斜（餐椅做法，避免後腳外傾不穩）
 * splayedFrontOnly = false：四腳都對角外斜（凳子做法，穩定 + 美觀）
 */
export function rectLegShape(
  shape: string,
  c: { x: number; z: number },
  opts?: {
    splayMm?: number;
    hoofMm?: number;
    hoofScale?: number;
    splayedFrontOnly?: boolean;
    /** 同時套腳 4 邊倒角（splayed 系列才支援組合）；非 splayed 時忽略 */
    chamferMm?: number;
    chamferStyle?: "chamfered" | "rounded";
  },
): Part["shape"] {
  const splayMm = opts?.splayMm ?? 30;
  // 明式馬蹄腳的腳趾通常占腳高 15-25%。35mm 在 450mm 腳上只有 8% → 看不出來。
  // 預設 90mm（占典型 450mm 凳腳的 20%），符合明清案桌實作慣例。
  const hoofMm = opts?.hoofMm ?? 90;
  const hoofScale = opts?.hoofScale ?? 1.4;
  const splayedFrontOnly = opts?.splayedFrontOnly ?? false;
  const chamferMm = opts?.chamferMm && opts.chamferMm > 0 ? opts.chamferMm : undefined;
  const chamferStyle = opts?.chamferStyle;

  if (shape === "tapered") return { kind: "tapered", bottomScale: 0.6, chamferMm, chamferStyle };
  if (shape === "strong-taper") return { kind: "tapered", bottomScale: 0.4, chamferMm, chamferStyle };
  if (shape === "inverted") return { kind: "tapered", bottomScale: 1.25, chamferMm, chamferStyle };
  // 注意：要新增 tapered 變體時，除這裡外也要改 lib/templates/_helpers.ts 內的
  // legBottomScale() 才能讓 apron/stretcher 的 buttHalf 公式跟著補償
  if (shape === "splayed") {
    return {
      kind: "splayed",
      dxMm: Math.sign(c.x) * splayMm,
      dzMm: splayedFrontOnly
        ? c.z < 0
          ? Math.sign(c.z) * splayMm
          : 0
        : Math.sign(c.z) * splayMm,
      chamferMm,
      chamferStyle,
    };
  }
  // 單向斜腳：只沿長邊（X 軸）外傾，左右兩側板正視仍然垂直
  if (shape === "splayed-length") {
    return { kind: "splayed", dxMm: Math.sign(c.x) * splayMm, dzMm: 0, chamferMm, chamferStyle };
  }
  // 單向斜腳：只沿寬邊（Z 軸）外傾，前後兩側板正視仍然垂直
  if (shape === "splayed-width") {
    return { kind: "splayed", dxMm: 0, dzMm: Math.sign(c.z) * splayMm, chamferMm, chamferStyle };
  }
  if (shape === "hoof") {
    // 馬蹄腳：腳趾朝家具外側（遠離中心）踢出去
    const dirX = (Math.sign(c.x) || 0) as -1 | 0 | 1;
    const dirZ = (Math.sign(c.z) || 0) as -1 | 0 | 1;
    return { kind: "hoof", hoofMm, hoofScale, dirX, dirZ };
  }
  return undefined;
}

// SEAT_EDGE_CHOICES / LEG_EDGE_CHOICES 已移除——改成數值輸入更彈性。
// 兼容舊 URL 字串（chamfered / chamfered-large / rounded / rounded-large）：
// parseSeatChamferMm() 接受 number 或舊 string，自動轉成 mm 數。

/** 把舊的 string 值（chamfered / chamfered-large / rounded / rounded-large）
 *  或新的 number mm 值，統一轉成 mm 數字。 */
export function parseSeatChamferMm(v: string | number | boolean | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  if (v === "" || v === "square") return 0;
  if (v === "chamfered" || v === "rounded") return 5;
  if (v === "chamfered-large" || v === "rounded-large") return 12;
  // 數字字串（從 URL params 或舊版表單）
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
export function parseLegChamferMm(v: string | number | boolean | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  if (v === "" || v === "square") return 0;
  if (v === "chamfered") return 3;
  if (v === "chamfered-large") return 8;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 邊緣處理樣式選擇（圓角 vs 45°）—— 跟 mm 數值搭配。
 *  目前 3D 兩種都用 45° 倒角渲染（節省幾何複雜度），
 *  rounded 跟 chamfered 視覺相似但 notes / 工具說明不同（修邊機選 V 型刀 vs 圓刀）。 */
const EDGE_STYLE_CHOICES = [
  { value: "chamfered", label: "45° 倒角（V 型刀）" },
  { value: "rounded", label: "圓角（圓刀）" },
];

export function seatEdgeOption(
  group: OptionGroup = "top",
  defaultValue: number = 5,
): OptionSpec {
  return {
    group,
    type: "number",
    key: "seatEdge",
    label: "座板邊緣大小 (mm)",
    defaultValue,
    min: 0,
    max: 30,
    step: 1,
    unit: "mm",
    help: "0 = 直角；3-5 細倒邊不壓腿；8-15 明顯倒邊／圓潤蛋形邊。樣式（45°/圓）下方選",
  };
}

export function seatEdgeStyleOption(
  group: OptionGroup = "top",
  defaultValue: string = "chamfered",
): OptionSpec {
  return {
    group,
    type: "select",
    key: "seatEdgeStyle",
    label: "座板邊緣樣式",
    defaultValue,
    choices: EDGE_STYLE_CHOICES,
    help: "與「座板邊緣大小」搭配。0mm 時兩個都不影響",
    dependsOn: { key: "seatEdge", notIn: [0] },
  };
}

export function stretcherEdgeOption(
  group: OptionGroup = "stretcher",
  defaultValue: number = 1,
): OptionSpec {
  return {
    group,
    type: "number",
    key: "stretcherEdge",
    label: "橫撐邊緣大小 (mm)",
    defaultValue,
    min: 0,
    max: 15,
    step: 1,
    unit: "mm",
    help: "預設 1mm 微倒（防扎手）；3-5 細倒邊；8 起明顯八角斷面",
  };
}

export function stretcherEdgeStyleOption(
  group: OptionGroup = "stretcher",
  defaultValue: string = "chamfered",
): OptionSpec {
  return {
    group,
    type: "select",
    key: "stretcherEdgeStyle",
    label: "橫撐邊緣樣式",
    defaultValue,
    choices: EDGE_STYLE_CHOICES,
    dependsOn: { key: "stretcherEdge", notIn: [0] },
  };
}

/** seat 邊緣 shape：mm > 0 才回傳 chamfered-top shape，0 = 不修飾。
 *  style="rounded" 用多段 chamfer 拼近似圓角，"chamfered"（默認）用單段 45°。
 *  bothSides=true 時底面也倒角（腳內縮時座板下緣外露才用得到）。 */
export function seatEdgeShape(
  v: string | number | undefined,
  style?: string,
  bothSides?: boolean,
): { kind: "chamfered-top"; chamferMm: number; bottomChamferMm?: number; style?: "chamfered" | "rounded" } | undefined {
  const mm = parseSeatChamferMm(v);
  if (mm <= 0) return undefined;
  return {
    kind: "chamfered-top",
    chamferMm: mm,
    bottomChamferMm: bothSides ? mm : undefined,
    style: style === "rounded" ? "rounded" : "chamfered",
  };
}

/** 腳 / 橫撐邊緣 → chamfered-edges shape（4 條長邊各倒 45° 或圓角）。 */
export function legEdgeShape(
  v: string | number | undefined,
  style?: string,
): { kind: "chamfered-edges"; chamferMm: number; style?: "chamfered" | "rounded" } | undefined {
  const mm = parseLegChamferMm(v);
  if (mm <= 0) return undefined;
  return {
    kind: "chamfered-edges",
    chamferMm: mm,
    style: style === "rounded" ? "rounded" : "chamfered",
  };
}

export function legEdgeOption(
  group: OptionGroup = "leg",
  defaultValue: number = 1,
): OptionSpec {
  return {
    group,
    type: "number",
    key: "legEdge",
    label: "腳邊緣大小 (mm)",
    defaultValue,
    min: 0,
    max: 20,
    step: 1,
    unit: "mm",
    help: "預設 1mm 微倒（防扎手）；3-5 細倒邊；8 起明顯八角斷面（明清風）。橫撐另外設定",
  };
}

export function legEdgeStyleOption(
  group: OptionGroup = "leg",
  defaultValue: string = "chamfered",
): OptionSpec {
  return {
    group,
    type: "select",
    key: "legEdgeStyle",
    label: "腳邊緣樣式",
    defaultValue,
    choices: EDGE_STYLE_CHOICES,
    dependsOn: { key: "legEdge", notIn: [0] },
  };
}

export function legEdgeNote(legEdge: string | number, style: string = "chamfered"): string {
  const mm = parseLegChamferMm(legEdge);
  if (mm <= 0) return "";
  const styleLabel = style === "rounded" ? `R${mm} 圓角（圓刀）` : `${mm}mm × 45° 倒角（V 型刀）`;
  return `腳 4 條長邊各做 ${styleLabel}。`;
}

export function stretcherEdgeNote(stretcherEdge: string | number, style: string = "chamfered"): string {
  const mm = parseLegChamferMm(stretcherEdge);
  if (mm <= 0) return "";
  const styleLabel = style === "rounded" ? `R${mm} 圓角` : `${mm}mm × 45° 倒角`;
  return `橫撐 4 條長邊各做 ${styleLabel}。`;
}

export function seatEdgeNote(seatEdge: string | number, style: string = "chamfered"): string {
  const mm = parseSeatChamferMm(seatEdge);
  if (mm <= 0) return "座板邊緣保持 90° 直角（最快做，但坐久邊緣會壓腿）。";
  const styleLabel = style === "rounded" ? `R${mm} 圓角（修邊機 ${mm}mm 圓刀）` : `${mm}mm × 45° 倒角（修邊機 V 型刀）`;
  return `座板邊緣${styleLabel}，去除銳邊不壓腿、手感佳。`;
}

/** 座面挖型選項：平面 / 馬鞍挖座 / 微凹挖座。
 *  目前只影響 notes / 工序，3D 視覺尚未渲染（需 displaced surface mesh，後續再加）。 */
export function seatProfileOption(group: OptionGroup = "top"): OptionSpec {
  return {
    group,
    type: "select",
    key: "seatProfile",
    label: "座面挖型",
    defaultValue: "flat",
    choices: [
      { value: "flat", label: "平面（最簡單）" },
      { value: "saddle", label: "馬鞍挖座（人體工學，需 5° 弧）" },
      { value: "scooped", label: "微凹挖座（雙凹各 6mm）" },
      { value: "waterfall", label: "前緣下垂（瀑布前緣，腿後不卡）" },
      { value: "dished", label: "中央碗狀（單軸下凹，給長坐用）" },
    ],
    help: "座面是否挖型。挖座更舒適但需用刨/雕刻機加工",
  };
}

/** 把 seatProfile 轉成 Part.shape；flat 回 undefined（不覆蓋現有 shape）。
 *  saddle 預設 10mm 深；scooped 預設 6mm 深；dished 8mm 深（單軸沿 X）。
 *  waterfall 不靠 seat-scoop——只是前緣加大圓角，由 template 自行用 chamfered-top
 *  傳大 bottomChamferMm 實作（這 helper 回 undefined 讓 caller 處理）。 */
export function seatScoopShape(
  profile: string,
): { kind: "seat-scoop"; profile: "saddle" | "scooped" | "dished"; depthMm: number } | undefined {
  if (profile === "saddle") return { kind: "seat-scoop", profile: "saddle", depthMm: 10 };
  if (profile === "scooped") return { kind: "seat-scoop", profile: "scooped", depthMm: 6 };
  if (profile === "dished") return { kind: "seat-scoop", profile: "dished", depthMm: 8 };
  return undefined;
}

export function seatProfileNote(profile: string): string {
  if (profile === "saddle") {
    return "座面馬鞍挖型，需用刨刀或雕刻機由後向前 5° 弧度挖出馬鞍狀凹陷。";
  }
  if (profile === "scooped") {
    return "座面雙凹挖型，左右各挖 6mm 深的對稱凹槽。";
  }
  if (profile === "dished") {
    return "座面碗狀單凹（沿短邊 8mm 深），長坐久了腿不會麻。";
  }
  if (profile === "waterfall") {
    return "座板前緣大圓角下垂（瀑布邊），坐久了大腿後側不會被銳邊壓。";
  }
  return "";
}

/** 桌面 / 座板拼板片數選項。1 = 整片實木（小桌面）；2-4 = 拼板（大桌面常見）。
 *  影響材料單顯示（每片寬度 = 桌面寬 / N）+ 裁切計算（拆成 N 個小片）。
 *  3D / 總材積不變——這只是「這塊面板實際是用幾片實木拼出來」的木工資訊。 */
export function topPanelPiecesOption(group: OptionGroup = "top"): OptionSpec {
  return {
    group,
    type: "select",
    key: "topPanelPieces",
    label: "桌面拼板片數",
    defaultValue: "1",
    choices: [
      { value: "1", label: "整片（< 300mm 寬可用單片實木）" },
      { value: "2", label: "2 片拼" },
      { value: "3", label: "3 片拼（最常見，每片 ~200-300mm 寬）" },
      { value: "4", label: "4 片拼（大桌面）" },
    ],
    help: "影響材料單顯示與裁切。實木 > 300mm 寬建議拼板防翹曲",
  };
}

export function topPanelPiecesNote(pieces: number, panelWidth: number): string {
  if (pieces <= 1) return "";
  const perPieceWidth = Math.round(panelWidth / pieces);
  return `桌面 ${pieces} 片拼板（每片寬 ${perPieceWidth}mm，平拼後上 PVA 木工膠 + F 夾固定 24hr）。寬度 > 300mm 強烈建議拼板防止單片翹曲。`;
}

/** 椅背傾角（rake）選項：椅背向後傾斜的角度。 */
export function backRakeOption(group: OptionGroup = "back"): OptionSpec {
  return {
    group,
    type: "number",
    key: "backRake",
    label: "椅背後傾角度（°）",
    defaultValue: 5,
    min: 0,
    max: 15,
    step: 1,
    unit: "°",
    help: "椅背向後傾斜角度。0° = 完全垂直；5° 較舒適、15° 偏躺",
  };
}

export function backRakeNote(deg: number): string {
  if (deg <= 0) return "椅背完全垂直（傳統明式 / 直筒椅）。";
  if (deg <= 3) return `椅背微向後傾 ${deg}°（接近垂直，正式餐椅常見）。`;
  if (deg <= 7) return `椅背向後傾 ${deg}°（人體工學常規，符合長時間用餐 / 工作）。`;
  if (deg <= 10) return `椅背後傾 ${deg}°（較放鬆，介於餐椅與休閒椅之間）。`;
  return `椅背後傾 ${deg}°（明顯後仰，偏向休閒椅或閱讀椅）。`;
}

/* ─────────────── 櫃類通用選項 helpers ─────────────── */

// 隱藏在 form 上的 sentinel dependsOn —— spec 還在 schema 裡（opt() 不會 throw），
// 但 isVisible 永遠回 false（key "__hidden" 在 values 裡是 undefined ≠ "__yes"）。
const HIDDEN_DEP = { key: "__hidden", equals: "__yes" } as const;

/** 踢腳板（toe kick）—— 底部往內凹一段讓腳趾不撞櫃面，地櫃必備
 *  withToeKick = false 時 toeKickHeight/Recess 不生效 */
export function toeKickOptions(group: OptionGroup = "structure", opts: { hidden?: boolean } = {}): OptionSpec[] {
  const hide = opts.hidden ?? true;
  const dep = hide ? HIDDEN_DEP : { key: "withToeKick", equals: true };
  return [
    {
      group,
      type: "checkbox",
      key: "withToeKick",
      label: "踢腳板（toe kick）",
      defaultValue: false,
      help: "底部前緣內凹一段，腳趾不會撞櫃面；需要腳高 = 0 且腳款 ≠ 平台底座/側板延伸落地",
      wide: true,
      dependsOn: hide ? HIDDEN_DEP : undefined,
    },
    {
      group,
      type: "number",
      key: "toeKickHeight",
      label: "踢腳板高 (mm)",
      defaultValue: 80,
      min: 50,
      max: 150,
      step: 10,
      dependsOn: dep,
    },
    {
      group,
      type: "number",
      key: "toeKickRecess",
      label: "踢腳板內凹 (mm)",
      defaultValue: 50,
      min: 30,
      max: 100,
      step: 5,
      dependsOn: dep,
    },
  ];
}

export function toeKickNote(withToeKick: boolean, h: number, r: number): string {
  if (!withToeKick) return "";
  return `底部踢腳板：高 ${h}mm × 內凹 ${r}mm，腳趾不撞櫃。`;
}

/**
 * 鎖定總高 toggle + midHeight 欄位。櫃類通用。
 * - 勾起鎖定總高：每層自設、餘量自動成為腳高（最少 30mm）
 * - 解鎖（預設）：腳高直接設、中層自動吃剩
 * 用法：在 options 內 spread `...lockTotalHeightOptions()`；body 內呼叫
 * resolveLockedTotalHeight() 取得 innerH / effectiveLegHeight / warnings。
 * legHeight 欄位請另外加 dependsOn: { key: "lockTotalHeight", equals: false } 隱藏。
 */
export function lockTotalHeightOptions(opts: { extraDeps?: Array<{ key: string; notIn?: Array<string | number | boolean>; equals?: string | number | boolean }>; skipMid?: boolean } = {}): OptionSpec[] {
  const lockDeps = opts.extraDeps && opts.extraDeps.length > 0 ? { all: opts.extraDeps } : undefined;
  const lockHelp = opts.skipMid
    ? "勾起：上下兩層高度自設、總高扣兩層後餘量自動成腳高（最少 30mm，太小會警告）。未勾：腳高直接設、其中一層自動吃剩（原本行為）"
    : "勾起：每層高度自設、總高扣三層後餘量自動成腳高（最少 30mm，太小會警告）。未勾：腳高直接設、中層自動吃剩（原本行為）";
  const specs: OptionSpec[] = [
    { group: "structure", type: "checkbox", key: "lockTotalHeight", label: "🔒 鎖定總高（餘量自動放腳）", defaultValue: false, help: lockHelp, wide: true, dependsOn: lockDeps },
  ];
  if (!opts.skipMid) {
    const midDeps = opts.extraDeps && opts.extraDeps.length > 0
      ? { all: [{ key: "lockTotalHeight", equals: true }, ...opts.extraDeps] }
      : { key: "lockTotalHeight", equals: true };
    specs.push({ group: "zone-mid", type: "number", key: "midHeight", label: "中層高度 (mm)", defaultValue: 250, min: 80, max: 1500, step: 10, help: "只在鎖定總高時用到", dependsOn: midDeps });
  }
  return specs;
}

/**
 * 鎖定總高底層計算：輸入 totalHeight + userInnerH + panelT，回傳是否超量、
 * 夾住後的 effectiveLegHeight 跟 maxInnerH。各 template 自行決定怎麼把 innerH
 * 分配到 zones（標準三段走 resolveLockedTotalHeight；鞋櫃 upper+main 兩段自行算）。
 *
 * MIN_LEG = 30：腳高最低 30mm，低於就視為超量 → effectiveLegHeight 夾 30，
 *               maxInnerH 縮成 max(160, total - 30 - 2×panelT)。
 */
export function computeLockedLegHeight(
  totalHeight: number,
  userInnerH: number,
  panelThickness: number,
): { exceeded: boolean; effectiveLegHeight: number; maxInnerH: number; computedLegHeight: number } {
  const MIN_LEG = 30;
  const computedLegHeight = totalHeight - userInnerH - 2 * panelThickness;
  if (computedLegHeight < MIN_LEG) {
    const maxInnerH = Math.max(160, totalHeight - MIN_LEG - 2 * panelThickness);
    return { exceeded: true, effectiveLegHeight: MIN_LEG, maxInnerH, computedLegHeight };
  }
  return { exceeded: false, effectiveLegHeight: computedLegHeight, maxInnerH: userInnerH, computedLegHeight };
}

/**
 * 鎖定總高的 innerH / legHeight 計算。
 * 解鎖：innerH = input.height - legHeight - 2 × panelT，legHeight 直接用使用者設的。
 * 鎖定：innerH = topH + midH + botH，legHeight = input.height - innerH - 2 × panelT（夾 ≥30）。
 */
export function resolveLockedTotalHeight(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
  panelThickness: number,
  legHeight: number,
  opts: { active?: boolean; skipMid?: boolean } = {},
): { innerH: number; effectiveLegHeight: number; warnings: string[] } {
  const active = opts.active ?? true;
  const skipMid = opts.skipMid ?? false;
  const lockTotalHeight = active && getOption<boolean>(input, opt(options, "lockTotalHeight"));
  if (!lockTotalHeight) {
    return {
      innerH: input.height - legHeight - 2 * panelThickness,
      effectiveLegHeight: legHeight,
      warnings: [],
    };
  }
  // skipMid 兩段式櫃可能 schema 只有其中一個 height 欄位（autoFill 那邊沒）
  const hasTopH = options.some((s) => s.key === "topHeight");
  const hasBotH = options.some((s) => s.key === "bottomHeight");
  const topH = hasTopH ? getOption<number>(input, opt(options, "topHeight")) : 0;
  const botH = hasBotH ? getOption<number>(input, opt(options, "bottomHeight")) : 0;
  const midH = skipMid ? 0 : (getOption<number>(input, opt(options, "midHeight")) ?? 0);
  const userInnerH = topH + midH + botH;
  const { exceeded, effectiveLegHeight, maxInnerH } = computeLockedLegHeight(
    input.height, userInnerH, panelThickness,
  );
  const warnings: string[] = [];
  if (exceeded) {
    const sumLabel = skipMid
      ? `兩層 (${topH}+${botH}=${userInnerH}mm)`
      : `三層 (${topH}+${midH}+${botH}=${userInnerH}mm)`;
    const scaleLabel = skipMid ? "兩層按比例自動縮成" : "三層按比例自動縮成";
    warnings.push(
      `鎖定總高：${sumLabel} + 板厚 (2×${panelThickness}=${2 * panelThickness}mm) 已超過總高 ${input.height}mm，腳高壓到最低 30mm，${scaleLabel} ${maxInnerH}mm。請降低層高或加大總高。`,
    );
    return { innerH: maxInnerH, effectiveLegHeight, warnings };
  }
  return { innerH: userInnerH, effectiveLegHeight, warnings };
}

/** 冠飾線（crown molding）—— 頂部裝飾線條，傳統櫃常見
 *  影響 notes 與 3D（加一條沿頂部的薄條）。3D 渲染待加。 */
export function crownMoldingOptions(group: OptionGroup = "structure", opts: { hidden?: boolean } = {}): OptionSpec[] {
  const hide = opts.hidden ?? true;
  return [
    {
      group,
      type: "checkbox",
      key: "withCrownMolding",
      label: "頂部冠飾線",
      defaultValue: false,
      help: "頂部加一圈外伸線板，傳統櫃常見裝飾",
      wide: true,
      dependsOn: hide ? HIDDEN_DEP : undefined,
    },
    {
      group,
      type: "number",
      key: "crownProjection",
      label: "冠飾外伸 (mm)",
      defaultValue: 30,
      min: 15,
      max: 80,
      step: 5,
      dependsOn: hide ? HIDDEN_DEP : { key: "withCrownMolding", equals: true },
    },
  ];
}

export function crownMoldingNote(withCrown: boolean, projection: number): string {
  if (!withCrown) return "";
  return `頂部冠飾線：${projection}mm 外伸（用 ogee / cove / chamfer profile 修邊機刀），上漆前先繞櫃黏貼。`;
}

/** 後板材質——影響材料單與裁切（背板按片計） */
export function backPanelMaterialOption(group: OptionGroup = "back"): OptionSpec {
  return {
    group,
    type: "select",
    key: "backPanelMaterial",
    label: "後板材質",
    defaultValue: "plywood",
    choices: [
      { value: "plywood", label: "夾板（最常用，4mm 或 6mm）" },
      { value: "mdf", label: "中纖板 MDF（平整、易上漆）" },
      { value: "solid", label: "實木拼板（最貴、整體感最好）" },
    ],
    help: "結構強度差不多，但實木最有質感、夾板最 CP 值",
  };
}

export function backPanelMaterialNote(mat: string): string {
  switch (mat) {
    case "plywood":
      return "後板用 4-6mm 夾板，鑲入側板後緣 dado 槽。";
    case "mdf":
      return "後板用 5mm MDF，槽接 + 邊緣上膠。MDF 平整易上漆但不耐潮。";
    case "hardboard":
      return "後板用 3mm 硬紙板（masonite），最便宜，槽接 + U 釘固定。";
    case "solid":
      return "後板用實木拼板（>10mm），鑲入槽 + 浮動安裝（中間留縫吸收形變）。";
  }
  return "";
}

/* ─────────────── 抽屜 / 門板把手樣式 ─────────────── */

/** 抽屜把手 / 門板把手樣式選項，櫃類通用 */
export function pullStyleOption(group: OptionGroup = "drawer"): OptionSpec {
  return {
    group,
    type: "select",
    key: "pullStyle",
    label: "抽屜 / 門板把手",
    defaultValue: "knob",
    choices: [
      { value: "knob", label: "● 黃銅圓把手（knob，傳統）" },
      { value: "wood-knob", label: "🍄 木製旋削圓把手（蘑菇形，自家車床做）" },
      { value: "bar", label: "▬ 長條把手（bar handle，現代簡約）" },
      { value: "ring-chinese", label: "◎ 中式古銅吊環（ring pull，明清櫃門 / 抽屜）" },
      { value: "drop-bail", label: "⌒ 古典吊環（Hepplewhite bail pull，18 世紀英美款）" },
      { value: "none", label: "✕ 不裝（純展示用）" },
    ],
    help: "把手樣式影響五金費用 + 工序，wood-knob 純木無金屬",
    // 任一 zone 類型是抽屜或門板時才顯示
    // upperType: shoe-cabinet 上層；leftType/rightType/centerType: 媒體櫃 h-2col/h-3col 欄
    // layoutMode="v-2layer": 媒體櫃縱向 2 層（下層固定是抽屜）
    dependsOn: {
      any: [
        { key: "topType", equals: "drawer" },
        { key: "midType", equals: "drawer" },
        { key: "bottomType", equals: "drawer" },
        { key: "upperType", equals: "drawer" },
        { key: "leftType", equals: "drawer" },
        { key: "rightType", equals: "drawer" },
        { key: "centerType", equals: "drawer" },
        { key: "layoutMode", equals: "v-2layer" },
        { key: "topType", equals: "door" },
        { key: "midType", equals: "door" },
        { key: "bottomType", equals: "door" },
        { key: "upperType", equals: "door" },
        { key: "leftType", equals: "door" },
        { key: "rightType", equals: "door" },
        { key: "centerType", equals: "door" },
      ],
    },
  };
}

/** 門板把手樣式（獨立於抽屜把手）；"inherit" = 跟抽屜把手一樣 */
export function doorPullStyleOption(group: OptionGroup = "door"): OptionSpec {
  return {
    group,
    type: "select",
    key: "doorPullStyle",
    label: "門板把手（獨立）",
    defaultValue: "inherit",
    choices: [
      { value: "inherit", label: "↳ 跟抽屜把手一樣" },
      { value: "knob", label: "● 黃銅圓把手" },
      { value: "wood-knob", label: "🍄 木製旋削圓把手" },
      { value: "bar", label: "▮ 長條把手（門板自動垂直）" },
      { value: "ring-chinese", label: "◎ 中式古銅吊環" },
      { value: "drop-bail", label: "⌒ 古典吊環（Hepplewhite）" },
      { value: "none", label: "✕ 不裝" },
    ],
    help: "門板把手樣式跟抽屜分開選；長條把手用在門板會自動轉成垂直方向",
    dependsOn: {
      any: [
        { key: "topType", equals: "door" },
        { key: "midType", equals: "door" },
        { key: "bottomType", equals: "door" },
        { key: "upperType", equals: "door" },
        { key: "leftType", equals: "door" },
        { key: "rightType", equals: "door" },
        { key: "centerType", equals: "door" },
      ],
    },
  };
}

export function pullStyleNote(style: string): string {
  switch (style) {
    case "knob":
      return "抽屜 / 門板配黃銅圓把手（Φ30mm，B&Q 五金 NT$ 30-100/個），鎖在中央或對稱位置。";
    case "wood-knob":
      return "車床旋削木製蘑菇形 knob（Φ35mm × 凸 28mm，自家車床做），與櫃體同材手感溫潤、無金屬五金費。";
    case "bar":
      return "抽屜 / 門板配長條把手（96/128/160mm 規格，NT$ 50-200/個），現代風常見。";
    case "ring-chinese":
      return "中式古銅吊環（面葉 Φ38mm + 銅環 Φ30mm，凸出 21mm，黃銅古銅色 NT$ 150-400/組），明清櫃門 / 抽屜標配。";
    case "drop-bail":
      return "古典吊環（Hepplewhite bail pull，橢圓底座 76×60mm + 黃銅吊環垂 22mm，凸出 25mm，中心距 64mm，NT$ 200-500/組），18 世紀英美書桌 / 斗櫃標配。";
    case "finger-pull":
      return "面板挖半月弧形指槽 80×25×深 12mm，無外露五金，北歐 / 日式極簡。";
    case "none":
      return "不裝把手（純展示 / 客戶後續自選）。";
  }
  return "";
}

