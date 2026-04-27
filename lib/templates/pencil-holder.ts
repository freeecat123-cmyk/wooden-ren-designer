import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";

export const pencilHolderOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "cornerJoinery", label: "角接合方式", defaultValue: "stub-joint", choices: [
    { value: "stub-joint", label: "搭接（rabbet，最簡單）" },
    { value: "finger-joint", label: "指接（finger joint，外露指狀）" },
  ] },
];

/**
 * 筆筒 — 5 片板組成的方盒（4 壁 + 底）
 * input: 外尺寸（長×寬×高）
 */
export const pencilHolder: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, height: outerH, material } = input;
  const o = pencilHolderOptions;
  const wallT = getOption<number>(input, opt(o, "wallThickness"));
  const botT = getOption<number>(input, opt(o, "bottomThickness"));
  const cornerJoinery = getOption<string>(input, opt(o, "cornerJoinery")) as
    | "stub-joint"
    | "finger-joint";

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    material,
    cornerJoinery,
    bottomFit: "grooved",
  });

  const design: FurnitureDesign = {
    id: `pencil-holder-${outerL}x${outerW}x${outerH}`,
    category: "pencil-holder",
    nameZh: "筆筒",
    overall: { length: outerL, width: outerW, thickness: outerH },
    parts: built.parts,
    defaultJoinery: cornerJoinery,
    primaryMaterial: material,
    notes: `筆筒 ${outerL}×${outerW}×${outerH}mm，5 片實木組成。底板用槽接嵌入 4 壁內側下緣，4 角採${cornerJoinery === "finger-joint" ? "**指接**（外露指狀視覺，新手練習指接的最佳對象）" : "**搭接**（rabbet，最簡單，膠合即可）"}。內部 ${built.innerL}×${built.innerW}mm 約可放 ${Math.max(0, Math.floor((built.innerL * built.innerW) / 100))} 支筆。`,
  };
  if (built.warnings.length) design.warnings = [...built.warnings];
  return design;
};
