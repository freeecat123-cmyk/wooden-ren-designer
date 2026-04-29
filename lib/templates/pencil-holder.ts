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
    { value: "miter", label: "斜角拼（45°，最隱形但要對齊）" },
  ] },
  { group: "structure", type: "number", key: "dividers", label: "內部隔板數", defaultValue: 0, min: 0, max: 3, step: 1, help: "0 = 整空筆筒；1-3 加直立隔板分區（鉛筆 / 筆 / 橡皮擦分開放）" },
  { group: "structure", type: "checkbox", key: "tiltedFront", label: "前低後高傾斜款", defaultValue: false, help: "前壁比後壁矮 30mm，鉛筆斜放看得清楚標籤", wide: true },
  { group: "structure", type: "number", key: "edgeChamfer", label: "頂緣倒角 (mm)", defaultValue: 1, min: 0, max: 8, step: 1, unit: "mm", help: "頂緣外側倒 1-3mm 防扎手，無倒角設 0" },
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
    | "finger-joint"
    | "miter";
  const dividers = getOption<number>(input, opt(o, "dividers"));
  const tiltedFront = getOption<boolean>(input, opt(o, "tiltedFront"));
  const edgeChamfer = getOption<number>(input, opt(o, "edgeChamfer"));

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    material,
    cornerJoinery: cornerJoinery === "miter" ? "stub-joint" : cornerJoinery,
    bottomFit: "grooved",
  });

  // 加內部直立隔板
  const dividerParts: typeof built.parts = [];
  if (dividers > 0) {
    const dividerSpacing = built.innerL / (dividers + 1);
    const dividerThick = wallT - 2;
    for (let i = 1; i <= dividers; i++) {
      dividerParts.push({
        id: `divider-${i}`,
        nameZh: `隔板 ${i}`,
        material,
        grainDirection: "length",
        visible: { length: built.innerW, width: outerH - botT, thickness: dividerThick },
        origin: {
          x: -built.innerL / 2 + i * dividerSpacing,
          y: botT,
          z: 0,
        },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  const design: FurnitureDesign = {
    id: `pencil-holder-${outerL}x${outerW}x${outerH}`,
    category: "pencil-holder",
    nameZh: "筆筒",
    overall: { length: outerL, width: outerW, thickness: outerH },
    parts: [...built.parts, ...dividerParts],
    defaultJoinery: cornerJoinery === "miter" ? "stub-joint" : cornerJoinery,
    primaryMaterial: material,
    notes: `筆筒 ${outerL}×${outerW}×${outerH}mm，${5 + dividers} 片實木組成。底板用槽接嵌入 4 壁內側下緣，4 角採${cornerJoinery === "finger-joint" ? "**指接**（外露指狀視覺，新手練習指接的最佳對象）" : cornerJoinery === "miter" ? "**斜角拼**（45° 對接，最隱形但需 45° 鋸台或斜切片切，膠合 + 細釘加固）" : "**搭接**（rabbet，最簡單，膠合即可）"}。內部 ${built.innerL}×${built.innerW}mm 約可放 ${Math.max(0, Math.floor((built.innerL * built.innerW) / 100))} 支筆。${dividers > 0 ? ` 內部 ${dividers} 片直立隔板分區。` : ""}${edgeChamfer > 0 ? ` 頂緣外側倒 ${edgeChamfer}mm 防扎手。` : ""}${tiltedFront ? " 前壁比後壁矮 30mm（鉛筆斜放看得清標籤）。" : ""}`,
  };
  // 傾斜款：前壁矮 30mm
  if (tiltedFront) {
    const frontWall = design.parts.find((p) => p.id === "wall-front");
    if (frontWall) {
      frontWall.visible = { ...frontWall.visible, width: Math.max(20, frontWall.visible.width - 30) };
    }
  }

  if (built.warnings.length) design.warnings = [...built.warnings];
  // 結構檢查 + max bounds
  const warnings: string[] = [];
  if (outerL > 200 || outerW > 200 || outerH > 250) {
    warnings.push(`筆筒 ${outerL}×${outerW}×${outerH}mm 超過合理範圍（max 200×200×250mm）。再大就比較像鳩尾盒——考慮改用鳩尾盒模板`);
    design.suggestions = [{
      text: `${outerL}×${outerW}×${outerH}mm 已超過筆筒範圍——鳩尾盒模板支援更大的盒體 + 鳩尾接合選項。`,
      suggestedCategory: "dovetail-box",
      presetParams: { length: String(outerL), width: String(outerW), height: String(outerH), material },
    }];
  }
  if (warnings.length) design.warnings = [...(design.warnings ?? []), ...warnings];
  return design;
};
