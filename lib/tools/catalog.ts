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
    category: "measure",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%BE%B7%E5%9C%8B%E8%A3%BD%E7%A8%8Bgiant%E5%8D%87%E7%B4%9A%E6%8D%B2%E5%B0%BA5%E5%85%AC%E5%B0%BA-%E5%B0%88%E6%A5%AD%E9%87%8D%E5%9E%8B%E6%8D%B2%E5%B0%BA-%E9%AB%98%E5%93%81%E8%B3%AA%E8%87%AA%E9%8E%96-%E9%AB%98%E7%B2%BE%E5%BA%A6%E6%8A%97%E6%91%94",
  },
  "try-square": {
    id: "try-square",
    nameZh: "不鏽鋼直尺 30cm",
    category: "measure",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E9%8B%BC%E5%B0%BA-%E4%B8%8D%E9%8F%BD%E9%8B%BC%E7%9B%B4%E5%B0%BA-%E9%90%B5%E9%8B%BC%E5%B0%BA-%E5%8A%A0%E5%8E%9A%E7%A1%AC%E5%B0%BA30cm%E9%AB%98%E7%B2%BE%E5%BA%A6%E9%8B%BC%E6%9D%BF%E5%B0%BA",
  },
  "marking-gauge": {
    id: "marking-gauge",
    nameZh: "單桿劃線規（榫卯必備）",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%96%AE%E6%A1%BF%E5%8A%83%E7%B7%9A%E8%A6%8F-%E5%8A%83%E7%B7%9A%E5%88%80-%E6%A6%AB%E5%8D%AF%E5%BF%85%E5%82%99-%E6%9C%A8%E5%B7%A5%E5%B7%A5%E5%85%B7-%E5%8A%83%E7%B7%9A%E5%88%80-%E8%A3%9D%E6%BD%A2",
  },
  "dovetail-marker": {
    id: "dovetail-marker",
    nameZh: "自由角規 / 萬用角度規",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E8%87%AA%E7%94%B1%E8%A7%92%E8%A6%8F-%E5%A4%9A%E5%8A%9F%E8%83%BD%E5%B0%BA%E8%A6%8F-%E8%90%AC%E7%94%A8%E8%A7%92%E5%BA%A6%E8%A6%8F-%E6%9C%A8%E5%B7%A5%E5%8A%83%E7%B7%9A%E9%87%8F%E5%99%A8-%E5%A4%9A%E5%8A%9F%E8%83%BD%E7%B5%84%E5%90%88%E8%A7%92%E5%B0%BA-%E6%9C%A8%E5%B7%A5%E6%B4%BB%E5%8B%95%E8%A7%92%E5%B0%BA",
  },

  // ----- 鑿刀 -----
  "chisel-set-3-6-12": {
    id: "chisel-set-3-6-12",
    nameZh: "西式鑿刀組",
    category: "chisel",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E8%A5%BF%E5%BC%8F%E9%91%BF%E5%88%80%E5%A5%97%E8%A3%9D%E7%B5%84-%E9%91%BF%E5%88%80-%E6%89%93%E9%91%BF-%E4%BF%AE%E9%91%BF",
  },
  "chisel-hardwood": {
    id: "chisel-hardwood",
    nameZh: "鹿港打鑿十本組（硬木專用）",
    category: "chisel",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E9%B9%BF%E6%B8%AF%E6%89%93%E9%91%BF%E5%8D%81%E6%9C%AC%E7%B5%84-%E4%BF%AE%E9%91%BF-%E6%9C%A8%E5%B7%A5%E9%91%BF-%E9%91%BF%E5%88%80-%E6%89%93%E9%91%BF-%E6%9C%A8%E5%B7%A5%E9%91%BF%E5%88%80-%E5%8F%B0%E7%81%A3%E8%A3%BD",
    notes: "硬木需高碳鋼或台製手工鑿，普通鑿刀易崩刃",
  },

  // ----- 鋸 -----
  "japanese-saw": {
    id: "japanese-saw",
    nameZh: "日式雙刃鋸（橫切+縱切）",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%A4%BE%E8%83%8C%E9%8B%B8-%E6%9C%A8%E5%B7%A5%E9%8B%B8-%E6%A9%AB%E6%96%B7%E9%9D%A2%E9%8B%B8-%E9%9B%99%E9%9D%A2%E9%8B%B8-%E6%9C%A8%E6%9D%BF%E5%88%87%E5%89%B2%E9%96%8B%E6%A6%AB%E9%8B%B8-%E7%A1%AC%E6%9C%A8%E9%8B%B8-%E6%89%8B%E5%B7%A5%E9%8B%B8-%E5%88%80%E9%8B%B8%E6%97%A5%E5%BC%8F%E5%B7%A5%E5%85%B7",
  },
  "dovetail-saw": {
    id: "dovetail-saw",
    nameZh: "岡田 Z-Saw 07055 導突鋸（硬木專用）",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%97%A5%E6%9C%AC%E5%B2%A1%E7%94%B0-z%E7%89%8C-%E8%86%A0%E6%9F%84%E5%B0%8E%E7%AA%81%E9%8B%B8-%E7%A1%AC%E6%9C%A8%E5%B0%88%E7%94%A8-150-%E5%A4%BE%E8%83%8C%E9%8B%B8-%E6%A6%AB%E9%A0%AD%E9%8B%B8-%E6%97%A5%E6%9C%AC%E8%A3%BD%E9%80%A0-z-saw-no-07055-%E8%B6%85%E8%96%84%E5%88%83",
  },

  // ----- 刨 -----
  "groove-plane": {
    id: "groove-plane",
    nameZh: "木工清底鉋 / 開槽鉋",
    category: "plane",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%9C%A8%E5%B7%A5%E6%B8%85%E5%BA%95%E9%89%8B-%E9%96%8B%E6%A7%BD%E9%89%8B-%E6%A6%AB%E8%82%A9%E9%89%8B-%E5%87%B9%E6%A7%BD%E4%BF%AE%E6%95%B4%E6%89%8B%E9%89%8B-%E7%9B%B4%E8%A7%92%E9%89%8B-%E6%89%8B%E5%8B%95%E9%96%8B%E6%A7%BD-%E7%B2%BE%E6%BA%96%E6%B8%85%E5%BA%95-",
  },

  // ----- 木槌 / 夾具 -----
  mallet: {
    id: "mallet",
    nameZh: "白膠鎚（膠槌，不留痕跡）",
    category: "chisel",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E7%99%BD%E8%86%A0%E9%8E%9A-%E4%B8%8D%E7%95%99%E7%97%95%E8%B7%A1-%E8%86%A0%E9%8C%98-%E6%9C%A8%E6%9F%84%E8%86%A0%E9%8E%9A-%E9%8E%9A%E5%AD%90-%E5%AE%B6%E5%85%B7%E7%B5%84%E8%A3%9D%E9%8E%9A",
  },
  "f-clamp-x4": {
    id: "f-clamp-x4",
    nameZh: "加厚瑪鋼美式 F 夾 ×4",
    category: "clamp",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%9C%A8%E5%B7%A5%E5%BF%85%E5%82%99%E5%BF%AB%E9%80%9F%E5%A4%BE-%E5%8A%A0%E5%8E%9A%E7%91%AA%E9%8B%BC%E7%BE%8E%E5%BC%8Ff%E5%A4%BE-%E9%87%8D%E5%9E%8B%E6%9C%A8%E5%B7%A5%E5%A4%BE%E5%85%B7-%E7%9F%B3%E6%9D%90%E5%BF%AB%E9%80%9F%E5%A4%BE",
  },
  "long-clamp-x2": {
    id: "long-clamp-x2",
    nameZh: "德式重型 F 夾（長型）×2",
    category: "clamp",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E9%87%8D%E5%9E%8B%E6%9C%A8%E5%B7%A5%E5%A4%BE%E5%AD%90-f%E5%A4%BE-%E9%98%B2%E6%BB%91%E6%A9%A1%E8%86%A0%E6%8A%8A%E6%89%8B-%E5%A4%BE%E9%89%97%E5%9B%BA%E5%AE%9A%E5%B7%A5%E5%85%B7-%E5%A3%93%E7%B7%8A%E5%99%A8%E6%A8%A1%E5%85%B7%E5%A4%BE%E5%BF%AB%E9%80%9F-%E5%BE%B7%E5%BC%8F%E9%87%8D%E5%9E%8Bf%E5%A4%BE",
  },

  // ----- 砂磨 / 膠合 / 塗裝 -----
  "sandpaper-set": {
    id: "sandpaper-set",
    nameZh: "日本富士星方型砂紙 120–600 番",
    category: "sand",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%97%A5%E6%9C%AC%E5%AF%8C%E5%A3%AB%E6%98%9F%E6%96%B9%E5%9E%8B%E7%A0%82%E7%B4%99-%E7%A0%82%E7%A3%A8%E7%A5%9E%E5%99%A8-%E8%99%9F%E6%95%B8120-600%E8%99%9F-%E4%B9%BE%E7%A3%A8%E7%A0%82%E7%B4%99-%E6%9C%A8%E5%B7%A5%E7%A0%82%E7%B4%99-%E5%AE%B6%E5%85%B7%E7%A0%82%E7%B4%99",
  },
  "sandpaper-coarse-60": {
    id: "sandpaper-coarse-60",
    nameZh: "粗番砂紙 60–80（硬木去刨痕）",
    category: "sand",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%97%A5%E6%9C%AC%E5%AF%8C%E5%A3%AB%E6%98%9F%E6%96%B9%E5%9E%8B%E7%A0%82%E7%B4%99-%E7%A0%82%E7%A3%A8%E7%A5%9E%E5%99%A8-%E8%99%9F%E6%95%B8120-600%E8%99%9F-%E4%B9%BE%E7%A3%A8%E7%A0%82%E7%B4%99-%E6%9C%A8%E5%B7%A5%E7%A0%82%E7%B4%99-%E5%AE%B6%E5%85%B7%E7%A0%82%E7%B4%99",
  },
  "pva-glue": {
    id: "pva-glue",
    nameZh: "太棒膠二號（PVA 木工膠）",
    category: "glue",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%9C%A8%E5%B7%A5%E8%86%A0-%E5%A4%AA%E6%A3%92%E6%9C%A8%E5%B7%A5%E8%86%A0-%E6%8B%BC%E6%9D%BF%E8%86%A0-%E5%96%AE%E6%B6%B2%E8%86%A0-%E5%AE%B6%E5%85%B7%E8%86%A0%E6%B0%B4-%E5%88%86%E8%A3%9D%E7%93%B6%E8%86%A0%E6%B0%B4",
  },
  "wood-oil": {
    id: "wood-oil",
    nameZh: "大谷 Vaton 木質保護油",
    category: "finish",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%A4%A7%E8%B0%B7%E5%A1%97%E6%96%99-vaton-%E6%9C%A8%E8%B3%AA%E4%BF%9D%E8%AD%B7%E6%B2%B9-%E6%BD%91%E6%B0%B4%E5%8A%91-501-511-519%E5%9C%B0%E6%9D%BF%E4%BF%9D%E8%AD%B7-%E5%AE%B6%E5%85%B7%E4%BF%9D%E9%A4%8A",
  },

  // ----- 電動 -----
  "router-table": {
    id: "router-table",
    nameZh: "鋁合金修邊機倒裝台",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E9%8B%81%E5%90%88%E9%87%91%E4%BF%AE%E9%82%8A%E6%A9%9F%E5%80%92%E8%A3%9D%E5%8F%B0-%E6%9C%A8%E5%B7%A5%E9%9B%95%E5%88%BB-%E9%96%8B%E6%A7%BD%E5%B7%A5%E5%85%B7-%E5%A4%9A%E5%8A%9F%E8%83%BD%E4%BF%AE%E9%82%8A%E6%A9%9F%E5%80%92%E8%A3%9D%E5%8D%87%E9%99%8D%E5%8F%B0-%E5%BE%AE%E8%AA%BF%E5%8D%87%E9%99%8D-%E9%8A%91%E5%88%80%E5%80%92%E8%A7%92%E5%B7%A5%E4%BD%9C%E5%8F%B0",
  },
  drill: {
    id: "drill",
    nameZh: "電鑽 + 攻絲懸臂定位支架",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%94%BB%E7%B5%B2%E6%87%B8%E8%87%82%E6%94%AF%E6%9E%B6-%E6%89%8B%E9%9B%BB%E9%91%BD%E6%94%BB%E7%89%99%E5%AE%9A%E4%BD%8D%E5%99%A8-%E9%8B%81%E5%90%88%E9%87%91%E5%9E%82%E7%9B%B4-%E6%B0%B4%E5%B9%B3%E6%94%BB%E7%B5%B2%E5%99%A8-%E9%8B%81%E5%9E%8B%E6%9D%90-diy-%E9%91%BD%E5%AD%94%E5%B0%8E%E5%90%91-%E7%B2%BE%E5%AF%86%E5%B0%8E%E8%BB%8C-%E4%B8%8D%E6%AD%AA%E6%96%9C-%E9%AB%98%E7%A9%A9%E5%AE%9A%E5%BA%A6",
  },
  "drill-bits": {
    id: "drill-bits",
    nameZh: "套裝 6.35mm 粗六角柄 三尖木工鑽頭組",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%A5%97%E8%A3%9D-6-35mm%E7%B2%97%E5%85%AD%E8%A7%92%E6%9F%84-%E4%B8%89%E5%B0%96%E6%9C%A8%E5%B7%A5%E9%91%BD%E9%A0%AD-%E5%96%AE%E9%9A%BB%E9%B3%A5%E7%B1%A0%E9%91%BD%E9%A0%AD-%E4%BD%9B%E7%8F%A0%E9%91%BD%E9%A0%AD-diy%E6%89%8B%E5%B7%A5%E9%91%BD%E9%A0%AD",
  },
  "dowel-jig": {
    id: "dowel-jig",
    nameZh: "木板打孔定位器（木釘拼接專用）",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%9C%A8%E6%9D%BF%E6%89%93%E5%AD%94%E5%AE%9A%E4%BD%8D%E5%99%A8-%E7%9B%B4%E5%AD%94%E9%91%BD%E5%AD%94-%E5%AE%9A%E4%BD%8D%E5%99%A8%E5%9C%93%E6%9C%A8%E6%A6%AB-%E6%8B%BC%E6%8E%A5%E6%9C%A8%E5%B7%A5%E5%B0%88%E7%94%A8",
  },
  "pocket-hole-jig": {
    id: "pocket-hole-jig",
    nameZh: "二代斜孔定位器（斜孔器夾具）",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%8F%B0%E7%81%A3%E5%87%BA%E8%B2%A8-%E6%9C%A8%E5%B7%A5%E6%96%B0%E6%AC%BE%E4%BA%8C%E4%BB%A3%E6%96%9C%E5%AD%94%E5%AE%9A%E4%BD%8D%E5%99%A8%E9%96%8B%E5%AD%94%E5%99%A8%E6%89%93%E6%96%9C%E7%9C%BC%E6%A9%9F%E9%91%BD%E9%A0%AD%E6%89%93%E6%96%9C%E5%8F%A3%E6%A8%A1%E5%85%B7%E5%B7%A5%E5%85%B7",
  },
  "groove-blade": {
    id: "groove-blade",
    nameZh: "開槽直刀（修邊機刀頭，6 柄）",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%B0%88%E6%A5%AD%E7%B4%9A%E7%9B%B4%E5%88%80-6%E6%9F%84-%E9%B3%A9%E5%B0%BE%E5%88%80-%E5%9C%93%E8%A7%92%E5%88%80-45%E5%BA%A6%E5%88%80-%E5%9C%93%E5%BA%95%E5%88%80-%E4%BF%AE%E9%82%8A%E5%88%80-%E4%BB%BF%E5%9E%8B%E5%88%80-%E4%BF%AE%E9%82%8A%E6%A9%9F-%E8%B7%AF%E9%81%94%E5%88%80-%E9%96%8B%E6%A7%BD%E9%8A%91%E5%88%80-%E4%BF%AE%E9%82%8A%E5%88%80-t%E5%9E%8B%E5%88%80",
  },

  // ----- 五金 (家具特殊) -----
  "concealed-hinge": {
    id: "concealed-hinge",
    nameZh: "隱藏鉸鏈（合頁）",
    category: "hardware",
    shopUrl: "https://woodenren.easy.co/collections/%E5%90%88%E9%A0%81",
  },
};
