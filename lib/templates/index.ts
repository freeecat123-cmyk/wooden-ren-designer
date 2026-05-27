import type {
  FurnitureCategory,
  FurnitureTemplate,
  OptionSpec,
} from "@/lib/types";
import { squareStool, squareStoolOptions } from "./square-stool";
import { teaTable, teaTableOptions } from "./tea-table";
import { bench, benchOptions } from "./bench";
import { sideTable, sideTableOptions } from "./side-table";
import { lowTable, lowTableOptions } from "./low-table";
import { diningTable, diningTableOptions } from "./dining-table";
import { desk, deskOptions } from "./desk";
import { openBookshelf, openBookshelfOptions } from "./open-bookshelf";
import { chestOfDrawers, chestOfDrawersOptions } from "./chest-of-drawers";
import { chineseCabinet, chineseCabinetOptions } from "./chinese-cabinet";
import { shoeCabinet, shoeCabinetOptions } from "./shoe-cabinet";
import { displayCabinet, displayCabinetOptions } from "./display-cabinet";
import { diningChair, diningChairOptions } from "./dining-chair";
import { wardrobe, wardrobeOptions } from "./wardrobe";
import { barStool, barStoolOptions } from "./bar-stool";
import { mediaConsole, mediaConsoleOptions } from "./media-console";
import { nightstand, nightstandOptions } from "./nightstand";
import { roundStool, roundStoolOptions } from "./round-stool";
import { roundTeaTable, roundTeaTableOptions } from "./round-tea-table";
import { roundTable, roundTableOptions } from "./round-table";
import { pencilHolder, pencilHolderOptions, applyPencilHolderPresets } from "./pencil-holder";
import { photoFrame, photoFrameOptions } from "./photo-frame";
import { tray, trayOptions } from "./tray";
import { dovetailBox, dovetailBoxOptions } from "./dovetail-box";
import { wineRack, wineRackOptions } from "./wine-rack";
import { coatRack, coatRackOptions } from "./coat-rack";
import { bed, bedOptions } from "./bed";

export interface FurnitureCatalogEntry {
  category: FurnitureCategory;
  /** 中文家具名（保留以維持 98 個既有檔案呼叫；Phase 2 i18n 引入 nameEn 並列） */
  nameZh: string;
  /** 英文家具名 — 國際版用 */
  nameEn: string;
  /** 中文家具描述 */
  description: string;
  /** 英文家具描述 — 國際版用 */
  descriptionEn: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  template?: FurnitureTemplate;
  defaults: { length: number; width: number; height: number };
  limits?: { length: number; width: number; height: number };
  optionSchema?: OptionSpec[];
  /** 強制套用使用情境 preset：解 search params 後呼叫，回傳的 options
   *  會同時 shadow UI 表單欄位顯示跟模板渲染，preset 值在兩處一致。 */
  applyPresets?: (
    options: Record<string, string | number | boolean>,
  ) => Record<string, string | number | boolean>;
}

/** Locale-aware accessor — Phase 2: callers 傳入 locale 拿正確語言名稱。 */
export function getEntryName(
  entry: Pick<FurnitureCatalogEntry, "nameZh" | "nameEn">,
  locale: string,
): string {
  return locale === "en" ? entry.nameEn : entry.nameZh;
}

export function getEntryDescription(
  entry: Pick<FurnitureCatalogEntry, "description" | "descriptionEn">,
  locale: string,
): string {
  return locale === "en" ? entry.descriptionEn : entry.description;
}

export const FURNITURE_CATALOG: FurnitureCatalogEntry[] = [
  {
    category: "stool",
    nameZh: "方凳",
    nameEn: "Square stool",
    description: "經典 4 腳方凳，通榫結構，木工入門必做",
    descriptionEn: "Classic 4-leg square stool with through tenons — the essential woodworking starter project",
    difficulty: "beginner",
    template: squareStool,
    defaults: { length: 350, width: 350, height: 450 },
    limits: { length: 500, width: 500, height: 500 },
    optionSchema: squareStoolOptions,
  },
  {
    category: "bench",
    nameZh: "長凳",
    nameEn: "Bench",
    description: "兩人座長凳，適合玄關或床尾",
    descriptionEn: "Two-seat bench, perfect for entryways or foot-of-bed",
    difficulty: "intermediate",
    template: bench,
    defaults: { length: 1200, width: 350, height: 450 },
    limits: { length: 3000, width: 550, height: 500 },
    optionSchema: benchOptions,
  },
  {
    category: "tea-table",
    nameZh: "茶几",
    nameEn: "Tea table",
    description: "沙發旁低矮小桌，茶水點心擺放——含下棚板放書本雜物",
    descriptionEn: "Low table beside the sofa for tea and snacks — with a lower shelf for books or odds",
    difficulty: "intermediate",
    template: teaTable,
    defaults: { length: 500, width: 350, height: 400 },
    limits: { length: 600, width: 400, height: 500 },
    optionSchema: teaTableOptions,
  },
  {
    category: "side-table",
    nameZh: "邊桌",
    nameEn: "Side table",
    description: "一般邊桌（客廳/玄關/床邊），可加單層抽屜",
    descriptionEn: "Side table for the living room, entryway, or bedside — optional single drawer",
    difficulty: "intermediate",
    template: sideTable,
    defaults: { length: 450, width: 400, height: 600 },
    limits: { length: 700, width: 400, height: 800 },
    optionSchema: sideTableOptions,
  },
  {
    category: "low-table",
    nameZh: "矮桌",
    nameEn: "Low table",
    description: "和室低座桌、地板桌",
    descriptionEn: "Floor-seating low table, Japanese-style chabudai",
    difficulty: "intermediate",
    template: lowTable,
    defaults: { length: 1000, width: 600, height: 350 },
    limits: { length: 1400, width: 1000, height: 400 },
    optionSchema: lowTableOptions,
  },
  {
    category: "open-bookshelf",
    nameZh: "開放書櫃",
    nameEn: "Open bookshelf",
    description: "多層開放式書櫃",
    descriptionEn: "Multi-tier open-front bookshelf",
    difficulty: "intermediate",
    template: openBookshelf,
    defaults: { length: 800, width: 300, height: 1800 },
    limits: { length: 1500, width: 500, height: 2400 },
    optionSchema: openBookshelfOptions,
  },
  {
    category: "chest-of-drawers",
    nameZh: "斗櫃",
    nameEn: "Chest of drawers",
    description: "3-5 層抽屜收納櫃",
    descriptionEn: "3–5 tier dresser / chest of drawers",
    difficulty: "advanced",
    template: chestOfDrawers,
    defaults: { length: 800, width: 450, height: 900 },
    limits: { length: 1300, width: 600, height: 1500 },
    optionSchema: chestOfDrawersOptions,
  },
  {
    category: "chinese-cabinet",
    nameZh: "中式方角櫃",
    nameEn: "Ming-style cabinet",
    description: "明清家具邊抹板心做法，4 立柱 + 6 面框板",
    descriptionEn: "Ming/Qing-style cabinet with frame-and-panel construction — 4 corner posts and 6 panel frames",
    difficulty: "advanced",
    template: chineseCabinet,
    defaults: { length: 800, width: 400, height: 1500 },
    limits: { length: 1500, width: 600, height: 2200 },
    optionSchema: chineseCabinetOptions,
  },
  {
    category: "shoe-cabinet",
    nameZh: "鞋櫃",
    nameEn: "Shoe cabinet",
    description: "玄關鞋櫃，含可調層板",
    descriptionEn: "Entryway shoe cabinet with adjustable shelves",
    difficulty: "advanced",
    template: shoeCabinet,
    defaults: { length: 900, width: 350, height: 1000 },
    limits: { length: 1500, width: 500, height: 2000 },
    optionSchema: shoeCabinetOptions,
  },
  {
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    nameEn: "Display cabinet",
    description: "展示用櫃，含玻璃門",
    descriptionEn: "Display cabinet with glass doors",
    difficulty: "advanced",
    template: displayCabinet,
    defaults: { length: 800, width: 400, height: 1600 },
    limits: { length: 1500, width: 600, height: 2200 },
    optionSchema: displayCabinetOptions,
  },
  {
    category: "dining-table",
    nameZh: "餐桌",
    nameEn: "Dining table",
    description: "4-6 人餐桌",
    descriptionEn: "Dining table for 4–6",
    difficulty: "advanced",
    template: diningTable,
    defaults: { length: 1500, width: 800, height: 750 },
    limits: { length: 2400, width: 1200, height: 800 },
    optionSchema: diningTableOptions,
  },
  {
    category: "desk",
    nameZh: "書桌/辦公桌",
    nameEn: "Desk",
    description: "工作書桌 / 辦公桌，含抽屜",
    descriptionEn: "Writing desk / office desk with drawer",
    difficulty: "advanced",
    template: desk,
    defaults: { length: 1200, width: 600, height: 750 },
    limits: { length: 2000, width: 900, height: 800 },
    optionSchema: deskOptions,
  },
  {
    category: "dining-chair",
    nameZh: "餐椅",
    nameEn: "Dining chair",
    description: "含椅背餐椅",
    descriptionEn: "Dining chair with back rest",
    difficulty: "advanced",
    template: diningChair,
    defaults: { length: 450, width: 450, height: 850 },
    limits: { length: 600, width: 650, height: 1100 },
    optionSchema: diningChairOptions,
  },
  {
    category: "wardrobe",
    nameZh: "衣櫃",
    nameEn: "Wardrobe",
    description: "含吊衣桿/層板/抽屜的直立式衣櫃",
    descriptionEn: "Upright wardrobe with hanging rod, shelves, and drawers",
    difficulty: "advanced",
    template: wardrobe,
    defaults: { length: 1200, width: 600, height: 2000 },
    limits: { length: 2400, width: 800, height: 2500 },
    optionSchema: wardrobeOptions,
  },
  {
    category: "bar-stool",
    nameZh: "吧檯椅",
    nameEn: "Bar stool",
    description: "高腳椅含腳踏橫撐，可選加短椅背",
    descriptionEn: "Counter-height stool with foot rail — optional short back rest",
    difficulty: "intermediate",
    template: barStool,
    defaults: { length: 350, width: 350, height: 750 },
    limits: { length: 500, width: 500, height: 900 },
    optionSchema: barStoolOptions,
  },
  {
    category: "media-console",
    nameZh: "電視櫃",
    nameEn: "Media console",
    description: "長型矮櫃，含門板、抽屜、層板",
    descriptionEn: "Long low cabinet with doors, drawers, and shelves",
    difficulty: "advanced",
    template: mediaConsole,
    defaults: { length: 1500, width: 400, height: 500 },
    limits: { length: 3000, width: 700, height: 900 },
    optionSchema: mediaConsoleOptions,
  },
  {
    category: "nightstand",
    nameZh: "床頭櫃",
    nameEn: "Nightstand",
    description: "床邊收納櫃，含抽屜 + 門/層板",
    descriptionEn: "Bedside storage with drawer plus door/shelf",
    difficulty: "intermediate",
    template: nightstand,
    defaults: { length: 450, width: 380, height: 600 },
    limits: { length: 600, width: 500, height: 800 },
    optionSchema: nightstandOptions,
  },
  {
    category: "round-stool",
    nameZh: "圓凳",
    nameEn: "Round stool",
    description: "圓座 + 4 隻腳，35cm 直徑常見",
    descriptionEn: "Round seat with 4 legs — typically 35 cm diameter",
    difficulty: "intermediate",
    template: roundStool,
    defaults: { length: 350, width: 350, height: 450 },
    limits: { length: 500, width: 500, height: 500 },
    optionSchema: roundStoolOptions,
  },
  {
    category: "round-tea-table",
    nameZh: "圓茶几",
    nameEn: "Round tea table",
    description: "圓桌面 + 4 隻腳含牙板，70cm 直徑常見",
    descriptionEn: "Round top with 4 legs and apron — typically 70 cm diameter",
    difficulty: "intermediate",
    template: roundTeaTable,
    defaults: { length: 700, width: 700, height: 450 },
    limits: { length: 1100, width: 1100, height: 500 },
    optionSchema: roundTeaTableOptions,
  },
  {
    category: "round-table",
    nameZh: "圓餐桌",
    nameEn: "Round dining table",
    description: "100cm+ 直徑圓餐桌，桌面需拼板",
    descriptionEn: "100 cm+ diameter round dining table — requires edge-jointed top",
    difficulty: "advanced",
    template: roundTable,
    defaults: { length: 1000, width: 1000, height: 750 },
    limits: { length: 1500, width: 1500, height: 800 },
    optionSchema: roundTableOptions,
  },
  // ---- 小物件 (accessories) ----
  {
    category: "pencil-holder",
    nameZh: "筆筒",
    nameEn: "Pencil holder",
    description: "5 片實木組成的方盒，桌上文具收納入門款",
    descriptionEn: "5-piece solid wood box — beginner-friendly desktop stationery organizer",
    difficulty: "beginner",
    template: pencilHolder,
    defaults: { length: 80, width: 80, height: 100 },
    limits: { length: 200, width: 200, height: 250 },
    optionSchema: pencilHolderOptions,
    applyPresets: applyPencilHolderPresets,
  },
  {
    category: "photo-frame",
    nameZh: "相框",
    nameEn: "Picture frame",
    description: "4 條邊框 45° 斜接，含玻璃槽與背板",
    descriptionEn: "4-piece mitered frame with rabbet for glass and back panel",
    difficulty: "beginner",
    template: photoFrame,
    defaults: { length: 100, width: 150, height: 18 },
    limits: { length: 1200, width: 1200, height: 35 },
    optionSchema: photoFrameOptions,
  },
  {
    category: "tray",
    nameZh: "托盤",
    nameEn: "Tray",
    description: "底板 + 4 圍邊，茶盤 / 文件 / 早餐通用",
    descriptionEn: "Base panel with 4 rails — works as tea tray, document tray, or breakfast tray",
    difficulty: "beginner",
    template: tray,
    defaults: { length: 400, width: 280, height: 60 },
    limits: { length: 600, width: 450, height: 120 },
    optionSchema: trayOptions,
  },
  {
    category: "dovetail-box",
    nameZh: "木盒",
    nameEn: "Dovetail box",
    description: "4 角接合 + 槽底木盒；切到榫接模式變身鳩尾盒，鳩尾練習主角",
    descriptionEn: "4-corner joined box with grooved base; switch to joinery mode for a full dovetail box — the classic dovetail practice piece",
    difficulty: "intermediate",
    template: dovetailBox,
    defaults: { length: 250, width: 150, height: 80 },
    limits: { length: 400, width: 300, height: 250 },
    optionSchema: dovetailBoxOptions,
  },
  {
    category: "wine-rack",
    nameZh: "紅酒架",
    nameEn: "Wine rack",
    description: "格柵結構，瓶數可調（2×2 到 8×6）",
    descriptionEn: "Lattice structure, bottle capacity adjustable from 2×2 to 8×6",
    difficulty: "intermediate",
    template: wineRack,
    defaults: { length: 400, width: 280, height: 300 },
    limits: { length: 1000, width: 400, height: 1000 },
    optionSchema: wineRackOptions,
  },
  {
    category: "bed",
    nameZh: "床架",
    nameEn: "Bed frame",
    description: "傳統木製床架，含床頭板、可選床尾板、N 床板條，套用方凳系列榫卯規則",
    descriptionEn: "Traditional wood bed frame with headboard, optional footboard, and N slats — follows the stool-series joinery conventions",
    difficulty: "advanced",
    template: bed,
    defaults: { length: 1900, width: 1525, height: 450 },
    limits: { length: 2200, width: 2000, height: 600 },
    optionSchema: bedOptions,
  },
  {
    category: "coat-rack",
    nameZh: "立式衣帽架",
    nameEn: "Coat rack",
    description: "立柱 + 底爪 + 多向掛鉤，玄關客廳款",
    descriptionEn: "Standing column with base feet and multi-direction hooks — entryway / living room style",
    difficulty: "intermediate",
    template: coatRack,
    defaults: { length: 280, width: 280, height: 1700 },
    limits: { length: 1000, width: 1000, height: 2200 },
    optionSchema: coatRackOptions,
  },
];

export function getTemplate(category: FurnitureCategory): FurnitureCatalogEntry | undefined {
  return FURNITURE_CATALOG.find((e) => e.category === category);
}
