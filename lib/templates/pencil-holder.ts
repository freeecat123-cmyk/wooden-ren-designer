import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

export const pencilHolderOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
];

/**
 * 筆筒 — 5 片板組成的方盒（4 壁 + 底）
 * input: 外尺寸（長×寬×高）
 */
export const pencilHolder: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, height, material } = input;
  const o = pencilHolderOptions;
  const wallT = getOption<number>(input, opt(o, "wallThickness"));
  const botT = getOption<number>(input, opt(o, "bottomThickness"));

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

  const front: Part = {
    id: "wall-front",
    nameZh: "前壁",
    material,
    grainDirection: "length",
    visible: { length: outerL, width: height - botT, thickness: wallT },
    origin: { x: 0, y: botT, z: -(outerW / 2 - wallT / 2) },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [],
    mortises: [],
  };

  const back: Part = {
    ...front,
    id: "wall-back",
    nameZh: "後壁",
    origin: { x: 0, y: botT, z: outerW / 2 - wallT / 2 },
  };

  const left: Part = {
    id: "wall-left",
    nameZh: "左壁",
    material,
    grainDirection: "length",
    visible: { length: innerW, width: height - botT, thickness: wallT },
    origin: { x: -(outerL / 2 - wallT / 2), y: botT, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: [],
  };

  const right: Part = {
    ...left,
    id: "wall-right",
    nameZh: "右壁",
    origin: { x: outerL / 2 - wallT / 2, y: botT, z: 0 },
  };

  return {
    id: `pencil-holder-${outerL}x${outerW}x${height}`,
    category: "pencil-holder",
    nameZh: "筆筒",
    overall: { length: outerL, width: outerW, thickness: height },
    parts: [bottom, front, back, left, right],
    defaultJoinery: "tongue-and-groove",
    primaryMaterial: material,
    notes: `筆筒 ${outerL}×${outerW}×${height}mm，5 片實木組成。建議底板用企口槽嵌入 4 壁，4 壁角落可用 finger joint 或 rabbet 簡單接合。內部空間 ${innerL}×${innerW}mm 約可放 ${Math.floor((innerL * innerW) / 100)} 支筆。`,
  };
};
