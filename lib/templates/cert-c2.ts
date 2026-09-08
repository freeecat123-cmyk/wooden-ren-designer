import type {
  FurnitureDesign,
  FurnitureTemplate,
  Mortise,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";
import type { QuadCorners } from "@/lib/render/quad-profile";

/**
 * 技術士技能檢定 家具木工 丙級 術科試題 01200-100302（練習範本）
 *
 * ⭐ 照官方試題公開尺寸自己畫的練習範本，不是官方圖面的重製。
 *    官方應檢參考資料（試題編號 01200-100301-3，最新修訂 114/06/18）請至 owinform.wdasec.gov.tw 下載，
 *    應檢一律以官方版本為準。
 *
 * ── 圖面判讀紀錄（2026-09-08，300dpi 逐區放大 ×2，A-A 剖面 × B-B 正視 × C-C 橫剖 × 評審表交叉驗證）──
 * 這是一件**斜面上掀門的小箱**：正面往前傾（上深 120、下深 80），門是 40 寬框＋6mm 夾板鑲板，
 * 以兩支 Ø8 木釘當樞軸往上掀（A-A 的一點鏈線＝門開到 110°）。
 *
 * 側板（A-A 外形線、右上小視圖）：**背緣垂直 300**，前緣斜、垂直高 350（評審表「箱體高度 120/80」＝上深／下深）；
 *   上緣往前**上升 30**、底緣往前**下降 20**（評審表「側板端斜度 30/20」）→ 四邊各不相同的四邊形。
 * 頂板（A-A 上方 18 厚橫剖）：頂面離背緣頂角 20，深 **91.6**（量到門的內面），
 *   兩端各 2 支 Ø8×30 木釘（離背 20、70；18 在板、12 在側板，B-B 右上虛線 18|12）。
 * 底板（A-A 下方 18 厚橫剖）：底面離背緣底角 15，深 **60.9 是量底面**（60.9 的延伸線畫到底板底面），木釘離背 20、45。
 *   評審表「箱體前板/後板高 60.9/91.6±1」＝這兩片板的深度。
 * 頂板／底板前端：順著門的傾角斜切（A-A 板端線與門平行），差 18×tan θ ≈ 2mm。門上前下後，
 *   所以兩片板都是**頂面比底面長 2**：頂板頂面 91.6／底面 89.5，底板頂面 63.0／底面 60.9。
 *   （🩸第一版把底板做成頂面短，圖面對照員從 60.9 延伸線落點抓到。）
 * 門（A-A 315 長斜件、B-B 右半正視、C-C 橫剖）：框料 40×18（評審表「板厚/門框寬 18/40」），
 *   長 315（評審表「門長度 315±1」）、寬＝側板內距 264（C-C 門梃貼側板）；
 *   鑲板 6mm 夾板，槽 6 寬 9 深、在厚度正中（C-C 的 6|6|6、A-A 下橫檔的 9）；
 *   門頂離側板前上角 15（A-A 的 15：尺寸線與門平行＝**沿門方向量**），樞軸在門頂下 25（A-A 的 25）、厚度正中，
 *   Ø8 木釘 18 入門梃、12 入側板；門面與側板前緣平行、內縮 ≈4.6（由 91.6 反推，圖上未直接標）。
 * 夾板背板（A-A 左側 6 寬直條，8|6）：離背緣 8、厚 6，嵌側板 6×9 溝（B-B 的 9），上下各入頂板／底板 9。
 * 材料表對帳：側板 2×(350×120) ← 750×125 ✓；頂板／底板／門框 ≤ 650×110 ×2 ✓；
 *   夾板 2 片 300×260（本題 2 片：背板 282×247、門鑲板 200×253）✓；木釘 10/12 支。
 * ⚠️ 91.6 與 60.9 反推的門內面位置差 0.4mm（22.7 vs 23.1）：板深照官方數字，門面取 91.6 那組，
 *   底板前端與門內面留 0.4 縫（±1 容差內）。
 * 門框榫頭：B-B 門頂下 31 有一條虛線橫過整支門梃、0–31 之間沒有縱向虛線 → 榫頭 31 寬**貼齊門端**（0–31），
 *   內側那 9 是橫檔自己的鑲板槽（槽 9 深吃掉榫根）。榫長圖上沒標，取 20 的暗榫（30 會被樞軸孔鑽穿）。
 *   門梃鑲板槽貫通到端面沒關係：端面那段槽口被橫檔蓋住。
 * ⚠️ 門寬：C-C 畫成貼側板；範本每側留 1 活動縫（門 262），切料表跟著。
 * ⚠️ 上橫檔內側頂角圖上有圓弧削角（約 R25，門開 110° 時橫檔頂端平躺頂板上當止擋），範本未做成造型，只在 warning／說明提醒。
 * ⚠️ 樞軸兩支木釘只膠門梃端、側板端不上膠（要能轉）——其餘 8 支照常上膠。
 */

/** 官方試題尺寸（mm） */
const EXAM = {
  overallW: 300,
  topDepth: 120,
  bottomDepth: 80,
  height: 350,           // 前緣垂直高（外形總高）
  backEdgeH: 300,        // 背緣垂直高
  topRiseFront: 30,      // 上緣往前上升
  bottomDropFront: 20,   // 底緣往前下降
  boardT: 18,
  span: 264,
  topBoardTopFromBackTop: 20,
  topBoardDepth: 91.6,
  topBoardDowelsFromBack: [20, 70],
  bottomBoardBottomFromBackBottom: 15,
  bottomBoardDepth: 60.9,
  bottomBoardDowelsFromBack: [20, 45],
  doorLen: 315,
  doorTopBelowCorner: 15,   // 門頂離側板前上角——圖上尺寸線與門平行，是**沿門方向**量
  frameW: 40,
  pivotFromDoorTop: 25,
  panelT: 6,
  panelGrooveW: 6,
  panelGrooveD: 9,
  backPlyT: 6,
  backPlyFromBack: 8,
  backPlyGrooveD: 9,
  dowelDia: 8,
  dowelLen: 30,
  dowelIntoPanel: 12,
  tenonT: 6,
  tenonW: 31,
  tenonL: 20,        // 🩸 原取 30：樞軸孔從外緣進 18、榫眼從內緣進 30，在門梃頂端 25 處交出 8×8×6 的塊，鑽樞軸會鑽斷榫頭；20 才分得開（剩 2）
  doorSideGap: 1,    // 門每側留 1 活動縫（圖上 C-C 畫成貼側板；零縫做出來門會卡死，「門之活動性」整項扣）
  doorOpenMax: 110,
} as const;

export const certC2Options: OptionSpec[] = [
  {
    group: "structure",
    type: "number",
    key: "doorOpen",
    label: "門開啟角度",
    defaultValue: 0,
    min: 0,
    max: EXAM.doorOpenMax,
    step: 5,
    unit: "°",
    help: "0＝關上（考題成品）。門以兩支 Ø8 木釘當樞軸往上掀，圖上一點鏈線畫到 110°。只影響 3D 示意，不改任何零件尺寸",
  },
  {
    group: "structure",
    type: "checkbox",
    key: "withBack",
    label: "裝 6mm 夾板背板",
    defaultValue: true,
    help: "試題規定要裝（本題用 2 片夾板：背板＋門鑲板）。取消只是為了看清楚骨架，應檢一定要裝",
  },
];

/** 把零件擺到「世界中心 y」——origin.y 是底，帶旋轉的零件要先算 yExt */
function placeCenterY(part: Part, centerY: number): Part {
  const { yExt } = worldExtents({ ...part, origin: { ...part.origin, y: 0 } });
  return { ...part, origin: { ...part.origin, y: centerY - yExt / 2 } };
}

export const certC2: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certC2Options;
  const doorOpenDeg = getOption<number>(input, opt(o, "doorOpen"));
  const withBack = getOption<boolean>(input, opt(o, "withBack"));

  const T = EXAM.boardT;
  // 下限夾在讀值這一行（§A10.11）：深度要放得下 40 的斜差＋底板；高度要放得下頂板、門框、底板
  // 寬：兩側板＋兩門梃 40＋鑲板槽 9×2＋鑲板至少 20 → 154（審查員實測 96 會做出負長度的門橫檔）
  const MIN_DEPTH = 110, MIN_HEIGHT = 260, minLength = 2 * T + 2 * EXAM.frameW + 2 * EXAM.panelGrooveD + 20;
  const H = Math.max(MIN_HEIGHT, input.height);
  const topDepth = Math.max(MIN_DEPTH, input.width);
  const overallW = Math.max(minLength, input.length);
  const span = overallW - 2 * T;
  const bottomDepth = topDepth - (EXAM.topDepth - EXAM.bottomDepth);
  const slantDz = topDepth - bottomDepth;                 // 前緣上下深度差（40）
  const theta = Math.atan2(slantDz, H);                    // 門／前緣傾角（考題 6.52°）
  const cosT = Math.cos(theta), sinT = Math.sin(theta);

  /** 世界座標：X 左右、Y 上（y=0＝側板前下角）、Z 前後，**+Z＝背（垂直邊）**（app 慣例：+Z 背、正視從 −Z 看）。
   *  離背 d 的東西在 z = zBack − d。 */
  const zBack = topDepth / 2;
  const backBottomY = EXAM.bottomDropFront;               // 背緣底角高
  const backTopY = H - EXAM.topRiseFront;                 // 背緣頂角高
  /** 前緣在高度 y 的深度（從背緣量） */
  const frontDepthAt = (y: number) => bottomDepth + slantDz * (y / H);
  const parts: Part[] = [];
  const warnings: string[] = [];

  // ── 側板 ×2：quad（背緣垂直 300、上緣前升 30、底緣前降 20）──────────────
  // 本地座標同 cert-c1（rotation x=π/2,y=π/2）：local x 鏡像到世界 z（local −x＝世界 +z＝背）、local z → 世界 y（−hz＝頂）
  const hx = topDepth / 2, hz = H / 2;
  const sideCorners: QuadCorners = [
    [-hx, -hz + EXAM.topRiseFront],               // 背上
    [hx, -hz],                                    // 前上（最高點）
    [hx - slantDz, hz],                           // 前下（深度收到 bottomDepth）
    [-hx, hz - EXAM.bottomDropFront],             // 背下
  ];
  const sideLocalX = (fromBack: number) => -hx + fromBack;
  const sideLocalZ = (fromTop: number) => -hz + fromTop;

  // 頂板／底板位置
  const topBoardTopY = backTopY - EXAM.topBoardTopFromBackTop;          // 300
  const bottomBoardBottomY = backBottomY + EXAM.bottomBoardBottomFromBackBottom; // 35
  // 門內面離前緣的水平距離：由官方 91.6（頂板頂面）反推；底板另一組官方數字 60.9 反推是 23.1（差 0.4）。
  // 底板深度要**跟著門面走**（留 0.4 縫），不能各用各的官方常數——那樣只在 H=350 相容，
  // H>366 底板前端就插進門裡（審查員實測 H=600 穿模 3.6mm）。考題尺寸下算出來仍是 60.9。
  // 兩個常數一律用**考題幾何**算（不跟滑桿走），尺寸放大時門的內縮量固定、板深跟著前緣算
  const examFrontDepth = (y: number) => EXAM.bottomDepth + (EXAM.topDepth - EXAM.bottomDepth) * (y / EXAM.height);
  const doorInnerOffset = examFrontDepth(EXAM.height - EXAM.topRiseFront - EXAM.topBoardTopFromBackTop) - EXAM.topBoardDepth;   // 22.686
  const bottomGap = examFrontDepth(EXAM.bottomDropFront + EXAM.bottomBoardBottomFromBackBottom) - EXAM.bottomBoardDepth - doorInnerOffset; // 0.414
  const topBoardDepth = frontDepthAt(topBoardTopY) - doorInnerOffset;           // 頂面深，考題尺寸＝91.6
  const bottomBoardDepth = frontDepthAt(bottomBoardBottomY) - doorInnerOffset - bottomGap; // 底面深，考題尺寸＝60.9
  const bevel = T * Math.tan(theta);                                            // 板端斜切差 ≈2.06

  const dowelY = { top: topBoardTopY - T / 2, bottom: bottomBoardBottomY + T / 2 };
  const backPlyZ = zBack - EXAM.backPlyFromBack - EXAM.backPlyT / 2;
  const backPlyTop = topBoardTopY - T + EXAM.backPlyGrooveD;
  const backPlyBottom = bottomBoardBottomY + T - EXAM.backPlyGrooveD;

  // ── 門的座標系：v＝沿門長（從門頂外角往下）、w＝從門面往內；樞軸固定，開門只轉 v/w 方向 ──
  const doorLen = EXAM.doorLen + (H - EXAM.height);
  const doorRecess = doorInnerOffset - T / cosT;            // 門面內縮（水平）≈4.57
  const closedDir = { v: { y: -cosT, z: sinT }, n: { y: -sinT, z: -cosT } }; // v＝沿門往下（往背 +z 靠）、n＝門面法線（朝前 −z）
  // 門頂外角＝側板前上角沿門方向下 15，再退到門面（水平內縮 doorRecess ⇒ 垂直門面方向 doorRecess·cosθ）
  const frontTopZ = zBack - frontDepthAt(H);
  const doorTopY = H + EXAM.doorTopBelowCorner * closedDir.v.y - doorRecess * cosT * closedDir.n.y;
  const doorTopZ = frontTopZ + EXAM.doorTopBelowCorner * closedDir.v.z - doorRecess * cosT * closedDir.n.z;
  const pivot = {
    y: doorTopY + EXAM.pivotFromDoorTop * closedDir.v.y - (T / 2) * closedDir.n.y,
    z: doorTopZ + EXAM.pivotFromDoorTop * closedDir.v.z - (T / 2) * closedDir.n.z,
  };
  const phi = theta - (doorOpenDeg * Math.PI) / 180;         // 開門＝往前上掀（φ 減小）
  const vDir = { y: -Math.cos(phi), z: Math.sin(phi) };
  const nDir = { y: -Math.sin(phi), z: -Math.cos(phi) };
  /** 門座標 (v, w) → 世界 (y, z) */
  const doorPt = (v: number, w: number) => ({
    y: pivot.y + (v - EXAM.pivotFromDoorTop) * vDir.y - (w - T / 2) * nDir.y,
    z: pivot.z + (v - EXAM.pivotFromDoorTop) * vDir.z - (w - T / 2) * nDir.z,
  });
  const railRot = { x: Math.PI / 2 - phi, y: 0, z: 0 };            // local z → v、local +y → 門內（+z 側）
  const stileRot = { x: Math.PI / 2, y: -phi, z: -Math.PI / 2 };   // local x → v、local +y → 門內

  // ── 側板 ─────────────────────────────────────────────────────────────
  const sideMortises = (innerY: number): Mortise[] => {
    const m: Mortise[] = [];
    for (const fb of EXAM.topBoardDowelsFromBack) m.push({
      origin: { x: sideLocalX(fb), y: innerY, z: sideLocalZ(H - dowelY.top) },
      depth: EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, top board" : "Ø8 木釘（頂板）",
    });
    for (const fb of EXAM.bottomBoardDowelsFromBack) m.push({
      origin: { x: sideLocalX(fb), y: innerY, z: sideLocalZ(H - dowelY.bottom) },
      depth: EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, bottom board" : "Ø8 木釘（底板）",
    });
    m.push({
      origin: { x: sideLocalX(zBack - pivot.z), y: innerY, z: sideLocalZ(H - pivot.y) },
      depth: EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 door pivot (no glue: must turn)" : "Ø8 門樞軸木釘（不上膠，要能轉）",
    });
    if (withBack) m.push({
      origin: { x: sideLocalX(zBack - backPlyZ), y: innerY, z: sideLocalZ(H - (backPlyTop + backPlyBottom) / 2) },
      depth: EXAM.backPlyGrooveD, length: EXAM.backPlyT, width: backPlyTop - backPlyBottom, through: false, cosmetic: true,
      label: isEn ? "6×9 groove for plywood back" : "夾板背板溝（6 寬 9 深）",
    });
    return m;
  };
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "side-left" : "side-right",
      nameZh: sx < 0 ? "左側板" : "右側板",
      nameEn: sx < 0 ? "Side panel (left)" : "Side panel (right)",
      material,
      grainDirection: "width",
      visible: { length: topDepth, width: H, thickness: T },
      origin: { x: sx * (span / 2 + T / 2), y: 0, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      shape: { kind: "quad", corners: sideCorners },
      tenons: [],
      mortises: sideMortises(sx < 0 ? T : 0),
    });
  }

  /** 板兩端面的木釘孔（Ø8，入板 18） */
  const endDowels = (len: number, zs: number[], label: string): Mortise[] =>
    ([-1, 1] as const).flatMap((sx) => zs.map((z) => ({
      origin: { x: sx * len / 2, y: T / 2, z },
      depth: EXAM.dowelLen - EXAM.dowelIntoPanel, length: EXAM.dowelDia, width: EXAM.dowelDia,
      through: false, shape: "round" as const, label,
    })));

  // ── 頂板：18 厚、深 91.6，前端順門傾角斜切（底面短 2）──────────────────
  const topBoardZ = zBack - topBoardDepth / 2;
  parts.push({
    id: "top-board",
    nameZh: "頂板",
    nameEn: "Top board",
    material,
    grainDirection: "length",
    visible: { length: span, width: topBoardDepth, thickness: T },
    origin: { x: 0, y: topBoardTopY - T, z: topBoardZ },
    shape: { kind: "quad", plane: "yz", corners: [   // 前端＝−z：頂面（+y）全深、底面（−y）短 bevel
      [-T / 2, -topBoardDepth / 2 + bevel], [T / 2, -topBoardDepth / 2], [T / 2, topBoardDepth / 2], [-T / 2, topBoardDepth / 2],
    ] },
    tenons: [],
    mortises: [
      ...endDowels(span, EXAM.topBoardDowelsFromBack.map((fb) => zBack - fb - topBoardZ), isEn ? "Ø8 dowel" : "Ø8 木釘"),
      ...(withBack ? [{
        origin: { x: 0, y: 0, z: backPlyZ - topBoardZ }, depth: EXAM.backPlyGrooveD, length: span, width: EXAM.backPlyT,
        through: false, cosmetic: true, label: isEn ? "6×9 groove for plywood back (underside)" : "夾板背板溝（底面，6 寬 9 深）",
      }] : []),
    ],
  });

  // ── 底板：18 厚、底面深 60.9、頂面深 60.9＋2（前端順門斜切；料要照頂面 63 備）──
  const bottomBoardStock = bottomBoardDepth + bevel;
  const bottomBoardZ = zBack - bottomBoardStock / 2;
  parts.push({
    id: "bottom-board",
    nameZh: "底板",
    nameEn: "Bottom board",
    material,
    grainDirection: "length",
    visible: { length: span, width: bottomBoardStock, thickness: T },
    origin: { x: 0, y: bottomBoardBottomY, z: bottomBoardZ },
    shape: { kind: "quad", plane: "yz", corners: [   // 前端＝−z：頂面全深（63）、底面短 bevel（60.9）
      [-T / 2, -bottomBoardStock / 2 + bevel], [T / 2, -bottomBoardStock / 2], [T / 2, bottomBoardStock / 2], [-T / 2, bottomBoardStock / 2],
    ] },
    tenons: [],
    mortises: [
      ...endDowels(span, EXAM.bottomBoardDowelsFromBack.map((fb) => zBack - fb - bottomBoardZ), isEn ? "Ø8 dowel" : "Ø8 木釘"),
      ...(withBack ? [{
        origin: { x: 0, y: T, z: backPlyZ - bottomBoardZ }, depth: EXAM.backPlyGrooveD, length: span, width: EXAM.backPlyT,
        through: false, cosmetic: true, label: isEn ? "6×9 groove for plywood back (top face)" : "夾板背板溝（頂面，6 寬 9 深）",
      }] : []),
    ],
  });

  // ── 木釘：頂板 4、底板 4、門樞軸 2（Ø8×30，18 在板／門梃、12 在側板）──────
  const dowelX = (sx: -1 | 1) => sx * (span / 2 + (EXAM.dowelIntoPanel - (EXAM.dowelLen - EXAM.dowelIntoPanel)) / 2);
  const dowelSpots: Array<{ id: string; zh: string; en: string; y: number; z: number }> = [
    ...EXAM.topBoardDowelsFromBack.map((fb, i) => ({ id: `top-${i + 1}`, zh: "頂板", en: "top board", y: dowelY.top, z: zBack - fb })),
    ...EXAM.bottomBoardDowelsFromBack.map((fb, i) => ({ id: `bottom-${i + 1}`, zh: "底板", en: "bottom board", y: dowelY.bottom, z: zBack - fb })),
    { id: "pivot", zh: "門樞軸，側板端不上膠", en: "door pivot, no glue in the side panel", y: pivot.y, z: pivot.z },
  ];
  for (const sx of [-1, 1] as const) for (const s of dowelSpots) {
    parts.push({
      id: `dowel-${sx < 0 ? "l" : "r"}-${s.id}`,
      nameZh: `木釘 Ø${EXAM.dowelDia}×${EXAM.dowelLen}（${s.zh}）`,
      nameEn: `Dowel Ø${EXAM.dowelDia}×${EXAM.dowelLen} (${s.en})`,
      material,
      grainDirection: "length",
      visible: { length: EXAM.dowelLen, width: EXAM.dowelDia, thickness: EXAM.dowelDia },
      origin: { x: dowelX(sx), y: s.y - EXAM.dowelDia / 2, z: s.z },
      shape: { kind: "round", axis: "x" },
      visual: "dowel",
      tenons: [],
      mortises: [],
    });
  }

  // ── 門：40×18 框（暗榫）＋ 6mm 夾板鑲板（槽 6×9 居中）────────────────────
  const fw = EXAM.frameW;
  const doorW = span - 2 * EXAM.doorSideGap;        // 門寬（每側 1 縫）
  const railLen = doorW - 2 * fw;                   // 肩對肩
  const grooveMortise = (len: number, zFace: number, label: string): Mortise => ({
    origin: { x: 0, y: T / 2, z: zFace }, depth: EXAM.panelGrooveD, length: len, width: EXAM.panelGrooveW,
    through: false, cosmetic: true, label,
  });
  const grooveLabel = isEn ? "panel groove 6×9" : "鑲板槽（6 寬 9 深）";
  // 橫檔：local z → v（往下）。頂橫檔內緣＝+z、底橫檔內緣＝−z
  for (const [id, zh, en, vCenter, innerZ] of [
    ["rail-top", "門上橫檔", "Door top rail", fw / 2, +fw / 2],
    ["rail-bottom", "門下橫檔", "Door bottom rail", doorLen - fw / 2, -fw / 2],
  ] as const) {
    const c = doorPt(vCenter, T / 2);
    const tenonOffset = -Math.sign(innerZ) * (fw - EXAM.tenonW) / 2;  // 榫頭貼門端（外側），內側 9 是橫檔的鑲板槽
    parts.push(placeCenterY({
      id: `front-door-1-${id}`,
      nameZh: zh,
      nameEn: en,
      material,
      grainDirection: "length",
      visible: { length: railLen, width: fw, thickness: T },
      origin: { x: 0, y: 0, z: c.z },
      rotation: railRot,
      tenons: (["start", "end"] as const).map((position) => ({
        position, type: "blind-tenon" as const,
        length: EXAM.tenonL, width: EXAM.tenonW, thickness: EXAM.tenonT, offsetWidth: tenonOffset,
      })),
      mortises: [grooveMortise(railLen, innerZ, grooveLabel)],
    }, c.y));
  }
  // 門梃：local x → v（往下）、local z → ±X（左梃內緣朝 +x）
  for (const sx of [-1, 1] as const) {
    const c = doorPt(doorLen / 2, T / 2);
    const innerZ = sx * fw / 2;    // 探針實測 stileRot 的 local +z → 世界 −x：左梃內緣（朝 +x）＝local −z
    const mortiseX = (v: number) => -doorLen / 2 + v;
    parts.push(placeCenterY({
      id: `front-door-1-stile-${sx < 0 ? "left" : "right"}`,
      nameZh: sx < 0 ? "門左梃" : "門右梃",
      nameEn: sx < 0 ? "Door stile (left)" : "Door stile (right)",
      material,
      grainDirection: "length",
      visible: { length: doorLen, width: fw, thickness: T },
      origin: { x: sx * (doorW / 2 - fw / 2), y: 0, z: c.z },
      rotation: stileRot,
      tenons: [],
      mortises: [
        // 上／下橫檔榫眼（內緣面）：榫頭貼門端，中心＝門端往內 31/2
        { origin: { x: mortiseX(EXAM.tenonW / 2), y: T / 2, z: innerZ }, depth: EXAM.tenonL, length: EXAM.tenonW, width: EXAM.tenonT, through: false,
          label: isEn ? "mortise, top rail" : "上橫檔榫眼" },
        { origin: { x: mortiseX(doorLen - EXAM.tenonW / 2), y: T / 2, z: innerZ }, depth: EXAM.tenonL, length: EXAM.tenonW, width: EXAM.tenonT, through: false,
          label: isEn ? "mortise, bottom rail" : "下橫檔榫眼" },
        // 樞軸孔（外緣面）：木釘 30 − 側板 12 − 縫 1 ＝ 17 入門梃；這一端上膠、側板端不上膠
        { origin: { x: mortiseX(EXAM.pivotFromDoorTop), y: T / 2, z: -innerZ }, depth: EXAM.dowelLen - EXAM.dowelIntoPanel - EXAM.doorSideGap, length: EXAM.dowelDia, width: EXAM.dowelDia, through: false, shape: "round",
          label: isEn ? "Ø8 pivot (glue this end)" : "Ø8 樞軸孔（此端上膠）" },
        grooveMortise(doorLen, innerZ, grooveLabel),
      ],
    }, c.y));
  }
  // 鑲板：6mm 夾板，入槽 9
  {
    const panelW = railLen + 2 * EXAM.panelGrooveD;
    const panelH = doorLen - 2 * fw + 2 * EXAM.panelGrooveD;
    const c = doorPt(doorLen / 2, T / 2);
    parts.push(placeCenterY({
      id: "front-door-1-panel",
      nameZh: "門鑲板（6mm 夾板）",
      nameEn: "Door panel (6mm plywood)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: { length: panelW, width: panelH, thickness: EXAM.panelT },
      origin: { x: 0, y: 0, z: c.z },
      rotation: railRot,
      tenons: [],
      mortises: [],
    }, c.y));
  }

  // ── 6mm 夾板背板：離背 8，嵌側板 6×9 溝，上下各入頂板／底板 9 ───────────
  if (withBack) {
    parts.push({
      id: "back-panel",
      nameZh: "夾板背板（6mm）",
      nameEn: "Plywood back (6mm)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: { length: span + 2 * EXAM.backPlyGrooveD, width: backPlyTop - backPlyBottom, thickness: EXAM.backPlyT },
      origin: { x: 0, y: backPlyBottom, z: backPlyZ },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 出聲 ───────────────────────────────────────────────────────────────
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
  if (doorOpenDeg > 0) {
    warnings.push(isEn
      ? `Door shown open ${doorOpenDeg}° (3D only; part sizes unchanged).`
      : `門示意開啟 ${doorOpenDeg}°（只影響 3D，零件尺寸不變）。`);
  }
  // 掃過 0–110°：這套幾何（樞軸在門頂下 25、頂板前上角離樞軸 15.2）100° 內乾淨，105° 起上橫檔碰頂板前上角 1.4mm、110° 3.4mm。
  // 官方圖鏈線畫到 110°，範本照畫但要講清楚——實作時要視情況把頂板前上角修圓或縮小開角。
  if (doorOpenDeg > 100) {
    warnings.push(isEn
      ? `Beyond ~100° the inner top edge of the door's top rail digs into the top surface of the top board (about 1.4 mm at 105°, 3.4 mm at 110° for the exam size). The official drawing rounds that inner corner of the rail (roughly R25, so the rail lies flat on the top board at 110°) — this template does not model the round-over; shape it as drawn.`
      : `超過 100° 門上橫檔的內側上稜會陷進頂板頂面（考題尺寸下 105° 約 1.4mm、110° 約 3.4mm）。官方圖在上橫檔內側頂角畫了圓弧削角（約 R25，讓 110° 時橫檔頂端平躺在頂板上）——範本沒做這個圓弧，實作照圖修。`);
  }

  const design: FurnitureDesign = {
    id: `cert-c2-${overallW}x${topDepth}x${H}`,
    category: "cert-c2",
    nameZh: "家具木工丙級 第二題（01200-100302）",
    overall: { length: overallW, width: topDepth, thickness: H },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class C furniture-woodworking trade test, question 01200-100302 (4 hours). A small wall box with a sloping front and a lift-up door: **side panels with four different edges** (back edge vertical 300, front edge 350 high leaning forward, depth 120 → 80), top board (91.6 deep) and bottom board (60.9 deep) on **Ø8×30 dowels** with their front ends cut to the door angle, a **frame-and-panel door** (40×18 frame, blind tenons, 6mm plywood panel in a 6×9 groove, 315 long) hung on **two Ø8 dowel pivots** so it swings up to 110°, and a **6mm plywood back** housed 8mm in from the back edge in 6×9 grooves. Ten dowels are used (top 4, bottom 4, pivots 2); glue the pivot dowels into the door stiles only — they must turn in the side panels. Leave a 1 mm gap each side of the door, lightly chamfer every exposed edge (the scoring sheet has marks for chamfers), and round the inner top corner of the top rail as drawn (about R25) so the door can open to 110° and rest on the top board. Official stock per candidate: 750×125×18.5 ×1, 650×110×18.5 ×2, 6mm plywood 300×260 ×2 for this question, Ø8×30 dowels ×12, PVA glue (the shared list also gives 10 screws; this question does not use them — the back is housed in grooves). **Drawn from published dimensions — download the official paper from the Workforce Development Agency and follow that version on test day.**`
      : `依技術士技能檢定家具木工丙級術科試題 01200-100302（4 小時）公開尺寸繪製的練習範本。這是一件**斜面上掀門的小壁箱**：**四邊各不相同的側板**（背緣垂直 300、前緣斜、高 350，深 120 收到 80）、頂板（深 91.6）與底板（深 60.9）各用 **Ø8×30 木釘**接側板、板前端順門的傾角斜切；**框＋鑲板的門**（40×18 框料暗榫、6mm 夾板鑲板入 6×9 槽、長 315）以**兩支 Ø8 木釘當樞軸**往上掀到 110°；背面是離背緣 8mm、嵌 6×9 溝的 **6mm 夾板背板**。木釘用 10 支（頂板 4、底板 4、樞軸 2）：樞軸那 2 支只膠門梃端、側板端不上膠要能轉。門每側留 1mm 活動縫，外露稜角一律輕倒角（評審表有倒角 4 分）；上橫檔內側頂角照圖修成圓弧（約 R25），門才能開到 110° 平躺在頂板上。官方材料（每人份）：木料 750×125×18.5 ×1、650×110×18.5 ×2、夾板 300×260×6 本題 2 片、Ø8×30 木釘 ×12、白膠（共用材料表還給 10 支木螺釘，本題用不到——背板是入溝的）。**本圖依公開尺寸自行繪製，應檢請以技能檢定中心公布的官方版本為準。**`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};
