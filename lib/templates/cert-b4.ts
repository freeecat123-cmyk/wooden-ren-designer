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
 * 技術士技能檢定 家具木工 乙級 術科試題 01200-100204（練習範本）
 *
 * ⭐ 照官方試題**公開尺寸**自己畫的練習範本，不是官方圖面的重製；不嵌、不顯示官方圖檔。
 *    官方應檢參考資料（完整題本 012002B15，本題圖框 112/10/27）請至 owinform.wdasec.gov.tw 下載，應檢以官方版本為準。
 *    ✅ 版本已查證：114/06/18 修正對照表**只改了第一題的工作圖**（頁 13），第四題未修正，112/10/27 就是現行版。
 *       ⚠️ 但它同時改了**應檢人須知、自備工具表、材料表（頁 4）、時間配當表**——
 *       須知還在最前面插了一條新的第一條、後面條號整體 +1。本檔引用的六／七／十／十一／十二條是**新版號**。
 *
 * ── 這是什麼 ──────────────────────────────────────────────────────────
 * **板腳單抽邊桌**：472(寬) × 380(深) × 370(高)，腳座著地處全寬 **483**。
 * 上段是 380 深 × 150 高的木心板箱體（天板＋左右側板＋背板），內裝一個 384×350 的抽屜；
 * 箱體左右外側各貼一片 **90×21 實木板腳**，板腳下端以 10 厚榫插入 **45×32×380 的腳座**，
 * 兩腳之間再用一支 **60×21 中橫檔**（10 厚貫穿榫）拉住。
 *
 * ⭐ **六題唯一的「板腳」題**：其餘五題的腳柱都是 **45×32** 方腳，只有本題是 **90×21 的板腳、而且只有 2 片**。
 *    證據是**工作圖**：1:10 側視圖是明確的 T 字形、A-A 左端腳柱只佔圖上 X 0~21、寬度鏈 472＝21｜430｜21。
 *    ⚠️ 評審表「腳柱 90×21，4 部位」只能當旁證，**不可以拿部位數反推支數**——
 *       第六題同樣是 45×32 卻也只有 **4 部位**（第一、二、三、五題才是 8），這條規則本身就不穩。
 *
 * ⚠️ **總寬 472 不是最大外廓**：腳座 32 厚比腳柱 21 厚每側多 5.5，落地處是 **483**（圖上直接標了）。
 *    `overall.length` 取 483（真實包絡），評審表的 472 量的是腳柱外對外。
 *
 * ── 座標（本檔內部）─────────────────────────────────────────────────
 * X 0~472 由**左腳柱外面**、Y 0~370 由地面、Z 0~380 由正面；程式內再平移到世界座標（+Z＝背）。
 *
 * ── 官方權威尺寸（評審表 PDF 第 10 頁）──────────────────────────────
 * 總高 370±1｜總寬 472±1（量腳柱外對外）｜總深 380±1｜上、中橫檔 60×21±0.5
 * 抽屜外側 384×350±1｜**腳柱 90×21±0.5（4 部位＝2 支）**｜側下橫檔 45×32±0.5｜抽屜前板寬 130±0.5
 *
 * ── 尺寸鏈（每一條都封得起來，全部回工作圖逐一核對過）──────────────
 * 寬：472＝21｜430｜21；430＝18｜394｜18；394＝5｜384｜5；384＝15｜354｜15；483＝5.5｜472｜5.5
 * 深：380＝62｜128｜128｜62（天板木釘）＝145｜90｜145（腳柱在腳座上）＝8｜364｜8（天板／側板封邊）
 *     ＝10｜360｜10（腳座頂面比底面短，兩端各斜切 10）；上橫檔 60＝14｜32｜14（木釘）
 *     抽屜前板 18＝12(手掛槽挖掉)｜6(留厚)；前板前面比箱體前緣退縮 3
 * 高：370＝18｜132｜60｜115｜45（天板／箱內／中橫檔／空檔／腳座）
 *     箱體 150＝18｜132＝18｜2｜130（天板／頂縫／前板）
 *     背板木釘 132＝34｜64｜34；抽屜側板 102＝5｜82｜15；抽屜後板 82＝21｜40｜21
 *     A-A 左鏈 22｜76｜34｜60（由天板底 352 下數到中橫檔底 160）；天板頂比腳柱頂高 10
 * 斷面：腳座 32＝11｜10｜11；中橫檔 21＝5.5｜10｜5.5；木釘 Ø8×30＝入面 12｜入端 18
 *
 * ── ⚠️ 建模時被工作圖推翻的四個先入為主（留著提醒第五、六題）────────
 * ① 抽屜前板不是 394 是 **384**：它是抽屜箱的一員、兩端做半隱鳩尾，不是面付式。
 * ② 抽屜後板不是 102 是 **82**：102 是側板高。C-C 的「5｜82｜15」與 A-A 的「5｜5」兩處互證。
 * ③ 滑軌槽深不是 7.5 是 **7**：A-A 有兩個「7」，一個是滑軌槽、一個是底板溝。
 * ④ 抽屜前板底緣背面有一條 **140 寬 × 12 深 × 6 高的手掛槽**（B-B 的 70 是半寬、C-C 的 6 是留厚），
 *    差點整個漏掉 —— 這是本題唯一的造型加工，也是唯一的「開口」。
 *
 * ── ⛔ 「部位數」不可以拿來反推件數（2026-09-10 六題橫向比對後定案，推翻先前的規則）────
 * 先前寫的「**尺寸**區塊的部位數＝件數 × 量測尺寸數，可以反推支數」**不成立**，兩條硬反證：
 *   ① **第一題「內部木釘 30 部位」＞ 材料表發的 29 支木釘**（材料表是六題共用一份，木釘一律 29 支）。
 *      部位數比材料還多，不可能是支數。
 *   ② **同一條「總寬度」，第一~四題是 4 部位、第五、六題是 3 部位**（配分都是 6 分：4×1.5 ＝ 3×2）。
 *      量同一條總寬不可能這題 4 個地方、那題 3 個地方 —— 部位數是**把配分湊成整數的分母**。
 * ⇒ 部位數只能當**旁證**；件數一律回工作圖數。實測「配分 ＝ 部位數 × 每部位扣分」在本題除了
 *   木螺釘那一格（12×0.3＝3.6 卻印 3.5，官方自己四捨五入）之外**全部整除**，這也支持它是分母。
 *
 * ── 官方部位數 vs 本模型（只做對照，不拿來反推）──────────────────
 * | 評審表 | 官方部位數×每部位＝配分 | 本模型 | 備註 |
 * | 尺寸：總高/總寬/總深 | 4×1.5＝6（各） | 370／472／380 | 公差都是 ±1 |
 * | 尺寸：上、中橫檔 60×21 | 2×0.5＝1 | **2 支** | 以圖為準，見下方 |
 * | 尺寸：抽屜外側 384×350 | 4×1＝4 | ✔ | |
 * | 尺寸：腳柱 90×21 | 4×0.5＝2 | **2 片板腳** | |
 * | 尺寸：側下橫檔 45×32 | 4×0.5＝2 | **2 支腳座** | |
 * | 尺寸：抽屜前板寬 130 | 2×0.5＝1 | ✔ | |
 * | 內部：榫孔與榫頭 | 16×0.5＝8 | 4 組榫 | |
 * | 內部：木釘 | 20×0.2＝4 | **21 支**（圖上數的） | 外部「木釘密合」是 22，兩列不相等 |
 * | 內部：鳩尾榫頭榫孔 | 30×0.25＝7.5 | 2 個角 | 30 在五題都一樣（第三題沒有鳩尾） |
 * | 內部：抽屜底板槽 | 3×0.5＝1.5 | **3 條**（前板＋兩側板） | 六題都是 3 |
 * | 外部：榫接密合 | 12×0.5＝6 | 4 組榫 | |
 * | 外部：鳩尾榫密合 | 18×0.25＝4.5 | 2 個角 | ⚠️ 不是「五題都一樣」——**第一題是 28** |
 * | 外部：抽屜底板接合 | 4×0.5＝2 | ✔ | |
 * | 五金：木螺釘 | 12×0.3＝3.5(官方誤植) | **13 支** | 支數依材料表與圖面各自定，見螺釘那段註解 |
 * 另有不計部位數的：活動部分 9%（抽屜之活動 4／抽屜前板之密合 5）、
 * 表面處理 15%（平滑 5／完整性 5／**圓弧與倒角 5**）。
 * 六區塊配比：尺寸 28％｜內部榫接 21％｜外部接合 23.5％｜五金裝配 3.5％｜活動部分 9％｜表面處理 15％ ＝ 100。
 * ⛔ 扣 41 分三條：未於規定時間完成／自行攜帶材料工件進出場／**尺寸誤差超過 20mm**。
 *
 * ⭐ **材料表是評審表與工作圖之外的第三份獨立驗證，本題全部對得上**
 *    （⚠️ 材料表**六題共用一份**「每人份」，只有項次 1、2 有分題註記，其餘每題發的都一樣）：
 *   木心板 480×450 ×1 → 天板心材 414×364；木心板 426×178 ×3 → 兩片側板心材 364×132 ＋ 背板 394×132；
 *   木料 440×132×18.5 ×1 → 抽屜前板 384×130×18；木料 400×130×15.5 ×3 → 抽屜側板 344 ×2 ＋ 後板 354；
 *   木材 550×19×8.5 ×5 → 天板封邊 430／430／**364／364**（本模型取**對接**：前後通長 430、左右夾中間 364）
 *     ＋ 一支裁 4 段 132（側板前後端各一，528 ≤ 550）。
 *     ⚠️ 四角改**斜切**就是 430／430／380／380，一樣 5 支排得下 —— **材料表分不出來、圖上也沒畫俯視**，
 *        所以接法是「官方未規定、本範本自訂對接」，不要把 380 寫成官方數字；
 *   合板 408×350 ×1 → 抽屜底板 368×339；
 *   ⚠️ **滑軌木條 317×14×11 ×2 官方沒有單獨發料**——只能從抽屜側板那支 400×130×15.5 剖完
 *      （側板 102 高、後板 82 高）剩下的邊料出。這也解釋了為什麼側板料發 130 寬而不是 105 寬。
 *   木料 1050×95×32.5 ×**2**（註明「1 號題 1 支，2~6 號題各 2 支」）：
 *     A 支 ＝ 板腳 345（含 30 榫）＋ 中橫檔 472（430＋兩端 21 榫）＝ 820；
 *     B 支 ＝ 板腳 345 ＋ 腳座 380（**一段 380 縱剖成兩支 45**：45＋鋸路 3＋45 ＝ 93 ≤ 95）＝ 728。
 *     ⚠️ 別寫成「一支出腳柱＋兩支腳座」——345＋380＋380 ＝ 1105 > 1050，**放不下**。
 *     旁證：第一題只發 1 支 1050 卻要 4 支 45×32×450 的腳柱，不縱剖根本不可能。
 *   木料 600×92×21.5 ×**1**（註明「1、2、4、5 號題 1 支，3 號題 0 支，6 號題 2 支」）→ 上橫檔 394×60×21；
 *   五金：Ø8×30 木釘 **29 支**、Ø2.4×15 **3 支**、Ø3×25 **14 支**、Ø3.5×30 **14 支**、白膠 1 瓶
 *   （這四項六題同額 ⇒ 是六題的**上限**，不能拿來反推本題用幾支；只有 **Ø2.4×15 的 3 支**
 *    因為只有抽屜底板會用到，等於直接把底板螺釘釘死在 3 支）。
 *   ⛔ 先前寫的「**21.5 那支料 ⇔ 這題有 21mm 厚零件**」**不成立**，兩個反例：
 *      **第二題**發 1 支，但它的下橫檔是 45×**24** 與 30×**18**，整題沒有 21；
 *      **第五題**發 1 支，但它的側上橫檔是 90×**20**。
 *      而且各題支數是**官方直接印在備註欄**的（「1、2、4、5 號題 1 支，3 號題 0 支，6 號題 2 支」），
 *      本來就不是推出來的規律。能講的只有弱版：這支料 ⇔ 這題有「≤21.5 厚、≤92 寬、≤600 長、
 *      不值得從 32.5 鉋」的板狀件，第三題是六題唯一整題沒有這種零件的。
 *
 * ⚠️ **上、中橫檔「1 支還是 2 支」的衝突已用圖面定案為 2 支**：
 *    評審表「上、中橫檔 60×21，**2 部位**」照「部位數÷2＝件數」只有 1 件，
 *    但工作圖上兩支都畫得出來（C-C 的上橫檔平放在 Y220~241／Z21~81、1:10 側視圖的中橫檔立放在 Y160~220），
 *    材料也切得出來，而且**總高鏈 370＝18｜132｜60｜115｜45 裡那個 60 就是中橫檔**。
 *    依應檢須知第七條「各部尺寸應以圖上所標示數字為準」→ **以圖為準做 2 支**。
 *
 * ── 官方未規定、本範本自訂（每一條都回圖確認過「圖上真的沒有」）────
 * 鳩尾齒數（取 5 段）、封邊條四角接法（取對接；斜切也排得下，材料表分不出來）、
 * 滑軌木條長度（取 Z21~338：前端貼抽屜前板背面、後端貼抽屜後板正面）、
 * 木螺釘沿深度方向的位置（板腳取深度中央 1 排、滑軌取 3 支）、抽屜底板成品尺寸（由槽推得）。
 *
 * 🩸 **這一欄曾經多寫了一條「腳柱下端榫深自訂 30」——那是圖上有的東西**（實際是**貫穿 45**）。
 *    這已經是這個系列第三次把「圖上標了的數字」寫成「官方未規定」了
 *    （第三題犯過兩次：上橫檔榫厚 12、底板槽深 7）。
 *    ⇒ **凡是要往這一欄寫東西，先回原圖放大 6~8 倍再確認一次**。
 * 手掛槽兩端圓角：註記字形在掃描解析度下判讀不出來，但**俯視實量 R≈2.7 ⇒ 是 R3**，
 * 而且物理自洽：**用 ø6 直刀貼著底緣走一刀，槽高就是 6（＝刀徑）、兩端自然留 R3（＝刀半徑）**，
 * 深度 12 靠分刀進給。（ø12 刀開不出 6 高的槽，所以不會是 R6。）
 * 不影響任何量測尺寸，本模型以直角表示。
 *
 * ── 依官方學科參考資料（012002A12.pdf）定的 ──────────────────────
 * §01-19「鳩尾榫之斜度一般為 **1:6**」＋§05-4「1/6～1/8」→ 9.46°
 * §05-10「半隱鳩尾榫長度應為板厚的 **2/3**」→ 18×2/3 ＝ 12（B-B 圖上也直接標了 12 ✅）
 * §05-24「19mm 木心板配 **Ø8** 木釘」✅
 * §05-58「抽屜組裝＝面與端」→ 前角鳩尾、後角木釘 ✅
 */

/** 官方試題尺寸（mm）。X 0~472 由左腳柱外面、Y 0~370 由地面、Z 0~380 由正面 */
const EXAM = {
  W: 472, D: 380, H: 370,
  outerW: 483,                                // 腳座著地全寬（腳座每側比腳柱多 5.5）
  legT: 21, legW: 90, legTopY: 360,           // 板腳：21 厚 × 90 深，頂面比天板頂低 10
  legZ0: 145,                                 // 腳柱在腳座上的位置：145｜90｜145 ＝ 380
  footH: 45, footT: 32, footTopShrink: 10,    // 腳座 45 高 × 32 厚 × 380 長，頂面兩端各短 10
  legFootTenonT: 10, legFootTenonLen: 45,     // 腳柱下端榫：10 厚（腳座斷面 32＝11｜10｜11）× **貫穿腳座 45**
                                              // 🩸 第一版寫成「官方未標、自訂盲榫 30」——錯了，圖上有：
                                              // 腳座立面圖與斷面圖兩處的虛線都從頂面一路畫到**底面**、
                                              // 中間沒有任何封口線。盲榫一定要畫榫眼底 ⇒ 是貫穿榫。
  midRailH: 60, midRailT: 21, midRailTopY: 220,   // 中橫檔：立放，60 高 × 21 厚，Y 160~220
  midRailTenonT: 10,                          // 榫厚 10（斷面 21＝5.5｜10｜5.5），貫穿腳柱
  panelT: 18, panelEdge: 8,                   // 木心板 18 ＋ 8 實木封邊
  carcaseTopY: 352, carcaseBottomY: 220,      // 箱體內部 Y 220~352（132 高）；天板 352~370
  topRailH: 21, topRailD: 60, topRailTopY: 241,   // 上橫檔：平放，21 厚 × 60 深，Y 220~241
  topRailZ0: 21,                              // 上橫檔前面貼齊抽屜前板背面（Z 21）
  topRailDowelZ: [14, 46],                    // 由上橫檔前緣起算：14｜32｜14 ＝ 60
  drawerGap: 5,
  drawerW: 384, drawerD: 350,                 // 評審表「抽屜外側寬、深度 384×350」
  drawerFrontH: 130, drawerFrontT: 18, drawerFrontZ0: 3, drawerTopGap: 2,
  drawerSideH: 102, drawerSideT: 15, drawerSideBelowFront: 3,   // 側板頂比前板頂低 3（比天板底低 5）
  drawerBackH: 82, drawerBackT: 15, drawerBackBelowSide: 5,     // 後板頂比側板頂低 5（C-C：102＝5｜82｜15）
  bottomT: 4, grooveD: 7, bottomBelowSideTop: 87,               // 底板頂離側板頂 87（＝102−15）
  slotH: 15, slotD: 7, runnerW: 11, runnerH: 14,
  slotTopBelowSideTop: 40,                    // 槽頂離側板頂 40（A-A 的 35 是由**後板頂**起算：5＋35＝40）
  pullW: 140, pullD: 12, pullH: 6,            // 前板底緣背側手掛槽（B-B 的 70 是半寬）
  dowelDia: 8, dowelLen: 30,
  dowelIntoFace: 12, dowelIntoEnd: 18,        // B-B 上段直接標的「12｜18」＝30
  topDowelZ: [62, 190, 318],                  // 天板↓側板：62｜128｜128｜62 ＝ 380
  backDowelStep: [55, 160, 160],              // 天板↓背板：由天板左緣起 55｜160｜160｜55 ＝ 430
  backSideDowelY: [318, 254],                 // 背板↔側板：34｜64｜34 ＝ 132（由箱內頂 352 下數）
  /**
   * 背板方向那 7 支木釘（天板↓背板 3 ＋ 背板↔側板 4）的 Z ＝ **背板 18 厚的正中央 371**。
   * 🩸 第一版取 367 想讓 Ø8 孔完全落在木心板核心內（核心後端 372），但那是**建模方便、不是圖**：
   *    孔打在背板端面上本來就只能置中，偏前 4mm 等於一邊只剩 5mm 肉。圖上也是畫在正中央。
   *    ⇒ 跟「天板↓側板」那 6 支一樣，**孔就是跨在核心與封邊條的膠合線上**，
   *      用 cosmetic 方槽在兩件上各標一塊（跟天板↓側板那組同一個處理）。
   */
  backSideDowelZ: 371,
  drawerBackDowelBelowBackTop: [21, 61],      // 抽屜後板↔側板：後板頂起 21｜40｜21 ＝ 82
  dovetailSegments: 5, dovetailAngleDeg: 9.46, dovetailPinDepth: 12,
  screwDiaLeg: 3.5, screwDiaRunner: 3, screwDiaBottom: 2.4,
  screwLegY: [330, 254],                      // A-A 左鏈 22｜76 ⇒ 352−22＝330、330−76＝254
  screwRunnerY: 300,
  // 抽屜底板→後板 **3 支**（材料表項次 10 Ø2.4×15 只發 3 支）。
  // 圖上後板中心線上有中心記號但沒標尺寸；判讀員實量落在 X≈149／323（對稱），
  // 取 90｜87｜87｜90 ＝ 354 貼合實量值。
  screwBottomStep: [90, 87, 87],
} as const;

export const certB4Options: OptionSpec[] = [
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
    help: "只影響 3D 展示（把抽屜拉出來看滑軌怎麼入槽），不改任何尺寸。應檢時抽屜當然是關著的",
  },
  {
    group: "structure",
    type: "checkbox",
    key: "withDrawer",
    label: "裝抽屜",
    defaultValue: true,
    help: "試題一定要做抽屜。取消只是為了看清楚箱體與滑軌，應檢一定要裝",
  },
];

export const certB4: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certB4Options;
  const pullRaw = getOption<number>(input, opt(o, "drawerPull"));
  // 夾在讀選項那一行（§A10.11）。負值會讓抽屜往箱體裡倒退、撞背板與滑軌。
  const pull = Math.min(250, Math.max(0, Number.isFinite(pullRaw) ? pullRaw : 0));
  const withDrawer = getOption<boolean>(input, opt(o, "withDrawer"));

  const E = EXAM;
  const warnings: string[] = [];

  // 尺寸鎖死：木釘列、抽屜、腳柱在腳座上的 145｜90｜145 全是考題常數，跟著滑桿縮放必穿模。
  const W = E.W, D = E.D, H = E.H;

  /** 圖面座標 → 世界座標：X 置中於腳柱跨距、Y 不變（origin.y＝底）、+Z＝背 */
  const wx = (x: number) => x - W / 2;
  const wz = (z: number) => z - D / 2;
  const parts: Part[] = [];

  // ── 版面關鍵 X ────────────────────────────────────────────────────
  const legL1 = E.legT;                        // 21  左腳內面（＝天板左緣）
  const sideL1 = legL1 + E.panelT;             // 39  左側板內面
  const drawerX0 = sideL1 + E.drawerGap;       // 44  抽屜箱左外面
  const drawerX1 = drawerX0 + E.drawerW;       // 428 抽屜箱右外面
  const sideR0 = drawerX1 + E.drawerGap;       // 433 右側板內面
  const legR0 = sideR0 + E.panelT;             // 451 右腳內面
  const carcaseW = legR0 - legL1;              // 430
  const innerW = sideR0 - sideL1;              // 394
  const carcaseH = E.carcaseTopY - E.carcaseBottomY;   // 132

  // ── 天板（木心板 414×364×18 ＋ 四周 8 實木封邊 → 430×380）──────────
  const topBottomY = E.H - E.panelT;           // 352
  const topCoreCx = (legL1 + legR0) / 2;       // 236
  {
    const m: Mortise[] = [];
    // 側板木釘孔 ×6（由底面往上鑽 12）
    for (const sx of [0, 1] as const) for (const z of E.topDowelZ) m.push({
      origin: { x: (sx === 0 ? sideL1 : sideR0) - (sx === 0 ? E.panelT / 2 : -E.panelT / 2) - topCoreCx, y: 0, z: wz(z) },
      depth: E.dowelIntoFace, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, side panel" : "Ø8 木釘（側板）",
    });
    // 背板木釘孔 ×3
    let x = legL1;
    for (const step of E.backDowelStep) {
      x += step;
      m.push({
        origin: { x: x - topCoreCx, y: 0, z: wz(E.backSideDowelZ) },
        depth: E.dowelIntoFace, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
        label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（背板）",
      });
    }
    parts.push({
      id: "top-core",
      nameZh: "天板（木心板）",
      nameEn: "Top core (blockboard)",
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: carcaseW - 2 * E.panelEdge, width: E.D - 2 * E.panelEdge, thickness: E.panelT },
      origin: { x: wx(topCoreCx), y: topBottomY, z: 0 },
      tenons: [],
      mortises: m,
    });
  }
  // 天板封邊：前後通長 430、左右夾在中間（長 364）
  for (const [id, zc] of [["top-edge-front", E.panelEdge / 2], ["top-edge-back", E.D - E.panelEdge / 2]] as const) {
    parts.push({
      id,
      nameZh: id.endsWith("front") ? "天板封邊（前）" : "天板封邊（後）",
      nameEn: id.endsWith("front") ? "Top edging (front)" : "Top edging (back)",
      material, grainDirection: "length",
      visible: { length: carcaseW, width: E.panelEdge, thickness: E.panelT },
      origin: { x: wx(topCoreCx), y: topBottomY, z: wz(zc) },
      tenons: [], mortises: [],
    });
  }
  for (const [id, xc] of [["top-edge-left", legL1 + E.panelEdge / 2], ["top-edge-right", legR0 - E.panelEdge / 2]] as const) {
    parts.push({
      id,
      nameZh: id.endsWith("left") ? "天板封邊（左）" : "天板封邊（右）",
      nameEn: id.endsWith("left") ? "Top edging (left)" : "Top edging (right)",
      material, grainDirection: "length",
      visible: { length: E.D - 2 * E.panelEdge, width: E.panelEdge, thickness: E.panelT },
      origin: { x: wx(xc), y: topBottomY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      tenons: [], mortises: [],
    });
  }

  // ── 板腳 ×2（實木 21 厚 × 90 深，Y 45~360；下端 10 厚榫插入腳座）────
  const legBotY = E.footH;                     // 45
  const legH = E.legTopY - legBotY;            // 315
  const legCz = E.legZ0 + E.legW / 2;          // 190（＝深度中央）
  for (const sx of [0, 1] as const) {
    const cx = sx === 0 ? E.legT / 2 : E.W - E.legT / 2;
    const inSign = sx === 0 ? 1 : -1;          // 朝箱體那一面的 local x 正負
    const m: Mortise[] = [];
    // 中橫檔的貫穿榫眼（沿 x）；origin.y 是 from-bottom
    m.push({
      origin: { x: inSign * E.legT / 2, y: E.midRailTopY - E.midRailH / 2 - legBotY, z: 0 },
      depth: E.legT, length: E.midRailH, width: E.midRailTenonT, through: true,
      label: isEn ? "through mortise, middle rail" : "中橫檔貫穿榫眼（10 厚 × 60 高）",
    });
    // ⚠️ 板腳這一側**不再開導引孔**：螺釘是從箱內穿過側板鎖進來的，
    //    兩邊都建模會被工序表數成兩支（評審表「木螺釘 12 部位」就會變 16）。
    //    孔只留在側板那一件上（貫穿），跟 cert-b3 的做法一致。
    parts.push({
      id: sx === 0 ? "leg-left" : "leg-right",
      nameZh: `板腳（${sx === 0 ? "左" : "右"}）`,
      nameEn: `Board leg (${sx === 0 ? "left" : "right"})`,
      material,
      grainDirection: "length",
      visible: { length: E.legT, width: E.legW, thickness: legH },
      origin: { x: wx(cx), y: legBotY, z: wz(legCz) },
      // position:"bottom" 的 width 走 local X、thickness 走 local Z（見 tenonLocalBox），
      // 所以「10 厚 × 90 寬」在這裡要寫成 width:10 / thickness:90（dining-table 也是這樣寫）。
      tenons: [{
        position: "bottom", type: "through-tenon",
        length: E.legFootTenonLen, width: E.legFootTenonT, thickness: E.legW,
      }],
      mortises: m,
    });
  }

  // ── 腳座 ×2（實木 380×45×32；頂面兩端各短 10 → 上窄下寬的梯形）──────
  for (const sx of [0, 1] as const) {
    const cx = sx === 0 ? E.legT / 2 : E.W - E.legT / 2;   // 與腳柱同軸，32 厚每側多 5.5
    parts.push({
      id: sx === 0 ? "foot-left" : "foot-right",
      nameZh: `側下橫檔（${sx === 0 ? "左" : "右"}）`,
      nameEn: `Foot rail (${sx === 0 ? "left" : "right"})`,
      material,
      grainDirection: "length",
      visible: { length: E.D, width: E.footH, thickness: E.footT },
      origin: { x: wx(cx), y: 0, z: 0 },
      // rotation {x:π/2, y:π/2}：local x→世界 −z、local y(厚)→世界 x、local z(寬)→世界 −y
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      // 兩端斜切：底面 380、頂面 360（頂面在 local −z 端）
      shape: { kind: "apron-trapezoid", topLengthScale: (E.D - 2 * E.footTopShrink) / E.D, bottomLengthScale: 1 },
      tenons: [],
      mortises: [{
        // local z ＝ −寬/2 是世界頂面；local y 置中 ⇒ 榫眼在 32 厚的正中央（11｜10｜11）
        origin: { x: legCz - E.D / 2, y: E.footT / 2, z: -E.footH / 2 },
        // ⚠️ length/width 這裡看起來是「反的」（10 × 90）是對的，不要順手改回來：
        //   `auditJoints` 的比對規則是 mortise.length ↔ tenon.width、mortise.width ↔ tenon.thickness，
        //   而 position:"bottom" 的榫頭 width 走 local X（＝10 厚那一軸）、thickness 走 local Z（＝90 寬）。
        //   幾何完全不受影響——`mortiseLocalBox` 只取 max/min，不看哪個欄位叫 length。
        depth: E.legFootTenonLen, length: E.legFootTenonT, width: E.legW, through: true,
        label: isEn ? "through mortise, leg tenon" : "腳柱貫穿榫眼（10 厚 × 90 寬，穿透 45）",
      }],
    });
  }

  // ── 中橫檔（實木 60 高 × 21 厚，立放 Y 160~220；兩端 10 厚貫穿榫入板腳）──
  parts.push({
    id: "mid-rail",
    nameZh: "中橫檔",
    nameEn: "Middle rail",
    material, grainDirection: "length",
    visible: { length: carcaseW, width: E.midRailH, thickness: E.midRailT },
    origin: { x: 0, y: E.midRailTopY - E.midRailH, z: wz(legCz) },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    tenons: (["start", "end"] as const).map((position): Tenon => ({
      position, type: "through-tenon",
      length: E.legT, width: E.midRailH, thickness: E.midRailTenonT,
      shoulderOn: ["top", "bottom"],
    })),
    mortises: [],
  });

  // ── 箱體：左右側板（木心板 364×132×18 ＋ 前後端 8 實木封邊）────────
  const sideCoreZ0 = E.panelEdge, sideCoreZ1 = E.D - E.panelEdge;   // 8 ~ 372
  const sideCz = (sideCoreZ0 + sideCoreZ1) / 2;                     // 190
  const sideCy = E.carcaseBottomY + carcaseH / 2;                   // 286
  const drawerFrontTopY = E.carcaseTopY - E.drawerTopGap;           // 350
  const drawerSideTopY = drawerFrontTopY - E.drawerSideBelowFront;  // 347
  const runnerTopY = drawerSideTopY - E.slotTopBelowSideTop;        // 307
  const drawerFrontZ1 = E.drawerFrontZ0 + E.drawerFrontT;           // 21
  const drawerBackZ1 = E.drawerFrontZ0 + E.drawerD;                 // 353
  const drawerBackZ0 = drawerBackZ1 - E.drawerBackT;                // 338
  const runnerZ0 = drawerFrontZ1, runnerZ1 = drawerBackZ0;          // 21 ~ 338
  const screwRunnerZ = [runnerZ0 + 60, (runnerZ0 + runnerZ1) / 2, runnerZ1 - 60];   // 81 / 179.5 / 278
  for (const sx of [0, 1] as const) {
    const coreCx = sx === 0 ? sideL1 - E.panelT / 2 : sideR0 + E.panelT / 2;
    const innerY = sx === 0 ? E.panelT : 0;    // local y：朝箱內那一面
    const m: Mortise[] = [];
    // rotation {x:π/2, y:π/2}：local x→世界 −z、local y(厚)→世界 x、local z(寬)→世界 −y
    // 天板木釘孔 ×3（開在**頂緣**＝local −z 端；入板 18）
    for (const z of E.topDowelZ) m.push({
      origin: { x: -(z - sideCz), y: E.panelT / 2, z: -(carcaseH / 2) },
      depth: E.dowelIntoEnd, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, top" : "Ø8 木釘（天板）",
    });
    // 背板木釘孔 ×2（開在**內面**；入側板 12）
    for (const y of E.backSideDowelY) m.push({
      origin: { x: -(E.backSideDowelZ - sideCz), y: innerY, z: -(y - sideCy) },
      depth: E.dowelIntoFace, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（背板）",
    });
    // 上橫檔木釘孔 ×2（開在**內面**；入側板 12）
    for (const zOff of E.topRailDowelZ) m.push({
      origin: { x: -((E.topRailZ0 + zOff) - sideCz), y: innerY, z: -((E.topRailTopY - E.topRailH / 2) - sideCy) },
      depth: E.dowelIntoFace, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, top rail" : "Ø8 木釘（上橫檔）",
    });
    /**
     * 木螺釘導引孔。做成 cosmetic 貫穿孔，零件圖才標得出位置；螺釘本體是現成五金、不建模。
     *
     * ⚠️ **不要拿評審表「木螺釘 12 部位」當支數**（見檔頭部位數那段的硬反證）。
     * 本模型的支數各有各的依據：
     *   - Ø2.4×15（底板→抽屜後板）**3 支** ← **材料表項次 10 只發 3 支**，這條是硬的。
     *   - Ø3.5×30（側板→板腳）每側 2 支 ← A-A 只標了兩個高度 Y330／Y254；深度方向官方未標，取深度中央 1 排。
     *   - Ø3×25（側板→滑軌木條）每側 3 支 ← 高度 Y300 圖上有標，深度位置官方未標；
     *     317 長的木條只鎖 2 支會轉，取 3 支（跟 cert-b3 同樣做法）。
     * 合計 4＋6＋3 ＝ 13 支。
     */
    for (const y of E.screwLegY) m.push({
      origin: { x: -(legCz - sideCz), y: E.panelT / 2, z: -(y - sideCy) },
      depth: E.panelT, length: E.screwDiaLeg, width: E.screwDiaLeg, through: true, shape: "round", cosmetic: true,
      label: isEn ? "pilot hole, Ø3.5×30 to leg" : "Ø3.5×30 導引孔（鎖板腳）",
    });
    parts.push({
      id: sx === 0 ? "side-panel-left" : "side-panel-right",
      nameZh: `側板（${sx === 0 ? "左" : "右"}）`,
      nameEn: `Side panel (${sx === 0 ? "left" : "right"})`,
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: sideCoreZ1 - sideCoreZ0, width: carcaseH, thickness: E.panelT },
      origin: { x: wx(coreCx), y: E.carcaseBottomY, z: wz(sideCz) },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: m,
    });
    for (const [suffix, zc] of [["front", E.panelEdge / 2], ["back", E.D - E.panelEdge / 2]] as const) {
      parts.push({
        id: `side-edge-${sx === 0 ? "left" : "right"}-${suffix}`,
        nameZh: `側板封邊（${sx === 0 ? "左" : "右"}${suffix === "front" ? "前" : "後"}）`,
        nameEn: `Side edging (${sx === 0 ? "left" : "right"} ${suffix})`,
        material, grainDirection: "length",
        visible: { length: E.panelT, width: E.panelEdge, thickness: carcaseH },
        origin: { x: wx(coreCx), y: E.carcaseBottomY, z: wz(zc) },
        tenons: [], mortises: [],
      });
    }
    // 抽屜滑軌木條（實木 11×14，鎖在側板內面；前端收在抽屜前板背面 Z 21，否則抽屜關不起來）
    const runnerCx = sx === 0 ? sideL1 + E.runnerW / 2 : sideR0 - E.runnerW / 2;
    parts.push({
      id: sx === 0 ? "runner-left" : "runner-right",
      nameZh: `抽屜滑軌（${sx === 0 ? "左" : "右"}）`,
      nameEn: `Drawer runner (${sx === 0 ? "left" : "right"})`,
      material, grainDirection: "length",
      visible: { length: runnerZ1 - runnerZ0, width: E.runnerH, thickness: E.runnerW },
      origin: { x: wx(runnerCx), y: runnerTopY - E.runnerH, z: wz((runnerZ0 + runnerZ1) / 2) },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      /**
       * ⭐ Ø3×25 是**從抽屜那一側往外鎖**（貫穿 11 厚的滑軌木條 ＋ 進側板 14，11＋14 ＝ 25 剛好是螺釘全長），
       *    所以導引孔開在**滑軌木條**上、不是側板上。
       * 🩸 第一版把孔開在側板並貫穿 ⇒ ① 釘頭會露在箱體外側面；
       *    ② Z＝179.5 那支正好在 90 深的板腳（Z 145~235）背後，**物理上根本鎖不進去**。
       */
      mortises: screwRunnerZ.map((z) => ({
        origin: { x: -(z - (runnerZ0 + runnerZ1) / 2), y: E.runnerW / 2, z: 0 },
        depth: E.runnerW, length: E.screwDiaRunner, width: E.screwDiaRunner, through: true, shape: "round" as const, cosmetic: true,
        label: isEn ? "pilot hole, Ø3×25 into side panel" : "Ø3×25 導引孔（由抽屜側鎖進側板）",
      })),
    });
  }

  // ── 箱體：背板（木心板 394×132×18）──────────────────────────────────
  {
    const m: Mortise[] = [];
    // 背板 local y ＝ 由背板**前面**（Z 362）量起 ⇒ 367 − 362 ＝ 5
    const backDowelLocalY = E.backSideDowelZ - (E.D - E.panelT);
    let x = legL1;
    for (const step of E.backDowelStep) {
      x += step;
      m.push({
        origin: { x: x - (sideL1 + sideR0) / 2, y: backDowelLocalY, z: -(carcaseH / 2) },
        depth: E.dowelIntoEnd, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
        label: isEn ? "Ø8 dowel, top" : "Ø8 木釘（天板）",
      });
    }
    for (const ex of [-1, 1] as const) for (const y of E.backSideDowelY) m.push({
      origin: { x: ex * innerW / 2, y: backDowelLocalY, z: -(y - sideCy) },
      depth: E.dowelIntoEnd, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, side panel" : "Ø8 木釘（側板）",
    });
    parts.push({
      id: "back-panel",
      nameZh: "背板",
      nameEn: "Back panel",
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: innerW, width: carcaseH, thickness: E.panelT },
      origin: { x: wx((sideL1 + sideR0) / 2), y: E.carcaseBottomY, z: wz(E.D - E.panelT / 2) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: m,
    });
  }

  // ── 上橫檔（實木 394×60×21，平放在箱體底、抽屜前板背後）────────────
  {
    const railCz = E.topRailZ0 + E.topRailD / 2;      // 51
    const m: Mortise[] = [];
    for (const ex of [-1, 1] as const) for (const zOff of E.topRailDowelZ) m.push({
      origin: { x: ex * innerW / 2, y: E.topRailH / 2, z: (E.topRailZ0 + zOff) - railCz },
      depth: E.dowelIntoEnd, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
      label: isEn ? "Ø8 dowel, side panel" : "Ø8 木釘（側板）",
    });
    parts.push({
      id: "top-rail",
      nameZh: "上橫檔",
      nameEn: "Top rail",
      material, grainDirection: "length",
      visible: { length: innerW, width: E.topRailD, thickness: E.topRailH },
      origin: { x: wx((sideL1 + sideR0) / 2), y: E.topRailTopY - E.topRailH, z: wz(railCz) },
      tenons: [],
      mortises: m,
    });
  }

  // ── 木釘（Ø8×30 現成品；不入裁切／零件圖，只進 BOM）────────────────
  const dowels: Part[] = [];
  const dowel = (
    id: string, nameZh: string, nameEn: string, axis: "x" | "y" | "z",
    c: { x: number; y: number; z: number }, intoFar: number, farDir: 1 | -1,
  ): void => {
    const shift = (intoFar - E.dowelLen / 2) * farDir;
    const cc = {
      x: axis === "x" ? c.x + shift : c.x,
      y: axis === "y" ? c.y + shift : c.y,
      z: axis === "z" ? c.z + shift : c.z,
    };
    dowels.push({
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
    });
  };
  // A 天板↓側板 ×6（垂直；入天板面 12／入側板端 18）
  for (const sx of [0, 1] as const) for (const z of E.topDowelZ) {
    const cx = sx === 0 ? sideL1 - E.panelT / 2 : sideR0 + E.panelT / 2;
    dowel(`dowel-top-side-${sx}-${z}`, "木釘 Ø8×30（天板↔側板）", "Dowel Ø8×30 (top to side)", "y",
      { x: wx(cx), y: E.carcaseTopY, z: wz(z) }, E.dowelIntoFace, 1);
  }
  // B 天板↓背板 ×3
  {
    let x = legL1;
    for (const step of E.backDowelStep) {
      x += step;
      dowel(`dowel-top-back-${Math.round(x)}`, "木釘 Ø8×30（天板↔背板）", "Dowel Ø8×30 (top to back)", "y",
        { x: wx(x), y: E.carcaseTopY, z: wz(E.backSideDowelZ) }, E.dowelIntoFace, 1);
    }
  }
  // C 背板↔側板 ×4（沿 x；入側板面 12／入背板端 18）
  for (const sx of [0, 1] as const) for (const y of E.backSideDowelY) {
    const face = sx === 0 ? sideL1 : sideR0;
    dowel(`dowel-back-side-${sx}-${y}`, "木釘 Ø8×30（背板↔側板）", "Dowel Ø8×30 (back to side)", "x",
      { x: wx(face), y, z: wz(E.backSideDowelZ) }, E.dowelIntoEnd, sx === 0 ? 1 : -1);
  }
  // D 上橫檔↔側板 ×4（沿 x）
  for (const sx of [0, 1] as const) for (const zOff of E.topRailDowelZ) {
    const face = sx === 0 ? sideL1 : sideR0;
    dowel(`dowel-toprail-${sx}-${zOff}`, "木釘 Ø8×30（上橫檔↔側板）", "Dowel Ø8×30 (top rail to side)", "x",
      { x: wx(face), y: E.topRailTopY - E.topRailH / 2, z: wz(E.topRailZ0 + zOff) }, E.dowelIntoEnd, sx === 0 ? 1 : -1);
  }

  // ── 抽屜（前角半隱鳩尾、後角木釘）──────────────────────────────────
  const drawerFrontBottomY = drawerFrontTopY - E.drawerFrontH;      // 220
  const drawerSideBotY = drawerSideTopY - E.drawerSideH;            // 245
  const bottomTopY = drawerSideTopY - E.bottomBelowSideTop;         // 260
  const drawerBackTopY = drawerSideTopY - E.drawerBackBelowSide;    // 342
  const drawerSideZ0 = drawerFrontZ1 - E.dovetailPinDepth;          // 9（鳩尾榫頭伸進前板）
  const drawerSideCz = (drawerSideZ0 + drawerBackZ1) / 2;           // 181
  const bottomZ0 = drawerFrontZ1 - E.grooveD;                       // 14
  const bottomW = E.drawerW - 2 * (E.drawerSideT - E.grooveD);      // 368
  if (withDrawer) {
    const dz = -pull;
    // 前板：384×130×18，兩端半隱鳩尾（榫孔 12 深 ＝ 18 的 2/3）
    parts.push({
      id: "drawer-1-front",
      nameZh: "抽屜前板",
      nameEn: "Drawer front",
      material, grainDirection: "length",
      visible: { length: E.drawerW, width: E.drawerFrontH, thickness: E.drawerFrontT },
      origin: { x: wx((drawerX0 + drawerX1) / 2), y: drawerFrontBottomY, z: wz(E.drawerFrontZ0 + E.drawerFrontT / 2 + dz) },
      // rotation {x:π/2}：local x→世界 x、local y(厚)→世界 z（y＝ly 是**背面**）、local z(寬)→世界 −y
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [
        {
          origin: { x: 0, y: E.drawerFrontT, z: -((bottomTopY - E.bottomT / 2) - (drawerFrontBottomY + E.drawerFrontH / 2)) },
          depth: E.grooveD, length: bottomW, width: E.bottomT, through: false,
          label: isEn ? "drawer bottom groove" : "抽屜底板槽（4 寬 × 7 深）", cosmetic: true,
        },
        {
          // 手掛槽：底緣背側 140 寬 × 12 深 × 6 高（B-B 的 70 是半寬、C-C 的 6 是留厚）
          origin: { x: 0, y: E.drawerFrontT, z: E.drawerFrontH / 2 - E.pullH / 2 },
          depth: E.pullD, length: E.pullW, width: E.pullH, through: false,
          label: isEn ? "finger pull recess 140x12x6" : "手掛槽（140 寬 × 12 深 × 6 高）", cosmetic: true,
        },
      ],
    });
    // 側板 ×2：15 厚 × 102 高，前端半隱鳩尾（ends:"plus" ＝ 只有 local +x 端＝**前端**做）
    for (const [i, cx] of [drawerX0 + E.drawerSideT / 2, drawerX1 - E.drawerSideT / 2].entries()) {
      const innerY = i === 0 ? E.drawerSideT : 0;
      parts.push({
        id: i === 0 ? "drawer-1-side-left" : "drawer-1-side-right",
        nameZh: `抽屜側板（${i === 0 ? "左" : "右"}）`,
        nameEn: `Drawer side (${i === 0 ? "left" : "right"})`,
        material, grainDirection: "length",
        visible: { length: drawerBackZ1 - drawerSideZ0, width: E.drawerSideH, thickness: E.drawerSideT },
        origin: { x: wx(cx), y: drawerSideBotY, z: wz(drawerSideCz + dz) },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        shape: {
          kind: "dovetail-ends", segmentCount: E.dovetailSegments, phase: 0,
          angleDeg: E.dovetailAngleDeg, pinDepth: E.dovetailPinDepth, halfPin: true, ends: "plus",
        },
        tenons: [],
        mortises: [
          {
            /**
             * 外面的滑軌槽（15 高 × 7 深）。
             * ⭐ 前端**從肩線 Z21 起**（＝鳩尾榫深 12 的根部），不可以像底板槽那樣開到底：
             *    槽落在距側板底 47~62，正好剖過中間那支鳩尾齒（40.8~61.2）——
             *    開到 Z9 會讓 20.4 高的榫頭有 14.2mm 只剩 8mm 厚。
             *    幾何上也不需要：滑軌木條前端就在 Z21，而抽屜的擋塊是上橫檔不是滑軌。
             * （相對地**底板槽開到底是對的**：它落在最底那支齒裡、端口被榫頭蓋住，是標準做法。）
             */
            origin: {
              x: -((drawerFrontZ1 + drawerBackZ1) / 2 - drawerSideCz),
              y: i === 0 ? 0 : E.drawerSideT,
              z: -((runnerTopY - E.slotH / 2) - (drawerSideBotY + E.drawerSideH / 2)),
            },
            depth: E.slotD, length: drawerBackZ1 - drawerFrontZ1, width: E.slotH, through: false,
            label: isEn ? "runner slot 15x7" : "滑軌槽（15 高 × 7 深）", cosmetic: true,
          },
          {   // 內面的底板槽（4 寬 × 7 深）
            origin: { x: 0, y: innerY, z: -((bottomTopY - E.bottomT / 2) - (drawerSideBotY + E.drawerSideH / 2)) },
            depth: E.grooveD, length: drawerBackZ1 - drawerSideZ0, width: E.bottomT, through: false,
            label: isEn ? "drawer bottom groove" : "抽屜底板槽（4 寬 × 7 深）", cosmetic: true,
          },
          // 後板木釘孔 ×2（沿 x，開在內面；入側板 12）
          ...E.drawerBackDowelBelowBackTop.map((dTop): Mortise => ({
            origin: {
              x: -((drawerBackZ0 + drawerBackZ1) / 2 - drawerSideCz),
              y: innerY,
              z: -((drawerBackTopY - dTop) - (drawerSideBotY + E.drawerSideH / 2)),
            },
            depth: E.dowelIntoFace, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
            label: isEn ? "Ø8 dowel, drawer back" : "Ø8 木釘（抽屜後板）",
          })),
        ],
      });
    }
    // 後板：354×82×15，坐在合板上
    parts.push({
      id: "drawer-1-back",
      nameZh: "抽屜後板",
      nameEn: "Drawer back",
      material, grainDirection: "length",
      visible: { length: E.drawerW - 2 * E.drawerSideT, width: E.drawerBackH, thickness: E.drawerBackT },
      origin: { x: wx((drawerX0 + drawerX1) / 2), y: drawerBackTopY - E.drawerBackH, z: wz(drawerBackZ0 + E.drawerBackT / 2 + dz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [-1, 1].flatMap((ex) => E.drawerBackDowelBelowBackTop.map((dTop): Mortise => ({
        origin: {
          x: ex * (E.drawerW - 2 * E.drawerSideT) / 2,
          y: E.drawerBackT / 2,
          z: -((drawerBackTopY - dTop) - (drawerBackTopY - E.drawerBackH / 2)),
        },
        depth: E.dowelIntoEnd, length: E.dowelDia, width: E.dowelDia, through: false, shape: "round",
        label: isEn ? "Ø8 dowel, drawer side" : "Ø8 木釘（抽屜側板）",
      }))),
    });
    // 底板：4mm 合板 368×339，入三面 7 深槽、後端以 Ø2.4×15 鎖進後板
    {
      const screwX: number[] = [];
      let x = drawerX0 + E.drawerSideT;
      for (const step of E.screwBottomStep) { x += step; screwX.push(x); }
      parts.push({
        id: "drawer-1-bottom",
        nameZh: "抽屜底板（合板）",
        nameEn: "Drawer bottom (plywood)",
        material, materialOverride: "plywood",
        grainDirection: "length",
        visible: { length: bottomW, width: drawerBackZ1 - bottomZ0, thickness: E.bottomT },
        origin: {
          x: wx((drawerX0 + drawerX1) / 2),
          y: bottomTopY - E.bottomT,
          z: wz((bottomZ0 + drawerBackZ1) / 2 + dz),
        },
        tenons: [],
        mortises: screwX.map((px): Mortise => ({
          origin: {
            x: px - (drawerX0 + drawerX1) / 2,
            y: 0,
            z: (drawerBackZ0 + E.drawerBackT / 2) - (bottomZ0 + drawerBackZ1) / 2,
          },
          depth: E.bottomT, length: E.screwDiaBottom, width: E.screwDiaBottom, through: true, shape: "round", cosmetic: true,
          label: isEn ? "pilot hole, Ø2.4×15 to drawer back" : "Ø2.4×15 導引孔（鎖抽屜後板）",
        })),
      });
    }
    // E 抽屜後板↔側板 ×4（沿 x；入抽屜側板面 12／入後板端 18）
    for (const i of [0, 1] as const) {
      const innerX = i === 0 ? drawerX0 + E.drawerSideT : drawerX1 - E.drawerSideT;
      for (const dTop of E.drawerBackDowelBelowBackTop) {
        dowel(`dowel-drawer-back-${i}-${dTop}`, "木釘 Ø8×30（抽屜後板↔側板）", "Dowel Ø8×30 (drawer back to side)", "x",
          { x: wx(innerX), y: drawerBackTopY - dTop, z: wz((drawerBackZ0 + drawerBackZ1) / 2 + dz) },
          E.dowelIntoEnd, i === 0 ? 1 : -1);
      }
    }
  }
  parts.push(...dowels);

  /**
   * ⭐ 「天板↓側板」那 6 支 Ø8 木釘的孔，**本來就跨在木心板核心與封邊條的膠合線上**。
   *
   * 工作圖 A-A 左上角放大到 8× 量得清清楚楚：天板左端封邊（實木斜線剖面）在圖上 X 21~29，
   * Ø8 木釘在 X 26~34（正中落在側板 21~39 的中線 30）。真的做也是這樣：封邊先貼、再一起鑽孔。
   *
   * 幾何上無解，不是取捨：側板 18 厚、Ø8 孔要留得住只能落在 X 25~35；
   * 天板核心左緣在 X 29，孔要完全進核心得 X ≥ 33 —— 交集只剩 X 33~35，
   * 那樣側板內側只剩 2mm 壁厚，鑽下去一定爆邊。所以依須知第七條照圖放在 30。
   *
   * 穿模稽核只看方盒，看不懂「一個孔跨兩件」，所以在核心與封邊條各補一個
   * **cosmetic 方槽**，把這個孔在各自料件上實際挖掉的那一塊標出來
   * （零件圖上會看到方框套著圓孔＝「這個孔就在料邊上、會咬到封邊條」）。
   * 圓孔本身仍然保留：`auditJoints` 是靠兩件的同徑圓孔配成一組木釘接的。
   */
  {
    const topCore = parts.find((p) => p.id === "top-core");
    // 標籤要把施工順序寫進去：封邊條那張加工圖是因為這個孔才生出來的，
    // 不寫清楚會被誤會成「封邊條要單獨挖一個方槽」。
    const pullLabel = isEn
      ? "Ø8 dowel hole — bore after the edging is glued on"
      : "Ø8 木釘孔（跨核心與封邊條，封邊貼合後才一起鑽）";
    for (const sx of [0, 1] as const) {
      const edge = parts.find((p) => p.id === (sx === 0 ? "top-edge-left" : "top-edge-right"));
      const cx = sx === 0 ? sideL1 - E.panelT / 2 : sideR0 + E.panelT / 2;
      for (const z of E.topDowelZ) {
        topCore?.mortises.push({
          origin: { x: cx - topCoreCx, y: 0, z: wz(z) },
          depth: E.dowelIntoFace, length: E.dowelDia, width: E.dowelDia, through: false, cosmetic: true,
          label: pullLabel,
        });
        edge?.mortises.push({
          // 封邊條 8 寬，孔只咬到靠核心那 3mm；方槽取整條 8 寬是保守表示（實際是半月形）
          origin: { x: -wz(z), y: 0, z: 0 },
          depth: E.dowelIntoFace, length: E.dowelDia, width: E.panelEdge, through: false, cosmetic: true,
          label: pullLabel,
        });
      }
    }

    /**
     * 背板方向那 7 支木釘（天板↓背板 3、背板↔側板 4）同樣跨在膠合線上：
     * 孔心在背板 18 厚的正中央 Z371，而天板／側板的木心板核心後端在 Z372 —— 只差 1mm。
     * 一樣在核心與後端封邊條各補一塊方槽。
     */
    const backEdge = parts.find((p) => p.id === "top-edge-back");
    {
      let x = legL1;
      for (const step of E.backDowelStep) {
        x += step;
        topCore?.mortises.push({
          origin: { x: x - topCoreCx, y: 0, z: wz(E.backSideDowelZ) },
          depth: E.dowelIntoFace, length: E.dowelDia, width: E.dowelDia, through: false, cosmetic: true,
          label: pullLabel,
        });
        backEdge?.mortises.push({
          origin: { x: x - topCoreCx, y: 0, z: 0 },
          depth: E.dowelIntoFace, length: E.dowelDia, width: E.panelEdge, through: false, cosmetic: true,
          label: pullLabel,
        });
      }
    }
    for (const sx of [0, 1] as const) {
      const panel = parts.find((p) => p.id === (sx === 0 ? "side-panel-left" : "side-panel-right"));
      const sEdge = parts.find((p) => p.id === (sx === 0 ? "side-edge-left-back" : "side-edge-right-back"));
      const innerY = sx === 0 ? E.panelT : 0;
      for (const y of E.backSideDowelY) {
        panel?.mortises.push({
          origin: { x: -(E.backSideDowelZ - sideCz), y: innerY, z: -(y - sideCy) },
          depth: E.dowelIntoFace, length: E.dowelDia, width: E.dowelDia, through: false, cosmetic: true,
          label: pullLabel,
        });
        sEdge?.mortises.push({
          origin: { x: (sx === 0 ? 1 : -1) * E.panelT / 2, y: y - E.carcaseBottomY, z: 0 },
          depth: E.panelT, length: E.dowelDia, width: E.panelEdge, through: true, cosmetic: true,
          label: pullLabel,
        });
      }
    }
  }

  if (input.length !== W || input.width !== D || input.height !== H) {
    warnings.push(isEn
      ? `Exam piece is fixed at ${W}×${D}×${H} mm — the sliders do not apply to this template.`
      : `本題尺寸固定 ${W}×${D}×${H}mm：木釘列、抽屜、腳柱在腳座上的 145｜90｜145 全部是考題常數，跟著滑桿縮放一定穿模，所以滑桿對這款不作用。`);
  }
  if (pull !== pullRaw) warnings.push(isEn
    ? `Drawer pull clamped to ${pull} mm (0–250).`
    : `抽屜拉出量夾到 ${pull}mm（可用範圍 0~250；負值會讓抽屜往箱體裡倒退、撞到背板）。`);
  if (pull > 0) warnings.push(isEn
    ? `Drawer shown pulled out ${pull} mm (display only).`
    : `抽屜拉出 ${pull}mm 只是展示，尺寸不變。`);

  const design: FurnitureDesign = {
    id: `cert-b4-${W}x${D}x${H}`,
    category: "cert-b4",
    nameZh: "家具木工乙級 第四題（01200-100204）",
    overall: { length: E.outerW, width: D, thickness: H },
    parts,
    defaultJoinery: "through-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class B furniture-woodworking trade test, question 01200-100204 (7 hours). A 472×380×370 mm board-leg side table with one drawer — 483 mm across the feet, because the 32 mm foot rails stand 5.5 mm proud of the 21 mm legs on each side. This is the only one of the six questions with **board legs**: the marking sheet lists "leg 90×21, 4 points" (2 legs × 2 dimensions) where every other question lists 45×32 with 8 points (4 posts). A blockboard carcase (top, two sides, back) 380 deep × 150 high sits between the two legs; each leg drops a 10 mm tenon into a 45×32×380 foot rail whose top face is 20 mm shorter than its base, and a 60×21 middle rail with through tenons ties the legs together. The drawer is 384×350 with a half-blind dovetailed front (12 mm sockets = 2/3 of the 18 mm front, per the official study guide), a dowelled back, and a 140×12×6 finger-pull recess along the bottom back edge of the front board. 21 Ø8×30 dowels, 12 pilot holes for wood screws, three drawer-bottom grooves. **Drawn from published dimensions — download the official paper and follow that version on test day.**`
      : `依技術士技能檢定家具木工乙級術科試題 01200-100204（7 小時）公開尺寸繪製的練習範本。472×380×370 的板腳單抽邊桌（腳座著地處全寬 **483**）。

⭐ **六題唯一的板腳題**：評審表寫「腳柱寬、厚度 90×21，**4 部位**」＝ 2 支 × 2 個尺寸，其餘五題都是 45×32、8 部位（＝4 支方腳）。1:10 側視圖是明確的 T 字形。

零件：木心板天板 414×364×18 ＋四周 8 實木封邊 → 430×380；木心板側板 364×132×18（前後端各 8 封邊）與背板 394×132×18；**實木板腳 90×21 兩片**（Y 45~360，頂面比天板頂低 10）；**腳座 45×32×380 兩支**（頂面 360、兩端各斜切 10，腳柱以 10 厚榫插入，斷面 32＝11｜10｜11）；上橫檔 394×60×21 平放在箱體底、抽屜前板背後；**中橫檔 60×21 貫穿榫入板腳**（斷面 21＝5.5｜10｜5.5）；抽屜外 384×350、前板 130 高 18 厚與側板**半隱鳩尾**（榫深 12 ＝ 18 的 2/3，B-B 圖上有標），後板 354×82×15 以木釘接、4mm 合板底板入 7 深槽。

⭐ **抽屜前板底緣背面有一條 140 寬 × 12 深 × 6 高的手掛槽**——不裝任何拉手五金，手從下面伸進去勾。這是本題唯一的造型加工。

**木釘 21 支 Ø8×30**，入料一律「**入面 12／入端面 18**」（B-B 上段直接標的）：天板↓側板 6、天板↓背板 3、背板↔側板 4、上橫檔↔側板 4、抽屜後板↔側板 4。

**工時**：官方測驗時間 **7 小時**（應檢須知第十條）。工序表已依檢定現場調整——材料表註 2「木材部分須四面鉋光，並要求直角」⇒ 拿掉「平刨＋厚刨整平」、切料只算截長剖寬；**應檢不做塗裝**（⚠️ 這是推論不是條文：須知第六條只寫「成品可砂光，砂紙請自備」，但材料表沒有任何塗料、自備工具表沒有塗裝工具、評審表「表面處理」只評平滑／完整性／圓弧與倒角，三個佐證一致）。

**刀具**：自備工具只有 ø12 與 ø6 直刀 ＋ 8mm 木工鑽頭，但**須知第十二條「測試場地提供機具及設備，應檢人皆可使用」**，加上自備鑿刀 3~36mm 一組 ⇒ 4mm 底板槽（圓鋸機兩趟）、10mm 榫眼（角鑿機／鑿刀）都做得出來，**不需要為了遷就手提刀具改槽寬**。

⚠️ **注意兩個容易做錯的地方**：① **總寬 472 量的是腳柱外對外**，腳座 32 厚比腳柱 21 厚每側多 5.5，落地處其實是 **483**；② 上、中橫檔評審表只寫「2 部位」（照件數規則看起來像 1 件），但**工作圖上兩支都畫得出來**、總高鏈 370＝18｜132｜**60**｜115｜45 裡那個 60 就是中橫檔，依須知第七條「各部尺寸應以圖上所標示數字為準」做 2 支。

**本圖依公開尺寸自行繪製，不含官方圖檔；應檢請以技能檢定中心公布的官方版本為準。**
**官方未規定、本範本自訂**：鳩尾齒數（取 5 段）、腳柱下端榫插入腳座的深度（取 30，腳座 45 高留 15 底）、封邊四角接法、滑軌木條長度與螺釘的深度方向位置、木螺釘沿深度方向的排數、手掛槽內角圓弧。
**依官方學科參考資料定的**：鳩尾斜度 1:6（§01-19、§05-4）＝9.46°；半隱鳩尾榫深 12＝板厚 2/3（§05-10，圖上也標了）；Ø8 木釘配 18 木心板（§05-24）；抽屜後角用木釘＝面與端（§05-58）。`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};

/** 考題預設尺寸的完整設計（測試／探針用）。 */
export function certB4Assembly(): FurnitureDesign {
  const options: Record<string, string | number | boolean> = {};
  for (const s of certB4Options) options[s.key] = s.defaultValue;
  return certB4({ length: EXAM.W, width: EXAM.D, height: EXAM.H, material: "pine", options });
}
