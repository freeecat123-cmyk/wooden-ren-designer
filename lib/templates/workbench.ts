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
/** 木顎厚 */
const VISE_CHOP_T_MM = 30;
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
const HEIGHT_COEF: Record<string, number> = { plane: 0.49, machine: 0.55, fine: 0.60 };
/** 腳鉗木顎厚（Benchcrafted：chop ≥ 2½"） */
const LEG_VISE_CHOP_T = 64;

// ───────────────────────── 流派 preset ─────────────────────────
/**
 * 「還停在預設值的 key 才吃 preset」（跟 bed / chinese-cabinet 同一套語意）。
 * ⚠️ 不能用 `input.options[key] === undefined` 判「使用者沒動過」——設計頁一有任何改動就會把
 *    **每一個** key（含預設值）寫進網址，之後每個 key 都是 defined，preset 就永遠套不上
 *    （2026-09-03 手機版實測抓到：benchStyle=apron 卻 withApron=false）。
 * 尺寸（長深高）不在 options 裡，preset 管不到，help 要講明。
 */
type PresetValues = Partial<Record<string, string | number | boolean>>;
const BENCH_PRESETS: Record<string, PresetValues> = {
  /** 法式厚板桌：Roubo —— 厚桌面 + 粗腳 + 腳頂通榫 + H 形下橫撐通榫 + 快速鉗 + 一列 Ø19 狗孔 */
  roubo: {},
  /** 裙板桌（英式 Nicholson / Sellers 平價）：薄桌面 + 高裙板 + 四邊下橫撐 + 下層板 + 螺栓可拆 */
  apron: {
    topThickness: 65, topBuild: "stack", topLayers: 2,
    legSize: 75, legTopJoint: "blind",
    withApron: true, apronWidth: 290, apronThickness: 40,
    lowerStretcherArrangement: "box-frame", lowerStretcherWidth: 90, lowerStretcherThickness: 40,
    withUnderShelf: true, legPenetratingTenon: false,
    knockdown: "bolt",
  },
  /** 工具槽桌（北歐式）：中等厚度桌面 + 後側工具槽 + 9" 鉗 */
  well: {
    topThickness: 65, legSize: 80, legTopJoint: "blind",
    topSplit: "well", wellWidth: 150, wellDepth: 45,
    frontViseSize: "9in",
  },
  /** 20mm 孔陣桌（現代 MFT）：夾板疊層 + 淺裙板 + 20mm 格陣（96 間距）、不裝鉗 */
  mft: {
    topThickness: 40, topBuild: "stack", topLayers: 2,
    legSize: 60, legTopJoint: "blind",
    withApron: true, apronWidth: 120, apronThickness: 25,
    lowerStretcherArrangement: "box-frame", lowerStretcherWidth: 60, lowerStretcherThickness: 25,
    withUnderShelf: true, legPenetratingTenon: false,
    frontVise: "none", dogHoles: "grid", holdfastHoles: false,
  },
};

export const workbenchOptions: OptionSpec[] = [
  // ───────────── ⭐ 流派 ─────────────
  { group: "preset", type: "select", key: "benchStyle", label: "工作桌流派", defaultValue: "roubo", wide: true, choices: [
    { value: "roubo", label: "厚板桌（法式 Roubo）— 厚桌面、粗腳通榫、快速鉗 + 狗孔" },
    { value: "apron", label: "裙板桌（英式 Nicholson / Sellers 平價）— 薄桌面靠高裙板撐，螺栓可拆" },
    { value: "well", label: "工具槽桌（北歐式）— 桌面後側一道放工具的槽" },
    { value: "mft", label: "20mm 孔陣桌（現代 MFT）— 夾板桌面、20mm 孔每 96mm 一格" },
  ], help: "選了一次帶入整組預設值；你改過的欄位不會被蓋掉。長／深／高請自己在上面調（厚板桌建議 1800×600×850）" },

  // ───────────── 桌高怎麼定（只給建議，不動滑桿） ─────────────
  { group: "structure", type: "select", key: "heightMode", label: "桌高用途（給建議值）", defaultValue: "plane", choices: [
    { value: "plane", label: "手刨為主（桌面 ≈ 掌根高，身高 × 0.49）" },
    { value: "machine", label: "機具 / 組裝為主（肘下約 10cm，身高 × 0.55）" },
    { value: "fine", label: "精細作業（鑿榫、鳩尾；身高 × 0.60）" },
  ], help: "依身高算出建議桌高，寫在下方說明與警告裡；不會自動改你設的「高」" },
  { group: "structure", type: "number", key: "userHeightCm", label: "你的身高", defaultValue: 170, unit: "cm", min: 145, max: 195, step: 1, help: "台灣男性中位約 170、女性約 160。只用來算建議桌高" },

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
  ] },
  { group: "top", type: "number", key: "gapWidth", label: "中縫寬", defaultValue: 45, unit: "mm", min: 25, max: 80, step: 5, dependsOn: { key: "topSplit", equals: "gap" }, help: "F 夾的夾頭要塞得進去；擋條做成跟桌面齊平，翻面可當刨擋" },
  { group: "top", type: "number", key: "wellWidth", label: "工具槽寬", defaultValue: 150, unit: "mm", min: 80, max: 320, step: 10, dependsOn: { key: "topSplit", equals: "well" }, help: "從桌深扣掉；桌腳只在工作面下面" },
  { group: "top", type: "number", key: "wellDepth", label: "工具槽深", defaultValue: 45, unit: "mm", min: 20, max: 80, step: 5, dependsOn: { key: "topSplit", equals: "well" }, help: "槽底板厚 18；槽深不能超過桌面厚 −10（槽底要能鎖在桌面後緣）" },
  { group: "top", type: "number", key: "endOverhang", label: "桌面兩端懸出（腳距桌端）", defaultValue: 0, unit: "mm", min: 0, max: 600, step: 10, help: "0 ＝ 自動 ＝ 桌長 ÷ 5（Roubo 原版比例）。懸出夠長，鉗才裝得進腳外側" },

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
  { group: "stretcher", type: "select", key: "lowerStretcherArrangement", label: "下橫撐排列", defaultValue: "h-frame", choices: [
    { value: "h-frame", label: "H 形（左右各一 + 中央一根長撐，Roubo）" },
    { value: "box-frame", label: "4 邊框（最穩，可放下層板）" },
    { value: "pair-x", label: "只前後 2 根" },
    { value: "pair-z", label: "只左右 2 根" },
  ], dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherWidth", label: "下橫撐高", defaultValue: 100, unit: "mm", min: 40, max: 150, step: 5, dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherThickness", label: "下橫撐厚", defaultValue: 50, unit: "mm", min: 25, max: 80, step: 5, dependsOn: { key: "withLowerStretchers", equals: true } },
  { group: "stretcher", type: "number", key: "lowerStretcherHeight", label: "下橫撐離地", defaultValue: 0, unit: "mm", min: 0, max: 300, step: 10, dependsOn: { key: "withLowerStretchers", equals: true }, help: "0 ＝ 自動 100（Schwarz 3 吋、Sellers 約 150）" },
  { group: "stretcher", type: "checkbox", key: "withUnderShelf", label: "下層置物板", defaultValue: false, dependsOn: { key: "withLowerStretchers", equals: true }, help: "架在下橫撐上；增重又能放工具箱，但別塞滿桌底（夾具要伸得進去）" },
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
  { group: "workholding", type: "select", key: "viseSide", label: "鉗在哪一端", defaultValue: "left", choices: [
    { value: "left", label: "左端（右撇子）" },
    { value: "right", label: "右端（左撇子）" },
  ], dependsOn: { key: "frontVise", notIn: ["none"] } },
  { group: "workholding", type: "select", key: "dogHoles", label: "桌狗孔", defaultValue: "row", choices: [
    { value: "row", label: "前緣一列（配鉗與刨擋）" },
    { value: "grid", label: "20mm 格陣（每 96mm 一孔，MFT 配件通用）" },
    { value: "none", label: "不打" },
  ] },
  { group: "workholding", type: "select", key: "dogHoleDia", label: "孔徑", defaultValue: "19", choices: [
    { value: "19", label: "Ø19（3/4\"，台灣桌狗 / holdfast 主流）" },
    { value: "20", label: "Ø20（MFT 配件；3/4\" 桌狗也插得進）" },
  ], dependsOn: { key: "dogHoles", equals: "row" } },
  { group: "workholding", type: "number", key: "dogHolePitch", label: "孔距", defaultValue: 100, unit: "mm", min: 60, max: 200, step: 10, dependsOn: { key: "dogHoles", equals: "row" }, help: "要小於鉗的行程（快速鉗開口 260 以上都夠）" },
  { group: "workholding", type: "number", key: "dogHoleFrontOffset", label: "離前緣", defaultValue: 60, unit: "mm", min: 40, max: 150, step: 5, dependsOn: { key: "dogHoles", equals: "row" }, help: "Schwarz 2~4\"；太靠邊會沿木紋裂" },
  { group: "workholding", type: "checkbox", key: "holdfastHoles", label: "holdfast 壓桿孔（後排，錯開）", defaultValue: true, dependsOn: { key: "dogHoles", notIn: ["none"] }, help: "跟狗孔同孔徑零成本；一支 holdfast 抵三支 F 夾。桌面 <44mm 咬不住會自動取消" },
  { group: "workholding", type: "checkbox", key: "planingStop", label: "刨擋（64mm 木方柱穿桌面）", defaultValue: false, help: "左前方一根方柱穿過桌面，敲高一點就是刨削擋；桌面 ≥75 才夾得住" },

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
  const preset = BENCH_PRESETS[benchStyle] ?? {};
  const pick = <T extends string | number | boolean>(key: string): T => {
    const spec = opt(o, key);
    const raw = getOption<T>(input, spec);
    if (preset[key] !== undefined && raw === (spec.defaultValue as T)) return preset[key] as T;
    return raw;
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
  const planingStop = pick<boolean>("planingStop");
  const knockdown = pick<string>("knockdown");

  // ── 夾制（§A10.11：夾在讀選項這一層、夾了要出聲） ──
  const topT = Math.max(40, Math.min(150, topTRaw));
  // 腳鉗木顎 64 厚，那支腳至少也要 64（Benchcrafted：leg ≥ 2½"）
  const legSize = frontVise === "leg" ? Math.max(legSizeRaw, LEG_VISE_CHOP_T) : legSizeRaw;
  if (legSize !== legSizeRaw) warnings.push(isEn ? `Leg vise needs a leg ≥ ${LEG_VISE_CHOP_T}mm thick; leg size raised ${legSizeRaw} → ${legSize}.` : `腳鉗那支腳至少 ${LEG_VISE_CHOP_T}mm 厚，腳粗已從 ${legSizeRaw} 提到 ${legSize}。`);
  const legHeight = H - topT;
  // 工具槽：從桌深扣掉，桌腳只在工作面下；槽深不能深過桌面厚 −10
  const wellWidth = topSplit === "well" ? Math.min(wellWidthRaw, Math.max(80, W - 2 * legSize - 200)) : 0;
  if (topSplit === "well" && wellWidth !== wellWidthRaw) warnings.push(isEn ? `Tool well narrowed ${wellWidthRaw} → ${wellWidth} so the legs still fit under the working top.` : `工具槽寬 ${wellWidthRaw} 會讓工作面放不下桌腳，已收到 ${wellWidth}。`);
  const wellDepth = topSplit === "well" ? Math.min(wellDepthRaw, topT - 10) : 0;
  if (topSplit === "well" && wellDepth !== wellDepthRaw) warnings.push(isEn ? `Tool well depth clamped ${wellDepthRaw} → ${wellDepth} (top thickness − 10).` : `工具槽深 ${wellDepthRaw} 超過桌面厚 −10，已收到 ${wellDepth}。`);
  const workW = W - wellWidth; // 桌腳 / 工作面所在的深度
  // 中縫：兩片各要放得下腳頂榫（腳 + 餘裕）
  const gap = topSplit === "gap" ? Math.min(gapWidth, Math.max(25, workW - 2 * legSize - 100)) : 0;
  if (topSplit === "gap" && gap !== gapWidth) warnings.push(isEn ? `Split gap clamped ${gapWidth} → ${gap} so each half still covers the leg tenons.` : `中縫 ${gapWidth} 會讓兩片桌面蓋不住腳頂榫，已收到 ${gap}。`);
  // 腳距桌端：0 = 桌長/5（§AT4.5）；上限讓兩腳之間至少留 300
  const maxOverhang = Math.max(0, Math.floor((L - 2 * legSize - 300) / 2));
  const endOverhangWanted = endOverhangRaw > 0 ? endOverhangRaw : Math.round(L / 5);
  const endOverhang = Math.min(endOverhangWanted, maxOverhang);
  if (endOverhang !== endOverhangWanted && endOverhangRaw > 0) warnings.push(isEn ? `End overhang ${endOverhangRaw} leaves too little between the legs; clamped to ${endOverhang}.` : `兩端懸出 ${endOverhangRaw} 會讓兩腳之間不到 300mm，已收到 ${endOverhang}。`);
  const frameL = L - 2 * endOverhang;
  const lowerStretcherHeight = lowerStretcherHeightRaw > 0 ? lowerStretcherHeightRaw : 100;
  // 下層板需要橫撐當支撐；H 形 / 雙條也能放（架在有的那幾根上）
  const withUnderShelf = withUnderShelfRaw && withLowerStretchers;
  // holdfast：桌面太薄咬不住 → 取消並出聲；太厚 → 提醒孔底反鑽
  const holdfastHoles = holdfastHolesRaw && dogHoles !== "none" && topT >= HOLDFAST_MIN_T;
  if (holdfastHolesRaw && dogHoles !== "none" && topT < HOLDFAST_MIN_T) warnings.push(isEn ? `Top is ${topT}mm — a holdfast needs ≥ ${HOLDFAST_MIN_T}mm to bite; holdfast holes skipped.` : `桌面 ${topT}mm 太薄，holdfast 要 ≥ ${HOLDFAST_MIN_T}mm 才咬得住，後排壓桿孔已取消。`);
  if (holdfastHoles && topT > HOLDFAST_MAX_T) warnings.push(isEn ? `Top is ${topT}mm: counterbore the holdfast holes from below (Ø30, ${topT - 70}mm deep) so the effective thickness is ~70mm.` : `桌面 ${topT}mm 比 holdfast 咬合上限 ${HOLDFAST_MAX_T} 厚：holdfast 孔請從桌底反鑽 Ø30、深 ${topT - 70}mm，讓有效厚度回到約 70。`);
  // 桌面片數：平拼 ≤280/片；側立拼 條寬＝厚；疊層＝層數
  const topPanelPieces = topBuild === "stave"
    ? Math.max(1, Math.ceil(workW / Math.max(38, topT)))
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

  // ── 桌面拉長到全長（腳架比桌面短 2×endOverhang，桌面兩端懸出） ──
  const top = design.parts.find((p) => p.id === "top")!;
  top.visible.length = L;
  top.grainDirection = "length";

  // ── 桌面中縫 + 擋條 ──
  const topPieces: Part[] = [];
  if (gap > 0) {
    const halfW = (workW - gap) / 2;
    const idx = design.parts.indexOf(top);
    const mk = (sz: -1 | 1): Part => {
      const centerZ = sz * (gap / 2 + halfW / 2);
      return {
        ...top,
        id: sz < 0 ? "top-front" : "top-back",
        nameZh: sz < 0 ? "桌面（前片）" : "桌面（後片）",
        nameEn: sz < 0 ? "Bench top (front half)" : "Bench top (back half)",
        visible: { length: L, width: halfW, thickness: topT },
        origin: { x: 0, y: top.origin.y, z: centerZ },
        mortises: top.mortises
          .filter((m) => Math.sign(m.origin.z) === sz)
          .map((m) => ({ ...m, origin: { ...m.origin, z: m.origin.z - centerZ } })),
        tenons: [],
      };
    };
    const front = mk(-1);
    const back = mk(1);
    const stop: Part = {
      id: "gap-stop",
      nameZh: "中縫擋條",
      nameEn: "Gap stop",
      material: input.material,
      grainDirection: "length",
      visible: { length: L, width: gap, thickness: topT },
      origin: { x: 0, y: top.origin.y, z: 0 },
      tenons: [],
      mortises: [],
    };
    design.parts.splice(idx, 1, front, back, stop);
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
    const wellT = 18;
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
  const sideSign = viseSide === "left" ? 1 : -1; // 「左」= 世界 +X
  const jaw = VISE_JAW_MM[frontViseSize] ?? 180;
  const legOuterX = frameL / 2;                  // 鉗那側的腳外面
  const legInnerX = frameL / 2 - legSize;
  let viseX: number | null = null;
  if (frontVise === "quick") {
    // 懸出夠長 → 鉗裝在腳外側（靠桌端）；不夠 → 裝在腳內側
    const fitsOutside = endOverhang >= jaw + 80;
    viseX = sideSign * (fitsOutside ? L / 2 - 60 - jaw / 2 : legInnerX - 20 - jaw / 2);
  } else if (frontVise === "leg") {
    viseX = sideSign * (legOuterX - legSize / 2); // 腳鉗就在前腳上
  }
  const viseHalfSpan = frontVise === "leg" ? Math.max(150, legSize + 40) / 2 : jaw / 2;

  // ── 狗孔 / holdfast 孔 ──
  let dogCount = 0;
  let holdfastCount = 0;
  let planingStopX: number | null = null;
  const rowZ = -workW / 2 + Math.max(dogHoleFrontOffsetRaw, 2 * dogHoleDiaRow + 10);
  if (dogHoles === "row") {
    const dia = dogHoleDiaRow;
    // 從鉗（或桌端）起算，往另一端走；端頭留 100
    const startX = viseX !== null
      ? viseX - sideSign * (viseHalfSpan + 50)
      : sideSign * (L / 2 - 100);
    const span = Math.abs(-sideSign * (L / 2 - 100) - startX);
    let pitch = dogHolePitchRaw;
    const nWanted = Math.floor(span / pitch) + 1;
    if (nWanted > MAX_DOG_HOLES) {
      pitch = Math.ceil(span / (MAX_DOG_HOLES - 1) / 10) * 10;
      warnings.push(isEn ? `${nWanted} dog holes is too many to render; pitch widened ${dogHolePitchRaw} → ${pitch}.` : `狗孔 ${nWanted} 個太多（3D 每孔都要布林運算），孔距已從 ${dogHolePitchRaw} 拉大到 ${pitch}。`);
    }
    let x = startX;
    // 刨擋佔掉第一格
    if (planingStop) { planingStopX = x; x -= sideSign * pitch; }
    for (; Math.abs(x) <= L / 2 - 100 + 0.5 && dogCount < MAX_DOG_HOLES; x -= sideSign * pitch) {
      const piece = topPieceAt(rowZ, dia / 2 + 5);
      if (piece) {
        piece.mortises.push(roundHole(x - piece.origin.x, topT, rowZ - piece.origin.z, dia, topT));
        dogCount++;
      }
    }
    if (holdfastHoles) {
      // 後排：距後緣 100、孔距 ≥ 300、跟前排錯開半格（Schwarz：16" apart, staggered）
      const hz = workW / 2 - 100;
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
    const dia = 20;
    const pitch = 96;
    const margin = 60;
    const cols = Math.max(1, Math.floor((L - 2 * margin) / pitch) + 1);
    const rowsWanted = Math.max(1, Math.floor((workW - 2 * margin) / pitch) + 1);
    const rows = Math.max(1, Math.min(rowsWanted, Math.floor(MAX_GRID_HOLES / cols)));
    if (rows < rowsWanted) warnings.push(isEn ? `20mm grid: only the front ${rows} of ${rowsWanted} rows are drawn (render limit ${MAX_GRID_HOLES} holes); drill the rest at the same 96mm pitch.` : `20mm 格陣 ${cols}×${rowsWanted} 太多孔，圖上只畫前 ${rows} 排（上限 ${MAX_GRID_HOLES} 孔）；其餘照 96mm 間距鑽完。`);
    const x0 = -((cols - 1) * pitch) / 2;
    const zStart = -workW / 2 + margin;
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
    const z = Math.max(rowZ, -workW / 2 + s / 2 + 40);
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

  // ── 前鉗 ──
  let viseHardwareNote = "";
  if (frontVise === "quick" && viseX !== null) {
    const spacerH = Math.max(0, VISE_MIN_EDGE_MM - topT);
    const bodyTopY = legHeight - spacerH;
    const screwY = bodyTopY - VISE_BODY_HEIGHT_MM / 2;
    const chopH = H - (bodyTopY - VISE_BODY_HEIGHT_MM);
    const chopZ = -workW / 2 - VISE_CHOP_T_MM / 2;
    // 鉗本體要躲在前裙板後面（builder 把裙板置中在腳裡，不是齊腳前面 → 用實際零件算後面在哪）。
    // 鉗裝在腳外側的懸出段時，那裡沒有裙板，本體直接貼桌面前緣。
    const apronFrontPart = withApron ? design.parts.find((p) => p.id === "apron-front") : undefined;
    const apronCoversVise = !!apronFrontPart && Math.abs(viseX) + jaw / 2 <= apronFrontPart.visible.length / 2;
    const bodyFrontZ = apronCoversVise && apronFrontPart ? apronFrontPart.origin.z + apronThickness / 2 : -workW / 2;
    const screwLocalY = screwY - (bodyTopY - VISE_BODY_HEIGHT_MM);
    // 木顎：跟桌面齊平、往下包住鉗本體；螺桿 + 兩根導桿的孔
    design.parts.push({
      id: "vise-chop",
      nameZh: "前鉗木顎",
      nameEn: "Front vise chop",
      material: input.material,
      grainDirection: "length",
      visible: { length: jaw, width: VISE_CHOP_T_MM, thickness: chopH },
      origin: { x: viseX, y: H - chopH, z: chopZ },
      tenons: [],
      mortises: [
        roundHole(0, screwLocalY, -VISE_CHOP_T_MM / 2, 30, VISE_CHOP_T_MM),
        roundHole(-(jaw / 2 - 35), screwLocalY, -VISE_CHOP_T_MM / 2, 20, VISE_CHOP_T_MM),
        roundHole(jaw / 2 - 35, screwLocalY, -VISE_CHOP_T_MM / 2, 20, VISE_CHOP_T_MM),
      ],
    });
    if (spacerH > 0) {
      warnings.push(isEn ? `Top is ${topT}mm; a quick-release vise wants ${VISE_MIN_EDGE_MM}mm at the front edge — a ${spacerH}mm spacer block was added under the top.` : `桌面 ${topT}mm 不到快速鉗要的 ${VISE_MIN_EDGE_MM}mm，已在桌底加 ${spacerH}mm 鉗座墊塊。`);
      design.parts.push({
        id: "vise-spacer",
        nameZh: "鉗座墊塊",
        nameEn: "Vise spacer block",
        material: input.material,
        grainDirection: "length",
        visible: { length: jaw, width: VISE_BODY_DEPTH_MM, thickness: spacerH },
        origin: { x: viseX, y: bodyTopY, z: bodyFrontZ + VISE_BODY_DEPTH_MM / 2 },
        tenons: [],
        mortises: [],
      });
    }
    design.parts.push({
      id: "vise-body",
      nameZh: `鑄鐵快速鉗本體（${frontViseSize === "9in" ? "9" : "7"} 吋）`,
      nameEn: `Quick-release vise body (${frontViseSize === "9in" ? "9" : "7"}")`,
      material: input.material,
      grainDirection: "length",
      visible: { length: jaw, width: VISE_BODY_DEPTH_MM, thickness: VISE_BODY_HEIGHT_MM },
      origin: { x: viseX, y: bodyTopY - VISE_BODY_HEIGHT_MM, z: bodyFrontZ + VISE_BODY_DEPTH_MM / 2 },
      visual: "metal",
      tenons: [],
      mortises: [],
    });
    design.parts.push({
      id: "vise-handle",
      nameZh: "前鉗手把",
      nameEn: "Front vise handle",
      material: input.material,
      grainDirection: "length",
      visible: { length: 220, width: 20, thickness: 20 },
      origin: { x: viseX, y: screwY - 10, z: chopZ - VISE_CHOP_T_MM / 2 - 45 },
      shape: { kind: "round", axis: "x" },
      visual: "metal",
      tenons: [],
      mortises: [],
    });
    // 前裙板讓螺桿 + 導桿穿過。裙板零件帶 rotation.x=π/2：mesh-local y 是板厚軸（0~厚）、
    // z 是板高軸（±裙板高/2，旋轉後變成世界的上下），§M1。
    if (apronCoversVise && apronFrontPart) {
      const apronCenterY = apronFrontPart.origin.y + apronWidth / 2;
      const localZ = screwY - apronCenterY;
      if (Math.abs(localZ) < apronWidth / 2 - 20) {
        const lx = viseX - apronFrontPart.origin.x;
        apronFrontPart.mortises.push(
          roundHole(lx, 0, localZ, 30, apronThickness),
          roundHole(lx - (jaw / 2 - 35), 0, localZ, 20, apronThickness),
          roundHole(lx + (jaw / 2 - 35), 0, localZ, 20, apronThickness),
        );
      }
    }
    viseHardwareNote = isEn
      ? `Hardware: ${frontViseSize === "9in" ? "9" : "7"}" quick-release bench vise (jaw ${jaw}mm) + 4 lag bolts.`
      : `五金：${frontViseSize === "9in" ? "9" : "7"} 吋鑄鐵快速鉗（鉗口 ${jaw}mm）＋ 4 支鎖桌底的木牙螺栓。`;
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
        { origin: { x: 0, y: guideY + 20, z: -legSize / 2 }, depth: legSize, length: 40, width: 25, through: true, cosmetic: true, label: isEn ? "parallel guide slot" : "平行導件槽" },
      );
    }
    viseHardwareNote = isEn
      ? "Hardware: leg-vise screw (wood Ø70 or imported kit) + parallel guide bar with pin holes."
      : "五金：腳鉗螺桿（自製 Ø70 木螺桿或進口套件）＋ 平行導件木條（鑽一排銷孔）。";
  }

  // ── 下層板（架在下橫撐上；缺角讓腳） ──
  if (withUnderShelf) {
    const shelfT = DEFAULT_SHELF_THICKNESS_MM;
    const stretcherY = lowerStretcherHeight;
    const shelfY = stretcherY + lowerStretcherWidth;
    const lsT = lowerStretcherThickness;
    const shelfLen = Math.max(50, frameL - legSize + lsT);
    const shelfWid = Math.max(50, workW - legSize + lsT);
    const notch = (legSize + lsT) / 2;
    if (shelfY < 150) warnings.push(isEn ? `Under-shelf sits ${shelfY}mm off the floor; ≥150 keeps it sweepable.` : `下層板離地 ${shelfY}mm，建議 ≥150 才掃得到地。`);
    design.parts.push({
      id: "under-shelf",
      nameZh: "下層置物板",
      nameEn: "Under shelf",
      material: input.material,
      grainDirection: "length",
      visible: { length: shelfLen, width: shelfWid, thickness: shelfT },
      origin: { x: 0, y: shelfY, z: 0 },
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
  design.overall = { length: L, width: W, thickness: H };

  // ── 警告：桌高 vs 身高、抗晃、重量、房門 ──
  const coef = HEIGHT_COEF[heightMode] ?? HEIGHT_COEF.plane;
  const suggested = Math.round(userHeightCm * 10 * coef);
  const modeZh = heightMode === "machine" ? "機具／組裝" : heightMode === "fine" ? "精細作業" : "手刨";
  const modeEn = heightMode === "machine" ? "machine/assembly" : heightMode === "fine" ? "fine work" : "hand-planing";
  if (H < suggested - 60) warnings.push(isEn ? `Bench height ${H} is >60mm below the ${modeEn} suggestion for ${userHeightCm}cm (${suggested}mm) — you will stoop.` : `桌高 ${H} 比 ${userHeightCm}cm 身高的${modeZh}建議值 ${suggested}mm 低超過 6cm，長時間會彎腰。`);
  if (H > suggested + 80) warnings.push(isEn ? `Bench height ${H} is >80mm above the ${modeEn} suggestion for ${userHeightCm}cm (${suggested}mm) — you cannot lean body weight into the plane.` : `桌高 ${H} 比 ${userHeightCm}cm 身高的${modeZh}建議值 ${suggested}mm 高超過 8cm，刨削時用不上體重。`);
  const apronEff = withApron ? apronWidth : 0;
  if (apronEff < 150 && !withLowerStretchers && topT < 60) warnings.push(isEn ? "No deep apron, no lower stretchers and a thin top: nothing resists racking. Add stretchers or an apron ≥ 200mm." : "沒有高裙板、沒有下橫撐、桌面又不到 60mm：沒有任何抗晃構件，刨兩下桌子就走路。請加下橫撐或 ≥200mm 裙板。");
  if (legSize < 80 && !withApron) warnings.push(isEn ? `Legs ${legSize}mm without an apron are light for a bench; ≥80 (thick-top style ≥100) recommended.` : `腳 ${legSize}mm 又沒裙板，對工作桌偏細；建議 ≥80（厚板桌 ≥100）。`);
  const density = MATERIALS[input.material]?.density ?? 600;
  const massKg = design.parts
    .filter((p) => p.visual !== "metal")
    .reduce((s, p) => s + (p.visible.length * p.visible.width * p.visible.thickness) / 1e9 * density, 0);
  if (massKg < 40) warnings.push(isEn ? `Estimated weight ${Math.round(massKg)}kg — a bench this light slides when you plane. Thicker top / bigger legs / under-shelf add mass.` : `估算重量約 ${Math.round(massKg)}kg，這麼輕的桌子一刨就滑；桌面加厚、腳加粗或加下層板都能增重（建議 ≥70kg）。`);
  else if (massKg < 70) warnings.push(isEn ? `Estimated weight ${Math.round(massKg)}kg; ≥70kg feels planted (Schwarz 250 lb, 木頭仁 ≥80kg).` : `估算重量約 ${Math.round(massKg)}kg，≥70kg 才不會被推著走（木頭仁教室規格整台 ≥80kg）。`);
  if (input.material === "southern-pine") warnings.push(isEn ? "Southern pine: buy UNTREATED stock — pressure-treated wood must not be a planing / working surface. Stave the top on edge (2×4s stood up) for a 89mm-thick top." : "南方松請買「無防腐」的：架上防腐材的藥劑不能當刨削面。桌面用 2×4 側立拼（立起來就是 89mm 厚），腳用兩支 2×4 對紋膠合。");
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
      `Suggested height for ${userHeightCm}cm / ${modeEn}: ${suggested}mm (set: ${H}). Est. weight ≈ ${Math.round(massKg)}kg. ${viseHardwareNote}`
    : `${styleZh}：桌面 ${topT}mm（${buildZh}）、腳 ${legSize} 方${legTopJoint === "through" ? "、腳頂貫穿榫露出桌面" : ""}${withApron ? `、裙板 ${apronWidth}×${apronThickness}` : ""}${withLowerStretchers ? `、下橫撐 ${({ "h-frame": "H 形", "box-frame": "4 邊框", "pair-x": "前後 2 根", "pair-z": "左右 2 根" } as Record<string, string>)[lowerStretcherArrangement] ?? ""}` : ""}。` +
      `${frontVise === "quick" ? `${viseSide === "left" ? "左" : "右"}端 ${frontViseSize === "9in" ? "9" : "7"} 吋快速鉗` : frontVise === "leg" ? `${viseSide === "left" ? "左" : "右"}前腳腳鉗` : "不裝鉗"}；` +
      `${dogCount > 0 ? `狗孔 ${dogCount} 個${dogHoles === "grid" ? "（20mm 格陣 @96）" : `（Ø${dogHoleDiaRow} @${dogHolePitchRaw}）`}` : "不打狗孔"}${holdfastCount > 0 ? `、holdfast 孔 ${holdfastCount} 個` : ""}${planingStop ? "、刨擋方柱" : ""}${knockdown === "bolt" ? `、螺栓可拆（M10 床螺栓 ${boltCount} 支）` : ""}。` +
      `身高 ${userHeightCm}cm 的${modeZh}建議桌高 ${suggested}mm（目前 ${H}）。估算重量約 ${Math.round(massKg)}kg。${viseHardwareNote}`;

  appendWarnings(design, warnings);
  applyStandardChecks(design, { minLength: 1000, maxLength: 3000, minWidth: 400, maxWidth: 1000, minHeight: 600, maxHeight: 1100 }, locale);
  return design;
};
