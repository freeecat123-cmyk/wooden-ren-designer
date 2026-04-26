import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

export const trayOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "wallHeight", label: "圍邊高 (mm)", defaultValue: 50, min: 25, max: 120, step: 5, unit: "mm" },
  { group: "structure", type: "number", key: "wallThickness", label: "圍邊厚 (mm)", defaultValue: 12, min: 8, max: 20, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底板厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "checkbox", key: "withHandles", label: "加握把孔", defaultValue: true, help: "兩端短邊各挖一個 80×25mm 橢圓孔當握把" },
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
  const withHandles = getOption<boolean>(input, opt(o, "withHandles"));

  const innerL = outerL - 2 * wallT;
  const innerW = outerW - 2 * wallT;

  const bottom: Part = {
    id: "bottom",
    nameZh: "底板",
    material,
    grainDirection: "length",
    visible: { length: outerL, width: outerW, thickness: botT },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [],
  };

  // 長邊圍邊：完整 outerL，沿 X 軸
  const front: Part = {
    id: "wall-front",
    nameZh: "前圍邊",
    material,
    grainDirection: "length",
    visible: { length: outerL, width: wallH, thickness: wallT },
    origin: { x: 0, y: botT, z: -(outerW / 2 - wallT / 2) },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [],
    mortises: [],
  };
  const back: Part = {
    ...front,
    id: "wall-back",
    nameZh: "後圍邊",
    origin: { x: 0, y: botT, z: outerW / 2 - wallT / 2 },
  };

  // 短邊圍邊：扣掉長邊厚度，沿 Z 軸
  const left: Part = {
    id: "wall-left",
    nameZh: "左短邊（含握把）",
    material,
    grainDirection: "length",
    visible: { length: innerW, width: wallH, thickness: wallT },
    origin: { x: -(outerL / 2 - wallT / 2), y: botT, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: [],
  };
  const right: Part = {
    ...left,
    id: "wall-right",
    nameZh: "右短邊（含握把）",
    origin: { x: outerL / 2 - wallT / 2, y: botT, z: 0 },
  };

  return {
    id: `tray-${outerL}x${outerW}`,
    category: "tray",
    nameZh: "托盤",
    overall: { length: outerL, width: outerW, thickness: botT + wallH },
    parts: [bottom, front, back, left, right],
    defaultJoinery: "dovetail",
    primaryMaterial: material,
    notes: `托盤 ${outerL}×${outerW}mm（圍邊高 ${wallH}mm）。底板與圍邊接合用槽接（grooved bottom）—— 圍邊內側下緣鋸 8×8mm 槽，底板四邊鋸鑲入。4 角接合用鳩尾榫最美觀，半搭接也可。${withHandles ? `**短邊握把**：在兩端短邊上緣中央挖 80×25mm 橢圓孔，邊緣倒 R5 圓角好握。` : ""}托盤是入門 → 中階銜接的最佳練習：用到拼板、鳩尾、刨削、收邊倒角，一件做完所有基本功都會。`,
  };
};
