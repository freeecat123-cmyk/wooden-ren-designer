import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";
import { polygonStaves } from "./_builders/polygon-stave-builder";

/** 使用情境 preset：一鍵套盒型最佳 wall/bottom + 預設選項組合 */
interface BoxPresetConfig {
  wallThickness?: number;
  bottomThickness?: number;
  dovetailStyle?: string;
  dovetailSegments?: number;
  dovetailAngle?: string;
  bottomAttach?: string;
  withLid?: boolean;
  lidType?: string;
  withFeltLining?: boolean;
  withMagneticClosure?: boolean;
  withInnerTray?: boolean;
  dividers?: number;
  crossDividers?: number;
  dividerHeight?: number;
  // 從 tray port：搬運把手孔（公文盒 / 工具箱）
  withHandle?: boolean;
  handleShape?: string;
}
const DOVETAIL_BOX_PRESETS: Record<string, BoxPresetConfig> = {
  // 首飾盒：薄壁、半隱鳩尾、絨布、磁吸、jewelry 抽板、十字內格
  jewelry: { wallThickness: 10, bottomThickness: 6, dovetailStyle: "half-blind", dovetailSegments: 7, dovetailAngle: "1:7", bottomAttach: "grooved", lidType: "hinged", withFeltLining: true, withMagneticClosure: true, withInnerTray: true, dividers: 1, crossDividers: 2 },
  // 雪茄盒：較厚壁（保濕）、嵌入式蓋、絨布
  cigar: { wallThickness: 15, bottomThickness: 8, dovetailStyle: "half-blind", dovetailSegments: 5, dovetailAngle: "1:8", bottomAttach: "grooved", lidType: "rabbeted", withFeltLining: true },
  // 茶葉盒：厚壁防潮、滑入式蓋、無內襯
  tea: { wallThickness: 12, bottomThickness: 8, dovetailStyle: "through", dovetailSegments: 5, dovetailAngle: "1:7", bottomAttach: "grooved", lidType: "sliding" },
  // 手錶盒：薄壁、鉸鏈蓋、絨布、磁吸、橫向 3 隔（4 格放手錶）
  watch: { wallThickness: 10, bottomThickness: 6, dovetailStyle: "half-blind", dovetailSegments: 5, dovetailAngle: "1:7", bottomAttach: "grooved", lidType: "hinged", withFeltLining: true, withMagneticClosure: true, crossDividers: 3 },
  // 文件盒：厚壁、鉸鏈蓋、搬運把手（公文盒提把）
  document: { wallThickness: 14, bottomThickness: 8, dovetailStyle: "through", dovetailSegments: 7, dovetailAngle: "1:8", bottomAttach: "grooved", lidType: "hinged", withHandle: true, handleShape: "pill" },
};

export const dovetailBoxOptions: OptionSpec[] = [
  // === Preset 預設 ===
  { group: "preset", type: "select", key: "boxUse", label: "使用情境預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（不套 preset）" },
    { value: "jewelry", label: "首飾盒（薄壁+半隱+絨布+磁吸+抽板+分格）" },
    { value: "cigar", label: "雪茄盒（厚壁保濕+嵌入式蓋+絨布）" },
    { value: "tea", label: "茶葉盒（厚壁+滑入式+無內襯）" },
    { value: "watch", label: "手錶盒（薄壁+鉸鏈+絨布+磁吸+橫向 4 隔）" },
    { value: "document", label: "文件盒（厚壁+鉸鏈+搬運把手）" },
  ], help: "一鍵套適合該用途的壁厚 / 鳩尾 / 蓋型 / 內襯組合，user 後改不蓋。" },

  // === Structure 結構 ===
  { group: "structure", type: "select", key: "boxShape", label: "盒型", defaultValue: "rect", choices: [
    { value: "rect", label: "方形 / 長方形（4 鳩尾角，傳統）" },
    { value: "oct", label: "八角盒（8 段斜接，禮品款）" },
  ], help: "八角款用 stave 拼接 22.5° 邊接，鳩尾改 mitered-spline；不支援滑入式蓋" },
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 12, min: 8, max: 25, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "bottomAttach", label: "底板裝法", defaultValue: "grooved", choices: [
    { value: "grooved", label: "鋸槽嵌入（底板比外壁小一圈，不上膠讓底板可熱漲冷縮）" },
    { value: "floating", label: "齊邊膠合（底板與外壁齊邊，整面塗膠）" },
    { value: "nailed", label: "底面釘合（底板從外面打釘 / 釘+膠，工具盒常見）" },
  ], help: "影響底板尺寸 + 是否上膠 + 工序", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "structure", type: "number", key: "edgeChamfer", label: "邊緣倒角 (mm)", defaultValue: 1, min: 0, max: 6, step: 1, unit: "mm", help: "外露角倒角，1-2mm 微倒手感佳" },

  // === Joinery 角接合 ===
  { group: "joinery", type: "select", key: "dovetailStyle", label: "鳩尾樣式", defaultValue: "through", choices: [
    { value: "through", label: "通鳩尾（through dovetail）—— 從外面看到指狀鳩尾紋" },
    { value: "half-blind", label: "半隱鳩尾（half-blind）—— 前面看不到，傳統抽屜做法" },
    { value: "secret-mitered", label: "暗鳩尾（secret mitered）—— 4 角看起來純斜接，鳩尾完全隱藏（最高難度）" },
  ], dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "joinery", type: "number", key: "dovetailSegments", label: "鳩尾齒數（每角）", defaultValue: 5, min: 3, max: 11, step: 2, unit: "齒", help: "通常 3 / 5 / 7 / 9 / 11，奇數比較平衡（兩端對稱半齒）；小盒 3-5、中盒 5-7、大盒 7-11", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "joinery", type: "select", key: "dovetailAngle", label: "鳩尾傾角（tail:pin 比）", defaultValue: "1:7", choices: [
    { value: "1:6", label: "1:6（約 9.5°，軟木 / 視覺強）" },
    { value: "1:7", label: "1:7（約 8.1°，折衷，最常用）" },
    { value: "1:8", label: "1:8（約 7.1°，硬木 / 細緻）" },
  ], help: "Lost Art Press 建議 7°-15° 都可；硬木用 1:8、軟木用 1:6、不確定用 1:7", dependsOn: { key: "boxShape", equals: "rect" } },

  // === Lid 盒蓋 ===
  { group: "lid", type: "checkbox", key: "withLid", label: "加蓋", defaultValue: true, help: "上方加滑入式或鉸鏈式蓋板" },
  { group: "lid", type: "select", key: "lidType", label: "蓋子型式", defaultValue: "sliding", choices: [
    { value: "sliding", label: "滑入式（前後壁內側鋸槽，蓋從前滑入）" },
    { value: "hinged", label: "鉸鏈式（後壁裝小銅鉸鏈）" },
    { value: "lift-off", label: "整片活動蓋（不固定，需用 cleat 卡入）" },
    { value: "rabbeted", label: "嵌入式（蓋邊緣搭接，蓋扣到盒上）" },
  ], help: "影響蓋子做法 + 工序", dependsOn: { key: "withLid", equals: true } },
  { group: "lid", type: "checkbox", key: "withMagneticClosure", label: "磁吸閉合", defaultValue: false, help: "蓋子前緣埋 2 個 6mm 釹磁鐵（B&Q 五金行有售），蓋上會自動吸合", wide: true, dependsOn: { key: "withLid", equals: true } },

  // === Handle 把手（公文盒 / 工具箱搬運用） ===
  { group: "handle", type: "checkbox", key: "withHandle", label: "短邊壁挖把手孔", defaultValue: false, help: "兩個短邊壁中央偏上挖長條穿透孔（公文盒 / 工具箱搬運用）" },
  { group: "handle", type: "select", key: "handleShape", label: "把手孔造型", defaultValue: "pill", choices: [
    { value: "rect", label: "矩形（直角，最簡單）" },
    { value: "pill", label: "圓角長條（兩端半圓 + 中段矩形）" },
    { value: "circle", label: "圓形（單一圓孔）" },
  ], dependsOn: { key: "withHandle", equals: true }, help: "圓角長條最常見、不刮手；矩形最容易加工；圓形適合小盒。" },
  { group: "handle", type: "number", key: "handleWidth", label: "把手孔寬 (mm)", defaultValue: 100, min: 50, max: 200, step: 5, unit: "mm", help: "建議 80-120mm（容 3-4 隻手指）。會自動 clamp 到壁長 −40mm。", dependsOn: { all: [{ key: "withHandle", equals: true }, { key: "handleShape", notIn: ["circle"] }] } },
  { group: "handle", type: "number", key: "handleHeight", label: "把手孔高 (mm)", defaultValue: 25, min: 15, max: 50, step: 1, unit: "mm", help: "建議 20-30mm（手指穿過剛好）。", dependsOn: { key: "withHandle", equals: true } },
  { group: "handle", type: "number", key: "handleTopMargin", label: "把手距壁頂 (mm)", defaultValue: 15, min: 5, max: 50, step: 1, unit: "mm", help: "把手孔上緣距離壁頂的距離。", dependsOn: { key: "withHandle", equals: true } },

  // === Divider 內隔分格 ===
  { group: "divider", type: "number", key: "dividers", label: "縱向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, unit: "片", help: "沿長邊方向插入的縱向隔板（把盒內切成數欄）", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "divider", type: "number", key: "crossDividers", label: "橫向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, unit: "片", help: "沿短邊方向插入的橫向隔板（與縱向隔板交叉可分多格）", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "divider", type: "number", key: "dividerThickness", label: "隔板厚度 (mm)", defaultValue: 6, min: 3, max: 12, step: 1, unit: "mm", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "divider", type: "number", key: "dividerHeight", label: "隔板高度 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, unit: "mm", help: "0 = 自動（壁高 - 10mm 留蓋空間），>0 自訂高度（不可超過壁內高）", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "divider", type: "number", key: "dividerInset", label: "隔板入溝深度 (mm)", defaultValue: 3, min: 0, max: 8, step: 1, unit: "mm", help: "隔板兩端嵌入壁內側 dado 的深度（4 壁內面鋸槽嵌入，固定但可拆）", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "divider", type: "checkbox", key: "withInnerTray", label: "活動分隔抽板", defaultValue: false, help: "盒內加一片可拆活動隔板（30mm 高 × 6 格），首飾分類用；與固定隔板可共存", wide: true },

  // === Lining 內襯 ===
  { group: "lining", type: "checkbox", key: "withFeltLining", label: "內襯絨布", defaultValue: false, help: "底面 + 4 壁內側貼絨布（首飾盒、珠寶盒必加），保護內容物 + 提升質感", wide: true },
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
  const boxShape = getOption<string>(input, opt(o, "boxShape")) as "rect" | "oct";
  // 新增選項（v2）
  const dovetailSegmentsRaw = getOption<number>(input, opt(o, "dovetailSegments"));
  const dovetailSegments = dovetailSegmentsRaw === 5 && preset?.dovetailSegments !== undefined ? preset.dovetailSegments : dovetailSegmentsRaw;
  const dovetailAngleRaw = getOption<string>(input, opt(o, "dovetailAngle"));
  const dovetailAngle = dovetailAngleRaw === "1:7" && preset?.dovetailAngle ? preset.dovetailAngle : dovetailAngleRaw;
  const bottomAttachRaw = getOption<string>(input, opt(o, "bottomAttach"));
  const bottomAttach = (bottomAttachRaw === "grooved" && preset?.bottomAttach ? preset.bottomAttach : bottomAttachRaw) as "grooved" | "floating" | "nailed";
  const dividersRaw = getOption<number>(input, opt(o, "dividers"));
  const dividers = dividersRaw === 0 && preset?.dividers !== undefined ? preset.dividers : dividersRaw;
  const crossDividersRaw = getOption<number>(input, opt(o, "crossDividers"));
  const crossDividers = crossDividersRaw === 0 && preset?.crossDividers !== undefined ? preset.crossDividers : crossDividersRaw;
  const dividerThickness = getOption<number>(input, opt(o, "dividerThickness"));
  const dividerHeightRaw = getOption<number>(input, opt(o, "dividerHeight"));
  const dividerInset = getOption<number>(input, opt(o, "dividerInset"));
  // 把手孔（從 tray port）：preset 可覆寫
  const withHandleRaw = getOption<boolean>(input, opt(o, "withHandle"));
  const withHandle = withHandleRaw === false && preset?.withHandle !== undefined ? preset.withHandle : withHandleRaw;
  const handleShapeRaw = getOption<string>(input, opt(o, "handleShape"));
  const handleShape = (handleShapeRaw === "pill" && preset?.handleShape ? preset.handleShape : handleShapeRaw) as "rect" | "pill" | "circle";
  const handleWidthOpt = getOption<number>(input, opt(o, "handleWidth"));
  const handleHeightOpt = getOption<number>(input, opt(o, "handleHeight"));
  const handleTopMarginOpt = getOption<number>(input, opt(o, "handleTopMargin"));

  // 蓋板與壁同厚，方便共用同款料
  const lidT = withLid ? wallT : 0;

  // 八角盒：跳過 buildBox 直接組多邊形 stave + 圓底盤 + (選用) 圓頂蓋
  if (boxShape === "oct") {
    const outerD = Math.min(outerL, outerW);
    const staves = polygonStaves({ sides: 8, outerD, outerH, wallT, botT, material });
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
    const polyParts: Part[] = [polyBottom, ...staves];
    if (withLid) {
      polyParts.push({
        id: "lid",
        nameZh: "八角頂蓋",
        material,
        grainDirection: "length",
        visible: { length: innerD, width: innerD, thickness: lidT },
        origin: { x: 0, y: outerH - lidT, z: 0 },
        shape: { kind: "round" },
        tenons: [],
        mortises: [],
      });
    }
    return {
      id: `dovetail-box-oct-${outerD}x${outerH}`,
      category: "dovetail-box",
      nameZh: "八角鳩尾盒",
      overall: { length: outerD, width: outerD, thickness: outerH },
      parts: polyParts,
      defaultJoinery: "mitered-spline",
      useButtJointConvention: false,
      primaryMaterial: material,
      notes: `八角鳩尾盒外接圓 ⌀${outerD}mm × 高 ${outerH}mm，壁厚 ${wallT}mm。8 段直立壁邊接 22.5° 斜切（45° 內角），相鄰邊用 mitered-spline（斜接 + 木鴿尾鍵）加固——比方盒鳩尾更難切但視覺最美。${withLid ? "頂蓋圓盤從盒口蓋上。" : ""}${withFeltLining ? " 內側 8 壁 + 底貼絨布。" : ""}${edgeChamfer > 0 ? ` 外露邊倒 ${edgeChamfer}mm 防割手。` : ""}`,
    };
  }

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    lidT,
    material,
    cornerJoinery: "dovetail",
    // bottomFit 對應 bottomAttach：grooved → 鋸槽嵌入；其餘（floating / nailed）→
    // 底板與外壁齊邊，nailed 是上膠+釘合（builder 不分這兩種，靠 notes 區分）
    bottomFit: bottomAttach === "grooved" ? "grooved" : "floating",
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
    "wall-left": withHandle ? "左短壁（鳩尾母 + 把手孔）" : "左壁（鳩尾母）",
    "wall-right": withHandle ? "右短壁（鳩尾母 + 把手孔）" : "右壁（鳩尾母）",
  };
  for (const p of built.parts) {
    if (nameMap[p.id]) p.nameZh = nameMap[p.id];
  }

  // 把手描述（純文字 hint，3D 渲染端目前未挖實際孔——只在材料單與工序註明）
  const handleDesc = withHandle
    ? ` 兩端短邊中央偏上挖${
        handleShape === "pill" ? "圓角長條" : handleShape === "circle" ? "圓形" : "矩形"
      }穿透把手孔（${
        handleShape === "circle"
          ? `⌀${handleHeightOpt}mm`
          : `${handleWidthOpt}×${handleHeightOpt}mm`
      }，距壁頂 ${handleTopMarginOpt}mm），手指穿過提起。`
    : "";

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
        ? `**通鳩尾**接合（每角 ${dovetailSegments} 齒，傾角 ${dovetailAngle}），從盒外能看到指狀鳩尾紋路，傳統工藝展示款。`
        : dovetailStyle === "half-blind"
          ? `**半隱鳩尾**接合（每角 ${dovetailSegments} 齒，傾角 ${dovetailAngle}），從正面看不到鳩尾，盒身視覺乾淨——傳統抽屜做法。`
          : `**暗鳩尾**接合（secret mitered dovetail，每角 ${dovetailSegments} 齒，傾角 ${dovetailAngle}），4 角看起來純斜接，鳩尾完全藏在內部，最高難度。`
    }${
      bottomAttach === "grooved"
        ? "底板槽接 4 壁內側下緣，不上膠（讓底板可熱漲冷縮）。"
        : bottomAttach === "floating"
          ? "底板與 4 壁齊邊膠合（整面塗膠，固定但不可拆）。"
          : "底板齊邊，從外面打 4 邊釘合 + 中央上膠（傳統工具盒做法）。"
    }${withLid ? `蓋子做${
      lidType === "sliding"
        ? "**滑入式**（蓋兩側下緣鋸凸條，前後壁內側上緣鋸對應槽，從前面滑入）"
        : lidType === "hinged"
          ? "**鉸鏈式**（後壁裝小銅鉸鏈一對，B&Q 有售 NT$ 50/對）"
          : lidType === "lift-off"
            ? "**整片活動蓋**（不固定，蓋內側加 4 條 cleat 卡入盒口防滑）"
            : "**嵌入式**（蓋邊緣鋸 4 mm 搭接溝，蓋下扣盒口）"
    }。` : ""}${handleDesc}${withFeltLining ? "內側 4 壁 + 底面貼絨布（B&Q / 美術社買 1mm 自黏絨布，剪好後黏入），珠寶 / 首飾盒必加。" : ""}${withMagneticClosure ? "蓋子前緣埋 2 個 6mm 釹磁鐵（鑽 6mm 圓孔嵌入 + AB 膠固定），蓋下時自動吸合。" : ""}${withInnerTray ? "盒內加一片可拆活動隔板（30mm 高 × 6 格 jewelry tray），底部加 4 個橡膠墊腳避免刮花底層。" : ""}${(dividers > 0 || crossDividers > 0) ? `盒內加${dividers > 0 ? ` ${dividers} 片縱向隔板` : ""}${dividers > 0 && crossDividers > 0 ? " +" : ""}${crossDividers > 0 ? ` ${crossDividers} 片橫向隔板` : ""}（厚 ${dividerThickness}mm，入溝深 ${dividerInset}mm，4 壁內側鋸 dado 嵌入）。` : ""}${edgeChamfer > 0 ? ` 外露邊緣倒 ${edgeChamfer}mm 防割手 + 微倒美感。` : ""}**鳩尾盒是進階接合的入門練習**——先做這個再做抽屜，所有鳩尾技巧都會了。`,
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

  // 固定內隔板：縱向（沿 X 軸延伸，沿 Z 分布） + 橫向（沿 Z 軸延伸，沿 X 分布）
  // 兩端嵌入 4 壁內側 dado 槽（深 dividerInset mm），高度可自訂或自動（壁高 - 10mm 留蓋空間）。
  const wallInnerH = outerH - botT - (withLid ? lidT : 0);
  const autoDividerH = Math.max(10, wallInnerH - 10);
  const actualDividerH = dividerHeightRaw > 0 ? Math.min(dividerHeightRaw, wallInnerH) : autoDividerH;
  const innerLDim = outerL - 2 * wallT;
  const innerWDim = outerW - 2 * wallT;
  // 縱向隔板：沿 X 延伸（length = innerL + 2 * dividerInset，兩端伸進壁 dado），
  // 沿 Z 軸等距分布，把盒內切成 (dividers + 1) 欄
  if (dividers > 0) {
    const divL = innerLDim + 2 * dividerInset;
    for (let i = 0; i < dividers; i++) {
      const zPos = -innerWDim / 2 + ((i + 1) * innerWDim) / (dividers + 1);
      design.parts.push({
        id: `divider-lengthwise-${i + 1}`,
        nameZh: `縱向隔板 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: divL, width: actualDividerH, thickness: dividerThickness },
        origin: { x: 0, y: botT + actualDividerH / 2, z: zPos },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }
  // 橫向隔板：沿 Z 延伸（length = innerW + 2 * dividerInset），沿 X 軸等距分布
  if (crossDividers > 0) {
    const divW = innerWDim + 2 * dividerInset;
    for (let i = 0; i < crossDividers; i++) {
      const xPos = -innerLDim / 2 + ((i + 1) * innerLDim) / (crossDividers + 1);
      design.parts.push({
        id: `divider-crosswise-${i + 1}`,
        nameZh: `橫向隔板 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: divW, width: actualDividerH, thickness: dividerThickness },
        origin: { x: xPos, y: botT + actualDividerH / 2, z: 0 },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
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
  // 暗鳩尾要求板厚 ≥ 12mm（spec §2.3）
  if (dovetailStyle === "secret-mitered" && wallT < 12) {
    extraWarnings.push(`暗鳩尾要求壁厚 ≥ 12mm（外 mitre 層 + 內部 tail/pin 才有空間），目前 ${wallT}mm 不建議做`);
  }
  // 齒數對盒長的合理性
  if (dovetailSegments >= 9 && outerH < 80) {
    extraWarnings.push(`盒高 ${outerH}mm 配 ${dovetailSegments} 齒太密，每齒寬度不足；建議減到 5-7 齒`);
  }
  // 隔板高度檢查
  if (dividerHeightRaw > wallInnerH) {
    extraWarnings.push(`隔板高度 ${dividerHeightRaw}mm 超過壁內高 ${wallInnerH}mm，已自動截到壁內高`);
  }
  // 把手孔寬度檢查
  if (withHandle && handleShape !== "circle" && handleWidthOpt > Math.max(0, outerL - 2 * wallT - 40)) {
    extraWarnings.push(`把手孔寬 ${handleWidthOpt}mm 對 ${outerL}mm 盒長太寬——壁兩端應各留 ≥20mm 餘料，建議調小到 ${Math.max(0, outerL - 2 * wallT - 40)}mm 以內`);
  }
  if (extraWarnings.length) design.warnings = [...(design.warnings ?? []), ...extraWarnings];
  return design;
};
