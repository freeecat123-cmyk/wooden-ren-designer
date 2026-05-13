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
import { applyStandardChecks, validateCabinetStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
  backPanelMaterialOption,
  backPanelMaterialNote,
  pullStyleOption,
  pullStyleNote,
} from "./_helpers";

export const shoeCabinetOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  ...makeZoneOptions({
    // 兩段式鞋櫃：上層開放層板（topCount=2 = 1 片內部層板，一勾斜放就看得到效果）
    // 下層門板藏鞋（bottomCount=2 = 3 格鞋區，每格 ~188mm 一般鞋夠用）；無中層
    topType: "shelves", topHeight: 250, topCount: 2,
    midType: "none", midCount: 0,
    bottomType: "door", bottomHeight: 600, bottomCount: 2,
  }, false, { skipMid: true }),
  { group: "door", type: "select", key: "doorType", label: "門材質", defaultValue: "wood", choices: [
    { value: "wood", label: "木鑲板門（框 + 鑲板）" },
    { value: "slab", label: "夾板貼皮平板門（裝潢常用）" },
    { value: "glass", label: "玻璃門（需配 5mm 強化玻璃）" },
    { value: "louvered", label: "百葉門（通風防鞋臭）" },
  ], dependsOn: ANY_ZONE_IS_DOOR },
  doorMountOption,
  doorFrameRailWidthOption,
  doorFrameThicknessOption,
  drawerMountOption,
  drawerBottomModeOption,
  backModeOption,
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 80, min: 0, max: 400, step: 10, help: "鞋櫃底部通常抬高防潮" },
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
  ...toeKickOptions("structure", { hidden: false }),
  ...crownMoldingOptions("structure", { hidden: false }),
  backPanelMaterialOption("structure"),
  { group: "structure", type: "checkbox", key: "withTopSeatCushion", label: "頂面加坐墊（穿鞋椅）", defaultValue: false, help: "頂面加 30mm 厚軟墊布套，玄關直接坐著穿鞋", wide: true },
  { group: "structure", type: "select", key: "angledRack", label: "斜放鞋格區段", defaultValue: "none", choices: [
    { value: "none", label: "不使用（一般水平層板）" },
    { value: "top", label: "上層改斜放（適合常穿鞋一目了然）" },
    { value: "bottom", label: "下層改斜放" },
    { value: "all", label: "上下都改斜放" },
  ], help: "傳統鞋櫃做法：層板前低後高，鞋頭外露好拿取。需要該區段「類型=開放層板」且層數 ≥ 2 才會生效。" },
  { group: "structure", type: "number", key: "angledRackTilt", label: "斜放角度 (°)", defaultValue: 15, min: 5, max: 25, step: 1, help: "建議 10~18°；角度太大鞋子會滑、太小看不到鞋頭", dependsOn: { key: "angledRack", notIn: ["none"] } },
  pullStyleOption("door"),
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
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const backPanelMaterial = getOption<string>(input, opt(o, "backPanelMaterial"));
  const withTopSeatCushion = getOption<boolean>(input, opt(o, "withTopSeatCushion"));
  const angledRack = getOption<string>(input, opt(o, "angledRack"));
  const angledRackTilt = getOption<number>(input, opt(o, "angledRackTilt"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const resolved = resolveZones(input, o, innerH, doorLabel);
  const { zones, notesLine } = resolved;
  let { warnings } = resolved;
  // 斜放鞋格自動補強：選到的 zone 若非「shelves」或數量 < 2 就強制改 shelves count=2，
  // 否則 zone 沒層板可斜，使用者體驗 = 勾了沒事發生。
  // zones 順序：zones[0] = 下層 (z1), zones[1] = 上層 (z2)
  if (angledRack !== "none" && zones.length >= 2) {
    const autoFixZone = (z: typeof zones[number], label: string) => {
      const fixes: string[] = [];
      if (z.type !== "shelves") {
        fixes.push(`類型從「${z.type === "door" ? "門板" : z.type === "drawer" ? "抽屜" : z.type === "hanging" ? "吊衣" : "空"}」改為「開放層板」`);
        z.type = "shelves";
      }
      if ((z.count ?? 0) < 2) {
        fixes.push(`數量補到 2（原 ${z.count ?? 0}）`);
        z.count = 2;
      }
      if (fixes.length > 0) {
        warnings = [...warnings, `${label}已套用斜放鞋格，自動${fixes.join("、")}。`];
      }
    };
    if (angledRack === "all" || angledRack === "bottom") autoFixZone(zones[0], "下層");
    if (angledRack === "all" || angledRack === "top") autoFixZone(zones[1], "上層");
  }

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
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "round" | "round-tapered",
    legInset,
    doorMount,
    doorFrameRailWidth: getOption<number>(input, opt(o, "doorFrameRailWidth")),
    doorFrameThickness: getOption<number>(input, opt(o, "doorFrameThickness")),
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    pullStyle,
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）${legHeight > 0 ? `；加 ${legHeight}mm 底座腳（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}` : ""}。${pullStyleNote(pullStyle)} ${doorType === "louvered" ? "百葉門：門板開水平百葉條（葉片厚 8mm、間距 15mm、傾斜 25°），通風散濕防鞋臭。" : ""} ${withTopSeatCushion ? "頂面加 30mm 厚海綿坐墊 + 布套（魔鬼氈固定），玄關穿鞋椅功能。" : ""} ${toeKickNote(withToeKick, toeKickHeight, toeKickRecess)} ${crownMoldingNote(withCrownMolding, crownProjection)} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
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

  // 踢腳板：底部前緣加一條向後內凹的板，腳趾不撞櫃。需要 legHeight = 0
  // （腳款若 plinth/panel-side 自身就有底，再加踢腳板會重複，故跳過）。
  if (withToeKick && legHeight === 0 && legShape !== "plinth" && legShape !== "panel-side") {
    const toeKickPlateT = 12; // 踢腳板厚度（plywood / pine 薄板皆可）
    design.parts.push({
      id: "toe-kick",
      nameZh: "踢腳板",
      material: input.material,
      grainDirection: "length",
      visible: { length: input.length, width: toeKickPlateT, thickness: toeKickHeight },
      // 沿前緣內凹 toeKickRecess mm，板厚 toeKickPlateT，置於離地 0 ~ toeKickHeight
      origin: {
        x: 0,
        y: toeKickHeight / 2,
        z: -input.width / 2 + toeKickRecess + toeKickPlateT / 2,
      },
      tenons: [],
      mortises: [],
    });
  } else if (withToeKick && legHeight > 0) {
    appendWarnings(design, [
      `已勾選踢腳板但底座腳高 ${legHeight}mm > 0：踢腳板會與底座腳重複，請將底座腳高設為 0。`,
    ]);
  }

  // 頂部冠飾線：頂面外圍加 4 條外伸線板（前/後/左/右）。截面 H 高 × 外伸 P 厚。
  // 高度暫用 40mm（標準冠飾線常見尺寸），靠近 ogee/cove profile 視覺感
  if (withCrownMolding) {
    const crownH = 40;
    const P = crownProjection;
    const topY = input.height + crownH / 2;
    const crownParts: Array<{
      id: string;
      nameZh: string;
      length: number;
      width: number;
      x: number;
      z: number;
    }> = [
      { id: "crown-front", nameZh: "冠飾線（前）", length: input.length + 2 * P, width: P, x: 0, z: -input.width / 2 - P / 2 },
      { id: "crown-back", nameZh: "冠飾線（後）", length: input.length + 2 * P, width: P, x: 0, z: input.width / 2 + P / 2 },
      { id: "crown-left", nameZh: "冠飾線（左）", length: P, width: input.width, x: -input.length / 2 - P / 2, z: 0 },
      { id: "crown-right", nameZh: "冠飾線（右）", length: P, width: input.width, x: input.length / 2 + P / 2, z: 0 },
    ];
    for (const cp of crownParts) {
      design.parts.push({
        id: cp.id,
        nameZh: cp.nameZh,
        material: input.material,
        grainDirection: "length",
        visible: { length: cp.length, width: cp.width, thickness: crownH },
        origin: { x: cp.x, y: topY, z: cp.z },
        tenons: [],
        mortises: [],
      });
    }
  }

  // 斜放鞋格：將指定 zone 的層板向前傾斜（rake = rotation.x），前緣下沉，
  // 鞋頭朝外好拿取；同時在前緣加 20×25mm 止擋條防止鞋子滑出。
  // 鞋櫃 zones：z1 = 下層 (bottom)、z2 = 上層 (top)
  if (angledRack !== "none") {
    const tiltRad = (angledRackTilt * Math.PI) / 180;
    const targetPrefixes =
      angledRack === "all" ? ["z1", "z2"]
      : angledRack === "top" ? ["z2"]
      : angledRack === "bottom" ? ["z1"]
      : [];
    const battenT = 20; // 止擋條截面深度（front-back）
    const battenH = 25; // 止擋條截面高度（vertical）
    const shelfIdsHit: string[] = [];
    const tiltedParts: typeof design.parts = [];
    for (const part of design.parts) {
      const inTarget = targetPrefixes.some((p) => part.id.startsWith(`${p}-`));
      const isInternalShelf = /-shelf-\d+$/.test(part.id);
      if (!inTarget || !isInternalShelf) continue;
      // rake：負值讓前緣（-Z 方向）下沉
      part.rotation = { x: -tiltRad, y: 0, z: 0 };
      part.nameZh = part.nameZh.replace("層板", "斜放鞋板");
      shelfIdsHit.push(part.id);
      tiltedParts.push(part);
    }
    // 為每片斜板配一條前緣止擋條：跟斜板共平面 + 同樣 rotation。
    // 在斜板局部座標：batten 中心在 (0, +t/2 + bh/2, -w/2 + bt/2)
    //   = 「板的頂面、前緣往內 bt/2」 ← 止擋條坐在板上、前緣對齊
    // 因為板有 rotation.x = -tiltRad，世界座標下這個偏移要也套同 rotation 才會
    // 真的「黏在板上」。否則止擋條只是在原本水平位置，不會跟板一起傾斜。
    const cosT = Math.cos(tiltRad);
    const sinT = Math.sin(tiltRad);
    for (const shelf of tiltedParts) {
      const yLocal = shelf.visible.thickness / 2 + battenH / 2;
      const zLocal = -shelf.visible.width / 2 + battenT / 2;
      // rotation.x = -tiltRad（前緣下沉）的歐拉旋轉公式：
      //   y' = yLocal * cos − zLocal * sin（用 -tilt → cos 不變、sin 變號）
      //   z' = −yLocal * sin + zLocal * cos
      // 帶入 -tilt → y' = yLocal * cosT + zLocal * sinT, z' = -yLocal * sinT + zLocal * cosT
      // 注意：tilt 為正值，rotation.x = -tiltRad
      const dy = yLocal * cosT + zLocal * sinT;
      const dz = -yLocal * sinT + zLocal * cosT;
      design.parts.push({
        id: `${shelf.id}-stop`,
        nameZh: `${shelf.nameZh} 止擋條`,
        material: input.material,
        grainDirection: "length",
        visible: { length: shelf.visible.length, width: battenT, thickness: battenH },
        origin: {
          x: shelf.origin.x,
          y: shelf.origin.y + dy,
          z: shelf.origin.z + dz,
        },
        rotation: { x: -tiltRad, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
    if (shelfIdsHit.length === 0) {
      appendWarnings(design, [
        `斜放鞋格已勾選但所選區段沒有層板可斜放：請將該區段「類型」設為「開放層板」且「數量 ≥ 2」。`,
      ]);
    } else {
      design.notes = `${design.notes ?? ""} 斜放鞋格 ${angledRackTilt}°：${shelfIdsHit.length} 片層板前緣下沉，前緣加 ${battenT}×${battenH}mm 止擋條。`.trim();
    }
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
  // 鞋層淨高 ergo：每層 < 170mm 高跟鞋放不下，> 350mm 太浪費；建議 190-280mm
  // 從 zones 計算每個 shelves zone 的每層淨高（heightMm / count）
  for (const z of zones) {
    const c = z.count ?? 0;
    if (z.type === "shelves" && c > 0) {
      const perShelf = (z.heightMm - c * panelThickness) / (c + 1);
      if (perShelf < 170) {
        appendWarnings(design, [`鞋櫃層板每層淨高 ${Math.round(perShelf)}mm 偏矮：高跟鞋 / 短靴需 ≥ 190mm，建議減少層板數或加大區段高度。`]);
        break;
      }
    }
  }
  if (input.height > 2000 || input.length > 1500) {
    appendSuggestion(design, {
      text: `${input.length}×${input.height}mm 已超過鞋櫃常規——衣櫃模板支援大尺寸玄關櫃。`,
      suggestedCategory: "wardrobe",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
