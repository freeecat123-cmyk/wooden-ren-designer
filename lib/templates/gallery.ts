/**
 * 模板「設計細節透視」畫廊
 *
 * 大多數圖由 scripts/shoot-showcase.mjs 自動產生（A:3D / B:wireframe / C:特殊鏡頭）。
 * 部分模板額外掛手動截圖（曲面靠背、衣櫃變化、櫃內透視）做為補充。
 *
 * 加新截圖流程：
 *   1. 截圖丟進 public/showcase/
 *   2. 在這個 file 對應的 category 陣列 push 一筆 { src, label, desc }
 *   3. detail page 自動 render
 *
 * 重新批跑自動截圖：node scripts/shoot-showcase.mjs
 */

import type { FurnitureCategory } from "../types";

export interface GalleryImage {
  /** 圖片路徑（相對 public/） */
  src: string;
  /** 標題（≤16 字） */
  label: string;
  /** 補述（≤40 字） */
  desc?: string;
}

// ── 手動補充截圖（保留舊資產）────────────────────────────
const CABINET_INTERNAL: GalleryImage = {
  src: "/showcase/cabinet-internal-perspective.png",
  label: "櫃體內部透視",
  desc: "切到隱藏面板模式可以看見內部隔板、滑軌位置、層板結構",
};

const BENCH_CURVED_BACK: GalleryImage = {
  src: "/showcase/bench-curved-back.png",
  label: "曲面靠背長凳",
  desc: "可選曲面椅背 + 直棍式靠背樣式，3D 即時看到組裝後樣子",
};

const WARDROBE_VARIATIONS: GalleryImage = {
  src: "/showcase/wardrobe-variations.png",
  label: "衣櫃配置變化多",
  desc: "吊衣桿、抽屜、上層板、下方鞋格、頂櫃自由組合",
};

// ── 共用工廠：自動產生 3D + wireframe 對 ─────────────────
function pair(slug: string, label3d: string, descWire: string): GalleryImage[] {
  return [
    { src: `/showcase/${slug}-3d.png`, label: label3d },
    {
      src: `/showcase/${slug}-wireframe.png`,
      label: "線框模式看結構",
      desc: descWire,
    },
  ];
}

export const TEMPLATE_GALLERY: Partial<Record<FurnitureCategory, GalleryImage[]>> = {
  // === 椅凳類 ===
  stool: pair("stool", "預設方凳 3D",
    "線框打開看每根腳和牙板的榫接位置，所有榫眼/榫頭都演算好了"),
  "round-stool": pair("round-stool", "圓椅凳預設樣",
    "splay 外撇腳的真實長度、複斜角度都在線框模式看得到"),
  "bar-stool": pair("bar-stool", "吧台椅高背預設",
    "踏腳橫桿位置依椅高自動算，線框可看到內部牙板補強"),
  bench: [
    ...pair("bench", "長凳預設 3D",
      "椅面下牙板＋拉檔結構，避免長椅久坐下沉"),
    BENCH_CURVED_BACK,
  ],
  "dining-chair": pair("dining-chair", "餐椅預設 3D",
    "後腳外撇 6~10° 防後仰翻倒，椅背曲度線框看得很清楚"),

  // === 桌類 ===
  "side-table": [
    ...pair("side-table", "邊桌預設 3D",
      "下層板 + 牙板加強結構，沙發旁放杯子最順的高度"),
    {
      src: "/showcase/side-table-drawers.png",
      label: "抽屜結構透視",
      desc: "藏起抽屜面板看到抽屜盒、滑軌位置，13 吋規格直接買",
    },
  ],
  "tea-table": pair("tea-table", "茶几預設 3D",
    "拉檔 + 牙板雙重補強，沙發旁的工作平面"),
  "low-table": pair("low-table", "和室低桌 3D",
    "腳形可選直腿或外撇，線框看牙板與腳的相接位置"),
  "round-tea-table": pair("round-tea-table", "圓茶几 3D",
    "圓檯面下的十字拉檔結構，承重更穩"),
  "round-table": pair("round-table", "圓餐桌 3D",
    "trestle 中柱式或 splay 外撇腳，線框看到內部承重結構"),
  "dining-table": pair("dining-table", "餐桌預設 3D",
    "拼板自動算企口接合，超過 40cm 寬自動切片"),
  desk: pair("desk", "書桌預設 3D",
    "下層板 + 腳形三選一（直腿/側板/A 字），線框看走線孔位置"),

  // === 櫃子類 ===
  "open-bookshelf": pair("open-bookshelf", "開放書櫃 3D",
    "每層獨立設高度，線框可確認可調層板的 32mm 孔位"),
  "chest-of-drawers": [
    ...pair("chest-of-drawers", "斗櫃預設 4 抽 3D",
      "三級接合可選（鳩尾/固定滑軌/蝶式），線框看抽屜分隔"),
    {
      src: "/showcase/chest-of-drawers-drawers.png",
      label: "抽屜結構透視",
      desc: "藏起抽屜面板看到 6 個抽屜盒位置，照著買 Blum 滑軌組裝",
    },
    CABINET_INTERNAL,
  ],
  "media-console": [
    ...pair("media-console", "媒體櫃預設 3D",
      "走線孔自動 + 散熱百葉，PS5 主機放裡面不悶熱"),
    {
      src: "/showcase/media-console-drawers.png",
      label: "抽屜結構透視",
      desc: "抽屜藏手把＋層板放主機，線框看內部分隔",
    },
    CABINET_INTERNAL,
  ],
  wardrobe: [
    ...pair("wardrobe", "衣櫃預設 3D",
      "吊衣桿、抽屜、層板位置線框模式可即時調整確認"),
    WARDROBE_VARIATIONS,
    CABINET_INTERNAL,
  ],
  "shoe-cabinet": [
    ...pair("shoe-cabinet", "鞋櫃預設 3D",
      "斜板存鞋設計，線框可看內部斜層板角度"),
    CABINET_INTERNAL,
  ],
  nightstand: [
    ...pair("nightstand", "床頭櫃預設 3D",
      "上抽屜 + 下開放層，線框看 USB 走線孔位置"),
    {
      src: "/showcase/nightstand-drawers.png",
      label: "抽屜結構透視",
      desc: "藏起抽屜面板看到抽屜盒與下層放書空間",
    },
  ],
  "display-cabinet": [
    ...pair("display-cabinet", "展示櫃預設 3D",
      "玻璃門 + 內部 LED 走線位置，線框模式看清楚"),
    CABINET_INTERNAL,
  ],

  // === 小物件 ===
  "pencil-holder": pair("pencil-holder", "筆筒預設方形 3D",
    "6 種預設（方/六角/八角/格柵/刷筒/隔板）一鍵切換"),
  "photo-frame": pair("photo-frame", "相框預設 3D",
    "斜接 45° 自動算，後背板槽位線框模式看得到"),
  tray: pair("tray", "托盤預設 3D",
    "兩側手把開孔 + 底板凹槽防滑，線框看接合位置"),
  "dovetail-box": [
    ...pair("dovetail-box", "鳩尾盒預設 3D",
      "四角自動鳩尾接合，線框模式看每根鳩尾的位置與大小"),
    {
      src: "/showcase/dovetail-box-lid.png",
      label: "掀蓋看內部",
      desc: "lid 浮起 140mm 看到內部空間 + 鳩尾接合特寫",
    },
  ],
  "wine-rack": pair("wine-rack", "酒架預設 3D",
    "X 形交叉格自動算，每格放標準 750ml 紅酒瓶"),
};

export function getGallery(
  category: FurnitureCategory,
): GalleryImage[] | undefined {
  const g = TEMPLATE_GALLERY[category];
  return g && g.length > 0 ? g : undefined;
}
