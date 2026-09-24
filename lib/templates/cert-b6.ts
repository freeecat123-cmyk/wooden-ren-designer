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
// 家具木工乙級 第六題（01200-100206）—— 第二輪
// ============================================================================
//
// 來源：docs/research/furniture-class-b/sources/012002B15-practical-v114.pdf
// （向量版）page 20（工作圖）、page 12（評審表）、page 6（材料表，六題共用同一張）。
//
// 判讀方式跟 cert-b5 一樣：`pdftoppm -r 600` 高解析輸出 + `magick -crop` 局部放大，
// 逐區讀官方向量圖，不是憑印象。以下記錄目前判讀到、跟 cert-b5 不一樣的
// 結構重點，跟每個數字的信心等級——**比照 cert-b5 慣例，之後應該還要走多輪複查
// 才能收斂**，不是宣稱百分之百正確。
//
// 【第二輪修正（推翻第一輪部份判讀，見下方對應段落細節）】
// - 第一輪誤判「圖面右下角494/472、380/360＝腳柱側腳（splay）」。第二輪逐一重新
//   量測 B-B／兩組A-A／C-C／計畫圖（頁20全部剖視），沒有找到任何一條「整支腳柱
//   斜線」的畫法（所有腳柱輪廓線都是純水平/垂直，唯一的斜線是C-C裡跑道／橫檔端
//   的一個獨立45°倒角，跟腳柱斜率無關）——側腳理論證據不足，推翻。
// - 改用新判讀：A-A剖面左側同時標「370」跟「360」兩條垂直尺寸線，箭頭終點幾乎
//   重疊在同一條底線（=地面），但起點差10mm——即「腳柱從地面量起有兩個高度基準，
//   差10mm，且共用同一個地面起點」。這精確對應「腳柱頂端比橫檔頂面高10mm、露出
//   一截」，不是「兩個不同構件」也不是「桌面板」。這一截外露腳柱頂就是A-A剖面畫的
//   小方框+對角X記號（此圖面「X-in-box」記號＝木料斷面/木紋外露，在頁20另一張
//   俯視剖面圖裡、於橫檔正上方的腳柱斷面位置同樣出現同一符號，兩處互相印證同一
//   慣例）。已建進 3D：`EXAM.legTopExposedMm=10`，上/中橫檔頂面＝H−10=360，
//   腳柱本身仍貫穿全高370（腳柱料件不切短，只是橫檔往下退讓10mm）。低風險：
//   只改橫檔Y座標，沒有新增幾何、沒有動共用層。
// - 深度雙標「380/360」（評審表項次3「總深度」）**這輪仍未100%解開**：已排除
//   側腳（理由同上），也排除獨立桌面板（見下方「沒有獨立桌面板」段落，證據更強化
//   ——如果有桌面板蓋在橫檔上，橫檔頂面就不會是「腳柱外露頂端」了，兩者矛盾）。
//   目前最佳解釋（中信心，非100%）：380＝腳柱外側面到外側面的總深度（跟評審表
//   總深單值一致），360＝下部裂口榫/滑條組件本身在C-C剖面量到的實際長度基準——
//   C-C剖面直接畫出「腳柱斷面＋2孔木釘＋一段延伸料件，末端一個10mm倒角，整體
//   量到360」，跟494/472（寬度，評審表總寬只有單值494，沒有雙標）不對稱的原因，
//   可能是這個10mm量測基準差異只發生在深度方向的下部構件、沒有發生在寬度方向。
//   本輪沒有把這個猜測動進3D幾何（風險：猜錯會做出不存在的構件），留下一輪用
//   更多C-C剖面細節（腳柱斷面跟延伸料件之間的空白區到底是什麼、哪個部位真正
//   對應360）繼續查。
//
// 【高信心（評審表 / 圖面文字直接讀出）】
// - 總高 H=370、總寬 W=494、總深 D=380（評審表「部位」尺寸欄直接列）。
// - 腳柱寬厚 45×32（跟 cert-b5 數值相同，但軸向配置本題另外判讀，見下）。
// - 側下橫檔寬厚 45×32（評審表「尺寸」項次7＝部位數4＝2支×2尺寸，物理只有 2 支）。
// - 上、中橫檔寬厚 60×21（評審表「尺寸」項次4＝部位數4＝2支×2尺寸，物理只有 2 支——
//   上橫檔＋中橫檔各一支，尺寸相同）。**第四輪訂正**：前三輪頭尾都誤把兩者都標成
//   「部位4」（把「部位數＝4」跟「項次4」搞混）——直接讀 page 12 評審表確認實際項次
//   分別是 4（上中橫檔）跟 7（側下橫檔），純文字誤植，不影響任何已建的 3D 幾何。
// - 抽屜 384×350、前板 130 高（評審表直接列）。
// - 圖面文字明寫：「腳架上下裂口榫接合，各以2支木釘補強，結構如圖示」——腳柱跟橫檔
//   （上下都算）之間走「裂口榫」（開放式缺口榫，不是盲榫全包），每處接合另外補強 2 支木釘。
// - B-B 剖面量到抽屜前/側板厚度標註「18｜5｜15」——18＝前板厚、15＝側板厚，中間 5 是
//   鳩尾榫頭外露段，跟 cert-b5 的 18／15 完全一致。
// - 材料表：本題項次2（480×92×21.5 或近似料）發 **2支**（cert-b5 同一項只發 1 支）——
//   直接對應「上橫檔＋中橫檔」兩支疊放的結構，是本題跟 cert-b5 最大的差異來源。
// - 木釘 Ø8×30、抽屜底板螺釘 Ø2.4×15（材料表硬約束「只發 3 支」）跟六題共用，沿用。
// - 腳柱頂端外露 10mm（上／中橫檔頂面＝H−10=360，不是貼齊腳頂 370）：A-A剖面
//   左側「370」「360」兩條垂直尺寸線箭頭終點同一條地面基準線、起點差10mm，
//   直接量出來的，不是推論（見上方「第二輪修正」段落）。
//
// 【中信心（結構合理推論，未逐一像素核對）】
// - 「側下橫檔」的「側」字跟 cert-b5「側下橫檔」（前後各一）不同——這裡判讀成左右各一支
//   （沿深度方向），連接同一側的前腳跟後腳；上／中橫檔則跟 cert-b5 一樣只在後側（連接
//   左右後腳）。這個判讀主要依據：評審表兩者都只列「部位4＝2支」，跟物理支數吻合；
//   純數字本身沒辦法反推「前後」還是「左右」，是本輪的結構判斷，留待下一輪覆核。
// - 評審表沒有另外列「桌面板」尺寸項（跟 cert-b5 的桌面 493×370 是獨立評分項不同）——
//   判讀成本題**沒有獨立桌面板**，腳柱直接頂到頂（H=370 全高），上／中橫檔就是最頂端
//   結構。第二輪追加證據：A-A剖面「370/360」雙高標註已確認是「腳柱頂端外露10mm」
//   （見上方第二輪修正），這跟桌面板假說直接矛盾——如果上橫檔上面蓋了一塊桌面板，
//   腳柱頂端就不會是外露端面（會被桌面板蓋住/包住），A-A剖面也不會把「腳柱頂」
//   單獨標出一個跟橫檔頂面差10mm的高度。桌面板假說已排除，不是留白。材料表
//   項次6/7/8（木心板/合板）雖然照樣發料，但材料表附註3明寫這些是「以術科測試
//   辦理單位實際準備之材料為準」（六題共用、非本題專屬證據，跟 cert-b5 判讀材料表
//   的既有規則一致），不能拿來反推「本題也有桌面」——未使用材料留白，比照 cert-b5
//   同類判讀，不強湊解釋。
// - Ø3.5×30 cns1051 螺釘：A-A 剖面在腳柱上端（後腳、上橫檔區域）找到一個獨立標註，
//   位置跟裂口榫／木釘補強區很近，但圖面沒有明確畫出用途細節。判讀成「上橫檔／中橫檔
//   接合區的額外鎖固」，每支後腳×每支上層橫檔一支＝4 支，比照 cert-b5「盲榫+補強釘」
//   既有做法延伸。抽屜滑條螺釘沿用 cert-b5 驗證過的 Ø3×25／每邊2支。
// - 裂口榫（notch-tenon / open tenon）在型別系統裡沒有專屬 `JoineryType`——現有選項是
//   `"through-tenon"|"blind-tenon"|...`，都沒有「開放式缺口」這個語意。第二輪重新
//   檢查 `lib/types/index.ts` 全部 JoineryType 選項跟其他已上線範本，確認全站沒有
//   現成的 bridle/notch-joint 幾何可以借用。維持第一輪選擇：用 `"through-tenon"`——
//   跟「裂口榫」一樣是「外露／看得到榫頭」的開放式接合，語意上比盲榫（完全包覆）
//   更接近，且稽核（auditJoints）只比對尺寸配對不比對造形，選哪個都不影響稽核
//   通過與否。3D 幾何維持標準矩形榫頭／榫孔（沒有另外把「缺口」的開放造形建出來，
//   即沒有把腳柱在榫接處畫出真正的U形缺口斷面）——這是記錄在案、刻意不擴大範圍的
//   簡化：真正做出開放缺口造形需要新增一種 shape kind 並改 `svg-views.tsx`／
//   silhouette 投影邏輯，屬於共用層改造，風險（可能波及其他範本的三視圖渲染）
//   超出這輪能驗證的把握，留給下一輪專門處理。
//
// 【第三輪：獨立仲裁三方案理論衝突 + 抽屜滑條螺釘方向 bug 修正】
// - 第二輪同時留下三套彼此衝突的說法：①「缺一塊獨立桌面板」②「腳柱側腳
//   （splay）」③「腳柱頂端外露 10mm」（見上方第二輪修正段落）。派獨立仲裁 agent
//   用材料表用料反算＋評審表百分比配分加總兩種可證偽的算術方法覆核，結論：①②
//   都不成立（①跟評審表沒有獨立桌面板項矛盾、材料表用料反算不出額外一塊桌面板；
//   ②整份圖面找不到任何一條腳柱斜線，跟①②衝突的百分比配分只有③能配平），③
//   維持有效——現有 3D 幾何（`EXAM.legTopExposedMm=10`）不用改。
// - 評審表「外部接合」榫接密合部位數＝8（4 支腳×每支腳 1 個裂口榫上位＋1 個下位
//   算共用，實際可反推物理接合點），比對評審表配分要求的 9 個，缺 1 個未查出對應
//   實物——比照 cert-b5 最終 11/17 五金部位的收尾方式：查證已到極限，接受現況、
//   誠實記錄，不再往下猜湊。
// - ⭐用 mortiseLocalBox + partMachiningMatrix 直接算世界座標，抓到抽屜滑條
//   Ø3×25「鎖入腳柱」導引孔的方向 bug：左滑條原本從已經貼腳柱那一面鑽、方向卻朝
//   滑條自己內部鑽（25mm 完全搆不到腳柱），右滑條因為兩側鏡射巧合才對。已改成
//   依 sx 選「貼抽屜、人手伸得進去鎖螺絲」那一面當入榫面，兩側方向對稱、都朝腳柱
//   鑽。同時修正 origin.z 誤用 E.runnerH/2（Z 軸慣例置中，這個值其實是頂面邊緣，
//   孔會有一半凸出滑條外）→ 改 0（正中央）。cert-b5 同一段程式碼有一模一樣的
//   bug，已在 cert-b5 那邊用同一套方法獨立修好、獨立驗證。
// - Ø3.5×30 補強螺釘：重新核對 origin 公式（`legInX*E.legW/2, E.legD/2`），發現
//   它直接複用「已驗證通過」的橫檔裂口榫榫眼同一個入面／同一根深度軸——這是對的
//   用法（補強螺釘沿榫頭同一軸貫穿裂口榫深度、咬進榫頭後方實木，是常見工法），
//   不是誤用；沒有 bug，維持原樣。
// - 圓弧與倒角（評審表佔 5%）：重新用 `pdftoppm -r 300` 對頁 20 C-C 剖面局部
//   放大複查，這次找到清楚、精確量到的倒角證據——C-C 剖面畫的深度方向下部構件
//   （左端跟腳柱 A-A 斷面的 Ø8 木釘孔位對得上、緊接腳柱）右端有一個明確倒角：
//   頂面在離右端 10mm 處開始斜切、斜線一路切到底面右端點（不是小圓角，是直線
//   斜切），跟評審表「圓弧與倒角」5% 配分項相符。但這個倒角落在跟「380/360」
//   雙標深度謎團同一個構件、同一張 C-C 剖面上（見下方殘留疑點），這根構件本身
//   的長度／對應到哪個既有零件（側下橫檔？獨立構件？）還沒有跟 380/360 之謎
//   一起收斂——先精確記下量到的數字（10mm 水平段，垂直段跟部位歸屬待下一輪
//   核對），不在歸屬未定前貿然把 `Part.edgeChamferNote` 掛到可能掛錯的零件上，
//   避免重蹈第二輪「一次只憑片面證據就分岔出三套理論」的教訓。
//
// 【第四輪：前排兩腳之間無橫檔連接——查證是否官方原始設計】
// - 起因：本題現有幾何只有「後側上／中橫檔」（連左右後腳）跟「左右側下橫檔」（沿深度、
//   各連同側前後腳），前排兩腳之間沒有任何直接構件相連（沒有「前橫檔」）——回官方圖
//   查證這是不是真的官方設計，不是建模時漏掉的缺口。
// - 材料表硬約束：本題側下橫檔／橫檔類角料，評審表項次4（上中橫檔60×21）＋項次7
//   （側下橫檔45×32）加起來實體數量固定＝2支60×21＋2支45×32，材料表對應項次同樣
//   只發等量料件（跟 cert-b5 同一批判讀規則，見檔頭材料表判讀通則）——總共就只有
//   「4支橫檔料」可用。上／中橫檔2支已確認疊放在後側（材料表項次2發2支、圖面B-B
//   俯視段直接量到從左腳柱起 32+55+160...往右延伸至全寬，見 `BB-top-view.png`類
//   複查截圖），側下橫檔2支若同時還要當「前橫檔＋後橫檔」或「左橫檔＋右橫檔」，
//   4支料件不管哪種配置都只夠鋪一個方向、鋪不出前後都有橫檔＋左右都有橫檔的四邊
//   全接構造。換句話說：不管側下橫檔最終判讀是左右（現有幾何）還是前後（cert-b5
//   式），「另一個方向沒有橫檔」都是材料數量鎖死的必然結果，不是三輪判讀漏掉、
//   也不是建模疏漏——是官方材料表本身的限制，回頭查證到此為止，不用改幾何。
// - 左右（現有）vs 前後配置何者才是官方原意：查了 page20 右下角簡圖（key-plan，
//   非主要工作圖，無標註數字）跟 B-B／A-A 系列剖面，沒有找到能明確排除任一種的
//   直接證據——簡圖本身太簡化（無尺寸標註，疑似只是示意兩個剖切位置用），拿它來
//   反推左右/前後屬於過度解讀，這輪不採信。維持第二輪判讀（左右各一，沿深度方向）：
//   跟評審表「側下橫檔」用字裡的「側」字面意義一致（cert-b5 同名構件用途不同、
//   命名不能直接類推）。這一點跟上面的「有無前橫檔」是兩個獨立問題——前者已查證
//   到極限、接受現況；後者（左右配置本身）維持中信心、留待下一輪。
// - 結構合理性佐證（非官方圖直接證據，僅供參考）：現有配置下，前排兩腳雖無直接
//   橫檔，但各自經左右側下橫檔連到對應後腳、再經抽屜滑條螺釘鎖進兩支前腳，抽屜盒體
//   本身也跨在兩支滑條之間——前排側向剛性由「側下橫檔＋滑條＋抽屜」共同提供，不是
//   完全無支撐。這跟不少單抽屜小桌/床頭櫃「開放前面、側撐+抽屜盒補強」的常見工法
//   相符，不是不合理的結構。
//
// 【本輪沒有進一步解開的疑點（留給下一輪）】
// - 深度雙標 380/360 的最終成因：第三輪找到直接證據——C-C 剖面那根「左端接腳柱
//   Ø8 木釘孔、右端 10mm 倒角」的構件，其水平總長標註剛好是 360（不是 380），
//   構件左端緊貼腳柱。跟「360＝下部構件在 C-C 量到的長度基準、380＝腳柱外側面
//   到外側面總深」的既有中信心猜測方向一致、證據更強，但這根構件精確對應
//   哪個既有零件（側下橫檔本身，還是側下橫檔之外另一根獨立構件）仍未 100%
//   釘死，沒有動 3D 幾何。
// - 圓弧與倒角的完整倒角形狀（垂直段尺寸、部位歸屬）——見上方第三輪段落，
//   已知水平 10mm，垂直段跟所屬零件留給下一輪跟 380/360 之謎一起解。
// - 裂口榫的開放缺口造形（U形斷面）沒有建成真正幾何，只用 through-tenon 近似
//   （見上方「中信心」段落）。
// - 評審表榫接密合部位數 8 對 9（見上方第三輪段落）——已查證到極限，比照
//   cert-b5 11/17 模式接受現況，不再往下猜湊。
//
/** 官方試題尺寸（mm）。X 0~494 由左腳柱外面、Y 0~370 由地面、Z 0~380 由前面（+Z＝背） */
const EXAM = {
  W: 494, D: 380, H: 370,
  legW: 32, legD: 45,                          // 腳柱寬(沿長向) × 厚(沿深向)，本輪畫直腳（側腳未建，見檔頭說明）
  upperRailH: 60, upperRailT: 21,               // 上橫檔：60 高 × 21 厚，只在後側；頂面比腳柱頂低 legTopExposedMm
  midRailH: 60, midRailT: 21,                   // 中橫檔：跟上橫檔同尺寸，疊在上橫檔正下方
  lowerRailH: 45, lowerRailT: 32,               // 側下橫檔：45 高 × 32 厚，左右各一支、貼地（跟 cert-b5「前後各一」不同，見檔頭）
  legRailTenonT: 18,                            // 橫檔入腳的裂口榫厚（腳柱 45 厚同 cert-b5，沿用同一個厚度）
  legRailTenonLen: 20,
  upperRailTenonT: 10,                          // 60高×21厚橫檔專用榫厚（留 5.5mm 肩，21 厚沒辦法用 18）
  legTopExposedMm: 10,                          // 腳柱頂端外露段（第二輪新判讀，見檔頭）：上橫檔頂面比腳柱頂面低 10mm，
                                                 // 露出的這段腳柱頂＝A-A剖面「370/360」雙高標註的差值、也是 C-C 剖面 X 記號
                                                 // （斷面／木紋外露記號）所在的位置——不是獨立桌面板、不是側腳，是腳柱本身
                                                 // 頂端露出一截（裂口榫上緣以上的腳柱本體）。
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
      label: isEn ? "mortise, side lower rail tenon (notch-tenon)" : "側下橫檔裂口榫眼",
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
      const upperLocalZ = legCenterY - (H - E.legTopExposedMm - E.upperRailH / 2);
      const midLocalZ = legCenterY - (H - E.legTopExposedMm - E.upperRailH - E.midRailH / 2);
      m.push({
        origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: upperLocalZ },
        depth: E.legRailTenonLen, length: E.upperRailH, width: E.upperRailTenonT,
        through: false,
        label: isEn ? "mortise, upper rail tenon (notch-tenon)" : "上橫檔裂口榫眼",
      });
      m.push({
        origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: midLocalZ },
        depth: E.legRailTenonLen, length: E.midRailH, width: E.upperRailTenonT,
        through: false,
        label: isEn ? "mortise, middle rail tenon (notch-tenon)" : "中橫檔裂口榫眼",
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

  // ── 上橫檔 ×1（60 高 × 21 厚，只在後側；頂面比腳柱頂低 legTopExposedMm=10mm，
  // 腳柱頂端露出一截，見 EXAM.legTopExposedMm 註解與檔頭第二輪說明）──────
  {
    const railCy = H - E.legTopExposedMm - E.upperRailH;
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
    const railCy = H - E.legTopExposedMm - E.upperRailH - E.midRailH;
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
      // origin.y 決定入榫面：滑條跟腳柱是「靠 thickness 軸貼齊」，兩側腳柱在
      // world 座標上左右相反，同一顆 origin.y 對兩側會挑到相反的面——這裡依
      // sx 選「貼抽屜、人手可伸進去鎖螺絲」那一面（backTop 那面才是貼腳柱、
      // 鎖上去後完全看不到也伸不進螺絲刀，不能是入榫面），鑽的方向才會朝腳柱去。
      const screwMortises: Mortise[] = [-1, 1].map((k) => ({
        origin: { x: k * runnerLen / 4, y: sx === 0 ? runnerT : 0, z: 0 },
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
    ? "⚠️ Not yet fully verified: built from an independent read of the official drawing, cross-checked over two passes so far. The 494×380 vs 472×360 pair in the corner key-plan drawings was initially misread as splayed/tapered legs — re-measured in pass 2 and that reading was withdrawn (no diagonal leg edge exists anywhere in the drawing's sections); legs are modeled straight. What pass 2 did confirm and model: each leg's top 10mm stands proud above the rail assembly (exposed end grain, matching a repeated \"X-in-box\" mark in the drawing and a matched pair of height dimensions in section A-A) — the rails now sit 10mm below the leg tops, not flush. Still unresolved: the exact cause of the evaluation sheet's dual depth value (380/360mm). Also still simplified: the drawing's \"notch-tenon\" (裂口榫) joint has no dedicated JoineryType in this codebase — modeled as through-tenon (closest available \"open/visible joint\" semantic) with standard rectangular mortise/tenon geometry, not the drawing's literal open-notch shape. See the file header for the full confidence breakdown."
    : "⚠️ 尚未完全驗證：依獨立讀圖建置，目前走過兩輪複查。圖面右下角小縮圖的「494×380 對 472×360」一組數字，第一輪誤判成腳柱側腳（斜腳）——第二輪重新量測後撤回這個判讀（圖面所有剖視裡沒有任何一條腳柱斜線），腳柱維持直腳。第二輪確認並建進3D的是：每支腳柱頂端外露10mm、站在橫檔組上方（斷面木紋外露，對應圖面重複出現的「X框」記號跟A-A剖面一組差10mm的高度標註）——橫檔現在退讓在腳柱頂下方10mm，不是貼齊腳頂。仍未解開：評審表深度雙標（380/360mm）的確切成因。另一個維持中的簡化：圖面「裂口榫」在型別系統沒有專屬 JoineryType，這輪用 through-tenon（語意上最接近「外露榫頭」）搭配標準矩形榫卯幾何代表，沒有畫出圖面真正的開放缺口造形。完整信心等級分類見檔頭。");

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
      ? `Practice piece drawn from the published dimensions of Taiwan's Class B furniture-woodworking trade test, question 01200-100206 (7 hours). 494×380×370: 4 straight legs (45×32) run the full height, with the top 10mm standing proud above the rail assembly (no separate top panel); a stacked pair of 60×21 back rails (upper + middle) sit 10mm below the leg tops and two 45×32 side rails (left + right) near the floor join the legs with notch-tenon joints, each pinned with 2 extra Ø8 dowels per the drawing's own note; a front-opening drawer 384×350 with a 130mm-tall front, dovetailed (9 segments/corner) front corners and doweled back corners, riding on two runners screwed into the leg posts. **Two review passes so far — see the file header for the current confidence breakdown and the one still-open question (the evaluation sheet's dual depth value).** Download the official paper at owinform.wdasec.gov.tw and follow that version on test day.`
      : `依技術士技能檢定家具木工乙級術科試題 01200-100206（7 小時）公開尺寸繪製的練習範本。494×380×370：4 支 45×32 直腳貫穿全高、頂端外露10mm站在橫檔組上方（沒有獨立桌面板）；後側疊放一組 60×21 上／中橫檔（退讓在腳頂下方10mm）、左右各一支 45×32 側下橫檔貼地，跟腳柱走裂口榫接合，圖面明寫每處另外補強 2 支木釘；抽屜 384×350 從前面推拉，前板 130 高，前角鳩尾（9段/角）、後角木釘，滑條鎖進腳柱。**已走過兩輪複查——目前信心等級與唯一還沒解開的疑點（評審表深度雙標）見檔頭。**官方應檢參考資料請至技能檢定中心官網下載，應檢以官方版本為準。`,
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
