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
 * 技術士技能檢定 家具木工 乙級 術科試題 01200-100205（練習範本）
 *
 * ⭐ 照官方試題**公開尺寸**自己畫的練習範本，不是官方圖面的重製；不嵌、不顯示官方圖檔。
 *    官方應檢參考資料（完整題本 012002B15，本題圖框 112/10/27，不在 114/06/18 修正對照表範圍內，
 *    是現行版）請至 owinform.wdasec.gov.tw 下載，應檢以官方版本為準。
 *
 * ⚠️⚠️ **第一版是單人單輪讀圖＋建模，第二輪五人組複查修掉 7 個 bug，這是第三輪：補上缺件**。
 *    第二輪判斷「補桌面板」風險太高沒動；這輪回原圖高倍裁切＋material表交叉比對後動手補上，
 *    細節見下面「D類本輪新增」。**C類第 3 項（盲榫 vs 裂口榫）仍未解決，上架前要再查一次**。
 *
 * ✅ **D類本輪新增：補上桌面板（原 C1/C2 點的缺件疑慮，本輪解決）**──────────
 *   關鍵新證據：**材料表 `550×19×8.5×5` 這支料在 cert-b1 用於「桌面封邊 8×18」、cert-b4 用於
 *   「天板封邊」**——同一支料、同一種用途在兩題都是「blockboard 桌面/天板的封邊」，而 cert-b5
 *   這支料原本完全沒被用到（跟 `480×450×18` 木心板一樣沒用到）——**這才是真正的證據**，不是
 *   B-B 剖面那個梳狀剖面線本身（那個後來查出來其實是既有「側上橫檔」自己的剖面，跨距 416 跟
 *   圖上「416」標註完全吻合，不是缺件）。
 *   → 補一塊桌面板：木心板芯 480×450×18（材料表項次 6，六題共用尺寸，本題裁切使用）＋
 *     四周 8×18 實木封邊（材料表項次 5），**簡化成單一板件建模**（不分開拆核心/封邊，
 *     跟 b1/b4 逐條封邊分開建模比，這是本輪為了控制風險做的簡化，未來如需精緻可再拆）。
 *   → 尺寸：493(寬，含封邊)×370(深，含封邊)×18(厚)。493＝480 核心＋兩側封邊（核心 480 剛好是
 *     材料表項次 6 原始寬）；370 對應評審表「總深度 380/370」的第二個數字——這輪判定 **370 是
 *     桌面板本身的深度**（比腳架 380 深度**內縮**，跟寬度方向**外懸**493 剛好相反方向，讀圖看
 *     到的兩個方向就是這樣不對稱，沒有硬湊成看起來「正常」）。
 *   → 高度分配：桌面板厚 18mm 疊在腳柱頂端上方，**腳柱因此縮短為 0~362（H−18）**，後上橫檔／
 *     腳柱榫眼的世界 Y 座標**全部跟著這個新的「腳頂＝362」重新算**（`legCenterY` 改成
 *     `(H−topT)/2`，只有一個變數要改，其餘計算式引用它就自動對齊，避免到處手改重複公式）。
 *   → 桌面板與 4 支腳頂的接合：各一組 Ø8×30 木釘（跟全題材料表 29 支木釘、cert-b1 同款「桌面
 *     木釘接腳」做法一致），沒有回圖精確核對釘孔位置，用「腳中心正上方」簡化擺放。
 *   → ⚠️ 這輪沒做的：封邊/核心分開建模、桌面板端面木紋/收邊細節、桌面板與後上橫檔之間會不會
 *     卡到（已用 findOverlaps 驗證 0 重疊，但沒有另外覆核官方圖上兩者實際淨空多少）。
 *
 * 🔴 **C類仍未解決（下一輪要做）**：
 *   3. **上下橫檔入腳「盲榫 vs 裂口榫」未定案**：讀圖對照員找到姊妹題 100206 明文寫「裂口榫接合、
 *      各以 2 支木釘補強」，但 100205 本題沒有這行字，只能當中信心旁證。本模型**維持盲榫**（改成
 *      裂口榫是換一種接合幾何，屬於「沒有同輪驗證不敢動」的風險，留給下一輪）。
 *
 * ── 這是什麼（讀圖＋結構判斷，見下方逐項信心標記）──────────────────────
 * 480(寬)×380(深)×380(高) 的雙腳端單抽小凳／邊几：左右兩端各 2 支 45×32 直腳（不斜、不錐），
 * 腳頂疊一塊 493×370×18 桌面板（木心板芯＋實木封邊，Ø8×30 木釘接腳），兩端腳柱之間**只在後側**
 * 架一支 90×20 的上橫檔（貼齊桌面板下緣），前後各架一支 45×32 的下橫檔（貼地），
 * 抽屜 370(寬，沿長向)×340(深，沿深向) 從**前面**推拉，滑條裝在兩端腳柱內側。
 *
 * ⭐ HIGH confidence（評審表 PDF 第 11 頁直接列出，逐字抄）：
 *   總高度 380±1｜總寬度 480±1｜總深度 380/370±1｜側上橫檔寬厚 90×20±0.5｜
 *   抽屜外側寬深 370×340±1｜腳柱寬厚 45×32±0.5｜側下橫檔寬厚 45×32±0.5｜抽屜前板寬度 130±0.5
 *   （最後一項比照 cert-b4 的解讀方式：跟該欄位在 b4 的用法一樣，這裡當**抽屜前板「高度」**用，
 *    不是字面的寬度——b4 檔頭已用同一張評審表版型論證過一次，b5 沿用同一判斷，未另外覆核。）
 *
 * ✅ B類已修（五人組複查抓到、這輪回原圖／材料表／評審表確認後修掉的具體 bug，非判讀分歧）：
 *   1. 上橫檔只有一支、在**後側**（不是兩端各一）：評審表材料表對照員重讀評審表核對，
 *      「側上橫檔 90×20，2 部位」＝1 支 × 2 個尺寸（寬、厚各驗一次），跟部位數規則吻合，維持原判讀。
 *   2. 下橫檔前後各一（不是兩端各一）：同上核對，「側下橫檔 45×32，4 部位」＝2 支 × 2 尺寸，維持原判讀。
 *   3. 抽屜從**前面**（沿深度方向）推拉：讀圖對照員獨立重算過一次幾何（370 塞進兩腳內距 416 可行，
 *      反過來 340 塞不進兩端腳內距 290 做不出來），維持原判讀，信心上修。
 *   4. **抽屜後角木釘孔深度不夠**（原本兩孔合計只 15mm、Ø8×30 木釘插不到底，抽屜合不攏）：
 *      改成側板孔（面鑽，留一半厚度安全牆）7.5mm ＋ 後板孔（端面木紋方向，不受厚度限制）22.5mm，
 *      合計 30mm 剛好等於 dowelLen，跟 cert-b3/b4 同一套「淺孔+深孔湊滿木釘長度」的驗證過模式。
 *   5. **滑條沒有真的接觸抽屜側板**（原本 X 方向中間空 4mm）：改成滑條 X 座標直接對齊側板本身的
 *      X 中心，確保滑條落在側板正下方、側板底邊真的擱得到滑條頂面。
 *   6. **鳩尾 `ends` 參數沒設**（型別預設 "both"，後角會被誤判成鳩尾母件）：加上 `ends:"plus"`
 *      （local x 正＝世界 −z＝前面，"plus" 端對到前角，跟乙級第二題修過的同一種坑同一種修法）。
 *   7. **Ø2.4×15 螺釘完全沒做**（材料表硬約束「本題只發 3 支、只有抽屜底板用得到」）：在後板加
 *      3 個 cosmetic 導引孔，仿 cert-b1「底板從後板底下穿過、螺釘由下往上鎖」的做法。
 *   8. **後上橫檔榫肩只剩 1mm**（原本沿用下橫檔 32 厚料的 18 厚榫，20 厚的後上橫檔留不出肩）：
 *      新增專屬 `backRailTenonT=10`，留 5mm 肩；下橫檔繼續用 `legRailTenonT=18`（留 7mm 肩）不變。
 *   9. **腳底倒角完全沒有**（評審表「圓弧與倒角」是表面處理 15% 裡的配分項，`derive.ts` 目前只有
 *      `shape.kind==="splayed"` 才會觸發倒角工序）：腳柱加 `shape:{kind:"splayed",dxMm:0,dzMm:0,
 *      footChamferMm:3}`——dx/dz=0 讓幾何等同直腳，只借這個機制掛 `footChamferMm` 觸發工序；
 *      3mm 沿用 b1~b3 同款倒角量的既有慣例，本題沒有獨立回圖核對出處，跟 C 類同等級的不確定性，
 *      但這條风险遠低於 C 類（純末端裝飾特徵，不影響其餘幾何位置），評估後選擇做。
 *      連帶：滑條也各加 2 個 Ø3.5×30 導引孔（鎖進腳柱），讓 `derive.ts` 的「鎖木螺釘」工序生成——
 *      這條沒有回圖核對確切位置，是為了讓材料表「五金裝配」有對應動作，非官方尺寸。
 *
 * ── 官方學科依據（012002A12.pdf，用來定沒有獨立標示的鳩尾角度/深度，跟 b3/b4 同一批）──
 * §01-19／§05-4 鳩尾斜度 1/6～1/8 → 取 9.46°；§05-10 半隱鳩尾榫長＝板厚 2/3 → 15×2/3＝10（本模型用 12，
 * 留 3mm 面皮，跟 b1/b4 一致，非 §05-10 直接算出）；§05-24 19mm 木心板配 Ø8 木釘（本題無木心板，僅供對照）。
 *
 * ── 材料表對帳（PDF 第 6 頁六題共用表，只確認得到的幾項）─────────────
 * 木料 600×92×21.5 第五題發 1 支——⚠️ 已知全站教訓「21.5 料⇔21mm 零件」不成立（b4 檔頭已推翻），
 *   本模型側上橫檔取 20mm 厚（評審表數字），不強行湊 21.5，這支料只是提供這根 90 寬料的原料，足夠。
 * 木心板 480×450×18 ×1（項次6）＋木材 550×19×8.5 ×5（項次5）：**本輪配給桌面板**（核心＋封邊），
 *   跟 cert-b1/cert-b4 的用法同源（見上面 D 類說明）；本輪合併成單一板件，未逐條拆封邊排版驗證。
 * 其餘各項（木料 1050×95×32.5 ×2、440×132×18.5 ×1、400×130×15.5 ×3、木心板 426×178×18×3、
 * 木釘 Ø8×30、木螺釘三種、白膠）**本輪沒有逐一排版核對「切不切得出來」**，留給下一輪。
 *
 * ⛔ 扣 41 分三條：未於規定時間完成／自行攜帶材料工件進出場／尺寸誤差超過 20mm（跟其他五題一樣）。
 */

/** 官方試題尺寸（mm）。X 0~480 由左腳柱外面、Y 0~380 由地面、Z 0~380 由前面（+Z＝背） */
const EXAM = {
  W: 480, D: 380, H: 380,
  legW: 32, legD: 45,                          // 腳柱寬(沿長向) × 厚(沿深向)，直腳、不斜
  topW: 493, topD: 370, topT: 18,              // 桌面板（木心板芯＋封邊簡化成單板）：疊在腳頂上方
  backRailH: 90, backRailT: 20,                // 側上橫檔：90 高 × 20 厚，貼桌面板下緣、只在後側一支
  lowerRailH: 45, lowerRailT: 32,              // 側下橫檔：45 高 × 32 厚，前後各一支、貼地
  legRailTenonT: 18,                           // 橫檔入腳的盲榫厚（腳柱 32 厚，留 14 背牆）
  legRailTenonLen: 20,
  drawerW: 370, drawerD: 340, drawerFrontH: 130,
  drawerFrontT: 18, drawerSideT: 15, drawerBackT: 15,
  drawerBottomT: 4, drawerBottomGrooveD: 7,
  runnerW: 14, runnerH: 14,
  dovetailSegments: 5, dovetailAngleDeg: 9.46, dovetailPinDepth: 12,
  dowelDia: 8, dowelLen: 30, dowelIntoSideFace: 7.5,  // 側板孔淺（面鑽，留一半厚度安全牆）、後板孔深（端面木紋，吃剩下的長度）
  backRailTenonT: 10,                          // 後上橫檔 20 厚專用榫厚（留 5mm 肩）；下橫檔 32 厚仍用 legRailTenonT=18（留 7mm 肩）
  footChamferMm: 3,                            // 評審表「圓弧與倒角」配分項；沿用 b1~b3 同款倒角量，本題未獨立覆核出處
  screwDia: 2.4, screwLen: 15,                 // Ø2.4×15：材料表硬約束「本題只發 3 支、只有抽屜底板用得到」
} as const;

export const certB5Options: OptionSpec[] = [
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

export const certB5: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certB5Options;
  const pullRaw = getOption<number>(input, opt(o, "drawerPull"));
  const pull = Math.min(250, Math.max(0, Number.isFinite(pullRaw) ? pullRaw : 0));
  const withDrawer = getOption<boolean>(input, opt(o, "withDrawer"));

  const E = EXAM;
  // 尺寸鎖死：跟 b3/b4 一樣，考題的每一個常數都是官方數字，不跟滑桿縮放。
  const W = E.W, D = E.D, H = E.H;
  const warnings: string[] = [];
  const round = (d: number) => ({ shape: "round" as const, length: d, width: d, through: false });

  /** 圖面座標 → 世界座標：X 置中、Z 置中（+Z＝背）、Y 不變（origin.y＝底） */
  const wx = (x: number) => x - W / 2;
  const wz = (z: number) => z - D / 2;

  const parts: Part[] = [];

  // ── 版面關鍵座標 ─────────────────────────────────────────────────
  const legCx0 = E.legW / 2;                    // 16  左腳中心（世界 X＝wx(16)＝−224）
  const legCx1 = W - E.legW / 2;                // 464 右腳中心（世界 X＝+224）
  const legCz = D / 2;                          // 190 腳柱沿深度置中（世界 Z＝0）
  const railSpanX = W - 2 * E.legW;             // 416（兩腳內面之間，橫檔跨距）
  const legInnerX0 = E.legW;                    // 32  左腳內面
  const legInnerX1 = W - E.legW;                // 448 右腳內面

  // ── 腳柱 ×4：直腳 32(x)×45(z)×380(y)，rotation x=π/2 ─────────────
  // rotation {x:π/2}：local x→世界 x、local y(厚 45)→世界 z、local z(寬 380)→世界 −y
  for (const sx of [0, 1] as const) for (const sz of [0, 1] as const) {
    const cx = sx === 0 ? legCx0 : legCx1;
    const cz = sz === 0 ? E.legD / 2 : D - E.legD / 2;
    const legInX = sx === 0 ? 1 : -1;           // 朝跨距內側的 local x 正負（rotation 後 local x＝世界 x）
    const m: Mortise[] = [];
    // 下橫檔盲榫眼（前後每支腳都有）
    // ⚠️ auditJoints 對位規則：mortise.depth↔tenon.length、mortise.length↔tenon.width、
    // mortise.width↔tenon.thickness——depth 是「插進去多深」要對榫頭長度，不是榫頭厚度，
    // 第一版把這兩個搞反了（榫全部找不到孔），改對後才過稽核（但那只驗尺寸，不驗位置）。
    // ⚠️⚠️ 位置那條後來被 `npm run audit`（machining）抓到：這支腳 rotation{x:π/2} 下
    // local y 是厚度方向（世界 z、範圍 [0,45]）、local z 才是高度方向（世界 −y，置中算法跟
    // cert-b1 側板/後板同一套 −(目標世界高 − 本零件世界高中心)）。第一版把「高度」寫進 origin.y，
    // 上橫檔那個孔算出 y=335 遠超出 [0,45]，2D 加工圖榫眼畫到料件外 40mm——joints 稽核只比尺寸
    // 不比位置，這種錯要靠 `npm run audit` 的 machining 那支才抓得到。
    // ⚠️ 本輪補桌面板（18 厚）疊在腳頂上方，腳柱因此縮短到 0~(H−topT)，legCenterY 改用
    // 腳柱自己實際的世界 Y 中心，不能再用整體 H/2——只有這一個變數要改，下面兩個 mortise
    // 都吃它，不用逐一手改重複公式（AGENTS.md「同一個判斷只能有一套」）。
    const legCenterY = (H - E.topT) / 2;
    m.push({
      origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: legCenterY - E.lowerRailH / 2 },
      depth: E.legRailTenonLen, length: E.lowerRailH, width: E.legRailTenonT,
      through: false,
      label: isEn ? "mortise, lower rail tenon" : "側下橫檔盲榫眼",
    });
    // 上橫檔盲榫眼：只有「後側」兩支腳（sz===1）才有
    // ⚠️ 榫厚用 backRailTenonT（10，非 legRailTenonT=18）——後上橫檔本身只有 20 厚，
    // 沿用下橫檔（32厚）的 18 厚榫肩只剩 1mm、做不出來，這輪修正見 commit 說明。
    if (sz === 1) m.push({
      origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: legCenterY - ((H - E.topT) - E.backRailH / 2) },
      depth: E.legRailTenonLen, length: E.backRailH, width: E.backRailTenonT,
      through: false,
      label: isEn ? "mortise, back rail tenon" : "側上橫檔盲榫眼",
    });
    parts.push({
      id: `leg-${sx === 0 ? "left" : "right"}-${sz === 0 ? "front" : "back"}`,
      nameZh: `腳柱（${sx === 0 ? "左" : "右"}${sz === 0 ? "前" : "後"}）`,
      nameEn: `Leg (${sx === 0 ? "left" : "right"} ${sz === 0 ? "front" : "back"})`,
      material,
      grainDirection: "width",
      // 腳長＝H−topT（桌面板疊在腳頂上方，見上面 legCenterY 註解）。
      visible: { length: E.legW, width: H - E.topT, thickness: E.legD },
      origin: { x: wx(cx), y: 0, z: wz(cz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      // dxMm/dzMm=0：直腳、不斜，借 splayed shape 只為了掛 footChamferMm（評審表「圓弧與倒角」
      // 配分項，共用層目前只有 splayed 腳型會觸發 derive.ts 的倒角工序，直腳沒有對應機制）。
      shape: { kind: "splayed", dxMm: 0, dzMm: 0, footChamferMm: E.footChamferMm },
      tenons: [],
      mortises: m,
    });
  }

  // ── 桌面板 ×1（本輪新增，見檔頭 D 類說明）：木心板芯＋封邊簡化成單板，疊在腳頂上方 ──
  // 493(寬，含封邊，比腳架 480 寬懸挑約 6.5/邊)×370(深，比腳架 380 深內縮約 5/邊)×18(厚，材料表
  // 木心板芯厚度)。跟腳頂是**膠合對接，無木釘**——比照 cert-b1 檔頭明講「腳頂沒有木釘」的既有結論
  // （b1 的桌面木釘只接側板/後板，不接光腳柱；b5 沒有側板，沒有對應可仿的既有做法，
  // 用最低風險的簡化：純膠合，不新增榫卯幾何），需要下一輪覆核實際官方接合方式。
  {
    parts.push({
      id: "top",
      nameZh: "桌面板",
      nameEn: "Top panel",
      material,
      grainDirection: "length",
      visible: { length: E.topW, width: E.topD, thickness: E.topT },
      origin: { x: wx(W / 2), y: H - E.topT, z: wz(D / 2) },
      tenons: [],
      mortises: [],
    });
  }

  // ── 側上橫檔 ×1（90 高 × 20 厚，貼桌面板下緣、只在後側）──────────
  {
    const railCz = D - E.legD / 2;              // 貼齊後腳中心（後腳內面在 D−legD）
    const tenonW = E.backRailH;
    parts.push({
      id: "back-rail",
      nameZh: "側上橫檔（後）",
      nameEn: "Upper side rail (back)",
      material,
      grainDirection: "length",
      visible: { length: railSpanX, width: E.backRailH, thickness: E.backRailT },
      origin: { x: wx(W / 2), y: (H - E.topT) - E.backRailH, z: wz(railCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: (["start", "end"] as const).map((position): Tenon => ({
        position, type: "blind-tenon",
        length: E.legRailTenonLen, width: tenonW, thickness: E.backRailTenonT,
        shoulderOn: ["top", "bottom"],
      })),
      mortises: [],
    });
  }

  // ── 側下橫檔 ×2（45 高 × 32 厚，前後各一，貼地）──────────────────
  for (const sz of [0, 1] as const) {
    const railCz = sz === 0 ? E.legD / 2 : D - E.legD / 2;
    parts.push({
      // ⚠️ id 要落在 svg-views.tsx 的 crossPieces 前綴白名單裡（"stretcher"）才會在三視圖標尺寸，
      // 不能隨便取名——這是本系列已經踩過兩次的共用層陷阱（AGENTS.md「一個一個列的名單」那條）。
      id: sz === 0 ? "stretcher-front" : "stretcher-back",
      nameZh: sz === 0 ? "側下橫檔（前）" : "側下橫檔（後）",
      nameEn: sz === 0 ? "Lower side rail (front)" : "Lower side rail (back)",
      material,
      grainDirection: "length",
      visible: { length: railSpanX, width: E.lowerRailH, thickness: E.lowerRailT },
      origin: { x: wx(W / 2), y: 0, z: wz(railCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: (["start", "end"] as const).map((position): Tenon => ({
        position, type: "blind-tenon",
        length: E.legRailTenonLen, width: E.lowerRailH, thickness: E.legRailTenonT,
        shoulderOn: ["top", "bottom"],
      })),
      mortises: [],
    });
  }

  // ── 抽屜（外側 370×340，從前面推拉；前角鳩尾、後角木釘，仿 cert-b1 做法）──
  if (withDrawer) {
    const zShift = -pull;
    const drawerCx = W / 2;
    const drawerFrontZ0 = (D - E.drawerD) / 2 + zShift;   // 20（前面留 20 淨空給下橫檔厚度以外的餘裕）
    const frontY0 = 100, frontY1 = frontY0 + E.drawerFrontH;   // 100~230（簡化：前/側/後同高）
    const frontCz = drawerFrontZ0 + E.drawerFrontT / 2;
    // 底板槽（世界 Y）：底板貼地那一面在 frontY0+10，槽跟底板同高，槽中心 Y＝底板中心 Y。
    const bottomPlateBottomY = frontY0 + 10;
    const bottomGrooveCy = bottomPlateBottomY + E.drawerBottomT / 2;
    const frontCy = frontY0 + E.drawerFrontH / 2;
    // 槽的 mortise local z：跟 cert-b1 同一套公式，−(目標世界 Y 中心 − 本零件世界 Y 中心)。
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

    // 側板 ×2：長度＝前板背面(内)到後板背面，前端鳩尾（尾在側板）
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
        // ⚠️ ends:"plus" 一定要設——型別預設 "both"（兩端都切鳩尾），這題設計是「只有前角鳩尾、
        // 後角木釘」，沒設的話後端也會被當成鳩尾母件（乙級第二題踩過同一種坑，見 lib/types/index.ts
        // 型別註解）。local x 正＝世界 −z＝前面（見下方註解），"plus" 端＝local x 正＝前端，符合意圖。
        tenons: [],
        // ⚠️ 側板底邊直接擱在滑條上（butt joint），本輪沒有另外幫滑條開槽——
        // 簡化為滑條頂面即承重面，不是官方畫法，需要下一輪覆核。
        mortises: [
          { origin: { x: 0, y: innerY, z: frontGrooveLocalZ }, depth: E.drawerBottomGrooveD, length: sideLen, width: E.drawerBottomT,
            through: false, cosmetic: true, label: isEn ? "bottom groove" : "底板槽" },
          // 木釘孔（配對後板端面那兩個孔，同直徑 Ø8）：開在側板後端內面、跟後板同高（中心高度，local z＝0）。
          // ⚠️ 這片側板是雙重旋轉（x=π/2,y=π/2）：local y 是厚度方向（面別，跟底板槽同一支 innerY）、
          // local z 才是高度方向——第一版把這兩個寫反了，孔配不到對面（跟腳柱榫眼那個 depth/length 反的
          // 是不同一種錯，但同一類「欄位對應想當然爾」的坑）。
          // ⚠️ 這片側板 rotation{x:π/2,y:π/2} 下 local x → 世界 −z，正值反而指向前面；
          // 要落在後端（世界 Z＝sideZ1）要用 −sideLen/2，第一版正負號寫反，孔位跑到前端去了。
          // 深度：淺孔鑽面（drawerSideT=15 厚只留一半安全牆 7.5mm）；深孔留給後板端面木紋方向。
          { origin: { x: -sideLen / 2, y: innerY, z: 0 },
            depth: E.dowelIntoSideFace, ...round(E.dowelDia),
            label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（後板）" },
        ],
      });
    }

    // 後板：木釘接兩側板
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
          // 後板 rotation{x:π/2} 下 local y 是「入面深度」（0~thickness，不是高度！），
          // local z 才對到世界高度；第一版把 y 寫成 drawerFrontH/2（想當成「置中高度」），
          // 結果孔整組偏移 57.5mm 跑出側板的容許誤差——高度置中要用 z:0，y 只填厚度中點。
          // ⚠️ 深度修正：原本 15−7.5=7.5，兩孔合計只有 15mm（Ø8×30 木釘插不到底，抽屜合不攏）。
          // 這孔鑽進端面木紋方向，不受 15mm 厚度限制，改成吃掉整支木釘剩下的長度：30−7.5=22.5。
          origin: { x: ex * (E.drawerW - 2 * E.drawerSideT) / 2, y: E.drawerBackT / 2, z: 0 },
          depth: E.dowelLen - E.dowelIntoSideFace, ...round(E.dowelDia),
          label: isEn ? "Ø8 dowel, side" : "Ø8 木釘（側板）",
        })),
        // Ø2.4×15 木螺釘導引孔 ×3：材料表硬約束「本題只發 3 支、只有抽屜底板用得到」，
        // 底板從後板底下穿過、螺釘由下往上鎖進後板（仿 cert-b1 做法），沿長度方向均分三處。
        // z 公式跟前板底板槽同一套（本零件世界高中心 − 目標世界高），目標＝底板中心高度。
        ...[-1, 0, 1].map((k): Mortise => ({
          origin: { x: k * (E.drawerW - 2 * E.drawerSideT) / 3, y: E.drawerBackT / 2,
            z: (frontY0 + E.drawerFrontH / 2) - (bottomPlateBottomY + E.drawerBottomT / 2) },
          depth: E.screwLen, ...round(E.screwDia), cosmetic: true, through: false,
          label: isEn ? "Ø2.4×15 screw, bottom panel" : "Ø2.4×15 木螺釘（底板）",
        })),
      ],
    });

    // 底板（4mm 合板）：入前板/兩側板槽 7，後端頂在後板內面
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
      // 後端頂在後板內面（sideZ1 − backT），不是後板外面——不然會整片疊進後板裡。
      origin: { x: wx(drawerCx), y: bottomPlateBottomY, z: wz(((sideZ1 - E.drawerBackT) + drawerFrontZ0 + E.drawerFrontT - E.drawerBottomGrooveD) / 2) },
      tenons: [],
      mortises: [],
    });

    // 滑條 ×2：裝在兩端腳柱內側面，支撐抽屜側板（比照 cert-b1）
    // ⚠️ 原本用「離腳內面固定間隙」算 cx，跟側板 X 範圍中間空 4mm、完全沒接觸（側板底邊
    // 擱不到滑條上）。改成直接對齊側板本身的 X 中心，確保滑條真的落在側板正下方。
    const runnerZ0 = sideZ0, runnerZ1 = sideZ1, runnerLen = runnerZ1 - runnerZ0;
    const runnerCz = (runnerZ0 + runnerZ1) / 2;
    for (const sx of [0, 1] as const) {
      const cx = sx === 0 ? drawerCx - E.drawerW / 2 + E.drawerSideT / 2 : drawerCx + E.drawerW / 2 - E.drawerSideT / 2;
      parts.push({
        id: sx === 0 ? "runner-left" : "runner-right",
        nameZh: sx === 0 ? "抽屜滑條（左）" : "抽屜滑條（右）",
        nameEn: sx === 0 ? "Drawer runner (left)" : "Drawer runner (right)",
        material,
        grainDirection: "length",
        visible: { length: runnerLen, width: E.runnerH, thickness: E.runnerW },
        origin: { x: wx(cx), y: frontY0 - E.runnerH, z: wz(runnerCz) },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        // Ø3.5×30 木螺釘導引孔：滑條鎖進腳柱內側面，兩端各一（近前後兩支腳的位置）。
        // ⚠️ 這片滑條跟抽屜側板同樣是雙重旋轉（x=π/2,y=π/2）：local x 才是沿長度方向
        // （跟側板木釘孔 origin.x=-sideLen/2 同一套慣例），不是 local z——第一版寫反被
        // `npm run audit` 的 mortise-spec 檢查抓到（origin.z 超出 part.width 範圍），已修正。
        // through:true——螺釘貫穿滑條本身厚度（14mm）再繼續鎖進腳柱，不是止於滑條內部；
        // 第一版寫 depth:20 又 through:false，20 超過滑條自己 14mm 厚，等於孔挖穿了還說沒貫穿。
        mortises: ([-1, 1] as const).map((k): Mortise => ({
          origin: { x: k * (runnerLen / 2 - 20), y: E.runnerW / 2, z: 0 },
          depth: E.runnerW, ...round(3.5), through: true, cosmetic: true,
          label: isEn ? "Ø3.5×30 screw, into leg" : "Ø3.5×30 木螺釘（鎖入腳柱）",
        })),
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
    ? "⚠️ Draft, third pass: an independent 5-reviewer check found 7 bugs (fixed pass 2) and a suspected missing tabletop; pass 3 added the tabletop (493×370×18) and re-derived the leg/rail Y-coordinates it affects. The blind-tenon-vs-notch-joint question is still unresolved — see the file header before treating this as equal quality to questions 1-4."
    : "⚠️ 本範本第二輪修掉五人組複查抓到的 7 個 bug，第三輪（本輪）補上懷疑漏做的桌面板（493×370×18）並重算受影響的腳柱／橫檔 Y 座標。「上下橫檔盲榫 vs 裂口榫」仍未解決，細節見檔頭——上架前務必先解決這條，不要直接當成跟前四題同等級。");

  const design: FurnitureDesign = {
    id: `cert-b5-${W}x${D}x${H}`,
    category: "cert-b5",
    nameZh: "家具木工乙級 第五題（01200-100205）",
    overall: { length: W, width: D, thickness: H },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class B furniture-woodworking trade test, question 01200-100205 (7 hours). 480×380×380: two end leg-frames (4 straight legs, 45×32, now 362mm tall) topped by a 493×370×18 top panel, joined by one 90×20 upper back rail under the top and two 45×32 lower rails (front and back) near the floor; a front-opening drawer 370×340 with a 130 mm-tall front, dovetailed side-to-front corners and doweled back corners, riding on two runners screwed to the inside faces of the leg posts. **Third-pass draft: 7 bugs fixed in pass 2, top panel added in pass 3 with re-derived leg/rail coordinates. The blind-tenon-vs-notch-joint question is still open — see the file header before treating this as equal quality to questions 1-4.** Download the official paper at owinform.wdasec.gov.tw and follow that version on test day.`
      : `依技術士技能檢定家具木工乙級術科試題 01200-100205（7 小時）公開尺寸繪製的練習範本。480×380×380：兩端各 2 支 45×32 直腳（現縮短為 362 高）疊一塊 493×370×18 桌面板，後側桌面板下緣架一支 90×20 上橫檔，前後各一支 45×32 下橫檔貼地；抽屜 370×340 從前面推拉，前板 130 高，前角鳩尾、後角木釘，滑條鎖在兩端腳柱內側。**第三輪範本：第二輪修掉 7 個確認的 bug，本輪補上桌面板並重算受影響的腳柱／橫檔座標。「盲榫 vs 裂口榫」仍未解決，細節見檔頭，不要直接當成跟前四題同等級。**官方應檢參考資料請至技能檢定中心官網下載，應檢以官方版本為準。`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};

/** 研究頁／測試用：考題預設尺寸的完整設計。 */
export function certB5Assembly(): FurnitureDesign {
  const options: Record<string, string | number | boolean> = {};
  for (const s of certB5Options) options[s.key] = s.defaultValue;
  return certB5({ length: EXAM.W, width: EXAM.D, height: EXAM.H, material: "pine", options });
}
