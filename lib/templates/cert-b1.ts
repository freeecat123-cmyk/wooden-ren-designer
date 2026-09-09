import type {
  FurnitureDesign,
  FurnitureTemplate,
  Mortise,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

/**
 * 技術士技能檢定 家具木工 乙級 術科試題 01200-100201（練習範本）
 *
 * ⭐ 這是**照官方試題公開尺寸自己畫的練習範本**，不是官方圖面的重製；不嵌、不顯示官方圖檔。
 *    官方應檢參考資料（勞動部勞動力發展署技能檢定中心，完整題本 012002B15，第一題圖框最新修訂 114/06/18）
 *    請至 owinform.wdasec.gov.tw 下載，應檢一律以官方版本為準。
 *
 * ── 圖面判讀紀錄（2026-09-09，PDF 第 15 頁 300dpi 逐區放大 ×3～×6，對照評審表 PDF 第 7 頁）──
 * 外形：桌面 450×450×18（木心板 434×434 四周貼 8mm 實木封邊，C-C 兩端「8」與端面斜線）；成品高 450；
 *   腳架外廓 410×410（B-B「410」、側視「410」）→ 桌面四邊各懸出 20（C-C「20」）。
 * 腳柱 32×45（評審表「腳柱寬、厚度 45×32」；B-B 平剖左腳「32」、左側「45」）×432 高，腳底 3mm 斜角（圖面文字）。
 * 側板／後板：木心板 18 厚 × 105 高（評審表「側、後板寬度 105」；A-A／C-C「105」），頂面貼桌面底。
 *   後板背面離腳背面 10（C-C「20｜10」）；側板內面離腳內面 5（A-A 尺寸鏈 18｜5｜3｜15 → 側板外面離腳外面 9）。
 *   兩端各 2 支 Ø8×30 木釘入腳（A-A／C-C 的 ⊕ 離桌面底 25、75；B-B 上圖「15｜15」＝入腳 15、入板 15）。
 * 桌面木釘：Ø8×30，入桌面 12、入板 18（C-C「12｜18」）；每支側板／後板 3 支，鏈都是「83｜142｜142｜83」（總 450）
 *   → 世界座標一律 −142／0／+142。離腳內面兩邊不同（腳沿深度 45、沿寬度 32）：後板 31／173／315、側板 18／160／302。
 *   🩸 第一版兩邊都用 31／173／315，側板那三支整組偏 13mm。
 * 前曲線橫檔：18 厚 × 60 高，正面與抽屜面板齊平（離腳正面 10）；頂在桌面下 125、底 185（C-C 右側 18｜2｜103｜2｜60＝185 到底）；
 *   下緣壸門：兩端各 70 平段、R15／R15 反向相切升高 20（A-A「70」「R15」「20」）；正面頂緣 6×4 缺口（C-C 右下「4」「6｜6」）；
 *   兩端榫頭 6 厚（C-C「6｜6｜6」隱藏線＝厚度三等分居中）入腳 21（B-B 平剖右腳「21」）。
 * 抽屜：外寬 340 × 外深 350（評審表）；面板 340×103×18（評審表「抽屜前板寬度 103」），頂離桌面底 2（C-C「2」），
 *   正面離腳正面 10，正中央 Ø20 貫穿指孔（圖面文字＋C-C「Ø20」）；側板 15 厚 × 100 高（C-C「100」），頂離桌面底 5（A-A「5」），
 *   底與面板底齊（327）；後板 15 厚 × 80 高（C-C「80」），底板 4mm 合板從後板底下穿過、Ø2.4×15 木螺釘鎖入後板（C-C 螺釘）；
 *   底板槽 4 寬 × 7 深（A-A「7」）開在面板與兩側板（評審表「抽屜底板槽 3 部位」），槽頂離抽屜底 15（C-C「15」）；
 *   側板外面滑條槽 15 高 × 8 深（A-A「15」「8」），**槽頂離桌面底 45**——A-A 右鏈是「5｜5｜35｜15」兩個獨立的 5：
 *   桌面底→側板頂 5、側板頂→抽屜後板頂 5（＝桌面底下 10，與 C-C「80」上箭頭同線）、再 35 到槽頂。
 * 滑條：15 寬（B-B 上圖「15」）× 14 高（A-A「14」）× 320（腳與腳之間），鎖在側板內面，Ø3.5×30 木螺釘（A-A／B-B），
 *   入抽屜側板槽 7（側板內面到抽屜側板 8＝5＋3，槽深 8 留 1）。
 * 鳩尾榫：評審表「鳩尾榫頭、榫孔 30 部位／密合 28 部位」→ 四角 × 7 段＝28 密合；圖面沒畫齒形也沒標齒數／角度，本範本每角 7 段 10°（自訂）。
 *   面板端半隱鳩尾：C-C 面板剖面那條貫穿全高的虛線離**正面** 6 → 榫孔深 12、面皮 6（範本 dovetailPinDepth=12、側板長 344）。
 * 材料表對帳（PDF 第 6 頁是**六題共用一張**，第 1 題那欄）：
 *   木料 1050×95×32.5 ×1 → 四支腳 432×45×32（1050 切 2 段 ×95 排 2 支）
 *   木料 600×92×21.5 ×1 → 前橫檔 388×60×18 ＋ 滑條 320×15×14 ×2
 *   木料 440×132×18.5 ×1 → **抽屜面板 340×103×18（實木，不是木心板）**
 *   木料 400×130×15.5 ×3 → 抽屜側板 344×100×15 ×2、後板 340×80×15
 *   木材 550×19×8.5 ×5 → 桌面封邊 8×18，四條（450 ×2、434 ×2）
 *   木心板 480×450×18 ×1 → 桌面 434×434；木心板 426×178×18 ×3 → 側板 320×105 ×2、後板 346×105
 *   合板 408×350×4 ×1 → 抽屜底板 339×324
 *   木釘 Ø8×30 ×29、木螺釘 Ø2.4×15 ×3／Ø3×25 ×14／Ø3.5×30 ×14、白膠
 *   ⚠️ 圖上畫得出位置的木釘只有 21 支（桌面 9＋板端入腳 12）；範本做 25 支（多了腳頂 4 支），
 *      而 C-C 前端腳正上方的桌面剖面裡並沒有畫木釘——腳頂那 4 支待與評審表「木釘 30 部位／密合 18」的計數口徑一起確認。
 *   ⚠️ Ø3×25 木螺釘 ×14 全圖沒有引線，位置不明。
 * ⚠️ 未做成造型：腳底 3mm 斜角、木螺釘本體（Ø3.5×30 滑條、Ø2.4×15 底板）——說明與工序提醒。
 */

/** 官方試題尺寸（mm）。預設值＝考題原尺寸；滑桿只是讓人放大練習用 */
const EXAM = {
  overall: 450,          // 桌面長＝寬＝高
  topT: 18,
  edgeBand: 8,           // 桌面實木封邊
  legFoot: 410,          // 腳架外廓
  legW: 32,              // 腳柱沿桌面長向（x）
  legD: 45,              // 腳柱沿桌面深向（z）
  railT: 18,
  railH: 105,
  sideRailInset: 9,      // 側板外面離腳外面（A-A：內面離腳內面 5 → 32−18−5）
  backRailInset: 10,     // 後板背面離腳背面（C-C「10」）
  railEndDowelsFromTop: [25, 75],   // 側板／後板端木釘離桌面底
  dowelDia: 8,
  dowelLen: 30,
  railDowelIntoLeg: 15,  // B-B「15｜15」
  topDowelIntoTop: 12,   // C-C「12｜18」
  // 桌面木釘沿長寬各 3 支，圖上鏈都是「83｜142｜142｜83」（總 450）→ 世界座標一律 −142／0／+142。
  // 離腳內面的距離兩邊不同，因為腳沿深度是 45、沿寬度是 32：
  //   後板（沿 x，腳 32）：83 = 20 懸出 + 32 + 31 → 31／173／315
  //   側板（沿 z，腳 45）：83 = 20 懸出 + 45 + 18 → 18／160／302
  // 🩸 2026-09-09 第一版兩邊都用 31／173／315，側板那三支整組偏了 13mm，最外一支只離側板端 5mm。
  backRailDowelsFromLegInner: [31, 173, 315],
  sideRailDowelsFromLegInner: [18, 160, 302],
  frontRailH: 60,
  frontRailBottomFromTop: 185,      // 桌面頂到橫檔底
  frontRailFlat: 70,     // 壸門兩端平段
  frontRailR: 15,
  frontRailRise: 20,
  frontRailNotchW: 6,    // 正面頂緣缺口 6 寬 × 4 深
  frontRailNotchD: 4,
  frontRailTenonT: 6,    // 6｜6｜6
  frontRailTenonL: 21,   // B-B「21」
  frontRailTenonShoulder: 4,        // 上下各留 4 肩（圖面未標）
  frontInset: 10,        // 面板／前橫檔正面離腳正面
  drawerW: 340,
  drawerD: 350,
  drawerFrontH: 103,
  drawerFrontT: 18,
  drawerFrontGapTop: 2,  // 面板頂離桌面底
  drawerSideT: 15,
  drawerSideH: 100,
  drawerSideGapTop: 5,   // 側板頂離桌面底（A-A「5」）
  drawerBackH: 80,
  drawerBackT: 15,
  fingerHoleDia: 20,
  bottomT: 4,
  bottomGrooveD: 7,      // A-A「7」
  bottomGrooveTopFromBottom: 15,    // C-C「15」＝槽頂／底板頂離抽屜底
  runnerW: 15,           // B-B「15」
  runnerH: 14,           // A-A「14」
  runnerGrooveH: 15,     // A-A「15」
  runnerGrooveD: 8,      // A-A「8」
  // 桌面底到槽頂 45：A-A 右鏈是「5｜5｜35｜15」兩個獨立的 5——
  // 第一個 5＝桌面底→抽屜側板頂；第二個 5＝側板頂→抽屜後板頂（＝桌面底下 10，與 C-C「80」上箭頭同線）；
  // 35 從那裡量到槽頂。🩸 第一版讀成「5｜35｜15」＝40，整組滑條高了 5mm。
  runnerGrooveTopFromTop: 45,
  runnerIntoGroove: 7,   // 8 深槽留 1
  dovetailSegments: 7,   // 四角 × 7 段＝評審表 28 密合部位
  dovetailAngleDeg: 10,
  // 面板端半隱鳩尾：C-C 面板剖面那條貫穿全高的虛線離**正面** 6 → 榫孔深 12、面皮 6（🩸 第一版取側板厚 15、面皮只剩 3）。
  // ⚠️ dovetail-ends 只有單一 pinDepth，後板端本來是貫穿（15）→ 這裡統一取 12，後板端的肩會差 3mm；
  //    面板端是看得到、要評分的半隱接合，正確性優先。
  dovetailPinDepth: 12,
  runnerScrew: "Ø3.5×30 木螺釘（CNS1051）",
  bottomScrew: "Ø2.4×15 木螺釘（CNS1051）",
} as const;

export const certB1Options: OptionSpec[] = [
  {
    group: "structure",
    type: "number",
    key: "drawerPull",
    label: "抽屜拉出量（示意）",
    defaultValue: 0,
    min: 0,
    max: 200,
    step: 10,
    unit: "mm",
    help: "只影響 3D 展示（把抽屜往前拉出來看滑條與槽怎麼配合），不改任何尺寸。應檢時抽屜當然是關著的",
  },
  {
    group: "structure",
    type: "checkbox",
    key: "withDrawer",
    label: "裝抽屜",
    defaultValue: true,
    help: "試題一定要做抽屜。取消只是為了看清楚桌架與滑條，應檢一定要裝",
  },
];

/**
 * 前曲線橫檔下緣輪廓（part-local X/Z，mm）：兩端各 70 平段，R15／R15 反向相切升高 20，左右鏡射。
 * 角度 θ＝acos(1 − 20/(2·15))：兩個等半徑反向圓弧各轉 θ 剛好升高 20（不是正弦、也不是通用壸門）。
 * local +Z＝下緣（rotation x=π/2 後為世界下方）。
 */
export function certB1FrontProfile(span = 346, h = EXAM.frontRailH): Array<[number, number]> {
  const r = EXAM.frontRailR, rise = EXAM.frontRailRise, flat = EXAM.frontRailFlat;
  const angle = Math.acos(1 - rise / (2 * r));
  const half = span / 2, bottom = h / 2, top = -h / 2;
  const left: Array<[number, number]> = [[-half, bottom], [-half + flat, bottom]];
  const x0 = -half + flat;
  for (let i = 1; i <= 24; i++) {
    const t = angle * i / 24;
    left.push([x0 + r * Math.sin(t), bottom - r * (1 - Math.cos(t))]);
  }
  const xMid = x0 + r * Math.sin(angle);
  for (let i = 1; i <= 24; i++) {
    const t = angle * (1 - i / 24);
    left.push([xMid + r * (Math.sin(angle) - Math.sin(t)), bottom - rise + r * (1 - Math.cos(t))]);
  }
  const right = left.slice().reverse().map(([x, z]): [number, number] => [-x, z]);
  return [...left, ...right, [half, top], [-half, top]];
}

export const certB1: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certB1Options;
  const pull = getOption<number>(input, opt(o, "drawerPull"));
  const withDrawer = getOption<boolean>(input, opt(o, "withDrawer"));

  const E = EXAM;
  const T = E.railT;
  // 主尺寸跟著滑桿走（預設＝考題）；下限夾在讀值這一行（§A10.11），夾了要出聲。
  // 長×深至少要放得下腳架（腳 + 側板 + 抽屜淨空）；高至少要放得下桌面 + 側板 + 前橫檔。
  // 🩸 2026-09-09：下限本來寫 300，但抽屜（340×350）與桌面木釘列是考題常數、不跟著跨距縮，
  // L 或 D 一低於 450 就整組穿模（實測 L=400 有 40 對、D=300 有 9 對，還有榫眼開到料外）。
  // 幾何真正的下限就是考題尺寸，長寬直接夾在 450；高度 300~800 實測乾淨，維持 300。
  const MIN_LEN = EXAM.overall, MIN_DEPTH = EXAM.overall, MIN_H = 300;
  const L = Math.max(MIN_LEN, input.length);
  const D = Math.max(MIN_DEPTH, input.width);
  const H = Math.max(MIN_H, input.height);

  /** 世界座標：X 左右、Y 上（origin.y＝底）、Z 前後，**+Z＝背**，3D「正視」從 −Z 看。 */
  const topBottomY = H - E.topT;                       // 432
  const overhang = (E.overall - E.legFoot) / 2;        // 20
  const legOuterX = L / 2 - overhang;                  // 205
  const legOuterZ = D / 2 - overhang;
  const legInnerX = legOuterX - E.legW;                // 173
  const legInnerZ = legOuterZ - E.legD;                // 160
  const legCx = legOuterX - E.legW / 2;                // 189
  const legCz = legOuterZ - E.legD / 2;                // 182.5
  const legH = topBottomY;                             // 432
  const railSpanX = 2 * legInnerX;                     // 346（後板／前橫檔）
  const railSpanZ = 2 * legInnerZ;                     // 320（側板／滑條）
  const railBottomY = topBottomY - E.railH;            // 327
  const railCy = topBottomY - E.railH / 2;             // 379.5
  const sideRailCx = legOuterX - E.sideRailInset - T / 2;     // 187
  const sideRailInnerX = sideRailCx - T / 2;                  // 178
  const backRailCz = legOuterZ - E.backRailInset - T / 2;     // 186
  const frontFaceZ = -legOuterZ + E.frontInset;               // −195

  const parts: Part[] = [];
  const warnings: string[] = [];
  const round = (d: number) => ({ shape: "round" as const, length: d, width: d, through: false });

  // ── 桌面：木心板 434×434×18 ＋ 四周 8mm 實木封邊 ─────────────────────
  const coreL = L - 2 * E.edgeBand, coreD = D - 2 * E.edgeBand;
  // 桌面底面的木釘孔（Ø8，深 12）：4 支腳頂 + 每支側板／後板 3 支
  // ⚠️ 腳頂**沒有**木釘：C-C 前端腳正上方的桌面剖面裡只有木心板芯條的梳狀線，沒有任何孔；
  // 兩位對照員各自量過都確認。圖上畫得出位置的木釘＝桌面 9（每板 3 支 × 3 板）＋板端入腳 12 ＝ 21 支。
  // （材料表的 29 支是六題共用一張表的上限，不是第一題用量。）
  const topHoles: Array<{ x: number; z: number; label: string }> = [];
  const sideRailDowelZ = E.sideRailDowelsFromLegInner.map((d) => -legInnerZ + d);   // −129, 13, 155
  const backRailDowelX = E.backRailDowelsFromLegInner.map((d) => -legInnerX + d);   // −142, 0, 142
  for (const sx of [-1, 1]) for (const z of sideRailDowelZ) topHoles.push({ x: sx * sideRailCx, z, label: isEn ? "Ø8 dowel, side rail" : "Ø8 木釘（側板）" });
  for (const x of backRailDowelX) topHoles.push({ x, z: backRailCz, label: isEn ? "Ø8 dowel, back rail" : "Ø8 木釘（後板）" });
  parts.push({
    id: "top-core",
    nameZh: "桌面（木心板）",
    nameEn: "Top core (blockboard)",
    material: "blockboard-primary",
    grainDirection: "length",
    visible: { length: coreL, width: coreD, thickness: E.topT },
    origin: { x: 0, y: topBottomY, z: 0 },
    tenons: [],
    mortises: topHoles.map((h) => ({ origin: { x: h.x, y: 0, z: h.z }, depth: E.topDowelIntoTop, ...round(E.dowelDia), label: h.label })),
  });
  for (const s of [-1, 1] as const) {
    parts.push({
      id: s < 0 ? "top-edge-front" : "top-edge-back",
      nameZh: s < 0 ? "桌面封邊（前）" : "桌面封邊（後）",
      nameEn: s < 0 ? "Top edging (front)" : "Top edging (back)",
      material,
      grainDirection: "length",
      visible: { length: L, width: E.edgeBand, thickness: E.topT },
      origin: { x: 0, y: topBottomY, z: s * (D / 2 - E.edgeBand / 2) },
      tenons: [],
      mortises: [],
    });
    parts.push({
      id: s < 0 ? "top-edge-left" : "top-edge-right",
      nameZh: s < 0 ? "桌面封邊（左）" : "桌面封邊（右）",
      nameEn: s < 0 ? "Top edging (left)" : "Top edging (right)",
      material,
      grainDirection: "length",
      visible: { length: coreD, width: E.edgeBand, thickness: E.topT },
      origin: { x: s * (L / 2 - E.edgeBand / 2), y: topBottomY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 腳柱 ×4：32(x)×45(z)×432，rotation x=π/2（local x→世界 x、local y(厚 45)→世界 z、local z(寬 432)→世界 −y）──
  // 榫眼 local 座標：ly = dz + 22.5（dz＝離腳中心 z）、lz = −dy（dy＝離腳中心高 216）。
  const legCy = legH / 2;
  const frontRailCy = H - E.frontRailBottomFromTop + E.frontRailH / 2;   // 295
  const tenonW = E.frontRailH - 2 * E.frontRailTenonShoulder;            // 52
  for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) {
    const m: Mortise[] = [];
    // 側板端木釘孔 ×2：開在朝向側板那一面（前腳背面 / 後腳正面），離桌面底 25、75，x 對齊側板中心
    for (const d of E.railEndDowelsFromTop) m.push({
      origin: { x: -sx * (legCx - sideRailCx), y: sz < 0 ? E.legD : 0, z: -((topBottomY - d) - legCy) },
      depth: E.railDowelIntoLeg, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, side rail" : "Ø8 木釘（側板）",
    });
    // 後腳：後板端木釘孔 ×2，開在內側 x 面（local ±x 端），z 對齊後板中心
    if (sz > 0) for (const d of E.railEndDowelsFromTop) m.push({
      origin: { x: -sx * E.legW / 2, y: (backRailCz - legCz) + E.legD / 2, z: -((topBottomY - d) - legCy) },
      depth: E.railDowelIntoLeg, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, back rail" : "Ø8 木釘（後板）",
    });
    // 前腳：前橫檔榫眼（6 厚 × 52 高，深 21），開在內側 x 面，z 對齊橫檔中心
    if (sz < 0) m.push({
      origin: { x: -sx * E.legW / 2, y: (frontFaceZ + T / 2) - (-legCz) + E.legD / 2, z: -(frontRailCy - legCy) },
      depth: E.frontRailTenonL, length: tenonW, width: E.frontRailTenonT, through: false,
      label: isEn ? "mortise, front rail tenon (6×52)" : "前橫檔榫眼（6×52）",
    });
    parts.push({
      id: `leg-${sx < 0 ? "left" : "right"}-${sz < 0 ? "front" : "back"}`,
      nameZh: `腳柱（${sx < 0 ? "左" : "右"}${sz < 0 ? "前" : "後"}）`,
      nameEn: `Leg (${sx < 0 ? "left" : "right"} ${sz < 0 ? "front" : "back"})`,
      material,
      grainDirection: "width",
      visible: { length: E.legW, width: legH, thickness: E.legD },
      origin: { x: sx * legCx, y: 0, z: sz * legCz },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: m,
    });
  }

  // ── 側板 ×2：木心板 18×105×320，rotation {x:π/2, y:π/2}（local x→世界 −z、local y(厚)→世界 x、local z(寬)→世界 −y）──
  // local：lx = −dz、ly = dx + 9、lz = −dy（dy 離板中心高 379.5）
  for (const sx of [-1, 1] as const) {
    const m: Mortise[] = [];
    for (const d of E.railEndDowelsFromTop) for (const ex of [-1, 1]) m.push({
      origin: { x: ex * railSpanZ / 2, y: T / 2, z: -((topBottomY - d) - railCy) },
      depth: E.dowelLen - E.railDowelIntoLeg, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, leg" : "Ø8 木釘（入腳）",
    });
    for (const z of sideRailDowelZ) m.push({
      origin: { x: -z, y: T / 2, z: -E.railH / 2 },
      depth: E.dowelLen - E.topDowelIntoTop, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, top" : "Ø8 木釘（桌面）",
    });
    parts.push({
      id: sx < 0 ? "side-rail-left" : "side-rail-right",
      nameZh: sx < 0 ? "側板（左）" : "側板（右）",
      nameEn: sx < 0 ? "Side rail (left)" : "Side rail (right)",
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: railSpanZ, width: E.railH, thickness: T },
      origin: { x: sx * sideRailCx, y: railBottomY, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: m,
    });
  }

  // ── 後板：木心板 18×105×346，rotation x=π/2（local y(厚)→世界 z、local z(寬)→世界 −y）──
  {
    const m: Mortise[] = [];
    for (const d of E.railEndDowelsFromTop) for (const ex of [-1, 1]) m.push({
      origin: { x: ex * railSpanX / 2, y: T / 2, z: -((topBottomY - d) - railCy) },
      depth: E.dowelLen - E.railDowelIntoLeg, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, leg" : "Ø8 木釘（入腳）",
    });
    for (const x of backRailDowelX) m.push({
      origin: { x, y: T / 2, z: -E.railH / 2 },
      depth: E.dowelLen - E.topDowelIntoTop, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, top" : "Ø8 木釘（桌面）",
    });
    parts.push({
      id: "back-rail",
      nameZh: "後板",
      nameEn: "Back rail",
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: railSpanX, width: E.railH, thickness: T },
      origin: { x: 0, y: railBottomY, z: backRailCz },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: m,
    });
  }

  // ── 前曲線橫檔：18×60×346，兩端 6 厚榫入腳 21；下緣壸門；正面頂緣 6×4 缺口 ─────
  {
    const frontRailBottomY = H - E.frontRailBottomFromTop;   // 265
    const rail: Part = {
      id: "front-rail",
      nameZh: "前曲線橫檔",
      nameEn: "Front curved rail",
      material,
      grainDirection: "length",
      visible: { length: railSpanX, width: E.frontRailH, thickness: T },
      origin: { x: 0, y: frontRailBottomY, z: frontFaceZ + T / 2 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      shape: { kind: "edge-profile", style: "kunmen", depthMm: E.frontRailRise, profilePoints: certB1FrontProfile(railSpanX, E.frontRailH) },
      tenons: (["start", "end"] as const).map((position) => ({
        position,
        type: "blind-tenon" as const,
        length: E.frontRailTenonL,
        width: tenonW,               // 沿 local z（高）：60 − 上下各 4 肩
        thickness: E.frontRailTenonT, // 沿 local y（厚）：6｜6｜6 居中
        shoulderOn: ["top", "bottom", "left", "right"] as Array<"top" | "bottom" | "left" | "right">,
      })),
      // 正面頂緣缺口 6 寬 × 4 深（頂＝local −z 面；正面＝local y=0 側）
      mortises: [{
        origin: { x: 0, y: E.frontRailNotchW / 2, z: -E.frontRailH / 2 }, depth: E.frontRailNotchD, length: railSpanX, width: E.frontRailNotchW,
        through: false, cosmetic: true, label: isEn ? "6×4 notch, front top edge" : "正面頂緣 6×4 缺口",
      }],
    };
    parts.push(rail);
  }

  // ── 滑條 ×2：15(x)×14(y)×320(z)，鎖在側板內面，入抽屜側板槽 7 ──────────
  const runnerTopY = topBottomY - E.runnerGrooveTopFromTop;   // 392
  const runnerCx = sideRailInnerX - E.runnerW / 2;            // 170.5
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: sx < 0 ? "runner-left" : "runner-right",
      nameZh: sx < 0 ? "抽屜滑條（左）" : "抽屜滑條（右）",
      nameEn: sx < 0 ? "Drawer runner (left)" : "Drawer runner (right)",
      material,
      grainDirection: "length",
      visible: { length: railSpanZ, width: E.runnerH, thickness: E.runnerW },
      origin: { x: sx * runnerCx, y: runnerTopY - E.runnerH, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 木釘 ×25（Ø8×30 現成木釘，做成零件插在孔裡；不入裁切／零件圖）──────
  const dowel = (id: string, nameZh: string, nameEn: string, axis: "x" | "y" | "z", center: { x: number; y: number; z: number }): Part => ({
    id, nameZh, nameEn, material, grainDirection: "length",
    visible: axis === "x"
      ? { length: E.dowelLen, width: E.dowelDia, thickness: E.dowelDia }
      : axis === "z"
        ? { length: E.dowelDia, width: E.dowelLen, thickness: E.dowelDia }
        : { length: E.dowelDia, width: E.dowelDia, thickness: E.dowelLen },
    origin: { x: center.x, y: center.y - (axis === "y" ? E.dowelLen / 2 : E.dowelDia / 2), z: center.z },
    shape: { kind: "round", axis },
    visual: "dowel",
    tenons: [],
    mortises: [],
  });
  // 桌面木釘（直立）：入桌面 12、入板 18 → 中心在桌面底下 3
  const topDowelCy = topBottomY - (E.dowelLen - E.topDowelIntoTop) + E.dowelLen / 2;   // 429
  let n = 0;
  for (const h of topHoles) parts.push(dowel(`dowel-top-${++n}`, `木釘 Ø8×30（桌面）`, "Dowel Ø8×30 (top)", "y", { x: h.x, y: topDowelCy, z: h.z }));
  // 側板端木釘（沿 z）：入腳 15、入板 15 → 中心在腳內面
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const d of E.railEndDowelsFromTop) {
    parts.push(dowel(`dowel-side-${sx < 0 ? "l" : "r"}${sz < 0 ? "f" : "b"}-${d}`, "木釘 Ø8×30（側板）", "Dowel Ø8×30 (side rail)", "z",
      { x: sx * sideRailCx, y: topBottomY - d, z: sz * legInnerZ }));
  }
  // 後板端木釘（沿 x）
  for (const sx of [-1, 1]) for (const d of E.railEndDowelsFromTop) {
    parts.push(dowel(`dowel-back-${sx < 0 ? "l" : "r"}-${d}`, "木釘 Ø8×30（後板）", "Dowel Ø8×30 (back rail)", "x",
      { x: sx * legInnerX, y: topBottomY - d, z: backRailCz }));
  }

  // ── 抽屜 ─────────────────────────────────────────────────────────────
  if (withDrawer) {
    const zShift = -pull;                                   // 拉出示意：整組往前
    const frontCz = frontFaceZ + E.drawerFrontT / 2 + zShift;                // −186
    const frontTopY = topBottomY - E.drawerFrontGapTop;                      // 430
    const frontBottomY = frontTopY - E.drawerFrontH;                         // 327
    const sideTopY = topBottomY - E.drawerSideGapTop;                        // 427
    const sideBottomY = sideTopY - E.drawerSideH;                            // 327
    const backZ1 = frontFaceZ + E.drawerD + zShift;                          // 155（後板背面）
    const backCz = backZ1 - E.drawerBackT / 2;                               // 147.5
    const bottomY = sideBottomY + E.bottomGrooveTopFromBottom - E.bottomT;   // 338
    const backBottomY = bottomY + E.bottomT;                                 // 342
    const sideCx = E.drawerW / 2 - E.drawerSideT / 2;                        // 162.5
    // 側板長：從面板正面往後 6（半隱鳩尾面皮）＝榫孔底，一路到後板背面
    const sideZ0 = frontFaceZ + (E.drawerFrontT - E.dovetailPinDepth) + zShift;   // −189
    const sideLen = backZ1 - sideZ0;                                         // 347
    const sideCz = (sideZ0 + backZ1) / 2;
    const runnerGrooveCy = runnerTopY - E.runnerGrooveH / 2;                 // 384.5
    const bottomGrooveCy = bottomY + E.bottomT / 2;                          // 340
    const sideCy = sideBottomY + E.drawerSideH / 2;                          // 377

    // 面板 340×103×18（rotation x=π/2；正面＝local y=0）
    parts.push({
      id: "drawer-1-front",
      nameZh: "抽屜面板",
      nameEn: "Drawer front",
      material,
      grainDirection: "length",
      visible: { length: E.drawerW, width: E.drawerFrontH, thickness: E.drawerFrontT },
      origin: { x: 0, y: frontBottomY, z: frontCz },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [
        { origin: { x: 0, y: 0, z: 0 }, depth: E.drawerFrontT, ...round(E.fingerHoleDia), through: true, cosmetic: true, label: isEn ? "Ø20 finger hole, centre" : "正中央 Ø20 指孔" },
        { origin: { x: 0, y: E.drawerFrontT, z: -(bottomGrooveCy - (frontBottomY + E.drawerFrontH / 2)) }, depth: E.bottomGrooveD, length: E.drawerW - 2 * E.drawerSideT + 2 * E.bottomGrooveD, width: E.bottomT,
          through: false, cosmetic: true, label: isEn ? "bottom groove 4 wide × 7 deep" : "底板槽（4 寬 × 7 深）" },
      ],
    });
    // 側板 ×2：15×100×347，兩端鳩尾（尾在側板）；外面滑條槽、內面底板槽
    for (const sx of [-1, 1] as const) {
      const outerY = sx < 0 ? 0 : E.drawerSideT, innerY = sx < 0 ? E.drawerSideT : 0;
      parts.push({
        id: sx < 0 ? "drawer-1-side-left" : "drawer-1-side-right",
        nameZh: sx < 0 ? "抽屜側板（左）" : "抽屜側板（右）",
        nameEn: sx < 0 ? "Drawer side (left)" : "Drawer side (right)",
        material,
        grainDirection: "length",
        visible: { length: sideLen, width: E.drawerSideH, thickness: E.drawerSideT },
        origin: { x: sx * sideCx, y: sideBottomY, z: sideCz },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        shape: { kind: "dovetail-ends", segmentCount: E.dovetailSegments, phase: 0, angleDeg: E.dovetailAngleDeg, pinDepth: E.dovetailPinDepth, halfPin: true },
        tenons: [],
        mortises: [
          { origin: { x: 0, y: outerY, z: -(runnerGrooveCy - sideCy) }, depth: E.runnerGrooveD, length: sideLen, width: E.runnerGrooveH,
            through: false, cosmetic: true, label: isEn ? "runner groove 15 high × 8 deep" : "滑條槽（15 高 × 8 深）" },
          { origin: { x: 0, y: innerY, z: -(bottomGrooveCy - sideCy) }, depth: E.bottomGrooveD, length: sideLen, width: E.bottomT,
            through: false, cosmetic: true, label: isEn ? "bottom groove 4 wide × 7 deep" : "底板槽（4 寬 × 7 深）" },
        ],
      });
    }
    // 後板 340×80×15：底板從它底下穿過，Ø2.4×15 木螺釘鎖入；兩端在滑條槽高度開 15×8 缺口讓滑條通過
    // （側板的滑條槽一路開到底、穿過鳩尾針區；後板與側板齊寬，不開缺口滑條會撞到後板端）
    const backCy = backBottomY + E.drawerBackH / 2;
    parts.push({
      id: "drawer-1-back",
      nameZh: "抽屜後板",
      nameEn: "Drawer back",
      material,
      grainDirection: "length",
      visible: { length: E.drawerW, width: E.drawerBackH, thickness: E.drawerBackT },
      origin: { x: 0, y: backBottomY, z: backCz },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: ([-1, 1] as const).map((ex) => ({
        origin: { x: ex * E.drawerW / 2, y: E.drawerBackT / 2, z: -(runnerGrooveCy - backCy) },
        depth: E.runnerGrooveD, length: E.drawerBackT, width: E.runnerGrooveH, through: false, cosmetic: true,
        label: isEn ? "runner notch 15×8 (end)" : "滑條缺口（端部 15 高 × 8 深）",
      })),
    });
    // 4mm 合板底板 324×339：入面板槽 7、入兩側板槽各 7、後端與後板背面齊
    parts.push({
      id: "drawer-1-bottom",
      nameZh: "抽屜底板（4mm 合板）",
      nameEn: "Drawer bottom (4mm plywood)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: { length: E.drawerW - 2 * E.drawerSideT + 2 * E.bottomGrooveD, width: backZ1 - (frontFaceZ + E.drawerFrontT - E.bottomGrooveD + zShift), thickness: E.bottomT },
      origin: { x: 0, y: bottomY, z: (backZ1 + frontFaceZ + E.drawerFrontT - E.bottomGrooveD + zShift) / 2 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 非考題尺寸就出聲 ───────────────────────────────────────────────
  if (L !== input.length || D !== input.width || H !== input.height) {
    warnings.push(isEn
      ? `Too small to build: clamped to ${L}×${D}×${H} mm (minimum ${MIN_LEN}×${MIN_DEPTH}×${MIN_H}).`
      : `尺寸太小做不出來：已夾到 ${L}×${D}×${H}mm（下限 ${MIN_LEN}×${MIN_DEPTH}×${MIN_H}）。`);
  }
  if (L !== E.overall || D !== E.overall || H !== E.overall) {
    warnings.push(isEn
      ? `Not the exam size: the official piece is ${E.overall}×${E.overall}×${E.overall} mm (you have ${L}×${D}×${H}). Fine for practice, but test day is the official size.`
      : `不是考題尺寸：官方試題是 ${E.overall}×${E.overall}×${E.overall}mm（目前 ${L}×${D}×${H}）。練習可以，應檢要照官方尺寸。`);
  }
  if (pull > 0) warnings.push(isEn ? `Drawer shown pulled out ${pull} mm (display only).` : `抽屜拉出 ${pull}mm 只是展示，尺寸不變。`);

  const design: FurnitureDesign = {
    id: `cert-b1-${L}x${D}x${H}`,
    category: "cert-b1",
    nameZh: "家具木工乙級 第一題（01200-100201）",
    overall: { length: L, width: D, thickness: H },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class B furniture-woodworking trade test, question 01200-100201 (7 hours). A 450×450×450 mm side table with one drawer: blockboard top 434×434 with 8 mm solid edging, four 45×32 legs on a 410×410 footprint (3 mm chamfer at the foot), blockboard side/back rails 105 high dowelled into the legs (Ø8×30, 15/15) and to the top (Ø8×30, 12 into the top / 18 into the rail, at 31/173/315 from the leg), a curved front rail 60 high with 70 mm flats and tangent R15/R15 rising 20, 6 mm tenons 21 into the legs and a 6×4 notch on the front top edge, and a side-hung drawer 340×350: front 340×103×18 with a Ø20 finger hole, sides 15×100 with a 15×8 runner groove (top 40 below the tabletop) and a 4×7 bottom groove (top 15 above the drawer bottom), back 15×80, 4 mm plywood bottom screwed to the back with ${E.bottomScrew}; runners 15×14×320 screwed to the side rails with ${E.runnerScrew}. Dovetails: 7 segments per corner (28 mating faces, as scored); the front is half-blind with a 3 mm lap in this model (official section shows 6). **Drawn from published dimensions — download the official paper and follow that version on test day.**`
      : `依技術士技能檢定家具木工乙級術科試題 01200-100201（7 小時）公開尺寸繪製的練習範本。450×450×450 的單抽小桌：木心板桌面 434×434 四周貼 8mm 實木封邊；四支 45×32 腳柱、腳架 410×410、腳底 3mm 斜角；側板／後板木心板 105 高，兩端各 2 支 Ø8×30 木釘入腳（入腳 15、入板 15，離桌面底 25、75），桌面每板 3 支木釘（入桌面 12、入板 18，離腳內面 31、173、315）；前曲線橫檔 60 高、兩端各 70 平段、R15／R15 相切升高 20，6 厚榫入腳 21，正面頂緣 6×4 缺口；側掛式抽屜 340×350：面板 340×103×18 正中央 Ø20 指孔、頂離桌面底 2；側板 15×100，外面滑條槽 15 高 × 8 深（槽頂離桌面底 40）、內面底板槽 4×7（槽頂離抽屜底 15）；後板 15×80；4mm 合板底板從後板底下穿過、用 ${E.bottomScrew} 鎖入後板；滑條 15×14×320 以 ${E.runnerScrew} 固定——**從桌子外面穿過 18 厚側板再進滑條 12**（18＋12＝30，沉頭露在側板外面，評審表「木螺釘 平整、釘頭完整 12 部位」看的就是這 12 顆），滑條入抽屜側板槽 7。鳩尾榫每角 7 段（評審表 28 個密合部位）；面板端為半隱鳩尾，本範本齒深 15 留 3 面皮（官方剖面隱藏線在離背面 6 處）。官方材料表是**六題共用一張**（每人份）：木料 1050×95×32.5（第一題 1 支＝四支腳）、600×92×21.5（前橫檔＋兩支滑條）、440×132×18.5（**抽屜面板，實木**）、400×130×15.5 ×3（抽屜側板 ×2＋後板）、550×19×8.5 ×5（桌面四條封邊），木心板 480×450×18（桌面芯）、426×178×18 ×3（側板 ×2＋後板），合板 408×350×4（抽屜底板），木釘與三種木螺釘、白膠。木釘 29 支與 Ø3×25 ×14 是六題的上限：**本題圖上的木釘是 21 支，Ø3×25 沒有用到**。
本範本未做成造型、只寫在工序裡的：腳底 3mm 斜角、木螺釘本體；桌面封邊四角用對接（實務常用 45° 斜接，材料也夠，兩種都可以）。抽屜關到底圖上沒畫止擋（後板前面還有 22mm 餘裕），實作要在桌架後板前面加止擋塊。**本圖依公開尺寸自行繪製，不含官方圖檔；應檢請以技能檢定中心公布的官方版本為準。**`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};

/** 研究頁／舊測試用：考題預設尺寸的完整設計。 */
export function certB1Assembly(): FurnitureDesign {
  const options: Record<string, string | number | boolean> = {};
  for (const s of certB1Options) options[s.key] = s.defaultValue;
  return certB1({ length: EXAM.overall, width: EXAM.overall, height: EXAM.overall, material: "pine", options });
}
