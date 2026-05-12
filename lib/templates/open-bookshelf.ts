import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import { makeZoneOptions, resolveBackMode, resolveZones } from "./_builders/zone-helpers";
import { applyStandardChecks, validateCabinetStructure, appendWarnings } from "./_validators";
import {
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
} from "./_helpers";

export const openBookshelfOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  // 開放書櫃預設無背板（最常見），但仍可改成釘背 / 入溝
  {
    group: "structure",
    type: "select",
    key: "backMode",
    label: "背板作法",
    defaultValue: "none",
    choices: [
      { value: "none", label: "無背板（開放式陳列）" },
      { value: "surface", label: "釘背（3mm 夾板蓋滿背面）— 裝潢標準" },
      { value: "rebated", label: "入溝（9mm 嵌進側板溝裡）— 榫卯 / 鄉村風家具" },
    ],
  },
  ...makeZoneOptions({
    topType: "shelves", topHeight: 400, topCount: 2,
    midType: "shelves", midCount: 3,
    bottomType: "shelves", bottomHeight: 400, bottomCount: 2,
  }),
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10 },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地（書櫃常見）" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  { group: "structure", type: "checkbox", key: "withLedderRail", label: "頂端 cornice 飾條", defaultValue: false, help: "頂端加線板飾條，書櫃古典感", wide: true },
  { group: "structure", type: "number", key: "corniceHeight", label: "cornice 高 (mm)", defaultValue: 30, min: 15, max: 80, step: 5, dependsOn: { key: "withLedderRail", equals: true } },
  { group: "structure", type: "number", key: "corniceDepth", label: "cornice 厚 (mm)", defaultValue: 25, min: 12, max: 50, step: 1, dependsOn: { key: "withLedderRail", equals: true } },
  { group: "structure", type: "number", key: "corniceOverhang", label: "cornice 兩端外伸 (mm)", defaultValue: 15, min: 0, max: 60, step: 1, dependsOn: { key: "withLedderRail", equals: true } },
  { group: "structure", type: "checkbox", key: "withBookStop", label: "層板後緣加擋條", defaultValue: false, help: "每片層板後緣加實木條，書本不會掉到後面（無背板書櫃常用）", wide: true },
  { group: "structure", type: "number", key: "bookStopHeight", label: "擋條高 (mm)", defaultValue: 8, min: 4, max: 30, step: 1, dependsOn: { key: "withBookStop", equals: true } },
  { group: "structure", type: "number", key: "bookStopThickness", label: "擋條厚 (mm)", defaultValue: 12, min: 6, max: 25, step: 1, dependsOn: { key: "withBookStop", equals: true } },
];

export const openBookshelf: FurnitureTemplate = (input) => {
  const o = openBookshelfOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const withLedderRail = getOption<boolean>(input, opt(o, "withLedderRail"));
  const corniceHeight = getOption<number>(input, opt(o, "corniceHeight"));
  const corniceDepth = getOption<number>(input, opt(o, "corniceDepth"));
  const corniceOverhang = getOption<number>(input, opt(o, "corniceOverhang"));
  const withBookStop = getOption<boolean>(input, opt(o, "withBookStop"));
  const bookStopHeight = getOption<number>(input, opt(o, "bookStopHeight"));
  const bookStopThickness = getOption<number>(input, opt(o, "bookStopThickness"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const { zones, notesLine, warnings } = resolveZones(input, o, innerH, "木");

  const design = caseFurniture({
    category: "open-bookshelf",
    nameZh: "開放書櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    zones,
    panelThickness,
    shelfThickness: panelThickness,
    backMode: resolveBackMode(input, o),
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "round" | "round-tapered",
    legInset,
    notes: `${notesLine}${legHeight > 0 ? `；加 ${legHeight}mm ${legShape} 腳${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。${withLedderRail ? `頂端加 ${corniceHeight}mm 高 cornice 飾條（傳統線板 + 修邊機 ogee 刀）。` : ""} ${withBookStop ? `每片層板後緣加 ${bookStopHeight}×${bookStopThickness}mm 實木擋條，防書本掉到後面。` : ""} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)}`.trim(),
    warnings,
  });
  // 層板後緣擋條：每片層板上方背側加實木條，書本不會掉到後面
  if (withBookStop) {
    const stopH = bookStopHeight;
    const stopT = bookStopThickness;
    const shelves = design.parts.filter(
      (p) => /shelf-\d+$/.test(p.id) && !p.nameZh.includes("抽屜"),
    );
    for (const shelf of shelves) {
      design.parts.push({
        id: `${shelf.id}-bookstop`,
        nameZh: `${shelf.nameZh}後緣擋條`,
        material: input.material,
        grainDirection: "length",
        visible: { length: shelf.visible.length, width: stopT, thickness: stopH },
        origin: {
          x: shelf.origin.x,
          y: shelf.origin.y + shelf.visible.thickness,
          z: shelf.origin.z + shelf.visible.width / 2 - stopT / 2,
        },
        tenons: [],
        mortises: [],
      });
    }
  }
  // 頂端 cornice 飾條：前緣 + 兩側包邊（傳統線板 ogee 形）
  if (withLedderRail) {
    const corniceH = corniceHeight;
    const corniceD = corniceDepth;
    const overhang = corniceOverhang;
    // 前緣橫條：長 = 全長 + 兩端 overhang，貼住頂面
    design.parts.push({
      id: "cornice-front",
      nameZh: "頂端 cornice 飾條（前）",
      material: input.material,
      grainDirection: "length",
      visible: { length: input.length + 2 * overhang, width: corniceD, thickness: corniceH },
      origin: {
        x: 0,
        y: input.height,
        z: -input.width / 2 - corniceD / 2,
      },
      tenons: [],
      mortises: [],
    });
    // 左右側邊飾條：從前緣延伸到後緣 / 接 45° 斜角
    for (const sx of [-1, 1]) {
      design.parts.push({
        id: `cornice-side-${sx < 0 ? "left" : "right"}`,
        nameZh: `頂端 cornice 飾條（${sx < 0 ? "左" : "右"}）`,
        material: input.material,
        grainDirection: "length",
        visible: { length: corniceD, width: input.width, thickness: corniceH },
        origin: {
          x: sx * (input.length / 2 + overhang - corniceD / 2),
          y: input.height,
          z: 0,
        },
        tenons: [],
        mortises: [],
      });
    }
  }

  applyStandardChecks(design, {
    minLength: 400, minWidth: 200, minHeight: 600,
    maxLength: 1500, maxWidth: 500, maxHeight: 2400,
  });
  appendWarnings(
    design,
    validateCabinetStructure({
      panelThickness,
      height: input.height,
      shelfSpan: input.length - 2 * panelThickness,
    }),
  );
  return design;
};
