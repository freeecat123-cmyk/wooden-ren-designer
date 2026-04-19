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

export interface FurnitureCatalogEntry {
  category: FurnitureCategory;
  nameZh: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  template?: FurnitureTemplate;
  defaults: { length: number; width: number; height: number };
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
    optionSchema: squareStoolOptions,
  },
  {
    category: "bench",
    nameZh: "長凳",
    description: "兩人座長凳，適合玄關或床尾",
    difficulty: "beginner",
    template: bench,
    defaults: { length: 1200, width: 350, height: 450 },
    optionSchema: benchOptions,
  },
  {
    category: "tea-table",
    nameZh: "茶几",
    description: "客廳邊几，含下棚板可放茶具書本",
    difficulty: "beginner",
    template: teaTable,
    defaults: { length: 600, width: 600, height: 400 },
    optionSchema: teaTableOptions,
  },
  {
    category: "side-table",
    nameZh: "邊桌 / 床頭櫃",
    description: "床側收納，可加單層抽屜",
    difficulty: "beginner",
    template: sideTable,
    defaults: { length: 450, width: 400, height: 600 },
    optionSchema: sideTableOptions,
  },
  {
    category: "low-table",
    nameZh: "矮桌",
    description: "和室低座桌、地板桌",
    difficulty: "beginner",
    template: lowTable,
    defaults: { length: 1000, width: 600, height: 350 },
    optionSchema: lowTableOptions,
  },
  {
    category: "open-bookshelf",
    nameZh: "開放書櫃",
    description: "多層開放式書櫃",
    difficulty: "intermediate",
    template: openBookshelf,
    defaults: { length: 800, width: 300, height: 1800 },
    optionSchema: openBookshelfOptions,
  },
  {
    category: "chest-of-drawers",
    nameZh: "斗櫃",
    description: "3-5 層抽屜收納櫃",
    difficulty: "intermediate",
    template: chestOfDrawers,
    defaults: { length: 800, width: 450, height: 900 },
    optionSchema: chestOfDrawersOptions,
  },
  {
    category: "shoe-cabinet",
    nameZh: "鞋櫃",
    description: "玄關鞋櫃，含可調層板",
    difficulty: "intermediate",
    template: shoeCabinet,
    defaults: { length: 900, width: 350, height: 1000 },
    optionSchema: shoeCabinetOptions,
  },
  {
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    description: "展示用櫃，含玻璃門",
    difficulty: "intermediate",
    template: displayCabinet,
    defaults: { length: 800, width: 400, height: 1600 },
    optionSchema: displayCabinetOptions,
  },
  {
    category: "dining-table",
    nameZh: "餐桌",
    description: "4-6 人餐桌",
    difficulty: "advanced",
    template: diningTable,
    defaults: { length: 1500, width: 800, height: 750 },
    optionSchema: diningTableOptions,
  },
  {
    category: "desk",
    nameZh: "書桌",
    description: "工作書桌，含抽屜",
    difficulty: "advanced",
    template: desk,
    defaults: { length: 1200, width: 600, height: 750 },
    optionSchema: deskOptions,
  },
  {
    category: "dining-chair",
    nameZh: "餐椅",
    description: "含椅背餐椅",
    difficulty: "advanced",
    template: diningChair,
    defaults: { length: 450, width: 450, height: 850 },
    optionSchema: diningChairOptions,
  },
  {
    category: "wardrobe",
    nameZh: "衣櫃",
    description: "含吊衣桿/層板/抽屜的直立式衣櫃",
    difficulty: "advanced",
    template: wardrobe,
    defaults: { length: 1200, width: 600, height: 2000 },
    optionSchema: wardrobeOptions,
  },
];

export function getTemplate(category: FurnitureCategory): FurnitureCatalogEntry | undefined {
  return FURNITURE_CATALOG.find((e) => e.category === category);
}
