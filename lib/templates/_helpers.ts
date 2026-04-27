/**
 * Shared geometry helpers used across furniture templates.
 */

import type { Part, OptionSpec, OptionGroup } from "@/lib/types";

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
  splayed: "斜腳",
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
  { value: "splayed", label: "斜腳（整支外傾）" },
  { value: "hoof", label: "馬蹄腳（底部外撇）" },
];

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
  },
): Part["shape"] {
  const splayMm = opts?.splayMm ?? 30;
  // 明式馬蹄腳的腳趾通常占腳高 15-25%。35mm 在 450mm 腳上只有 8% → 看不出來。
  // 預設 90mm（占典型 450mm 凳腳的 20%），符合明清案桌實作慣例。
  const hoofMm = opts?.hoofMm ?? 90;
  const hoofScale = opts?.hoofScale ?? 1.4;
  const splayedFrontOnly = opts?.splayedFrontOnly ?? false;

  if (shape === "tapered") return { kind: "tapered", bottomScale: 0.6 };
  if (shape === "strong-taper") return { kind: "tapered", bottomScale: 0.4 };
  if (shape === "inverted") return { kind: "tapered", bottomScale: 1.25 };
  if (shape === "splayed") {
    return {
      kind: "splayed",
      dxMm: Math.sign(c.x) * splayMm,
      dzMm: splayedFrontOnly
        ? c.z < 0
          ? Math.sign(c.z) * splayMm
          : 0
        : Math.sign(c.z) * splayMm,
    };
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
 *  style="rounded" 用多段 chamfer 拼近似圓角，"chamfered"（默認）用單段 45°。 */
export function seatEdgeShape(
  v: string | number | undefined,
  style?: string,
): { kind: "chamfered-top"; chamferMm: number; style?: "chamfered" | "rounded" } | undefined {
  const mm = parseSeatChamferMm(v);
  if (mm <= 0) return undefined;
  return {
    kind: "chamfered-top",
    chamferMm: mm,
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
    ],
    help: "座面是否挖型。挖座更舒適但需用刨/雕刻機加工",
  };
}

export function seatProfileNote(profile: string): string {
  if (profile === "saddle") {
    return "座面馬鞍挖型，需用刨刀或雕刻機由後向前 5° 弧度挖出馬鞍狀凹陷。";
  }
  if (profile === "scooped") {
    return "座面雙凹挖型，左右各挖 6mm 深的對稱凹槽。";
  }
  return "";
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
