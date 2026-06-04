export type ToolCategory =
  | "chisel"
  | "saw"
  | "plane"
  | "measure"
  | "marking"
  | "clamp"
  | "sand"
  | "glue"
  | "finish"
  | "power"
  | "hardware"
  | "sharpening";

export type ToolPriority = "required" | "recommended" | "optional";

export interface Tool {
  id: string;
  nameZh: string;
  nameEn?: string;
  category: ToolCategory;
  /** 木頭仁商店實際商品連結；以 {@link https://woodenren.easy.co/} 為 source */
  shopUrl?: string;
  sku?: string;
  /** Cached price in NT$. Refresh manually until scraper exists. */
  priceCached?: number;
  alternativeIds?: string[];
  notes?: string;
}

export const TOOL_CATALOG: Record<string, Tool> = {
  // ----- 量測 / 劃線 -----
  "tape-measure-5m": {
    id: "tape-measure-5m",
    nameZh: "5m 卷尺（Giant 德製升級捲尺）",
    nameEn: "5m Tape Measure (Giant German Premium)",
    category: "measure",
    shopUrl:
      "https://woodenren.easy.co/products/giantop-5m-heavy-duty-auto-lock-tape-measure",
  },
  "try-square": {
    id: "try-square",
    nameZh: "不鏽鋼直尺 30cm",
    nameEn: "Stainless Steel Ruler 30cm",
    category: "measure",
    shopUrl:
      "https://woodenren.easy.co/products/stainless-steel-ruler-30cm-woodworking",
  },
  "marking-gauge": {
    id: "marking-gauge",
    nameZh: "單桿劃線規（榫卯必備）",
    nameEn: "Single-Beam Marking Gauge (Essential for Joinery)",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/single-bar-marking-gauge-woodworking",
  },
  "dovetail-marker": {
    id: "dovetail-marker",
    nameZh: "自由角規 / 萬用角度規",
    nameEn: "Sliding Bevel / Universal Angle Gauge",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/sliding-t-bevel-angle-gauge",
  },

  // ----- 鑿刀 -----
  "chisel-set-3-6-12": {
    id: "chisel-set-3-6-12",
    nameZh: "西式鑿刀組",
    nameEn: "Western Chisel Set",
    category: "chisel",
    shopUrl:
      "https://woodenren.easy.co/products/western-bevel-edge-chisel-set",
  },
  "chisel-hardwood": {
    id: "chisel-hardwood",
    nameZh: "鹿港打鑿十本組（硬木專用）",
    nameEn: "Lukang 10-Piece Bench Chisel Set (Hardwood)",
    category: "chisel",
    shopUrl:
      "https://woodenren.easy.co/products/lukang-mortise-chisel-set-10pcs",
    notes: "硬木需高碳鋼或台製手工鑿，普通鑿刀易崩刃",
  },

  // ----- 鋸 -----
  "japanese-saw": {
    id: "japanese-saw",
    nameZh: "Temple Tool 180mm 雙刃鋸（縱切+橫切兩用，日本鋼材）",
    nameEn: "Temple Tool 180mm Double-Edge Ryoba Saw (Rip + Crosscut, Japanese Steel)",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/temple-tool-180mm-double-edge-ryoba-saw",
  },
  "dovetail-saw": {
    id: "dovetail-saw",
    nameZh: "Temple Tool 240mm 縱切導付鋸（日式夾背鋸，燕尾榫專用）",
    nameEn: "Temple Tool 240mm Rip Dozuki Saw (Japanese Back Saw, for Dovetails)",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/temple-tool-240mm-rip-dozuki-dovetail-saw",
  },
  "all-purpose-saw": {
    id: "all-purpose-saw",
    nameZh: "Temple Tool 150mm 全能導付鋸（日式夾背鋸，泛用型極細齒）",
    nameEn: "Temple Tool 150mm All-Purpose Dozuki Saw (Japanese Back Saw, Ultra-Fine Teeth)",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/temple-tool-150mm-dozuki-dovetail-saw",
  },
  "flush-cut-saw": {
    id: "flush-cut-saw",
    nameZh: "Temple Tool 150mm 齊平剪切鋸（日式釘引鋸，無撥齒不傷木面）",
    nameEn: "Temple Tool 150mm Flush-Cut Saw (Japanese Kugihiki, No-Set Teeth)",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/flush-cut-saw-150mm-japanese-kugihiki-no-set",
    notes: "無撥齒設計，鋸身可貼平木面切除突出榫頭/木釘而不刮傷表面",
  },

  // ----- 刨 -----
  "groove-plane": {
    id: "groove-plane",
    nameZh: "木工清底鉋 / 開槽鉋",
    nameEn: "Router Plane / Plough Plane",
    category: "plane",
    shopUrl:
      "https://woodenren.easy.co/products/groove-shoulder-cleaning-plane",
  },

  // ----- 木槌 / 夾具 -----
  mallet: {
    id: "mallet",
    nameZh: "白膠鎚（膠槌，不留痕跡）",
    nameEn: "White Rubber Mallet (Non-Marring)",
    category: "chisel",
    shopUrl:
      "https://woodenren.easy.co/products/white-rubber-mallet-wood-handle",
  },
  "f-clamp-x4": {
    id: "f-clamp-x4",
    nameZh: "加厚瑪鋼美式 F 夾 ×4",
    nameEn: "Heavy-Duty Malleable Iron F-Clamps × 4",
    category: "clamp",
    shopUrl:
      "https://woodenren.easy.co/products/f-clamp-malleable-iron-heavy-duty-woodworking",
  },
  "long-clamp-x2": {
    id: "long-clamp-x2",
    nameZh: "德式重型 F 夾（長型）×2",
    nameEn: "German Heavy-Duty Long F-Clamps × 2",
    category: "clamp",
    shopUrl:
      "https://woodenren.easy.co/products/heavy-duty-german-f-clamp",
  },

  // ----- 砂磨 / 膠合 / 塗裝 -----
  "sandpaper-set": {
    id: "sandpaper-set",
    nameZh: "日本富士星方型砂紙 120–600 番",
    nameEn: "Fuji Star Japanese Sandpaper Set 120–600 Grit",
    category: "sand",
    shopUrl:
      "https://woodenren.easy.co/products/fujistar-square-sandpaper-120-600-dry",
  },
  "sandpaper-coarse-60": {
    id: "sandpaper-coarse-60",
    nameZh: "粗番砂紙 60–80（硬木去刨痕）",
    nameEn: "Coarse Sandpaper 60–80 Grit (Hardwood Plane Mark Removal)",
    category: "sand",
    shopUrl:
      "https://woodenren.easy.co/products/fujistar-square-sandpaper-120-600-dry",
  },
  "pva-glue": {
    id: "pva-glue",
    nameZh: "太棒膠二號（PVA 木工膠）",
    nameEn: "Taibang No.2 PVA Wood Glue",
    category: "glue",
    shopUrl:
      "https://woodenren.easy.co/products/taibang-wood-glue-pva-panel-glue",
  },
  "wood-oil": {
    id: "wood-oil",
    nameZh: "大谷 Vaton 木質保護油",
    nameEn: "Otani Vaton Wood Protection Oil",
    category: "finish",
    shopUrl:
      "https://woodenren.easy.co/products/vaton-wood-protection-oil-501-511-519",
  },

  // ----- 電動 -----
  "router-table": {
    id: "router-table",
    nameZh: "鋁合金修邊機倒裝台",
    nameEn: "Aluminum Trim Router Table",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/router-table-aluminum-lift-base",
  },
  drill: {
    id: "drill",
    nameZh: "電鑽 + 攻絲懸臂定位支架",
    nameEn: "Drill + Tapping Cantilever Positioning Stand",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/tapping-cantilever-drill-guide-aluminum",
  },
  "drill-bits": {
    id: "drill-bits",
    nameZh: "套裝 6.35mm 粗六角柄 三尖木工鑽頭組",
    nameEn: "6.35mm Hex Shank Brad Point Drill Bit Set",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/three-point-wood-drill-bit-6-35mm-hex",
  },
  "dowel-jig": {
    id: "dowel-jig",
    nameZh: "木板打孔定位器（木釘拼接專用）",
    nameEn: "Doweling Jig (For Dowel Joinery)",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/dowel-jig-alignment-tool",
  },
  "pocket-hole-jig": {
    id: "pocket-hole-jig",
    nameZh: "二代斜孔定位器（斜孔器夾具）",
    nameEn: "Gen-2 Pocket-Hole Jig",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/pocket-hole-jig-gen2-angled-drill-guide",
  },
  "groove-blade": {
    id: "groove-blade",
    nameZh: "開槽直刀（修邊機刀頭，6 柄）",
    nameEn: "Straight Grooving Bit (Trim Router, 6mm Shank)",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/router-bit-set-6pcs-trimmer-dovetail-roundover",
  },

  // ----- 五金 (家具特殊) -----
  "concealed-hinge": {
    id: "concealed-hinge",
    nameZh: "隱藏鉸鏈（合頁）",
    nameEn: "Concealed Hinge",
    category: "hardware",
    shopUrl: "https://woodenren.easy.co/collections/%E5%90%88%E9%A0%81",
  },

  // ----- 木頭仁賣場新增（2026-05-21）-----
  "chisel-canvas-roll": {
    id: "chisel-canvas-roll",
    nameZh: "日式 13 格帆布鑿刀包（工具捲包）",
    nameEn: "Japanese 13-Pocket Canvas Chisel Roll",
    category: "chisel",
    shopUrl:
      "https://woodenren.easy.co/products/japanese-13-slot-canvas-chisel-roll-bag",
    notes: "鑿刀收納捲包，13 格能裝完整一套；保護刀刃也方便攜帶",
  },
  "silicone-lubricant": {
    id: "silicone-lubricant",
    nameZh: "匠之滑 矽質潤滑噴霧 450ml（台製）",
    nameEn: "Takumi Silicone Lubricant Spray 450ml (Made in Taiwan)",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/silicone-lubricant-spray-450ml",
    notes: "帶鋸／台鋸／平刨機台面防鏽＋離型；木屑不沾、推料順暢",
  },
  "dovetail-jig": {
    id: "dovetail-jig",
    nameZh: "鳩尾榫檯（全透燕尾榫治具）",
    nameEn: "Through-Dovetail Jig",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/dovetail-jig-marking-template-set",
    notes: "修邊機配燕尾刀做全透鳩尾榫的定位治具；木盒／抽屜箱大量重複用",
  },
  "tenz-screw-set": {
    id: "tenz-screw-set",
    nameZh: "TENZ 登馳低耗能星型螺絲（2024 新款）",
    nameEn: "TENZ Low-Torque Star-Drive Wood Screws (2024)",
    category: "hardware",
    shopUrl:
      "https://woodenren.easy.co/products/tenz-low-energy-star-drive-wood-screws",
    notes: "台灣精品獎；星型頭省力不咬合，pocket-hole / 直鎖通用",
  },
  "sharpening-jig": {
    id: "sharpening-jig",
    nameZh: "鋁合金定角磨刀器（鑿刀／鉋刀定角開刃）",
    nameEn: "Aluminum Honing Guide (Chisels & Plane Irons)",
    category: "sharpening",
    shopUrl:
      "https://woodenren.easy.co/products/aluminum-honing-guide-plane-chisel",
    notes: "夾住鑿刀／鉋刀刃口，搭配磨刀石維持固定角度（25°/30°）；新手必備",
  },
  "glue-tray-set": {
    id: "glue-tray-set",
    nameZh: "矽膠膠水托盤＋刷膠工具組",
    nameEn: "Silicone Glue Tray + Brush Set",
    category: "glue",
    shopUrl:
      "https://woodenren.easy.co/products/silicone-glue-tray-roller-brush-set",
    notes: "矽膠托盤＋滾筒刷＋平刷；膠水乾掉一撕即淨，比紙杯衛生",
  },
  "router-engraving-base": {
    id: "router-engraving-base",
    nameZh: "龜甲紋雕刻底座（修邊機圓弧雕刻座）",
    nameEn: "Tortoiseshell Pattern Carving Base (Trim Router Arc Jig)",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/turtle-shell-carving-router-base-naguri",
    notes: "修邊機加裝這個底座做圓弧／龜甲紋雕刻；裝飾性家具加分項",
  },

  // ----- 木頭仁賣場新增第二批（2026-05-21）-----
  "masking-tape-low-tack": {
    id: "masking-tape-low-tack",
    nameZh: "弱黏款紙膠帶（不剝面板 / 不留膠）",
    nameEn: "Low-Tack Masking Tape (No Surface Damage / No Residue)",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/woodworking-washi-masking-tape-low-tack",
    notes: "切割／塗裝防溢膠線、膠合定位、面板保護萬用；弱黏不撕掉表面",
  },
  "quick-bench-vise": {
    id: "quick-bench-vise",
    nameZh: "快速木工虎鉗 SKC-301（快拆桌鉗）",
    nameEn: "Quick-Release Bench Vise SKC-301",
    category: "clamp",
    shopUrl:
      "https://woodenren.easy.co/products/quick-woodworking-vise-skc-301",
    notes: "桌面快拆虎鉗，鑿榫／鋸切時鎖緊零件用；比 F 夾穩定",
  },
  "hand-drill-brace": {
    id: "hand-drill-brace",
    nameZh: "手搖鑽（三爪手鑽）",
    nameEn: "Hand Drill (Three-Jaw Brace)",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/three-jaw-hand-drill-woodworking",
    notes: "手動鑽孔，職人手感款；無電源也能鑽、鎖螺絲不傷面板",
  },
  "magnetic-saw-guide": {
    id: "magnetic-saw-guide",
    nameZh: "磁切切割輔具 90/45 度（手鋸神器）",
    nameEn: "Magnetic Saw Guide 90°/45° (Hand Saw Helper)",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/magnetic-saw-guide-90-45-degree",
    notes: "磁吸式手鋸導引塊，90/45 度切割不歪斜；斜接、畫框、切肩線必備",
  },
  "silicone-glue-box": {
    id: "silicone-glue-box",
    nameZh: "矽膠膠水盒＋矽膠刷（可水洗）",
    nameEn: "Silicone Glue Box + Silicone Brush (Washable)",
    category: "glue",
    shopUrl:
      "https://woodenren.easy.co/products/silicone-glue-brush-pot-set",
    notes: "膠水儲存＋塗布二合一，可水洗重複用，比拋棄式紙杯／海綿環保",
  },
  "marking-knife": {
    id: "marking-knife",
    nameZh: "劃線刀（SK5 雙刃手工雕刻刀）",
    nameEn: "Marking Knife (SK5 Double-Edge)",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/sk5-double-edge-marking-carving-knife-beech",
    notes: "比鉛筆精準十倍；切斷木纖維留下明顯刻線，榫接對位專用",
  },
  "countersink-bit": {
    id: "countersink-bit",
    nameZh: "半自動沉孔鑽（不傷面板螺絲埋頭鑽）",
    nameEn: "Semi-Auto Countersink Bit (Non-Marring Screw Recess)",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/semi-auto-countersink-drill-set",
    notes: "螺絲頭埋進木面不外露，正面光潔；pocket-hole 進階版",
  },
};

/**
 * Tool name EN map. Add new tool ids here when they appear in TOOL_CATALOG.
 * Missing entries fall back to tool.nameZh (Tool type has no nameEn field).
 */
export const TOOL_NAME_EN: Record<string, string> = {
  "tape-measure-5m": "Tape measure (5 m)",
  "try-square": "Try square",
  "marking-gauge": "Marking gauge",
  "dovetail-marker": "Dovetail marker",
  "chisel-set-3-6-12": "Chisel set (3 / 6 / 12 mm)",
  "chisel-hardwood": "Hardwood chisel",
  "japanese-saw": "Japanese pull saw",
  "dovetail-saw": "Dovetail saw",
  "all-purpose-saw": "All-purpose hand saw",
  "flush-cut-saw": "Flush-cut saw",
  "groove-plane": "Plough / groove plane",
  mallet: "Mallet",
  "f-clamp-x4": "F-clamps × 4",
  "long-clamp-x2": "Bar / parallel clamps × 2",
  "sandpaper-set": "Sandpaper set (120 / 240 / 400)",
  "sandpaper-coarse-60": "Coarse sandpaper (60 grit)",
  "pva-glue": "PVA wood glue",
  "wood-oil": "Wood oil",
  "router-table": "Router table",
  drill: "Drill",
  "drill-bits": "Drill bit set",
  "dowel-jig": "Doweling jig",
  "pocket-hole-jig": "Pocket-hole jig",
  "groove-blade": "Dado / grooving blade",
  "concealed-hinge": "Concealed hinge",
  "chisel-canvas-roll": "Chisel canvas roll",
  "silicone-lubricant": "Silicone lubricant",
  "dovetail-jig": "Dovetail jig",
  "tenz-screw-set": "TENZ screw set",
  "sharpening-jig": "Sharpening jig",
  "glue-tray-set": "Glue tray set",
  "router-engraving-base": "Router engraving base",
  "masking-tape-low-tack": "Low-tack masking tape",
  "quick-bench-vise": "Quick-release bench vise",
  "hand-drill-brace": "Hand-drill brace",
  "magnetic-saw-guide": "Magnetic saw guide",
  "silicone-glue-box": "Silicone glue box",
  "marking-knife": "Marking knife",
  "countersink-bit": "Countersink bit",
  jointer: "Jointer",
  "jointer-planer": "Jointer / planer",
  thicknesser: "Thicknesser",
  "biscuit-joiner": "Biscuit joiner",
  jigsaw: "Jigsaw",
  "miter-box": "Miter box",
};

export function toolName(tool: Tool, locale: string): string {
  if (locale === "en") {
    if (tool.nameEn) return tool.nameEn;
    const en = TOOL_NAME_EN[tool.id];
    if (en) return en;
  }
  return tool.nameZh;
}
