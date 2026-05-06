import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { applyStandardChecks, appendSuggestion } from "./_validators";
import {
  seatEdgeOption,
  seatEdgeStyleOption,
  legEdgeOption,
  legEdgeStyleOption,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  drawerJoineryOption,
  drawerJoineryNote,
  drawerSlideTypeOption,
  drawerSlideTypeNote,
  legBottomScale,
  legScaleAt,
} from "./_helpers";
import type { Part } from "@/lib/types";

export const sideTableOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 35, min: 20, max: 120, step: 1 },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 25, min: 12, max: 60, step: 1 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 60, min: 30, max: 200, step: 5, dependsOn: { key: "withDrawer", equals: false } },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙板/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "加下橫撐", defaultValue: false },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距桌面 (mm)", defaultValue: 8, min: 0, max: 200, step: 5, help: "邊桌總高約 600，5–10 比例適中", dependsOn: { key: "withDrawer", equals: false } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 500, step: 10, dependsOn: { key: "withLowerStretchers", equals: true } },
  // ----- 前緣抽屜（藏雜物 / 床頭物品）-----
  { group: "drawer", type: "checkbox", key: "withDrawer", label: "加抽屜", defaultValue: false, help: "前緣抽屜，掛在前牙板下方" },
  { group: "drawer", type: "number", key: "drawerHeight", label: "抽屜高 (mm)", defaultValue: 80, min: 30, max: 250, step: 5, help: "抽屜面板高（不含底下橫撐 20mm）；牙板高 = 抽屜高 + 20", dependsOn: { key: "withDrawer", equals: true } },
  { group: "drawer", type: "number", key: "drawerDepth", label: "抽屜深 (mm)", defaultValue: 0, min: 0, max: 500, step: 10, help: "0 = 自動（桌寬 -80）", dependsOn: { key: "withDrawer", equals: true } },
  { group: "drawer", type: "number", key: "drawerFaceOffset", label: "面板距正面 (mm)", defaultValue: 0, min: -20, max: 50, step: 1, help: "0 = 跟正面齊平；正值 = 面板凸出；負值 = 面板內縮", dependsOn: { key: "withDrawer", equals: true } },
  { ...drawerJoineryOption("drawer"), dependsOn: { key: "withDrawer", equals: true } },
  { group: "drawer", type: "select", key: "drawerSlideType", label: "抽屜滑軌種類", defaultValue: "side-mount", choices: [
    { value: "side-mount", label: "三段滑軌（側裝鋼珠 13mm）" },
    { value: "none", label: "無滑軌（木製或直接配合，5mm 鬆配）" },
  ], help: "三段滑軌：抽屜兩側各留 13mm 給滑軌；無滑軌：兩側只留 5mm 鬆配", dependsOn: { key: "withDrawer", equals: true } },
  { group: "drawer", type: "select", key: "pullStyle", label: "抽屜把手", defaultValue: "knob", choices: [
    { value: "knob", label: "圓把手（knob）" },
    { value: "bar", label: "長條把手（bar）" },
    { value: "none", label: "無把手" },
  ], dependsOn: { key: "withDrawer", equals: true } },
];

export const sideTable: FurnitureTemplate = (input) => {
  const o = sideTableOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const seatEdge = getOption<number>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronWidthRaw = getOption<number>(input, opt(o, "apronWidth"));
  const drawerHeight = getOption<number>(input, opt(o, "drawerHeight"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const withDrawer = getOption<boolean>(input, opt(o, "withDrawer"));
  // 抽屜模式：牙板強制貼桌面底（apronOffset=0）→ 抽屜面板也貼著桌面下緣
  const effectiveApronOffset = withDrawer ? 0 : apronOffset;
  // 抽屜模式：牙板高由 drawerHeight 反推（drawerHeight + 20mm 給底橫撐）
  const RAIL_H = 20;
  const apronWidth = withDrawer ? drawerHeight + RAIL_H : apronWidthRaw;

  const drawerCount = withDrawer ? 1 : 0; // 固定單抽屜（全寬）
  const drawerDepthOpt = getOption<number>(input, opt(o, "drawerDepth"));
  const drawerFaceOffset = getOption<number>(input, opt(o, "drawerFaceOffset"));
  const drawerJoinery = getOption<string>(input, opt(o, "drawerJoinery"));
  const drawerSlideType = getOption<string>(input, opt(o, "drawerSlideType"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const design = simpleTable({
    category: "side-table",
    nameZh: "邊桌 / 床頭櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    legPenetratingTenon,
    withLowerStretchers,
    legInset,
    apronOffset: effectiveApronOffset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: legShape === "tapered" ? "tapered" : "box",
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    notes: `床側收納用矮桌，可加下橫撐增穩定。${withDrawer ? ` 含 1 個前緣抽屜（面板高 ${drawerHeight}mm，${drawerFaceOffset === 0 ? "跟正面齊平" : drawerFaceOffset > 0 ? `凸出 ${drawerFaceOffset}mm` : `內縮 ${-drawerFaceOffset}mm`}）。${drawerJoineryNote(drawerJoinery)} ${drawerSlideType === "side-mount" ? "三段滑軌（兩側各留 13mm 鎖滑軌）" : "無滑軌（兩側 5mm 鬆配，純木工）"}。 把手：${pullStyle === "none" ? "無" : pullStyle === "knob" ? "圓把手" : "長條把手"}。` : ""}`,
  });

  // 前緣抽屜：面板 + 抽屜箱（替代前牙板）
  if (drawerCount > 0) {
    const apronPart = design.parts.find((p) => p.id === "apron-front");
    const topPart = design.parts.find((p) => p.id === "top");
    if (apronPart && topPart) {
      // 抽屜替代前牙板 → 把 apron-front 從零件清單移除
      design.parts = design.parts.filter((p) => p.id !== "apron-front");
      // 左右兩支牙板朝內側偏移，讓「牙板內側面」跟「腳內側面」齊平 → 提供
      // 抽屜滑軌鎖固的平整面（牙板原本以腳中心為軸，內外側都會凸出腳半邊）
      const apronThicknessActualLR = 22;
      const sideShift = legSize / 2 - apronThicknessActualLR / 2;
      for (const id of ["apron-left", "apron-right"]) {
        const part = design.parts.find((p) => p.id === id);
        if (part) {
          const towardCenter = part.origin.x < 0 ? 1 : -1;
          part.origin.x += towardCenter * sideShift;
        }
      }
      const legHeight = input.height - topThickness;
      const apronY = legHeight - apronWidth - effectiveApronOffset;
      // 抽屜面板高 = 牙板高 - 20mm（抽屜下方留 2cm 給橫撐）
      const effectiveDrawerHeight = Math.max(20, apronWidth - RAIL_H);
      const drawerY = apronY + RAIL_H; // 抽屜底面 = 橫撐頂面
      const drawerFaceThick = 18;
      const apronThicknessActual = 22;
      const apronFrontZ = -(input.width / 2 - legSize / 2 - legInset) - apronThicknessActual / 2;
      // 面板 Z 位置：基準 = 跟腳前面齊平（不是牙板前面）
      // drawerFaceOffset 正值 → 面板凸出；負值 → 面板內縮（更靠桌內）
      const legFrontZ = -(input.width / 2 - legInset);
      const drawerFaceZ = legFrontZ + drawerFaceThick / 2 - drawerFaceOffset;
      // 抽屜箱外框（body）總寬：
      //   無滑軌 → 兩腳間 - 2mm（緊配：1mm/側）
      //   三段滑軌 → 兩腳間 - 25mm（兩側各 12.5mm 給鋼珠滑軌）
      const legInnerDistance = input.length - 2 * legSize - 2 * legInset;
      const bodyTotalSpan = drawerSlideType === "none"
        ? legInnerDistance - 2
        : legInnerDistance - 25;
      const slotW = bodyTotalSpan;
      // 抽屜面板（front face）總寬：
      //   無滑軌 → 等於抽屜箱寬（slotW）
      //   三段滑軌 → 兩腳間（overlay 蓋滿開口，跟箱身差 25mm = 兩側各 12.5mm 滑軌）
      const faceTotalSpan = drawerSlideType === "side-mount"
        ? legInnerDistance
        : bodyTotalSpan;
      const faceW = faceTotalSpan;
      // 最大可用深度：從面板背面 → 後牙板前面留 10mm 空間
      // = width - legSize/2 - 2×legInset - apronThick/2 - 面板厚 + 面板凸出量 - 10
      const maxDrawerDepth = Math.max(
        50,
        input.width - legSize / 2 - 2 * legInset - apronThicknessActual / 2 - drawerFaceThick + drawerFaceOffset - 10,
      );
      // 0 = 自動填滿；> 0 = 使用者指定，但不能超過最大深度（避免穿出後牙板）
      const drawerDepth = drawerDepthOpt > 0
        ? Math.min(drawerDepthOpt, maxDrawerDepth)
        : maxDrawerDepth;
      void drawerDepth;
      const sideThick = 12;        // 抽屜兩側板 / 後板厚度
      const bottomThick = 6;       // 底板厚度
      // 抽屜下方橫撐（drawer-bottom-rail）：20mm 高，前緣跟「腳前面」齊平
      // 推到 origin.z = -(width/2 - legInset) + apronThickness/2，讓 rail 前面 = 腳前面
      // 長度用 rail 底部 (apronY) 的腳寬度計算 → 底部完美貼合，頂部微 overlap 進腳（隱藏）
      // 用 rail 底部而非中心：錐形腳越下越細、leg-inner 越外，底部是 rail 跟腳最遠的點
      const bottomScale = legBottomScale(legShape === "tapered" ? "tapered" : "box");
      const legSizeAtRailBot = legSize * legScaleAt(apronY, legHeight, bottomScale);
      const railLength = input.length - 2 * legInset - legSize - legSizeAtRailBot;
      design.parts.push({
        id: "drawer-bottom-rail",
        nameZh: "抽屜下橫撐",
        material: input.material,
        grainDirection: "length",
        visible: {
          length: railLength,
          width: RAIL_H,
          thickness: apronThicknessActual,
        },
        origin: { x: 0, y: apronY, z: -(input.width / 2 - legInset) + apronThicknessActual / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
      // 抽屜箱外框寬 = 抽屜面板寬（slotW 已扣除滑軌空間）
      const bodyOuterW = slotW;
      const drawerParts: Part[] = [];
      {
        const i = 0;
        const xCenter = 0;
        const sideName = "";
        // 抽屜箱 Z 範圍：從面板背面 → 內伸 drawerDepth
        const bodyFrontZ = drawerFaceZ + drawerFaceThick / 2; // 面板背面 = 抽屜箱前緣
        const bodyBackZ = bodyFrontZ + drawerDepth;
        const bodyCenterZ = (bodyFrontZ + bodyBackZ) / 2;
        // ----- 外面板（overlay 蓋板，跟正面齊平）-----
        drawerParts.push({
          id: `drawer-${i + 1}-front`,
          nameZh: `${sideName}抽屜面板`,
          material: input.material,
          grainDirection: "length",
          visible: { length: faceW, width: effectiveDrawerHeight, thickness: drawerFaceThick },
          origin: { x: xCenter, y: drawerY, z: drawerFaceZ },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
        // ----- 抽屜箱前板（內層，三段滑軌時 = 跟箱身等寬，貼在外面板背後）-----
        // 無滑軌模式：外面板 = 箱身寬，跟此前板重疊不需重複，skip
        if (drawerSlideType === "side-mount") {
          const innerFrontThick = 12;
          drawerParts.push({
            id: `drawer-${i + 1}-box-front`,
            nameZh: `${sideName}抽屜箱前板`,
            material: input.material,
            grainDirection: "length",
            visible: { length: bodyOuterW, width: effectiveDrawerHeight - 4, thickness: innerFrontThick },
            origin: { x: xCenter, y: drawerY + 2, z: bodyFrontZ + innerFrontThick / 2 },
            rotation: { x: Math.PI / 2, y: 0, z: 0 },
            tenons: [],
            mortises: [],
          });
        }
        // ----- 左側板 + 右側板（受滑軌留量約束）-----
        for (const sx of [-1, 1] as const) {
          drawerParts.push({
            id: `drawer-${i + 1}-side-${sx < 0 ? "L" : "R"}`,
            nameZh: `${sideName}抽屜${sx < 0 ? "左" : "右"}側板`,
            material: input.material,
            grainDirection: "length",
            visible: { length: sideThick, width: effectiveDrawerHeight - 4, thickness: drawerDepth },
            origin: {
              x: xCenter + sx * (bodyOuterW / 2 - sideThick / 2),
              y: drawerY + 2,
              z: bodyCenterZ,
            },
            rotation: { x: Math.PI / 2, y: 0, z: 0 },
            tenons: [],
            mortises: [],
          });
        }
        // ----- 後板 -----
        drawerParts.push({
          id: `drawer-${i + 1}-back`,
          nameZh: `${sideName}抽屜後板`,
          material: input.material,
          grainDirection: "length",
          visible: { length: bodyOuterW - 2 * sideThick, width: effectiveDrawerHeight - 4, thickness: sideThick },
          origin: { x: xCenter, y: drawerY + 2, z: bodyBackZ - sideThick / 2 },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
        // ----- 底板 -----
        drawerParts.push({
          id: `drawer-${i + 1}-bottom`,
          nameZh: `${sideName}抽屜底板`,
          material: input.material,
          grainDirection: "length",
          visible: { length: bodyOuterW - 2 * sideThick, width: bottomThick, thickness: drawerDepth - sideThick },
          origin: {
            x: xCenter,
            y: drawerY + 2,
            z: (bodyFrontZ + (bodyBackZ - sideThick)) / 2,
          },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
        // ----- 把手 -----
        if (pullStyle && pullStyle !== "none") {
          const isKnob = pullStyle === "knob";
          // knob = 圓把手（直徑 25mm × 凸出 18mm）；bar = 長條把手 90×12×8
          const pullW = isKnob ? 25 : 90;
          const pullH = isKnob ? 25 : 12;
          const pullThick = isKnob ? 18 : 8;
          drawerParts.push({
            id: `drawer-${i + 1}-pull`,
            nameZh: `${sideName}抽屜把手`,
            material: input.material,
            grainDirection: "length",
            visible: { length: pullW, width: pullH, thickness: pullThick },
            origin: {
              x: xCenter,
              y: drawerY + effectiveDrawerHeight / 2 - pullH / 2,
              z: drawerFaceZ - drawerFaceThick / 2 - pullThick / 2,
            },
            rotation: { x: Math.PI / 2, y: 0, z: 0 },
            shape: isKnob ? { kind: "round" } : undefined,
            tenons: [],
            mortises: [],
          });
        }
      }
      design.parts.push(...drawerParts);
    }
  }

  applyStandardChecks(design, {
    minLength: 300, minWidth: 250, minHeight: 400,
    maxLength: 700, maxWidth: 550, maxHeight: 800,
  });
  if (input.length > 700 || input.width > 550) {
    appendSuggestion(design, {
      text: `${input.length}×${input.width}mm 已大於床頭櫃——抽屜櫃模板含完整抽屜結構。`,
      suggestedCategory: "chest-of-drawers",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
