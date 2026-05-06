import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery, applyStandardChecks } from "./_validators";
import { legShapeLabel as sharedLegShapeLabel, computeSplayGeometry, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, legBottomScale, legScaleAt } from "./_helpers";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

/** round-table 多出 pedestal/trestle 兩種「桌型」標籤（非 leg shape）；shared label 不認這兩個就 fallback */
const TABLE_TYPE_LABEL: Record<string, string> = {
  pedestal: "獨柱餐桌",
  trestle: "端梁餐桌",
};
function legShapeLabel(s: string): string {
  return TABLE_TYPE_LABEL[s] ?? sharedLegShapeLabel(s);
}

/**
 * 獨柱餐桌：中央 1 支粗柱（cross-section legSize×3）+ 4 爪底盤
 * 柱頂直接支撐圓桌面（透過頂部 cleat 連接，這裡簡化）
 * 4 隻爪從柱底向 4 個方向放射延伸，端部往內收呈現「獸足」感
 */
function buildPedestalRoundTable(p: {
  diameter: number; height: number; material: string;
  topThickness: number; legSize: number; legHeight: number; radius: number;
}): FurnitureDesign {
  const { diameter, height, material, topThickness, legSize, legHeight, radius } = p;
  // 柱粗 = legSize × 2.5，太細看起來會像柱頂頂著桌面要倒
  const columnSize = Math.round(legSize * 2.5);
  // 底盤爪：每爪長 = 半徑 × 0.6（從中心往外），高 50, 厚 35
  const footLength = Math.round(radius * 0.6);
  const footWidth = 50;
  const footThickness = 35;
  // 柱頂連接用的方板（與桌面下方膠合）
  const topCleatSize = columnSize + 30;
  const topCleatThickness = 22;

  const top: Part = {
    id: "top",
    nameZh: "圓桌面",
    material: material as "maple",
    grainDirection: "length",
    visible: { length: diameter, width: diameter, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: { kind: "round" },
    tenons: [],
    mortises: [],
  };
  // 中央柱：lathe-turned 從地面一路到 cleat 下方，底部 flare 把
  // 4 隻底爪的內側包住；爪只看得到從柱外冒出來的部分
  const column: Part = {
    id: "pedestal-column",
    nameZh: "中央柱",
    material: material as "maple",
    grainDirection: "length",
    visible: { length: columnSize, width: columnSize, thickness: legHeight - topCleatThickness },
    origin: { x: 0, y: 0, z: 0 },
    shape: { kind: "lathe-turned" },
    tenons: [
      { position: "top", type: "blind-tenon", length: 30, width: Math.round(columnSize * 0.4), thickness: Math.round(columnSize * 0.4) },
    ],
    mortises: [],
  };
  // 柱頂方板（接桌面）
  const topCleat: Part = {
    id: "pedestal-top-cleat",
    nameZh: "柱頂連接板",
    material: material as "maple",
    grainDirection: "length",
    visible: { length: topCleatSize, width: topCleatSize, thickness: topCleatThickness },
    origin: { x: 0, y: legHeight - topCleatThickness, z: 0 },
    tenons: [],
    mortises: [
      { origin: { x: 0, y: 0, z: 0 }, depth: 30, length: Math.round(columnSize * 0.4), width: Math.round(columnSize * 0.4), through: false },
    ],
  };
  // 4 隻爪（東西南北方向往外放射）
  // 爪原點在中心，body 沿 X 或 Z 軸延伸到柱外
  // 為簡化：每隻爪是矩形板，從柱面到 footLength 處
  const feet: Part[] = [
    { id: "pedestal-foot-front", nameZh: "前底爪", axis: "z" as const, sign: -1 },
    { id: "pedestal-foot-back", nameZh: "後底爪", axis: "z" as const, sign: 1 },
    { id: "pedestal-foot-left", nameZh: "左底爪", axis: "x" as const, sign: -1 },
    { id: "pedestal-foot-right", nameZh: "右底爪", axis: "x" as const, sign: 1 },
  ].map((f) => {
    const isXAxis = f.axis === "x";
    return {
      id: f.id,
      nameZh: f.nameZh,
      material: material as "maple",
      grainDirection: "length" as const,
      visible: { length: footLength, width: footWidth, thickness: footThickness },
      // butt-joint 慣例：爪從柱外面延伸出去，不跟柱重疊；爪中心 = 柱外面 + footLength/2
      origin: {
        x: isXAxis ? f.sign * (columnSize / 2 + footLength / 2) : 0,
        y: 0,
        z: !isXAxis ? f.sign * (columnSize / 2 + footLength / 2) : 0,
      },
      // X 軸爪 rotation x: π/2; Z 軸爪 rotation x: π/2 + y: π/2
      rotation: isXAxis
        ? { x: Math.PI / 2, y: 0, z: 0 }
        : { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [
        // 接柱：start 端入柱（柱在中心，爪從柱面延伸出去）
        { position: "start" as const, type: "shouldered-tenon" as const, length: 25, width: footWidth - 12, thickness: 18 },
      ],
      mortises: [],
    };
  });
  // 給柱開 4 個榫眼接 4 隻爪。爪 mesh 中心 Y = footThickness/2，
  // 榫眼也對到那裡才不會偏一邊
  const footMortiseY = footThickness / 2;
  column.mortises = [
    { origin: { x: -columnSize / 2, y: footMortiseY, z: 0 }, depth: 25, length: footWidth - 12, width: 18, through: false },
    { origin: { x: columnSize / 2, y: footMortiseY, z: 0 }, depth: 25, length: footWidth - 12, width: 18, through: false },
    { origin: { x: 0, y: footMortiseY, z: -columnSize / 2 }, depth: 25, length: footWidth - 12, width: 18, through: false },
    { origin: { x: 0, y: footMortiseY, z: columnSize / 2 }, depth: 25, length: footWidth - 12, width: 18, through: false },
  ];

  return {
    id: `round-table-pedestal-${diameter}x${height}`,
    category: "round-table",
    nameZh: "圓餐桌（獨柱）",
    overall: { length: diameter, width: diameter, thickness: height },
    parts: [top, topCleat, column, ...feet],
    defaultJoinery: "shouldered-tenon",
    primaryMaterial: material as "maple",
    notes: `獨柱圓餐桌：中央 ${columnSize}mm 粗柱 + 4 隻 ${footLength}mm 長底爪。柱粗 = legSize × 2.5（${legSize}→${columnSize}）才有支撐感。柱頂用 ${topCleatSize}mm 連接板膠合到桌面下方。底爪用帶肩榫接入柱面 4 個方向。${diameter >= 1100 ? "1100mm 以上直徑桌面建議用 2 支柱（trestle）以避免桌面過重壓垮單柱接合。" : ""}`,
  };
}

/**
 * 端梁餐桌（trestle round table）：兩端梁框 + 中央連接橫木
 * 圓桌通常不用 trestle（trestle 適合矩形長桌），此處做簡化版：
 * - 2 個端梁框（在世界 Z = ±radius×0.6 位置）
 * - 每框 = 2 支粗腳 + 1 條頂橫木 + 1 條底足
 * - 1 條中央橫木連接兩框中心
 */
function buildTrestleRoundTable(p: {
  diameter: number; height: number; material: string;
  topThickness: number; legSize: number; legHeight: number; radius: number;
}): FurnitureDesign {
  const { diameter, height, material, topThickness, legSize, legHeight, radius } = p;
  // 端框位置：z = ±frameZ
  const frameZ = Math.round(radius * 0.55);
  // 每框 2 支腳間距 = 半徑 × 0.5
  const frameLegSpacing = Math.round(radius * 0.5);
  const trestleLegSize = Math.round(legSize * 1.3);
  // 頂橫木 + 底足：跨越 frameLegSpacing + trestleLegSize（稍長）
  const frameRailLen = frameLegSpacing + trestleLegSize;
  // 頂橫木：Z 方向（深）=  腳的 Z 跟腳齊；Y 方向（高）= 腳粗 60% 才有結構量感
  // 不然從下往上看頂橫木會像細皮帶夾在兩個粗腳之間
  const frameRailWidth = trestleLegSize;
  const frameRailThickness = Math.round(trestleLegSize * 0.6);
  // 底足：比腳寬 10mm 一點點突出做穩定，厚 50 比較有結構感
  const frameFootWidth = trestleLegSize + 10;
  const frameFootThickness = 50;
  // 中央橫木：跨越 2 個底足之間，落在底足 Y 範圍內（傳統 trestle 結構）
  // 長度 = 2 框中心距離 - 兩端底足厚度（榫入足內側面）
  const centerStretcherLen = 2 * frameZ - frameFootWidth;
  const centerStretcherWidth = 25;
  const centerStretcherThickness = 30;
  // 中央橫木 Y：嵌在底足內部（足厚 35，橫木高 25 → 居中放）
  const centerStretcherY = (frameFootThickness - centerStretcherWidth) / 2;

  const top: Part = {
    id: "top",
    nameZh: "圓桌面",
    material: material as "maple",
    grainDirection: "length",
    visible: { length: diameter, width: diameter, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: { kind: "round" },
    tenons: [],
    mortises: [],
  };

  const parts: Part[] = [top];
  // 兩個端框
  for (const fz of [-frameZ, frameZ] as const) {
    const fid = fz < 0 ? "front" : "back";
    const fLabel = fz < 0 ? "前" : "後";
    // 2 支腳
    for (const fx of [-frameLegSpacing / 2, frameLegSpacing / 2] as const) {
      const sid = fx < 0 ? "left" : "right";
      const sLabel = fx < 0 ? "左" : "右";
      parts.push({
        id: `trestle-${fid}-${sid}-leg`,
        nameZh: `${fLabel}框${sLabel}腳`,
        material: material as "maple",
        grainDirection: "length",
        visible: { length: trestleLegSize, width: trestleLegSize, thickness: legHeight - frameFootThickness - frameRailThickness },
        origin: { x: fx, y: frameFootThickness, z: fz },
        tenons: [],
        mortises: [],
      });
    }
    // 頂橫木
    parts.push({
      id: `trestle-${fid}-top-rail`,
      nameZh: `${fLabel}框頂橫木`,
      material: material as "maple",
      grainDirection: "length",
      visible: { length: frameRailLen, width: frameRailWidth, thickness: frameRailThickness },
      origin: { x: 0, y: legHeight - frameRailThickness, z: fz },
      tenons: [],
      mortises: [],
    });
    // 底足（含中央橫木 mortise，audit 需要）
    parts.push({
      id: `trestle-${fid}-foot`,
      nameZh: `${fLabel}框底足`,
      material: material as "maple",
      grainDirection: "length",
      visible: { length: frameRailLen + 40, width: frameFootWidth, thickness: frameFootThickness },
      origin: { x: 0, y: 0, z: fz },
      tenons: [],
      mortises: [
        {
          // mortise on inner Z face for center-stretcher tenon
          origin: { x: 0, y: frameFootThickness / 2, z: fz < 0 ? +frameFootWidth / 2 - 17 : -frameFootWidth / 2 + 17 },
          depth: 35,
          length: centerStretcherWidth - 12,
          width: 18,
          through: false,
        },
      ],
    });
  }
  // 中央橫木（沿 Z 軸跨越兩框中心）
  parts.push({
    id: "trestle-center-stretcher",
    nameZh: "中央連接橫木",
    material: material as "maple",
    grainDirection: "length",
    visible: { length: centerStretcherLen, width: centerStretcherWidth, thickness: centerStretcherThickness },
    origin: { x: 0, y: centerStretcherY, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [
      { position: "start", type: "shouldered-tenon", length: 35, width: centerStretcherWidth - 12, thickness: 18 },
      { position: "end", type: "shouldered-tenon", length: 35, width: centerStretcherWidth - 12, thickness: 18 },
    ],
    mortises: [],
  });

  return {
    id: `round-table-trestle-${diameter}x${height}`,
    category: "round-table",
    nameZh: "圓餐桌（端梁）",
    overall: { length: diameter, width: diameter, thickness: height },
    parts,
    defaultJoinery: "shouldered-tenon",
    primaryMaterial: material as "maple",
    notes: `端梁圓餐桌：兩端梁框（前/後 各 2 腳 + 頂橫木 + 底足）+ 中央連接橫木。腳粗 ${trestleLegSize}mm（base × 1.3）。每框長 ${frameRailLen}mm，框間距 ${2 * frameZ}mm。建議圓桌 ≥ 1000mm 直徑才用此結構，小桌會看起來框比桌面還大。`,
  };
}

export const roundTableOptions: OptionSpec[] = [
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 18, max: 50, step: 1, unit: "mm" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 60, min: 30, max: 120, step: 1, unit: "mm" },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "top", type: "checkbox", key: "withLazySusan", label: "中央旋轉盤（lazy susan）", defaultValue: false, help: "中央加可旋轉小圓盤——需配 12-16 吋金屬軸承（五金行 NT$ 200-400）。台灣家庭 8 人圓桌標配", wide: true },
  { group: "top", type: "number", key: "lazySusanDiameter", label: "旋轉盤直徑 (mm)", defaultValue: 600, min: 300, max: 1000, step: 50, dependsOn: { key: "withLazySusan", equals: true } },
  { group: "leg", type: "number", key: "legInset", label: "腳離邊 (mm)", defaultValue: 150, min: 50, max: 400, step: 10, unit: "mm", help: "腳中心離桌面圓周的內縮量。內縮越大坐得越進去（膝蓋空間越大）", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "tapered", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "方錐腳（方料下方收窄）" },
    { value: "fluted-square", label: "古典方腿（方料 + 4 面凹槽）" },
    { value: "round", label: "圓腳（直圓柱）" },
    { value: "round-taper-down", label: "圓錐腳（上粗下細）" },
    { value: "round-taper-up", label: "倒圓錐腳（上細下粗）" },
    { value: "heavy-round-taper", label: "重型圓錐腳（大幅下收）" },
    { value: "shaker", label: "夏克風腳（方頂 + 圓錐）" },
    { value: "lathe-turned", label: "車旋腳（古典花瓶輪廓）" },
    { value: "splayed-tapered", label: "外斜方錐腳（整支外傾）" },
    { value: "splayed-round-taper-down", label: "外斜圓錐腳（外傾 + 上粗下細）" },
    { value: "splayed-round-taper-up", label: "外斜倒圓錐腳（外傾 + 上細下粗）" },
    { value: "pedestal", label: "獨柱餐桌（中央 1 支粗柱 + 4 爪底盤）" },
    { value: "trestle", label: "端梁餐桌（兩端梁框 + 中央連接橫木）" },
  ] },
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度（°）", defaultValue: 5, min: 0, max: 20, step: 1, unit: "°", help: "整支腳外傾的角度，0=直立。僅外斜系列有效（餐桌 5° 內最自然，避免絆腳）", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 100, min: 50, max: 200, step: 5, unit: "mm", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 25, min: 15, max: 40, step: 1, unit: "mm", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "apron", type: "number", key: "apronDropFromTop", label: "牙板距桌面 (mm)", defaultValue: 30, min: 0, max: 200, step: 5, unit: "mm", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙板錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "前後牙板（X 軸）相對左右下移量。0 = 等高（自動上下半榫）", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/下橫撐進腳改通榫；圓腳系列強制盲榫（曲面不能鑿穿）", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "stretcher", type: "checkbox", key: "withLowerStretcher", label: "加下橫撐", defaultValue: false, help: "靠近地面的另一組橫撐連結 4 腳，更穩固", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "stretcher", type: "number", key: "lowerStretcherStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, unit: "mm", help: "左右下橫撐（Z 軸）相對前後上移量。0 = 等高", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高 (mm)", defaultValue: 50, min: 25, max: 150, step: 5, unit: "mm", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚 (mm)", defaultValue: 22, min: 12, max: 40, step: 1, unit: "mm", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "stretcher", type: "number", key: "lowerStretcherFromGround", label: "下橫撐離地 (mm)", defaultValue: 120, min: 30, max: 500, step: 10, unit: "mm", dependsOn: { key: "legShape", notIn: ["pedestal", "trestle"] } },
  { group: "top", type: "select", key: "topPattern", label: "桌面拼板花紋", defaultValue: "radial", choices: [
    { value: "radial", label: "放射狀（pie segments，最有圓桌感）" },
    { value: "concentric", label: "同心環（內外兩圈拼板）" },
    { value: "star-match", label: "星形拼（4-8 個三角板對拼）" },
    { value: "straight", label: "直拼（普通拼板，最簡單）" },
  ], help: "圓桌面拼板樣式。放射狀是最經典做法，同心環適合大桌（>1.2m）" },
];

/**
 * 圓餐桌（round dining table）— 圓桌面 + 4 隻腳 + 4 條牙板
 *
 * 尺寸：input.length = 直徑，預設 1000×1000×750mm（100cm 直徑、75cm 桌高）
 * 桌面 >= 900mm 通常需 4-5 片實木拼板（避免單片過寬翹曲）。
 */
export const roundTable: FurnitureTemplate = (input): FurnitureDesign => {
  const { height, material } = input;
  const diameter = input.length;

  const o = roundTableOptions;
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const withLazySusan = getOption<boolean>(input, opt(o, "withLazySusan"));
  const lazySusanDiameter = getOption<number>(input, opt(o, "lazySusanDiameter"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  const apronDropFromTop = getOption<number>(input, opt(o, "apronDropFromTop"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const withLowerStretcher = getOption<boolean>(input, opt(o, "withLowerStretcher"));
  const lowerStretcherWidth = getOption<number>(input, opt(o, "lowerStretcherWidth"));
  const lowerStretcherThickness = getOption<number>(input, opt(o, "lowerStretcherThickness"));
  const lowerStretcherFromGround = getOption<number>(input, opt(o, "lowerStretcherFromGround"));
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const lowerStretcherStaggerMm = getOption<number>(input, opt(o, "lowerStretcherStaggerMm"));
  const legPenetratingTenonRaw = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const isRoundShapeLeg =
    legShape === "round" || legShape === "round-taper-down" || legShape === "round-taper-up" ||
    legShape === "shaker" || legShape === "lathe-turned" || legShape === "heavy-round-taper" ||
    legShape === "splayed-round-taper-down" || legShape === "splayed-round-taper-up";
  const legPenetratingTenon = legPenetratingTenonRaw && !isRoundShapeLeg;

  const radius = diameter / 2;
  const legHeight = height - topThickness;

  // 獨柱餐桌 / 端梁餐桌：完全不同結構，跳過 4 隻腳分支
  if (legShape === "pedestal") {
    return buildPedestalRoundTable({ diameter, height, material, topThickness, legSize, legHeight, radius });
  }
  if (legShape === "trestle") {
    return buildTrestleRoundTable({ diameter, height, material, topThickness, legSize, legHeight, radius });
  }

  const cornerOffset = Math.max(legSize, (radius - legInset) / Math.SQRT2);
  const { splayMm, splayDx, splayDz } = computeSplayGeometry(legHeight, splayAngle);
  const apronY0 = legHeight - apronWidth - apronDropFromTop;
  const apronYCenter0 = apronY0 + apronWidth / 2;
  // 套方凳榫卯規則
  const apronTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legSize,
  });
  const apronTenonW = Math.min(apronTenonStd.width, Math.max(8, legSize - 6));
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonLen = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const APRON_TOP_SHOULDER = 10;
  const apronTotalTenonH = Math.max(0, apronWidth - APRON_TOP_SHOULDER);
  const apronCanHalfStagger = apronStaggerMm < apronTenonW && apronTotalTenonH >= 16;
  const APRON_HALF_TENON_GAP = 4;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.max(4, Math.floor((apronTotalTenonH + apronStaggerMm - APRON_HALF_TENON_GAP) / 2)))
    : apronTenonW;
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronHalfTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronHalfTenonH / 2 - apronWidth / 2
    : 0;
  const apronVisuallyStaggered = apronStaggerMm > 0;

  const lsY0 = lowerStretcherFromGround;
  const lsYCenter0 = lsY0 + lowerStretcherWidth / 2;
  const lsY0_z = lsY0 + lowerStretcherStaggerMm;
  const lsYCenter0_z = lsY0_z + lowerStretcherWidth / 2;
  const lowerTenonType = legPenetratingTenon ? "through-tenon" : autoTenonType(legSize);
  const lowerTenonStd = standardTenon({
    type: lowerTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: lowerStretcherThickness,
    childWidth: lowerStretcherWidth,
    motherThickness: legSize,
  });
  const lsTenonW = Math.min(lowerTenonStd.width, Math.max(8, legSize - 6));
  const lsTenonThick = lowerTenonStd.thickness;
  const lsTenonLen = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
  const lowerCanHalfStagger = lowerStretcherStaggerMm < lsTenonW && lowerStretcherWidth >= 16;
  const LOWER_HALF_TENON_GAP = 4;
  const lowerHalfTenonH = lowerCanHalfStagger
    ? Math.min(lsTenonW, Math.max(4, Math.floor((lowerStretcherWidth + lowerStretcherStaggerMm - LOWER_HALF_TENON_GAP) / 2)))
    : lsTenonW;
  const lowerUpperTenonOffset = lowerCanHalfStagger
    ? (lowerStretcherWidth / 2 - lowerHalfTenonH / 2)
    : 0;
  const lowerLowerTenonOffset = lowerCanHalfStagger
    ? (lowerHalfTenonH / 2 - lowerStretcherWidth / 2)
    : 0;
  const lowerVisuallyStaggered = lowerStretcherStaggerMm > 0;

  // 圓桌面
  const top: Part = {
    id: "top",
    nameZh: "圓桌面",
    material,
    grainDirection: "length",
    visible: { length: diameter, width: diameter, thickness: topThickness },
    origin: { x: 0, y: legHeight, z: 0 },
    shape: { kind: "round" },
    tenons: [],
    mortises: [
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          origin: { x: sx * cornerOffset, y: 0, z: sz * cornerOffset },
          // 跟 leg seat tenon length 同公式才能對位（drafting-math.md §B2）
          depth: Math.round(Math.min(topThickness * (2 / 3), topThickness - 6)),
          length: Math.round(legSize * 0.6),
          width: Math.round(legSize * 0.6),
          through: false,
        })),
      ),
    ],
  };

  // 4 隻腳
  const legs: Part[] = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => ({
      id: `leg-${sx < 0 ? "l" : "r"}${sz < 0 ? "f" : "b"}`,
      nameZh: `${sz < 0 ? "前" : "後"}${sx < 0 ? "左" : "右"}腳`,
      material,
      grainDirection: "length" as const,
      visible: { length: legSize, width: legSize, thickness: legHeight },
      origin: { x: sx * cornerOffset, y: 0, z: sz * cornerOffset },
      shape:
        legShape === "tapered"
          ? ({ kind: "tapered", bottomScale: 0.55 } as const)
          : legShape === "fluted-square"
            ? ({ kind: "tapered", bottomScale: 1 } as const)
            : legShape === "round"
              ? ({ kind: "round" } as const)
              : legShape === "round-taper-down"
                ? ({ kind: "round-tapered", bottomScale: 0.55 } as const)
                : legShape === "round-taper-up"
                  ? ({ kind: "round-tapered", bottomScale: 1.4 } as const)
                  : legShape === "heavy-round-taper"
                    ? ({ kind: "round-tapered", bottomScale: 0.4 } as const)
                    : legShape === "shaker"
                      ? ({ kind: "shaker" } as const)
                      : legShape === "lathe-turned"
                        ? ({ kind: "lathe-turned" } as const)
                        : legShape === "splayed-tapered"
                          ? ({ kind: "splayed-tapered", bottomScale: 0.55, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                          : legShape === "splayed-round-taper-down"
                            ? ({ kind: "splayed-round-tapered", bottomScale: 0.55, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                            : legShape === "splayed-round-taper-up"
                              ? ({ kind: "splayed-round-tapered", bottomScale: 1.4, dxMm: sx * splayDx, dzMm: sz * splayDz } as const)
                              : legEdgeShape(legEdge, legEdgeStyle),
      tenons: [
        {
          position: "top" as const,
          type: "blind-tenon" as const,
          length: Math.round(Math.min(topThickness * (2 / 3), topThickness - 6)),
          width: Math.round(legSize * 0.6),
          thickness: Math.round(legSize * 0.6),
        },
      ],
      mortises: [
        // Z 面（接 Z 軸 = 左右牙板, 靜止）— 上半榫
        {
          origin: {
            x: 0,
            y: apronYCenter0 + apronUpperTenonOffset,
            z: -sz * (legSize / 2),
          },
          depth: apronTenonLen,
          length: apronCanHalfStagger ? apronHalfTenonH : apronTenonW,
          width: apronTenonThick,
          through: apronTenonType === "through-tenon",
        },
        // X 面（接 X 軸 = 前後牙板, 下移）— 下半榫
        {
          origin: {
            x: -sx * (legSize / 2),
            y: apronYCenter0 + apronLowerTenonOffset - (apronVisuallyStaggered ? apronStaggerMm : 0),
            z: 0,
          },
          depth: apronTenonLen,
          length: apronCanHalfStagger ? apronHalfTenonH : apronTenonW,
          width: apronTenonThick,
          through: apronTenonType === "through-tenon",
        },
        ...(withLowerStretcher
          ? [
              // X 面（前後對, 靜止）— 下半榫
              {
                origin: {
                  x: -sx * (legSize / 2),
                  y: lsYCenter0 + lowerLowerTenonOffset,
                  z: 0,
                },
                depth: lsTenonLen,
                length: lowerCanHalfStagger ? lowerHalfTenonH : lsTenonW,
                width: lsTenonThick,
                through: lowerTenonType === "through-tenon",
              },
              // Z 面（左右對, 上移）— 上半榫
              {
                origin: {
                  x: 0,
                  y: lsYCenter0 + lowerUpperTenonOffset + (lowerVisuallyStaggered ? lowerStretcherStaggerMm : 0),
                  z: -sz * (legSize / 2),
                },
                depth: lsTenonLen,
                length: lowerCanHalfStagger ? lowerHalfTenonH : lsTenonW,
                width: lsTenonThick,
                through: lowerTenonType === "through-tenon",
              },
            ]
          : []),
      ],
    })),
  );

  // 4 條牙板（餐桌結構承重，用帶肩榫）
  const apronY = apronY0;
  const isSplayed = legShape.startsWith("splayed-");
  // 圓家具腳對角線 splay，apron 在前/側視平面看到的 Z 斜率 = tan(α)/√2
  const tilt = isSplayed ? computeSplayGeometry(legHeight, splayAngle).apronTilt : 0;
  // 在 apron Y 中心位置算腳的真實中心——外斜時腳已從 corner 偏出去，
  // 榫頭要打在腳真正的中心，apron 才對齊（不會偏一側讓壁太薄爆掉）
  const apronYCenter = apronY + apronWidth / 2;
  const shiftFactor = legHeight > 0 ? 1 - apronYCenter / legHeight : 0;
  const apronSplayDx = isSplayed ? splayDx * shiftFactor : 0;
  const apronSplayDz = isSplayed ? splayDz * shiftFactor : 0;
  // tapered 補償（drafting-math §A11）：apron 端面 = 腳在 apron Y 處的內面
  const apronBottomScale = legBottomScale(legShape);
  const apronLegSizeCenter = legSize * legScaleAt(apronYCenter, legHeight, apronBottomScale);
  const apronLegSizeTop = legSize * legScaleAt(apronY + apronWidth, legHeight, apronBottomScale);
  const apronLegSizeBot = legSize * legScaleAt(apronY, legHeight, apronBottomScale);
  // butt-joint 慣例：visible.length 兩端剛好頂在腳的內側面（apron Y center）
  const apronSpan = 2 * (cornerOffset + apronSplayDx) - apronLegSizeCenter;
  const hasTaper = apronBottomScale !== 1;
  const apronShiftTop = legHeight > 0 ? 1 - (apronY + apronWidth) / legHeight : 0;
  const apronShiftBot = legHeight > 0 ? 1 - apronY / legHeight : 0;
  const apronSplayDxTop = isSplayed ? splayDx * apronShiftTop : 0;
  const apronSplayDxBot = isSplayed ? splayDx * apronShiftBot : 0;
  const apronSpanCenterEdge = cornerOffset + apronSplayDx - apronLegSizeCenter / 2;
  const apronSpanTopEdge = cornerOffset + apronSplayDxTop - apronLegSizeTop / 2;
  const apronSpanBotEdge = cornerOffset + apronSplayDxBot - apronLegSizeBot / 2;
  const trapTopScale = hasTaper && apronSpanCenterEdge > 0 ? apronSpanTopEdge / apronSpanCenterEdge : 1;
  const trapBotScale = hasTaper && apronSpanCenterEdge > 0 ? apronSpanBotEdge / apronSpanCenterEdge : 1;
  const aprons: Part[] = [
    { id: "apron-front", nameZh: "前牙板", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + apronSplayDz) } },
    { id: "apron-back", nameZh: "後牙板", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + apronSplayDz } },
    { id: "apron-left", nameZh: "左牙板", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + apronSplayDx), z: 0 } },
    { id: "apron-right", nameZh: "右牙板", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + apronSplayDx, z: 0 } },
  ].map((s) => {
    const bevelAngle = isSplayed ? (s.axis === "x" ? -s.sz * tilt : -s.sx * tilt) : 0;
    const apronTopAtSeat = apronDropFromTop === 0;
    const useTopBevel = isSplayed && apronTopAtSeat;
    const partShape = hasTaper
      ? ({
          kind: "apron-trapezoid" as const,
          topLengthScale: trapTopScale,
          bottomLengthScale: trapBotScale,
          bevelAngle: useTopBevel ? bevelAngle : undefined,
          bevelMode: useTopBevel ? ("half" as const) : undefined,
        })
      : isSplayed && apronTopAtSeat
        ? ({ kind: "apron-half-beveled" as const, bevelAngle })
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    const tenonType: "through-tenon" | "shouldered-tenon" =
      apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon";
    const tenons = (() => {
      if (!apronCanHalfStagger) {
        const mk = (position: "start" | "end") => ({
          position,
          type: tenonType,
          length: apronTenonLen,
          width: apronTenonW,
          thickness: apronTenonThick,
          shoulderOn: [...apronTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right">,
        });
        return [mk("start"), mk("end")];
      }
      const isUpper = s.axis === "z";
      const worldOffset = isUpper ? apronUpperTenonOffset : apronLowerTenonOffset;
      const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = isUpper
        ? ["top", "left", "right"]
        : ["left", "right"];
      const mk = (position: "start" | "end") => ({
        position,
        type: tenonType,
        length: apronTenonLen,
        width: apronHalfTenonH,
        thickness: apronTenonThick,
        shoulderOn,
        offsetWidth: -worldOffset,
      });
      return [mk("start"), mk("end")];
    })();
    return {
      id: s.id,
      nameZh: s.nameZh,
      material,
      grainDirection: "length" as const,
      visible: { length: apronSpan, width: apronWidth, thickness: apronThickness },
      origin: { x: s.origin.x, y: apronY - (apronVisuallyStaggered && s.axis === "x" ? apronStaggerMm : 0), z: s.origin.z },
      rotation:
        s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 },
      shape: partShape,
      tenons,
      mortises: [],
    };
  });

  // 4 條下橫撐——同邏輯，靠近地面，餐桌默認用帶肩榫
  const lowerStretchers: Part[] = [];
  if (withLowerStretcher) {
    const lsShiftFactor = legHeight > 0 ? 1 - lsYCenter0 / legHeight : 0;
    const lsSplayDx = isSplayed ? splayDx * lsShiftFactor : 0;
    const lsSplayDz = isSplayed ? splayDz * lsShiftFactor : 0;
    // tapered 補償（同 apron 邏輯）
    const lsLegSizeCenter = legSize * legScaleAt(lsYCenter0, legHeight, apronBottomScale);
    const lsLegSizeTop = legSize * legScaleAt(lsYCenter0 + lowerStretcherWidth / 2, legHeight, apronBottomScale);
    const lsLegSizeBot = legSize * legScaleAt(lsYCenter0 - lowerStretcherWidth / 2, legHeight, apronBottomScale);
    const lsSpan = 2 * (cornerOffset + lsSplayDx) - lsLegSizeCenter;
    const lsHasTaper = apronBottomScale !== 1;
    const lsShiftTop = legHeight > 0 ? 1 - (lsYCenter0 + lowerStretcherWidth / 2) / legHeight : 0;
    const lsShiftBot = legHeight > 0 ? 1 - (lsYCenter0 - lowerStretcherWidth / 2) / legHeight : 0;
    const lsSplayDxTop = isSplayed ? splayDx * lsShiftTop : 0;
    const lsSplayDxBot = isSplayed ? splayDx * lsShiftBot : 0;
    const lsCenterEdge = cornerOffset + lsSplayDx - lsLegSizeCenter / 2;
    const lsTopEdge = cornerOffset + lsSplayDxTop - lsLegSizeTop / 2;
    const lsBotEdge = cornerOffset + lsSplayDxBot - lsLegSizeBot / 2;
    const lsTrapTopScale = lsHasTaper && lsCenterEdge > 0 ? lsTopEdge / lsCenterEdge : 1;
    const lsTrapBotScale = lsHasTaper && lsCenterEdge > 0 ? lsBotEdge / lsCenterEdge : 1;
    const lsSides = [
      { id: "lower-stretcher-front", nameZh: "前下橫撐", axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(cornerOffset + lsSplayDz) } },
      { id: "lower-stretcher-back", nameZh: "後下橫撐", axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: cornerOffset + lsSplayDz } },
      { id: "lower-stretcher-left", nameZh: "左下橫撐", axis: "z" as const, sx: -1, sz: 0, origin: { x: -(cornerOffset + lsSplayDx), z: 0 } },
      { id: "lower-stretcher-right", nameZh: "右下橫撐", axis: "z" as const, sx: 1, sz: 0, origin: { x: cornerOffset + lsSplayDx, z: 0 } },
    ];
    // 下橫撐：trapezoid 但無 bevel；左右（Z）整支上移 staggerMm
    for (const s of lsSides) {
      const partShape = lsHasTaper
        ? { kind: "apron-trapezoid" as const, topLengthScale: lsTrapTopScale, bottomLengthScale: lsTrapBotScale }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
      const lsType: "through-tenon" | "shouldered-tenon" =
        lowerTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon";
      const tenons = (() => {
        if (!lowerCanHalfStagger) {
          const mk = (position: "start" | "end") => ({
            position,
            type: lsType,
            length: lsTenonLen,
            width: lsTenonW,
            thickness: lsTenonThick,
            shoulderOn: [...lowerTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right">,
          });
          return [mk("start"), mk("end")];
        }
        const isUpper = s.axis === "z";
        const worldOffset = isUpper ? lowerUpperTenonOffset : lowerLowerTenonOffset;
        const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = ["left", "right"];
        const mk = (position: "start" | "end") => ({
          position,
          type: lsType,
          length: lsTenonLen,
          width: lowerHalfTenonH,
          thickness: lsTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
        });
        return [mk("start"), mk("end")];
      })();
      lowerStretchers.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: lsSpan, width: lowerStretcherWidth, thickness: lowerStretcherThickness },
        origin: { x: s.origin.x, y: s.axis === "z" ? lsY0_z : lsY0, z: s.origin.z },
        rotation: s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tilt }
          : { x: Math.PI / 2 + (-s.sz) * tilt, y: 0, z: 0 },
        shape: partShape,
        tenons,
        mortises: [],
      });
    }
  }

  // 中央旋轉盤——坐在桌面上方 25mm 處（給軸承留空間）
  const lazySusanParts: Part[] = [];
  if (withLazySusan) {
    const dia = Math.min(lazySusanDiameter, diameter - 200);
    lazySusanParts.push({
      id: "lazy-susan",
      nameZh: `旋轉盤 (${dia}mm)`,
      material,
      grainDirection: "length",
      visible: { length: dia, width: dia, thickness: 22 },
      // 桌面頂面 = legHeight + topThickness；軸承約 25mm 高
      origin: { x: 0, y: legHeight + 25, z: 0 },
      shape: { kind: "round" },
      tenons: [],
      mortises: [],
    });
  }

  const design: FurnitureDesign = {
    id: `round-table-${diameter}x${height}`,
    category: "round-table",
    nameZh: "圓餐桌",
    overall: { length: diameter, width: diameter, thickness: height },
    parts: [top, ...legs, ...aprons, ...lowerStretchers, ...lazySusanParts],
    defaultJoinery: "shouldered-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `圓餐桌直徑 ${diameter}mm × 高 ${height}mm，4 隻${legShapeLabel(legShape)}含帶肩牙板。${
      legShape === "fluted-square"
        ? `古典方腿：腳的 4 面各刨 3-5 道垂直凹槽（reed/flute），凹槽寬 5-8mm、深 3-5mm，從腳頂下 30mm 起到地面上 50mm 止（端不通到底，留實木）。`
        : ""
    }${
      legShape === "lathe-turned"
        ? `車旋腳：上車床車出多段球節 + 主桿輪廓，建議用直徑 ≥ legSize 的圓料（${legSize}mm 以上）才有料可車。`
        : ""
    }${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${withLazySusan ? ` 中央旋轉盤直徑 ${Math.min(lazySusanDiameter, diameter - 200)}mm，需配 12-16 吋金屬軸承一組（依旋轉盤尺寸選）。` : ""}${(() => { const tp = getOption<string>(input, opt(o, "topPattern")); return tp === "radial" ? " 桌面採放射狀拼板（pie segments，4-8 片三角板對拼出圓盤）。" : tp === "concentric" ? " 桌面採同心環拼板（內小圓 + 外環兩圈）。" : tp === "star-match" ? " 桌面採星形對拼（4-8 個三角板鏡像對拼出星形紋路）。" : ""; })()}`.trim(),
  };
  const w = validateRoundLegJoinery(design);
  if (w.length) design.warnings = [...(design.warnings ?? []), ...w];
  applyStandardChecks(design, {
    minLength: 700, minWidth: 700, minHeight: 600,
    maxLength: 1500, maxWidth: 1500, maxHeight: 800,
  });
  return design;
};
