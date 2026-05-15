import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";
import { polygonStaves } from "./_builders/polygon-stave-builder";

/** 使用情境 preset */
interface TrayPresetConfig {
  wallThickness?: number;
  bottomThickness?: number;
  cornerJoinery?: string;
  dividers?: number;
  crossDividers?: number;
}
const TRAY_PRESETS: Record<string, TrayPresetConfig> = {
  // 一般托盤：方筒整空
  classic: { wallThickness: 8, bottomThickness: 8, cornerJoinery: "stub-joint", dividers: 0, crossDividers: 0 },
  // 文具站：grid 6 格分裝剪刀/筆/刀片
  "stationery-station": { wallThickness: 10, bottomThickness: 10, cornerJoinery: "finger-joint", dividers: 2, crossDividers: 1 },
  // 化妝刷筒：深款 + 1 縱向 + 倒角圓潤
  "makeup-brush": { wallThickness: 10, bottomThickness: 10, cornerJoinery: "stub-joint", dividers: 1, crossDividers: 0 },
  // 廚房料理工具筒：深 + 厚壁
  "kitchen-utensil": { wallThickness: 12, bottomThickness: 12, cornerJoinery: "finger-joint", dividers: 1, crossDividers: 1 },
  // 木工專用：4 格分裝尺/筆/夾子 + 厚壁耐撞
  "woodworker-caddy": { wallThickness: 12, bottomThickness: 12, cornerJoinery: "finger-joint", dividers: 2, crossDividers: 2 },
};

export const trayOptions: OptionSpec[] = [
  // 托盤永遠是方形——保留 schema 讓 getOption 回 "rect" 預設、其他 option 的
  // dependsOn 仍能 evaluate；用 sentinel dependsOn 把選項本身從表單隱藏。
  // 想之後讓托盤也有六/八角，把這條 dependsOn 拿掉即可。
  { group: "structure", type: "select", key: "bodyShape", label: "筒身形狀", defaultValue: "rect", dependsOn: { key: "__tray_polygon_disabled__", equals: "true" }, choices: [
    { value: "rect", label: "方筒（4 壁，最簡單）" },
    { value: "hex", label: "六角筒（6 段拼接）" },
    { value: "oct", label: "八角筒（8 段拼接）" },
  ], help: "六/八角款用 stave 拼接（取 length/width 較小邊為直徑）；方筒以外不支援 dividers" },
  { group: "preset", type: "select", key: "useCase", label: "使用情境預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（不套 preset）" },
    { value: "classic", label: "一般托盤（方筒整空）" },
    { value: "stationery-station", label: "文具站（grid 6 格分裝剪刀/筆/刀片）" },
    { value: "makeup-brush", label: "化妝刷筒（深款 + 縱向隔板 + 圓潤倒角）" },
    { value: "kitchen-utensil", label: "廚房料理工具筒（厚壁 + 4 格）" },
    { value: "woodworker-caddy", label: "木工專用（厚壁 + 9 格分裝尺/筆/夾子）" },
  ], help: "一鍵套適合該情境的壁厚 / 隔板 / 接合 / 倒角組合，user 後改不蓋。" },
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "bottomAttach", label: "底板接法", defaultValue: "seated", choices: [
    { value: "seated", label: "底板內縮（壁立其上膠合，最簡單）" },
    { value: "inset-panel", label: "鑲板入溝（像抽屜底板，4 壁開槽嵌入）" },
    { value: "flush-glued", label: "整塊膠合（底板與外框齊邊）" },
  ], help: "底板內縮=底板嵌入壁內、壁壓在底板邊緣膠合（最簡單）；鑲板入溝=4 壁內側開 5mm 槽、底板浮嵌（季節伸縮免裂）；整塊膠合=底板整塊外緣與框體齊邊、強力膠合。", wide: true },
  { group: "structure", type: "select", key: "cornerJoinery", label: "角接合方式", defaultValue: "stub-joint", choices: [
    { value: "stub-joint", label: "搭接（rabbet，最簡單）" },
    { value: "finger-joint", label: "指接（finger joint，外露指狀）" },
    { value: "miter", label: "斜角拼（45°，最隱形但要對齊）" },
  ], dependsOn: { key: "bodyShape", equals: "rect" } },
  // 壁向外撇 + 複斜接合：壁向外傾角度 0 = 垂直（傳統盒）；> 0 = 壁外撇（shaker 風托盤）。
  // 配合 miter corner 自動成為「複斜 miter」——鋸床要設複合角度（角度公式見
  // docs/drafting-math.md §「複斜接合」）。
  { group: "structure", type: "number", key: "wallSplay", label: "壁外撇角度 (°)", defaultValue: 0, min: 0, max: 15, step: 1, unit: "°", help: "0 = 垂直壁；> 0 = 壁向外傾（shaker 托盤風）。miter 角接合時自動變複斜——鋸床鋸切角度會由公式計算。", dependsOn: { key: "bodyShape", equals: "rect" } },
  { group: "structure", type: "number", key: "dividers", label: "縱向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, help: "0 = 整空；1-5 沿長邊方向加直立隔板（垂直 length 軸）", dependsOn: { key: "bodyShape", equals: "rect" } },
  { group: "structure", type: "number", key: "crossDividers", label: "橫向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, help: "0 = 沒有；1-5 沿短邊方向加隔板（跟縱向組合可形成 grid 網格）", dependsOn: { key: "__tray_cross_dividers_disabled__", equals: "true" } },
  { group: "structure", type: "number", key: "dividerThickness", label: "隔板厚度 (mm)", defaultValue: 6, min: 3, max: 15, step: 1, unit: "mm", help: "預設跟著「壁厚的一半」（壁 8mm→隔板 4mm、壁 12mm→6mm）。改數字才覆寫。" },
  { group: "structure", type: "number", key: "dividerHeight", label: "隔板高度 (mm)", defaultValue: 0, min: 0, max: 500, step: 1, unit: "mm", help: "0 = 自動填滿（從底板到頂）。手動指定可矮於壁高，讓筆桿露出來。" },
  { group: "structure", type: "number", key: "dividerInset", label: "隔板嵌入深度 (mm)", defaultValue: 0, min: 0, max: 15, step: 1, unit: "mm", help: "0 = 跟壁齊；設 3mm = 隔板兩端各延伸 3mm 進壁內側溝槽（dado joint，4 壁內側要銑對應槽）。", dependsOn: { key: "bodyShape", equals: "rect" } },
  { group: "structure", type: "select", key: "polygonDividerStyle", label: "多邊形隔板", defaultValue: "none", choices: [
    { value: "none", label: "無隔板" },
    { value: "single", label: "單片直徑（穿過中心）" },
    { value: "cross", label: "十字（2 片穿過中心交叉）", dependsOn: { key: "bodyShape", equals: "oct" } },
  ], dependsOn: { key: "bodyShape", notIn: ["rect"] }, help: "六/八角筒專用。單片穿過盒中心；八角還可以選十字（六角因 wall 間距 60° 不對齊垂直，不支援）。" },
  { group: "structure", type: "number", key: "fingerSegments", label: "指接段數", defaultValue: 0, min: 0, max: 30, step: 1, help: "0=自動（依壁高自動算奇數），1-30 = 手動指定段數。建議奇數（5/7/9/11/13），兩端都是齒視覺較對稱。", dependsOn: { all: [{ key: "bodyShape", equals: "rect" }, { key: "cornerJoinery", equals: "finger-joint" }] } },
  // 托盤把手：兩個短邊壁挖長條穿透孔，手指可穿過提起
  { group: "structure", type: "checkbox", key: "withHandle", label: "短邊壁挖把手孔", defaultValue: true, help: "兩個短邊壁中央偏上挖長條穿透孔，方便手指穿過提起托盤。" },
  { group: "structure", type: "select", key: "handleShape", label: "把手孔造型", defaultValue: "pill", choices: [
    { value: "rect", label: "矩形（直角，最簡單）" },
    { value: "pill", label: "圓角長條（兩端半圓 + 中段矩形）" },
    { value: "circle", label: "圓形（單一圓孔，較小手指洞）" },
  ], dependsOn: { key: "withHandle", equals: true }, help: "圓角長條最常見、最不刮手；矩形最容易加工；圓形適合小托盤或刻意要圓孔效果。" },
  { group: "structure", type: "number", key: "handleWidth", label: "把手孔寬 (mm)", defaultValue: 100, min: 50, max: 200, step: 5, unit: "mm", help: "建議 80-120mm（容 3-4 隻手指）。會自動 clamp 到壁長 -40mm（兩側留 20mm 邊）。", dependsOn: { all: [{ key: "withHandle", equals: true }, { key: "handleShape", notIn: ["circle"] }] } },
  { group: "structure", type: "number", key: "handleHeight", label: "把手孔高 (mm)", defaultValue: 25, min: 15, max: 50, step: 1, unit: "mm", help: "建議 20-30mm（手指穿過剛好）。", dependsOn: { key: "withHandle", equals: true } },
  { group: "structure", type: "number", key: "handleTopMargin", label: "把手距壁頂 (mm)", defaultValue: 10, min: 5, max: 30, step: 1, unit: "mm", help: "把手孔上緣距離壁頂的距離。", dependsOn: { key: "withHandle", equals: true } },
];

/**
 * 托盤 — 5 片板組成的方盒（4 壁 + 底）
 * input: 外尺寸（長×寬×高）
 */
export const tray: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, height: outerH, material } = input;
  const o = trayOptions;
  const useCase = getOption<string>(input, opt(o, "useCase"));
  const preset = TRAY_PRESETS[useCase];
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
  const bodyShape = getOption<string>(input, opt(o, "bodyShape")) as "rect" | "hex" | "oct";
  const bottomAttach = getOption<string>(input, opt(o, "bottomAttach")) as "seated" | "inset-panel" | "flush-glued";
  // 隔板厚度：option 預設 6 當 sentinel = 自動走 wallT/2
  const dividerHeightOpt = getOption<number>(input, opt(o, "dividerHeight"));
  const dividerInsetOpt = Math.max(0, Math.min(wallT - 1, getOption<number>(input, opt(o, "dividerInset"))));
  const polygonDividerStyle = getOption<string>(input, opt(o, "polygonDividerStyle"));
  // 托盤把手孔：兩個短邊壁中央偏上挖穿透長條孔
  const wallSplayDeg = getOption<number>(input, opt(o, "wallSplay"));
  const wallSplayRad = (wallSplayDeg * Math.PI) / 180;
  const withHandle = getOption<boolean>(input, opt(o, "withHandle"));
  const handleShape = getOption<string>(input, opt(o, "handleShape")) as "rect" | "pill" | "circle";
  const handleWidthOpt = getOption<number>(input, opt(o, "handleWidth"));
  const handleHeightOpt = getOption<number>(input, opt(o, "handleHeight"));
  const handleTopMarginOpt = getOption<number>(input, opt(o, "handleTopMargin"));
  const dividerThicknessRaw = getOption<number>(input, opt(o, "dividerThickness"));
  const dividerThick = dividerThicknessRaw === 6
    ? Math.max(3, Math.round(wallT / 2))
    : dividerThicknessRaw;
  // 指接段數：0 = 自動（依壁高奇數），1-30 = 手動指定
  const fingerSegmentsOpt = getOption<number>(input, opt(o, "fingerSegments"));

  // 六/八角款：完全跳過 buildBox，自組多邊形 stave + 多邊形底板
  if (bodyShape === "hex" || bodyShape === "oct") {
    const sides = bodyShape === "hex" ? 6 : 8;
    const outerD = Math.min(outerL, outerW);
    const apothem = (outerD / 2) * Math.cos(Math.PI / sides);
    const innerWallVertexR = (apothem - wallT) / Math.cos(Math.PI / sides);
    const outerWallVertexR = outerD / 2;

    // 依 bottomAttach 決定 wall 起點/高度跟底板尺寸位置
    let stavesOuterH: number; // 傳入 polygonStaves 算 wallH=outerH-botT
    let stavesBaseY: number;
    let bottomOriginY: number;
    let bottomVertexR: number;
    let bottomAttachDesc: string;
    if (bottomAttach === "inset-panel") {
      stavesOuterH = outerH + botT;  // 內部 wallH = outerH（全高）
      stavesBaseY = 0;
      bottomOriginY = botT;
      // 5mm 卡進壁內側溝槽（沿用 box-builder 慣例 grooveDepth=5）
      const grooveDepth = Math.min(5, wallT - 1);
      const bottomApothem = (apothem - wallT) + grooveDepth;
      bottomVertexR = bottomApothem / Math.cos(Math.PI / sides);
      bottomAttachDesc = `**鑲板入溝**（壁全高、底板邊緣卡進壁內側溝槽 ${grooveDepth}mm）`;
    } else if (bottomAttach === "flush-glued") {
      stavesOuterH = outerH;
      stavesBaseY = botT;
      bottomOriginY = 0;
      bottomVertexR = outerWallVertexR; // 底板外緣跟壁外緣齊
      bottomAttachDesc = "**整塊膠合**（底板外緣與框體齊邊）";
    } else { // seated
      stavesOuterH = outerH;
      stavesBaseY = botT;
      bottomOriginY = 0;
      // 底板邊緣往外壓進壁內側 wallT/2，確保有「框壓底」的接合面（沿用 rect 的 BOTTOM_GROOVE_INSET 慣例）
      const seatOverlap = wallT / 2;
      const bottomApothem = (apothem - wallT) + seatOverlap;
      bottomVertexR = bottomApothem / Math.cos(Math.PI / sides);
      bottomAttachDesc = `**底板內縮**（底板邊緣壓入壁內 ${seatOverlap}mm，N 段壁壓在底板邊緣膠合）`;
    }
    const staves = polygonStaves({ sides, outerD, outerH: stavesOuterH, wallT, botT, material, baseY: stavesBaseY });
    // 每塊壁的端面是 miter（角度 = π/N，相鄰兩壁總共 2π/N = 外角）。
    // local +Y 經 polygon-stave-builder rotation 映射為 radial outward = "outer side"。
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
    // 多邊形隔板：single = 1 片穿過中心、cross = 2 片垂直交叉
    const polygonDividerParts: Part[] = [];
    // hex 不支援 cross（保險：若舊 URL 帶 cross 強制降到 single）
    const polyDividerStyleStr = (sides === 6 && polygonDividerStyle === "cross") ? "single" : polygonDividerStyle as string;
    if (polyDividerStyleStr === "single" || polyDividerStyleStr === "cross") {
      const innerFlatR = apothem - wallT;
      // 固定 5mm dado 槽（沿用 box-builder 慣例），延伸進壁內側並 CSG 挖出可見溝槽
      const polyDividerGroove = Math.min(5, wallT - 1);
      const polyDividerLen = 2 * innerFlatR + 2 * polyDividerGroove;
      const polyBottomTopY = bottomAttach === "inset-panel" ? 2 * botT : botT;
      const polyDividerHAuto = Math.max(1, outerH - polyBottomTopY);
      const polyDividerH = dividerHeightOpt > 0
        ? Math.max(1, Math.min(dividerHeightOpt, polyDividerHAuto))
        : polyDividerHAuto;
      // 隔板 1：沿世界 Z 軸（垂直於第一壁的方向）
      polygonDividerParts.push({
        id: "divider-1",
        nameZh: "隔板 1（縱）",
        material,
        grainDirection: "length",
        visible: { length: polyDividerLen, width: polyDividerH, thickness: dividerThick },
        origin: { x: 0, y: polyBottomTopY, z: 0 },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
      if (polyDividerStyleStr === "cross") {
        // 隔板 2：沿世界 X 軸（垂直於隔板 1）
        polygonDividerParts.push({
          id: "divider-2",
          nameZh: "隔板 2（橫）",
          material,
          grainDirection: "length",
          visible: { length: polyDividerLen, width: polyDividerH, thickness: dividerThick },
          origin: { x: 0, y: polyBottomTopY, z: 0 },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      // 在 staves 上加 cosmetic mortise（CSG 挖出 dado 溝槽，可見隔板嵌入）
      // wall index 對應：第一壁在 ang=π/2 → divider 1 (Z 軸) 進 wall 0 跟 wall N/2
      // divider 2 (X 軸) 進 wall N/4 跟 wall 3N/4 (僅 oct 用)
      const addStaveMortise = (staveIdx: number) => {
        const stave = staves[staveIdx];
        if (!stave) return;
        stave.mortises.push({
          origin: { x: 0, y: wallT, z: 0 },
          depth: polyDividerGroove + 0.3,
          length: polyDividerH + 0.5,
          width: dividerThick + 0.5,
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

    return {
      id: `tray-${bodyShape}-${outerD}x${outerH}`,
      category: "tray",
      nameZh: `${sides === 6 ? "六" : "八"}角托盤`,
      overall: { length: outerD, width: outerD, thickness: outerH },
      parts: [polyBottom, ...staves, ...polygonDividerParts],
      defaultJoinery: "mitered-spline",
      useButtJointConvention: false,
      primaryMaterial: material,
      notes: `${sides} 角托盤，外接圓 ⌀${outerD}mm × 高 ${outerH}mm，壁厚 ${wallT}mm。${sides} 段直立壁邊接 ${(360 / sides).toFixed(1)}° 斜切（${sides === 6 ? "60° 內角" : "45° 內角"}），相鄰邊用膠合 + biscuit / 暗榫加固。底板為 ${sides} 邊形，採 ${bottomAttachDesc}${polyDividerDesc}。`,
    };
  }

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    material,
    cornerJoinery: cornerJoinery === "miter" ? "stub-joint" : cornerJoinery,
    bottomFit: bottomAttach === "flush-glued" ? "floating" : "grooved",
  });

  // 底板接法後處理 — 蓋掉 buildBox 預設幾何
  const bottomPart = built.parts.find((p) => p.id === "bottom");
  if (bottomPart) {
    if (bottomAttach === "inset-panel") {
      // 鑲板入溝：4 壁全高、底板浮嵌於壁內側 5mm 槽中，離地約 botT
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
          part.visible = { ...part.visible, width: outerH };
          part.origin = { ...part.origin, y: 0 };
        }
      }
    } else if (bottomAttach === "flush-glued") {
      // 整塊膠合：底板外緣與框體齊
      bottomPart.visible = { length: outerL, width: outerW, thickness: botT };
      bottomPart.origin = { x: 0, y: 0, z: 0 };
    }
    // seated 不動，保留 buildBox 既有結果
  }

  // 斜接 (miter) / 指接 (finger-joint) 下料：短壁 (左/右) 也延伸到外角全長
  // （搭接 stub-joint 才是短壁夾在長壁之間 length=innerW）。
  // 壁的 Y / 高度交由 bottomAttach 決定（seated=坐底板上，inset-panel/flush-glued=全高），不在這裡覆寫。
  // 壁外撇 + miter：top corner 在世界中比 bottom corner 多偏 wallH·tan(θ)，
  // 壁全長 +2·wallH·tan(θ) 讓 top corner 對齊。bottom 會稍微凸 V 字，但
  // top 接齊比較重要。完整解需要梯形壁（top 長 bottom 短）+ miter inset
  // 合體 shape kind，是更大工程，先簡化版。
  const splayExt = cornerJoinery === "miter" && wallSplayRad > 0
    ? 2 * built.wallH * Math.tan(wallSplayRad)
    : 0;
  if (cornerJoinery === "miter" || cornerJoinery === "finger-joint") {
    for (const part of built.parts) {
      if (part.id === "wall-front" || part.id === "wall-back") {
        part.visible = { ...part.visible, length: outerL + splayExt };
        part.tenons = [];
      } else if (part.id === "wall-left" || part.id === "wall-right") {
        part.visible = { ...part.visible, length: outerW + splayExt };
        part.tenons = [];
      }
    }
  }
  // miter 4 壁額外掛 mitered-ends shape，3D / 三視圖會把端面渲成 45° 斜切。
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
    const wallActualH = bottomAttach === "inset-panel" ? outerH : outerH - botT;
    fingerJointInfo = { segmentCount, fingerW: wallActualH / segmentCount };
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

  // 壁外撇（Phase 1：視覺）：rect bodyShape 才有意義。每片壁的 rotation 加一個
  // 角度，讓 wall 繞自己的長軸傾斜，top 往外撇。Phase 1 不補償 origin，所以
  // 整片壁繞 center 轉，底邊會稍微往外移、top 往外撇更多（總體仍是向外撇的效果）。
  // 配合 miter corner 時，wall 的 local 端面 45° 切在傾斜的 frame 下變成複斜 miter。
  // 符號約定（試到對為止）：
  // - front wall（z 負）: outward = -Z → rotation x: +Δ
  // - back wall（z 正）: outward = +Z → rotation x: -Δ
  // - left/right wall 因為先 rotate y:π/2，wall 的長軸現在沿 world Z 跑，要動 rotation z
  if (bodyShape === "rect" && wallSplayRad > 0) {
    for (const part of built.parts) {
      if (!part.rotation) continue;
      // 全部 sign 翻過來：原本以為 +Δ 是 outward，實測是 inward
      if (part.id === "wall-front") {
        part.rotation = { ...part.rotation, x: (part.rotation.x ?? 0) - wallSplayRad };
      } else if (part.id === "wall-back") {
        part.rotation = { ...part.rotation, x: (part.rotation.x ?? 0) + wallSplayRad };
      } else if (part.id === "wall-left") {
        part.rotation = { ...part.rotation, z: (part.rotation.z ?? 0) + wallSplayRad };
      } else if (part.id === "wall-right") {
        part.rotation = { ...part.rotation, z: (part.rotation.z ?? 0) - wallSplayRad };
      }
    }
  }

  // 托盤把手孔：rect bodyShape 才有意義（六/八角筒沒「短邊壁」這個概念）。
  // 兩個短邊壁（wall-left / wall-right）中央偏上挖穿透長條孔（cosmetic mortise
  // through:true），手指穿過提起。
  // 短邊壁 local：X=innerW（水平向）、Y=wallT（厚度）、Z=wallH（垂直）。
  if (bodyShape === "rect" && withHandle) {
    for (const part of built.parts) {
      if (part.id !== "wall-left" && part.id !== "wall-right") continue;
      const wallLen = part.visible.length;       // local X 軸（= innerW）
      const wallHeight = part.visible.width;     // local Z 軸（= wallH）
      const wallThick = part.visible.thickness;  // local Y 軸（= wallT）
      // clamp 把手寬到壁長 -40mm（兩側留 20mm 邊不破角）
      const handleW = Math.min(handleWidthOpt, wallLen - 40);
      if (handleW < 30) continue; // 壁太短畫不下，跳過
      const handleH = Math.min(handleHeightOpt, wallHeight - 2 * handleTopMarginOpt - 5);
      if (handleH < 10) continue; // 壁太矮畫不下
      // 把手孔中心 Z：距壁頂 handleTopMargin + handleH/2
      // 短邊壁 rotation {x:π/2, y:π/2} 後 local -Z 朝世界上方，所以「靠壁頂」= 負 Z
      const handleZCenter = -(wallHeight / 2 - handleTopMarginOpt - handleH / 2);
      // 依造型推 mortise：
      // - rect: 1 個矩形 mortise
      // - pill: 中段矩形 + 兩端圓形（CSG round mortise = 圓柱）
      // - circle: 單一圓形 mortise
      if (handleShape === "rect") {
        part.mortises.push({
          origin: { x: 0, y: 0, z: handleZCenter },
          depth: wallThick,
          length: handleW,
          width: handleH,
          through: true,
          cosmetic: true,
          shape: "rect",
        });
      } else if (handleShape === "pill") {
        // 中段矩形寬度 = handleW - handleH（兩端各扣半個 handleH 給圓蓋）。
        // 若 handleW <= handleH 退化成圓（沒有中段）。
        const rectLen = handleW - handleH;
        if (rectLen > 0) {
          part.mortises.push({
            origin: { x: 0, y: 0, z: handleZCenter },
            depth: wallThick,
            length: rectLen,
            width: handleH,
            through: true,
            cosmetic: true,
            shape: "rect",
          });
        }
        const endOffset = Math.max(0, rectLen / 2);
        // 左端圓（CSG round = 圓柱沿 local Y 軸、radius = min(hx, hz)）
        part.mortises.push({
          origin: { x: -endOffset, y: 0, z: handleZCenter },
          depth: wallThick,
          length: handleH,
          width: handleH,
          through: true,
          cosmetic: true,
          shape: "round",
        });
        // 右端圓
        part.mortises.push({
          origin: { x: endOffset, y: 0, z: handleZCenter },
          depth: wallThick,
          length: handleH,
          width: handleH,
          through: true,
          cosmetic: true,
          shape: "round",
        });
      } else if (handleShape === "circle") {
        // 圓形：取較小邊為直徑
        const dia = Math.min(handleW, handleH);
        part.mortises.push({
          origin: { x: 0, y: 0, z: handleZCenter },
          depth: wallThick,
          length: dia,
          width: dia,
          through: true,
          cosmetic: true,
          shape: "round",
        });
      }
    }
  }

  // 隔板起點 Y：底板頂面位置 — inset-panel 底板抬高 botT，其餘走 buildBox 既定
  const bottomTopY = bottomAttach === "inset-panel" ? 2 * botT : botT;
  const dividerHAuto = Math.max(1, outerH - bottomTopY);
  const dividerH = dividerHeightOpt > 0
    ? Math.max(1, Math.min(dividerHeightOpt, dividerHAuto))
    : dividerHAuto;

  // 加內部直立隔板（縱向：沿 length 軸切，跟長邊垂直）
  const dividerParts: typeof built.parts = [];
  if (dividers > 0) {
    const dividerSpacing = built.innerL / (dividers + 1);
    for (let i = 1; i <= dividers; i++) {
      dividerParts.push({
        id: `divider-${i}`,
        nameZh: `縱向隔板 ${i}`,
        material,
        grainDirection: "length",
        visible: { length: built.innerW + 2 * dividerInsetOpt, width: dividerH, thickness: dividerThick },
        origin: {
          x: -built.innerL / 2 + i * dividerSpacing,
          y: bottomTopY,
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
        visible: { length: built.innerL + 2 * dividerInsetOpt, width: dividerH, thickness: dividerThick },
        origin: {
          x: 0,
          y: bottomTopY,
          z: -built.innerW / 2 + i * dividerSpacing,
        },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  const design: FurnitureDesign = {
    id: `tray-${outerL}x${outerW}x${outerH}`,
    category: "tray",
    nameZh: "托盤",
    overall: { length: outerL, width: outerW, thickness: outerH },
    parts: [...built.parts, ...dividerParts],
    defaultJoinery: cornerJoinery === "miter" ? "stub-joint" : cornerJoinery,
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `托盤 ${outerL}×${outerW}×${outerH}mm，${5 + dividers + crossDividers} 片實木組成。底板${bottomAttach === "inset-panel" ? "**鑲板入溝**（4 壁內側下緣銑 5mm 槽、底板浮嵌，留伸縮空間免裂）" : bottomAttach === "flush-glued" ? "**整塊膠合**（底板外緣與框體齊邊，木工膠夾合即可）" : "**底板內縮**（底板嵌入框內、4 壁壓在底板邊緣膠合）"}，4 角採${cornerJoinery === "finger-joint" ? `**指接**（外露指狀視覺，新手練習指接的最佳對象）${fingerJointInfo ? `；共 ${fingerJointInfo.segmentCount} 段，每齒寬 ${fingerJointInfo.fingerW.toFixed(1)}mm` : ""}` : cornerJoinery === "miter" ? "**斜角拼**（45° 對接，最隱形但需 45° 鋸台或斜切片切，膠合 + 細釘加固）" : "**搭接**（rabbet，最簡單，膠合即可）"}。內部 ${built.innerL}×${built.innerW}mm 約可放 ${Math.max(0, Math.floor((built.innerL * built.innerW) / 100))} 支筆。${dividers > 0 ? ` 內部縱向 ${dividers} 片隔板（${dividerThick}mm 厚）。` : ""}${crossDividers > 0 ? ` 橫向 ${crossDividers} 片隔板（${dividerThick}mm 厚）。` : ""}${dividers > 0 && crossDividers > 0 ? ` grid 網格分 ${(dividers + 1) * (crossDividers + 1)} 區。` : ""}`,
  };

  if (built.warnings.length) design.warnings = [...built.warnings];
  // 結構檢查 + max bounds
  const warnings: string[] = [];
  if (outerL > 200 || outerW > 200 || outerH > 250) {
    warnings.push(`托盤 ${outerL}×${outerW}×${outerH}mm 超過合理範圍（max 200×200×250mm）。再大就比較像鳩尾盒——考慮改用鳩尾盒模板`);
    design.suggestions = [{
      text: `${outerL}×${outerW}×${outerH}mm 已超過托盤範圍——鳩尾盒模板支援更大的盒體 + 鳩尾接合選項。`,
      suggestedCategory: "dovetail-box",
      presetParams: { length: String(outerL), width: String(outerW), height: String(outerH), material },
    }];
  }
  if (warnings.length) design.warnings = [...(design.warnings ?? []), ...warnings];
  return design;
};
