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
  | "hardware";

export type ToolPriority = "required" | "recommended" | "optional";

export interface Tool {
  id: string;
  nameZh: string;
  category: ToolCategory;
  /** TODO(woodenren-shop): replace with real Easy Store product URLs */
  shopUrl?: string;
  sku?: string;
  /** Cached price in NT$. Refresh manually until scraper exists. */
  priceCached?: number;
  alternativeIds?: string[];
  notes?: string;
}

const SHOP_BASE = "https://woodenren.easy.co/products";

export const TOOL_CATALOG: Record<string, Tool> = {
  // ----- 量測 / 劃線 -----
  "tape-measure-5m": {
    id: "tape-measure-5m",
    nameZh: "5m 卷尺",
    category: "measure",
    shopUrl: `${SHOP_BASE}/tape-measure-5m`,
  },
  pencil: {
    id: "pencil",
    nameZh: "木工鉛筆",
    category: "marking",
    shopUrl: `${SHOP_BASE}/woodworking-pencil`,
  },
  "try-square": {
    id: "try-square",
    nameZh: "150mm 直角尺",
    category: "measure",
    shopUrl: `${SHOP_BASE}/try-square-150`,
  },
  "marking-gauge": {
    id: "marking-gauge",
    nameZh: "劃線規",
    category: "marking",
    shopUrl: `${SHOP_BASE}/marking-gauge`,
  },
  "dovetail-marker": {
    id: "dovetail-marker",
    nameZh: "鳩尾規 (1:6 / 1:8)",
    category: "marking",
    shopUrl: `${SHOP_BASE}/dovetail-marker`,
  },

  // ----- 鑿刀 -----
  "chisel-set-3-6-12": {
    id: "chisel-set-3-6-12",
    nameZh: "鑿刀組 (3 / 6 / 12mm)",
    category: "chisel",
    shopUrl: `${SHOP_BASE}/chisel-set-basic`,
  },
  "chisel-fine": {
    id: "chisel-fine",
    nameZh: "細鑿刀 (3mm 燕尾用)",
    category: "chisel",
    shopUrl: `${SHOP_BASE}/chisel-fine-3mm`,
  },
  "chisel-hardwood": {
    id: "chisel-hardwood",
    nameZh: "白橡硬木專用鑿刀組",
    category: "chisel",
    shopUrl: `${SHOP_BASE}/chisel-hardwood`,
    notes: "硬木需高碳鋼或 PM-V11 鋼種",
  },

  // ----- 鋸 -----
  "japanese-saw": {
    id: "japanese-saw",
    nameZh: "日式雙刃鋸 (橫切+縱切)",
    category: "saw",
    shopUrl: `${SHOP_BASE}/ryoba-saw`,
  },
  "dovetail-saw": {
    id: "dovetail-saw",
    nameZh: "鳩尾鋸 (細齒)",
    category: "saw",
    shopUrl: `${SHOP_BASE}/dovetail-saw`,
  },
  "miter-saw": {
    id: "miter-saw",
    nameZh: "斜切鋸",
    category: "saw",
    shopUrl: `${SHOP_BASE}/miter-saw`,
  },
  "tungsten-blade": {
    id: "tungsten-blade",
    nameZh: "鎢鋼鋸片 (硬木用)",
    category: "saw",
    shopUrl: `${SHOP_BASE}/tungsten-blade`,
  },
  "round-saw": {
    id: "round-saw",
    nameZh: "圓棒鋸",
    category: "saw",
    shopUrl: `${SHOP_BASE}/round-tenon-saw`,
  },

  // ----- 刨 -----
  "groove-plane": {
    id: "groove-plane",
    nameZh: "槽溝刨",
    category: "plane",
    shopUrl: `${SHOP_BASE}/groove-plane`,
    alternativeIds: ["trim-router"],
  },

  // ----- 木槌 / 夾具 -----
  mallet: {
    id: "mallet",
    nameZh: "木槌",
    category: "chisel",
    shopUrl: `${SHOP_BASE}/wooden-mallet`,
  },
  "f-clamp-x4": {
    id: "f-clamp-x4",
    nameZh: "F 型木工夾 ×4",
    category: "clamp",
    shopUrl: `${SHOP_BASE}/f-clamp-set-4`,
  },
  "long-clamp-x2": {
    id: "long-clamp-x2",
    nameZh: "1200mm 長型木工夾 ×2",
    category: "clamp",
    shopUrl: `${SHOP_BASE}/long-clamp-1200`,
  },

  // ----- 砂磨 / 膠合 / 塗裝 -----
  "sandpaper-set": {
    id: "sandpaper-set",
    nameZh: "砂紙組 (120 / 240 / 400 番)",
    category: "sand",
    shopUrl: `${SHOP_BASE}/sandpaper-set`,
  },
  "sandpaper-coarse-60": {
    id: "sandpaper-coarse-60",
    nameZh: "60 番粗砂紙 (硬木去刨痕)",
    category: "sand",
    shopUrl: `${SHOP_BASE}/sandpaper-60`,
  },
  "pva-glue": {
    id: "pva-glue",
    nameZh: "PVA 木工膠 (Titebond II)",
    category: "glue",
    shopUrl: `${SHOP_BASE}/pva-glue`,
  },
  "wood-oil": {
    id: "wood-oil",
    nameZh: "護木油 (亞麻仁 / 胡桃)",
    category: "finish",
    shopUrl: `${SHOP_BASE}/wood-oil`,
  },

  // ----- 電動 -----
  "trim-router": {
    id: "trim-router",
    nameZh: "修邊機",
    category: "power",
    shopUrl: `${SHOP_BASE}/trim-router`,
  },
  "router-table": {
    id: "router-table",
    nameZh: "銑床 / 路達桌",
    category: "power",
    shopUrl: `${SHOP_BASE}/router-table`,
  },
  drill: {
    id: "drill",
    nameZh: "電鑽",
    category: "power",
    shopUrl: `${SHOP_BASE}/cordless-drill`,
  },
  "drill-bits": {
    id: "drill-bits",
    nameZh: "鑽頭組 (3-12mm)",
    category: "power",
    shopUrl: `${SHOP_BASE}/drill-bit-set`,
  },
  "dowel-jig": {
    id: "dowel-jig",
    nameZh: "木釘鑽孔夾具",
    category: "power",
    shopUrl: `${SHOP_BASE}/dowel-jig`,
  },
  "pocket-hole-jig": {
    id: "pocket-hole-jig",
    nameZh: "口袋孔夾具 (Kreg K4/K5)",
    category: "power",
    shopUrl: `${SHOP_BASE}/pocket-hole-jig`,
  },
  "groove-blade": {
    id: "groove-blade",
    nameZh: "開槽鋸片 (斜切片榫用)",
    category: "saw",
    shopUrl: `${SHOP_BASE}/groove-blade`,
  },

  // ----- 五金 (家具特殊) -----
  "drawer-slide": {
    id: "drawer-slide",
    nameZh: "抽屜滑軌",
    category: "hardware",
    shopUrl: `${SHOP_BASE}/drawer-slide`,
  },
  "concealed-hinge": {
    id: "concealed-hinge",
    nameZh: "隱藏鉸鏈",
    category: "hardware",
    shopUrl: `${SHOP_BASE}/concealed-hinge`,
  },
};
