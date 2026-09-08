import type {
  FurnitureDesign,
  FurnitureTemplate,
  Mortise,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { sidePanelQuad } from "@/lib/render/quad-profile";

/**
 * 技術士技能檢定 家具木工 丙級 術科試題 01200-100301（練習範本）
 *
 * ⭐ 這是**照官方試題公開尺寸自己畫的練習範本**，不是官方圖面的重製。
 *    官方應檢參考資料（勞動部勞動力發展署技能檢定中心，試題編號 01200-100301-3，
 *    最新修訂 114/06/18）請至 owinform.wdasec.gov.tw 下載，應檢一律以官方版本為準。
 *
 * ── 圖面判讀紀錄（2026-09-07，600dpi 逐區放大，B-B 正視 × A-A 剖面 × 材料表交叉驗證）──
 * 側板（A-A 外形線）：背緣垂直 350；上緣往前**下降 30**；底緣往前**上升 15**；
 *   上緣深 120、底緣深 95 → 四邊各不相同的四邊形（不是梯形）。
 * 背橫檔（A-A 左上 18×50 剖面，兩個 Ø8 孔）：18 厚、50 高、立在背側，頂端離側板頂 15，
 *   木釘距頂 30 與 40。
 * 上層板（A-A 18×100 橫向剖面）：18 厚、深 100，頂面離側板頂 65；
 *   兩端**貫穿榫**穿過側板再凸出 10（B-B 的 320＝300＋10＋10，端頭圓弧＝圖上 3×45°），
 *   剖面 20|20|30|20 中交叉線兩段＝**雙榫頭各 20 寬**（離背 20–40、70–90）。
 * 下橫檔（A-A 18×80 剖面，Ø8×30）：18 厚、深 80，頂面離地 80；木釘離背 20、65；
 *   B-B 右側虛線 18|12 ＝ 木釘 30 長：18 在橫檔、12 在側板 → **木釘接（不是榫）**。
 * 前擋條（A-A 右下 12×18 R3）：12 深 × 18 高，底離地 15（正好是底緣斜線升到前端的高度），
 *   B-B 右下虛線＝插入側板的短榫。
 * 6mm 夾板（A-A 左側 6 寬直條）：在**背側**、上層板下緣到下橫檔上緣之間（B-B 虛線框 187 高），
 *   嵌進側板背緣 6 深的溝，Ø3×15 木螺釘 10 支固定（B-B 標註 cns1051＝10 支）。
 * 材料表對帳：側板 2×(350×120) ← 750×125 ✓；橫檔 4 支 ≤ 650×110 ×2 ✓；夾板 ≤ 300×260 ✓。
 * ⚠️ 木釘：圖上數到 8 支（背橫檔 4、下橫檔 4），材料表給 12，其餘 4 支圖面未標位置。
 * ⚠️ 下橫檔頂面「80」與 15+18+30+18＝81 差 1mm，取圖上直接標註的 80。
 */

/** 官方試題尺寸（mm）。預設值＝考題原尺寸；滑桿只是讓人放大練習用 */
const EXAM = {
  overallW: 320,   // 含兩端榫頭凸出各 10
  topDepth: 120,
  height: 350,
  boardT: 18,
  bottomDepth: 95,
  topDropFront: 30,
  bottomRiseFront: 15,
  span: 264,       // 兩側板內距
  tenonProud: 10,
  backRailH: 50,
  backRailFromTop: 15,
  backRailDowelsFromTop: [30, 40],
  shelfDepth: 100,
  shelfTopFromTop: 65,
  shelfTenonW: 20,
  shelfTenonFromBack: [20, 70],   // 各 20 寬 → 20–40、70–90
  lowerRailDepth: 80,
  lowerRailTopFromBottom: 80,
  lowerRailDowelsFromBack: [20, 65],
  lipDepth: 12,
  lipH: 18,
  lipBottomFromBottom: 15,
  lipFrontSetback: 3,             // A-A 標 6 / 3：前擋條前面離側板前緣 3
  plyT: 6,
  plyRebate: 6,
  dowelDia: 8,
  dowelLen: 30,
  dowelIntoPanel: 12,
  screwSpec: "Ø3×15（CNS1051）×10",
} as const;

export const certC1Options: OptionSpec[] = [
  {
    group: "structure",
    type: "number",
    key: "tenonProud",
    label: "上層板貫穿榫凸出",
    defaultValue: EXAM.tenonProud,
    min: 0,
    max: 15,
    step: 1,
    unit: "mm",
    help: "試題規定榫頭穿過 18mm 側板後再凸出 10mm（總寬 320＝300＋10＋10），端頭倒 3×45°。改成 0 就是齊平的通榫，練習用",
  },
  {
    group: "structure",
    type: "checkbox",
    key: "withPanel",
    label: "裝 6mm 夾板背板",
    defaultValue: true,
    help: "試題規定要裝（材料表第 3 項，本題用 1 片）。取消只是為了看清楚骨架，應檢一定要裝",
  },
];

export const certC1: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certC1Options;
  const proud = getOption<number>(input, opt(o, "tenonProud"));
  const withPanel = getOption<boolean>(input, opt(o, "withPanel"));

  const T = EXAM.boardT;
  // 主尺寸跟著滑桿走（預設＝考題）；各構件相對位置維持試題的絕對 mm 數
  // 下限夾在讀值這一行（§A10.11）：深度 < 90 下橫檔（深−35）擺不下兩支相隔 ≥20 的木釘、層板擺不下兩支榫；
  // 高 < 200 層板底會壓到下橫檔；寬度至少要放得下 60 的淨跨。夾了要出聲——下面 warnings 會講。
  const MIN_DEPTH = 90, MIN_HEIGHT = 200;
  const minLength = 60 + 2 * T + 2 * proud;
  const H = Math.max(MIN_HEIGHT, input.height);
  const topDepth = Math.max(MIN_DEPTH, input.width);
  const overallW = Math.max(minLength, input.length);
  const span = overallW - 2 * T - 2 * proud;
  const bottomDepth = Math.max(40, topDepth - (EXAM.topDepth - EXAM.bottomDepth));
  const shelfDepth = Math.min(EXAM.shelfDepth, topDepth - 10);
  const lowerRailDepth = Math.min(EXAM.lowerRailDepth, bottomDepth - 10);
  // 靠前那支榫／木釘的位置跟著實際深度走（考題：層板 100 深榫在 70＝深−30；下橫檔 80 深木釘在 65＝深−15）。
  // 深度縮小時若還用考題常數，榫眼會開到料外（實測 width=80 時 rail-lower 木釘孔 z=42.5 超出 ±22.5）。
  const shelfTenonFromBack: readonly [number, number] = [EXAM.shelfTenonFromBack[0], shelfDepth - (EXAM.shelfDepth - EXAM.shelfTenonFromBack[1])];
  const lowerRailDowelsFromBack: readonly [number, number] = [EXAM.lowerRailDowelsFromBack[0], lowerRailDepth - (EXAM.lowerRailDepth - EXAM.lowerRailDowelsFromBack[1])];

  /** 世界座標：X 左右、Y 上（origin.y＝底）、Z 前後，**−Z＝背（垂直邊）** */
  const zBack = -topDepth / 2;
  const parts: Part[] = [];
  const warnings: string[] = [];

  /**
   * 側板本地座標（rotation x=π/2, y=π/2）——用 lib/assembly/joint-world 的 rotateXYZ 實測：
   *   local x（深度）**鏡像**到世界 z：local +60 → 世界 z=−60（背）
   *   local z（高度）→ 世界 y：local −175 → y=350（頂）
   *   local y（厚度）→ 世界 x：local y=18 那面在 origin.x+9
   * 所以：背緣放 local +x（sidePanelQuad backSide="max"）、離背 d 的東西在 local x = +hx − d，
   * 而榫眼要開在**內面**——左側板內面是 local y=18（origin.x+9=−132），右側板內面是 local y=0。
   * ⚠️ 這三條是量出來的，不是推的；改旋轉就要重量（scratchpad 探針 probe-c1-rot.ts）。
   */
  const sideLocalX = (fromBack: number) => topDepth / 2 - fromBack;
  const sideLocalZ = (fromTop: number) => -H / 2 + fromTop;

  // ── 側板 ×2：四邊各不相同的四邊形 ───────────────────────────────────
  const sideCorners = sidePanelQuad({
    lx: topDepth, lz: H, bottomDepth,
    topDropFront: EXAM.topDropFront, bottomRiseFront: EXAM.bottomRiseFront,
    backSide: "max",
  });
  const sideMortises = (innerY: number): Mortise[] => {
    const m: Mortise[] = [];
    // 背橫檔木釘 ×2（Ø8，入側板 12）
    for (const d of EXAM.backRailDowelsFromTop) m.push({
      origin: { x: sideLocalX(T / 2), y: innerY, z: sideLocalZ(EXAM.backRailFromTop + d) },
      depth: EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, back rail" : "Ø8 木釘（背橫檔）",
    });
    // 上層板雙貫穿榫 ×2（20 寬 × 18 厚，穿透）
    for (const fb of shelfTenonFromBack) m.push({
      origin: { x: sideLocalX(fb + EXAM.shelfTenonW / 2), y: innerY, z: sideLocalZ(EXAM.shelfTopFromTop + T / 2) },
      depth: T, length: EXAM.shelfTenonW, width: T, through: true,
      label: isEn ? "through mortise, shelf tenon" : "上層板貫穿榫眼",
    });
    // 下橫檔木釘 ×2
    for (const fb of lowerRailDowelsFromBack) m.push({
      origin: { x: sideLocalX(fb), y: innerY, z: sideLocalZ(H - EXAM.lowerRailTopFromBottom + T / 2) },
      depth: EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, lower rail" : "Ø8 木釘（下橫檔）",
    });
    // 前擋條短榫眼（12 深 × 18 高，插入 12）
    const lipFrontFromBack = bottomDepth - EXAM.lipFrontSetback;
    m.push({
      origin: { x: sideLocalX(lipFrontFromBack - EXAM.lipDepth / 2), y: innerY, z: sideLocalZ(H - EXAM.lipBottomFromBottom - EXAM.lipH / 2) },
      depth: EXAM.lipDepth, length: EXAM.lipDepth, width: EXAM.lipH, through: false,
      label: isEn ? "stub mortise, front lip" : "前擋條短榫眼",
    });
    // 夾板背板入溝（背緣 6 深 × 6 寬，層板下緣到下橫檔上緣）——cosmetic：零件圖要畫、CSG 不挖
    m.push({
      origin: { x: sideLocalX(EXAM.plyT / 2), y: innerY, z: sideLocalZ(EXAM.shelfTopFromTop + T + (H - EXAM.shelfTopFromTop - T - EXAM.lowerRailTopFromBottom) / 2) },
      depth: EXAM.plyRebate, length: EXAM.plyT, width: H - EXAM.shelfTopFromTop - T - EXAM.lowerRailTopFromBottom, through: false, cosmetic: true,
      label: isEn ? "6mm rebate for plywood back" : "夾板背板入溝（6 深）",
    });
    return m;
  };
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "side-left" : "side-right",
      nameZh: sx < 0 ? "左側板" : "右側板",
      nameEn: sx < 0 ? "Side panel (left)" : "Side panel (right)",
      material,
      grainDirection: "width",                       // 木紋順高度（350 長邊）
      visible: { length: topDepth, width: H, thickness: T },
      origin: { x: sx * (span / 2 + T / 2), y: 0, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      shape: { kind: "quad", corners: sideCorners },
      tenons: [],
      mortises: sideMortises(sx < 0 ? T : 0),
    });
  }

  /** 橫檔兩端面的木釘孔（Ø8，入橫檔 18）：origin.x＝±半長，z＝在端面上的位置 */
  const endDowels = (railLen: number, positions: Array<{ y: number; z: number }>, label: string): Mortise[] =>
    ([-1, 1] as const).flatMap((sx) => positions.map((p) => ({
      origin: { x: sx * railLen / 2, y: p.y, z: p.z },
      depth: EXAM.dowelLen - EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia,
      through: false, shape: "round" as const, label,
    })));

  // ── 背橫檔：18 厚 × 50 高，立在背側，頂端離側板頂 15，木釘接 ──────────
  const backRailTop = H - EXAM.backRailFromTop;
  parts.push({
    id: "rail-back-top",
    nameZh: "背橫檔",
    nameEn: "Back top rail",
    material,
    grainDirection: "length",
    visible: { length: span, width: EXAM.backRailH, thickness: T },
    origin: { x: 0, y: backRailTop - EXAM.backRailH, z: zBack + T / 2 },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },      // width 立成高度；local −z＝頂
    tenons: [],
    mortises: endDowels(span,
      EXAM.backRailDowelsFromTop.map((d) => ({ y: T / 2, z: -EXAM.backRailH / 2 + d })),
      isEn ? "Ø8 dowel" : "Ø8 木釘"),
  });

  // ── 上層板：18 厚 × 深 100，頂面離側板頂 65，雙貫穿榫凸出 proud ────────
  const shelfTopY = H - EXAM.shelfTopFromTop;
  const shelfCenterZ = zBack + shelfDepth / 2;
  parts.push({
    id: "shelf",
    nameZh: "上層板",
    nameEn: "Top shelf",
    material,
    grainDirection: "length",
    visible: { length: span, width: shelfDepth, thickness: T },
    origin: { x: 0, y: shelfTopY - T, z: shelfCenterZ },
    tenons: (["start", "end"] as const).flatMap((position) =>
      shelfTenonFromBack.map((fb) => ({
        position,
        type: "through-tenon" as const,
        length: T + proud,
        width: EXAM.shelfTenonW,
        thickness: T,
        shoulderOn: ["left", "right"] as Array<"left" | "right">,   // 上下齊平（榫頭＝整個板厚）
        offsetWidth: (zBack + fb + EXAM.shelfTenonW / 2) - shelfCenterZ,
      })),
    ),
    mortises: [],
  });

  // ── 下橫檔：18 厚 × 深 80，頂面離地 80，木釘接 ─────────────────────────
  const lowerRailCenterZ = zBack + lowerRailDepth / 2;
  parts.push({
    id: "rail-lower",
    nameZh: "下橫檔",
    nameEn: "Lower rail",
    material,
    grainDirection: "length",
    visible: { length: span, width: lowerRailDepth, thickness: T },
    origin: { x: 0, y: EXAM.lowerRailTopFromBottom - T, z: lowerRailCenterZ },
    tenons: [],
    mortises: endDowels(span,
      lowerRailDowelsFromBack.map((fb) => ({ y: T / 2, z: (zBack + fb) - lowerRailCenterZ })),
      isEn ? "Ø8 dowel" : "Ø8 木釘"),
  });

  // ── 木釘 ×8：Ø8×30 現成木釘，18 入橫檔端面、12 入側板內面（考場供料 12 支，圖上用 8 支）──
  // 真的做成零件插在孔裡（不是只挖孔）：3D 組裝看得到、材料單另列；不入裁切 / 零件圖。
  // 位置＝橫檔端面孔位的世界座標：x 跨過側板內面（span/2），朝外多 12（入側板）、朝內 18（入橫檔）。
  const dowelSpots: Array<{ y: number; z: number; rail: "back" | "lower" }> = [
    ...EXAM.backRailDowelsFromTop.map((d) => ({ y: backRailTop - d, z: zBack + T / 2, rail: "back" as const })),
    ...lowerRailDowelsFromBack.map((fb) => ({ y: EXAM.lowerRailTopFromBottom - T / 2, z: zBack + fb, rail: "lower" as const })),
  ];
  for (const sx of [-1, 1] as const) {
    dowelSpots.forEach((s, i) => {
      parts.push({
        id: `dowel-${sx < 0 ? "l" : "r"}-${s.rail}-${i % 2 + 1}`,
        nameZh: `木釘 Ø${EXAM.dowelDia}×${EXAM.dowelLen}（${s.rail === "back" ? "背橫檔" : "下橫檔"}）`,
        nameEn: `Dowel Ø${EXAM.dowelDia}×${EXAM.dowelLen} (${s.rail === "back" ? "back rail" : "lower rail"})`,
        material,
        grainDirection: "length",
        visible: { length: EXAM.dowelLen, width: EXAM.dowelDia, thickness: EXAM.dowelDia },
        // 中心＝側板內面往外 (12 − 18)/2 = −3 → 18 在橫檔內、12 在側板內
        origin: { x: sx * (span / 2 + (EXAM.dowelIntoPanel - (EXAM.dowelLen - EXAM.dowelIntoPanel)) / 2), y: s.y - EXAM.dowelDia / 2, z: s.z },
        shape: { kind: "round", axis: "x" },
        visual: "dowel",
        tenons: [],
        mortises: [],
      });
    });
  }

  // ── 前擋條：12 深 × 18 高，底離地 15，前面離側板前緣 3，短榫入側板 12 ──
  const lipFrontZ = zBack + bottomDepth - EXAM.lipFrontSetback;
  parts.push({
    id: "front-lip",
    nameZh: "前擋條",
    nameEn: "Front lip",
    material,
    grainDirection: "length",
    visible: { length: span, width: EXAM.lipDepth, thickness: EXAM.lipH },
    origin: { x: 0, y: EXAM.lipBottomFromBottom, z: lipFrontZ - EXAM.lipDepth / 2 },
    tenons: (["start", "end"] as const).map((position) => ({
      position,
      type: "blind-tenon" as const,
      length: EXAM.lipDepth,
      width: EXAM.lipDepth,
      thickness: EXAM.lipH,
      shoulderOn: [] as Array<"top" | "bottom" | "left" | "right">,   // 整個斷面插入，無肩
    })),
    mortises: [],
  });

  // ── 6mm 夾板背板：上層板下緣 → 下橫檔上緣，嵌側板背緣 6 深溝，木螺釘固定 ──
  if (withPanel) {
    const plyTop = shelfTopY - T;
    const plyBottom = EXAM.lowerRailTopFromBottom;
    const plyH = plyTop - plyBottom;
    parts.push({
      id: "back-panel",
      nameZh: "夾板背板（6mm）",
      nameEn: "Plywood back (6mm)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: { length: span + 2 * EXAM.plyRebate, width: plyH, thickness: EXAM.plyT },
      origin: { x: 0, y: plyBottom, z: zBack + EXAM.plyT / 2 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 非考題尺寸就出聲 ───────────────────────────────────────────────
  if (H !== input.height || topDepth !== input.width || overallW !== input.length) {
    warnings.push(isEn
      ? `Too small to build: clamped to ${overallW}×${topDepth}×${H} mm (minimum ${minLength}×${MIN_DEPTH}×${MIN_HEIGHT}).`
      : `尺寸太小做不出來：已夾到 ${overallW}×${topDepth}×${H}mm（下限 ${minLength}×${MIN_DEPTH}×${MIN_HEIGHT}）。`);
  }
  if (overallW !== EXAM.overallW || topDepth !== EXAM.topDepth || H !== EXAM.height) {
    warnings.push(isEn
      ? `Not the exam size: the official piece is ${EXAM.overallW}×${EXAM.topDepth}×${EXAM.height} mm (you have ${overallW}×${topDepth}×${H}). Fine for practice, but test day is the official size.`
      : `不是考題尺寸：官方試題是 ${EXAM.overallW}×${EXAM.topDepth}×${EXAM.height}mm（目前 ${overallW}×${topDepth}×${H}）。練習可以，應檢要照官方尺寸。`);
  }
  if (proud !== EXAM.tenonProud) {
    warnings.push(isEn
      ? `Exam tenons stand ${EXAM.tenonProud}mm proud (you set ${proud}).`
      : `試題榫頭凸出 ${EXAM.tenonProud}mm（目前 ${proud}）。`);
  }

  const design: FurnitureDesign = {
    id: `cert-c1-${overallW}x${topDepth}x${H}`,
    category: "cert-c1",
    nameZh: "家具木工丙級 第一題（01200-100301）",
    overall: { length: overallW, width: topDepth, thickness: H },
    parts,
    defaultJoinery: "through-tenon",
    useButtJointConvention: true,
    joineryOnly: true,                            // 沒有組裝版：toBeginnerMode 不得拆榫（木釘孔拆掉木釘就穿模）
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class C furniture-woodworking trade test, question 01200-100301 (4 hours: 3 h + 1 h). What it trains: **side panels with four different edges** (back edge vertical 350, top edge drops 30 toward the front, bottom edge rises 15, depth 120 → 95), **twin through tenons** on the shelf standing ${proud}mm proud with 3×45° chamfered ends, **dowel joints** (Ø8×30, 18 into the rail / 12 into the panel) on the back rail and lower rail, a stub-tenoned front lip (12×18, R3), and a **6mm plywood back** in a 6mm rebate fixed with ${EXAM.screwSpec}. Official stock per candidate: 750×125×18.5 ×1, 650×110×18.5 ×2, 6mm plywood 300×260, Ø8×30 dowels ×12, screws ×10, PVA glue; spruce / pine / lauan or similar knot-free wood, planed square on four faces. **Drawn from published dimensions — download the official paper from the Workforce Development Agency and follow that version on test day.**`
      : `依技術士技能檢定家具木工丙級術科試題 01200-100301（4 小時：測試 3 小時＋1 小時）公開尺寸繪製的練習範本。這題練的是：**四邊各不相同的側板**（背緣垂直 350、上緣往前降 30、底緣往前升 15、深 120 收到 95）、上層板**雙貫穿榫**凸出 ${proud}mm 端頭倒 3×45°、背橫檔與下橫檔的**木釘接**（Ø8×30，入橫檔 18、入側板 12）、前擋條短榫（12×18、R3 圓角）、以及嵌進背緣 6mm 溝的**夾板背板**（${EXAM.screwSpec} 固定）。官方材料（每人份）：木料 750×125×18.5 ×1、650×110×18.5 ×2、夾板 300×260×6、Ø8×30 木釘 ×12、木螺釘 ×10、白膠；木材限雲杉／松木／柳安或同硬度無節木料，四面鉋光要求直角。**本圖依公開尺寸自行繪製，應檢請以技能檢定中心公布的官方版本為準。**`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};
