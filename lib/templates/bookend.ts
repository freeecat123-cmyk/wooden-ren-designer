import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { formatMm } from "@/lib/units/format";

/** 三角加固板厚（恆 12mm，過厚反而難切斜邊） */
const BRACE_THICKNESS = 12;
/** 三角加固相對底深的最大占比 */
const BRACE_DEPTH_FRAC = 0.7;
/** 三角加固相對背高的最大占比 */
const BRACE_HEIGHT_FRAC = 0.6;
/** 帶肩榫的肩寬（每邊各內縮多少 mm） */
const TENON_SHOULDER = 4;

export const bookendOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板厚", defaultValue: 18, min: 12, max: 30, step: 1, unit: "mm", help: "輕書/設計感 15mm；標準 18mm；撐字典/年鑑 25mm" },
  { group: "structure", type: "checkbox", key: "withBrace", label: "加三角加固", defaultValue: true, help: "底板與背板交界加直角三角支撐，避免重書壓彎" },
];

/**
 * 書擋 — L 型結構（底板 + 背板）+ 選用三角加固
 * input: 底板長 × 底板深 × 背板高
 *   length = 底板深度（書方向）
 *   width  = 底板寬度（順書架方向）
 *   height = 背板高度
 *
 * 書擋一定一對使用——overall 是「單件」尺寸，材料/工時 ×2 才是實際需求。
 */
export const bookend: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: baseDepth, width: baseWidth, height: backHeight, material } = input;
  const locale = input.locale ?? "zh-TW";
  const isEn = locale === "en";
  const o = bookendOptions;
  const panelT = getOption<number>(input, opt(o, "panelThickness"));
  const withBrace = getOption<boolean>(input, opt(o, "withBrace"));

  // 預設組裝版幾何（直角對接，乾淨好看）：
  // - 底板 X∈[-60,+60] Y∈[0, panelT]、整片方板
  // - 背板沿後緣立起，Y∈[panelT, backHeight]，origin.y=panelT
  // 榫接版（joineryView 覆寫）露出 45° miter：兩塊板都套 mitered-corner shape，
  // 背板延伸到 Y=0 涵蓋重疊區後再削掉前下角，外觀接續成連續 L。
  const backPanelH = backHeight - panelT;
  const tenonW = Math.max(1, baseWidth - 2 * TENON_SHOULDER); // spline 寬度 baseline

  const base: Part = {
    id: "base",
    nameZh: "底板",
    nameEn: "Base panel",
    material,
    grainDirection: "length",
    visible: { length: baseDepth, width: baseWidth, thickness: panelT },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [],
    joineryView: {
      shape: { kind: "mitered-corner", axis: "z", corner: "-+", depthMm: panelT },
    },
  };

  const back: Part = {
    id: "back",
    nameZh: "背板",
    nameEn: "Back panel",
    material,
    grainDirection: "length",
    visible: { length: baseWidth, width: backPanelH, thickness: panelT },
    origin: { x: -(baseDepth / 2 - panelT / 2), y: panelT, z: 0 },
    // 雙軸 Rx(π/2)·Ry(π/2)：把橫躺板（visible.width=backPanelH 沿 Z 軸）扶正
    // → backPanelH 變世界 +Y（垂直立板）、baseWidth 變世界 Z、panelT 變世界 X。
    // 形成書擋 L 型 silhouette。曾在 b8c84c4 改成單軸 Ry 變回平躺，已 revert。
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: [],
    joineryView: {
      // 榫接版：背板延伸到 Y=0 + 前下角 45° miter
      visible: { length: baseWidth, width: backHeight, thickness: panelT },
      origin: { x: -(baseDepth / 2 - panelT / 2), y: 0, z: 0 },
      shape: { kind: "mitered-corner", axis: "x", corner: "++", depthMm: panelT },
    },
  };

  const parts: Part[] = [base, back];
  const warnings: string[] = [];

  if (backPanelH <= 0) {
    warnings.push(
      isEn
        ? `Back panel height ≤ 0: overall height ${backHeight} mm is less than panel thickness ${panelT} mm.`
        : `背板高度 ≤ 0：總高 ${backHeight}mm 小於板厚 ${panelT}mm。`,
    );
  }

  if (withBrace) {
    const braceLeg = Math.min(baseDepth * BRACE_DEPTH_FRAC, backHeight * BRACE_HEIGHT_FRAC);
    // 三角加固卡在「底板上面 + 背板前面」的角落
    parts.push({
      id: "brace",
      nameZh: "三角加固",
      nameEn: "Triangle brace",
      material,
      grainDirection: "length",
      visible: { length: braceLeg, width: braceLeg, thickness: BRACE_THICKNESS },
      // 直角三角形卡 base 上面 + back 前面的角落，跟雙軸 back panel 對齊。
      origin: { x: -baseDepth / 2 + panelT + braceLeg / 2, y: panelT, z: 0 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      shape: { kind: "right-triangle", corner: "-x+z" },
      tenons: [],
      mortises: [],
    });
  }

  const design: FurnitureDesign = {
    id: `bookend-${baseDepth}x${baseWidth}x${backHeight}`,
    category: "bookend",
    nameZh: "書擋（一對）",
    overall: { length: baseDepth, width: baseWidth, thickness: backHeight },
    parts,
    defaultJoinery: "mitered-spline",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: isEn
      ? `Bookend ${formatMm(baseDepth, "inch")}×${formatMm(baseWidth, "inch")}×${formatMm(backHeight, "inch")}. Base and back join with a **45° miter + hidden spline**: chamfer the top-rear edge of the base and the bottom-front edge of the back at ${formatMm(panelT, "inch")} × 45°, so the seam disappears once mated; cut a 6×40mm spline groove down the center of both faces and glue in a straight-grain spline (grain running across the short axis) — keeps the corner aligned and resists peeling.${withBrace ? " A right-angle triangular brace on the inside of the L corner adds serious load capacity." : ""} **Bookends always come in pairs** — this cut list is per piece; order ×2.`
      : `書擋 ${baseDepth}×${baseWidth}×${backHeight}mm。底板與背板用 **45° miter + spline 暗榫**接：底板後緣上頂面、背板前緣下底面各斜切 ${panelT}mm × 45°，對接後縫隙完全隱形；接合面中央開 6×40mm spline 凹槽，內嵌片榫（直紋木條沿短邊方向）膠合 → 既對齊又抗剝離。${withBrace ? "L 角內側再加直角三角加固，承重大幅提升。" : ""}**書擋一定一對使用**——本表是單件用量，下單請 ×2。`,
  };
  if (baseDepth > 250 || baseWidth > 300 || backHeight > 350) {
    warnings.push(
      isEn
        ? `Bookend ${baseDepth}×${baseWidth}×${backHeight} mm exceeds reasonable range (max 250×300×350 mm). Larger than this is no longer a bookend but an L-shaped desk or small cabinet.`
        : `書擋 ${baseDepth}×${baseWidth}×${backHeight}mm 超過合理範圍（max 250×300×350mm）。再大就不是書擋而是 L 型桌或小櫃`,
    );
  }
  if (panelT < 12 && backHeight > 200) {
    warnings.push(
      isEn
        ? `Panel ${panelT} mm vs ${backHeight} mm tall back is too thin — heavy books will bend it over time; recommend ≥ 15 mm.`
        : `板厚 ${panelT}mm 對 ${backHeight}mm 高背板太薄——重書壓久會彎，建議加厚到 15mm 以上`,
    );
  }
  if (warnings.length) design.warnings = warnings;
  return design;
};
