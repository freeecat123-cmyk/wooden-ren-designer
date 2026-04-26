import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

export const photoFrameOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "frameWidth", label: "邊框寬 (mm)", defaultValue: 25, min: 15, max: 60, step: 1, unit: "mm", help: "邊框面寬度（從照片邊緣往外的木料寬）" },
  { group: "structure", type: "number", key: "frameThickness", label: "邊框厚 (mm)", defaultValue: 18, min: 12, max: 30, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "backThickness", label: "背板厚 (mm)", defaultValue: 4, min: 3, max: 8, step: 1, unit: "mm", help: "三合板或卡紙板背板厚度" },
];

/**
 * 相框 — 4 條邊框 45° 斜接 + 玻璃 + 背板
 * input: length = 照片寬, width = 照片高, height 不用（總厚 = 邊框厚）
 */
export const photoFrame: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: photoW, width: photoH, material } = input;
  const o = photoFrameOptions;
  const frameW = getOption<number>(input, opt(o, "frameWidth"));
  const frameT = getOption<number>(input, opt(o, "frameThickness"));
  const backT = getOption<number>(input, opt(o, "backThickness"));

  // 整框外尺寸 = 照片 + 兩側邊框
  const outerL = photoW + 2 * frameW;
  const outerW = photoH + 2 * frameW;

  // 4 條邊框（45° 斜接，body 長 = 對應外邊長）
  // 上下橫邊：length = outerL，width = frameW（從外邊往內），thickness = frameT
  const topRail: Part = {
    id: "frame-top",
    nameZh: "上邊框",
    material,
    grainDirection: "length",
    visible: { length: outerL, width: frameW, thickness: frameT },
    origin: { x: 0, y: 0, z: outerW / 2 - frameW / 2 },
    tenons: [],
    mortises: [],
  };
  const bottomRail: Part = {
    ...topRail,
    id: "frame-bottom",
    nameZh: "下邊框",
    origin: { x: 0, y: 0, z: -(outerW / 2 - frameW / 2) },
  };
  // 左右立邊：扣掉上下邊厚度（或直接用外高）—— 45 度切後實際長就是 outerW
  // 這裡用內側長度避免 45° 視覺誤差
  const sideLen = outerW - 2 * frameW;
  const leftRail: Part = {
    id: "frame-left",
    nameZh: "左邊框",
    material,
    grainDirection: "length",
    visible: { length: sideLen, width: frameW, thickness: frameT },
    origin: { x: -(outerL / 2 - frameW / 2), y: 0, z: 0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: [],
  };
  const rightRail: Part = {
    ...leftRail,
    id: "frame-right",
    nameZh: "右邊框",
    origin: { x: outerL / 2 - frameW / 2, y: 0, z: 0 },
  };

  // 背板（三合板，蓋住整個照片區 + 內框溝槽）
  const backPanel: Part = {
    id: "back-panel",
    nameZh: "背板（夾板）",
    material,
    materialOverride: "plywood",
    grainDirection: "length",
    visible: { length: photoW + 4, width: photoH + 4, thickness: backT },
    origin: { x: 0, y: frameT - backT, z: 0 },
    tenons: [],
    mortises: [],
  };

  return {
    id: `photo-frame-${photoW}x${photoH}`,
    category: "photo-frame",
    nameZh: "相框",
    overall: { length: outerL, width: outerW, thickness: frameT },
    parts: [topRail, bottomRail, leftRail, rightRail, backPanel],
    defaultJoinery: "mitered-spline",
    primaryMaterial: material,
    notes: `相框（裝 ${photoW}×${photoH}mm 照片），外尺寸 ${outerL}×${outerW}×${frameT}mm。4 條邊框內側鋸 8×4mm 凹槽放玻璃 + 背板（從後方滑入）。4 角 45° 斜接，建議插花榫片（spline）補強——純斜接膠合強度不夠，下次搬家就鬆了。**玻璃自備**（厚 2mm 透明玻璃，到玻璃行裁 ${photoW}×${photoH}mm）。`,
  };
};
