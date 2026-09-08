import type {
  FurnitureDesign,
  FurnitureTemplate,
  Mortise,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import type { QuadCorners } from "@/lib/render/quad-profile";

/**
 * 技術士技能檢定 家具木工 丙級 術科試題 01200-100303（練習範本）
 *
 * ⭐ 照官方試題公開尺寸自己畫的練習範本，不是官方圖面的重製。
 *    官方應檢參考資料（試題編號 01200-100301-3，最新修訂 114/06/18）請至 owinform.wdasec.gov.tw 下載，
 *    應檢一律以官方版本為準。
 *
 * ── 圖面判讀紀錄（2026-09-08，300dpi 逐區放大 ×2，A-A 剖面 × B-B 正視 × 小三視圖 × 評審表交叉驗證）──
 * 這是一件**前後兩截、中間留 10mm 縫的斜頂小架**（300 寬 × 240 深 × 後 230／前 105 高）：
 * 每一側的側板都是前後兩片（各 115 深），中間隔 10 的縫，用 Ø8×30 木釘（各入 10、縫裡露 10）連起來——
 * 評審表「側板間隙 10±0.5」4 部位就是在量這條縫。
 *
 * 側板（A-A 外形、小側視圖）：頂邊從背緣頂 230 先**平 18**，再一直線斜到前端 105（斜率 125/222）；
 *   後片 115 深、前片 115 深、縫 10 → 240。底緣離地：兩片各在外端保留 50 平踩地，中段往上收 5（5×45° 過渡）。
 * 後橫板（A-A 左上 18×50 剖面）：18 深 × 50 高，貼背緣、頂端離側板頂 25（評審表「底板距背後橫板高 117」＝
 *   底板頂面 38 到橫板底 155），木釘離橫板頂 14、36（B-B 右上虛線 18|12：18 在橫板、12 在側板）。
 * 後底板（A-A 左下 105 深剖面）：18 厚、離地 20、深 105；兩端**雙貫穿榫**各 12 寬，離背 15–27、83–95
 *   （剖面上的交叉線），榫頭齊平（總寬 300＝18+264+18，不像第一題凸出）；前端 3×45° 倒角。
 * 前底板（A-A 右下 95 深剖面）：18 厚、離地 20、深 95；兩端各 2 支木釘離其後緣 20、75；前端 3×45°。
 * 連接木釘（A-A 中段 10|10、B-B 左側 Ø8×30 圓圈離地 29 與 129）：每側 2 支，沿深度方向穿過縫，
 *   後片入 10、縫 10、前片入 10。
 * 夾板背板（A-A 左側 6 寬直條、B-B 橫板底下那條「12」虛線）：6mm、與背緣齊平，**上端進後橫板 12、下端進後底板 12**
 *   （橫板背底角、底板背頂角各開 6×12 缺口——評審表「背板嵌槽 4 部位」＝兩側板溝＋兩個缺口），
 *   嵌側板背緣 6 深溝，木螺釘 10 支（圖面標 ø3×15 cns1051=10支；材料表寫 Ø2.4×15，以現場發的為準）。
 *   🩸第一版只做到橫板底（背板 129 高、缺口只有底板一個），木工檢查員從 B-B 的「12」抓出來。
 * 木螺釘位置（B-B 的「+」記號換算）：兩側側板柱各 3 支（離地約 161、97、29）、後橫板 2 支（離地 161，離側板內面約 88）、
 *   後底板 2 支（離地 29，同位置）＝10。
 * 木釘對帳：後橫板 4 ＋ 前底板 4 ＋ 連接 4 ＝ 12 ＝ 材料表 12 ✓；夾板 1 片（288×141 ≤ 300×260）✓。
 * 評審表：寬 300 / 深 240 / 高 230/105 / 底板寬 95/105 / 側板寬 115／後橫板寬 50 / 117 / 板厚 18 全部對得上。
 * ⚠️ 未做成造型（只在說明提醒）：底緣踩腳（後片背端 50 平踩地、往前 5×45° 收上 5 到縫；前片縫側收 5、前端 50 平踩地）；
 *   底板倒角（後底板只有前端＝縫側上下兩角 3×45°，背端方正；前底板**兩端**上下四角都 3×45°）。
 * ⚠️ 排料：四片側板照直排 230+230+169.8+169.8＝800 > 750，一定要**頭尾對調套排**（兩片後片斜線互為鋸線 ≈419，
 *   兩片前片梯形套排 ≈278，合計 720 ≤ 750）；後底板 300×105 與前底板 264×95 一支 650×110、後橫板另一支。
 * ⚠️ 前片側板後緣高 169.8、後片前緣高 175.4 是斜線算出來的（圖上未直接標）。
 */

const EXAM = {
  overallW: 300,
  depth: 240,
  heightBack: 230,
  heightFront: 105,
  boardT: 18,
  span: 264,
  pieceDepth: 115,
  gap: 10,
  topFlat: 18,               // 背緣頂端平段
  railH: 50,
  railTopFromTop: 25,
  railDowelsFromTop: [14, 36],
  railToBoard: 117,
  boardBottomFromFloor: 20,
  backBoardDepth: 105,
  backBoardTenonW: 12,
  backBoardTenonsFromBack: [15, 83],   // 各 12 寬 → 15–27、83–95
  frontBoardDepth: 95,
  frontBoardFromGap: 10,             // 前底板後緣離前片後緣 10（A-A 底部「10」），前端也離前緣 10
  frontBoardDowelsFromBack: [20, 75],
  linkDowelHeights: [29, 129],
  footFlat: 50,
  footRelief: 5,
  plyT: 6,
  plyRebateDeep: 6,      // 側板背緣 rebate：6 深（沿深度）
  plyRebateWide: 12,     // × 12 寬（沿板厚，從內面量；外側留 6 唇）——B-B 夾板隱藏線離側板外面 5.9
  plyIntoBoard: 12,
  dowelDia: 8,
  dowelLen: 30,
  dowelIntoPanel: 12,
  screwSpec: "木螺釘 ×10（圖面標 Ø3×15、材料表寫 Ø2.4×15，同為 CNS1051，以現場發的為準）",
} as const;

export const certC3Options: OptionSpec[] = [
  {
    group: "structure",
    type: "number",
    key: "sideGap",
    label: "側板間隙",
    defaultValue: EXAM.gap,
    min: 4,
    max: 20,
    step: 1,
    unit: "mm",
    help: "前後兩片側板中間的縫，試題規定 10±0.5（評審表 4 部位各 1 分）。連接木釘 30 長：縫愈大入板愈淺",
  },
  {
    group: "structure",
    type: "checkbox",
    key: "withBack",
    label: "裝 6mm 夾板背板",
    defaultValue: true,
    help: "試題規定要裝（本題用 1 片）。取消只是為了看清楚骨架，應檢一定要裝",
  },
];

export const certC3: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certC3Options;
  const gap = getOption<number>(input, opt(o, "sideGap"));
  const withBack = getOption<boolean>(input, opt(o, "withBack"));

  const T = EXAM.boardT;
  // 下限（審查員實測 H=160 後橫板浮在側板上方、D=200 前底板伸出前片）：後橫板／底板／連接木釘的高度與
  // 前底板深度都是考題常數，所以高不能低於 230、深不能低於 115＋縫＋95
  const MIN_DEPTH = EXAM.pieceDepth + gap + EXAM.frontBoardDepth, MIN_HEIGHT = EXAM.heightBack, minLength = 2 * T + 60;
  const H = Math.max(MIN_HEIGHT, input.height);           // 背緣高
  const depth = Math.max(MIN_DEPTH, input.width);
  const overallW = Math.max(minLength, input.length);
  const span = overallW - 2 * T;
  const backDepth = EXAM.pieceDepth;                        // 後片固定 115（評審表量）
  const frontDepth = depth - backDepth - gap;               // 前片：考題 115
  const frontH = Math.max(60, EXAM.heightFront + (H - EXAM.heightBack));   // 前端高跟著背緣高平移

  /** 世界座標：X 左右、Y 上（y=0＝地）、Z 前後，**+Z＝背**（app 慣例：+Z 背、正視從 −Z 看）；離背 d 在 z = zBack − d */
  const zBack = depth / 2;
  const zSplit = zBack - backDepth;                          // 後片前緣
  const zFrontStart = zSplit - gap;                          // 前片後緣
  const zFront = -depth / 2;
  /** 頂邊：背緣頂 H 平 18 再直線斜到前端 frontH */
  const topAt = (z: number) => {
    const zFlatEnd = zBack - EXAM.topFlat;
    if (z >= zFlatEnd) return H;
    return H - (H - frontH) * ((zFlatEnd - z) / (zFlatEnd - zFront));
  };
  const backPieceFrontH = topAt(zSplit);     // 175.4
  const frontPieceBackH = topAt(zFrontStart); // 169.8
  const parts: Part[] = [];
  const warnings: string[] = [];

  const boardBottomY = EXAM.boardBottomFromFloor;
  const boardTopY = boardBottomY + T;                        // 38
  const boardMidY = boardBottomY + T / 2;                    // 29
  const railBottomY = boardTopY + EXAM.railToBoard;          // 155
  const railTopY = railBottomY + EXAM.railH;                 // 205（＝H−25）
  const linkInto = (EXAM.dowelLen - gap) / 2;                // 連接木釘入每片：考題 10
  if (linkInto < EXAM.dowelDia) warnings.push(isEn ? `Side gap ${gap} leaves only ${linkInto.toFixed(1)} mm of dowel in each piece.` : `側板間隙 ${gap} 讓連接木釘每側只剩 ${linkInto.toFixed(1)}mm，會鬆。`);

  // ── 側板：後片（五角：頂邊平 18 再斜）、前片（四角）──────────────────
  // 本地座標同 cert-c1：rotation x=π/2,y=π/2 → local −x＝背（世界 +z）、local +x＝前、local −z＝頂
  const backHx = backDepth / 2, backHz = H / 2;
  const backCorners: QuadCorners = [
    [-backHx, -backHz],                           // 背上 230
    [backHx, -backHz + (H - backPieceFrontH)],    // 前上（縫側，高 175.4）
    [backHx, backHz],                             // 前下
    [-backHx, backHz],                            // 背下
  ];
  const backTopBreak: [number, number] = [-backHx + EXAM.topFlat, -backHz];   // 頂邊平段止點（離背 18）
  const frontHx = frontDepth / 2, frontHz = frontPieceBackH / 2;
  const frontCorners: QuadCorners = [
    [-frontHx, -frontHz],                               // 背上（縫側，169.8）
    [frontHx, -frontHz + (frontPieceBackH - frontH)],   // 前上（105）
    [frontHx, frontHz],
    [-frontHx, frontHz],
  ];
  const backLocalX = (fromBack: number) => -backHx + fromBack;         // 後片：離背緣
  const backLocalZ = (fromTop: number) => -backHz + fromTop;           // 後片：離 230 頂
  const frontLocalX = (fromRear: number) => -frontHx + fromRear;       // 前片：離其後緣（縫側）
  const frontLocalZ = (fromTop: number) => -frontHz + fromTop;         // 前片：離其 169.8 頂
  const plyTop = railBottomY + EXAM.plyIntoBoard, plyBottom = boardTopY - EXAM.plyIntoBoard;   // 上下各進板 12

  const backPieceMortises = (innerY: number): Mortise[] => {
    const m: Mortise[] = [];
    for (const d of EXAM.railDowelsFromTop) m.push({
      origin: { x: backLocalX(T / 2), y: innerY, z: backLocalZ(H - (railTopY - d)) },
      depth: EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, back rail" : "Ø8 木釘（後橫板）",
    });
    for (const fb of EXAM.backBoardTenonsFromBack) m.push({
      origin: { x: backLocalX(fb + EXAM.backBoardTenonW / 2), y: innerY, z: backLocalZ(H - boardMidY) },
      depth: T, length: EXAM.backBoardTenonW, width: T, through: true,
      label: isEn ? "through mortise, back bottom board" : "後底板貫穿榫眼",
    });
    // 連接木釘：在前緣（縫側）端面，沿深度方向
    for (const h of EXAM.linkDowelHeights) m.push({
      origin: { x: backHx, y: T / 2, z: backLocalZ(H - h) },
      depth: linkInto, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 link dowel (front edge)" : "Ø8 連接木釘（前緣）",
    });
    if (withBack) m.push({
      origin: { x: backLocalX(EXAM.plyRebateDeep / 2), y: innerY, z: backLocalZ(H - (plyTop + plyBottom) / 2) },
      depth: EXAM.plyRebateWide, length: EXAM.plyRebateDeep, width: plyTop - plyBottom, through: false, cosmetic: true,
      label: isEn ? "rebate for plywood back, 6 deep × 12 wide" : "夾板背板 rebate（6 深 × 12 寬）",
    });
    return m;
  };
  const frontPieceMortises = (innerY: number): Mortise[] => {
    const m: Mortise[] = [];
    for (const fb of EXAM.frontBoardDowelsFromBack) m.push({
      origin: { x: frontLocalX(EXAM.frontBoardFromGap + fb), y: innerY, z: frontLocalZ(frontPieceBackH - boardMidY) },
      depth: EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, front bottom board" : "Ø8 木釘（前底板）",
    });
    for (const h of EXAM.linkDowelHeights) m.push({
      origin: { x: -frontHx, y: T / 2, z: frontLocalZ(frontPieceBackH - h) },
      depth: linkInto, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 link dowel (back edge)" : "Ø8 連接木釘（後緣）",
    });
    return m;
  };
  for (const sx of [-1, 1] as const) {
    const x = sx * (span / 2 + T / 2);
    const innerY = sx < 0 ? T : 0;
    parts.push({
      id: sx < 0 ? "side-back-left" : "side-back-right",
      nameZh: sx < 0 ? "左側板（後片）" : "右側板（後片）",
      nameEn: sx < 0 ? "Side panel, rear (left)" : "Side panel, rear (right)",
      material,
      grainDirection: "width",
      visible: { length: backDepth, width: H, thickness: T },
      origin: { x, y: 0, z: zBack - backDepth / 2 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      shape: { kind: "quad", corners: backCorners, topBreak: backTopBreak },
      tenons: [],
      mortises: backPieceMortises(innerY),
    });
    parts.push({
      id: sx < 0 ? "side-front-left" : "side-front-right",
      nameZh: sx < 0 ? "左側板（前片）" : "右側板（前片）",
      nameEn: sx < 0 ? "Side panel, front (left)" : "Side panel, front (right)",
      material,
      grainDirection: "width",
      visible: { length: frontDepth, width: frontPieceBackH, thickness: T },
      origin: { x, y: 0, z: zFrontStart - frontDepth / 2 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      shape: { kind: "quad", corners: frontCorners },
      tenons: [],
      mortises: frontPieceMortises(innerY),
    });
  }

  /** 板兩端面的木釘孔（Ø8，入板 18） */
  const endDowels = (len: number, spots: Array<{ y: number; z: number }>, label: string): Mortise[] =>
    ([-1, 1] as const).flatMap((sx) => spots.map((p) => ({
      origin: { x: sx * len / 2, y: p.y, z: p.z },
      depth: EXAM.dowelLen - EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia,
      through: false, shape: "round" as const, label,
    })));

  // ── 後橫板：18 深 × 50 高，貼背緣，頂端離側板頂 25，木釘接 ─────────────
  parts.push({
    id: "rail-back",
    nameZh: "後橫板",
    nameEn: "Back rail",
    material,
    grainDirection: "length",
    visible: { length: span, width: EXAM.railH, thickness: T },
    origin: { x: 0, y: railBottomY, z: zBack - T / 2 },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },      // width 立成高度；local −z＝頂、local y=0 那面＝背
    tenons: [],
    mortises: [
      ...endDowels(span, EXAM.railDowelsFromTop.map((d) => ({ y: T / 2, z: -EXAM.railH / 2 + d })), isEn ? "Ø8 dowel" : "Ø8 木釘"),
      // 背底角 6×12 缺口給夾板進 12（開在底邊面 local +z，靠背面 y=0..6）
      ...(withBack ? [{
        origin: { x: 0, y: T - EXAM.plyT / 2, z: EXAM.railH / 2 }, depth: EXAM.plyIntoBoard, length: span, width: EXAM.plyT,   // rotation x=π/2：local +y＝世界 +z＝背
        through: false, cosmetic: true, label: isEn ? "6×12 notch for plywood back (back-bottom corner)" : "夾板背板缺口（背底角 6×12）",
      }] : []),
    ],
  });

  // ── 後底板：105 深，雙貫穿榫（12 寬，齊平）────────────────────────────
  const backBoardZ = zBack - EXAM.backBoardDepth / 2;
  parts.push({
    id: "board-back",
    nameZh: "後底板",
    nameEn: "Rear bottom board",
    material,
    grainDirection: "length",
    visible: { length: span, width: EXAM.backBoardDepth, thickness: T },
    origin: { x: 0, y: boardBottomY, z: backBoardZ },
    tenons: (["start", "end"] as const).flatMap((position) =>
      EXAM.backBoardTenonsFromBack.map((fb) => ({
        position,
        type: "through-tenon" as const,
        length: T,
        width: EXAM.backBoardTenonW,
        thickness: T,
        shoulderOn: ["left", "right"] as Array<"left" | "right">,   // 榫頭＝整個板厚，只有前後肩
        offsetWidth: (zBack - fb - EXAM.backBoardTenonW / 2) - backBoardZ,
      })),
    ),
    mortises: withBack ? [{
      origin: { x: 0, y: T, z: zBack - EXAM.plyT / 2 - backBoardZ }, depth: EXAM.plyIntoBoard, length: span, width: EXAM.plyT,
      through: false, cosmetic: true, label: isEn ? "6×12 notch for plywood back" : "夾板背板缺口（背頂角 6×12）",
    }] : [],
  });

  // ── 前底板：95 深、離前片後緣（縫側）10（A-A 底部的「10」；前端也離前緣 10），木釘離其後緣 20、75 ──
  const frontBoardRearZ = zFrontStart - EXAM.frontBoardFromGap;
  const frontBoardZ = frontBoardRearZ - EXAM.frontBoardDepth / 2;
  parts.push({
    id: "board-front",
    nameZh: "前底板",
    nameEn: "Front bottom board",
    material,
    grainDirection: "length",
    visible: { length: span, width: EXAM.frontBoardDepth, thickness: T },
    origin: { x: 0, y: boardBottomY, z: frontBoardZ },
    tenons: [],
    mortises: endDowels(span, EXAM.frontBoardDowelsFromBack.map((fb) => ({ y: T / 2, z: (frontBoardRearZ - fb) - frontBoardZ })), isEn ? "Ø8 dowel" : "Ø8 木釘"),
  });

  // ── 木釘 12 支：後橫板 4、前底板 4（沿 X）＋ 連接 4（沿 Z，穿過縫）────────
  const dowelX = (sx: -1 | 1) => sx * (span / 2 + (EXAM.dowelIntoPanel - (EXAM.dowelLen - EXAM.dowelIntoPanel)) / 2);
  const xSpots: Array<{ id: string; zh: string; en: string; y: number; z: number }> = [
    ...EXAM.railDowelsFromTop.map((d, i) => ({ id: `rail-${i + 1}`, zh: "後橫板", en: "back rail", y: railTopY - d, z: zBack - T / 2 })),
    ...EXAM.frontBoardDowelsFromBack.map((fb, i) => ({ id: `front-${i + 1}`, zh: "前底板", en: "front bottom board", y: boardMidY, z: frontBoardRearZ - fb })),
  ];
  for (const sx of [-1, 1] as const) {
    for (const s of xSpots) parts.push({
      id: `dowel-${sx < 0 ? "l" : "r"}-${s.id}`,
      nameZh: `木釘 Ø${EXAM.dowelDia}×${EXAM.dowelLen}（${s.zh}）`,
      nameEn: `Dowel Ø${EXAM.dowelDia}×${EXAM.dowelLen} (${s.en})`,
      material, grainDirection: "length",
      visible: { length: EXAM.dowelLen, width: EXAM.dowelDia, thickness: EXAM.dowelDia },
      origin: { x: dowelX(sx), y: s.y - EXAM.dowelDia / 2, z: s.z },
      shape: { kind: "round", axis: "x" }, visual: "dowel", tenons: [], mortises: [],
    });
    EXAM.linkDowelHeights.forEach((h, i) => parts.push({
      id: `dowel-${sx < 0 ? "l" : "r"}-link-${i + 1}`,
      nameZh: `木釘 Ø${EXAM.dowelDia}×${EXAM.dowelLen}（側板連接，縫裡露 ${gap}）`,
      nameEn: `Dowel Ø${EXAM.dowelDia}×${EXAM.dowelLen} (side-panel link, ${gap} exposed in the gap)`,
      material, grainDirection: "length",
      visible: { length: EXAM.dowelDia, width: EXAM.dowelLen, thickness: EXAM.dowelDia },   // 軸沿 z：width 是長度
      origin: { x: sx * (span / 2 + T / 2), y: h - EXAM.dowelDia / 2, z: zSplit - gap / 2 },
      shape: { kind: "round", axis: "z" }, visual: "dowel", tenons: [], mortises: [],
    }));
  }

  // ── 夾板背板：與背緣齊平，後橫板底到後底板頂下 12，嵌側板 6 深溝，木螺釘固定 ──
  if (withBack) {
    parts.push({
      id: "back-panel",
      nameZh: "夾板背板（6mm）",
      nameEn: "Plywood back (6mm)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: { length: span + 2 * EXAM.plyRebateWide, width: plyTop - plyBottom, thickness: EXAM.plyT },
      origin: { x: 0, y: plyBottom, z: zBack - EXAM.plyT / 2 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 出聲 ────────────────────────────────────────────────────────────────
  if (H !== input.height || depth !== input.width || overallW !== input.length) {
    warnings.push(isEn
      ? `Too small to build: clamped to ${overallW}×${depth}×${H} mm (minimum ${minLength}×${MIN_DEPTH}×${MIN_HEIGHT}).`
      : `尺寸太小做不出來：已夾到 ${overallW}×${depth}×${H}mm（下限 ${minLength}×${MIN_DEPTH}×${MIN_HEIGHT}）。`);
  }
  if (overallW !== EXAM.overallW || depth !== EXAM.depth || H !== EXAM.heightBack) {
    warnings.push(isEn
      ? `Not the exam size: the official piece is ${EXAM.overallW}×${EXAM.depth}×${EXAM.heightBack} mm (you have ${overallW}×${depth}×${H}). Fine for practice, but test day is the official size.`
      : `不是考題尺寸：官方試題是 ${EXAM.overallW}×${EXAM.depth}×${EXAM.heightBack}mm（目前 ${overallW}×${depth}×${H}）。練習可以，應檢要照官方尺寸。`);
  }
  if (gap !== EXAM.gap) {
    warnings.push(isEn ? `Exam side gap is ${EXAM.gap} mm (you set ${gap}).` : `試題側板間隙 ${EXAM.gap}mm（目前 ${gap}）。`);
  }

  const design: FurnitureDesign = {
    id: `cert-c3-${overallW}x${depth}x${H}`,
    category: "cert-c3",
    nameZh: "家具木工丙級 第三題（01200-100303）",
    overall: { length: overallW, width: depth, thickness: H },
    parts,
    defaultJoinery: "through-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class C furniture-woodworking trade test, question 01200-100303 (4 hours). A sloping-top rack in two halves: each side panel is two pieces (rear 115 deep, front 115 deep) with a graded **${EXAM.gap} mm gap** between them, tied by **Ø8×30 link dowels** through the gap (10 in each piece, 10 showing); the top edge runs flat 18 mm from the back then straight down to 105 at the front. A dowelled back rail (18×50, 25 below the top), a rear bottom board (105 deep) on **twin flush through tenons** 12 wide, a front bottom board (95 deep) on dowels, both bottom boards 20 off the floor with 3×45° chamfered front ends, and a **6mm plywood back** flush with the back edge, housed 6 mm into the sides, notched 6×12 into the rear board and fixed with ${EXAM.screwSpec}. Twelve dowels are used (rail 4, front board 4, links 4). **Holding the 10 ±0.5 gap:** clamp a 10 mm spacer top and bottom in the gap while gluing each side's two pieces, then remove it and measure both ends. **Ten screws (per view B-B):** three in each side upright (about 161, 97 and 29 off the floor), two in the back rail (161 high, about 88 in from each side) and two in the rear board (29 high, same positions). **Cutting:** the four side pieces only fit the 750×125 board if nested head-to-tail (straight cutting needs 800 > 750). **Not modelled — cut as drawn:** the 5 mm foot relief (rear piece: 50 flat at the back then 5×45° up to the gap; front piece: relieved from the gap, 50 flat at the front) and the chamfers (rear board: gap end only; front board: both ends, 3×45°). The front-board dowel holes sit at the same height (29) as the link dowel, 16 mm apart — drill shallow pilot holes first. Official stock per candidate: 750×125×18.5 ×1, 650×110×18.5 ×2, 6mm plywood 300×260 ×1 for this question, Ø8×30 dowels ×12, wood screws ×10 (the materials list says Ø2.4×15, the drawing Ø3×15 — use what is issued), PVA glue. **Drawn from published dimensions — download the official paper from the Workforce Development Agency and follow that version on test day.**`
      : `依技術士技能檢定家具木工丙級術科試題 01200-100303（4 小時）公開尺寸繪製的練習範本。這是一件**前後兩截的斜頂小架**：每一側的側板都是前後兩片（各 115 深），中間留 **${EXAM.gap}mm 縫**（評審表要量），用 **Ø8×30 連接木釘**穿過縫綁在一起（各入 10、縫裡露 10）；頂邊從背緣頂先平 18 再一直線斜到前端 105。後橫板 18×50 木釘接、頂端離側板頂 25；後底板 105 深用**雙貫穿榫**（12 寬、齊平）；前底板 95 深用木釘；兩片底板離地 20、前端 3×45° 倒角；背面是與背緣齊平的 **6mm 夾板背板**（嵌側板 6 深×12 寬 rebate，上進後橫板 12、下進後底板 12，橫板背底角與底板背頂角各開 6×12 缺口、${EXAM.screwSpec} 固定）。木釘 12 支全部用到（後橫板 4、前底板 4、連接 4）。**縫 10±0.5 的做法**：膠合每側前後片時在縫裡上下各夾一塊 10mm 墊塊，夾緊後抽掉，上下都要量。**木螺釘 10 支位置**（照 B-B）：兩側側板柱各 3 支（離地約 161、97、29）、後橫板 2 支（離地 161，離側板內面約 88）、後底板 2 支（離地 29，同位置）。**排料**：四片側板要頭尾對調套排才進得了 750×125（直排 800 > 750）。**沒做成造型、照圖自己做**：底緣踩腳（後片背端 50 平、往前 5×45° 收上 5；前片縫側收 5、前端 50 平）；倒角（後底板只有縫側端 3×45°、前底板兩端都 3×45°）。前片木釘孔與連接木釘同高 29、相距 16mm，先鑽淺孔試位。官方材料（每人份）：木料 750×125×18.5 ×1、650×110×18.5 ×2、夾板 300×260×6 本題 1 片、Ø8×30 木釘 ×12、木螺釘 ×10、白膠。**本圖依公開尺寸自行繪製，應檢請以技能檢定中心公布的官方版本為準。**`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};
