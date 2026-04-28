import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import { makeZoneOptions, resolveBackMode, resolveZones } from "./_builders/zone-helpers";
import { applyStandardChecks, validateCabinetStructure, appendWarnings } from "./_validators";
import {
  shelfPinSystemOption,
  shelfPinSystemNote,
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
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地（書櫃常見）" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  shelfPinSystemOption("structure"),
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  { group: "structure", type: "checkbox", key: "withBookStop", label: "層板後緣加擋條", defaultValue: false, help: "層板後緣加 8mm 擋條防書本掉到後面，無背板書櫃常用做法", wide: true },
  { group: "structure", type: "checkbox", key: "withWallAnchor", label: "預留牆面固定五金", defaultValue: false, help: "高書櫃 (>1200mm) 必加：頂板背面預留 L 型固定片孔位，鎖牆防傾倒", wide: true },
  { group: "structure", type: "checkbox", key: "withAdjustableShelfPins", label: "可調層板釘孔陣列", defaultValue: false, help: "兩側板鑽 32mm 間距釘孔陣列，層板可任意上下調整。歐洲收納櫃標準", wide: true },
  { group: "structure", type: "checkbox", key: "withLedderRail", label: "頂端 cornice 飾條", defaultValue: false, help: "頂端加 30mm 高線板飾條，書櫃古典感", wide: true },
];

export const openBookshelf: FurnitureTemplate = (input) => {
  const o = openBookshelfOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const shelfPinSystem = getOption<string>(input, opt(o, "shelfPinSystem"));
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const withBookStop = getOption<boolean>(input, opt(o, "withBookStop"));
  const withWallAnchor = getOption<boolean>(input, opt(o, "withWallAnchor"));
  const withAdjustableShelfPins = getOption<boolean>(input, opt(o, "withAdjustableShelfPins"));
  const withLedderRail = getOption<boolean>(input, opt(o, "withLedderRail"));

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
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    notes: `${notesLine}${legHeight > 0 ? `；加 ${legHeight}mm ${legShape} 腳${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。${shelfPinSystemNote(shelfPinSystem)} ${withBookStop ? "層板後緣加 8mm 擋條防書本掉落。" : ""} ${withWallAnchor ? "頂板背面預留 L 型固定片孔位，務必鎖牆防傾倒（高書櫃必做）。" : ""} ${withAdjustableShelfPins ? "兩側板鑽 32mm 間距 ⌀5mm 釘孔陣列（European 32mm system，配 3-5mm 鋼/塑膠書釘），層板可任意調整。" : ""} ${withLedderRail ? "頂端加 30mm 高 cornice 飾條（傳統線板 + 修邊機 ogee 刀）。" : ""} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)}`.trim(),
    warnings,
  });
  // 可調層板釘孔陣列：兩側板鑽 ⌀5mm 釘孔（mortise 代表）
  if (withAdjustableShelfPins) {
    const pitch = 32;
    const startY = 100;
    const endY = input.height - 100;
    const rowCount = Math.floor((endY - startY) / pitch);
    for (const sideId of ["side-left", "side-right"]) {
      const sidePart = design.parts.find((p) => p.id === sideId);
      if (!sidePart) continue;
      const newMortises = [...sidePart.mortises];
      for (let r = 0; r < rowCount; r++) {
        const y = startY + r * pitch;
        // 兩排（前後）
        for (const z of [-input.width / 2 + 40, input.width / 2 - 40]) {
          newMortises.push({
            origin: { x: 0, y, z },
            depth: 12,
            length: 5,
            width: 5,
            through: false,
          });
        }
      }
      sidePart.mortises = newMortises;
    }
  }
  // 頂端 cornice 飾條
  if (withLedderRail) {
    design.parts.push({
      id: "cornice-front",
      nameZh: "頂端 cornice 飾條",
      material: input.material,
      grainDirection: "length",
      visible: { length: input.length + 20, width: 30, thickness: 18 },
      origin: { x: 0, y: input.height + 15, z: input.width / 2 + 10 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
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
      hasWallAnchor: withWallAnchor,
    }),
  );
  return design;
};
