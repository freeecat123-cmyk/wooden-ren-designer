import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { caseFurniture } from "./_builders/case-furniture";
import { renderDrawerZone as renderDrawerZoneShared } from "./_builders/drawer-row";
import { applyLowerStretcherArrangement } from "./dining-table";
import { applyStandardChecks } from "./_validators";
import {
  seatEdgeOption,
  seatEdgeBottomOption,
  seatEdgeStyleOption,
  legEdgeOption,
  legEdgeStyleOption,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  apronEdgeOption,
  apronEdgeStyleOption,
  pullStyleOption,
  legEdgeShape,
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
  // ───────────── ① 桌面 ─────────────
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 12, max: 60, step: 2 },
  { ...seatEdgeOption("top", 5), dependsOn: { key: "liveEdge", notIn: [true] } },
  { ...seatEdgeBottomOption("top"), dependsOn: { all: [{ key: "legInset", notIn: [0] }, { key: "liveEdge", notIn: [true] }] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { all: [{ any: [{ key: "seatEdge", notIn: [0] }, { key: "seatEdgeBottom", notIn: [0] }] }, { key: "liveEdge", notIn: [true] }] } },
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊", defaultValue: false, help: "桌面長邊保留原木樹皮曲線", wide: true },

  // ───────────── ② 桌腳 ─────────────
  { group: "leg", type: "select", key: "legShape", label: "桌腳樣式", defaultValue: "box", help: "選「牙板位置抽屜」時只支援：直腳、方斜腳（沿寬邊單向）、夏克腳—其他腳型自動隱藏", choices: [
    { value: "box", label: "直腳（方料）" },
    // 以下腳型在「牙板位置抽屜」模式下不支援（跑條/填補牙板無法準確對齊腳內面）→ 隱藏
    { value: "tapered", label: "錐形腳（方料下收）", dependsOn: { any: [{ key: "drawerStyle", notIn: ["apron"] }, { key: "drawerCount", equals: 0 }] } },
    { value: "splayed", label: "方斜腳（四角對角外傾）", dependsOn: { any: [{ key: "drawerStyle", notIn: ["apron"] }, { key: "drawerCount", equals: 0 }] } },
    { value: "splayed-length", label: "方斜腳（沿長邊單向外傾）", dependsOn: { any: [{ key: "drawerStyle", notIn: ["apron"] }, { key: "drawerCount", equals: 0 }] } },
    { value: "splayed-width", label: "方斜腳（沿寬邊單向外傾）" },
    { value: "splayed-tapered", label: "方錐斜腳（下收 + 外傾）", dependsOn: { any: [{ key: "drawerStyle", notIn: ["apron"] }, { key: "drawerCount", equals: 0 }] } },
    { value: "splayed-round-tapered", label: "圓錐斜腳（圓料下收 + 外傾）", dependsOn: { any: [{ key: "drawerStyle", notIn: ["apron"] }, { key: "drawerCount", equals: 0 }] } },
    { value: "shaker", label: "夏克腳（上 1/4 方料、下 3/4 圓錐收）" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 55, min: 20, max: 120, step: 2 },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 400, step: 5 },
  // shaker / splayed-round-tapered 是圓料、沒有 4 條長邊；只在方料/方錐/方斜腳顯示
  legEdgeOption("leg", 1, { key: "legShape", notIn: ["shaker", "splayed-round-tapered"] }),
  legEdgeStyleOption("leg", "chamfered", { key: "legShape", notIn: ["shaker", "splayed-round-tapered"] }),

  // ───────────── ③ 牙條 ─────────────
  { group: "apron", type: "checkbox", key: "withApron", label: "加牙條", defaultValue: true, help: "牙條連接四隻腳上方，傳統桌類結構件。Mid-century / 工業風常省略改用金屬支架" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙條高 (mm)", defaultValue: 90, min: 30, max: 200, step: 5, dependsOn: { key: "withApron", equals: true } },
  { group: "apron", type: "number", key: "apronThickness", label: "牙條厚 (mm)", defaultValue: 25, min: 10, max: 50, step: 2, dependsOn: { key: "withApron", equals: true } },
  { group: "apron", type: "number", key: "apronOffset", label: "牙條距桌面 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "withApron", equals: true } },
  apronEdgeOption("apron", 1),
  apronEdgeStyleOption("apron"),
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙條/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）", dependsOn: { key: "withApron", equals: true } },

  // ───────────── ④ 橫撐 ─────────────
  { group: "apron", type: "checkbox", key: "withCenterStretcher", label: "中央牙條", defaultValue: false, help: "現代書桌少用；中式 / 工業風款再勾起來。需有牙條。pedestal 中央抽屜跟牙條抽屜會跟中央牙條衝突所以隱藏", dependsOn: { all: [{ key: "withApron", equals: true }, { key: "drawerStyle", notIn: ["apron"] }, { any: [{ key: "drawerStyle", equals: "none" }, { key: "drawerSide", notIn: ["center"] }] }] } },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "下橫撐", defaultValue: false },
  { group: "stretcher", type: "select", key: "lowerStretcherArrangement", label: "下橫撐排列", defaultValue: "box-frame", choices: [
    { value: "box-frame", label: "4 邊框（最穩，預設）" },
    { value: "h-frame", label: "H 形（左右 2 條 + 中央 1 條）" },
    { value: "pair-x", label: "雙條（前/後 2 條，無左右）" },
    { value: "pair-z", label: "雙條（左/右 2 條，無前後）" },
  ], dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5, dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 28, min: 10, max: 50, step: 1, dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 700, step: 10, help: "設 0 = 自動", dependsOn: { key: "withLowerStretchers", equals: true } },
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "stretcher", type: "checkbox", key: "withSlatRack", label: "下橫撐置物條", defaultValue: false, help: "前後下橫撐之間架格柵條，做置物層", dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "slatCount", label: "置物條數量", defaultValue: 0, min: 0, max: 20, step: 1, help: "0 = 自動依桌長算（每 150mm 一條）", dependsOn: { key: "withSlatRack", equals: true } },
  { group: "stretcher", type: "number", key: "slatWidth", label: "置物條寬 (mm)", defaultValue: 35, min: 15, max: 100, step: 5, dependsOn: { key: "withSlatRack", equals: true } },
  { group: "stretcher", type: "number", key: "slatThickness", label: "置物條厚 (mm)", defaultValue: 18, min: 8, max: 40, step: 1, dependsOn: { key: "withSlatRack", equals: true } },

  // ───────────── ⑤ 抽屜 ─────────────
  { group: "drawer", type: "select", key: "drawerStyle", label: "抽屜形式", defaultValue: "none", choices: [
    { value: "none", label: "無抽屜" },
    { value: "pedestal", label: "懸吊抽屜櫃（桌底掛櫃）" },
    { value: "apron", label: "牙板位置抽屜（薄抽併排於前牙板帶）" },
  ], help: "無：純桌子無抽屜；懸吊：傳統 pedestal desk，整個抽屜櫃掛桌底；牙板：把前牙板換成 N 個薄抽屜（類似床頭桌作法）" },
  { group: "drawer", type: "number", key: "drawerCount", label: "抽屜數", defaultValue: 1, min: 1, max: 3, step: 1, help: "懸吊形式 = N 層抽屜疊在櫃裡；牙板形式 = N 個抽屜橫向併排", dependsOn: { key: "drawerStyle", notIn: ["none"] } },
  { group: "drawer", type: "select", key: "drawerSide", label: "抽屜位置", defaultValue: "right", choices: [
    { value: "left", label: "左側" },
    { value: "right", label: "右側" },
    { value: "center", label: "中央（窄型）" },
  ], dependsOn: { key: "drawerStyle", equals: "pedestal" } },
  // 抽屜細部（同櫃類）—— 跟櫃類同款 helper 共用
  { ...drawerMountOption, dependsOn: { key: "drawerStyle", equals: "pedestal" }, help: "牙板抽屜形式只能入柱（強制）" },
  { ...drawerBottomModeOption, dependsOn: { key: "drawerStyle", notIn: ["none"] } },
  { ...drawerSlideOption, dependsOn: { key: "drawerStyle", notIn: ["none"] } },
  { ...pullStyleOption("drawer"), dependsOn: { key: "drawerStyle", notIn: ["none"] } },
  // 抽屜櫃結構：接桌底方式 + 深度/間距 + H 框（僅 pedestal 形式）
  { group: "drawer", type: "select", key: "pedestalTopAttach", label: "櫃子接桌底方式", defaultValue: "single", choices: [
    { value: "single", label: "單邊側板延伸（傳統 pedestal desk）" },
    { value: "both", label: "兩側側板延伸（櫃子兩面都接桌底）" },
    { value: "none", label: "不接桌底（純靠 H 框支撐）" },
    { value: "brass-pillars", label: "4 隻黃銅柱（現代極簡）" },
  ], dependsOn: { key: "drawerStyle", equals: "pedestal" } },
  { group: "drawer", type: "number", key: "brassPillarInset", label: "黃銅柱內縮 (mm)", defaultValue: 80, min: 0, max: 200, step: 5, help: "從櫃邊往內縮的距離（前後 + 左右都套用）", dependsOn: { all: [{ key: "drawerStyle", equals: "pedestal" }, { key: "pedestalTopAttach", equals: "brass-pillars" }] } },
  { group: "drawer", type: "number", key: "pedestalTopGap", label: "櫃頂距桌底 (mm)", defaultValue: 5, min: 0, max: 200, step: 5, help: "無牙板時可調櫃頂到桌底的距離，預設 5mm 幾乎貼桌底", dependsOn: { all: [{ key: "withApron", equals: false }, { key: "drawerStyle", equals: "pedestal" }] } },
  { group: "drawer", type: "number", key: "pedestalDepth", label: "櫃子深度 (mm)", defaultValue: 0, min: 0, max: 1000, step: 10, help: "0 = 跟桌子同深；> 0 = 自訂深度（max 桌深）", dependsOn: { all: [{ key: "withApron", equals: false }, { key: "drawerStyle", equals: "pedestal" }] } },
  { group: "drawer", type: "checkbox", key: "withHFrame", label: "加 H 框結構橫撐", defaultValue: true, help: "櫃子下方加 H 形橫撐做結構支撐；現代懸吊櫃可關掉只靠側板掛在腳上", dependsOn: { key: "drawerStyle", equals: "pedestal" } },
  { group: "drawer", type: "number", key: "pedestalStretcherHeight", label: "H 框橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 600, step: 10, help: "0 = 自動貼櫃底；> 0 = 改放在離地此高度（櫃子變懸吊式）", dependsOn: { all: [{ key: "drawerStyle", equals: "pedestal" }, { key: "withHFrame", equals: true }] } },
  // 牙板抽屜形式（apron）— 面板可微內縮做層次
  { group: "drawer", type: "number", key: "apronDrawerFrontInset", label: "抽屜面板內縮 (mm)", defaultValue: 0, min: 0, max: 15, step: 1, help: "面板從牙板外面往內推幾 mm（0 = 跟牙板齊平；3~6 = 微凹陷有層次；max 15 因面板厚 18mm）", dependsOn: { key: "drawerStyle", equals: "apron" } },
  // 單抽情況：寬度可調 + 位置（左/中/右）；多抽預設等寬橫向併滿牙板
  { group: "drawer", type: "number", key: "apronDrawerWidth", label: "牙板抽屜寬 (mm)", defaultValue: 400, min: 150, max: 800, step: 10, help: "單抽時可調寬度；預設 400mm（A4 紙橫向約 297mm 放得進去 + 邊距）；上限 800 適合大多桌寬", dependsOn: { all: [{ key: "drawerCount", equals: 1 }, { key: "drawerStyle", equals: "apron" }] } },
  { group: "drawer", type: "select", key: "apronDrawerPosition", label: "牙板抽屜位置", defaultValue: "center", choices: [
    { value: "left", label: "左側" },
    { value: "center", label: "中央" },
    { value: "right", label: "右側" },
  ], dependsOn: { all: [{ key: "drawerCount", equals: 1 }, { key: "drawerStyle", equals: "apron" }] } },

  // ───────────── ⑥ 後飾遮腿板 ─────────────
  { group: "apron", type: "checkbox", key: "withModestyPanel", label: "後飾遮腿板（modesty panel）", defaultValue: false, help: "桌後加一片整片立板（高 350mm），遮住坐者下肢的後側；常見於辦公桌靠牆或自由站立場合。斜腳/夏克腳款不適用故隱藏", wide: true, dependsOn: { key: "legShape", notIn: ["splayed", "splayed-length", "splayed-width", "splayed-tapered", "splayed-round-tapered", "shaker"] } },
];

export const desk: FurnitureTemplate = (input) => {
  const o = deskOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const seatEdge = getOption<number>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const seatEdgeBottom = getOption<number>(input, opt(o, "seatEdgeBottom"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronEdge = getOption<number>(input, opt(o, "apronEdge"));
  const apronEdgeStyle = getOption<string>(input, opt(o, "apronEdgeStyle"));
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
  const withModestyPanelRaw = getOption<boolean>(input, opt(o, "withModestyPanel"));
  // 斜腳 / 夏克腳款 modesty 板會跟外傾腳 / 下半圓錐幾何衝突，強制取消
  const isAnySplayed = legShape === "splayed" || legShape === "splayed-length" || legShape === "splayed-width" || legShape === "splayed-tapered" || legShape === "splayed-round-tapered";
  const modestyNotSupported = isAnySplayed || legShape === "shaker";
  const withModestyPanel = modestyNotSupported ? false : withModestyPanelRaw;
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
  const drawerStyleRaw = getOption<string>(input, opt(o, "drawerStyle"));
  // 向下相容：舊版設計檔沒有 drawerStyle，若 drawerCount > 0 表示有抽屜 → 視為 pedestal
  const drawerStyle = drawerStyleRaw === "none" && getOption<number>(input, opt(o, "drawerCount")) > 0 && input.options?.drawerStyle === undefined
    ? "pedestal"
    : drawerStyleRaw;
  const apronDrawerWidth = getOption<number>(input, opt(o, "apronDrawerWidth"));
  const apronDrawerPosition = getOption<string>(input, opt(o, "apronDrawerPosition"));
  const apronDrawerFrontInset = getOption<number>(input, opt(o, "apronDrawerFrontInset"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const seatEdgeBottomClamped = Math.min(seatEdgeBottom, legInset);
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const lowerStretcherArrangement = getOption<string>(input, opt(o, "lowerStretcherArrangement"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));

  const design = simpleTable({
    category: "desk",
    nameZh: "書桌/辦公桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    apronThickness,
    legPenetratingTenon,
    // 中央橫撐：(1) pedestal 中央抽屜衝突 (2) apron 模式中間是抽屜帶也衝突
    withCenterStretcher: withCenterStretcher
      && !(drawerStyle === "pedestal" && drawerSide === "center")
      && drawerStyle !== "apron",
    skipFrontApron: drawerStyle === "apron" && withApron,
    withLowerStretchers,
    lowerStretcherWidth,
    lowerStretcherThickness,
    withSlatRack,
    slatCount,
    slatWidth,
    slatThickness,
    legInset,
    apronOffset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: legShape as "box" | "tapered" | "splayed" | "splayed-length" | "splayed-width" | "splayed-tapered" | "splayed-round-tapered" | "shaker",
    seatEdge,
    seatEdgeStyle,
    seatEdgeBottom: seatEdgeBottomClamped,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    apronEdge,
    apronEdgeStyle,
    liveEdge,
    notes: `書桌/辦公桌：桌腳 ${legSize}mm${legShape === "tapered" ? "（錐形）" : legShape === "shaker" ? "（夏克）" : ""}、牙板 ${apronWidth}×${apronThickness}mm${drawerStyle === "pedestal" ? `、${drawerSide === "center" ? "中央" : drawerSide === "left" ? "左側" : "右側"}懸吊 ${drawerCount} 抽屜` : drawerStyle === "apron" ? `、牙板抽屜 ${drawerCount} 個` : "、無抽屜"}。${liveEdge ? " Live edge 原木邊。" : ""}${withModestyPanel ? " 後方加 350mm 高 modesty 飾遮腿板。" : ""}`,
  });

  // 下橫撐排列方式（box-frame 預設無動作，跟 dining-table 同一條 post-process）
  if (withLowerStretchers && lowerStretcherArrangement !== "box-frame") {
    applyLowerStretcherArrangement(design, lowerStretcherArrangement, {
      length: input.length,
      width: input.width,
      legSize,
      legInset,
      material: input.material as string,
      lowerStretcherWidth,
      lowerStretcherThickness,
      doubleRailGap: 0, // 書桌不支援雙環模式
    });
  }

  if (drawerCount > 0 && drawerStyle === "pedestal") {
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
    // front 視角相機在 -Z（PerspectiveView line 2583），世界 +X 顯示在螢幕左邊。
    // 使用者選「右側」直覺上是看螢幕右側 → 對應世界 -X。
    const caseX = drawerSide === "center"
      ? 0
      : drawerSide === "left"
      ? (innerLegEdgeX - caseW / 2)
      : -(innerLegEdgeX - caseW / 2);

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
              nameEn: `Brass pillar (${sx < 0 ? "left" : "right"} ${sz < 0 ? "front" : "back"})`,
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
            ? [-1]   // 櫃在螢幕左（世界 -X 朝 +X 反過來）、延伸朝走道側
            : [+1];  // 櫃在螢幕右、延伸朝走道側
        for (const sx of extensionSides) {
          const extX = caseX + sx * (caseW / 2 - PANEL_T / 2);
          design.parts.push({
            id: `desk-pedestal-extension-${sx < 0 ? "left" : "right"}`,
            nameZh: `懸吊櫃延伸側板（${sx < 0 ? "左" : "右"}）`,
            nameEn: `Pedestal extension side panel (${sx < 0 ? "left" : "right"})`,
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
    // 算 stretcher TOP / BOT / CENTER 三組 splay+taper，以 center 當基準長度，
    // 用 apron-trapezoid shape 讓端面跟著腳角度切斜（比照 simple-table 下橫撐做法）
    const isSplayedX = legShape === "splayed" || legShape === "splayed-length" || legShape === "splayed-tapered" || legShape === "splayed-round-tapered";
    const isSplayedZ = legShape === "splayed" || legShape === "splayed-width" || legShape === "splayed-tapered" || legShape === "splayed-round-tapered";
    const splayMm = 40; // 跟 simple-table 同
    const stretcherTopY = stretcherY + 40; // STRETCHER_H = 40
    const stretcherCenterY = stretcherY + 20;
    const splayFracBot = Math.max(0, 1 - stretcherY / legHeight);
    const splayFracTop = Math.max(0, 1 - stretcherTopY / legHeight);
    const splayFracCenter = Math.max(0, 1 - stretcherCenterY / legHeight);
    const splayOffsetX = isSplayedX ? splayMm * splayFracCenter : 0;
    const splayOffsetZ = isSplayedZ ? splayMm * splayFracCenter : 0;
    const splayOffsetZBot = isSplayedZ ? splayMm * splayFracBot : 0;
    const splayOffsetZTop = isSplayedZ ? splayMm * splayFracTop : 0;
    const legCenterX = input.length / 2 - legSize / 2 - legInset + splayOffsetX;
    // 縱向橫撐沿 Z 跨前後腳；前腳外推 splayOffsetZ、後腳同樣 → 整體 Z 跨距 + 2×splayOffsetZ
    // 圓腳：直接跨腳中心到腳中心（端面藏進圓柱半徑內）→ 額外 +legSize
    // 方錐：腳在 stretcher Y 因 taper 變窄、inner face 內縮 → 補 taper 差讓
    //       stretcher 端面剛好接到 inner face（不另外加 TENON penetration，
    //       wireframe 看不到內穿線）
    const isRoundLegInH = legShape === "splayed-round-tapered";
    const isTaperedLeg = legShape === "tapered" || legShape === "splayed-tapered" || legShape === "splayed-round-tapered";
    const bottomScale = isTaperedLeg ? 0.55 : 1;
    // 三條 Y 各自的腳寬（taper 影響）
    const legScaleAtCenter = 1 - (1 - bottomScale) * (1 - stretcherCenterY / legHeight);
    const legScaleAtBot = 1 - (1 - bottomScale) * (1 - stretcherY / legHeight);
    const legScaleAtTop = 1 - (1 - bottomScale) * (1 - stretcherTopY / legHeight);
    const halfLegCenter = (legSize * legScaleAtCenter) / 2;
    const halfLegBot = (legSize * legScaleAtBot) / 2;
    const halfLegTop = (legSize * legScaleAtTop) / 2;
    const taperCompCenter = legSize / 2 - halfLegCenter;
    const taperCompBot = legSize / 2 - halfLegBot;
    const taperCompTop = legSize / 2 - halfLegTop;
    // 三條 Y 各自的 stretcher 半長（以 inner face at that Y 為終點）
    const halfLenCenter = isRoundLegInH
      ? innerLegEdgeZ + legSize / 2 + splayOffsetZ
      : innerLegEdgeZ + splayOffsetZ + taperCompCenter;
    const halfLenBot = isRoundLegInH
      ? innerLegEdgeZ + legSize / 2 + splayOffsetZBot
      : innerLegEdgeZ + splayOffsetZBot + taperCompBot;
    const halfLenTop = isRoundLegInH
      ? innerLegEdgeZ + legSize / 2 + splayOffsetZTop
      : innerLegEdgeZ + splayOffsetZTop + taperCompTop;
    const sideStretcherLen = 2 * halfLenCenter;
    // apron-trapezoid scale：top/bot 跟 center 的長度比
    const trapTopScale = halfLenTop / halfLenCenter;
    const trapBotScale = halfLenBot / halfLenCenter;
    const sideStretcherShape = (Math.abs(trapTopScale - 1) > 0.001 || Math.abs(trapBotScale - 1) > 0.001)
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
      : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    void TENON;
    for (const sx of [-1, +1] as const) {
      // Euler ZYX (x:π/2, y:π/2)：local X→world -Z（length 沿 Z 方向）、
      // local +z→world -Y（trapezoid bot=stretcher 下緣，更長）、
      // local -z→world +Y（trapezoid top=stretcher 上緣，更短）
      // 端面就會跟腳斜面平行，下緣接到腳上、上緣斜切回避內收的腳
      design.parts.push({
        id: `desk-h-side-${sx < 0 ? "left" : "right"}`,
        nameZh: `H 框${sx < 0 ? "左" : "右"}縱向橫撐`,
        nameEn: `H-frame ${sx < 0 ? "left" : "right"} longitudinal stretcher`,
        material: input.material,
        grainDirection: "length",
        visible: { length: sideStretcherLen, width: STRETCHER_H, thickness: STRETCHER_T },
        origin: { x: sx * legCenterX, y: stretcherY, z: 0 },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        shape: sideStretcherShape,
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
        nameEn: "H-frame cross stretcher",
        material: input.material,
        grainDirection: "length",
        visible: { length: crossStretcherLen, width: STRETCHER_T, thickness: STRETCHER_H },
        origin: { x: 0, y: stretcherY, z: 0 },
        shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
        tenons: [],
        mortises: [],
      });
    }
    } // end withHFrame
  }

  // ───────── 牙板抽屜形式 ─────────
  // 把前牙板那條改成 N 個薄抽屜橫向併排，使用 case-furniture 抽出來的
  // renderDrawerZone helper，跟床頭桌/斗櫃同一條抽屜生成邏輯（5 板 + 滑軌 + 把手）。
  if (drawerStyle === "apron" && !withApron) {
    design.warnings = [
      ...(design.warnings ?? []),
      "選了「牙板位置抽屜」但沒勾「加牙板」— 牙板抽屜需要有牙板帶才能放，請勾起來",
    ];
  }
  if (drawerCount > 0 && drawerStyle === "apron" && withApron) {
    const legHeight = input.height - topThickness;
    const apronY = legHeight - apronWidth - apronOffset;
    // 牙板帶內側淨寬（前後腳內面之間）
    const innerLegSpan = input.length - 2 * legSize - 2 * legInset;
    // 牙板中心 Z（前牙板位置：負 Z）— 跟 simple-table 的 apronEdgeZ 同公式
    const apronCenterZ = input.width / 2 - legSize / 2 - legInset;
    // renderDrawerZone 用 `-caseWidth/2 - faceT/2 - 1` 算 zFace。我們希望抽屜
    // 面板的外面 (zFace - faceT/2) 落在牙板外面 z = -(apronCenterZ + apronThickness/2)。
    // 推：caseWidth = 2*(apronCenterZ + apronThickness/2) + 2 ≈ 2*apronCenterZ + apronThickness + 2
    // （+2 是 renderDrawerZone 內 `-1` 偏移雙倍補回）
    // virtualCaseWidth：讓抽屜面板外面剛好切齊桌面前緣（= 腳外面 + legInset，當前 desk
    // 不傳 topOverhang 給 simpleTable 所以桌面前緣 = 腳外面 Z = -width/2 + legInset）。
    // 推導：apronCenterZ = width/2 - legSize/2 - legInset → -apronCenterZ - legSize/2 = -width/2 + legInset
    // 所以 caseW = 2*apronCenterZ + legSize 即可讓 -caseW/2 = -width/2 + legInset。
    // 加 2 (補 renderDrawerZone zFace 內建 -1 偏移) − 2*apronDrawerFrontInset (面板內縮量)。
    // TODO 未來加 topOverhang 時要改用真正的桌面前緣 Z（= -width/2 + legInset - topOverhang）。
    const virtualCaseWidth = 2 * apronCenterZ + legSize + 2 - 2 * apronDrawerFrontInset;
    // 填補牙板的 Z 中心：讓「外面」跟抽屜面板外面 + 桌面前緣切齊
    const fillerCenterZ = -apronCenterZ - legSize / 2 + apronDrawerFrontInset + apronThickness / 2;
    const fillerInnerZ = fillerCenterZ + apronThickness / 2;
    const apronBackInnerZ = apronCenterZ - apronThickness / 2;
    // 抽屜深度 = filler 內面到後牙板內面（讓抽屜剛好塞滿牙板帶內部）
    const apronDrawerDepth = apronBackInnerZ - fillerInnerZ;
    // 抽屜箱中心 Z = runner 中心 Z（renderDrawerZone 的 caseInnerZ 用這個放 col-partition）
    const apronDrawerCenterZ = (fillerInnerZ + apronBackInnerZ) / 2;
    // 牙板抽屜面板強制入柱（overlay 會凸出牙板平面外，不合理）
    const drawerMount = "inset" as const;
    const drawerBottomMode = resolveDrawerBottomMode(input, o);
    const drawerSlideGap = resolveDrawerSlideGap(input, o);
    const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
    // 單抽：寬度 + 左/中/右位置可調；多抽：等寬併滿牙板帶
    // 注意 front 相機在 -Z，世界 +X 顯示在螢幕左 → 直覺「左」對應 +X、「右」對應 -X
    const isSingleApronDrawer = drawerCount === 1;
    const apronZoneW = isSingleApronDrawer
      ? Math.min(apronDrawerWidth, innerLegSpan)
      : innerLegSpan;
    const apronZoneXCenter = isSingleApronDrawer
      ? apronDrawerPosition === "left"
        ? (innerLegSpan / 2 - apronZoneW / 2)
        : apronDrawerPosition === "right"
        ? -(innerLegSpan / 2 - apronZoneW / 2)
        : 0
      : 0;
    renderDrawerZoneShared({
      yStart: apronY,
      height: apronWidth,
      rows: 1,
      cols: drawerCount,
      idPrefix: "desk-apron-drawer",
      labelPrefix: "牙板抽屜 ",
      dividerFrom: "none",
      xCenter: apronZoneXCenter,
      colInnerW: apronZoneW,
      material: input.material,
      panelT: apronThickness,
      shelfT: 0,
      shelfTongueT: 0,
      tenonLen: 0,
      caseLength: input.length,
      caseWidth: virtualCaseWidth,
      innerW: innerLegSpan,
      innerD: apronDrawerDepth,
      caseInnerZ: apronDrawerCenterZ,
      // panelT 也設成 apronThickness — 內部分隔（多抽時 cols-1 條）跟外側跑條等厚
      drawerFacePanelT: 18,
      drawerMount,
      drawerBottomMode,
      drawerSlideGap,
      pullStyle,
      skipCaseDividers: true,
    }, design.parts);

    // 多抽情況：col-partition 前緣縮到「抽屜面板後緣」位置（不戳到面板前方），
    // 從 2mm 縫看進去就直接是抽屜箱深處而不是 partition 戳出來的木頭
    if (drawerCount > 1) {
      const drawerFrontT = 18; // 與 drawer-row.ts 內定值同
      const newPartitionFrontZ = -apronCenterZ - legSize / 2 + apronDrawerFrontInset + drawerFrontT;
      const newPartitionWidth = apronBackInnerZ - newPartitionFrontZ;
      const newPartitionCenterZ = (newPartitionFrontZ + apronBackInnerZ) / 2;
      for (const p of design.parts) {
        if (p.id.startsWith("desk-apron-drawer-col-partition-")) {
          p.visible = { ...p.visible, width: newPartitionWidth };
          p.origin = { ...p.origin, z: newPartitionCenterZ };
        }
      }
    }
    // 多抽情況：把抽屜面板兩端各加長 apronThickness/2 + drawerGap/2，
    // 蓋掉中間 col-partition + 一半的 drawerGap → 中間留 2mm 縫隙。
    //   無滑軌 inset 模式：沒有 -face，由 -front 兼任面板 → 延伸 -front
    //   有滑軌：有獨立 -face（可見面板）→ 延伸 -face；-front 是背後的箱體前板無需動
    if (drawerCount > 1) {
      const DRAWER_GAP = 2;
      for (let i = 0; i < drawerCount; i++) {
        const hasLeftRunner = i > 0;
        const hasRightRunner = i < drawerCount - 1;
        const extLeft = hasLeftRunner ? apronThickness / 2 + DRAWER_GAP / 2 : 0;
        const extRight = hasRightRunner ? apronThickness / 2 + DRAWER_GAP / 2 : 0;
        if (extLeft === 0 && extRight === 0) continue;
        const face = design.parts.find((p) => p.id === `desk-apron-drawer-${i + 1}-face`);
        const front = design.parts.find((p) => p.id === `desk-apron-drawer-${i + 1}-front`);
        const target = face ?? front;
        if (!target) continue;
        target.visible = {
          ...target.visible,
          length: target.visible.length + extLeft + extRight,
        };
        target.origin = {
          ...target.origin,
          x: target.origin.x + (extRight - extLeft) / 2,
        };
      }
    }

    // —— 牙板抽屜左右補牙條 + 跑條（runner） ——
    // (1) 填補牙條：抽屜外側剩下的牙板帶用短牙板填滿（跟前牙板同 Y/Z/厚）
    // (2) 跑條：抽屜外側兩條 front-to-back 木條接前/後牙板，給抽屜當側軌
    const innerLegEdgeX = input.length / 2 - legSize - legInset;
    const drawerXLeft = apronZoneXCenter - apronZoneW / 2;   // 抽屜帶左邊界（世界 -X 方向那端）
    const drawerXRight = apronZoneXCenter + apronZoneW / 2;
    // 左/右間隙寬：抽屜帶外緣到內腳緣之間的距離
    const gapLeftW = drawerXLeft - (-innerLegEdgeX);  // > 0 表示左側有空隙
    const gapRightW = innerLegEdgeX - drawerXRight;
    // fillerCenterZ / fillerInnerZ / apronBackInnerZ 已於上方算好（renderDrawerZone 也用同樣值）
    if (gapLeftW > 5) {
      design.parts.push({
        id: "desk-apron-front-filler-left",
        nameZh: "前牙條填補（左）",
        nameEn: "Front apron filler (left)",
        material: input.material,
        grainDirection: "length",
        visible: { length: gapLeftW, width: apronWidth, thickness: apronThickness },
        origin: { x: -innerLegEdgeX + gapLeftW / 2, y: apronY, z: fillerCenterZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
    if (gapRightW > 5) {
      design.parts.push({
        id: "desk-apron-front-filler-right",
        nameZh: "前牙條填補（右）",
        nameEn: "Front apron filler (right)",
        material: input.material,
        grainDirection: "length",
        visible: { length: gapRightW, width: apronWidth, thickness: apronThickness },
        origin: { x: drawerXRight + gapRightW / 2, y: apronY, z: fillerCenterZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
    // 跑條：每抽屜的左/右外側各一條 — front-to-back 連接前/後牙板
    // 截面跟前後牙板等寬：apronWidth (高) × apronThickness (橫向短邊)
    const runnerLen = apronDrawerDepth;
    const runnerCenterZ = apronDrawerCenterZ;
    // 外側跑條：左/右各一條（最外側）。中間跑條由 renderDrawerZone 的 col-partition
    // 處理（已設 panelT=apronThickness 等厚），多抽時不另外生 middle runner 避免重疊。
    const outerRunnerXs = [
      apronZoneXCenter - apronZoneW / 2 - apronThickness / 2, // 左外側
      apronZoneXCenter + apronZoneW / 2 + apronThickness / 2, // 右外側
    ];
    for (let r = 0; r < outerRunnerXs.length; r++) {
      design.parts.push({
        id: `desk-apron-drawer-runner-${r === 0 ? "left" : "right"}`,
        nameZh: `抽屜跑條（${r === 0 ? "左" : "右"}）`,
        nameEn: `Drawer runner (${r === 0 ? "left" : "right"})`,
        material: input.material,
        grainDirection: "length",
        visible: { length: runnerLen, width: apronWidth, thickness: apronThickness },
        origin: { x: outerRunnerXs[r], y: apronY, z: runnerCenterZ },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  // 後飾遮腿板（modesty panel）
  if (withModestyPanel) {
    design.parts.push({
      id: "modesty-panel",
      nameZh: "後飾遮腿板",
      nameEn: "Modesty panel",
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
