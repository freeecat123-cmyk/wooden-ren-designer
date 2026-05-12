import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { caseFurniture } from "./_builders/case-furniture";
import { applyStandardChecks } from "./_validators";
import {
  seatEdgeOption,
  seatEdgeStyleOption,
  legEdgeOption,
  legEdgeStyleOption,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  pullStyleOption,
  softCloseOption,
} from "./_helpers";
import {
  drawerBottomModeOption,
  drawerMountOption,
  drawerSlideOption,
  resolveDrawerBottomMode,
  resolveDrawerMount,
  resolveDrawerSlideGap,
} from "./_builders/zone-helpers";

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
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊", defaultValue: false, help: "桌面長邊保留原木樹皮曲線", wide: true },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "checkbox", key: "withApron", label: "加牙板", defaultValue: true, help: "牙板連接四隻腳上方，傳統桌類結構件。Mid-century / 工業風常省略改用金屬支架" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 90, min: 30, max: 200, step: 5, dependsOn: { key: "withApron", equals: true } },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 25, min: 10, max: 50, step: 2, dependsOn: { key: "withApron", equals: true } },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）", dependsOn: { key: "withApron", equals: true } },
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: false, help: "現代書桌少用；中式 / 工業風款再勾起來" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "下橫撐", defaultValue: false },
  { group: "stretcher", type: "checkbox", key: "withSlatRack", label: "下橫撐置物條", defaultValue: false, help: "前後下橫撐之間架格柵條，做置物層", dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "slatCount", label: "置物條數量", defaultValue: 0, min: 0, max: 20, step: 1, help: "0 = 自動依桌長算（每 150mm 一條）", dependsOn: { key: "withSlatRack", equals: true } },
  { group: "stretcher", type: "number", key: "slatWidth", label: "置物條寬 (mm)", defaultValue: 35, min: 15, max: 100, step: 5, dependsOn: { key: "withSlatRack", equals: true } },
  { group: "stretcher", type: "number", key: "slatThickness", label: "置物條厚 (mm)", defaultValue: 18, min: 8, max: 40, step: 1, dependsOn: { key: "withSlatRack", equals: true } },
  { group: "drawer", type: "number", key: "drawerCount", label: "懸吊抽屜數", defaultValue: 0, min: 0, max: 3, step: 1, help: "桌面下掛一組抽屜櫃（0 = 無）。沿用櫃類抽屜系統：含 5 件式抽屜箱、滑軌、把手等完整功能" },
  { group: "drawer", type: "select", key: "drawerSide", label: "抽屜位置", defaultValue: "right", choices: [
    { value: "left", label: "左側" },
    { value: "right", label: "右側" },
    { value: "center", label: "中央（窄型）" },
  ], dependsOn: { key: "drawerCount", notIn: [0] } },
  // 跟櫃類同款的抽屜細節選項——desk 沒 zones 所以 dependsOn 改吃 drawerCount > 0
  { ...drawerMountOption, dependsOn: { key: "drawerCount", notIn: [0] } },
  { ...drawerBottomModeOption, dependsOn: { key: "drawerCount", notIn: [0] } },
  { ...drawerSlideOption, dependsOn: { key: "drawerCount", notIn: [0] } },
  { ...pullStyleOption("drawer"), dependsOn: { key: "drawerCount", notIn: [0] } },
  { ...softCloseOption("drawer"), dependsOn: { key: "drawerCount", notIn: [0] } },
  { group: "drawer", type: "checkbox", key: "withHFrame", label: "加 H 框結構橫撐", defaultValue: true, help: "櫃子下方加 H 形橫撐做結構支撐；現代懸吊櫃可關掉只靠側板掛在腳上", dependsOn: { key: "drawerCount", notIn: [0] } },
  { group: "drawer", type: "number", key: "pedestalStretcherHeight", label: "H 框橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 600, step: 10, help: "0 = 自動貼櫃底；> 0 = 改放在離地此高度（櫃子變懸吊式）", dependsOn: { all: [{ key: "drawerCount", notIn: [0] }, { key: "withHFrame", equals: true }] } },
  { group: "drawer", type: "number", key: "pedestalTopGap", label: "櫃頂距桌底 (mm)", defaultValue: 5, min: 0, max: 200, step: 5, help: "無牙板時可調櫃頂到桌底的距離，預設 5mm 幾乎貼桌底", dependsOn: { all: [{ key: "withApron", equals: false }, { key: "drawerCount", notIn: [0] }] } },
  { group: "apron", type: "checkbox", key: "withModestyPanel", label: "前飾遮腿板（modesty panel）", defaultValue: false, help: "面對客戶時遮住下肢；牙板下方加一片整片立板（高 300-400mm）。會議桌/客戶桌常見", wide: true },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 400, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "withApron", equals: true } },
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
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
  const withModestyPanel = getOption<boolean>(input, opt(o, "withModestyPanel"));
  const apronWidthRaw = getOption<number>(input, opt(o, "apronWidth"));
  // withApron / apronThickness 已在下方 declare 用 raw → 0；此處先用同樣邏輯
  // 但 withApron 變數還沒讀，先暫定後續會 reassign。為避免重複，直接讀。
  const apronWidth = (getOption<boolean>(input, opt(o, "withApron")) ? apronWidthRaw : 0);
  const apronThicknessRaw = getOption<number>(input, opt(o, "apronThickness"));
  const withApron = getOption<boolean>(input, opt(o, "withApron"));
  const apronThickness = withApron ? apronThicknessRaw : 0;
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const withCenterStretcher = getOption<boolean>(input, opt(o, "withCenterStretcher"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const withSlatRack = getOption<boolean>(input, opt(o, "withSlatRack"));
  const slatCount = getOption<number>(input, opt(o, "slatCount"));
  const slatWidth = getOption<number>(input, opt(o, "slatWidth"));
  const slatThickness = getOption<number>(input, opt(o, "slatThickness"));
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
    legPenetratingTenon,
    withCenterStretcher: withCenterStretcher && drawerCount === 0,
    withLowerStretchers,
    withSlatRack,
    slatCount,
    slatWidth,
    slatThickness,
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
    liveEdge,
    notes: `書桌：桌腳 ${legSize}mm${legShape === "tapered" ? "（錐形）" : ""}、牙板 ${apronWidth}×${apronThickness}mm${drawerCount > 0 ? `、${drawerSide === "center" ? "中央" : drawerSide === "left" ? "左側" : "右側"}懸吊 ${drawerCount} 抽屜` : ""}。${liveEdge ? " Live edge 原木邊。" : ""}${withModestyPanel ? " 前方加 350mm 高 modesty 飾遮腿板（會議/客戶桌風格）。" : ""}`,
  });

  if (drawerCount > 0) {
    const legHeight = input.height - topThickness;
    const innerW = input.length - 2 * legSize - 2 * legInset;
    const caseW = drawerSide === "center"
      ? Math.min(400, input.length * 0.4)
      : Math.min(450, innerW * 0.4);
    // 櫃頂位置：有牙板時牙板底下再扣 5mm clearance；無牙板用 pedestalTopGap
    const pedestalTopGap = getOption<number>(input, opt(o, "pedestalTopGap"));
    const topGap = withApron ? apronWidth + 5 : pedestalTopGap;
    const caseTopY = legHeight - topGap;
    // 櫃身高度限制：caseTopY 到地板的距離 - 80mm 離地（給 H-frame 留空間）
    const maxCaseH = caseTopY - 80;
    const caseH = Math.min(maxCaseH, drawerCount * 130 + 30);
    const caseY = caseTopY - caseH;
    // 櫃深：剛好卡在前後牙板之間（caseD = 2 × 牙板內面 Z）
    // 牙板中心 Z = ±(width/2 - legSize/2 - legInset)，牙板內面 = 中心 + thickness/2 朝中心
    const PANEL_T = 15; // 跟 caseFurniture 的 panelThickness 一致
    const innerLegEdgeX = input.length / 2 - legSize - legInset;
    const innerLegEdgeZ = input.width / 2 - legSize - legInset;
    // 有牙板：caseD 卡在前後牙板內面之間
    // 無牙板：caseD 卡在前後腳內面之間
    const apronCenterZ = input.width / 2 - legSize / 2 - legInset;
    const apronInnerZ = apronCenterZ - apronThickness / 2;
    const caseD = withApron ? 2 * apronInnerZ : 2 * innerLegEdgeZ;
    // 櫃子貼到外側腳的內面（左/右側）；中央則不貼任何腳
    const caseX = drawerSide === "center"
      ? 0
      : drawerSide === "left"
      ? -(innerLegEdgeX - caseW / 2)
      : (innerLegEdgeX - caseW / 2);

    // 抽屜模式 / 滑軌 / 把手等選項
    const drawerMount = resolveDrawerMount(input, o);
    const drawerBottomMode = resolveDrawerBottomMode(input, o);
    const drawerSlideGap = resolveDrawerSlideGap(input, o);
    const pullStyle = getOption<string>(input, opt(o, "pullStyle"));

    // 用 caseFurniture builder 蓋一個迷你抽屜櫃（無腳），再 translate 進 desk 座標
    const pedestal = caseFurniture({
      category: "nightstand", // 借用——只影響 nameZh 沒外洩
      nameZh: "懸吊抽屜櫃",
      length: caseW,
      width: caseD,
      height: caseH,
      material: input.material,
      shelfCount: 0,
      zones: [{ type: "drawer", heightMm: caseH - 36, count: drawerCount, cols: 1 }],
      legHeight: 0,
      drawerMount,
      drawerBottomMode,
      drawerSlideGap,
      pullStyle,
      backMode: "surface",
      panelThickness: 15,
    });

    // 平移所有 part：x += caseX、y += caseY、z 不偏（面板向 -Z 凸出已在
    // 牙板下方無衝突）。caseFurniture 自身 0,0,0 為 X/Z 中心、y=0 為 case 底
    for (const p of pedestal.parts) {
      design.parts.push({
        ...p,
        id: `desk-pedestal-${p.id}`,
        origin: {
          x: p.origin.x + caseX,
          y: p.origin.y + caseY,
          z: p.origin.z,
        },
      });
    }
    // 延伸側板：把櫃頂連到桌面底，取代另一隻腳的結構支撐角色
    // - left/right pedestal：延伸的是「靠走道側」的側板（kneehole 那側）
    // - center pedestal：兩側都延伸（跨距較窄無腳支撐）
    const extensionTopY = legHeight; // 連到桌底
    const extensionBotY = caseTopY;  // 從櫃頂往上接
    const extensionH = extensionTopY - extensionBotY;
    if (extensionH > 0) {
      const extensionSides: number[] = drawerSide === "center"
        ? [-1, +1]
        : drawerSide === "left"
          ? [+1]   // 櫃在左、延伸右側板（朝走道）
          : [-1];  // 櫃在右、延伸左側板（朝走道）
      for (const sx of extensionSides) {
        const extX = caseX + sx * (caseW / 2 - PANEL_T / 2);
        design.parts.push({
          id: `desk-pedestal-extension-${sx < 0 ? "left" : "right"}`,
          nameZh: `懸吊櫃延伸側板（${sx < 0 ? "左" : "右"}）`,
          material: input.material,
          grainDirection: "length",
          visible: { length: PANEL_T, width: caseD, thickness: extensionH },
          origin: { x: extX, y: extensionBotY, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
    }
    // H-frame 結構橫撐：左右各一條沿 Z 縱向（前後腳間 + 8mm 插入腳）
    // 加一條沿 X 橫向連接、撐櫃底。8mm penetration 視覺上 mortise-tenon
    // 接合（不只是貼齊），audit 用預設 options 不會跑到這條代碼
    const withHFrame = getOption<boolean>(input, opt(o, "withHFrame"));
    if (withHFrame) {
    const STRETCHER_T = 25;     // X / Z 方向短軸（厚）
    const STRETCHER_H = 40;     // Y 方向（高）
    const TENON = 8;            // mortise-tenon 視覺接合 penetration
    const pedestalStretcherHeight = getOption<number>(input, opt(o, "pedestalStretcherHeight"));
    // 0 = 自動貼櫃底；> 0 = 改成離地此高度。max clamp 到 caseY - STRETCHER_H
    // 避免 stretcher 頂面超過櫃底（不然會撞櫃子）
    const maxStretcherY = caseY - STRETCHER_H;
    const stretcherY = pedestalStretcherHeight > 0
      ? Math.min(pedestalStretcherHeight, maxStretcherY)
      : maxStretcherY;
    if (pedestalStretcherHeight > maxStretcherY) {
      design.warnings = [
        ...(design.warnings ?? []),
        `H 框離地高 ${pedestalStretcherHeight}mm 超過上限——已自動縮回 ${maxStretcherY}mm（不能高過櫃底）`,
      ];
    }
    // 縱向橫撐：X 中心在腳中心軸上（兩面跟腳內外面平齊，跟腳同X 範圍）
    // 長度跨前後腳內面 + 兩端各 8mm 插進腳裡（mortise-tenon）
    const legCenterX = input.length / 2 - legSize / 2 - legInset;
    const sideStretcherLen = 2 * innerLegEdgeZ + 2 * TENON;
    for (const sx of [-1, +1] as const) {
      design.parts.push({
        id: `desk-h-side-${sx < 0 ? "left" : "right"}`,
        nameZh: `H 框${sx < 0 ? "左" : "右"}縱向橫撐`,
        material: input.material,
        grainDirection: "width",  // 主軸沿 Z（width）
        visible: { length: STRETCHER_T, width: sideStretcherLen, thickness: STRETCHER_H },
        origin: { x: sx * legCenterX, y: stretcherY, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
    // 橫向長橫撐：只在 drawerCount > 1 才需要（單抽櫃輕、左右兩條已夠）
    if (drawerCount > 1) {
      const crossStretcherLen = 2 * (legCenterX - STRETCHER_T / 2 + TENON);
      design.parts.push({
        id: "desk-h-cross",
        nameZh: "H 框橫向長橫撐",
        material: input.material,
        grainDirection: "length",
        visible: { length: crossStretcherLen, width: STRETCHER_T, thickness: STRETCHER_H },
        origin: { x: 0, y: stretcherY, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
    } // end withHFrame
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
  applyStandardChecks(design, {
    minLength: 900, minWidth: 400, minHeight: 650,
    maxLength: 2000, maxWidth: 900, maxHeight: 800,
  });
  return design;
};
