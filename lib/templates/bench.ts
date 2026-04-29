import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { applyStandardChecks, validateStoolStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  RECT_LEG_SHAPE_CHOICES,
  seatEdgeOption,
  seatEdgeStyleOption,
  seatEdgeNote,
  seatProfileOption,
  seatProfileNote,
  legEdgeOption,
  legEdgeStyleOption,
  legEdgeNote,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  stretcherEdgeNote,
  legShapeLabel,
} from "./_helpers";
import {
  SHELF_CLEARANCE_MM,
  DEFAULT_SHELF_THICKNESS_MM,
  LOWER_STRETCHER_HEIGHT_RATIO,
} from "./_constants";

export const benchOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: RECT_LEG_SHAPE_CHOICES },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 1 },
  { group: "top", type: "number", key: "topThickness", label: "座板厚 (mm)", defaultValue: 30, min: 12, max: 60, step: 1 },
  seatEdgeOption("top", 5),
  seatEdgeStyleOption("top"),
  seatProfileOption("top"),
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  stretcherEdgeOption("stretcher", 1),
  stretcherEdgeStyleOption("stretcher"),
  { group: "apron", type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 80, min: 30, max: 200, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙板距座板 (mm)", defaultValue: 20, min: 0, max: 400, step: 5 },
  { group: "stretcher", type: "checkbox", key: "withCenterStretcher", label: "加中央橫撐", defaultValue: false, help: "超過 1.2m 建議加" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "加 4 邊下橫撐", defaultValue: false, help: "H 字形結構，更穩但費料" },
  { group: "top", type: "checkbox", key: "withUnderShelf", label: "座下儲物層板", defaultValue: false, help: "在下橫撐之間加一片層板收納鞋子/書" },
  { group: "back", type: "select", key: "endSplat", label: "椅背款式", defaultValue: "none", choices: [
    { value: "none", label: "無（純長凳）" },
    { value: "low", label: "矮椅背 板式（150mm，腰靠感）" },
    { value: "high", label: "高椅背 板式（350mm，正式座椅）" },
    { value: "slatted", label: "高椅背 直格條（350mm，垂直料 + 頂橫木）" },
    { value: "ladder", label: "高椅背 橫格條（350mm，1~3 條水平橫木 + 2 立柱）", dependsOn: { key: "legShape", notIn: ["splayed", "splayed-width"] } },
    { value: "windsor", label: "Windsor 風（轉柱+圓料+彎弧頂木 bow）" },
  ], help: "沿長邊背側加椅背料，靠著有依靠感" },
  { group: "back", type: "number", key: "windsorSpindleCount", label: "Windsor 圓料數", defaultValue: 7, min: 5, max: 13, step: 1, help: "中央車旋圓料根數（不含兩支邊柱）", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "windsorPostD", label: "Windsor 邊柱直徑 (mm)", defaultValue: 32, min: 20, max: 60, step: 2, help: "兩支較粗的車旋邊柱直徑", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "windsorSpindleD", label: "Windsor 圓料直徑 (mm)", defaultValue: 16, min: 10, max: 35, step: 1, help: "中央細圓料直徑", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "windsorRakeMm", label: "Windsor 後傾量 (mm)", defaultValue: 35, min: 0, max: 80, step: 5, help: "椅背料頂端比底端往後縮的距離；越大越貼腰背", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "windsorBowBendMm", label: "Windsor 頂橫木彎弧 (mm)", defaultValue: 40, min: 0, max: 80, step: 5, help: "頂橫木 (bow) 中央向後彎的最大量；0 = 直線", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "windsorTopRailH", label: "Windsor 頂橫木寬度 (mm)", defaultValue: 45, min: 25, max: 100, step: 5, help: "頂橫木 (bow) 高度（正視看到的寬度）", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "windsorTopRailT", label: "Windsor 頂橫木厚度 (mm)", defaultValue: 28, min: 15, max: 60, step: 1, help: "頂橫木 (bow) 厚度（側視看到的深度）", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "windsorBackInset", label: "Windsor 椅背距座板背緣 (mm)", defaultValue: 0, min: 0, max: 150, step: 5, help: "椅背整體（圓料+邊柱+頂橫木）往前推離座板背緣的距離；0 = 齊平", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "windsorEndInset", label: "Windsor 椅背距座板端面 (mm)", defaultValue: 0, min: 0, max: 200, step: 5, help: "椅背左右兩端往內縮的距離（邊柱外緣 + bow 兩端）；0 = 齊平座板兩端", dependsOn: { key: "endSplat", equals: "windsor" } },
  { group: "back", type: "number", key: "slatCount", label: "直料根數", defaultValue: 5, min: 3, max: 12, step: 1, dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "slatSize", label: "直料粗細 (mm)", defaultValue: 20, min: 20, max: 100, step: 5, help: "方料截面，width 跟 thickness 都用這值", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "topRailSize", label: "頂橫木粗細 (mm)", defaultValue: 50, min: 25, max: 100, step: 5, help: "頂橫木高度，thickness 自動配 25mm", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "slatBackInset", label: "直料距背緣 (mm)", defaultValue: 0, min: 0, max: 80, step: 5, help: "直料背面跟座板背緣的距離，0 = 齊平", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "slatEndInset", label: "直料距端頭 (mm)", defaultValue: 0, min: 0, max: 200, step: 10, help: "直料兩端往內縮的距離（頂橫木仍跨整條長邊不動），0 = 齊平座板兩端", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "topRailBendMm", label: "頂橫木向後彎弧 (mm)", defaultValue: 0, min: 0, max: 80, step: 5, help: "頂橫木中央往後（背側）彎的最大量，給人靠著符合腰背曲線。0 = 直線", dependsOn: { key: "endSplat", equals: "slatted" } },
  { group: "back", type: "number", key: "ladderRungs", label: "橫格條數", defaultValue: 2, min: 1, max: 3, step: 1, help: "全部排在椅背上半段，下緣不貼座板", dependsOn: { key: "endSplat", equals: "ladder" } },
  { group: "back", type: "number", key: "ladderRailH", label: "橫格條寬度 (mm)", defaultValue: 60, min: 25, max: 150, step: 5, help: "橫木的高度（正視看到的寬度）", dependsOn: { key: "endSplat", equals: "ladder" } },
  { group: "back", type: "number", key: "ladderRailT", label: "橫格條厚度 (mm)", defaultValue: 25, min: 15, max: 50, step: 5, help: "橫木的厚度（側視看到的深度）", dependsOn: { key: "endSplat", equals: "ladder" } },
  { group: "back", type: "number", key: "ladderRailGap", label: "橫格條間距 (mm)", defaultValue: 40, min: 10, max: 200, step: 5, help: "相鄰橫木之間的空隙；橫木從頂橫木往下依序疊", dependsOn: { key: "endSplat", equals: "ladder" } },
  { group: "back", type: "number", key: "ladderRailBendMm", label: "橫格條向後弧 (mm)", defaultValue: 0, min: 0, max: 80, step: 5, help: "每條橫格條中央往後（背側）彎的最大量，貼合腰背曲線。0 = 直線", dependsOn: { key: "endSplat", equals: "ladder" } },
  { group: "leg", type: "number", key: "legInset", label: "椅腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5 },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高 (mm)", defaultValue: 0, min: 0, max: 400, step: 10, help: "設 0 = 自動", dependsOn: { key: "withLowerStretchers", equals: true } },
];

export const bench: FurnitureTemplate = (input) => {
  const o = benchOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const seatEdge = getOption<string>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const seatProfile = getOption<string>(input, opt(o, "seatProfile"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const withCenterStretcher = getOption<boolean>(input, opt(o, "withCenterStretcher"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const withUnderShelf = getOption<boolean>(input, opt(o, "withUnderShelf"));
  const endSplat = getOption<string>(input, opt(o, "endSplat"));
  const slatCount = getOption<number>(input, opt(o, "slatCount"));
  const slatSize = getOption<number>(input, opt(o, "slatSize"));
  const topRailSize = getOption<number>(input, opt(o, "topRailSize"));
  const slatBackInset = getOption<number>(input, opt(o, "slatBackInset"));
  const slatEndInset = getOption<number>(input, opt(o, "slatEndInset"));
  const topRailBendMm = getOption<number>(input, opt(o, "topRailBendMm"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const ladderRungs = getOption<number>(input, opt(o, "ladderRungs"));
  const ladderRailH = getOption<number>(input, opt(o, "ladderRailH"));
  const ladderRailT = getOption<number>(input, opt(o, "ladderRailT"));
  const ladderRailGap = getOption<number>(input, opt(o, "ladderRailGap"));
  const ladderRailBendMm = getOption<number>(input, opt(o, "ladderRailBendMm"));
  const windsorSpindleCount = getOption<number>(input, opt(o, "windsorSpindleCount"));
  const windsorPostD = getOption<number>(input, opt(o, "windsorPostD"));
  const windsorSpindleD = getOption<number>(input, opt(o, "windsorSpindleD"));
  const windsorRakeMm = getOption<number>(input, opt(o, "windsorRakeMm"));
  const windsorBowBendMm = getOption<number>(input, opt(o, "windsorBowBendMm"));
  const windsorTopRailH = getOption<number>(input, opt(o, "windsorTopRailH"));
  const windsorTopRailT = getOption<number>(input, opt(o, "windsorTopRailT"));
  const windsorBackInset = getOption<number>(input, opt(o, "windsorBackInset"));
  const windsorEndInset = getOption<number>(input, opt(o, "windsorEndInset"));

  const design = simpleTable({
    category: "bench",
    nameZh: "長凳",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    apronOffset,
    withCenterStretcher: withCenterStretcher || input.length > 1200,
    withLowerStretchers: withLowerStretchers || withUnderShelf,
    legInset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: (["box", "tapered", "strong-taper", "inverted", "splayed", "splayed-length", "splayed-width", "hoof"].includes(legShape) ? legShape : "box") as "box" | "tapered" | "strong-taper" | "inverted" | "splayed" | "splayed-length" | "splayed-width" | "hoof",
    seatEdge,
    seatEdgeStyle,
    seatProfile,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    notes: `腳樣式：${legShapeLabel(legShape)}。長凳腳粗越大越穩；超過 1.2m 建議開啟中央橫撐防扭。${seatEdgeNote(seatEdge, seatEdgeStyle)}${legEdgeNote(legEdge, legEdgeStyle)}${stretcherEdgeNote(stretcherEdge, stretcherEdgeStyle)}${seatProfileNote(seatProfile) ? ` ${seatProfileNote(seatProfile)}` : ""}${endSplat !== "none" ? ` 椅背：${endSplat === "low" ? "150mm 板式（腰靠感）" : endSplat === "high" ? "350mm 板式" : endSplat === "slatted" ? "直格條 5 料" : endSplat === "ladder" ? "橫格條 3 條" : "Windsor 風（邊柱+5 圓料）"}。` : ""}`,
  });

  // 椅背 —— 沿長邊背側（+Z）從座板上緣往上延伸
  if (endSplat !== "none") {
    const splatHeight = endSplat === "low" ? 150 : 350;
    // overall.thickness 需含椅背，否則三視圖 viewBox 會切到椅背頂端
    design.overall = { ...design.overall, thickness: input.height + splatHeight };
    const splatThick = 25;
    const seatTop = input.height;
    const halfW = input.width / 2;
    const backZ = halfW - splatThick / 2;
    const mat = input.material;

    if (endSplat === "low" || endSplat === "high") {
      // 板式：單片整面立板
      design.parts.push({
        id: "back-splat",
        nameZh: "椅背立板",
        material: mat,
        grainDirection: "length",
        visible: { length: input.length, width: splatHeight, thickness: splatThick },
        origin: { x: 0, y: seatTop, z: backZ },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    } else if (endSplat === "slatted") {
      // 直格條：N 條垂直料（方料截面 slatSize × slatSize） + 頂橫木
      // slatBackInset：直料 + 頂橫木整體往前移（座板背緣往前推 slatBackInset）
      const topRailH = topRailSize;
      const topRailT = 25; // 頂橫木 thickness 固定 25mm
      const slatN = slatCount;
      const slatW = slatSize;
      const slatT = slatSize;
      const slatHeight = splatHeight - topRailH;
      // 直料兩端往內縮 slatEndInset，剩下空間平均分配 N 條直料
      // 頂橫木維持跨整條長邊（input.length）不縮
      const slatSpan = Math.max(slatN * slatW, input.length - 2 * slatEndInset);
      const slatGap = (slatSpan - slatN * slatW) / Math.max(1, slatN - 1);
      // 直料 origin.z 從 backZ 往前推 slatBackInset，但 backZ 算法用了 splatThick/2，
      // 直料截面是 slatT 不是 splatThick，要校正：直料背面齊平座板背緣 - slatBackInset
      // → origin.z = halfW - slatT/2 - slatBackInset
      const slatZ = halfW - slatT / 2 - slatBackInset;
      const railZ = halfW - topRailT / 2 - slatBackInset;
      for (let i = 0; i < slatN; i++) {
        const x = -slatSpan / 2 + slatW / 2 + i * (slatW + slatGap);
        // 頂橫木在這個 X 位置的後彎量
        const tBend = (2 * x) / input.length;
        const dzAtTop = topRailBendMm > 0
          ? topRailBendMm * Math.max(0, 1 - tBend * tBend)
          : 0;
        // 直料底部接座板 (slatX, seatTop, slatZ)、頂部接彎頂橫木 (..., seatTop+slatHeight, slatZ+dz)
        // 整支向後傾斜 θ = atan(dz / slatHeight)，料長除 cos(θ) 補償
        const tilt = dzAtTop > 0 ? Math.atan(dzAtTop / slatHeight) : 0;
        const tiltedHeight = slatHeight / Math.cos(tilt);
        // PerspectiveView py = (origin.y + yExt/2) → 調 origin 讓料中軸中點落在 (slatX, seatTop+slatHeight/2, slatZ+dz/2)
        const originY = seatTop + (slatHeight - tiltedHeight) / 2;
        const originZ = slatZ + dzAtTop / 2;
        design.parts.push({
          id: `back-slat-${i + 1}`,
          nameZh: `椅背直料 ${i + 1}`,
          material: mat,
          grainDirection: "length",
          visible: { length: slatW, width: tiltedHeight, thickness: slatT },
          origin: { x, y: originY, z: originZ },
          rotation: { x: Math.PI / 2 + tilt, y: 0, z: 0 },
          shape: dzAtTop > 0
            ? { kind: "tilt-z", topShiftMm: dzAtTop, baseHeightMm: slatHeight }
            : undefined,
          tenons: [],
          mortises: [],
        });
      }
      // 頂橫木：不旋轉，讓 local Z = 深度方向，arch-bent 才能在世界 Z 方向彎
      // local X=長 (世界 X)、local Y=高度 (世界 Y, thickness 借當高)、local Z=深度 (世界 Z, width 借當深)
      design.parts.push({
        id: "back-top-rail",
        nameZh: "椅背頂橫木",
        material: mat,
        grainDirection: "length",
        visible: { length: input.length, width: topRailT, thickness: topRailH },
        origin: { x: 0, y: seatTop + slatHeight, z: railZ },
        shape: topRailBendMm > 0 ? { kind: "arch-bent" as const, bendMm: topRailBendMm } : undefined,
        tenons: [],
        mortises: [],
      });
    } else if (endSplat === "ladder") {
      // 橫格條：N 條（1~3）水平橫料 + 2 條後背立柱接座板
      // 結構：立柱靠最後（背面齊座板背緣），橫木掛在立柱「前面」→ 從正視圖看
      // 立柱在橫木後面（被橫木遮住）
      // 從頂橫木往下依序疊放，每兩條之間留 ladderRailGap 空隙
      const railH = Math.max(15, ladderRailH || 60);
      const railT = Math.max(10, ladderRailT || 25);
      const railGap = Math.max(0, ladderRailGap || 40);
      const postW = legSize;
      const postT = legSize;
      const N = Math.max(1, Math.min(3, Math.round(ladderRungs || 2)));
      // 立柱位置 = 後腳位置（後腳延伸上來當立柱）
      const rearLegZ = halfW - legSize / 2 - legInset;
      const postZ = rearLegZ;
      // 橫木：背面貼立柱前面（rail 中心 = 後腳前緣再往前 railT/2）
      const railZ = rearLegZ - legSize / 2 - railT / 2;
      // 橫木 X 軸長度 = 整條長凳長（跟原本一樣）；重疊立柱的部分另外把立柱切開
      const postX = input.length / 2 - legSize / 2 - legInset;
      const railLength = input.length;
      // 頂橫木下緣 = splat 區段最上方
      const topRailBotY = seatTop + splatHeight - railH;
      // 檢查最底下那條會不會掉到座板下方；若會，自動縮 gap 至剛好 fit 進上半段
      const stackHeight = N * railH + (N - 1) * railGap;
      const minBotY = seatTop + splatHeight / 2; // 不准低於背高一半
      const adjustedGap = stackHeight > splatHeight - railH
        ? Math.max(0, (splatHeight - railH - N * railH) / Math.max(1, N - 1))
        : railGap;
      const railIntervals: Array<{ bot: number; top: number }> = [];
      for (let i = 0; i < N; i++) {
        // i=0 → 最上面（頂橫木）；逐條往下
        const yBot = topRailBotY - i * (railH + adjustedGap);
        const isTop = i === 0;
        if (yBot < minBotY) break; // 底線保護：超過上半段不畫
        railIntervals.push({ bot: yBot, top: yBot + railH });
        // 不旋轉（像 slatted 頂橫木）：let local Z = 世界 Z 才能讓 arch-bent 在世界 +Z 彎
        // local X=長 (世界 X)、local Y(thickness)=高度 (世界 Y)、local Z(width)=深度 (世界 Z)
        design.parts.push({
          id: `back-rail-${i + 1}`,
          nameZh: isTop ? "椅背頂橫木" : `椅背橫料 ${i + 1}`,
          material: mat,
          grainDirection: "length",
          visible: { length: railLength, width: railT, thickness: railH },
          origin: { x: 0, y: yBot, z: railZ },
          shape: ladderRailBendMm > 0
            ? { kind: "arch-bent", bendMm: ladderRailBendMm }
            : undefined,
          tenons: [],
          mortises: [],
        });
      }
      // 後背立柱 = 後腳延長上來。
      // 「鋁向後彎時跟立柱會在 X 範圍內重疊」的處理：
      // 在「鋁堆疊 Y 區間（railSpanBot..railSpanTop）」內，立柱前緣往後縮 cutDepth
      // 的距離，讓鋁的後彎曲線剛好通過。實作是把立柱拆成三段：
      //   下段：legHeight..railSpanBot，全寬
      //   中段：railSpanBot..railSpanTop，前緣往後縮 cutDepth（width 軸縮，origin.z 往 +Z 偏 cutDepth/2）
      //   上段：railSpanTop..postTopY，全寬
      // 切的「斜面長度」= 鋁堆疊總高（=railSpanTop − railSpanBot），剛好對應你說的
      // 「3 條鋁總高 120cm 就切 120cm」。
      const splayedSet = new Set(["splayed", "splayed-length", "splayed-width"]);
      const taperedSet = new Set(["tapered", "strong-taper", "inverted", "hoof"]);
      const isSplayed = splayedSet.has(legShape);
      const isTapered = taperedSet.has(legShape);
      const legHeight = input.height - topThickness;
      const postUpExt = topThickness + splatHeight;
      const postTopY = legHeight + postUpExt;

      // 鋁堆疊 Y 範圍 + 在後腳 X 位置的 bend cut depth
      // (postX 上面已宣告)
      let railSpanBot = Infinity, railSpanTop = -Infinity;
      for (const r of railIntervals) {
        railSpanBot = Math.min(railSpanBot, r.bot);
        railSpanTop = Math.max(railSpanTop, r.top);
      }
      const tBendAtPost = (2 * postX) / input.length;
      const cutDepth = ladderRailBendMm > 0 && railIntervals.length > 0
        ? ladderRailBendMm * Math.max(0, 1 - tBendAtPost * tBendAtPost)
        : 0;
      const hasCut = cutDepth > 0.5 && railSpanTop > railSpanBot;

      const splayMm = 40;
      const splayHasX = legShape === "splayed" || legShape === "splayed-length";
      const splayHasZ = legShape === "splayed" || legShape === "splayed-width";

      // 公用：依 (legId, segBot, segTop, cutDepthThis) 加一段立柱
      const addPostSeg = (
        leg: typeof design.parts[number],
        segBot: number,
        segTop: number,
        cut: number,
        suffix: string,
      ) => {
        const segH = segTop - segBot;
        if (segH <= 0.5) return;
        const legId = leg.id.slice(4);
        // 中段切除：width 縮 cut，origin.z 往 +Z 偏 cut/2 → 後緣不動、前緣後縮 cut
        const widthAdj = legSize - cut;
        const zAdj = cut / 2;
        if (isSplayed) {
          const dxLeg = splayHasX ? Math.sign(leg.origin.x) * splayMm : 0;
          const dzLeg = splayHasZ ? Math.sign(leg.origin.z) * splayMm : 0;
          const tiltX = (dxLeg * postUpExt) / legHeight;
          const tiltZ = (dzLeg * postUpExt) / legHeight;
          const fBot = (segBot - legHeight) / postUpExt;
          const fTop = (segTop - legHeight) / postUpExt;
          const segBotX = leg.origin.x - tiltX * fBot;
          const segTopX = leg.origin.x - tiltX * fTop;
          const segBotZ = leg.origin.z - tiltZ * fBot;
          const segTopZ = leg.origin.z - tiltZ * fTop;
          const legChamferMm = leg.shape?.kind === "splayed" ? leg.shape.chamferMm : undefined;
          const legChamferStyle = leg.shape?.kind === "splayed" ? leg.shape.chamferStyle : undefined;
          design.parts.push({
            id: `back-post-${legId}-${suffix}`,
            nameZh: `椅背柱-${suffix}（接後腳 ${legId}）`,
            material: mat,
            grainDirection: "length",
            visible: { length: legSize, width: widthAdj, thickness: segH },
            origin: { x: segTopX, y: segBot, z: segTopZ + zAdj },
            shape: {
              kind: "splayed",
              dxMm: segBotX - segTopX,
              dzMm: segBotZ - segTopZ,
              ...(legChamferMm ? { chamferMm: legChamferMm } : {}),
              ...(legChamferStyle ? { chamferStyle: legChamferStyle } : {}),
            },
            tenons: [],
            mortises: [],
          });
        } else {
          const postShape = leg.shape?.kind === "chamfered-edges"
            ? { kind: "chamfered-edges" as const, chamferMm: leg.shape.chamferMm, style: leg.shape.style }
            : undefined;
          design.parts.push({
            id: `back-post-${legId}-${suffix}`,
            nameZh: `椅背柱-${suffix}（接後腳 ${legId}）`,
            material: mat,
            grainDirection: "length",
            visible: { length: legSize, width: segH, thickness: widthAdj },
            origin: { x: leg.origin.x, y: segBot, z: leg.origin.z + zAdj },
            rotation: { x: Math.PI / 2, y: 0, z: 0 },
            shape: postShape,
            tenons: [],
            mortises: [],
          });
        }
      };

      const rearLegs = design.parts.filter(p => p.id.startsWith("leg-") && p.origin.z > 0);
      if (!isSplayed && !isTapered && !hasCut) {
        // box 腳 + 沒有切除 → 直接延長後腳
        for (const p of rearLegs) {
          p.visible = { ...p.visible, thickness: p.visible.thickness + postUpExt };
          p.nameZh = `後腳/椅背柱 ${p.id.slice(4)}`;
        }
      } else if (!hasCut) {
        // splayed/tapered + 沒切除 → 加單支立柱（不分段）
        for (const leg of rearLegs) {
          addPostSeg(leg, legHeight, postTopY, 0, "full");
        }
      } else {
        // 有切除 → 三段：下段 + 中段（前緣後縮 cutDepth）+ 上段
        for (const leg of rearLegs) {
          if (railSpanBot > legHeight) addPostSeg(leg, legHeight, railSpanBot, 0, "lower");
          addPostSeg(leg, railSpanBot, railSpanTop, cutDepth, "mid");
          if (postTopY > railSpanTop) addPostSeg(leg, railSpanTop, postTopY, 0, "upper");
        }
      }
    } else if (endSplat === "windsor") {
      // Windsor 風：兩支車旋邊柱 + N 條中央車旋圓料 + 彎弧頂橫木 (bow)
      // 全部垂直（純圓料用 rotation X = π/2 立起來），底端接座板、頂端接頂橫木
      // 注意：rake 後傾跟 round shape 的 rotation 會衝突 → 暫時保留選項供未來實作，目前忽略
      const stumpD = Math.max(20, Math.min(60, windsorPostD || 32));     // 邊柱直徑（較粗）
      const spindleD = Math.max(10, Math.min(35, windsorSpindleD || 16)); // 中央圓料直徑（細）
      const topRailH = Math.max(25, Math.min(100, windsorTopRailH || 45)); // 頂橫木（bow）高度
      const topRailT = Math.max(15, Math.min(60, windsorTopRailT || 28));  // 頂橫木（bow）厚度
      const bowBendMm = Math.max(0, windsorBowBendMm);
      const backInset = Math.max(0, Math.min(150, windsorBackInset || 0));
      const endInset = Math.max(0, Math.min(200, windsorEndInset || 0));
      const spindleN = Math.max(5, Math.min(13, Math.round(windsorSpindleCount || 7)));
      void windsorRakeMm; // TODO: 後傾要搭配 tilt-z shape，跟 round 不能用 rotation 疊

      const railBotY = seatTop + splatHeight - topRailH;
      const partH = railBotY - seatTop; // 椅背料完整直立高度（座板上緣 → 頂橫木下緣）

      // 預先算 stumpX（要等下面 stumpInset 算完才知道）→ 先把 bow 範圍預備好
      const _stumpInsetPre = Math.max(stumpD / 2 + 8, endInset + stumpD / 2);
      const _bowLengthPre = Math.max(100, 2 * (input.length / 2 - _stumpInsetPre) + stumpD);
      // arch-bent 公式：每根圓料用「bow 自身長度」算，跟 bow 同步彎度
      const archDzAt = (x: number) =>
        bowBendMm > 0
          ? bowBendMm * Math.max(0, 1 - Math.pow((2 * x) / _bowLengthPre, 2))
          : 0;

      // 從座板背緣垂直往上、頂端跟著 bow 後彎傾斜的車旋圓料
      // round shape 軸序：length=X 寬, width=Z 深, thickness=Y 高
      // splayed-round-tapered: dzMm 是「底端 Z 位移」相對於 origin（top）
      const buildVerticalRound = (
        x: number,
        diameter: number,
        idSuffix: string,
        nameZh: string,
      ) => {
        if (partH <= 0) return;
        const dz = archDzAt(x);
        const zTop = halfW - diameter / 2 - backInset + dz; // 頂端跟著 bow 偏 +Z，整體往前推 backInset
        const useSplay = dz > 0.5;
        design.parts.push({
          id: `back-${idSuffix}`,
          nameZh,
          material: mat,
          grainDirection: "length",
          visible: { length: diameter, width: diameter, thickness: partH },
          origin: { x, y: seatTop, z: zTop },
          shape: useSplay
            ? { kind: "splayed-round-tapered" as const, bottomScale: 1, dxMm: 0, dzMm: -dz }
            : { kind: "round" as const },
          tenons: [],
          mortises: [],
        });
      };

      // 兩側邊柱 (stump posts)：邊柱「外緣」距座板端面 = endInset
      // 預設留 8mm 安全邊距避免邊柱整支懸出
      const stumpInset = Math.max(stumpD / 2 + 8, endInset + stumpD / 2);
      const stumpX = input.length / 2 - stumpInset;
      buildVerticalRound(-stumpX, stumpD, "post-left", "椅背左邊柱（轉柱）");
      buildVerticalRound(stumpX, stumpD, "post-right", "椅背右邊柱（轉柱）");

      // 中央圓料 (spindles)：在兩邊柱「內側邊」之間等距分佈
      // 用 slot-pitch 法：兩端 gap = 中間相鄰 gap，避免端點圓料貼到邊柱
      const innerWidth = 2 * stumpX - stumpD; // 邊柱內緣到內緣
      const slotPitch = innerWidth / (spindleN + 1);
      const innerLeft = -stumpX + stumpD / 2;
      for (let i = 0; i < spindleN; i++) {
        const x = innerLeft + slotPitch * (i + 1);
        buildVerticalRound(x, spindleD, `spindle-${i + 1}`, `椅背圓料 ${i + 1}`);
      }

      // 頂橫木 (bow)：椅背頂端水平彎弧木，連接所有圓料 + 邊柱
      const railZ = halfW - topRailT / 2 - backInset;
      // bow 長度跟著 stumpX 縮：bow 兩端對齊邊柱外緣
      const bowLength = Math.max(100, 2 * stumpX + stumpD);
      design.parts.push({
        id: "back-top-rail",
        nameZh: "椅背頂橫木 (bow 彎弧)",
        material: mat,
        grainDirection: "length",
        visible: { length: bowLength, width: topRailT, thickness: topRailH },
        origin: { x: 0, y: railBotY, z: railZ },
        shape: bowBendMm > 0 ? { kind: "arch-bent" as const, bendMm: bowBendMm } : undefined,
        tenons: [],
        mortises: [],
      });
    }
  }

  if (withUnderShelf) {
    const shelfT = DEFAULT_SHELF_THICKNESS_MM;
    const stretcherW = 40;
    const stretcherT = 20; // 跟 simple-table opts.lowerStretcherThickness 預設一致
    const stretcherY = lowerStretcherHeight > 0
      ? lowerStretcherHeight
      : Math.round((input.height - topThickness) * LOWER_STRETCHER_HEIGHT_RATIO);
    const shelfY = stretcherY + stretcherW;
    // 跟著 simple-table 的 splay 慣例算橫撐 origin 偏移：splayed 腳的橫撐
    // 會以「中軸 Y」算外推量（centerline alignment），shelf 也要跟上。
    const splayMm = 40;
    const splayDx = legShape === "splayed" || legShape === "splayed-length" ? splayMm : 0;
    const splayDz = legShape === "splayed" || legShape === "splayed-width" ? splayMm : 0;
    const legHeight = input.height - topThickness;
    const sCenterY = stretcherY + stretcherW / 2;
    const sCenterShift = legHeight > 0 ? 1 - sCenterY / legHeight : 0;
    const sSplayX = splayDx * sCenterShift;
    const sSplayZ = splayDz * sCenterShift;
    // shelf 邊緣 = 橫撐外面（apronEdge + splay@centerY + stretcherT/2）×2
    const shelfLen = Math.max(50, input.length - legSize - 2 * legInset + 2 * sSplayX + stretcherT);
    const shelfWid = Math.max(50, input.width - legSize - 2 * legInset + 2 * sSplayZ + stretcherT);
    // 缺角公式：shelf 邊緣 vs 腳在 shelf-Y 的內面
    //   shelf_edge = apronEdge + splay@centerY + stretcherT/2
    //   leg_inner_at_shelfY = apronEdge + splay@shelfY - legSize/2
    //   overlap = splay × (centerShift - shelfShift) + (stretcherT + legSize)/2
    //           = splay × stretcherW / (2 × legHeight) + (legSize + stretcherT)/2
    const splayExtraX = legHeight > 0 ? (splayDx * stretcherW) / (2 * legHeight) : 0;
    const splayExtraZ = legHeight > 0 ? (splayDz * stretcherW) / (2 * legHeight) : 0;
    const notchLen = Math.max(0, splayExtraX + (legSize + stretcherT) / 2);
    const notchWid = Math.max(0, splayExtraZ + (legSize + stretcherT) / 2);
    design.parts.push({
      id: "under-shelf",
      nameZh: "座下層板",
      material: input.material,
      grainDirection: "length",
      visible: { length: shelfLen, width: shelfWid, thickness: shelfT },
      origin: { x: 0, y: shelfY, z: 0 },
      shape: notchLen > 0 || notchWid > 0
        ? { kind: "notched-corners", notchLengthMm: notchLen, notchWidthMm: notchWid }
        : undefined,
      tenons: [],
      mortises: [],
    });
  }

  applyStandardChecks(design, {
    minLength: 600, minWidth: 200, minHeight: 350,
    maxLength: 2000, maxWidth: 550, maxHeight: 550,
  });
  if (input.height > 550) {
    appendSuggestion(design, {
      text: `坐高 ${input.height}mm 已接近桌面高度——建議用低桌或餐桌模板，含中央橫撐 + 牙板選項。`,
      suggestedCategory: input.height >= 700 ? "dining-table" : "low-table",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  appendWarnings(
    design,
    validateStoolStructure({
      legSize,
      height: input.height,
      seatThickness: topThickness,
      seatSpan: input.length, // 長凳座板跨距 = length（長邊）
      lowerStretcherHeight: withLowerStretchers && lowerStretcherHeight > 0
        ? lowerStretcherHeight
        : undefined,
      hasLowerStretcher: withLowerStretchers || withUnderShelf,
    }),
  );
  return design;
};
