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
    { value: "splayed", label: "斜腳（四角對角外傾）" },
    { value: "splayed-length", label: "斜腳（沿長邊單向外傾）" },
    { value: "splayed-width", label: "斜腳（沿寬邊單向外傾）" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 55, min: 20, max: 120, step: 2 },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 12, max: 60, step: 2 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  topPanelPiecesOption("top"),
  { group: "top", type: "checkbox", key: "withBreadboardEnds", label: "桌面端板（防翹曲）", defaultValue: false, help: "兩端加垂直木條 + 企口接合，防止跨度大時翹曲", wide: true },
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊", defaultValue: false, help: "桌面長邊保留原木樹皮曲線", wide: true },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 90, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 25, min: 10, max: 50, step: 2 },
  { group: "top", type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 30, min: 0, max: 300, step: 5 },
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: false, help: "現代書桌少用；中式 / 工業風款再勾起來" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "下橫撐", defaultValue: false },
  { group: "drawer", type: "number", key: "drawerCount", label: "懸吊抽屜數", defaultValue: 0, min: 0, max: 3, step: 1, help: "桌面下掛一組抽屜櫃（0 = 無）" },
  { group: "drawer", type: "select", key: "drawerSide", label: "抽屜位置", defaultValue: "right", choices: [
    { value: "left", label: "左側" },
    { value: "right", label: "右側" },
    { value: "center", label: "中央（窄型）" },
  ], dependsOn: { key: "drawerCount", notIn: [0] } },
  { group: "top", type: "select", key: "grommetCount", label: "桌面線材孔", defaultValue: "0", choices: [
    { value: "0", label: "無" },
    { value: "1", label: "1 個（50mm 圓孔）" },
    { value: "2", label: "2 個（兩端各一）" },
  ], help: "穿線出口孔，需用 50mm 環孔鋸 + 黑色塑膠 grommet 圈" },
  { group: "drawer", type: "checkbox", key: "withKeyboardTray", label: "鍵盤抽屜（滑出式）", defaultValue: false, help: "桌面下方 60mm 處加一片滑軌式鍵盤板，需配 350mm 鍵盤滑軌（B 級五金行有售）", wide: true },
  { group: "apron", type: "checkbox", key: "withModestyPanel", label: "前飾遮腿板（modesty panel）", defaultValue: false, help: "面對客戶時遮住下肢；牙板下方加一片整片立板（高 300-400mm）。會議桌/客戶桌常見", wide: true },
  { group: "drawer", type: "checkbox", key: "withPencilTray", label: "桌面下筆槽", defaultValue: false, help: "桌面正下方中央加一條淺抽屜（45mm 高），放筆 / 名片 / 印章", wide: true },
  { group: "top", type: "select", key: "lShape", label: "L 字形延伸", defaultValue: "none", choices: [
    { value: "none", label: "無（直線桌）" },
    { value: "right", label: "右側延伸（return on right）" },
    { value: "left", label: "左側延伸（return on left）" },
  ], help: "桌面右/左側加垂直延伸（return panel）做 L 形，含 1 隻角落腳。延伸方向為 +Z（朝牆面內側）" },
  { group: "top", type: "number", key: "lShapeReturnLength", label: "延伸長度 (mm)", defaultValue: 800, min: 400, max: 1500, step: 50, dependsOn: { key: "lShape", notIn: ["none"] }, help: "L 形延伸的長度（沿深度方向）" },
  { group: "top", type: "number", key: "lShapeReturnDepth", label: "延伸深度 (mm)", defaultValue: 500, min: 300, max: 800, step: 25, dependsOn: { key: "lShape", notIn: ["none"] }, help: "L 形延伸的寬（深）" },
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
  const withBreadboardEnds = getOption<boolean>(input, opt(o, "withBreadboardEnds"));
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
  const grommetCount = parseInt(getOption<string>(input, opt(o, "grommetCount"))) || 0;
  const withKeyboardTray = getOption<boolean>(input, opt(o, "withKeyboardTray"));
  const withModestyPanel = getOption<boolean>(input, opt(o, "withModestyPanel"));
  const withPencilTray = getOption<boolean>(input, opt(o, "withPencilTray"));
  const lShape = getOption<string>(input, opt(o, "lShape"));
  const lShapeReturnLength = getOption<number>(input, opt(o, "lShapeReturnLength"));
  const lShapeReturnDepth = getOption<number>(input, opt(o, "lShapeReturnDepth"));
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
    legShape: legShape as "box" | "tapered" | "splayed" | "splayed-length" | "splayed-width",
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    topPanelPieces,
    withBreadboardEnds,
    liveEdge,
    notes: `書桌：桌腳 ${legSize}mm${legShape === "tapered" ? "（錐形）" : ""}、牙板 ${apronWidth}×${apronThickness}mm${drawerCount > 0 ? `、${drawerSide === "center" ? "中央" : drawerSide === "left" ? "左側" : "右側"}懸吊 ${drawerCount} 抽屜` : ""}。${topPanelPiecesNote(topPanelPieces, input.width)}${withBreadboardEnds ? " 桌面兩端加端板防翹。" : ""}${liveEdge ? " Live edge 原木邊。" : ""}${withKeyboardTray ? " 桌下加滑出式鍵盤板。" : ""}${withModestyPanel ? " 前方加 350mm 高 modesty 飾遮腿板（會議/客戶桌風格）。" : ""}${withPencilTray ? " 桌面下方中央加 45mm 高淺抽屜（筆/名片/印章）。" : ""}`,
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

  // 線材孔（grommet）—— 50mm 圓盤標記，視覺提示孔位
  // 用 visual: "glass" 不入材料/裁切（這是孔不是料），但 3D 半透明可見
  if (grommetCount > 0) {
    const legHeight = input.height - topThickness;
    const grommetD = 50;
    // 孔位往後緣 100mm，貼近牆邊讓線從這裡穿下去
    const grommetZ = input.width / 2 - 100;
    const positions = grommetCount === 1
      ? [{ x: 0, label: "中央" }]
      : [
          { x: -input.length * 0.3, label: "左" },
          { x: input.length * 0.3, label: "右" },
        ];
    for (const p of positions) {
      design.parts.push({
        id: `desk-grommet-${p.label}`,
        nameZh: `線材孔（${p.label}）`,
        material: input.material,
        grainDirection: "length",
        visible: { length: grommetD, width: grommetD, thickness: topThickness + 2 },
        // 孔在桌面厚度範圍內，y = legHeight 起到 +topThickness（穿透）
        origin: { x: p.x, y: legHeight - 1, z: grommetZ },
        shape: { kind: "round" },
        visual: "glass",
        tenons: [],
        mortises: [],
      });
    }
  }

  // 鍵盤抽屜—— 桌面下方滑出式鍵盤板。預設 600 × 280 × 18mm
  if (withKeyboardTray) {
    const legHeight = input.height - topThickness;
    const trayLen = Math.min(700, input.length * 0.55);
    const trayWid = Math.min(320, input.width * 0.55);
    const trayThick = 18;
    // Y 位置：桌面下緣 - 60mm 滑軌空間 - tray 厚度
    const trayY = legHeight - 60 - trayThick;
    // Z 位置：偏前緣（讓使用者打字方便），不要卡到後牙板
    const trayZ = -input.width / 2 + trayWid / 2 + 30;
    design.parts.push({
      id: "desk-keyboard-tray",
      nameZh: "鍵盤抽屜板",
      material: input.material,
      grainDirection: "length",
      visible: { length: trayLen, width: trayWid, thickness: trayThick },
      origin: { x: 0, y: trayY, z: trayZ },
      tenons: [],
      mortises: [],
    });
  }

  // L 形延伸（return panel）—— 主桌面 +X 或 -X 側加垂直延伸
  // 注意：本實作只加延伸桌面 + 1 隻角落腳，視覺上看得出 L 形但結構需自行補強。
  // 完整實作需要 6 隻腳 + 角落支撐結構，未來再加。
  if (lShape !== "none") {
    const legHeight = input.height - topThickness;
    const sx = lShape === "right" ? 1 : -1;
    // 延伸面板：沿 Z 軸延伸 lShapeReturnLength 距離（朝後牆方向 +Z）
    const returnLen = lShapeReturnLength;
    const returnDep = lShapeReturnDepth;
    // 延伸面板原點：在主桌面 ±X 端、向 +Z 延伸
    const returnX = sx * (input.length / 2 + returnDep / 2);
    const returnZ = input.width / 2 + returnLen / 2;
    design.parts.push({
      id: `desk-l-return`,
      nameZh: `L 形延伸桌面（${lShape === "right" ? "右" : "左"}）`,
      material: input.material,
      grainDirection: "length",
      visible: { length: returnDep, width: returnLen, thickness: topThickness },
      origin: { x: returnX, y: legHeight, z: returnZ },
      tenons: [],
      mortises: [],
    });
    // 延伸區角落腳（far corner）
    design.parts.push({
      id: `desk-l-corner-leg`,
      nameZh: `L 形角落腳`,
      material: input.material,
      grainDirection: "length",
      visible: { length: legSize, width: legSize, thickness: legHeight },
      origin: { x: sx * (input.length / 2 + returnDep - legSize / 2), y: 0, z: input.width / 2 + returnLen - legSize / 2 },
      tenons: [],
      mortises: [],
    });
  }

  // 補充說明
  if (grommetCount > 0 || withKeyboardTray || lShape !== "none") {
    const extras: string[] = [];
    if (grommetCount > 0) {
      extras.push(`${grommetCount} 個 50mm 線材孔（用環孔鋸鑽，套黑色塑膠 grommet 圈）`);
    }
    if (withKeyboardTray) {
      extras.push("含滑出式鍵盤板（需配 350mm 鍵盤滑軌一對）");
    }
    if (lShape !== "none") {
      extras.push(`L 形${lShape === "right" ? "右" : "左"}側延伸 ${lShapeReturnDepth}×${lShapeReturnLength}mm（含角落腳一隻；完整 L 桌結構需 5-6 隻腳，目前模板簡化版，安裝時建議補加 1-2 隻支撐腳）`);
    }
    design.notes = (design.notes ?? "") + " " + extras.join("；") + "。";
  }

  // 前飾遮腿板（modesty panel）
  if (withModestyPanel) {
    design.parts.push({
      id: "modesty-panel",
      nameZh: "前飾遮腿板",
      material: input.material,
      grainDirection: "length",
      visible: { length: input.length - 100, width: 350, thickness: 18 },
      origin: { x: 0, y: input.height - 380, z: -input.width / 2 + 30 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
  }
  // 桌面下筆槽（pencil tray）
  if (withPencilTray) {
    design.parts.push({
      id: "pencil-tray",
      nameZh: "桌下筆槽抽屜",
      material: input.material,
      grainDirection: "length",
      visible: { length: 400, width: 200, thickness: 45 },
      origin: { x: 0, y: input.height - 70, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  applyStandardChecks(design, {
    minLength: 900, minWidth: 400, minHeight: 650,
    maxLength: 2000, maxWidth: 900, maxHeight: 800,
  });
  return design;
};
