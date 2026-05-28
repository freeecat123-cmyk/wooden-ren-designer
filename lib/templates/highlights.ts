/**
 * 模板介紹頁的「設計重點 highlights」
 *
 * 每模板 4~6 條結構化亮點，detail page 用視覺 grid 渲染，
 * 比段落更好掃讀、強調該模板獨有的功能/參數。
 */

import type { FurnitureCategory } from "../types";

export interface Highlight {
  /** Emoji icon */
  icon: string;
  /** 一句話亮點（≤14 字） */
  title: string;
  /** 補充說明（可選，≤30 字） */
  desc?: string;
}

export const TEMPLATE_HIGHLIGHTS: Partial<Record<FurnitureCategory, Highlight[]>> = {
  stool: [
    { icon: "🔨", title: "榫眼位置自動算", desc: "通榫 ≤25mm、盲榫 2/3 演算法自動切換" },
    { icon: "↔️", title: "X/Z 軸牙板錯位", desc: "不會卡到對面榫頭" },
    { icon: "📐", title: "外撇 0~12° 含複斜", desc: "腳真實長度＋鋸台設定值都給" },
    { icon: "🆓", title: "免費模板", desc: "上限 35×35×45cm，想做幾張做幾張" },
  ],
  "pencil-holder": [
    { icon: "📐", title: "6 種預設一鍵切換", desc: "方/六角/八角/格柵/刷筒/隔板" },
    { icon: "🪚", title: "鋸台角度自動算", desc: "六角 30°、八角 22.5°，直接照做" },
    { icon: "🪵", title: "斜接/指接/鳩尾", desc: "演算法選最不浪費料的接法" },
    { icon: "🆓", title: "免費模板", desc: "上限 20×20×25cm，下角料就能做" },
  ],
  "side-table": [
    { icon: "🛋️", title: "依沙發高度自動建議", desc: "拿杯子最順的桌高" },
    { icon: "🗃️", title: "抽屜五金規格自動", desc: "報「13 吋滑軌」直接買" },
    { icon: "📚", title: "下層板可加可不加", desc: "堆雜誌或留純面板" },
    { icon: "🦵", title: "外撇腳含複斜計算", desc: "真實長度＋兩軸切割角度" },
  ],
  "dining-chair": [
    { icon: "🪑", title: "椅背曲度 5~8°", desc: "後仰最舒服的角度" },
    { icon: "🦵", title: "後腳外撇 6~10° 防翻", desc: "椅子後仰時不翻倒" },
    { icon: "📐", title: "真實腿長自動算", desc: "含複斜，到 mm 精確" },
    { icon: "📏", title: "座面前低後高", desc: "坐起來不會滑下來" },
    { icon: "🪚", title: "鋸台設定值直接給", desc: "兩軸傾角各幾度都算好" },
  ],
  desk: [
    { icon: "📏", title: "依身高建議桌高", desc: "168 配 47cm、175 配 50cm" },
    { icon: "🗃️", title: "1~3 抽屜自由配", desc: "左/右/中位置可選" },
    { icon: "🔌", title: "走線孔 60mm 標準", desc: "可開 2~4 個位置可選" },
    { icon: "⌨️", title: "下層板放鍵盤架", desc: "1~2 層可調" },
    { icon: "🪜", title: "腳形三選一", desc: "直腿/側板/A 字" },
  ],
  "open-bookshelf": [
    { icon: "📐", title: "每層獨立設高度", desc: "漫畫 18cm／A4 32cm 各層配" },
    { icon: "🔩", title: "可調層板支援", desc: "32mm 國際標準孔距" },
    { icon: "⚠️", title: "跨距承重警示", desc: "超過 60cm 自動建議加厚" },
    { icon: "📚", title: "深度 22~26cm 建議", desc: "A4+文庫本都放得下" },
  ],
  "chest-of-drawers": [
    { icon: "🪵", title: "三級接合可選", desc: "鳩尾/固定滑軌/蝶式" },
    { icon: "🔩", title: "五金規格自動列", desc: "Blum/Hettich 型號都給" },
    { icon: "📐", title: "面寬可配比", desc: "全等寬/上小下大/漸進" },
    { icon: "🛏️", title: "高度建議 70~110", desc: "再高要靠牆防倒" },
  ],
  "media-console": [
    { icon: "🔌", title: "走線孔 2~4 個自動", desc: "60mm 標準 HDMI 過得去" },
    { icon: "🌬️", title: "散熱孔 PS5 必備", desc: "後側百葉自動開" },
    { icon: "📺", title: "依電視寬建議深寬", desc: "65 吋配 185cm 寬" },
    { icon: "🎮", title: "抽屜+層板混合", desc: "藏手把＋主機通風" },
  ],
  wardrobe: [
    { icon: "📏", title: "嵌牆尺寸扣餘量", desc: "自動扣 1~2cm 安裝餘量" },
    { icon: "👔", title: "吊衣桿男女配", desc: "女裝 110、男裝 140" },
    { icon: "🚪", title: "推/開/無門三選一", desc: "依床距離自動建議" },
    { icon: "🗃️", title: "抽屜 0~6 抽", desc: "中下段配置最順手" },
    { icon: "💰", title: "省 8~10 萬訂做費", desc: "材料費 2~3 萬可做完" },
  ],
  "dining-table": [
    { icon: "🪚", title: "拼板自動算企口", desc: "超過 40cm 寬自動切片" },
    { icon: "👥", title: "依人數建議尺寸", desc: "6 人 180、8 人 220" },
    { icon: "🦵", title: "腳形三選一", desc: "4 直腿/A 字/梯形" },
    { icon: "⚠️", title: "長度超 180 加支撐", desc: "中間補強腳防下垂" },
  ],
  "tea-table": [
    { icon: "🛋️", title: "依沙發比例建議", desc: "寬 = 沙發 × 0.5~0.7" },
    { icon: "📏", title: "比沙發低 5cm 最順", desc: "拿杯子最舒服" },
    { icon: "📚", title: "下層板放雜誌", desc: "可加可不加" },
    { icon: "🗃️", title: "0~2 抽屜選配", desc: "藏遙控器、線材" },
  ],
  "shoe-cabinet": [
    { icon: "🔩", title: "可調層板", desc: "依季節調高（雪靴/拖鞋同櫃）" },
    { icon: "🚪", title: "推/開/上開蓋", desc: "依玄關空間選" },
    { icon: "👞", title: "深 30~35cm 建議", desc: "男鞋 28 號都放得下" },
    { icon: "💨", title: "背板透氣孔提醒", desc: "防鞋櫃悶味" },
    { icon: "🪑", title: "可加坐墊面", desc: "穿鞋椅一體" },
  ],
  nightstand: [
    { icon: "🛏️", title: "依床高建議高度", desc: "比床面高 0~5cm" },
    { icon: "🗃️", title: "抽屜/層板/混合", desc: "三款結構自由" },
    { icon: "🔌", title: "可加 USB 充電孔", desc: "手機半夜充電不亂飛" },
    { icon: "💑", title: "做兩張對稱", desc: "新婚臥房經典配" },
  ],
  bench: [
    { icon: "📏", title: "長 90~200cm", desc: "超過 150 自動加補強桿" },
    { icon: "🦵", title: "腳形三選", desc: "直腿/A 字/梯形" },
    { icon: "🪑", title: "三種用途", desc: "穿鞋/餐桌排坐/戶外" },
    { icon: "🌲", title: "戶外材選柚木", desc: "5~10 年耐用" },
  ],
  "bar-stool": [
    { icon: "🏝️", title: "依中島高自動配", desc: "中島 - 28cm = 椅高" },
    { icon: "👣", title: "踏腳桿位置自動", desc: "離地 25~30cm" },
    { icon: "⚖️", title: "外撇腳防翻", desc: "6~10° 保穩定" },
    { icon: "🪑", title: "無背/矮背/高背", desc: "三種椅背選" },
  ],
  "round-stool": [
    { icon: "⚖️", title: "3 腳地不平也穩", desc: "永遠 3 點接觸" },
    { icon: "📏", title: "直徑 30~40cm", desc: "超過 45 變邊几" },
    { icon: "🪚", title: "圓坐面拼板自動", desc: "超過 30cm 自動切片" },
    { icon: "🦵", title: "外撇 6~12°", desc: "視覺輕巧也穩固" },
  ],
  "low-table": [
    { icon: "🧎", title: "腳高 30~38cm", desc: "盤腿坐膝蓋塞得進" },
    { icon: "🪚", title: "拼板自動", desc: "超過 40cm 自動切片" },
    { icon: "🦵", title: "外撇 5~10° 視覺穩", desc: "腳形三選" },
    { icon: "🍵", title: "可加邊框防杯倒", desc: "茶席桌專用" },
  ],
  "round-tea-table": [
    { icon: "👶", title: "圓邊不撞膝", desc: "小孩家庭首選" },
    { icon: "🏛️", title: "三種結構", desc: "3 腳/4 腳/單腿底盤" },
    { icon: "📐", title: "底盤直徑自動", desc: "桌面 × 0.5~0.6" },
    { icon: "🪚", title: "圓桌面拼板", desc: "拼方再修圓" },
  ],
  "round-table": [
    { icon: "👨‍👩‍👧‍👦", title: "圍圓無主位", desc: "家庭氛圍最平等" },
    { icon: "👥", title: "120/140/150cm", desc: "6/8/10 人擠分別" },
    { icon: "🏛️", title: "結構三選", desc: "單腿座/4 腿/十字底盤" },
    { icon: "📐", title: "桌面建議 25mm+", desc: "圓桌跨距大要厚" },
  ],
  "display-cabinet": [
    { icon: "📐", title: "層高依收藏配", desc: "公仔 25cm／酒 35cm" },
    { icon: "💡", title: "可預留 LED 溝", desc: "12V 燈條嵌入" },
    { icon: "🪟", title: "玻璃尺寸自動算", desc: "玻璃行報價需要的" },
    { icon: "🪞", title: "背板三選", desc: "實木/玻璃/鏡面" },
  ],
  "dovetail-box": [
    { icon: "🪵", title: "三種接法", desc: "鳩尾/指接/企口" },
    { icon: "📐", title: "鳩尾位置算到 0.5mm", desc: "照圖鋸就行" },
    { icon: "🗝️", title: "蓋子三選", desc: "掀蓋/合頁/滑蓋" },
    { icon: "🗃️", title: "內部可加隔板", desc: "珠寶盒/工具盒適用" },
  ],
  tray: [
    { icon: "✋", title: "把手三選", desc: "邊把手/挖手孔/無把" },
    { icon: "🪶", title: "底厚 9~15mm", desc: "輕巧好端" },
    { icon: "🍵", title: "蜂蠟塗料食安認證", desc: "安心接觸食物" },
    { icon: "💰", title: "市集 ROI 高", desc: "成本 80、賣 280" },
  ],
  "wine-rack": [
    { icon: "🍷", title: "瓶徑 7~8cm 標準", desc: "香檳預留 9cm" },
    { icon: "📊", title: "6~24 瓶可調", desc: "幾列幾行自由配" },
    { icon: "🪵", title: "三種格柵", desc: "純木/十字/菱形" },
    { icon: "🧱", title: "嵌牆/獨立/壁掛", desc: "三種結構選" },
  ],
  "photo-frame": [
    { icon: "📐", title: "45° 斜接自動", desc: "標準相片尺寸自動換" },
    { icon: "🖼️", title: "三種邊寬", desc: "細 2/中 3/寬 5cm" },
    { icon: "🪟", title: "玻璃尺寸自動算", desc: "玻璃行訂做用" },
    { icon: "🪝", title: "掛繩/腳架/磁鐵", desc: "三種掛法選" },
  ],
};

/** EN translations for all highlights. Locale-aware accessor uses this when locale==='en'. */
export const TEMPLATE_HIGHLIGHTS_EN: Partial<Record<FurnitureCategory, Highlight[]>> = {
  stool: [
    { icon: "🔨", title: "Auto mortise layout", desc: "Through ≤25 mm / blind 2/3 algorithm auto-switches" },
    { icon: "↔️", title: "X/Z apron stagger", desc: "Tenons never collide in the leg" },
    { icon: "📐", title: "0–12° splay with compound", desc: "True leg length + table-saw angles given" },
    { icon: "🆓", title: "Free template", desc: "Capped at 35×35×45 cm, build as many as you want" },
  ],
  "pencil-holder": [
    { icon: "📐", title: "6 presets, one click", desc: "Square / hex / oct / grid / brush / divided" },
    { icon: "🪚", title: "Auto saw angles", desc: "Hex 30°, oct 22.5° — just set and cut" },
    { icon: "🪵", title: "Miter / finger / dovetail", desc: "Algorithm picks the most stock-efficient joinery" },
    { icon: "🆓", title: "Free template", desc: "Capped at 20×20×25 cm, scraps will do" },
  ],
  "side-table": [
    { icon: "🛋️", title: "Auto-fits sofa height", desc: "The most natural cup-grabbing height" },
    { icon: "🗃️", title: "Auto drawer hardware", desc: "Says \"13-inch slide\" — just buy it" },
    { icon: "📚", title: "Optional lower shelf", desc: "Magazines or stay flat" },
    { icon: "🦵", title: "Compound-splay legs", desc: "True length + both cut angles" },
  ],
  "dining-chair": [
    { icon: "🪑", title: "Backrest curve 5–8°", desc: "Most comfortable lean-back angle" },
    { icon: "🦵", title: "Back legs splay 6–10°", desc: "Anti-tip when leaning back" },
    { icon: "📐", title: "True leg length auto", desc: "Compound included, mm precision" },
    { icon: "📏", title: "Seat tips down front", desc: "Doesn't slide forward" },
    { icon: "🪚", title: "Table-saw settings spelled out", desc: "Both-axis tilt angles ready" },
  ],
  desk: [
    { icon: "📏", title: "Height by body height", desc: "168 → 47 cm, 175 → 50 cm" },
    { icon: "🗃️", title: "1–3 drawers, your call", desc: "Left / right / center" },
    { icon: "🔌", title: "60 mm grommet standard", desc: "2–4 positions selectable" },
    { icon: "⌨️", title: "Keyboard tray support", desc: "1–2 adjustable layers" },
    { icon: "🪜", title: "Three leg styles", desc: "Straight / panel side / A-frame" },
  ],
  "open-bookshelf": [
    { icon: "📐", title: "Per-shelf height", desc: "Manga 18 cm / A4 32 cm individually" },
    { icon: "🔩", title: "Adjustable shelves", desc: "32 mm shelf-pin standard" },
    { icon: "⚠️", title: "Span sag warning", desc: "Over 60 cm auto-suggests thicker" },
    { icon: "📚", title: "Depth 22–26 cm hint", desc: "Fits A4 + paperback" },
  ],
  "chest-of-drawers": [
    { icon: "🪵", title: "Three joinery tiers", desc: "Dovetail / fixed slide / butt" },
    { icon: "🔩", title: "Auto hardware spec", desc: "Blum / Hettich SKU listed" },
    { icon: "📐", title: "Face-width ratio", desc: "Equal / ascending / progressive" },
    { icon: "🛏️", title: "Height 70–110 hint", desc: "Anchor to wall if taller" },
  ],
  "media-console": [
    { icon: "🔌", title: "Auto 2–4 cable grommets", desc: "60 mm fits any HDMI" },
    { icon: "🌬️", title: "Vent slots for PS5", desc: "Auto rear louvers" },
    { icon: "📺", title: "Sized by TV width", desc: "65-inch → 185 cm console" },
    { icon: "🎮", title: "Drawer + shelf mix", desc: "Hide controllers, vent consoles" },
  ],
  wardrobe: [
    { icon: "📏", title: "Built-in size minus tolerance", desc: "Auto-deducts 1–2 cm install slack" },
    { icon: "👔", title: "Rod height by gender", desc: "Women 110, men 140" },
    { icon: "🚪", title: "Sliding / hinged / none", desc: "Auto-suggests by bed distance" },
    { icon: "🗃️", title: "0–6 drawers", desc: "Mid-lower placement works best" },
    { icon: "💰", title: "Saves $2.5–3k vs custom", desc: "Materials only $600–900" },
  ],
  "dining-table": [
    { icon: "🪚", title: "Auto edge-glue layout", desc: "Over 40 cm auto-rips for joinery" },
    { icon: "👥", title: "Sized by seat count", desc: "6 → 180, 8 → 220" },
    { icon: "🦵", title: "Three leg styles", desc: "4 straight / A-frame / trestle" },
    { icon: "⚠️", title: "Over 180 + support", desc: "Adds center reinforcement against sag" },
  ],
  "tea-table": [
    { icon: "🛋️", title: "Suggested by sofa ratio", desc: "Width = sofa × 0.5–0.7" },
    { icon: "📏", title: "5 cm below sofa = perfect", desc: "Easiest cup reach" },
    { icon: "📚", title: "Optional lower shelf", desc: "For magazines or skip" },
    { icon: "🗃️", title: "0–2 drawers", desc: "Hide remotes & cables" },
  ],
  "shoe-cabinet": [
    { icon: "🔩", title: "Adjustable shelves", desc: "Seasonal swap (boots vs slippers)" },
    { icon: "🚪", title: "Sliding / hinged / lift-up", desc: "Pick by entry space" },
    { icon: "👞", title: "Depth 30–35 cm hint", desc: "Fits men's size 12" },
    { icon: "💨", title: "Back-panel vent reminder", desc: "Anti-odor" },
    { icon: "🪑", title: "Optional seat top", desc: "Shoe-tying bench in one" },
  ],
  nightstand: [
    { icon: "🛏️", title: "Height by bed height", desc: "0–5 cm above mattress" },
    { icon: "🗃️", title: "Drawer / shelf / mix", desc: "Three configurations" },
    { icon: "🔌", title: "Optional USB charging port", desc: "Phone charges without cable spaghetti" },
    { icon: "💑", title: "Build two matching", desc: "Classic newlywed bedroom set" },
  ],
  bench: [
    { icon: "📏", title: "Length 90–200 cm", desc: "Over 150 auto-adds stretcher" },
    { icon: "🦵", title: "Three leg styles", desc: "Straight / A-frame / trestle" },
    { icon: "🪑", title: "Three uses", desc: "Entry / dining / outdoor" },
    { icon: "🌲", title: "Teak for outdoor", desc: "5–10 year lifespan" },
  ],
  "bar-stool": [
    { icon: "🏝️", title: "Auto-fit to island height", desc: "Island − 28 cm = stool height" },
    { icon: "👣", title: "Auto footrest position", desc: "25–30 cm off the floor" },
    { icon: "⚖️", title: "Splayed legs anti-tip", desc: "6–10° keeps stability" },
    { icon: "🪑", title: "No / low / high back", desc: "Three back styles" },
  ],
  "round-stool": [
    { icon: "⚖️", title: "3 legs always stable", desc: "Three-point contact, uneven floors OK" },
    { icon: "📏", title: "Diameter 30–40 cm", desc: "Over 45 becomes a side table" },
    { icon: "🪚", title: "Auto round-seat layout", desc: "Over 30 cm auto-strips for joinery" },
    { icon: "🦵", title: "Splay 6–12°", desc: "Visually light, still solid" },
  ],
  "low-table": [
    { icon: "🧎", title: "Leg height 30–38 cm", desc: "Knees clear when sitting cross-legged" },
    { icon: "🪚", title: "Auto edge-glue", desc: "Over 40 cm auto-rips for joinery" },
    { icon: "🦵", title: "5–10° splay, visually steady", desc: "Three leg styles" },
    { icon: "🍵", title: "Optional rim against spills", desc: "Tea-ceremony table specific" },
  ],
  "round-tea-table": [
    { icon: "👶", title: "Round edge, no knee bumps", desc: "Family-with-kids favorite" },
    { icon: "🏛️", title: "Three structures", desc: "3-leg / 4-leg / pedestal" },
    { icon: "📐", title: "Auto pedestal diameter", desc: "Top × 0.5–0.6" },
    { icon: "🪚", title: "Auto round-top layout", desc: "Glue square then trim round" },
  ],
  "round-table": [
    { icon: "👨‍👩‍👧‍👦", title: "No head of the table", desc: "Most egalitarian family vibe" },
    { icon: "👥", title: "120 / 140 / 150 cm", desc: "6 / 8 / 10 seats with proper clearance" },
    { icon: "🏛️", title: "Three structures", desc: "Single pedestal / 4 legs / cross base" },
    { icon: "📐", title: "Top thickness 25 mm+", desc: "Round tables need extra thickness for span" },
  ],
  "display-cabinet": [
    { icon: "📐", title: "Layer height per collection", desc: "Figures 25 cm / wine 35 cm" },
    { icon: "💡", title: "Reserve LED channels", desc: "12V strip embedded" },
    { icon: "🪟", title: "Auto glass dimensions", desc: "Spec the glass shop needs" },
    { icon: "🪞", title: "Three back options", desc: "Solid / glass / mirror" },
  ],
  "dovetail-box": [
    { icon: "🪵", title: "Three joinery options", desc: "Dovetail / finger / rabbet" },
    { icon: "📐", title: "Dovetail position to 0.5 mm", desc: "Saw to the line" },
    { icon: "🗝️", title: "Three lid styles", desc: "Lift-off / hinged / sliding" },
    { icon: "🗃️", title: "Optional interior dividers", desc: "Jewelry / tool / tea boxes" },
  ],
  tray: [
    { icon: "✋", title: "Three handle styles", desc: "Side rails / cut-out / no handles" },
    { icon: "🪶", title: "Bottom 9–15 mm", desc: "Light, easy to carry" },
    { icon: "🍵", title: "Food-safe beeswax", desc: "Direct food contact OK" },
    { icon: "💰", title: "High craft-market ROI", desc: "Cost $3, sell $10" },
  ],
  "wine-rack": [
    { icon: "🍷", title: "Bottle ⌀ 7–8 cm standard", desc: "Champagne reserves 9 cm" },
    { icon: "📊", title: "6–24 bottles adjustable", desc: "Free choice of rows × columns" },
    { icon: "🪵", title: "Three lattice styles", desc: "Plain / cross / diamond" },
    { icon: "🧱", title: "Built-in / freestanding / wall", desc: "Three mounting options" },
  ],
  "photo-frame": [
    { icon: "📐", title: "Auto 45° miter", desc: "Standard print sizes auto-converted" },
    { icon: "🖼️", title: "Three edge widths", desc: "Slim 2 / mid 3 / wide 5 cm" },
    { icon: "🪟", title: "Auto glass dimensions", desc: "Spec the glass shop needs" },
    { icon: "🪝", title: "Cord / kickstand / magnet", desc: "Three hanging options" },
  ],
};

export function getHighlights(
  category: FurnitureCategory,
  locale: string = "zh-TW",
): Highlight[] | undefined {
  if (locale === "en" && TEMPLATE_HIGHLIGHTS_EN[category]) {
    return TEMPLATE_HIGHLIGHTS_EN[category];
  }
  return TEMPLATE_HIGHLIGHTS[category];
}
