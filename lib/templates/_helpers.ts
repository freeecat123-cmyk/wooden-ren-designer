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
  const hoofMm = opts?.hoofMm ?? 35;
  const hoofScale = opts?.hoofScale ?? 1.3;
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
  if (shape === "hoof") return { kind: "hoof", hoofMm, hoofScale };
  return undefined;
}

/** 座板邊緣處理選項。會實際渲染 chamfered-top shape（commit 9980c3d）。 */
export const SEAT_EDGE_CHOICES = [
  { value: "square", label: "直角（最簡單，不修邊）" },
  { value: "chamfered", label: "倒角 5×45°（不壓腿）" },
  { value: "chamfered-large", label: "大倒角 10×45°（明顯斜邊）" },
  { value: "rounded", label: "圓角 R5（手感佳）" },
  { value: "rounded-large", label: "大圓角 R12（蛋形邊）" },
];

/** 腳 / 橫撐邊緣處理選項。會渲染 chamfered-edges shape（4 條長邊倒角）。
 *  跟座板分開 helper 是因為視覺位置不同——腳是垂直 4 邊角線，
 *  橫撐是水平 4 條長邊。 */
export const LEG_EDGE_CHOICES = [
  { value: "square", label: "直角（最簡單）" },
  { value: "chamfered", label: "倒角 3×45°（細緻）" },
  { value: "chamfered-large", label: "大倒角 8×45°（明顯八角斷面）" },
];

export function seatEdgeOption(
  group: OptionGroup = "top",
  defaultValue: string = "chamfered",
): OptionSpec {
  return {
    group,
    type: "select",
    key: "seatEdge",
    label: "座板邊緣處理",
    defaultValue,
    choices: SEAT_EDGE_CHOICES,
    help: "座板四周邊緣修飾，直角最簡單，倒角/圓角不刮腿、坐感更佳",
  };
}

/** 把 seatEdge 字串轉成 Part.shape——square 不修飾、其他都用 chamfered-top
 *  做出 45° 倒角視覺（圓角 R5/R12 在 3D 用 chamfer 視覺替代，等比例放大 mm 數）。
 *  套在座板 / 桌面 part 的 .shape 即可，3D 跟前/側視會看到斜邊。 */
export function seatEdgeShape(seatEdge: string): { kind: "chamfered-top"; chamferMm: number } | undefined {
  if (seatEdge === "chamfered") return { kind: "chamfered-top", chamferMm: 5 };
  if (seatEdge === "chamfered-large") return { kind: "chamfered-top", chamferMm: 10 };
  if (seatEdge === "rounded") return { kind: "chamfered-top", chamferMm: 5 };
  if (seatEdge === "rounded-large") return { kind: "chamfered-top", chamferMm: 12 };
  return undefined;
}

/** 腳 / 橫撐邊緣 → chamfered-edges shape（4 條長邊各倒 45°）。 */
export function legEdgeShape(legEdge: string): { kind: "chamfered-edges"; chamferMm: number } | undefined {
  if (legEdge === "chamfered") return { kind: "chamfered-edges", chamferMm: 3 };
  if (legEdge === "chamfered-large") return { kind: "chamfered-edges", chamferMm: 8 };
  return undefined;
}

export function legEdgeOption(
  group: OptionGroup = "leg",
  defaultValue: string = "square",
): OptionSpec {
  return {
    group,
    type: "select",
    key: "legEdge",
    label: "腳 / 橫撐邊緣處理",
    defaultValue,
    choices: LEG_EDGE_CHOICES,
    help: "4 條長邊角線倒角，視覺與手感變柔和。橫撐也套用同樣處理。",
  };
}

export function legEdgeNote(legEdge: string): string {
  if (legEdge === "chamfered") return "腳跟橫撐 4 條長邊各倒 3mm × 45°（修邊機 V 型刀）。";
  if (legEdge === "chamfered-large") return "腳跟橫撐 4 條長邊各倒 8mm × 45°，截面變八角形，明清風常見。";
  return "";
}

export function seatEdgeNote(seatEdge: string): string {
  switch (seatEdge) {
    case "square":
      return "座板邊緣保持 90° 直角（最快做，但坐久邊緣會壓腿）。";
    case "chamfered":
      return "座板邊緣 5mm × 45° 倒角（手刨或修邊機倒角刀），去除銳邊不壓腿。";
    case "rounded":
      return "座板邊緣 R5 圓角（修邊機 1/4 圓銑刀），手感舒服。";
    case "rounded-large":
      return "座板邊緣 R12 大圓角（修邊機 1/2 圓銑刀），蛋形圓潤、視覺柔和。";
    default:
      return "";
  }
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
