import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners, RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, backRakeOption, backRakeNote, legShapeLabel, legBottomScale, legScaleAt } from "./_helpers";
import { applyStandardChecks } from "./_validators";
import { DINING_CHAIR } from "@/lib/knowledge/chair-geometry";
import { standardTenon, autoTenonType } from "@/lib/joinery/standards";

export const diningChairOptions: OptionSpec[] = [
  // 腳
  { group: "leg", type: "select", key: "legShape", label: "椅腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1 },
  // 座板
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  { group: "top", type: "number", key: "seatHeight", label: "坐高 (mm)", defaultValue: DINING_CHAIR.seatHeightMm, min: 150, max: 900, step: 10, help: `地面到座板上緣，一般 ${DINING_CHAIR.seatHeightRangeMm[0]}–${DINING_CHAIR.seatHeightRangeMm[1]}（FWW 共識）` },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  // 座面舒適度
  seatProfileOption("top"),
  { group: "top", type: "checkbox", key: "seatFrontWaterfall", label: "座板前緣 waterfall 圓化", defaultValue: false, help: "座板前緣大圓化（R20-R30），減少對大腿後側壓迫，久坐不麻", wide: true },
  { group: "top", type: "number", key: "seatBendMm", label: "椅面彎曲 (mm)", defaultValue: 0, min: 0, max: 25, step: 1, help: "整片椅面像彎合板那樣彎曲，中間下凹比較好坐；四角榫眼位置不受影響。>0 會覆蓋鞍形 / 邊緣 profile / waterfall" },
  // 牙板
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 60, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 0, min: 0, max: 150, step: 5, help: "牙板頂緣往下退的距離；0 = 齊平座板下緣（最常見）" },
  // 椅背
  { group: "back", type: "select", key: "backStyle", label: "椅背樣式", defaultValue: "slats", choices: [
    { value: "slats", label: "直條式（垂直板條）" },
    { value: "ladder", label: "橫檔式（水平橫木 3–5 根）" },
    { value: "splat", label: "中板式（中央單片寬板）" },
    { value: "windsor", label: "Windsor spindle 風格（多支圓棒）" },
    { value: "curved-splat", label: "曲面中板（弧形貼合背部）" },
  ] },
  { group: "back", type: "number", key: "backSlats", label: "直條數（直條式用）", defaultValue: 3, min: 0, max: 10, step: 1, help: "backStyle=直條 時有效", dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "slatWidth", label: "直條寬 (mm)", defaultValue: 50, min: 15, max: 200, step: 5, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "ladderRungs", label: "橫檔數（橫檔式用）", defaultValue: 4, min: 2, max: 8, step: 1, dependsOn: { key: "backStyle", equals: "ladder" } },
  { group: "back", type: "number", key: "splatWidth", label: "中板寬 (mm)（中板式用）", defaultValue: 180, min: 80, max: 400, step: 10, dependsOn: { key: "backStyle", equals: "splat" } },
  { group: "back", type: "number", key: "curvedSplatWidth", label: "曲面中板寬 (mm)", defaultValue: 220, min: 100, max: 450, step: 10, help: "曲面中板的水平寬度", dependsOn: { key: "backStyle", equals: "curved-splat" } },
  { group: "back", type: "number", key: "curvedSplatBendMm", label: "曲面中板凹陷 (mm)", defaultValue: 20, min: -60, max: 60, step: 2, help: "正值往背面凹（貼合背部）；負值往前凸（外凸）；0 = 平板", dependsOn: { key: "backStyle", equals: "curved-splat" } },
  { group: "back", type: "number", key: "backTopRailHeight", label: "椅背頂橫木高 (mm)", defaultValue: 50, min: 20, max: 180, step: 5 },
  backRakeOption("back"),
  // 扶手
  { group: "back", type: "checkbox", key: "withArmrest", label: "加扶手", defaultValue: false, help: "後腳延伸往前接到前腳上方的扶手（會增加木料 + 工時）" },
  { group: "back", type: "number", key: "armrestHeight", label: "扶手高（座板上）(mm)", defaultValue: 200, min: 150, max: 280, step: 10, help: "從座板上緣到扶手頂面", dependsOn: { key: "withArmrest", equals: true } },
  // 橫撐
  { group: "stretcher", type: "select", key: "stretcherStyle", label: "下橫撐樣式", defaultValue: "none", choices: [
    { value: "none", label: "無下橫撐" },
    { value: "h-frame", label: "H 形（左右 + 中央連接）" },
    { value: "box", label: "田字形（四周一圈）" },
    { value: "side-only", label: "雙側（左右兩條，前後不加）" },
  ] },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10, help: "0 = 自動（坐高的 25%）", dependsOn: { key: "stretcherStyle", notIn: ["none"] } },
];

/**
 * 餐椅（dining-chair）
 *
 * 結構（簡化版）：
 *  - 1 × 座板
 *  - 4 × 椅腳（前 2 短至座面，後 2 延伸至椅背頂）
 *  - 4 × 座面下牙板（半榫接椅腳）
 *  - 1 × 椅背頂橫木（連接後 2 椅腳上端）
 *  - 2 × 椅背板條（直立，半榫接座面後牙板與頂橫木）
 *
 * 已知簡化：後腳以直料表示。實際舒適餐椅會有後仰曲線（10–15°），需後腳上半段
 * 後傾或鋸成 S 形。SVG/3D 渲染目前以 axis-aligned box 為主，無法表現曲線；
 * 製作時請依工序文件以樣板鋸出後腳曲線後再鑿榫眼。
 */
export const diningChair: FurnitureTemplate = (input): FurnitureDesign => {
  const { length, width, height, material } = input;
  const o = diningChairOptions;

  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const seatThickness = getOption<number>(input, opt(o, "seatThickness"));
  const seatHeight = getOption<number>(input, opt(o, "seatHeight"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const seatFrontWaterfall = getOption<boolean>(input, opt(o, "seatFrontWaterfall"));
  const seatBendMm = getOption<number>(input, opt(o, "seatBendMm"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const backStyle = getOption<string>(input, opt(o, "backStyle"));
  const backRake = getOption<number>(input, opt(o, "backRake"));
  const withArmrest = getOption<boolean>(input, opt(o, "withArmrest"));
  const armrestHeight = getOption<number>(input, opt(o, "armrestHeight"));
  const slatCount = getOption<number>(input, opt(o, "backSlats"));
  const slatWidth = getOption<number>(input, opt(o, "slatWidth"));
  const ladderRungs = getOption<number>(input, opt(o, "ladderRungs"));
  const splatWidth = getOption<number>(input, opt(o, "splatWidth"));
  const curvedSplatBendMm = getOption<number>(input, opt(o, "curvedSplatBendMm"));
  const curvedSplatWidth = getOption<number>(input, opt(o, "curvedSplatWidth"));
  const topRailHeightOpt = getOption<number>(input, opt(o, "backTopRailHeight"));
  const stretcherStyle = getOption<string>(input, opt(o, "stretcherStyle"));
  const lowerStretcherHeightOpt = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const apronThickness = 20;
  const backHeight = height - seatHeight;
  // 正規比例（standardTenon 規則）：榫厚 = T/3、肩寬 5mm、盲榫長 = round(2/3 × M, ≥25)、通榫長 = M
  const MIN_SHOULDER = 6;
  // 1) leg ↔ seat：腳頂進座板，依自動規則（座板薄 → 通榫；厚 → 盲榫）
  const legTopTenonType = autoTenonType(seatThickness);
  const legTenonStd = standardTenon({
    type: legTopTenonType,
    childThickness: legSize,
    childWidth: legSize,
    motherThickness: seatThickness,
  });
  const legTopTenonSize = legTenonStd.width; // legSize x legSize → width = thickness
  // 2) apron ↔ leg：依自動規則（餐椅未提供 legPenetratingTenon UI option，全走自動）
  const apronTenonType = autoTenonType(legSize);
  const apronTenonStd = standardTenon({
    type: apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon",
    childThickness: apronThickness,
    childWidth: apronWidth,
    motherThickness: legSize,
  });
  // 通榫加 5mm 補償斜腳 rotation tilt 在世界軸投影損失
  const apronTenonLen = apronTenonStd.length + (apronTenonType === "through-tenon" ? 5 : 0);
  const apronTenonThick = apronTenonStd.thickness;
  const apronTenonW = apronTenonStd.width;
  // 牙板半榫錯位（無 stagger UI，apronStaggerMm 固定為 0 → 走半榫錯位）
  // 靜止 Z（左右）= 上半榫；移動 X（前後）= 下半榫
  // apronOffset = 0 → 牙板頂貼座板下緣 → 上半榫保留 10mm 上肩；> 0 → 同樣保留以維持半榫錯位
  const apronStaggerMm = 0;
  const APRON_TOP_SHOULDER = 10;
  const apronTotalTenonH = Math.max(0, apronWidth - APRON_TOP_SHOULDER);
  const apronCanHalfStagger = apronStaggerMm < apronTenonW && apronTotalTenonH >= 16;
  const APRON_HALF_TENON_GAP = 4;
  const apronHalfTenonH = apronCanHalfStagger
    ? Math.min(apronTenonW, Math.floor((apronTotalTenonH + apronStaggerMm - APRON_HALF_TENON_GAP) / 2))
    : apronTenonW;
  const apronUpperTenonH = apronHalfTenonH;
  const apronLowerTenonH = apronHalfTenonH;
  // part-local：apron Y 從 0(底) 到 apronWidth(頂)；mesh 中心 Y = apronWidth/2
  const apronUpperTenonOffset = apronCanHalfStagger
    ? (apronWidth - APRON_TOP_SHOULDER - apronUpperTenonH / 2) - apronWidth / 2
    : 0;
  const apronLowerTenonOffset = apronCanHalfStagger
    ? apronLowerTenonH / 2 - apronWidth / 2
    : 0;
  const seatTopTenonLen = legTenonStd.length;
  const slatThickness = 18;

  // 椅背 joinery 位置事先算好，腳/頂橫木/後牙板 都會引用
  const topRailHeight = topRailHeightOpt;
  const topRailThickness = 22;
  const topRailY = height - topRailHeight;
  const topRailYCenter = topRailY + topRailHeight / 2;
  const topRailTenonThick = Math.max(
    6,
    Math.min(topRailThickness - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
  );
  const topRailTenonW = Math.max(15, topRailHeight - 2 * MIN_SHOULDER);
  const apronY = seatHeight - seatThickness - apronWidth - apronOffset;
  const backZonHeight = topRailY - seatHeight;
  // 椅背元件位置：slat / splat 用 X，rung 用 Y
  const ladderRungWidth = 55;
  const ladderRungThickness = 18;
  const slatXs: number[] = [];
  if (backStyle === "slats" && slatCount > 0) {
    const availableWidth = length - legSize - 40;
    const slotPitch = availableWidth / (slatCount + 1);
    for (let i = 0; i < slatCount; i++) {
      slatXs.push(-availableWidth / 2 + slotPitch * (i + 1));
    }
  }
  const rungYs: number[] = [];
  if (backStyle === "ladder") {
    for (let i = 0; i < ladderRungs; i++) {
      rungYs.push(
        seatHeight + ((i + 1) * backZonHeight) / (ladderRungs + 1) -
          ladderRungWidth / 2,
      );
    }
  }
  // slat / splat tenon 規格（給 rail / apron 的母榫眼用）
  const slatTenonLen = 15;
  const slatTenonW = (w: number) => Math.max(10, w - Math.round(w / 4));
  const slatTenonT = Math.max(5, Math.round(slatThickness / 3));
  const splatThicknessConst = 18;
  const splatTenonW = Math.max(12, splatWidth - 20);
  const splatTenonT = Math.max(5, Math.round(splatThicknessConst / 3));
  // ladder rung tenon（給後腳的母榫眼用）
  const rungTenonW = Math.max(12, ladderRungWidth - 2 * MIN_SHOULDER);
  const rungTenonT = Math.max(5, Math.round(ladderRungThickness / 3));

  const cornerPts = corners(length, width, legSize);

  // Leg shape mapping (reused from simple-table conventions)
  const splayMm = 30;
  const hoofMm = 35;
  const legShapeFor = (c: { x: number; z: number }): Part["shape"] => {
    if (legShape === "tapered") return { kind: "tapered", bottomScale: 0.6 };
    if (legShape === "strong-taper") return { kind: "tapered", bottomScale: 0.4 };
    if (legShape === "inverted") return { kind: "tapered", bottomScale: 1.25 };
    const cs: "chamfered" | "rounded" = legEdgeStyle === "rounded" ? "rounded" : "chamfered";
    const cm = legEdge > 0 ? legEdge : undefined;
    if (legShape === "splayed") {
      // 對稱 splay（同 bar-stool）：4 腳都往外傾，配合 buildSides 的對稱數學
      return {
        kind: "splayed",
        dxMm: Math.sign(c.x) * splayMm,
        dzMm: Math.sign(c.z) * splayMm,
        chamferMm: cm,
        chamferStyle: cs,
      };
    }
    if (legShape === "splayed-length") {
      return { kind: "splayed", dxMm: Math.sign(c.x) * splayMm, dzMm: 0, chamferMm: cm, chamferStyle: cs };
    }
    if (legShape === "splayed-width") {
      return { kind: "splayed", dxMm: 0, dzMm: Math.sign(c.z) * splayMm, chamferMm: cm, chamferStyle: cs };
    }
    if (legShape === "hoof") return { kind: "hoof", hoofMm, hoofScale: 1.3 };
    return undefined;
  };

  // butt-joint 慣例：腳本身只到座板下緣（前後都一樣），後腳的「上半段」用
  // 獨立的「背柱」零件 (back-post)，讓座板可以乾乾淨淨坐在 4 隻腳上面，
  // 不會跟後腳穿模。
  const legBaseHeight = seatHeight - seatThickness;
  const legs: Part[] = cornerPts.map((c, i) => {
    const isBack = c.z > 0;
    return {
      id: `leg-${i + 1}`,
      nameZh: isBack ? `後椅腳 ${i + 1}` : `前椅腳 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legSize, width: legSize, thickness: legBaseHeight },
      origin: { x: c.x, y: 0, z: c.z },
      shape: legShapeFor(c) ?? legEdgeShape(legEdge, legEdgeStyle),
      tenons: [
        {
          position: "top",
          type: legTopTenonType === "through-tenon" ? "through-tenon" : "blind-tenon",
          length: legTenonStd.length,
          width: legTenonStd.width,
          thickness: legTenonStd.thickness,
        },
      ],
      mortises: (() => {
        // 牙板中心 Y（leg-local）；靜止 Z（左右）= 上榫；移動 X（前後）= 下榫
        // 餐椅 apronStaggerMm 固定為 0，xCenterY = zCenterY
        const zCenterY = apronY + apronWidth / 2;
        const xCenterY = zCenterY - apronStaggerMm;
        const apronThrough = apronTenonType === "through-tenon";
        if (apronCanHalfStagger) {
          return [
            // Z 面 mortise（接 Z 軸 = 左右牙板，靜止）— 上榫
            {
              origin: { x: 0, y: zCenterY + apronUpperTenonOffset, z: c.z > 0 ? -1 : 1 },
              depth: apronTenonLen,
              length: apronUpperTenonH,
              width: apronTenonThick,
              through: apronThrough,
            },
            // X 面 mortise（接 X 軸 = 前後牙板，下移）— 下榫
            {
              origin: { x: c.x > 0 ? -1 : 1, y: xCenterY + apronLowerTenonOffset, z: 0 },
              depth: apronTenonLen,
              length: apronLowerTenonH,
              width: apronTenonThick,
              through: apronThrough,
            },
          ];
        }
        return [
          {
            origin: { x: 0, y: zCenterY, z: c.z > 0 ? -1 : 1 },
            depth: apronTenonLen,
            length: apronTenonW,
            width: apronTenonThick,
            through: apronThrough,
          },
          {
            origin: { x: c.x > 0 ? -1 : 1, y: xCenterY, z: 0 },
            depth: apronTenonLen,
            length: apronTenonW,
            width: apronTenonThick,
            through: apronThrough,
          },
        ];
      })(),
    };
  });

  // 後腳延伸出來的「背柱」(back-post) — 座板上方支撐椅背
  const backPosts: Part[] = cornerPts
    .filter((c) => c.z > 0)
    .map((c, i) => ({
      id: `back-post-${i + 1}`,
      nameZh: `背柱 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legSize, width: legSize, thickness: height - seatHeight },
      origin: { x: c.x, y: seatHeight, z: c.z },
      shape: legEdgeShape(legEdge, legEdgeStyle),
      tenons: [
        // 背柱底端進座板，與前腳頂端共用同一個座板榫眼 → dims 必須一致
        {
          position: "bottom",
          type: legTopTenonType === "through-tenon" ? "through-tenon" : "blind-tenon",
          length: legTenonStd.length,
          width: legTenonStd.width,
          thickness: legTenonStd.thickness,
        },
      ],
      mortises: [
        // 頂橫木的母榫眼
        {
          origin: { x: c.x > 0 ? -1 : 1, y: topRailYCenter - seatHeight, z: 0 },
          depth: apronTenonLen,
          length: topRailTenonW,
          width: topRailTenonThick,
          through: false,
        },
        // 橫檔（ladder rung）的母榫眼
        ...(backStyle === "ladder"
          ? rungYs.map((ry) => ({
              origin: { x: c.x > 0 ? -1 : 1, y: ry + ladderRungWidth / 2 - seatHeight, z: 0 },
              depth: apronTenonLen,
              length: rungTenonW,
              width: rungTenonT,
              through: false,
            }))
          : []),
      ],
    }));

  // 座板（前腳通榫進來）
  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: seatHeight - seatThickness, z: 0 },
    shape: seatBendMm > 0
      ? { kind: "face-rounded" as const, cornerR: 0, bendMm: -seatBendMm, bendAxis: "y" as const }
      : seatScoopShape(seatProfile) ?? (seatFrontWaterfall ? { kind: "chamfered-top", chamferMm: 25, style: "rounded" } : seatEdgeShape(seatEdge, seatEdgeStyle)),
    tenons: [],
    // 4 腳通榫進來（榫頭從下方刺穿座板，背柱也從上方接，共用同一個榫眼）
    // mortise depth + through 跟 tenon type 同步（座板薄→通榫穿透；厚→盲榫不穿頂）
    mortises: [
      ...cornerPts.map((c) => ({
        origin: { x: c.x, y: 0, z: c.z },
        depth: legTenonStd.length,
        length: legTenonStd.width,
        width: legTenonStd.thickness,
        through: legTopTenonType === "through-tenon",
      })),
    ],
  };

  // 4 座面下牙板 —— 套 bar-stool buildSides 算法（端面軸心對齊腳軸、上下緣保持水平、
  // splay 椅腳時端面斜成腳的傾角）
  const bottomScale = legBottomScale(legShape);
  const apronCenterY = apronY + apronWidth / 2;
  void backHeight;

  const apronIsLengthSplay = legShape === "splayed" || legShape === "splayed-length";
  const apronIsWidthSplay = legShape === "splayed" || legShape === "splayed-width";
  const apronSplayDx = apronIsLengthSplay ? splayMm : 0;
  const apronSplayDz = apronIsWidthSplay ? splayMm : 0;
  const apronIsSplayed = apronSplayDx > 0 || apronSplayDz > 0;
  const apronTiltX = apronSplayDx > 0 ? Math.atan(apronSplayDx / Math.max(1, legBaseHeight)) : 0;
  const apronTiltZ = apronSplayDz > 0 ? Math.atan(apronSplayDz / Math.max(1, legBaseHeight)) : 0;
  const apronInnerSpanX = length - legSize;
  const apronInnerSpanZ = width - legSize;
  const apronLegEdgeX = length / 2 - legSize / 2;
  const apronLegEdgeZ = width / 2 - legSize / 2;

  const apronShiftAt = (yMm: number) => legBaseHeight > 0 ? Math.max(0, 1 - yMm / legBaseHeight) : 0;
  const apronTopY = apronY + apronWidth;
  const apronBotY = apronY;
  const aSC = apronShiftAt(apronCenterY);
  const aST = apronShiftAt(apronTopY);
  const aSB = apronShiftAt(apronBotY);
  const apronSplayXc = apronSplayDx * aSC;
  const apronSplayZc = apronSplayDz * aSC;
  const apronSplayXt = apronSplayDx * aST;
  const apronSplayZt = apronSplayDz * aST;
  const apronSplayXb = apronSplayDx * aSB;
  const apronSplayZb = apronSplayDz * aSB;
  const apronLwC = legSize * legScaleAt(apronCenterY, legBaseHeight, bottomScale);
  const apronLwT = legSize * legScaleAt(apronTopY, legBaseHeight, bottomScale);
  const apronLwB = legSize * legScaleAt(apronBotY, legBaseHeight, bottomScale);

  type ApronSideDef = {
    key: string; nameZh: string; visibleLength: number;
    axis: "x" | "z"; sx: number; sz: number;
    origin: { x: number; z: number };
  };
  const apronSides: ApronSideDef[] = [
    { key: "front", nameZh: "前牙板", visibleLength: apronInnerSpanX - apronLwC + 2 * apronSplayXc, axis: "x", sx: 0, sz: -1, origin: { x: 0, z: -(apronLegEdgeZ + apronSplayZc) } },
    { key: "back",  nameZh: "後牙板", visibleLength: apronInnerSpanX - apronLwC + 2 * apronSplayXc, axis: "x", sx: 0, sz: 1,  origin: { x: 0, z: apronLegEdgeZ + apronSplayZc } },
    { key: "left",  nameZh: "左牙板", visibleLength: apronInnerSpanZ - apronLwC + 2 * apronSplayZc, axis: "z", sx: -1, sz: 0, origin: { x: -(apronLegEdgeX + apronSplayXc), z: 0 } },
    { key: "right", nameZh: "右牙板", visibleLength: apronInnerSpanZ - apronLwC + 2 * apronSplayZc, axis: "z", sx: 1, sz: 0,  origin: { x: apronLegEdgeX + apronSplayXc, z: 0 } },
  ];

  // apron-trapezoid 上下緣縮放與 bevelAngle 計算
  const apronHalfX_C = apronLegEdgeX + apronSplayXc - apronLwC / 2;
  const apronHalfX_T = apronLegEdgeX + apronSplayXt - apronLwT / 2;
  const apronHalfX_B = apronLegEdgeX + apronSplayXb - apronLwB / 2;
  const apronHalfZ_C = apronLegEdgeZ + apronSplayZc - apronLwC / 2;
  const apronHalfZ_T = apronLegEdgeZ + apronSplayZt - apronLwT / 2;
  const apronHalfZ_B = apronLegEdgeZ + apronSplayZb - apronLwB / 2;
  const apronHasShapeBend = apronSplayDx > 0 || apronSplayDz > 0 || bottomScale !== 1;

  const aprons: Part[] = apronSides.map((s) => {
    const trapTopScale =
      s.axis === "x" && apronHasShapeBend ? apronHalfX_T / apronHalfX_C
      : s.axis === "z" && apronHasShapeBend ? apronHalfZ_T / apronHalfZ_C
      : null;
    const trapBotScale =
      s.axis === "x" && apronHasShapeBend ? apronHalfX_B / apronHalfX_C
      : s.axis === "z" && apronHasShapeBend ? apronHalfZ_B / apronHalfZ_C
      : 1;
    const bevelAngle = apronIsSplayed
      ? s.axis === "x" ? -s.sz * apronTiltZ : -s.sx * apronTiltX
      : 0;
    // bevel 規則：apronOffset === 0（牙板貼座板下緣）→ half-bevel 頂面水平；其他無 bevel
    const apronTopAtSeat = apronOffset === 0;
    const useTopBevel = apronIsSplayed && apronTopAtSeat;
    const partShape = trapTopScale !== null
      ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale, bevelAngle: useTopBevel ? bevelAngle : undefined, bevelMode: useTopBevel ? "half" as const : undefined }
      : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
    return {
      id: `apron-${s.key}`,
      nameZh: s.nameZh,
      material,
      grainDirection: "length" as const,
      visible: { length: s.visibleLength, width: apronWidth, thickness: apronThickness },
      origin: { x: s.origin.x, y: apronY, z: s.origin.z },
      rotation: s.axis === "z"
        ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * apronTiltX }
        : { x: Math.PI / 2 + (-s.sz) * apronTiltZ, y: 0, z: 0 },
      shape: partShape,
      tenons: (() => {
        const tenonType: "through-tenon" | "shouldered-tenon" =
          apronTenonType === "through-tenon" ? "through-tenon" : "shouldered-tenon";
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
        // 半榫錯位：靜止 Z（左右）= 上半榫；移動 X（前後）= 下半榫
        const isUpper = s.axis === "z";
        const tenonH = isUpper ? apronUpperTenonH : apronLowerTenonH;
        const worldOffset = isUpper ? apronUpperTenonOffset : apronLowerTenonOffset;
        const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = isUpper
          ? ["top", "left", "right"]
          : ["left", "right"];
        const mk = (position: "start" | "end") => ({
          position,
          type: tenonType,
          length: apronTenonLen,
          width: tenonH,
          thickness: apronTenonThick,
          shoulderOn,
          offsetWidth: -worldOffset,
        });
        return [mk("start"), mk("end")];
      })(),
      // 後牙板：上緣加 slat / splat 母榫眼。世界上方 = local -Z 面（rotation x:π/2）
      mortises:
        s.key === "back" && backStyle === "slats" && slatXs.length > 0
          ? slatXs.map((sx) => ({
              origin: { x: sx, y: 0, z: -1 },
              depth: slatTenonLen,
              length: slatTenonW(slatWidth),
              width: slatTenonT,
              through: false,
            }))
          : s.key === "back" && backStyle === "splat"
            ? [
                {
                  origin: { x: 0, y: 0, z: -1 },
                  depth: slatTenonLen,
                  length: splatTenonW,
                  width: splatTenonT,
                  through: false,
                },
              ]
            : [],
    };
  });

  // 椅背頂橫木（連接後 2 椅腳）
  const backTopRail: Part = {
    id: "back-top-rail",
    nameZh: "椅背頂橫木",
    material,
    grainDirection: "length",
    visible: { length: length - 2 * legSize, width: topRailThickness, thickness: topRailHeight },
    origin: { x: 0, y: topRailY, z: width / 2 - legSize / 2 },
    tenons: [
      {
        position: "start",
        type: "shouldered-tenon",
        length: apronTenonLen,
        width: topRailTenonW,
        thickness: topRailTenonThick,
      },
      {
        position: "end",
        type: "shouldered-tenon",
        length: apronTenonLen,
        width: topRailTenonW,
        thickness: topRailTenonThick,
      },
    ],
    // 椅背頂橫木：下緣加 slat / splat 母榫眼。底面 = local Y=0
    mortises:
      backStyle === "slats" && slatXs.length > 0
        ? slatXs.map((sx) => ({
            origin: { x: sx, y: 0, z: 0 },
            depth: slatTenonLen,
            length: slatTenonW(slatWidth),
            width: slatTenonT,
            through: false,
          }))
        : backStyle === "splat"
          ? [
              {
                origin: { x: 0, y: 0, z: 0 },
                depth: slatTenonLen,
                length: splatTenonW,
                width: splatTenonT,
                through: false,
              },
            ]
          : [],
  };

  // 下橫撐——依 stretcherStyle 決定組態
  const lowerStretchers: Part[] = [];
  if (stretcherStyle !== "none") {
    const lowerY =
      lowerStretcherHeightOpt > 0
        ? lowerStretcherHeightOpt
        : Math.round(seatHeight * 0.25);
    const lowerW = 35;
    const lowerT = 18;
    // 下橫撐 ↔ 椅腳：依自動規則
    const lowerTenonType = autoTenonType(legSize);
    const lowerTenonStd = standardTenon({
      type: lowerTenonType,
      childThickness: lowerT,
      childWidth: lowerW,
      motherThickness: legSize,
    });
    // 通榫加 5mm 補償斜腳 tilt 投影損失
    const lowerTenon = lowerTenonStd.length + (lowerTenonType === "through-tenon" ? 5 : 0);
    const lowerTenonThick = lowerTenonStd.thickness;
    const lowerTenonW = lowerTenonStd.width;
    // 下橫撐半榫錯位（無 stagger UI，固定 0 → 半榫上下不留肩，中央留 4mm 間隙）
    const lowerStretcherStaggerMm = 0;
    const lowerCanHalfStagger = lowerStretcherStaggerMm < lowerTenonW && lowerW >= 16;
    const LOWER_HALF_TENON_GAP = 4;
    const lowerHalfTenonH = lowerCanHalfStagger
      ? Math.min(lowerTenonW, Math.floor((lowerW + lowerStretcherStaggerMm - LOWER_HALF_TENON_GAP) / 2))
      : lowerTenonW;
    const lowerUpperTenonH = lowerHalfTenonH;
    const lowerLowerTenonH = lowerHalfTenonH;
    const lowerUpperTenonOffset = lowerCanHalfStagger ? (lowerW / 2 - lowerUpperTenonH / 2) : 0;
    const lowerLowerTenonOffset = lowerCanHalfStagger ? (lowerLowerTenonH / 2 - lowerW / 2) : 0;

    // ---- 參考 bar-stool buildSides 算法 ----
    // splay 規則：dining-chair 「splayed」原本後腳 z 不外傾，但下橫撐用對稱 splay 算
    // （視覺上前後一致；後腳 z 在 leg shape 仍是直立，stretcher 端面對齊腳的中軸面足以接合）
    const isLengthSplay = legShape === "splayed" || legShape === "splayed-length";
    const isWidthSplay = legShape === "splayed" || legShape === "splayed-width";
    const splayDx = isLengthSplay ? splayMm : 0;
    const splayDz = isWidthSplay ? splayMm : 0;
    const isSplayed = splayDx > 0 || splayDz > 0;
    const tiltX = splayDx > 0 ? Math.atan(splayDx / Math.max(1, legBaseHeight)) : 0;
    const tiltZ = splayDz > 0 ? Math.atan(splayDz / Math.max(1, legBaseHeight)) : 0;
    const innerSpanX = length - legSize; // 中心-中心
    const innerSpanZ = width - legSize;
    const legEdgeX = length / 2 - legSize / 2;
    const legEdgeZ = width / 2 - legSize / 2;

    const lowerCenterY = lowerY + lowerW / 2;
    const lowerBotY = lowerY;
    const lowerTopY = lowerY + lowerW;
    const shiftAt = (yMm: number) => legBaseHeight > 0 ? Math.max(0, 1 - yMm / legBaseHeight) : 0;
    const sCenter = shiftAt(lowerCenterY);
    const sBot = shiftAt(lowerBotY);
    const sTop = shiftAt(lowerTopY);
    const splayXc = splayDx * sCenter;
    const splayZc = splayDz * sCenter;
    const splayXt = splayDx * sTop;
    const splayZt = splayDz * sTop;
    const splayXb = splayDx * sBot;
    const splayZb = splayDz * sBot;
    const lwC = legSize * legScaleAt(lowerCenterY, legBaseHeight, bottomScale);
    const lwT = legSize * legScaleAt(lowerTopY, legBaseHeight, bottomScale);
    const lwB = legSize * legScaleAt(lowerBotY, legBaseHeight, bottomScale);

    type SideDef = {
      key: string; nameZh: string; visibleLength: number;
      axis: "x" | "z"; sx: number; sz: number;
      origin: { x: number; z: number };
    };
    const sides: SideDef[] = [
      { key: "front", nameZh: "前下橫撐", visibleLength: innerSpanX - lwC + 2 * splayXc, axis: "x", sx: 0, sz: -1, origin: { x: 0, z: -(legEdgeZ + splayZc) } },
      { key: "back",  nameZh: "後下橫撐", visibleLength: innerSpanX - lwC + 2 * splayXc, axis: "x", sx: 0, sz: 1,  origin: { x: 0, z: legEdgeZ + splayZc } },
      { key: "left",  nameZh: "左下橫撐", visibleLength: innerSpanZ - lwC + 2 * splayZc, axis: "z", sx: -1, sz: 0, origin: { x: -(legEdgeX + splayXc), z: 0 } },
      { key: "right", nameZh: "右下橫撐", visibleLength: innerSpanZ - lwC + 2 * splayZc, axis: "z", sx: 1, sz: 0,  origin: { x: legEdgeX + splayXc, z: 0 } },
    ];

    const buildLowerPart = (s: SideDef): Part => {
      const halfX_C = legEdgeX + splayXc - lwC / 2;
      const halfX_T = legEdgeX + splayXt - lwT / 2;
      const halfX_B = legEdgeX + splayXb - lwB / 2;
      const halfZ_C = legEdgeZ + splayZc - lwC / 2;
      const halfZ_T = legEdgeZ + splayZt - lwT / 2;
      const halfZ_B = legEdgeZ + splayZb - lwB / 2;
      const hasShapeBend = splayDx > 0 || splayDz > 0 || bottomScale !== 1;
      const trapTopScale =
        s.axis === "x" && hasShapeBend ? halfX_T / halfX_C
        : s.axis === "z" && hasShapeBend ? halfZ_T / halfZ_C
        : null;
      const trapBotScale =
        s.axis === "x" && hasShapeBend ? halfX_B / halfX_C
        : s.axis === "z" && hasShapeBend ? halfZ_B / halfZ_C
        : 1;
      // 下橫撐 trapezoid 是腳幾何要求（端面縮到腳寬避免縫），但不 bevel
      const partShape = trapTopScale !== null
        ? { kind: "apron-trapezoid" as const, topLengthScale: trapTopScale, bottomLengthScale: trapBotScale }
        : legEdgeShape(stretcherEdge, stretcherEdgeStyle);
      const lsType: "through-tenon" | "blind-tenon" =
        lowerTenonType === "through-tenon" ? "through-tenon" : "blind-tenon";
      return {
        id: `ls-${s.key}`,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: s.visibleLength, width: lowerW, thickness: lowerT },
        origin: { x: s.origin.x, y: lowerY, z: s.origin.z },
        rotation: s.axis === "z"
          ? { x: Math.PI / 2, y: Math.PI / 2, z: s.sx * tiltX }
          : { x: Math.PI / 2 + (-s.sz) * tiltZ, y: 0, z: 0 },
        shape: partShape,
        tenons: (() => {
          if (!lowerCanHalfStagger) {
            const mk = (position: "start" | "end") => ({
              position,
              type: lsType,
              length: lowerTenon,
              width: lowerTenonW,
              thickness: lowerTenonThick,
              shoulderOn: [...lowerTenonStd.shoulderOn] as Array<"top" | "bottom" | "left" | "right">,
            });
            return [mk("start"), mk("end")];
          }
          // 半榫錯位：靜止 X（前後）= 下榫；移動 Z（左右）= 上榫
          const isUpper = s.axis === "z";
          const tenonH = isUpper ? lowerUpperTenonH : lowerLowerTenonH;
          const worldOffset = isUpper ? lowerUpperTenonOffset : lowerLowerTenonOffset;
          const shoulderOn: Array<"top" | "bottom" | "left" | "right"> = ["left", "right"];
          const mk = (position: "start" | "end") => ({
            position,
            type: lsType,
            length: lowerTenon,
            width: tenonH,
            thickness: lowerTenonThick,
            shoulderOn,
            offsetWidth: -worldOffset,
          });
          return [mk("start"), mk("end")];
        })(),
        mortises: [],
      };
    };

    // 順便給 4 椅腳補下橫撐母榫眼（靜止 X 面=下榫；移動 Z 面=上榫）
    const lsXCenterY = lowerY + lowerW / 2;
    const lsZCenterY = lsXCenterY + lowerStretcherStaggerMm;
    const lsThrough = lowerTenonType === "through-tenon";
    const stretcherSidesUsed = new Set<string>();
    if (stretcherStyle === "box") ["front","back","left","right"].forEach(k => stretcherSidesUsed.add(k));
    else if (stretcherStyle === "side-only") ["left","right"].forEach(k => stretcherSidesUsed.add(k));
    else if (stretcherStyle === "h-frame") ["left","right"].forEach(k => stretcherSidesUsed.add(k));
    const needZFace = stretcherSidesUsed.has("left") || stretcherSidesUsed.has("right");
    const needXFace = stretcherSidesUsed.has("front") || stretcherSidesUsed.has("back");
    for (const leg of legs) {
      const cx = leg.origin.x;
      const cz = leg.origin.z;
      if (lowerCanHalfStagger) {
        if (needZFace) {
          leg.mortises.push({
            origin: { x: 0, y: lsZCenterY + lowerUpperTenonOffset, z: cz > 0 ? -1 : 1 },
            depth: lowerTenon,
            length: lowerUpperTenonH,
            width: lowerTenonThick,
            through: lsThrough,
          });
        }
        if (needXFace) {
          leg.mortises.push({
            origin: { x: cx > 0 ? -1 : 1, y: lsXCenterY + lowerLowerTenonOffset, z: 0 },
            depth: lowerTenon,
            length: lowerLowerTenonH,
            width: lowerTenonThick,
            through: lsThrough,
          });
        }
      } else {
        if (needZFace) {
          leg.mortises.push({
            origin: { x: 0, y: lsZCenterY, z: cz > 0 ? -1 : 1 },
            depth: lowerTenon,
            length: lowerTenonW,
            width: lowerTenonThick,
            through: lsThrough,
          });
        }
        if (needXFace) {
          leg.mortises.push({
            origin: { x: cx > 0 ? -1 : 1, y: lsXCenterY, z: 0 },
            depth: lowerTenon,
            length: lowerTenonW,
            width: lowerTenonThick,
            through: lsThrough,
          });
        }
      }
    }

    const sideMap: Record<string, SideDef> = Object.fromEntries(sides.map(s => [s.key, s]));
    if (stretcherStyle === "box") {
      ["front", "back", "left", "right"].forEach(k => lowerStretchers.push(buildLowerPart(sideMap[k])));
    } else if (stretcherStyle === "side-only") {
      ["left", "right"].forEach(k => lowerStretchers.push(buildLowerPart(sideMap[k])));
    } else if (stretcherStyle === "h-frame") {
      ["left", "right"].forEach(k => lowerStretchers.push(buildLowerPart(sideMap[k])));
      // 中央橫撐：跨左右側橫撐 inner face；左右側橫撐中心 X = ±(legEdgeX + splayXc)，厚度 lowerT
      const sideCenterX = legEdgeX + splayXc;
      const midBodyLen = Math.max(50, 2 * sideCenterX - lowerT);
      lowerStretchers.push({
        id: "ls-center",
        nameZh: "中央連接橫撐",
        material,
        grainDirection: "length",
        visible: { length: midBodyLen, width: lowerW, thickness: lowerT },
        origin: { x: 0, y: lowerY, z: 0 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: Math.min(12, lowerTenon), width: lowerTenonW, thickness: lowerTenonThick },
          { position: "end", type: "blind-tenon", length: Math.min(12, lowerTenon), width: lowerTenonW, thickness: lowerTenonThick },
        ],
        mortises: [],
      });
    }
  }

  // 椅背部件——依 backStyle 生成（backZonHeight 已在頂部宣告）
  const backParts: Part[] = [];
  const backZ = width / 2 - legSize / 2;
  // 椅面彎曲時，座面在 x 處的下凹量（face-rounded bendAxis="y" 公式）
  // 把 back parts 的 bottom 跟著座面下降，避免懸空
  const seatHx = length / 2;
  const seatBendDipAt = (x: number): number => {
    if (seatBendMm <= 0) return 0;
    const t = seatHx > 0 ? x / seatHx : 0;
    return seatBendMm * Math.max(0, 1 - t * t);
  };
  if (backStyle === "slats" && slatCount > 0) {
    const availableWidth = length - legSize - 40;
    const slotPitch = availableWidth / (slatCount + 1);
    for (let i = 0; i < slatCount; i++) {
      const xCenter = -availableWidth / 2 + slotPitch * (i + 1);
      const dip = seatBendDipAt(xCenter);
      backParts.push({
        id: `back-slat-${i + 1}`,
        nameZh: `椅背板條 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: backZonHeight + dip, width: slatWidth, thickness: slatThickness },
        origin: { x: xCenter, y: seatHeight - dip, z: backZ },
        rotation: { x: 0, y: 0, z: Math.PI / 2 },
        tenons: [
          { position: "start", type: "blind-tenon", length: 15, width: Math.max(10, slatWidth - Math.round(slatWidth / 4)), thickness: Math.max(5, Math.round(slatThickness / 3)) },
          { position: "end", type: "blind-tenon", length: 15, width: Math.max(10, slatWidth - Math.round(slatWidth / 4)), thickness: Math.max(5, Math.round(slatThickness / 3)) },
        ],
        mortises: [],
      });
    }
  } else if (backStyle === "ladder") {
    // N 根水平橫木，均勻分佈於 seatHeight → topRailY 之間
    const rungWidth = 55;
    const rungThickness = 18;
    const rungBodyLen = length - legSize;
    const rungTenonThick = Math.max(5, Math.round(rungThickness / 3));
    const rungTenonW = Math.max(12, rungWidth - 2 * MIN_SHOULDER);
    for (let i = 0; i < ladderRungs; i++) {
      const y = seatHeight + ((i + 1) * backZonHeight) / (ladderRungs + 1) - rungWidth / 2;
      backParts.push({
        id: `back-rung-${i + 1}`,
        nameZh: `椅背橫檔 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: rungBodyLen, width: rungWidth, thickness: rungThickness },
        origin: { x: 0, y, z: backZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: apronTenonLen, width: rungTenonW, thickness: rungTenonThick },
          { position: "end", type: "blind-tenon", length: apronTenonLen, width: rungTenonW, thickness: rungTenonThick },
        ],
        mortises: [],
      });
    }
  } else if (backStyle === "splat") {
    // 中央單片寬板：直立 + 寬面朝前後
    // rotation (π/2, 0, π/2) 做循環置換：length→Y vertical, width→X 左右, thickness→Z 深度
    const splatThickness = 18;
    const splatDip = seatBendDipAt(0);
    backParts.push({
      id: "back-splat",
      nameZh: "椅背中板",
      material,
      grainDirection: "length",
      visible: { length: backZonHeight + splatDip, width: splatWidth, thickness: splatThickness },
      origin: { x: 0, y: seatHeight - splatDip, z: backZ },
      rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 2 },
      tenons: [
        { position: "start", type: "blind-tenon", length: 15, width: Math.max(12, splatWidth - 20), thickness: Math.max(5, Math.round(splatThickness / 3)) },
        { position: "end", type: "blind-tenon", length: 15, width: Math.max(12, splatWidth - 20), thickness: Math.max(5, Math.round(splatThickness / 3)) },
      ],
      mortises: [],
    });
  } else if (backStyle === "windsor") {
    // Windsor spindle：6 支圓棒（直徑 18mm）由座板上方插入頂橫木
    const spindleCount = 6;
    const spindleDia = 18;
    const availableWidth = length - legSize - 60;
    const slotPitch = availableWidth / (spindleCount + 1);
    for (let i = 0; i < spindleCount; i++) {
      const xCenter = -availableWidth / 2 + slotPitch * (i + 1);
      const dip = seatBendDipAt(xCenter);
      backParts.push({
        id: `back-spindle-${i + 1}`,
        nameZh: `椅背圓棒 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: spindleDia, width: spindleDia, thickness: backZonHeight + dip },
        origin: { x: xCenter, y: seatHeight - dip, z: backZ },
        shape: { kind: "round" },
        tenons: [
          { position: "top", type: "blind-tenon", length: 15, width: Math.round(spindleDia * 0.6), thickness: Math.round(spindleDia * 0.6) },
          { position: "bottom", type: "blind-tenon", length: 15, width: Math.round(spindleDia * 0.6), thickness: Math.round(spindleDia * 0.6) },
        ],
        mortises: [],
      });
    }
  } else if (backStyle === "curved-splat") {
    // 曲面中板：較厚（25mm），寬度由 curvedSplatWidth 設定，bendMm 控制凹陷深度
    const cThickness = 25;
    const cWidth = curvedSplatWidth;
    const cDip = seatBendDipAt(0);
    backParts.push({
      id: "back-curved-splat",
      nameZh: "椅背曲面中板",
      material,
      grainDirection: "length",
      visible: { length: backZonHeight + cDip, width: cWidth, thickness: cThickness },
      origin: { x: 0, y: seatHeight - cDip, z: backZ },
      rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 2 },
      // 大面凹陷：thickness 才是薄軸，所以 bendAxis="y"；正值往背面凹、負值往前凸
      shape: { kind: "face-rounded", cornerR: 0, bendMm: curvedSplatBendMm, bendAxis: "y" },
      tenons: [
        { position: "start", type: "blind-tenon", length: 15, width: Math.max(12, cWidth - 20), thickness: Math.max(5, Math.round(cThickness / 3)) },
        { position: "end", type: "blind-tenon", length: 15, width: Math.max(12, cWidth - 20), thickness: Math.max(5, Math.round(cThickness / 3)) },
      ],
      mortises: [],
    });
  }
  const slats = backParts; // 向下相容：後面 parts 陣列仍引用 slats 變數

  // ---- 椅背後仰 (backRake) ----
  // 所有椅背部件繞 (seatHeight, backZ) X 軸傾斜 reclineRad
  const reclineRad = (backRake * Math.PI) / 180;
  if (Math.abs(reclineRad) > 1e-6) {
    const cosR = Math.cos(reclineRad);
    const sinR = Math.sin(reclineRad);
    const yExtOf = (p: Part): number => {
      // back-rung: rotation x:π/2 → width 垂直
      if (p.id.startsWith("back-rung-")) return p.visible.width;
      // slat / splat / curved-splat: rotation 讓 length 垂直
      if (p.id.startsWith("back-slat-") || p.id === "back-splat" || p.id === "back-curved-splat") return p.visible.length;
      // back-post / back-top-rail / back-spindle: thickness 垂直
      return p.visible.thickness;
    };
    const tilt = (p: Part): Part => {
      const yExt = yExtOf(p);
      const cy = p.origin.y + yExt / 2;
      const cz = p.origin.z;
      const dy = cy - seatHeight;
      const dz = cz - backZ;
      const newCy = seatHeight + dy * cosR - dz * sinR;
      const newCz = backZ + dy * sinR + dz * cosR;
      // 加 world-X 旋轉 reclineRad（renderer Euler order = ZYX intrinsic）：
      // - 若 existing Rz ≈ π/2（slat/splat/curved-splat）→ 等效解 rotation.y -= rx
      //   （推導：Rx_world(rx) * Rz(π/2) = ZYX(0, -rx, π/2)；splat 的 Rx 保留）
      // - 否則直接加到 rotation.x（無 Z rot 的情形：post/rail/rung/spindle）
      const ex = p.rotation?.x ?? 0;
      const ey = p.rotation?.y ?? 0;
      const ez = p.rotation?.z ?? 0;
      const hasZQuarter = Math.abs(Math.abs(ez) - Math.PI / 2) < 0.01;
      // 錨在座面上的部件，傾斜後 bottom corner 要 ≥ seatHeight（避免與 seat AABB 重疊）
      // - 一般部件（無 Rz）：bottom = origin.y - thickness/2*(1-cos)；clamp origin.y >= seatHeight
      // - Rz=π/2 部件（slat/splat）：傾斜後 bottom-back corner 額外往下 (width/2)*sin(rec)
      //   因此 origin.y 還要再加 (width/2)*sin(rec) 才能讓最低點不過 seatHeight
      const wHalf = p.visible.width / 2;
      const extraLift = hasZQuarter ? wHalf * Math.abs(sinR) : 0;
      const yLowerBound = seatHeight + extraLift;
      const rawOriginY = newCy - yExt / 2;
      const isSeatAnchored = p.origin.y >= seatHeight - 0.01;
      const clampedOriginY = isSeatAnchored ? Math.max(yLowerBound, rawOriginY) : rawOriginY;
      // clamp 把 slat 抬高的量 → 同步從 length / thickness（垂直軸）扣掉，避免頂端撞到 top-rail
      const liftedBy = clampedOriginY - rawOriginY;
      let newVisible = p.visible;
      if (liftedBy > 0.01) {
        // back-rung 用 width 為 yExt；slat/splat/curved-splat 用 length；其他用 thickness
        if (p.id.startsWith("back-rung-")) {
          newVisible = { ...p.visible, width: Math.max(1, p.visible.width - liftedBy) };
        } else if (p.id.startsWith("back-slat-") || p.id === "back-splat" || p.id === "back-curved-splat") {
          newVisible = { ...p.visible, length: Math.max(1, p.visible.length - liftedBy) };
        } else {
          newVisible = { ...p.visible, thickness: Math.max(1, p.visible.thickness - liftedBy) };
        }
      }
      return {
        ...p,
        visible: newVisible,
        origin: { x: p.origin.x, y: clampedOriginY, z: newCz },
        rotation: hasZQuarter
          ? { x: ex, y: ey - reclineRad, z: ez }
          : { x: ex + reclineRad, y: ey, z: ez },
      };
    };
    for (let i = 0; i < backPosts.length; i++) backPosts[i] = tilt(backPosts[i]);
    Object.assign(backTopRail, tilt(backTopRail));
    for (let i = 0; i < backParts.length; i++) backParts[i] = tilt(backParts[i]);
  }

  const design: FurnitureDesign = {
    id: `dining-chair-${length}x${width}x${height}`,
    category: "dining-chair",
    nameZh: "餐椅",
    overall: { length, width, thickness: height },
    parts: [seatPanel, ...legs, ...backPosts, ...aprons, ...lowerStretchers, backTopRail, ...slats],
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes:
      `腳樣式：${legShapeLabel(legShape)}。前椅腳通榫接座板；後椅腳延伸成椅背支柱；牙板與椅腳半榫；椅背板條上下半榫接頂橫木與後牙板。` +
      ` ${backRakeNote(backRake)} ${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}` +
      (seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : "") +
      (seatFrontWaterfall ? " 座板前緣 R25 大圓化（waterfall edge），減少對大腿後側壓迫。" : "") +
      (backStyle === "windsor" ? " Windsor spindle 椅背：5-7 支車旋圓棒由座板上緣插入頂橫木。" : "") +
      (backStyle === "curved-splat" ? " 曲面中板：中央單片寬板用蒸彎木 R600 弧度成型，貼合背部曲線。" : "") +
      (withArmrest ? ` 加扶手：扶手前端接前腳上方加高柱（${armrestHeight}mm 處），後端半榫接後腳。會增加 4 件零件 + 2-3 小時工時。` : "") +
      " 後腳於圖面以直料呈現，實作建議依樣板鋸出 10–15° 後仰曲線以提升坐感。",
  };
  applyStandardChecks(design, {
    minLength: 350, minWidth: 350, minHeight: 700,
    maxLength: 600, maxWidth: 650, maxHeight: 1100,
  });
  return design;
};
