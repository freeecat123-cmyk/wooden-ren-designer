import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { corners, RECT_LEG_SHAPE_CHOICES, seatEdgeOption, seatEdgeStyleOption, seatEdgeNote, seatEdgeShape, seatProfileOption, seatProfileNote, seatScoopShape, legEdgeOption, legEdgeStyleOption, legEdgeNote, legEdgeShape, stretcherEdgeOption, stretcherEdgeStyleOption, stretcherEdgeNote, backRakeOption, backRakeNote, legShapeLabel } from "./_helpers";
import { applyStandardChecks } from "./_validators";

export const diningChairOptions: OptionSpec[] = [
  // 腳
  { group: "leg", type: "select", key: "legShape", label: "椅腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1 },
  // 座板
  { group: "top", type: "number", key: "seatThickness", label: "座板厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  { group: "top", type: "number", key: "seatHeight", label: "坐高 (mm)", defaultValue: 450, min: 150, max: 900, step: 10, help: "地面到座板上緣，一般 440–460" },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  // 座面舒適度
  seatProfileOption("top"),
  // 牙板
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 60, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 5, min: 0, max: 150, step: 5, help: "牙板頂緣往下退的距離" },
  // 椅背
  { group: "back", type: "select", key: "backStyle", label: "椅背樣式", defaultValue: "slats", choices: [
    { value: "slats", label: "直條式（垂直板條）" },
    { value: "ladder", label: "橫檔式（水平橫木 3–5 根）" },
    { value: "splat", label: "中板式（中央單片寬板）" },
  ] },
  { group: "back", type: "number", key: "backSlats", label: "直條數（直條式用）", defaultValue: 2, min: 0, max: 10, step: 1, help: "backStyle=直條 時有效", dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "slatWidth", label: "直條寬 (mm)", defaultValue: 60, min: 15, max: 200, step: 5, dependsOn: { key: "backStyle", equals: "slats" } },
  { group: "back", type: "number", key: "ladderRungs", label: "橫檔數（橫檔式用）", defaultValue: 4, min: 2, max: 8, step: 1, dependsOn: { key: "backStyle", equals: "ladder" } },
  { group: "back", type: "number", key: "splatWidth", label: "中板寬 (mm)（中板式用）", defaultValue: 180, min: 80, max: 400, step: 10, dependsOn: { key: "backStyle", equals: "splat" } },
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
  const topRailHeightOpt = getOption<number>(input, opt(o, "backTopRailHeight"));
  const stretcherStyle = getOption<string>(input, opt(o, "stretcherStyle"));
  const lowerStretcherHeightOpt = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const apronThickness = 20;
  const backHeight = height - seatHeight;
  // 正規比例：榫厚 = min(apron 厚 - 兩肩 12, 柱腳 1/3)；肩寬固定 6mm
  const MIN_SHOULDER = 6;
  const legTopTenonSize = Math.max(15, Math.round((legSize * 2) / 3));
  const apronTenonLen = Math.round((legSize * 2) / 3);
  const apronTenonThick = Math.max(
    6,
    Math.min(apronThickness - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
  );
  const apronTenonW = Math.max(15, apronWidth - 2 * MIN_SHOULDER);
  const seatTopTenonLen = seatThickness;
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
    if (legShape === "splayed") {
      return {
        kind: "splayed",
        dxMm: Math.sign(c.x) * splayMm,
        // Back legs often stay plumb in real chairs; splay only front legs
        // so the chair doesn't scoot out from underneath. Front = z < 0.
        dzMm: c.z < 0 ? Math.sign(c.z) * splayMm : 0,
      };
    }
    if (legShape === "hoof") return { kind: "hoof", hoofMm, hoofScale: 1.3 };
    return undefined;
  };

  // 4 椅腳（前 2 短，後 2 長）
  const legs: Part[] = cornerPts.map((c, i) => {
    const isBack = c.z > 0;
    const legTotalH = isBack ? height : seatHeight;
    return {
      id: `leg-${i + 1}`,
      nameZh: isBack ? `後椅腳 ${i + 1}` : `前椅腳 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: legSize, width: legSize, thickness: legTotalH },
      origin: { x: c.x, y: 0, z: c.z },
      shape: legShapeFor(c) ?? legEdgeShape(legEdge, legEdgeStyle),
      tenons: isBack
        ? [] // 後腳頂端接椅背頂橫木（橫木有公榫，不在腳上）
        : [
            {
              position: "top",
              type: "through-tenon",
              length: seatTopTenonLen,
              width: legTopTenonSize,
              thickness: legTopTenonSize,
            },
          ],
      mortises: [
        // 座面下牙板 X 向
        {
          origin: {
            x: 0,
            y: apronY,
            z: c.z > 0 ? -1 : 1,
          },
          depth: apronTenonLen,
          length: apronTenonW,
          width: apronTenonThick,
          through: false,
        },
        // 座面下牙板 Z 向
        {
          origin: {
            x: c.x > 0 ? -1 : 1,
            y: apronY,
            z: 0,
          },
          depth: apronTenonLen,
          length: apronTenonW,
          width: apronTenonThick,
          through: false,
        },
        // 背腳：頂橫木的母榫眼（橫木在 x 軸，從世界 ±x 方向接入腳）
        ...(isBack
          ? [
              {
                origin: {
                  x: c.x > 0 ? -1 : 1,
                  y: topRailYCenter,
                  z: 0,
                },
                depth: apronTenonLen,
                length: topRailTenonW,
                width: topRailTenonThick,
                through: false,
              },
            ]
          : []),
        // 背腳：橫檔（ladder rung）的母榫眼，每根橫檔一個
        ...(isBack && backStyle === "ladder"
          ? rungYs.map((ry) => ({
              origin: {
                x: c.x > 0 ? -1 : 1,
                y: ry + ladderRungWidth / 2,
                z: 0,
              },
              depth: apronTenonLen,
              length: rungTenonW,
              width: rungTenonT,
              through: false,
            }))
          : []),
      ],
    };
  });

  // 座板（前腳通榫進來）
  const seatPanel: Part = {
    id: "seat",
    nameZh: "座板",
    material,
    grainDirection: "length",
    visible: { length, width, thickness: seatThickness },
    origin: { x: 0, y: seatHeight - seatThickness, z: 0 },
    shape: seatScoopShape(seatProfile) ?? seatEdgeShape(seatEdge, seatEdgeStyle),
    tenons: [],
    // 前 2 腳通榫進來（榫頭從下方刺穿座板）；
    // 後 2 腳沒通榫但腳本身穿過座板高度範圍——也要開孔讓腳通過，
    // 不然 3D 看起來座板跟腳會重疊（撞穿）
    mortises: [
      ...cornerPts
        .filter((c) => c.z < 0)
        .map((c) => ({
          origin: { x: c.x, y: 0, z: c.z },
          depth: seatThickness,
          length: legTopTenonSize,
          width: legTopTenonSize,
          through: true,
        })),
      ...cornerPts
        .filter((c) => c.z > 0)
        .map((c) => ({
          origin: { x: c.x, y: 0, z: c.z },
          depth: seatThickness,
          length: legSize,
          width: legSize,
          through: true,
        })),
    ],
  };

  // 4 座面下牙板 —— body 延伸到腳中心
  const apronInnerSpan = { x: length - legSize, z: width - legSize };
  void backHeight;
  const apronSides = [
    {
      key: "front",
      nameZh: "前牙板",
      visibleLength: apronInnerSpan.x,
      axis: "x" as const,
      origin: { x: 0, z: -(width / 2 - legSize / 2) },
    },
    {
      key: "back",
      nameZh: "後牙板",
      visibleLength: apronInnerSpan.x,
      axis: "x" as const,
      origin: { x: 0, z: width / 2 - legSize / 2 },
    },
    {
      key: "left",
      nameZh: "左牙板",
      visibleLength: apronInnerSpan.z,
      axis: "z" as const,
      origin: { x: -(length / 2 - legSize / 2), z: 0 },
    },
    {
      key: "right",
      nameZh: "右牙板",
      visibleLength: apronInnerSpan.z,
      axis: "z" as const,
      origin: { x: length / 2 - legSize / 2, z: 0 },
    },
  ];
  const aprons: Part[] = apronSides.map((s) => ({
    id: `apron-${s.key}`,
    nameZh: s.nameZh,
    material,
    grainDirection: "length",
    visible: {
      length: s.visibleLength,
      width: apronWidth,
      thickness: apronThickness,
    },
    origin: { x: s.origin.x, y: apronY, z: s.origin.z },
    rotation: s.axis === "z"
      ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
      : { x: Math.PI / 2, y: 0, z: 0 },
    shape: legEdgeShape(stretcherEdge, stretcherEdgeStyle),
    tenons: [
      {
        position: "start",
        type: "shouldered-tenon",
        length: apronTenonLen,
        width: apronTenonW,
        thickness: apronTenonThick,
      },
      {
        position: "end",
        type: "shouldered-tenon",
        length: apronTenonLen,
        width: apronTenonW,
        thickness: apronTenonThick,
      },
    ],
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
  }));

  // 椅背頂橫木（連接後 2 椅腳）
  const backTopRail: Part = {
    id: "back-top-rail",
    nameZh: "椅背頂橫木",
    material,
    grainDirection: "length",
    visible: { length: length - legSize, width: topRailThickness, thickness: topRailHeight },
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
    const lowerTenon = Math.round((legSize * 2) / 3);
    const lowerTenonThick = Math.max(
      6,
      Math.min(lowerT - 2 * MIN_SHOULDER, Math.round(legSize / 3)),
    );
    const lowerTenonW = Math.max(12, lowerW - 2 * MIN_SHOULDER);
    const frontBack = [
      { id: "ls-front", nameZh: "前下橫撐", visibleLength: apronInnerSpan.x, axis: "x" as const, origin: { x: 0, z: -(width / 2 - legSize / 2) } },
      { id: "ls-back", nameZh: "後下橫撐", visibleLength: apronInnerSpan.x, axis: "x" as const, origin: { x: 0, z: width / 2 - legSize / 2 } },
    ];
    const leftRight = [
      { id: "ls-left", nameZh: "左下橫撐", visibleLength: apronInnerSpan.z, axis: "z" as const, origin: { x: -(length / 2 - legSize / 2), z: 0 } },
      { id: "ls-right", nameZh: "右下橫撐", visibleLength: apronInnerSpan.z, axis: "z" as const, origin: { x: length / 2 - legSize / 2, z: 0 } },
    ];
    const pushStretcher = (s: { id: string; nameZh: string; visibleLength: number; axis: "x" | "z"; origin: { x: number; z: number } }) => {
      lowerStretchers.push({
        id: s.id,
        nameZh: s.nameZh,
        material,
        grainDirection: "length",
        visible: { length: s.visibleLength, width: lowerW, thickness: lowerT },
        origin: { x: s.origin.x, y: lowerY, z: s.origin.z },
        rotation: s.axis === "z" ? { x: Math.PI / 2, y: Math.PI / 2, z: 0 } : { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [
          { position: "start", type: "blind-tenon", length: lowerTenon, width: lowerTenonW, thickness: lowerTenonThick },
          { position: "end", type: "blind-tenon", length: lowerTenon, width: lowerTenonW, thickness: lowerTenonThick },
        ],
        mortises: [],
      });
    };
    if (stretcherStyle === "box") {
      [...frontBack, ...leftRight].forEach(pushStretcher);
    } else if (stretcherStyle === "side-only") {
      leftRight.forEach(pushStretcher);
    } else if (stretcherStyle === "h-frame") {
      // 左右兩條 + 中央連接橫撐（典型 H）
      leftRight.forEach(pushStretcher);
      const midBodyLen = Math.max(50, length - 2 * legSize - 2 * lowerT);
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
  if (backStyle === "slats" && slatCount > 0) {
    const availableWidth = length - legSize - 40;
    const slotPitch = availableWidth / (slatCount + 1);
    for (let i = 0; i < slatCount; i++) {
      const xCenter = -availableWidth / 2 + slotPitch * (i + 1);
      backParts.push({
        id: `back-slat-${i + 1}`,
        nameZh: `椅背板條 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: backZonHeight, width: slatWidth, thickness: slatThickness },
        origin: { x: xCenter, y: seatHeight, z: backZ },
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
    // 中央單片寬板
    const splatThickness = 18;
    backParts.push({
      id: "back-splat",
      nameZh: "椅背中板",
      material,
      grainDirection: "length",
      visible: { length: backZonHeight, width: splatWidth, thickness: splatThickness },
      origin: { x: 0, y: seatHeight, z: backZ },
      rotation: { x: 0, y: 0, z: Math.PI / 2 },
      tenons: [
        { position: "start", type: "blind-tenon", length: 15, width: Math.max(12, splatWidth - 20), thickness: Math.max(5, Math.round(splatThickness / 3)) },
        { position: "end", type: "blind-tenon", length: 15, width: Math.max(12, splatWidth - 20), thickness: Math.max(5, Math.round(splatThickness / 3)) },
      ],
      mortises: [],
    });
  }
  const slats = backParts; // 向下相容：後面 parts 陣列仍引用 slats 變數

  const design: FurnitureDesign = {
    id: `dining-chair-${length}x${width}x${height}`,
    category: "dining-chair",
    nameZh: "餐椅",
    overall: { length, width, thickness: height },
    parts: [seatPanel, ...legs, ...aprons, ...lowerStretchers, backTopRail, ...slats],
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes:
      `腳樣式：${legShapeLabel(legShape)}。前椅腳通榫接座板；後椅腳延伸成椅背支柱；牙板與椅腳半榫；椅背板條上下半榫接頂橫木與後牙板。` +
      ` ${backRakeNote(backRake)} ${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}` +
      (seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : "") +
      (withArmrest ? ` 加扶手：扶手前端接前腳上方加高柱（${armrestHeight}mm 處），後端半榫接後腳。會增加 4 件零件 + 2-3 小時工時。` : "") +
      " 後腳於圖面以直料呈現，實作建議依樣板鋸出 10–15° 後仰曲線以提升坐感。",
  };
  applyStandardChecks(design, {
    minLength: 350, minWidth: 350, minHeight: 700,
    maxLength: 600, maxWidth: 650, maxHeight: 1100,
  });
  return design;
};
