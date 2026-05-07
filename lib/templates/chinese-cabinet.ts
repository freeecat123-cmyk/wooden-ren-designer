import type { FurnitureDesign, FurnitureTemplate, OptionSpec, Part } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { applyStandardChecks } from "./_validators";

/**
 * 中式方角櫃（Chinese square-corner cabinet）
 *
 * 結構：明清家具典型「邊抹板心」做法（frame-and-panel）。
 * - 4 立柱（角柱）：4 隻方料貫穿全高，當每一面的左右邊柱
 * - 每一面（左/右側、背面、門面）= 上抹 + 下抹 + 板心（嵌入框內側槽）
 *   立柱本身充當邊柱，不另畫
 * - 頂蓋：1 片實木板，邊緣略外伸
 * - 底框：4 條底抹圍成底箱，承層板
 * - 牙條：直線素牙，封底框下緣
 * - 內部水平層板（dividers）依 layerCount-1 排列
 * - 每層功用可設：對開門 / 抽屜 / 開放層板
 *
 * 接合：框角全用 shouldered tenon；板心浮放於框內槽（不黏死，
 * 讓木材吐縮不爆裂）；立柱跟頂底抹用通榫 + 暗銷（傳統明式做法）。
 */

const LAYER_TYPE_CHOICES = [
  { value: "door", label: "門（對開）" },
  { value: "drawer", label: "抽屜" },
  { value: "shelf", label: "開放層板" },
];

/**
 * 配置預設：一鍵套用常見中式櫃形 layer 配置（蓋過個別 layerNType 設定）
 * - bookshelf 書櫃：5 層全開放層板，放書展示
 * - cupboard  碗櫥：上下 2 門 + 中間 1 抽屜，廚房 / 餐廳收納
 * - tea-cabinet 茶櫃：抽屜 + 門 + 層板，茶具收納
 * - shrine 神桌邊櫃：4 層 抽屜 + 雙門上下 + 頂層 shelf，較高、上半封閉放供品香爐
 * - custom 自訂：依使用者 layer1-5 選擇
 */
const CABINET_PRESET_LAYERS: Record<string, string[]> = {
  bookshelf: ["shelf", "shelf", "shelf", "shelf", "shelf"],
  cupboard: ["door", "drawer", "door"],
  // 茶櫃：傳統多抽屜分裝茶葉/茶罐 + 上方展示層板
  "tea-cabinet": ["drawer", "drawer", "door", "shelf"],
  shrine: ["drawer", "door", "door", "shelf"],
};

export const chineseCabinetOptions: OptionSpec[] = [
  // 配置預設（最頂端，影響後續 layer 設定）
  { group: "leg", type: "select", key: "cabinetPreset", label: "配置預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（依下方層配置）" },
    { value: "bookshelf", label: "書櫃（5 層全開放）" },
    { value: "cupboard", label: "碗櫥（門 + 抽屜 + 門）" },
    { value: "tea-cabinet", label: "茶櫃（抽屜 + 門 + 層板）" },
    { value: "shrine", label: "神桌邊櫃（抽屜 + 門 + 層板）" },
  ], help: "選擇預設可一鍵套用層配置，會蓋過下方層設定" },
  // 比例風格（一鍵切換明清整體比例）
  { group: "leg", type: "select", key: "proportionStyle", label: "比例風格", defaultValue: "ming", choices: [
    { value: "ming", label: "明式（瘦高 H:W ≈ 1.8）" },
    { value: "qing", label: "清式（矮寬 H:W ≈ 1.2）" },
    { value: "free", label: "自訂（依整體尺寸輸入）" },
  ], help: "明式瘦高典雅、清式矮寬厚實。自訂 = 你輸入的寬深高比例" },
  // 立柱
  { group: "leg", type: "number", key: "postSize", label: "立柱粗 (mm)", defaultValue: 40, min: 30, max: 60, step: 1, unit: "mm" },
  { group: "leg", type: "select", key: "postEndStyle", label: "立柱頂端", defaultValue: "flush", choices: [
    { value: "flush", label: "平頂（隱藏）" },
    { value: "exposedTenon", label: "露明榫（裝飾）" },
  ], help: "露明榫 = 立柱頂榫頭穿透頂蓋凸出，明清炫技做法" },
  { group: "leg", type: "select", key: "legShape", label: "立柱底款", defaultValue: "auto", choices: [
    { value: "auto", label: "依比例風格（明=內翻馬蹄、清=外翻馬蹄）" },
    { value: "box", label: "直方足（無馬蹄）" },
    { value: "inward-hoof", label: "內翻馬蹄足（明式典型）" },
    { value: "outward-hoof", label: "外翻馬蹄足（清式厚實）" },
  ], help: "馬蹄足 = 明清家具靈魂——立柱底端腳趾朝內/外翻起" },
  { group: "leg", type: "number", key: "hoofMm", label: "馬蹄高 (mm)", defaultValue: 80, min: 50, max: 140, step: 5, unit: "mm", help: "馬蹄區段從柱底往上的高度", dependsOn: { key: "legShape", oneOf: ["auto", "inward-hoof", "outward-hoof"] } },
  { group: "leg", type: "number", key: "hoofScale", label: "馬蹄外撇倍率", defaultValue: 1.35, min: 1.05, max: 1.6, step: 0.05, help: "腳趾相對直料寬的倍率（1=不撇、1.5=撇半倍）", dependsOn: { key: "legShape", oneOf: ["auto", "inward-hoof", "outward-hoof"] } },
  // 背板
  { group: "apron", type: "select", key: "backPanelStyle", label: "背板樣式", defaultValue: "framed", choices: [
    { value: "framed", label: "框板（上下抹+板心）" },
    { value: "singleBoard", label: "整片實木板" },
  ], help: "框板 = 傳統明式做法，整片 = 簡化做法" },
  // 板心樣式
  { group: "apron", type: "select", key: "panelStyle", label: "板心樣式", defaultValue: "flat", choices: [
    { value: "flat", label: "平板心" },
    { value: "raised", label: "凸面板心（中央凸起 5mm）" },
  ], help: "凸面板心 = 板心邊緣斜削、中央凸起，視覺層次" },
  // 邊抹（rails）
  { group: "apron", type: "number", key: "railWidth", label: "邊抹寬 (mm)", defaultValue: 50, min: 35, max: 80, step: 5, unit: "mm", help: "頂底抹 / 內部水平分隔板的高度" },
  { group: "apron", type: "number", key: "railThickness", label: "邊抹厚 (mm)", defaultValue: 25, min: 18, max: 35, step: 1, unit: "mm" },
  // 板心
  { group: "apron", type: "number", key: "panelThickness", label: "板心厚 (mm)", defaultValue: 12, min: 8, max: 18, step: 1, unit: "mm", help: "嵌入框內側槽，浮放（不黏死讓木材吐縮）" },
  // 頂蓋
  { group: "top", type: "number", key: "topThickness", label: "頂蓋厚 (mm)", defaultValue: 22, min: 18, max: 35, step: 1, unit: "mm" },
  { group: "top", type: "number", key: "topOverhang", label: "頂蓋外伸 (mm)", defaultValue: 20, min: 0, max: 40, step: 5, unit: "mm", help: "頂蓋四周外伸量" },
  // 牙條
  { group: "stretcher", type: "number", key: "skirtHeight", label: "牙條高 (mm)", defaultValue: 60, min: 30, max: 120, step: 5, unit: "mm", help: "底框下方裝飾牙條" },
  { group: "stretcher", type: "number", key: "skirtThickness", label: "牙條厚 (mm)", defaultValue: 18, min: 12, max: 25, step: 1, unit: "mm" },
  { group: "stretcher", type: "select", key: "skirtStyle", label: "牙條樣式", defaultValue: "auto", choices: [
    { value: "auto", label: "依比例風格（明=壼門、清=雲頭）" },
    { value: "straight", label: "直線素牙（最簡）" },
    { value: "arched", label: "壼門（底邊向下凹弧）" },
    { value: "cloud-head", label: "雲頭（上下都起翹）" },
  ], help: "明清家具靈魂裝飾——壼門/雲頭比直素牙更有「中式」感" },
  { group: "stretcher", type: "select", key: "spandrelStyle", label: "牙頭裝飾", defaultValue: "none", choices: [
    { value: "none", label: "無牙頭" },
    { value: "cloud-head", label: "雲頭牙頭（清式厚實）" },
    { value: "ruyi", label: "如意牙頭（明式典雅）" },
  ], help: "牙頭 = 立柱跟牙條交角的小三角雕飾，雲頭/如意是中式櫃靈魂" },
  { group: "stretcher", type: "number", key: "spandrelSize", label: "牙頭尺寸 (mm)", defaultValue: 80, min: 50, max: 160, step: 5, unit: "mm", help: "牙頭沿立柱往牙條延伸的長度（高度跟著牙條走）", dependsOn: { key: "spandrelStyle", oneOf: ["cloud-head", "ruyi"] } },
  // 層數（1-8）
  { group: "stretcher", type: "number", key: "layerCount", label: "分層數", defaultValue: 3, min: 1, max: 8, step: 1, help: "由下往上 1, 2, 3...，最多 8 層" },
  { group: "stretcher", type: "select", key: "layer1Type", label: "第 1 層（最下層）", defaultValue: "drawer", choices: LAYER_TYPE_CHOICES },
  { group: "stretcher", type: "select", key: "layer2Type", label: "第 2 層", defaultValue: "door", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [2, 3, 4, 5, 6, 7, 8] } },
  { group: "stretcher", type: "select", key: "layer3Type", label: "第 3 層", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [3, 4, 5, 6, 7, 8] } },
  { group: "stretcher", type: "select", key: "layer4Type", label: "第 4 層", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [4, 5, 6, 7, 8] } },
  { group: "stretcher", type: "select", key: "layer5Type", label: "第 5 層", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [5, 6, 7, 8] } },
  { group: "stretcher", type: "select", key: "layer6Type", label: "第 6 層", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [6, 7, 8] } },
  { group: "stretcher", type: "select", key: "layer7Type", label: "第 7 層", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [7, 8] } },
  { group: "stretcher", type: "select", key: "layer8Type", label: "第 8 層（最上層）", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [8] } },
  // 各層高度（mm，0 = 自動等分，> 0 = 指定該層高度）
  { group: "stretcher", type: "number", key: "layer1HeightMm", label: "第 1 層高 (mm)", defaultValue: 0, min: 0, max: 800, step: 10, unit: "mm", help: "0 = 自動等分；其他層加總過大會自動縮放" },
  { group: "stretcher", type: "number", key: "layer2HeightMm", label: "第 2 層高 (mm)", defaultValue: 0, min: 0, max: 800, step: 10, unit: "mm", dependsOn: { key: "layerCount", oneOf: [2, 3, 4, 5, 6, 7, 8] } },
  { group: "stretcher", type: "number", key: "layer3HeightMm", label: "第 3 層高 (mm)", defaultValue: 0, min: 0, max: 800, step: 10, unit: "mm", dependsOn: { key: "layerCount", oneOf: [3, 4, 5, 6, 7, 8] } },
  { group: "stretcher", type: "number", key: "layer4HeightMm", label: "第 4 層高 (mm)", defaultValue: 0, min: 0, max: 800, step: 10, unit: "mm", dependsOn: { key: "layerCount", oneOf: [4, 5, 6, 7, 8] } },
  { group: "stretcher", type: "number", key: "layer5HeightMm", label: "第 5 層高 (mm)", defaultValue: 0, min: 0, max: 800, step: 10, unit: "mm", dependsOn: { key: "layerCount", oneOf: [5, 6, 7, 8] } },
  { group: "stretcher", type: "number", key: "layer6HeightMm", label: "第 6 層高 (mm)", defaultValue: 0, min: 0, max: 800, step: 10, unit: "mm", dependsOn: { key: "layerCount", oneOf: [6, 7, 8] } },
  { group: "stretcher", type: "number", key: "layer7HeightMm", label: "第 7 層高 (mm)", defaultValue: 0, min: 0, max: 800, step: 10, unit: "mm", dependsOn: { key: "layerCount", oneOf: [7, 8] } },
  { group: "stretcher", type: "number", key: "layer8HeightMm", label: "第 8 層高 (mm)", defaultValue: 0, min: 0, max: 800, step: 10, unit: "mm", dependsOn: { key: "layerCount", oneOf: [8] } },
  // 門細部
  { group: "stretcher", type: "number", key: "doorGap", label: "門中縫 (mm)", defaultValue: 3, min: 1, max: 8, step: 1, unit: "mm", help: "雙開門中央縫隙寬度" },
  { group: "stretcher", type: "select", key: "doorStyle", label: "門板樣式", defaultValue: "solid", choices: [
    { value: "solid", label: "整片實木板" },
    { value: "lattice-cross", label: "格扇門：田字格（橫直櫺）" },
    { value: "lattice-lantern", label: "格扇門：燈籠錦（米字斜櫺）" },
    { value: "glass", label: "玻璃門（木框 + 中央玻璃片）" },
    { value: "glass-lattice", label: "玻璃格扇門（田字格木櫺後襯玻璃）" },
  ], help: "格扇門 = 明清書櫃/博古架靈魂；玻璃門 = 博古架/展示櫃常見" },
  { group: "stretcher", type: "select", key: "doorPullType", label: "門拉手", defaultValue: "round-brass", choices: [
    { value: "none", label: "無" },
    { value: "round-brass", label: "圓銅環" },
    { value: "strip", label: "長條銅片" },
  ], help: "銅件是中式櫃靈魂裝飾" },
  // 抽屜細部
  { group: "stretcher", type: "select", key: "drawerSplit", label: "抽屜分格", defaultValue: "single", choices: [
    { value: "single", label: "單格" },
    { value: "double", label: "雙格（中央分隔）" },
    { value: "triple", label: "三格" },
  ], help: "抽屜面分割線（多格抽屜常見）" },
  { group: "stretcher", type: "select", key: "drawerPullType", label: "抽屜拉手", defaultValue: "round-brass", choices: [
    { value: "none", label: "無" },
    { value: "round-brass", label: "圓銅環" },
    { value: "strip", label: "長條銅片" },
  ] },
  { group: "stretcher", type: "select", key: "drawerInternalGrid", label: "抽屜內格", defaultValue: "none", choices: [
    { value: "none", label: "不分格（單格）" },
    { value: "divided-2", label: "縱向分隔（2 格）" },
    { value: "divided-4", label: "縱橫分隔（田字 4 格）" },
  ], help: "抽屜盒內加分隔板，從上方俯視看得到（茶葉/茶罐/筆收納分裝）" },
  { group: "stretcher", type: "select", key: "hiddenDrawerLayer", label: "暗抽層", defaultValue: "none", choices: [
    { value: "none", label: "無暗抽" },
    { value: "1", label: "第 1 層為暗抽" },
    { value: "2", label: "第 2 層為暗抽" },
    { value: "3", label: "第 3 層為暗抽" },
    { value: "4", label: "第 4 層為暗抽" },
    { value: "5", label: "第 5 層為暗抽" },
    { value: "6", label: "第 6 層為暗抽" },
    { value: "7", label: "第 7 層為暗抽" },
    { value: "8", label: "第 8 層為暗抽" },
  ], help: "暗抽 = 抽屜面跟相鄰門板齊平+無拉手+無分格（外觀看不出是抽屜）" },
  // 開放層板細部
  { group: "stretcher", type: "number", key: "shelfExtraCount", label: "層內活動板數", defaultValue: 0, min: 0, max: 3, step: 1, help: "每個 shelf 層內額外加幾片活動層板" },
];

export const chineseCabinet: FurnitureTemplate = (input): FurnitureDesign => {
  const o = chineseCabinetOptions;
  const { length, width, height, material } = input;
  const proportionStyle = getOption<string>(input, opt(o, "proportionStyle"));
  const postSizeRaw = getOption<number>(input, opt(o, "postSize"));
  const railWidthRaw = getOption<number>(input, opt(o, "railWidth"));
  const railThickness = getOption<number>(input, opt(o, "railThickness"));
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const topOverhang = getOption<number>(input, opt(o, "topOverhang"));
  const skirtHeightRaw = getOption<number>(input, opt(o, "skirtHeight"));
  // proportionStyle 覆寫關鍵比例（除非 free）
  const postSize = proportionStyle === "ming" ? 35 : proportionStyle === "qing" ? 50 : postSizeRaw;
  const railWidth = proportionStyle === "ming" ? 45 : proportionStyle === "qing" ? 65 : railWidthRaw;
  const skirtHeight = proportionStyle === "ming" ? 50 : proportionStyle === "qing" ? 80 : skirtHeightRaw;
  const skirtThickness = getOption<number>(input, opt(o, "skirtThickness"));
  const skirtStyleRaw = getOption<string>(input, opt(o, "skirtStyle"));
  const spandrelStyle = getOption<string>(input, opt(o, "spandrelStyle"));
  const spandrelSize = getOption<number>(input, opt(o, "spandrelSize"));
  // skirtStyle="auto" → 依 proportionStyle 帶（明式壼門、清式雲頭、free 直素牙）
  const skirtStyle: string =
    skirtStyleRaw === "auto"
      ? proportionStyle === "ming"
        ? "arched"
        : proportionStyle === "qing"
          ? "cloud-head"
          : "straight"
      : skirtStyleRaw;
  const cabinetPreset = getOption<string>(input, opt(o, "cabinetPreset"));
  const postEndStyle = getOption<string>(input, opt(o, "postEndStyle"));
  const legShapeRaw = getOption<string>(input, opt(o, "legShape"));
  const hoofMmRaw = getOption<number>(input, opt(o, "hoofMm"));
  const hoofScale = getOption<number>(input, opt(o, "hoofScale"));
  // legShape="auto" → 依 proportionStyle：ming=內翻、qing=外翻、free=直方
  const legShape: "box" | "inward-hoof" | "outward-hoof" =
    legShapeRaw === "auto"
      ? proportionStyle === "ming"
        ? "inward-hoof"
        : proportionStyle === "qing"
          ? "outward-hoof"
          : "box"
      : (legShapeRaw as "box" | "inward-hoof" | "outward-hoof");
  // 馬蹄高度不能超過牙條 + 一些餘量，否則馬蹄頂頂到下抹（牙條 + railWidth）
  const hoofMm = legShape === "box" ? 0 : Math.min(hoofMmRaw, skirtHeight + railWidth - 10);
  const backPanelStyle = getOption<string>(input, opt(o, "backPanelStyle"));
  const panelStyle = getOption<string>(input, opt(o, "panelStyle"));
  const doorGap = getOption<number>(input, opt(o, "doorGap"));
  const doorPullType = getOption<string>(input, opt(o, "doorPullType"));
  const doorStyle = getOption<string>(input, opt(o, "doorStyle"));
  const drawerSplit = getOption<string>(input, opt(o, "drawerSplit"));
  const drawerPullType = getOption<string>(input, opt(o, "drawerPullType"));
  const drawerInternalGrid = getOption<string>(input, opt(o, "drawerInternalGrid"));
  const hiddenDrawerLayer = getOption<string>(input, opt(o, "hiddenDrawerLayer"));
  const shelfExtraCount = getOption<number>(input, opt(o, "shelfExtraCount"));
  const userLayerCount = getOption<number>(input, opt(o, "layerCount"));
  const userLayerTypes = [
    getOption<string>(input, opt(o, "layer1Type")),
    getOption<string>(input, opt(o, "layer2Type")),
    getOption<string>(input, opt(o, "layer3Type")),
    getOption<string>(input, opt(o, "layer4Type")),
    getOption<string>(input, opt(o, "layer5Type")),
    getOption<string>(input, opt(o, "layer6Type")),
    getOption<string>(input, opt(o, "layer7Type")),
    getOption<string>(input, opt(o, "layer8Type")),
  ];
  const userLayerHeightsMm = [
    getOption<number>(input, opt(o, "layer1HeightMm")),
    getOption<number>(input, opt(o, "layer2HeightMm")),
    getOption<number>(input, opt(o, "layer3HeightMm")),
    getOption<number>(input, opt(o, "layer4HeightMm")),
    getOption<number>(input, opt(o, "layer5HeightMm")),
    getOption<number>(input, opt(o, "layer6HeightMm")),
    getOption<number>(input, opt(o, "layer7HeightMm")),
    getOption<number>(input, opt(o, "layer8HeightMm")),
  ];
  // cabinetPreset 提供 layer types 範本，user 永遠可以調 layerCount 蓋過 preset 層數
  // - layerCount > preset 長度：用 preset + user 補的 layerXType
  // - layerCount < preset 長度：截 preset 前 N 個
  // - layerCount === preset 長度：完全用 preset
  const presetConfig = CABINET_PRESET_LAYERS[cabinetPreset];
  const layerCount = userLayerCount;
  const layerTypes: string[] = presetConfig
    ? presetConfig.length >= layerCount
      ? presetConfig.slice(0, layerCount)
      : [...presetConfig, ...userLayerTypes.slice(presetConfig.length, layerCount)]
    : userLayerTypes.slice(0, layerCount);
  // 各層高度 mm — 不論 preset 或 custom 都生效（user 想手動就手動）
  // 0 = 自動分（取剩餘空間平均）；> 0 = 指定值
  const layerHeightsRaw = userLayerHeightsMm.slice(0, layerCount);

  // 幾何規劃：4 立柱接地貫穿全高，牙條外掛在立柱底外側（傳統明式）
  // 立柱：Y [0, height − topThickness]
  // 牙條：Y [0, skirtHeight]，跟立柱底外側共存
  // 上下抹：上抹底面 = postTopY − railWidth；下抹底面 = skirtHeight（牙條頂）
  // 內部空間 = 上下抹之間
  const postTopY = height - topThickness;
  const postBottomY = 0;
  const postHeight = postTopY;
  // 4 立柱位置：±(length/2 - postSize/2), ±(width/2 - postSize/2)
  const postX = length / 2 - postSize / 2;
  const postZ = width / 2 - postSize / 2;
  // 內部開放空間：頂底抹之間（下抹仍在牙條頂上方）
  const innerTopY = postTopY - railWidth;  // 上抹底面
  const innerBottomY = skirtHeight + railWidth;  // 下抹頂面（牙條頂 + railWidth）
  const innerHeight = innerTopY - innerBottomY;
  // 每層高度：0 取剩餘平均，非 0 用指定值；總和過 innerHeight 自動縮放
  const setSum = layerHeightsRaw.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const autoCount = layerHeightsRaw.filter(h => h <= 0).length;
  const remaining = Math.max(0, innerHeight - setSum);
  const autoHeight = autoCount > 0 ? remaining / autoCount : 0;
  let layerHeights = layerHeightsRaw.map(h => h > 0 ? h : autoHeight);
  // 防呆：如果指定值總和超過 innerHeight，整體縮放到 innerHeight
  const totalH = layerHeights.reduce((a, b) => a + b, 0);
  if (totalH > innerHeight) {
    const scale = innerHeight / totalH;
    layerHeights = layerHeights.map(h => h * scale);
  } else if (totalH < innerHeight && autoCount === 0) {
    // 全部指定但加起來不夠，按比例放大
    const scale = innerHeight / totalH;
    layerHeights = layerHeights.map(h => h * scale);
  }
  // 累積：每層底端 Y 位置 = innerBottomY + 前 i 層高度之和
  const layerBottomYs: number[] = [];
  let acc = innerBottomY;
  for (const h of layerHeights) {
    layerBottomYs.push(acc);
    acc += h;
  }

  const parts: Part[] = [];

  // ── 頂蓋（外伸）
  // postEndStyle="exposedTenon" 時頂蓋有 4 個通孔接立柱頂榫
  const topMortises = postEndStyle === "exposedTenon"
    ? [-1, 1].flatMap(sx => [-1, 1].map(sz => ({
        origin: { x: sx * postX, y: 0, z: sz * postZ },
        depth: topThickness,
        length: Math.round(postSize * 0.5),
        width: Math.round(postSize * 0.5),
        through: true,
      })))
    : [];
  parts.push({
    id: "top",
    nameZh: "頂蓋",
    material,
    grainDirection: "length",
    visible: { length: length + topOverhang * 2, width: width + topOverhang * 2, thickness: topThickness },
    origin: { x: 0, y: postTopY, z: 0 },
    tenons: [],
    mortises: topMortises,
  });

  // 榫接尺寸（明式攢邊打槽 / 悶榫接腳）
  const tenonLen = Math.min(20, Math.round(postSize / 2 - 2));  // 進入立柱深度
  const tenonW = Math.max(20, railWidth - 16);  // 留 8mm 肩
  const tenonT = Math.max(6, Math.round(railThickness / 3));   // ~8mm 厚

  // ── 4 立柱（含 4 個 mortise 接 rail：上抹/下抹 × 側面/前後面）
  // postEndStyle="exposedTenon" 立柱頂榫頭穿透頂蓋凸出 18mm（明清炫技）
  const postExposedTenon = postEndStyle === "exposedTenon"
    ? [{ position: "top" as const, type: "through-tenon" as const, length: topThickness + 18, width: Math.round(postSize * 0.5), thickness: Math.round(postSize * 0.5) }]
    : [];
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const fbId = sz < 0 ? "front" : "back";
      const lrId = sx < 0 ? "left" : "right";
      const fbLabel = sz < 0 ? "前" : "後";
      const lrLabel = sx < 0 ? "左" : "右";
      // 上抹/下抹 Y 中心位置（rail 中心 Y）
      const upperRailCY = postTopY - railWidth / 2;
      const lowerRailCY = skirtHeight + railWidth / 2;
      // 馬蹄足朝向：outward = 朝外（dirX/Z = sx/sz）；inward = 朝中軸（-sx/-sz）
      const hoofDirSign: -1 | 1 = legShape === "outward-hoof" ? 1 : -1;
      const postShape: Part["shape"] | undefined =
        legShape === "box"
          ? undefined
          : {
              kind: "hoof",
              hoofMm,
              hoofScale,
              dirX: (sx * hoofDirSign) as -1 | 1,
              dirZ: (sz * hoofDirSign) as -1 | 1,
            };
      parts.push({
        id: `post-${fbId}-${lrId}`,
        nameZh: `${fbLabel}${lrLabel}立柱`,
        material,
        grainDirection: "length",
        visible: { length: postSize, width: postSize, thickness: postHeight },
        origin: { x: sx * postX, y: postBottomY, z: sz * postZ },
        ...(postShape ? { shape: postShape } : {}),
        tenons: postExposedTenon,
        mortises: [
          // 側面 rail 進立柱（Z 內面，朝對面立柱方向）
          { origin: { x: 0, y: upperRailCY, z: -sz * postSize / 2 }, depth: tenonLen, length: tenonW, width: tenonT, through: false },
          { origin: { x: 0, y: lowerRailCY, z: -sz * postSize / 2 }, depth: tenonLen, length: tenonW, width: tenonT, through: false },
          // 前/後 rail 進立柱（X 內面，朝對面立柱方向）
          { origin: { x: -sx * postSize / 2, y: upperRailCY, z: 0 }, depth: tenonLen, length: tenonW, width: tenonT, through: false },
          { origin: { x: -sx * postSize / 2, y: lowerRailCY, z: 0 }, depth: tenonLen, length: tenonW, width: tenonT, through: false },
        ],
      });
    }
  }

  // ── 6 面 frame-and-panel：每面 上抹 + 下抹 + 板心
  // 立柱當邊柱用（4 個立柱橫跨 4 個面的邊柱角色）
  // 上抹/下抹的位置：頂底位置 + 左右側面 + 前面（門框）+ 背面
  // 為簡化：頂面（頂蓋）已是單片，不做 frame；底面（底框）做 4 條 rail 圍底箱
  // 側面（左/右/前/後）：每面在 postTopY 跟 postBottomY 各加 1 條水平 rail
  // 板心：在 4 條 rail 之間（同立柱間）

  // 抹板（rail）端頭跟立柱外面齊平（明式攢邊做法）
  // 跨度 = 2 × (postX + postSize/2) = 立柱外面到立柱外面 = 整個櫃子寬度
  const railLenX = 2 * (postX + postSize / 2);
  const railLenZ = 2 * (postZ + postSize / 2);
  // 板心 / 內部 divider 留在兩立柱內面之間（不延伸進立柱）
  const innerSpanX = 2 * (postX - postSize / 2);
  const innerSpanZ = 2 * (postZ - postSize / 2);
  const panelInnerW_X = innerSpanX - 10;  // 板心比內面短 5mm 兩邊（嵌入 rail 槽 5mm）
  const panelInnerW_Z = innerSpanZ - 10;
  // 板心 height = 上下抹之間 + 嵌入上下槽各 5mm

  // 上抹/下抹位置（除頂蓋外，櫃身的 top/bottom rail）
  // 上抹頂面 = postTopY，下緣 = postTopY - railWidth
  // 下抹底邊 = skirtHeight（牙條頂），頂面 = skirtHeight + railWidth
  const upperRailY = postTopY - railWidth;
  const lowerRailY = skirtHeight;
  // panel 高度 = 上下抹之間 + 嵌入上下槽各 5mm
  const panelInnerH = upperRailY - lowerRailY - railWidth + 10;

  // 明式邊抹板心：rail / panel 跟立柱「外面共面」（嵌入立柱、外面齊平）
  // rail 中心 = 立柱外面 - rail 厚/2（rail 在立柱範圍內偏外側）
  // panel 中心 = rail 中心（嵌入 rail 內側槽）
  // 立柱外面 X = postX + postSize/2，所以 rail center X = postX + postSize/2 - railThickness/2
  const sideRailOffsetX = postX + postSize / 2 - railThickness / 2;
  const fbRailOffsetZ = postZ + postSize / 2 - railThickness / 2;

  // visible 軸慣例：length → X、width → Z、thickness → Y（高度）
  // 對沿 Z 軸延伸的 rail（左/右側上下抹）：X=厚度、Y=高度、Z=長度
  //   → visible: length=railThickness, width=railLenZ, thickness=railWidth
  // 對沿 X 軸延伸的 rail（前/後上下抹）：X=長度、Y=高度、Z=厚度
  //   → visible: length=railLenX, width=railThickness, thickness=railWidth
  // 對立面 panel：高度沿 Y、長度沿延伸軸、厚度沿 face normal

  // ── 左/右側面 frame（沿 Z 延伸）
  for (const sx of [-1, 1] as const) {
    const lrId = sx < 0 ? "left" : "right";
    const lrLabel = sx < 0 ? "左" : "右";
    // 上抹
    parts.push({
      id: `${lrId}-side-upper-rail`,
      nameZh: `${lrLabel}側上抹`,
      material,
      grainDirection: "length",
      visible: { length: railThickness, width: railLenZ, thickness: railWidth },
      origin: { x: sx * sideRailOffsetX, y: upperRailY, z: 0 },
      tenons: [
        { position: "left", type: "shouldered-tenon", length: tenonLen, width: tenonW, thickness: tenonT },
        { position: "right", type: "shouldered-tenon", length: tenonLen, width: tenonW, thickness: tenonT },
      ],
      mortises: [],
    });
    // 下抹
    parts.push({
      id: `${lrId}-side-lower-rail`,
      nameZh: `${lrLabel}側下抹`,
      material,
      grainDirection: "length",
      visible: { length: railThickness, width: railLenZ, thickness: railWidth },
      origin: { x: sx * sideRailOffsetX, y: lowerRailY, z: 0 },
      tenons: [
        { position: "left", type: "shouldered-tenon", length: tenonLen, width: tenonW, thickness: tenonT },
        { position: "right", type: "shouldered-tenon", length: tenonLen, width: tenonW, thickness: tenonT },
      ],
      mortises: [],
    });
    // 板心
    parts.push({
      id: `${lrId}-side-panel`,
      nameZh: `${lrLabel}側板心`,
      material,
      grainDirection: "length",
      visible: { length: panelThickness, width: panelInnerW_Z, thickness: panelInnerH },
      origin: { x: sx * sideRailOffsetX, y: lowerRailY + railWidth - 5, z: 0 },
      tenons: [],
      mortises: [],
    });
    // raised 模式：加中央凸起 plateau（小一圈、外側突出 15mm）
    if (panelStyle === "raised") {
      const plateauMargin = 40;  // plateau 比 panel 縮小 40mm 兩邊
      const plateauThickness = 15;
      parts.push({
        id: `${lrId}-side-panel-raised`,
        nameZh: `${lrLabel}側板心凸面`,
        material,
        grainDirection: "length",
        visible: {
          length: plateauThickness,
          width: panelInnerW_Z - plateauMargin * 2,
          thickness: panelInnerH - plateauMargin * 2,
        },
        origin: {
          x: sx * (sideRailOffsetX + panelThickness / 2 + plateauThickness / 2),
          y: lowerRailY + railWidth - 5 + plateauMargin,
          z: 0,
        },
        tenons: [],
        mortises: [],
      });
    }
  }

  // ── 背面 frame（沿 X 延伸）
  const fbRailTenons = [
    { position: "start" as const, type: "shouldered-tenon" as const, length: tenonLen, width: tenonW, thickness: tenonT },
    { position: "end" as const, type: "shouldered-tenon" as const, length: tenonLen, width: tenonW, thickness: tenonT },
  ];
  // singleBoard 模式不畫上下抹，整片背板取代框板結構
  if (backPanelStyle !== "singleBoard") {
    parts.push({
      id: "back-upper-rail",
      nameZh: "背面上抹",
      material,
      grainDirection: "length",
      visible: { length: railLenX, width: railThickness, thickness: railWidth },
      origin: { x: 0, y: upperRailY, z: fbRailOffsetZ },
      tenons: fbRailTenons,
      mortises: [],
    });
    parts.push({
      id: "back-lower-rail",
      nameZh: "背面下抹",
      material,
      grainDirection: "length",
      visible: { length: railLenX, width: railThickness, thickness: railWidth },
      origin: { x: 0, y: lowerRailY, z: fbRailOffsetZ },
      tenons: fbRailTenons,
      mortises: [],
    });
  }
  // 背面板心：framed = 框板嵌入（一般板心高度 panelInnerH）；singleBoard = 整片實木板蓋住整個背面（從上抹到下抹）
  if (backPanelStyle === "singleBoard") {
    // 整片背板：跨越 4 立柱內側，從 lower rail 頂面到 upper rail 底面
    parts.push({
      id: "back-panel",
      nameZh: "背面整片板",
      material,
      grainDirection: "length",
      visible: { length: innerSpanX, width: panelThickness, thickness: upperRailY - (lowerRailY + railWidth) },
      origin: { x: 0, y: lowerRailY + railWidth, z: fbRailOffsetZ },
      tenons: [],
      mortises: [],
    });
  } else {
    // 框板浮芯（傳統做法）：panel 嵌入上下抹槽
    parts.push({
      id: "back-panel",
      nameZh: "背面板心",
      material,
      grainDirection: "length",
      visible: { length: panelInnerW_X, width: panelThickness, thickness: panelInnerH },
      origin: { x: 0, y: lowerRailY + railWidth - 5, z: fbRailOffsetZ },
      tenons: [],
      mortises: [],
    });
    if (panelStyle === "raised") {
      const plateauMargin = 40;
      const plateauThickness = 15;
      parts.push({
        id: "back-panel-raised",
        nameZh: "背面板心凸面",
        material,
        grainDirection: "length",
        visible: {
          length: panelInnerW_X - plateauMargin * 2,
          width: plateauThickness,
          thickness: panelInnerH - plateauMargin * 2,
        },
        origin: { x: 0, y: lowerRailY + railWidth - 5 + plateauMargin, z: fbRailOffsetZ + panelThickness / 2 + plateauThickness / 2 },
        tenons: [],
        mortises: [],
      });
    }
  }

  // ── 前面 frame
  parts.push({
    id: "front-upper-rail",
    nameZh: "前面上抹",
    material,
    grainDirection: "length",
    visible: { length: railLenX, width: railThickness, thickness: railWidth },
    origin: { x: 0, y: upperRailY, z: -(fbRailOffsetZ) },
    tenons: fbRailTenons,
    mortises: [],
  });
  parts.push({
    id: "front-lower-rail",
    nameZh: "前面下抹",
    material,
    grainDirection: "length",
    visible: { length: railLenX, width: railThickness, thickness: railWidth },
    origin: { x: 0, y: lowerRailY, z: -(fbRailOffsetZ) },
    tenons: fbRailTenons,
    mortises: [],
  });

  // ── 內部水平分隔板（dividers between layers）
  // layerCount 層 → 需要 (layerCount - 1) 條分隔板
  // 第 i/i+1 層分隔板 Y = layerBottomYs[i+1] - railWidth/2
  for (let i = 0; i < layerCount - 1; i++) {
    const dividerY = layerBottomYs[i + 1] - railWidth / 2;
    parts.push({
      id: `divider-${i + 1}`,
      nameZh: `第 ${i + 1}/${i + 2} 層分隔板`,
      material,
      grainDirection: "length",
      // 水平層板：X 方向 = 兩立柱內面 innerSpanX, Z 方向 innerSpanZ, Y 厚 railWidth
      visible: { length: innerSpanX, width: innerSpanZ, thickness: railWidth },
      origin: { x: 0, y: dividerY, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 每層功用內容
  for (let i = 0; i < layerCount; i++) {
    const layerType = layerTypes[i];
    const layerBottomY = layerBottomYs[i];
    const thisLayerHeight = layerHeights[i];
    const layerTopY = layerBottomY + thisLayerHeight;
    const layerCenterY = (layerBottomY + layerTopY) / 2;

    if (layerType === "door") {
      // 對開門：2 扇 + 拉手
      const doorWidth = (innerSpanX - doorGap) / 2;
      const doorHeight = thisLayerHeight - 4;  // 上下各 2mm 隙
      const doorThickness = railThickness;
      const doorFrontZ = -(fbRailOffsetZ);
      // 格扇櫺條尺寸（凸貼門面 5mm）
      const muntinT = 8;        // 櫺條厚度（伸出門面）
      const muntinW = 18;       // 櫺條寬度
      const muntinFrontZ = doorFrontZ - doorThickness / 2 - muntinT / 2;  // 凸貼 -Z 面
      const isGlassDoor = doorStyle === "glass" || doorStyle === "glass-lattice";
      const hasOuterFrame = doorStyle === "lattice-cross" || doorStyle === "lattice-lantern" || isGlassDoor;
      const hasCenterCross = doorStyle === "lattice-cross" || doorStyle === "lattice-lantern" || doorStyle === "glass-lattice";
      const hasDiagonals = doorStyle === "lattice-lantern";
      for (const sx of [-1, 1] as const) {
        const lrId = sx < 0 ? "left" : "right";
        const lrLabel = sx < 0 ? "左" : "右";
        const doorCX = sx * (doorWidth / 2 + doorGap / 2);
        // 玻璃門：主板改 visual:"glass" + 厚度 5mm（不計入材料單）
        const glassThickness = 5;
        const mainPanelThickness = isGlassDoor ? glassThickness : doorThickness;
        parts.push({
          id: `layer${i + 1}-${lrId}-door`,
          nameZh: `第 ${i + 1} 層${lrLabel}門${isGlassDoor ? "玻璃片" : ""}`,
          material,
          grainDirection: "length",
          visible: { length: doorWidth, width: mainPanelThickness, thickness: doorHeight },
          origin: { x: doorCX, y: layerCenterY - doorHeight / 2, z: doorFrontZ },
          ...(isGlassDoor ? { visual: "glass" as const } : {}),
          tenons: [],
          mortises: [],
        });
        // raised 凸面板心擴到 solid 門板：lattice / glass 不加（會跟櫺條/玻璃打架）
        if (doorStyle === "solid" && panelStyle === "raised") {
          const plateauMargin = 35;
          const plateauThickness = 12;
          parts.push({
            id: `layer${i + 1}-${lrId}-door-raised`,
            nameZh: `第 ${i + 1} 層${lrLabel}門凸面板`,
            material,
            grainDirection: "length",
            visible: { length: doorWidth - plateauMargin * 2, width: plateauThickness, thickness: doorHeight - plateauMargin * 2 },
            origin: { x: doorCX, y: layerCenterY - (doorHeight - plateauMargin * 2) / 2, z: doorFrontZ - doorThickness / 2 - plateauThickness / 2 },
            tenons: [],
            mortises: [],
          });
        }
        // 格扇門 / 玻璃門：4 邊外框（木框）
        if (hasOuterFrame) {
          const frameInsetX = muntinW / 2;
          const frameInsetY = muntinW / 2;
          // 4 邊外框：上 / 下 / 左 / 右（沿門邊內側）
          const sideY = layerCenterY - doorHeight / 2;
          // 上框
          parts.push({
            id: `layer${i + 1}-${lrId}-door-muntin-top`,
            nameZh: `第 ${i + 1} 層${lrLabel}門上框櫺`,
            material,
            grainDirection: "length",
            visible: { length: doorWidth - muntinW * 2 + 2, width: muntinT, thickness: muntinW },
            origin: { x: doorCX, y: sideY + doorHeight - frameInsetY - muntinW / 2, z: muntinFrontZ },
            tenons: [],
            mortises: [],
          });
          // 下框
          parts.push({
            id: `layer${i + 1}-${lrId}-door-muntin-bot`,
            nameZh: `第 ${i + 1} 層${lrLabel}門下框櫺`,
            material,
            grainDirection: "length",
            visible: { length: doorWidth - muntinW * 2 + 2, width: muntinT, thickness: muntinW },
            origin: { x: doorCX, y: sideY + frameInsetY - muntinW / 2, z: muntinFrontZ },
            tenons: [],
            mortises: [],
          });
          // 左/右框
          for (const sxF of [-1, 1] as const) {
            parts.push({
              id: `layer${i + 1}-${lrId}-door-muntin-${sxF < 0 ? "left" : "right"}`,
              nameZh: `第 ${i + 1} 層${lrLabel}門${sxF < 0 ? "左" : "右"}框櫺`,
              material,
              grainDirection: "length",
              visible: { length: muntinW, width: muntinT, thickness: doorHeight },
              origin: { x: doorCX + sxF * (doorWidth / 2 - frameInsetX - muntinW / 2), y: sideY, z: muntinFrontZ },
              tenons: [],
              mortises: [],
            });
          }
        }
        // 中央十字（橫直櫺）：cross / lantern / glass-lattice 都加
        if (hasCenterCross) {
          const sideY = layerCenterY - doorHeight / 2;
          parts.push({
            id: `layer${i + 1}-${lrId}-door-muntin-hcenter`,
            nameZh: `第 ${i + 1} 層${lrLabel}門橫櫺`,
            material,
            grainDirection: "length",
            visible: { length: doorWidth - muntinW * 2 + 2, width: muntinT, thickness: muntinW },
            origin: { x: doorCX, y: layerCenterY - muntinW / 2, z: muntinFrontZ },
            tenons: [],
            mortises: [],
          });
          parts.push({
            id: `layer${i + 1}-${lrId}-door-muntin-vcenter`,
            nameZh: `第 ${i + 1} 層${lrLabel}門直櫺`,
            material,
            grainDirection: "length",
            visible: { length: muntinW, width: muntinT, thickness: doorHeight - muntinW * 2 + 2 },
            origin: { x: doorCX, y: sideY + muntinW, z: muntinFrontZ },
            tenons: [],
            mortises: [],
          });
        }
        // 燈籠錦：在 cross 基礎上加 4 條 45° 對角櫺條（米字）
        if (hasDiagonals) {
          const innerW = doorWidth - muntinW * 2 + 2;
          const innerH = doorHeight - muntinW * 2 + 2;
          // 對角線從中心放射到 4 角的「半條」櫺條：用 length = sqrt((innerW/2)^2+(innerH/2)^2)
          const halfDiag = Math.sqrt((innerW / 2) ** 2 + (innerH / 2) ** 2);
          const angle = Math.atan2(innerH / 2, innerW / 2);  // 對角線 X-Y 角度
          for (const sxA of [-1, 1] as const) {
            for (const syA of [-1, 1] as const) {
              parts.push({
                id: `layer${i + 1}-${lrId}-door-muntin-diag-${sxA < 0 ? "l" : "r"}${syA < 0 ? "b" : "t"}`,
                nameZh: `第 ${i + 1} 層${lrLabel}門斜櫺`,
                material,
                grainDirection: "length",
                visible: { length: halfDiag, width: muntinT, thickness: muntinW * 0.6 },
                origin: { x: doorCX + sxA * innerW / 4, y: layerCenterY - muntinW * 0.3, z: muntinFrontZ },
                rotation: { x: 0, y: 0, z: sxA * syA * angle },
                tenons: [],
                mortises: [],
              });
            }
          }
        }
        // 門拉手（朝中縫一側 30mm）
        if (doorPullType !== "none") {
          const pullX = sx * (doorGap / 2 + 30);
          const pullY = layerCenterY;
          const pullZ = doorFrontZ - doorThickness / 2 - 4;  // 凸出門面 4mm
          if (doorPullType === "round-brass") {
            // 圓銅環：直徑 30mm 圓盤、高 8mm（凸出門面 4mm 在門外側）
            parts.push({
              id: `layer${i + 1}-${lrId}-door-pull`,
              nameZh: `第 ${i + 1} 層${lrLabel}門拉環`,
              material,
              grainDirection: "length",
              shape: { kind: "round" },
              visible: { length: 30, width: 30, thickness: 8 },
              origin: { x: pullX, y: pullY - 4, z: pullZ },
              tenons: [],
              mortises: [],
            });
          } else {  // strip
            parts.push({
              id: `layer${i + 1}-${lrId}-door-pull`,
              nameZh: `第 ${i + 1} 層${lrLabel}門拉片`,
              material,
              grainDirection: "length",
              visible: { length: 12, width: 6, thickness: 80 },
              origin: { x: pullX, y: pullY - 40, z: pullZ },
              tenons: [],
              mortises: [],
            });
          }
        }
      }
    } else if (layerType === "drawer") {
      // 抽屜：依 drawerSplit 切 1/2/3 格抽屜面 + 抽屜盒
      const isHidden = hiddenDrawerLayer === String(i + 1);
      const drawerGap = 3;
      const drawerWidth = innerSpanX - drawerGap * 2;
      const drawerHeight = thisLayerHeight - 4;
      const drawerThickness = railThickness;
      const drawerFrontZ = -(fbRailOffsetZ);
      // 暗抽強制 single + 無拉手；隱藏抽屜面分割線視覺
      const effectiveSplit = isHidden ? "single" : drawerSplit;
      const effectivePullType = isHidden ? "none" : drawerPullType;
      const drawerSplitCount = effectiveSplit === "double" ? 2 : effectiveSplit === "triple" ? 3 : 1;
      const drawerSplitGap = drawerSplitCount > 1 ? 4 : 0;  // 格之間縫
      const subDrawerWidth = (drawerWidth - drawerSplitGap * (drawerSplitCount - 1)) / drawerSplitCount;
      // 第 1 個抽屜面位於最左：X 中心 = -drawerWidth/2 + subWidth/2
      for (let d = 0; d < drawerSplitCount; d++) {
        const cxOffset = -drawerWidth / 2 + subDrawerWidth / 2 + d * (subDrawerWidth + drawerSplitGap);
        parts.push({
          id: `layer${i + 1}-drawer-${d + 1}-front`,
          nameZh: drawerSplitCount === 1 ? `第 ${i + 1} 層抽屜面` : `第 ${i + 1} 層抽屜面 ${d + 1}/${drawerSplitCount}`,
          material,
          grainDirection: "length",
          visible: { length: subDrawerWidth, width: drawerThickness, thickness: drawerHeight },
          origin: { x: cxOffset, y: layerCenterY - drawerHeight / 2, z: drawerFrontZ },
          tenons: [],
          mortises: [],
        });
        // 抽屜拉手（每個分格中央）
        if (effectivePullType !== "none") {
          const pullY = layerCenterY;
          const pullZ = drawerFrontZ - drawerThickness / 2 - 4;
          if (effectivePullType === "round-brass") {
            parts.push({
              id: `layer${i + 1}-drawer-${d + 1}-pull`,
              nameZh: `第 ${i + 1} 層抽屜拉環 ${d + 1}`,
              material,
              grainDirection: "length",
              shape: { kind: "round" },
              visible: { length: 28, width: 28, thickness: 8 },
              origin: { x: cxOffset, y: pullY - 4, z: pullZ },
              tenons: [],
              mortises: [],
            });
          } else {
            parts.push({
              id: `layer${i + 1}-drawer-${d + 1}-pull`,
              nameZh: `第 ${i + 1} 層抽屜拉片 ${d + 1}`,
              material,
              grainDirection: "length",
              visible: { length: Math.min(80, subDrawerWidth - 20), width: 6, thickness: 12 },
              origin: { x: cxOffset, y: pullY - 6, z: pullZ },
              tenons: [],
              mortises: [],
            });
          }
        }
      }
      // 抽屜底（簡化用 1 片底板）
      const drawerBottomThickness = 6;
      parts.push({
        id: `layer${i + 1}-drawer-bottom`,
        nameZh: `第 ${i + 1} 層抽屜底`,
        material,
        grainDirection: "length",
        visible: { length: drawerWidth - 20, width: 2 * postZ - postSize - 30, thickness: drawerBottomThickness },
        origin: { x: 0, y: layerBottomY + 5, z: 0 },
        tenons: [],
        mortises: [],
      });
      // 抽屜兩側（立著的板，沿 Z 延伸）：X=厚, Y=高, Z=長
      const drawerSideThickness = 12;
      const drawerSideHeight = drawerHeight - 12;
      const drawerSideLength = 2 * (postZ - postSize / 2) - 30;
      for (const sx of [-1, 1] as const) {
        const lrId = sx < 0 ? "left" : "right";
        parts.push({
          id: `layer${i + 1}-drawer-${lrId}-side`,
          nameZh: `第 ${i + 1} 層抽屜${sx < 0 ? "左" : "右"}側`,
          material,
          grainDirection: "length",
          visible: { length: drawerSideThickness, width: drawerSideLength, thickness: drawerSideHeight },
          origin: { x: sx * (drawerWidth / 2 - 10 - drawerSideThickness / 2), y: layerBottomY + 5 + drawerBottomThickness, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      // 抽屜後（沿 X 延伸）：X=長, Y=高, Z=厚
      parts.push({
        id: `layer${i + 1}-drawer-back`,
        nameZh: `第 ${i + 1} 層抽屜後`,
        material,
        grainDirection: "length",
        visible: { length: drawerWidth - 20 - drawerSideThickness * 2, width: drawerSideThickness, thickness: drawerSideHeight },
        origin: { x: 0, y: layerBottomY + 5 + drawerBottomThickness, z: postZ - postSize / 2 - 20 },
        tenons: [],
        mortises: [],
      });
      // 抽屜內格分隔板（暗抽不加）
      if (!isHidden && drawerInternalGrid !== "none") {
        const dividerThickness = 8;
        const innerWidth = drawerWidth - 20 - drawerSideThickness * 2;     // 兩側板內寬
        const innerLength = drawerSideLength - drawerSideThickness * 2;    // 後板到前抽屜面內深
        const innerY = layerBottomY + 5 + drawerBottomThickness;
        // 縱向分隔板（沿 Z 軸延伸，把抽屜分成左右兩格）
        parts.push({
          id: `layer${i + 1}-drawer-divider-vert`,
          nameZh: `第 ${i + 1} 層抽屜縱向分隔板`,
          material,
          grainDirection: "length",
          visible: { length: dividerThickness, width: innerLength, thickness: drawerSideHeight - 4 },
          origin: { x: 0, y: innerY, z: 0 },
          tenons: [],
          mortises: [],
        });
        // 田字 4 格：再加 1 條橫向分隔板（沿 X 軸延伸）
        if (drawerInternalGrid === "divided-4") {
          parts.push({
            id: `layer${i + 1}-drawer-divider-horiz`,
            nameZh: `第 ${i + 1} 層抽屜橫向分隔板`,
            material,
            grainDirection: "length",
            visible: { length: innerWidth, width: dividerThickness, thickness: drawerSideHeight - 4 },
            origin: { x: 0, y: innerY, z: 0 },
            tenons: [],
            mortises: [],
          });
        }
      }
    } else {
      // shelf：開放層板。shelfExtraCount > 0 時加活動層板等分這個 layer
      if (shelfExtraCount > 0) {
        const extraSpacing = thisLayerHeight / (shelfExtraCount + 1);
        for (let s = 0; s < shelfExtraCount; s++) {
          const extraY = layerBottomY + extraSpacing * (s + 1) - 9;  // 18mm 厚活動板
          parts.push({
            id: `layer${i + 1}-extra-shelf-${s + 1}`,
            nameZh: `第 ${i + 1} 層活動板 ${s + 1}`,
            material,
            grainDirection: "length",
            visible: { length: innerSpanX - 4, width: innerSpanZ - 4, thickness: 18 },
            origin: { x: 0, y: extraY, z: 0 },
            tenons: [],
            mortises: [],
          });
        }
      }
    }
  }

  // ── 底框（4 條 rail 圍成底箱，承層板/抽屜底）
  // 簡化：用 1 片底板
  parts.push({
    id: "bottom-board",
    nameZh: "底板",
    material,
    grainDirection: "length",
    visible: { length: 2 * postX - postSize, width: 2 * postZ - postSize, thickness: 18 },
    origin: { x: 0, y: skirtHeight + railWidth, z: 0 },
    tenons: [],
    mortises: [],
  });

  // ── 牙條（直線素牙）：圍底框下緣 4 條
  // 牙條從立柱外面**內縮 10mm**（reveal 視覺凹進感）
  const SKIRT_INSET = 10;
  const skirtOffsetX = postX + postSize / 2 - skirtThickness / 2 - SKIRT_INSET;
  const skirtOffsetZ = postZ + postSize / 2 - skirtThickness / 2 - SKIRT_INSET;
  // 牙條 shape（雲頭 / 壼門用 face-rounded 的 archMm 表示弧度）
  // arched 走純底凹強弧（壼門深弧），cloud-head 同時帶上凸+下凹（雲頭起翹）
  const skirtShape: Part["shape"] | undefined =
    skirtStyle === "arched"
      ? { kind: "face-rounded", cornerR: 8, bottomArchMm: skirtHeight * 0.55 }
      : skirtStyle === "cloud-head"
        ? { kind: "face-rounded", cornerR: 18, topArchMm: skirtHeight * 0.32, bottomArchMm: skirtHeight * 0.45 }
        : undefined;

  // 前後牙條（沿 X 延伸）：X=長, Y=高, Z=厚
  for (const sz of [-1, 1] as const) {
    const fbId = sz < 0 ? "front" : "back";
    const fbLabel = sz < 0 ? "前" : "後";
    parts.push({
      id: `skirt-${fbId}`,
      nameZh: `${fbLabel}牙條`,
      material,
      grainDirection: "length",
      visible: { length: 2 * (postX - postSize / 2), width: skirtThickness, thickness: skirtHeight },
      origin: { x: 0, y: 0, z: sz * skirtOffsetZ },
      ...(skirtShape ? { shape: skirtShape } : {}),
      tenons: [],
      mortises: [],
    });
  }
  // 左右牙條（沿 Z 延伸）：X=厚, Y=高, Z=長（接到兩立柱內面）
  for (const sx of [-1, 1] as const) {
    const lrId = sx < 0 ? "left" : "right";
    const lrLabel = sx < 0 ? "左" : "右";
    parts.push({
      id: `skirt-${lrId}`,
      nameZh: `${lrLabel}牙條`,
      material,
      grainDirection: "length",
      visible: { length: skirtThickness, width: 2 * (postZ - postSize / 2), thickness: skirtHeight },
      origin: { x: sx * skirtOffsetX, y: 0, z: 0 },
      ...(skirtShape ? { shape: skirtShape } : {}),
      tenons: [],
      mortises: [],
    });
  }

  // 牙頭裝飾（spandrel）：立柱跟牙條交角的小三角雕飾
  // ruyi 如意紋（明式）尖頂高弧、cloud-head 雲頭（清式）厚實圓弧
  if (spandrelStyle !== "none") {
    // ruyi 如意：尖頂高弧（如意紋上端尖凸），cornerR 大、topArch 強、bottomArch 也凹下露出花邊
    // cloud-head 雲頭：圓潤厚實（卷雲），cornerR 小、topArch 中等、bottomArch 不凹
    const spandrelShape: Part["shape"] =
      spandrelStyle === "ruyi"
        ? { kind: "face-rounded", cornerR: 28, topArchMm: spandrelSize * 0.75, bottomArchMm: spandrelSize * 0.25 }
        : { kind: "face-rounded", cornerR: 8, topArchMm: spandrelSize * 0.45 };
    // 前後牙條兩端各 1 個（沿 X 延伸）
    for (const sz of [-1, 1] as const) {
      const fbId = sz < 0 ? "front" : "back";
      const fbLabel = sz < 0 ? "前" : "後";
      for (const sx of [-1, 1] as const) {
        const lrLabel = sx < 0 ? "左" : "右";
        parts.push({
          id: `spandrel-${fbId}-${sx < 0 ? "left" : "right"}-x`,
          nameZh: `${fbLabel}${lrLabel}牙頭`,
          material,
          grainDirection: "length",
          visible: { length: spandrelSize, width: skirtThickness, thickness: skirtHeight },
          // 立柱內側 X = sx*(postX - postSize/2)，spandrel 從那往 -sx 方向延伸
          origin: { x: sx * (postX - postSize / 2) - sx * spandrelSize / 2, y: 0, z: sz * skirtOffsetZ },
          shape: spandrelShape,
          tenons: [],
          mortises: [],
        });
      }
    }
    // 左右牙條兩端各 1 個（沿 Z 延伸）
    for (const sx of [-1, 1] as const) {
      const lrId = sx < 0 ? "left" : "right";
      const lrLabel = sx < 0 ? "左" : "右";
      for (const sz of [-1, 1] as const) {
        const fbLabel = sz < 0 ? "前" : "後";
        parts.push({
          id: `spandrel-${lrId}-${sz < 0 ? "front" : "back"}-z`,
          nameZh: `${lrLabel}${fbLabel}牙頭`,
          material,
          grainDirection: "length",
          visible: { length: skirtThickness, width: spandrelSize, thickness: skirtHeight },
          origin: { x: sx * skirtOffsetX, y: 0, z: sz * (postZ - postSize / 2) - sz * spandrelSize / 2 },
          shape: spandrelShape,
          tenons: [],
          mortises: [],
        });
      }
    }
  }

  const layerSummary = layerTypes.map((t, i) => `${i + 1}=${t === "door" ? "對開門" : t === "drawer" ? "抽屜" : "層板"}`).join(" / ");

  const design: FurnitureDesign = {
    id: `chinese-cabinet-${length}x${width}x${height}`,
    category: "chinese-cabinet",
    nameZh: "中式方角櫃",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "shouldered-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `中式方角櫃（明式邊抹板心）：4 立柱 ${postSize}mm + 6 面框板（邊抹 ${railWidth}×${railThickness}mm + 板心 ${panelThickness}mm）+ 直線素牙（高 ${skirtHeight}mm）。${layerCount} 層配置：${layerSummary}。框角全帶肩榫；板心浮放於框內槽 5mm 深，不黏死讓木材吐縮不爆裂。`,
  };

  applyStandardChecks(design, {
    minLength: 500, minWidth: 250, minHeight: 600,
    maxLength: 1500, maxWidth: 600, maxHeight: 2200,
  });
  return design;
};
