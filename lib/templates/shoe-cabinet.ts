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
  resolveBackMode,
  resolveDoorMount,
  resolveDrawerBottomMode,
  resolveDrawerMount,
  resolveDrawerSlideGap,
} from "./_builders/zone-helpers";
import type { CabinetZone } from "./_builders/case-furniture";
import { applyStandardChecks, validateCabinetStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  backPanelMaterialOption,
  backPanelMaterialNote,
  pullStyleOption,
  pullStyleNote,
} from "./_helpers";

export const shoeCabinetOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  // 單一收納區（不分上下層）：類型 + 數量。topType/topCount 這個 key 名是
  // 為了沿用既有 ANY_ZONE_IS_DOOR 條件 + 共用 door / drawer 子選項。
  { group: "structure", type: "select", key: "topType", label: "類型", defaultValue: "door", choices: [
    { value: "door", label: "門板（藏鞋）" },
    { value: "shelves", label: "開放層板（直放 / 斜放鞋格）" },
    { value: "drawer", label: "抽屜" },
  ] },
  { group: "structure", type: "number", key: "topCount", label: "數量", defaultValue: 2, min: 1, max: 8, step: 1, help: "門板=扇數 / 抽屜=排數 / 開放層板=層數（1=空櫃、2=1 片中板、3=2 片中板…）" },
  { group: "structure", type: "number", key: "topCols", label: "抽屜列數（左右分）", defaultValue: 1, min: 1, max: 4, step: 1, dependsOn: { key: "topType", equals: "drawer" } },
  { group: "structure", type: "number", key: "topDoorShelves", label: "門內層板數", defaultValue: 0, min: 0, max: 6, step: 1, help: "門關起來時內藏的層板數（0=全空）", dependsOn: { key: "topType", equals: "door" } },
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
  backPanelMaterialOption("structure"),
  { group: "structure", type: "checkbox", key: "angledRack", label: "斜放鞋格（前低後高、鞋頭外露）", defaultValue: false, help: "傳統鞋櫃做法：層板前緣下沉、鞋頭朝外好拿取，前緣加止擋條防滑。勾選後會自動把類型補成「開放層板」、數量補到 ≥ 2。", wide: true },
  { group: "structure", type: "number", key: "angledRackTilt", label: "斜放角度 (°)", defaultValue: 15, min: 5, max: 25, step: 1, help: "建議 10~18°；角度太大鞋子會滑、太小看不到鞋頭", dependsOn: { key: "angledRack", equals: true } },
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
  const backPanelMaterial = getOption<string>(input, opt(o, "backPanelMaterial"));
  const angledRack = getOption<boolean>(input, opt(o, "angledRack"));
  const angledRackTilt = getOption<number>(input, opt(o, "angledRackTilt"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));

  const innerH = input.height - legHeight - 2 * panelThickness;
  // 單一收納區（不分上下層）：吃 topType/topCount/topCols/topDoorShelves
  let zoneType = getOption<string>(input, opt(o, "topType")) as CabinetZone["type"];
  let zoneCount = getOption<number>(input, opt(o, "topCount"));
  const zoneCols = getOption<number>(input, opt(o, "topCols"));
  const doorInnerShelves = getOption<number>(input, opt(o, "topDoorShelves"));
  const warnings: string[] = [];
  // 斜放鞋格自動補強：勾了斜放但類型不是 shelves / 數量 < 2 → 自動補正並 warn
  if (angledRack) {
    const fixes: string[] = [];
    if (zoneType !== "shelves") {
      fixes.push(`類型從「${zoneType === "door" ? "門板" : zoneType === "drawer" ? "抽屜" : "其他"}」改為「開放層板」`);
      zoneType = "shelves";
    }
    if (zoneCount < 2) {
      fixes.push(`數量補到 2（原 ${zoneCount}）`);
      zoneCount = 2;
    }
    if (fixes.length > 0) {
      warnings.push(`已套用斜放鞋格，自動${fixes.join("、")}。`);
    }
  }
  const zones: CabinetZone[] = [
    {
      type: zoneType,
      heightMm: innerH,
      count: zoneCount,
      cols: zoneCols,
      doorInnerShelves,
    },
  ];
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const typeLabel =
    zoneType === "shelves"
      ? `${zoneCount} 層開放層板（${Math.max(0, zoneCount - 1)} 片內部層板）`
      : zoneType === "drawer"
        ? `${zoneCount}×${zoneCols} 抽屜`
        : zoneType === "door"
          ? `${zoneCount} 扇${doorLabel}門${doorInnerShelves > 0 ? `（內藏 ${doorInnerShelves} 片層板）` : ""}`
          : "空櫃";
  const notesLine = `單格收納：${typeLabel}`;

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
    notes: `${notesLine}；門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）${legHeight > 0 ? `；加 ${legHeight}mm 底座腳（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}` : ""}。${pullStyleNote(pullStyle)} ${doorType === "louvered" ? "百葉門：門板開水平百葉條（葉片厚 8mm、間距 15mm、傾斜 25°），通風散濕防鞋臭。" : ""} ${backPanelMaterialNote(backPanelMaterial)}`.trim(),
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
  // 斜放鞋格：將收納區的層板向前傾斜（rake = rotation.x），前緣下沉，
  // 鞋頭朝外好拿取；同時在前緣加 20×25mm 止擋條防止鞋子滑出。
  // 單一 zone：所有 z1-shelf-N 都套用
  if (angledRack) {
    const tiltRad = (angledRackTilt * Math.PI) / 180;
    const battenT = 20; // 止擋條截面深度（front-back）
    const battenH = 25; // 止擋條截面高度（vertical）
    const shelfIdsHit: string[] = [];
    const tiltedParts: typeof design.parts = [];
    for (const part of design.parts) {
      const isInternalShelf = /-shelf-\d+$/.test(part.id);
      if (!isInternalShelf) continue;
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
    if (shelfIdsHit.length > 0) {
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
