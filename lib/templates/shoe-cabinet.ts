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
  resolveBackMode,
  resolveDoorMount,
  resolveDrawerBottomMode,
  resolveDrawerBottomThickness,
  resolveDrawerBoxJoinery,
  resolveDrawerMount,
  resolveDrawerSlideGap,
} from "./_builders/zone-helpers";
import type { CabinetZone } from "./_builders/case-furniture";
import { applyStandardChecks, validateCabinetStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  withLegsOption,
  backPanelPlywoodOption,
  pullStyleOption,
  pullStyleNote,
  doorPullStyleOption,
  computeLockedLegHeight,
} from "./_helpers";

export const shoeCabinetOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚", defaultValue: 18, unit: "mm", min: 9, max: 35, step: 1 },
  // 單一收納區（不分上下層）：類型 + 數量。topType/topCount 這個 key 名是
  // 為了沿用既有 ANY_ZONE_IS_DOOR 條件 + 共用 door / drawer 子選項。
  // 分上下層 toggle：勾起 = 加上層；取消 = 整個櫃單一收納區（只剩下層 = 全櫃）
  { group: "structure", type: "checkbox", key: "withUpperZone", label: "分上下層（上層+下層獨立配置）", defaultValue: true, wide: true, help: "勾起：上層放小物/抽屜、下層放鞋。取消：整個櫃內單一收納區（無上層）" },
  // ── 上層：upper* 全屬 zone-top，手機 AdvancedSheet 會自動歸到「▲ 上層」section
  { group: "zone-top", type: "number", key: "upperHeight", label: "上層高度", defaultValue: 220, unit: "mm", min: 80, max: 600, step: 10, help: "上層 zone 的垂直空間，建議 180~260mm 給薄抽屜或小物收納", dependsOn: { key: "withUpperZone", equals: true } },
  { group: "zone-top", type: "select", key: "upperType", label: "上層類型", defaultValue: "drawer", choices: [
    { value: "drawer", label: "抽屜" },
    { value: "door", label: "門板" },
    { value: "shelves", label: "開放層板" },
  ], dependsOn: { key: "withUpperZone", equals: true } },
  // 「上層 數量」依類型拆 3 個 entry（同 key=upperCount，dependsOn 隔開）。
  // 門扇數上限 2（單門 / 雙開門）；抽屜排數 / 層板層數仍可到 4。
  { group: "zone-top", type: "number", key: "upperCount", label: "上層 門扇數", defaultValue: 1, min: 1, max: 2, step: 1, help: "雙開門=2、單門=1", dependsOn: { all: [{ key: "withUpperZone", equals: true }, { key: "upperType", equals: "door" }] } },
  { group: "zone-top", type: "number", key: "upperCount", label: "上層 抽屜排數", defaultValue: 1, min: 1, max: 4, step: 1, help: "上下幾排抽屜", dependsOn: { all: [{ key: "withUpperZone", equals: true }, { key: "upperType", equals: "drawer" }] } },
  { group: "zone-top", type: "number", key: "upperCount", label: "上層 層板層數", defaultValue: 1, min: 1, max: 4, step: 1, help: "1=空櫃、2=1 片中板…", dependsOn: { all: [{ key: "withUpperZone", equals: true }, { key: "upperType", equals: "shelves" }] } },
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
  { group: "zone-bot", type: "number", key: "topCount", label: "門扇數", defaultValue: 2, min: 1, max: 2, step: 1, help: "雙開門=2、單門=1", dependsOn: { key: "topType", equals: "door" } },
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
  drawerBottomThicknessOption,
  drawerBoxJoineryOption,
  backModeOption,
  withLegsOption,
  backPanelPlywoodOption,
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高", defaultValue: 80, unit: "mm", min: 0, max: 400, step: 10, help: "鞋櫃底部通常抬高防潮。鎖定總高時自動算", dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "lockTotalHeight", equals: false }] } },
  { group: "leg", type: "number", key: "legSize", label: "腳粗", defaultValue: 35, unit: "mm", min: 20, max: 120, step: 5, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳（方料）" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座" },
    { value: "panel-side", label: "側板延伸落地" },
    { value: "full-depth-panel", label: "整深度板腳（可調左右內縮）" },
  ] , dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮", defaultValue: 0, unit: "mm", min: 0, max: 300, step: 5, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  drawerSlideOption,
  { group: "structure", type: "checkbox", key: "lockTotalHeight", label: "🔒 鎖定總高（餘量自動放腳）", defaultValue: false, help: "勾起：上層 / 下層高度都明確設、總高扣掉後的餘量自動成腳高（最少 30mm，太小會警告）。未勾：腳高直接設、下層自動吃剩（原本行為）", wide: true },
  { group: "zone-bot", type: "number", key: "lowerHeight", label: "下層高度", defaultValue: 600, unit: "mm", min: 200, max: 1500, step: 10, help: "只在鎖定總高時用到；放鞋的主收納區高度（不分上下層時 = 整個內部高度）。上層高度請用「上層高度」欄位設定", dependsOn: { key: "lockTotalHeight", equals: true } },
  { group: "structure", type: "checkbox", key: "angledRack", label: "斜放鞋格（前低後高、鞋頭外露）", defaultValue: false, help: "傳統鞋櫃做法：層板前緣下沉、鞋頭朝外好拿取，前緣加止擋條防滑。只在類型=開放層板時生效。", wide: true },
  { group: "structure", type: "number", key: "angledRackTilt", label: "斜放角度 (°)", defaultValue: 15, min: 5, max: 25, step: 1, help: "建議 10~18°；角度太大鞋子會滑、太小看不到鞋頭", dependsOn: { key: "angledRack", equals: true } },
  pullStyleOption("door"),
  doorPullStyleOption("door"),
];

export const shoeCabinet: FurnitureTemplate = (input) => {
  const locale = input.locale ?? "zh-TW";
  const isEn = locale === "en";
  const o = shoeCabinetOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const doorType = getOption<string>(input, opt(o, "doorType"));
  const withLegsShoe = getOption<boolean>(input, opt(o, "withLegs"));
  const legHeight = withLegsShoe === false ? 0 : getOption<number>(input, opt(o, "legHeight"));
  const backPanelPlywood = getOption<boolean>(input, opt(o, "backPanelPlywood"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const doorMount = resolveDoorMount(input, o);
  const drawerMount = resolveDrawerMount(input, o);
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
  let upperCount = getOption<number>(input, opt(o, "upperCount"));
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
    const userInnerH = upperSum + lowerHeightExplicit;
    const { exceeded, effectiveLegHeight: ehL, maxInnerH } = computeLockedLegHeight(
      input.height, userInnerH, panelThickness,
    );
    effectiveLegHeight = ehL;
    if (exceeded) {
      // 超量 → 腳夾 30，innerH 縮到容量上限，下層按比例縮
      lockWarnings.push(
        `鎖定總高：${hasUpper ? `上層 ${upperHeight} + ` : ""}下層 ${lowerHeightExplicit} = ${userInnerH}mm + 板厚 (2×${panelThickness}) 已超過總高 ${input.height}mm，腳高夾 30mm，內高縮到 ${maxInnerH}mm，下層自動裁切。`,
      );
      innerHTotal = maxInnerH;
      mainHeight = hasUpper ? Math.max(80, maxInnerH - upperHeight) : maxInnerH;
    } else {
      innerHTotal = userInnerH;
      mainHeight = lowerHeightExplicit;
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
  // 門扇數上限 2（單門 / 雙開門）。3 扇以上鞋櫃寬度分不實用，且門把無法落在豎梃。
  // OptionSpec max 已限 2，這裡夾限防呆舊 URL / 風格變體寫進來的過大值。
  if (zoneType === "door" && zoneCount > 2) {
    warnings.push(`門扇數上限為 2（單門 / 雙開門），已從 ${zoneCount} 修正為 2。`);
    zoneCount = 2;
  }
  if (upperType === "door" && upperCount > 2) {
    warnings.push(`上層門扇數上限為 2，已從 ${upperCount} 修正為 2。`);
    upperCount = 2;
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
    backPanelMaterial: backPanelPlywood ? "plywood" : "inherit",
    legHeight: effectiveLegHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "full-depth-panel" | "round" | "round-tapered",
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
    notes: (isEn
      ? `${notesLine}; door: ${doorMountLabel(doorMount)} (Euro hinge ${doorMount === "inset" ? "inset" : doorMount === "overlay-3" ? "half-overlay" : "full-overlay"})${effectiveLegHeight > 0 ? `; ${Math.round(effectiveLegHeight)}mm base legs (${legShape})${legInset > 0 ? `, inset ${legInset}mm` : ""}${lockTotalHeight ? " (auto-calc from locked total height)" : ""}` : ""}. ${pullStyleNote(pullStyle, locale)} ${doorType === "louvered" ? "Louvered door: horizontal slats cut in panel (8mm slat thickness, 15mm spacing, 25° tilt) for ventilation against shoe odor." : ""}`
      : `${notesLine}；門板：${doorMountLabel(doorMount)}（西德鉸鏈${doorMount === "inset" ? "入柱型" : doorMount === "overlay-3" ? "半蓋" : "全蓋"}）${effectiveLegHeight > 0 ? `；加 ${Math.round(effectiveLegHeight)}mm 底座腳（${legShape}）${legInset > 0 ? `，內縮 ${legInset}mm` : ""}${lockTotalHeight ? "（鎖定總高自動算）" : ""}` : ""}。${pullStyleNote(pullStyle, locale)} ${doorType === "louvered" ? "百葉門：門板開水平百葉條（葉片厚 8mm、間距 15mm、傾斜 25°），通風散濕防鞋臭。" : ""}`
    ).trim(),
    warnings,
  });
  // 百葉門：把每片門的木鑲板換成「N 片橫向實心百葉條」（真實葉片，非裝飾凹槽）。
  // 框（橫檔 + 豎梃）由 caseFurniture 已建好、保留；只把 -panel 換成葉片群。
  // 葉片沿門寬橫放（rotation 同橫檔的單軸 X 旋轉），嵌在框內開口、上下均分。
  if (doorType === "louvered") {
    const grooveDepth = 8;   // caseFurniture 門框鑲板槽深，用來推算框內開口
    const slatThick = 6;     // 葉片厚＝豎梃斜槽寬；25° 斜槽在門厚 22 內的鉛直跨度
                             // = faceH·sin25+thick·cos25，thick 9→6 把跨度 19→16、
                             // 槽到料面留 ~2.8mm 壁（原 1.4mm 快破邊，user 回報）
    const slatPitch = 30;    // 葉片中心間距
    const slatFaceH = 26;    // 葉片面寬（傾斜後鉛直投影 ≈27mm < pitch → 不互疊）
    // 葉片繞自身長軸（part-local X）傾斜 25°；疊在門板基準 X 旋轉上仍為單軸。
    const slatTiltRad = (25 * Math.PI) / 180;
    const louverPanels = design.parts.filter(
      (p) => p.id.endsWith("-panel") && p.id.includes("-door-") && !p.id.includes("-door-inner"),
    );
    for (const panel of louverPanels) {
      // 葉片長度 = 原木鑲板全寬（panelOuterW）：整片直接卡進左右豎梃凹槽
      // （兩端各埋 grooveDepth），不另做榫。跟原本木鑲板入框做法一致。
      // 葉片入豎梃槽（panel 全寬、兩端各埋 grooveDepth）＝真實接合、無端面縫隙。
      // （葉片端跟豎梃的互穿白點靠 3D 材質 polygonOffset 把葉片壓後讓豎梃遮住，
      //  見 PerspectiveView：百葉葉片 polygonOffset 大值。）
      const slatLen = panel.visible.length;
      const openH = panel.visible.width - 2 * grooveDepth;  // 框內開口高
      const openBottomY = panel.origin.y + grooveDepth;
      const count = Math.max(2, Math.floor(openH / slatPitch));
      const margin = (openH - count * slatPitch) / 2;
      const idBase = panel.id.replace(/-panel$/, "");
      const baseName = panel.nameZh.replace(/木鑲板$/, "");
      // 兩側豎梃：每片葉片兩端嵌進豎梃內側的斜槽。原本只生葉片、豎梃完全沒槽
      // → 零件圖看不到葉片榫孔（user 回報）。在豎梃 local 座標補 cosmetic 斜槽：
      //   - origin.x = 內側面（沿用該豎梃既有橫檔榫眼的 x，已驗證落在內緣）
      //   - origin.z = 葉片世界高 − 豎梃中心高（豎梃 width=門高、mortise.z 沿此軸）
      //   - length(沿門高) = 葉片面寬、width(沿門厚) = 葉片厚、depth = 凹槽深
      //   - rotX = 葉片傾角（CSG cut box 跟著葉片斜 25°）
      const stiles = [
        design.parts.find((p) => p.id === `${idBase}-stile-left`),
        design.parts.find((p) => p.id === `${idBase}-stile-right`),
      ].filter((p): p is NonNullable<typeof p> => p != null);
      for (let r = 0; r < count; r++) {
        const slatY =
          openBottomY + margin + r * slatPitch + (slatPitch - slatFaceH) / 2;
        design.parts.push({
          id: `${idBase}-louver-${r + 1}`,
          nameZh: `${baseName}百葉條`,
          nameEn: `${panel.nameEn ?? "Panel"} louver ${r + 1}`,
          material: panel.material,
          grainDirection: "length",
          visible: { length: slatLen, width: slatFaceH, thickness: slatThick },
          origin: { x: panel.origin.x, y: slatY, z: panel.origin.z },
          rotation: { x: Math.PI / 2 + slatTiltRad, y: 0, z: 0 },
          // 葉片兩短邊（厚度向 6mm 邊）倒圓＝百葉慣例 bullnose（非方角）；
          // chamferMm = 厚/2 把 6mm 短邊磨成半圓，截面成跑道形（user 回報）。
          shape: { kind: "chamfered-edges", chamferMm: slatThick / 2, style: "rounded" },
          tenons: [],
          mortises: [],
        });
        for (const stile of stiles) {
          // 內側面 x：沿用既有橫檔榫眼 x（落在面向門心的內緣）；無則由幾何推算
          const innerX =
            stile.mortises[0]?.origin.x ??
            Math.sign(panel.origin.x - stile.origin.x) *
              (stile.visible.length / 2 - grooveDepth / 2);
          const stileCenterY = stile.origin.y + stile.visible.width / 2;
          const tiltDeg = Math.round((slatTiltRad * 180) / Math.PI);
          stile.mortises.push({
            // origin.y 是 from-bottom（零件底面起算）→ 槽要落在板厚中央＝thickness/2
            // （葉片在門厚中段，槽置中料厚；y:0 會貼底面、零件圖偏下一邊 user 回報）
            // z 要對齊葉片「中心高」＝slatY(葉片底origin.y)+slatFaceH/2，非葉片底；
            // 用 slatY 會讓整排槽偏 −slatFaceH/2、最頂端空出半葉空格（user「最右邊空一格」）。
            origin: {
              x: innerX,
              y: stile.visible.thickness / 2,
              z: slatY + slatFaceH / 2 - stileCenterY,
            },
            depth: grooveDepth,
            length: slatFaceH,
            width: slatThick,
            through: false,
            cosmetic: true,
            rotX: slatTiltRad,
            label: `百葉槽${tiltDeg}°`,
          });
        }
      }
    }
    // 移除原本的實心木鑲板（已被百葉條群取代）
    const louverPanelIds = new Set(louverPanels.map((p) => p.id));
    design.parts = design.parts.filter((p) => !louverPanelIds.has(p.id));
  }
  // 斜放鞋格：將「主（下）收納區」的層板向前傾斜（rake = rotation.x），前緣下沉，
  // 鞋頭朝外好拿取；同時在前緣加 20×25mm 止擋條防止鞋子滑出。
  // 主 zone id prefix = z1（shelves: z1-shelf-N；門內藏層板: z1-door-inner-shelf-N）
  // 必須限定 z1-，否則 hasUpper + 上層 shelves/門內藏層板（z2-*）會被誤斜。
  const isMainShelf = (id: string) =>
    /^z1-shelf-\d+$/.test(id) || /^z1-door-inner-shelf-\d+$/.test(id);
  if (angledRackActive) {
    // 自動上限 tilt：傾斜後層板垂直跨度 (shelfD*sinθ + shelfT*cosθ) 撞鄰層
    // 是「斜板超出框內」的元凶。留 2*panelT 隔離 → 保守用 cosθ≈1：
    //   sinθ ≤ (layerH - 3*panelT) / shelfD
    const shelfDApprox =
      design.parts.find((p) => isMainShelf(p.id))?.visible.width ?? input.width;
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
      if (!isMainShelf(part.id)) continue;
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
        nameEn: `${shelf.nameEn ?? "Shelf"} stop bar`,
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
    }, input.locale),
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
      text:
        input.locale === "en"
          ? `${input.length}×${input.height} mm is past typical shoe-cabinet sizing — the wardrobe template handles large entry cabinets.`
          : `${input.length}×${input.height}mm 已超過鞋櫃常規——衣櫃模板支援大尺寸玄關櫃。`,
      suggestedCategory: "wardrobe",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
