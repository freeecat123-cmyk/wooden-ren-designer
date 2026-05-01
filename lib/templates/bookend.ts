import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

/** 三角加固板厚（恆 12mm，過厚反而難切斜邊） */
const BRACE_THICKNESS = 12;
/** 三角加固相對底深的最大占比 */
const BRACE_DEPTH_FRAC = 0.5;
/** 三角加固相對背高的最大占比 */
const BRACE_HEIGHT_FRAC = 0.4;
/** 帶肩榫的肩寬（每邊各內縮多少 mm） */
const TENON_SHOULDER = 4;

export const bookendOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板厚 (mm)", defaultValue: 18, min: 12, max: 30, step: 1, unit: "mm" },
  { group: "structure", type: "checkbox", key: "withBrace", label: "加三角加固", defaultValue: true, help: "底板與背板交界加三角支撐，避免重書壓彎" },
  { group: "structure", type: "number", key: "edgeChamfer", label: "邊緣倒角 (mm)", defaultValue: 2, min: 0, max: 8, step: 1, unit: "mm", help: "外露邊緣倒角，2-3mm 手感佳" },
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
  const o = bookendOptions;
  const panelT = getOption<number>(input, opt(o, "panelThickness"));
  const withBrace = getOption<boolean>(input, opt(o, "withBrace"));
  const edgeChamfer = getOption<number>(input, opt(o, "edgeChamfer"));

  // 背板貼底板後緣立起，本身高 = backHeight - 底板厚
  const backPanelH = backHeight - panelT;
  // 帶肩榫：榫長 = 底板厚（從背板下緣往底板裡插），寬 = 底板寬內縮 2× 肩寬
  const tenonW = Math.max(1, baseWidth - 2 * TENON_SHOULDER);

  // 底板沿世界 X = baseDepth（書方向，前後深度），世界 Z = baseWidth（沿書架）
  const base: Part = {
    id: "base",
    nameZh: "底板",
    material,
    grainDirection: "length",
    visible: { length: baseDepth, width: baseWidth, thickness: panelT },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [
      {
        // 背板榫眼開在底板「後緣」(世界 -X 端) 的中央
        origin: { x: -(baseDepth / 2 - panelT / 2), y: panelT, z: 0 },
        depth: panelT,
        length: tenonW,
        width: panelT - 2,
        through: false,
      },
    ],
  };

  // 背板立在底板的「後緣」(世界 -X)，沿世界 Z 跨滿整個 baseWidth，
  // 旋轉後板厚 panelT 落在世界 X 軸（厚度方向）。
  const back: Part = {
    id: "back",
    nameZh: "背板",
    material,
    grainDirection: "length",
    visible: { length: baseWidth, width: backPanelH, thickness: panelT },
    origin: { x: -(baseDepth / 2 - panelT / 2), y: panelT, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [
      {
        position: "bottom",
        type: "shouldered-tenon",
        length: panelT,
        width: tenonW,
        thickness: panelT - 2,
      },
    ],
    mortises: [],
  };

  const parts: Part[] = [base, back];
  const warnings: string[] = [];

  if (backPanelH <= 0) {
    warnings.push(`背板高度 ≤ 0：總高 ${backHeight}mm 小於板厚 ${panelT}mm。`);
  }

  if (withBrace) {
    const braceLeg = Math.min(baseDepth * BRACE_DEPTH_FRAC, backHeight * BRACE_HEIGHT_FRAC);
    // 三角加固（其實是矩形板）卡在「底板上面 + 背板前面」的角落，
    // 沿世界 X 從背板前面 (X=-baseDepth/2 + panelT) 往前延伸 braceLeg
    parts.push({
      id: "brace",
      nameZh: "三角加固",
      material,
      grainDirection: "length",
      visible: { length: braceLeg, width: braceLeg, thickness: BRACE_THICKNESS },
      origin: { x: -baseDepth / 2 + panelT + braceLeg / 2, y: panelT, z: 0 },
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
    defaultJoinery: "shouldered-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `書擋 ${baseDepth}×${baseWidth}×${backHeight}mm。底板與背板用帶肩榫接（榫長 ${panelT}mm、寬 ${tenonW}mm）。${withBrace ? "三角加固板斜切後膠合到 L 角內側，承重大大提升。" : ""}${edgeChamfer > 0 ? `所有外露邊緣倒 ${edgeChamfer}mm 防扎手。` : ""}**書擋一定一對使用**——本表是單件用量，下單請 ×2。`,
  };
  // max bounds
  if (baseDepth > 250 || baseWidth > 300 || backHeight > 350) {
    warnings.push(`書擋 ${baseDepth}×${baseWidth}×${backHeight}mm 超過合理範圍（max 250×300×350mm）。再大就不是書擋而是 L 型桌或小櫃`);
  }
  // 結構檢查
  if (panelT < 12 && backHeight > 200) {
    warnings.push(`板厚 ${panelT}mm 對 ${backHeight}mm 高背板太薄——重書壓久會彎，建議加厚到 15mm 以上`);
  }
  if (warnings.length) design.warnings = warnings;
  return design;
};
