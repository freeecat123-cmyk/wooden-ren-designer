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
import { applyStandardChecks, validateCabinetStructure, appendWarnings } from "./_validators";
import {
  shelfPinSystemOption,
  shelfPinSystemNote,
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
  backPanelMaterialOption,
  backPanelMaterialNote,
  pullStyleOption,
  pullStyleNote,
  softCloseOption,
  softCloseNote,
} from "./_helpers";

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
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 70, min: 0, max: 400, step: 10, help: "0 = 貼地（系統櫃式）；70–80 = 沙發腳款（最常見展示櫃造型）" },
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
  shelfPinSystemOption("structure"),
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  backPanelMaterialOption("structure"),
  { group: "structure", type: "checkbox", key: "glassShelves", label: "玻璃層板（透光感）", defaultValue: false, help: "層板換成 8mm 強化玻璃，光線可以從上層透到下層。常見於精品櫃 / 公仔櫃", wide: true },
  { group: "structure", type: "checkbox", key: "withLedStrip", label: "預留 LED 燈條溝", defaultValue: false, help: "頂板背面開 12mm 寬 × 6mm 深溝藏 LED 燈條，照亮櫃內展品。需配 12V 變壓器", wide: true },
  { group: "structure", type: "checkbox", key: "withMirroredBack", label: "背板鏡面", defaultValue: false, help: "背板換成 4mm 鏡面玻璃，櫃內展品反射加倍視覺，精品櫃常用", wide: true },
  { group: "door", type: "select", key: "doorMullion", label: "玻璃門木格分隔（mullion）", defaultValue: "none", choices: [
    { value: "none", label: "整面玻璃（最簡單）" },
    { value: "cross", label: "十字 4 格（古典款）" },
    { value: "vertical-3", label: "縱向 3 格" },
    { value: "colonial", label: "Colonial 6 格（殖民風）" },
    { value: "art-deco", label: "Art Deco 幾何（菱形/扇形）" },
  ], help: "玻璃門加木格分條（mullion），打破整片玻璃的單調，傳統感更強", dependsOn: { key: "doorType", equals: "glass" } },
  pullStyleOption("door"),
  softCloseOption("door"),
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
  const shelfPinSystem = getOption<string>(input, opt(o, "shelfPinSystem"));
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const backPanelMaterial = getOption<string>(input, opt(o, "backPanelMaterial"));
  const glassShelves = getOption<boolean>(input, opt(o, "glassShelves"));
  const withLedStrip = getOption<boolean>(input, opt(o, "withLedStrip"));
  const withMirroredBack = getOption<boolean>(input, opt(o, "withMirroredBack"));
  const doorMullion = getOption<string>(input, opt(o, "doorMullion"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const softClose = getOption<boolean>(input, opt(o, "softClose"));

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
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）${legInset > 0 ? `；腳內縮 ${legInset}mm` : ""}。${shelfPinSystemNote(shelfPinSystem)} ${pullStyleNote(pullStyle)} ${softCloseNote(softClose)} ${glassShelves ? "層板換 8mm 強化玻璃，需向玻璃行訂製，邊緣磨平 + 倒角防割手。" : ""} ${withLedStrip ? "頂板下面開 12mm 寬 × 6mm 深溝藏 LED 燈條（需配 12V 變壓器 + 線材孔）。" : ""} ${withMirroredBack ? "背板換成 4mm 鏡面玻璃（需玻璃行裁邊磨光），展品視覺加倍。" : ""} ${doorType === "glass" && doorMullion !== "none" ? `玻璃門加 ${doorMullion === "cross" ? "十字 4 格" : doorMullion === "vertical-3" ? "縱向 3 格" : doorMullion === "colonial" ? "Colonial 6 格" : "Art Deco 幾何"} 木格 mullion。` : ""} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
    warnings,
  });
  applyStandardChecks(design, {
    minLength: 500, minWidth: 300, minHeight: 600,
    maxLength: 1500, maxWidth: 600, maxHeight: 2200,
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
