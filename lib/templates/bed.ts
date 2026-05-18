import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import {
  corners,
  rectLegShape,
  RECT_LEG_SHAPE_CHOICES,
  legEdgeOption,
  legEdgeStyleOption,
  legEdgeShape,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  legShapeLabel,
  parseLegChamferMm,
  legBottomScale,
  legScaleAt,
  computeCompoundSplayNormal,
} from "./_helpers";
import { applyStandardChecks, appendWarnings } from "./_validators";
import { SPLAY_ANGLE } from "@/lib/knowledge/chair-geometry";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

/**
 * 床（bed）—— 木製傳統 4 腳床架
 *
 * 結構：
 *  - 4 × 床腳（legs）：頭端 2 腳通常較高（為了接床頭板），尾端 2 腳同高度（連床頭）
 *  - 2 × 側板（side rails，長邊 X 軸）：左右兩條，承重要件
 *  - 1 × 床頭板（headboard，Z 軸跨）：高，靠背功能
 *  - 0/1 × 床尾板（footboard）：可選，現代款常省略
 *  - N × 床板條（slats）：沿短邊（Z 軸）等距排，間距 ≤ 100mm 護腰
 *  - 2 × 內側 ledger strip：黏在 side rail 內側下緣，slats 擱上去
 *
 * 接合（套用 square-stool 規則）：
 *  - side-rail ↔ leg：依自動規則（≤25mm 通榫 +5mm；>25mm 盲榫 2/3）
 *    legPenetratingTenon=true 強制通榫
 *  - headboard ↔ head leg：同上
 *  - footboard ↔ foot leg：同上
 *  - slats：butt joint 擱在 ledger 上，不開榫（可拆換洗）
 *
 * 預設：雙人床 5×6.2 ft = 1525×1900mm，總高 700mm（床頭板高 800mm 從地）
 *  - leg height 450mm（床腳上緣 = mattress 底面位置 250mm + 鬆量）
 *  - mattress clearance 250mm（床板距地）
 *  - 床頭板高 800mm（從地板到頂端）
 *
 * 台灣常見尺寸：
 *  - 單人 3.5×6.2 ft = 1067×1900
 *  - 雙人 5×6.2 ft = 1525×1900
 *  - 加大 5.5×6.5 ft = 1676×1981
 *  - 特大 6×6.5 ft = 1828×1981
 */

/**
 * bedPreset 風格預設：一鍵套用 5 個影響 layout 最大的參數初始值（mm 級）
 * - 採「user 沒覆寫 default 才以 preset 為準」邏輯（與 chinese-cabinet 一致）
 * - 不覆寫 slat / ledger / edge 等細部，user 後改不蓋
 */
interface BedPresetConfig {
  legSize?: number;
  legShape?: string;
  sideRailWidth?: number;
  mattressClearanceMm?: number;
  headboardHeight?: number;
  headStyle?: string;
  withFootboard?: boolean;
  footboardHeight?: number;
  slatGapMm?: number;
}

const BED_PRESETS: Record<string, BedPresetConfig> = {
  // 北歐簡約：細腳 tapered、低背、無床尾板
  nordic: { legSize: 60, legShape: "tapered", sideRailWidth: 150, mattressClearanceMm: 220, headboardHeight: 700, headStyle: "panel", withFootboard: false, slatGapMm: 80 },
  // 工業風：厚重 box leg、無床尾板
  industrial: { legSize: 70, legShape: "box", sideRailWidth: 180, mattressClearanceMm: 280, headboardHeight: 600, headStyle: "panel", withFootboard: false, slatGapMm: 90 },
  // 日式平床（榻榻米款）：低床、矮頭板
  "japanese-platform": { legSize: 70, legShape: "box", sideRailWidth: 200, mattressClearanceMm: 180, headboardHeight: 500, headStyle: "panel", withFootboard: false, slatGapMm: 70 },
  // 明式架子床（柱頭框先不做、headboard 加高）
  "ming-canopy": { legSize: 90, legShape: "box", sideRailWidth: 200, mattressClearanceMm: 320, headboardHeight: 1100, headStyle: "spindled", withFootboard: true, footboardHeight: 600, slatGapMm: 80 },
  // 黃花梨四柱床（高床、加長頭板、加床尾板）
  "huanghuali-4post": { legSize: 100, legShape: "tapered", sideRailWidth: 220, mattressClearanceMm: 350, headboardHeight: 1300, headStyle: "panel-frame", withFootboard: true, footboardHeight: 700, slatGapMm: 80 },
  // 拔步床（明清頂級臥具，極高床+極高背）
  "babu-alcove": { legSize: 110, legShape: "box", sideRailWidth: 240, mattressClearanceMm: 380, headboardHeight: 1400, headStyle: "panel-frame", withFootboard: true, footboardHeight: 800, slatGapMm: 80 },
  // 高腳掀床（儲物用、加高 sideRail）
  "storage-lift": { legSize: 90, legShape: "box", sideRailWidth: 280, mattressClearanceMm: 420, headboardHeight: 800, headStyle: "panel", withFootboard: false, slatGapMm: 90 },
  // 兒童床（細腳、矮、加床尾欄當圍欄）
  kids: { legSize: 60, legShape: "box", sideRailWidth: 160, mattressClearanceMm: 260, headboardHeight: 700, headStyle: "spindled", withFootboard: true, footboardHeight: 500, slatGapMm: 70 },
};

export const bedOptions: OptionSpec[] = [
  // ---------- 風格預設 ----------
  { group: "preset", type: "select", key: "bedPreset", label: "風格預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（不套 preset）" },
    { value: "nordic", label: "北歐簡約（tapered 細腳、低背、無尾板）" },
    { value: "industrial", label: "工業風（厚重直腳、矮背）" },
    { value: "japanese-platform", label: "日式平床（榻榻米、低床矮頭板）" },
    { value: "ming-canopy", label: "明式架子床（高背、含尾板）" },
    { value: "huanghuali-4post", label: "黃花梨四柱床（高背 1300mm、含尾板）" },
    { value: "babu-alcove", label: "拔步床（極高背 1400mm、頂級臥具）" },
    { value: "storage-lift", label: "高腳掀床（高側板、儲物用）" },
    { value: "kids", label: "兒童床（細腳、矮、含床尾欄）" },
  ], help: "一鍵套用 5 個關鍵尺寸初始值。user 修改後仍以 user 值為準（preset 只蓋預設）。" },

  // ---------- 腳 ----------
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 80, min: 50, max: 150, step: 5, unit: "mm", help: "床腳要承重，建議 70mm 起跳；明式架子床常 90~100mm" },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 100, step: 5, unit: "mm", help: "腳中心離側板外緣的內縮量；0 = 腳貼齊外緣" },
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度 (°)", defaultValue: 0, min: 0, max: SPLAY_ANGLE.stoolMaxDeg, step: 0.5, unit: "°", help: "斜腳系列才有效；床腳通常直立（0°）以便對牆。" },
  legEdgeOption("leg", 0),
  legEdgeStyleOption("leg"),

  // ---------- 床頭板 ----------
  { group: "back", type: "select", key: "headStyle", label: "床頭樣式", defaultValue: "panel", choices: [
    { value: "panel", label: "平實板（一片整板，最簡單）" },
    { value: "spindled", label: "直柵欄（N 根直立木條，明式 / 兒童床）" },
    { value: "panel-frame", label: "嵌板框（外框 + 中央嵌板，黃花梨 / 拔步床）" },
    { value: "arched", label: "拱頂（板頂收弧，現代款）" },
    { value: "slatted-horizontal", label: "橫板條（N 條橫木，斯堪地維亞）" },
    { value: "tufted-look", label: "軟包仿木（板面分格仿軟包紋）" },
    { value: "crested", label: "中央高冠（中段凸起，維多利亞）" },
    { value: "fielded", label: "起線板（板心凸出有斜邊框）" },
  ], help: "8 種床頭樣式。spindled / panel-frame 用多塊木料拼接，其他用單片板加 silhouette 變化。" },
  { group: "back", type: "number", key: "headboardHeight", label: "床頭板高 (mm)", defaultValue: 800, min: 400, max: 1500, step: 10, unit: "mm", help: "從地板到床頭板頂端的總高度。常見 700~1000；高背床 1100+" },
  { group: "back", type: "number", key: "headboardThickness", label: "床頭板厚 (mm)", defaultValue: 25, min: 18, max: 50, step: 1, unit: "mm" },
  { group: "back", type: "number", key: "headSpindleCount", label: "直柵欄數", defaultValue: 7, min: 3, max: 15, step: 1, help: "spindled 樣式的直立木條數量", dependsOn: { key: "headStyle", equals: "spindled" } },
  { group: "back", type: "number", key: "headSpindleSize", label: "直柵欄粗 (mm)", defaultValue: 30, min: 20, max: 60, step: 5, unit: "mm", help: "spindled 直立木條的粗細（方料）", dependsOn: { key: "headStyle", equals: "spindled" } },

  // ---------- 床尾板 ----------
  { group: "back", type: "checkbox", key: "withFootboard", label: "加床尾板", defaultValue: false, help: "傳統明式有，現代款常省略。勾選後尾端立板高 = 床尾板高" },
  { group: "back", type: "number", key: "footboardHeight", label: "床尾板高 (mm)", defaultValue: 500, min: 250, max: 1000, step: 10, unit: "mm", dependsOn: { key: "withFootboard", equals: true } },
  { group: "back", type: "number", key: "footboardThickness", label: "床尾板厚 (mm)", defaultValue: 25, min: 18, max: 50, step: 1, unit: "mm", dependsOn: { key: "withFootboard", equals: true } },

  // ---------- 側板 ----------
  { group: "apron", type: "number", key: "sideRailWidth", label: "側板高 (mm)", defaultValue: 180, min: 120, max: 300, step: 10, unit: "mm", help: "側板上下方向的高度（= 牙板高度）。床承重大，建議 150mm 起跳" },
  { group: "apron", type: "number", key: "sideRailThickness", label: "側板厚 (mm)", defaultValue: 30, min: 20, max: 50, step: 1, unit: "mm" },
  { group: "apron", type: "number", key: "mattressClearanceMm", label: "床板距地高 (mm)", defaultValue: 250, min: 150, max: 500, step: 10, unit: "mm", help: "從地板到床板頂面的高度；mattress 上緣 = 此值 + 床墊厚（約 200~300mm）" },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：側板/床頭板進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },

  // ---------- 床板條 ----------
  { group: "stretcher", type: "number", key: "slatGapMm", label: "床板條間距 (mm)", defaultValue: 80, min: 30, max: 100, step: 5, unit: "mm", help: "相鄰 slats 中心距減去 slat 寬。≤100mm 才能護腰避免床墊塌陷" },
  { group: "stretcher", type: "number", key: "slatWidthMm", label: "床板條寬 (mm)", defaultValue: 80, min: 50, max: 150, step: 5, unit: "mm" },
  { group: "stretcher", type: "number", key: "slatThicknessMm", label: "床板條厚 (mm)", defaultValue: 18, min: 12, max: 30, step: 1, unit: "mm" },
  { group: "stretcher", type: "number", key: "ledgerWidthMm", label: "ledger 撐條寬 (mm)", defaultValue: 30, min: 20, max: 60, step: 5, unit: "mm", help: "釘在側板內側下緣，slats 擱上去。寬度 = 上下方向高度" },
  { group: "stretcher", type: "number", key: "ledgerThicknessMm", label: "ledger 撐條厚 (mm)", defaultValue: 25, min: 18, max: 40, step: 1, unit: "mm", help: "從側板向床中心凸出的厚度" },
  stretcherEdgeOption("stretcher", 0),
  stretcherEdgeStyleOption("stretcher"),
];

export const bed: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;

  const o = bedOptions;
  const bedPreset = getOption<string>(input, opt(o, "bedPreset"));
  const preset = BED_PRESETS[bedPreset];
  // preset 只蓋仍是 default 值的 option（與 chinese-cabinet 一致）
  const legShapeRaw = getOption<string>(input, opt(o, "legShape"));
  const legShape = legShapeRaw === "box" && preset?.legShape ? preset.legShape : legShapeRaw;
  const legSizeRaw = getOption<number>(input, opt(o, "legSize"));
  const legSize = legSizeRaw === 80 && preset?.legSize !== undefined ? preset.legSize : legSizeRaw;
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const legEdge = getOption<string>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const headboardHeightRaw = getOption<number>(input, opt(o, "headboardHeight"));
  const headboardHeight = headboardHeightRaw === 800 && preset?.headboardHeight !== undefined ? preset.headboardHeight : headboardHeightRaw;
  const headboardThickness = getOption<number>(input, opt(o, "headboardThickness"));
  const headStyleRaw = getOption<string>(input, opt(o, "headStyle"));
  const headStyle = headStyleRaw === "panel" && preset?.headStyle ? preset.headStyle : headStyleRaw;
  const headSpindleCount = getOption<number>(input, opt(o, "headSpindleCount"));
  const headSpindleSize = getOption<number>(input, opt(o, "headSpindleSize"));
  const withFootboardRaw = getOption<boolean>(input, opt(o, "withFootboard"));
  const withFootboard = withFootboardRaw === false && preset?.withFootboard !== undefined ? preset.withFootboard : withFootboardRaw;
  const footboardHeightRaw = getOption<number>(input, opt(o, "footboardHeight"));
  const footboardHeight = footboardHeightRaw === 500 && preset?.footboardHeight !== undefined ? preset.footboardHeight : footboardHeightRaw;
  const footboardThickness = getOption<number>(input, opt(o, "footboardThickness"));
  const sideRailWidthRaw = getOption<number>(input, opt(o, "sideRailWidth"));
  const sideRailWidth = sideRailWidthRaw === 180 && preset?.sideRailWidth !== undefined ? preset.sideRailWidth : sideRailWidthRaw;
  const sideRailThickness = getOption<number>(input, opt(o, "sideRailThickness"));
  const mattressClearanceMmRaw = getOption<number>(input, opt(o, "mattressClearanceMm"));
  const mattressClearanceMm = mattressClearanceMmRaw === 250 && preset?.mattressClearanceMm !== undefined ? preset.mattressClearanceMm : mattressClearanceMmRaw;
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const slatGapMmRaw = getOption<number>(input, opt(o, "slatGapMm"));
  const slatGapMm = slatGapMmRaw === 80 && preset?.slatGapMm !== undefined ? preset.slatGapMm : slatGapMmRaw;
  const slatWidthMm = getOption<number>(input, opt(o, "slatWidthMm"));
  const slatThicknessMm = getOption<number>(input, opt(o, "slatThicknessMm"));
  const ledgerWidthMm = getOption<number>(input, opt(o, "ledgerWidthMm"));
  const ledgerThicknessMm = getOption<number>(input, opt(o, "ledgerThicknessMm"));
  const stretcherEdge = getOption<string>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));

  // 床高邏輯：input.height 是「床架（不含床頭板）」整體高度，包含腳。
  // mattressClearanceMm = 床板頂面距地（slats 頂面）。
  // 側板上緣 = mattressClearanceMm（即 slats 擱在 ledger 上，slats 頂面 = side rail 頂面）
  // 為簡化：side rail 上緣對齊 mattressClearance，腳上緣 = side rail 上緣 = mattressClearance
  // 腳高 legHeight = mattressClearanceMm（腳整支從地到 side rail 頂面）
  const legHeight = mattressClearanceMm;
  // 頭/尾腳的「立柱延伸」: leg 本體只到 side rail 頂面，headboard / footboard 另
  // 用獨立板擋在 head-end / foot-end 兩腳之間。床頭板從地板（y=0）到 headboardHeight。
  // 床頭板厚向放在 z = -width/2 + headboardThickness/2 端面那邊。

  // ---------- joinery 標準（套用 square-stool 規則） ----------
  // 1) side-rail ↔ leg（X 軸長邊，最重要的承重接合）
  const sideRailTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const sideRailTenonStd = standardTenon({
    type: sideRailTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: sideRailThickness,
    childWidth: sideRailWidth,
    motherThickness: legSize,
  });
  // 通榫 +5mm 補償（即使床通常直立 splay=0，仍套用一致規則）
  const sideRailTenonLength = sideRailTenonStd.length + (sideRailTenonType === "through-tenon" ? 5 : 0);

  // 2) headboard ↔ head leg（Z 軸跨）
  const headboardTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  // 床頭板上半部高出腳，下半部嵌進腳之間。實際進腳的「榫頭高度」= 從 side-rail 頂面以下的進腳區段
  // 為簡化：headboard 整體 width = headboardHeight - mattressClearanceMm（離地高 = mattressClearance）
  const headboardPlateHeight = Math.max(100, headboardHeight - 0); // 整支板高 = 從地到頂
  const headboardTenonStd = standardTenon({
    type: headboardTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: headboardThickness,
    childWidth: Math.min(legHeight - 20, sideRailWidth), // 進腳的有效榫高 ≤ side-rail width
    motherThickness: legSize,
  });
  const headboardTenonLength = headboardTenonStd.length + (headboardTenonType === "through-tenon" ? 5 : 0);

  // 3) footboard ↔ foot leg（同 head）
  const footboardTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const footboardTenonStd = standardTenon({
    type: footboardTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: footboardThickness,
    childWidth: Math.min(legHeight - 20, sideRailWidth),
    motherThickness: legSize,
  });
  const footboardTenonLength = footboardTenonStd.length + (footboardTenonType === "through-tenon" ? 5 : 0);

  // ---------- 4 床腳 ----------
  // X = length（頭尾方向）；Z = width（左右方向）
  // 慣例：head 端 = -X，foot 端 = +X
  const cornerList = corners(length, width, legSize, legInset);
  // splay 支援（直立 0° 為預設；保留斜腳能力以套用同一套 helper）
  const splayMm = Math.round(Math.tan((splayAngle * Math.PI) / 180) * legHeight);

  const legs: Part[] = cornerList.map((c, i) => {
    // head end = c.x < 0；foot end = c.x > 0
    const isHead = c.x < 0;
    const isFoot = c.x > 0;
    return {
      id: `leg-${i + 1}`,
      nameZh: `${isHead ? "頭" : "尾"}腳 ${i + 1}（${c.z < 0 ? "左" : "右"}）`,
      material,
      grainDirection: "length",
      visible: { length: legSize, width: legSize, thickness: legHeight },
      origin: { x: c.x, y: 0, z: c.z },
      shape: rectLegShape(legShape, c, {
        splayedFrontOnly: false,
        splayMm,
        chamferMm: parseLegChamferMm(legEdge),
        chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered",
      }) ?? legEdgeShape(legEdge, legEdgeStyle),
      tenons: [],
      // mortises：side-rail（X 面，朝家具中心）+ headboard/footboard（Z 面對齊）
      // side rail 中心 Y = mattressClearance - sideRailWidth/2
      mortises: (() => {
        const mortises: Part["mortises"] = [];
        const sideRailCenterY_local = mattressClearanceMm - sideRailWidth / 2;
        // side-rail mortise 在腳的 X 面（接 side rail 沿 X 軸跑）
        // origin.x = ±1 朝家具中心（c.x > 0 → -1）
        mortises.push({
          origin: { x: c.x > 0 ? -1 : 1, y: sideRailCenterY_local, z: 0 },
          depth: sideRailTenonLength,
          length: sideRailTenonStd.width,
          width: sideRailTenonStd.thickness,
          through: sideRailTenonType === "through-tenon",
        });
        // headboard mortise 在頭端腳的 Z 面（接 headboard 沿 Z 軸跑）
        if (isHead) {
          mortises.push({
            origin: { x: 0, y: sideRailCenterY_local, z: c.z > 0 ? -1 : 1 },
            depth: headboardTenonLength,
            length: headboardTenonStd.width,
            width: headboardTenonStd.thickness,
            through: headboardTenonType === "through-tenon",
          });
        }
        // footboard mortise（可選）
        if (isFoot && withFootboard) {
          mortises.push({
            origin: { x: 0, y: sideRailCenterY_local, z: c.z > 0 ? -1 : 1 },
            depth: footboardTenonLength,
            length: footboardTenonStd.width,
            width: footboardTenonStd.thickness,
            through: footboardTenonType === "through-tenon",
          });
        }
        return mortises;
      })(),
    };
  });

  // ---------- 2 側板 ----------
  // butt-joint 慣例：visible.length = 端面對接長度（= 兩腳內面距離）
  // tapered 補償：腳 cross-section 隨 Y 線性變化，rail 端面要對到 rail Y 處實際腳寬
  const apronEdgeX = length / 2 - legSize / 2 - legInset;
  const apronEdgeZ = width / 2 - legSize / 2 - legInset;
  const sideRailY = mattressClearanceMm - sideRailWidth;
  const sideRailCenterY = mattressClearanceMm - sideRailWidth / 2;
  const bottomScale = legBottomScale(legShape);
  const railLegSizeAtCenter = legSize * legScaleAt(sideRailCenterY, legHeight, bottomScale);
  const railLegSizeAtTop = legSize * legScaleAt(mattressClearanceMm, legHeight, bottomScale);
  const railLegSizeAtBot = legSize * legScaleAt(sideRailY, legHeight, bottomScale);
  // rail Y 區間內腳的「最大」cross-section — 用來算 rail span，避免 tapered/inverted 任一方向腳寬都不會跟 rail 干涉
  const railLegSizeMax = Math.max(railLegSizeAtTop, railLegSizeAtBot, railLegSizeAtCenter);
  const sideRailInnerSpan = 2 * apronEdgeX - railLegSizeMax;
  // headboard / footboard 從地板 y=0 到頂端橫跨整個腳高，要考慮 y=0 的腳底寬（inverted 腳底較寬）
  const headLegSizeAtFloor = legSize * legScaleAt(0, legHeight, bottomScale);
  const headLegSizeMax = Math.max(railLegSizeMax, headLegSizeAtFloor);

  // splay tenon axis：side rail 是 axis="x"，splay 模式下端面跟著腳斜
  // 沿用 stool/bench 同 convention（axis="x" 牙條不需反轉 cornerSx）
  const splayDx = legShape === "splayed" || legShape === "splayed-length" ? splayMm : 0;
  const splayDz = legShape === "splayed" || legShape === "splayed-width" ? splayMm : 0;
  const railHasAxisSplay = splayDx > 0 || splayDz > 0;
  const railSplayAngleDeg = legHeight > 0 ? Math.atan(splayMm / legHeight) * 180 / Math.PI : 0;
  const sideRails: Part[] = [
    { id: "side-rail-left", nameZh: "左側板", sz: -1 as -1 | 1 },
    { id: "side-rail-right", nameZh: "右側板", sz: 1 as -1 | 1 },
  ].map(({ id, nameZh, sz }): Part => {
    const railTenonAxisStart = railHasAxisSplay
      ? computeCompoundSplayNormal({ apronAxis: "x", cornerSx: -1, cornerSz: sz, splayAngleDeg: railSplayAngleDeg })
      : null;
    const railTenonAxisEnd = railHasAxisSplay
      ? computeCompoundSplayNormal({ apronAxis: "x", cornerSx: +1, cornerSz: sz, splayAngleDeg: railSplayAngleDeg })
      : null;
    return {
      id,
      nameZh,
      material,
      grainDirection: "length",
      visible: { length: sideRailInnerSpan, width: sideRailWidth, thickness: sideRailThickness },
      origin: { x: 0, y: sideRailY, z: sz * apronEdgeZ },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
      tenons: [
        {
          position: "start",
          type: sideRailTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
          length: sideRailTenonLength,
          width: sideRailTenonStd.width,
          thickness: sideRailTenonStd.thickness,
          shoulderOn: [...sideRailTenonStd.shoulderOn],
          ...(railTenonAxisStart ? { axis: railTenonAxisStart } : {}),
        },
        {
          position: "end",
          type: sideRailTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
          length: sideRailTenonLength,
          width: sideRailTenonStd.width,
          thickness: sideRailTenonStd.thickness,
          shoulderOn: [...sideRailTenonStd.shoulderOn],
          ...(railTenonAxisEnd ? { axis: railTenonAxisEnd } : {}),
        },
      ],
      mortises: [],
    };
  });

  // ---------- ledger strips（內側下緣，slats 擱上去） ----------
  // 黏在 side rail 內側下緣，slat 頂面 = side rail 頂面 = mattressClearance
  // ledger 頂面 = slat 底面 = mattressClearance - slatThickness
  // ledger 底面 = mattressClearance - slatThickness - ledgerWidth
  const ledgerY = mattressClearanceMm - slatThicknessMm - ledgerWidthMm;
  const ledgerInnerZSign = (sz: number) => sz > 0 ? -1 : 1; // 朝家具中心
  const ledgers: Part[] = [
    { id: "ledger-left", nameZh: "左側 ledger 撐條", sz: -1 },
    { id: "ledger-right", nameZh: "右側 ledger 撐條", sz: 1 },
  ].map(({ id, nameZh, sz }): Part => {
    // 黏在 side rail 內側面（ledger 外側面 = side rail 內側面）
    const ledgerOuterZ = sz * apronEdgeZ + ledgerInnerZSign(sz) * sideRailThickness / 2;
    const ledgerCenterZ = ledgerOuterZ + ledgerInnerZSign(sz) * ledgerThicknessMm / 2;
    return {
      id,
      nameZh,
      material,
      grainDirection: "length",
      visible: { length: sideRailInnerSpan, width: ledgerWidthMm, thickness: ledgerThicknessMm },
      origin: { x: 0, y: ledgerY, z: ledgerCenterZ },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    };
  });

  // ---------- 床頭板 ----------
  // 跨在頭端兩腳之間（Z 軸長度 = 兩頭腳內面距離）
  // headStyle="panel" 整片立板；"spindled" 改頂底兩橫木 + N 直柵欄；其他 silhouette 變化共用 panel 結構
  const headLegInnerSpan = 2 * apronEdgeZ - headLegSizeMax;
  const headboardX = -apronEdgeX; // 頭端

  const headParts: Part[] = [];
  if (headStyle === "spindled") {
    // 頂橫木：在 headboardPlateHeight 頂端
    const railH = 50; // 橫木高度
    const railT = headboardThickness; // 橫木厚度
    const baseY = mattressClearanceMm; // 直柵欄從床面起
    const spindleSpan = headboardPlateHeight - baseY - railH; // 柵欄長度
    headParts.push({
      id: "head-top-rail",
      nameZh: "頭頂橫木",
      material,
      grainDirection: "length",
      visible: { length: headLegInnerSpan, width: railH, thickness: railT },
      origin: { x: headboardX, y: headboardPlateHeight - railH, z: 0 },
      rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
    // 底橫木：在床面 baseY 上
    headParts.push({
      id: "head-bot-rail",
      nameZh: "頭底橫木",
      material,
      grainDirection: "length",
      visible: { length: headLegInnerSpan, width: railH, thickness: railT },
      origin: { x: headboardX, y: baseY, z: 0 },
      rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
    // N 直柵欄：均勻分佈在 headLegInnerSpan，沿 Z 軸 spaced
    const N = Math.max(3, headSpindleCount);
    const sSize = headSpindleSize;
    const pitch = N > 1 ? (headLegInnerSpan - sSize) / (N - 1) : 0;
    for (let i = 0; i < N; i++) {
      const z = N === 1 ? 0 : -headLegInnerSpan / 2 + sSize / 2 + i * pitch;
      headParts.push({
        id: `head-spindle-${i + 1}`,
        nameZh: `直柵欄 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: sSize, width: sSize, thickness: spindleSpan },
        origin: { x: headboardX, y: baseY + railH, z },
        tenons: [],
        mortises: [],
      });
    }
  } else if (headStyle === "panel-frame") {
    // 嵌板框：外框（4 條）+ 中央嵌板（薄）
    const frameW = 80; // 外框邊寬
    const frameT = headboardThickness;
    const innerL = headLegInnerSpan - 2 * frameW;
    const innerH = headboardPlateHeight - 2 * frameW;
    const panelT = Math.max(12, headboardThickness - 8); // 嵌板薄
    // 上下橫框
    for (const [id, nameZh, y] of [
      ["head-frame-top", "頭頂橫框", headboardPlateHeight - frameW] as const,
      ["head-frame-bot", "頭底橫框", 0] as const,
    ]) {
      headParts.push({
        id, nameZh, material, grainDirection: "length",
        visible: { length: headLegInnerSpan, width: frameW, thickness: frameT },
        origin: { x: headboardX, y, z: 0 },
        rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
        tenons: [], mortises: [],
      });
    }
    // 左右立框
    for (const [id, nameZh, sz] of [
      ["head-frame-left", "頭左立框", -1] as const,
      ["head-frame-right", "頭右立框", 1] as const,
    ]) {
      headParts.push({
        id, nameZh, material, grainDirection: "length",
        visible: { length: frameW, width: innerH, thickness: frameT },
        origin: { x: headboardX, y: frameW, z: sz * (headLegInnerSpan / 2 - frameW / 2) },
        rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
        tenons: [], mortises: [],
      });
    }
    // 中央嵌板（薄）
    headParts.push({
      id: "head-panel",
      nameZh: "頭中央嵌板",
      material,
      grainDirection: "length",
      visible: { length: innerL, width: innerH, thickness: panelT },
      origin: { x: headboardX + (frameT - panelT) / 2, y: frameW, z: 0 },
      rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
      tenons: [], mortises: [],
    });
  } else if (headStyle === "slatted-horizontal") {
    // 橫板條：N 條沿 Z 軸跨的水平木條（斯堪地維亞風）
    const slatH = 80;
    const gap = 10;
    const baseY = mattressClearanceMm;
    const span = headboardPlateHeight - baseY;
    const N = Math.max(3, Math.floor(span / (slatH + gap)));
    const totalH = N * slatH + (N - 1) * gap;
    const startY = baseY + (span - totalH) / 2;
    for (let i = 0; i < N; i++) {
      headParts.push({
        id: `head-hslat-${i + 1}`,
        nameZh: `橫板條 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: headLegInnerSpan, width: slatH, thickness: headboardThickness },
        origin: { x: headboardX, y: startY + i * (slatH + gap), z: 0 },
        rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
        tenons: [], mortises: [],
      });
    }
  } else {
    // panel / arched / tufted-look / crested / fielded：共用 base panel + 樣式裝飾
    headParts.push({
      id: "headboard",
      nameZh: "床頭板",
      material,
      grainDirection: "length",
      visible: { length: headLegInnerSpan, width: headboardPlateHeight, thickness: headboardThickness },
      // origin.y = 板底（renderer 把 origin.y 當底部）；板從地板 0 到 headboardPlateHeight
      origin: { x: headboardX, y: 0, z: 0 },
      rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
      tenons: [
        {
          position: "start",
          type: headboardTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
          length: headboardTenonLength,
          width: headboardTenonStd.width,
          thickness: headboardTenonStd.thickness,
          shoulderOn: [...headboardTenonStd.shoulderOn],
          offsetWidth: (mattressClearanceMm - sideRailWidth / 2) - headboardPlateHeight / 2,
        },
        {
          position: "end",
          type: headboardTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
          length: headboardTenonLength,
          width: headboardTenonStd.width,
          thickness: headboardTenonStd.thickness,
          shoulderOn: [...headboardTenonStd.shoulderOn],
          offsetWidth: (mattressClearanceMm - sideRailWidth / 2) - headboardPlateHeight / 2,
        },
      ],
      mortises: [],
    });
    // 樣式裝飾（在 base panel 上額外疊小件）
    if (headStyle === "crested") {
      // 中央高冠：板頂中央加凸出 part
      headParts.push({
        id: "head-crest",
        nameZh: "中央高冠",
        material,
        grainDirection: "length",
        visible: { length: headLegInnerSpan * 0.3, width: 80, thickness: headboardThickness },
        origin: { x: headboardX, y: headboardPlateHeight, z: 0 },
        rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
        tenons: [], mortises: [],
      });
    } else if (headStyle === "winged") {
      // 兩翼：左右各延伸出立柱外的小板
      const wingW = legSize * 1.8;
      const wingH = headboardPlateHeight * 0.5;
      const wingY = headboardPlateHeight - wingH;
      for (const sz of [-1, 1] as const) {
        headParts.push({
          id: `head-wing-${sz < 0 ? "left" : "right"}`,
          nameZh: `床頭${sz < 0 ? "左" : "右"}翼`,
          material,
          grainDirection: "length",
          visible: { length: wingW, width: wingH, thickness: headboardThickness },
          origin: { x: headboardX, y: wingY, z: sz * (headLegInnerSpan / 2 + wingW / 2) },
          rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
          tenons: [], mortises: [],
        });
      }
    } else if (headStyle === "arched") {
      // 拱頂：板頂加一條較粗的橫木示意拱形（v1 用矩形近似，v2 可加 shape kind="arch"）
      headParts.push({
        id: "head-arch-top",
        nameZh: "拱頂橫木",
        material,
        grainDirection: "length",
        visible: { length: headLegInnerSpan * 0.85, width: 100, thickness: headboardThickness + 8 },
        origin: { x: headboardX, y: headboardPlateHeight - 100, z: 0 },
        rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
        tenons: [], mortises: [],
      });
    } else if (headStyle === "fielded") {
      // 起線板：中央加凸出的內板（仿 raised-panel 雕線）
      const innerW = headLegInnerSpan - 200;
      const innerH = (headboardPlateHeight - mattressClearanceMm) - 80;
      headParts.push({
        id: "head-fielded-inner",
        nameZh: "起線中央板",
        material,
        grainDirection: "length",
        visible: { length: innerW, width: innerH, thickness: 12 },
        origin: { x: headboardX + headboardThickness / 2 + 6, y: mattressClearanceMm + 40, z: 0 },
        rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
        tenons: [], mortises: [],
      });
    } else if (headStyle === "tufted-look") {
      // 軟包仿木：3×4 grid 圓凸（仿軟包扣）
      const cols = 4, rows = 3;
      const z0 = -headLegInnerSpan / 2 + 100;
      const z1 = headLegInnerSpan / 2 - 100;
      const y0 = mattressClearanceMm + 80;
      const y1 = headboardPlateHeight - 80;
      const dz = (z1 - z0) / (cols - 1);
      const dy = (y1 - y0) / (rows - 1);
      const buttonSize = 40;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          headParts.push({
            id: `head-tuft-${r + 1}-${c + 1}`,
            nameZh: `軟包扣 ${r + 1}-${c + 1}`,
            material,
            grainDirection: "length",
            visible: { length: buttonSize, width: buttonSize, thickness: 10 },
            origin: { x: headboardX + headboardThickness / 2 + 5, y: y0 + r * dy, z: z0 + c * dz },
            rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
            shape: { kind: "round", axis: "x" },
            tenons: [], mortises: [],
          });
        }
      }
    }
  }

  // ---------- 床尾板（可選） ----------
  let footboard: Part | null = null;
  if (withFootboard) {
    const footPlateHeight = Math.max(100, footboardHeight);
    footboard = {
      id: "footboard",
      nameZh: "床尾板",
      material,
      grainDirection: "length",
      visible: { length: headLegInnerSpan, width: footPlateHeight, thickness: footboardThickness },
      origin: { x: apronEdgeX, y: 0, z: 0 },
      rotation: { x: -Math.PI / 2, y: -Math.PI / 2, z: 0 },
      tenons: [
        {
          position: "start",
          type: footboardTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
          length: footboardTenonLength,
          width: footboardTenonStd.width,
          thickness: footboardTenonStd.thickness,
          shoulderOn: [...footboardTenonStd.shoulderOn],
          offsetWidth: (mattressClearanceMm - sideRailWidth / 2) - footPlateHeight / 2,
        },
        {
          position: "end",
          type: footboardTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
          length: footboardTenonLength,
          width: footboardTenonStd.width,
          thickness: footboardTenonStd.thickness,
          shoulderOn: [...footboardTenonStd.shoulderOn],
          offsetWidth: (mattressClearanceMm - sideRailWidth / 2) - footPlateHeight / 2,
        },
      ],
      mortises: [],
    };
  }

  // ---------- 床板條（slats）沿 Z 軸跨 ----------
  // slats 擱在兩條 ledger 上面，頂面 = mattressClearance
  // X 軸沿 length 等距排，間距 = slatGapMm
  // 兩端伸到 ledger 中心線（butt joint，無榫頭）
  // slat 長度（Z 軸）= 兩 ledger 內面距離 + 2 × ledgerThickness/2 重疊（剛好擱滿 ledger）
  const ledgerInnerSpanZ = 2 * apronEdgeZ - 2 * (sideRailThickness) - 2 * (ledgerThicknessMm / 2);
  // slat 跨距（簡化）：從一邊 ledger 中心線到另一邊，= 2 × (apronEdgeZ - sideRailThickness/2 - ledgerThickness/2)
  const slatLengthZ = 2 * apronEdgeZ - 2 * sideRailThickness; // 留 ledger 上面足夠承接
  const slatCount = Math.max(3, Math.floor((sideRailInnerSpan - slatWidthMm) / (slatWidthMm + slatGapMm)) + 1);
  const slatPitch = slatCount > 1 ? (sideRailInnerSpan - slatWidthMm) / (slatCount - 1) : 0;
  const slatTopY = mattressClearanceMm;
  const slatOriginY = slatTopY - slatThicknessMm / 2;

  const slats: Part[] = [];
  for (let i = 0; i < slatCount; i++) {
    const x = slatCount === 1
      ? 0
      : -sideRailInnerSpan / 2 + slatWidthMm / 2 + i * slatPitch;
    slats.push({
      id: `slat-${i + 1}`,
      nameZh: `床板條 ${i + 1}`,
      material,
      grainDirection: "length",
      // visible: length = slat 長（X 軸方向：slatWidth），width = Z 軸方向（slat 跨距），thickness = Y
      // 我們要 slat 沿 Z 軸跨 → 用 rotation y=π/2 把 length 軸對到 Z
      visible: { length: slatLengthZ, width: slatWidthMm, thickness: slatThicknessMm },
      origin: { x, y: slatOriginY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }
  // 避免 unused vars 警告（保留變數方便未來開榫）
  void ledgerInnerSpanZ;

  const parts: Part[] = [
    ...legs,
    ...sideRails,
    ...ledgers,
    ...headParts,
    ...(footboard ? [footboard] : []),
    ...slats,
  ];

  // 整體 thickness 包含床頭板高（三視圖 viewBox 才不會切掉）
  const overallHeight = Math.max(height, headboardPlateHeight);

  const design: FurnitureDesign = {
    id: `bed-${length}x${width}x${overallHeight}`,
    category: "bed",
    nameZh: "床",
    overall: { length, width, thickness: overallHeight },
    parts,
    defaultJoinery: sideRailTenonType === "through-tenon" ? "through-tenon" : "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes:
      `腳樣式：${legShapeLabel(legShape)}。側板與床頭板皆套用方凳基礎榫卯規則` +
      `（≤25mm 通榫 +5mm、>25mm 盲榫 2/3 深）。${withFootboard ? "含床尾板。" : "純床頭款（無床尾板）。"}` +
      ` 床板條 ${slatCount} 片擱在 ledger 上（不開榫，可拆換洗）。` +
      ` 床板距地 ${mattressClearanceMm}mm，床頭板總高 ${headboardPlateHeight}mm。`,
  };

  applyStandardChecks(design, {
    minLength: 1800, minWidth: 900, minHeight: 200,
    maxLength: 2200, maxWidth: 2000, maxHeight: 1800,
  });

  // 床特有警告
  const warnings: string[] = [];
  if (slatGapMm > 100) {
    warnings.push(`床板條間距 ${slatGapMm}mm 超過 100mm — 床墊容易塌陷且護腰不足，建議 ≤100mm。`);
  }
  if (legSize < 60) {
    warnings.push(`床腳 ${legSize}mm 偏細 — 雙人床建議 70mm 起跳，承重才穩固。`);
  }
  if (sideRailWidth < 120) {
    warnings.push(`側板高 ${sideRailWidth}mm 偏窄 — 床承重大，建議 150mm 起跳避免長期下垂。`);
  }
  if (mattressClearanceMm < headboardPlateHeight && headboardPlateHeight - mattressClearanceMm < 200) {
    warnings.push(`床頭板高 ${headboardPlateHeight}mm 比床板高 ${mattressClearanceMm}mm 高出不到 200mm — 靠背效果有限，建議床頭板總高 ≥ ${mattressClearanceMm + 400}mm。`);
  }
  appendWarnings(design, warnings);

  return design;
};
