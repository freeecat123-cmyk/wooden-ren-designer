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
interface CabinetPresetConfig {
  layers: string[];
  /** preset 帶的 doorStyle 預設值；user 手動覆寫仍優先 */
  doorStyle?: string;
  /** v12 加：preset 可綁定形制 / 比例風格等高階組合 */
  compoundMode?: string;
  cabinetCorner?: string;
  proportionStyle?: string;
  balustradeStyle?: string;
  spandrelStyle?: string;
  legShape?: string;
}

const CABINET_PRESETS: Record<string, CabinetPresetConfig> = {
  bookshelf: { layers: ["shelf", "shelf", "shelf", "shelf", "shelf"] },
  cupboard: { layers: ["door", "drawer", "door"] },
  // 茶櫃：傳統多抽屜分裝茶葉/茶罐 + 上方展示層板
  "tea-cabinet": { layers: ["drawer", "drawer", "door", "shelf"] },
  shrine: { layers: ["drawer", "door", "door", "shelf"] },
  // 博古架：玻璃格扇門 4 層展示古玩茶具，明清書房常見
  "display-cabinet": { layers: ["door", "door", "door", "shelf"], doorStyle: "glass-lattice" },
  // 玻璃書櫃：5 層全玻璃門，現代家居書房展示
  "glass-bookshelf": { layers: ["door", "door", "door", "door", "door"], doorStyle: "glass" },
  // v12：頂箱櫃 — 明清主臥/廳堂主角，下櫃 4 層 + 頂箱（compoundMode），明式比例
  "top-cabinet": {
    layers: ["drawer", "door", "door", "shelf"],
    compoundMode: "topBox",
    proportionStyle: "ming",
  },
  // v12：圓角櫃 — 明式四大櫃形之一，側腳上窄下寬 + 噴面 + 木軸（cabinetCorner=round），明式比例
  "round-cabinet": {
    layers: ["door", "door", "shelf"],
    cabinetCorner: "round",
    proportionStyle: "ming",
    legShape: "box",  // 圓角櫃強制無馬蹄
  },
  // v12：万歷櫃 — 上敞下櫃，最上層 shelf + 直櫺欄（balustrade）
  "wanli-cabinet": {
    layers: ["door", "door", "shelf"],
    balustradeStyle: "vertical",
    proportionStyle: "ming",
  },
};

export const chineseCabinetOptions: OptionSpec[] = [
  // 配置預設（最頂端，影響後續 layer 設定）
  { group: "leg", type: "select", key: "cabinetPreset", label: "配置預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（依下方層配置）" },
    { value: "bookshelf", label: "書櫃（5 層全開放）" },
    { value: "cupboard", label: "碗櫥（門 + 抽屜 + 門）" },
    { value: "tea-cabinet", label: "茶櫃（抽屜 + 門 + 層板）" },
    { value: "shrine", label: "神桌邊櫃（抽屜 + 門 + 層板）" },
    { value: "display-cabinet", label: "博古架（玻璃格扇門 × 4 層）" },
    { value: "glass-bookshelf", label: "玻璃書櫃（5 層全玻璃門）" },
    { value: "top-cabinet", label: "頂箱櫃（明清主臥/廳堂主角，上小下大兩段）" },
    { value: "round-cabinet", label: "圓角櫃（明式四大櫃形，側腳+噴面+木軸）" },
    { value: "wanli-cabinet", label: "万歷櫃（上敞下櫃 + 直櫺欄，書房經典）" },
  ], help: "選擇預設可一鍵套用層配置 + 形制 + 比例風格。會蓋過下方對應設定，但保留尺寸 / 細部" },
  // 頂箱櫃 compound mode：上下兩段堆疊（明清四件櫃 / 頂豎櫃）
  { group: "leg", type: "select", key: "compoundMode", label: "形制", defaultValue: "single", choices: [
    { value: "single", label: "單段櫃（標準方角櫃）" },
    { value: "topBox", label: "頂箱櫃（上小下大兩段堆疊）" },
  ], help: "頂箱櫃 = 明清主臥/廳堂主角，下櫃 + 上頂箱兩段，分件運輸。預設 = 單段" },
  { group: "leg", type: "number", key: "topBoxRatio", label: "頂箱佔總高比例", defaultValue: 0.3, min: 0.2, max: 0.45, step: 0.05, help: "頂箱高度佔總高的比例（0.25 偏低典雅、0.4 接近對半）", dependsOn: { key: "compoundMode", oneOf: ["topBox"] } },
  { group: "leg", type: "number", key: "topBoxLayers", label: "頂箱層數", defaultValue: 1, min: 1, max: 2, step: 1, help: "頂箱內部層數（1=純對開門、2=門+小抽屜）", dependsOn: { key: "compoundMode", oneOf: ["topBox"] } },
  // 圓角櫃形制：上窄下寬側腳 + 噴面 + 木軸門（明式四大櫃形之一）
  { group: "leg", type: "select", key: "cabinetCorner", label: "櫃角形制", defaultValue: "square", choices: [
    { value: "square", label: "方角櫃（直立柱、銅合頁、直角）" },
    { value: "round", label: "圓角櫃（側腳上窄下寬、噴面、木軸門）" },
  ], help: "圓角櫃 = 明式四大櫃形之一，靠側腳（splay）+ 噴面（cap overhang）+ 木軸（無金屬合頁）三件套，比方角更早期文人雅" },
  { group: "leg", type: "number", key: "splayAngle", label: "側腳角度 (°)（暫保留）", defaultValue: 0.5, min: 0.2, max: 1.5, step: 0.1, unit: "°", help: "⚠️ 暫時不生效——圓角櫃改用「立柱倒圓 + 加大噴面」當視覺辨識，避免 frame 構件不跟著斜產生縫。完整 frame-trapezoid 同步修待下輪", dependsOn: { key: "cabinetCorner", oneOf: ["round"] } },
  { group: "leg", type: "number", key: "capOverhangExtra", label: "噴面額外外伸 (mm)", defaultValue: 15, min: 0, max: 40, step: 5, unit: "mm", help: "圓角櫃頂蓋比方角櫃多伸的部分（疊加在 topOverhang 上）", dependsOn: { key: "cabinetCorner", oneOf: ["round"] } },
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
  // 亮格櫃 / 万歷櫃：頂層敞格 + 圍欄（書房經典「上敞放古玩+下櫃放書」）
  { group: "apron", type: "select", key: "balustradeStyle", label: "敞格圍欄", defaultValue: "none", choices: [
    { value: "none", label: "無圍欄（標準櫃）" },
    { value: "vertical", label: "直櫺欄（垂直細櫺杆 5 根）" },
    { value: "scroll", label: "卷草欄（雲頭曲線櫺）" },
  ], help: "圍欄裝在最上層 shelf 前緣，3 面圍——上方變敞格放古玩。配合 layerCount 把最上層設為 shelf 即成万歷櫃" },
  { group: "apron", type: "number", key: "balustradeHeight", label: "圍欄高 (mm)", defaultValue: 80, min: 50, max: 150, step: 5, unit: "mm", dependsOn: { key: "balustradeStyle", notIn: ["none"] } },
  // 屏心嵌飾：板心中央嵌石 / 嵌格 / 留字框（明清板心開光裝飾）
  { group: "apron", type: "select", key: "panelInlay", label: "板心嵌飾（屏心）", defaultValue: "none", choices: [
    { value: "none", label: "無嵌飾（純板心）" },
    { value: "stone-medallion", label: "嵌石開光（圓 / 方框中央嵌大理石）" },
    { value: "latticed-center", label: "格紋中心（中央嵌田字格）" },
    { value: "calligraphy-frame", label: "留字框（中央留出書法 / 對聯框）" },
  ], help: "明清板心常嵌大理石 / 雲石 / 瘿木做圓形開光，或中央格紋裝飾。只在 panelStyle=flat 時生效", dependsOn: { key: "panelStyle", oneOf: ["flat"] } },
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
  { group: "stretcher", type: "select", key: "spandrelStyle", label: "牙頭裝飾", defaultValue: "auto", choices: [
    { value: "auto", label: "依比例風格（明=如意、清=雲頭、自訂=無）" },
    { value: "none", label: "無牙頭" },
    { value: "cloud-head", label: "雲頭牙頭（清式厚實）" },
    { value: "ruyi", label: "如意牙頭（明式典雅）" },
  ], help: "牙頭 = 立柱跟牙條交角的小三角雕飾，雲頭/如意是中式櫃靈魂" },
  { group: "stretcher", type: "number", key: "spandrelSize", label: "牙頭尺寸 (mm)", defaultValue: 80, min: 50, max: 160, step: 5, unit: "mm", help: "牙頭沿立柱往牙條延伸的長度（高度跟著牙條走）", dependsOn: { key: "spandrelStyle", notIn: ["none"] } },
  // 站牙：立柱底端內側朝內延伸的三角穩定撐木（明清文人櫃站立感）
  { group: "stretcher", type: "select", key: "standingBraceStyle", label: "站牙", defaultValue: "none", choices: [
    { value: "none", label: "無站牙" },
    { value: "scroll", label: "卷草站牙（明式典雅）" },
    { value: "cloud", label: "雲頭站牙（清式厚實）" },
  ], help: "站牙 = 立柱底外側朝外的三角撐木，補強站立感。spandrelStyle=ruyi 時自動隱藏避免擠在一起" },
  { group: "stretcher", type: "number", key: "standingBraceSize", label: "站牙尺寸 (mm)", defaultValue: 100, min: 60, max: 200, step: 10, unit: "mm", help: "站牙沿立柱往上的高度", dependsOn: { key: "standingBraceStyle", notIn: ["none"] } },
  // 絛環板：頂蓋下方一條裝飾橫帶（清式櫃常見「華而不空」橫條）
  { group: "stretcher", type: "select", key: "friezePanel", label: "絛環板", defaultValue: "none", choices: [
    { value: "none", label: "無絛環板" },
    { value: "lattice", label: "格紋絛環（田字 / 十字格）" },
    { value: "openwork", label: "透雕絛環（雲紋 / 卷草）" },
  ], help: "絛環板 = 頂蓋下方 30–60mm 的薄板，內嵌 lattice / 透雕，清式櫃裝飾語彙" },
  { group: "stretcher", type: "number", key: "friezeHeight", label: "絛環板高 (mm)", defaultValue: 50, min: 30, max: 80, step: 5, unit: "mm", dependsOn: { key: "friezePanel", notIn: ["none"] } },
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
  const { length, width, material } = input;
  const heightInput = input.height;
  const cabinetPresetEarly = getOption<string>(input, opt(o, "cabinetPreset"));
  const presetEarly = CABINET_PRESETS[cabinetPresetEarly];
  // preset 帶的 compoundMode / cabinetCorner 等高階形制：user 沒主動選非 default 時就以 preset 為準
  const compoundModeRaw = getOption<string>(input, opt(o, "compoundMode"));
  const compoundMode = compoundModeRaw === "single" && presetEarly?.compoundMode
    ? presetEarly.compoundMode
    : compoundModeRaw;
  const topBoxRatio = getOption<number>(input, opt(o, "topBoxRatio"));
  const topBoxLayers = getOption<number>(input, opt(o, "topBoxLayers"));
  const cabinetCornerRaw = getOption<string>(input, opt(o, "cabinetCorner"));
  const cabinetCornerResolved = cabinetCornerRaw === "square" && presetEarly?.cabinetCorner
    ? presetEarly.cabinetCorner
    : cabinetCornerRaw;
  // 互斥：圓角櫃靠側腳整體往上收窄、無法分件堆疊。明清史上沒有圓角頂箱櫃。
  // 兩個都選時優先尊重圓角（後者更稀有且結構衝突更大），mute compoundMode。
  const cabinetCorner = cabinetCornerResolved;
  const splayAngleDeg = getOption<number>(input, opt(o, "splayAngle"));
  const capOverhangExtra = getOption<number>(input, opt(o, "capOverhangExtra"));
  const isRoundCorner = cabinetCorner === "round";
  // 頂箱櫃模式：總高切上下兩段，下櫃用 effectiveHeight 走既有渲染，
  // 上頂箱另外堆一段 frame-and-panel。waistGap = 上下櫃之間的縫隙（傳統做法
  // 是兩段獨立分件、垂直堆疊但沒接觸——畫 5mm gap 視覺區分）
  // 圓角櫃禁用頂箱（明清史上沒這形制）
  const isCompound = compoundMode === "topBox" && !isRoundCorner;
  const waistGap = isCompound ? 5 : 0;
  const topBoxHeight = isCompound ? Math.round(heightInput * topBoxRatio) : 0;
  const height = isCompound ? heightInput - topBoxHeight - waistGap : heightInput;
  const proportionStyleRaw = getOption<string>(input, opt(o, "proportionStyle"));
  const proportionStyle = proportionStyleRaw === "ming" && presetEarly?.proportionStyle
    ? presetEarly.proportionStyle
    : proportionStyleRaw;
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
  const spandrelStyleRaw = getOption<string>(input, opt(o, "spandrelStyle"));
  const spandrelStyle: string =
    spandrelStyleRaw === "auto"
      ? proportionStyle === "ming"
        ? "ruyi"
        : proportionStyle === "qing"
          ? "cloud-head"
          : "none"
      : spandrelStyleRaw;
  const spandrelSize = getOption<number>(input, opt(o, "spandrelSize"));
  const standingBraceStyleRaw = getOption<string>(input, opt(o, "standingBraceStyle"));
  const standingBraceSize = getOption<number>(input, opt(o, "standingBraceSize"));
  const friezePanel = getOption<string>(input, opt(o, "friezePanel"));
  const friezeHeight = getOption<number>(input, opt(o, "friezeHeight"));
  // 跟 spandrelStyle=ruyi 互斥（避免擠在一起）— 只擋顯式 ruyi，
  // auto+ming 不再連帶 mute，使用者選了 scroll/cloud 站牙就會生效
  const standingBraceStyle = spandrelStyleRaw === "ruyi"
    ? "none"
    : standingBraceStyleRaw;
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
  // 圓角櫃模式自動鎖 legShape=box（馬蹄+側腳組合幾何複雜，初版純側腳）
  const effectiveLegShape: "box" | "inward-hoof" | "outward-hoof" = isRoundCorner ? "box" : legShape;
  const hoofMm = effectiveLegShape === "box" ? 0 : Math.min(hoofMmRaw, skirtHeight + railWidth - 10);
  const backPanelStyle = getOption<string>(input, opt(o, "backPanelStyle"));
  const panelStyle = getOption<string>(input, opt(o, "panelStyle"));
  const panelInlay = getOption<string>(input, opt(o, "panelInlay"));
  const balustradeStyleRaw = getOption<string>(input, opt(o, "balustradeStyle"));
  const balustradeStyle = balustradeStyleRaw === "none" && presetEarly?.balustradeStyle
    ? presetEarly.balustradeStyle
    : balustradeStyleRaw;
  const balustradeHeight = getOption<number>(input, opt(o, "balustradeHeight"));
  // 嵌飾只在 flat 板心生效（raised 凸面已經有層次了，不再加）
  const panelInlayActive = panelInlay !== "none" && panelStyle === "flat";
  const doorGap = getOption<number>(input, opt(o, "doorGap"));
  const doorPullType = getOption<string>(input, opt(o, "doorPullType"));
  const doorStyleRaw = getOption<string>(input, opt(o, "doorStyle"));
  // preset 帶的 doorStyle 在 user 未主動選非 solid 時生效（user override solid 也算「主動選」）
  const presetDoorStyle = CABINET_PRESETS[cabinetPreset]?.doorStyle;
  const doorStyle = doorStyleRaw === "solid" && presetDoorStyle ? presetDoorStyle : doorStyleRaw;
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
  const presetConfig = CABINET_PRESETS[cabinetPreset];
  const presetLayers = presetConfig?.layers;
  const layerCount = userLayerCount;
  const layerTypes: string[] = presetLayers
    ? presetLayers.length >= layerCount
      ? presetLayers.slice(0, layerCount)
      : [...presetLayers, ...userLayerTypes.slice(presetLayers.length, layerCount)]
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
  // 圓角櫃側腳量：立柱底端往外擴 splayMm
  const splayMmGlobal = isRoundCorner
    ? Math.round(Math.tan((splayAngleDeg * Math.PI) / 180) * postHeight)
    : 0;
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
    visible: { length: length + (topOverhang + (isRoundCorner ? capOverhangExtra : 0)) * 2, width: width + (topOverhang + (isRoundCorner ? capOverhangExtra : 0)) * 2, thickness: topThickness },
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
      const hoofDirSign: -1 | 1 = effectiveLegShape === "outward-hoof" ? 1 : -1;
      // 圓角櫃側腳：底端朝外位移 splayMm（上窄下寬），用 splayed shape
      // splayMm = tan(splayAngle) × postHeight；底端往 sign(c.x), sign(c.z) 方向偏
      const splayMmRound = isRoundCorner
        ? Math.round(Math.tan((splayAngleDeg * Math.PI) / 180) * postHeight)
        : 0;
      const postShape: Part["shape"] | undefined = isRoundCorner
        ? {
            kind: "splayed",
            dxMm: sx * splayMmRound,
            dzMm: sz * splayMmRound,
          }
        : effectiveLegShape === "box"
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
    // 圓角櫃 frame-trapezoid：板心底端 Z 跨距比頂端寬 splayMm × (1 - panel_bot_y/postHeight) × 2
    // 用 tapered shape 套 bottomScale = panelBotZ / panelTopZ
    const sidePanelBotY = lowerRailY + railWidth - 5;
    const sidePanelTopY = sidePanelBotY + panelInnerH;
    // 板心 Z 跨距隨高度線性：innerSpan_at_y = innerSpan + 2×splayMm×(1−y/postHeight)
    // tapered shape：bottom 比 top 寬 = (1+底端 splay shift) / (1+頂端 splay shift)
    const sidePanelTaper = isRoundCorner && splayMmGlobal > 0
      ? (panelInnerW_Z + 2 * splayMmGlobal * (1 - sidePanelBotY / postHeight)) /
        Math.max(1, panelInnerW_Z + 2 * splayMmGlobal * (1 - sidePanelTopY / postHeight))
      : 1;
    parts.push({
      id: `${lrId}-side-panel`,
      nameZh: `${lrLabel}側板心`,
      material,
      grainDirection: "length",
      visible: { length: panelThickness, width: panelInnerW_Z, thickness: panelInnerH },
      origin: { x: sx * sideRailOffsetX, y: sidePanelBotY, z: 0 },
      ...(sidePanelTaper > 1.001 ? { shape: { kind: "tapered" as const, bottomScale: sidePanelTaper } } : {}),
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
    // 屏心嵌飾：板心中央嵌石 / 嵌格 / 留字框（外凸 5mm，視覺開光）
    if (panelInlayActive) {
      const inlayMargin = Math.min(80, panelInnerW_Z * 0.2);
      const inlayThickness = 5;
      const inlayInnerW = Math.max(60, panelInnerW_Z - inlayMargin * 2);
      const inlayInnerH = Math.max(60, panelInnerH - inlayMargin * 2);
      const inlayCornerR = Math.round(Math.min(inlayInnerH, inlayInnerW) * 0.15);
      // 三值差異化：
      //  stone-medallion = 大圓角整片（橢圓開光感）
      //  latticed-center = 細邊小框 + 中央田字格條陣列（10mm 邊框 + 4 條櫺）
      //  calligraphy-frame = 厚邊框（內留空當字框，外環粗）
      if (panelInlay === "stone-medallion") {
        parts.push({
          id: `${lrId}-side-panel-inlay`,
          nameZh: `${lrLabel}側嵌石屏心`,
          material,
          grainDirection: "length",
          visible: { length: inlayThickness, width: inlayInnerW, thickness: inlayInnerH },
          origin: { x: sx * (sideRailOffsetX + panelThickness / 2 + inlayThickness / 2), y: lowerRailY + railWidth - 5 + inlayMargin, z: 0 },
          shape: { kind: "face-rounded", cornerR: inlayCornerR * 2, bendMm: 0, bendAxis: "z" },
          tenons: [],
          mortises: [],
        });
      } else if (panelInlay === "latticed-center") {
        // 中央 1 條橫 + 1 條直構成十字格框
        const barT = 6;
        const barX = sx * (sideRailOffsetX + panelThickness / 2 + inlayThickness / 2);
        const baseY = lowerRailY + railWidth - 5 + inlayMargin;
        // 外框 4 條
        for (const [partKey, partLen, partThick, dy, dz] of [
          ["top", inlayInnerW, barT, inlayInnerH - barT, 0],
          ["bot", inlayInnerW, barT, 0, 0],
          ["left", barT, inlayInnerH, 0, -inlayInnerW / 2 + barT / 2],
          ["right", barT, inlayInnerH, 0, inlayInnerW / 2 - barT / 2],
        ] as const) {
          parts.push({
            id: `${lrId}-side-panel-inlay-${partKey}`,
            nameZh: `${lrLabel}側格紋屏心-${partKey}`,
            material,
            grainDirection: "length",
            visible: { length: inlayThickness, width: partLen, thickness: partThick },
            origin: { x: barX, y: baseY + dy, z: dz },
            tenons: [],
            mortises: [],
          });
        }
        // 中央十字
        parts.push({
          id: `${lrId}-side-panel-inlay-cross-h`,
          nameZh: `${lrLabel}側格紋十字-橫`,
          material,
          grainDirection: "length",
          visible: { length: inlayThickness, width: inlayInnerW, thickness: barT },
          origin: { x: barX, y: baseY + inlayInnerH / 2 - barT / 2, z: 0 },
          tenons: [],
          mortises: [],
        });
        parts.push({
          id: `${lrId}-side-panel-inlay-cross-v`,
          nameZh: `${lrLabel}側格紋十字-直`,
          material,
          grainDirection: "length",
          visible: { length: inlayThickness, width: barT, thickness: inlayInnerH },
          origin: { x: barX, y: baseY, z: 0 },
          tenons: [],
          mortises: [],
        });
      } else if (panelInlay === "calligraphy-frame") {
        // 厚邊框 12mm 寬，中央留空（書法字框感）
        const frameW = 12;
        const barX = sx * (sideRailOffsetX + panelThickness / 2 + inlayThickness / 2);
        const baseY = lowerRailY + railWidth - 5 + inlayMargin;
        for (const [partKey, partLen, partThick, dy, dz] of [
          ["top", inlayInnerW, frameW, inlayInnerH - frameW, 0],
          ["bot", inlayInnerW, frameW, 0, 0],
          ["left", frameW, inlayInnerH, 0, -inlayInnerW / 2 + frameW / 2],
          ["right", frameW, inlayInnerH, 0, inlayInnerW / 2 - frameW / 2],
        ] as const) {
          parts.push({
            id: `${lrId}-side-panel-inlay-frame-${partKey}`,
            nameZh: `${lrLabel}側字框-${partKey}`,
            material,
            grainDirection: "length",
            visible: { length: inlayThickness, width: partLen, thickness: partThick },
            origin: { x: barX, y: baseY + dy, z: dz },
            tenons: [],
            mortises: [],
          });
        }
      }
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
    const backPanelBotY = lowerRailY + railWidth - 5;
    const backPanelTopY = backPanelBotY + panelInnerH;
    const backPanelTaper = isRoundCorner && splayMmGlobal > 0
      ? (panelInnerW_X + 2 * splayMmGlobal * (1 - backPanelBotY / postHeight)) /
        (panelInnerW_X + 2 * splayMmGlobal * (1 - backPanelTopY / postHeight))
      : 1;
    parts.push({
      id: "back-panel",
      nameZh: "背面板心",
      material,
      grainDirection: "length",
      visible: { length: panelInnerW_X, width: panelThickness, thickness: panelInnerH },
      origin: { x: 0, y: backPanelBotY, z: fbRailOffsetZ },
      ...(backPanelTaper > 1.001 ? { shape: { kind: "tapered" as const, bottomScale: backPanelTaper } } : {}),
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
    // 背板屏心嵌飾
    if (panelInlayActive) {
      const inlayMarginBack = Math.min(80, panelInnerW_X * 0.2);
      const inlayThickness = 5;
      // cornerR 用較小邊的 0.15 倍，避免長寬比例懸殊時形狀拉伸
      const inlayShapeBack: Part["shape"] | undefined =
        panelInlay === "stone-medallion"
          ? { kind: "face-rounded", cornerR: Math.round(Math.min(panelInnerH, panelInnerW_X) * 0.15), bendMm: 0, bendAxis: "z" }
          : undefined;
      parts.push({
        id: "back-panel-inlay",
        nameZh: "背板屏心",
        material,
        grainDirection: "length",
        visible: {
          length: Math.max(60, panelInnerW_X - inlayMarginBack * 2),
          width: inlayThickness,
          thickness: Math.max(60, panelInnerH - inlayMarginBack * 2),
        },
        origin: {
          x: 0,
          y: lowerRailY + railWidth - 5 + inlayMarginBack,
          z: fbRailOffsetZ + panelThickness / 2 + inlayThickness / 2,
        },
        ...(inlayShapeBack ? { shape: inlayShapeBack } : {}),
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
        // 圓角櫃 frame-trapezoid：門板底端比頂端寬 splayMm 對應差
        const doorBotY = layerCenterY - doorHeight / 2;
        const doorTopY = doorBotY + doorHeight;
        const doorTaper = isRoundCorner && splayMmGlobal > 0
          ? (doorWidth + 2 * splayMmGlobal * (1 - doorBotY / postHeight)) /
            (doorWidth + 2 * splayMmGlobal * (1 - doorTopY / postHeight))
          : 1;
        parts.push({
          id: `layer${i + 1}-${lrId}-door`,
          nameZh: `第 ${i + 1} 層${lrLabel}門${isGlassDoor ? "玻璃片" : ""}`,
          material,
          grainDirection: "length",
          visible: { length: doorWidth, width: mainPanelThickness, thickness: doorHeight },
          origin: { x: doorCX, y: doorBotY, z: doorFrontZ },
          ...(isGlassDoor ? { visual: "glass" as const } : {}),
          ...(!isGlassDoor && doorTaper > 1.001 ? { shape: { kind: "tapered" as const, bottomScale: doorTaper } } : {}),
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
        // 屏心嵌飾擴到 solid 門板（前 3D 視覺最常看到的位置）
        if (doorStyle === "solid" && panelInlayActive) {
          const inlayMargin = Math.min(50, doorWidth * 0.18);
          const inlayThickness = 4;
          const inlayInnerW = Math.max(50, doorWidth - inlayMargin * 2);
          const inlayInnerH = Math.max(50, doorHeight - inlayMargin * 2);
          if (panelInlay === "stone-medallion") {
            parts.push({
              id: `layer${i + 1}-${lrId}-door-inlay-stone`,
              nameZh: `第 ${i + 1} 層${lrLabel}門嵌石屏心`,
              material,
              grainDirection: "length",
              visible: { length: inlayInnerW, width: inlayThickness, thickness: inlayInnerH },
              origin: { x: doorCX, y: layerCenterY - inlayInnerH / 2, z: doorFrontZ - doorThickness / 2 - inlayThickness / 2 },
              shape: { kind: "face-rounded", cornerR: Math.round(Math.min(inlayInnerH, inlayInnerW) * 0.3), bendMm: 0, bendAxis: "z" },
              tenons: [],
              mortises: [],
            });
          } else if (panelInlay === "calligraphy-frame") {
            const frameW = 10;
            for (const [partKey, partLen, partThick, dy, dx] of [
              ["top", inlayInnerW, frameW, inlayInnerH - frameW, 0],
              ["bot", inlayInnerW, frameW, 0, 0],
              ["left", frameW, inlayInnerH, 0, -inlayInnerW / 2 + frameW / 2],
              ["right", frameW, inlayInnerH, 0, inlayInnerW / 2 - frameW / 2],
            ] as const) {
              parts.push({
                id: `layer${i + 1}-${lrId}-door-inlay-frame-${partKey}`,
                nameZh: `第 ${i + 1} 層${lrLabel}門字框-${partKey}`,
                material,
                grainDirection: "length",
                visible: { length: partLen, width: inlayThickness, thickness: partThick },
                origin: { x: doorCX + dx, y: layerCenterY - inlayInnerH / 2 + dy, z: doorFrontZ - doorThickness / 2 - inlayThickness / 2 },
                tenons: [],
                mortises: [],
              });
            }
          }
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
        // 合頁面葉（hinge plate）：門外側（遠離中縫一側）上下各 1 條長條銅片
        // 凸貼於門面 -Z 2mm，沿垂直 Y 方向 80mm 長，仿明清銅件
        // 圓角櫃用木軸（門板上下出軸頭轉立柱），無金屬合頁——skip 銅片
        if (doorPullType !== "none" && !isRoundCorner) {
          const hingeX = sx * (doorWidth / 2 + doorGap / 2 - sx * 0);  // 對齊門外側邊
          const hingeOuterX = doorCX + sx * (doorWidth / 2 - 18);  // 距離門外緣 18mm
          const hingeZ = doorFrontZ - doorThickness / 2 - 1;  // 凸貼門面 2mm 厚銅片
          const hingeTopY = layerCenterY + doorHeight / 2 - 60;
          const hingeBotY = layerCenterY - doorHeight / 2 + 60;
          for (const [hY, hLabel] of [[hingeTopY, "上"], [hingeBotY, "下"]] as const) {
            parts.push({
              id: `layer${i + 1}-${lrId}-door-hinge-${hLabel === "上" ? "top" : "bot"}`,
              nameZh: `第 ${i + 1} 層${lrLabel}門${hLabel}合頁面葉`,
              material,
              grainDirection: "length",
              visible: { length: 24, width: 2, thickness: 90 },
              origin: { x: hingeOuterX, y: hY - 45, z: hingeZ },
              visual: "brass-antique",
              tenons: [],
              mortises: [],
            });
          }
          void hingeX;  // hingeX 保留供後續其他位置設計
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
              visual: "brass-antique",
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
              visual: "brass-antique",
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
              visual: "brass-antique",
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
              visual: "brass-antique",
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
  // 圓角櫃不該有牙頭（裝飾構件衝突明式四大櫃形 sleek 形式）
  if (spandrelStyle !== "none" && !isRoundCorner) {
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

  // ── 站牙：4 立柱底外側朝外的小三角撐木（明清文人櫃站立感補強）
  // shape: face-rounded 用 cornerR 製造卷草弧；雲頭用更大 cornerR 做圓鈍頭
  // 位置：每隻立柱外側（左/右側 + 前/後）總共 4 隻立柱 × 2 邊 = 8 隻
  // 跟牙頭分工：牙頭 = 立柱-牙條交角的內側裝飾；站牙 = 立柱外側朝外的撐木
  if (standingBraceStyle !== "none") {
    const braceShape: Part["shape"] =
      standingBraceStyle === "scroll"
        ? { kind: "face-rounded", cornerR: 35, bendMm: 0, bendAxis: "z" }
        : { kind: "face-rounded", cornerR: 50, bendMm: 0, bendAxis: "z" };
    // 厚度從 skirtThickness-4（薄片）拉到 skirtThickness+8（25mm 起跳）
    // 才看得見——3D 透視 3/4 角度站牙若 < 20mm 會變一條垂直細線
    const braceThickness = Math.max(25, skirtThickness + 8);
    const braceOuterX = postX + postSize / 2 + 1;
    const braceOuterZ = postZ + postSize / 2 + 1;
    // 沿 Z 軸方向的站牙（左右側面）—4 個
    for (const sx of [-1, 1] as const) {
      const lrId = sx < 0 ? "left" : "right";
      const lrLabel = sx < 0 ? "左" : "右";
      for (const sz of [-1, 1] as const) {
        const fbLabel = sz < 0 ? "前" : "後";
        parts.push({
          id: `standing-brace-${lrId}-${sz < 0 ? "front" : "back"}-z`,
          nameZh: `${lrLabel}${fbLabel}站牙（側）`,
          material,
          grainDirection: "length",
          visible: { length: braceThickness, width: standingBraceSize, thickness: standingBraceSize },
          origin: { x: sx * (braceOuterX + braceThickness / 2), y: skirtHeight, z: sz * (postZ - standingBraceSize / 2) },
          shape: braceShape,
          tenons: [],
          mortises: [],
        });
      }
    }
    // 沿 X 軸方向的站牙（前後面）—4 個
    for (const sz of [-1, 1] as const) {
      const fbId = sz < 0 ? "front" : "back";
      const fbLabel = sz < 0 ? "前" : "後";
      for (const sx of [-1, 1] as const) {
        const lrLabel = sx < 0 ? "左" : "右";
        parts.push({
          id: `standing-brace-${fbId}-${sx < 0 ? "left" : "right"}-x`,
          nameZh: `${fbLabel}${lrLabel}站牙（前後）`,
          material,
          grainDirection: "length",
          visible: { length: standingBraceSize, width: braceThickness, thickness: standingBraceSize },
          origin: { x: sx * (postX - standingBraceSize / 2), y: skirtHeight, z: sz * (braceOuterZ + braceThickness / 2) },
          shape: braceShape,
          tenons: [],
          mortises: [],
        });
      }
    }
  }

  // ── 絛環板：頂蓋下方一條裝飾橫帶（清式櫃靈魂橫條）
  // 位置：上抹頂面之上、頂蓋底面之下的薄帶（避開背板 Y 區間）
  // 只裝前面（背面有背板擋住沒人看；之前裝後面會跟背板重疊）
  // 頂箱櫃模式：絛環板下櫃看不到（被頂箱底蓋遮住），只裝頂箱底蓋下方
  // 但本輪先把絛環板鎖在「下櫃 upperRail」上方，topBox 模式下絛環板改畫
  // 在頂箱頂部下方（之後再支援，本輪先不畫絛環板於頂箱模式）
  if (friezePanel !== "none" && !isCompound) {
    const friezeThickness = Math.max(10, panelThickness);
    // 絛環板 Y：移到「上抹頂面之下、板心區內最上端」當束腰板（傳統明式做法）
    // 之前 friezeY = upperRailY 是上抹「底面」y，frieze 從那往上 50mm 整個鑽進
    // 上抹 + 凸破頂蓋 5mm（B 報告 cf3bdd6 → 6f0b1ae 共 7 commit 都這 bug）
    const friezeY = upperRailY - friezeHeight;
    // 確保不超過板心頂端（避開鑽到下抹）
    const friezeYClamped = Math.max(lowerRailY + railWidth + 10, friezeY);
    const friezeLen = 2 * (postX - postSize / 2) - 4;
    const friezeZ = -(postZ + postSize / 2 - friezeThickness / 2);
    // 主絛環板背板（薄板）
    parts.push({
      id: "frieze-panel-front",
      nameZh: "前絛環板",
      material,
      grainDirection: "length",
      visible: { length: friezeLen, width: friezeThickness, thickness: friezeHeight },
      origin: { x: 0, y: friezeYClamped, z: friezeZ },
      tenons: [],
      mortises: [],
    });
    // 視覺差異化：lattice = 田字格內條陣列；openwork = face-rounded 圓鈍頭橫條
    // 都用小厚度凸出薄板 3mm 表達裝飾紋
    if (friezePanel === "lattice") {
      // 田字格：1 條中央橫 + 4 條等分直
      // 厚度從 3mm 拉到 6mm、櫺寬從 8mm 拉到 12mm，3D 透視才看得清
      const overlayThickness = 6;
      const overlayBarT = 12;
      const overlayZ = friezeZ - friezeThickness / 2 - overlayThickness / 2;
      // 中央橫桿
      parts.push({
        id: "frieze-overlay-h",
        nameZh: "絛環中央橫條",
        material,
        grainDirection: "length",
        visible: { length: friezeLen - 12, width: overlayThickness, thickness: overlayBarT },
        origin: { x: 0, y: friezeYClamped + friezeHeight / 2 - overlayBarT / 2, z: overlayZ },
        tenons: [],
        mortises: [],
      });
      // 4 條等分直櫺（橫條上下各半）
      for (let i = 1; i <= 4; i++) {
        const tFrac = i / 5;
        parts.push({
          id: `frieze-overlay-v${i}`,
          nameZh: `絛環直櫺${i}`,
          material,
          grainDirection: "length",
          visible: { length: overlayBarT, width: overlayThickness, thickness: friezeHeight - 12 },
          origin: { x: -friezeLen / 2 + tFrac * friezeLen - overlayBarT / 2, y: friezeYClamped + 6, z: overlayZ },
          tenons: [],
          mortises: [],
        });
      }
    } else if (friezePanel === "openwork") {
      // 透雕：3 個雲頭 cornerR 鈍頭裝飾條（face-rounded 大 cornerR）
      const overlayThickness = 4;
      const overlayBarT = 30;
      const overlayZ = friezeZ - friezeThickness / 2 - overlayThickness / 2;
      const cloudShape: Part["shape"] = { kind: "face-rounded", cornerR: 14, bendMm: 0, bendAxis: "z" };
      for (let i = 0; i < 3; i++) {
        const tFrac = (i + 0.5) / 3;
        parts.push({
          id: `frieze-cloud-${i + 1}`,
          nameZh: `絛環雲頭${i + 1}`,
          material,
          grainDirection: "length",
          visible: { length: overlayBarT * 1.6, width: overlayThickness, thickness: overlayBarT },
          origin: { x: -friezeLen / 2 + tFrac * friezeLen - overlayBarT * 0.8, y: friezeYClamped + friezeHeight / 2 - overlayBarT / 2, z: overlayZ },
          shape: cloudShape,
          tenons: [],
          mortises: [],
        });
      }
    }
  }

  // ── 亮格櫃 / 万歷櫃：頂端最上層 shelf 加圍欄（直櫺 / 卷草），3 面圍
  // 找最上層 shelf（layer index 越高 = 越上層）；取 layerBottomYs + layerHeights
  if (balustradeStyle !== "none") {
    let topShelfIdx = -1;
    for (let i = layerCount - 1; i >= 0; i--) {
      if (layerTypes[i] === "shelf") { topShelfIdx = i; break; }
    }
    // 沒 shelf 時自動把最上層轉 shelf（万歷櫃形制需求）
    if (topShelfIdx < 0 && layerCount > 0) {
      topShelfIdx = layerCount - 1;
      layerTypes[topShelfIdx] = "shelf";
    }
    if (topShelfIdx >= 0) {
      const baluBottomY = layerBottomYs[topShelfIdx] + (layerHeights[topShelfIdx] ?? 0);  // shelf 頂面（下個層的底）
      // 圍欄頂高 = baluBottomY + balustradeHeight，但不能超過上抹
      const baluTopY = Math.min(baluBottomY + balustradeHeight, upperRailY - 10);
      const actualBaluH = baluTopY - baluBottomY;
      const baluRailThick = 18;  // 上下圍欄橫桿厚度
      const spindleSize = 10;     // 直櫺杆方料
      // 防呆：shelf 太高 / 上抹太低時 actualBaluH ≤ 2*baluRailThick 圍欄塞不下，
      // 之前沒擋會讓 spindleH 變負（reviewer b22f4d1 抓到）。直接 skip 整個圍欄渲染
      const baluFits = actualBaluH > baluRailThick * 2 + 10;
      if (baluFits) {
      // 前 + 左 + 右 三面（背面有背板不需要）
      const baluFaces: Array<{ axis: "x" | "z"; sign: -1 | 1 }> = [
        { axis: "z", sign: -1 },  // 前
        { axis: "x", sign: -1 },  // 左
        { axis: "x", sign: 1 },   // 右
      ];
      for (const f of baluFaces) {
        const isFront = f.axis === "z";
        const faceLabel = f.axis === "z" ? "前" : f.sign < 0 ? "左" : "右";
        const spanLen = isFront ? 2 * (postX - postSize / 2) - 4 : 2 * (postZ - postSize / 2) - 4;
        // 圍欄橫桿放在立柱內側 + baluRailThick/2，不再 -2（會穿入立柱 AABB）
        const baseX = isFront ? 0 : f.sign * (postX - postSize / 2 - baluRailThick / 2);
        const baseZ = isFront ? f.sign * (postZ - postSize / 2 - baluRailThick / 2) : 0;
        // 上下圍欄橫桿
        for (const railRole of ["upper", "lower"] as const) {
          const railY = railRole === "upper" ? baluTopY - baluRailThick : baluBottomY;
          parts.push({
            id: `balustrade-${faceLabel === "前" ? "front" : faceLabel === "左" ? "left" : "right"}-${railRole}-rail`,
            nameZh: `${faceLabel}圍欄${railRole === "upper" ? "上" : "下"}橫桿`,
            material,
            grainDirection: "length",
            visible: isFront
              ? { length: spanLen, width: baluRailThick, thickness: baluRailThick }
              : { length: baluRailThick, width: spanLen, thickness: baluRailThick },
            origin: { x: baseX, y: railY, z: baseZ },
            tenons: [],
            mortises: [],
          });
        }
        // 5 根直櫺杆（vertical 樣式）/ 卷草用 face-rounded 弧線
        const spindleCount = balustradeStyle === "vertical" ? 5 : 3;
        const spindleH = actualBaluH - baluRailThick * 2;
        const spindleY = baluBottomY + baluRailThick;
        const spindleShape: Part["shape"] | undefined =
          balustradeStyle === "scroll"
            ? { kind: "face-rounded", cornerR: 4, bendMm: 8, bendAxis: "y" }
            : undefined;
        for (let s = 0; s < spindleCount; s++) {
          const tFrac = (s + 0.5) / spindleCount;  // 均分
          const offset = (tFrac - 0.5) * (spanLen - 30);  // 兩端各留 15mm
          const sx = isFront ? offset : baseX;
          const sz = isFront ? baseZ : offset;
          parts.push({
            id: `balustrade-${faceLabel === "前" ? "front" : faceLabel === "左" ? "left" : "right"}-spindle-${s + 1}`,
            nameZh: `${faceLabel}圍欄櫺杆${s + 1}`,
            material,
            grainDirection: "length",
            visible: { length: spindleSize, width: spindleSize, thickness: spindleH },
            origin: { x: sx, y: spindleY, z: sz },
            ...(spindleShape ? { shape: spindleShape } : {}),
            tenons: [],
            mortises: [],
          });
        }
      }
      }
    }
  }

  const layerSummary = layerTypes.map((t, i) => `${i + 1}=${t === "door" ? "對開門" : t === "drawer" ? "抽屜" : "層板"}`).join(" / ");

  // ── 頂箱櫃：在主櫃頂蓋之上堆一段縮小版 frame-and-panel
  // 上頂箱結構：4 立柱（短）+ 4 面 上下抹+板心 + 頂蓋 + 1-2 層門
  // Y 範圍：mainTopWithCap = postTopY + topThickness（主櫃頂蓋頂面）
  //         tbBaseY = mainTopWithCap + waistGap（5mm 縫隙—兩段獨立分件）
  //         tbHeight = topBoxHeight
  if (isCompound) {
    const tbBaseY = postTopY + topThickness + waistGap;
    const tbPostSize = Math.max(28, postSize - 8);  // 頂箱立柱比下櫃略細
    const tbRailWidth = Math.max(35, railWidth - 10);
    const tbTopThickness = Math.max(15, topThickness - 6);
    const tbTopOverhang = Math.max(10, topOverhang - 5);
    // 頂箱寬深略縮（明清做法是上小下大），縮 30mm
    const tbInsetXZ = 15;
    const tbLength = length - tbInsetXZ * 2;
    const tbWidth = width - tbInsetXZ * 2;
    const tbPostX = tbLength / 2 - tbPostSize / 2;
    const tbPostZ = tbWidth / 2 - tbPostSize / 2;
    const tbPostTopY = tbBaseY + topBoxHeight - tbTopThickness;
    const tbRailLenX = 2 * (tbPostX + tbPostSize / 2);
    const tbRailLenZ = 2 * (tbPostZ + tbPostSize / 2);
    const tbInnerSpanX = 2 * (tbPostX - tbPostSize / 2);
    const tbInnerSpanZ = 2 * (tbPostZ - tbPostSize / 2);
    const tbPanelInnerW_Z = tbInnerSpanZ - 10;
    const tbUpperRailY = tbPostTopY - tbRailWidth;
    const tbLowerRailY = tbBaseY;  // 頂箱底直接坐主櫃頂蓋（無 skirt）
    const tbInnerH = tbUpperRailY - (tbLowerRailY + tbRailWidth);
    const tbSideRailOffsetX = tbPostX + tbPostSize / 2 - railThickness / 2;
    const tbFbRailOffsetZ = tbPostZ + tbPostSize / 2 - railThickness / 2;
    const tbPanelH = tbInnerH + 10;

    // 4 立柱
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const fbId = sz < 0 ? "front" : "back";
        const lrId = sx < 0 ? "left" : "right";
        const fbLabel = sz < 0 ? "前" : "後";
        const lrLabel = sx < 0 ? "左" : "右";
        parts.push({
          id: `tb-post-${fbId}-${lrId}`,
          nameZh: `頂箱${fbLabel}${lrLabel}立柱`,
          material,
          grainDirection: "length",
          visible: { length: tbPostSize, width: tbPostSize, thickness: topBoxHeight - tbTopThickness },
          origin: { x: sx * tbPostX, y: tbBaseY, z: sz * tbPostZ },
          tenons: [],
          mortises: [],
        });
      }
    }
    // 4 面 frame-and-panel（左右 + 前後）
    for (const sx of [-1, 1] as const) {
      const lrId = sx < 0 ? "left" : "right";
      const lrLabel = sx < 0 ? "左" : "右";
      for (const railRole of ["upper", "lower"] as const) {
        const railY = railRole === "upper" ? tbUpperRailY : tbLowerRailY;
        const roleLabel = railRole === "upper" ? "上抹" : "下抹";
        parts.push({
          id: `tb-${lrId}-side-${railRole}-rail`,
          nameZh: `頂箱${lrLabel}側${roleLabel}`,
          material,
          grainDirection: "length",
          visible: { length: railThickness, width: tbRailLenZ, thickness: tbRailWidth },
          origin: { x: sx * tbSideRailOffsetX, y: railY, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      // 板心（側面，背面方向相同——即左右側板心不會被門擋）
      parts.push({
        id: `tb-${lrId}-side-panel`,
        nameZh: `頂箱${lrLabel}側板心`,
        material,
        grainDirection: "length",
        visible: { length: panelThickness, width: tbPanelInnerW_Z, thickness: tbPanelH },
        origin: { x: sx * tbSideRailOffsetX, y: tbLowerRailY + tbRailWidth - 5, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
    // 前/後面 frame：前面跟側面同 rail（上下抹）；後面除 rail 外還有板心
    for (const sz of [-1, 1] as const) {
      const fbId = sz < 0 ? "front" : "back";
      const fbLabel = sz < 0 ? "前" : "後";
      for (const railRole of ["upper", "lower"] as const) {
        const railY = railRole === "upper" ? tbUpperRailY : tbLowerRailY;
        const roleLabel = railRole === "upper" ? "上抹" : "下抹";
        parts.push({
          id: `tb-${fbId}-${railRole}-rail`,
          nameZh: `頂箱${fbLabel}${roleLabel}`,
          material,
          grainDirection: "length",
          visible: { length: tbRailLenX, width: railThickness, thickness: tbRailWidth },
          origin: { x: 0, y: railY, z: sz * tbFbRailOffsetZ },
          tenons: [],
          mortises: [],
        });
      }
    }
    parts.push({
      id: "tb-back-panel",
      nameZh: "頂箱背板",
      material,
      grainDirection: "length",
      visible: { length: tbInnerSpanX - 10, width: panelThickness, thickness: tbPanelH },
      origin: { x: 0, y: tbLowerRailY + tbRailWidth - 5, z: tbFbRailOffsetZ },
      tenons: [],
      mortises: [],
    });
    // 前面對開門（topBoxLayers=1 一對門到頂；topBoxLayers=2 上方加一條小抽屜）
    // 厚度 = railThickness（跟前抹齊厚），不能比 rail 薄否則 z-order 被 rail 蓋住看不見
    const tbDoorGap = doorGap;
    const tbDoorThickness = railThickness;
    const tbDoorBottomY = tbLowerRailY + tbRailWidth;
    const tbDoorH = tbInnerH;
    let tbDrawerH = 0;
    if (topBoxLayers === 2) {
      // 抽屜佔頂箱內部 1/4 高度（最少 80mm 最多 160mm）
      tbDrawerH = Math.max(80, Math.min(160, Math.round(tbInnerH * 0.25)));
    }
    const tbDoorActualH = tbDoorH - tbDrawerH;
    const tbDoorWidth = (tbInnerSpanX - tbDoorGap) / 2;
    // 門 / 抽屜面 z 中心 = 跟前抹同 z 中心 = -tbFbRailOffsetZ（負 = 前面）
    const tbDoorZ = -tbFbRailOffsetZ;
    for (const sx of [-1, 1] as const) {
      const lrId = sx < 0 ? "left" : "right";
      const lrLabel = sx < 0 ? "左" : "右";
      parts.push({
        id: `tb-door-${lrId}`,
        nameZh: `頂箱${lrLabel}門板`,
        material,
        grainDirection: "length",
        visible: { length: tbDoorWidth, width: tbDoorThickness, thickness: tbDoorActualH },
        origin: { x: sx * (tbDoorGap / 2 + tbDoorWidth / 2), y: tbDoorBottomY, z: tbDoorZ },
        tenons: [],
        mortises: [],
      });
    }
    if (topBoxLayers === 2) {
      // 頂箱小抽屜（橫貫頂箱前面，位於門板上方）— 完整 5 件抽屜盒
      const tbDrawerSideT = 12;       // 抽屜左右側板厚
      const tbDrawerBackT = 12;       // 抽屜後板厚
      const tbDrawerBottomT = 6;      // 抽屜底板厚
      const tbDrawerY = tbDoorBottomY + tbDoorActualH + 2;
      const tbDrawerW = tbDrawerH - 4;
      const tbDrawerLen = tbInnerSpanX - 4;
      const tbDrawerDepth = tbWidth - 30;  // 抽屜深 = 頂箱內深 - 30mm 餘量
      // 1. 抽屜面板
      parts.push({
        id: "tb-drawer-front",
        nameZh: "頂箱抽屜面板",
        material,
        grainDirection: "length",
        visible: { length: tbDrawerLen, width: tbDoorThickness, thickness: tbDrawerW },
        origin: { x: 0, y: tbDrawerY, z: tbDoorZ },
        tenons: [],
        mortises: [],
      });
      // 2-3. 抽屜左右側板
      for (const sx of [-1, 1] as const) {
        const lrId = sx < 0 ? "left" : "right";
        const lrLabel = sx < 0 ? "左" : "右";
        parts.push({
          id: `tb-drawer-side-${lrId}`,
          nameZh: `頂箱抽屜${lrLabel}側板`,
          material,
          grainDirection: "length",
          visible: { length: tbDrawerSideT, width: tbDrawerDepth, thickness: tbDrawerW },
          origin: { x: sx * (tbDrawerLen / 2 - tbDrawerSideT / 2), y: tbDrawerY, z: tbDoorZ + tbDoorThickness / 2 + tbDrawerDepth / 2 },
          tenons: [],
          mortises: [],
        });
      }
      // 4. 抽屜後板
      parts.push({
        id: "tb-drawer-back",
        nameZh: "頂箱抽屜後板",
        material,
        grainDirection: "length",
        visible: { length: tbDrawerLen - tbDrawerSideT * 2, width: tbDrawerBackT, thickness: tbDrawerW - 8 },
        origin: { x: 0, y: tbDrawerY + 4, z: tbDoorZ + tbDoorThickness / 2 + tbDrawerDepth - tbDrawerBackT / 2 },
        tenons: [],
        mortises: [],
      });
      // 5. 抽屜底板
      parts.push({
        id: "tb-drawer-bottom",
        nameZh: "頂箱抽屜底板",
        material,
        grainDirection: "length",
        visible: { length: tbDrawerLen - tbDrawerSideT * 2, width: tbDrawerDepth - 8, thickness: tbDrawerBottomT },
        origin: { x: 0, y: tbDrawerY + 2, z: tbDoorZ + tbDoorThickness / 2 + tbDrawerDepth / 2 },
        tenons: [],
        mortises: [],
      });
      // 6. 拉手（圓銅環）
      if (doorPullType !== "none") {
        const pullSize = doorPullType === "round-brass" ? 30 : 60;
        const pullW = doorPullType === "round-brass" ? 30 : 18;
        parts.push({
          id: "tb-drawer-pull",
          nameZh: "頂箱抽屜拉手",
          material,
          grainDirection: "length",
          visible: { length: pullSize, width: 5, thickness: pullW },
          origin: { x: 0, y: tbDrawerY + tbDrawerW / 2 - pullW / 2, z: tbDoorZ - tbDoorThickness / 2 - 3 },
          visual: "brass-antique",
          ...(doorPullType === "round-brass" ? { shape: { kind: "face-rounded", cornerR: 14, bendMm: 0, bendAxis: "z" } as const } : {}),
          tenons: [],
          mortises: [],
        });
      }
    }
    // 頂箱頂蓋
    parts.push({
      id: "tb-top",
      nameZh: "頂箱頂蓋",
      material,
      grainDirection: "length",
      visible: { length: tbLength + tbTopOverhang * 2, width: tbWidth + tbTopOverhang * 2, thickness: tbTopThickness },
      origin: { x: 0, y: tbPostTopY, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  const design: FurnitureDesign = {
    id: `chinese-cabinet-${length}x${width}x${heightInput}`,
    category: "chinese-cabinet",
    nameZh: isCompound ? "中式頂箱櫃" : "中式方角櫃",
    overall: { length, width, thickness: heightInput },
    parts,
    defaultJoinery: "shouldered-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `${isCompound ? "中式頂箱櫃（compound）" : isRoundCorner ? "中式圓角櫃（splay-leg）" : "中式方角櫃"}（明式邊抹板心）：4 立柱 ${postSize}mm + 6 面框板（邊抹 ${railWidth}×${railThickness}mm + 板心 ${panelThickness}mm）+ ${skirtStyle === "arched" ? "壼門" : skirtStyle === "cloud-head" ? "雲頭" : "直線素牙"}（高 ${skirtHeight}mm）。${layerCount} 層配置：${layerSummary}。框角全帶肩榫；4 立柱頂角為粽角榫（三向交會：上抹+側抹+頂蓋）—明式櫃靈魂榫卯，傳統做法是立柱頂端開十字槽容納兩條抹頭+頂蓋；板心浮放於框內槽 5mm 深，不黏死讓木材吐縮不爆裂。${balustradeStyle !== "none" ? "頂層設 shelf 配圍欄即成万歷櫃形制。" : ""}${standingBraceStyle !== "none" ? "立柱底加站牙穩固。" : ""}${friezePanel !== "none" ? "頂蓋下絛環板裝飾橫帶。" : ""}${panelInlayActive ? "板心嵌屏心（中央開光）。" : ""}`,
  };

  applyStandardChecks(design, {
    minLength: 500, minWidth: 250, minHeight: 600,
    maxLength: 1500, maxWidth: 600, maxHeight: isCompound ? 2600 : 2200,
  });
  return design;
};
