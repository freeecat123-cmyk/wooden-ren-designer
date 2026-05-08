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
import { applyStandardChecks, validateCabinetStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  shelfPinSystemOption,
  shelfPinSystemNote,
  backPanelMaterialOption,
  backPanelMaterialNote,
  pullStyleOption,
  pullStyleNote,
  softCloseOption,
  softCloseNote,
} from "./_helpers";

export const nightstandOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 30, step: 1 },
  ...makeZoneOptions({
    // 兩段式床頭櫃：上層 150mm 抽屜（手機/書/眼鏡剛好）+ 下層門櫃自動填滿
    // 下層改 door（不是 shelves）— 床邊小物要遮蔽防灰塵
    topType: "drawer", topHeight: 150, topCount: 1, topCols: 1,
    midType: "none", midCount: 0,
    bottomType: "door", bottomHeight: 280, bottomCount: 1,
  }, false, { skipMid: true, autoFillSide: "bottom" }),
  { group: "door", type: "select", key: "doorType", label: "門材質（如有門板）", defaultValue: "wood", choices: [
    { value: "wood", label: "木鑲板門" },
    { value: "slab", label: "夾板貼皮平板門" },
    { value: "glass", label: "玻璃門" },
  ] },
  doorMountOption,
  drawerMountOption,
  drawerBottomModeOption,
  backModeOption,
  { group: "leg", type: "number", key: "legHeight", label: "椅腳高 (mm)", defaultValue: 100, min: 0, max: 300, step: 10, help: "100 在 600mm 床頭櫃比例最穩；120 偏細長" },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 100, step: 1, dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "tapered", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 150, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  drawerSlideOption,
  shelfPinSystemOption("structure"),
  backPanelMaterialOption("structure"),
  pullStyleOption("drawer"),
  softCloseOption("drawer"),
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
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const softClose = getOption<boolean>(input, opt(o, "softClose"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const earlyWarnings: string[] = [];
  if (innerH < 200) {
    earlyWarnings.push(
      `內部淨高僅 ${innerH}mm 過小：總高 ${input.height} − 腳高 ${legHeight} − 上下板 ${2 * panelThickness} 後不夠塞抽屜+下層，請降腳高或調總高。`,
    );
  }
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
    legShape: legShape as "box" | "tapered" | "bracket",
    legInset,
    doorMount,
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}；腳高 ${legHeight}mm（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}。${pullStyleNote(pullStyle)} ${softCloseNote(softClose)} ${shelfPinSystemNote(shelfPinSystem)} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
    warnings,
  });

  applyStandardChecks(design, {
    minLength: 300, minWidth: 300, minHeight: 400,
    maxLength: 600, maxWidth: 500, maxHeight: 800,
  });
  appendWarnings(design, earlyWarnings);
  const drawerCount = zones
    .filter((z) => z.type === "drawer")
    .reduce((sum, z) => sum + (z.count ?? 0) * (z.cols ?? 1), 0);
  appendWarnings(
    design,
    validateCabinetStructure({
      panelThickness,
      height: input.height,
      shelfSpan: input.length - 2 * panelThickness,
      hasDrawers: drawerCount > 0,
      drawerCount,
      hasDrawerSlide: getOption<boolean>(input, opt(o, "useDrawerSlide")),
    }),
  );
  // 床面齊平 ergo：標準床面 500-550mm（含床墊），床頭櫃高 ±50mm 才好用
  if (input.height < 450) {
    appendWarnings(design, [`床頭櫃高 ${input.height}mm 偏低：標準床面（含床墊）約 500-550mm，建議床頭櫃高 480-600mm 才能順手拿東西。`]);
  } else if (input.height > 650) {
    appendWarnings(design, [`床頭櫃高 ${input.height}mm 偏高：超過床面（500-550mm）+ 50mm 上限，躺著拿東西手要抬太高。`]);
  }
  if (input.length > 600 || input.height > 800) {
    appendSuggestion(design, {
      text: `${input.length}×${input.height}mm 比較像斗櫃 / 五斗櫃尺寸——斗櫃模板有完整抽屜結構選項。`,
      suggestedCategory: "chest-of-drawers",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
