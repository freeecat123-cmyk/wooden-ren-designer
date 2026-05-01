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
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 70, min: 0, max: 400, step: 10, help: "設 0 則貼地，>0 則加 4 隻沙發腳；70–80 是最常見的家具底座高" },
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
  { group: "drawer", type: "select", key: "drawerFaceStyle", label: "抽屜面板樣式", defaultValue: "flat", choices: [
    { value: "flat", label: "平板（slab，現代極簡）" },
    { value: "shaker", label: "夏克框（5 件式 frame-and-panel）" },
    { value: "inset", label: "嵌入式（面板小於開口、四週 reveal）" },
    { value: "overlay", label: "全蓋式（面板蓋住整個開口）" },
    { value: "raised-panel", label: "凸版（傳統雕花框 + 凸鑲板）" },
  ] },
  { group: "structure", type: "checkbox", key: "withGalleryRail", label: "頂面 gallery 飾邊", defaultValue: false, help: "頂板四週加 25mm 高木條圍欄，避免擺放物品掉落、視覺更精緻", wide: true },
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
  const drawerFaceStyle = getOption<string>(input, opt(o, "drawerFaceStyle"));
  const withGalleryRail = getOption<boolean>(input, opt(o, "withGalleryRail"));

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
    notes: `${notesLine}${legHeight > 0 ? `；底座加 ${legHeight}mm ${legShape} 腳${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。${drawerJoineryNote(drawerJoinery)} ${drawerSlideTypeNote(drawerSlideType)} ${pullStyleNote(pullStyle)} ${softCloseNote(softClose)} ${shelfPinSystemNote(shelfPinSystem)} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)} ${backPanelMaterialNote(backPanelMaterial)} ${drawerFaceStyle === "flat" ? "" : drawerFaceStyle === "shaker" ? "抽屜面板採夏克 5 件式 frame-and-panel（外框 60mm 寬、內凹平鑲板）。" : drawerFaceStyle === "inset" ? "抽屜面板嵌入式 inset（面板小於開口 3mm、四週留 reveal）。" : drawerFaceStyle === "overlay" ? "抽屜面板全蓋式 overlay（面板蓋住整個開口）。" : "抽屜面板凸版 raised-panel（外框 + 中央凸 6mm 雕花板）。"} ${withGalleryRail ? "頂面四週加 25mm 高 gallery 木條圍欄。" : ""}`.trim(),
    warnings,
  });
  // 抽屜面板樣式：shaker → 5 件式 frame-and-panel
  if (drawerFaceStyle === "shaker") {
    const faceParts = design.parts.filter((p) => p.id.endsWith("-face"));
    const railW = 60;
    const panelInset = 8;
    for (const face of faceParts) {
      const fL = face.visible.length;
      const fH = face.visible.width;
      const fT = face.visible.thickness;
      const idx = face.id;
      // remove the slab face
      design.parts = design.parts.filter((p) => p.id !== face.id);
      const baseOrigin = face.origin;
      const baseRot = face.rotation;
      // top rail
      design.parts.push({
        id: `${idx}-rail-top`,
        nameZh: face.nameZh + " 上框",
        material: input.material,
        grainDirection: "length",
        visible: { length: fL, width: railW, thickness: fT },
        origin: { x: baseOrigin.x, y: baseOrigin.y + fH / 2 - railW / 2, z: baseOrigin.z },
        rotation: baseRot,
        tenons: [],
        mortises: [],
      });
      design.parts.push({
        id: `${idx}-rail-bottom`,
        nameZh: face.nameZh + " 下框",
        material: input.material,
        grainDirection: "length",
        visible: { length: fL, width: railW, thickness: fT },
        origin: { x: baseOrigin.x, y: baseOrigin.y - fH / 2 + railW / 2, z: baseOrigin.z },
        rotation: baseRot,
        tenons: [],
        mortises: [],
      });
      design.parts.push({
        id: `${idx}-stile-left`,
        nameZh: face.nameZh + " 左框",
        material: input.material,
        grainDirection: "length",
        visible: { length: fH - 2 * railW, width: railW, thickness: fT },
        origin: { x: baseOrigin.x - fL / 2 + railW / 2, y: baseOrigin.y, z: baseOrigin.z },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
      design.parts.push({
        id: `${idx}-stile-right`,
        nameZh: face.nameZh + " 右框",
        material: input.material,
        grainDirection: "length",
        visible: { length: fH - 2 * railW, width: railW, thickness: fT },
        origin: { x: baseOrigin.x + fL / 2 - railW / 2, y: baseOrigin.y, z: baseOrigin.z },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
      design.parts.push({
        id: `${idx}-panel`,
        nameZh: face.nameZh + " 中央鑲板",
        material: input.material,
        grainDirection: "length",
        visible: { length: fL - 2 * railW, width: fH - 2 * railW, thickness: Math.max(8, fT - panelInset) },
        origin: { x: baseOrigin.x, y: baseOrigin.y, z: baseOrigin.z + panelInset / 2 },
        rotation: baseRot,
        tenons: [],
        mortises: [],
      });
    }
  }

  // 頂面 gallery 飾邊：4 條小木條圍欄
  if (withGalleryRail) {
    const railH = 25;
    const railT = 12;
    const yTop = input.height + railH / 2;
    // front/back
    for (const side of [-1, 1]) {
      design.parts.push({
        id: `gallery-${side > 0 ? "back" : "front"}`,
        nameZh: `頂面 gallery ${side > 0 ? "後" : "前"}條`,
        material: input.material,
        grainDirection: "length",
        visible: { length: input.length, width: railH, thickness: railT },
        origin: { x: 0, y: yTop, z: side * (input.width / 2 - railT / 2) },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
    // left/right
    for (const side of [-1, 1]) {
      design.parts.push({
        id: `gallery-${side > 0 ? "right" : "left"}`,
        nameZh: `頂面 gallery ${side > 0 ? "右" : "左"}條`,
        material: input.material,
        grainDirection: "length",
        visible: { length: input.width, width: railH, thickness: railT },
        origin: { x: side * (input.length / 2 - railT / 2), y: yTop, z: 0 },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

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
