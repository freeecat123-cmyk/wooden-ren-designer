import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { validateRoundLegJoinery } from "./_validators";

/** 底爪相對立柱粗的縮放：腳厚 = columnSize × FOOT_THICKNESS_RATIO */
const FOOT_THICKNESS_RATIO = 0.6;
/** 底爪相對立柱粗的縮放：腳寬 = columnSize × FOOT_WIDTH_RATIO */
const FOOT_WIDTH_RATIO = 0.8;
/** 掛鉤直徑（圓料） */
const HOOK_SIZE = 18;
/** 第二排掛鉤距離主排的下移量（mm） */
const SECOND_ROW_OFFSET_Y = 200;
/** 第二排掛鉤外伸長度的縮放（比主排略短） */
const SECOND_ROW_LENGTH_SCALE = 0.85;
/** 主排掛鉤距離柱頂的縮減（柱頂稍微露出，不要鉤頂著天花） */
const HOOK_TOP_INSET = 30;
/** 底爪榫頭埋入立柱的深度比（× columnSize） */
const FOOT_TENON_DEPTH_RATIO = 0.5;
/** 掛鉤盲榫的深度比（× columnSize） */
const HOOK_TENON_DEPTH_RATIO = 0.4;

export const coatRackOptions: OptionSpec[] = [
  { group: "leg", type: "number", key: "columnSize", label: "立柱粗 (mm)", defaultValue: 50, min: 35, max: 80, step: 5, unit: "mm" },
  { group: "leg", type: "select", key: "columnStyle", label: "立柱樣式", defaultValue: "lathe-turned", choices: [
    { value: "box", label: "方柱（直方料）" },
    { value: "round", label: "圓柱（直圓料）" },
    { value: "lathe-turned", label: "車旋柱（古典花瓶輪廓，最經典）" },
  ] },
  { group: "leg", type: "number", key: "footCount", label: "底爪數", defaultValue: 4, min: 3, max: 4, step: 1, help: "3 腳穩定、4 腳更傳統" },
  { group: "leg", type: "number", key: "footLength", label: "底爪長 (mm)", defaultValue: 280, min: 200, max: 450, step: 10, help: "從柱中心往外的長度（影響穩定度）" },
  { group: "structure", type: "number", key: "hookCount", label: "掛鉤數", defaultValue: 6, min: 4, max: 8, step: 2 },
  { group: "structure", type: "number", key: "hookLength", label: "掛鉤外伸長 (mm)", defaultValue: 110, min: 60, max: 180, step: 10 },
  { group: "structure", type: "checkbox", key: "withSecondHookRow", label: "加第二排掛鉤", defaultValue: false, help: "在主排下方 200mm 處加一圈，掛短外套 / 圍巾" },
  { group: "structure", type: "checkbox", key: "wallMode", label: "靠牆模式（省後排掛鉤）", defaultValue: false, help: "假定靠牆放，省掉朝牆面的 1/3 掛鉤（前 240° 範圍保留）" },
  { group: "structure", type: "checkbox", key: "withUmbrellaBase", label: "底部加傘架槽", defaultValue: false, help: "底爪之間加一個 200mm 直徑淺盤（金屬或塑膠 tray）放雨傘 / 雨鞋。實際盤要外購，木工只標位置", wide: true },
  { group: "structure", type: "checkbox", key: "withMirror", label: "立柱中段加掛鏡", defaultValue: false, help: "在立柱中段固定一面方形鏡（300×400mm 常見），出門前可整理儀容", wide: true },
  { group: "structure", type: "checkbox", key: "withHatRail", label: "頂端帽架橫木", defaultValue: false, help: "立柱頂端加 60mm 寬橫木 + 掛鉤，掛禮帽 / 報童帽不變形", wide: true },
  { group: "structure", type: "checkbox", key: "withFloorTray", label: "底盤鞋墊托", defaultValue: false, help: "底爪上加一片圓盤（400mm 直徑），放鞋墊承接滴水", wide: true },
  { group: "structure", type: "number", key: "edgeChamfer", label: "立柱邊倒角 (mm)", defaultValue: 1, min: 0, max: 6, step: 1, unit: "mm", help: "方柱才有效；圓柱已經圓了。1-2mm 微倒手感佳" },
];

/**
 * 立式衣帽架 — 中央立柱 + 3-4 隻底爪 + 頂部多向掛鉤
 * 結構同 pedestal 餐桌，但更高更細、頂端是掛鉤不是桌面
 */
export const coatRack: FurnitureTemplate = (input): FurnitureDesign => {
  const { height, material } = input;
  const o = coatRackOptions;
  const columnSize = getOption<number>(input, opt(o, "columnSize"));
  const columnStyle = getOption<string>(input, opt(o, "columnStyle"));
  const footCount = getOption<number>(input, opt(o, "footCount"));
  const footLength = getOption<number>(input, opt(o, "footLength"));
  const hookCount = getOption<number>(input, opt(o, "hookCount"));
  const hookLength = getOption<number>(input, opt(o, "hookLength"));
  const withSecondHookRow = getOption<boolean>(input, opt(o, "withSecondHookRow"));
  const wallMode = getOption<boolean>(input, opt(o, "wallMode"));
  const withUmbrellaBase = getOption<boolean>(input, opt(o, "withUmbrellaBase"));
  const withMirror = getOption<boolean>(input, opt(o, "withMirror"));
  const withHatRail = getOption<boolean>(input, opt(o, "withHatRail"));
  const withFloorTray = getOption<boolean>(input, opt(o, "withFloorTray"));
  const edgeChamfer = getOption<number>(input, opt(o, "edgeChamfer"));

  const footThickness = Math.round(columnSize * FOOT_THICKNESS_RATIO);
  const footWidth = Math.round(columnSize * FOOT_WIDTH_RATIO);
  const columnHeight = height - footThickness;
  const footTenonDepth = Math.max(8, Math.round(columnSize * FOOT_TENON_DEPTH_RATIO));
  const hookTenonDepth = Math.max(8, Math.round(columnSize * HOOK_TENON_DEPTH_RATIO));

  // 立柱形狀：box 沒有 shape prop（預設方料），round/lathe-turned 才指定
  const columnShape =
    columnStyle === "round"
      ? ({ kind: "round" } as const)
      : columnStyle === "lathe-turned"
      ? ({ kind: "lathe-turned" } as const)
      : undefined;

  // 立柱：底部離地 footThickness（爪頂端），頂端到 height
  // 立柱身上開的 mortise：底爪 + 掛鉤
  const columnMortises = [];

  // 底爪：footCount 個方向放射
  const feet: Part[] = [];
  if (footCount === 4) {
    const dirs = [
      { id: "foot-front", nameZh: "前底爪", axis: "z" as const, sign: -1, mAngle: -Math.PI / 2 },
      { id: "foot-back", nameZh: "後底爪", axis: "z" as const, sign: 1, mAngle: Math.PI / 2 },
      { id: "foot-left", nameZh: "左底爪", axis: "x" as const, sign: -1, mAngle: Math.PI },
      { id: "foot-right", nameZh: "右底爪", axis: "x" as const, sign: 1, mAngle: 0 },
    ];
    for (const d of dirs) {
      const isXAxis = d.axis === "x";
      feet.push({
        id: d.id,
        nameZh: d.nameZh,
        material,
        grainDirection: "length",
        visible: { length: footLength, width: footWidth, thickness: footThickness },
        origin: {
          x: isXAxis ? (d.sign * footLength) / 2 : 0,
          y: 0,
          z: !isXAxis ? (d.sign * footLength) / 2 : 0,
        },
        rotation: isXAxis
          ? { x: Math.PI / 2, y: 0, z: 0 }
          : { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [
          {
            position: "start",
            type: "blind-tenon",
            length: footTenonDepth,
            width: Math.max(1, footWidth - 8),
            thickness: Math.max(1, footThickness - 6),
          },
        ],
        mortises: [],
      });
      columnMortises.push({
        origin: {
          x: isXAxis ? (d.sign * columnSize) / 2 : 0,
          y: footThickness / 2,
          z: !isXAxis ? (d.sign * columnSize) / 2 : 0,
        },
        depth: footTenonDepth,
        length: Math.max(1, footWidth - 8),
        width: Math.max(1, footThickness - 6),
        through: false,
      });
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      feet.push({
        id: `foot-${i + 1}`,
        nameZh: `底爪 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: footLength, width: footWidth, thickness: footThickness },
        origin: {
          x: (Math.cos(angle) * footLength) / 2,
          y: 0,
          z: (Math.sin(angle) * footLength) / 2,
        },
        rotation: { x: Math.PI / 2, y: angle, z: 0 },
        tenons: [
          {
            position: "start",
            type: "blind-tenon",
            length: footTenonDepth,
            width: Math.max(1, footWidth - 8),
            thickness: Math.max(1, footThickness - 6),
          },
        ],
        mortises: [],
      });
      columnMortises.push({
        origin: {
          x: (Math.cos(angle) * columnSize) / 2,
          y: footThickness / 2,
          z: (Math.sin(angle) * columnSize) / 2,
        },
        depth: footTenonDepth,
        length: Math.max(1, footWidth - 8),
        width: Math.max(1, footThickness - 6),
        through: false,
      });
    }
  }

  // 頂部掛鉤：18mm 圓料盲榫接入立柱
  const hookY = height - HOOK_TOP_INSET;
  const hooks: Part[] = [];
  // 靠牆模式：保留前 240°（4/6 圈）的掛鉤，跳過後方 120°
  const wallModeKept = (i: number, count: number): boolean => {
    if (!wallMode) return true;
    const angle = (i * 2 * Math.PI) / count;
    // 後方定義為 z > 0（angle 在 [π/3, 2π/3]）
    const z = Math.sin(angle);
    const x = Math.cos(angle);
    return !(z > 0.5 && Math.abs(x) < 0.6);
  };

  for (let i = 0; i < hookCount; i++) {
    if (!wallModeKept(i, hookCount)) continue;
    const angle = (i * 2 * Math.PI) / hookCount;
    hooks.push({
      id: `hook-${i + 1}`,
      nameZh: `掛鉤 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: hookLength, width: HOOK_SIZE, thickness: HOOK_SIZE },
      origin: {
        x: Math.cos(angle) * (columnSize / 2 + hookLength / 2),
        y: hookY,
        z: Math.sin(angle) * (columnSize / 2 + hookLength / 2),
      },
      shape: { kind: "round" },
      rotation: { x: Math.PI / 2, y: angle, z: 0 },
      tenons: [
        {
          position: "start",
          type: "blind-tenon",
          length: hookTenonDepth,
          width: HOOK_SIZE,
          thickness: HOOK_SIZE,
        },
      ],
      mortises: [],
    });
    columnMortises.push({
      origin: {
        x: Math.cos(angle) * (columnSize / 2),
        y: hookY,
        z: Math.sin(angle) * (columnSize / 2),
      },
      depth: hookTenonDepth,
      length: HOOK_SIZE,
      width: HOOK_SIZE,
      through: false,
    });
  }

  if (withSecondHookRow) {
    const row2Y = hookY - SECOND_ROW_OFFSET_Y;
    const offset = Math.PI / hookCount;
    const r2Length = hookLength * SECOND_ROW_LENGTH_SCALE;
    for (let i = 0; i < hookCount; i++) {
      if (!wallModeKept(i, hookCount)) continue;
      const angle = (i * 2 * Math.PI) / hookCount + offset;
      hooks.push({
        id: `hook-r2-${i + 1}`,
        nameZh: `下排掛鉤 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: r2Length, width: HOOK_SIZE, thickness: HOOK_SIZE },
        origin: {
          x: Math.cos(angle) * (columnSize / 2 + r2Length / 2),
          y: row2Y,
          z: Math.sin(angle) * (columnSize / 2 + r2Length / 2),
        },
        shape: { kind: "round" },
        rotation: { x: Math.PI / 2, y: angle, z: 0 },
        tenons: [
          {
            position: "start",
            type: "blind-tenon",
            length: hookTenonDepth,
            width: HOOK_SIZE,
            thickness: HOOK_SIZE,
          },
        ],
        mortises: [],
      });
      columnMortises.push({
        origin: {
          x: Math.cos(angle) * (columnSize / 2),
          y: row2Y,
          z: Math.sin(angle) * (columnSize / 2),
        },
        depth: hookTenonDepth,
        length: HOOK_SIZE,
        width: HOOK_SIZE,
        through: false,
      });
    }
  }

  const column: Part = {
    id: "column",
    nameZh: "中央立柱",
    material,
    grainDirection: "length",
    visible: { length: columnSize, width: columnSize, thickness: columnHeight },
    origin: { x: 0, y: 0, z: 0 },
    ...(columnShape ? { shape: columnShape } : {}),
    tenons: [],
    mortises: columnMortises,
  };

  const styleLabel =
    columnStyle === "lathe-turned" ? "車旋古典" : columnStyle === "round" ? "圓料" : "方料";

  const totalHooks = hooks.length;

  // 頂端帽架橫木：長 60×30 木條，X 方向
  const topAccessories: Part[] = [];
  if (withHatRail) {
    topAccessories.push({
      id: "hat-rail",
      nameZh: "頂端帽架橫木",
      material,
      grainDirection: "length",
      visible: { length: footLength + 200, width: 60, thickness: 30 },
      origin: { x: 0, y: height - 30, z: 0 },
      tenons: [],
      mortises: [],
    });
  }
  // 底盤鞋墊托：⌀400 圓盤
  if (withFloorTray) {
    topAccessories.push({
      id: "floor-tray",
      nameZh: "底盤鞋墊托",
      material,
      grainDirection: "length",
      visible: { length: 400, width: 400, thickness: 18 },
      origin: { x: 0, y: footThickness, z: 0 },
      shape: { kind: "round" },
      tenons: [],
      mortises: [],
    });
  }
  const design: FurnitureDesign = {
    id: `coat-rack-${height}`,
    category: "coat-rack",
    nameZh: "立式衣帽架",
    overall: { length: footLength, width: footLength, thickness: height },
    parts: [column, ...feet, ...hooks, ...topAccessories],
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes: `立式衣帽架，總高 ${height}mm，立柱 ${columnSize}mm（${styleLabel}），${footCount} 底爪${footCount === 3 ? "（120° 三角穩定）" : "（4 方向放射）"}，${totalHooks} 個掛鉤${wallMode ? "（已啟用靠牆模式，省略後方掛鉤）" : ""}。底爪用盲榫接入柱面（榫深 ${footTenonDepth}mm）。掛鉤是 ${HOOK_SIZE}mm 圓料盲榫接入柱面（榫深 ${hookTenonDepth}mm）—— 圓柱母件不能用通榫，盲榫接合最穩。${columnStyle === "lathe-turned" ? "車旋柱建議用直徑 ≥ " + columnSize + "mm 的圓料車出花瓶輪廓。" : ""}${withUmbrellaBase ? " 底爪之間加金屬 / 塑膠淺盤（200mm 直徑，B&Q 有售 NT$ 100），放雨傘 / 雨鞋接水。" : ""}${withMirror ? " 立柱中段（離地 1500mm 處）固定 300×400mm 方鏡（玻璃行訂製含磨邊），用 4 個鏡釘固定。" : ""}${withHatRail ? " 立柱頂端加 60mm 寬橫木（兩端各 200mm 外伸）+ 圓鉤，掛禮帽 / 報童帽不變形。" : ""}${withFloorTray ? " 底爪上加 ⌀400mm 圓盤承接鞋墊（防雨鞋滴水弄濕地板）。" : ""}${edgeChamfer > 0 && columnStyle === "box" ? ` 方柱 4 條長邊倒 ${edgeChamfer}mm 防扎手。` : ""}`,
  };
  const w = validateRoundLegJoinery(design);
  if (w.length) design.warnings = [...(design.warnings ?? []), ...w];
  // max bounds + 結構檢查
  const extraWarnings: string[] = [];
  if (height > 2000) {
    extraWarnings.push(`衣帽架高度 ${height}mm 過高（max 2000mm）——重心高 + 容易碰天花，建議縮到 1800mm 以下`);
  }
  if (height < 1500) {
    extraWarnings.push(`衣帽架高度 ${height}mm 過矮（min 1500mm）——掛長外套會拖地`);
  }
  if (footLength < height / 8) {
    extraWarnings.push(`底爪長 ${footLength}mm 對 ${height}mm 高度太短——容易倒。建議底爪長 ≥ 高度 / 7`);
  }
  if (extraWarnings.length) design.warnings = [...(design.warnings ?? []), ...extraWarnings];
  return design;
};
