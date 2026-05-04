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

export const bedOptions: OptionSpec[] = [
  // ---------- 腳 ----------
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 80, min: 50, max: 150, step: 5, unit: "mm", help: "床腳要承重，建議 70mm 起跳；明式架子床常 90~100mm" },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 100, step: 5, unit: "mm", help: "腳中心離側板外緣的內縮量；0 = 腳貼齊外緣" },
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度 (°)", defaultValue: 0, min: 0, max: SPLAY_ANGLE.stoolMaxDeg, step: 0.5, unit: "°", help: "斜腳系列才有效；床腳通常直立（0°）以便對牆。" },
  legEdgeOption("leg", 0),
  legEdgeStyleOption("leg"),

  // ---------- 床頭板 ----------
  { group: "back", type: "number", key: "headboardHeight", label: "床頭板高 (mm)", defaultValue: 800, min: 400, max: 1500, step: 10, unit: "mm", help: "從地板到床頭板頂端的總高度。常見 700~1000；高背床 1100+" },
  { group: "back", type: "number", key: "headboardThickness", label: "床頭板厚 (mm)", defaultValue: 25, min: 18, max: 50, step: 1, unit: "mm" },

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
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const legEdge = getOption<string>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const headboardHeight = getOption<number>(input, opt(o, "headboardHeight"));
  const headboardThickness = getOption<number>(input, opt(o, "headboardThickness"));
  const withFootboard = getOption<boolean>(input, opt(o, "withFootboard"));
  const footboardHeight = getOption<number>(input, opt(o, "footboardHeight"));
  const footboardThickness = getOption<number>(input, opt(o, "footboardThickness"));
  const sideRailWidth = getOption<number>(input, opt(o, "sideRailWidth"));
  const sideRailThickness = getOption<number>(input, opt(o, "sideRailThickness"));
  const mattressClearanceMm = getOption<number>(input, opt(o, "mattressClearanceMm"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const slatGapMm = getOption<number>(input, opt(o, "slatGapMm"));
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
  // headboard / footboard 也用同樣補償（連腳的 Z 軸）
  const headLegSizeMax = railLegSizeMax;

  const sideRails: Part[] = [
    { id: "side-rail-left", nameZh: "左側板", sz: -1 },
    { id: "side-rail-right", nameZh: "右側板", sz: 1 },
  ].map(({ id, nameZh, sz }): Part => ({
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
      },
      {
        position: "end",
        type: sideRailTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
        length: sideRailTenonLength,
        width: sideRailTenonStd.width,
        thickness: sideRailTenonStd.thickness,
        shoulderOn: [...sideRailTenonStd.shoulderOn],
      },
    ],
    mortises: [],
  }));

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
  // 板從地板到 headboardHeight 整片立板
  // 注意：headboard 進腳的部分（從 side rail 上緣以下）有榫頭，上半部凸出腳
  // 為簡化此版：headboard 是整片立板，從地板（y=0）到 headboardHeight，
  // 寬度 = 兩頭腳內面距離（butt joint），用 Z 軸跨
  // headboard 跨距用 sideRail Y 處的腳寬補償（headboard 主要進腳的高度區段就在 sideRail 附近）
  const headLegInnerSpan = 2 * apronEdgeZ - headLegSizeMax;
  const headboardCenterY = headboardPlateHeight / 2;
  const headboardX = -apronEdgeX; // 頭端
  const headboard: Part = {
    id: "headboard",
    nameZh: "床頭板",
    material,
    grainDirection: "length",
    visible: { length: headLegInnerSpan, width: headboardPlateHeight, thickness: headboardThickness },
    origin: { x: headboardX, y: headboardCenterY - headboardPlateHeight / 2 + headboardPlateHeight / 2, z: 0 },
    // rotation: x=π/2 把 length 軸對到 Z；現在我們要 length 對到 Z 軸（左右），所以 y=π/2
    // 用 y=π/2 旋轉：local +X → world +Z，local +Z → world -X
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    tenons: [
      // 兩端進頭腳側面：榫頭沿 Z 軸（頭板長度方向）
      // headboard 在腳的 sideRailCenterY 高度位置進腳（榫高 = headboardTenonStd.width）
      // 但 headboard 整支從 0 到 headboardPlateHeight；榫頭在 part-local 哪裡？
      // part-local: width 軸 = world Y（高度）, mesh 中心 Y = headboardPlateHeight/2
      // 榫中心 Y（world）= sideRailCenterY = mattressClearance - sideRailWidth/2
      // offsetWidth (mesh local) = sideRailCenterY - headboardPlateHeight/2
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
  };
  // origin.y 算錯，重算：希望板的世界範圍 y ∈ [0, headboardPlateHeight]
  // 旋轉 y=π/2：mesh local 軸對映：local X(length) → +Z, local Y(width) → +Y, local Z(thickness) → -X
  // 所以 width 軸還是世界 Y，origin.y = visible.width/2 = headboardPlateHeight/2 對齊
  headboard.origin = { x: headboardX, y: headboardPlateHeight / 2, z: 0 };

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
      origin: { x: apronEdgeX, y: footPlateHeight / 2, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
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
    headboard,
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
