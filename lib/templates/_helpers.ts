/**
 * Shared geometry helpers used across furniture templates.
 */

import type { Part, OptionSpec, OptionGroup, FurnitureTemplateInput } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { topOutlinePoints } from "@/lib/render/geometry";

/**
 * Z 面 mortise origin / rotation for splayed-leg apron-to-leg joint.
 *
 * 對齊 square-stool 2026-05-27 (b3f09ad) 公約：
 *   Z 面 mortise（entry 在 ±Z 面，FRONT 視圖直接看到）→ 繞 part-local X 軸轉 (rotX)
 *     physically：左右牙板在 Z-Y 平面內傾斜，mortise 繞 X 軸跟著轉；
 *     FRONT 視圖 Z 被 collapse 看不到 tilt → 維持直矩形 ✓
 *   X 面 mortise（entry 在 ±X 面，FRONT 透視過去）→ 繞 part-local Z 軸轉 (rotZ)
 *     見 xFaceApronMortiseRotZ。
 *
 * 2026-05-26 起 mortise 不再做 splayShift offset，origin 鎖回腳中心軸（maker
 * 製作優先 > 3D 視覺對齊，user 要求對稱垂直矩形 + 對稱肩位）。3D 上 splay 腳會
 * 看到接合微縫，是接受的 trade-off。
 *
 * @param corner       Leg corner {x, z}（世界 X/Z）
 * @param splayDz      Z 軸 splay 量（splayed / splayed-width / splayed-tapered）；
 *                     非該軸 splay 傳 0 → 退化為無旋轉
 * @param legHeight    腳高
 * @param legSize      腳截面尺寸（face lock 用 legSize/2 − 0.5）
 * @param zCenterY     apron 中心 Y 在 leg-local 座標
 * @param tenonOffset  tenon 在 apron-local 的 Y 偏移（半榫錯位用 ±apronHalfTenonH/2、
 *                     無錯位傳 0）
 * @param fallbackZ    splayDz=0 時 origin.z fallback，預設 ±1（LEG_FACE_INSET）
 */
export function splayedLegMortiseGeom(args: {
  corner: { x: number; z: number };
  splayDz: number;
  legHeight: number;
  legSize: number;
  zCenterY: number;
  tenonOffset: number;
  /** splayDz=0 時的 fallback origin.z，預設 ±1（LEG_FACE_INSET） */
  fallbackZ?: number;
}): { x: number; y: number; z: number; rotX?: number } {
  const { corner, splayDz, legHeight, legSize, zCenterY, tenonOffset } = args;
  const hasSplay = splayDz !== 0 && legHeight > 0;
  if (!hasSplay) {
    // 無 splay：維持舊慣例（origin.z=±1 讓 mortiseLocalBox heuristic 選 z 面）
    const fz = args.fallbackZ ?? 1;
    return {
      x: 0,
      y: zCenterY + tenonOffset,
      z: corner.z > 0 ? -fz : +fz,
    };
  }
  // origin 鎖回腳中心：x=0、z=±(legSize/2 − 0.5) 鎖 depthAxis=z、y=apron center
  const legHalfZ = legSize / 2 - 0.5;
  const rotX = Math.sign(corner.z || 1) * Math.atan(Math.abs(splayDz) / legHeight);
  return {
    x: 0,
    y: zCenterY + tenonOffset,
    z: corner.z > 0 ? -legHalfZ : +legHalfZ,
    rotX,
  };
}

/**
 * X 面 apron-mortise rotZ for splayed-leg apron-to-leg joint。
 *
 * 對應 splayedLegMortiseGeom 的另一面。physically 前後牙板在 X-Y 平面內傾斜，
 * mortise 繞 part-local Z 軸轉，在 FRONT 視圖直接看到 → 變平行四邊形。
 *
 * 符號：apron tenon 在 world 沿 -X 方向、leg 軸傾後 leg-local frame 看 apron 方向
 * 是 (-cos θ, sin θ)，從 mortise 自然軸 -X 旋轉到此是 clockwise（負 rotZ around Z），
 * 符號要 -sign(corner.x)（user 2026-05-27「斜錯方向」）。
 *
 * @param corner   Leg corner {x}
 * @param splayDx  X 軸 splay 量；非 X 軸 splay 傳 0 → 回傳 0
 * @param legHeight 腳高
 */
export function xFaceApronMortiseRotZ(
  corner: { x: number },
  splayDx: number,
  legHeight: number,
): number {
  if (splayDx === 0 || legHeight <= 0) return 0;
  return -Math.sign(corner.x || 1) * Math.atan(Math.abs(splayDx) / legHeight);
}

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
 * For compound splay (4-corner diagonal external splay), compute the
 * WORLD-frame unit direction the apron's tenon at a given corner extends
 * (out of apron, into leg).
 *
 * Convention:
 *   - apronAxis "x": apron lies along world X. Tenon at corner (sx, sz) extends
 *     toward sx·+X with an UPWARD (+Y) component proportional to splay angle.
 *     Geometric reality: with positive splay the leg's top sits at the corner
 *     and its bottom is further out, so the leg's inner face's outward normal
 *     tilts DOWN; the tenon (opposite of that normal, pointing INTO the leg)
 *     therefore tilts UP.
 *   - apronAxis "z": symmetric in Z.
 *   - cornerSz=0 (single-axis splayed-length) or cornerSx=0 (splayed-width)
 *     degenerates: tenon stays in the apron-axis plane.
 *
 * Output is WORLD-frame. Renderers and templates consume it directly without
 * composing with the apron's rotation. Templates may set the mortise.axis at
 * the receiving leg = the negation of this vector (mortise OPENS the other way).
 */
export function computeCompoundSplayNormal(args: {
  apronAxis: "x" | "z";
  cornerSx: -1 | 0 | 1;
  cornerSz: -1 | 0 | 1;
  splayAngleDeg: number;
}): { x: number; y: number; z: number } {
  const { apronAxis, cornerSx, cornerSz, splayAngleDeg } = args;
  const a = splayAngleDeg * (Math.PI / 180);
  if (apronAxis === "x") {
    if (cornerSx === 0) return { x: 0, y: 0, z: 0 };
    return { x: cornerSx * Math.cos(a), y: Math.sin(a), z: 0 };
  } else {
    if (cornerSz === 0) return { x: 0, y: 0, z: 0 };
    return { x: 0, y: Math.sin(a), z: cornerSz * Math.cos(a) };
  }
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
  "curved-taper": "弧肩斜腳",
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

/** 矩形腳系列（適用方凳/長凳/餐椅/吧檯椅）。圓系列另外處理。
 *  ⚠️ curved-taper（弧肩斜腳）只有 square-stool 有完整實作（幾何 + 牙板/橫撐補償 +
 *  三視圖投影），故「不」放進共用清單，避免 bench/bar-stool/dining-chair/bed 出現
 *  假選項（選了只 fallback 成方腳）。要提供的模板改用
 *  RECT_LEG_SHAPE_CHOICES_WITH_CURVED_TAPER。 */
export const RECT_LEG_SHAPE_CHOICES = [
  { value: "box", label: "直方腳（最簡單）" },
  { value: "tapered", label: "錐形腳（下方收窄）" },
  { value: "strong-taper", label: "方錐漸縮（大幅下收）" },
  { value: "inverted", label: "倒錐腳（下方更粗）" },
  { value: "splayed", label: "斜腳（四角對角外傾）" },
  { value: "splayed-length", label: "斜腳（沿長邊單向外傾）" },
  { value: "splayed-width", label: "斜腳（沿寬邊單向外傾）" },
];

/** 有完整 curved-taper 支援的模板（目前只有 square-stool）用這份含弧肩斜腳的清單。 */
export const RECT_LEG_SHAPE_CHOICES_WITH_CURVED_TAPER = [
  ...RECT_LEG_SHAPE_CHOICES,
  { value: "curved-taper", label: "弧肩斜腳（接撐段＋弧肩＋外斜）" },
];

/**
 * 弧肩斜腳（curved-taper）的三個可調參數，加進任一椅凳模板的 options 即可。
 * 只在 legShape=curved-taper 時顯示。總寬＝腳粗（legSize）、厚度＝腳的前後厚。
 */
export function curvedTaperLegOptions(group: OptionGroup = "leg"): OptionSpec[] {
  const dependsOn = { key: "legShape", oneOf: ["curved-taper"] };
  return [
    { group, type: "number", key: "ctBlockHeight", label: "接撐段高", defaultValue: 40, min: 10, max: 250, step: 5, unit: "mm", help: "內面（接橫撐那面）頂部維持全寬的一節高度，留給橫桿／牙板接合。", dependsOn },
    { group, type: "number", key: "ctShoulder", label: "弧肩內收", defaultValue: 8, min: 0, max: 40, step: 1, unit: "mm", help: "接橫撐那面的凹弧肩往內收的量（同時是弧的半徑）。0＝無弧肩。", dependsOn },
    { group, type: "number", key: "ctInset", label: "外面斜降", defaultValue: 12, min: 0, max: 100, step: 1, unit: "mm", help: "外面整支直線斜降、腳底往內收的量；內面弧肩以下維持垂直。", dependsOn },
    // 外斜獨立一欄（不共用 splayAngle）：splayAngle 各模板預設多為 5°，若讓 curved-taper
    // 直接吃它，所有既有弧肩斜腳設計會突然外傾 → 破壞既有 URL。此欄預設 0 = 垂直（既有行為）。
    { group, type: "number", key: "ctSplay", label: "外斜角度 (°)", defaultValue: 0, min: 0, max: 12, step: 0.5, unit: "°", help: "整支腳外傾角度（對角外斜，同斜腳系列）。0 = 垂直。建議 3–8°，太斜底盤過大", dependsOn },
  ];
}

/** 把外部 dependsOn 條件與內建條件 all 合成（外部為空就用內建）。 */
function composeDependsOn(
  base: NonNullable<OptionSpec["dependsOn"]>,
  extra?: OptionSpec["dependsOn"],
): NonNullable<OptionSpec["dependsOn"]> {
  return extra ? ({ all: [extra, base] } as NonNullable<OptionSpec["dependsOn"]>) : base;
}

/**
 * 牙條造型（edge-profile 曲線）選項組：apronProfile + apronProfileDepth。
 * builder（simple-table）/ 模板讀 "apronProfile"/"apronProfileDepth" 傳給 shape。
 * extraDependsOn = 模板自己的顯示條件（如 withApron），與內建條件 all 合成。
 */
export function apronProfileOptions(
  group: OptionGroup = "apron",
  extraDependsOn?: OptionSpec["dependsOn"],
): OptionSpec[] {
  return [
    { group, type: "select", key: "apronProfile", label: "牙條造型", defaultValue: "none", choices: [
      { value: "none", label: "無（直邊）" },
      { value: "arch", label: "下緣圓弧" },
      { value: "arch-out", label: "下緣外圓弧（凸弧垂邊）" },
      { value: "kunmen", label: "壸門曲線（明式）" },
      { value: "wave", label: "波浪連續弧" },
      { value: "double-arch", label: "上下內凹弧（束腰）" },
    ], help: "牙板下緣（束腰款含上緣）的造型。兩端自動留腳肩不吃榫。選造型後牙條倒角不套用（一件一種造型）", ...(extraDependsOn ? { dependsOn: extraDependsOn } : {}) },
    { group, type: "number", key: "apronProfileDepth", label: "牙條造型深度", defaultValue: 0, min: 0, max: 100, step: 1, unit: "mm", help: "0 = 自動（牙條高的 40%）", dependsOn: composeDependsOn({ key: "apronProfile", notIn: ["none"] }, extraDependsOn) },
  ];
}

/** 下橫撐造型選項組：stretcherProfile + stretcherProfileDepth。用法同 apronProfileOptions。 */
export function stretcherProfileOptions(
  group: OptionGroup = "stretcher",
  extraDependsOn?: OptionSpec["dependsOn"],
): OptionSpec[] {
  return [
    { group, type: "select", key: "stretcherProfile", label: "下橫撐造型", defaultValue: "none", choices: [
      { value: "none", label: "無（直邊）" },
      { value: "arch", label: "下緣圓弧" },
      { value: "top-arch", label: "上緣圓弧" },
      { value: "kunmen", label: "壸門曲線（明式）" },
      { value: "wave", label: "波浪連續弧" },
      { value: "double-arch", label: "上下內凹弧（束腰）" },
    ], help: "下橫撐緣的造型。選造型後下橫撐倒角不套用（一件一種造型）", ...(extraDependsOn ? { dependsOn: extraDependsOn } : {}) },
    { group, type: "number", key: "stretcherProfileDepth", label: "下橫撐造型深度", defaultValue: 0, min: 0, max: 80, step: 1, unit: "mm", help: "0 = 自動（下橫撐高的 40%）", dependsOn: composeDependsOn({ key: "stretcherProfile", notIn: ["none"] }, extraDependsOn) },
  ];
}

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

/**
 * 弧肩斜腳（curved-taper）在世界高度 Y 處的「等效對稱 legSize scale」。
 * curved-taper 只有內面（接橫撐那面）內縮＝接撐段全寬 → 內凹弧肩(shoulder) → 直線斜降(inset)；
 * 外面垂直。牙板/橫撐端面要對到「該高度的內面」，故回傳 scale 使
 * `legSize × scale / 2` = 腳中心到內面的距離（= legSize/2 − 內面內縮量 recession）。
 * 幾何與 buildCurvedTaperGeometry 對齊（同 clamp、同弧參數）。Y：0=腳底、legHeight=腳頂。
 */
export function curvedTaperInnerScaleAt(
  Y: number,
  legHeight: number,
  legSize: number,
  blockHeightMm: number,
  shoulderMm: number,
  insetMm: number,
): number {
  if (legHeight <= 0 || legSize <= 0) return 1;
  const blockH = Math.max(0, Math.min(blockHeightMm, legHeight * 0.9));
  const shoulder = Math.max(0, Math.min(shoulderMm, legSize * 0.45));
  const coveSpan = Math.min(shoulder, Math.max(0, legHeight - blockH));
  const inset = Math.max(0, Math.min(insetMm, legSize - shoulder - legSize * 0.05));
  const depthFromTop = legHeight - Y; // 0＝腳頂
  let recession: number;
  if (depthFromTop <= blockH) {
    recession = 0; // 接撐段全寬
  } else if (depthFromTop <= blockH + coveSpan) {
    // 內凹弧：block 底(recession 0) → 弧尾(recession shoulder)。
    // buildCurvedTaperGeometry 的弧參數化為 x=-hx+shoulder·cos(th)、y=yCoveEnd+coveSpan·sin(th)，
    // 即「高度」正比 sin(th)（非 th 線性）。所以在給定高度反解時 sin(th)=1-frac，
    // recession = shoulder·cos(th) = shoulder·√(1-(1-frac)²)。舊版用 th 線性映射
    // (th=(π/2)(1-frac)) 只在弧兩端吻合、弧中段最大偏離 ~29% shoulder，已修正逐點對齊幾何。
    const frac = coveSpan > 0 ? (depthFromTop - blockH) / coveSpan : 1;
    const sinTh = 1 - frac; // 幾何：sin(th)=1-frac
    recession = shoulder * Math.sqrt(Math.max(0, 1 - sinTh * sinTh));
  } else {
    // 直線斜降：shoulder → shoulder+inset
    const slantSpan = legHeight - blockH - coveSpan;
    const f = slantSpan > 0 ? (depthFromTop - blockH - coveSpan) / slantSpan : 1;
    recession = shoulder + inset * Math.min(1, Math.max(0, f));
  }
  // 下限 -0.9：內面可內縮到接近外面（腳底最窄剩 5% 寬，對齊幾何 inset 夾限）。
  // 不可夾在正值（如 0.05），否則 recession 超過半寬時橫撐長度/梯形斜切被壓平 → 接不上有縫。
  return Math.max(-0.9, 1 - (2 * recession) / legSize);
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
    /** 弧肩斜腳（curved-taper）參數；斜面朝外由 sign(c.x) 決定。
     *  splayMm > 0 = 選配外斜：腳底沿 X/Z 對角外踢 splayMm（依 corner 正負號），頂固定。
     *  ⚠️ 刻意不用外層 opts.splayMm（那是 splayed 系列用、模板常帶預設 5° 值）——
     *  避免既有 curved-taper 呼叫者未 opt-in 就突然全部外斜。 */
    curvedTaper?: { blockHeightMm: number; shoulderMm: number; insetMm: number; splayMm?: number };
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
  if (shape === "curved-taper") {
    const ct = opts?.curvedTaper;
    // 斜面朝家具外側（沿 local X），中柱腳（c.x=0）預設 +1
    const dir = (Math.sign(c.x) || 1) as -1 | 0 | 1;
    // 選配外斜：對角外踢（同 "splayed" 慣例，底部沿 corner 方向外移）
    const ctSplay = ct?.splayMm ?? 0;
    return {
      kind: "curved-taper",
      blockHeightMm: ct?.blockHeightMm ?? 40,
      shoulderMm: ct?.shoulderMm ?? 8,
      insetMm: ct?.insetMm ?? 12,
      dir,
      ...(ctSplay > 0
        ? { dxMm: Math.sign(c.x) * ctSplay, dzMm: Math.sign(c.z) * ctSplay }
        : {}),
    };
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
    label: "倒角尺寸",
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
    label: "倒角樣式",
    defaultValue,
    choices: EDGE_STYLE_CHOICES,
    help: "與「倒角尺寸」搭配。0mm 時兩個都不影響",
    dependsOn: { key: "seatEdge", notIn: [0] },
  };
}

/** 下緣倒角尺寸選項：座板 / 桌面「下緣」獨立倒角量。
 *  跟上緣 seatEdgeOption 並列；倒角樣式共用 seatEdgeStyle。
 *  template 應加 dependsOn { key:"legInset", notIn:[0] }——腳齊邊時牙條貼邊、
 *  下緣倒角會切到接合區，故只在腳內縮時開放。實際值由 template 夾限到 legInset。 */
export function seatEdgeBottomOption(
  group: OptionGroup = "top",
  defaultValue: number = 0,
): OptionSpec {
  return {
    group,
    type: "number",
    key: "seatEdgeBottom",
    label: "下緣倒角尺寸",
    defaultValue,
    min: 0,
    max: 30,
    step: 1,
    unit: "mm",
    help: "座板／桌面「下緣」的倒角量。腳內縮後下緣外露才可調；倒角量會自動限制在腳內縮量內，不會切到牙條。樣式跟上緣共用",
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
    label: "倒角尺寸",
    defaultValue,
    min: 0,
    max: 15,
    step: 1,
    unit: "mm",
    // ⚠️ 跟 apronEdge 一樣:tapered/splayed/圓腳時橫撐斷面會變梯形,倒角無效。
    //    apronEdge 的 help 有寫、這支漏了 → 圓凳(預設圓腳)上拉了完全沒反應。
    //    (2026-08-24 大軍稽核順藤摸出來的,agent 沒報這條)
    help: "預設 1mm 微倒（防扎手）；3-5 細倒邊；8 起明顯八角斷面。tapered / splayed / 圓腳時橫撐會變梯形斷面，倒角無效",
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
    label: "倒角樣式",
    defaultValue,
    choices: EDGE_STYLE_CHOICES,
    dependsOn: { key: "stretcherEdge", notIn: [0] },
  };
}

/** 牙板 / 牙條倒角（apron）—— 走跟 stretcher 一樣的 4 邊倒角邏輯，
 *  跟 stretcher 拆開讓使用者能個別調。tapered/splayed 腳形時牙板會變梯形
 *  (apron-trapezoid)，倒角會被無視——template 加 dependsOn 自行決定要不要隱藏。 */
export function apronEdgeOption(
  group: OptionGroup = "apron",
  defaultValue: number = 1,
): OptionSpec {
  return {
    group,
    type: "number",
    key: "apronEdge",
    label: "牙條倒角",
    defaultValue,
    min: 0,
    max: 15,
    step: 1,
    unit: "mm",
    help: "預設 1mm 微倒（防扎手）；3-5 細倒邊。tapered/splayed 腳形時牙條會變梯形，倒角無效",
  };
}

export function apronEdgeStyleOption(
  group: OptionGroup = "apron",
  defaultValue: string = "chamfered",
): OptionSpec {
  return {
    group,
    type: "select",
    key: "apronEdgeStyle",
    label: "牙條倒角樣式",
    defaultValue,
    choices: EDGE_STYLE_CHOICES,
    dependsOn: { key: "apronEdge", notIn: [0] },
  };
}

export function apronEdgeNote(apronEdge: string | number, style: string = "chamfered", locale: string = "zh-TW"): string {
  const mm = parseLegChamferMm(apronEdge);
  if (mm <= 0) return "";
  if (locale === "en") {
    return ` Apron edges (4) ${style === "rounded" ? `R${mm} rounded` : `${mm}mm chamfer`}.`;
  }
  return ` 牙板 4 邊${style === "rounded" ? `R${mm} 圓角` : `${mm}mm 倒角`}。`;
}

/** seat 邊緣 shape：mm > 0 才回傳 chamfered-top shape，0 = 不修飾。
 *  style="rounded" 用多段 chamfer 拼近似圓角，"chamfered"（默認）用單段 45°。
 *  bottomV 給下緣倒角 mm 值（0/undefined = 下緣不倒）。上下任一 > 0 就回 chamfered-top。 */
export function seatEdgeShape(
  v: string | number | undefined,
  style?: string,
  bottomV?: string | number,
): { kind: "chamfered-top"; chamferMm: number; bottomChamferMm?: number; style?: "chamfered" | "rounded" } | undefined {
  const mm = parseSeatChamferMm(v);
  const bottomMm = parseSeatChamferMm(bottomV);
  if (mm <= 0 && bottomMm <= 0) return undefined;
  return {
    kind: "chamfered-top",
    chamferMm: mm,
    bottomChamferMm: bottomMm > 0 ? bottomMm : undefined,
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
  dependsOn?: OptionSpec["dependsOn"],
): OptionSpec {
  return {
    group,
    type: "number",
    key: "legEdge",
    label: "倒角尺寸",
    defaultValue,
    min: 0,
    max: 20,
    step: 1,
    unit: "mm",
    help: "預設 1mm 微倒（防扎手）；3-5 細倒邊；8 起明顯八角斷面（明清風）。橫撐另外設定",
    ...(dependsOn ? { dependsOn } : {}),
  };
}

export function legEdgeStyleOption(
  group: OptionGroup = "leg",
  defaultValue: string = "chamfered",
  extraDependsOn?: OptionSpec["dependsOn"],
): OptionSpec {
  // 預設只 gate legEdge=0；如果模板有額外 dependsOn（例如圓腳系列要隱藏），
  // 用 `all` 把 legEdge!=0 跟 extraDependsOn 合起來。
  const baseDep: NonNullable<OptionSpec["dependsOn"]> = { key: "legEdge", notIn: [0] };
  const dependsOn = extraDependsOn
    ? ({ all: [baseDep, extraDependsOn] } as OptionSpec["dependsOn"])
    : baseDep;
  return {
    group,
    type: "select",
    key: "legEdgeStyle",
    label: "腳邊緣樣式",
    defaultValue,
    choices: EDGE_STYLE_CHOICES,
    dependsOn,
  };
}

export function legEdgeNote(legEdge: string | number, style: string = "chamfered", locale: string = "zh-TW"): string {
  const mm = parseLegChamferMm(legEdge);
  if (mm <= 0) return "";
  if (locale === "en") {
    const styleLabel = style === "rounded" ? `R${mm} rounded (round bit)` : `${mm}mm × 45° chamfer (V bit)`;
    return `Legs (4 long edges each): ${styleLabel}.`;
  }
  const styleLabel = style === "rounded" ? `R${mm} 圓角（圓刀）` : `${mm}mm × 45° 倒角（V 型刀）`;
  return `腳 4 條長邊各做 ${styleLabel}。`;
}

export function stretcherEdgeNote(stretcherEdge: string | number, style: string = "chamfered", locale: string = "zh-TW"): string {
  const mm = parseLegChamferMm(stretcherEdge);
  if (mm <= 0) return "";
  if (locale === "en") {
    const styleLabel = style === "rounded" ? `R${mm} rounded` : `${mm}mm × 45° chamfer`;
    return `Stretchers (4 long edges each): ${styleLabel}.`;
  }
  const styleLabel = style === "rounded" ? `R${mm} 圓角` : `${mm}mm × 45° 倒角`;
  return `橫撐 4 條長邊各做 ${styleLabel}。`;
}

export function seatEdgeNote(seatEdge: string | number, style: string = "chamfered", locale: string = "zh-TW"): string {
  const mm = parseSeatChamferMm(seatEdge);
  if (locale === "en") {
    if (mm <= 0) return "Seat edges kept square 90° (fastest to build, but pressure on thighs after sitting a while).";
    const styleLabel = style === "rounded" ? `R${mm} rounded (router ${mm}mm round bit)` : `${mm}mm × 45° chamfer (router V bit)`;
    return `Seat edges: ${styleLabel}. Breaks the sharp edge — better comfort, no leg pressure.`;
  }
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

/** 椅面／座板「俯視輪廓」造型選單（top-outline shape）。
 *  rect = 方形（預設、不建 shape）；octagon = 四角 45° 切角；oval = 滿版圓／橢圓；
 *  arch = 前後緣外凸弧。非方形時挖型／倒角／彎曲不套用（一件一 shape），
 *  template 應對衝突欄加 dependsOn { key:"seatOutline", oneOf:["rect"] } 隱藏。 */
export function seatOutlineOption(group: OptionGroup = "top", noun: string = "椅面"): OptionSpec {
  return {
    group,
    type: "select",
    key: "seatOutline",
    label: `${noun}輪廓`,
    defaultValue: "rect",
    choices: [
      { value: "rect", label: "方形（預設）" },
      { value: "octagon", label: "切角（八角面）" },
      { value: "oval", label: "圓形／橢圓（滿版）" },
      { value: "arch", label: "外凸弧" },
      { value: "petal", label: "海棠／花瓣形" },
    ],
    help: "俯視看的外輪廓造型，可直接下 CNC 切外形。切角／外凸弧／瓣深的量在「輪廓尺寸」調；圓形＝長寬相等時，否則為橢圓（「方圓程度」可往圓角方過渡）。非方形時倒角／挖型／彎曲不套用；造型會自動避開腳榫眼（腳內縮愈大可切愈多）",
  };
}

export function seatOutlineSizeOption(group: OptionGroup = "top", defaultValue: number = 40): OptionSpec {
  return {
    group,
    type: "number",
    key: "seatOutlineSize",
    label: "輪廓尺寸",
    defaultValue,
    min: 5,
    max: 150,
    step: 5,
    unit: "mm",
    help: "切角＝每角沿兩邊切掉的長度（Z 向可用「切角深 Z」分開調）；外凸弧＝兩端往內收的弧深；海棠＝瓣間凹谷深。圓形／橢圓不使用此值",
    dependsOn: { key: "seatOutline", notIn: ["rect", "oval"] },
  };
}

/** 椅面／桌面輪廓「細節鈕」：各款式的進階參數（依款式顯示）。 */
export function seatOutlineDetailOptions(group: OptionGroup = "top"): OptionSpec[] {
  return [
    {
      group,
      type: "number",
      key: "seatOutlineSizeZ",
      label: "切角深 Z",
      defaultValue: 0,
      min: 0,
      max: 150,
      step: 5,
      unit: "mm",
      help: "0 = 跟「輪廓尺寸」同值（45° 等邊切角）。填值 = Z 向切深與 X 向分開，可做長八角／緩斜角",
      dependsOn: { key: "seatOutline", oneOf: ["octagon"] },
    },
    {
      group,
      type: "number",
      key: "seatOutlineSquareness",
      label: "方圓程度",
      defaultValue: 0,
      min: 0,
      max: 100,
      step: 5,
      unit: "%",
      help: "0 = 正圓／橢圓；愈大愈接近圓角方形（超橢圓）。腳榫空間也會變寬",
      dependsOn: { key: "seatOutline", oneOf: ["oval"] },
    },
    {
      group,
      type: "select",
      key: "seatOutlineArchSides",
      label: "外凸弧套用邊",
      defaultValue: "front-back",
      choices: [
        { value: "front-back", label: "前後緣" },
        { value: "left-right", label: "左右緣" },
        { value: "all", label: "四邊（枕形）" },
      ],
      help: "弧鼓在哪幾邊；四邊＝四角內收、四邊中段鼓滿的枕形",
      dependsOn: { key: "seatOutline", oneOf: ["arch"] },
    },
    {
      group,
      type: "select",
      key: "seatOutlineLobes",
      label: "瓣數",
      defaultValue: "4",
      choices: [
        { value: "4", label: "4 瓣（海棠形）" },
        { value: "6", label: "6 瓣" },
        { value: "8", label: "8 瓣" },
      ],
      help: "瓣鼓在前後左右軸向、凹谷在瓣間；瓣深在「輪廓尺寸」調",
      dependsOn: { key: "seatOutline", oneOf: ["petal"] },
    },
  ];
}

/** 讀齊椅面／桌面輪廓相關選項（9 個模板共用，避免逐檔重複 getOption）。 */
export function readSeatOutlineParams(
  input: FurnitureTemplateInput,
  o: OptionSpec[],
): { outline: string; params: TopOutlineParams } {
  const outline = getOption<string>(input, opt(o, "seatOutline"));
  const sizeZ = getOption<number>(input, opt(o, "seatOutlineSizeZ"));
  return {
    outline,
    params: {
      sizeMm: getOption<number>(input, opt(o, "seatOutlineSize")),
      sizeZMm: sizeZ > 0 ? sizeZ : undefined,
      squareness: getOption<number>(input, opt(o, "seatOutlineSquareness")) / 100,
      archSides: getOption<string>(input, opt(o, "seatOutlineArchSides")) as TopOutlineParams["archSides"],
      lobes: parseInt(getOption<string>(input, opt(o, "seatOutlineLobes")), 10) || 4,
    },
  };
}

export type TopOutlineStyle = "octagon" | "oval" | "arch" | "petal";
export type TopOutlineParams = {
  sizeMm: number;
  sizeZMm?: number;
  squareness?: number; // 0..1
  archSides?: "front-back" | "left-right" | "all";
  lobes?: number;
};
export type TopOutlineShape = {
  kind: "top-outline";
  style: TopOutlineStyle;
  sizeMm: number;
  sizeZMm?: number;
  squareness?: number;
  archSides?: "front-back" | "left-right" | "all";
  lobes?: number;
};

/** ray-casting 點在多邊形內（top-outline 輪廓皆繞原點閉合）。 */
function pointInPolygon(px: number, pz: number, pts: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** 泛用防露榫解算器：把輪廓造型對「座板全部榫眼」驗證（榫眼外角＋margin 必須
 *  落在輪廓內，實際 point-in-polygon 測試），不合就把尺寸參數二分縮小到安全值。
 *  - octagon/arch/petal → 回傳 clamp 後的 shape（縮到 0 = 視覺退回方形／純橢圓）
 *  - oval（無可縮參數）或縮到 0 仍不合 → 回 null（caller 退方形＋出警告，
 *    引導使用者加大腳內縮／背柱內縮）。mortise 座標為座板 local（中心原點）。 */
export function resolveTopOutlineShape(
  outline: string,
  params: TopOutlineParams,
  lx: number,
  lz: number,
  mortises: Array<{ origin: { x: number; z: number }; length: number; width: number }>,
  marginMm: number = 4,
): TopOutlineShape | null {
  if (outline !== "octagon" && outline !== "oval" && outline !== "arch" && outline !== "petal") {
    return null;
  }
  const style = outline as TopOutlineStyle;
  // 榫眼外角（對稱輪廓 → 取第一象限代表點）＋margin 斜向外推
  const cornerPts = mortises.map(
    (m) =>
      [
        Math.abs(m.origin.x) + m.length / 2 + marginMm,
        Math.abs(m.origin.z) + m.width / 2 + marginMm,
      ] as [number, number],
  );
  const fitsAt = (t: number): boolean => {
    const pts = topOutlinePoints(lx, lz, style, params.sizeMm * t, {
      sizeZMm: params.sizeZMm !== undefined ? params.sizeZMm * t : undefined,
      squareness: params.squareness,
      archSides: params.archSides,
      lobes: params.lobes,
    });
    return cornerPts.every(([px, pz]) => pointInPolygon(px, pz, pts));
  };
  const mk = (t: number): TopOutlineShape => ({
    kind: "top-outline",
    style,
    sizeMm: Math.floor(params.sizeMm * t),
    ...(params.sizeZMm !== undefined ? { sizeZMm: Math.floor(params.sizeZMm * t) } : {}),
    ...(params.squareness ? { squareness: params.squareness } : {}),
    ...(params.archSides && params.archSides !== "front-back" ? { archSides: params.archSides } : {}),
    ...(params.lobes && params.lobes !== 4 ? { lobes: params.lobes } : {}),
  });
  if (fitsAt(1)) return mk(1);
  if (style === "oval") return null; // 滿版無可縮參數
  if (!fitsAt(0)) return null; // 縮到 0（方形／純橢圓）仍不合 → 整個不套
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAt(mid)) lo = mid;
    else hi = mid;
  }
  // floor 後再驗一次（floor 只會更小＝更安全）
  return mk(lo);
}

export function seatOutlineNote(outline: string, sizeMm: number, locale: string = "zh-TW", noun: string = "座板"): string {
  const isEn = locale === "en";
  const nounEn = noun === "桌面" ? "Table top" : "Seat";
  if (outline === "octagon") {
    return isEn
      ? ` ${nounEn} corners cut (${sizeMm}mm legs) — octagonal top; cut the outline first, then rout mortises.`
      : ` ${noun}四角切角（每角切 ${sizeMm}mm）＝八角面；先切外形再挖榫眼。`;
  }
  if (outline === "oval") {
    return isEn
      ? ` ${nounEn} cut to a full-span oval — band-saw / CNC the outline first, then rout mortises.`
      : ` ${noun}切成滿版圓／橢圓；先帶鋸或 CNC 切外形，再挖腳榫眼。`;
  }
  if (outline === "arch") {
    return isEn
      ? ` ${nounEn} edges bulge outward (${sizeMm}mm arch at the ends).`
      : ` ${noun}外凸弧（兩端各收 ${sizeMm}mm、中段滿幅）。`;
  }
  if (outline === "petal") {
    return isEn
      ? ` ${nounEn} cut to a petal (begonia) outline (${sizeMm}mm valleys) — band-saw / CNC the outline first, then rout mortises.`
      : ` ${noun}切成海棠／花瓣形（瓣間凹谷 ${sizeMm}mm）；先帶鋸或 CNC 切外形，再挖榫眼。`;
  }
  return "";
}

/** 滿版橢圓椅面的最小腳內縮：腳外角 (hx−i, hz−i)＋margin 必須落在橢圓內。
 *  由 insetFloor（使用者設的腳內縮）起 1mm 步進找最小滿足值。 */
export function ovalMinLegInset(
  lx: number,
  lz: number,
  insetFloor: number,
  marginMm: number = 5,
): number {
  const hx = lx / 2;
  const hz = lz / 2;
  const fits = (i: number): boolean => {
    const px = Math.max(0, hx - i + marginMm);
    const pz = Math.max(0, hz - i + marginMm);
    return (px * px) / (hx * hx) + (pz * pz) / (hz * hz) <= 1;
  };
  const cap = Math.min(hx, hz) * 0.6;
  let i = Math.max(0, insetFloor);
  while (i < cap && !fits(i)) i += 1;
  return Math.round(i);
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
      label: "踢腳板高",
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
      label: "踢腳板內凹",
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
    specs.push({ group: "zone-mid", type: "number", key: "midHeight", label: "中層高度", defaultValue: 250, min: 80, max: 1500, step: 10, help: "只在鎖定總高時用到", dependsOn: midDeps });
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
      label: "冠飾外伸",
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

/**
 * 椅腳開關 — 預設安裝椅腳；關掉時整組椅腳欄位隱藏 + 強制 legHeight=0（櫃子貼地）。
 * 用法：在 options 內 spread `withLegsOption`；body 內呼叫 `resolveLegHeight()`
 * 取得實際 legHeight（withLegs=false → 0）。
 * 各 leg 欄位的 dependsOn 不必改，因為 legHeight=0 後 legSize/legShape/legInset
 * 既有 notIn:[0] 條件會自動把它們收掉；只要把 legHeight 欄位的 dependsOn 加上
 * `{ key: "withLegs", equals: true }` 即可一起隱藏。
 */
export const withLegsOption: OptionSpec = {
  group: "leg",
  type: "checkbox",
  key: "withLegs",
  label: "🦿 安裝櫃腳（關掉 = 貼地）",
  defaultValue: true,
  wide: true,
  help: "勾起：加底座櫃腳，可選腳高 / 腳粗 / 樣式 / 內縮；不勾：櫃子直接貼地（適合系統櫃風格）",
};

/** 取得實際 legHeight：withLegs=false → 0；其餘吃使用者設的 legHeight。 */
export function resolveLegHeight(
  input: FurnitureTemplateInput,
  options: OptionSpec[],
): number {
  const hasWithLegs = options.some((s) => s.key === "withLegs");
  if (hasWithLegs) {
    const withLegs = getOption<boolean>(input, opt(options, "withLegs"));
    if (!withLegs) return 0;
  }
  const hasLegHeight = options.some((s) => s.key === "legHeight");
  if (!hasLegHeight) return 0;
  return getOption<number>(input, opt(options, "legHeight"));
}

/** 後板材質——影響材料單與裁切（背板按片計） */
export function backPanelMaterialOption(group: OptionGroup = "back"): OptionSpec {
  return {
    group,
    type: "select",
    key: "backPanelMaterial",
    label: "後板材質",
    defaultValue: "inherit",
    choices: [
      { value: "inherit", label: "↳ 跟主材料一樣" },
      { value: "plywood", label: "夾板（最常用，4mm 或 6mm）" },
      { value: "mdf", label: "中纖板 MDF（平整、易上漆）" },
      { value: "solid", label: "實木拼板（最貴、整體感最好）" },
    ],
    help: "預設跟主材料同；要跟主材料不同時可獨立選 夾板 / MDF / 實木",
  };
}

/** 後板省料開關：勾起改用夾板（裝潢慣例最 CP 值），不勾則跟主材料同。 */
/**
 * ⛔ 這個選項只在「入溝背板」(9mm) 才有意義。
 *
 *    「釘背」背板是 3mm —— 3mm 的實木板市面上不存在(§T1,1 分 = 3mm 是薄合板的
 *    規格),所以不管勾不勾都一定算夾板(見 case-furniture.ts 的 backTooThinForSolid)。
 *    原本這個框在釘背模式下照樣顯示、勾了報價一毛不變,而且說明文字寫「不勾 =
 *    後板跟主材料同」跟實際相反 —— 使用者會以為網站壞掉,或照著這張單去買錯料。
 *    (2026-08-24 大軍稽核抓到)
 *
 * 修法是讓它**只在有意義的時候出現**,不是硬讓 3mm 實木背板變成可選。
 */
export const backPanelPlywoodOption: OptionSpec = {
  group: "structure",
  type: "checkbox",
  key: "backPanelPlywood",
  label: "後板改用夾板（省料）",
  defaultValue: false,
  wide: true,
  help: "勾起：後板計入夾板（省木材費）；不勾：後板跟主材料同（整體感最好）。※ 釘背（3mm）一律是夾板——市面沒有 3mm 的實木板。",
  dependsOn: { key: "backMode", equals: "rebated" },
};

export function backPanelMaterialNote(mat: string, mainMaterialLabel?: string): string {
  switch (mat) {
    case "inherit":
      return mainMaterialLabel
        ? `後板跟主材料同（${mainMaterialLabel}）實木拼板（>10mm），鑲入槽 + 浮動安裝（中間留縫吸收形變）。`
        : "後板跟主材料同，實木拼板（>10mm），鑲入槽 + 浮動安裝。";
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
        { all: [{ key: "upperType", equals: "drawer" }, { key: "layoutMode", notIn: ["h-2col", "h-3col"] }] },
        { all: [{ key: "leftType", equals: "drawer" }, { key: "layoutMode", oneOf: ["h-2col", "h-3col"] }] },
        { all: [{ key: "rightType", equals: "drawer" }, { key: "layoutMode", oneOf: ["h-2col", "h-3col"] }] },
        { all: [{ key: "centerType", equals: "drawer" }, { key: "layoutMode", equals: "h-3col" }] },
        { key: "layoutMode", equals: "v-2layer" },
        { key: "topType", equals: "door" },
        { key: "midType", equals: "door" },
        { key: "bottomType", equals: "door" },
        { all: [{ key: "upperType", equals: "door" }, { key: "layoutMode", notIn: ["h-2col", "h-3col"] }] },
        { all: [{ key: "leftType", equals: "door" }, { key: "layoutMode", oneOf: ["h-2col", "h-3col"] }] },
        { all: [{ key: "rightType", equals: "door" }, { key: "layoutMode", oneOf: ["h-2col", "h-3col"] }] },
        { all: [{ key: "centerType", equals: "door" }, { key: "layoutMode", equals: "h-3col" }] },
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
        { all: [{ key: "upperType", equals: "door" }, { key: "layoutMode", notIn: ["h-2col", "h-3col"] }] },
        { all: [{ key: "leftType", equals: "door" }, { key: "layoutMode", oneOf: ["h-2col", "h-3col"] }] },
        { all: [{ key: "rightType", equals: "door" }, { key: "layoutMode", oneOf: ["h-2col", "h-3col"] }] },
        { all: [{ key: "centerType", equals: "door" }, { key: "layoutMode", equals: "h-3col" }] },
      ],
    },
  };
}

export function pullStyleNote(style: string, locale: string = "zh-TW"): string {
  const isEn = locale === "en";
  switch (style) {
    case "knob":
      return isEn
        ? "Drawer / door brass round knob (Φ30mm, ~$1-3 each at hardware stores), centered or symmetric."
        : "抽屜 / 門板配黃銅圓把手（Φ30mm，B&Q 五金 NT$ 30-100/個），鎖在中央或對稱位置。";
    case "wood-knob":
      return isEn
        ? "Lathe-turned mushroom-shaped wood knob (Φ35mm × 28mm proud, turn it yourself). Same wood as the case, warm hand-feel, zero hardware cost."
        : "車床旋削木製蘑菇形 knob（Φ35mm × 凸 28mm，自家車床做），與櫃體同材手感溫潤、無金屬五金費。";
    case "bar":
      return isEn
        ? "Drawer / door bar pull (96/128/160mm sizes, ~$2-6 each). Common on modern pieces."
        : "抽屜 / 門板配長條把手（96/128/160mm 規格，NT$ 50-200/個），現代風常見。";
    case "ring-chinese":
      return isEn
        ? "Chinese-style antique brass ring pull (Φ38mm backplate + Φ30mm ring, proud 21mm, antiqued brass ~$5-12 each). Standard for Ming/Qing cabinet doors and drawers."
        : "中式古銅吊環（面葉 Φ38mm + 銅環 Φ30mm，凸出 21mm，黃銅古銅色 NT$ 150-400/組），明清櫃門 / 抽屜標配。";
    case "drop-bail":
      return isEn
        ? "Classical bail pull (Hepplewhite style, 76×60mm oval backplate + 22mm brass drop, proud 25mm, 64mm centers, ~$6-15 each). Standard for 18th-century English/American desks and chests."
        : "古典吊環（Hepplewhite bail pull，橢圓底座 76×60mm + 黃銅吊環垂 22mm，凸出 25mm，中心距 64mm，NT$ 200-500/組），18 世紀英美書桌 / 斗櫃標配。";
    case "finger-pull":
      return isEn
        ? "Crescent-shaped finger pull cut into the panel (80×25mm, 12mm deep). No exposed hardware — Scandinavian / Japanese minimalist."
        : "面板挖半月弧形指槽 80×25×深 12mm，無外露五金，北歐 / 日式極簡。";
    case "none":
      return isEn
        ? "No pulls fitted (display-only / customer to choose later)."
        : "不裝把手（純展示 / 客戶後續自選）。";
  }
  return "";
}


/**
 * 夾住「腳內縮」,避免牙條 / 橫撐被算成負長度。
 *
 * §A10.2 的 butt-joint 公式:
 *   `visible.length = length − 2×legSize − 2×legInset (+ 2×splay)`
 * doc 沒有給 legInset 的上限,而各模板 OptionSpec 的 max 是**寫死的常數**
 * (square-stool 200、bench/side-table/low-table 300、dining-table/desk 400),
 * 跟家具實際尺寸無關 → 小尺寸家具把滑桿拉大就會產出**負長度**的牙條與橫撐,
 * 而且完全沒有警告,負值一路流進材料單、裁切與報價。(2026-08-21 稽核發現。)
 *
 * ⚠️ 這裡夾的是**輸入**(內縮量)不是輸出(零件長度)。把長度夾成 0 只會生出一堆
 *    沒有厚度的鬼零件,使用者看不出哪裡不對;夾內縮量則是「拉到底就是貼著極限」,
 *    畫面上看得見、而且做得出來。呼應 2026-08-03「用限制代替修正」被打回的教訓。
 *
 * @param minSpanMm 牙條 / 橫撐至少要留的淨長。60mm 以下已經短到接不了榫。
 */
export function clampLegInset(
  legInset: number,
  o: { length: number; width: number; legW: number; legD: number; minSpanMm?: number },
): number {
  const min = o.minSpanMm ?? 60;
  const capX = (o.length - 2 * o.legW - min) / 2;
  const capZ = (o.width - 2 * o.legD - min) / 2;
  const cap = Math.min(capX, capZ);
  // cap < 0 = 這個尺寸連內縮 0 都放不下(家具本身太小),回 0 是能做的最好結果
  return Math.max(0, Math.min(legInset, cap));
}

/**
 * 同一「類」警告只印一次（key 是類別，不是整句）。
 *
 * 夾制觸發時要留痕（不然靜默修正就是另一個 bug），但全模板 × 全選項掃描會把
 * 同類警告印四千遍，CI log 直接被淹掉。訊息裡帶著實際尺寸所以整句去重沒用，
 * 要用類別當 key。
 */
const _warnedOnce = new Set<string>();
export function warnOnce(kind: string, msg: string): void {
  if (_warnedOnce.has(kind)) return;
  _warnedOnce.add(kind);
  console.warn(`${msg}（同類警告只印一次）`);
}
