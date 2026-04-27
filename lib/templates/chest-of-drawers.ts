import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import {
  backModeOption,
  drawerBottomModeOption,
  drawerMountOption,
  drawerSlideOption,
  makeZoneOptions,
  resolveBackMode,
  resolveDrawerBottomMode,
  resolveDrawerMount,
  resolveDrawerSlideGap,
  resolveZones,
} from "./_builders/zone-helpers";
import { applyStandardChecks, validateCabinetStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  shelfPinSystemOption,
  shelfPinSystemNote,
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
  backPanelMaterialOption,
  backPanelMaterialNote,
  drawerJoineryOption,
  drawerJoineryNote,
  drawerSlideTypeOption,
  drawerSlideTypeNote,
  pullStyleOption,
  pullStyleNote,
  softCloseOption,
  softCloseNote,
} from "./_helpers";

export const chestOfDrawersOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  backModeOption,
  ...makeZoneOptions({
    // 傳統斗櫃：三層都是抽屜（經典 6 抽）
    topType: "drawer", topHeight: 300, topCount: 2, topCols: 1,
    midType: "drawer", midCount: 2, midCols: 1,
    bottomType: "drawer", bottomHeight: 300, bottomCount: 2, bottomCols: 1,
  }),
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10, help: "設 0 則貼地，>0 則加 4 隻沙發腳" },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳（下方收窄）" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座（連板）" },
    { value: "panel-side", label: "側板延伸落地（中間空心）" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  drawerMountOption,
  drawerBottomModeOption,
  drawerSlideOption,
  drawerJoineryOption("drawer"),
  drawerSlideTypeOption("drawer"),
  pullStyleOption("drawer"),
  softCloseOption("drawer"),
  shelfPinSystemOption("structure"),
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  backPanelMaterialOption("structure"),
];

export const chestOfDrawers: FurnitureTemplate = (input) => {
  const o = chestOfDrawersOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const drawerMount = resolveDrawerMount(input, o);
  const shelfPinSystem = getOption<string>(input, opt(o, "shelfPinSystem"));
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const backPanelMaterial = getOption<string>(input, opt(o, "backPanelMaterial"));
  const drawerJoinery = getOption<string>(input, opt(o, "drawerJoinery"));
  const drawerSlideType = getOption<string>(input, opt(o, "drawerSlideType"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const softClose = getOption<boolean>(input, opt(o, "softClose"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const { zones, notesLine, warnings } = resolveZones(input, o, innerH, "木");

  const design = caseFurniture({
    category: "chest-of-drawers",
    nameZh: "斗櫃",
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
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    notes: `${notesLine}${legHeight > 0 ? `；底座加 ${legHeight}mm ${legShape} 腳${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。${drawerJoineryNote(drawerJoinery)} ${drawerSlideTypeNote(drawerSlideType)} ${pullStyleNote(pullStyle)} ${softCloseNote(softClose)} ${shelfPinSystemNote(shelfPinSystem)} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
    warnings,
  });
  applyStandardChecks(design, {
    minLength: 500, minWidth: 300, minHeight: 500,
    maxLength: 1300, maxWidth: 600, maxHeight: 1500,
  });
  const useDrawerSlide = getOption<boolean>(input, opt(o, "useDrawerSlide"));
  appendWarnings(
    design,
    validateCabinetStructure({
      panelThickness,
      height: input.height,
      shelfSpan: input.length - 2 * panelThickness,
      hasDrawers: true,
      drawerCount: 6,
      hasDrawerSlide: useDrawerSlide,
    }),
  );
  if (input.height > 1500) {
    appendSuggestion(design, {
      text: `櫃高 ${input.height}mm 已接近衣櫃尺寸——衣櫃模板有吊衣桿、長褲架等收納選項。`,
      suggestedCategory: "wardrobe",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
