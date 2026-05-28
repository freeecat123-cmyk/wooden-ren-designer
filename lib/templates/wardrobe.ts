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
import { applyStandardChecks, validateCabinetStructure, appendWarnings } from "./_validators";
import {
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
  withLegsOption,
  backPanelPlywoodOption,
  resolveLegHeight,
  pullStyleOption,
  pullStyleNote,
  doorPullStyleOption,
  lockTotalHeightOptions,
  resolveLockedTotalHeight,
} from "./_helpers";

export const wardrobeOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚", defaultValue: 18, min: 9, max: 35, step: 1 },
  ...makeZoneOptions({
    // 標準衣櫃：上層層板收納、中層門板（門內掛衣）、下層抽屜
    topType: "shelves", topHeight: 300, topCount: 2,
    midType: "door", midCount: 2,
    bottomType: "drawer", bottomHeight: 400, bottomCount: 2, bottomCols: 2,
  }, true),
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "slab", choices: [
    { value: "slab", label: "夾板貼皮平板門（裝潢常用，衣櫃首選）" },
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
  ], dependsOn: ANY_ZONE_IS_DOOR },
  doorMountOption,
  doorFrameRailWidthOption,
  doorFrameThicknessOption,
  withLegsOption,
  backPanelPlywoodOption,
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高", defaultValue: 80, min: 0, max: 400, step: 10, help: "鎖定總高時自動算", dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "lockTotalHeight", equals: false }] } },
  { group: "leg", type: "number", key: "legSize", label: "底座腳粗", defaultValue: 50, min: 35, max: 120, step: 1, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] }, help: "衣櫃高重，建議 50mm 以上" },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "plinth", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳（方料）" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座（衣櫃常見）" },
    { value: "panel-side", label: "側板延伸落地" },
  ] , dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  drawerMountOption,
  drawerBottomModeOption,
  drawerBottomThicknessOption,
  drawerBoxJoineryOption,
  backModeOption,
  drawerSlideOption,
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  ...lockTotalHeightOptions(),
  pullStyleOption("door"),
  doorPullStyleOption("door"),
];

export const wardrobe: FurnitureTemplate = (input) => {
  const o = wardrobeOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = resolveLegHeight(input, o);
  const backPanelPlywood = getOption<boolean>(input, opt(o, "backPanelPlywood"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const doorMount = resolveDoorMount(input, o);
  const drawerMount = resolveDrawerMount(input, o);
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const doorPullStyleRaw = getOption<string>(input, opt(o, "doorPullStyle"));
  const doorPullStyle = !doorPullStyleRaw || doorPullStyleRaw === "inherit" ? pullStyle : doorPullStyleRaw;

  const { innerH, effectiveLegHeight, warnings: lockWarnings } = resolveLockedTotalHeight(
    input, o, panelThickness, legHeight,
  );
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const { zones, notesLine, warnings } = resolveZones(input, o, innerH, doorLabel);
  warnings.push(...lockWarnings);
  // 從實際 zones 推算抽屜總數，給 validateCabinetStructure 用（原本 hardcoded 4 不準）
  const drawerCount = zones.reduce(
    (sum, z) => (z.type === "drawer" ? sum + (z.count ?? 0) * (z.cols ?? 1) : sum),
    0,
  );
  const hasDrawers = drawerCount > 0;

  const design = caseFurniture({
    category: "wardrobe",
    nameZh: "衣櫃",
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
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "round" | "round-tapered",
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
    notes: `${notesLine}（${doorMountLabel(doorMount)}）${effectiveLegHeight > 0 ? `；加 ${effectiveLegHeight}mm ${legShape} 底座${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。需配吊衣桿、西德鉸鏈（${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）${hasDrawers ? "、抽屜滑軌" : ""}。${pullStyleNote(pullStyle)} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)}`.trim(),
    warnings,
  });
  applyStandardChecks(design, {
    minLength: 600, minWidth: 400, minHeight: 1500,
    maxLength: 2400, maxWidth: 800, maxHeight: 2500,
  });
  const useDrawerSlide = getOption<boolean>(input, opt(o, "useDrawerSlide"));
  appendWarnings(
    design,
    validateCabinetStructure({
      panelThickness,
      height: input.height,
      shelfSpan: input.length - 2 * panelThickness,
      hasDrawers,
      drawerCount,
      hasDrawerSlide: useDrawerSlide,
    }),
  );
  // 吊衣桿高度 ergo：< 1100mm 大衣/長外套掛不下；1700+ 標配
  for (const z of zones) {
    if (z.type === "hanging" && z.heightMm < 1100) {
      appendWarnings(design, [`吊衣區淨高 ${z.heightMm}mm < 1100mm，大衣 / 長洋裝會拖到底。建議加大櫃高或縮短上下層的高度，吊衣區留 1100-1700mm。`]);
      break;
    }
  }
  return design;
};
