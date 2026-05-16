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
  cornerJoinery?: string;
  dovetailSegments?: number;
  dovetailAngle?: number;
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
  // 首飾盒：薄壁、鳩尾、絨布、磁吸、jewelry 抽板、十字內格
  jewelry: { wallThickness: 10, bottomThickness: 6, dovetailSegments: 7, dovetailAngle: 10, bottomAttach: "seated", lidType: "hinged", withFeltLining: true, withMagneticClosure: true, withInnerTray: true, dividers: 1, crossDividers: 2 },
  // 雪茄盒：較厚壁（保濕）、嵌入式蓋、絨布
  cigar: { wallThickness: 15, bottomThickness: 8, dovetailSegments: 5, dovetailAngle: 8, bottomAttach: "seated", lidType: "rabbeted", withFeltLining: true },
  // 茶葉盒：厚壁防潮、滑入式蓋、無內襯
  tea: { wallThickness: 12, bottomThickness: 8, dovetailSegments: 5, dovetailAngle: 10, bottomAttach: "seated", lidType: "sliding" },
  // 手錶盒：薄壁、鉸鏈蓋、絨布、磁吸、橫向 3 隔（4 格放手錶）
  watch: { wallThickness: 10, bottomThickness: 6, dovetailSegments: 5, dovetailAngle: 10, bottomAttach: "seated", lidType: "hinged", withFeltLining: true, withMagneticClosure: true, crossDividers: 3 },
  // 文件盒：厚壁、鉸鏈蓋、搬運把手（公文盒提把）
  document: { wallThickness: 14, bottomThickness: 8, dovetailSegments: 7, dovetailAngle: 8, bottomAttach: "seated", lidType: "hinged", withHandle: true, handleShape: "pill" },
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
    { value: "hex", label: "六角盒（6 段斜接，禮品款）" },
    { value: "oct", label: "八角盒（8 段斜接，禮品款）" },
  ], help: "六/八角款用 stave 拼接邊接（六角 60° / 八角 45° 內角），鳩尾改 mitered-spline；不支援滑入式蓋、把手孔、活動抽板" },
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 12, min: 8, max: 25, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "bottomAttach", label: "底板裝法", defaultValue: "seated", choices: [
    { value: "seated", label: "底板內縮（壁立其上膠合，最簡單）" },
    { value: "inset-panel", label: "鑲板入溝（像抽屜底板，4 壁開槽嵌入）" },
    { value: "flush-glued", label: "整塊膠合（底板與外框齊邊）" },
  ], help: "底板內縮=底板嵌入壁內、壁壓在底板邊緣膠合（最簡單）；鑲板入溝=4 壁內側開 5mm 槽、底板浮嵌（季節伸縮免裂）；整塊膠合=底板整塊外緣與框體齊邊、強力膠合。", wide: true },
  { group: "structure", type: "number", key: "edgeChamfer", label: "邊緣倒角 (mm)", defaultValue: 1, min: 0, max: 6, step: 1, unit: "mm", help: "外露角倒角，1-2mm 微倒手感佳" },

  // === Joinery 角接合 ===
  { group: "joinery", type: "select", key: "cornerJoinery", label: "角接合方式", defaultValue: "dovetail", choices: [
    { value: "stub-joint", label: "搭接（rabbet，最簡單，內側鋸槽再膠合）" },
    { value: "finger-joint", label: "指接（finger joint，外露指狀，新手練習首選）" },
    { value: "miter", label: "斜角拼（45°，最隱形但要對齊，膠合 + 細釘加固）" },
    { value: "dovetail", label: "鳩尾（dovetail，傳統工藝，分通鳩尾 / 半隱 / 暗鳩尾三種）" },
  ], help: "搭接 → 指接 → 鳩尾，加工難度由低到高。dovetail-box 模板核心是鳩尾，但其他三種也支援。", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "joinery", type: "number", key: "dovetailSegments", label: "鳩尾段數（每角）", defaultValue: 0, min: 0, max: 21, step: 1, help: "0=自動（依壁高自動算奇數），1-21=手動指定段數。包含 pin + tail 總段數；建議奇數（5/7/9/11），兩端為半 pin 較穩。", dependsOn: { all: [{ key: "boxShape", equals: "rect" }, { key: "cornerJoinery", equals: "dovetail" }] } },
  { group: "joinery", type: "number", key: "dovetailAngle", label: "鳩尾角度 (°)", defaultValue: 10, min: 5, max: 18, step: 1, unit: "°", help: "傳統 1:6 (約 9.5°，軟木) ~ 1:8 (約 7.1°，硬木)。角太小拉力不足、太大易斷。", dependsOn: { all: [{ key: "boxShape", equals: "rect" }, { key: "cornerJoinery", equals: "dovetail" }] } },
  { group: "joinery", type: "number", key: "fingerSegments", label: "指接段數（每角）", defaultValue: 0, min: 0, max: 30, step: 1, help: "0=自動（依壁高自動算奇數），1-30=手動指定段數。建議奇數（5/7/9/11/13），兩端都是齒視覺較對稱。", dependsOn: { all: [{ key: "boxShape", equals: "rect" }, { key: "cornerJoinery", equals: "finger-joint" }] } },

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
  { group: "divider", type: "select", key: "polygonDividerStyle", label: "多邊形隔板", defaultValue: "none", choices: [
    { value: "none", label: "無隔板" },
    { value: "single", label: "單片直徑（穿過中心）" },
    { value: "cross", label: "十字（2 片穿過中心交叉）", dependsOn: { key: "boxShape", equals: "oct" } },
  ], dependsOn: { key: "boxShape", notIn: ["rect"] }, help: "六/八角盒專用。單片穿過盒中心；八角還可以選十字（六角因壁間距 60° 不對齊垂直，不支援）。" },
  { group: "divider", type: "number", key: "dividers", label: "縱向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, unit: "片", help: "沿長邊方向插入的縱向隔板（把盒內切成數欄）", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "divider", type: "number", key: "crossDividers", label: "橫向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, unit: "片", help: "沿短邊方向插入的橫向隔板（與縱向隔板交叉可分多格）", dependsOn: { key: "boxShape", equals: "rect" } },
  { group: "divider", type: "number", key: "dividerThickness", label: "隔板厚度 (mm)", defaultValue: 6, min: 3, max: 12, step: 1, unit: "mm", help: "rect 用縱/橫向隔板、六/八角用穿心隔板共用此厚度" },
  { group: "divider", type: "number", key: "dividerHeight", label: "隔板高度 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, unit: "mm", help: "0 = 自動（壁高 - 10mm 留蓋空間），>0 自訂高度（不可超過壁內高）" },
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
  const lidTypeRaw = getOption<string>(input, opt(o, "lidType"));
  const lidType = lidTypeRaw === "sliding" && preset?.lidType ? preset.lidType : lidTypeRaw;
  const withFeltLiningRaw = getOption<boolean>(input, opt(o, "withFeltLining"));
  const withFeltLining = withFeltLiningRaw === false && preset?.withFeltLining !== undefined ? preset.withFeltLining : withFeltLiningRaw;
  const withMagneticClosureRaw = getOption<boolean>(input, opt(o, "withMagneticClosure"));
  const withMagneticClosure = withMagneticClosureRaw === false && preset?.withMagneticClosure !== undefined ? preset.withMagneticClosure : withMagneticClosureRaw;
  const withInnerTrayRaw = getOption<boolean>(input, opt(o, "withInnerTray"));
  const withInnerTray = withInnerTrayRaw === false && preset?.withInnerTray !== undefined ? preset.withInnerTray : withInnerTrayRaw;
  const edgeChamfer = getOption<number>(input, opt(o, "edgeChamfer"));
  const boxShape = getOption<string>(input, opt(o, "boxShape")) as "rect" | "hex" | "oct";
  const polygonDividerStyle = getOption<string>(input, opt(o, "polygonDividerStyle"));
  // 角接合方式：preset 可覆寫
  const cornerJoineryRaw = getOption<string>(input, opt(o, "cornerJoinery"));
  const cornerJoinery = (cornerJoineryRaw === "dovetail" && preset?.cornerJoinery ? preset.cornerJoinery : cornerJoineryRaw) as
    | "stub-joint"
    | "finger-joint"
    | "miter"
    | "dovetail";
  const fingerSegmentsOpt = getOption<number>(input, opt(o, "fingerSegments"));
  // 鳩尾段數 / 角度（托盤格式：0=自動算奇數、5-18° number）
  const dovetailSegmentsRaw = getOption<number>(input, opt(o, "dovetailSegments"));
  const dovetailSegmentsOpt = dovetailSegmentsRaw === 0 && preset?.dovetailSegments !== undefined ? preset.dovetailSegments : dovetailSegmentsRaw;
  const dovetailAngleRaw = getOption<number>(input, opt(o, "dovetailAngle"));
  const dovetailAngleOpt = dovetailAngleRaw === 10 && preset?.dovetailAngle !== undefined ? preset.dovetailAngle : dovetailAngleRaw;
  const bottomAttachRaw = getOption<string>(input, opt(o, "bottomAttach"));
  const bottomAttach = (bottomAttachRaw === "seated" && preset?.bottomAttach ? preset.bottomAttach : bottomAttachRaw) as "seated" | "inset-panel" | "flush-glued";
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

  // 六/八角盒：跳過 buildBox 直接組多邊形 stave（mitered-ends inset）
  //            + regular-polygon 底板 + (選用) regular-polygon 頂蓋 + (選用) 穿心隔板
  if (boxShape === "hex" || boxShape === "oct") {
    const sides = boxShape === "hex" ? 6 : 8;
    const outerD = Math.min(outerL, outerW);
    const apothem = (outerD / 2) * Math.cos(Math.PI / sides);
    const outerWallVertexR = outerD / 2;

    // 底板裝法：托盤命名 seated / inset-panel / flush-glued 對應 polygon 三套幾何
    let stavesOuterH: number; // 傳給 polygonStaves，內部 wallH = stavesOuterH - botT
    let stavesBaseY: number;
    let bottomOriginY: number;
    let bottomVertexR: number;
    let bottomAttachDesc: string;
    if (bottomAttach === "inset-panel") {
      // 鑲板入溝：壁全高、底板邊緣卡進壁內側溝槽（5mm）
      stavesOuterH = outerH + botT;
      stavesBaseY = 0;
      bottomOriginY = botT;
      const grooveDepth = Math.min(5, wallT - 1);
      const bottomApothem = (apothem - wallT) + grooveDepth;
      bottomVertexR = bottomApothem / Math.cos(Math.PI / sides);
      bottomAttachDesc = `**鑲板入溝**（${sides} 壁全高、底板邊緣卡進壁內側溝槽 ${grooveDepth}mm，季節伸縮免裂）`;
    } else if (bottomAttach === "flush-glued") {
      // 整塊膠合：底板外緣與框體齊邊、整面塗膠
      stavesOuterH = outerH;
      stavesBaseY = botT;
      bottomOriginY = 0;
      bottomVertexR = outerWallVertexR;
      bottomAttachDesc = "**整塊膠合**（底板外緣與框體齊邊，整面塗膠）";
    } else { // seated
      // 底板內縮：底板邊緣壓入壁內 wallT/2，N 段壁壓在底板邊緣膠合
      stavesOuterH = outerH;
      stavesBaseY = botT;
      bottomOriginY = 0;
      const seatOverlap = wallT / 2;
      const bottomApothem = (apothem - wallT) + seatOverlap;
      bottomVertexR = bottomApothem / Math.cos(Math.PI / sides);
      bottomAttachDesc = `**底板內縮**（底板邊緣壓入壁內 ${seatOverlap}mm，${sides} 段壁壓在底板邊緣膠合）`;
    }
    const staves = polygonStaves({ sides, outerD, outerH: stavesOuterH, wallT, botT, material, baseY: stavesBaseY });
    // 端面 mitre（角度 = π/N，相鄰兩壁總共 2π/N = 外角）
    const miterInset = wallT * Math.tan(Math.PI / sides);
    for (const stave of staves) {
      stave.shape = { kind: "mitered-ends", insetEach: miterInset, outerSide: "+y" };
    }

    const bottomBbox = 2 * bottomVertexR;
    const polyBottom: Part = {
      id: "bottom",
      nameZh: `${sides} 角底板`,
      material,
      grainDirection: "length",
      visible: { length: bottomBbox, width: bottomBbox, thickness: botT },
      origin: { x: 0, y: bottomOriginY, z: 0 },
      shape: { kind: "regular-polygon", sides, outerRadius: bottomVertexR },
      tenons: [],
      mortises: [],
    };

    // 穿心隔板（single / cross）；hex 不支援 cross（壁間距 60° 不對齊垂直）
    const polygonDividerParts: Part[] = [];
    const polyDividerStyleStr = (sides === 6 && polygonDividerStyle === "cross") ? "single" : polygonDividerStyle as string;
    if (polyDividerStyleStr === "single" || polyDividerStyleStr === "cross") {
      const innerFlatR = apothem - wallT;
      const polyDividerGroove = Math.min(5, wallT - 1);
      const polyDividerLen = 2 * innerFlatR + 2 * polyDividerGroove;
      const polyBottomTopY = bottomAttach === "inset-panel" ? 2 * botT : botT;
      const polyDividerHAuto = Math.max(1, outerH - polyBottomTopY - (withLid ? lidT : 0));
      const polyDividerH = dividerHeightRaw > 0
        ? Math.max(1, Math.min(dividerHeightRaw, polyDividerHAuto))
        : polyDividerHAuto;
      polygonDividerParts.push({
        id: "divider-1",
        nameZh: "穿心隔板 1（縱）",
        material,
        grainDirection: "length",
        visible: { length: polyDividerLen, width: polyDividerH, thickness: dividerThickness },
        origin: { x: 0, y: polyBottomTopY, z: 0 },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
      if (polyDividerStyleStr === "cross") {
        polygonDividerParts.push({
          id: "divider-2",
          nameZh: "穿心隔板 2（橫）",
          material,
          grainDirection: "length",
          visible: { length: polyDividerLen, width: polyDividerH, thickness: dividerThickness },
          origin: { x: 0, y: polyBottomTopY, z: 0 },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      // CSG cosmetic mortise（4 / 8 壁加 dado 槽嵌入隔板）
      const addStaveMortise = (staveIdx: number) => {
        const stave = staves[staveIdx];
        if (!stave) return;
        stave.mortises.push({
          origin: { x: 0, y: wallT, z: 0 },
          depth: polyDividerGroove + 0.3,
          length: polyDividerH + 0.5,
          width: dividerThickness + 0.5,
          through: false,
          shape: "rect",
          cosmetic: true,
        });
      };
      addStaveMortise(0);
      addStaveMortise(sides / 2);
      if (polyDividerStyleStr === "cross") {
        addStaveMortise(sides / 4);
        addStaveMortise((3 * sides) / 4);
      }
    }
    const polyDividerDesc = polyDividerStyleStr === "single"
      ? "，內部 1 片穿心隔板分 2 區"
      : polyDividerStyleStr === "cross"
        ? "，內部十字隔板分 4 區"
        : "";

    const polyParts: Part[] = [polyBottom, ...staves, ...polygonDividerParts];

    // 頂蓋：lift-off / hinged 兩款比較直觀；其他型式對 polygon 不適用
    if (withLid) {
      polyParts.push({
        id: "lid",
        nameZh: `${sides} 角頂蓋`,
        material,
        grainDirection: "length",
        visible: { length: bottomBbox, width: bottomBbox, thickness: lidT },
        origin: { x: 0, y: outerH - lidT, z: 0 },
        shape: { kind: "regular-polygon", sides, outerRadius: bottomVertexR },
        tenons: [],
        mortises: [],
      });
    }

    // 絨布內襯（polygon 簡化版：只貼底）
    if (withFeltLining) {
      const feltApothem = Math.max(1, apothem - wallT - 2);
      const feltVertexR = feltApothem / Math.cos(Math.PI / sides);
      polyParts.push({
        id: "felt-bottom",
        nameZh: "絨布內襯（底）",
        material,
        grainDirection: "length",
        visible: { length: 2 * feltVertexR, width: 2 * feltVertexR, thickness: 1 },
        origin: { x: 0, y: bottomOriginY + botT, z: 0 },
        shape: { kind: "regular-polygon", sides, outerRadius: feltVertexR },
        tenons: [],
        mortises: [],
        visual: "fabric",
      });
    }

    const polyDesign: FurnitureDesign = {
      id: `dovetail-box-${boxShape}-${outerD}x${outerH}`,
      category: "dovetail-box",
      nameZh: `${sides === 6 ? "六" : "八"}角鳩尾盒`,
      overall: { length: outerD, width: outerD, thickness: outerH },
      parts: polyParts,
      defaultJoinery: "mitered-spline",
      useButtJointConvention: false,
      primaryMaterial: material,
      notes: `${sides === 6 ? "六" : "八"}角鳩尾盒，外接圓 ⌀${outerD}mm × 高 ${outerH}mm，壁厚 ${wallT}mm。${sides} 段直立壁邊接 ${(180 / sides).toFixed(1)}° 斜切（${sides === 6 ? "60° 內角" : "45° 內角"}），相鄰邊用 mitered-spline（斜接 + 木鴿尾鍵）加固——比方盒鳩尾更難切但視覺最美。底板採 ${bottomAttachDesc}${polyDividerDesc}。${withLid ? `加 ${sides === 6 ? "六" : "八"} 邊形頂蓋從盒口蓋上。` : ""}${withFeltLining ? " 內底貼絨布。" : ""}${edgeChamfer > 0 ? ` 外露邊倒 ${edgeChamfer}mm 防割手。` : ""}`,
    };

    // polygon 也跑壁厚 / 尺寸合理性檢查
    const polyWarnings: string[] = [];
    if (outerD > 400 || outerH > 250) {
      polyWarnings.push(`${sides === 6 ? "六" : "八"}角盒 ⌀${outerD}×${outerH}mm 超過合理範圍（max ⌀400×250mm）。再大就是收納箱級別`);
    }
    if (wallT < 10 && outerD > 250) {
      polyWarnings.push(`壁厚 ${wallT}mm 對 ⌀${outerD}mm 太薄——多邊形斜接需要足夠端面承黏，建議加厚到 12mm 以上`);
    }
    if (polyWarnings.length) polyDesign.warnings = polyWarnings;
    return polyDesign;
  }

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    lidT,
    material,
    // miter 由 shape 自己畫斜切，buildBox 走 stub-joint base
    cornerJoinery: cornerJoinery === "miter" ? "stub-joint" : cornerJoinery,
    // bottomFit 對應 bottomAttach：flush-glued → floating（底板齊邊整面塗膠），
    //                             else（seated / inset-panel） → grooved（buildBox 預設 inset）
    bottomFit: bottomAttach === "flush-glued" ? "floating" : "grooved",
  });

  // 底板裝法後處理（仿托盤）：蓋掉 buildBox 預設幾何
  const bottomPart = built.parts.find((p) => p.id === "bottom");
  if (bottomPart) {
    if (bottomAttach === "inset-panel") {
      // 鑲板入溝：4 壁全高（從 y=0 起到 outerH）、底板浮嵌於壁內側 5mm 槽中
      const grooveDepth = 5;
      const insetEach = Math.max(2, wallT - grooveDepth);
      bottomPart.visible = {
        length: outerL - 2 * insetEach,
        width: outerW - 2 * insetEach,
        thickness: botT,
      };
      bottomPart.origin = { x: 0, y: botT, z: 0 };
      for (const part of built.parts) {
        if (part.id.startsWith("wall-")) {
          part.visible = { ...part.visible, width: outerH - (withLid ? lidT : 0) };
          part.origin = { ...part.origin, y: 0 };
        }
      }
    } else if (bottomAttach === "flush-glued") {
      // 整塊膠合：底板外緣與框體齊
      bottomPart.visible = { length: outerL, width: outerW, thickness: botT };
      bottomPart.origin = { x: 0, y: 0, z: 0 };
    }
    // seated 不動，保留 buildBox 既有結果（底板嵌入壁內 + 壁立其上）
  }

  // miter / finger-joint / dovetail：短壁也延伸到外角全長（搭接才夾在長壁之間）
  // 並清除 buildBox 預先產的榫頭，改由 shape 屬性表達榫接幾何
  if (cornerJoinery === "miter" || cornerJoinery === "finger-joint" || cornerJoinery === "dovetail") {
    for (const part of built.parts) {
      if (part.id === "wall-front" || part.id === "wall-back") {
        part.visible = { ...part.visible, length: outerL };
        part.tenons = [];
      } else if (part.id === "wall-left" || part.id === "wall-right") {
        part.visible = { ...part.visible, length: outerW };
        part.tenons = [];
      }
    }
  }

  // miter 4 壁掛 mitered-ends shape：3D / 三視圖端面渲成 45° 斜切。
  if (cornerJoinery === "miter") {
    for (const part of built.parts) {
      let outerSide: "+y" | "-y" | null = null;
      if (part.id === "wall-back" || part.id === "wall-right") outerSide = "+y";
      else if (part.id === "wall-front" || part.id === "wall-left") outerSide = "-y";
      if (outerSide) {
        part.shape = { kind: "mitered-ends", insetEach: wallT, outerSide };
      }
    }
  }

  // finger-joint 4 壁掛 finger-joint-ends shape：comb 沿 wallH 方向交錯。
  let fingerJointInfo: { segmentCount: number; fingerW: number } | null = null;
  if (cornerJoinery === "finger-joint") {
    let segmentCount: number;
    if (fingerSegmentsOpt > 0) {
      segmentCount = Math.max(2, Math.min(30, Math.floor(fingerSegmentsOpt)));
    } else {
      const totalH = outerH - botT;
      segmentCount = Math.max(3, Math.round(totalH / (1.5 * wallT)));
      if (segmentCount % 2 === 0) segmentCount += 1;
      segmentCount = Math.min(13, segmentCount);
    }
    const wallActualH = outerH - botT - (withLid ? lidT : 0);
    fingerJointInfo = { segmentCount, fingerW: Math.max(1, wallActualH / segmentCount) };
    for (const part of built.parts) {
      let phase: 0 | 1 | null = null;
      if (part.id === "wall-front" || part.id === "wall-back") phase = 0;
      else if (part.id === "wall-left" || part.id === "wall-right") phase = 1;
      if (phase !== null) {
        part.shape = {
          kind: "finger-joint-ends",
          segmentCount,
          phase,
          fingerDepth: wallT,
        };
      }
    }
  }

  // dovetail 4 壁掛 dovetail-ends shape：trapezoid 段沿 wallH 方向交錯。
  // 仿托盤：前後板切 tail 凸齒（dovetail-ends phase=0 halfPin），左右板維持
  // plain box，組裝後 CSG 把左右板跟 tail 重疊處挖掉（比硬算 pin 形狀對齊 tail 簡單可靠）。
  let dovetailInfo: { segmentCount: number; segH: number; angleDeg: number; bumped: boolean } | null = null;
  if (cornerJoinery === "dovetail") {
    let segmentCount: number;
    let bumped = false;
    if (dovetailSegmentsOpt > 0) {
      segmentCount = Math.max(3, Math.min(21, Math.floor(dovetailSegmentsOpt)));
      // phase=0 halfPin=true 要求奇數段（不然 s=N-2 s=N-1 兩個都是 pin → 渲染破口）
      if (segmentCount % 2 === 0) {
        segmentCount += 1;
        bumped = true;
      }
    } else {
      const totalH = outerH - botT;
      segmentCount = Math.max(3, Math.round(totalH / (1.8 * wallT)));
      if (segmentCount % 2 === 0) segmentCount += 1;
      segmentCount = Math.min(11, segmentCount);
    }
    const angleDeg = Math.max(5, Math.min(18, dovetailAngleOpt));
    const wallActualH = outerH - botT - (withLid ? lidT : 0);
    dovetailInfo = { segmentCount, segH: Math.max(1, wallActualH / segmentCount), angleDeg, bumped };
    for (const part of built.parts) {
      if (part.id === "wall-front" || part.id === "wall-back") {
        part.shape = {
          kind: "dovetail-ends",
          segmentCount,
          phase: 0,
          angleDeg,
          pinDepth: wallT,
          halfPin: true,
        };
      }
      // wall-left/right：維持 buildBox 給的 default box，CSG 在 3D 那層挖
    }
  }

  // 重新貼上中文零件名（box-builder 預設叫 前壁/後壁/左壁/右壁）
  // 隨 cornerJoinery 帶上接合角色提示
  const roleFM = cornerJoinery === "dovetail" ? "（鳩尾公）"
              : cornerJoinery === "finger-joint" ? "（指接 phase 0）"
              : cornerJoinery === "miter" ? "（45° 斜接）"
              : "（搭接）";
  const roleLR = cornerJoinery === "dovetail" ? "（鳩尾母）"
              : cornerJoinery === "finger-joint" ? "（指接 phase 1）"
              : cornerJoinery === "miter" ? "（45° 斜接）"
              : "（搭接）";
  const nameMap: Record<string, string> = {
    "wall-front": `前壁${roleFM}`,
    "wall-back": `後壁${roleFM}`,
    "wall-left": withHandle ? `左短壁${roleLR} + 把手孔` : `左壁${roleLR}`,
    "wall-right": withHandle ? `右短壁${roleLR} + 把手孔` : `右壁${roleLR}`,
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

  // 接合文案：四套說法依 cornerJoinery 分支
  const joineryDesc = cornerJoinery === "dovetail"
    ? `**鳩尾接合**（dovetail，${dovetailInfo ? `每角 ${dovetailInfo.segmentCount} 段、傾角 ${dovetailInfo.angleDeg}°` : ""}），傳統工藝展示款，從盒外能看到指狀鳩尾紋路。`
    : cornerJoinery === "finger-joint"
      ? `**指接**（finger joint，${fingerJointInfo ? `每角 ${fingerJointInfo.segmentCount} 段、每齒寬 ${fingerJointInfo.fingerW.toFixed(1)}mm` : ""}），外露指狀紋路，新手練習鳩尾前的最佳基本款。`
      : cornerJoinery === "miter"
        ? "**斜角拼**（45° 對接，最隱形但需鋸台或斜切片切精準對齊，膠合 + 細釘 / 餅乾榫加固）。"
        : "**搭接**（rabbet，最簡單：長壁端面銑 wallT/2 深的槽，短壁端面留厚塊嵌入，膠合即可）。";
  const joineryClosing = cornerJoinery === "dovetail"
    ? "**鳩尾盒是進階接合的入門練習**——先做這個再做抽屜，所有鳩尾技巧都會了。"
    : cornerJoinery === "finger-joint"
      ? "**指接是鳩尾的入門練習**——熟練後可進階到鳩尾。"
      : cornerJoinery === "miter"
        ? "**斜角拼最考驗精度**——鋸切角度差 0.5° 就會留縫，建議用斜切片切。"
        : "**搭接最快上手**——適合工具盒 / 收納箱等不講究外觀的用途。";

  const design: FurnitureDesign = {
    id: `dovetail-box-${outerL}x${outerW}x${outerH}`,
    category: "dovetail-box",
    nameZh: cornerJoinery === "dovetail" ? "鳩尾盒" : "木盒",
    overall: { length: outerL, width: outerW, thickness: outerH },
    parts: built.parts,
    defaultJoinery: cornerJoinery === "miter" ? "mitered-spline" : cornerJoinery,
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `木盒 ${outerL}×${outerW}×${outerH}mm，${joineryDesc}${
      bottomAttach === "inset-panel"
        ? "底板鑲板入溝：4 壁全高，內側鋸 5mm 槽、底板浮嵌（季節伸縮免裂，不上膠）。"
        : bottomAttach === "flush-glued"
          ? "底板與 4 壁齊邊整塊膠合（整面塗膠，固定但不可拆）。"
          : "底板內縮：底板嵌入壁內、4 壁壓在底板邊緣膠合（最簡單）。"
    }${withLid ? `蓋子做${
      lidType === "sliding"
        ? "**滑入式**（蓋兩側下緣鋸凸條，前後壁內側上緣鋸對應槽，從前面滑入）"
        : lidType === "hinged"
          ? "**鉸鏈式**（後壁裝小銅鉸鏈一對，B&Q 有售 NT$ 50/對）"
          : lidType === "lift-off"
            ? "**整片活動蓋**（不固定，蓋內側加 4 條 cleat 卡入盒口防滑）"
            : "**嵌入式**（蓋邊緣鋸 4 mm 搭接溝，蓋下扣盒口）"
    }。` : ""}${handleDesc}${withFeltLining ? "內側 4 壁 + 底面貼絨布（B&Q / 美術社買 1mm 自黏絨布，剪好後黏入），珠寶 / 首飾盒必加。" : ""}${withMagneticClosure ? "蓋子前緣埋 2 個 6mm 釹磁鐵（鑽 6mm 圓孔嵌入 + AB 膠固定），蓋下時自動吸合。" : ""}${withInnerTray ? "盒內加一片可拆活動隔板（30mm 高 × 6 格 jewelry tray），底部加 4 個橡膠墊腳避免刮花底層。" : ""}${(dividers > 0 || crossDividers > 0) ? `盒內加${dividers > 0 ? ` ${dividers} 片縱向隔板` : ""}${dividers > 0 && crossDividers > 0 ? " +" : ""}${crossDividers > 0 ? ` ${crossDividers} 片橫向隔板` : ""}（厚 ${dividerThickness}mm，入溝深 ${dividerInset}mm，4 壁內側鋸 dado 嵌入）。` : ""}${edgeChamfer > 0 ? ` 外露邊緣倒 ${edgeChamfer}mm 防割手 + 微倒美感。` : ""}${joineryClosing}`,
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
    extraWarnings.push(`木盒 ${outerL}×${outerW}×${outerH}mm 超過合理範圍（max 400×300×250mm）。再大就是收納箱級別，工序很重`);
  }
  if (cornerJoinery === "dovetail" && wallT < 10 && outerL > 250) {
    extraWarnings.push(`壁厚 ${wallT}mm 對 ${outerL}mm 長盒太薄——鳩尾齒太細不好切，建議加厚到 12mm 以上`);
  }
  // 段數對盒高的合理性
  if (cornerJoinery === "dovetail" && dovetailInfo && dovetailInfo.segmentCount >= 9 && outerH < 80) {
    extraWarnings.push(`盒高 ${outerH}mm 配 ${dovetailInfo.segmentCount} 段太密，每段寬度不足；建議減到 5-7 段`);
  }
  // 鳩尾段數偶數 → bump 到奇數（phase=0 halfPin 渲染要求奇數）
  if (cornerJoinery === "dovetail" && dovetailInfo?.bumped) {
    extraWarnings.push(`鳩尾段數 ${dovetailSegmentsOpt} 是偶數，已自動 +1 → ${dovetailInfo.segmentCount}（halfPin 兩端都是半 pin 要求奇數段才對稱）`);
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
