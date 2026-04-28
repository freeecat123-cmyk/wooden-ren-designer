import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

/** 背板裝入時相對玻璃的擴大量（每邊 mm，預留卡入裕度） */
const BACK_PANEL_CLEARANCE = 4;
/** 玻璃槽內縮量（讓玻璃不會從正面看到槽口） */
const GLASS_FRAME_INSET = 2;

export const photoFrameOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "frameWidth", label: "邊框寬 (mm)", defaultValue: 25, min: 15, max: 60, step: 1, unit: "mm", help: "邊框面寬度（從照片邊緣往外的木料寬）" },
  { group: "structure", type: "number", key: "frameThickness", label: "邊框厚 (mm)", defaultValue: 18, min: 12, max: 30, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "backThickness", label: "背板厚 (mm)", defaultValue: 4, min: 3, max: 8, step: 1, unit: "mm", help: "三合板或卡紙板背板厚度" },
  { group: "structure", type: "number", key: "glassThickness", label: "玻璃厚 (mm)", defaultValue: 2, min: 2, max: 4, step: 1, unit: "mm", help: "玻璃行標準切片，2mm 透明玻璃最常用" },
  { group: "structure", type: "number", key: "glassGrooveDepth", label: "玻璃槽深 (mm)", defaultValue: 8, min: 5, max: 12, step: 1, unit: "mm", help: "邊框內側鋸槽深度（4 邊都鋸），玻璃 + 背板 + 一點裕度" },
  { group: "structure", type: "select", key: "frameProfile", label: "邊框輪廓", defaultValue: "flat", choices: [
    { value: "flat", label: "平面（最簡單）" },
    { value: "chamfer-out", label: "外緣 45° 倒角" },
    { value: "chamfer-in", label: "內緣斜面（朝照片方向斜下）" },
    { value: "ogee", label: "古典 Ogee 線（雙曲線）" },
    { value: "cove", label: "凹弧 Cove（內凹圓弧）" },
  ], help: "邊框正面輪廓樣式。平面最簡單；其他需修邊機 + 對應曲線刀" },
  { group: "structure", type: "select", key: "cornerJoint", label: "邊框角接合", defaultValue: "mitered-spline", choices: [
    { value: "mitered-spline", label: "45° 斜接 + 花榫片（spline，最穩）" },
    { value: "butt", label: "對接（butt joint，最簡單但強度最弱）" },
    { value: "half-lap", label: "半搭接（half-lap，承重佳適合大框）" },
  ], help: "邊框 4 角接合方式。spline 是相框經典做法，補強純斜接的弱點" },
  { group: "structure", type: "select", key: "multiPhotoLayout", label: "多照片排列", defaultValue: "single", choices: [
    { value: "single", label: "單張" },
    { value: "horizontal-2", label: "橫排 2 張（共用中間隔板）" },
    { value: "horizontal-3", label: "橫排 3 張" },
    { value: "vertical-2", label: "直排 2 張" },
    { value: "grid-4", label: "田字 4 格" },
  ], help: "多照片組合相框，需在邊框內加 mullion（中央隔條），每格獨立放照片" },
  { group: "structure", type: "select", key: "stand", label: "立架／吊掛", defaultValue: "easel", choices: [
    { value: "easel", label: "立架（背面 V 型支撐板，立桌面）" },
    { value: "wall-hung", label: "吊掛式（背面 D 形勾或鋸齒鈎）" },
    { value: "both", label: "兩用（立架可摺收 + 吊掛勾）" },
  ], help: "立架最常見，吊掛適合走廊牆面，兩用最彈性" },
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
  const glassT = getOption<number>(input, opt(o, "glassThickness"));
  const glassGrooveDepth = getOption<number>(input, opt(o, "glassGrooveDepth"));
  const frameProfile = getOption<string>(input, opt(o, "frameProfile"));
  const cornerJoint = getOption<string>(input, opt(o, "cornerJoint"));
  const multiPhotoLayout = getOption<string>(input, opt(o, "multiPhotoLayout"));
  const stand = getOption<string>(input, opt(o, "stand"));

  // 整框外尺寸 = 照片 + 兩側邊框
  const outerL = photoW + 2 * frameW;
  const outerW = photoH + 2 * frameW;

  // 上下橫邊：完整 outerL
  const topRail: Part = {
    id: "frame-top",
    nameZh: "上邊框",
    material,
    grainDirection: "length",
    visible: { length: outerL, width: frameW, thickness: frameT },
    origin: { x: 0, y: 0, z: outerW / 2 - frameW / 2 },
    tenons: [
      { position: "start", type: "mitered-spline", length: frameT, width: frameW, thickness: 4 },
      { position: "end", type: "mitered-spline", length: frameT, width: frameW, thickness: 4 },
    ],
    mortises: [],
  };
  const bottomRail: Part = {
    ...topRail,
    id: "frame-bottom",
    nameZh: "下邊框",
    origin: { x: 0, y: 0, z: -(outerW / 2 - frameW / 2) },
  };

  // 左右立邊：扣掉上下邊厚度（45° 斜接後接觸線在外角）
  const sideLen = outerW - 2 * frameW;
  const leftRail: Part = {
    id: "frame-left",
    nameZh: "左邊框",
    material,
    grainDirection: "length",
    visible: { length: sideLen, width: frameW, thickness: frameT },
    origin: { x: -(outerL / 2 - frameW / 2), y: 0, z: 0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    tenons: [
      { position: "start", type: "mitered-spline", length: frameT, width: frameW, thickness: 4 },
      { position: "end", type: "mitered-spline", length: frameT, width: frameW, thickness: 4 },
    ],
    mortises: [],
  };
  const rightRail: Part = {
    ...leftRail,
    id: "frame-right",
    nameZh: "右邊框",
    origin: { x: outerL / 2 - frameW / 2, y: 0, z: 0 },
  };

  // 玻璃（visual: glass 不入材積、不出材料單）
  const glass: Part = {
    id: "glass",
    nameZh: "玻璃",
    material,
    visual: "glass",
    grainDirection: "length",
    visible: { length: photoW, width: photoH, thickness: glassT },
    origin: { x: 0, y: frameT - glassGrooveDepth - glassT, z: 0 },
    tenons: [],
    mortises: [],
  };

  // 背板（夾板，槽接從後方滑入，比照片大 BACK_PANEL_CLEARANCE 一圈）
  const backPanel: Part = {
    id: "back-panel",
    nameZh: "背板（夾板）",
    material,
    materialOverride: "plywood",
    grainDirection: "length",
    visible: {
      length: photoW + 2 * BACK_PANEL_CLEARANCE,
      width: photoH + 2 * BACK_PANEL_CLEARANCE,
      thickness: backT,
    },
    origin: { x: 0, y: frameT - backT, z: 0 },
    tenons: [],
    mortises: [],
  };

  const warnings: string[] = [];
  if (photoW > 800 || photoH > 800) {
    warnings.push(`相框照片 ${photoW}×${photoH}mm 超過 800mm（最大）——大尺寸玻璃易破，建議改用壓克力或拆成多框拼接`);
  }
  if (frameW > photoW * 0.3 || frameW > photoH * 0.3) {
    warnings.push(`邊框寬 ${frameW}mm 占照片邊長 > 30%，視覺比例失衡。建議邊框寬不超過照片短邊的 1/4`);
  }

  return {
    id: `photo-frame-${photoW}x${photoH}`,
    category: "photo-frame",
    nameZh: "相框",
    overall: { length: outerL, width: outerW, thickness: frameT },
    parts: [topRail, bottomRail, leftRail, rightRail, glass, backPanel],
    defaultJoinery: "mitered-spline",
    primaryMaterial: material,
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: `相框（裝 ${photoW}×${photoH}mm 照片），外尺寸 ${outerL}×${outerW}×${frameT}mm。4 條邊框內側鋸 ${glassGrooveDepth}×${glassT + backT + 2}mm 凹槽放玻璃 + 背板（從後方滑入）。4 角 45° 斜接 + 插花榫片（spline）補強——純斜接膠合強度不夠。${frameProfile === "chamfer-out" ? `邊框正面外緣 45° 倒角（修邊機 V 型刀）。` : frameProfile === "chamfer-in" ? `邊框正面內緣斜面下垂（修邊機 chamfer 刀）。` : frameProfile === "ogee" ? `邊框正面 Ogee 古典線型（修邊機 Ogee 線刀）。` : frameProfile === "cove" ? `邊框正面凹弧 Cove（修邊機 Cove 刀）。` : ""}${stand === "easel" ? ` 背面加 V 型立架（鉸鏈 + 摺收支撐板，立桌面用）。` : stand === "wall-hung" ? ` 背面加 D 形掛勾或鋸齒鈎（吊牆用）。` : ` 兩用：背面同時加可摺立架 + 掛勾。`}${cornerJoint === "butt" ? "4 角對接（butt joint，最簡單，膠合即可，承重弱）。" : cornerJoint === "half-lap" ? "4 角半搭接（half-lap，承重佳，做大框用）。" : ""}${multiPhotoLayout !== "single" ? ` 多照片排列：${multiPhotoLayout}（邊框內加 mullion 隔條、每格獨立鋸槽放照片）。` : ""} **玻璃自備**：到玻璃行裁 ${photoW}×${photoH}mm × ${glassT}mm 厚透明玻璃；玻璃槽內縮 ${GLASS_FRAME_INSET}mm 確保正面看不到槽口。`,
  };
};
