import type { FurnitureTemplate, OptionSpec, Part } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { applyStandardChecks } from "./_validators";
import {
  seatEdgeOption,
  seatEdgeStyleOption,
  legEdgeOption,
  legEdgeStyleOption,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  topPanelPiecesOption,
  topPanelPiecesNote,
} from "./_helpers";

export const deskOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "桌腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 55, min: 20, max: 120, step: 2 },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 12, max: 60, step: 2 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  topPanelPiecesOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 90, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 25, min: 10, max: 50, step: 2 },
  { group: "top", type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 30, min: 0, max: 300, step: 5 },
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: true },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "下橫撐", defaultValue: false },
  { group: "drawer", type: "number", key: "drawerCount", label: "懸吊抽屜數", defaultValue: 0, min: 0, max: 3, step: 1, help: "桌面下掛一組抽屜櫃（0 = 無）" },
  { group: "drawer", type: "select", key: "drawerSide", label: "抽屜位置", defaultValue: "right", choices: [
    { value: "left", label: "左側" },
    { value: "right", label: "右側" },
    { value: "center", label: "中央（窄型）" },
  ], dependsOn: { key: "drawerCount", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 400, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 20, min: 0, max: 300, step: 5 },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 700, step: 10, help: "設 0 = 自動", dependsOn: { key: "withLowerStretchers", equals: true } },
];

export const desk: FurnitureTemplate = (input) => {
  const o = deskOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const seatEdge = getOption<number>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const topPanelPieces = parseInt(getOption<string>(input, opt(o, "topPanelPieces"))) || 1;
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const topOverhang = getOption<number>(input, opt(o, "topOverhang"));
  const withCenterStretcher = getOption<boolean>(input, opt(o, "withCenterStretcher"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const drawerCount = getOption<number>(input, opt(o, "drawerCount"));
  const drawerSide = getOption<string>(input, opt(o, "drawerSide"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));

  const design = simpleTable({
    category: "desk",
    nameZh: "書桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    apronThickness,
    topOverhang,
    withCenterStretcher: withCenterStretcher && drawerCount === 0,
    withLowerStretchers,
    legInset,
    apronOffset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: legShape === "tapered" ? "tapered" : "box",
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    topPanelPieces,
    notes: `書桌：桌腳 ${legSize}mm${legShape === "tapered" ? "（錐形）" : ""}、牙板 ${apronWidth}×${apronThickness}mm${drawerCount > 0 ? `、${drawerSide === "center" ? "中央" : drawerSide === "left" ? "左側" : "右側"}懸吊 ${drawerCount} 抽屜` : ""}。${topPanelPiecesNote(topPanelPieces, input.width)}`,
  });

  if (drawerCount > 0) {
    const legHeight = input.height - topThickness;
    // 內側可用空間 = 總長 - 兩端腳 - 兩端 legInset
    const innerW = input.length - 2 * legSize - 2 * legInset;
    const caseW = drawerSide === "center"
      ? Math.min(400, input.length * 0.4)
      : Math.min(450, innerW * 0.4);
    const caseH = Math.min(legHeight * 0.55, drawerCount * 120 + 40);
    const caseD = input.width - 40;
    const caseY = legHeight - caseH;
    const sideT = 15;
    // caseX 要扣 legInset，case 才落在腳內側 20mm 處（不撞內縮的腳）
    const caseX = drawerSide === "center"
      ? 0
      : drawerSide === "left"
      ? -(input.length / 2 - legSize - legInset - caseW / 2 - 20)
      : (input.length / 2 - legSize - legInset - caseW / 2 - 20);

    const drawers: Part[] = [];
    const slotH = caseH / drawerCount;
    const frontT = 15;
    // 抽屜面板 Z 位置：與牙板前面平齊（overlay drawer），不再卡在桌面前緣
    // 牙板中心 Z = -(width/2 - legInset - legSize/2)，前面 = 中心 - apronThickness/2
    const apronFrontZ = -(input.width / 2 - legInset - legSize / 2) - apronThickness / 2;
    const drawerFaceZ = apronFrontZ - frontT / 2;
    for (let i = 0; i < drawerCount; i++) {
      drawers.push({
        id: `desk-drawer-${i + 1}-front`,
        nameZh: `懸吊抽屜${i + 1} 面板`,
        material: input.material,
        grainDirection: "length",
        visible: { length: caseW - 4, width: slotH - 4, thickness: frontT },
        origin: { x: caseX, y: caseY + i * slotH + 2, z: drawerFaceZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }

    // 懸吊抽屜箱左右側板
    const sides: Part[] = [-1, 1].map((s) => ({
      id: `desk-drawer-side-${s < 0 ? "left" : "right"}`,
      nameZh: `懸吊抽屜${s < 0 ? "左" : "右"}側板`,
      material: input.material,
      grainDirection: "length",
      visible: { length: caseD, width: caseH, thickness: sideT },
      origin: { x: caseX + s * (caseW / 2 - sideT / 2), y: caseY, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    }));

    // 頂板（與桌面黏合）
    design.parts.push({
      id: "desk-drawer-top",
      nameZh: "懸吊抽屜頂板",
      material: input.material,
      grainDirection: "length",
      visible: { length: caseW, width: caseD, thickness: sideT },
      origin: { x: caseX, y: caseY + caseH - sideT, z: 0 },
      tenons: [],
      mortises: [],
    });
    design.parts.push(...sides, ...drawers);
  }

  applyStandardChecks(design, {
    minLength: 900, minWidth: 400, minHeight: 650,
    maxLength: 2000, maxWidth: 900, maxHeight: 800,
  });
  return design;
};
