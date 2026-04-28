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

export const wardrobeOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  ...makeZoneOptions({
    // 標準衣櫃：上層層板收納、中層吊衣、下層抽屜
    topType: "shelves", topHeight: 300, topCount: 2,
    midType: "hanging", midCount: 1,
    bottomType: "drawer", bottomHeight: 400, bottomCount: 2, bottomCols: 2,
  }, true),
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "slab", choices: [
    { value: "slab", label: "夾板貼皮平板門（裝潢常用，衣櫃首選）" },
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
  ] },
  doorMountOption,
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 80, min: 0, max: 400, step: 10 },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "plinth", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座（衣櫃常見）" },
    { value: "panel-side", label: "側板延伸落地" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  drawerMountOption,
  drawerBottomModeOption,
  backModeOption,
  drawerSlideOption,
  shelfPinSystemOption("structure"),
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  backPanelMaterialOption("structure"),
  { group: "structure", type: "checkbox", key: "withTrouserRack", label: "拉出式長褲架", defaultValue: false, help: "可拉出的橫桿陣列，掛長褲（每根 50mm 間距、配側裝滑軌）", wide: true },
  { group: "structure", type: "checkbox", key: "withTieShelf", label: "領帶 / 配件抽板", defaultValue: false, help: "薄抽板（厚 20mm）內含格子，分類放領帶、皮帶、首飾", wide: true },
  { group: "structure", type: "checkbox", key: "withTopCompartment", label: "頂部棉被櫃", defaultValue: false, help: "頂端 350mm 加水平隔板做獨立空間，放棉被/換季衣物", wide: true },
  { group: "structure", type: "checkbox", key: "withBottomShoeRack", label: "底部鞋格", defaultValue: false, help: "底部 200mm 加 2 層斜放層板做鞋櫃用", wide: true },
  { group: "structure", type: "checkbox", key: "withInteriorLed", label: "內部感應 LED", defaultValue: false, help: "頂部裝 LED 燈條，門開時自動感應點亮", wide: true },
  pullStyleOption("door"),
  softCloseOption("door"),
];

export const wardrobe: FurnitureTemplate = (input) => {
  const o = wardrobeOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
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
  const withTrouserRack = getOption<boolean>(input, opt(o, "withTrouserRack"));
  const withTieShelf = getOption<boolean>(input, opt(o, "withTieShelf"));
  const withTopCompartment = getOption<boolean>(input, opt(o, "withTopCompartment"));
  const withBottomShoeRack = getOption<boolean>(input, opt(o, "withBottomShoeRack"));
  const withInteriorLed = getOption<boolean>(input, opt(o, "withInteriorLed"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const softClose = getOption<boolean>(input, opt(o, "softClose"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const { zones, notesLine, warnings } = resolveZones(input, o, innerH, doorLabel);

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
    legHeight,
    legSize: 45,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side",
    legInset,
    doorMount,
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    notes: `${notesLine}（${doorMountLabel(doorMount)}）${legHeight > 0 ? `；加 ${legHeight}mm ${legShape} 底座${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。需配吊衣桿、西德鉸鏈（${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）、抽屜滑軌。${shelfPinSystemNote(shelfPinSystem)} ${pullStyleNote(pullStyle)} ${softCloseNote(softClose)} ${withTrouserRack ? "含拉出式長褲架（5-7 根橫桿 + 一對側裝滑軌）。" : ""} ${withTieShelf ? "含領帶 / 配件抽板（淺型 20mm 厚 + 內部分隔格）。" : ""} ${withTopCompartment ? "頂部 350mm 棉被櫃（水平隔板 + 獨立小門）。" : ""} ${withBottomShoeRack ? "底部 200mm 鞋格（2 層 8° 斜放板）。" : ""} ${withInteriorLed ? "內部 LED 燈條（門開感應，3000K 暖光、12V/2A 電源、預埋線管）。" : ""} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
    warnings,
  });
  // 頂部棉被櫃：水平隔板（Part）距頂端 350mm
  if (withTopCompartment) {
    design.parts.push({
      id: "top-compartment-divider",
      nameZh: "頂部棉被櫃水平隔板",
      material: input.material,
      grainDirection: "length",
      visible: {
        length: input.length - 2 * panelThickness,
        width: input.width - 2 * panelThickness,
        thickness: panelThickness,
      },
      origin: { x: 0, y: input.height - 350, z: 0 },
      tenons: [],
      mortises: [],
    });
  }
  // 底部鞋格：2 層斜板
  if (withBottomShoeRack) {
    for (let i = 0; i < 2; i++) {
      design.parts.push({
        id: `shoe-rack-${i + 1}`,
        nameZh: `底部鞋格 ${i + 1}`,
        material: input.material,
        grainDirection: "length",
        visible: {
          length: input.length - 2 * panelThickness,
          width: input.width - 2 * panelThickness - 20,
          thickness: panelThickness - 4,
        },
        origin: { x: 0, y: legHeight + 50 + i * 90, z: 0 },
        rotation: { x: -8 * Math.PI / 180, y: 0, z: 0 }, // 8° 斜
        tenons: [],
        mortises: [],
      });
    }
  }
  // 內部 LED：頂端加細長條代表
  if (withInteriorLed) {
    design.parts.push({
      id: "interior-led-strip",
      nameZh: "內部 LED 燈條",
      material: input.material,
      grainDirection: "length",
      visible: { length: input.length - 2 * panelThickness - 20, width: 12, thickness: 6 },
      origin: { x: 0, y: input.height - panelThickness - 10, z: input.width / 2 - panelThickness - 8 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

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
      hasDrawers: true,
      drawerCount: 4,
      hasDrawerSlide: useDrawerSlide,
    }),
  );
  return design;
};
