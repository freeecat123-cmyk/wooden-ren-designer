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
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
  backPanelMaterialOption,
  backPanelMaterialNote,
  pullStyleOption,
  pullStyleNote,
  doorPullStyleOption,
  lockTotalHeightOptions,
  resolveLockedTotalHeight,
} from "./_helpers";

export const displayCabinetOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 20, min: 9, max: 35, step: 1 },
  ...makeZoneOptions({
    topType: "door", topHeight: 400, topCount: 2,
    midType: "shelves", midCount: 3,
    bottomType: "door", bottomHeight: 500, bottomCount: 2,
  }),
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "glass", choices: [
    { value: "glass", label: "玻璃門（強化玻璃）" },
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "slab", label: "夾板貼皮平板門（裝潢常用）" },
  ], dependsOn: ANY_ZONE_IS_DOOR },
  doorMountOption,
  doorFrameRailWidthOption,
  doorFrameThicknessOption,
  drawerMountOption,
  drawerBottomModeOption,
  backModeOption,
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 70, min: 0, max: 400, step: 10, help: "0 = 貼地（系統櫃式）；70–80 = 沙發腳款（最常見展示櫃造型）。鎖定總高時自動算", dependsOn: { key: "lockTotalHeight", equals: false } },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳（方料）" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  drawerSlideOption,
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  backPanelMaterialOption("structure"),
  ...lockTotalHeightOptions(),
  { group: "structure", type: "select", key: "topDecor", label: "頂部裝飾條樣式", defaultValue: "none", choices: [
    { value: "none", label: "無（極簡款）" },
    { value: "flat-band", label: "平直線板（一條 60mm 板繞頂緣）" },
    { value: "stepped", label: "階梯線板（兩層收口，傳統厚實感）" },
    { value: "dentil", label: "齒狀線板（古典款，希臘建築風小齒）" },
    { value: "balustrade", label: "欄杆飾條（小立柱排列，洋風櫥櫃）" },
  ], help: "櫃頂加裝飾條，從簡約到古典 4 種風格；前+左+右三面包覆，後方靠牆不裝", wide: true },
  { group: "door", type: "select", key: "doorMullion", label: "玻璃門木格分隔（mullion）", defaultValue: "none", choices: [
    { value: "none", label: "整面玻璃（最簡單）" },
    { value: "cross", label: "十字 4 格（古典款）" },
    { value: "vertical-3", label: "縱向 3 格" },
    { value: "colonial", label: "Colonial 6 格（殖民風）" },
    { value: "art-deco", label: "Art Deco 幾何（菱形/扇形）" },
  ], help: "玻璃門加木格分條（mullion），打破整片玻璃的單調，傳統感更強", dependsOn: { key: "doorType", equals: "glass" } },
  pullStyleOption("door"),
  doorPullStyleOption("door"),
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
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const backPanelMaterial = getOption<string>(input, opt(o, "backPanelMaterial"));
  const doorMullion = getOption<string>(input, opt(o, "doorMullion"));
  const topDecor = getOption<string>(input, opt(o, "topDecor"));
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
    legHeight: effectiveLegHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "round" | "round-tapered",
    legInset,
    doorMount,
    doorFrameRailWidth: getOption<number>(input, opt(o, "doorFrameRailWidth")),
    doorFrameThickness: getOption<number>(input, opt(o, "doorFrameThickness")),
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    pullStyle,
    doorPullStyle,
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）${doorType === "glass" ? "；門用 5mm 強化玻璃" : ""}${legInset > 0 ? `；腳內縮 ${legInset}mm` : ""}。${pullStyleNote(pullStyle)} ${doorType === "glass" && doorMullion !== "none" ? `玻璃門加 ${doorMullion === "cross" ? "十字 4 格" : doorMullion === "vertical-3" ? "縱向 3 格" : doorMullion === "colonial" ? "Colonial 6 格" : "Art Deco 幾何"} 木格 mullion。` : ""} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
    warnings,
  });
  // 頂部裝飾條：前 + 左 + 右三面包覆（後方靠牆省略）
  if (topDecor !== "none") {
    const yTop = input.height;
    const L = input.length;
    const W = input.width;
    const mat = input.material;
    const proj = 8; // 裝飾條外伸 8mm，比櫃體略凸顯立體感
    const trimT = 18;
    const bandH = 60;

    // 直接以「世界軸尺寸」設 visible：length→X、thickness→Y(垂直)、width→Z，
    // 不用旋轉。避免雙軸 rotation 在 ZYX Euler 下跟 worldExtents 對不上的渲染 bug。
    const pushBand = (params: {
      id: string; nameZh: string; height: number; thick: number;
      xInset?: number; zInset?: number; yOffset: number;
    }) => {
      const { id, nameZh, height, thick, xInset = 0, zInset = 0, yOffset } = params;
      // 前條：X 軸長、Y 軸高 (height)、Z 軸薄 (thick)
      const frontZ = -W / 2 - proj + thick / 2 + zInset;
      design.parts.push({
        id: `${id}-front`,
        nameZh: `${nameZh} 前條`,
        material: mat, grainDirection: "length",
        visible: { length: L + 2 * proj - 2 * xInset, width: thick, thickness: height },
        origin: { x: 0, y: yTop + yOffset, z: frontZ },
        tenons: [], mortises: [],
      });
      // 側條（左右）：前端切齊前條後面、後端到櫃體後緣（後方靠牆免裝）
      // X 軸薄 (thick)、Y 軸高 (height)、Z 軸長 (sideLen)
      for (const side of [-1, 1]) {
        const sideFrontZ = -W / 2 - proj + thick + zInset;
        const sideBackZ = W / 2;
        const sideLen = sideBackZ - sideFrontZ;
        const sideCenterZ = (sideFrontZ + sideBackZ) / 2;
        design.parts.push({
          id: `${id}-${side > 0 ? "right" : "left"}`,
          nameZh: `${nameZh} ${side > 0 ? "右" : "左"}條`,
          material: mat, grainDirection: "width",
          visible: { length: thick, width: sideLen, thickness: height },
          origin: { x: side * (L / 2 + proj - thick / 2 - xInset), y: yTop + yOffset, z: sideCenterZ },
          tenons: [], mortises: [],
        });
      }
    };

    if (topDecor === "flat-band") {
      pushBand({ id: "top-decor", nameZh: "頂部飾條", height: bandH, thick: trimT, yOffset: 0 });
    }

    if (topDecor === "stepped") {
      // 古典 cornice：下層窄、上層 cap 寬外伸（cap 蓋住下層、向外多伸 15mm）
      // 下層：50mm 高，xInset=15、zInset=15（窄）→ 從櫃邊內縮 7mm
      pushBand({ id: "top-decor-lower", nameZh: "頂部飾條 下層", height: 50, thick: trimT, xInset: 15, zInset: 15, yOffset: 0 });
      // 上層：30mm 高，無內縮（寬，外伸跟櫃同 proj=8）→ 比下層往外 15mm 突出
      pushBand({ id: "top-decor-upper", nameZh: "頂部飾條 上層 cap", height: 30, thick: trimT, yOffset: 50 });
    }

    if (topDecor === "dentil") {
      // 古典 dentil cornice：底座（下）→ 齒列（中）→ 上層 cap（最上）
      // 底座：35mm 窄板，xInset/zInset 15 → 比櫃邊內縮 7mm
      pushBand({ id: "top-decor-base", nameZh: "齒飾 底座", height: 35, thick: trimT, xInset: 15, zInset: 15, yOffset: 0 });
      // 齒列：每齒 22 × 25 × 14，齒寬=齒距 1:1 古典比例
      const toothW = 22, toothH = 25, toothT = 14, gap = 22;
      const pitch = toothW + gap;
      const frontZ = -W / 2 - proj + toothT / 2;
      const yToothBase = yTop + 35; // 站在底座上方
      // 前排：盡量填滿 L+2*proj
      const usableL = L + 2 * proj - 2 * toothW;
      const nFront = Math.max(2, Math.floor(usableL / pitch) + 1);
      const startX = -((nFront - 1) * pitch) / 2;
      for (let k = 0; k < nFront; k++) {
        design.parts.push({
          id: `top-decor-tooth-front-${k + 1}`,
          nameZh: `頂部齒飾 前 ${k + 1}`,
          material: mat, grainDirection: "length",
          visible: { length: toothW, width: toothT, thickness: toothH },
          origin: { x: startX + k * pitch, y: yToothBase, z: frontZ },
          tenons: [], mortises: [],
        });
      }
      // 左右側齒：分佈在「前齒後方」到「後緣」之間
      const sideFrontZTooth = -W / 2 - proj + toothT;
      const sideBackZTooth = W / 2;
      const sideRangeTooth = sideBackZTooth - sideFrontZTooth;
      const nSide = Math.max(2, Math.floor((sideRangeTooth - toothW) / pitch) + 1);
      const sideCenterZTooth = (sideFrontZTooth + sideBackZTooth) / 2;
      const startZ = sideCenterZTooth - ((nSide - 1) * pitch) / 2;
      for (const side of [-1, 1]) {
        for (let k = 0; k < nSide; k++) {
          design.parts.push({
            id: `top-decor-tooth-${side > 0 ? "right" : "left"}-${k + 1}`,
            nameZh: `頂部齒飾 ${side > 0 ? "右" : "左"} ${k + 1}`,
            material: mat, grainDirection: "width",
            visible: { length: toothT, width: toothW, thickness: toothH },
            origin: { x: side * (L / 2 + proj - toothT / 2), y: yToothBase, z: startZ + k * pitch },
            tenons: [], mortises: [],
          });
        }
      }
      // 上層 cap：壓在齒列頂上，無內縮（寬出，蓋住整圈齒）
      pushBand({ id: "top-decor-cap", nameZh: "齒飾 上層 cap", height: 18, thick: trimT, yOffset: 35 + toothH });
    }

    if (topDecor === "balustrade") {
      // 下橫條 25mm + 立柱 90mm + 上橫條 25mm，三層欄杆
      const baseH = 25, postH = 90, capH = 25;
      pushBand({ id: "top-decor-base", nameZh: "頂部欄杆 底條", height: baseH, thick: trimT, yOffset: 0 });
      pushBand({ id: "top-decor-cap", nameZh: "頂部欄杆 頂條", height: capH, thick: trimT, yOffset: baseH + postH });
      // 立柱：每 70mm 一根，方料 18×18mm
      const postW = 18, postT = 18, pitchP = 70;
      const yPostBase = yTop + baseH;
      const frontZpost = -W / 2 - proj + postT / 2;
      const usableLp = L + 2 * proj - 2 * postW;
      const nFrontPost = Math.max(2, Math.floor(usableLp / pitchP) + 1);
      const startXp = -((nFrontPost - 1) * pitchP) / 2;
      for (let k = 0; k < nFrontPost; k++) {
        design.parts.push({
          id: `top-decor-post-front-${k + 1}`,
          nameZh: `頂部欄杆 前立柱 ${k + 1}`,
          material: mat, grainDirection: "length",
          visible: { length: postW, width: postT, thickness: postH },
          origin: { x: startXp + k * pitchP, y: yPostBase, z: frontZpost },
          tenons: [], mortises: [],
        });
      }
      // 左右側立柱：分佈在「前立柱後方」到「後緣」之間
      const sideFrontZpost = -W / 2 - proj + postT;
      const sideBackZpost = W / 2;
      const sideRangePost = sideBackZpost - sideFrontZpost;
      const nSidePost = Math.max(2, Math.floor((sideRangePost - postW) / pitchP) + 1);
      const sideCenterZpost = (sideFrontZpost + sideBackZpost) / 2;
      const startZp = sideCenterZpost - ((nSidePost - 1) * pitchP) / 2;
      for (const side of [-1, 1]) {
        for (let k = 0; k < nSidePost; k++) {
          design.parts.push({
            id: `top-decor-post-${side > 0 ? "right" : "left"}-${k + 1}`,
            nameZh: `頂部欄杆 ${side > 0 ? "右" : "左"}立柱 ${k + 1}`,
            material: mat, grainDirection: "length",
            visible: { length: postT, width: postW, thickness: postH },
            origin: { x: side * (L / 2 + proj - postT / 2), y: yPostBase, z: startZp + k * pitchP },
            tenons: [], mortises: [],
          });
        }
      }
    }
  }

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
