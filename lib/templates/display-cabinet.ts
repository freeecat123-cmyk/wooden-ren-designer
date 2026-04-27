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

export const displayCabinetOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 20, min: 9, max: 35, step: 1 },
  ...makeZoneOptions({
    topType: "shelves", topHeight: 400, topCount: 2,
    midType: "shelves", midCount: 3,
    bottomType: "door", bottomHeight: 500, bottomCount: 2,
  }),
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "glass", choices: [
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "slab", label: "夾板貼皮平板門（裝潢常用）" },
  ] },
  doorMountOption,
  drawerMountOption,
  drawerBottomModeOption,
  backModeOption,
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10 },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  drawerSlideOption,
];

export const displayCabinet: FurnitureTemplate = (input) => {
  const o = displayCabinetOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const doorMount = resolveDoorMount(input, o);
  const drawerMount = resolveDrawerMount(input, o);

  const innerH = input.height - legHeight - 2 * panelThickness;
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const { zones, notesLine, warnings } = resolveZones(input, o, innerH, doorLabel);

  const design = caseFurniture({
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    doorType:
      doorType === "wood"
        ? "wood"
        : doorType === "slab"
          ? "slab"
          : "glass",
    zones,
    panelThickness,
    shelfThickness: panelThickness - 2,
    backMode: resolveBackMode(input, o),
    legHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    doorMount,
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）${legInset > 0 ? `；腳內縮 ${legInset}mm` : ""}。`,
    warnings,
  });
  applyStandardChecks(design, { minLength: 500, minWidth: 300, minHeight: 600 });
  return design;
};
