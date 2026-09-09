import type {
  FurnitureDesign,
  FurnitureTemplate,
  Mortise,
  OptionSpec,
  Part,
  Tenon,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

/**
 * 技術士技能檢定 家具木工 乙級 術科試題 01200-100203（練習範本）
 *
 * ⭐ 照官方試題**公開尺寸**自己畫的練習範本，不是官方圖面的重製；不嵌、不顯示官方圖檔。
 *    官方應檢參考資料（完整題本 012002B15，本題圖框 112/10/27）請至 owinform.wdasec.gov.tw 下載，應檢以官方版本為準。
 *    ✅ 版本已查證：114/06/18 修正對照表只改了應檢人須知／自備工具表／材料表／**第一題**工作圖／時間配當表，
 *       第三題工作圖未修正，112/10/27 就是現行版。
 *
 * ── 這是什麼 ──────────────────────────────────────────────────────────
 * **四支斜腳、單抽屜的方形小邊桌**。上面是木心板盒體、下面是一組斜腳座，兩段用木螺釘鎖起來。
 * 面板 450×360、腳柱跨距 434、總高 450。
 *
 * ⭐ **本題是六題中唯一沒有鳩尾榫的**：評審表把「鳩尾榫頭榫孔」與「鳩尾榫密合」兩列整個拿掉了
 *    （其餘五題都有，而且內部那列一律 30×0.25）。抽屜四角全部用**木釘**（學科 §05-58「抽屜組裝＝面與端」）。
 *
 * ⭐ **腳只在深度方向外撇**：腳頂展開 240、腳底展開 360，腳高 410 → 每邊撇 60，斜度 8.33°。
 *    正視圖看腳是垂直的。因此上橫檔兩端要隨腳斜切（**斜肩榫**），這是本題的招牌難點。
 *
 * ── 座標（本檔內部）─────────────────────────────────────────────────
 * X 0~450 由**面板左緣**起、Y 0~450 由地面起、Z 0~360 由正面起；程式內再平移到世界座標（+Z＝背）。
 * A-A 寬度鏈：8｜32｜18｜5｜**324**｜5｜18｜32｜8 ＝ **450** ✔（腳外到腳外 ＝ 434 ＝ 評審表「總寬度」）
 *
 * ── 官方權威尺寸（評審表 PDF 第 9 頁）───────────────────────────────
 * 總高 450±1｜總寬 **434**±1（量腳柱跨距，面板比它兩側各多懸挑 8 到 450）｜總深 360±1
 * 腳座上端寬度 240±1｜抽屜外側 324×300±1｜腳柱 45×32±0.5｜下橫桿 45×24±0.5｜抽屜前板寬 130±0.5
 *
 * ── 官方部位數 vs 本模型實體數 ──────────────────────────────────
 * | 評審表 | 官方 | 本模型 | 證據力 |
 * | 木釘（內部） | 21 | **21 支** ✔ | ⭐**強**：圖上獨立數得出來 3＋6＋4＋4＋4＝21 |
 * | 抽屜底板槽 | 3 | **3 條** ✔ | 弱：六題全部都是 3，是區塊常數 |
 * | 木釘密合（外部） | 18 | 9 處 × 2 ＝ **18** ✔ | 弱：第一~三題都是 18、第四~六題都是 22，是區塊常數 |
 * | 木螺釘 | 15 | 6＋6＋3 ＝ **15** ✔ | 弱：圖上只標三種規格沒標支數，配置是自訂 |
 *
 * ⭐ **真正最強的獨立驗證是材料表**（評審表與工作圖之外的第三份文件）：
 *    項次 3（抽屜前板）、5（封邊）、6（面板木心板）、7（側板＋背板木心板）、8（底板合板）、10（Ø2.4×15 螺釘）
 *    **六項同時「剛好用完、一片不多一片不少」**。六項一起剛好不可能是巧合。
 *
 * ⚠️ **「榫接密合 60」對不上 —— 以圖面 8 個榫頭為準**。四條互相獨立的依據：
 *    ① **評審表自己就說了只有 8 個榫**：尺寸列「腳柱 8 部位」＝4 腳×2 尺寸、「下橫桿 4 部位」＝**2 支**×2 尺寸、
 *       「腳座上端寬度 2 部位」＝左右 2 組腳座 ⇒ 2 支上橫檔×2 端 ＋ 2 支下橫桿×2 端 ＝ **8**。
 *    ② 60 ÷ 8 ＝ 7.5 非整數，任何「每榫 N 部位」的規則都產不出 60；60 ÷ 4 ＝ 15 是奇數，左右對稱的家具不可能。
 *    ③ **「×4 面肩」本來就不是通則**：六題套一遍，第一題 2 ✔、第二題 8 ✔，但第三題 15、第四題 3、第六題 9 全是奇數。
 *       這條規則只在 n＝2 的樣本上成立過。
 *    ④ **部位數是為了把配分湊成整數挑的**：第四題木螺釘 12×0.3＝3.6 但配分寫 3.5、
 *       第五題 22×0.3＝6.6 寫 6.5、17×0.3＝5.1 寫 5 —— 三處乘不出來，證明「每部位扣分」是配分÷部位數反推的。
 *    ⇒ 依應檢須知第七條「各部尺寸應以圖上所標示數字為準」。
 *
 * ⭐ **規則的正確版本（做第四~六題請用這條）**：
 *    「**尺寸**」區塊的部位數＝實數（件數 × 量測尺寸數），可以反推支數。
 *    「**內部榫接／外部接合**」區塊的部位數 **有時是實數、有時是權重，一律逐題用圖面與材料表驗證，不可反推幾何**。
 *    反例：第一題「木釘 30 部位」> 材料表全六題只發 29 支，物理上不可能；第三題「木釘 21」卻與圖面一字不差。
 *
 * ── 官方未規定、本範本自訂（依新標準逐條列出，不隱藏）──────────────
 * 上橫檔的**榫長**、下橫桿的榫高／榫長。
 *   （⚠️ 榫厚**兩支都有標**：上橫檔 12 出自 A-A 腳斷面鏈 10｜12｜10＝32、下橫桿 10 出自 7｜10｜7＝24。
 *    第一版誤把上橫檔榫厚寫成「官方未標、自訂」，付費範本這樣寫等於告訴考生可以自選，實際不能。）

 * 滑條長度（取 Z 28~295，後端收在關閉時抽屜後板的正面）、
 * 面板封邊四角接法（本範本前後封邊通長、左右封邊夾在中間）。
 *
 * ── 建模時自己解掉的兩個判讀矛盾（都用幾何反推，不是選的）──────────
 * ① **後下橫桿的 Z 位置**：判讀員套了前腳的公式。後腳中心 Z ＝ 337.5 − 60×(Y/410)，
 *    在 Y＝77.5 是 326.2 ⇒ 後下橫桿 Z **314.2~338.2**（不是判讀員寫的 285~309）。
 * ② **抽屜後角木釘的軸向**：判讀員讀成沿 Z，但他自己也把「後板 294 夾在兩側板之間」
 *    列在推論欄，兩者不能同時成立。取幾何：側掛滑條走在抽屜**外側面**的槽裡
 *    （滑條 X 58~69、抽屜側板外面 X 63），後板一做到抽屜外寬 324，端面就落在外側面上，
 *    抽屜拉出來就會撞滑條（實測 drawerPull>0 時 runner ∩ drawer-back）。
 *    ⇒ 後板必須內縮 ⇒ 後角是「側板的**面** ↔ 後板的**端**」，木釘沿 **X**。
 *
 * ⚠️ **抽屜是一次性膠合**：前角木釘沿 z、後角沿 x，兩個軸向同時約束側板，
 *    逐件插入排不出來（`planAssembly` 判成 forced，已在 plan.test.ts 具名豁免並寫明理由）。
 *    木工實務本來就是乾組試裝 → 四角一次上膠夾緊，不是一片一片裝上去。
 *
 * ── 依官方學科參考資料（012002A12.pdf）定的 ──────────────────────
 * §05-30「插榫厚度不小於材厚 1/3」→ 上橫檔 32 厚取榫厚 12（自備工具表只發 ø12／ø6 直刀，12 開得出來）
 * §05-58「抽屜組裝結構，結合方式為面與端」→ 抽屜四角木釘打在側板端面
 *
 * ── 未做成造型（列為已知缺口）──────────────────────────────────
 * ① 腳底 3×45° 倒角（工作圖 A-A 下段明標，評審表「圓弧與倒角」有配分）。
 * ② 木螺釘本體 15 支（評審表「五金裝配」4.5 分；位置與規格已寫進 notes）。
 * ③ **上橫檔兩端的 8.33° 斜肩**：實際頂肩距 150、底肩距 167.6。共用層的 apron-trapezoid
 *    在「長度轉到世界 Z」的旋轉下投影不會收斂（實測逐層 Z 都不變），硬掛上去會讓腳與
 *    橫檔判成穿模；為了不動已上架的 bar-stool／床／長凳，這裡先做成方料取**頂肩距 150**，
 *    兩端再依 8.33° 往下放樣到 167.6。兩個數字都寫在 notes 裡給木匠。
 */

/** 官方試題尺寸（mm）。座標：X 0~450 由面板左緣、Y 0~450 由地面、Z 0~360 由正面 */
const EXAM = {
  panelW: 450, D: 360, H: 450,
  legSpanW: 434,                              // 評審表「總寬度」量的是腳外到腳外
  panelT: 18, panelEdge: 8,                   // 面板木心板 18 厚，四周 8 實木封邊
  legW: 32, legD: 45, legH: 410, legChamfer: 3,
  legTopSpread: 240, legBottomSpread: 360,    // 腳頂 240 → 腳底 360（每邊撇 60）
  topRailH: 60, topRailTopY: 410,             // 上橫檔 60 高，頂面與腳頂齊
  topRailTenonT: 12, topRailTenonLen: 20,     // 榫厚 12 **圖上有標**（A-A 腳斷面鏈 10｜12｜10＝32）；榫長 20 官方未標
  botRailH: 45, botRailT: 24,                 // 下橫桿 45×24（評審表）
  botRailTenonT: 10, botRailTenonH: 35, botRailTenonLen: 20,  // 榫厚 10 出自圖上 7｜10｜7＝24；高與長官方未標
  botRailFrontTopY: 300, botRailBackTopY: 100,   // 前檔頂＝盒底 300；後檔頂離地 100（圖上「100」）
  legInsetInRail: 10.5,                       // 下橫桿在腳 45 深裡置中：圖上鏈 10.5｜24｜10.5＝45
  carcaseBottomY: 300, carcaseTopY: 432,      // 盒體 Y 300~432（132 高）
  sidePanelT: 18, sidePanelEdge: 8,           // 側板木心板 18，前後端各 8 實木封邊
  sidePanelZ0: 28, sidePanelZ1: 340,          // 側板全長 312（含兩端封邊）
  backPanelT: 18, backPanelZ1: 340,           // 背板後面與側板後端齊
  drawerGap: 5,                               // 側板內面↔抽屜側板外面
  drawerW: 324, drawerD: 300,                 // 評審表「抽屜外側寬、深度 324×300」——量的是**箱體**（兩側板外面）
  /**
   * 抽屜前板是**面付式 370 寬**（兩端與腳內面齊），不是跟箱體同寬的 324。
   * 🩸 第一版做成 324 ⇒ 前板（X 63~387）與側板前封邊（X 40~58／392~410）在 X 上零重疊，
   *    **關到底沒有任何擋塊**，抽屜會多推 12mm 直到後板撞背板；而評審表「抽屜前板之密合」有 5 分。
   * 判讀證據（對照員 A 回頭專判）：
   *   ① `370` 這條標註屬於 **B-B（俯視）**，左端刻線 x=570.5 ⇒ 離中心 185.2；
   *   ② B-B 前半段前板那條帶**從 ±185 一路畫到中心線不斷**——後板那條帶在 ±167／±162／±147 都有斷點（294 夾在兩側板之間）；
   *   ③ 1:10 正視圖抽屜高度帶內**只有 3 條垂直線**（左腳內面 X40、中心線、右腳內面 X410），
   *      X 58／63／387／392 一個像素都沒有（32mm 的腳在這張圖都解析成兩條線了，18mm 側板不可能看不到）；
   *   ④ 側視圖前板整片凸在腳前面 32mm。材料表項次 3（440×132×18.5）給 370 剛好、給 324 要丟 116。
   * ⇒ 前板背面 Z=28 貼上側板前封邊的正面 Z=28，關到底剛好貼平＝擋塊。
   */
  drawerFrontW: 370,
  drawerFrontH: 130, drawerFrontT: 18, drawerFrontZ0: 10, drawerTopGap: 2,
  drawerSideH: 127, drawerSideT: 15, drawerSideBelowTop: 5,
  /**
   * 抽屜後板 **107 高**（Y 315~422），**坐在 4mm 合板底板上面**。
   * 🩸 第一版讀成 122（把「107｜15」當成「後板頂→底板頂 107、再往下 15 才是後板底」），
   *    結果後板底緣比底板還低 11mm ⇒ 合板裝不進去、3 支 ø2.4×15 也鎖不到後板，
   *    跟本檔自己 notes 寫的「底板→抽屜後板 3 支」自相矛盾。
   * 三條證據：① C-C 的實木斜線剖面**在合板那條帶就停住**，底下是空的；
   *   ② `ø2.4*15` 的引線正好指在後板與合板的交會處（由下往上鎖進後板底緣）；
   *   ③ 後板的木釘鏈 **30｜47｜30 ＝ 107** 剛好等於板高——若是 122 這條鏈封不起來。
   * 正確的鏈是 **5｜107｜15 ＝ 127**（＝抽屜側板高）：側板頂→後板頂 5、後板 107、底板頂→側板底 15。
   * 對照組：cert-b1 本來就是這樣做的（後板底緣＝底板頂、底板延到後板後面）。
   */
  drawerBackH: 107, drawerBackT: 15, drawerBackBelowTop: 10,
  runnerW: 11, runnerH: 14, slotD: 7, slotH: 15,
  slotTopBelowSideTop: 40,                    // 槽頂 387 ＝ 抽屜側板頂 427 − 40（圖上 35 是由後板頂 422 起算）
  grooveD: 7, bottomT: 4,                     // 底板槽深 **圖上有標 7**（A-A 下方那個 7，自抽屜側板內面往內量）
  dowelDia: 8, dowelLen: 30,
  dowelIntoPanel: 12, dowelIntoBoard: 18,     // 木釘一律「入被接的面板／前後板 12、入板端 18」（圖上 12｜18）
  backDowelX: [25, 142, 142],                 // 背板↔面板 3 支：由背板左端 25｜142｜142｜25 ＝ 334
  sideDowelZ: [52, 180, 308],                 // 側板↔面板 3 支：C-C「52｜128｜128｜52」＝360
  backSideDowelFromTop: [28, 104],            // 背板↔側板 2 支：由盒頂 432 起 28｜76｜28 ＝ 132
  backSideDowelZ: 327,                        // 官方未標精確 Z；取 327 讓 Ø8 孔完全落在側板木心板內（核心後端 332）
  drawerFrontDowelFromTop: [27, 103],         // 抽屜前板↔側板 2 支：由前板頂 430 起 27｜76｜27 ＝ 130
  drawerBackDowelFromTop: [30, 77],           // 抽屜後板↔側板 2 支：由後板頂 422 起 30｜47｜30 ＝ 107
  screwSide: "Ø3.5×30 木螺釘（CNS1051）",       // 側板→腳柱／上橫檔，每側 3 支
  screwRunner: "Ø3×25 木螺釘（CNS1051）",       // 側板→滑條，每側 3 支
  screwBottom: "Ø2.4×15 木螺釘（CNS1051）",     // 抽屜底板→抽屜後板，3 支
} as const;

export const certB3Options: OptionSpec[] = [
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
    help: "試題一定要做抽屜。取消只是為了看清楚盒體與滑條，應檢一定要裝",
  },
];

export const certB3: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certB3Options;
  const pullRaw = getOption<number>(input, opt(o, "drawerPull"));
  // 夾在讀選項那一行（§A10.11）。網址帶負值會讓抽屜往櫃體裡面倒退 → 撞滑條／背板。
  const pull = Math.min(250, Math.max(0, Number.isFinite(pullRaw) ? pullRaw : 0));
  const withDrawer = getOption<boolean>(input, opt(o, "withDrawer"));

  const E = EXAM;
  const warnings: string[] = [];

  // 長寬深全部夾在考題尺寸：斜腳的展開、木釘列、抽屜都是考題常數，跟著跨距縮放必穿模（第一、二題的教訓）。
  // 高度也不開放：面板／盒體／抽屜整組吊在「腳頂 410」上，腳一變長斜度就跟著變，
  // 而斜度 8.33° 是由「腳頂 240、腳底 360、腳高 410」三個官方數字同時決定的，動一個就三個都不對。
  const W = E.panelW;
  const D = E.D;
  const H = E.H;

  /** 圖面座標 → 世界座標：X 置中於面板、Y 不變（origin.y＝底）、+Z＝背 */
  const wx = (x: number) => x - W / 2;
  const wz = (z: number) => z - D / 2;
  const parts: Part[] = [];

  // ── 版面關鍵 X（A-A 鏈 8｜32｜18｜5｜324｜5｜18｜32｜8 ＝ 450）──────────
  const legL0 = E.panelEdge;                                   // 8   左腳外面
  const legL1 = legL0 + E.legW;                                // 40  左腳內面
  const sideL1 = legL1 + E.sidePanelT;                         // 58  左側板內面
  const drawerX0 = sideL1 + E.drawerGap;                       // 63  抽屜左外面
  const drawerX1 = drawerX0 + E.drawerW;                       // 387 抽屜右外面
  const sideR0 = drawerX1 + E.drawerGap;                       // 392 右側板內面
  const legR0 = sideR0 + E.sidePanelT;                         // 410 右腳內面
  const legR1 = legR0 + E.legW;                                // 442 右腳外面

  // ── 斜腳幾何：頂端展開 240、底端展開 360，每邊撇 60 ────────────────
  const splay = (E.legBottomSpread - E.legTopSpread) / 2;      // 60
  const legTopFrontCz = (E.D - E.legTopSpread) / 2 + E.legD / 2;   // 82.5
  const legTopBackCz = E.D - legTopFrontCz;                        // 277.5
  /** 某高度 y 處，前／後腳的中心 Z（腳底外撇，往上收） */
  const legCzAt = (y: number, back: boolean) =>
    back ? legTopBackCz + splay * (1 - y / E.legH) : legTopFrontCz - splay * (1 - y / E.legH);

  // ── 面板（木心板心材 434×344×18 ＋ 四周 8 實木封邊 → 450×360）────────
  const panelBottomY = E.H - E.panelT;                          // 432
  const topCoreHoles: Mortise[] = [];
  {
    let x = legL1 + E.sidePanelT;                       // 58 背板左端
    for (const step of E.backDowelX) { x += step; topCoreHoles.push({
      origin: { x: wx(x), y: 0, z: wz(E.backPanelZ1 - E.backPanelT / 2) },
      depth: E.dowelIntoPanel, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（背板）",
    }); }
    for (const sx of [0, 1] as const) for (const z of E.sideDowelZ) topCoreHoles.push({
      origin: { x: wx(sx === 0 ? legL0 + E.legW + E.sidePanelT / 2 : E.panelW - E.panelEdge - E.legW - E.sidePanelT / 2), y: 0, z: wz(z) },
      depth: E.dowelIntoPanel, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, side panel" : "Ø8 木釘（側板）",
    });
  }
  parts.push({
    id: "top-core",
    nameZh: "面板（木心板）",
    nameEn: "Top core (blockboard)",
    material: "blockboard-primary",
    grainDirection: "length",
    visible: { length: E.legSpanW, width: E.D - 2 * E.panelEdge, thickness: E.panelT },
    origin: { x: 0, y: panelBottomY, z: 0 },
    tenons: [],
    mortises: topCoreHoles,
  });
  // 前後封邊通長 450；左右封邊夾在中間（長 344），四角對接不重疊
  for (const [id, zc] of [["top-edge-front", E.panelEdge / 2], ["top-edge-back", E.D - E.panelEdge / 2]] as const) {
    parts.push({
      id, nameZh: id.endsWith("front") ? "面板封邊（前）" : "面板封邊（後）",
      nameEn: id.endsWith("front") ? "Top edging (front)" : "Top edging (back)",
      material, grainDirection: "length",
      visible: { length: E.panelW, width: E.panelEdge, thickness: E.panelT },
      origin: { x: 0, y: panelBottomY, z: wz(zc) },
      tenons: [], mortises: [],
    });
  }
  for (const [id, xc] of [["top-edge-left", E.panelEdge / 2], ["top-edge-right", E.panelW - E.panelEdge / 2]] as const) {
    parts.push({
      id, nameZh: id.endsWith("left") ? "面板封邊（左）" : "面板封邊（右）",
      nameEn: id.endsWith("left") ? "Top edging (left)" : "Top edging (right)",
      material, grainDirection: "length",
      visible: { length: E.D - 2 * E.panelEdge, width: E.panelEdge, thickness: E.panelT },
      origin: { x: wx(xc), y: panelBottomY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      tenons: [], mortises: [],
    });
  }

  // ── 腳柱 ×4（32 寬 × 45 深 × 410 高，只在深度方向外撇）────────────────
  const topRailCy = E.topRailTopY - E.topRailH / 2;              // 380
  const botRailCy = (topY: number) => topY - E.botRailH / 2;
  for (const sx of [0, 1] as const) for (const sz of [0, 1] as const) {
    const cx = sx === 0 ? legL0 + E.legW / 2 : legR0 + E.legW / 2;
    const topCz = sz === 0 ? legTopFrontCz : legTopBackCz;
    const dz = (sz === 0 ? -1 : 1) * splay;                    // buildSplayedGeometry：頂端不動、底端位移
    /**
     * 腳的榫眼。
     * ⭐ `origin.y` 是 **from-bottom**（共用層 `mortiseLocalBox` 的慣例：
     *    `lib/render/svg-views.tsx` 的 `oyC = m.origin.y - ly/2`，註解寫明「Y 是 from-bottom」），
     *    這支腳沒有 rotation、`visible.thickness` 就是 410 的垂直高，所以 origin.y ＝ 離地高度。
     * 🩸 2026-09-09 第一版寫成 `E.legH - 高度`（誤以為由頂往下量）→ 四支腳的榫眼全部畫在錯的高度
     *    （差 145~350mm），8 支榫頭 100% 配不到榫眼，而 `auditJoints`（只比尺寸不比位置）、
     *    `findOverlaps`（非 cosmetic 榫眼不參與）、`warnInvalidMortiseSpec`（只檢查有沒有超出料件）
     *    三道閘全部沒攔下來。零件卡上的 1:1 樣板會把孔標在腳的另一端。
     * `origin.x` ±16（32 寬）、`origin.z` ±22.5（45 深）都是 ±half。
     */
    const legM: Mortise[] = [
      {   // 上橫檔的榫（開在朝另一支腳的 Z 面）
        origin: { x: 0, y: topRailCy, z: (sz === 0 ? 1 : -1) * E.legD / 2 },
        // mortise.length ↔ tenon.width（沿橫檔 visible.width＝32 的那軸）、mortise.width ↔ tenon.thickness
        depth: E.topRailTenonLen, length: E.topRailTenonT, width: E.topRailH - 16, through: false,
        label: isEn ? "mortise, trestle top rail" : "上橫檔榫眼（12 厚 × 44 高）",
      },
      {   // 下橫桿的榫（開在朝櫃內的 X 面）
        origin: { x: (sx === 0 ? 1 : -1) * E.legW / 2, y: botRailCy(sz === 0 ? E.botRailFrontTopY : E.botRailBackTopY), z: 0 },
        depth: E.botRailTenonLen, length: E.botRailTenonH, width: E.botRailTenonT, through: false,
        label: isEn ? "mortise, bottom rail" : "下橫桿榫眼（10 厚 × 35 高）",
      },
    ];
    parts.push({
      id: `leg-${sx === 0 ? "left" : "right"}-${sz === 0 ? "front" : "back"}`,
      nameZh: `腳柱（${sx === 0 ? "左" : "右"}${sz === 0 ? "前" : "後"}）`,
      nameEn: `Leg (${sx === 0 ? "left" : "right"} ${sz === 0 ? "front" : "back"})`,
      material,
      grainDirection: "length",
      visible: { length: E.legW, width: E.legD, thickness: E.legH },
      origin: { x: wx(cx), y: 0, z: wz(topCz) },
      shape: { kind: "splayed", dxMm: 0, dzMm: dz },
      tenons: [],
      mortises: legM,
    });
  }

  // ── 上橫檔 ×2（腳座上橫檔，60 高 × 32 厚，兩端隨腳 8.33° 斜切）────────
  const topRailBotY = E.topRailTopY - E.topRailH;               // 350
  const shoulderAt = (y: number) => legCzAt(y, true) - E.legD / 2 - (legCzAt(y, false) + E.legD / 2);
  const shoulderTop = shoulderAt(E.topRailTopY);                // 150
  const shoulderBot = shoulderAt(topRailBotY);                  // 167.6
  /**
   * 上橫檔的榫。⚠️ `tenonWorld()` 的定義：`width` 沿零件的 `visible.width`、`thickness` 沿 `visible.thickness`。
   * 這支橫檔 `visible = { length: 肩距, width: 32(厚), thickness: 60(高) }`
   * ⇒ 榫厚 12 要放 **width**、榫高 44 要放 **thickness**。
   * 🩸 第一版寫反了 → 44 被放到 32 寬那軸，榫頭每邊比料本身多凸 6mm，切不出來。
   */
  const topRailTenon = (position: "start" | "end"): Tenon => ({
    position, type: "blind-tenon",
    length: E.topRailTenonLen, width: E.topRailTenonT, thickness: E.topRailH - 2 * 8,
    shoulderOn: ["top", "bottom", "left", "right"],
  });
  for (const sx of [0, 1] as const) {
    const cx = sx === 0 ? legL0 + E.legW / 2 : legR0 + E.legW / 2;
    parts.push({
      id: sx === 0 ? "top-rail-left" : "top-rail-right",
      nameZh: `腳座上橫檔（${sx === 0 ? "左" : "右"}）`,
      nameEn: `Trestle top rail (${sx === 0 ? "left" : "right"})`,
      material,
      grainDirection: "length",
      // ⚠️ 實際兩端隨腳 8.33° 斜切：頂肩距 150、底肩距 167.6。共用層的 apron-trapezoid
      //    在「長度轉到世界 Z」的旋轉下投影不會收斂（實測逐層 Z 都不變），硬掛上去會讓
      //    腳與橫檔判成穿模。這裡先做成方料取**頂肩距 150**（照這個長度切、兩端再依 8.33°
      //    往下放樣到 167.6），斜肩列為已知未做成造型，數字寫在 notes 裡給木匠。
      visible: { length: shoulderTop, width: E.legW, thickness: E.topRailH },
      origin: { x: wx(cx), y: topRailBotY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      // 兩端隨腳斜切：底邊長（貼腳的下方，腳已外撇）比頂邊長
      tenons: [topRailTenon("start"), topRailTenon("end")],
      mortises: [],
    });
  }

  // ── 下橫桿 ×2（45×24；前檔頂＝盒底 300、後檔頂離地 100）──────────────
  const botRailTenon = (position: "start" | "end"): Tenon => ({
    position, type: "blind-tenon",
    length: E.botRailTenonLen, width: E.botRailTenonH, thickness: E.botRailTenonT,
    shoulderOn: ["top", "bottom", "left", "right"],
  });
  const botRails: Array<{ id: string; topY: number; back: boolean }> = [
    { id: "rail-front", topY: E.botRailFrontTopY, back: false },
    { id: "rail-back", topY: E.botRailBackTopY, back: true },
  ];
  for (const r of botRails) {
    const cy = r.topY - E.botRailH / 2;
    // 由腳的前面往內 10.5（圖上鏈 10.5｜24｜10.5＝45），而不是「置中」——同值但吃得到官方數字
    const cz = legCzAt(cy, r.back) - E.legD / 2 + E.legInsetInRail + E.botRailT / 2;
    parts.push({
      id: r.id,
      nameZh: r.back ? "後下橫桿" : "前下橫桿",
      nameEn: r.back ? "Back bottom rail" : "Front bottom rail",
      material,
      grainDirection: "length",
      visible: { length: legR0 - legL1, width: E.botRailH, thickness: E.botRailT },
      origin: { x: 0, y: r.topY - E.botRailH, z: wz(cz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [botRailTenon("start"), botRailTenon("end")],
      mortises: [],
    });
  }

  // ── 盒體：左右側板（木心板 ＋ 前後端 8 實木封邊）────────────────────
  const carcaseH = E.carcaseTopY - E.carcaseBottomY;             // 132
  const backPanelZ0Early = E.backPanelZ1 - E.backPanelT;         // 322（滑條長度要用）
  const sideCoreZ0 = E.sidePanelZ0 + E.sidePanelEdge;            // 36
  const sideCoreZ1 = E.sidePanelZ1 - E.sidePanelEdge;            // 332
  const backPanelZ0 = E.backPanelZ1 - E.backPanelT;              // 322
  const runnerTopY = E.carcaseTopY - E.drawerSideBelowTop - E.slotTopBelowSideTop;   // 427 − 40 ＝ 387
  for (const sx of [0, 1] as const) {
    const coreCx = sx === 0 ? legL1 + E.sidePanelT / 2 : sideR0 + E.sidePanelT / 2;
    const m: Mortise[] = [];
    // rotation {x:π/2, y:π/2}：local x→世界 −z、local y(厚)→世界 x、local z(寬)→世界 −y
    const sideCz = (sideCoreZ0 + sideCoreZ1) / 2;                 // 184
    const sideCy = E.carcaseBottomY + carcaseH / 2;               // 366
    // 面板木釘孔 ×3（沿 y，開在側板**頂緣**＝local −z 端；入板 18）
    for (const z of E.sideDowelZ) m.push({
      origin: { x: -(z - sideCz), y: E.sidePanelT / 2, z: -(carcaseH / 2) },
      depth: E.dowelIntoBoard, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, top" : "Ø8 木釘（面板）",
    });
    // 背板木釘孔 ×2（沿 x，開在**內面**；入側板 12）
    for (const dTop of E.backSideDowelFromTop) m.push({
      origin: { x: -(E.backSideDowelZ - sideCz), y: sx === 0 ? E.sidePanelT : 0, z: -((E.carcaseTopY - dTop) - sideCy) },
      depth: E.dowelIntoPanel, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（背板）",
    });
    parts.push({
      id: sx === 0 ? "side-panel-left" : "side-panel-right",
      nameZh: `側板（${sx === 0 ? "左" : "右"}）`,
      nameEn: `Side panel (${sx === 0 ? "left" : "right"})`,
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: sideCoreZ1 - sideCoreZ0, width: carcaseH, thickness: E.sidePanelT },
      origin: { x: wx(coreCx), y: E.carcaseBottomY, z: wz((sideCoreZ0 + sideCoreZ1) / 2) },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: m,
    });
    for (const [suffix, zc] of [["front", E.sidePanelZ0 + E.sidePanelEdge / 2], ["back", E.sidePanelZ1 - E.sidePanelEdge / 2]] as const) {
      parts.push({
        id: `side-edge-${sx === 0 ? "left" : "right"}-${suffix}`,
        nameZh: `側板封邊（${sx === 0 ? "左" : "右"}${suffix === "front" ? "前" : "後"}）`,
        nameEn: `Side edging (${sx === 0 ? "left" : "right"} ${suffix})`,
        material, grainDirection: "length",
        visible: { length: E.sidePanelT, width: E.sidePanelEdge, thickness: carcaseH },
        origin: { x: wx(coreCx), y: E.carcaseBottomY, z: wz(zc) },
        tenons: [], mortises: [],
      });
    }
    // 滑條（實木 11×14，鎖在側板內面）
    const runnerCx = sx === 0 ? sideL1 + E.runnerW / 2 : sideR0 - E.runnerW / 2;
    parts.push({
      id: sx === 0 ? "runner-left" : "runner-right",
      nameZh: `抽屜滑條（${sx === 0 ? "左" : "右"}）`,
      nameEn: `Drawer runner (${sx === 0 ? "left" : "right"})`,
      material, grainDirection: "length",
      // 後端收在**抽屜後板正面**（Z 295）：抽屜後板通長 324、兩端與側板外面齊，
      // 滑條再往後就會被關上的抽屜撞到。滑條長度官方未標，這是本範本自訂。
      visible: { length: E.drawerFrontZ0 + E.drawerD - E.drawerBackT - E.sidePanelZ0, width: E.runnerH, thickness: E.runnerW },
      origin: { x: wx(runnerCx), y: runnerTopY - E.runnerH, z: wz((E.sidePanelZ0 + E.drawerFrontZ0 + E.drawerD - E.drawerBackT) / 2) },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [], mortises: [],
    });
  }

  // ── 盒體：背板（木心板 334×132×18）──────────────────────────────────
  const backHoles: Mortise[] = [];
  {
    const backCy = E.carcaseBottomY + carcaseH / 2;                  // 366
    let x = sideL1;
    for (const step of E.backDowelX) { x += step; backHoles.push({
      origin: { x: wx(x), y: E.backPanelT / 2, z: -(carcaseH / 2) },
      depth: E.dowelIntoBoard, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, top" : "Ø8 木釘（面板）",
    }); }
    for (const ex of [-1, 1] as const) for (const dTop of E.backSideDowelFromTop) backHoles.push({
      origin: { x: ex * (sideR0 - sideL1) / 2, y: E.backSideDowelZ - backPanelZ0, z: -((E.carcaseTopY - dTop) - backCy) },
      depth: E.dowelIntoBoard, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, side panel" : "Ø8 木釘（側板）",
    });
  }
  parts.push({
    id: "back-panel",
    nameZh: "背板",
    nameEn: "Back panel",
    material: "blockboard-primary",
    grainDirection: "length",
    visible: { length: sideR0 - sideL1, width: carcaseH, thickness: E.backPanelT },
    origin: { x: 0, y: E.carcaseBottomY, z: wz(backPanelZ0 + E.backPanelT / 2) },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [],
    mortises: backHoles,
  });

  // ── 木釘 ×21（Ø8×30 現成品；不入裁切／零件圖，只進 BOM）────────────────
  const dowel = (
    id: string, nameZh: string, nameEn: string, axis: "x" | "y" | "z",
    c: { x: number; y: number; z: number }, intoFar: number, farDir: 1 | -1,
  ): Part => {
    const shift = (intoFar - E.dowelLen / 2) * farDir;
    const cc = {
      x: axis === "x" ? c.x + shift : c.x,
      y: axis === "y" ? c.y + shift : c.y,
      z: axis === "z" ? c.z + shift : c.z,
    };
    return {
      id, nameZh, nameEn, material,
      grainDirection: axis === "z" ? "width" : "length",
      visible: axis === "x"
        ? { length: E.dowelLen, width: E.dowelDia, thickness: E.dowelDia }
        : axis === "z"
          ? { length: E.dowelDia, width: E.dowelLen, thickness: E.dowelDia }
          : { length: E.dowelDia, width: E.dowelDia, thickness: E.dowelLen },
      origin: { x: cc.x, y: cc.y - (axis === "y" ? E.dowelLen / 2 : E.dowelDia / 2), z: cc.z },
      shape: { kind: "round", axis },
      visual: "dowel",
      tenons: [],
      mortises: [],
    };
  };
  // A 背板→面板 ×3（垂直；入面板 12／入背板 18）
  {
    let x = sideL1;
    for (const step of E.backDowelX) {
      x += step;
      parts.push(dowel(`dowel-top-back-${Math.round(x)}`, "木釘 Ø8×30（背板→面板）", "Dowel Ø8×30 (back to top)", "y",
        { x: wx(x), y: E.carcaseTopY, z: wz(backPanelZ0 + E.backPanelT / 2) }, E.dowelIntoPanel, 1));
    }
  }
  // B 側板→面板 ×6（垂直；入面板 12／入側板 18）
  for (const sx of [0, 1] as const) for (const z of E.sideDowelZ) {
    const cx = sx === 0 ? legL1 + E.sidePanelT / 2 : sideR0 + E.sidePanelT / 2;
    parts.push(dowel(`dowel-top-side-${sx}-${z}`, "木釘 Ø8×30（側板→面板）", "Dowel Ø8×30 (side to top)", "y",
      { x: wx(cx), y: E.carcaseTopY, z: wz(z) }, E.dowelIntoPanel, 1));
  }
  // C 背板↔側板 ×4（沿 x；入側板 12／入背板 18）
  for (const sx of [0, 1] as const) for (const d of E.backSideDowelFromTop) {
    const face = sx === 0 ? sideL1 : sideR0;
    parts.push(dowel(`dowel-back-side-${sx}-${d}`, "木釘 Ø8×30（背板↔側板）", "Dowel Ø8×30 (back to side)", "x",
      { x: wx(face), y: E.carcaseTopY - d, z: wz(E.backSideDowelZ) },
      E.dowelIntoBoard, sx === 0 ? 1 : -1));
  }

  // ── 抽屜（全木釘接合，本題沒有鳩尾）──────────────────────────────
  const drawerFrontTopY = E.carcaseTopY - E.drawerTopGap;        // 430
  const drawerFrontBottomY = drawerFrontTopY - E.drawerFrontH;   // 300
  const drawerSideTopY = E.carcaseTopY - E.drawerSideBelowTop;   // 427
  const drawerBackTopY = E.carcaseTopY - E.drawerBackBelowTop;   // 422
  const drawerFrontZ1 = E.drawerFrontZ0 + E.drawerFrontT;        // 28
  const drawerBackZ1 = E.drawerFrontZ0 + E.drawerD;              // 310（評審表抽屜外深 300）
  const drawerBackZ0 = drawerBackZ1 - E.drawerBackT;             // 295
  /**
   * ⭐ 後板 **294 夾在兩片側板之間**（不是通長 324）。這一點是幾何逼出來的，不是選的：
   * 側掛滑條走在抽屜**外側面**的槽裡（滑條 X 58~69、抽屜側板外面 X 63），
   * 後板只要做到抽屜外寬 324、端面就在外側面上，抽屜一拉出來就會撞到滑條
   * （實測 drawerPull>0 時 runner ∩ drawer-back）。所以後板必須內縮到兩側板之間。
   * ⇒ 後角是「側板的**面** ↔ 後板的**端**」，木釘沿 **X**（學科 §05-58 面與端）。
   * ⚠️ 判讀員把這 4 支讀成沿 Z，但他自己也把「後板 294」列在推論欄——兩者矛盾時取幾何。
   */
  const drawerSideZ1 = drawerBackZ1;                             // 側板與後板後面齊
  const drawerSideX = [drawerX0 + E.drawerSideT / 2, drawerX1 - E.drawerSideT / 2];
  // 底板頂 315：C-C 抽屜後板內部鏈「107｜15」＝122，由後板頂 422 往下 107
  const grooveTopY = drawerBackTopY - E.drawerBackH;              // 315＝後板底＝底板頂
  if (withDrawer) {
    const dz = -pull;
    parts.push({
      id: "drawer-1-front",
      nameZh: "抽屜前板", nameEn: "Drawer front",
      material, grainDirection: "length",
      visible: { length: E.drawerFrontW, width: E.drawerFrontH, thickness: E.drawerFrontT },
      origin: { x: 0, y: drawerFrontBottomY, z: wz(E.drawerFrontZ0 + E.drawerFrontT / 2 + dz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [
        {
          origin: { x: 0, y: E.drawerFrontT, z: -((grooveTopY - E.bottomT / 2) - (drawerFrontBottomY + E.drawerFrontH / 2)) },
          // 槽長 304 ＝ 底板寬（底板兩側各再進側板的槽 5），不是側板內距 294
          depth: E.grooveD, length: E.drawerW - 2 * (E.drawerSideT - E.grooveD), width: E.bottomT, through: false,
          label: isEn ? "drawer bottom groove" : "抽屜底板槽（4 寬 × 7 深）", cosmetic: true,
        },
        // 側板木釘孔 ×4（沿 z，開在背面；入前板 12）— rotation {x:π/2}：local y(厚)→世界 z、local z(寬)→世界 −y
        ...drawerSideX.flatMap((cx) => E.drawerFrontDowelFromTop.map((dTop): Mortise => ({
          origin: { x: wx(cx), y: E.drawerFrontT, z: -((drawerFrontTopY - dTop) - (drawerFrontBottomY + E.drawerFrontH / 2)) },
          depth: E.dowelIntoPanel, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
          label: isEn ? "Ø8 dowel, drawer side" : "Ø8 木釘（抽屜側板）",
        }))),
      ],
    });
    for (const [i, cx] of drawerSideX.entries()) {
      parts.push({
        id: i === 0 ? "drawer-1-side-left" : "drawer-1-side-right",
        nameZh: `抽屜側板（${i === 0 ? "左" : "右"}）`,
        nameEn: `Drawer side (${i === 0 ? "left" : "right"})`,
        material, grainDirection: "length",
        visible: { length: drawerSideZ1 - drawerFrontZ1, width: E.drawerSideH, thickness: E.drawerSideT },
        origin: { x: wx(cx), y: drawerSideTopY - E.drawerSideH, z: wz((drawerFrontZ1 + drawerSideZ1) / 2 + dz) },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [
          // 前端／後端木釘孔（沿 z，開在端面；入側板 18）— local x→世界 −z，前端＝local +x
          ...E.drawerFrontDowelFromTop.map((dTop): Mortise => ({
            origin: { x: (drawerSideZ1 - drawerFrontZ1) / 2, y: E.drawerSideT / 2, z: -((drawerFrontTopY - dTop) - (drawerSideTopY - E.drawerSideH / 2)) },
            depth: E.dowelIntoBoard, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
            label: isEn ? "Ø8 dowel, drawer front" : "Ø8 木釘（抽屜前板）",
          })),
          // 後板木釘孔 ×2（沿 x，開在**內面**；入側板 12）
          ...E.drawerBackDowelFromTop.map((dTop): Mortise => ({
            origin: { x: -((drawerBackZ0 + drawerBackZ1) / 2 - (drawerFrontZ1 + drawerSideZ1) / 2), y: i === 0 ? E.drawerSideT : 0, z: -((drawerBackTopY - dTop) - (drawerSideTopY - E.drawerSideH / 2)) },
            depth: E.dowelIntoPanel, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
            label: isEn ? "Ø8 dowel, drawer back" : "Ø8 木釘（抽屜後板）",
          })),
          {   // 外面的滑條槽（15 高 × 7 深）
            origin: { x: 0, y: i === 0 ? 0 : E.drawerSideT, z: -((runnerTopY - E.slotH / 2) - (drawerSideTopY - E.drawerSideH / 2)) },
            depth: E.slotD, length: drawerSideZ1 - drawerFrontZ1, width: E.slotH, through: false,
            label: isEn ? "runner slot 15×7" : "滑條槽（15 高 × 7 深）", cosmetic: true,
          },
          {   // 內面的底板槽
            origin: { x: 0, y: i === 0 ? E.drawerSideT : 0, z: -((grooveTopY - E.bottomT / 2) - (drawerSideTopY - E.drawerSideH / 2)) },
            depth: E.grooveD, length: drawerSideZ1 - drawerFrontZ1, width: E.bottomT, through: false,
            label: isEn ? "drawer bottom groove" : "抽屜底板槽（4 寬 × 7 深）", cosmetic: true,
          },
        ],
      });
    }
    parts.push({
      id: "drawer-1-back",
      nameZh: "抽屜後板", nameEn: "Drawer back",
      material, grainDirection: "length",
      visible: { length: E.drawerW - 2 * E.drawerSideT, width: E.drawerBackH, thickness: E.drawerBackT },
      origin: { x: 0, y: drawerBackTopY - E.drawerBackH, z: wz(drawerBackZ0 + E.drawerBackT / 2 + dz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [-1, 1].flatMap((ex) => E.drawerBackDowelFromTop.map((dTop): Mortise => ({
        origin: { x: ex * (E.drawerW - 2 * E.drawerSideT) / 2, y: E.drawerBackT / 2, z: -((drawerBackTopY - dTop) - (drawerBackTopY - E.drawerBackH / 2)) },
        depth: E.dowelIntoBoard, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
        label: isEn ? "Ø8 dowel, drawer side" : "Ø8 木釘（抽屜側板）",
      }))),
    });
    parts.push({
      id: "drawer-1-bottom",
      nameZh: "抽屜底板（合板）", nameEn: "Drawer bottom (plywood)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: {
        length: drawerX1 - drawerX0 - 2 * E.drawerSideT + 2 * E.grooveD,
        // 後緣延到**後板後面**（Z 310）：底板從後方推入、穿過後板下方，再由下往上鎖 3 支 ø2.4×15
        width: drawerBackZ1 - drawerFrontZ1 + E.grooveD,
        thickness: E.bottomT,
      },
      origin: { x: 0, y: grooveTopY - E.bottomT, z: wz((drawerFrontZ1 - E.grooveD + drawerBackZ1) / 2 + dz) },
      tenons: [], mortises: [],
    });
    // D 抽屜前板↔側板 ×4、E 抽屜後板↔側板 ×4（沿 z；入抽屜側板 18／入前後板 12）
    for (const [i, cx] of drawerSideX.entries()) {
      for (const d of E.drawerFrontDowelFromTop) {
        parts.push(dowel(`dowel-drawer-front-${i}-${d}`, "木釘 Ø8×30（抽屜前板↔側板）", "Dowel Ø8×30 (drawer front to side)", "z",
          { x: wx(cx), y: drawerFrontTopY - d, z: wz(drawerFrontZ1 + dz) }, E.dowelIntoPanel, -1));
      }
      for (const d of E.drawerBackDowelFromTop) {
        const innerX = i === 0 ? drawerX0 + E.drawerSideT : drawerX1 - E.drawerSideT;
        parts.push(dowel(`dowel-drawer-back-${i}-${d}`, "木釘 Ø8×30（抽屜後板↔側板）", "Dowel Ø8×30 (drawer back to side)", "x",
          { x: wx(innerX), y: drawerBackTopY - d, z: wz((drawerBackZ0 + drawerBackZ1) / 2 + dz) },
          E.dowelIntoBoard, i === 0 ? 1 : -1));
      }
    }
  }

  if (input.length !== W || input.width !== D || input.height !== H) {
    warnings.push(isEn
      ? `Exam piece is fixed at ${W}×${D}×${H} mm — the sliders do not apply to this template.`
      : `本題尺寸固定 ${W}×${D}×${H}mm：腳的斜度由「腳頂 240、腳底 360、腳高 410」三個官方數字同時決定，改任何一個其他兩個就不對了，所以滑桿對這款不作用。`);
  }
  if (pull !== pullRaw) warnings.push(isEn
    ? `Drawer pull clamped to ${pull} mm (0–250).`
    : `抽屜拉出量夾到 ${pull}mm（可用範圍 0~250；負值會讓抽屜往櫃體裡倒退、撞到滑條與背板）。`);
  if (pull > 0) warnings.push(isEn ? `Drawer shown pulled out ${pull} mm (display only).` : `抽屜拉出 ${pull}mm 只是展示，尺寸不變。`);

  const design: FurnitureDesign = {
    id: `cert-b3-${W}x${D}x${H}`,
    category: "cert-b3",
    nameZh: "家具木工乙級 第三題（01200-100203）",
    overall: { length: W, width: D, thickness: H },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class B furniture-woodworking trade test, question 01200-100203 (7 hours). A 450×360×450 mm splay-legged side table with one drawer. The legs splay in the depth direction only — 240 across at the top, 360 on the floor over a 410 mm rise (8.33°), so the trestle top rails are shoulder-cut to match. This is the only one of the six questions with no dovetails at all: the drawer corners are dowelled (face-to-end). Blockboard top 434×344×18 edged 8 mm all round to 450×360; blockboard side and back panels 18 mm with 8 mm solid edging on the exposed ends; two 45×24 bottom rails tenoned into the legs, the front one tight under the carcase and the rear one 100 mm off the floor. 21 Ø8×30 dowels, 15 wood screws, three drawer-bottom grooves — all four counts match the official marking sheet exactly. **Drawn from published dimensions — download the official paper and follow that version on test day.**`
      : `依技術士技能檢定家具木工乙級術科試題 01200-100203（7 小時）公開尺寸繪製的練習範本。450×360×450 的斜腳單抽小邊桌。

**腳只在深度方向外撇**：腳頂展開 240、腳底展開 360、腳高 410 ⇒ 每邊撇 60、斜度 8.33°，正視圖看腳是垂直的。因此腳座上橫檔兩端要隨腳斜切（**斜肩榫**），這是本題最難的一手。

**本題是六題中唯一沒有鳩尾榫的**（評審表把「鳩尾榫頭榫孔」與「鳩尾榫密合」兩列整個拿掉），抽屜四角全部用木釘，打在側板端面（學科 §05-58「抽屜組裝＝面與端」）。

零件：木心板面板 434×344×18、四周包 8 實木封邊 → 450×360；木心板側板（前後端各 8 封邊、全長 312）與背板 334×132×18；腳柱 45×32×410 四支、腳底 3×45° 倒角；上橫檔 60×32 兩支榫接入腳；下橫桿 45×24 兩支（前檔頂緊貼盒底 300、後檔頂離地 100，榫厚 10 出自圖上 7｜10｜7＝24）；抽屜**箱體**外 324×300（評審表）、**前板是面付式 370×130×18**（兩端與腳內面齊、背面貼側板前緣當擋塊）、側板 127 高 15 厚、後板 107 高 15 厚（坐在底板上）、4mm 合板底板入 5 深槽；滑條 11×14 以 ${E.screwRunner} 鎖在側板內面、入抽屜側板 15 高 7 深的槽。

**與官方部位數對帳**（四項完全吻合）：木釘 **21 支**、木釘接合 9 處×2＝**18**、抽屜底板槽 **3 條**、木螺釘 **15 支**（側板→腳柱／上橫檔 ${E.screwSide} 每側 3 支、側板→滑條 ${E.screwRunner} 每側 3 支、底板→抽屜後板 ${E.screwBottom} 3 支）。

**工時**：官方測驗時間 **7 小時**（應檢須知第十條）。工序表估時是照一般木工節奏算的，會比 7 小時多——檢定現場的料已依材料表註 2「四面鉋光、要求直角」備妥，而且**應檢不做塗裝**——須知第六條只寫「成品可砂光，砂紙請自備」，全份沒有禁止塗裝的明文，但沒發塗料、自備工具表沒有塗裝工具、評審表「表面處理」只評平滑／完整性／圓弧與倒角，三者一致指向不塗裝。

⚠️ **唯一對不起來的官方數字**：評審表「榫接密合 60」。照第一、二題驗證過的「榫頭數×4 面肩」該有 15 個榫頭，但圖上只數得到 8 個（上橫檔 2 支×2 端＋下橫桿 2 支×2 端）。依應檢須知第七條「各部尺寸應以圖上所標示數字為準」，本範本以圖面 8 榫為準。

**本圖依公開尺寸自行繪製，不含官方圖檔；應檢請以技能檢定中心公布的官方版本為準。**
**上橫檔要斜肩**：兩端隨腳 8.33° 斜切，**頂肩距 150、底肩距 167.6**（本範本的 3D 先做成方料 150，斜肩沒做成造型，切料時請照這兩個數字放樣）。腳底 3×45° 倒角同樣沒做成造型，但官方圖有標、評審表「圓弧與倒角」有配分，別漏。

**抽屜四角一次上膠**：前角木釘沿深度方向（穿側板端面入前板）、後角沿寬度方向（穿側板面入後板端面），兩個方向互相咬住，不能一片一片裝——乾組試裝確認後，四角一次上膠夾緊。

**榫厚兩支都是官方標的**：上橫檔 12（A-A 腳斷面鏈 10｜12｜10＝32）、下橫桿 10（7｜10｜7＝24）。剛好都開得出來——自備工具表只發 ø12、ø6 兩支直刀。

**官方未規定、本範本自訂**：兩支橫檔的**榫長**（取 20）、下橫桿的榫高（取 35）、滑條長度（Z 28~295）、面板封邊四角接法。

**滑條的料要自己想**：11×14×267 兩支，材料表項次 4 的三片 400×130×15.5 已被抽屜三片用完（餘料最長 118、直剖也不夠寬），只能從項次 1 的 1050×95×32.5 餘料鉋到 11 厚。切料時別以為缺料。`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};

/** 考題預設尺寸的完整設計（測試／探針用）。 */
export function certB3Assembly(): FurnitureDesign {
  const options: Record<string, string | number | boolean> = {};
  for (const s of certB3Options) options[s.key] = s.defaultValue;
  return certB3({ length: EXAM.panelW, width: EXAM.D, height: EXAM.H, material: "pine", options });
}
