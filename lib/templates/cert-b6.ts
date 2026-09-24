import type {
  FurnitureDesign,
  FurnitureTemplate,
  Mortise,
  OptionSpec,
  Part,
  Tenon,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

// ============================================================================
// 家具木工乙級 第六題（01200-100206）—— 第一輪（草稿）
// ============================================================================
//
// 來源：docs/research/furniture-class-b/sources/012002B15-practical-v114.pdf
// （向量版）page 20（工作圖）、page 12（評審表）、page 6（材料表，六題共用同一張）。
//
// 判讀方式跟 cert-b5 一樣：`pdftoppm -r 600` 高解析輸出 + `magick -crop` 局部放大，
// 逐區讀官方向量圖，不是憑印象。以下記錄本輪（第一輪）判讀到、跟 cert-b5 不一樣的
// 結構重點，跟每個數字的信心等級——**這是第一輪草稿，比照 cert-b5 慣例，之後應該
// 還要走多輪複查才能收斂**，不是宣稱百分之百正確。
//
// 【高信心（評審表 / 圖面文字直接讀出）】
// - 總高 H=370、總寬 W=494、總深 D=380（評審表「部位」尺寸欄直接列）。
// - 腳柱寬厚 45×32（跟 cert-b5 數值相同，但軸向配置本題另外判讀，見下）。
// - 側下橫檔寬厚 45×32（評審表「部位4」＝2支×2尺寸，物理只有 2 支）。
// - 上、中橫檔寬厚 60×21（評審表「部位4」＝2支×2尺寸，物理只有 2 支——上橫檔＋
//   中橫檔各一支，尺寸相同）。
// - 抽屜 384×350、前板 130 高（評審表直接列）。
// - 圖面文字明寫：「腳架上下裂口榫接合，各以2支木釘補強，結構如圖示」——腳柱跟橫檔
//   （上下都算）之間走「裂口榫」（開放式缺口榫，不是盲榫全包），每處接合另外補強 2 支木釘。
// - B-B 剖面量到抽屜前/側板厚度標註「18｜5｜15」——18＝前板厚、15＝側板厚，中間 5 是
//   鳩尾榫頭外露段，跟 cert-b5 的 18／15 完全一致。
// - 材料表：本題項次2（480×92×21.5 或近似料）發 **2支**（cert-b5 同一項只發 1 支）——
//   直接對應「上橫檔＋中橫檔」兩支疊放的結構，是本題跟 cert-b5 最大的差異來源。
// - 木釘 Ø8×30、抽屜底板螺釘 Ø2.4×15（材料表硬約束「只發 3 支」）跟六題共用，沿用。
//
// 【中信心（結構合理推論，未逐一像素核對）】
// - 「側下橫檔」的「側」字跟 cert-b5「側下橫檔」（前後各一）不同——這裡判讀成左右各一支
//   （沿深度方向），連接同一側的前腳跟後腳；上／中橫檔則跟 cert-b5 一樣只在後側（連接
//   左右後腳）。這個判讀主要依據：評審表兩者都只列「部位4＝2支」，跟物理支數吻合；
//   純數字本身沒辦法反推「前後」還是「左右」，是本輪的結構判斷，留待下一輪覆核。
// - 圖面右下角縮圖出現一組「494/472（寬）、380/360（深）」雙重標註 + 一張標「10」
//   （C-C 剖面，梯形輪廓、360 長邊），判讀為腳柱有側腳（splay）——樓地板端較寬
//   （494×380，跟評審表總寬深一致）、上端（橫檔那端）較窄（472×360）。**這輪暫不
//   把側腳做進 3D 幾何**（腳柱先畫直腳），原因：(1) 側腳角度不是評審表列出的評分尺寸；
//   (2) 現有共用側腳工具（`_helpers.ts` 的 `splayedLegMortiseGeom` 等）是為圓腳/45°
//   對角外斜設計，要套進本題「矩形、X/Z 各自獨立斜率」的腳型需要另外改造共用層，
//   風險（可能波及其他已上線範本）大於這輪能驗證的把握；(3) 沒有側腳一樣能把 8 個
//   評分尺寸做對。側腳留白＝已知、記錄在案的簡化，不是沒發現。
// - 評審表沒有另外列「桌面板」尺寸項（跟 cert-b5 的桌面 493×370 是獨立評分項不同）——
//   判讀成本題**沒有獨立桌面板**，腳柱直接頂到頂（H=370 全高），上／中橫檔就是最頂端
//   結構。材料表項次6/7/8（木心板/合板）雖然照樣發料，但材料表附註3明寫這些是
//   「以術科測試辦理單位實際準備之材料為準」（六題共用、非本題專屬證據，跟 cert-b5
//   判讀材料表的既有規則一致），不能拿來反推「本題也有桌面」。
// - Ø3.5×30 cns1051 螺釘：A-A 剖面在腳柱上端（後腳、上橫檔區域）找到一個獨立標註，
//   位置跟裂口榫／木釘補強區很近，但圖面沒有明確畫出用途細節。判讀成「上橫檔／中橫檔
//   接合區的額外鎖固」，每支後腳×每支上層橫檔一支＝4 支，比照 cert-b5「盲榫+補強釘」
//   既有做法延伸。抽屜滑條螺釘沿用 cert-b5 驗證過的 Ø3×25／每邊2支。
// - 裂口榫（notch-tenon / open tenon）在型別系統裡沒有專屬 `JoineryType`——現有選項是
//   `"through-tenon"|"blind-tenon"|...`，都沒有「開放式缺口」這個語意。這輪選擇用
//   `"through-tenon"`：跟「裂口榫」一樣是「外露／看得到榫頭」的開放式接合，跟盲榫
//   （完全包覆）語意上比盲榫更接近，且稽核（auditJoints）只比對尺寸配對不比對造形，
//   選哪個都不影響稽核通過與否。3D 幾何維持標準矩形榫頭／榫孔（沒有另外把「缺口」的
//   開放造形建出來）——跟側腳一樣，是本輪記錄在案的簡化。
//
// 【本輪沒有進一步解開的疑點（留給下一輪）】
// - 494/472、380/360 的側腳角度未建進 3D。
// - 評審表五金裝配部位數字（本輪未逐一核對到最終總數，比照 cert-b5 經驗，這類尾數
//   常常要花好幾輪才收斂，這裡不硬湊）。
// - Ø3.5×30 的確切用途／支數只是結構合理推論，非逐字圖面確認。
//
/** 官方試題尺寸（mm）。X 0~494 由左腳柱外面、Y 0~370 由地面、Z 0~380 由前面（+Z＝背） */
const EXAM = {
  W: 494, D: 380, H: 370,
  legW: 32, legD: 45,                          // 腳柱寬(沿長向) × 厚(沿深向)，本輪畫直腳（側腳未建，見檔頭說明）
  upperRailH: 60, upperRailT: 21,               // 上橫檔：60 高 × 21 厚，只在後側、貼頂
  midRailH: 60, midRailT: 21,                   // 中橫檔：跟上橫檔同尺寸，疊在上橫檔正下方
  lowerRailH: 45, lowerRailT: 32,               // 側下橫檔：45 高 × 32 厚，左右各一支、貼地（跟 cert-b5「前後各一」不同，見檔頭）
  legRailTenonT: 18,                            // 橫檔入腳的盲榫厚（腳柱 45 厚同 cert-b5，沿用同一個厚度）
  legRailTenonLen: 20,
  upperRailTenonT: 10,                          // 60高×21厚橫檔專用榫厚（留 5.5mm 肩，21 厚沒辦法用 18）
  jointDowelIntoLeg: 12, jointDowelIntoRail: 18, // 裂口榫補強木釘 Ø8×30 拆兩段：12 入腳柱（面鑽）、18 入橫檔（端面木紋），比照 cert-b5 12|18 分法
  drawerW: 384, drawerD: 350, drawerFrontH: 130,
  drawerFrontT: 18, drawerSideT: 15, drawerBackT: 15,   // B-B 剖面「18｜5｜15」直接讀出
  drawerBottomT: 4, drawerBottomGrooveD: 7,
  runnerH: 14,                                  // 滑條高度，沿用 cert-b5 規格；寬度用公式算（腳柱內面到側板內緣的跨距）
  dovetailSegments: 9, dovetailAngleDeg: 9.46, dovetailPinDepth: 12,  // 沿用 cert-b5 驗證過的公式（鳩尾榫密合數÷2角），本題未獨立回圖核對段數，見檔頭中信心說明
  dowelDia: 8, dowelLen: 30, dowelIntoSideFace: 7.5,
  screwDia: 2.4, screwLen: 15,                  // Ø2.4×15：材料表硬約束，抽屜底板用
  runnerScrewDia: 3, runnerScrewLen: 25,        // Ø3×25：滑條鎖進腳柱，沿用 cert-b5 驗證過的做法
  railReinforceScrewDia: 3.5, railReinforceScrewLen: 30,  // Ø3.5×30 cns1051：上/中橫檔接合區補強，見檔頭中信心說明
} as const;

export const certB6Options: OptionSpec[] = [
  {
    group: "structure",
    type: "number",
    key: "drawerPull",
    label: "抽屜拉出量（示意）",
    defaultValue: 0,
    min: 0,
    max: 250,
    step: 10,
    unit: "mm",
    help: "只影響 3D 展示（把抽屜拉出來看滑條怎麼入槽），不改任何尺寸。應檢時抽屜當然是關著的",
  },
  {
    group: "structure",
    type: "checkbox",
    key: "withDrawer",
    label: "裝抽屜",
    defaultValue: true,
    help: "試題一定要做抽屜。取消只是為了看清楚腳架與橫檔，應檢一定要裝",
  },
];

export const certB6: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certB6Options;
  const pullRaw = getOption<number>(input, opt(o, "drawerPull"));
  const pull = Math.min(250, Math.max(0, Number.isFinite(pullRaw) ? pullRaw : 0));
  const withDrawer = getOption<boolean>(input, opt(o, "withDrawer"));

  const E = EXAM;
  // 尺寸鎖死：跟 b1~b5 一樣，考題的每一個常數都是官方數字，不跟滑桿縮放。
  const W = E.W, D = E.D, H = E.H;
  const warnings: string[] = [];
  const round = (d: number) => ({ shape: "round" as const, length: d, width: d, through: false });

  // 木釘展示零件（比照 cert-b1/cert-b5 的 dowel() helper）：`visual:"dowel"` 是 `derive.ts`
  // 判斷「要不要生成鑽木釘孔工序」的閘門，center 直接給世界座標。
  const dowel = (id: string, nameZh: string, nameEn: string, axis: "x" | "y" | "z", center: { x: number; y: number; z: number }, len: number = E.dowelLen): Part => ({
    id, nameZh, nameEn, material, grainDirection: "length",
    visible: axis === "x"
      ? { length: len, width: E.dowelDia, thickness: E.dowelDia }
      : axis === "z"
        ? { length: E.dowelDia, width: len, thickness: E.dowelDia }
        : { length: E.dowelDia, width: E.dowelDia, thickness: len },
    origin: { x: center.x, y: center.y - (axis === "y" ? len / 2 : E.dowelDia / 2), z: center.z },
    shape: { kind: "round", axis },
    visual: "dowel",
    tenons: [],
    mortises: [],
  });

  /** 圖面座標 → 世界座標：X 置中、Z 置中（+Z＝背）、Y 不變（origin.y＝底） */
  const wx = (x: number) => x - W / 2;
  const wz = (z: number) => z - D / 2;

  const parts: Part[] = [];

  // ── 版面關鍵座標 ─────────────────────────────────────────────────
  const legCx0 = E.legW / 2;                    // 16  左腳中心
  const legCx1 = W - E.legW / 2;                // 478 右腳中心
  const legCzFront = E.legD / 2;                // 22.5  前腳沿深度中心
  const legCzBack = D - E.legD / 2;              // 357.5 後腳沿深度中心
  const railSpanX = W - 2 * E.legW;              // 430（左右後腳內面之間，上/中橫檔跨距）
  const railSpanZ = D - 2 * E.legD;              // 290（前後腳內面之間，側下橫檔跨距）
  const legCenterY = H / 2;                      // 185（腳柱本輪全高、沒有獨立桌面板，見檔頭）

  // ── 腳柱 ×4：直腳 32(x)×45(z)×370(y)，rotation x=π/2 ─────────────
  // 跟 cert-b5 同一套 local↔world 軸換算（已在 cert-b5 驗證過、AGENTS.md 要求沿用而非重猜）：
  // rotation{x:π/2}下 local x(長,legW)→世界x、local y(厚,legD)→世界z、local z(寬,legHeight)→世界−y。
  // mortise.origin 在這個未旋轉的 part-local 座標系裡：
  //   x：世界X方向的面別（±legW/2＝腳柱兩側面，上/中橫檔從這裡入榫，跟 cert-b5 後上橫檔同做法）
  //   y：世界Z方向的面別（0 或 legD＝腳柱前/後面，側下橫檔從這裡入榫——本題新做法，cert-b5 沒用到）
  //   z：世界Y方向（高度，legCenterY − 目標世界高＝負向，跟 cert-b5 腳柱榫眼同一套公式）
  for (const sx of [0, 1] as const) for (const sz of [0, 1] as const) {
    const cx = sx === 0 ? legCx0 : legCx1;
    const cz = sz === 0 ? legCzFront : legCzBack;
    const legInX = sx === 0 ? 1 : -1;             // 朝跨距內側的 local x 正負（上/中橫檔入面）
    // 側下橫檔從哪一個 Z 面入榫：前腳(sz=0)的橫檔往後延伸(世界+Z變大)，內面在 local-y 較大那端(=legD)；
    // 後腳(sz=1)的橫檔往前延伸(世界+Z變小)，內面在 local-y 較小那端(=0)。
    const legInY = sz === 0 ? E.legD : 0;
    const m: Mortise[] = [];

    // 側下橫檔盲榫眼（裂口榫近似）：4 支腳都有，入面＝local-Y（世界Z），貼地
    const lowerRailLocalZ = legCenterY - E.lowerRailH / 2;
    m.push({
      origin: { x: 0, y: legInY, z: lowerRailLocalZ },
      depth: E.legRailTenonLen, length: E.lowerRailH, width: E.legRailTenonT,
      through: false,
      label: isEn ? "mortise, side lower rail tenon (notch-tenon)" : "側下橫檔盲榫眼（裂口榫）",
    });
    // 補強木釘 ×2（同面，沿高度方向上下各偏移，避開榫頭中軸但仍咬進榫頭範圍——裂口榫補強的既定做法）
    const lowerDowelOff = E.lowerRailH / 2 - 10;
    for (const dz of [-1, 1] as const) {
      m.push({
        origin: { x: 0, y: legInY, z: lowerRailLocalZ + dz * lowerDowelOff },
        depth: E.jointDowelIntoLeg, ...round(E.dowelDia),
        label: isEn ? "Ø8 dowel, side lower rail (joint reinforcement)" : "Ø8 木釘（側下橫檔補強）",
      });
    }

    // 上橫檔／中橫檔盲榫眼：只有後側兩支腳（sz===1）才有，入面＝local-X（世界X），貼頂
    if (sz === 1) {
      const upperLocalZ = legCenterY - (H - E.upperRailH / 2);
      const midLocalZ = legCenterY - (H - E.upperRailH - E.midRailH / 2);
      m.push({
        origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: upperLocalZ },
        depth: E.legRailTenonLen, length: E.upperRailH, width: E.upperRailTenonT,
        through: false,
        label: isEn ? "mortise, upper rail tenon (notch-tenon)" : "上橫檔盲榫眼（裂口榫）",
      });
      m.push({
        origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: midLocalZ },
        depth: E.legRailTenonLen, length: E.midRailH, width: E.upperRailTenonT,
        through: false,
        label: isEn ? "mortise, middle rail tenon (notch-tenon)" : "中橫檔盲榫眼（裂口榫）",
      });
      const upperDowelOff = E.upperRailH / 2 - 15;
      for (const dz of [-1, 1] as const) {
        m.push({
          origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: upperLocalZ + dz * upperDowelOff },
          depth: E.jointDowelIntoLeg, ...round(E.dowelDia),
          label: isEn ? "Ø8 dowel, upper rail (joint reinforcement)" : "Ø8 木釘（上橫檔補強）",
        });
      }
      const midDowelOff = E.midRailH / 2 - 15;
      for (const dz of [-1, 1] as const) {
        m.push({
          origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: midLocalZ + dz * midDowelOff },
          depth: E.jointDowelIntoLeg, ...round(E.dowelDia),
          label: isEn ? "Ø8 dowel, middle rail (joint reinforcement)" : "Ø8 木釘（中橫檔補強）",
        });
      }
      // Ø3.5×30 補強螺釘（見檔頭中信心說明）：上/中橫檔區域各一支，鎖進腳柱
      m.push({
        origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: upperLocalZ },
        depth: E.railReinforceScrewLen, ...round(E.railReinforceScrewDia), cosmetic: true, through: false,
        label: isEn ? "Ø3.5×30 pilot hole, into leg (upper rail reinforcement)" : "Ø3.5×30 導引孔（上橫檔補強，鎖入腳柱）",
      });
      m.push({
        origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: midLocalZ },
        depth: E.railReinforceScrewLen, ...round(E.railReinforceScrewDia), cosmetic: true, through: false,
        label: isEn ? "Ø3.5×30 pilot hole, into leg (middle rail reinforcement)" : "Ø3.5×30 導引孔（中橫檔補強，鎖入腳柱）",
      });
    }

    parts.push({
      id: `leg-${sx === 0 ? "left" : "right"}-${sz === 0 ? "front" : "back"}`,
      nameZh: `腳柱（${sx === 0 ? "左" : "右"}${sz === 0 ? "前" : "後"}）`,
      nameEn: `Leg (${sx === 0 ? "left" : "right"} ${sz === 0 ? "front" : "back"})`,
      material,
      grainDirection: "width",
      visible: { length: E.legW, width: H, thickness: E.legD },
      origin: { x: wx(cx), y: 0, z: wz(cz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: m,
    });
  }

  // ── 補強木釘展示零件 ×2（比照 cert-b5：只挑一處代表性接合點加 3D 展示，
  // 不是每個孔都補展示零件——`visual:"dowel"` 是 derive.ts 判斷「要不要生成鑽木釘孔工序」
  // 的閘門，這裡挑左前腳／左側下橫檔那一組，World 座標直接用跟腳柱榫眼同一套公式算，
  // 不是另外手推，避免跟孔位本身兜不起來）──────────────────────────
  {
    const lowerRailLocalZ = legCenterY - E.lowerRailH / 2;
    const lowerDowelOff = E.lowerRailH / 2 - 10;
    const worldX = wx(legCx0);
    const interfaceZ = wz(legCzFront) + (E.legD - E.legD / 2);   // local-y(=legD，前腳內面)→世界Z 偏移
    // 展示零件的中心不能剛好卡在接合面上——12 入腳／18 入橫檔不對稱，中心要往橫檔那側
    // 偏移 (18−12)/2=3mm，不然整支木釘會跟腳柱重疊太多（findOverlaps 抓到的就是這個）。
    const worldZ = interfaceZ + (E.jointDowelIntoRail - E.jointDowelIntoLeg) / 2;
    for (const dz of [-1, 1] as const) {
      const worldY = E.lowerRailH / 2 - dz * lowerDowelOff;
      parts.push(dowel(
        `dowel-lower-rail-lf-${dz < 0 ? "a" : "b"}`,
        "木釘 Ø8×30（側下橫檔補強，示意）",
        "Dowel Ø8×30 (side lower rail reinforcement, representative)",
        "z",
        { x: worldX, y: worldY, z: worldZ },
      ));
    }
  }

  // ── 上橫檔 ×1（60 高 × 21 厚，貼頂、只在後側）────────────────────
  {
    const railCy = H - E.upperRailH;
    parts.push({
      id: "rail-upper-back",
      nameZh: "上橫檔（後）",
      nameEn: "Upper rail (back)",
      material,
      grainDirection: "length",
      visible: { length: railSpanX, width: E.upperRailH, thickness: E.upperRailT },
      origin: { x: wx(W / 2), y: railCy, z: wz(legCzBack) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: (["start", "end"] as const).map((position): Tenon => ({
        position, type: "through-tenon",
        length: E.legRailTenonLen, width: E.upperRailH, thickness: E.upperRailTenonT,
        shoulderOn: ["top", "bottom"],
      })),
      mortises: (["start", "end"] as const).flatMap((position): Mortise[] => {
        const sx = position === "start" ? -1 : 1;
        const off = E.upperRailH / 2 - 15;
        return [-1, 1].map((dz): Mortise => ({
          origin: { x: sx * (railSpanX / 2), y: E.upperRailT / 2, z: dz * off },
          depth: E.jointDowelIntoRail, ...round(E.dowelDia),
          label: isEn ? "Ø8 dowel, leg (joint reinforcement)" : "Ø8 木釘（腳柱補強）",
        }));
      }),
    });
  }

  // ── 中橫檔 ×1（60 高 × 21 厚，疊在上橫檔正下方、只在後側）────────
  {
    const railCy = H - E.upperRailH - E.midRailH;
    parts.push({
      id: "rail-mid-back",
      nameZh: "中橫檔（後）",
      nameEn: "Middle rail (back)",
      material,
      grainDirection: "length",
      visible: { length: railSpanX, width: E.midRailH, thickness: E.midRailT },
      origin: { x: wx(W / 2), y: railCy, z: wz(legCzBack) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: (["start", "end"] as const).map((position): Tenon => ({
        position, type: "through-tenon",
        length: E.legRailTenonLen, width: E.midRailH, thickness: E.upperRailTenonT,
        shoulderOn: ["top", "bottom"],
      })),
      mortises: (["start", "end"] as const).flatMap((position): Mortise[] => {
        const sx = position === "start" ? -1 : 1;
        const off = E.midRailH / 2 - 15;
        return [-1, 1].map((dz): Mortise => ({
          origin: { x: sx * (railSpanX / 2), y: E.midRailT / 2, z: dz * off },
          depth: E.jointDowelIntoRail, ...round(E.dowelDia),
          label: isEn ? "Ø8 dowel, leg (joint reinforcement)" : "Ø8 木釘（腳柱補強）",
        }));
      }),
    });
  }

  // ── 側下橫檔 ×2（45 高 × 32 厚，左右各一，貼地，沿深度方向）──────
  // 跟 cert-b5「側下橫檔」（沿長度方向、前後各一）不同軸向：這裡沿深度方向，
  // 用 rotation{x:π/2,y:π/2}（比照 cert-b5 抽屜側板／滑條的雙重旋轉做法）。
  for (const sx of [0, 1] as const) {
    const cx = sx === 0 ? legCx0 : legCx1;
    const legInZ = sx === 0 ? 1 : -1;             // 跟腳柱 mortise 的 legInY 相反號規則對齊：這裡是 rail 自己 local-x 的面別
    parts.push({
      id: sx === 0 ? "rail-lower-left" : "rail-lower-right",
      nameZh: sx === 0 ? "側下橫檔（左）" : "側下橫檔（右）",
      nameEn: sx === 0 ? "Lower side rail (left)" : "Lower side rail (right)",
      material,
      grainDirection: "length",
      visible: { length: railSpanZ, width: E.lowerRailH, thickness: E.lowerRailT },
      origin: { x: wx(cx), y: 0, z: wz(D / 2) },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: (["start", "end"] as const).map((position): Tenon => ({
        position, type: "through-tenon",
        length: E.legRailTenonLen, width: E.lowerRailH, thickness: E.legRailTenonT,
        shoulderOn: ["top", "bottom"],
      })),
      mortises: (["start", "end"] as const).flatMap((position): Mortise[] => {
        const sz = position === "start" ? -1 : 1;
        const off = E.lowerRailH / 2 - 10;
        void legInZ;
        return [-1, 1].map((dz): Mortise => ({
          origin: { x: sz * (railSpanZ / 2), y: E.lowerRailT / 2, z: dz * off },
          depth: E.jointDowelIntoRail, ...round(E.dowelDia),
          label: isEn ? "Ø8 dowel, leg (joint reinforcement)" : "Ø8 木釘（腳柱補強）",
        }));
      }),
    });
  }

  // ── 抽屜（外側 384×350，從前面推拉；前角鳩尾、後角木釘，仿 cert-b5 做法）──
  if (withDrawer) {
    const zShift = -pull;
    const drawerCx = W / 2;
    const drawerFrontZ0 = (D - E.drawerD) / 2 + zShift;
    const frontY0 = 80, frontY1 = frontY0 + E.drawerFrontH;   // 80~210，落在側下橫檔頂(45)與中橫檔底(250)之間
    const frontCz = drawerFrontZ0 + E.drawerFrontT / 2;
    const bottomPlateBottomY = frontY0 + 10;
    const bottomGrooveCy = bottomPlateBottomY + E.drawerBottomT / 2;
    const frontCy = frontY0 + E.drawerFrontH / 2;
    const frontGrooveLocalZ = frontCy - bottomGrooveCy;

    parts.push({
      id: "drawer-1-front",
      nameZh: "抽屜前板",
      nameEn: "Drawer front",
      material,
      grainDirection: "length",
      visible: { length: E.drawerW, width: E.drawerFrontH, thickness: E.drawerFrontT },
      origin: { x: wx(drawerCx), y: frontY0, z: wz(frontCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [
        {
          origin: { x: 0, y: E.drawerFrontT, z: frontGrooveLocalZ },
          depth: E.drawerBottomGrooveD, length: E.drawerW - 2 * E.drawerSideT + 2 * E.drawerBottomGrooveD, width: E.drawerBottomT,
          through: false, cosmetic: true, label: isEn ? "bottom groove" : "底板槽",
        },
      ],
    });

    const sideZ0 = drawerFrontZ0 + (E.drawerFrontT - E.dovetailPinDepth);
    const sideZ1 = drawerFrontZ0 + E.drawerD;
    const sideLen = sideZ1 - sideZ0;
    const sideCz = (sideZ0 + sideZ1) / 2;
    for (const sx of [0, 1] as const) {
      const cx = sx === 0 ? drawerCx - E.drawerW / 2 + E.drawerSideT / 2 : drawerCx + E.drawerW / 2 - E.drawerSideT / 2;
      const innerY = sx === 0 ? E.drawerSideT : 0;
      parts.push({
        id: sx === 0 ? "drawer-1-side-left" : "drawer-1-side-right",
        nameZh: sx === 0 ? "抽屜側板（左）" : "抽屜側板（右）",
        nameEn: sx === 0 ? "Drawer side (left)" : "Drawer side (right)",
        material,
        grainDirection: "length",
        visible: { length: sideLen, width: E.drawerFrontH, thickness: E.drawerSideT },
        origin: { x: wx(cx), y: frontY0, z: wz(sideCz) },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        shape: { kind: "dovetail-ends", segmentCount: E.dovetailSegments, phase: 0, angleDeg: E.dovetailAngleDeg, pinDepth: E.dovetailPinDepth, halfPin: true, ends: "plus" },
        tenons: [],
        mortises: [
          { origin: { x: 0, y: innerY, z: frontGrooveLocalZ }, depth: E.drawerBottomGrooveD, length: sideLen, width: E.drawerBottomT,
            through: false, cosmetic: true, label: isEn ? "bottom groove" : "底板槽" },
          { origin: { x: -sideLen / 2, y: innerY, z: 0 },
            depth: E.dowelIntoSideFace, ...round(E.dowelDia),
            label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（後板）" },
        ],
      });
    }

    const backCz = sideZ1 - E.drawerBackT / 2;
    parts.push({
      id: "drawer-1-back",
      nameZh: "抽屜後板",
      nameEn: "Drawer back",
      material,
      grainDirection: "length",
      visible: { length: E.drawerW - 2 * E.drawerSideT, width: E.drawerFrontH, thickness: E.drawerBackT },
      origin: { x: wx(drawerCx), y: frontY0, z: wz(backCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [
        ...[1, -1].map((ex) => ({
          origin: { x: ex * (E.drawerW - 2 * E.drawerSideT) / 2, y: E.drawerBackT / 2, z: 0 },
          depth: E.dowelLen - E.dowelIntoSideFace, ...round(E.dowelDia),
          label: isEn ? "Ø8 dowel, side" : "Ø8 木釘（側板）",
        })),
        ...[-1, 0, 1].map((k): Mortise => ({
          origin: { x: k * (E.drawerW - 2 * E.drawerSideT) / 3, y: E.drawerBackT / 2,
            z: (frontY0 + E.drawerFrontH / 2) - (bottomPlateBottomY + E.drawerBottomT / 2) },
          depth: E.screwLen, ...round(E.screwDia), cosmetic: true, through: false,
          label: isEn ? "Ø2.4×15 pilot hole, bottom panel" : "Ø2.4×15 導引孔（底板）",
        })),
      ],
    });

    parts.push({
      id: "drawer-1-bottom",
      nameZh: "抽屜底板（4mm 合板）",
      nameEn: "Drawer bottom (4mm plywood)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: {
        length: E.drawerW - 2 * E.drawerSideT + 2 * E.drawerBottomGrooveD,
        width: (sideZ1 - E.drawerBackT) - (drawerFrontZ0 + E.drawerFrontT - E.drawerBottomGrooveD),
        thickness: E.drawerBottomT,
      },
      origin: { x: wx(drawerCx), y: bottomPlateBottomY, z: wz(((sideZ1 - E.drawerBackT) + drawerFrontZ0 + E.drawerFrontT - E.drawerBottomGrooveD) / 2) },
      tenons: [],
      mortises: [],
    });

    // 滑條 ×2：側下橫檔（45×32）貼地，跟抽屜高度（frontY0=80）之間還有段距離，
    // 抽屜實際的承重／滑軌另外靠這 2 支滑條（比照 cert-b5 驗證過的做法：一端鎖進
    // 腳柱、另一端托住抽屜側板底邊），不是直接擱在側下橫檔上。
    const runnerZ0 = sideZ0, runnerZ1 = sideZ1, runnerLen = runnerZ1 - runnerZ0;
    const runnerCz = (runnerZ0 + runnerZ1) / 2;
    const runnerT = (drawerCx - E.drawerW / 2 + E.drawerSideT) - E.legW;
    for (const sx of [0, 1] as const) {
      const cx = sx === 0
        ? (E.legW + drawerCx - E.drawerW / 2 + E.drawerSideT) / 2
        : W - (E.legW + drawerCx - E.drawerW / 2 + E.drawerSideT) / 2;
      const screwMortises: Mortise[] = [-1, 1].map((k) => ({
        origin: { x: k * runnerLen / 4, y: 0, z: E.runnerH / 2 },
        depth: E.runnerScrewLen, ...round(E.runnerScrewDia), cosmetic: true, through: false,
        label: isEn ? "Ø3×25 pilot hole, into leg" : "Ø3×25 導引孔（鎖入腳柱）",
      }));
      parts.push({
        id: sx === 0 ? "runner-left" : "runner-right",
        nameZh: sx === 0 ? "抽屜滑條（左）" : "抽屜滑條（右）",
        nameEn: sx === 0 ? "Drawer runner (left)" : "Drawer runner (right)",
        material,
        grainDirection: "length",
        visible: { length: runnerLen, width: E.runnerH, thickness: runnerT },
        origin: { x: wx(cx), y: frontY0 - E.runnerH, z: wz(runnerCz) },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: screwMortises,
      });
    }
  }

  if (H !== input.height || W !== input.length || D !== input.width) {
    warnings.push(isEn
      ? `Not adjustable: this is a fixed trade-test answer, size locked to ${W}×${D}×${H} mm.`
      : `尺寸不可調：這是考題固定答案，鎖定 ${W}×${D}×${H}mm。`);
  }
  if (pull > 0) warnings.push(isEn ? `Drawer shown pulled out ${pull} mm (display only).` : `抽屜拉出 ${pull}mm 只是展示，尺寸不變。`);
  warnings.push(isEn
    ? "⚠️ Draft (pass 1): built from a single independent read of the official drawing, not yet cross-checked by a second review pass the way cert-b1–b5 were. Two structural simplifications are recorded on purpose, not overlooked: (1) the drawing shows splayed/tapered legs (494×380 at the floor narrowing to 472×360 at rail height, confirmed by a 10mm taper in the C-C section) — this pass keeps the legs straight/vertical, since splay isn't one of the evaluation sheet's 8 graded dimensions and adapting the codebase's existing splay machinery (built for round/45°-diagonal legs) to this rectangular, independent-per-axis case carries real risk of a subtle bug; (2) the drawing's \"notch-tenon\" (裂口榫) joint has no dedicated JoineryType in this codebase — modeled here as through-tenon (closest available \"open/visible joint\" semantic) with standard rectangular mortise/tenon geometry, not the drawing's literal open-notch shape. See the file header for the full confidence breakdown."
    : "⚠️ 草稿（第一輪）：依單一次獨立讀圖建置，還沒像 cert-b1～b5 那樣走過第二輪複查。兩個結構簡化是刻意記錄、不是漏掉：(1) 圖面顯示腳柱側腳（樓地板端 494×380 較寬、橫檔端 472×360 較窄，C-C 剖面量到 10mm 斜度可佐證）——這輪先畫直腳，因為側腳角度不是評審表 8 個評分尺寸之一，而套用現有共用側腳工具（是為圓腳/45°對角外斜設計）到這種「矩形、X/Z 軸各自獨立斜率」的腳型有實質風險；(2) 圖面「裂口榫」在型別系統沒有專屬 JoineryType，這輪用 through-tenon（語意上最接近「外露榫頭」）搭配標準矩形榫卯幾何代表，沒有畫出圖面真正的開放缺口造形。完整信心等級分類見檔頭。");

  const design: FurnitureDesign = {
    id: `cert-b6-${W}x${D}x${H}`,
    category: "cert-b6",
    nameZh: "家具木工乙級 第六題（01200-100206）",
    overall: { length: W, width: D, thickness: H },
    parts,
    defaultJoinery: "through-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class B furniture-woodworking trade test, question 01200-100206 (7 hours). 494×380×370: 4 straight legs (45×32) run the full height (no separate top panel this pass); a stacked pair of 60×21 back rails (upper + middle) near the top and two 45×32 side rails (left + right) near the floor join the legs with notch-tenon joints, each pinned with 2 extra Ø8 dowels per the drawing's own note; a front-opening drawer 384×350 with a 130mm-tall front, dovetailed (9 segments/corner) front corners and doweled back corners, riding on two runners screwed into the leg posts. **Draft, pass 1 — see the file header for two deliberate first-pass simplifications (splay not modeled; notch-tenon approximated as through-tenon) and the full evidence/confidence breakdown.** Download the official paper at owinform.wdasec.gov.tw and follow that version on test day.`
      : `依技術士技能檢定家具木工乙級術科試題 01200-100206（7 小時）公開尺寸繪製的練習範本。494×380×370：4 支 45×32 直腳貫穿全高（本輪沒有獨立桌面板）；後側疊放一組 60×21 上／中橫檔、左右各一支 45×32 側下橫檔貼地，跟腳柱走裂口榫接合，圖面明寫每處另外補強 2 支木釘；抽屜 384×350 從前面推拉，前板 130 高，前角鳩尾（9段/角）、後角木釘，滑條鎖進腳柱。**第一輪草稿——兩個刻意的簡化（側腳未建模、裂口榫用 through-tenon 近似）與完整證據等級分類見檔頭。**官方應檢參考資料請至技能檢定中心官網下載，應檢以官方版本為準。`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};

/** 研究頁／測試用：考題預設尺寸的完整設計。 */
export function certB6Assembly(): FurnitureDesign {
  const options: Record<string, string | number | boolean> = {};
  for (const s of certB6Options) options[s.key] = s.defaultValue;
  return certB6({ length: EXAM.W, width: EXAM.D, height: EXAM.H, material: "pine", options });
}
