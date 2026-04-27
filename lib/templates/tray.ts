import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";

export const trayOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "wallHeight", label: "圍邊高 (mm)", defaultValue: 50, min: 25, max: 120, step: 5, unit: "mm" },
  { group: "structure", type: "number", key: "wallThickness", label: "圍邊厚 (mm)", defaultValue: 12, min: 8, max: 20, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底板厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "cornerJoinery", label: "角接合方式", defaultValue: "finger-joint", choices: [
    { value: "finger-joint", label: "指接（finger joint，外露指狀，托盤經典）" },
    { value: "dovetail", label: "鳩尾（更高階，視覺最美）" },
    { value: "stub-joint", label: "搭接（rabbet，最簡單）" },
  ] },
  { group: "structure", type: "checkbox", key: "withHandles", label: "加握把孔", defaultValue: true, help: "兩端短邊各挖一個橢圓孔當握把" },
  { group: "structure", type: "number", key: "handleWidth", label: "握把孔寬 (mm)", defaultValue: 80, min: 60, max: 120, step: 5, unit: "mm", dependsOn: { key: "withHandles" } },
  { group: "structure", type: "number", key: "handleHeight", label: "握把孔高 (mm)", defaultValue: 25, min: 18, max: 35, step: 1, unit: "mm", dependsOn: { key: "withHandles" } },
];

/**
 * 托盤 — 底板 + 4 圍邊（選用握把孔）
 * input: length × width = 托盤外尺寸（俯視），height 不用
 */
export const tray: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, material } = input;
  const o = trayOptions;
  const wallH = getOption<number>(input, opt(o, "wallHeight"));
  const wallT = getOption<number>(input, opt(o, "wallThickness"));
  const botT = getOption<number>(input, opt(o, "bottomThickness"));
  const cornerJoinery = getOption<string>(input, opt(o, "cornerJoinery")) as
    | "finger-joint"
    | "dovetail"
    | "stub-joint";
  const withHandles = getOption<boolean>(input, opt(o, "withHandles"));
  const handleW = getOption<number>(input, opt(o, "handleWidth"));
  const handleH = getOption<number>(input, opt(o, "handleHeight"));

  const built = buildBox({
    outerL,
    outerW,
    outerH: botT + wallH,
    wallT,
    botT,
    material,
    cornerJoinery,
    bottomFit: "grooved",
  });

  // 修正左右壁名稱以符合托盤習慣
  for (const p of built.parts) {
    if (p.id === "wall-left" && withHandles) p.nameZh = "左短邊（含握把）";
    if (p.id === "wall-right" && withHandles) p.nameZh = "右短邊（含握把）";
    if (p.id === "wall-front") p.nameZh = "前圍邊";
    if (p.id === "wall-back") p.nameZh = "後圍邊";
  }

  const cornerLabel =
    cornerJoinery === "dovetail"
      ? "鳩尾榫"
      : cornerJoinery === "finger-joint"
      ? "指接（finger joint）"
      : "搭接（rabbet）";

  const design: FurnitureDesign = {
    id: `tray-${outerL}x${outerW}`,
    category: "tray",
    nameZh: "托盤",
    overall: { length: outerL, width: outerW, thickness: botT + wallH },
    parts: built.parts,
    defaultJoinery: cornerJoinery,
    primaryMaterial: material,
    notes: `托盤 ${outerL}×${outerW}mm（圍邊高 ${wallH}mm）。底板與圍邊用槽接（圍邊內側下緣鋸 ${botT}×${botT}mm 槽）。4 角 ${cornerLabel}。${withHandles ? `**短邊握把**：兩端短邊上緣中央挖 ${handleW}×${handleH}mm 橢圓孔，邊緣倒 R5 圓角好握。` : ""}托盤是入門到中階的銜接練習：拼板、${cornerJoinery === "dovetail" ? "鳩尾" : cornerJoinery === "finger-joint" ? "指接" : "搭接"}、刨削、收邊倒角，一件做完所有基本功都會。`,
  };
  if (built.warnings.length) design.warnings = built.warnings;
  return design;
};
