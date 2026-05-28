import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { autoTenonType, standardTenon } from "@/lib/joinery/standards";

/** 背板卡入裕度（rabbet 深度減此值 = 實際 overlap，每邊 mm）：1mm 留滑入餘量 */
const BACK_PANEL_CLEARANCE = 1;
/** 玻璃槽內縮量（讓玻璃不會從正面看到槽口） */
const GLASS_FRAME_INSET = 2;

export const photoFrameOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "frameWidth", label: "邊框寬 (mm)", defaultValue: 35, min: 15, max: 60, step: 1, unit: "mm", help: "邊框面寬度（從照片邊緣往外的木料寬）" },
  { group: "structure", type: "number", key: "frameThickness", label: "邊框厚 (mm)", defaultValue: 25, min: 12, max: 30, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "backThickness", label: "背板厚 (mm)", defaultValue: 4, min: 3, max: 8, step: 1, unit: "mm", help: "三合板或卡紙板背板厚度" },
  { group: "structure", type: "number", key: "glassThickness", label: "玻璃厚 (mm)", defaultValue: 2, min: 2, max: 4, step: 1, unit: "mm", help: "玻璃行標準切片，2mm 透明玻璃最常用" },
  { group: "structure", type: "number", key: "glassGrooveDepth", label: "玻璃槽深 (mm)", defaultValue: 6, min: 5, max: 12, step: 1, unit: "mm", help: "邊框內側鋸槽深度（4 邊都鋸），玻璃 2 + 背板 4 = 6mm 已足夠；太深會吃到 frameWidth 強度" },
  { group: "structure", type: "select", key: "frameProfile", label: "邊框輪廓", defaultValue: "flat", choices: [
    { value: "flat", label: "平面（最簡單）" },
    { value: "chamfer-out", label: "外緣 45° 倒角" },
  ], help: "邊框正面輪廓樣式。平面最簡單；外緣倒角讓正面 4 條長邊都帶 45° 斜切" },
  { group: "structure", type: "number", key: "chamferMm", label: "倒角大小 (mm)", defaultValue: 3, min: 1, max: 8, step: 1, unit: "mm", help: "僅外緣倒角模式生效" },
  { group: "structure", type: "select", key: "cornerJoinery", label: "邊角形狀", defaultValue: "butt", choices: [
    { value: "butt", label: "直角（方角對接，傳統）" },
    { value: "miter", label: "45° 斜角（畫框風）" },
  ], help: "邊角外觀。直角=4 個方角；45° 斜角=精緻畫框風。內部接合工法（盲榫 / spline）在榫接版才會看到" },
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
  const chamferMm = getOption<number>(input, opt(o, "chamferMm"));
  const cornerJoinery = getOption<string>(input, opt(o, "cornerJoinery"));
  const useMiter = cornerJoinery === "miter";

  // 整框外尺寸 = 照片 + 兩側邊框
  const outerL = photoW + 2 * frameW;
  const outerW = photoH + 2 * frameW;

  // 4 個角用盲榫補強：left/right rail 上下各出一支盲榫進 top/bottom rail。
  // 公件 = leftRail/rightRail；母件 = topRail/bottomRail。
  // 用 standardTenon helper 算榫厚/寬（依木工標準 T/3、W-2×肩），
  // 但長度覆寫——standardTenon 的 25mm 最小盲榫長度是給椅桌厚料訂的，
  // 相框薄料用會吃掉太多母件強度。改用 50% 母厚（更典型的小件比例）。
  const tenonType = autoTenonType(frameW);
  const tenonSpecRaw = standardTenon({
    type: tenonType,
    childThickness: frameT,
    childWidth: frameW,
    motherThickness: frameW,
  });
  const tenonLengthOverride =
    tenonType === "through-tenon"
      ? frameW
      : Math.max(8, Math.round(frameW * 0.5) - 2);
  const tenonSpec = { ...tenonSpecRaw, length: tenonLengthOverride };
  const cornerTenon = (pos: "start" | "end"): Part["tenons"][number] => ({
    position: pos,
    type: tenonType,
    length: tenonSpec.length,
    width: tenonSpec.width,
    thickness: tenonSpec.thickness,
    shoulderOn: tenonSpec.shoulderOn,
  });
  const cornerMortise = (
    xWorld: number,
    zLocal: number,
  ): Part["mortises"][number] => ({
    origin: { x: xWorld, y: frameT / 2, z: zLocal },
    depth: tenonSpec.length,
    length: tenonSpec.width,
    width: tenonSpec.thickness,
    through: tenonType === "through-tenon",
  });

  const topRail: Part = {
    id: "frame-top",
    nameZh: "上邊框",
    nameEn: "Top frame rail",
    material,
    grainDirection: "length",
    visible: { length: outerL, width: frameW, thickness: frameT },
    origin: { x: 0, y: 0, z: outerW / 2 - frameW / 2 },
    tenons: [],
    // miter 時 tenon 被斜切吃掉 → 也清掉 mortise；非 miter 用盲榫眼
    mortises: useMiter ? [] : [
      cornerMortise(-(outerL / 2 - frameW / 2), -frameW / 2),
      cornerMortise(+(outerL / 2 - frameW / 2), -frameW / 2),
    ],
  };
  const bottomRail: Part = {
    ...topRail,
    id: "frame-bottom",
    nameZh: "下邊框",
    nameEn: "Bottom frame rail",
    origin: { x: 0, y: 0, z: -(outerW / 2 - frameW / 2) },
    mortises: useMiter ? [] : [
      cornerMortise(-(outerL / 2 - frameW / 2), +frameW / 2),
      cornerMortise(+(outerL / 2 - frameW / 2), +frameW / 2),
    ],
  };

  // 左右立邊：
  // - 直角盲榫接：length = sideLen（夾在 top/bottom 之間），出榫穿入 top/bottom
  // - 45° 斜接：length = outerW（延伸到外角全長），miter 切短內緣（per pencil-holder line 290-294）
  const sideLen = useMiter ? outerW : outerW - 2 * frameW;
  const leftRail: Part = {
    id: "frame-left",
    nameZh: "左邊框",
    nameEn: "Left frame rail",
    material,
    grainDirection: "length",
    visible: { length: sideLen, width: frameW, thickness: frameT },
    origin: { x: -(outerL / 2 - frameW / 2), y: 0, z: 0 },
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    // miter 時 tenon 會被斜切吃掉，改用 spline；非 miter 用標準盲榫
    tenons: useMiter ? [] : [cornerTenon("start"), cornerTenon("end")],
    mortises: [],
  };
  const rightRail: Part = {
    ...leftRail,
    id: "frame-right",
    nameZh: "右邊框",
    nameEn: "Right frame rail",
    origin: { x: outerL / 2 - frameW / 2, y: 0, z: 0 },
    // 跟 leftRail 一樣，但 tenons 內容相同（盲榫對稱）
  };

  // 45° 斜接時，4 條 rail 兩端套 mitered-corner shape（bothEnds 同時切兩個對角 corner）。
  // 切點在「內 a2 邊」（朝照片開口側），外緣保持滿長。
  // topRail (no rotation): 外緣 = +Z，切 +- 與 -- (-a2 = inner)
  // bottomRail (no rotation): 外緣 = -Z，切 ++ 與 -+ (+a2 = inner)
  // leftRail (Ry π/2): 局部 +Z → world +X = 朝中心 (inner)，切 ++ 與 -+
  // rightRail (Ry π/2): 局部 +Z → world +X = 外側，切 +- 與 -- (-a2 = inner)
  // 45° 斜接：改用 pencil-holder 驗證過的 mitered-ends pattern
  // visible 對調 width/thickness（local Y → 內外方向）+ rotation Rx(π/2)（左右再加 Ry π/2）
  if (useMiter) {
    topRail.visible = { length: outerL, width: frameT, thickness: frameW };
    topRail.rotation = { x: Math.PI / 2, y: 0, z: 0 };
    topRail.shape = { kind: "mitered-ends", insetEach: frameW, outerSide: "+y" };

    bottomRail.visible = { length: outerL, width: frameT, thickness: frameW };
    bottomRail.rotation = { x: Math.PI / 2, y: 0, z: 0 };
    bottomRail.shape = { kind: "mitered-ends", insetEach: frameW, outerSide: "-y" };

    leftRail.visible = { length: outerW, width: frameT, thickness: frameW };
    leftRail.rotation = { x: Math.PI / 2, y: Math.PI / 2, z: 0 };
    leftRail.shape = { kind: "mitered-ends", insetEach: frameW, outerSide: "-y" };

    rightRail.visible = { length: outerW, width: frameT, thickness: frameW };
    rightRail.rotation = { x: Math.PI / 2, y: Math.PI / 2, z: 0 };
    rightRail.shape = { kind: "mitered-ends", insetEach: frameW, outerSide: "+y" };
  }

  // 邊框輪廓 chamfer-out：套 chamfered-edges（mitered-ends 不直接支援 chamfer，
  // 但 4 條軸向長邊倒角獨立於 miter 端切，加在 mitered-ends 之上會被覆蓋——所以
  // 只在直角模式套；miter 模式的倒角之後再做。）
  if (frameProfile === "chamfer-out" && chamferMm > 0 && !useMiter) {
    for (const rail of [topRail, bottomRail, leftRail, rightRail]) {
      if (!rail.shape) {
        rail.shape = { kind: "chamfered-edges", chamferMm };
      }
    }
  }

  // 玻璃（visual: glass 不入材積、不出材料單）
  // 跟背板一樣卡進邊框 rabbet 區，每邊 overlap = rabbet 深度 - 1mm 裕度。
  // 三視圖正面/側面才看得到玻璃邊緣伸入邊框後方。
  const glassOverlap = glassGrooveDepth - BACK_PANEL_CLEARANCE; // 預設 5mm
  const glass: Part = {
    id: "glass",
    nameZh: "玻璃",
    nameEn: "Glass",
    material,
    visual: "glass",
    grainDirection: "length",
    visible: { length: photoW + 2 * glassOverlap, width: photoH + 2 * glassOverlap, thickness: glassT },
    origin: { x: 0, y: frameT - glassGrooveDepth - glassT, z: 0 },
    tenons: [],
    mortises: [],
  };

  // 背板（夾板）— 從後方滑入邊框內側 rabbet，背面跟邊框底齊。
  // 邊框 Y∈[0, frameT]：正面 y=frameT（玻璃在前內側 y=17-19）、背面 y=0。
  // 背板尺寸 = 照片開口 + 兩側 rabbet 深度（glassGrooveDepth × 2），
  // 邊緣卡入邊框內側的 rabbet 裡 → 三視圖正面/側面看得到背板延伸到邊框下方的虛線輪廓。
  // 預留 BACK_PANEL_CLEARANCE 每邊 4mm 卡入裕度（避免太緊）。
  const backPanelOverlap = glassGrooveDepth - BACK_PANEL_CLEARANCE;
  const backPanelL = photoW + 2 * backPanelOverlap;
  const backPanelW = photoH + 2 * backPanelOverlap;
  const backPanel: Part = {
    id: "back-panel",
    nameZh: "背板（夾板）",
    nameEn: "Back panel (plywood)",
    material,
    materialOverride: "plywood",
    grainDirection: "length",
    visible: {
      length: backPanelL,
      width: backPanelW,
      thickness: backT,
    },
    origin: { x: 0, y: 0, z: 0 },
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
    useButtJointConvention: true,
    defaultJoinery: useMiter ? "mitered" : "blind-tenon",
    primaryMaterial: material,
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: `相框（裝 ${photoW}×${photoH}mm 照片），外尺寸 ${outerL}×${outerW}×${frameT}mm。4 條邊框內側鋸 ${glassGrooveDepth}×${glassT + backT + 2}mm 凹槽放玻璃 + 背板（從後方滑入）。${useMiter ? "4 角 45° 斜接 + 膠合（夾具夾緊靜置 24 小時）；想要更強可在 4 角另加 spline 木片或對角木釘加固——目前材料單未含 spline，需自行裁切。" : "4 角 90° 對接 + 隱榫補強。"}${frameProfile === "chamfer-out" ? `邊框正面 4 條長邊各倒 ${chamferMm}mm × 45°（修邊機 V 型刀或砂帶機）。` : ""} **玻璃自備**：到玻璃行裁 ${photoW}×${photoH}mm × ${glassT}mm 厚透明玻璃；玻璃槽內縮 ${GLASS_FRAME_INSET}mm 確保正面看不到槽口。`,
  };
};
