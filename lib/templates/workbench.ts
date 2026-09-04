/**
 * 木工工作桌（workbench）模板 —— 2026-09-03 五位專家兩輪會議定案的 v1。
 *
 * 骨架：`simpleTable()`（方料直腳 + 可選裙板 + 下橫撐 + 厚桌面）→ post-process 加工作桌獨有零件。
 * 規則出處：docs/drafting-math.md §AU（工作桌）、§O2/§O7（桌高）、§AT4.5（Roubo 腳距端 = 桌長/5）。
 *
 * v1 有的：四種流派 preset（厚板桌 / 裙板桌 / 工具槽桌 / 20mm 孔陣桌）、腳頂貫穿榫、
 *   桌面拼法（寬板平拼 / 窄條側立 / 疊層）、桌面中縫擋條、後側工具槽、狗孔列 / 20mm 格陣、
 *   holdfast 後排孔、刨擋（木方柱穿桌面）、鑄鐵快速前鉗（含墊塊）、腳鉗簡版、下層板、
 *   螺栓可拆（腳上穿孔）、身高→桌高提示、重量 / 抗晃 / 房門警告。
 * v2 才做（沒有幾何表示法，別在這裡硬塞）：尾鉗、Moravian 斜腳 + 楔形通榫、滑入鳩尾、
 *   deadman、抽屜櫃、日式低台、腳輪。
 *
 * ⚠️ 座標：front = −Z；使用者說的「左」= 世界 +X（同 desk.ts 的慣例，鏡頭在 −Z 看進去）。
 * ⚠️ 桌面上的孔一律 `Mortise{shape:"round", cosmetic:true, through:true}`，origin 是 mesh-local
 *    （§M1：x ∈ ±length/2、y ∈ [0, thickness] 從底量、z ∈ ±width/2）。
 */
import type { FurnitureTemplate, FurnitureDesign, OptionSpec, Part, Mortise } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";
import { WORKBENCH_PRESETS } from "./workbench-presets";
import { caseFurniture } from "./_builders/case-furniture";
import { applyLowerStretcherArrangement } from "./dining-table";
import { applyStandardChecks, appendWarnings } from "./_validators";
import { LOWER_STRETCHER_HEIGHT_RATIO, DEFAULT_SHELF_THICKNESS_MM } from "./_constants";
import { MATERIALS } from "@/lib/materials";
import { formatMm } from "@/lib/units/format";

// ───────────────────────── 常數（來源見 §AU） ─────────────────────────
/** 鑄鐵快速鉗鉗口寬（台灣建成 / SKC 規格：7" = 180、9" = 225） */
const VISE_JAW_MM: Record<string, number> = { "7in": 180, "9in": 225 };
/** 快速鉗要求的前緣木料厚度（廠商標「桌板厚度約 60mm」），不足就加墊塊 */
const VISE_MIN_EDGE_MM = 60;
/** 鉗本體（鑄件）在桌底佔的深 / 高 */
const VISE_BODY_DEPTH_MM = 160;
const VISE_BODY_HEIGHT_MM = 70;
/** 木顎厚（45 才放得下 Ø19 桌狗孔，兩側各留 13） */
const VISE_CHOP_T_MM = 45;
/** 內顎板（貼桌面前緣那片，跟木顎同樣三個孔） */
const VISE_INNER_JAW_T_MM = 20;
/** holdfast 咬得住的桌面厚度範圍（Gramercy 1¾"~3½"；Lee Valley 1½"~4"） */
const HOLDFAST_MIN_T = 44;
const HOLDFAST_MAX_T = 89;
/** 刨擋木方柱斷面（AWB 2½" 方） */
const PLANING_STOP_MM = 64;
const PLANING_STOP_PROUD_MM = 20;
/** 狗孔數量上限（3D 用深色圓柱「塞」畫孔不再 CSG；上限是為了零件圖標註與 mesh 數量） */
const MAX_DOG_HOLES = 60;
const MAX_GRID_HOLES = 200;
/** 平拼單片實木上限（同 round-table / 工具牆的 280 慣例） */
const PLANK_MAX_W = 280;
/** 桌高係數（§O7 + Schwarz 小指根法；170cm → 833 / 935 / 1020） */
const HEIGHT_COEF: Record<string, number> = { plane: 0.49, machine: 0.55, fine: 0.60, assembly: 0.44 };
/** 尾鉗（wagon）：Benchcrafted 懸出 ≥ 18½"、槽 = 行程 310 + dog 45 + 10、端蓋 4" */
const WAGON_MIN_OVERHANG = 470;
const WAGON_SLOT_L = 365;
const WAGON_SLOT_W = 52;
const WAGON_END_CAP_T = 100;
/** 抽屜櫃頂到桌底最少淨空（holdfast 桿露出約 8" + 餘裕） */
const DRAWER_CLEARANCE = 210;
/** 弦向全收縮率 %（USDA Wood Handbook）；ΔW = W × S/100 × ΔMC/30，台灣室內 ΔMC 取 6% */
const TANGENTIAL_SHRINK: Record<string, number> = {
  beech: 11.9, maple: 9.9, "white-oak": 10.5, walnut: 7.8, ash: 7.8, teak: 5.8,
  "douglas-fir": 7.6, "taiwan-cypress": 6.5, pine: 6.1, "southern-pine": 7.4,
};
const DELTA_MC = 6;
/** 腳鉗木顎厚（Benchcrafted：chop ≥ 2½"） */
const LEG_VISE_CHOP_T = 64;

// ───────────────────────── 流派 preset ─────────────────────────
// 值在 ./workbench-presets.ts（設計頁切流派時把整組寫進網址；模板不覆寫）。
// 唯一例外：舊連結只帶 benchStyle、其他 key 完全不在網址上 → 當成「還沒被表單寫過」套一次。
export const workbenchOptions: OptionSpec[] = [
  // ───────────── ⭐ 流派 ─────────────
  { group: "preset", type: "select", key: "benchStyle", label: "工作桌流派", defaultValue: "roubo", wide: true, choices: [
    { value: "roubo", label: "厚板桌（法式 Roubo）— 厚桌面、粗腳通榫、快速鉗 + 狗孔" },
    { value: "apron", label: "裙板桌（英式 Nicholson / Sellers 平價）— 薄桌面靠高裙板撐，螺栓可拆" },
    { value: "well", label: "工具槽桌（北歐式）— 桌面後側一道放工具的槽" },
    { value: "mft", label: "20mm 孔陣桌（現代 MFT）— 夾板桌面、20mm 孔每 96mm 一格" },
    { value: "classroom", label: "教室雙面桌 — 兩人面對面各一支鉗、各一列狗孔（深度建議 900）" },
  ], help: "選了一次帶入整組預設值；你改過的欄位不會被蓋掉。長／深／高請自己在上面調（厚板桌建議 1800×600×830、教室雙面桌 1800×900）" },

  // ───────────── 桌高怎麼定（只給建議，不動滑桿） ─────────────
  { group: "structure", type: "select", key: "heightMode", label: "桌高用途（給建議值）", defaultValue: "plane", choices: [
    { value: "plane", label: "手刨為主（桌面 ≈ 掌根高，身高 × 0.49）" },
    { value: "machine", label: "機具 / 組裝為主（肘下約 10cm，身高 × 0.55）" },
    { value: "fine", label: "精細作業（鑿榫、鳩尾；身高 × 0.60）" },
    { value: "assembly", label: "組裝／上漆矮桌（身高 × 0.44；兼餐桌約 730）" },
    { value: "outfeed", label: "當桌鋸出料台（桌高 ＝ 桌鋸台面 − 2，只能低不能高）" },
  ], help: "依身高算出建議桌高，寫在下方說明與警告裡；不會自動改你設的「高」" },
  { group: "structure", type: "number", key: "userHeightCm", label: "你的身高", defaultValue: 170, unit: "cm", min: 145, max: 195, step: 1, help: "台灣男性中位約 170、女性約 160。只用來算建議桌高" },
  { group: "structure", type: "number", key: "shoeAllowanceMm", label: "鞋底／腳墊加厚", defaultValue: 0, unit: "mm", min: 0, max: 60, step: 5, help: "穿工作鞋或站在防疲勞墊上做，建議桌高會加上這個數。只影響建議值與警告" },
  { group: "structure", type: "number", key: "sawTableHeightMm", label: "桌鋸台面高", defaultValue: 870, unit: "mm", min: 700, max: 1000, step: 5, dependsOn: { key: "heightMode", equals: "outfeed" }, help: "出料台只能跟台面同高或低 1~2mm，高於台面木料尾端會被抬起反彈。只影響建議值與警告" },
  { group: "structure", type: "number", key: "roomLengthCm", label: "房間能放的長", defaultValue: 0, unit: "cm", min: 0, max: 1000, step: 10, help: "量牆到牆。0 ＝ 不管；桌長加 90cm 走道放不下會提醒。只影響警告" },
  { group: "structure", type: "number", key: "roomWidthCm", label: "房間能放的深", defaultValue: 0, unit: "cm", min: 0, max: 1000, step: 10, help: "0 ＝ 不管；桌深加 90cm 走道放不下會提醒。只影響警告" },

  // ───────────── 桌面 ─────────────
  { group: "top", type: "number", key: "topThickness", label: "桌面厚", defaultValue: 75, unit: "mm", min: 40, max: 150, step: 5, help: "手工具桌建議 ≥75；holdfast 要咬得住桌面 44~89mm；≥90 會提醒孔底反鑽" },
  { group: "top", type: "select", key: "topBuild", label: "桌面做法", defaultValue: "plank", choices: [
    { value: "plank", label: "寬板平拼（每片 ≤ 280mm，自動算片數）" },
    { value: "stave", label: "窄條側立拼（條寬 ＝ 桌面厚，台灣 2×4 / 角料做法）" },
    { value: "stack", label: "夾板或薄板疊層（層數在下面設）" },
  ], help: "只影響材料單與裁切怎麼拆，3D 外觀一樣" },
  { group: "top", type: "number", key: "topLayers", label: "疊層數", defaultValue: 2, min: 1, max: 4, step: 1, dependsOn: { key: "topBuild", equals: "stack" }, help: "每層厚 ＝ 桌面厚 ÷ 層數（18mm 樺木夾板 × 3 ≈ 54）" },
  { group: "top", type: "select", key: "topSplit", label: "桌面分割", defaultValue: "none", choices: [
    { value: "none", label: "整片" },
    { value: "gap", label: "中間留縫 + 擋條（split-top，夾具可從縫伸進去）" },
    { value: "well", label: "後側工具槽（放鑿子、刨刀不會滾下桌）" },
    { value: "center-well", label: "中央凹槽放工具（兩片桌面中間低一層，歐式／教室桌常見）" },
  ] },
  { group: "top", type: "number", key: "gapWidth", label: "中縫寬", defaultValue: 45, unit: "mm", min: 25, max: 80, step: 5, dependsOn: { key: "topSplit", equals: "gap" }, help: "F 夾的夾頭要塞得進去；擋條做成跟桌面齊平，翻面可當刨擋" },
  { group: "top", type: "number", key: "wellWidth", label: "工具槽寬", defaultValue: 150, unit: "mm", min: 80, max: 320, step: 10, dependsOn: { key: "topSplit", oneOf: ["well", "center-well"] }, help: "後側槽：從桌深扣掉，桌腳只在工作面下；中央槽：夾在兩片桌面之間，兩片各要蓋得住腳" },
  { group: "top", type: "number", key: "wellDepth", label: "工具槽深", defaultValue: 45, unit: "mm", min: 20, max: 80, step: 5, dependsOn: { key: "topSplit", oneOf: ["well", "center-well"] }, help: "槽底板厚 24；槽深不能超過桌面厚 −20（中央槽的底板要鎖在兩片桌面內側的墊條上）" },
  { group: "top", type: "number", key: "endOverhang", label: "桌端懸出（腳距桌端）", defaultValue: 0, unit: "mm", min: 0, max: 600, step: 10, help: "0 ＝ 自動 ＝ 桌長 ÷ 5（Roubo 原版比例）。懸出夠長，鉗才裝得進腳外側；裝尾鉗那端會自動拉到 470" },
  { group: "top", type: "number", key: "frontOverhang", label: "桌面前緣凸出腳／裙板", defaultValue: 0, unit: "mm", min: 0, max: 100, step: 5, dependsOn: { key: "topSplit", notIn: ["well"] }, help: "裙板桌要凸出 50 才夾得到桌面（後悔榜第一名）；厚板桌保持 0 齊平，腳鉗和長板靠板都要齊平" },
  { group: "top", type: "checkbox", key: "topBattens", label: "桌面底穿帶（燕尾，防翹）", defaultValue: false, dependsOn: { key: "topBuild", notIn: ["stack"] }, help: "桌面底面兩端各一條 60×30 穿帶，滑入 15 深的燕尾槽（槽口 40、槽底 50，約 1:6）；只在中央上膠、兩端留 20 不出邊，桌面才能脹縮" },
  { group: "top", type: "checkbox", key: "breadboardEnds", label: "兩端封邊板（防桌面翹）", defaultValue: false, dependsOn: { all: [{ key: "topBuild", notIn: ["stack"] }, { key: "topSplit", equals: "none" }, { key: "endVise", equals: "none" }] }, help: "60mm 寬、木紋跟桌面垂直；只在中央 15cm 上膠，外側銷孔做長孔讓桌面伸縮" },

  // ───────────── 腳 ─────────────
  { group: "leg", type: "number", key: "legSize", label: "腳粗（方料）", defaultValue: 100, unit: "mm", min: 60, max: 150, step: 5, help: "厚板桌 100~125；裙板桌 75~90。腳鉗那支腳至少 64" },
  { group: "leg", type: "select", key: "legTopJoint", label: "腳接桌面", defaultValue: "through", choices: [
    { value: "through", label: "貫穿榫（榫頭端面露在桌面上，Roubo 作法）" },
    { value: "blind", label: "暗榫（桌面看不到榫）" },
  ] },

  // ───────────── 裙板 ─────────────
  { group: "apron", type: "checkbox", key: "withApron", label: "裙板（薄桌面的剛性來源）", defaultValue: false, wide: true, help: "桌面 <60mm 就靠 ≥250mm 高的裙板抗晃（Nicholson / Sellers 作法）；厚板桌不用" },
  { group: "apron", type: "number", key: "apronWidth", label: "裙板高", defaultValue: 250, unit: "mm", min: 100, max: 350, step: 10, dependsOn: { key: "withApron", equals: true } },
  { group: "apron", type: "number", key: "apronThickness", label: "裙板厚", defaultValue: 40, unit: "mm", min: 25, max: 60, step: 5, dependsOn: { key: "withApron", equals: true }, help: "≥38 的前裙板才咬得住 holdfast" },

  // ───────────── 下橫撐 ─────────────
  { group: "stretcher", type: "checkbox", key: "withLowerStretchers", label: "下橫撐", defaultValue: true, help: "工作桌幾乎必有；沒有它腳會被刨削推力推到走路" },
  { group: "stretcher", type: "select", key: "lowerStretcherArrangement", label: "下橫撐排列", defaultValue: "box-frame", choices: [
    { value: "box-frame", label: "4 邊框（最穩；前橫撐給長板靠板用，可放下層板、抽屜）" },
    { value: "h-frame", label: "H 形（左右各一 + 中央一根長撐）" },
    { value: "pair-x", label: "只前後 2 根" },
    { value: "pair-z", label: "只左右 2 根" },
  ], dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高", defaultValue: 100, unit: "mm", min: 40, max: 150, step: 5, dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚", defaultValue: 50, unit: "mm", min: 25, max: 80, step: 5, dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地", defaultValue: 0, unit: "mm", min: 0, max: 300, step: 10, dependsOn: { key: "withLowerStretchers", equals: true }, help: "0 ＝ 自動 100（Schwarz 3 吋、Sellers 約 150）" },
  { group: "stretcher", type: "checkbox", key: "withUnderShelf", label: "下層置物板", defaultValue: false, dependsOn: { key: "withLowerStretchers", equals: true }, help: "架在下橫撐上；增重又能放工具箱，但別塞滿桌底（夾具要伸得進去）" },
  { group: "stretcher", type: "number", key: "drawerCount", label: "桌下抽屜（0 ＝ 無）", defaultValue: 0, min: 0, max: 3, step: 1, dependsOn: { all: [{ key: "withLowerStretchers", equals: true }, { key: "deadman", notIn: [true] }] }, help: "抽屜櫃坐在下橫撐上，櫃頂離桌底自動留 210mm 給 holdfast 桿；跟裙板同時用夾具會沒地方夾" },
  { group: "stretcher", type: "checkbox", key: "legPenetratingTenon", label: "橫撐 / 裙板通榫露出腳外", defaultValue: true, dependsOn: { any: [{ key: "withLowerStretchers", equals: true }, { key: "withApron", equals: true }] }, help: "Roubo 標配；未勾依母件厚度自動決定盲榫或通榫" },

  // ───────────── 工件固定 ─────────────
  { group: "workholding", type: "select", key: "frontVise", label: "前鉗", defaultValue: "quick", choices: [
    { value: "quick", label: "鑄鐵快速鉗（台灣 7\" 約 NT$2,200、9\" 約 NT$2,900）" },
    { value: "leg", label: "腳鉗（木顎鎖在前腳上；螺桿要自製或進口）" },
    { value: "none", label: "不裝" },
  ], help: "快速鉗買得到最省事；腳鉗夾寬板最強但台灣沒現貨螺桿" },
  { group: "workholding", type: "select", key: "frontViseSize", label: "鉗寬", defaultValue: "7in", choices: [
    { value: "7in", label: "7 吋（鉗口 180mm）" },
    { value: "9in", label: "9 吋（鉗口 225mm）" },
  ], dependsOn: { key: "frontVise", equals: "quick" }, help: "前緣木料要 ≥60mm 厚，不夠會自動加墊塊" },
  { group: "workholding", type: "select", key: "viseSide", label: "慣用手（鉗在哪一端）", defaultValue: "left", choices: [
    { value: "left", label: "右撇子：前鉗在左端" },
    { value: "right", label: "左撇子：前鉗在右端" },
  ], dependsOn: { key: "frontVise", notIn: ["none"] }, help: "一起鏡像：前鉗、尾鉗、狗孔起算端、刨擋、長板靠板" },
  { group: "workholding", type: "select", key: "endVise", label: "尾鉗（桌尾）", defaultValue: "none", choices: [
    { value: "none", label: "不裝" },
    { value: "wagon", label: "滑塊尾鉗（桌面開槽，需進口五金；台灣木樹林尾鉗 NT$2,900~4,500 同型）" },
  ], dependsOn: { key: "topSplit", equals: "none" }, help: "裝在前鉗的另一端：那端懸出自動拉到 470、桌面末端 100 厚端蓋、開 365×52 槽；桌長不到 1800 會略過" },
  { group: "workholding", type: "checkbox", key: "legHoles", label: "前腳 holdfast／插銷孔列（正面看得到）", defaultValue: true, help: "兩支前腳正面各一列 Ø19 孔：長料一端夾在前鉗、另一端用 holdfast 或插銷靠在腳上（Roubo 的作法）" },
  { group: "workholding", type: "checkbox", key: "deadman", label: "長板靠板（洞洞板，沿桌前左右拖動）", defaultValue: false, dependsOn: { all: [{ key: "frontVise", notIn: ["none"] }, { key: "lowerStretcherArrangement", oneOf: ["box-frame", "pair-x"] }, { key: "withLowerStretchers", equals: true }, { key: "frontOverhang", equals: 0 }, { key: "drawerCount", equals: 0 }] }, help: "一片帶孔的木板騎在前下橫撐的脊條上、頂在桌底軌裡，左右拖到需要的位置插銷撐長板。要前緣齊平、下橫撐 4 邊框或只前後、沒有抽屜" },
  { group: "workholding", type: "checkbox", key: "doubleSided", label: "雙面桌（對側再一支前鉗＋一列狗孔）", defaultValue: false, dependsOn: { all: [{ key: "frontVise", equals: "quick" }, { key: "topSplit", equals: "none" }] }, help: "教室用：兩人面對面各一支鉗（對角）、各一列狗孔，holdfast 孔改中央一列；桌深建議 ≥ 800" },
  { group: "workholding", type: "select", key: "dogHoles", label: "桌狗孔", defaultValue: "row", choices: [
    { value: "row", label: "前緣一列（配鉗與刨擋）" },
    { value: "grid", label: "20mm 格陣（每 96mm 一孔，MFT 配件通用）" },
    { value: "none", label: "不打" },
  ] },
  { group: "workholding", type: "select", key: "dogHoleDia", label: "孔徑（狗孔／格陣／holdfast／前腳孔／靠板孔一起）", defaultValue: "19", choices: [
    { value: "19", label: "Ø19（3/4\"，台灣桌狗 / holdfast 主流）" },
    { value: "20", label: "Ø20（MFT 配件；3/4\" 桌狗也插得進）" },
  ], help: "所有圓孔同一個孔徑，桌狗、holdfast 才通用。孔陣桌流派預設 20，其他 19" },
  { group: "workholding", type: "number", key: "dogHolePitch", label: "孔距", defaultValue: 100, unit: "mm", min: 60, max: 200, step: 10, dependsOn: { key: "dogHoles", equals: "row" }, help: "要小於鉗的行程（快速鉗開口 260 以上都夠）" },
  { group: "workholding", type: "number", key: "dogHoleFrontOffset", label: "離前緣", defaultValue: 60, unit: "mm", min: 40, max: 150, step: 5, dependsOn: { key: "dogHoles", equals: "row" }, help: "Schwarz 2~4\"；太靠邊會沿木紋裂" },
  { group: "workholding", type: "checkbox", key: "holdfastHoles", label: "holdfast 壓桿孔（後排，錯開）", defaultValue: true, dependsOn: { key: "dogHoles", notIn: ["none"] }, help: "跟狗孔同孔徑零成本；一支 holdfast 抵三支 F 夾。桌面 <44mm 咬不住會自動取消" },

  // ───────────── 可拆 ─────────────
  { group: "misc", type: "select", key: "knockdown", label: "可拆式", defaultValue: "none", choices: [
    { value: "none", label: "膠合固定（最穩）" },
    { value: "bolt", label: "螺栓可拆（橫撐 / 裙板用 M10 床螺栓穿腳鎖，搬家拆得開）" },
  ], help: "可拆版榫頭不上膠，腳上會多穿孔；材料單另列螺栓" },
];

/** 桌面上的圓孔（狗孔 / holdfast 孔 / 螺桿孔）——一律 cosmetic round through */
function roundHole(x: number, y: number, z: number, dia: number, depth: number): Mortise {
  return { origin: { x, y, z }, depth, length: dia, width: dia, through: true, shape: "round", cosmetic: true };
}

export const workbench: FurnitureTemplate = (input) => {
  const locale = input.locale ?? "zh-TW";
  const isEn = locale === "en";
  const o = workbenchOptions;
  const warnings: string[] = [];

  // ── 讀選項：使用者沒動過的 key 吃 preset ──
  const benchStyle = getOption<string>(input, opt(o, "benchStyle"));
  const preset = WORKBENCH_PRESETS[benchStyle] ?? {};
  // 舊連結相容：網址只有 benchStyle、preset 管的 key 一個都沒出現 → 套 preset；否則所見即所得
  const presetKeys = Object.keys(preset);
  const legacyLink = presetKeys.length > 0 && presetKeys.every((k) => input.options?.[k] === undefined);
  const pick = <T extends string | number | boolean>(key: string): T => {
    if (legacyLink && preset[key] !== undefined) return preset[key] as T;
    return getOption<T>(input, opt(o, key));
  };

  const L = input.length;
  const W = input.width;
  const H = input.height;
  const heightMode = pick<string>("heightMode");
  const userHeightCm = pick<number>("userHeightCm");
  const topTRaw = pick<number>("topThickness");
  const topBuild = pick<string>("topBuild");
  const topLayers = pick<number>("topLayers");
  const topSplit = pick<string>("topSplit");
  const gapWidth = pick<number>("gapWidth");
  const wellWidthRaw = pick<number>("wellWidth");
  const wellDepthRaw = pick<number>("wellDepth");
  const endOverhangRaw = pick<number>("endOverhang");
  const legSizeRaw = pick<number>("legSize");
  const legTopJoint = pick<string>("legTopJoint");
  const withApron = pick<boolean>("withApron");
  const apronWidth = pick<number>("apronWidth");
  const apronThickness = pick<number>("apronThickness");
  const withLowerStretchers = pick<boolean>("withLowerStretchers");
  const lowerStretcherArrangement = pick<string>("lowerStretcherArrangement");
  const lowerStretcherWidth = pick<number>("lowerStretcherWidth");
  const lowerStretcherThickness = pick<number>("lowerStretcherThickness");
  const lowerStretcherHeightRaw = pick<number>("lowerStretcherHeight");
  const withUnderShelfRaw = pick<boolean>("withUnderShelf");
  const legPenetratingTenon = pick<boolean>("legPenetratingTenon");
  const frontVise = pick<string>("frontVise");
  const frontViseSize = pick<string>("frontViseSize");
  const viseSide = pick<string>("viseSide");
  const dogHoles = pick<string>("dogHoles");
  const dogHoleDiaRow = Number(pick<string>("dogHoleDia")) === 20 ? 20 : 19;
  const dogHolePitchRaw = pick<number>("dogHolePitch");
  const dogHoleFrontOffsetRaw = pick<number>("dogHoleFrontOffset");
  const holdfastHolesRaw = pick<boolean>("holdfastHoles");
  const planingStop = false; // 09-04 木頭仁：刨擋是買現成的，不畫
  const knockdown = pick<string>("knockdown");
  const shoeAllowanceMm = pick<number>("shoeAllowanceMm");
  const sawTableHeightMm = pick<number>("sawTableHeightMm");
  const roomLengthCm = pick<number>("roomLengthCm");
  const roomWidthCm = pick<number>("roomWidthCm");
  const frontOverhangRaw = pick<number>("frontOverhang");
  const breadboardEndsRaw = pick<boolean>("breadboardEnds");
  const topBattensRaw = pick<boolean>("topBattens");
  const drawerCountRaw = pick<number>("drawerCount");
  const endViseRaw = pick<string>("endVise");
  const deadmanRaw = pick<boolean>("deadman");
  const legHoles = pick<boolean>("legHoles");
  const doubleSidedRaw = pick<boolean>("doubleSided");
  const moxonRaw = false; // 09-04 木頭仁：桌上鉗、附件都是買現成的，不畫進料單
  const accessoriesRaw = false;

  // ── 夾制（§A10.11：夾在讀選項這一層、夾了要出聲） ──
  const topT = Math.max(40, Math.min(150, topTRaw));
  // 腳鉗木顎 64 厚，那支腳至少也要 64（Benchcrafted：leg ≥ 2½"）
  const legSize = frontVise === "leg" ? Math.max(legSizeRaw, LEG_VISE_CHOP_T) : legSizeRaw;
  if (legSize !== legSizeRaw) warnings.push(isEn ? `Leg vise needs a leg ≥ ${LEG_VISE_CHOP_T}mm thick; leg size raised ${legSizeRaw} → ${legSize}.` : `腳鉗那支腳至少 ${LEG_VISE_CHOP_T}mm 厚，腳粗已從 ${legSizeRaw} 提到 ${legSize}。`);
  const legHeight = H - topT;
  // 工具槽：從桌深扣掉，桌腳只在工作面下；槽深不能深過桌面厚 −10
  const wellWidth = topSplit === "well" ? Math.min(wellWidthRaw, Math.max(80, W - 2 * legSize - 200)) : 0;
  // 中央凹槽：夾在兩片桌面之間，兩片各要蓋得住腳（腳 + 40 餘裕）
  const centerWell = topSplit === "center-well" ? Math.min(wellWidthRaw, Math.max(80, W - 2 * (legSize + 40))) : 0;
  if (topSplit === "center-well" && centerWell !== wellWidthRaw) warnings.push(isEn ? `Centre well narrowed ${wellWidthRaw} → ${centerWell} so both slabs still cover the legs.` : `中央槽 ${wellWidthRaw} 會讓兩片桌面蓋不住腳，已收到 ${centerWell}。`);
  if (topSplit === "well" && wellWidth !== wellWidthRaw) warnings.push(isEn ? `Tool well narrowed ${wellWidthRaw} → ${wellWidth} so the legs still fit under the working top.` : `工具槽寬 ${wellWidthRaw} 會讓工作面放不下桌腳，已收到 ${wellWidth}。`);
  const wellDepth = topSplit === "well" ? Math.min(wellDepthRaw, topT - 10) : topSplit === "center-well" ? Math.min(wellDepthRaw, topT - 20) : 0;
  if ((topSplit === "well" || topSplit === "center-well") && wellDepth !== wellDepthRaw) warnings.push(isEn ? `Tool well depth clamped ${wellDepthRaw} → ${wellDepth} (top thickness − 10).` : `工具槽深 ${wellDepthRaw} 超過桌面厚 −10，已收到 ${wellDepth}。`);
  const workW = W - wellWidth; // 桌腳 / 工作面所在的深度
  // 中縫：兩片各要放得下腳頂榫（腳 + 餘裕）
  const gap = topSplit === "gap" ? Math.min(gapWidth, Math.max(25, workW - 2 * legSize - 100)) : 0;
  if (topSplit === "gap" && gap !== gapWidth) warnings.push(isEn ? `Split gap clamped ${gapWidth} → ${gap} so each half still covers the leg tenons.` : `中縫 ${gapWidth} 會讓兩片桌面蓋不住腳頂榫，已收到 ${gap}。`);
  // 前緣凸出腳／裙板：腳鉗與長板靠板要齊平；工具槽桌不給
  let frontOverhang = topSplit === "well" ? 0 : Math.max(0, Math.min(100, frontOverhangRaw));
  if (topSplit === "well" && frontOverhangRaw > 0) warnings.push(isEn ? "Tool-well bench keeps the front edge flush; front overhang reset to 0." : "工具槽桌的前緣維持跟腳齊平，前緣凸出已改回 0。");
  if (frontVise === "leg" && frontOverhang > 0) {
    warnings.push(isEn ? "A leg vise needs the top flush with the leg; front overhang reset to 0." : "腳鉗的木顎要貼著腳，桌面前緣必須跟腳齊平，前緣凸出已改回 0。");
    frontOverhang = 0;
  }
  // 腳距桌端：0 = 桌長/5（§AT4.5）；上限讓兩腳之間至少留 300
  const maxOverhang = Math.max(0, Math.floor((L - 2 * legSize - 300) / 2));
  const endOverhangWanted = endOverhangRaw > 0 ? endOverhangRaw : Math.round(L / 5);
  const endOverhang = Math.min(endOverhangWanted, maxOverhang);
  if (endOverhang !== endOverhangWanted && endOverhangRaw > 0) warnings.push(isEn ? `End overhang ${endOverhangRaw} leaves too little between the legs; clamped to ${endOverhang}.` : `兩端懸出 ${endOverhangRaw} 會讓兩腳之間不到 300mm，已收到 ${endOverhang}。`);
  const sideSign = viseSide === "left" ? 1 : -1; // 「左」= 世界 +X（鏡頭在 −Z 看進去）
  const jaw0 = VISE_JAW_MM[frontViseSize] ?? 180;
  // 雙面桌：對側再一支前鉗（在前鉗的另一端、桌子後緣）
  const doubleSided = doubleSidedRaw && frontVise === "quick" && topSplit === "none";
  if (doubleSidedRaw && !doubleSided) warnings.push(isEn ? "Double-sided bench needs a quick-release front vise and a one-piece top; skipped." : "雙面桌要用快速前鉗、桌面整片，已略過對側那支鉗。");
  // 尾鉗：裝在前鉗的另一端，那端懸出拉到 470（Benchcrafted ≥ 18½"）；桌長不到 1800、分片桌面、雙面桌都略過
  const wagonSign = -sideSign;
  const wagonWanted = endViseRaw === "wagon";
  const wagon = wagonWanted && topSplit === "none" && L >= 1800 && !doubleSided;
  if (wagonWanted && !wagon) warnings.push(isEn
    ? (L < 1800 ? `Wagon vise skipped: bench must be ≥ 1800 long (yours ${L}) or the legs end up too close.` : "Wagon vise skipped: needs a one-piece top and no second vise on that end.")
    : (L < 1800 ? `尾鉗已略過：桌長要 ≥ 1800（目前 ${L}），否則兩端懸出後腳距太短會晃。` : "尾鉗已略過：要整片桌面，而且那一端不能再有雙面桌的第二支鉗。"));
  const ovWagon = wagon ? Math.max(endOverhang, WAGON_MIN_OVERHANG) : endOverhang;
  // 尾鉗那端拉長後，另一端（自動模式）縮到 300 把腳距補回來（木匠：別一選尾鉗就跳腳距警告；快速鉗 7" 要 260 才裝得進腳外側）
  const ovNear = wagon && endOverhangRaw === 0 ? Math.min(endOverhang, Math.max(300, jaw0 + 80)) : endOverhang;
  if (wagon && ovWagon !== endOverhang) warnings.push(isEn ? `Wagon-vise end overhang raised to ${ovWagon} (slot + end cap need ≥ 470); the other end set to ${ovNear}.` : `尾鉗那端懸出已拉到 ${ovWagon}（槽 + 端蓋要 ≥ 470）；另一端${ovNear !== endOverhang ? `縮到 ${ovNear} 補回腳距` : `維持 ${endOverhang}`}。`);
  // 世界 +X 端 / −X 端各自的懸出；腳架中心相對桌面中心平移
  const ovPlus = wagon && wagonSign > 0 ? ovWagon : ovNear;
  const ovMinus = wagon && wagonSign < 0 ? ovWagon : ovNear;
  const frameL = L - ovPlus - ovMinus;
  const frameDx = (ovMinus - ovPlus) / 2;
  let lowerStretcherHeight = lowerStretcherHeightRaw > 0 ? lowerStretcherHeightRaw : 100;
  // 下橫撐不能頂到裙板（builder 不夾；工程師 09-04 隨機測試抓到 apron × ls 穿模）
  if (withApron) {
    const maxLsY = legHeight - apronWidth - lowerStretcherWidth - 20;
    if (lowerStretcherHeight > maxLsY) {
      warnings.push(isEn ? `Lower stretcher ${lowerStretcherHeight}mm off the floor would run into the ${apronWidth}mm apron; lowered to ${Math.max(0, maxLsY)}.` : `下橫撐離地 ${lowerStretcherHeight} 會頂到 ${apronWidth}mm 的裙板，已降到 ${Math.max(0, maxLsY)}。`);
      lowerStretcherHeight = Math.max(0, maxLsY);
    }
  }
  // 下層板需要橫撐當支撐；H 形 / 雙條也能放（架在有的那幾根上）
  const withUnderShelf = withUnderShelfRaw && withLowerStretchers;
  // holdfast：桌面太薄咬不住 → 取消並出聲；太厚 → 提醒孔底反鑽
  const holdfastHoles = holdfastHolesRaw && dogHoles !== "none" && topT >= HOLDFAST_MIN_T;
  if (holdfastHolesRaw && dogHoles !== "none" && topT < HOLDFAST_MIN_T) warnings.push(isEn ? `Top is ${topT}mm — a holdfast needs ≥ ${HOLDFAST_MIN_T}mm to bite; holdfast holes skipped.` : `桌面 ${topT}mm 太薄，holdfast 要 ≥ ${HOLDFAST_MIN_T}mm 才咬得住，後排壓桿孔已取消。`);
  if (holdfastHoles && topT > HOLDFAST_MAX_T) warnings.push(isEn ? `Top is ${topT}mm: counterbore the holdfast holes from below (Ø30, ${topT - 70}mm deep) so the effective thickness is ~70mm.` : `桌面 ${topT}mm 比 holdfast 咬合上限 ${HOLDFAST_MAX_T} 厚：holdfast 孔請從桌底反鑽 Ø30、深 ${topT - 70}mm，讓有效厚度回到約 70。`);
  // 桌面片數：平拼 ≤280/片；側立拼 條寬＝厚；疊層＝層數
  const softStave = topBuild === "stave" && (input.material === "southern-pine" || input.material === "pine");
  const topPanelPieces = topBuild === "stave"
    ? Math.max(1, Math.ceil((workW + frontOverhang) / Math.max(38, topT) * (softStave ? 1.15 : 1)))
    : topBuild === "stack"
      ? Math.max(1, topLayers)
      : Math.max(1, Math.ceil(workW / PLANK_MAX_W));

  // ── 骨架 ──
  const design: FurnitureDesign = simpleTable({
    category: "workbench",
    nameZh: "木工工作桌",
    length: frameL,
    width: workW,
    height: H,
    material: input.material,
    legSize,
    topThickness: topT,
    apronWidth: withApron ? apronWidth : 0,
    apronThickness,
    apronOffset: 0,
    legPenetratingTenon,
    legTopThroughTenon: legTopJoint === "through",
    withLowerStretchers,
    lowerStretcherWidth,
    lowerStretcherThickness,
    lowerStretcherHeight,
    legInset: 0,
    legShape: "box",
    topPanelPieces,
    seatEdge: 0,
    seatEdgeBottom: 0,
  });
  design.nameZh = isEn ? "Woodworking workbench" : "木工工作桌";

  if (withLowerStretchers && lowerStretcherArrangement !== "box-frame") {
    applyLowerStretcherArrangement(design, lowerStretcherArrangement, {
      length: frameL,
      width: workW,
      legSize,
      legInset: 0,
      material: input.material as string,
      lowerStretcherWidth,
      lowerStretcherThickness,
      doubleRailGap: 0,
    });
  }

  // 材料別名：桌面 / 腳的中文名工作桌化
  for (const p of design.parts) {
    if (p.id === "top") { p.nameZh = "桌面"; p.nameEn = "Bench top"; }
    if (p.id.startsWith("apron-")) {
      const side = p.id.slice(6);
      p.nameZh = ({ front: "前裙板", back: "後裙板", left: "左裙板", right: "右裙板" } as Record<string, string>)[side] ?? p.nameZh;
      p.nameEn = ({ front: "Front apron", back: "Back apron", left: "Left apron", right: "Right apron" } as Record<string, string>)[side];
    }
  }

  // ── 桌面拉長到全長（腳架比桌面短，桌面兩端懸出）；腳架依尾鉗懸出平移 ──
  const top = design.parts.find((p) => p.id === "top")!;
  if (frameDx !== 0) for (const p of design.parts) if (p !== top) p.origin.x += frameDx;
  const breadboardEnds = breadboardEndsRaw && !wagon && topSplit === "none" && topBuild !== "stack";
  if (breadboardEndsRaw && !breadboardEnds) warnings.push(isEn ? "Breadboard ends skipped (needs a one-piece solid top without a wagon vise)." : "兩端封邊板已略過：要整片實木桌面、且沒有尾鉗端蓋。");
  const topLen = L - (wagon ? WAGON_END_CAP_T : 0) - (breadboardEnds ? 120 : 0);
  const topOriginX = wagon ? -wagonSign * (WAGON_END_CAP_T / 2) : 0;
  top.visible.length = topLen;
  top.origin.x = topOriginX;
  top.grainDirection = "length";
  // 桌面前緣凸出：往 −Z 加寬；前緣 = −workW/2 − frontOverhang
  if (frontOverhang > 0) {
    top.visible.width = workW + frontOverhang;
    top.origin.z = -frontOverhang / 2;
  }
  const topFrontZ = -workW / 2 - frontOverhang;
  // 腳頂榫眼：跟著腳架平移，再換回桌面 mesh-local（§M1）
  for (const m of top.mortises) {
    m.origin.x += frameDx - topOriginX;
    m.origin.z -= top.origin.z;
  }

  // ── 桌面中縫 + 擋條 ──
  const topPieces: Part[] = [];
  const split = gap > 0 ? gap : centerWell;
  if (split > 0) {
    const idx = design.parts.indexOf(top);
    const mk = (sz: -1 | 1): Part => {
      const zMin = sz < 0 ? topFrontZ : split / 2;
      const zMax = sz < 0 ? -split / 2 : workW / 2;
      const centerZ = (zMin + zMax) / 2;
      return {
        ...top,
        id: sz < 0 ? "top-front" : "top-back",
        nameZh: sz < 0 ? "桌面（前片）" : "桌面（後片）",
        nameEn: sz < 0 ? "Bench top (front half)" : "Bench top (back half)",
        visible: { length: topLen, width: zMax - zMin, thickness: topT },
        origin: { x: topOriginX, y: top.origin.y, z: centerZ },
        mortises: top.mortises
          .filter((m) => Math.sign(m.origin.z + top.origin.z) === sz)
          .map((m) => ({ ...m, origin: { ...m.origin, z: m.origin.z + top.origin.z - centerZ } })),
        tenons: [],
      };
    };
    const front = mk(-1);
    const back = mk(1);
    if (gap > 0) {
      const stop: Part = {
        id: "gap-stop",
        nameZh: "中縫擋條",
        nameEn: "Gap stop",
        material: input.material,
        grainDirection: "length",
        visible: { length: topLen, width: gap, thickness: topT },
        origin: { x: topOriginX, y: top.origin.y, z: 0 },
        tenons: [],
        mortises: [],
      };
      design.parts.splice(idx, 1, front, back, stop);
    } else {
      // 中央凹槽：槽底板 24 厚，頂面比桌面低 wellDepth；兩側各一條 20×20 墊條鎖在桌面內側撐住槽底
      const trayT = 24;
      const trayTopY = H - wellDepth;
      const tray: Part = {
        id: "center-well-bottom",
        nameZh: "中央工具槽底板",
        nameEn: "Centre tool-well bottom",
        material: input.material,
        grainDirection: "length",
        visible: { length: topLen, width: centerWell, thickness: trayT },
        origin: { x: topOriginX, y: trayTopY - trayT, z: 0 },
        tenons: [],
        mortises: [],
      };
      const cleats: Part[] = ([-1, 1] as const).map((sz) => ({
        id: `center-well-cleat-${sz < 0 ? "f" : "b"}`,
        nameZh: sz < 0 ? "中央槽墊條（前片內側）" : "中央槽墊條（後片內側）",
        nameEn: sz < 0 ? "Centre well cleat (front slab)" : "Centre well cleat (back slab)",
        material: input.material,
        grainDirection: "length",
        visible: { length: topLen - 40, width: 20, thickness: 20 },
        origin: { x: topOriginX, y: trayTopY - trayT - 20, z: sz * (centerWell / 2 - 10) },
        tenons: [],
        mortises: [],
      }));
      design.parts.splice(idx, 1, front, back, tray, ...cleats);
    }
    topPieces.push(front, back);
  } else {
    topPieces.push(top);
  }
  /** 找到蓋住世界 z 的桌面片（縫裡沒有片就回 null） */
  const topPieceAt = (z: number, margin: number): Part | null => {
    for (const p of topPieces) {
      if (Math.abs(z - p.origin.z) <= p.visible.width / 2 - margin) return p;
    }
    return null;
  };

  // ── 工具槽（Sellers well board：槽底板 + 後擋板 + 兩端板，鎖在桌面後緣） ──
  if (wellWidth > 0) {
    const wellT = 24; // Sellers well board 25；18 跨 1.7m 會自己觸發撓度警告
    const wellH = wellDepth + wellT;
    const wellY = H - wellH;
    const zFront = workW / 2; // 工作面後緣
    design.parts.push({
      id: "well-bottom",
      nameZh: "工具槽底板",
      nameEn: "Tool well bottom",
      material: input.material,
      grainDirection: "length",
      visible: { length: L - 2 * wellT, width: wellWidth - wellT, thickness: wellT },
      origin: { x: 0, y: wellY, z: zFront + (wellWidth - wellT) / 2 },
      tenons: [],
      mortises: [],
    });
    design.parts.push({
      id: "well-back",
      nameZh: "工具槽後擋板",
      nameEn: "Tool well back",
      material: input.material,
      grainDirection: "length",
      visible: { length: L - 2 * wellT, width: wellT, thickness: wellH },
      origin: { x: 0, y: wellY, z: zFront + wellWidth - wellT / 2 },
      tenons: [],
      mortises: [],
    });
    for (const sx of [-1, 1] as const) {
      design.parts.push({
        id: `well-end-${sx < 0 ? "r" : "l"}`,
        nameZh: sx < 0 ? "工具槽右端板" : "工具槽左端板",
        nameEn: sx < 0 ? "Tool well right end" : "Tool well left end",
        material: input.material,
        grainDirection: "width",
        visible: { length: wellT, width: wellWidth, thickness: wellH },
        origin: { x: sx * (L / 2 - wellT / 2), y: wellY, z: zFront + wellWidth / 2 },
        tenons: [],
        mortises: [],
      });
    }
  }

  // ── 前鉗位置（先算，狗孔要避開它） ──
  const jaw = VISE_JAW_MM[frontViseSize] ?? 180;
  const viseLegCenterX = frameDx + sideSign * (frameL / 2 - legSize / 2);   // 鉗那側的腳中心
  const viseLegInnerEdge = viseLegCenterX - sideSign * (legSize / 2);       // 那支腳朝桌中心的面
  const ovVise = sideSign > 0 ? ovPlus : ovMinus;
  // 懸出夠長 → 鉗裝在腳外側（靠桌端）；不夠 → 裝在腳內側
  const fitsOutside = frontVise === "quick" && ovVise >= jaw + 80;
  let viseX: number | null = null;
  if (frontVise === "quick") {
    viseX = fitsOutside ? sideSign * (L / 2 - 60 - jaw / 2) : viseLegInnerEdge - sideSign * (20 + jaw / 2);
  } else if (frontVise === "leg") {
    viseX = viseLegCenterX; // 腳鉗就在前腳上
  }
  const viseHalfSpan = frontVise === "leg" ? Math.max(150, legSize + 40) / 2 : jaw / 2;

  // ── 狗孔 / holdfast 孔 ──
  let dogCount = 0;
  let holdfastCount = 0;
  let planingStopX: number | null = null;
  const rowZ = topFrontZ + Math.max(dogHoleFrontOffsetRaw, 2 * dogHoleDiaRow + 10);
  const rearRowZ = workW / 2 - Math.max(dogHoleFrontOffsetRaw, 2 * dogHoleDiaRow + 10);
  const viseX2 = doubleSided && viseX !== null ? -viseX : null; // 對側那支：另一端、桌後緣
  if (dogHoles === "row") {
    const dia = dogHoleDiaRow;
    // 從鉗（或桌端）起算，往另一端走；端頭留 100；尾鉗那端要在槽前停下
    // 從鉗口桌狗（木顎中心 x）起算整數個孔距，跳過落在鉗本體上方的那幾格（木匠：狗孔列要跟鉗口桌狗成一組）
    const startX = viseX !== null
      ? viseX - sideSign * dogHolePitchRaw * Math.ceil((viseHalfSpan + 20) / dogHolePitchRaw)
      : sideSign * (L / 2 - 100);
    const farLimit = wagon ? L / 2 - (WAGON_END_CAP_T + 30 + WAGON_SLOT_L + 60) : L / 2 - 100;
    const endX = -sideSign * farLimit;
    const span = Math.abs(endX - startX);
    let pitch = dogHolePitchRaw;
    const nWanted = Math.floor(span / pitch) + 1;
    if (nWanted > MAX_DOG_HOLES) {
      pitch = Math.ceil(span / (MAX_DOG_HOLES - 1) / 10) * 10;
      warnings.push(isEn ? `${nWanted} dog holes is too many; pitch widened ${dogHolePitchRaw} → ${pitch}.` : `狗孔 ${nWanted} 個太多，孔距已從 ${dogHolePitchRaw} 拉大到 ${pitch}。`);
    }
    let x = startX;
    // 刨擋佔掉第一格
    if (planingStop) { planingStopX = x; x -= sideSign * pitch; }
    for (; sideSign * (x - endX) >= -0.5 && dogCount < MAX_DOG_HOLES; x -= sideSign * pitch) {
      const piece = topPieceAt(rowZ, dia / 2 + 5);
      if (piece) {
        piece.mortises.push(roundHole(x - piece.origin.x, topT, rowZ - piece.origin.z, dia, topT));
        dogCount++;
      }
    }
    // 雙面桌：後緣一列，從對側那支鉗往另一端走
    if (viseX2 !== null) {
      let x2 = viseX2 + sideSign * (viseHalfSpan + 50);
      for (let n = 0; -sideSign * (x2 + sideSign * (L / 2 - 100)) <= 0.5 && Math.abs(x2) <= L / 2 - 100 + 0.5 && n < MAX_DOG_HOLES; n++, x2 += sideSign * pitch) {
        const piece = topPieceAt(rearRowZ, dia / 2 + 5);
        if (piece) {
          piece.mortises.push(roundHole(x2 - piece.origin.x, topT, rearRowZ - piece.origin.z, dia, topT));
          dogCount++;
        }
      }
    }
    if (holdfastHoles) {
      // 後排：距後緣 100、孔距 ≥ 300、跟前排錯開半格（Schwarz：16" apart, staggered）；雙面桌改中央一列
      const hz = doubleSided ? 0 : workW / 2 - 100;
      const hp = Math.max(2 * pitch, 300);
      let hx = startX - sideSign * pitch / 2;
      while (Math.abs(hx) <= L / 2 - 120 && holdfastCount < 12) {
        const piece = topPieceAt(hz, dia / 2 + 5);
        if (piece) {
          piece.mortises.push(roundHole(hx - piece.origin.x, topT, hz - piece.origin.z, dia, topT));
          holdfastCount++;
        }
        hx -= sideSign * hp;
      }
    }
  } else if (dogHoles === "grid") {
    const dia = dogHoleDiaRow;
    const pitch = 96;
    const margin = 60;
    const cols = Math.max(1, Math.floor((L - 2 * margin) / pitch) + 1);
    const rowsWanted = Math.max(1, Math.floor((workW - 2 * margin) / pitch) + 1);
    const rows = Math.max(1, Math.min(rowsWanted, Math.floor(MAX_GRID_HOLES / cols)));
    if (rows < rowsWanted) warnings.push(isEn ? `20mm grid: only the front ${rows} of ${rowsWanted} rows are drawn (render limit ${MAX_GRID_HOLES} holes); drill the rest at the same 96mm pitch.` : `20mm 格陣 ${cols}×${rowsWanted} 太多孔，圖上只畫前 ${rows} 排（上限 ${MAX_GRID_HOLES} 孔）；其餘照 96mm 間距鑽完。`);
    const x0 = -((cols - 1) * pitch) / 2;
    const zStart = topFrontZ + margin;
    for (let r = 0; r < rows; r++) {
      const z = zStart + r * pitch;
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * pitch;
        // 避開鉗那一塊
        if (viseX !== null && Math.abs(x - viseX) < viseHalfSpan + 30 && z < -workW / 2 + 200) continue;
        const piece = topPieceAt(z, dia / 2 + 5);
        if (!piece) continue;
        piece.mortises.push(roundHole(x - piece.origin.x, topT, z - piece.origin.z, dia, topT));
        dogCount++;
      }
    }
    if (planingStop) planingStopX = sideSign * (L / 2 - 120);
  } else if (planingStop) {
    planingStopX = viseX !== null ? viseX - sideSign * (viseHalfSpan + 80) : sideSign * (L / 2 - 120);
  }

  // ── 刨擋：木方柱 + 桌面方形貫穿榫孔（榫在柱底、從桌面上方插入） ──
  if (planingStop && planingStopX !== null) {
    const s = PLANING_STOP_MM;
    const z = Math.max(rowZ, topFrontZ + s / 2 + 40);
    const piece = topPieceAt(z, s / 2 + 5);
    if (!piece) {
      warnings.push(isEn ? "Planing stop skipped: no solid top where it would sit." : "刨擋位置落在中縫裡，已略過。");
    } else {
      if (topT < 75) warnings.push(isEn ? `Top ${topT}mm is thin for a friction-fit planing stop (≥75 recommended).` : `桌面 ${topT}mm 偏薄，刨擋方柱靠摩擦卡住，建議 ≥75。`);
      piece.mortises.push({
        origin: { x: planingStopX - piece.origin.x, y: topT, z: z - piece.origin.z },
        depth: topT,
        length: s,
        width: s,
        through: true,
      });
      design.parts.push({
        id: "planing-stop",
        nameZh: "刨擋方柱",
        nameEn: "Planing stop",
        material: input.material,
        grainDirection: "length",
        visible: { length: s, width: s, thickness: PLANING_STOP_PROUD_MM },
        origin: { x: planingStopX, y: H, z },
        tenons: [{ position: "bottom", type: "through-tenon", length: topT, width: s, thickness: s }],
        mortises: [],
      });
    }
  }

  // ── 前鉗（快速鉗）：可放前緣（zSign −1）或雙面桌的後緣（zSign +1） ──
  let viseHardwareNote = "";
  const addQuickVise = (vx: number, zSign: -1 | 1, idPrefix: string, labelZh: string, labelEn: string) => {
    const spacerH = Math.max(0, VISE_MIN_EDGE_MM - topT);
    const bodyTopY = legHeight - spacerH;
    const screwY = bodyTopY - VISE_BODY_HEIGHT_MM / 2;
    const chopH = H - (bodyTopY - VISE_BODY_HEIGHT_MM);
    const edgeZ = zSign < 0 ? topFrontZ : workW / 2;
    const innerZ = edgeZ + zSign * (VISE_INNER_JAW_T_MM / 2);
    const chopZ = edgeZ + zSign * (VISE_INNER_JAW_T_MM + VISE_CHOP_T_MM / 2);
    // 鉗本體要躲在裙板後面（builder 把裙板置中在腳裡，不是齊腳面 → 用實際零件算後面在哪）。
    // 鉗裝在腳外側的懸出段時，那裡沒有裙板，本體直接貼桌面邊緣下方。
    const apronPart = withApron ? design.parts.find((p) => p.id === (zSign < 0 ? "apron-front" : "apron-back")) : undefined;
    const apronCoversVise = !!apronPart && Math.abs(vx - apronPart.origin.x) + jaw / 2 <= apronPart.visible.length / 2;
    const bodyEdgeZ = apronCoversVise && apronPart ? apronPart.origin.z - zSign * (apronThickness / 2) : zSign * (workW / 2);
    const bodyCenterZ = bodyEdgeZ - zSign * (VISE_BODY_DEPTH_MM / 2);
    const screwLocalY = screwY - (bodyTopY - VISE_BODY_HEIGHT_MM);
    const faceZ = zSign * (VISE_CHOP_T_MM / 2);
    // 內顎板：貼在桌面前緣、跟木顎同樣的螺桿 + 導桿三孔（孔位一對一對應，鎖上鉗才對得準）
    design.parts.push({
      id: `${idPrefix}inner-jaw`,
      nameZh: `${labelZh}內顎板（貼桌面前緣）`,
      nameEn: `${labelEn} inner jaw (on the bench edge)`,
      material: input.material,
      grainDirection: "length",
      visible: { length: jaw, width: VISE_INNER_JAW_T_MM, thickness: chopH },
      origin: { x: vx, y: H - chopH, z: innerZ },
      tenons: [],
      mortises: [
        roundHole(0, screwLocalY, zSign * (VISE_INNER_JAW_T_MM / 2), 30, VISE_INNER_JAW_T_MM),
        roundHole(-(jaw / 2 - 35), screwLocalY, zSign * (VISE_INNER_JAW_T_MM / 2), 20, VISE_INNER_JAW_T_MM),
        roundHole(jaw / 2 - 35, screwLocalY, zSign * (VISE_INNER_JAW_T_MM / 2), 20, VISE_INNER_JAW_T_MM),
      ],
    });
    // 木顎：三孔對應內顎板；頂面再一個 Ø19 桌狗孔（跟桌面狗孔列同一條線夾長料）
    design.parts.push({
      id: `${idPrefix}chop`,
      nameZh: `${labelZh}木顎`,
      nameEn: `${labelEn} chop`,
      material: input.material,
      grainDirection: "length",
      visible: { length: jaw, width: VISE_CHOP_T_MM, thickness: chopH },
      origin: { x: vx, y: H - chopH, z: chopZ },
      tenons: [],
      mortises: [
        roundHole(0, screwLocalY, faceZ, 30, VISE_CHOP_T_MM),
        roundHole(-(jaw / 2 - 35), screwLocalY, faceZ, 20, VISE_CHOP_T_MM),
        roundHole(jaw / 2 - 35, screwLocalY, faceZ, 20, VISE_CHOP_T_MM),
        { ...roundHole(0, chopH, 0, dogHoleDiaRow, 60), through: false, label: isEn ? "vise dog" : "鉗口桌狗孔" },
      ],
    });
    // 鉗本體鎖桌底的 4 支木牙螺栓：桌面底面預鑽 Ø8 深 40（四角，離本體邊 20）
    // cosmetic（audit-joints 才不會找不到配對的榫）；3D 走圓柱塞不走布林（PerspectiveView 盲孔也用塞）
    const topPieceForVise = topPieceAt(bodyCenterZ, VISE_BODY_DEPTH_MM / 2 - 15) ?? top;
    for (const sx of [-1, 1] as const) for (const sz of [-1, 1] as const) {
      const hx = vx + sx * (jaw / 2 - 20) - topPieceForVise.origin.x;
      const hz = bodyCenterZ + sz * (VISE_BODY_DEPTH_MM / 2 - 20) - topPieceForVise.origin.z;
      if (Math.abs(hx) < topPieceForVise.visible.length / 2 - 10 && Math.abs(hz) < topPieceForVise.visible.width / 2 - 10) {
        topPieceForVise.mortises.push({ origin: { x: hx, y: 0, z: hz }, depth: 40, length: 8, width: 8, through: false, shape: "round", cosmetic: true, label: isEn ? "vise lag bolt" : "鉗座螺栓孔" });
      }
    }
    if (spacerH > 0) {
      design.parts.push({
        id: `${idPrefix}spacer`,
        nameZh: `${labelZh}鉗座墊塊`,
        nameEn: `${labelEn} spacer block`,
        material: input.material,
        grainDirection: "length",
        visible: { length: jaw, width: VISE_BODY_DEPTH_MM, thickness: spacerH },
        origin: { x: vx, y: bodyTopY, z: bodyCenterZ },
        tenons: [],
        mortises: [],
      });
    }
    design.parts.push({
      id: `${idPrefix}body`,
      nameZh: `鑄鐵快速鉗本體（${frontViseSize === "9in" ? "9" : "7"} 吋）`,
      nameEn: `Quick-release vise body (${frontViseSize === "9in" ? "9" : "7"}")`,
      material: input.material,
      grainDirection: "length",
      visible: { length: jaw, width: VISE_BODY_DEPTH_MM, thickness: VISE_BODY_HEIGHT_MM },
      origin: { x: vx, y: bodyTopY - VISE_BODY_HEIGHT_MM, z: bodyCenterZ },
      visual: "metal",
      tenons: [],
      mortises: [],
    });
    design.parts.push({
      id: `${idPrefix}handle`,
      nameZh: `${labelZh}手把`,
      nameEn: `${labelEn} handle`,
      material: input.material,
      grainDirection: "length",
      visible: { length: 220, width: 20, thickness: 20 },
      origin: { x: vx, y: screwY - 10, z: chopZ + zSign * (VISE_CHOP_T_MM / 2 + 45) },
      shape: { kind: "round", axis: "x" },
      visual: "metal",
      tenons: [],
      mortises: [],
    });
    // 裙板讓螺桿 + 導桿穿過。裙板零件帶 rotation.x=π/2：mesh-local y 是板厚軸（0~厚）、
    // z 是板高軸（±裙板高/2，旋轉後變成世界的上下），§M1。
    if (apronCoversVise && apronPart) {
      const apronCenterY = apronPart.origin.y + apronWidth / 2;
      const localZ = screwY - apronCenterY;
      if (Math.abs(localZ) < apronWidth / 2 - 20) {
        const lx = vx - apronPart.origin.x;
        apronPart.mortises.push(
          roundHole(lx, 0, localZ, 30, apronThickness),
          roundHole(lx - (jaw / 2 - 35), 0, localZ, 20, apronThickness),
          roundHole(lx + (jaw / 2 - 35), 0, localZ, 20, apronThickness),
        );
      }
    }
    return spacerH;
  };
  if (frontVise === "quick" && viseX !== null) {
    const spacerH = addQuickVise(viseX, -1, "vise-", "前鉗", "Front vise");
    if (spacerH > 0) warnings.push(isEn ? `Top is ${topT}mm; a quick-release vise wants ${VISE_MIN_EDGE_MM}mm at the front edge — a ${spacerH}mm spacer block was added under the top.` : `桌面 ${topT}mm 不到快速鉗要的 ${VISE_MIN_EDGE_MM}mm，已在桌底加 ${spacerH}mm 鉗座墊塊。`);
    if (viseX2 !== null) addQuickVise(viseX2, 1, "vise2-", "對側鉗", "Second vise");
    viseHardwareNote = isEn
      ? `Hardware: ${viseX2 !== null ? "2 × " : ""}${frontViseSize === "9in" ? "9" : "7"}" quick-release bench vise (jaw ${jaw}mm) + 4 lag bolts each.`
      : `五金：${viseX2 !== null ? "2 支" : ""}${frontViseSize === "9in" ? "9" : "7"} 吋鑄鐵快速鉗（鉗口 ${jaw}mm）＋ 各 4 支鎖桌底的木牙螺栓。`;
  } else if (frontVise === "leg" && viseX !== null) {
    const chopW = Math.max(150, legSize + 40);
    const chopBottomY = 100;
    const chopH = H - chopBottomY;
    const screwY = H - 200; // Benchcrafted：螺桿約 8" 在桌面下
    const guideY = lowerStretcherHeight + lowerStretcherWidth + 40; // 平行導件槽要避開橫撐榫
    const chopZ = -workW / 2 - LEG_VISE_CHOP_T / 2;
    design.parts.push({
      id: "leg-vise-chop",
      nameZh: "腳鉗木顎",
      nameEn: "Leg vise chop",
      material: input.material,
      grainDirection: "length",
      visible: { length: chopW, width: LEG_VISE_CHOP_T, thickness: chopH },
      origin: { x: viseX, y: chopBottomY, z: chopZ },
      tenons: [],
      mortises: [
        roundHole(0, screwY - chopBottomY, -LEG_VISE_CHOP_T / 2, 32, LEG_VISE_CHOP_T),
      ],
    });
    design.parts.push({
      id: "leg-vise-handle",
      nameZh: "腳鉗手把",
      nameEn: "Leg vise handle",
      material: input.material,
      grainDirection: "length",
      visible: { length: 300, width: 24, thickness: 24 },
      origin: { x: viseX, y: screwY - 12, z: chopZ - LEG_VISE_CHOP_T / 2 - 50 },
      shape: { kind: "round", axis: "x" },
      visual: "metal",
      tenons: [],
      mortises: [],
    });
    // 那支前腳：螺桿圓孔 + 平行導件方槽（都是前後貫穿）
    const viseLeg = design.parts
      .filter((p) => p.id.startsWith("leg-") && !p.id.startsWith("leg-vise"))
      .sort((a, b) => Math.hypot(a.origin.x - viseX!, a.origin.z + workW / 2) - Math.hypot(b.origin.x - viseX!, b.origin.z + workW / 2))[0];
    if (viseLeg) {
      viseLeg.mortises.push(
        roundHole(0, screwY, -legSize / 2, 32, legSize),
        { origin: { x: 0, y: guideY + 20, z: -legSize / 2 }, depth: legSize, length: 40, width: 25, through: true, label: isEn ? "parallel guide slot" : "平行導件槽" },
      );
      // 平行導件木條：鎖在木顎底、穿過腳、露出腳後 120，一排 Ø10 銷孔（插銷擋住木顎下端才夾得平）
      const guideProud = 120;
      const pinHoles: Mortise[] = [];
      for (let gx = -guideProud / 2 + 15; gx <= guideProud / 2 - 10; gx += 25) pinHoles.push(roundHole(gx, 40, 0, 10, 40));
      design.parts.push({
        id: "leg-vise-guide",
        nameZh: "腳鉗平行導件（穿腳，露出腳後 120）",
        nameEn: "Leg vise parallel guide (through the leg)",
        material: input.material,
        grainDirection: "length",
        // rotation.y = π/2：length 軸轉到世界 Z（前後向）；「end」= 世界 −Z 那頭 = 穿進腳的榫
        visible: { length: guideProud, width: 25, thickness: 40 },
        origin: { x: viseLeg.origin.x, y: guideY, z: viseLeg.origin.z + legSize / 2 + guideProud / 2 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        tenons: [{ position: "end", type: "through-tenon", length: legSize, width: 40, thickness: 25 }],
        mortises: pinHoles,
      });
    }
    viseHardwareNote = isEn
      ? "Hardware: leg-vise screw (wood Ø70 or imported kit) + parallel guide bar with pin holes."
      : "五金：腳鉗螺桿（自製 Ø70 木螺桿或進口套件）＋ 平行導件木條（鑽一排銷孔）。";
  }

  // ── 尾鉗（wagon）：桌尾 100 端蓋 + 桌面 365×52 貫穿槽 + 露頭滑塊狗 + 螺桿手輪（滑塊五金列清單） ──
  if (wagon) {
    const xE = wagonSign * (L / 2);
    const capX = xE - wagonSign * (WAGON_END_CAP_T / 2);
    const slotCx = xE - wagonSign * (WAGON_END_CAP_T + 30 + WAGON_SLOT_L / 2);
    const capZ = top.origin.z;
    design.parts.push({
      id: "end-cap",
      nameZh: "尾鉗端蓋",
      nameEn: "Tail vise end cap",
      material: input.material,
      grainDirection: "width",
      visible: { length: WAGON_END_CAP_T, width: workW + frontOverhang, thickness: topT },
      origin: { x: capX, y: legHeight, z: capZ },
      tenons: [],
      mortises: [roundHole(wagonSign * (WAGON_END_CAP_T / 2), topT / 2, rowZ - capZ, 25, WAGON_END_CAP_T)],
    });
    const piece = topPieceAt(rowZ, WAGON_SLOT_W / 2 + 5) ?? top;
    piece.mortises.push({
      origin: { x: slotCx - piece.origin.x, y: topT, z: rowZ - piece.origin.z },
      depth: topT,
      length: WAGON_SLOT_L,
      width: WAGON_SLOT_W,
      through: true,
      cosmetic: true,
      label: isEn ? "wagon vise slot" : "尾鉗滑塊槽",
    });
    // 滑塊狗頭是五金的一部分（買現成），不畫；槽跟狗孔列同線即可
    design.parts.push({
      id: "wagon-screw",
      nameZh: "尾鉗螺桿（露出段）",
      nameEn: "Wagon vise screw",
      material: input.material,
      grainDirection: "length",
      visible: { length: 60, width: 28, thickness: 28 },
      origin: { x: xE + wagonSign * 30, y: H - topT / 2 - 14, z: rowZ },
      shape: { kind: "round", axis: "x" },
      visual: "metal",
      tenons: [],
      mortises: [],
    });
    design.parts.push({
      id: "wagon-wheel",
      nameZh: "尾鉗手輪",
      nameEn: "Wagon vise hand wheel",
      material: input.material,
      grainDirection: "length",
      visible: { length: 30, width: 150, thickness: 150 },
      origin: { x: xE + wagonSign * 75, y: H - topT / 2 - 75, z: rowZ },
      shape: { kind: "round", axis: "x" },
      visual: "metal",
      tenons: [],
      mortises: [],
    });
    if (topT < 95) warnings.push(isEn ? `Wagon vise hardware is designed for a ≥95mm top; yours is ${topT} — shim the guide rails from below.` : `尾鉗五金是給 ≥95mm 桌面設計的，目前 ${topT}：導軌要從桌底墊高到 95。`);
  }

  // ── 桌面底穿帶（燕尾）：兩端各一條 60×30，放在腳外側緊鄰腳（避開鉗本體與尾鉗槽），滑入桌底燕尾槽 ──
  const topBattens = topBattensRaw && topBuild !== "stack";
  if (topBattensRaw && !topBattens) warnings.push(isEn ? "Battens skipped: a laminated sheet top does not cup, and the layers have nowhere to take a dovetail." : "疊層桌面不會翹、也批不出燕尾槽，穿帶已略過。");
  if (topBattens) {
    const battenLen = workW + frontOverhang - 40; // 兩端各留 20 不出邊（止燕尾）
    for (const sx of [-1, 1] as const) {
      const legOuterX = frameDx + sx * (frameL / 2);
      let bx = legOuterX + sx * 40;
      // 鉗那端：鉗本體佔掉桌底，穿帶要擠在腳外面與鉗本體之間（9" 鉗 + 尾鉗把懸出縮到 305 時只剩 20 就放不下）
      if (frontVise === "quick" && viseX !== null && fitsOutside && Math.sign(viseX) === sx) {
        const bodyInner = Math.abs(viseX) - jaw / 2;
        const maxCenter = bodyInner - 30 - 10;
        if (maxCenter - Math.abs(legOuterX) < 30) {
          warnings.push(isEn ? `No room for a batten between the ${sx > 0 ? "left" : "right"} leg and the vise body; only the other end gets one.` : `${sx > 0 ? "左" : "右"}端腳外面到鉗本體之間放不下穿帶，只做另一端。`);
          continue;
        }
        bx = sx * Math.min(Math.abs(bx), maxCenter);
      }
      design.parts.push({
        id: `top-batten-${sx < 0 ? "r" : "l"}`,
        nameZh: sx < 0 ? "桌面穿帶（右）" : "桌面穿帶（左）",
        nameEn: sx < 0 ? "Top batten (right)" : "Top batten (left)",
        material: input.material,
        grainDirection: "length",
        // rotation.y = π/2：length 軸轉到世界 Z（跨桌面深度方向）
        visible: { length: battenLen, width: 60, thickness: 30 },
        origin: { x: bx, y: legHeight - 30, z: top.origin.z },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  // ── 兩端封邊板（breadboard end）：60 寬、木紋跟桌面垂直；長孔鬆配寫在說明 ──
  if (breadboardEnds) {
    for (const sx of [-1, 1] as const) {
      design.parts.push({
        id: `breadboard-${sx < 0 ? "r" : "l"}`,
        nameZh: sx < 0 ? "右端封邊板" : "左端封邊板",
        nameEn: sx < 0 ? "Right breadboard end" : "Left breadboard end",
        material: input.material,
        grainDirection: "length",
        visible: { length: workW + frontOverhang, width: 60, thickness: topT },
        origin: { x: sx * (L / 2 - 30), y: legHeight, z: top.origin.z },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  // ── 長板靠板（sliding deadman）：前下橫撐上一條 45° 脊條 + 桌底軌條 + 帶孔滑板 ──
  const lsFront = design.parts.find((p) => p.id === "ls-front");
  const deadman = deadmanRaw && frontVise !== "none" && !!lsFront && frontOverhang === 0 && drawerCountRaw === 0 && (frontVise === "leg" || fitsOutside);
  if (deadmanRaw && !deadman) warnings.push(isEn
    ? "Sliding deadman skipped: it needs a front vise mounted outboard of the leg (enough end overhang), a front lower stretcher, a flush front edge and no drawers."
    : "長板靠板已略過：要有前下橫撐、前緣齊平、沒有抽屜，而且前鉗要裝在腳外側（桌端懸出要夠）。");
  let deadmanRidgeZ = 0;
  if (deadman && lsFront) {
    const lsT = lowerStretcherThickness;
    const lsTop = lowerStretcherHeight + lowerStretcherWidth;
    deadmanRidgeZ = lsFront.origin.z - lsT / 2 + 12.5;
    design.parts.push({
      id: "deadman-ridge",
      nameZh: "靠板脊條（前橫撐上，刨成 45°）",
      nameEn: "Deadman ridge strip (bevelled 45°)",
      material: input.material,
      grainDirection: "length",
      visible: { length: lsFront.visible.length, width: 25, thickness: 25 },
      origin: { x: lsFront.origin.x, y: lsTop, z: deadmanRidgeZ },
      shape: { kind: "chamfered-top", chamferMm: 11, style: "chamfered" },
      tenons: [],
      mortises: [],
    });
    design.parts.push({
      id: "deadman-rail",
      nameZh: "靠板上軌（桌底）",
      nameEn: "Deadman top rail",
      material: input.material,
      grainDirection: "length",
      visible: { length: Math.max(100, frameL - 2 * legSize - 50), width: 25, thickness: 25 },
      origin: { x: frameDx, y: legHeight - 25, z: deadmanRidgeZ },
      tenons: [],
      mortises: [],
    });
    const boardH = (legHeight - 25) - (lsTop + 25) - 2;
    const boardX = viseLegInnerEdge - sideSign * (30 + 90);
    const holes: Mortise[] = [];
    for (let hy = 60; hy <= boardH - 60; hy += 100) holes.push(roundHole(0, hy, -20, dogHoleDiaRow, 40));
    design.parts.push({
      id: "deadman-board",
      nameZh: "長板靠板（滑板）",
      nameEn: "Sliding deadman board",
      material: input.material,
      grainDirection: "length",
      visible: { length: 180, width: 40, thickness: boardH },
      origin: { x: boardX, y: lsTop + 26, z: deadmanRidgeZ },
      tenons: [],
      mortises: holes,
    });
  }

  // ── 前腳 holdfast／插銷孔列：兩支前腳正面各一列 Ø19（Roubo：長料一端在前鉗、另一端靠腳用 holdfast 壓） ──
  if (legHoles) {
    const frontLegs = design.parts.filter((p) => /^leg-\d$/.test(p.id) && p.origin.z < 0);
    for (const leg of frontLegs) {
      const yTop = legHeight - 120;
      const yBot = lowerStretcherHeight + lowerStretcherWidth + 120;
      const n = Math.max(1, Math.floor((yTop - yBot) / 150) + 1);
      const step = n > 1 ? (yTop - yBot) / (n - 1) : 0;
      for (let i = 0; i < n; i++) {
        // 腳零件：length=legSize(x)、width=legSize(z)、thickness=腳高(y)；前面 = mesh-local −z
        leg.mortises.push({ ...roundHole(0, yTop - i * step, -legSize / 2, dogHoleDiaRow, legSize), label: isEn ? "leg holdfast hole" : "前腳 holdfast 孔" });
      }
    }
  }

  // ── 桌下抽屜櫃：坐在下橫撐上，櫃頂離桌底 ≥ 210 給 holdfast 桿（硬夾制） ──
  let drawerCount = withLowerStretchers && !deadman ? drawerCountRaw : 0;
  if (drawerCountRaw > 0 && !withLowerStretchers) warnings.push(isEn ? "Drawers need lower stretchers to sit on; skipped." : "抽屜櫃要坐在下橫撐上，請先打開下橫撐；已略過。");
  if (drawerCount > 0) {
    const lsT = lowerStretcherThickness;
    const caseY = lowerStretcherHeight + lowerStretcherWidth;
    // 有裙板時櫃頂還要躲到裙板底下（裙板佔掉桌底那一段）
    const apronBottomY = withApron ? legHeight - apronWidth - 5 : Infinity;
    const caseTop = Math.min(legHeight - DRAWER_CLEARANCE, apronBottomY);
    const caseH = caseTop - caseY;
    if (caseH < 120) {
      warnings.push(isEn ? `Drawer cabinet skipped: only ${caseH}mm left between the stretchers and the ${DRAWER_CLEARANCE}mm holdfast clearance under the top.` : `抽屜櫃已略過：橫撐頂到桌底扣掉 holdfast 淨空 ${DRAWER_CLEARANCE} 只剩 ${caseH}mm，放不下抽屜。桌高加高或下橫撐放低再試。`);
      drawerCount = 0;
    } else {
      // 面板半蓋會比櫃體前面凸 18：櫃深再退 30、中心後移 15，面板前緣留在腳前面後方 ≥ 20（腳鉗木顎才不會撞面板）
      const caseW = frameL - 2 * legSize - 6;
      const caseD = workW - legSize + lsT - 34;
      const cab = caseFurniture({
        category: "nightstand",
        nameZh: "桌下抽屜櫃",
        length: caseW,
        width: caseD,
        height: caseH,
        material: input.material,
        shelfCount: 0,
        zones: [{ type: "drawer", heightMm: caseH - 36, count: drawerCount, cols: 1 }],
        legHeight: 0,
        // inset + 無滑軌時 caseFurniture 的抽屜箱會比櫃深 3mm（穿背板）；半蓋 + 釘底 0 穿模（2026-09-04 實測）
        drawerMount: "overlay-3",
        drawerBottomMode: "surface",
        drawerSlideGap: 0,
        drawerBoxJoinery: "lap",
        pullStyle: "wood-knob",
        backMode: "surface",
        panelThickness: 15,
      });
      for (const p of cab.parts) {
        design.parts.push({ ...p, id: `drawer-cab-${p.id}`, origin: { x: p.origin.x + frameDx, y: p.origin.y + caseY, z: p.origin.z + 15 } });
      }
      if (withApron) warnings.push(isEn ? "Drawers AND a deep apron leave nowhere for clamps to reach the top — pick one, or put drawers only in the end overhang." : "抽屜櫃加上裙板，夾具會沒地方夾桌面：二選一，或只在桌端懸出段做抽屜。");
    }
  }

  // ── 桌上加高小鉗（Moxon）：兩片顎板 + 兩支螺桿放桌面後側靠前鉗那端 ──
  const moxon = moxonRaw && !doubleSided;
  if (moxonRaw && doubleSided) warnings.push(isEn ? "Moxon vise skipped on a double-sided bench (the back edge is the second person's front)." : "雙面桌沒放加高小鉗：後緣是對面那個人的前緣，沒地方放。");
  if (moxon) {
    const mx = sideSign * (L / 2 - 450);
    const jzFront = workW / 2 - 150;
    const jzBack = workW / 2 - 90;
    for (const [id, nameZh, nameEn, jz] of [["moxon-front", "加高小鉗前顎板", "Moxon front jaw", jzFront], ["moxon-back", "加高小鉗後顎板", "Moxon back jaw", jzBack]] as const) {
      design.parts.push({
        id, nameZh, nameEn,
        material: input.material,
        grainDirection: "length",
        visible: { length: 600, width: 40, thickness: 140 },
        origin: { x: mx, y: H, z: jz },
        tenons: [],
        mortises: [roundHole(-220, 70, -20, 20, 40), roundHole(220, 70, -20, 20, 40)],
      });
    }
    for (const sx of [-1, 1] as const) {
      design.parts.push({
        id: `moxon-screw-${sx < 0 ? "r" : "l"}`,
        nameZh: "加高小鉗螺桿（露出段）",
        nameEn: "Moxon screw",
        material: input.material,
        grainDirection: "length",
        visible: { length: 60, width: 20, thickness: 20 },
        origin: { x: mx + sx * 220, y: H + 60, z: jzFront - 20 - 30 },
        shape: { kind: "round", axis: "z" },
        visual: "metal",
        tenons: [],
        mortises: [],
      });
    }
  }

  // ── 附件：V 口壓板（doe's foot）+ 鋸切靠板（bench hook），放桌面後側另一端 ──
  const accessories = accessoriesRaw && !doubleSided;
  if (accessoriesRaw && doubleSided) warnings.push(isEn ? "Accessories skipped on a double-sided bench (no free back edge to park them)." : "雙面桌沒畫附件：桌面後側是對面那個人的工作區，沒地方擺。");
  if (accessories) {
    const ax = -sideSign * (L / 2 - 350);
    design.parts.push({
      id: "doe-foot",
      nameZh: "V 口壓板（doe's foot，端頭鋸 90° V 口）",
      nameEn: "Doe's foot (90° V notch at one end)",
      material: input.material,
      grainDirection: "length",
      visible: { length: 600, width: 60, thickness: 12 },
      origin: { x: ax, y: H, z: workW / 2 - 230 },
      tenons: [],
      mortises: [],
    });
    design.parts.push({
      id: "bench-hook-base",
      nameZh: "鋸切靠板底板",
      nameEn: "Bench hook base",
      material: input.material,
      grainDirection: "length",
      visible: { length: 300, width: 180, thickness: 18 },
      origin: { x: ax, y: H, z: workW / 2 - 100 },
      tenons: [],
      mortises: [],
    });
    design.parts.push({
      id: "bench-hook-stop",
      nameZh: "鋸切靠板擋條",
      nameEn: "Bench hook fence",
      material: input.material,
      grainDirection: "length",
      visible: { length: 180, width: 40, thickness: 20 },
      origin: { x: ax, y: H + 18, z: workW / 2 - 30 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 下層板（架在下橫撐上；缺角讓腳）；有抽屜櫃時櫃底板就是層板 ──
  if (withUnderShelf && drawerCount > 0) warnings.push(isEn ? "Under-shelf skipped: the drawer cabinet bottom already covers the stretchers." : "下層板已略過：抽屜櫃的底板已經蓋住下橫撐。");
  if (withUnderShelf && drawerCount === 0) {
    const shelfT = DEFAULT_SHELF_THICKNESS_MM;
    const stretcherY = lowerStretcherHeight;
    const shelfY = stretcherY + lowerStretcherWidth;
    const lsT = lowerStretcherThickness;
    const shelfLen = Math.max(50, frameL - legSize + lsT);
    // 長板靠板的脊條佔掉前緣 25
    const shelfWid = Math.max(50, workW - legSize + lsT - (deadman ? 25 : 0));
    const notch = (legSize + lsT) / 2;
    if (shelfY < 150) warnings.push(isEn ? `Under-shelf sits ${shelfY}mm off the floor; ≥150 keeps it sweepable.` : `下層板離地 ${shelfY}mm，建議 ≥150 才掃得到地。`);
    design.parts.push({
      id: "under-shelf",
      nameZh: "下層置物板",
      nameEn: "Under shelf",
      material: input.material,
      grainDirection: "length",
      visible: { length: shelfLen, width: shelfWid, thickness: shelfT },
      origin: { x: frameDx, y: shelfY, z: deadman ? 12.5 : 0 },
      shape: { kind: "notched-corners", notchLengthMm: notch, notchWidthMm: notch },
      panelPieces: Math.max(1, Math.ceil(shelfWid / PLANK_MAX_W)),
      tenons: [],
      mortises: [],
    });
  }

  // ── 螺栓可拆：腳上每個橫撐 / 裙板榫眼中心再穿一個 Ø11 貫穿孔（床螺栓） ──
  let boltCount = 0;
  if (knockdown === "bolt") {
    for (const leg of design.parts.filter((p) => /^leg-\d+$/.test(p.id))) {
      const extra: Mortise[] = [];
      for (const m of leg.mortises) {
        if (m.cosmetic || m.shape === "round") continue;
        extra.push({ ...roundHole(m.origin.x, m.origin.y, m.origin.z, 11, legSize), label: isEn ? "M10 bed bolt" : "M10 床螺栓孔" });
        boltCount++;
      }
      leg.mortises.push(...extra);
    }
    if (boltCount === 0) warnings.push(isEn ? "Knockdown selected but there are no stretchers or aprons to bolt — turn on lower stretchers or an apron." : "選了螺栓可拆，但沒有橫撐或裙板可以鎖，請打開下橫撐或裙板。");
  }

  // ── 工具槽時整體往前移半個槽寬，讓桌子在自己的外框裡置中 ──
  if (wellWidth > 0) {
    for (const p of design.parts) p.origin.z -= wellWidth / 2;
  }
  design.overall = { length: L, width: W, thickness: H + (moxon ? 140 : accessories ? 38 : 0) };

  // ── 警告：桌高 vs 身高（含鞋墊、出料台）、抗晃、重量、房門、房間、伸縮、搬運 ──
  const coef = HEIGHT_COEF[heightMode] ?? HEIGHT_COEF.plane;
  const suggested = heightMode === "outfeed" ? sawTableHeightMm - 2 : Math.round(userHeightCm * 10 * coef) + shoeAllowanceMm;
  const modeZh = ({ machine: "機具／組裝", fine: "精細作業", assembly: "組裝／上漆矮桌", outfeed: "桌鋸出料台" } as Record<string, string>)[heightMode] ?? "手刨";
  const modeEn = ({ machine: "machine/assembly", fine: "fine work", assembly: "assembly / finishing", outfeed: "table-saw outfeed" } as Record<string, string>)[heightMode] ?? "hand-planing";
  if (heightMode === "outfeed") {
    if (H > sawTableHeightMm) warnings.push(isEn ? `DANGER: bench (${H}) is ${H - sawTableHeightMm}mm ABOVE the saw table (${sawTableHeightMm}) — the board tail gets lifted and kicks back. Outfeed must be level or 1–2mm lower.` : `危險：桌高 ${H} 比桌鋸台面 ${sawTableHeightMm} 高 ${H - sawTableHeightMm}mm，木料尾端會被抬起反彈。出料台只能同高或低 1~2mm。`);
    else if (H < sawTableHeightMm - 15) warnings.push(isEn ? `Bench is ${sawTableHeightMm - H}mm below the saw table; long boards will droop and catch. Aim for 1–2mm below.` : `桌高比桌鋸台面低 ${sawTableHeightMm - H}mm，長板尾端會下垂卡住；建議只低 1~2mm。`);
    if (frontVise !== "none" || planingStop || wagon) warnings.push(isEn ? "Outfeed use: keep the 30cm nearest the saw free of vise chops, planing stop and dog blocks — face them away from the saw." : "當出料台用時，靠桌鋸那 30cm 前緣不能有鉗木顎、刨擋、露頭狗塊擋木料；把鉗那一端朝離桌鋸的方向擺。");
  } else {
    if (H < suggested - 60) warnings.push(isEn ? `Bench height ${H} is >60mm below the ${modeEn} suggestion for ${userHeightCm}cm (${suggested}mm) — you will stoop.` : `桌高 ${H} 比 ${userHeightCm}cm 身高的${modeZh}建議值 ${suggested}mm 低超過 6cm，長時間會彎腰。鋸短容易加高難：不確定就先做高 25mm，用兩週再鋸腳。`);
    if (H > suggested + 80) warnings.push(isEn ? `Bench height ${H} is >80mm above the ${modeEn} suggestion for ${userHeightCm}cm (${suggested}mm) — you cannot lean body weight into the plane.` : `桌高 ${H} 比 ${userHeightCm}cm 身高的${modeZh}建議值 ${suggested}mm 高超過 8cm，刨削時用不上體重。不確定就先做高 25mm 用兩週，再決定鋸多少。`);
  }
  if (heightMode === "assembly" && dogHoles !== "none") warnings.push(isEn ? "Low assembly / dining-height bench: plug the dog holes with dowels if it doubles as a dining table." : "矮桌兼餐桌用的話，狗孔記得塞木塞，不然卡飯粒。");
  // 房間放不放得下（走道 90cm）
  if (roomLengthCm > 0 && L + 900 > roomLengthCm * 10) warnings.push(isEn ? `Room length ${roomLengthCm}cm minus a 90cm aisle leaves ${Math.max(0, roomLengthCm * 10 - 900)}mm — the bench (${L}) will not fit.` : `房間長 ${roomLengthCm}cm 扣 90cm 走道只剩 ${Math.max(0, roomLengthCm * 10 - 900)}mm，桌長 ${L} 放不下；桌長縮到 ${Math.max(0, roomLengthCm * 10 - 900)} 以下。`);
  if (roomWidthCm > 0 && W + 900 > roomWidthCm * 10) warnings.push(isEn ? `Room width ${roomWidthCm}cm minus a 90cm aisle leaves ${Math.max(0, roomWidthCm * 10 - 900)}mm — the bench depth (${W}) will not fit.` : `房間深 ${roomWidthCm}cm 扣 90cm 走道只剩 ${Math.max(0, roomWidthCm * 10 - 900)}mm，桌深 ${W} 放不下。`);
  // 腳距 ÷ 桌高：Schwarz 6 呎桌兩端各留 19" 剩 34" 腳距（比 1.01）就會晃
  const legSpan = frameL - legSize;
  const spanRatio = legSpan / H;
  if (spanRatio < 0.95) warnings.push(isEn ? `Leg span ${legSpan} is shorter than the bench height ${H}: it will tip when you plane. Reduce end overhang or lengthen the bench.` : `腳距 ${legSpan} 比桌高 ${H} 還短，刨的時候桌子會被推倒；請縮短桌端懸出或把桌子做長。`);
  else if (spanRatio < 1.05) warnings.push(isEn ? `Leg span ${legSpan} vs height ${H} (ratio ${spanRatio.toFixed(2)}): Schwarz's 6ft bench at 1.01 rocks fore-and-aft when planing; shorten the end overhang.` : `腳距 ${legSpan} 對桌高 ${H}（比 ${spanRatio.toFixed(2)}）偏短：Schwarz 的 6 呎桌腳距比 1.01 刨起來會前後晃；請縮短桌端懸出。`);
  // 深度
  if (W > 700 && !doubleSided) warnings.push(isEn ? `Depth ${W}mm: you cannot reach the back edge from the front; 600–650 is plenty for one person.` : `桌深 ${W}mm 站前面搆不到後緣、牆上工具也拿不到；一個人 600~650 就夠。`);
  if (W < 450) warnings.push(isEn ? `Depth ${W}mm is narrow: wide boards will not lie flat for prep.` : `桌深 ${W}mm 偏窄，寬板放不平、備料不方便。`);
  if (doubleSided && W < 800) warnings.push(isEn ? `Double-sided bench should be ≥800 deep (yours ${W}) so two people do not collide.` : `雙面桌兩人面對面，桌深建議 ≥ 800（目前 ${W}）才不會撞手。`);
  // 裙板擋夾具
  if (withApron && apronWidth >= 150 && frontOverhang < 50) warnings.push(isEn ? `Apron ${apronWidth}mm with only ${frontOverhang}mm front overhang: a 4" C-clamp cannot reach the top. Give the top ≥50mm overhang past the apron, or rely on holdfasts.` : `裙板 ${apronWidth}mm 高、桌面前緣只凸出 ${frontOverhang}：4 吋 C 夾夾不到桌面，前緣至少凸出裙板 50mm，或改用 holdfast。`);
  if (withApron && apronWidth > 250) warnings.push(isEn ? "A deep apron is itself a clamping face: mount the front vise flush with it." : "裙板超過 250 本身就是夾持面：前鉗的內顎板跟裙板齊平，夾長板時裙板一起受力。");
  if (holdfastHoles && topT < 75) warnings.push(isEn ? `Top ${topT}mm: holdfasts bite but pop loose easily; 75–90 is the sweet spot.` : `桌面 ${topT}mm：holdfast 咬得住但容易彈出，最穩是 75~90。`);
  if (dogHoles === "row" && !doubleSided && dogCount > 20) warnings.push(isEn ? `${dogCount} dog holes: Schwarz's rule is one row plus ~8 holdfast holes; more holes weaken the top and you will use few of them.` : `狗孔 ${dogCount} 個偏多：Schwarz 的規矩是前緣一排加約 8 個 holdfast 孔就夠，孔多桌面反而變弱、大多用不到。`);
  // 桌面伸縮（USDA Wood Handbook 弦向收縮率；台灣室內 ΔMC 約 6%）
  const shrinkT = topBuild === "stack" ? 0 : (TANGENTIAL_SHRINK[input.material as string] ?? 0) * (topBuild === "stave" ? 0.55 : 1);
  const deltaW = Math.round(((workW + frontOverhang) * (shrinkT / 100) * (DELTA_MC / 30)) * 10) / 10;
  if (deltaW > 6 && (breadboardEnds || wagon)) warnings.push(isEn ? `This top moves about ${deltaW}mm across its width between seasons: glue the end board / end cap only in the middle 150mm and make the outer holes ${Math.ceil(deltaW)}mm slots.` : `這片桌面一年會脹縮約 ${deltaW}mm：封邊板／尾鉗端蓋只在中央 15cm 上膠，外側銷孔、螺栓孔做 ${Math.ceil(deltaW)}mm 長孔，不然桌面會裂。`);
  const rearMortiseNoteZh = deltaW > 10 && legTopJoint === "through" ? `後排兩支腳的桌面榫眼沿深度放寬 ${Math.ceil(deltaW / 2)}mm 讓桌面能動。` : "";
  const rearMortiseNoteEn = deltaW > 10 && legTopJoint === "through" ? `Make the rear legs' top mortises ${Math.ceil(deltaW / 2)}mm wider across the depth so the top can move. ` : "";
  const apronEff = withApron ? apronWidth : 0;
  if (apronEff < 150 && !withLowerStretchers && topT < 60) warnings.push(isEn ? "No deep apron, no lower stretchers and a thin top: nothing resists racking. Add stretchers or an apron ≥ 200mm." : "沒有高裙板、沒有下橫撐、桌面又不到 60mm：沒有任何抗晃構件，刨兩下桌子就走路。請加下橫撐或 ≥200mm 裙板。");
  if (legSize < 80 && !withApron) warnings.push(isEn ? `Legs ${legSize}mm without an apron are light for a bench; ≥80 (thick-top style ≥100) recommended.` : `腳 ${legSize}mm 又沒裙板，對工作桌偏細；建議 ≥80（厚板桌 ≥100）。`);
  const density = MATERIALS[input.material]?.density ?? 600;
  const massKg = design.parts
    .filter((p) => p.visual !== "metal")
    .reduce((s, p) => s + (p.visible.length * p.visible.width * p.visible.thickness) / 1e9 * density, 0);
  if (massKg < 40 && benchStyle === "mft") warnings.push(isEn ? `Estimated weight ${Math.round(massKg)}kg: an MFT-style bench is a clamping / cutting table, not a planing bench — fine for track-saw and router work; put toolboxes on the shelf if you hand-plane on it.` : `估算重量約 ${Math.round(massKg)}kg：孔陣桌是夾持／切割台，不是手刨桌，配軌道鋸、修邊機沒問題；要手刨就把工具箱放到下層板增重。`);
  else if (massKg < 40) warnings.push(isEn ? `Estimated weight ${Math.round(massKg)}kg — a bench this light slides when you plane. Thicker top / bigger legs / under-shelf add mass.` : `估算重量約 ${Math.round(massKg)}kg，這麼輕的桌子一刨就滑；桌面加厚、腳加粗或加下層板都能增重（建議 ≥70kg）。`);
  else if (massKg < 70) warnings.push(isEn ? `Estimated weight ${Math.round(massKg)}kg; ≥70kg feels planted (Schwarz 250 lb, 木頭仁 ≥80kg). An under-shelf loaded with toolboxes is the quickest way to add mass.` : `估算重量約 ${Math.round(massKg)}kg，≥70kg 才不會被推著走（木頭仁教室規格整台 ≥80kg）；加下層板放工具箱是最快的增重法。`);
  // 可拆桌才會自己搬：單件重量（勞動部 / ISO 11228-1：一人 25kg）
  if (knockdown !== "none") {
    // 疊層桌面是幾片分開的板，單件重量要除以層數
    const heaviest = design.parts.filter((p) => p.visual !== "metal").reduce((m, p) => Math.max(m, (p.visible.length * p.visible.width * p.visible.thickness) / 1e9 * density / (topBuild === "stack" && (p.panelPieces ?? 1) > 1 ? (p.panelPieces ?? 1) : 1)), 0);
    if (heaviest > 40) warnings.push(isEn ? `Heaviest single piece ≈ ${Math.round(heaviest)}kg — it will not go up a staircase; split the top (centre gap) or thin it.` : `拆開後最重的一件約 ${Math.round(heaviest)}kg，樓梯搬不上去，可拆就沒意義了：桌面改中縫兩片，或減厚。`);
    else if (heaviest > 25) warnings.push(isEn ? `Heaviest single piece ≈ ${Math.round(heaviest)}kg: two people to carry (one-person limit 25kg).` : `拆開後最重的一件約 ${Math.round(heaviest)}kg，一個人搬不動（勞動部單人上限 25kg），要兩人搬或桌面分兩片。`);
  }
  if (input.material === "southern-pine" || (input.material === "pine" && topBuild === "stave")) warnings.push(isEn ? "Softwood: buy UNTREATED stock (pressure-treated wood must not be a working surface), sticker it indoors 2–4 weeks before milling, do not bolt the top down hard. For a stave top buy ~15% extra and pick knot-free pieces for the dog-hole row." : "南方松／松木：買「無防腐」的（防腐藥劑不能當刨削面）、先在室內陰乾 2~4 週再加工、桌面別用螺栓鎖死。側立拼的料已多算 15%，狗孔那一列挑無節、無髓心的料。");
  if (W >= 800) warnings.push(isEn ? `Depth ${W}mm will not fit through a standard door — consider the bolt-together option.` : `桌深 ${W}mm 一般房門推不出去（門寬 −7cm 才過得了），建議選螺栓可拆。`);
  if (L >= 2000 && !withApron && lowerStretcherArrangement !== "h-frame") warnings.push(isEn ? "Over 2m long without an apron: use the H-frame stretcher layout (long center rail) so the base cannot rack lengthwise." : "桌長超過 2m 又沒裙板：下橫撐請用 H 形（中央長撐）擋住長向扭動。");

  // ── 說明 ──
  const styleZh = ({ roubo: "厚板桌（法式 Roubo）", apron: "裙板桌（英式 Nicholson / Sellers）", well: "工具槽桌（北歐式）", mft: "20mm 孔陣桌（MFT）" } as Record<string, string>)[benchStyle] ?? "自訂";
  const styleEn = ({ roubo: "Roubo thick-top", apron: "English apron (Nicholson / Sellers)", well: "Scandinavian tool-well", mft: "MFT 20mm grid" } as Record<string, string>)[benchStyle] ?? "custom";
  const buildZh = topBuild === "stave" ? `窄條側立拼 ${topPanelPieces} 條` : topBuild === "stack" ? `${topPanelPieces} 層疊合` : `寬板平拼 ${topPanelPieces} 片`;
  const buildEn = topBuild === "stave" ? `${topPanelPieces} staves on edge` : topBuild === "stack" ? `${topPanelPieces} layers` : `${topPanelPieces} planks`;
  design.notes = isEn
    ? `${styleEn} workbench: top ${formatMm(topT, "inch")} (${buildEn}), legs ${formatMm(legSize, "inch")} square${legTopJoint === "through" ? " with through tenons into the top" : ""}${withApron ? `, apron ${formatMm(apronWidth, "inch")}` : ""}${withLowerStretchers ? `, ${lowerStretcherArrangement} stretchers` : ""}. ` +
      `${frontVise === "quick" ? `${frontViseSize === "9in" ? "9" : "7"}" quick-release vise on the ${viseSide}` : frontVise === "leg" ? `leg vise on the ${viseSide}` : "no vise"}; ` +
      `${dogCount > 0 ? `${dogCount} dog holes${dogHoles === "grid" ? " (20mm grid @96)" : ` Ø${dogHoleDiaRow} @${dogHolePitchRaw}`}` : "no dog holes"}${holdfastCount > 0 ? `, ${holdfastCount} holdfast holes` : ""}${planingStop ? ", planing stop" : ""}${knockdown === "bolt" ? `, knockdown with ${boltCount} M10 bed bolts` : ""}. ` +
      `Suggested height for ${userHeightCm}cm / ${modeEn}: ${suggested}mm (set: ${H}). Est. weight ≈ ${Math.round(massKg)}kg${deltaW > 0 ? `, seasonal movement ≈ ${deltaW}mm` : ""}. ${rearMortiseNoteEn}` +
      `${wagon ? `Wagon vise at the ${wagonSign > 0 ? "left" : "right"} end (overhang ${ovWagon}, slot ${WAGON_SLOT_L}×${WAGON_SLOT_W}, end cap ${WAGON_END_CAP_T}; hardware separate). ` : ""}${deadman ? "Sliding deadman: ridge on the front stretcher, rail under the top, 180mm board with a hole row. " : ""}${drawerCount > 0 ? `${drawerCount} drawers under the top (${DRAWER_CLEARANCE}mm holdfast clearance). ` : ""}${breadboardEnds ? "60mm breadboard ends (glue centre only, slotted outer pins). " : ""}${topBattens ? "Two 60×30 battens under the top in stopped sliding dovetails (15 deep, 40 at the mouth / 50 at the bottom ≈ 1:6), 20mm short of each edge, glued only in the middle 100mm. " : ""}${doubleSided ? "Double-sided: second vise on the far end / back edge, rear dog row, holdfast holes down the centre. " : ""}${moxon ? "Moxon vise jaws 600×140×40 ×2 included (hardware separate). " : ""}${accessories ? "Accessories: doe's foot 600×60×12, bench hook 300×180. " : ""}` +
      `${viseHardwareNote}`
    : `${styleZh}：桌面 ${topT}mm（${buildZh}）、腳 ${legSize} 方${legTopJoint === "through" ? "、腳頂貫穿榫露出桌面" : ""}${withApron ? `、裙板 ${apronWidth}×${apronThickness}` : ""}${withLowerStretchers ? `、下橫撐 ${({ "h-frame": "H 形", "box-frame": "4 邊框", "pair-x": "前後 2 根", "pair-z": "左右 2 根" } as Record<string, string>)[lowerStretcherArrangement] ?? ""}` : ""}。` +
      `${frontVise === "quick" ? `${viseSide === "left" ? "左" : "右"}端 ${frontViseSize === "9in" ? "9" : "7"} 吋快速鉗` : frontVise === "leg" ? `${viseSide === "left" ? "左" : "右"}前腳腳鉗` : "不裝鉗"}；` +
      `${dogCount > 0 ? `狗孔 ${dogCount} 個${dogHoles === "grid" ? "（20mm 格陣 @96）" : `（Ø${dogHoleDiaRow} @${dogHolePitchRaw}）`}` : "不打狗孔"}${holdfastCount > 0 ? `、holdfast 孔 ${holdfastCount} 個` : ""}${planingStop ? "、刨擋方柱" : ""}${knockdown === "bolt" ? `、螺栓可拆（M10 床螺栓 ${boltCount} 支）` : ""}。` +
      `身高 ${userHeightCm}cm 的${modeZh}建議桌高 ${suggested}mm（目前 ${H}）。估算重量約 ${Math.round(massKg)}kg${deltaW > 0 ? `，桌面季節脹縮約 ${deltaW}mm` : ""}。${rearMortiseNoteZh}` +
      `${wagon ? `尾鉗在${wagonSign > 0 ? "左" : "右"}端（懸出 ${ovWagon}、槽 ${WAGON_SLOT_L}×${WAGON_SLOT_W}、端蓋 ${WAGON_END_CAP_T}，滑塊五金另購）。` : ""}${deadman ? "長板靠板：前橫撐脊條 + 桌底軌 + 180 寬帶孔滑板。" : ""}${drawerCount > 0 ? `桌下 ${drawerCount} 抽（櫃頂離桌底 ${DRAWER_CLEARANCE}）。` : ""}${breadboardEnds ? "兩端 60 封邊板（只膠中央、外側長孔）。" : ""}${topBattens ? "桌面底穿帶 60×30 ×2：燕尾槽深 15、槽口 40 底 50（約 1:6），兩端留 20 止燕尾、只在中央 10cm 上膠。" : ""}${doubleSided ? "雙面桌：對側另一支鉗＋後緣一列狗孔，holdfast 孔在中央。" : ""}${moxon ? "附桌上加高小鉗（顎板 600×140×40 ×2，五金另購）。" : ""}${accessories ? "附件：V 口壓板 600×60×12、鋸切靠板 300×180。" : ""}` +
      `${viseHardwareNote} 市售對照：全榫接 120×54×80 工作桌約 NT$9,990。`;

  appendWarnings(design, warnings);
  applyStandardChecks(design, { minLength: 1000, maxLength: 3000, minWidth: 400, maxWidth: 1000, minHeight: 600, maxHeight: 1100 }, locale);
  return design;
};
