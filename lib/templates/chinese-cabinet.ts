import type { FurnitureDesign, FurnitureTemplate, OptionSpec, Part } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { applyStandardChecks } from "./_validators";

/**
 * 中式方角櫃（Chinese square-corner cabinet）
 *
 * 結構：明清家具典型「邊抹板心」做法（frame-and-panel）。
 * - 4 立柱（角柱）：4 隻方料貫穿全高，當每一面的左右邊柱
 * - 每一面（左/右側、背面、門面）= 上抹 + 下抹 + 板心（嵌入框內側槽）
 *   立柱本身充當邊柱，不另畫
 * - 頂蓋：1 片實木板，邊緣略外伸
 * - 底框：4 條底抹圍成底箱，承層板
 * - 牙條：直線素牙，封底框下緣
 * - 內部水平層板（dividers）依 layerCount-1 排列
 * - 每層功用可設：對開門 / 抽屜 / 開放層板
 *
 * 接合：框角全用 shouldered tenon；板心浮放於框內槽（不黏死，
 * 讓木材吐縮不爆裂）；立柱跟頂底抹用通榫 + 暗銷（傳統明式做法）。
 */

const LAYER_TYPE_CHOICES = [
  { value: "door", label: "門（對開）" },
  { value: "drawer", label: "抽屜" },
  { value: "shelf", label: "開放層板" },
];

export const chineseCabinetOptions: OptionSpec[] = [
  // 立柱
  { group: "leg", type: "number", key: "postSize", label: "立柱粗 (mm)", defaultValue: 40, min: 30, max: 60, step: 1, unit: "mm" },
  // 邊抹（rails）
  { group: "apron", type: "number", key: "railWidth", label: "邊抹寬 (mm)", defaultValue: 50, min: 35, max: 80, step: 5, unit: "mm", help: "頂底抹 / 內部水平分隔板的高度" },
  { group: "apron", type: "number", key: "railThickness", label: "邊抹厚 (mm)", defaultValue: 25, min: 18, max: 35, step: 1, unit: "mm" },
  // 板心
  { group: "apron", type: "number", key: "panelThickness", label: "板心厚 (mm)", defaultValue: 12, min: 8, max: 18, step: 1, unit: "mm", help: "嵌入框內側槽，浮放（不黏死讓木材吐縮）" },
  // 頂蓋
  { group: "top", type: "number", key: "topThickness", label: "頂蓋厚 (mm)", defaultValue: 22, min: 18, max: 35, step: 1, unit: "mm" },
  { group: "top", type: "number", key: "topOverhang", label: "頂蓋外伸 (mm)", defaultValue: 20, min: 0, max: 40, step: 5, unit: "mm", help: "頂蓋四周外伸量" },
  // 牙條
  { group: "stretcher", type: "number", key: "skirtHeight", label: "牙條高 (mm)", defaultValue: 60, min: 30, max: 120, step: 5, unit: "mm", help: "底框下方裝飾牙條（直線素牙）" },
  { group: "stretcher", type: "number", key: "skirtThickness", label: "牙條厚 (mm)", defaultValue: 18, min: 12, max: 25, step: 1, unit: "mm" },
  // 層數
  { group: "stretcher", type: "number", key: "layerCount", label: "分層數", defaultValue: 3, min: 1, max: 5, step: 1, help: "由下往上 1, 2, 3..." },
  { group: "stretcher", type: "select", key: "layer1Type", label: "第 1 層（最下層）", defaultValue: "drawer", choices: LAYER_TYPE_CHOICES },
  { group: "stretcher", type: "select", key: "layer2Type", label: "第 2 層", defaultValue: "door", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [2, 3, 4, 5] } },
  { group: "stretcher", type: "select", key: "layer3Type", label: "第 3 層", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [3, 4, 5] } },
  { group: "stretcher", type: "select", key: "layer4Type", label: "第 4 層", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [4, 5] } },
  { group: "stretcher", type: "select", key: "layer5Type", label: "第 5 層（最上層）", defaultValue: "shelf", choices: LAYER_TYPE_CHOICES, dependsOn: { key: "layerCount", oneOf: [5] } },
];

export const chineseCabinet: FurnitureTemplate = (input): FurnitureDesign => {
  const o = chineseCabinetOptions;
  const { length, width, height, material } = input;
  const postSize = getOption<number>(input, opt(o, "postSize"));
  const railWidth = getOption<number>(input, opt(o, "railWidth"));
  const railThickness = getOption<number>(input, opt(o, "railThickness"));
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const topOverhang = getOption<number>(input, opt(o, "topOverhang"));
  const skirtHeight = getOption<number>(input, opt(o, "skirtHeight"));
  const skirtThickness = getOption<number>(input, opt(o, "skirtThickness"));
  const layerCount = getOption<number>(input, opt(o, "layerCount"));
  const layerTypesRaw = [
    getOption<string>(input, opt(o, "layer1Type")),
    getOption<string>(input, opt(o, "layer2Type")),
    getOption<string>(input, opt(o, "layer3Type")),
    getOption<string>(input, opt(o, "layer4Type")),
    getOption<string>(input, opt(o, "layer5Type")),
  ];
  const layerTypes = layerTypesRaw.slice(0, layerCount);

  // 幾何規劃：4 立柱接地貫穿全高，牙條外掛在立柱底外側（傳統明式）
  // 立柱：Y [0, height − topThickness]
  // 牙條：Y [0, skirtHeight]，跟立柱底外側共存
  // 上下抹：上抹底面 = postTopY − railWidth；下抹底面 = skirtHeight（牙條頂）
  // 內部空間 = 上下抹之間
  const postTopY = height - topThickness;
  const postBottomY = 0;
  const postHeight = postTopY;
  // 4 立柱位置：±(length/2 - postSize/2), ±(width/2 - postSize/2)
  const postX = length / 2 - postSize / 2;
  const postZ = width / 2 - postSize / 2;
  // 內部開放空間：頂底抹之間（下抹仍在牙條頂上方）
  const innerTopY = postTopY - railWidth;  // 上抹底面
  const innerBottomY = skirtHeight + railWidth;  // 下抹頂面（牙條頂 + railWidth）
  const innerHeight = innerTopY - innerBottomY;
  // 每層高度（等分）
  const layerHeight = innerHeight / layerCount;

  const parts: Part[] = [];

  // ── 頂蓋（外伸）
  parts.push({
    id: "top",
    nameZh: "頂蓋",
    material,
    grainDirection: "length",
    visible: { length: length + topOverhang * 2, width: width + topOverhang * 2, thickness: topThickness },
    origin: { x: 0, y: postTopY, z: 0 },
    tenons: [],
    mortises: [],
  });

  // ── 4 立柱
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const fbId = sz < 0 ? "front" : "back";
      const lrId = sx < 0 ? "left" : "right";
      const fbLabel = sz < 0 ? "前" : "後";
      const lrLabel = sx < 0 ? "左" : "右";
      parts.push({
        id: `post-${fbId}-${lrId}`,
        nameZh: `${fbLabel}${lrLabel}立柱`,
        material,
        grainDirection: "length",
        visible: { length: postSize, width: postSize, thickness: postHeight },
        origin: { x: sx * postX, y: postBottomY, z: sz * postZ },
        tenons: [],
        mortises: [],
      });
    }
  }

  // ── 6 面 frame-and-panel：每面 上抹 + 下抹 + 板心
  // 立柱當邊柱用（4 個立柱橫跨 4 個面的邊柱角色）
  // 上抹/下抹的位置：頂底位置 + 左右側面 + 前面（門框）+ 背面
  // 為簡化：頂面（頂蓋）已是單片，不做 frame；底面（底框）做 4 條 rail 圍底箱
  // 側面（左/右/前/後）：每面在 postTopY 跟 postBottomY 各加 1 條水平 rail
  // 板心：在 4 條 rail 之間（同立柱間）

  // 抹板（rail）端頭卡進立柱中央（明式榫頭埋入立柱中軸位置）
  // 跨度 = 2 × postX/Z = 一立柱中心到另一立柱中心
  const railLenX = 2 * postX;
  const railLenZ = 2 * postZ;
  // 板心 / 內部 divider 留在兩立柱內面之間（不延伸進立柱）
  const innerSpanX = 2 * (postX - postSize / 2);
  const innerSpanZ = 2 * (postZ - postSize / 2);
  const panelInnerW_X = innerSpanX - 10;  // 板心比內面短 5mm 兩邊（嵌入 rail 槽 5mm）
  const panelInnerW_Z = innerSpanZ - 10;
  // 板心 height = 上下抹之間 + 嵌入上下槽各 5mm

  // 上抹/下抹位置（除頂蓋外，櫃身的 top/bottom rail）
  // 上抹頂面 = postTopY，下緣 = postTopY - railWidth
  // 下抹底邊 = skirtHeight（牙條頂），頂面 = skirtHeight + railWidth
  const upperRailY = postTopY - railWidth;
  const lowerRailY = skirtHeight;
  // panel 高度 = 上下抹之間 + 嵌入上下槽各 5mm
  const panelInnerH = upperRailY - lowerRailY - railWidth + 10;

  // 明式邊抹板心：rail / panel 跟立柱「外面共面」（嵌入立柱、外面齊平）
  // rail 中心 = 立柱外面 - rail 厚/2（rail 在立柱範圍內偏外側）
  // panel 中心 = rail 中心（嵌入 rail 內側槽）
  // 立柱外面 X = postX + postSize/2，所以 rail center X = postX + postSize/2 - railThickness/2
  const sideRailOffsetX = postX + postSize / 2 - railThickness / 2;
  const fbRailOffsetZ = postZ + postSize / 2 - railThickness / 2;

  // visible 軸慣例：length → X、width → Z、thickness → Y（高度）
  // 對沿 Z 軸延伸的 rail（左/右側上下抹）：X=厚度、Y=高度、Z=長度
  //   → visible: length=railThickness, width=railLenZ, thickness=railWidth
  // 對沿 X 軸延伸的 rail（前/後上下抹）：X=長度、Y=高度、Z=厚度
  //   → visible: length=railLenX, width=railThickness, thickness=railWidth
  // 對立面 panel：高度沿 Y、長度沿延伸軸、厚度沿 face normal

  // ── 左/右側面 frame（沿 Z 延伸）
  for (const sx of [-1, 1] as const) {
    const lrId = sx < 0 ? "left" : "right";
    const lrLabel = sx < 0 ? "左" : "右";
    // 上抹
    parts.push({
      id: `${lrId}-side-upper-rail`,
      nameZh: `${lrLabel}側上抹`,
      material,
      grainDirection: "length",
      visible: { length: railThickness, width: railLenZ, thickness: railWidth },
      origin: { x: sx * sideRailOffsetX, y: upperRailY, z: 0 },
      tenons: [],
      mortises: [],
    });
    // 下抹
    parts.push({
      id: `${lrId}-side-lower-rail`,
      nameZh: `${lrLabel}側下抹`,
      material,
      grainDirection: "length",
      visible: { length: railThickness, width: railLenZ, thickness: railWidth },
      origin: { x: sx * sideRailOffsetX, y: lowerRailY, z: 0 },
      tenons: [],
      mortises: [],
    });
    // 板心
    parts.push({
      id: `${lrId}-side-panel`,
      nameZh: `${lrLabel}側板心`,
      material,
      grainDirection: "length",
      visible: { length: panelThickness, width: panelInnerW_Z, thickness: panelInnerH },
      origin: { x: sx * sideRailOffsetX, y: lowerRailY + railWidth - 5, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 背面 frame（沿 X 延伸）
  parts.push({
    id: "back-upper-rail",
    nameZh: "背面上抹",
    material,
    grainDirection: "length",
    visible: { length: railLenX, width: railThickness, thickness: railWidth },
    origin: { x: 0, y: upperRailY, z: fbRailOffsetZ },
    tenons: [],
    mortises: [],
  });
  parts.push({
    id: "back-lower-rail",
    nameZh: "背面下抹",
    material,
    grainDirection: "length",
    visible: { length: railLenX, width: railThickness, thickness: railWidth },
    origin: { x: 0, y: lowerRailY, z: fbRailOffsetZ },
    tenons: [],
    mortises: [],
  });
  parts.push({
    id: "back-panel",
    nameZh: "背面板心",
    material,
    grainDirection: "length",
    visible: { length: panelInnerW_X, width: panelThickness, thickness: panelInnerH },
    origin: { x: 0, y: lowerRailY + railWidth - 5, z: fbRailOffsetZ },
    tenons: [],
    mortises: [],
  });

  // ── 前面 frame
  parts.push({
    id: "front-upper-rail",
    nameZh: "前面上抹",
    material,
    grainDirection: "length",
    visible: { length: railLenX, width: railThickness, thickness: railWidth },
    origin: { x: 0, y: upperRailY, z: -(fbRailOffsetZ) },
    tenons: [],
    mortises: [],
  });
  parts.push({
    id: "front-lower-rail",
    nameZh: "前面下抹",
    material,
    grainDirection: "length",
    visible: { length: railLenX, width: railThickness, thickness: railWidth },
    origin: { x: 0, y: lowerRailY, z: -(fbRailOffsetZ) },
    tenons: [],
    mortises: [],
  });

  // ── 內部水平分隔板（dividers between layers）
  // layerCount 層 → 需要 (layerCount - 1) 條分隔板
  // 第 i 層頂端 Y = innerBottomY + (i + 1) × layerHeight
  for (let i = 0; i < layerCount - 1; i++) {
    const dividerY = innerBottomY + (i + 1) * layerHeight - railWidth / 2;
    parts.push({
      id: `divider-${i + 1}`,
      nameZh: `第 ${i + 1}/${i + 2} 層分隔板`,
      material,
      grainDirection: "length",
      // 水平層板：X 方向 = 兩立柱內面 innerSpanX, Z 方向 innerSpanZ, Y 厚 railWidth
      visible: { length: innerSpanX, width: innerSpanZ, thickness: railWidth },
      origin: { x: 0, y: dividerY, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 每層功用內容
  for (let i = 0; i < layerCount; i++) {
    const layerType = layerTypes[i];
    const layerBottomY = innerBottomY + i * layerHeight;
    const layerTopY = innerBottomY + (i + 1) * layerHeight;
    const thisLayerHeight = layerTopY - layerBottomY;
    const layerCenterY = (layerBottomY + layerTopY) / 2;

    if (layerType === "door") {
      // 對開門：2 扇，每扇 = 4 frames + 板心
      // 門面寬 = (innerSpanX − 中縫 4mm) / 2，扣門框 4 邊各 railWidth
      // 簡化：門用單 part 表示（不細拆 4 邊框），方便後續 hinge 動畫
      const doorGap = 4;  // 中縫
      const doorWidth = (innerSpanX - doorGap) / 2;
      const doorHeight = thisLayerHeight - 4;  // 上下各 2mm 隙
      const doorThickness = railThickness;
      for (const sx of [-1, 1] as const) {
        const lrId = sx < 0 ? "left" : "right";
        const lrLabel = sx < 0 ? "左" : "右";
        parts.push({
          id: `layer${i + 1}-${lrId}-door`,
          nameZh: `第 ${i + 1} 層${lrLabel}門`,
          material,
          grainDirection: "length",
          // 立著的門板：X 寬, Y 高, Z 厚
          visible: { length: doorWidth, width: doorThickness, thickness: doorHeight },
          origin: { x: sx * (doorWidth / 2 + doorGap / 2), y: layerCenterY - doorHeight / 2, z: -(fbRailOffsetZ) },
          tenons: [],
          mortises: [],
        });
      }
    } else if (layerType === "drawer") {
      // 抽屜：單一 drawer face + 抽屜盒（簡化）
      const drawerGap = 3;
      const drawerWidth = innerSpanX - drawerGap * 2;
      const drawerHeight = thisLayerHeight - 4;
      const drawerThickness = railThickness;
      // 抽屜面板（front）— 立著的板：X 寬, Y 高, Z 厚
      parts.push({
        id: `layer${i + 1}-drawer-front`,
        nameZh: `第 ${i + 1} 層抽屜面`,
        material,
        grainDirection: "length",
        visible: { length: drawerWidth, width: drawerThickness, thickness: drawerHeight },
        origin: { x: 0, y: layerCenterY - drawerHeight / 2, z: -(fbRailOffsetZ) },
        tenons: [],
        mortises: [],
      });
      // 抽屜底（簡化用 1 片底板）
      const drawerBottomThickness = 6;
      parts.push({
        id: `layer${i + 1}-drawer-bottom`,
        nameZh: `第 ${i + 1} 層抽屜底`,
        material,
        grainDirection: "length",
        visible: { length: drawerWidth - 20, width: 2 * postZ - postSize - 30, thickness: drawerBottomThickness },
        origin: { x: 0, y: layerBottomY + 5, z: 0 },
        tenons: [],
        mortises: [],
      });
      // 抽屜兩側（立著的板，沿 Z 延伸）：X=厚, Y=高, Z=長
      const drawerSideThickness = 12;
      const drawerSideHeight = drawerHeight - 12;
      const drawerSideLength = 2 * (postZ - postSize / 2) - 30;
      for (const sx of [-1, 1] as const) {
        const lrId = sx < 0 ? "left" : "right";
        parts.push({
          id: `layer${i + 1}-drawer-${lrId}-side`,
          nameZh: `第 ${i + 1} 層抽屜${sx < 0 ? "左" : "右"}側`,
          material,
          grainDirection: "length",
          visible: { length: drawerSideThickness, width: drawerSideLength, thickness: drawerSideHeight },
          origin: { x: sx * (drawerWidth / 2 - 10 - drawerSideThickness / 2), y: layerBottomY + 5 + drawerBottomThickness, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      // 抽屜後（沿 X 延伸）：X=長, Y=高, Z=厚
      parts.push({
        id: `layer${i + 1}-drawer-back`,
        nameZh: `第 ${i + 1} 層抽屜後`,
        material,
        grainDirection: "length",
        visible: { length: drawerWidth - 20 - drawerSideThickness * 2, width: drawerSideThickness, thickness: drawerSideHeight },
        origin: { x: 0, y: layerBottomY + 5 + drawerBottomThickness, z: postZ - postSize / 2 - 20 },
        tenons: [],
        mortises: [],
      });
    } else {
      // shelf：開放層板（無門無抽屜，只在前面留空）
      // 這層的 divider 已經在上面 push 了；這層內部不額外加東西
      // 視覺上呈現「開放層」由前面的「無門」自然體現
    }
  }

  // ── 底框（4 條 rail 圍成底箱，承層板/抽屜底）
  // 簡化：用 1 片底板
  parts.push({
    id: "bottom-board",
    nameZh: "底板",
    material,
    grainDirection: "length",
    visible: { length: 2 * postX - postSize, width: 2 * postZ - postSize, thickness: 18 },
    origin: { x: 0, y: skirtHeight + railWidth, z: 0 },
    tenons: [],
    mortises: [],
  });

  // ── 牙條（直線素牙）：圍底框下緣 4 條
  // 牙條從立柱外面**內縮 10mm**（reveal 視覺凹進感）
  const SKIRT_INSET = 10;
  const skirtOffsetX = postX + postSize / 2 - skirtThickness / 2 - SKIRT_INSET;
  const skirtOffsetZ = postZ + postSize / 2 - skirtThickness / 2 - SKIRT_INSET;
  // 前後牙條（沿 X 延伸）：X=長, Y=高, Z=厚
  for (const sz of [-1, 1] as const) {
    const fbId = sz < 0 ? "front" : "back";
    const fbLabel = sz < 0 ? "前" : "後";
    parts.push({
      id: `skirt-${fbId}`,
      nameZh: `${fbLabel}牙條`,
      material,
      grainDirection: "length",
      visible: { length: 2 * (postX - postSize / 2), width: skirtThickness, thickness: skirtHeight },
      origin: { x: 0, y: 0, z: sz * skirtOffsetZ },
      tenons: [],
      mortises: [],
    });
  }
  // 左右牙條（沿 Z 延伸）：X=厚, Y=高, Z=長（接到兩立柱內面）
  for (const sx of [-1, 1] as const) {
    const lrId = sx < 0 ? "left" : "right";
    const lrLabel = sx < 0 ? "左" : "右";
    parts.push({
      id: `skirt-${lrId}`,
      nameZh: `${lrLabel}牙條`,
      material,
      grainDirection: "length",
      visible: { length: skirtThickness, width: 2 * (postZ - postSize / 2), thickness: skirtHeight },
      origin: { x: sx * skirtOffsetX, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  const layerSummary = layerTypes.map((t, i) => `${i + 1}=${t === "door" ? "對開門" : t === "drawer" ? "抽屜" : "層板"}`).join(" / ");

  const design: FurnitureDesign = {
    id: `chinese-cabinet-${length}x${width}x${height}`,
    category: "chinese-cabinet",
    nameZh: "中式方角櫃",
    overall: { length, width, thickness: height },
    parts,
    defaultJoinery: "shouldered-tenon",
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `中式方角櫃（明式邊抹板心）：4 立柱 ${postSize}mm + 6 面框板（邊抹 ${railWidth}×${railThickness}mm + 板心 ${panelThickness}mm）+ 直線素牙（高 ${skirtHeight}mm）。${layerCount} 層配置：${layerSummary}。框角全帶肩榫；板心浮放於框內槽 5mm 深，不黏死讓木材吐縮不爆裂。`,
  };

  applyStandardChecks(design, {
    minLength: 500, minWidth: 250, minHeight: 600,
    maxLength: 1500, maxWidth: 600, maxHeight: 2200,
  });
  return design;
};
