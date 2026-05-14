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
  doorPullStyleOption,
} from "./_helpers";

export const shoeCabinetOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  // 單一收納區（不分上下層）：類型 + 數量。topType/topCount 這個 key 名是
  // 為了沿用既有 ANY_ZONE_IS_DOOR 條件 + 共用 door / drawer 子選項。
  // 分上下層 toggle：勾起 = 加上層；取消 = 整個櫃單一收納區（只剩下層 = 全櫃）
  { group: "structure", type: "checkbox", key: "withUpperZone", label: "分上下層（上層+下層獨立配置）", defaultValue: true, wide: true, help: "勾起：上層放小物/抽屜、下層放鞋。取消：整個櫃內單一收納區（無上層）" },
  // ── 上層：upper* 全屬 zone-top，手機 AdvancedSheet 會自動歸到「▲ 上層」section
  { group: "zone-top", type: "number", key: "upperHeight", label: "上層高度 (mm)", defaultValue: 220, min: 80, max: 600, step: 10, help: "上層 zone 的垂直空間，建議 180~260mm 給薄抽屜或小物收納", dependsOn: { key: "withUpperZone", equals: true } },
  { group: "zone-top", type: "select", key: "upperType", label: "上層類型", defaultValue: "drawer", choices: [
    { value: "drawer", label: "抽屜" },
    { value: "door", label: "門板" },
    { value: "shelves", label: "開放層板" },
  ], dependsOn: { key: "withUpperZone", equals: true } },
  { group: "zone-top", type: "number", key: "upperCount", label: "上層 數量", defaultValue: 1, min: 1, max: 4, step: 1, help: "抽屜=排數 / 門=扇數 / 層板=層數", dependsOn: { key: "withUpperZone", equals: true } },
  { group: "zone-top", type: "number", key: "upperCols", label: "上層 列數（左右分）", defaultValue: 2, min: 1, max: 4, step: 1, dependsOn: { all: [{ key: "withUpperZone", equals: true }, { key: "upperType", equals: "drawer" }] } },
  { group: "zone-top", type: "number", key: "upperDoorShelves", label: "上層 門後藏層板數", defaultValue: 0, min: 0, max: 3, step: 1, dependsOn: { all: [{ key: "withUpperZone", equals: true }, { key: "upperType", equals: "door" }] } },
  // ── 下層（主鞋櫃 / 單一收納區時就是整櫃）：top* 全屬 zone-bot
  // topType/topCount 這個 key 名是為了沿用既有 ANY_ZONE_IS_DOOR 條件 + 共用 door / drawer 子選項。
  { group: "zone-bot", type: "select", key: "topType", label: "類型", defaultValue: "door", choices: [
    { value: "door", label: "門板（藏鞋）" },
    { value: "shelves", label: "開放層板（直放 / 斜放鞋格）" },
    { value: "drawer", label: "抽屜" },
  ] },
  // 「數量」依類型拆 3 個 entry，label 隨類型變（避免跟「門內層板數」搞混）。
  // 三個 entry 同 key=topCount，dependsOn 隔開，UI 只顯示符合當前類型的那個。
  { group: "zone-bot", type: "number", key: "topCount", label: "門扇數", defaultValue: 2, min: 1, max: 8, step: 1, help: "雙開門=2、單門=1、多扇=3 以上", dependsOn: { key: "topType", equals: "door" } },
  { group: "zone-bot", type: "number", key: "topCount", label: "層板層數", defaultValue: 2, min: 1, max: 8, step: 1, help: "1=空櫃、2=1 片中板、3=2 片中板…", dependsOn: { key: "topType", equals: "shelves" } },
  { group: "zone-bot", type: "number", key: "topCount", label: "抽屜排數", defaultValue: 2, min: 1, max: 8, step: 1, help: "上下幾排抽屜", dependsOn: { key: "topType", equals: "drawer" } },
  { group: "zone-bot", type: "number", key: "topCols", label: "抽屜列數（左右分）", defaultValue: 1, min: 1, max: 4, step: 1, dependsOn: { key: "topType", equals: "drawer" } },
  { group: "zone-bot", type: "number", key: "topDoorShelves", label: "門後藏層板數", defaultValue: 0, min: 0, max: 6, step: 1, help: "關門時門板後面藏的層板（0=全空）。勾斜放鞋格時這裡 ≥ 1 才看得到斜板。", dependsOn: { key: "topType", equals: "door" } },
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
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 80, min: 0, max: 400, step: 10, help: "鞋櫃底部通常抬高防潮。鎖定總高時自動算", dependsOn: { key: "lockTotalHeight", equals: false } },
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
  { group: "structure", type: "checkbox", key: "lockTotalHeight", label: "🔒 鎖定總高（餘量自動放腳）", defaultValue: false, help: "勾起：上層 / 下層高度都明確設、總高扣掉後的餘量自動成腳高（最少 30mm，太小會警告）。未勾：腳高直接設、下層自動吃剩（原本行為）", wide: true },
  { group: "zone-bot", type: "number", key: "lowerHeight", label: "下層高度 (mm)", defaultValue: 600, min: 200, max: 1500, step: 10, help: "只在鎖定總高時用到；放鞋的主收納區高度", dependsOn: { key: "lockTotalHeight", equals: true } },
  { group: "structure", type: "checkbox", key: "angledRack", label: "斜放鞋格（前低後高、鞋頭外露）", defaultValue: false, help: "傳統鞋櫃做法：層板前緣下沉、鞋頭朝外好拿取，前緣加止擋條防滑。只在類型=開放層板時生效。", wide: true },
  { group: "structure", type: "number", key: "angledRackTilt", label: "斜放角度 (°)", defaultValue: 15, min: 5, max: 25, step: 1, help: "建議 10~18°；角度太大鞋子會滑、太小看不到鞋頭", dependsOn: { key: "angledRack", equals: true } },
  pullStyleOption("door"),
  doorPullStyleOption("door"),
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
  const doorPullStyleRaw = getOption<string>(input, opt(o, "doorPullStyle"));
  const doorPullStyle = !doorPullStyleRaw || doorPullStyleRaw === "inherit" ? pullStyle : doorPullStyleRaw;

  // 主（下）收納區：吃 topType/topCount/topCols/topDoorShelves
  const zoneType = getOption<string>(input, opt(o, "topType")) as CabinetZone["type"];
  let zoneCount = getOption<number>(input, opt(o, "topCount"));
  const zoneCols = getOption<number>(input, opt(o, "topCols"));
  const doorInnerShelves = getOption<number>(input, opt(o, "topDoorShelves"));
  // 上層收納區：withUpperZone checkbox 控制；勾起才 build zone
  const withUpperZone = getOption<boolean>(input, opt(o, "withUpperZone"));
  const upperHeight = getOption<number>(input, opt(o, "upperHeight"));
  const upperType = getOption<string>(input, opt(o, "upperType")) as CabinetZone["type"];
  const upperCount = getOption<number>(input, opt(o, "upperCount"));
  const upperCols = getOption<number>(input, opt(o, "upperCols"));
  const upperDoorShelves = getOption<number>(input, opt(o, "upperDoorShelves"));
  const hasUpper = withUpperZone;
  const lockTotalHeight = getOption<boolean>(input, opt(o, "lockTotalHeight"));
  const lowerHeightExplicit = getOption<number>(input, opt(o, "lowerHeight"));
  // case-furniture stack 邏輯：zones[i].heightMm 已包含 boundary 板（非最上層
  // 那 zone 的 heightMm = usableH + shelfT，shelfT 從 heightMm 頂部扣出當 boundary）。
  // → 總和 sum(heightMm) = innerH，不要重複扣 boundary。
  const lockWarnings: string[] = [];
  let effectiveLegHeight = legHeight;
  let innerHTotal: number;
  let mainHeight: number;
  if (lockTotalHeight) {
    // 鎖定模式：上層 + 下層使用者明確設，腳吃餘量
    const upperSum = hasUpper ? upperHeight : 0;
    innerHTotal = upperSum + lowerHeightExplicit;
    mainHeight = lowerHeightExplicit;
    const computedLegH = input.height - innerHTotal - 2 * panelThickness;
    if (computedLegH < 30) {
      lockWarnings.push(
        `鎖定總高：${hasUpper ? `上層 ${upperHeight} + ` : ""}下層 ${lowerHeightExplicit} = ${innerHTotal}mm + 板厚 (2×${panelThickness}) 已超過總高 ${input.height}mm，腳高夾在最低 30mm。`,
      );
      effectiveLegHeight = 30;
    } else {
      effectiveLegHeight = computedLegH;
    }
  } else {
    innerHTotal = input.height - legHeight - 2 * panelThickness;
    mainHeight = hasUpper ? innerHTotal - upperHeight : innerHTotal;
  }
  // tilt cap 算 layerH 用主 zone usable 高（扣掉內含的 boundary），不是整個 innerH
  const innerH = hasUpper ? mainHeight - panelThickness : mainHeight;
  const warnings: string[] = [...lockWarnings];
  // 斜放鞋格：對開放層板 / 門內藏層板都生效（門板 + 斜板 = 玄關穿鞋櫃常見做法）。
  // 抽屜不適用（抽屜沒有層板可斜）。
  const angledRackActive =
    angledRack && (zoneType === "shelves" || zoneType === "door");
  // shelves 模式 count=1 = 空櫃沒層板可斜 → 補到 2（zoneCount 改 let）
  if (angledRackActive && zoneType === "shelves" && zoneCount < 2) {
    warnings.push(`已套用斜放鞋格，自動將數量從 ${zoneCount} 補到 2（1 層 = 空櫃，沒有層板可斜放）。`);
    zoneCount = 2;
  }
  // door 模式 doorInnerShelves=0 = 沒層板 → 尊重使用者選擇，斜放本次無作用，只 warn
  if (angledRackActive && zoneType === "door" && doorInnerShelves === 0) {
    warnings.push(`勾了斜放鞋格但「門後藏層板數」為 0 → 沒層板可斜。要看斜板請把「門後藏層板數」設 ≥ 1。`);
  }
  // zones bottom-up: zones[0]=主（下）區，zones[1]=上層（hasUpper 才加）
  const zones: CabinetZone[] = [
    {
      type: zoneType,
      heightMm: mainHeight,
      count: zoneCount,
      cols: zoneCols,
      doorInnerShelves,
    },
  ];
  if (hasUpper) {
    zones.push({
      type: upperType,
      heightMm: upperHeight,
      count: upperCount,
      cols: upperCols,
      doorInnerShelves: upperDoorShelves,
    });
  }
  const doorLabel =
    doorType === "wood" ? "木" : doorType === "slab" ? "平板" : "玻璃";
  const describeZone = (
    t: CabinetZone["type"],
    count: number,
    cols: number,
    innerShelves: number,
  ) =>
    t === "shelves"
      ? `${count} 層開放層板（${Math.max(0, count - 1)} 片中板）`
      : t === "drawer"
        ? `${count}×${cols} 抽屜`
        : t === "door"
          ? `${count} 扇${doorLabel}門${innerShelves > 0 ? `（內藏 ${innerShelves} 片層板）` : ""}`
          : "空櫃";
  const mainLabel = describeZone(zoneType, zoneCount, zoneCols, doorInnerShelves);
  const upperLabel = hasUpper
    ? describeZone(upperType, upperCount, upperCols, upperDoorShelves)
    : "";
  const notesLine = hasUpper
    ? `下層：${mainLabel}；上層：${upperLabel}`
    : `單格收納：${mainLabel}`;

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
  if (angledRackActive) {
    // 自動上限 tilt：傾斜後層板垂直跨度 (shelfD*sinθ + shelfT*cosθ) 撞鄰層
    // 是「斜板超出框內」的元凶。留 2*panelT 隔離 → 保守用 cosθ≈1：
    //   sinθ ≤ (layerH - 3*panelT) / shelfD
    const shelfDApprox =
      design.parts.find((p) => /-shelf-\d+$/.test(p.id))?.visible.width ?? input.width;
    // shelves zone: layers = zoneCount；door zone（門內藏層板）: layers = doorInnerShelves + 1
    const shelfLayerCount =
      zoneType === "door" ? doorInnerShelves + 1 : zoneCount;
    const layerH = innerH / shelfLayerCount;
    const maxSinT = Math.max(0, (layerH - 3 * panelThickness) / shelfDApprox);
    const maxTiltRad = Math.asin(Math.min(1, maxSinT));
    let tiltRad = (angledRackTilt * Math.PI) / 180;
    if (maxTiltRad < 0.05) {
      appendWarnings(design, [
        `層板太密（${shelfLayerCount} 層 × 板深 ${Math.round(shelfDApprox)}mm），任何斜度都會撞到相鄰層 / 頂底板，斜放本次不套用。建議減少層板數或加高櫃高。`,
      ]);
      tiltRad = 0;
    } else if (tiltRad > maxTiltRad) {
      const cappedDeg = Math.max(1, Math.floor((maxTiltRad * 180) / Math.PI));
      appendWarnings(design, [
        `斜放角度從 ${angledRackTilt}° 自動降到 ${cappedDeg}°（避免層板溢出鄰層 / 頂底板）。要更斜：減少層板數或加高櫃高。`,
      ]);
      tiltRad = maxTiltRad;
    }
    const battenT = 20; // 止擋條截面深度（front-back）
    const battenH = 25; // 止擋條截面高度（vertical）
    const shelfIdsHit: string[] = [];
    const tiltedParts: typeof design.parts = [];
    for (const part of design.parts) {
      const isInternalShelf = /-shelf-\d+$/.test(part.id);
      if (!isInternalShelf) continue;
      // tiltRad=0 表示自動 cap 後沒得斜（層板太密）→ skip 整片，但已 warn
      if (tiltRad === 0) continue;
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
