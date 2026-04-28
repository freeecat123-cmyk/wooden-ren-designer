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
import { pencilHolder, pencilHolderOptions } from "./pencil-holder";
import { bookend, bookendOptions } from "./bookend";
import { photoFrame, photoFrameOptions } from "./photo-frame";
import { tray, trayOptions } from "./tray";
import { dovetailBox, dovetailBoxOptions } from "./dovetail-box";
import { wineRack, wineRackOptions } from "./wine-rack";
import { coatRack, coatRackOptions } from "./coat-rack";

export interface FurnitureCatalogEntry {
  category: FurnitureCategory;
  nameZh: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  template?: FurnitureTemplate;
  defaults: { length: number; width: number; height: number };
  limits?: { length: number; width: number; height: number };
  optionSchema?: OptionSpec[];
}

export const FURNITURE_CATALOG: FurnitureCatalogEntry[] = [
  {
    category: "stool",
    nameZh: "方凳",
    description: "經典 4 腳方凳，通榫結構，木工入門必做",
    difficulty: "beginner",
    template: squareStool,
    defaults: { length: 350, width: 350, height: 450 },
    limits: { length: 500, width: 500, height: 500 },
    optionSchema: squareStoolOptions,
  },
  {
    category: "bench",
    nameZh: "長凳",
    description: "兩人座長凳，適合玄關或床尾",
    difficulty: "beginner",
    template: bench,
    defaults: { length: 1200, width: 350, height: 450 },
    limits: { length: 3000, width: 550, height: 500 },
    optionSchema: benchOptions,
  },
  {
    category: "tea-table",
    nameZh: "茶几",
    description: "客廳邊几，含下棚板可放茶具書本",
    difficulty: "beginner",
    template: teaTable,
    defaults: { length: 600, width: 600, height: 400 },
    limits: { length: 1200, width: 900, height: 500 },
    optionSchema: teaTableOptions,
  },
  {
    category: "side-table",
    nameZh: "邊桌 / 床頭櫃",
    description: "床側收納，可加單層抽屜",
    difficulty: "beginner",
    template: sideTable,
    defaults: { length: 450, width: 400, height: 600 },
    limits: { length: 700, width: 400, height: 800 },
    optionSchema: sideTableOptions,
  },
  {
    category: "low-table",
    nameZh: "矮桌",
    description: "和室低座桌、地板桌",
    difficulty: "beginner",
    template: lowTable,
    defaults: { length: 1000, width: 600, height: 350 },
    limits: { length: 1400, width: 1000, height: 400 },
    optionSchema: lowTableOptions,
  },
  {
    category: "open-bookshelf",
    nameZh: "開放書櫃",
    description: "多層開放式書櫃",
    difficulty: "intermediate",
    template: openBookshelf,
    defaults: { length: 800, width: 300, height: 1800 },
    limits: { length: 1500, width: 500, height: 2400 },
    optionSchema: openBookshelfOptions,
  },
  {
    category: "chest-of-drawers",
    nameZh: "斗櫃",
    description: "3-5 層抽屜收納櫃",
    difficulty: "intermediate",
    template: chestOfDrawers,
    defaults: { length: 800, width: 450, height: 900 },
    limits: { length: 1300, width: 600, height: 1500 },
    optionSchema: chestOfDrawersOptions,
  },
  {
    category: "shoe-cabinet",
    nameZh: "鞋櫃",
    description: "玄關鞋櫃，含可調層板",
    difficulty: "intermediate",
    template: shoeCabinet,
    defaults: { length: 900, width: 350, height: 1000 },
    limits: { length: 1500, width: 500, height: 2000 },
    optionSchema: shoeCabinetOptions,
  },
  {
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    description: "展示用櫃，含玻璃門",
    difficulty: "intermediate",
    template: displayCabinet,
    defaults: { length: 800, width: 400, height: 1600 },
    limits: { length: 1500, width: 600, height: 2200 },
    optionSchema: displayCabinetOptions,
  },
  {
    category: "dining-table",
    nameZh: "餐桌",
    description: "4-6 人餐桌",
    difficulty: "advanced",
    template: diningTable,
    defaults: { length: 1500, width: 800, height: 750 },
    limits: { length: 2400, width: 1200, height: 800 },
    optionSchema: diningTableOptions,
  },
  {
    category: "desk",
    nameZh: "書桌",
    description: "工作書桌，含抽屜",
    difficulty: "advanced",
    template: desk,
    defaults: { length: 1200, width: 600, height: 750 },
    limits: { length: 2000, width: 900, height: 800 },
    optionSchema: deskOptions,
  },
  {
    category: "dining-chair",
    nameZh: "餐椅",
    description: "含椅背餐椅",
    difficulty: "advanced",
    template: diningChair,
    defaults: { length: 450, width: 450, height: 850 },
    limits: { length: 600, width: 650, height: 1100 },
    optionSchema: diningChairOptions,
  },
  {
    category: "wardrobe",
    nameZh: "衣櫃",
    description: "含吊衣桿/層板/抽屜的直立式衣櫃",
    difficulty: "advanced",
    template: wardrobe,
    defaults: { length: 1200, width: 600, height: 2000 },
    limits: { length: 2400, width: 800, height: 2500 },
    optionSchema: wardrobeOptions,
  },
  {
    category: "bar-stool",
    nameZh: "吧檯椅",
    description: "高腳椅含腳踏橫撐，可選加短椅背",
    difficulty: "intermediate",
    template: barStool,
    defaults: { length: 350, width: 350, height: 750 },
    limits: { length: 500, width: 500, height: 900 },
    optionSchema: barStoolOptions,
  },
  {
    category: "media-console",
    nameZh: "電視櫃",
    description: "長型矮櫃，含門板、抽屜、層板",
    difficulty: "intermediate",
    template: mediaConsole,
    defaults: { length: 1500, width: 400, height: 500 },
    limits: { length: 3000, width: 700, height: 900 },
    optionSchema: mediaConsoleOptions,
  },
  {
    category: "nightstand",
    nameZh: "床頭櫃",
    description: "1 抽屜 + 開放層的床邊小櫃",
    difficulty: "beginner",
    template: nightstand,
    defaults: { length: 450, width: 380, height: 600 },
    limits: { length: 600, width: 500, height: 800 },
    optionSchema: nightstandOptions,
  },
  {
    category: "round-stool",
    nameZh: "圓凳",
    description: "圓座 + 4 隻腳，35cm 直徑常見",
    difficulty: "beginner",
    template: roundStool,
    defaults: { length: 350, width: 350, height: 450 },
    limits: { length: 500, width: 500, height: 500 },
    optionSchema: roundStoolOptions,
  },
  {
    category: "round-tea-table",
    nameZh: "圓茶几",
    description: "圓桌面 + 4 隻腳含牙板，70cm 直徑常見",
    difficulty: "intermediate",
    template: roundTeaTable,
    defaults: { length: 700, width: 700, height: 450 },
    limits: { length: 1100, width: 1100, height: 500 },
    optionSchema: roundTeaTableOptions,
  },
  {
    category: "round-table",
    nameZh: "圓餐桌",
    description: "100cm+ 直徑圓餐桌，桌面需拼板",
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
    description: "5 片實木組成的方盒，桌上文具收納入門款",
    difficulty: "beginner",
    template: pencilHolder,
    defaults: { length: 80, width: 80, height: 110 },
    limits: { length: 200, width: 200, height: 250 },
    optionSchema: pencilHolderOptions,
  },
  {
    category: "bookend",
    nameZh: "書擋",
    description: "L 型結構的書架夾，可選三角加固",
    difficulty: "beginner",
    template: bookend,
    defaults: { length: 150, width: 120, height: 180 },
    limits: { length: 250, width: 300, height: 350 },
    optionSchema: bookendOptions,
  },
  {
    category: "photo-frame",
    nameZh: "相框",
    description: "4 條邊框 45° 斜接，含玻璃槽與背板",
    difficulty: "beginner",
    template: photoFrame,
    defaults: { length: 100, width: 150, height: 18 },
    limits: { length: 1200, width: 1200, height: 35 },
    optionSchema: photoFrameOptions,
  },
  {
    category: "tray",
    nameZh: "托盤",
    description: "底板 + 4 圍邊，茶盤 / 文件 / 早餐通用",
    difficulty: "intermediate",
    template: tray,
    defaults: { length: 400, width: 280, height: 60 },
    limits: { length: 600, width: 450, height: 120 },
    optionSchema: trayOptions,
  },
  {
    category: "dovetail-box",
    nameZh: "木盒",
    description: "4 角接合 + 槽底木盒；切到榫接模式變身鳩尾盒，鳩尾練習主角",
    difficulty: "intermediate",
    template: dovetailBox,
    defaults: { length: 250, width: 150, height: 80 },
    limits: { length: 400, width: 300, height: 250 },
    optionSchema: dovetailBoxOptions,
  },
  {
    category: "wine-rack",
    nameZh: "紅酒架",
    description: "格柵結構，瓶數可調（2×2 到 8×6）",
    difficulty: "intermediate",
    template: wineRack,
    defaults: { length: 400, width: 280, height: 300 },
    limits: { length: 1000, width: 400, height: 1000 },
    optionSchema: wineRackOptions,
  },
  {
    category: "coat-rack",
    nameZh: "立式衣帽架",
    description: "立柱 + 底爪 + 多向掛鉤，玄關客廳款",
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
