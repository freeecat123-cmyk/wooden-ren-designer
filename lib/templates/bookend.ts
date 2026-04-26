import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

export const bookendOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板厚 (mm)", defaultValue: 18, min: 12, max: 30, step: 1, unit: "mm" },
  { group: "structure", type: "checkbox", key: "withBrace", label: "加三角加固", defaultValue: true, help: "底板與背板交界加三角支撐，避免重書壓彎" },
];

/**
 * 書擋 — L 型結構（底板 + 背板）+ 選用三角加固
 * input: 底板長 × 底板深 × 背板高
 *   length = 底板深度（書方向）
 *   width  = 底板寬度（順書架方向）
 *   height = 背板高度
 */
export const bookend: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: baseDepth, width: baseWidth, height: backHeight, material } = input;
  const o = bookendOptions;
  const panelT = getOption<number>(input, opt(o, "panelThickness"));
  const withBrace = getOption<boolean>(input, opt(o, "withBrace"));

  const base: Part = {
    id: "base",
    nameZh: "底板",
    material,
    grainDirection: "length",
    visible: { length: baseDepth, width: baseWidth, thickness: panelT },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [],
  };

  // 背板立在底板後緣，本身高 = backHeight - panelT (扣底板厚度)
  const back: Part = {
    id: "back",
    nameZh: "背板",
    material,
    grainDirection: "length",
    visible: { length: baseWidth, width: backHeight - panelT, thickness: panelT },
    origin: { x: 0, y: panelT, z: -(baseDepth / 2 - panelT / 2) },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: [],
  };

  const parts: Part[] = [base, back];

  if (withBrace) {
    // 三角加固板：直角三角形，水平短邊靠底板、垂直短邊靠背板
    const braceLeg = Math.min(baseDepth * 0.5, backHeight * 0.4);
    parts.push({
      id: "brace",
      nameZh: "三角加固",
      material,
      grainDirection: "length",
      visible: { length: braceLeg, width: braceLeg, thickness: 12 },
      origin: { x: 0, y: panelT, z: -(baseDepth / 2 - panelT - braceLeg / 2) },
      tenons: [],
      mortises: [],
      // 形狀渲染為 box（簡化），實際製作時切成直角三角形
    });
  }

  return {
    id: `bookend-${baseDepth}x${baseWidth}x${backHeight}`,
    category: "bookend",
    nameZh: "書擋（一對）",
    overall: { length: baseDepth, width: baseWidth, thickness: backHeight },
    parts,
    defaultJoinery: "shouldered-tenon",
    primaryMaterial: material,
    notes: `書擋一對 ${baseDepth}×${baseWidth}×${backHeight}mm。底板與背板用帶肩榫接（或鳩尾接更傳統）。${withBrace ? "三角加固板斜切後膠合到 L 角內側，承重大大提升。" : ""}**請做 2 件**——書擋本身一定一對，下方切料表是單件用量，一對請 ×2。`,
  };
};
