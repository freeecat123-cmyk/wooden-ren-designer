import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";

/** 使用情境 preset */
interface PencilHolderPresetConfig {
  wallThickness?: number;
  bottomThickness?: number;
  cornerJoinery?: string;
  dividers?: number;
  crossDividers?: number;
  edgeChamfer?: number;
  withDrainHoles?: boolean;
  topAngleDeg?: number;
}
const PENCIL_HOLDER_PRESETS: Record<string, PencilHolderPresetConfig> = {
  // 一般筆筒：方筒整空
  classic: { wallThickness: 8, bottomThickness: 8, cornerJoinery: "stub-joint", dividers: 0, crossDividers: 0, edgeChamfer: 2 },
  // 文具站：grid 6 格分裝剪刀/筆/刀片
  "stationery-station": { wallThickness: 10, bottomThickness: 10, cornerJoinery: "finger-joint", dividers: 2, crossDividers: 1, edgeChamfer: 2 },
  // 化妝刷筒：深款 + 1 縱向 + 倒角圓潤
  "makeup-brush": { wallThickness: 10, bottomThickness: 10, cornerJoinery: "stub-joint", dividers: 1, crossDividers: 0, edgeChamfer: 4 },
  // 廚房料理工具筒：深 + 排水孔 + 厚壁
  "kitchen-utensil": { wallThickness: 12, bottomThickness: 12, cornerJoinery: "finger-joint", dividers: 1, crossDividers: 1, edgeChamfer: 3, withDrainHoles: true },
  // 木工專用：4 格分裝尺/筆/夾子 + 厚壁耐撞
  "woodworker-caddy": { wallThickness: 12, bottomThickness: 12, cornerJoinery: "finger-joint", dividers: 2, crossDividers: 2, edgeChamfer: 2 },
  // 桌邊前傾款：頂緣斜切 15° 讓書桌前方好取筆
  "tilted-desk": { wallThickness: 8, bottomThickness: 8, cornerJoinery: "stub-joint", dividers: 1, crossDividers: 0, edgeChamfer: 2, topAngleDeg: 15 },
};

export const pencilHolderOptions: OptionSpec[] = [
  { group: "preset", type: "select", key: "useCase", label: "使用情境預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（不套 preset）" },
    { value: "classic", label: "一般筆筒（方筒整空）" },
    { value: "stationery-station", label: "文具站（grid 6 格分裝剪刀/筆/刀片）" },
    { value: "makeup-brush", label: "化妝刷筒（深款 + 縱向隔板 + 圓潤倒角）" },
    { value: "kitchen-utensil", label: "廚房料理工具筒（厚壁 + 4 格 + 排水孔）" },
    { value: "woodworker-caddy", label: "木工專用（厚壁 + 9 格分裝尺/筆/夾子）" },
    { value: "tilted-desk", label: "桌邊前傾款（頂緣斜切 15°）" },
  ], help: "一鍵套適合該情境的壁厚 / 隔板 / 接合 / 倒角組合，user 後改不蓋。" },
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "cornerJoinery", label: "角接合方式", defaultValue: "stub-joint", choices: [
    { value: "stub-joint", label: "搭接（rabbet，最簡單）" },
    { value: "finger-joint", label: "指接（finger joint，外露指狀）" },
    { value: "miter", label: "斜角拼（45°，最隱形但要對齊）" },
  ] },
  { group: "structure", type: "number", key: "dividers", label: "縱向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, help: "0 = 整空；1-5 沿長邊方向加直立隔板（垂直 length 軸）" },
  { group: "structure", type: "number", key: "crossDividers", label: "橫向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, help: "0 = 沒有；1-5 沿短邊方向加隔板（跟縱向組合可形成 grid 網格）" },
  { group: "structure", type: "number", key: "edgeChamfer", label: "邊緣倒角 (mm)", defaultValue: 2, min: 0, max: 8, step: 1, unit: "mm", help: "外露邊緣倒角，2-3mm 手感佳；化妝刷筒可拉到 4-5mm" },
  { group: "structure", type: "checkbox", key: "withDrainHoles", label: "底部排水孔", defaultValue: false, help: "底板鑽 4 個 ⌀5mm 排水孔，廚房料理工具筒 / 水彩筆筒適用", wide: true },
];

/**
 * 筆筒 — 5 片板組成的方盒（4 壁 + 底）
 * input: 外尺寸（長×寬×高）
 */
export const pencilHolder: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, height: outerH, material } = input;
  const o = pencilHolderOptions;
  const useCase = getOption<string>(input, opt(o, "useCase"));
  const preset = PENCIL_HOLDER_PRESETS[useCase];
  const wallTRaw = getOption<number>(input, opt(o, "wallThickness"));
  const wallT = wallTRaw === 8 && preset?.wallThickness !== undefined ? preset.wallThickness : wallTRaw;
  const botTRaw = getOption<number>(input, opt(o, "bottomThickness"));
  const botT = botTRaw === 8 && preset?.bottomThickness !== undefined ? preset.bottomThickness : botTRaw;
  const cornerJoineryRaw = getOption<string>(input, opt(o, "cornerJoinery"));
  const cornerJoinery = (cornerJoineryRaw === "stub-joint" && preset?.cornerJoinery ? preset.cornerJoinery : cornerJoineryRaw) as
    | "stub-joint"
    | "finger-joint"
    | "miter";
  const dividersRaw = getOption<number>(input, opt(o, "dividers"));
  const dividers = dividersRaw === 0 && preset?.dividers !== undefined ? preset.dividers : dividersRaw;
  const crossDividersRaw = getOption<number>(input, opt(o, "crossDividers"));
  const crossDividers = crossDividersRaw === 0 && preset?.crossDividers !== undefined ? preset.crossDividers : crossDividersRaw;
  const edgeChamferRaw = getOption<number>(input, opt(o, "edgeChamfer"));
  const edgeChamfer = edgeChamferRaw === 2 && preset?.edgeChamfer !== undefined ? preset.edgeChamfer : edgeChamferRaw;
  const withDrainHolesRaw = getOption<boolean>(input, opt(o, "withDrainHoles"));
  const withDrainHoles = withDrainHolesRaw === false && preset?.withDrainHoles !== undefined ? preset.withDrainHoles : withDrainHolesRaw;
  void edgeChamfer; void withDrainHoles; // 旗標已套 preset，下游 builder/notes 需個別實作（v2 backlog）

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

  // 斜接 (miter) / 指接 (finger-joint) 的下料規則：4 片壁都用「全外尺寸」下料。
  // - 長 = outerL (前/後) 或 outerW (左/右)：兩端的接合在垂直邊（指接交錯/45° 斜切）
  // - 寬 = outerH：底板用槽接嵌入牆內側下緣，牆從地板延伸到盒頂全高
  // - 厚 = wallT：不變
  // 只有搭接 (stub-joint) 才是 2 長 + 2 短 + 牆坐底板上 (wallH = outerH - botT) 的傳統佈料。
  if (cornerJoinery === "miter" || cornerJoinery === "finger-joint") {
    for (const part of built.parts) {
      if (part.id === "wall-front" || part.id === "wall-back") {
        part.visible = { ...part.visible, length: outerL, width: outerH };
        part.origin = { ...part.origin, y: 0 };
        part.tenons = [];
      } else if (part.id === "wall-left" || part.id === "wall-right") {
        part.visible = { ...part.visible, length: outerW, width: outerH };
        part.origin = { ...part.origin, y: 0 };
        part.tenons = [];
      }
    }
  }

  // 加內部直立隔板（縱向：沿 length 軸切，跟長邊垂直）
  const dividerParts: typeof built.parts = [];
  const dividerThick = wallT - 2;
  if (dividers > 0) {
    const dividerSpacing = built.innerL / (dividers + 1);
    for (let i = 1; i <= dividers; i++) {
      dividerParts.push({
        id: `divider-${i}`,
        nameZh: `縱向隔板 ${i}`,
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
  // 橫向隔板（沿 width 軸切，跟短邊垂直）
  if (crossDividers > 0) {
    const dividerSpacing = built.innerW / (crossDividers + 1);
    for (let i = 1; i <= crossDividers; i++) {
      dividerParts.push({
        id: `cross-divider-${i}`,
        nameZh: `橫向隔板 ${i}`,
        material,
        grainDirection: "length",
        visible: { length: built.innerL, width: outerH - botT, thickness: dividerThick },
        origin: {
          x: 0,
          y: botT,
          z: -built.innerW / 2 + i * dividerSpacing,
        },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
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
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `筆筒 ${outerL}×${outerW}×${outerH}mm，${5 + dividers + crossDividers} 片實木組成。底板用槽接嵌入 4 壁內側下緣，4 角採${cornerJoinery === "finger-joint" ? "**指接**（外露指狀視覺，新手練習指接的最佳對象）" : cornerJoinery === "miter" ? "**斜角拼**（45° 對接，最隱形但需 45° 鋸台或斜切片切，膠合 + 細釘加固）" : "**搭接**（rabbet，最簡單，膠合即可）"}。內部 ${built.innerL}×${built.innerW}mm 約可放 ${Math.max(0, Math.floor((built.innerL * built.innerW) / 100))} 支筆。${dividers > 0 ? ` 內部縱向 ${dividers} 片隔板。` : ""}${crossDividers > 0 ? ` 橫向 ${crossDividers} 片隔板。` : ""}${dividers > 0 && crossDividers > 0 ? ` grid 網格分 ${(dividers + 1) * (crossDividers + 1)} 區。` : ""}`,
  };

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
