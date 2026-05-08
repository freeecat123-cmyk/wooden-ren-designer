import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";

/** 使用情境 preset：一鍵套盒型最佳 wall/bottom + 預設選項組合 */
interface BoxPresetConfig {
  wallThickness?: number;
  bottomThickness?: number;
  dovetailStyle?: string;
  lidType?: string;
  withFeltLining?: boolean;
  withMagneticClosure?: boolean;
  withInnerTray?: boolean;
}
const DOVETAIL_BOX_PRESETS: Record<string, BoxPresetConfig> = {
  // 首飾盒：薄壁、半隱鳩尾、絨布、磁吸、jewelry 抽板
  jewelry: { wallThickness: 10, bottomThickness: 6, dovetailStyle: "half-blind", lidType: "hinged", withFeltLining: true, withMagneticClosure: true, withInnerTray: true },
  // 雪茄盒：較厚壁（保濕）、嵌入式蓋、絨布
  cigar: { wallThickness: 15, bottomThickness: 8, dovetailStyle: "half-blind", lidType: "rabbeted", withFeltLining: true },
  // 茶葉盒：厚壁防潮、滑入式蓋、無內襯
  tea: { wallThickness: 12, bottomThickness: 8, dovetailStyle: "through", lidType: "sliding" },
  // 手錶盒：薄壁、鉸鏈蓋、絨布、磁吸
  watch: { wallThickness: 10, bottomThickness: 6, dovetailStyle: "half-blind", lidType: "hinged", withFeltLining: true, withMagneticClosure: true },
  // 文件盒：厚壁、鉸鏈蓋、無內襯
  document: { wallThickness: 14, bottomThickness: 8, dovetailStyle: "through", lidType: "hinged" },
};

export const dovetailBoxOptions: OptionSpec[] = [
  { group: "preset", type: "select", key: "boxUse", label: "使用情境預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（不套 preset）" },
    { value: "jewelry", label: "首飾盒（薄壁+半隱+絨布+磁吸+抽板）" },
    { value: "cigar", label: "雪茄盒（厚壁保濕+嵌入式蓋+絨布）" },
    { value: "tea", label: "茶葉盒（厚壁+滑入式+無內襯）" },
    { value: "watch", label: "手錶盒（薄壁+鉸鏈+絨布+磁吸）" },
    { value: "document", label: "文件盒（厚壁+鉸鏈+無內襯）" },
  ], help: "一鍵套適合該用途的壁厚 / 鳩尾 / 蓋型 / 內襯組合，user 後改不蓋。" },
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 12, min: 8, max: 25, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "checkbox", key: "withLid", label: "加蓋", defaultValue: true, help: "上方加滑入式或鉸鏈式蓋板" },
  { group: "structure", type: "select", key: "dovetailStyle", label: "鳩尾樣式", defaultValue: "through", choices: [
    { value: "through", label: "通鳩尾（through dovetail）—— 從外面看到指狀鳩尾紋" },
    { value: "half-blind", label: "半隱鳩尾（half-blind）—— 前面看不到，傳統抽屜做法" },
    { value: "secret-mitered", label: "暗鳩尾（secret mitered）—— 4 角看起來純斜接，鳩尾完全隱藏（最高難度）" },
  ] },
  { group: "structure", type: "select", key: "lidType", label: "蓋子型式", defaultValue: "sliding", choices: [
    { value: "sliding", label: "滑入式（前後壁內側鋸槽，蓋從前滑入）" },
    { value: "hinged", label: "鉸鏈式（後壁裝小銅鉸鏈）" },
    { value: "lift-off", label: "整片活動蓋（不固定，需用 cleat 卡入）" },
    { value: "rabbeted", label: "嵌入式（蓋邊緣搭接，蓋扣到盒上）" },
  ], help: "影響蓋子做法 + 工序", dependsOn: { key: "withLid", equals: true } },
  { group: "structure", type: "checkbox", key: "withFeltLining", label: "內襯絨布", defaultValue: false, help: "底面 + 4 壁內側貼絨布（首飾盒、珠寶盒必加），保護內容物 + 提升質感", wide: true },
  { group: "structure", type: "checkbox", key: "withMagneticClosure", label: "磁吸閉合", defaultValue: false, help: "蓋子前緣埋 2 個 6mm 釹磁鐵（B&Q 五金行有售），蓋上會自動吸合", wide: true },
  { group: "structure", type: "checkbox", key: "withInnerTray", label: "內部 jewelry 分隔抽板", defaultValue: false, help: "盒內加一片可拆活動隔板（30mm 高 × 6 格），首飾分類用", wide: true },
  { group: "structure", type: "number", key: "edgeChamfer", label: "邊緣倒角 (mm)", defaultValue: 1, min: 0, max: 6, step: 1, unit: "mm", help: "外露角倒角，1-2mm 微倒手感佳" },
];

/**
 * 鳩尾盒 — 4 壁鳩尾接合 + 槽底（選用蓋）
 * input: outerL × outerW × outerH
 */
export const dovetailBox: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, height: outerH, material } = input;
  const o = dovetailBoxOptions;
  const boxUse = getOption<string>(input, opt(o, "boxUse"));
  const preset = DOVETAIL_BOX_PRESETS[boxUse];
  // preset 只蓋仍是 default 的 option
  const wallTRaw = getOption<number>(input, opt(o, "wallThickness"));
  const wallT = wallTRaw === 12 && preset?.wallThickness !== undefined ? preset.wallThickness : wallTRaw;
  const botTRaw = getOption<number>(input, opt(o, "bottomThickness"));
  const botT = botTRaw === 8 && preset?.bottomThickness !== undefined ? preset.bottomThickness : botTRaw;
  const withLid = getOption<boolean>(input, opt(o, "withLid"));
  const dovetailStyleRaw = getOption<string>(input, opt(o, "dovetailStyle"));
  const dovetailStyle = dovetailStyleRaw === "through" && preset?.dovetailStyle ? preset.dovetailStyle : dovetailStyleRaw;
  const lidTypeRaw = getOption<string>(input, opt(o, "lidType"));
  const lidType = lidTypeRaw === "sliding" && preset?.lidType ? preset.lidType : lidTypeRaw;
  const withFeltLiningRaw = getOption<boolean>(input, opt(o, "withFeltLining"));
  const withFeltLining = withFeltLiningRaw === false && preset?.withFeltLining !== undefined ? preset.withFeltLining : withFeltLiningRaw;
  const withMagneticClosureRaw = getOption<boolean>(input, opt(o, "withMagneticClosure"));
  const withMagneticClosure = withMagneticClosureRaw === false && preset?.withMagneticClosure !== undefined ? preset.withMagneticClosure : withMagneticClosureRaw;
  const withInnerTrayRaw = getOption<boolean>(input, opt(o, "withInnerTray"));
  const withInnerTray = withInnerTrayRaw === false && preset?.withInnerTray !== undefined ? preset.withInnerTray : withInnerTrayRaw;
  const edgeChamfer = getOption<number>(input, opt(o, "edgeChamfer"));

  // 蓋板與壁同厚，方便共用同款料
  const lidT = withLid ? wallT : 0;

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    lidT,
    material,
    cornerJoinery: "dovetail",
    bottomFit: "grooved",
  });

  // 半隱鳩尾的 mortise 不貫穿
  if (dovetailStyle === "half-blind") {
    for (const p of built.parts) {
      if (p.id === "wall-left" || p.id === "wall-right") {
        for (const m of p.mortises) m.through = false;
      }
    }
  }

  // 重新貼上鳩尾盒的中文零件名（box-builder 預設叫 前壁/後壁/左壁/右壁）
  const nameMap: Record<string, string> = {
    "wall-front": "前壁（鳩尾公）",
    "wall-back": "後壁（鳩尾公）",
    "wall-left": "左壁（鳩尾母）",
    "wall-right": "右壁（鳩尾母）",
  };
  for (const p of built.parts) {
    if (nameMap[p.id]) p.nameZh = nameMap[p.id];
  }

  const design: FurnitureDesign = {
    id: `dovetail-box-${outerL}x${outerW}x${outerH}`,
    category: "dovetail-box",
    nameZh: "鳩尾盒",
    overall: { length: outerL, width: outerW, thickness: outerH },
    parts: built.parts,
    defaultJoinery: "dovetail",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `鳩尾盒 ${outerL}×${outerW}×${outerH}mm，${
      dovetailStyle === "through"
        ? "**通鳩尾**接合，從盒外能看到指狀鳩尾紋路，傳統工藝展示款。"
        : dovetailStyle === "half-blind"
          ? "**半隱鳩尾**接合，從正面看不到鳩尾，盒身視覺乾淨——傳統抽屜做法。"
          : "**暗鳩尾**接合（secret mitered dovetail），4 角看起來純斜接，鳩尾完全藏在內部，最高難度。"
    }底板槽接 4 壁內側下緣，不上膠（讓底板可熱漲冷縮）。${withLid ? `蓋子做${
      lidType === "sliding"
        ? "**滑入式**（蓋兩側下緣鋸凸條，前後壁內側上緣鋸對應槽，從前面滑入）"
        : lidType === "hinged"
          ? "**鉸鏈式**（後壁裝小銅鉸鏈一對，B&Q 有售 NT$ 50/對）"
          : lidType === "lift-off"
            ? "**整片活動蓋**（不固定，蓋內側加 4 條 cleat 卡入盒口防滑）"
            : "**嵌入式**（蓋邊緣鋸 4 mm 搭接溝，蓋下扣盒口）"
    }。` : ""}${withFeltLining ? "內側 4 壁 + 底面貼絨布（B&Q / 美術社買 1mm 自黏絨布，剪好後黏入），珠寶 / 首飾盒必加。" : ""}${withMagneticClosure ? "蓋子前緣埋 2 個 6mm 釹磁鐵（鑽 6mm 圓孔嵌入 + AB 膠固定），蓋下時自動吸合。" : ""}${withInnerTray ? "盒內加一片可拆活動隔板（30mm 高 × 6 格 jewelry tray），底部加 4 個橡膠墊腳避免刮花底層。" : ""}${edgeChamfer > 0 ? ` 外露邊緣倒 ${edgeChamfer}mm 防割手 + 微倒美感。` : ""}**鳩尾盒是進階接合的入門練習**——先做這個再做抽屜，所有鳩尾技巧都會了。`,
  };
  // 絨布內襯：4 壁 + 底面 5 片 visual-only part（給 BOM 計料用，不入材積）
  if (withFeltLining) {
    const feltL = outerL - 2 * wallT - 2;
    const feltW = outerW - 2 * wallT - 2;
    const feltWallH = outerH - botT - (withLid ? lidT : 0) - 2;
    design.parts.push({
      id: "felt-bottom",
      nameZh: "絨布內襯（底）",
      material,
      grainDirection: "length",
      visible: { length: feltL, width: feltW, thickness: 1 },
      origin: { x: 0, y: botT, z: 0 },
      tenons: [],
      mortises: [],
      visual: "fabric",
    });
    // 4 片絨布壁
    design.parts.push({
      id: "felt-front",
      nameZh: "絨布內襯（前壁）",
      material,
      grainDirection: "length",
      visible: { length: feltL, width: feltWallH, thickness: 1 },
      origin: { x: 0, y: botT + feltWallH / 2, z: -outerW / 2 + wallT + 1 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
      visual: "fabric",
    });
    design.parts.push({
      id: "felt-back",
      nameZh: "絨布內襯（後壁）",
      material,
      grainDirection: "length",
      visible: { length: feltL, width: feltWallH, thickness: 1 },
      origin: { x: 0, y: botT + feltWallH / 2, z: outerW / 2 - wallT - 1 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
      visual: "fabric",
    });
    design.parts.push({
      id: "felt-left",
      nameZh: "絨布內襯（左壁）",
      material,
      grainDirection: "length",
      visible: { length: feltW, width: feltWallH, thickness: 1 },
      origin: { x: -outerL / 2 + wallT + 1, y: botT + feltWallH / 2, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
      visual: "fabric",
    });
    design.parts.push({
      id: "felt-right",
      nameZh: "絨布內襯（右壁）",
      material,
      grainDirection: "length",
      visible: { length: feltW, width: feltWallH, thickness: 1 },
      origin: { x: outerL / 2 - wallT - 1, y: botT + feltWallH / 2, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
      visual: "fabric",
    });
  }
  // 磁吸閉合：2 個釹磁鐵（visual-only，hint 給 BOM 採購）
  if (withMagneticClosure && withLid) {
    for (let i = 0; i < 2; i++) {
      design.parts.push({
        id: `magnet-${i + 1}`,
        nameZh: `釹磁鐵 ⌀6×3mm（${i === 0 ? "左" : "右"}）`,
        material,
        grainDirection: "length",
        visible: { length: 6, width: 6, thickness: 3 },
        origin: { x: (i === 0 ? -1 : 1) * (outerL / 4), y: outerH - lidT - 3, z: -outerW / 2 + wallT + 3 },
        shape: { kind: "round" },
        tenons: [],
        mortises: [],
        visual: "metal",
      });
    }
  }
  // 內部 jewelry 抽板（活動隔板）
  if (withInnerTray) {
    const trayH = 30;
    const trayPanelT = 6;
    design.parts.push({
      id: "inner-tray",
      nameZh: "內部活動隔板（jewelry tray）",
      material,
      grainDirection: "length",
      visible: {
        length: outerL - 2 * wallT - 4,
        width: outerW - 2 * wallT - 4,
        thickness: trayPanelT,
      },
      origin: { x: 0, y: outerH - trayH - (withLid ? wallT : 0) - 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  if (built.warnings.length) design.warnings = built.warnings;
  // max bounds + suggestions
  const extraWarnings: string[] = [];
  if (outerL > 400 || outerW > 300 || outerH > 250) {
    extraWarnings.push(`鳩尾盒 ${outerL}×${outerW}×${outerH}mm 超過合理範圍（max 400×300×250mm）。再大就是收納箱級別，工序很重 / 鳩尾要切很多齒`);
  }
  if (wallT < 10 && outerL > 250) {
    extraWarnings.push(`壁厚 ${wallT}mm 對 ${outerL}mm 長盒太薄——鳩尾齒太細不好切，建議加厚到 12mm 以上`);
  }
  if (extraWarnings.length) design.warnings = [...(design.warnings ?? []), ...extraWarnings];
  return design;
};
