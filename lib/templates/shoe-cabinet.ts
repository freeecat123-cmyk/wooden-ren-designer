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

export const shoeCabinetOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  ...makeZoneOptions({
    // 兩段式鞋櫃：上層開放（鑰匙小物）/ 下層門板藏鞋；無中層
    topType: "shelves", topHeight: 250, topCount: 1,
    midType: "none", midCount: 0,
    bottomType: "door", bottomHeight: 600, bottomCount: 2,
  }, false, { skipMid: true }),
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "wood", choices: [
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "slab", label: "夾板貼皮平板門（裝潢常用）" },
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
    { value: "louvered", label: "百葉門（通風防鞋臭）" },
  ] },
  doorMountOption,
  drawerMountOption,
  drawerBottomModeOption,
  backModeOption,
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 80, min: 0, max: 400, step: 10, help: "鞋櫃底部通常抬高防潮" },
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
  { group: "structure", type: "checkbox", key: "tiltedShelf", label: "斜放層板（鞋頭朝下）", defaultValue: false, help: "層板向後傾斜 5-10°，鞋子放上去後鞋頭朝下、不會滑出。傳統鞋櫃常用做法", wide: true },
  { group: "structure", type: "checkbox", key: "withTopSeatCushion", label: "頂面加坐墊（穿鞋椅）", defaultValue: false, help: "頂面加 30mm 厚軟墊布套，玄關直接坐著穿鞋", wide: true },
  pullStyleOption("door"),
  softCloseOption("door"),
];

export const shoeCabinet: FurnitureTemplate = (input) => {
  const o = shoeCabinetOptions;
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
  const tiltedShelf = getOption<boolean>(input, opt(o, "tiltedShelf"));
  const withTopSeatCushion = getOption<boolean>(input, opt(o, "withTopSeatCushion"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const softClose = getOption<boolean>(input, opt(o, "softClose"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const { zones, notesLine, warnings } = resolveZones(input, o, innerH, doorLabel);

  const design = caseFurniture({
    category: "shoe-cabinet",
    nameZh: "鞋櫃",
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
          : doorType === "louvered"
            ? "wood"
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
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）${legHeight > 0 ? `；加 ${legHeight}mm 底座腳（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}` : ""}。${shelfPinSystemNote(shelfPinSystem)} ${pullStyleNote(pullStyle)} ${softCloseNote(softClose)} ${tiltedShelf ? "層板向後傾 8°，鞋頭朝下不易滑出（前緣加 8mm 擋條更保險）。" : ""} ${doorType === "louvered" ? "百葉門：門板開水平百葉條（葉片厚 8mm、間距 15mm、傾斜 25°），通風散濕防鞋臭。" : ""} ${withTopSeatCushion ? "頂面加 30mm 厚海綿坐墊 + 布套（魔鬼氈固定），玄關穿鞋椅功能。" : ""} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
    warnings,
  });
  // 百葉門：在每片門面板上加水平百葉 mortises（每片 ⌀15mm 間距、傾斜記在 notes）
  if (doorType === "louvered") {
    const doorParts = design.parts.filter((p) => p.id.includes("door") || p.id.endsWith("-face"));
    for (const dp of doorParts) {
      const dH = dp.visible.width;
      const slatPitch = 23; // 8mm 葉片 + 15mm 間距
      const count = Math.floor((dH - 40) / slatPitch);
      const newM = [...dp.mortises];
      for (let r = 0; r < count; r++) {
        const y = -dH / 2 + 20 + (r + 0.5) * slatPitch;
        newM.push({ origin: { x: 0, y, z: 0 }, depth: 6, length: dp.visible.length - 30, width: 8, through: false });
      }
      dp.mortises = newM;
    }
  }
  // 頂面坐墊：加一片軟墊 Part（薄板代表）
  if (withTopSeatCushion) {
    design.parts.push({
      id: "seat-cushion",
      nameZh: "頂面坐墊",
      material: input.material,
      grainDirection: "length",
      visible: { length: input.length - 20, width: input.width - 20, thickness: 30 },
      origin: { x: 0, y: input.height + 15, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  applyStandardChecks(design, {
    minLength: 500, minWidth: 250, minHeight: 500,
    maxLength: 1500, maxWidth: 500, maxHeight: 2000,
  });
  appendWarnings(
    design,
    validateCabinetStructure({
      panelThickness,
      height: input.height,
      shelfSpan: input.length - 2 * panelThickness,
    }),
  );
  if (input.height > 2000 || input.length > 1500) {
    appendSuggestion(design, {
      text: `${input.length}×${input.height}mm 已超過鞋櫃常規——衣櫃模板支援大尺寸玄關櫃。`,
      suggestedCategory: "wardrobe",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
