import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import {
  backModeOption,
  doorMountLabel,
  ANY_ZONE_IS_DOOR,
  doorMountOption,
  doorFrameRailWidthOption,
  doorFrameThicknessOption,
  drawerBottomModeOption,
  drawerBottomThicknessOption,
  drawerBoxJoineryOption,
  drawerMountOption,
  drawerSlideOption,
  makeZoneOptions,
  resolveBackMode,
  resolveDoorMount,
  resolveDrawerBottomMode,
  resolveDrawerBottomThickness,
  resolveDrawerBoxJoinery,
  resolveDrawerMount,
  resolveDrawerSlideGap,
  resolveZones,
} from "./_builders/zone-helpers";
import { applyStandardChecks, validateCabinetStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  withLegsOption,
  backPanelPlywoodOption,
  resolveLegHeight,
  pullStyleOption,
  pullStyleNote,
  doorPullStyleOption,
  lockTotalHeightOptions,
  resolveLockedTotalHeight,
} from "./_helpers";

/** 使用情境 preset — 強制套用一整套細部參數，user 切「自訂」才解除 */
export interface NightstandPresetConfig {
  panelThickness?: number;
  topType?: "drawer" | "door" | "shelves" | "open" | "none";
  topHeight?: number;
  topCount?: number;
  topCols?: number;
  bottomType?: "drawer" | "door" | "shelves" | "open" | "none";
  bottomHeight?: number;
  bottomCount?: number;
  doorType?: "wood" | "slab" | "glass";
  doorMount?: "overlay-6" | "overlay-3" | "inset";
  drawerBoxJoinery?: "lap" | "dovetail";
  useDrawerSlide?: boolean;
  backMode?: "surface" | "rebated" | "none";
  withLegs?: boolean;
  legShape?: "box" | "tapered" | "round" | "round-tapered" | "bracket";
  legHeight?: number;
  legSize?: number;
  pullStyle?: string;
  doorPullStyle?: string;
}

export const NIGHTSTAND_PRESETS: Record<string, NightstandPresetConfig> = {
  // 1. 經典款：抽屜 + 門櫃 + 方錐腳，木鑲板門，全蓋鉸鏈
  classic: {
    panelThickness: 18,
    topType: "drawer", topHeight: 150, topCount: 1, topCols: 1,
    bottomType: "door", bottomHeight: 280,
    doorType: "wood", doorMount: "overlay-6",
    drawerBoxJoinery: "lap", useDrawerSlide: true,
    backMode: "surface",
    withLegs: true, legShape: "tapered", legHeight: 100, legSize: 35,
    pullStyle: "knob", doorPullStyle: "inherit",
  },
  // 2. 夏克風（Shaker）：木鑲板入柱門 + 鳩尾抽屜 + 無滑軌（傳統側拉）+ 入溝背板
  shaker: {
    panelThickness: 22,
    topType: "drawer", topHeight: 150, topCount: 1, topCols: 1,
    bottomType: "door", bottomHeight: 280,
    doorType: "wood", doorMount: "inset",
    drawerBoxJoinery: "dovetail", useDrawerSlide: false,
    backMode: "rebated",
    withLegs: true, legShape: "tapered", legHeight: 130, legSize: 38,
    pullStyle: "wood-knob", doorPullStyle: "wood-knob",
  },
  // 3. 雙抽屜款：兩個抽屜疊（無門櫃）+ 鳩尾接合 + 三段滑軌
  "two-drawer": {
    panelThickness: 18,
    topType: "drawer", topHeight: 150, topCount: 1, topCols: 1,
    bottomType: "drawer", bottomHeight: 200, bottomCount: 1,
    drawerBoxJoinery: "dovetail", useDrawerSlide: true,
    backMode: "surface",
    withLegs: true, legShape: "tapered", legHeight: 80, legSize: 35,
    pullStyle: "bar", doorPullStyle: "inherit",
  },
  // 4. 開放層板款：上抽屜 + 下開放 2 層板 + 圓錐腳 + 無背板（陳列風）
  "open-shelf": {
    panelThickness: 18,
    topType: "drawer", topHeight: 150, topCount: 1, topCols: 1,
    bottomType: "shelves", bottomHeight: 280, bottomCount: 2,
    drawerBoxJoinery: "lap", useDrawerSlide: true,
    backMode: "none",
    withLegs: true, legShape: "round-tapered", legHeight: 100, legSize: 30,
    pullStyle: "wood-knob", doorPullStyle: "inherit",
  },
  // 5. 現代極簡：夾板平板門 + 圓柱長腳 + 長條把手
  "modern-slab": {
    panelThickness: 18,
    topType: "drawer", topHeight: 150, topCount: 1, topCols: 1,
    bottomType: "door", bottomHeight: 300,
    doorType: "slab", doorMount: "overlay-6",
    drawerBoxJoinery: "lap", useDrawerSlide: true,
    backMode: "surface",
    withLegs: true, legShape: "round", legHeight: 130, legSize: 28,
    pullStyle: "bar", doorPullStyle: "bar",
  },
  // 6. 懸吊壁掛：無腳 + 上抽屜 + 下開放層板
  floating: {
    panelThickness: 18,
    topType: "drawer", topHeight: 150, topCount: 1, topCols: 1,
    bottomType: "shelves", bottomHeight: 280, bottomCount: 1,
    drawerBoxJoinery: "lap", useDrawerSlide: true,
    backMode: "surface",
    withLegs: false, legShape: "tapered", legHeight: 0, legSize: 35,
    pullStyle: "bar", doorPullStyle: "inherit",
  },
};

export const nightstandOptions: OptionSpec[] = [
  { group: "preset", type: "select", key: "useCase", label: "使用情境預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（不套 preset）" },
    { value: "classic", label: "經典款（抽屜 + 木門 + 方錐腳）" },
    { value: "shaker", label: "夏克風（鳩尾抽屜 + 入柱門 + 傳統側拉）" },
    { value: "two-drawer", label: "雙抽屜款（兩抽屜疊 + 滑軌 + 鳩尾）" },
    { value: "open-shelf", label: "開放層板款（抽屜 + 2 層板 + 圓錐腳 + 無背板）" },
    { value: "modern-slab", label: "現代極簡（平板門 + 圓柱長腳 + 長條把手）" },
    { value: "floating", label: "懸吊壁掛（無腳 + 抽屜 + 開放層板）" },
  ], help: "強制套用一整套細部參數（板厚 / 抽屜門 / 接合 / 鉸鏈 / 把手 / 腳）；要自訂請切「自訂」。" },
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
  ], dependsOn: ANY_ZONE_IS_DOOR },
  doorMountOption,
  doorFrameRailWidthOption,
  doorFrameThicknessOption,
  drawerMountOption,
  drawerBottomModeOption,
  drawerBottomThicknessOption,
  drawerBoxJoineryOption,
  backModeOption,
  withLegsOption,
  backPanelPlywoodOption,
  { group: "leg", type: "number", key: "legHeight", label: "椅腳高 (mm)", defaultValue: 100, min: 0, max: 300, step: 10, help: "100 在 600mm 床頭櫃比例最穩；120 偏細長。鎖定總高時自動算", dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "lockTotalHeight", equals: false }] } },
  { group: "leg", type: "number", key: "legSize", label: "椅腳粗 (mm)", defaultValue: 35, min: 20, max: 100, step: 1, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "tapered", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳（方料）" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
  ] , dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 150, step: 5, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  drawerSlideOption,
  ...lockTotalHeightOptions({ skipMid: true }),
  // 鎖定總高時要讓使用者也能設下層高度（非鎖定時下層自動填滿，不顯示此欄）
  { group: "zone-bot", type: "number", key: "bottomHeight", label: "下層高度 (mm)", defaultValue: 280, min: 80, max: 1500, step: 10, help: "只在鎖定總高時用到；下層門櫃高度", dependsOn: { key: "lockTotalHeight", equals: true } },
  pullStyleOption("drawer"),
  doorPullStyleOption("door"),
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
  const legHeight = resolveLegHeight(input, o);
  const backPanelPlywood = getOption<boolean>(input, opt(o, "backPanelPlywood"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const doorMount = resolveDoorMount(input, o);
  const drawerMount = resolveDrawerMount(input, o);
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const doorPullStyleRaw = getOption<string>(input, opt(o, "doorPullStyle"));
  const doorPullStyle = !doorPullStyleRaw || doorPullStyleRaw === "inherit" ? pullStyle : doorPullStyleRaw;

  const lockTotalHeight = getOption<boolean>(input, opt(o, "lockTotalHeight"));
  const { innerH, effectiveLegHeight, warnings: lockWarnings } = resolveLockedTotalHeight(
    input, o, panelThickness, legHeight, { skipMid: true },
  );
  const earlyWarnings: string[] = [];
  if (innerH < 200) {
    earlyWarnings.push(
      `內部淨高僅 ${innerH}mm 過小：總高 ${input.height} − 腳高 ${effectiveLegHeight} − 上下板 ${2 * panelThickness} 後不夠塞抽屜+下層，請降腳高或調總高。`,
    );
  }
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  // 鎖定總高時下層高度由使用者設、上層自動吃剩；非鎖定時 bottomHeight 不該被 resolveZones 看到
  // （options 內 bottomHeight 永遠存在以維持 schema 穩定，但用 dependsOn 控制 UI 顯示）
  const zoneOptions = lockTotalHeight ? o : o.filter((s) => s.key !== "bottomHeight");
  const { zones, notesLine, warnings } = resolveZones(input, zoneOptions, innerH, doorLabel);
  warnings.push(...lockWarnings);

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
    backPanelMaterial: backPanelPlywood ? "plywood" : "inherit",
    legHeight: effectiveLegHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "round" | "round-tapered",
    legInset,
    doorMount,
    doorFrameRailWidth: getOption<number>(input, opt(o, "doorFrameRailWidth")),
    doorFrameThickness: getOption<number>(input, opt(o, "doorFrameThickness")),
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerBottomThickness: resolveDrawerBottomThickness(input, o),
    drawerBoxJoinery: resolveDrawerBoxJoinery(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    pullStyle,
    doorPullStyle,
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}；腳高 ${effectiveLegHeight}mm${lockTotalHeight ? "（鎖定總高自動算）" : ""}（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}。${pullStyleNote(pullStyle)}`.trim(),
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

/** 強制套用 preset：呼叫端 parseDesignSearchParams 解 URL params 後呼叫，
 *  preset 有定義的欄位 shadow 進 options，UI 表單 + 模板渲染同步。 */
export function applyNightstandPresets(
  options: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const useCase = String(options.useCase ?? "");
  const preset = NIGHTSTAND_PRESETS[useCase];
  if (!preset) return options;
  const next: Record<string, string | number | boolean> = { ...options };
  if (preset.panelThickness !== undefined) next.panelThickness = preset.panelThickness;
  if (preset.topType !== undefined) next.topType = preset.topType;
  if (preset.topHeight !== undefined) next.topHeight = preset.topHeight;
  if (preset.topCount !== undefined) next.topCount = preset.topCount;
  if (preset.topCols !== undefined) next.topCols = preset.topCols;
  if (preset.bottomType !== undefined) next.bottomType = preset.bottomType;
  if (preset.bottomHeight !== undefined) next.bottomHeight = preset.bottomHeight;
  if (preset.bottomCount !== undefined) next.bottomCount = preset.bottomCount;
  if (preset.doorType !== undefined) next.doorType = preset.doorType;
  if (preset.doorMount !== undefined) next.doorMount = preset.doorMount;
  if (preset.drawerBoxJoinery !== undefined) next.drawerBoxJoinery = preset.drawerBoxJoinery;
  if (preset.useDrawerSlide !== undefined) next.useDrawerSlide = preset.useDrawerSlide;
  if (preset.backMode !== undefined) next.backMode = preset.backMode;
  if (preset.withLegs !== undefined) next.withLegs = preset.withLegs;
  if (preset.legShape !== undefined) next.legShape = preset.legShape;
  if (preset.legHeight !== undefined) next.legHeight = preset.legHeight;
  if (preset.legSize !== undefined) next.legSize = preset.legSize;
  if (preset.pullStyle !== undefined) next.pullStyle = preset.pullStyle;
  if (preset.doorPullStyle !== undefined) next.doorPullStyle = preset.doorPullStyle;
  return next;
}
