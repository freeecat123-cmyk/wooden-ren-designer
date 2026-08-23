import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { applyStandardChecks, appendSuggestion, appendWarnings } from "./_validators";
import {
  curvedTaperLegOptions,
  seatEdgeOption,
  seatEdgeStyleOption,
  seatOutlineOption,
  seatOutlineSizeOption,
  seatOutlineNote,
  seatOutlineDetailOptions,
  readSeatOutlineParams,
  resolveTopOutlineShape,
  ovalMinLegInset,
  legEdgeOption,
  legEdgeStyleOption,
  stretcherEdgeOption,
  stretcherEdgeStyleOption,
  apronEdgeOption,
  apronEdgeStyleOption,
  apronProfileOptions,
  stretcherProfileOptions,
  clampLegInset,
} from "./_helpers";
import { formatMm } from "@/lib/units/format";

export const lowTableOptions: OptionSpec[] = [
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳" },
    { value: "tapered", label: "錐形腳" },
    { value: "splayed", label: "斜腳（四角對角外傾）" },
    { value: "splayed-length", label: "斜腳（沿長邊單向外傾）" },
    { value: "splayed-width", label: "斜腳（沿寬邊單向外傾）" },
    { value: "curved-taper", label: "弧肩斜腳（上段全寬→內凹弧肩→斜降）" },
  ] },
  ...curvedTaperLegOptions("leg"),
  { group: "leg", type: "number", key: "legSize", label: "腳粗", defaultValue: 45, unit: "mm", min: 20, max: 120, step: 1 },
  { group: "top", type: "number", key: "topThickness", label: "桌面厚", defaultValue: 28, unit: "mm", min: 12, max: 60, step: 1 },
  // 桌面俯視輪廓造型（top-outline）：與 liveEdge 互斥、非方形時倒角欄隱藏（一件一 shape）
  { ...seatOutlineOption("top", "桌面"), dependsOn: { all: [{ key: "liveEdge", notIn: [true] }, { key: "dropLeaf", oneOf: ["none"] }] } },
  seatOutlineSizeOption("top"),
  ...seatOutlineDetailOptions("top"),
  { ...seatEdgeOption("top", 5), dependsOn: { all: [{ key: "liveEdge", notIn: [true] }, { key: "seatOutline", oneOf: ["rect"] }] } },
  { ...seatEdgeStyleOption("top"), dependsOn: { all: [{ key: "seatEdge", notIn: [0] }, { key: "liveEdge", notIn: [true] }, { key: "seatOutline", oneOf: ["rect"] }] } },
  { group: "top", type: "checkbox", key: "liveEdge", label: "Live edge 原木邊", defaultValue: false, help: "桌面長邊保留原木樹皮曲線", wide: true, dependsOn: { key: "seatOutline", oneOf: ["rect"] } },
  { group: "top", type: "select", key: "dropLeaf", label: "翻板（drop-leaf）", defaultValue: "none", choices: [
    { value: "none", label: "無" },
    { value: "one-side", label: "單側翻板" },
    { value: "two-sides", label: "雙側翻板" },
  ], help: "兩端用蝶式鉸鏈加可摺疊延伸板" },
  { group: "top", type: "number", key: "dropLeafWidth", label: "翻板寬", defaultValue: 200, unit: "mm", min: 150, max: 400, step: 25, dependsOn: { key: "dropLeaf", notIn: ["none"] } },
  legEdgeOption("leg", 1),
  legEdgeStyleOption("leg"),
  { ...stretcherEdgeOption("stretcher", 1), dependsOn: { key: "stretcherProfile", oneOf: ["none"] } },
  { ...stretcherEdgeStyleOption("stretcher"), dependsOn: { all: [{ key: "stretcherEdge", notIn: [0] }, { key: "stretcherProfile", oneOf: ["none"] }] } },
  ...stretcherProfileOptions("stretcher", { key: "withLowerStretchers", equals: true }),
  { group: "apron", type: "number", key: "apronWidth", label: "牙條高", defaultValue: 70, unit: "mm", min: 30, max: 200, step: 5 },
  { group: "apron", type: "checkbox", key: "legPenetratingTenon", label: "腳上榫頭通透（明榫裝飾）", defaultValue: false, help: "勾選：牙條/下橫撐進腳改通榫（榫頭穿透到腳另一面），明式裝飾感；未勾：依母件厚度自動規則（≤25mm 通榫、>25mm 盲榫深度=厚度2/3）" },
  { group: "apron", type: "checkbox", key: "withCenterStretcher", label: "加中央牙條", defaultValue: false, help: "長桌建議加（>900mm 防扭）" },
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "加下橫撐", defaultValue: false },
  { group: "stretcher", type: "checkbox", key: "withSlatRack", label: "下橫撐置物條", defaultValue: false, help: "前後下橫撐之間架格柵條，做置物層", dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "slatCount", label: "置物條數量", defaultValue: 0, min: 0, max: 20, step: 1, help: "0 = 自動依桌長算（每 150mm 一條）", dependsOn: { key: "withSlatRack", equals: true } },
  { group: "stretcher", type: "number", key: "slatWidth", label: "置物條寬", defaultValue: 35, unit: "mm", min: 15, max: 100, step: 5, dependsOn: { key: "withSlatRack", equals: true } },
  { group: "stretcher", type: "number", key: "slatThickness", label: "置物條厚", defaultValue: 18, unit: "mm", min: 8, max: 40, step: 1, dependsOn: { key: "withSlatRack", equals: true } },
  { group: "leg", type: "number", key: "legInset", label: "桌腳內縮", defaultValue: 0, unit: "mm", min: 0, max: 300, step: 5 },
  { group: "apron", type: "number", key: "apronOffset", label: "牙條距桌面", defaultValue: 0, unit: "mm", min: 0, max: 200, step: 5, help: "矮桌體量小，10mm 比例較不會牙條飄離" },
  { ...apronEdgeOption("apron", 1), dependsOn: { key: "apronProfile", oneOf: ["none"] } },
  { ...apronEdgeStyleOption("apron"), dependsOn: { all: [{ key: "apronEdge", notIn: [0] }, { key: "apronProfile", oneOf: ["none"] }] } },
  ...apronProfileOptions("apron"),
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地高", defaultValue: 0, unit: "mm", min: 0, max: 400, step: 10, dependsOn: { key: "withLowerStretchers", equals: true } },
];

export const lowTable: FurnitureTemplate = (input) => {
  const locale = input.locale ?? "zh-TW";
  const isEn = locale === "en";
  const o = lowTableOptions;
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const topThickness = getOption<number>(input, opt(o, "topThickness"));
  const seatEdge = getOption<number>(input, opt(o, "seatEdge"));
  const seatEdgeStyle = getOption<string>(input, opt(o, "seatEdgeStyle"));
  const legEdge = getOption<number>(input, opt(o, "legEdge"));
  const legEdgeStyle = getOption<string>(input, opt(o, "legEdgeStyle"));
  const stretcherEdge = getOption<number>(input, opt(o, "stretcherEdge"));
  const stretcherEdgeStyle = getOption<string>(input, opt(o, "stretcherEdgeStyle"));
  const apronEdge = getOption<number>(input, opt(o, "apronEdge"));
  const apronEdgeStyle = getOption<string>(input, opt(o, "apronEdgeStyle"));
  const liveEdge = getOption<boolean>(input, opt(o, "liveEdge"));
  const dropLeaf = getOption<string>(input, opt(o, "dropLeaf"));
  const dropLeafWidth = getOption<number>(input, opt(o, "dropLeafWidth"));
  const apronWidth = getOption<number>(input, opt(o, "apronWidth"));
  const legPenetratingTenon = getOption<boolean>(input, opt(o, "legPenetratingTenon"));
  const withCenterStretcher = getOption<boolean>(input, opt(o, "withCenterStretcher"));
  const withLowerStretchers = getOption<boolean>(input, opt(o, "withLowerStretchers"));
  const withSlatRack = getOption<boolean>(input, opt(o, "withSlatRack"));
  const slatCount = getOption<number>(input, opt(o, "slatCount"));
  const slatWidth = getOption<number>(input, opt(o, "slatWidth"));
  const slatThickness = getOption<number>(input, opt(o, "slatThickness"));
  const legInsetRaw = getOption<number>(input, opt(o, "legInset"));
  const { outline: seatOutline, params: seatOutlineParams } = readSeatOutlineParams(input, o);
  // 滿版圓／橢圓桌面：自動抬高桌腳內縮讓腳（含頂榫）落在橢圓內、防露榫
  const _legInsetWanted = (seatOutline === "oval" || seatOutline === "petal") && !liveEdge && dropLeaf === "none"
    ? ovalMinLegInset(input.length, input.width, legInsetRaw, 5 + (seatOutline === "petal" ? seatOutlineParams.sizeMm : 0))
    : legInsetRaw;
  /**
   * 🧷 夾住腳內縮 —— 否則牙條會被算成**負長度**。
   *
   * §A10.2:`visible.length = length − 2×legSize − 2×legInset (+2×splay)`。
   * doc 沒給 legInset 上限,而 OptionSpec 的 max 是**寫死的常數**(150~400)跟家具尺寸無關,
   * 小尺寸家具把滑桿拉到底就會產出負長度的牙條 —— 完全沒有警告,
   * 負值一路流進材料單、裁切與報價(負材積、負價格)。
   * (2026-08-21 稽核只報了「床頭櫃抽屜」一條;實際全掃發現 10 個模板都中。)
   *
   * ⚠️ 夾的是**輸入**不是輸出:把零件長度夾成 0 只會生出沒厚度的鬼零件,
   *    使用者看不出哪裡不對;夾內縮量則是「拉到底就是貼著極限」,畫面看得見也做得出來。
   */
  const legInset = clampLegInset(_legInsetWanted, {
    length: input.length,
    width: input.width,
    legW: legSize,
    legD: legSize,
  });
  const apronOffset = getOption<number>(input, opt(o, "apronOffset"));
  const lowerStretcherHeight = getOption<number>(input, opt(o, "lowerStretcherHeight"));
  const design = simpleTable({
    category: "low-table",
    nameZh: "矮桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    legPenetratingTenon,
    withCenterStretcher,
    withLowerStretchers,
    withSlatRack,
    slatCount,
    slatWidth,
    slatThickness,
    legInset,
    apronOffset,
    lowerStretcherHeight: lowerStretcherHeight > 0 ? lowerStretcherHeight : undefined,
    legShape: legShape as "box" | "tapered" | "splayed" | "splayed-length" | "splayed-width" | "curved-taper",
    ctBlockHeight: getOption<number>(input, opt(o, "ctBlockHeight")),
    ctShoulder: getOption<number>(input, opt(o, "ctShoulder")),
    ctInset: getOption<number>(input, opt(o, "ctInset")),
    ctSplay: getOption<number>(input, opt(o, "ctSplay")),
    seatEdge,
    seatEdgeStyle,
    legEdge,
    legEdgeStyle,
    stretcherEdge,
    stretcherEdgeStyle,
    apronEdge,
    apronEdgeStyle,
    apronProfile: getOption<string>(input, opt(o, "apronProfile")) as "none" | "arch" | "arch-out" | "kunmen" | "wave" | "double-arch",
    apronProfileDepth: getOption<number>(input, opt(o, "apronProfileDepth")),
    stretcherProfile: getOption<string>(input, opt(o, "stretcherProfile")) as "none" | "arch" | "top-arch" | "kunmen" | "wave" | "double-arch",
    stretcherProfileDepth: getOption<number>(input, opt(o, "stretcherProfileDepth")),
    liveEdge,
    dropLeaf: dropLeaf as "none" | "one-side" | "two-sides",
    dropLeafWidth,
    notes: isEn
      ? `Tatami / floor table; sit-on-floor height ~350 mm (13-3/4").${liveEdge ? " Live edge." : ""}${dropLeaf !== "none" ? ` Includes ${dropLeaf === "one-side" ? "one-side" : "two-side"} drop leaf (each ${formatMm(dropLeafWidth, "inch")} wide).` : ""}`
      : `和室矮桌、地板桌；席地而坐高度約 350mm。${liveEdge ? " Live edge 原木邊。" : ""}${dropLeaf !== "none" ? ` 含${dropLeaf === "one-side" ? "單" : "雙"}側翻板（每片 ${dropLeafWidth}mm 寬）。` : ""}`,
  });

  // 桌面俯視輪廓造型：對 top part 的「最終榫眼」clamp 後套用
  // （octagon/arch 縮尺寸防露榫;oval 塞不下退方形＋警告;liveEdge 已由 UI 互斥）
  if (!liveEdge && dropLeaf === "none" && seatOutline !== "rect") {
    const topPartOutline = design.parts.find((p) => p.id === "top");
    if (topPartOutline) {
      const resolvedOutline = resolveTopOutlineShape(
        seatOutline,
        seatOutlineParams,
        topPartOutline.visible.length,
        topPartOutline.visible.width,
        topPartOutline.mortises,
      );
      if (resolvedOutline !== null) {
        topPartOutline.shape = resolvedOutline;
        design.notes += seatOutlineNote(seatOutline, resolvedOutline.sizeMm, locale, "桌面");
      } else {
        appendWarnings(design, [
          isEn
            ? "The full-span curved top outline (oval / petal) conflicts with existing top mortises — reverted to a rectangular top. Increase leg inset to enable it."
            : "滿版曲線桌面（圓／橢圓／海棠）與桌面既有榫眼衝突，已退回方形。加大「桌腳內縮」即可啟用。",
        ]);
      }
    }
  }

  applyStandardChecks(design, {
    minLength: 500, minWidth: 400, minHeight: 250,
    maxLength: 1400, maxWidth: 1000, maxHeight: 450,
  });
  if (input.height > 450) {
    appendSuggestion(design, {
      text: `桌高 ${input.height}mm 已超過矮桌範圍——餐桌模板適合站立 / 坐椅高度。`,
      suggestedCategory: "dining-table",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};
