import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import {
  backModeOption,
  doorMountLabel,
  doorMountOption,
  drawerBottomModeOption,
  drawerMountOption,
  drawerSlideOption,
  makeZoneOptions,
  resolveBackMode,
  resolveDoorMount,
  resolveDrawerBottomMode,
  resolveDrawerMount,
  resolveDrawerSlideGap,
  resolveZones,
} from "./_builders/zone-helpers";
import { applyStandardChecks } from "./_validators";
import {
  shelfPinSystemOption,
  shelfPinSystemNote,
  backPanelMaterialOption,
  backPanelMaterialNote,
  drawerJoineryOption,
  drawerJoineryNote,
  drawerSlideTypeOption,
  drawerSlideTypeNote,
} from "./_helpers";

export const nightstandOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 30, step: 1 },
  ...makeZoneOptions({
    // 兩段式床頭櫃：上層抽屜 / 下層開放層板（皆可改成抽屜 / 門 / 開放）
    topType: "drawer", topHeight: 180, topCount: 1, topCols: 1,
    midType: "none", midCount: 0,
    bottomType: "shelves", bottomHeight: 250, bottomCount: 1,
  }, false, { skipMid: true }),
  { group: "door", type: "select", key: "doorType", label: "門材質（如有門板）", defaultValue: "wood", choices: [
    { value: "wood", label: "木鑲板門" },
    { value: "slab", label: "夾板貼皮平板門" },
    { value: "glass", label: "玻璃門" },
  ] },
  doorMountOption,
  drawerMountOption,
  drawerBottomModeOption,
  backModeOption,
  { group: "leg", type: "number", key: "legHeight", label: "椅腳高 (mm)", defaultValue: 120, min: 0, max: 300, step: 10 },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 70, step: 1, dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "tapered", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 150, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  drawerSlideOption,
  drawerJoineryOption("drawer"),
  drawerSlideTypeOption("drawer"),
  shelfPinSystemOption("structure"),
  backPanelMaterialOption("back"),
  { group: "structure", type: "checkbox", key: "withCableHole", label: "預留充電線孔", defaultValue: true, help: "後板開 25mm 圓孔讓手機充電線穿過，床頭櫃必備", wide: true },
];

/**
 * 床頭櫃（nightstand）
 * 長 400–500、寬 350–400、高 500–650。
 * 兩段式：上層 / 下層皆可獨立設為層板 / 抽屜 / 門片。
 */
export const nightstand: FurnitureTemplate = (input) => {
  const o = nightstandOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const doorMount = resolveDoorMount(input, o);
  const drawerMount = resolveDrawerMount(input, o);
  const shelfPinSystem = getOption<string>(input, opt(o, "shelfPinSystem"));
  const backPanelMaterial = getOption<string>(input, opt(o, "backPanelMaterial"));
  const drawerJoinery = getOption<string>(input, opt(o, "drawerJoinery"));
  const drawerSlideType = getOption<string>(input, opt(o, "drawerSlideType"));
  const withCableHole = getOption<boolean>(input, opt(o, "withCableHole"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const { zones, notesLine, warnings } = resolveZones(input, o, innerH, doorLabel);

  const design = caseFurniture({
    category: "nightstand",
    nameZh: "床頭櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    zones,
    doorType:
      doorType === "wood"
        ? "wood"
        : doorType === "slab"
          ? "slab"
          : "glass",
    panelThickness,
    shelfThickness: panelThickness,
    backMode: resolveBackMode(input, o),
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    doorMount,
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}；腳高 ${legHeight}mm（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}。${drawerJoineryNote(drawerJoinery)} ${drawerSlideTypeNote(drawerSlideType)} ${shelfPinSystemNote(shelfPinSystem)} ${withCableHole ? "後板開 25mm 充電線孔（黑色 grommet 圈防磨）。" : ""} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
    warnings,
  });
  applyStandardChecks(design, { minLength: 300, minWidth: 300, minHeight: 400 });
  return design;
};
