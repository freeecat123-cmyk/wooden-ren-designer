import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

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

  const footThickness = 30;
  const footWidth = 40;
  const columnHeight = height - footThickness;

  // 立柱：底部離地 footThickness（爪頂端），頂端到 height
  const column: Part = {
    id: "column",
    nameZh: "中央立柱",
    material,
    grainDirection: "length",
    visible: { length: columnSize, width: columnSize, thickness: columnHeight },
    origin: { x: 0, y: 0, z: 0 },
    shape:
      columnStyle === "round"
        ? { kind: "round" }
        : columnStyle === "lathe-turned"
          ? { kind: "lathe-turned" }
          : undefined,
    tenons: [],
    mortises: [],
  };

  // 底爪：footCount 個方向放射
  const feet: Part[] = [];
  if (footCount === 4) {
    // 4 爪沿 ±X / ±Z 4 個正交方向
    const dirs = [
      { id: "foot-front", nameZh: "前底爪", axis: "z" as const, sign: -1 },
      { id: "foot-back", nameZh: "後底爪", axis: "z" as const, sign: 1 },
      { id: "foot-left", nameZh: "左底爪", axis: "x" as const, sign: -1 },
      { id: "foot-right", nameZh: "右底爪", axis: "x" as const, sign: 1 },
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
          x: isXAxis ? d.sign * footLength / 2 : 0,
          y: 0,
          z: !isXAxis ? d.sign * footLength / 2 : 0,
        },
        rotation: isXAxis
          ? { x: Math.PI / 2, y: 0, z: 0 }
          : { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  } else {
    // 3 爪每 120° 平分
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
        tenons: [],
        mortises: [],
      });
    }
  }

  // 頂部掛鉤：水平短料（直徑 18mm 的圓料），從柱頂往外伸
  // hookCount 平均分佈於 360°
  const hookY = height - 30;
  const hookSize = 18;
  const hooks: Part[] = [];
  for (let i = 0; i < hookCount; i++) {
    const angle = (i * 2 * Math.PI) / hookCount;
    hooks.push({
      id: `hook-${i + 1}`,
      nameZh: `掛鉤 ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: hookLength, width: hookSize, thickness: hookSize },
      origin: {
        x: (Math.cos(angle) * (columnSize / 2 + hookLength / 2)),
        y: hookY,
        z: (Math.sin(angle) * (columnSize / 2 + hookLength / 2)),
      },
      shape: { kind: "round" },
      rotation: { x: Math.PI / 2, y: angle, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // 第二排掛鉤（選用）—— 主排下方 200mm
  if (withSecondHookRow) {
    const row2Y = hookY - 200;
    // 旋轉 30° 錯開避免跟主排撞到，數量同 hookCount
    const offset = Math.PI / hookCount;
    for (let i = 0; i < hookCount; i++) {
      const angle = (i * 2 * Math.PI) / hookCount + offset;
      hooks.push({
        id: `hook-r2-${i + 1}`,
        nameZh: `下排掛鉤 ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: hookLength * 0.85, width: hookSize, thickness: hookSize },
        origin: {
          x: (Math.cos(angle) * (columnSize / 2 + hookLength * 0.85 / 2)),
          y: row2Y,
          z: (Math.sin(angle) * (columnSize / 2 + hookLength * 0.85 / 2)),
        },
        shape: { kind: "round" },
        rotation: { x: Math.PI / 2, y: angle, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  return {
    id: `coat-rack-${height}`,
    category: "coat-rack",
    nameZh: "立式衣帽架",
    overall: { length: footLength, width: footLength, thickness: height },
    parts: [column, ...feet, ...hooks],
    defaultJoinery: "blind-tenon",
    primaryMaterial: material,
    notes: `立式衣帽架，總高 ${height}mm，立柱 ${columnSize}mm（${columnStyle === "lathe-turned" ? "車旋古典" : columnStyle === "round" ? "圓料" : "方料"}），${footCount} 底爪${footCount === 3 ? "（120° 三角穩定）" : "（4 方向放射）"}，${hookCount + (withSecondHookRow ? hookCount : 0)} 個掛鉤。${columnStyle === "lathe-turned" ? "車旋柱建議用直徑 ≥ ${columnSize}mm 的圓料車出花瓶輪廓——餐桌獨柱腳同款做法。" : ""}底爪用帶肩榫接入柱面，4 個方向各一個榫眼。掛鉤是 18mm 圓料，柱頂鑽穿透孔（透孔 / 通榫）讓掛鉤從一邊穿進去釘膠固定。**需要靠牆放可以省 1-2 個掛鉤**（後方那兩個用不到）。`,
  };
};
