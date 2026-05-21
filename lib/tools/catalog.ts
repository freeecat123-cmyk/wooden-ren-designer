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
    nameZh: "Temple Tool 180mm 雙刃鋸（縱切+橫切兩用，日本鋼材）",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-temple-tool-180mm-%E9%9B%99%E5%88%83%E9%8B%B8-%E6%97%A5%E5%BC%8F%E6%89%8B%E9%8B%B8-%E7%B8%B1%E5%88%87-%E6%A9%AB%E5%88%87%E5%85%A9%E7%94%A8-%E9%9B%99%E9%9D%A2%E9%8B%B8-%E6%97%A5%E6%9C%AC%E9%8B%BC%E6%9D%90-%E9%9D%88%E5%B7%A7%E5%9E%8B-%E7%B2%BE%E5%AF%86%E6%9C%A8%E4%BD%9C",
  },
  "dovetail-saw": {
    id: "dovetail-saw",
    nameZh: "Temple Tool 240mm 縱切導付鋸（日式夾背鋸，燕尾榫專用）",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-temple-tool-240mm-%E7%B8%B1%E5%88%87%E5%B0%8E%E4%BB%98%E9%8B%B8-%E6%97%A5%E5%BC%8F%E5%A4%BE%E8%83%8C%E9%8B%B8-%E7%87%95%E5%B0%BE%E6%A6%AB%E5%B0%88%E7%94%A8-%E6%9C%A8%E5%B7%A5%E9%8B%B8-%E6%A5%B5%E7%B4%B0%E9%BD%92%E6%97%A5%E6%9C%AC%E9%8B%BC%E6%9D%90-%E5%A4%BE%E8%83%8C%E9%8B%B8",
  },
  "all-purpose-saw": {
    id: "all-purpose-saw",
    nameZh: "Temple Tool 150mm 全能導付鋸（日式夾背鋸，泛用型極細齒）",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/%E6%9C%A8%E9%A0%AD%E4%BB%81-temple-tool-150mm-%E5%85%A8%E8%83%BD%E5%B0%8E%E4%BB%98%E9%8B%B8-%E6%97%A5%E5%BC%8F%E5%A4%BE%E8%83%8C%E9%8B%B8-%E6%B3%9B%E7%94%A8%E5%9E%8B%E6%A5%B5%E7%B4%B0%E9%BD%92-%E5%AE%B6%E5%85%B7%E5%B8%AB%E9%96%8B%E7%99%BC-%E6%97%A5%E6%9C%AC%E9%8B%BC%E6%9D%90-%E7%B2%BE%E5%AF%86%E6%A6%AB%E6%8E%A5-%E5%BE%AE%E5%9E%8B",
  },
  "flush-cut-saw": {
    id: "flush-cut-saw",
    nameZh: "Temple Tool 150mm 齊平剪切鋸（日式釘引鋸，無撥齒不傷木面）",
    category: "saw",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-temple-tool-150mm-%E9%BD%8A%E5%B9%B3%E5%89%AA%E5%88%87%E9%8B%B8-%E6%97%A5%E5%BC%8F%E6%89%8B%E5%B7%A5%E9%87%98%E5%BC%95%E9%8B%B8-%E7%84%A1%E6%92%A5%E9%BD%92%E8%A8%AD%E8%A8%88-%E5%AE%B6%E5%85%B7%E5%B8%AB%E9%96%8B%E7%99%BC-%E4%B8%8D%E5%82%B7%E6%9C%A8%E9%9D%A2-%E6%A5%B5%E8%96%84%E5%BD%88%E6%80%A7%E9%8B%B8",
    notes: "無撥齒設計，鋸身可貼平木面切除突出榫頭/木釘而不刮傷表面",
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

  // ----- 木頭仁賣場新增（2026-05-21）-----
  "chisel-canvas-roll": {
    id: "chisel-canvas-roll",
    nameZh: "日式 13 格帆布鑿刀包（工具捲包）",
    category: "chisel",
    shopUrl:
      "https://woodenren.easy.co/collections/%EF%B8%8F-%E6%9C%A8%E5%B7%A5%E9%98%B2%E8%AD%B7/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%97%A5%E5%BC%8F13%E6%A0%BC%E5%B8%86%E5%B8%83%E9%91%BF%E5%88%80%E5%8C%85-%E5%B7%A5%E5%85%B7%E5%8C%85-%E9%9B%95%E5%88%BB%E5%88%80%E5%8C%85-%E5%B8%86%E5%B8%83%E5%8C%85-%E9%91%BF%E5%88%80%E8%A2%8B",
    notes: "鑿刀收納捲包，13 格能裝完整一套；保護刀刃也方便攜帶",
  },
  "silicone-lubricant": {
    id: "silicone-lubricant",
    nameZh: "匠之滑 矽質潤滑噴霧 450ml（台製）",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/collections/feature-on-homepage/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%8C%A0%E4%B9%8B%E6%BB%91-%E9%AB%98%E6%95%88%E8%83%BD%E7%9F%BD%E8%B3%AA%E6%BD%A4%E6%BB%91%E5%99%B4%E9%9C%A7-450ml%EF%BD%9C%E5%B8%B6%E9%8B%B8%E6%A9%9F-%E5%8F%B0%E9%8B%B8-%E5%B9%B3%E5%88%A8%E6%A9%9F-%E6%9C%A8%E5%B7%A5%E6%A9%9F%E5%85%B7%E6%BD%A4%E6%BB%91%E5%8A%91-%E9%98%B2%E9%8F%BD-%E9%9B%A2%E5%9E%8B%E5%8A%91-taiwan%E8%A3%BD",
    notes: "帶鋸／台鋸／平刨機台面防鏽＋離型；木屑不沾、推料順暢",
  },
  "dovetail-jig": {
    id: "dovetail-jig",
    nameZh: "鳩尾榫檯（全透燕尾榫治具）",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/collections/feature-on-homepage/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E9%B3%A9%E5%B0%BE%E6%A6%AB%E6%AA%AF-%E9%B3%A9%E5%B0%BE%E6%A6%AB%E7%89%87-%E7%87%95%E5%B0%BE%E6%A6%AB%E6%AA%AF-%E6%A6%AB%E7%89%87-%E5%85%A8%E9%80%8F%E9%B3%A9%E5%B0%BE%E6%A6%AB-%E6%9C%A8%E5%B7%A5diy",
    notes: "修邊機配燕尾刀做全透鳩尾榫的定位治具；木盒／抽屜箱大量重複用",
  },
  "tenz-screw-set": {
    id: "tenz-screw-set",
    nameZh: "TENZ 登馳低耗能星型螺絲（2024 新款）",
    category: "hardware",
    shopUrl:
      "https://woodenren.easy.co/collections/feature-on-homepage/products/tenz-%E7%99%BB%E9%A6%B3%E8%9E%BA%E7%B5%B2-%E4%BD%8E%E8%80%97%E8%83%BD%E8%9E%BA%E7%B5%B2-2024%E6%96%B0%E6%AC%BE%E7%99%BB%E9%A6%B3-%E6%98%9F%E5%9E%8B%E8%9E%BA%E7%B5%B2-%E6%9C%A8%E5%B7%A5%E8%9E%BA%E7%B5%B2-%E5%8F%B0%E7%81%A3%E7%B2%BE%E5%93%81%E7%8D%8E",
    notes: "台灣精品獎；星型頭省力不咬合，pocket-hole / 直鎖通用",
  },
  "sharpening-jig": {
    id: "sharpening-jig",
    nameZh: "鋁合金定角磨刀器（鑿刀／鉋刀定角開刃）",
    category: "sharpening",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E9%8B%81%E5%90%88%E9%87%91%E5%AE%9A%E8%A7%92%E7%A3%A8%E5%88%80%E5%99%A8-%E6%9C%A8%E5%B7%A5%E7%A3%A8%E5%88%80%E6%9E%B6-%E9%89%8B%E5%88%80-%E9%91%BF%E5%AD%90%E5%AE%9A%E8%A7%92%E5%99%A8-%E6%89%8B%E5%8B%95%E9%96%8B%E5%88%83%E5%99%A8-%E9%AB%98%E7%B2%BE%E5%BA%A6-%E9%98%B2%E6%BB%91%E6%BB%BE%E8%BC%AA-",
    notes: "夾住鑿刀／鉋刀刃口，搭配磨刀石維持固定角度（25°/30°）；新手必備",
  },
  "glue-tray-set": {
    id: "glue-tray-set",
    nameZh: "矽膠膠水托盤＋刷膠工具組",
    category: "glue",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E7%9F%BD%E8%86%A0%E8%86%A0%E6%B0%B4%E6%89%98%E7%9B%A4-%E5%88%B7%E8%86%A0%E5%B7%A5%E5%85%B7%E7%B5%84-%E6%9C%A8%E5%B7%A5%E5%A1%97%E8%86%A0%E5%AE%B9%E5%99%A8-%E6%BB%BE%E7%AD%92%E5%88%B7-%E7%9F%BD%E8%86%A0%E5%88%B7-%E8%86%A0%E6%B0%B4%E4%B9%BE%E6%8E%89%E4%B8%80%E6%92%95%E5%8D%B3%E6%B7%A8-",
    notes: "矽膠托盤＋滾筒刷＋平刷；膠水乾掉一撕即淨，比紙杯衛生",
  },
  "router-engraving-base": {
    id: "router-engraving-base",
    nameZh: "龜甲紋雕刻底座（修邊機圓弧雕刻座）",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E9%BE%9C%E7%94%B2%E7%B4%8B%E9%9B%95%E5%88%BB%E5%BA%95%E5%BA%A7-%E5%9C%93%E5%BC%A7%E9%9B%95%E5%88%BB%E5%BA%A7-%E4%BF%AE%E9%82%8A%E6%A9%9F%E5%BA%A7-%E8%B7%AF%E9%81%94%E5%BA%A7-%E9%9B%95%E5%88%BB%E5%BA%A7",
    notes: "修邊機加裝這個底座做圓弧／龜甲紋雕刻；裝飾性家具加分項",
  },

  // ----- 木頭仁賣場新增第二批（2026-05-21）-----
  "masking-tape-low-tack": {
    id: "masking-tape-low-tack",
    nameZh: "弱黏款紙膠帶（不剝面板 / 不留膠）",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E7%B4%99%E8%86%A0%E5%B8%B6%E5%BC%B1%E9%BB%8F%E6%AC%BE-%E6%9C%A8%E5%B7%A5%E6%A8%99%E8%A8%98%E9%BB%8F%E5%90%88-%E7%89%86%E5%A3%81%E4%B8%8D%E5%89%9D%E8%90%BD%E5%92%8C%E7%B4%99%E8%86%A0%E5%B8%B6",
    notes: "切割／塗裝防溢膠線、膠合定位、面板保護萬用；弱黏不撕掉表面",
  },
  "quick-bench-vise": {
    id: "quick-bench-vise",
    nameZh: "快速木工虎鉗 SKC-301（快拆桌鉗）",
    category: "clamp",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%BF%AB%E9%80%9F%E6%9C%A8%E5%B7%A5%E8%99%8E%E9%89%97-skc-301-%E6%9C%A8%E5%B7%A5%E5%A4%BE-%E5%BF%AB%E9%80%9F%E8%99%8E%E9%89%97-%E6%9C%A8%E5%B7%A5%E6%A1%8C%E9%89%97",
    notes: "桌面快拆虎鉗，鑿榫／鋸切時鎖緊零件用；比 F 夾穩定",
  },
  "hand-drill-brace": {
    id: "hand-drill-brace",
    nameZh: "手搖鑽（三爪手鑽）",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%89%8B%E6%90%96%E9%91%BD-%E4%B8%89%E7%88%AA-%E6%9C%A8%E5%B7%A5%E9%91%BD-%E6%89%8B%E6%90%96%E8%B5%B7%E5%AD%90-%E6%89%8B%E9%91%BD",
    notes: "手動鑽孔，職人手感款；無電源也能鑽、鎖螺絲不傷面板",
  },
  "magnetic-saw-guide": {
    id: "magnetic-saw-guide",
    nameZh: "磁切切割輔具 90/45 度（手鋸神器）",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E7%A3%81%E5%88%87%E5%88%87%E5%89%B2%E8%BC%94%E5%85%B790%E5%BA%A6-45%E5%BA%A6-%E6%89%8B%E9%8B%B8%E7%A5%9E%E5%99%A8-%E7%B2%BE%E6%BA%96%E5%88%87%E5%89%B2%E7%9B%B4%E8%A7%92-45%E5%BA%A6%E8%A7%92-%E5%88%87%E5%89%B2%E9%9D%A0%E5%B1%B1-%E6%89%8B%E5%B7%A5%E7%A5%9E%E5%99%A8-%E7%A3%81%E5%90%B8",
    notes: "磁吸式手鋸導引塊，90/45 度切割不歪斜；斜接、畫框、切肩線必備",
  },
  "silicone-glue-box": {
    id: "silicone-glue-box",
    nameZh: "矽膠膠水盒＋矽膠刷（可水洗）",
    category: "glue",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E7%9F%BD%E8%86%A0%E7%9B%92%E7%9F%BD%E8%86%A0%E5%88%B7-%E5%A1%97%E8%86%A0%E5%AE%B9%E5%99%A8-%E8%86%A0%E6%B0%B4%E5%84%B2%E5%AD%98%E7%9B%92-%E6%9C%A8%E5%B7%A5%E8%86%A0%E5%88%B7-%E5%8F%AF%E6%B0%B4%E6%B4%97-%E9%98%B2%E4%B9%BE%E5%9B%BA-%E5%B0%8F%E5%9E%8B%E5%88%B7%E8%86%A0%E5%B7%A5%E5%85%B7-%E5%A1%97%E5%88%B7%E5%B7%A5%E5%85%B7-diy%E6%9C%A8%E5%B7%A5-%E5%B0%88%E6%A5%AD%E7%B4%9A",
    notes: "膠水儲存＋塗布二合一，可水洗重複用，比拋棄式紙杯／海綿環保",
  },
  "marking-knife": {
    id: "marking-knife",
    nameZh: "劃線刀（SK5 雙刃手工雕刻刀）",
    category: "marking",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E5%8A%83%E7%B7%9A%E5%88%80-%E9%9B%99%E5%88%83-%E6%89%8B%E5%B7%A5%E9%9B%95%E5%88%BB%E5%88%80-sk5-%E6%9C%A8%E9%9B%95%E5%88%80%E6%AB%B8%E6%9C%A8%E6%89%8B%E6%9F%84-%E8%96%84%E5%88%83-%E9%9B%95%E8%8A%B1%E6%9C%A8%E9%A0%AD%E6%A4%B4%E6%9C%A8-%E8%BB%9F%E6%9C%A8%E4%BF%AE%E9%82%8A-%E5%89%8A%E5%88%80",
    notes: "比鉛筆精準十倍；切斷木纖維留下明顯刻線，榫接對位專用",
  },
  "countersink-bit": {
    id: "countersink-bit",
    nameZh: "半自動沉孔鑽（不傷面板螺絲埋頭鑽）",
    category: "power",
    shopUrl:
      "https://woodenren.easy.co/products/-%E6%9C%A8%E9%A0%AD%E4%BB%81-%E6%96%B0%E6%AC%BE%E5%8D%8A%E8%87%AA%E5%8B%95%E6%B2%89%E5%AD%94%E9%91%BD-%E4%B8%8D%E5%82%B7%E9%9D%A2%E6%9D%BF%E7%B2%BE%E6%BA%96%E9%99%90%E4%BD%8D-%E6%9C%A8%E5%B7%A5%E6%B2%89%E9%A0%AD%E9%91%BD-%E8%9E%BA%E7%B5%B2%E5%9F%8B%E9%A0%AD%E9%91%BD-%E9%8C%90%E5%AD%94%E9%91%BD%E5%A5%97%E8%A3%9D-%E9%9A%8E%E6%A2%AF%E9%91%BD%E5%A5%97%E8%A3%9D-%E5%B0%88%E6%A5%AD%E4%BA%94%E9%87%91%E5%B7%A5%E5%85%B7-%E8%BC%95%E9%AC%86%E6%8B%86%E8%A3%9D%E4%B8%8D%E7%95%99%E7%97%95",
    notes: "螺絲頭埋進木面不外露，正面光潔；pocket-hole 進階版",
  },
};
