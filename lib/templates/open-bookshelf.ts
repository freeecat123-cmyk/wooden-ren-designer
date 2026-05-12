import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import { makeZoneOptions, resolveBackMode, resolveZones } from "./_builders/zone-helpers";
import { applyStandardChecks, validateCabinetStructure, appendWarnings } from "./_validators";
import {
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
} from "./_helpers";

export const openBookshelfOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  // 開放書櫃預設無背板（最常見），但仍可改成釘背 / 入溝
  {
    group: "structure",
    type: "select",
    key: "backMode",
    label: "背板作法",
    defaultValue: "none",
    choices: [
      { value: "none", label: "無背板（開放式陳列）" },
      { value: "surface", label: "釘背（3mm 夾板蓋滿背面）— 裝潢標準" },
      { value: "rebated", label: "入溝（9mm 嵌進側板溝裡）— 榫卯 / 鄉村風家具" },
    ],
  },
  ...makeZoneOptions({
    topType: "shelves", topHeight: 400, topCount: 2,
    midType: "shelves", midCount: 3,
    bottomType: "shelves", bottomHeight: 400, bottomCount: 2,
  }),
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10 },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地（書櫃常見）" },
  ] , dependsOn: { key: "legHeight", notIn: [0] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { key: "legHeight", notIn: [0] } },
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  { group: "structure", type: "checkbox", key: "withLedderRail", label: "頂端 cornice 飾條", defaultValue: false, help: "頂端加線板飾條，書櫃古典感", wide: true },
  { group: "structure", type: "number", key: "corniceHeight", label: "cornice 高 (mm)", defaultValue: 30, min: 15, max: 80, step: 5, dependsOn: { key: "withLedderRail", equals: true } },
  { group: "structure", type: "number", key: "corniceDepth", label: "cornice 厚 (mm)", defaultValue: 25, min: 12, max: 50, step: 1, dependsOn: { key: "withLedderRail", equals: true } },
  { group: "structure", type: "number", key: "corniceOverhang", label: "cornice 兩端外伸 (mm)", defaultValue: 15, min: 0, max: 60, step: 1, dependsOn: { key: "withLedderRail", equals: true } },
  { group: "structure", type: "checkbox", key: "withBookStop", label: "層板後緣加擋條", defaultValue: false, help: "每片層板後緣加實木條，書本不會掉到後面（無背板書櫃常用）", wide: true },
  { group: "structure", type: "number", key: "bookStopHeight", label: "擋條高 (mm)", defaultValue: 8, min: 4, max: 30, step: 1, dependsOn: { key: "withBookStop", equals: true } },
  { group: "structure", type: "number", key: "bookStopThickness", label: "擋條厚 (mm)", defaultValue: 12, min: 6, max: 25, step: 1, dependsOn: { key: "withBookStop", equals: true } },
  { group: "structure", type: "checkbox", key: "withShelfReinforcement", label: "層板加固橫條（防撓）", defaultValue: false, help: "每片層板下方加實木支撐條，防長層板撓彎，書櫃寬度 >900mm 建議開（有縱向分隔板時自動取消，分隔板已提供支撐）", wide: true, dependsOn: { key: "verticalDividerCount", equals: 0 } },
  { group: "structure", type: "select", key: "reinforcementPosition", label: "加固條位置", defaultValue: "back", choices: [
    { value: "back", label: "後緣（隱藏）" },
    { value: "front", label: "前緣（外露 = 仿英式書櫃面框）" },
    { value: "both", label: "前後雙條（最強）" },
  ], dependsOn: { all: [{ key: "withShelfReinforcement", equals: true }, { key: "verticalDividerCount", equals: 0 }] } },
  { group: "structure", type: "number", key: "reinforcementHeight", label: "加固條高 (mm)", defaultValue: 30, min: 15, max: 60, step: 5, dependsOn: { all: [{ key: "withShelfReinforcement", equals: true }, { key: "verticalDividerCount", equals: 0 }] } },
  { group: "structure", type: "number", key: "reinforcementThickness", label: "加固條厚 (mm)", defaultValue: 18, min: 12, max: 25, step: 1, dependsOn: { all: [{ key: "withShelfReinforcement", equals: true }, { key: "verticalDividerCount", equals: 0 }] } },
  { group: "structure", type: "number", key: "verticalDividerCount", label: "縱向分隔板數", defaultValue: 0, min: 0, max: 3, step: 1, help: "0=無；1=中央 1 片切兩格；2=三等分；長書櫃放 1 片同時提供結構支撐（會自動取消加固條）" },
];

export const openBookshelf: FurnitureTemplate = (input) => {
  const o = openBookshelfOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const legHeight = getOption<number>(input, opt(o, "legHeight"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const withLedderRail = getOption<boolean>(input, opt(o, "withLedderRail"));
  const corniceHeight = getOption<number>(input, opt(o, "corniceHeight"));
  const corniceDepth = getOption<number>(input, opt(o, "corniceDepth"));
  const corniceOverhang = getOption<number>(input, opt(o, "corniceOverhang"));
  const withBookStop = getOption<boolean>(input, opt(o, "withBookStop"));
  const bookStopHeight = getOption<number>(input, opt(o, "bookStopHeight"));
  const bookStopThickness = getOption<number>(input, opt(o, "bookStopThickness"));
  const withShelfReinforcement = getOption<boolean>(input, opt(o, "withShelfReinforcement"));
  const reinforcementPosition = getOption<string>(input, opt(o, "reinforcementPosition"));
  const reinforcementHeight = getOption<number>(input, opt(o, "reinforcementHeight"));
  const reinforcementThickness = getOption<number>(input, opt(o, "reinforcementThickness"));
  const verticalDividerCount = getOption<number>(input, opt(o, "verticalDividerCount"));
  // 縱向分隔板已提供結構支撐，此時加固條變多餘 → 自動關
  const effectiveReinforcement = withShelfReinforcement && verticalDividerCount === 0;

  const innerH = input.height - legHeight - 2 * panelThickness;
  const { zones, notesLine, warnings } = resolveZones(input, o, innerH, "木");

  const design = caseFurniture({
    category: "open-bookshelf",
    nameZh: "開放書櫃",
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
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "round" | "round-tapered",
    legInset,
    notes: `${notesLine}${legHeight > 0 ? `；加 ${legHeight}mm ${legShape} 腳${legInset > 0 ? `（內縮 ${legInset}mm）` : ""}` : ""}。${withLedderRail ? `頂端加 ${corniceHeight}mm 高 cornice 飾條（傳統線板 + 修邊機 ogee 刀）。` : ""} ${withBookStop ? `每片層板後緣加 ${bookStopHeight}×${bookStopThickness}mm 實木擋條，防書本掉到後面。` : ""} ${effectiveReinforcement ? `每片層板下方加 ${reinforcementHeight}×${reinforcementThickness}mm 加固條（${reinforcementPosition === "back" ? "後緣" : reinforcementPosition === "front" ? "前緣" : "前後雙條"}），防長層板撓彎。` : ""} ${verticalDividerCount > 0 ? `每層加 ${verticalDividerCount} 片直立分隔板，把每格切成 ${verticalDividerCount + 1} 等份。` : ""} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)}`.trim(),
    warnings,
  });
  // 層板後緣擋條：每片層板上方背側加實木條，書本不會掉到後面
  // 縱向分隔板穿過時，擋條切成 N+1 段繞開分隔板（分隔板坐滿層板）
  if (withBookStop) {
    const stopH = bookStopHeight;
    const stopT = bookStopThickness;
    const dividerT = panelThickness;
    // 涵蓋三類橫向板：1) 區內層板 z*-shelf-N  2) 區頂板 z*-boundary
    // 3) 案類 zone-boundary（drawer zone 內用，nameZh 含「抽屜」會被排掉）
    const shelves = design.parts.filter(
      (p) =>
        (/shelf-\d+$/.test(p.id) || /-?boundary$/.test(p.id)) &&
        !p.nameZh.includes("抽屜"),
    );
    // 分隔板 X 中心（跟下面 vdivider 計算同一個公式）
    const divSegCount = verticalDividerCount + 1;
    for (const shelf of shelves) {
      const innerW = shelf.visible.length;
      const divXs: number[] = [];
      for (let d = 0; d < verticalDividerCount; d++) {
        divXs.push(-innerW / 2 + ((d + 1) * innerW) / divSegCount);
      }
      // 切點配對：[stopLeft, divLeft0, divRight0, divLeft1, divRight1, ..., stopRight]
      const cutPoints = [-innerW / 2];
      for (const dx of divXs) {
        cutPoints.push(dx - dividerT / 2, dx + dividerT / 2);
      }
      cutPoints.push(innerW / 2);
      for (let s = 0; s < cutPoints.length / 2; s++) {
        const segLeft = cutPoints[s * 2];
        const segRight = cutPoints[s * 2 + 1];
        const segLen = segRight - segLeft;
        if (segLen < 1) continue;
        const segCx = (segLeft + segRight) / 2;
        const segIdSuffix = verticalDividerCount > 0 ? `-${s + 1}` : "";
        design.parts.push({
          id: `${shelf.id}-bookstop${segIdSuffix}`,
          nameZh: `${shelf.nameZh}後緣擋條${verticalDividerCount > 0 ? ` ${s + 1}` : ""}`,
          material: input.material,
          grainDirection: "length",
          visible: { length: segLen, width: stopT, thickness: stopH },
          origin: {
            x: shelf.origin.x + segCx,
            y: shelf.origin.y + shelf.visible.thickness,
            z: shelf.origin.z + shelf.visible.width / 2 - stopT / 2,
          },
          tenons: [],
          mortises: [],
        });
      }
    }
  }
  // 層板下方加固橫條：防長層板撓彎，後緣（隱藏）/ 前緣（仿英式書櫃面框）/ 雙條
  if (effectiveReinforcement) {
    const reinH = reinforcementHeight;
    const reinT = reinforcementThickness;
    const reinShelves = design.parts.filter(
      (p) =>
        (/shelf-\d+$/.test(p.id) || /-?boundary$/.test(p.id)) &&
        !p.nameZh.includes("抽屜"),
    );
    const positions: ("back" | "front")[] =
      reinforcementPosition === "both" ? ["back", "front"]
      : reinforcementPosition === "front" ? ["front"]
      : ["back"];
    for (const shelf of reinShelves) {
      const halfW = shelf.visible.width / 2;
      // 後緣往內 5mm 避背板（3-9mm 厚）；前緣往內 5mm 視覺收乾淨
      for (const pos of positions) {
        const dz = pos === "back" ? halfW - reinT / 2 - 5 : -halfW + reinT / 2 + 5;
        design.parts.push({
          id: `${shelf.id}-reinforce-${pos}`,
          nameZh: `${shelf.nameZh}加固條（${pos === "back" ? "後" : "前"}）`,
          material: input.material,
          grainDirection: "length",
          visible: { length: shelf.visible.length, width: reinT, thickness: reinH },
          origin: {
            x: shelf.origin.x,
            y: shelf.origin.y - reinH,
            z: shelf.origin.z + dz,
          },
          tenons: [],
          mortises: [],
        });
      }
    }
  }
  // 頂端 cornice 飾條：前緣 + 兩側包邊（傳統線板 ogee 形）
  if (withLedderRail) {
    const corniceH = corniceHeight;
    const corniceD = corniceDepth;
    const overhang = corniceOverhang;
    // 前緣橫條：長 = 全長 + 兩端 overhang，貼住頂面
    design.parts.push({
      id: "cornice-front",
      nameZh: "頂端 cornice 飾條（前）",
      material: input.material,
      grainDirection: "length",
      visible: { length: input.length + 2 * overhang, width: corniceD, thickness: corniceH },
      origin: {
        x: 0,
        y: input.height,
        z: -input.width / 2 - corniceD / 2,
      },
      tenons: [],
      mortises: [],
    });
    // 左右側邊飾條：從前緣延伸到後緣 / 接 45° 斜角
    for (const sx of [-1, 1]) {
      design.parts.push({
        id: `cornice-side-${sx < 0 ? "left" : "right"}`,
        nameZh: `頂端 cornice 飾條（${sx < 0 ? "左" : "右"}）`,
        material: input.material,
        grainDirection: "length",
        visible: { length: corniceD, width: input.width, thickness: corniceH },
        origin: {
          x: sx * (input.length / 2 + overhang - corniceD / 2),
          y: input.height,
          z: 0,
        },
        tenons: [],
        mortises: [],
      });
    }
  }
  // 縱向分隔板：把書櫃內每一格切成 N+1 等份，每片分隔由「相鄰兩片水平板」之間
  // 一段一段插入（避免穿模水平板）。每段獨立 part，沿 X 軸均分。
  if (verticalDividerCount > 0) {
    const allHoriz = design.parts.filter(
      (p) =>
        p.id === "top" || p.id === "bottom" ||
        ((/shelf-\d+$/.test(p.id) || /-?boundary$/.test(p.id)) &&
          !p.nameZh.includes("抽屜") &&
          !p.id.endsWith("-bookstop") &&
          !p.id.includes("-reinforce-")),
    );
    const sorted = [...allHoriz].sort((a, b) => a.origin.y - b.origin.y);
    const dividerT = panelThickness;
    // 用最常見 in-zone shelf 的 length / width / z 當作 X/Z 範圍基準
    // (case top/bottom 跟 shelves 在 X/Z 上一致)
    const refShelf = sorted.find((p) => /shelf-\d+$/.test(p.id)) ?? sorted[0];
    const innerW = refShelf.visible.length;
    const innerD = refShelf.visible.width;
    const refZ = refShelf.origin.z;
    const segCount = verticalDividerCount + 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const lower = sorted[i];
      const upper = sorted[i + 1];
      // 分隔板坐滿層板（不修剪）——bookstop 已切成 N+1 段繞開分隔板。
      // 加固條 (cleat) 在 vd>0 時自動 effectiveReinforcement=false 跳過，所以也不會撞。
      const segYBot = lower.origin.y + lower.visible.thickness;
      const segYTop = upper.origin.y;
      const segH = segYTop - segYBot;
      if (segH < 50) continue;
      for (let d = 0; d < verticalDividerCount; d++) {
        const xCenter = -innerW / 2 + ((d + 1) * innerW) / segCount;
        design.parts.push({
          id: `vdivider-row${i + 1}-${d + 1}`,
          nameZh: `第${i + 1}層直立分隔板 ${d + 1}`,
          material: input.material,
          grainDirection: "length",
          visible: { length: dividerT, width: innerD, thickness: segH },
          origin: { x: xCenter, y: segYBot, z: refZ },
          tenons: [],
          mortises: [],
        });
      }
    }
  }

  applyStandardChecks(design, {
    minLength: 400, minWidth: 200, minHeight: 600,
    maxLength: 1500, maxWidth: 500, maxHeight: 2400,
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
