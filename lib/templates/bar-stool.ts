import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners, RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, legShapeLabel } from "./_helpers";
import { applyStandardChecks, validateStoolStructure, appendWarnings } from "./_validators";
import { SPLAY_ANGLE } from "@/lib/knowledge/chair-geometry";
// 吧台椅尺寸範圍很穩定，沒明顯需要建議切換的目標模板（dining-chair 是椅背較大的不同物件）。

export const barStoolOptions: OptionSpec[] = [
  // 吧檯椅排除「方錐漸縮（大幅下收）」——重心高、下收太多會頭重腳輕
  { group: "leg", type: "select", key: "legShape", label: "椅腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES.filter((c) => c.value !== "strong-taper") },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 80, step: 1, help: "正方腳預設值。若下方寬/厚另填則優先使用" },
  { group: "leg", type: "number", key: "legWidthOverride", label: "椅腳寬 X (mm)", defaultValue: 0, min: 0, max: 120, step: 1, help: "0 = 用「椅腳粗」；填值 = 沿座板長邊 X 的尺寸（可做扁腳）" },
  { group: "leg", type: "number", key: "legDepthOverride", label: "椅腳厚 Z (mm)", defaultValue: 0, min: 0, max: 120, step: 1, help: "0 = 用「椅腳粗」；填值 = 沿座板寬邊 Z 的尺寸" },
  { group: "leg", type: "number", key: "legInset", label: "椅腳內縮 (mm)", defaultValue: 0, min: 0, max: 150, step: 5, help: "椅腳從座板邊緣往內縮的距離（每邊）" },
  { group: "leg", type: "number", key: "splayAngle", label: "外斜角度 (°)", defaultValue: SPLAY_ANGLE.stoolDefaultDeg, min: 1, max: SPLAY_ANGLE.barStoolMaxDeg, step: 0.5, unit: "°", help: `斜腳系列才有效——從垂直起算的外傾角度。吧檯椅較高，建議不超過 8°，太斜底盤過大不穩（上限 ${SPLAY_ANGLE.barStoolMaxDeg}°）`, dependsOn: { key: "legShape", oneOf: ["splayed", "splayed-length", "splayed-width"] } },
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 28, min: 15, max: 60, step: 1 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  seatProfileOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "stretcher", type: "number", key: "footrestHeight", label: "腳踏高 (mm)", defaultValue: 350, min: 50, max: 700, step: 10, help: "腳踏離地高度。吧檯椅標準＝座面下 400–450mm（座面 750→腳踏 300–350；座面 800→腳踏 350–400）；counter stool 較矮，距座面約 300mm" },
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 50, min: 20, max: 150, step: 5 },
  { group: "apron", type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 18, min: 10, max: 40, step: 1, help: "牙板的水平厚度（垂直於座板邊）" },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 5, min: 0, max: 300, step: 5, help: "牙板頂緣往下退的距離" },
  { group: "apron", type: "number", key: "apronStaggerMm", label: "牙板錯開 (mm)", defaultValue: 0, min: 0, max: 60, step: 2, help: "左右牙板相對前後牙板抬高量，避免榫眼重疊；建議 ≥ 牙板厚" },
  { group: "back", type: "select", key: "backStyle", label: "椅背樣式", defaultValue: "none", choices: [
    { value: "none", label: "無椅背" },
    { value: "rail", label: "短橫木（一根橫木）" },
    { value: "slats", label: "直條式（N 根垂直板條）" },
    { value: "panel", label: "弧形板（單片圓角板背）" },
  ] },
  { group: "back", type: "number", key: "backPanelHeight", label: "弧形板高 (mm)", defaultValue: 180, min: 100, max: 400, step: 10, help: "椅背板的垂直高（圓角矩形板）", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelThickness", label: "弧形板厚 (mm)", defaultValue: 18, min: 10, max: 30, step: 1, dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelCornerR", label: "弧形板圓角 (mm)", defaultValue: 30, min: 0, max: 100, step: 2, help: "板的四角圓角半徑", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelTopArch", label: "上緣拱起 (mm)", defaultValue: 0, min: -80, max: 80, step: 2, help: "板上緣中央位移；正值往上拱（拱形頂），負值往下凹（凹弧頂）；0 = 平頂", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelBottomArch", label: "下緣拱起 (mm)", defaultValue: 0, min: -80, max: 80, step: 2, help: "板下緣中央位移；正值往上拱（D 形/月牙），負值往下延伸（裙擺）；0 = 平底", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelFaceBend", label: "弧形板大面彎曲 (mm)", defaultValue: 0, min: 0, max: 80, step: 2, help: "板的大面（前/後）凹陷量；0 = 平板，數值越大越彎（建議 10–30 做 lumbar 腰靠）", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPostDiameter", label: "圓形支撐柱直徑 (mm)", defaultValue: 25, min: 15, max: 50, step: 1, help: "支撐椅背板的兩支圓形垂直木", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelInset", label: "靠背距椅面後緣 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "圓柱後緣從椅面後緣往前的距離；0 = 圓柱後緣與椅面後緣對齊", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backReclineDeg", label: "靠背後仰角 (°)", defaultValue: 0, min: 0, max: 20, step: 0.5, unit: "°", help: "靠背向後傾斜的角度；正視圖看仍是直的，側視圖才會看到斜度（圓柱與板同步傾斜）", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPostFromEdge", label: "圓柱距板端面 (mm)", defaultValue: 30, min: 0, max: 200, step: 5, help: "圓柱中心到靠背板左/右端面的距離；圓柱貼著板背", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backPanelEmbed", label: "靠背卡入圓柱 (mm)", defaultValue: 6, min: 0, max: 30, step: 1, help: "靠背板嵌入圓柱的深度；接合處從圓柱扣掉同尺寸的平面", dependsOn: { key: "backStyle", equals: "panel" } },
  { group: "back", type: "number", key: "backHeight", label: "椅背高 (mm)", defaultValue: 200, min: 80, max: 500, step: 10, help: "從座板上緣到椅背頂", dependsOn: { key: "backStyle", notIn: ["none"] } },
  { group: "back", type: "number", key: "backSlats", label: "直條數（直條式用）", defaultValue: 3, min: 1, max: 8, step: 1, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "backSlatWidth", label: "直條寬 (mm)", defaultValue: 40, min: 15, max: 150, step: 5, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "backSlatThickness", label: "直條厚 (mm)", defaultValue: 16, min: 8, max: 40, step: 1, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "topRailHeight", label: "頂橫木寬 (mm)", defaultValue: 0, min: 0, max: 120, step: 5, help: "0 = 自動（椅背高的 1/3，最大 50）；自己填值會優先", dependsOn: { key: "backStyle", notIn: ["none", "panel"] } },
  { group: "back", type: "number", key: "topRailThickness", label: "頂橫木厚 (mm)", defaultValue: 22, min: 12, max: 50, step: 1, dependsOn: { key: "backStyle", notIn: ["none", "panel"] } },
  { group: "stretcher", type: "number", key: "footrestWidth", label: "腳踏寬 (mm)", defaultValue: 30, min: 20, max: 60, step: 1, help: "腳踏橫撐的垂直高（粗）" },
  { group: "stretcher", type: "number", key: "footrestThickness", label: "腳踏厚 (mm)", defaultValue: 22, min: 12, max: 40, step: 1, help: "腳踏橫撐的水平厚（深）" },
  { group: "stretcher", type: "number", key: "footrestStaggerMm", label: "下橫撐錯開 (mm)", defaultValue: 0, min: 0, max: 60, step: 2, help: "左右下橫撐相對前後下橫撐抬高量，避免榫眼重疊；建議 ≥ 腳踏厚" },
];

/**
 * 吧檯椅（bar stool）
 * 高度 700–800mm，一圈腳踏橫撐在較低位置；可選加短椅背。
 */
export const barStool: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;
  const o = barStoolOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legWidthOverride = getOption<number>(input, opt(o, "legWidthOverride"));
  const legDepthOverride = getOption<number>(input, opt(o, "legDepthOverride"));
  const legW = legWidthOverride > 0 ? legWidthOverride : legSize;
  const legD = legDepthOverride > 0 ? legDepthOverride : legSize;
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const apronStaggerMm = getOption<number>(input, opt(o, "apronStaggerMm"));
  const footrestStaggerMm = getOption<number>(input, opt(o, "footrestStaggerMm"));
  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const footrestHeight = getOption<number>(input, opt(o, "footrestHeight"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const backStyle = getOption<string>(input, opt(o, "backStyle"));
  const backHeightOpt = getOption<number>(input, opt(o, "backHeight"));
  const backSlatCount = getOption<number>(input, opt(o, "backSlats"));
  const backSlatWidth = getOption<number>(input, opt(o, "backSlatWidth"));
  const backPanelHeight = getOption<number>(input, opt(o, "backPanelHeight"));
  const backPanelThickness = getOption<number>(input, opt(o, "backPanelThickness"));
  const backPanelCornerR = getOption<number>(input, opt(o, "backPanelCornerR"));
  const backPanelFaceBend = getOption<number>(input, opt(o, "backPanelFaceBend"));
  const backPanelTopArch = getOption<number>(input, opt(o, "backPanelTopArch"));
  const backPanelBottomArch = getOption<number>(input, opt(o, "backPanelBottomArch"));
  const backPostDiameter = getOption<number>(input, opt(o, "backPostDiameter"));
  const backPanelInset = getOption<number>(input, opt(o, "backPanelInset"));
  const backReclineDeg = getOption<number>(input, opt(o, "backReclineDeg"));
  const backPostFromEdge = getOption<number>(input, opt(o, "backPostFromEdge"));
  const backPanelEmbed = getOption<number>(input, opt(o, "backPanelEmbed"));
  const footRestWidth = getOption<number>(input, opt(o, "footrestWidth"));
  const footRestThickness = getOption<number>(input, opt(o, "footrestThickness"));
  const splayAngle = getOption<number>(input, opt(o, "splayAngle"));
  const withBack = backStyle !== "none";

  const apronThickness = getOption<number>(input, opt(o, "apronThickness"));
  // footRestWidth / footRestThickness 已從 options 讀入（line 50-51）
  // 正規榫卯比例：榫厚 = min(apron 厚 - 兩肩 12, 柱腳 1/3)；肩寬固定 6mm
  const MIN_SHOULDER = 6;
  const apronTenonLen = Math.round((legSize * 2) / 3);
  const apronTenonThick = Math.max(
    5,
    Math.min(apronThickness - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
  );
  const apronTenonW = Math.max(12, apronWidth - 2 * MIN_SHOULDER);
  const frTenonThick = Math.max(
    5,
    Math.min(footRestThickness - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
  );
  const frTenonW = Math.max(12, footRestWidth - 2 * MIN_SHOULDER);
  const seatTopTenonLen = seatThickness;
  const legTopTenonSize = Math.max(15, Math.round((legSize * 2) / 3));

  const seatY = height - seatThickness;
  const backHeight = withBack ? backHeightOpt : 0;
  const halfL = length / 2 - legW / 2 - legInset;
  const halfW = width / 2 - legD / 2 - legInset;
  const cornerPts = [
    { x: -halfL, z: -halfW },
    { x: halfL, z: -halfW },
    { x: -halfL, z: halfW },
    { x: halfL, z: halfW },
  ];
  const innerSpanX = length - legW - 2 * legInset;
  const innerSpanZ = width - legD - 2 * legInset;
  const legEdgeZ = halfW;
  const legEdgeX = halfL;

  // Leg shape mapping (same set as dining-table / dining-chair)
  // splayMm = tan(splayAngle) × seatY，腳底向外偏移量（前後腳共用同一偏移，視覺一致）
  const splayMm = Math.round(Math.tan((splayAngle * Math.PI) / 180) * seatY);
  const hoofMm = 30;
  const legShapeFor = (c: { x: number; z: number }): Part["shape"] => {
    if (legShape === "tapered") return { kind: "tapered", bottomScale: 0.6 };
    if (legShape === "strong-taper") return { kind: "tapered", bottomScale: 0.4 };
    if (legShape === "inverted") return { kind: "tapered", bottomScale: 1.25 };
    if (legShape === "splayed") {
      return {
        kind: "splayed",
        dxMm: Math.sign(c.x) * splayMm,
        dzMm: Math.sign(c.z) * splayMm,
        chamferMm: legEdge > 0 ? legEdge : undefined,
        chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered",
      };
    }
    if (legShape === "splayed-length") {
      return { kind: "splayed", dxMm: Math.sign(c.x) * splayMm, dzMm: 0, chamferMm: legEdge > 0 ? legEdge : undefined, chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered" };
    }
    if (legShape === "splayed-width") {
      return { kind: "splayed", dxMm: 0, dzMm: Math.sign(c.z) * splayMm, chamferMm: legEdge > 0 ? legEdge : undefined, chamferStyle: legEdgeStyle === "rounded" ? "rounded" : "chamfered" };
    }
    if (legShape === "hoof") return { kind: "hoof", hoofMm, hoofScale: 1.3 };
    return undefined;
  };

  // 椅背 joinery 位置：頂橫木 + 板條 X 座標——legs / rail / apron / seat 都要引用
  const topRailHOverride = getOption<number>(input, opt(o, "topRailHeight"));
  const topRailH = withBack
    ? (topRailHOverride > 0 ? topRailHOverride : Math.min(50, Math.round(backHeight / 3)))
    : 0;
  const topRailThickness = getOption<number>(input, opt(o, "topRailThickness"));
  const topRailY = withBack ? seatY + backHeight - topRailH : 0;
  const topRailYCenter = topRailY + topRailH / 2;
  const topRailTenonW = withBack ? Math.max(12, topRailH - 10) : 0;
  const topRailTenonThick = 17;
  const slatXs: number[] = [];
  const slatThicknessConst = getOption<number>(input, opt(o, "backSlatThickness"));
  const slatTenonLen = 12;
  const slatTenonW = (w: number) => Math.max(10, w - 10);
  const slatTenonT = Math.max(5, Math.round(slatThicknessConst / 3));
  if (withBack && backStyle === "slats" && backSlatCount > 0) {
    const availableW = length - legSize - 40;
    const pitch = availableW / (backSlatCount + 1);
    for (let i = 0; i < backSlatCount; i++) {
      slatXs.push(-availableW / 2 + pitch * (i + 1));
    }
  }

  const legs: Part[] = cornerPts.map((c, i) => {
    // 弧形板背：後腳不延伸到椅背高（板由獨立圓柱支撐）
    const isBack = c.z > 0 && withBack && backStyle !== "panel";
    const legTotalH = isBack ? seatY + backHeight : seatY;
    return {
      id: `leg-${i + 1}`,
      nameZh: isBack ? `後椅腳 ${i + 1}` : `椅腳 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legW, width: legD, thickness: legTotalH },
      origin: { x: c.x, y: 0, z: c.z },
      shape: legShapeFor(c) ?? legEdgeShape(legEdge, legEdgeStyle),
      tenons: isBack ? [] : [
        {
          position: "top",
          type: "through-tenon",
          length: seatTopTenonLen,
          width: legTopTenonSize,
          thickness: legTopTenonSize,
        },
      ],
      mortises: [
        // 座板下牙板（前/後牙板：y = ringY；左/右牙板：y = ringY - apronStaggerMm）
        {
          origin: { x: 0, y: seatY - apronWidth - apronOffset, z: c.z > 0 ? -1 : 1 },
          depth: apronTenonLen,
          length: apronTenonW,
          width: apronTenonThick,
          through: false,
        },
        {
          origin: { x: c.x > 0 ? -1 : 1, y: seatY - apronWidth - apronOffset - apronStaggerMm, z: 0 },
          depth: apronTenonLen,
          length: apronTenonW,
          width: apronTenonThick,
          through: false,
        },
        // 腳踏橫撐（前/後：y = footrestHeight；左/右：y = footrestHeight + footrestStaggerMm）
        {
          origin: { x: 0, y: footrestHeight, z: c.z > 0 ? -1 : 1 },
          depth: apronTenonLen,
          length: frTenonW,
          width: frTenonThick,
          through: false,
        },
        {
          origin: { x: c.x > 0 ? -1 : 1, y: footrestHeight + footrestStaggerMm, z: 0 },
          depth: apronTenonLen,
          length: frTenonW,
          width: frTenonThick,
          through: false,
        },
        // 背腳：椅背頂橫木的母榫眼
        ...(isBack
          ? [
              {
                origin: { x: c.x > 0 ? -1 : 1, y: topRailYCenter, z: 0 },
                depth: apronTenonLen,
                length: topRailTenonW,
                width: topRailTenonThick,
                through: false,
              },
            ]
          : []),
      ],
    };
  });

  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: seatY, z: 0 },
    shape: seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle),
    tenons: [],
    // 前腳通榫進來；後腳穿過座板高度範圍，要開大孔讓腳通過。
    // slats 從座板上面立起到頂橫木 → 座板上緣加 slat 母榫眼
    mortises: [
      ...cornerPts
        .filter((c) => !(withBack && c.z > 0))
        .map((c) => ({
          origin: { x: c.x, y: 0, z: c.z },
          depth: seatThickness,
          length: legTopTenonSize,
          width: legTopTenonSize,
          through: true,
        })),
      ...cornerPts
        .filter((c) => withBack && c.z > 0)
        .map((c) => ({
          origin: { x: c.x, y: 0, z: c.z },
          depth: seatThickness,
          length: legSize,
          width: legSize,
          through: true,
        })),
      ...slatXs.map((sx) => ({
        origin: { x: sx, y: seatThickness, z: legEdgeZ },
        depth: slatTenonLen,
        length: slatTenonW(backSlatWidth),
        width: slatTenonT,
        through: false,
      })),
    ],
  };

  const ringY = seatY - apronWidth - apronOffset;

  // 斜腳補償（同 square-stool）：以橫撐中軸 Y 為基準算 splay 偏移 → 中軸跟腳中軸對齊；
  // 上下緣縮放成 trapezoid → 端面跟著腳傾斜；rotation 帶 tilt → 橫撐軸與腳軸平行。
  const isLengthSplay = legShape === "splayed" || legShape === "splayed-length";
  const isWidthSplay = legShape === "splayed" || legShape === "splayed-width";
  const splayDx = isLengthSplay ? splayMm : 0;
  const splayDz = isWidthSplay ? splayMm : 0;
  const isSplayed = splayDx > 0 || splayDz > 0;
  const tiltX = splayDx > 0 ? Math.atan(splayDx / seatY) : 0;
  const tiltZ = splayDz > 0 ? Math.atan(splayDz / seatY) : 0;

  // 通用：給定該層橫撐的「橫撐料」中軸 Y 與料厚 W，產生四面 sides。
  const buildSides = (centerY: number, beamWidth: number, namePrefix: string) => {
    const botY = centerY - beamWidth / 2;
    const topY = centerY + beamWidth / 2;
    const shiftAt = (yMm: number) => seatY > 0 ? 1 - yMm / seatY : 0;
    const sCenter = shiftAt(centerY);
    const sBot = shiftAt(botY);
    const sTop = shiftAt(topY);
    const splayXc = splayDx * sCenter;
    const splayZc = splayDz * sCenter;
    const splayXt = splayDx * sTop;
    const splayZt = splayDz * sTop;
    const splayXb = splayDx * sBot;
    const splayZb = splayDz * sBot;
    return {
      sides: [
        // 正確 visible.length 公式：innerSpan(中心到中心) − legSize(扣兩半邊腳) + 2×tenonLen(榫頭凸進母榫)。
        // 舊的 +2×tenonLen 沒扣 legSize → apron 兩端凸出腳外面 17mm，從正面看像穿過腳。
        // beginner-mode.ts 的 shrink = 2×tenonLen − taperOffset 預期搭配此公式。
        { key: "front", nameZh: `前${namePrefix}`, visibleLength: innerSpanX - legW + 2 * splayXc + 2 * apronTenonLen, axis: "x" as const, sx: 0, sz: -1, origin: { x: 0, z: -(legEdgeZ + splayZc) } },
        { key: "back", nameZh: `後${namePrefix}`, visibleLength: innerSpanX - legW + 2 * splayXc + 2 * apronTenonLen, axis: "x" as const, sx: 0, sz: 1, origin: { x: 0, z: legEdgeZ + splayZc } },
        { key: "left", nameZh: `左${namePrefix}`, visibleLength: innerSpanZ - legD + 2 * splayZc + 2 * apronTenonLen, axis: "z" as const, sx: -1, sz: 0, origin: { x: -(legEdgeX + splayXc), z: 0 } },
        { key: "right", nameZh: `右${namePrefix}`, visibleLength: innerSpanZ - legD + 2 * splayZc + 2 * apronTenonLen, axis: "z" as const, sx: 1, sz: 0, origin: { x: legEdgeX + splayXc, z: 0 } },
      ],
      splayXc, splayZc, splayXt, splayZt, splayXb, splayZb,
    };
  };

  const apronCenterY = ringY + apronWidth / 2;
  const apronB = buildSides(apronCenterY, apronWidth, "牙板");
  const aprons: Part[] = apronB.sides.map((s) => {
    const trapTopScale =
      s.axis === "x" && splayDx > 0
        ? (legEdgeX + apronB.splayXt) / (legEdgeX + apronB.splayXc)
        : s.axis === "z" && splayDz > 0
          ? (legEdgeZ + apronB.splayZt) / (legEdgeZ + apronB.splayZc)
          : null;
    const trapBotScale =
      s.axis === "x" && splayDx > 0
        ? (legEdgeX + apronB.splayXb) / (legEdgeX + apronB.splayXc)
        : s.axis === "z" && splayDz > 0
          ? (legEdgeZ + apronB.splayZb) / (legEdgeZ + apronB.splayZc)
          : 1;
    const bevelAngle = isSplayed
      ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
      : 0;
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: bevelAngle || undefined }
      : isSplayed
        ? { kind: "apron-beveled" as const, bevelAngle }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    return {
      id: `apron-${s.key}`,
      nameZh: s.nameZh,
      material,
      grainDirection: "length" as const,
      visible: { length: s.visibleLength, width: apronWidth, thickness: apronThickness },
      origin: { x: s.origin.x, y: ringY + (s.axis === "z" ? -apronStaggerMm : 0), z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
        : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
      shape: partShape,
      tenons: [
        { position: "start" as const, type: "shouldered-tenon" as const, length: apronTenonLen, width: apronTenonW, thickness: apronTenonThick },
        { position: "end" as const, type: "shouldered-tenon" as const, length: apronTenonLen, width: apronTenonW, thickness: apronTenonThick },
      ],
      mortises: [],
    };
  });

  const frCenterY = footrestHeight + footRestWidth / 2;
  const frB = buildSides(frCenterY, footRestWidth, "腳踏");
  const footRests: Part[] = frB.sides.map((s) => {
    const trapTopScale =
      s.axis === "x" && splayDx > 0
        ? (legEdgeX + frB.splayXt) / (legEdgeX + frB.splayXc)
        : s.axis === "z" && splayDz > 0
          ? (legEdgeZ + frB.splayZt) / (legEdgeZ + frB.splayZc)
          : null;
    const trapBotScale =
      s.axis === "x" && splayDx > 0
        ? (legEdgeX + frB.splayXb) / (legEdgeX + frB.splayXc)
        : s.axis === "z" && splayDz > 0
          ? (legEdgeZ + frB.splayZb) / (legEdgeZ + frB.splayZc)
          : 1;
    const bevelAngle = isSplayed
      ? s.axis === "x" ? -s.sz * tiltZ : -s.sx * tiltX
      : 0;
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: bevelAngle || undefined }
      : isSplayed
        ? { kind: "apron-beveled" as const, bevelAngle }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    return {
      id: `footrest-${s.key}`,
      nameZh: `腳踏-${s.nameZh.replace("腳踏", "")}`,
      material,
      grainDirection: "length" as const,
      visible: { length: s.visibleLength, width: footRestWidth, thickness: footRestThickness },
      origin: { x: s.origin.x, y: footrestHeight + (s.axis === "z" ? footrestStaggerMm : 0), z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
        : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
      shape: partShape,
      tenons: [
        { position: "start" as const, type: "blind-tenon" as const, length: apronTenonLen, width: frTenonW, thickness: frTenonThick },
        { position: "end" as const, type: "blind-tenon" as const, length: apronTenonLen, width: frTenonW, thickness: frTenonThick },
      ],
      mortises: [],
    };
  });

  const parts: Part[] = [seatPanel, ...legs, ...aprons, ...footRests];

  if (withBack) {
    if (backStyle !== "panel") {
    // 頂橫木一定有——鎖住後腳頂部。slat 從下方接入，下緣加 slat 母榫眼
    parts.push({
      id: "back-rail",
      nameZh: "椅背頂橫木",
      material,
      grainDirection: "length",
      visible: { length: innerSpanX + 2 * apronTenonLen, width: topRailThickness, thickness: topRailH },
      origin: { x: 0, y: topRailY, z: legEdgeZ },
      tenons: [
        { position: "start", type: "blind-tenon", length: apronTenonLen, width: topRailTenonW, thickness: topRailTenonThick },
        { position: "end", type: "blind-tenon", length: apronTenonLen, width: topRailTenonW, thickness: topRailTenonThick },
      ],
      mortises: slatXs.map((sx) => ({
        origin: { x: sx, y: 0, z: 0 },
        depth: slatTenonLen,
        length: slatTenonW(backSlatWidth),
        width: slatTenonT,
        through: false,
      })),
    });
    }
    if (backStyle === "panel") {
      // 弧形板背：板跨左右後腳間，圓柱貼在板背面，距板端面 backPostFromEdge
      const panelLen = innerSpanX + 2 * apronTenonLen;
      // 參照物 = 圓柱「接座板處」的後緣（圓柱底端）。inset=0 → 圓柱底後緣對齊椅面後緣
      // 後仰時圓柱底端會往 -Z 偏 reclineDz，故 postZ（中心，頂端在此 Z）需 +reclineDz 補回
      const reclineRad = (backReclineDeg * Math.PI) / 180;
      const reclineDz = Math.tan(reclineRad) * backHeight;
      const postBottomBackZ = width / 2 - backPanelInset; // 圓柱底端後緣 Z（基準）
      const postZ_calc = postBottomBackZ - backPostDiameter / 2 + reclineDz;
      // 靠背板嵌入圓柱 backPanelEmbed mm；後仰時板繞自身中軸旋轉，板背面會位移：
      // 板背面 Z 偏移 = backPanelHeight/2 * sin + backPanelThickness/2 * cos，要從 panelZ 扣回來
      const cosR = Math.cos(reclineRad);
      const sinR = Math.sin(reclineRad);
      const panelZ = postZ_calc - backPostDiameter / 2 - (backPanelThickness / 2) * cosR + backPanelEmbed - (backPanelHeight / 2) * sinR;
      const postX = panelLen / 2 - backPostFromEdge;
      const postZ = postZ_calc;
      const postBottomY = seatY;
      const postH = backHeight;
      const panelTopY = seatY + backHeight;
      const panelOriginY = panelTopY - backPanelHeight;
      // 兩支圓柱：正視圖直立（X 不斜），側視圖跟著靠背後仰角度斜（Z 方向）；reclineRad/reclineDz 已在上面定義
      [-1, 1].forEach((sx) => {
        parts.push({
          id: `back-post-${sx > 0 ? "right" : "left"}`,
          nameZh: `椅背圓柱-${sx > 0 ? "右" : "左"}`,
          material,
          grainDirection: "length",
          visible: { length: backPostDiameter, width: backPostDiameter, thickness: postH },
          // round + rotation 讓圓柱後仰；之前用 splayed 會 fallback 成方柱（splayed 不在 isRound）
          // rotation 繞 mesh 中心，所以 origin.z 要往後偏 halfPostH×sin θ 讓底端回到原位
          origin: { x: sx * postX, y: postBottomY - (postH / 2) * (1 - Math.cos(reclineRad)), z: (postBottomBackZ - backPostDiameter / 2) + (postH / 2) * Math.sin(reclineRad) },
          rotation: reclineRad > 0 ? { x: reclineRad, y: 0, z: 0 } : undefined,
          shape: { kind: "round" },
          tenons: [
            { position: "bottom", type: "blind-tenon", length: 25, width: Math.round(backPostDiameter * 0.6), thickness: Math.round(backPostDiameter * 0.6) },
            { position: "top", type: "blind-tenon", length: 20, width: Math.round(backPostDiameter * 0.6), thickness: Math.round(backPostDiameter * 0.6) },
          ],
          mortises: [],
        });
      });
      // 弧形板：跟著圓柱一起後仰。圓柱用 splayed shape，底端在 -Z 偏 reclineDz、頂在 origin。
      // rotation.x = reclineRad 是繞「板自己的中心」轉，所以對齊基準要用「板中心 Y」處的圓柱位置，
      // 不是板底 Y——用板底會讓板頂過頭、板底跑出來，整片扭曲。
      // 板中心 Y 距圓柱頂端的距離 = backPanelHeight/2；圓柱頂後仰 reclineDz，所以中心 Y 處後仰 reclineDz × (1 − halfPanelH/postH)。
      const postZAtPanelCenter = postZ - reclineDz * (backPanelHeight / 2 / Math.max(1, postH));
      const panelBottomZ = postZAtPanelCenter - backPostDiameter / 2 - backPanelThickness / 2;
      // bend + recline 視覺修正：彎板把幾何中心推到 +Z（centroid ≈ bendMm × 2/3），
      // 但 mesh.rotation.x 是繞 mesh 局部 (0,0,0) 轉，不是繞 centroid。
      // 結果：recline 後板會往下沉、視覺上頂緣比底緣更彎、整片像扭一下。
      // 修法：補上「繞 centroid 旋轉」等價的 origin 偏移：
      //   newOrigin = origin + (I − R) × centroid
      //   對 X 軸旋轉 + centroid (0,0,c)：偏移 = (0, c·sinθ, c·(1−cosθ))
      const bendCentroidZ = (backPanelFaceBend * 2) / 3;
      const compensationY = bendCentroidZ * Math.sin(reclineRad);
      const compensationZ = bendCentroidZ * (1 - Math.cos(reclineRad));
      parts.push({
        id: "back-panel",
        nameZh: "椅背弧形板",
        material,
        grainDirection: "length",
        visible: { length: panelLen, width: backPanelThickness, thickness: backPanelHeight },
        origin: { x: 0, y: panelOriginY + compensationY, z: panelBottomZ + compensationZ },
        rotation: reclineDz > 0 ? { x: reclineRad, y: 0, z: 0 } : undefined,
        shape: { kind: "face-rounded", cornerR: backPanelCornerR, topArchMm: backPanelTopArch, bottomArchMm: backPanelBottomArch, bendMm: backPanelFaceBend },
        tenons: [],
        mortises: [],
      });
    } else if (backStyle === "slats" && backSlatCount > 0) {
      const slatLen = backHeight - topRailH;
      slatXs.forEach((xCenter, i) => {
        parts.push({
          id: `back-slat-${i + 1}`,
          nameZh: `椅背板條 ${i + 1}`,
          material,
          grainDirection: "length",
          visible: { length: slatLen, width: backSlatWidth, thickness: slatThicknessConst },
          origin: { x: xCenter, y: seatY, z: legEdgeZ },
          rotation: { x: 0, y: 0, z: Math.PI / 2 },
          tenons: [
            { position: "start", type: "blind-tenon", length: slatTenonLen, width: slatTenonW(backSlatWidth), thickness: slatTenonT },
            { position: "end", type: "blind-tenon", length: slatTenonLen, width: slatTenonW(backSlatWidth), thickness: slatTenonT },
          ],
          mortises: [],
        });
      });
    }
  }

  const design: FurnitureDesign = {
    id: `bar-stool-${length}x${width}x${height}`,
    category: "bar-stool",
    nameZh: "吧檯椅",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes:
      `吧檯椅：高度 ${height}mm（建議 700–800）；腳樣式 ${legShapeLabel(legShape)}；` +
      `四面腳踏（離地 ${footrestHeight}mm）；` +
      `${withBack ? "含短椅背" : "無椅背"}。座板與椅腳通榫，牙板/腳踏與椅腳半榫。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : ""}`,
  };

  applyStandardChecks(design, {
    minLength: 300, minWidth: 300, minHeight: 600,
    maxLength: 550, maxWidth: 550, maxHeight: 900,
  });
  appendWarnings(
    design,
    validateStoolStructure({
      legSize,
      height,
      seatThickness,
      seatSpan: Math.max(length, width),
      lowerStretcherHeight: footrestHeight > 0 ? footrestHeight : undefined,
      hasLowerStretcher: true, // bar-stool 一定有腳踏圈，視為下橫撐結構
    }),
  );
  return design;
};
