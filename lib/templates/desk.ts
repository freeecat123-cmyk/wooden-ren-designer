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
    { value: "tapered", label: "錐形腳（方料下收）" },
    { value: "splayed", label: "方斜腳（四角對角外傾）" },
    { value: "splayed-length", label: "方斜腳（沿長邊單向外傾）" },
    { value: "splayed-width", label: "方斜腳（沿寬邊單向外傾）" },
    { value: "splayed-tapered", label: "方錐斜腳（下收 + 外傾）" },
    { value: "splayed-round-tapered", label: "圓錐斜腳（圓料下收 + 外傾）" },
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
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: false, help: "現代書桌少用；中式 / 工業風款再勾起來。需有牙板 + 無抽屜（抽屜佔中央位置）", dependsOn: { all: [{ key: "withApron", equals: true }, { key: "drawerCount", equals: 0 }] } },
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
  { group: "drawer", type: "select", key: "pedestalTopAttach", label: "櫃子接桌底方式", defaultValue: "single", choices: [
    { value: "single", label: "單邊側板延伸（傳統 pedestal desk）" },
    { value: "both", label: "兩側側板延伸（櫃子兩面都接桌底）" },
    { value: "none", label: "不接桌底（純靠 H 框支撐）" },
    { value: "brass-pillars", label: "4 隻黃銅柱（現代極簡）" },
  ], dependsOn: { key: "drawerCount", notIn: [0] } },
  { group: "drawer", type: "number", key: "brassPillarInset", label: "黃銅柱內縮 (mm)", defaultValue: 80, min: 0, max: 200, step: 5, help: "從櫃邊往內縮的距離（前後 + 左右都套用）", dependsOn: { all: [{ key: "drawerCount", notIn: [0] }, { key: "pedestalTopAttach", equals: "brass-pillars" }] } },
  { group: "drawer", type: "checkbox", key: "withHFrame", label: "加 H 框結構橫撐", defaultValue: true, help: "櫃子下方加 H 形橫撐做結構支撐；現代懸吊櫃可關掉只靠側板掛在腳上", dependsOn: { key: "drawerCount", notIn: [0] } },
  { group: "drawer", type: "number", key: "pedestalStretcherHeight", label: "H 框橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 600, step: 10, help: "0 = 自動貼櫃底；> 0 = 改放在離地此高度（櫃子變懸吊式）", dependsOn: { all: [{ key: "drawerCount", notIn: [0] }, { key: "withHFrame", equals: true }] } },
  { group: "drawer", type: "number", key: "pedestalTopGap", label: "櫃頂距桌底 (mm)", defaultValue: 5, min: 0, max: 200, step: 5, help: "無牙板時可調櫃頂到桌底的距離，預設 5mm 幾乎貼桌底", dependsOn: { all: [{ key: "withApron", equals: false }, { key: "drawerCount", notIn: [0] }] } },
  { group: "drawer", type: "number", key: "pedestalDepth", label: "櫃子深度 (mm)", defaultValue: 0, min: 0, max: 1000, step: 10, help: "0 = 跟桌子同深；> 0 = 自訂深度（max 桌深）", dependsOn: { all: [{ key: "withApron", equals: false }, { key: "drawerCount", notIn: [0] }] } },
  { group: "apron", type: "checkbox", key: "withModestyPanel", label: "後飾遮腿板（modesty panel）", defaultValue: false, help: "桌後加一片整片立板（高 350mm），遮住坐者下肢的後側；常見於辦公桌靠牆或自由站立場合。斜腳款不適用故隱藏", wide: true, dependsOn: { key: "legShape", notIn: ["splayed", "splayed-length", "splayed-width", "splayed-tapered", "splayed-round-tapered"] } },
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
  const withModestyPanelRaw = getOption<boolean>(input, opt(o, "withModestyPanel"));
  // 斜腳款 modesty 板會跟外傾腳幾何衝突，強制取消
  const isAnySplayed = legShape === "splayed" || legShape === "splayed-length" || legShape === "splayed-width" || legShape === "splayed-tapered" || legShape === "splayed-round-tapered";
  const withModestyPanel = isAnySplayed ? false : withModestyPanelRaw;
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
    legShape: legShape as "box" | "tapered" | "splayed" | "splayed-length" | "splayed-width" | "splayed-tapered" | "splayed-round-tapered",
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    liveEdge,
    notes: `書桌：桌腳 ${legSize}mm${legShape === "tapered" ? "（錐形）" : ""}、牙板 ${apronWidth}×${apronThickness}mm${drawerCount > 0 ? `、${drawerSide === "center" ? "中央" : drawerSide === "left" ? "左側" : "右側"}懸吊 ${drawerCount} 抽屜` : ""}。${liveEdge ? " Live edge 原木邊。" : ""}${withModestyPanel ? " 後方加 350mm 高 modesty 飾遮腿板。" : ""}`,
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
    // 無牙板：default 跟桌子同深，user 可自訂 pedestalDepth (max 桌深)
    const apronCenterZ = input.width / 2 - legSize / 2 - legInset;
    const apronInnerZ = apronCenterZ - apronThickness / 2;
    const pedestalDepthRaw = getOption<number>(input, opt(o, "pedestalDepth"));
    const caseD = withApron
      ? 2 * apronInnerZ
      : Math.min(pedestalDepthRaw > 0 ? pedestalDepthRaw : input.width, input.width);
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
    // 櫃頂接桌底：4 種方式
    const pedestalTopAttach = getOption<string>(input, opt(o, "pedestalTopAttach"));
    const extensionTopY = legHeight; // 連到桌底
    const extensionBotY = caseTopY;
    const extensionH = extensionTopY - extensionBotY;
    if (extensionH > 0 && pedestalTopAttach !== "none") {
      if (pedestalTopAttach === "brass-pillars") {
        // 4 隻黃銅圓柱，預設從櫃邊內縮 brassPillarInset（default 80mm）
        const PILLAR_D = 20;
        const brassPillarInset = getOption<number>(input, opt(o, "brassPillarInset"));
        // clamp 內縮不超過櫃半寬/半深 - 柱半徑（避免柱跑出櫃外）
        const insetX = Math.min(brassPillarInset, caseW / 2 - PILLAR_D / 2);
        const insetZ = Math.min(brassPillarInset, caseD / 2 - PILLAR_D / 2);
        for (const sx of [-1, +1] as const) {
          for (const sz of [-1, +1] as const) {
            design.parts.push({
              id: `desk-pedestal-pillar-${sx < 0 ? "L" : "R"}${sz < 0 ? "F" : "B"}`,
              nameZh: `黃銅柱（${sx < 0 ? "左" : "右"}${sz < 0 ? "前" : "後"}）`,
              material: input.material,
              materialOverride: "plywood",
              grainDirection: "length",
              visible: { length: PILLAR_D, width: PILLAR_D, thickness: extensionH },
              origin: {
                x: caseX + sx * (caseW / 2 - insetX),
                y: extensionBotY,
                z: sz * (caseD / 2 - insetZ),
              },
              shape: { kind: "round" },
              visual: "brass-antique",
              tenons: [],
              mortises: [],
            });
          }
        }
      } else {
        // 側板延伸：single / both，center pedestal 因無外側腳預設 both
        const useBoth = pedestalTopAttach === "both" || drawerSide === "center";
        const extensionSides: number[] = useBoth
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
    // 縱向橫撐：X 中心在腳中心軸上 + 斜腳補償（splayed 系列腳底比頂位移）
    // 在 stretcher Y 高度處，腳已沿 X/Z 偏移 splayMm × (1 - stretcherY/legHeight)
    const isSplayedX = legShape === "splayed" || legShape === "splayed-length" || legShape === "splayed-tapered" || legShape === "splayed-round-tapered";
    const isSplayedZ = legShape === "splayed" || legShape === "splayed-width" || legShape === "splayed-tapered" || legShape === "splayed-round-tapered";
    const splayMm = 40; // 跟 simple-table 同
    const splayFrac = Math.max(0, 1 - stretcherY / legHeight);
    const splayOffsetX = isSplayedX ? splayMm * splayFrac : 0;
    const splayOffsetZ = isSplayedZ ? splayMm * splayFrac : 0;
    const legCenterX = input.length / 2 - legSize / 2 - legInset + splayOffsetX;
    // 縱向橫撐統一伸到腳中心 Z（不論方/錐/圓腳，端面都藏進腳輪廓內）
    // = 2 × (top 腳中心 Z + splay 偏移 at stretcher Y)
    const sideStretcherLen = 2 * (innerLegEdgeZ + legSize / 2 + splayOffsetZ);
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

  // 後飾遮腿板（modesty panel）
  if (withModestyPanel) {
    design.parts.push({
      id: "modesty-panel",
      nameZh: "後飾遮腿板",
      material: input.material,
      grainDirection: "length",
      visible: { length: input.length - 100, width: 350, thickness: 18 },
      origin: { x: 0, y: input.height - 380, z: input.width / 2 - 30 },
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
