import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";
import { polygonStaves } from "./_builders/polygon-stave-builder";

/** 4 大使用情境 preset */
interface TrayPresetConfig {
  wallHeight?: number;
  wallThickness?: number;
  bottomThickness?: number;
  cornerJoinery?: string;
  handleStyle?: string;
  withFeltPad?: boolean;
  dividerLayout?: string;
}
const TRAY_PRESETS: Record<string, TrayPresetConfig> = {
  // 早餐床頭托盤：高邊防潑灑、雙耳握把、整片開放、防滑墊
  breakfast: { wallHeight: 80, wallThickness: 14, bottomThickness: 10, cornerJoinery: "finger-joint", handleStyle: "cutout", withFeltPad: true, dividerLayout: "none" },
  // 茶盤：低邊圍住茶具、茶組固定槽、防滑墊
  "tea-ceremony": { wallHeight: 40, wallThickness: 12, bottomThickness: 10, cornerJoinery: "dovetail", handleStyle: "none", withFeltPad: true, dividerLayout: "tea-set" },
  // Charcuterie 起司板：超低邊（lip 15mm）、不加握把、整片實木
  charcuterie: { wallHeight: 15, wallThickness: 10, bottomThickness: 25, cornerJoinery: "stub-joint", handleStyle: "none", withFeltPad: true, dividerLayout: "none" },
  // 玄關鑰匙托盤：低邊、田字 4 格、麻繩握把
  entryway: { wallHeight: 30, wallThickness: 10, bottomThickness: 8, cornerJoinery: "finger-joint", handleStyle: "rope", withFeltPad: false, dividerLayout: "grid-4" },
  // 點心盤：中邊、雙隔板、雙耳握把
  dessert: { wallHeight: 50, wallThickness: 12, bottomThickness: 10, cornerJoinery: "dovetail", handleStyle: "metal", withFeltPad: true, dividerLayout: "split-2" },
};

export const trayOptions: OptionSpec[] = [
  { group: "structure", type: "select", key: "trayShape", label: "托盤形狀", defaultValue: "rect", choices: [
    { value: "rect", label: "方形 / 長方形（最常見）" },
    { value: "oct", label: "八角（8 片圍邊拼接，西式餐廳款）" },
  ], help: "八角款用 stave 拼接（取 length/width 較小邊為直徑）；八角不支援 dividers / handle cutout" },
  { group: "preset", type: "select", key: "trayUse", label: "使用情境預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（不套 preset）" },
    { value: "breakfast", label: "早餐床頭托盤（高邊 + 雙耳握把 + 防滑）" },
    { value: "tea-ceremony", label: "茶盤（茶組固定槽 + 鳩尾接合）" },
    { value: "charcuterie", label: "Charcuterie 起司板（超低邊 + 厚底）" },
    { value: "entryway", label: "玄關鑰匙托盤（田字 4 格 + 麻繩）" },
    { value: "dessert", label: "點心盤（中邊 + 雙隔板 + 金屬把手）" },
  ], help: "依使用情境一鍵套圍邊高 / 接合 / 握把 / 分隔組合，user 後改不蓋。" },
  { group: "structure", type: "number", key: "wallHeight", label: "圍邊高 (mm)", defaultValue: 50, min: 25, max: 120, step: 5, unit: "mm" },
  { group: "structure", type: "number", key: "wallThickness", label: "圍邊厚 (mm)", defaultValue: 12, min: 8, max: 20, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底板厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "cornerJoinery", label: "角接合方式", defaultValue: "finger-joint", choices: [
    { value: "finger-joint", label: "指接（finger joint，外露指狀，托盤經典）" },
    { value: "dovetail", label: "鳩尾（更高階，視覺最美）" },
    { value: "stub-joint", label: "搭接（rabbet，最簡單）" },
  ] },
  { group: "structure", type: "select", key: "handleStyle", label: "握把樣式", defaultValue: "hole", choices: [
    { value: "hole", label: "握把孔（橢圓孔，最簡單）" },
    { value: "cutout", label: "凹陷把手（短邊上緣 V 型缺口）" },
    { value: "rope", label: "麻繩握把（兩側打孔穿麻繩繞圈）" },
    { value: "metal", label: "金屬鉤環（鎖在外側，最不傷手）" },
    { value: "none", label: "不加握把（純展示用托盤）" },
  ] },
  { group: "structure", type: "number", key: "handleWidth", label: "握把孔寬 (mm)", defaultValue: 80, min: 60, max: 120, step: 5, unit: "mm", dependsOn: { key: "handleStyle", oneOf: ["hole", "cutout"] } },
  { group: "structure", type: "number", key: "handleHeight", label: "握把孔高 (mm)", defaultValue: 25, min: 18, max: 35, step: 1, unit: "mm", dependsOn: { key: "handleStyle", oneOf: ["hole", "cutout"] } },
  { group: "structure", type: "checkbox", key: "withFeltPad", label: "底面貼防滑墊", defaultValue: false, help: "底板下緣貼 4 片小氈墊，端到桌面不刮傷且止滑", wide: true },
  { group: "structure", type: "select", key: "dividerLayout", label: "內格分隔", defaultValue: "none", choices: [
    { value: "none", label: "無分隔（整片開放）" },
    { value: "split-2", label: "縱向 1 道隔板（茶具左右分區）" },
    { value: "grid-4", label: "田字格 4 格（杯墊 / 點心分隔）" },
    { value: "tea-set", label: "茶組固定槽（茶壺 + 4 杯固定凹槽）" },
  ] },
  { group: "structure", type: "number", key: "edgeChamfer", label: "圍邊倒角 (mm)", defaultValue: 2, min: 0, max: 8, step: 1, unit: "mm", help: "圍邊頂緣倒角，2-3mm 手感佳不會割手" },
];

/**
 * 托盤 — 底板 + 4 圍邊（選用握把孔）
 * input: length × width = 托盤外尺寸（俯視），height 不用
 */
export const tray: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, material } = input;
  const o = trayOptions;
  const trayUse = getOption<string>(input, opt(o, "trayUse"));
  const preset = TRAY_PRESETS[trayUse];
  const wallHRaw = getOption<number>(input, opt(o, "wallHeight"));
  const wallH = wallHRaw === 50 && preset?.wallHeight !== undefined ? preset.wallHeight : wallHRaw;
  const wallTRaw = getOption<number>(input, opt(o, "wallThickness"));
  const wallT = wallTRaw === 12 && preset?.wallThickness !== undefined ? preset.wallThickness : wallTRaw;
  const botTRaw = getOption<number>(input, opt(o, "bottomThickness"));
  const botT = botTRaw === 8 && preset?.bottomThickness !== undefined ? preset.bottomThickness : botTRaw;
  const cornerJoineryRaw = getOption<string>(input, opt(o, "cornerJoinery"));
  const cornerJoinery = (cornerJoineryRaw === "finger-joint" && preset?.cornerJoinery ? preset.cornerJoinery : cornerJoineryRaw) as
    | "finger-joint"
    | "dovetail"
    | "stub-joint";
  const handleStyleRaw = getOption<string>(input, opt(o, "handleStyle"));
  const handleStyle = handleStyleRaw === "hole" && preset?.handleStyle ? preset.handleStyle : handleStyleRaw;
  const withHandles = handleStyle !== "none";
  const handleW = getOption<number>(input, opt(o, "handleWidth"));
  const handleH = getOption<number>(input, opt(o, "handleHeight"));
  const withFeltPadRaw = getOption<boolean>(input, opt(o, "withFeltPad"));
  const withFeltPad = withFeltPadRaw === false && preset?.withFeltPad !== undefined ? preset.withFeltPad : withFeltPadRaw;
  const dividerLayoutRaw = getOption<string>(input, opt(o, "dividerLayout"));
  const dividerLayout = dividerLayoutRaw === "none" && preset?.dividerLayout ? preset.dividerLayout : dividerLayoutRaw;
  const edgeChamfer = getOption<number>(input, opt(o, "edgeChamfer"));
  const trayShape = getOption<string>(input, opt(o, "trayShape")) as "rect" | "oct";

  // 八角款：跳過 buildBox 直接組多邊形
  if (trayShape === "oct") {
    const outerD = Math.min(outerL, outerW);
    const staves = polygonStaves({ sides: 8, outerD, outerH: wallH + botT, wallT, botT, material });
    const innerD = outerD * Math.cos(Math.PI / 8) - 2 * wallT - 2;
    const polyBottom: Part = {
      id: "bottom",
      nameZh: "八角底板",
      material,
      grainDirection: "length",
      visible: { length: innerD, width: innerD, thickness: botT },
      origin: { x: 0, y: 0, z: 0 },
      shape: { kind: "round" },
      tenons: [],
      mortises: [],
    };
    return {
      id: `tray-oct-${outerD}x${wallH + botT}`,
      category: "tray",
      nameZh: "八角托盤",
      overall: { length: outerD, width: outerD, thickness: wallH + botT },
      parts: [polyBottom, ...staves],
      defaultJoinery: "mitered-spline",
      useButtJointConvention: false,
      primaryMaterial: material,
      notes: `八角托盤外接圓 ⌀${outerD}mm × 圍邊高 ${wallH}mm，壁厚 ${wallT}mm。8 段直立壁邊接 22.5° 斜切（45° 內角），相鄰邊用膠合 + biscuit / 暗榫加固。${withFeltPad ? "底面貼 8 片自黏氈墊。" : ""}${edgeChamfer > 0 ? ` 圍邊頂緣倒 ${edgeChamfer}mm 防割手。` : ""}`,
    };
  }

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
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `托盤 ${outerL}×${outerW}mm（圍邊高 ${wallH}mm）。底板與圍邊用槽接（圍邊內側下緣鋸 ${botT}×${botT}mm 槽）。4 角 ${cornerLabel}。${
      handleStyle === "hole"
        ? `**握把孔**：兩端短邊中央挖 ${handleW}×${handleH}mm 橢圓孔，邊緣倒 R5 好握。`
        : handleStyle === "cutout"
          ? `**凹陷把手**：兩端短邊上緣中央挖 ${handleW}mm 寬 V 型缺口（深 ${handleH}mm）。`
          : handleStyle === "rope"
            ? `**麻繩握把**：兩端短邊各鑽 2 個 12mm 圓孔（間距 80mm），穿 8mm 黃麻繩繞 3 圈打結。`
            : handleStyle === "metal"
              ? `**金屬把手**：兩端短邊外側各鎖一個復古黃銅 / 黑色金屬把手（B&Q 五金行 NT$ 80-150 / 個）。`
              : `無握把（純展示用 / 桌面點心盤）。`
    }${withFeltPad ? " 底面貼 4 片自黏氈墊，桌面不刮傷且止滑。" : ""}${
      dividerLayout === "split-2"
        ? " 內部加 1 道縱向隔板（${wallT}mm 厚），槽接卡入兩側壁。"
        : dividerLayout === "grid-4"
          ? " 內部加田字格隔板（縱橫各 1 道，4 格分區）。"
          : dividerLayout === "tea-set"
            ? " 內部按茶組挖固定凹槽：中央 ⌀120mm 茶壺槽 + 4 個 ⌀60mm 杯槽（深 5mm）。"
            : ""
    }${edgeChamfer > 0 ? ` 圍邊頂緣倒 ${edgeChamfer}mm 防割手。` : ""}托盤是入門到中階的銜接練習：拼板、${cornerJoinery === "dovetail" ? "鳩尾" : cornerJoinery === "finger-joint" ? "指接" : "搭接"}、刨削、收邊倒角，一件做完所有基本功都會。`,
  };
  // 分隔板
  if (dividerLayout === "split-2") {
    design.parts.push({
      id: "divider-mid",
      nameZh: "中央縱向隔板",
      material,
      grainDirection: "length",
      visible: { length: outerL - 2 * wallT - 4, width: wallH - 4, thickness: wallT - 2 },
      origin: { x: 0, y: botT + (wallH - 4) / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  } else if (dividerLayout === "grid-4") {
    design.parts.push({
      id: "divider-x",
      nameZh: "X 方向隔板",
      material,
      grainDirection: "length",
      visible: { length: outerL - 2 * wallT - 4, width: wallH - 4, thickness: wallT - 2 },
      origin: { x: 0, y: botT + (wallH - 4) / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
    design.parts.push({
      id: "divider-z",
      nameZh: "Z 方向隔板",
      material,
      grainDirection: "length",
      visible: { length: outerW - 2 * wallT - 4, width: wallH - 4, thickness: wallT - 2 },
      origin: { x: 0, y: botT + (wallH - 4) / 2, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  } else if (dividerLayout === "tea-set") {
    // 茶組固定凹槽 — 在底板加 mortises
    const bottomPart = design.parts.find((p) => p.id === "bottom");
    if (bottomPart) {
      bottomPart.mortises = [
        ...bottomPart.mortises,
        { origin: { x: 0, y: 0, z: 0 }, depth: 5, length: 120, width: 120, through: false },
        { origin: { x: -outerL / 4, y: 0, z: -outerW / 4 }, depth: 5, length: 60, width: 60, through: false },
        { origin: { x: outerL / 4, y: 0, z: -outerW / 4 }, depth: 5, length: 60, width: 60, through: false },
        { origin: { x: -outerL / 4, y: 0, z: outerW / 4 }, depth: 5, length: 60, width: 60, through: false },
        { origin: { x: outerL / 4, y: 0, z: outerW / 4 }, depth: 5, length: 60, width: 60, through: false },
      ];
    }
  }

  if (built.warnings.length) design.warnings = built.warnings;
  // max bounds
  const extraWarnings: string[] = [];
  if (outerL > 600 || outerW > 450) {
    extraWarnings.push(`托盤 ${outerL}×${outerW}mm 超過家用合理範圍（max 600×450mm）。大托盤承重 + 端起來重，建議減小尺寸 / 改用其他容器`);
  }
  if (wallT < 8 && outerL > 400) {
    extraWarnings.push(`圍邊厚 ${wallT}mm 對 ${outerL}mm 長托盤太薄——端起時容易裂；建議加厚到 12mm`);
  }
  if (extraWarnings.length) design.warnings = [...(design.warnings ?? []), ...extraWarnings];
  return design;
};
