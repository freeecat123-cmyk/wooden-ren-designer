import type {
  FurnitureCategory,
  FurnitureTemplate,
} from "@/lib/types";
import { squareStool } from "./square-stool";
import { teaTable } from "./tea-table";
import { bench } from "./bench";
import { sideTable } from "./side-table";
import { lowTable } from "./low-table";
import { diningTable } from "./dining-table";
import { desk } from "./desk";
import { openBookshelf } from "./open-bookshelf";
import { chestOfDrawers } from "./chest-of-drawers";
import { shoeCabinet } from "./shoe-cabinet";
import { displayCabinet } from "./display-cabinet";
import { diningChair } from "./dining-chair";

export interface FurnitureCatalogEntry {
  category: FurnitureCategory;
  nameZh: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  template?: FurnitureTemplate;
  defaults: { length: number; width: number; height: number };
}

export const FURNITURE_CATALOG: FurnitureCatalogEntry[] = [
  {
    category: "stool",
    nameZh: "方凳",
    description: "經典 4 腳方凳，通榫結構，木工入門必做",
    difficulty: "beginner",
    template: squareStool,
    defaults: { length: 350, width: 350, height: 450 },
  },
  {
    category: "bench",
    nameZh: "長凳",
    description: "兩人座長凳，適合玄關或床尾",
    difficulty: "beginner",
    template: bench,
    defaults: { length: 1200, width: 350, height: 450 },
  },
  {
    category: "tea-table",
    nameZh: "茶几",
    description: "客廳邊几，含下棚板可放茶具書本",
    difficulty: "beginner",
    template: teaTable,
    defaults: { length: 600, width: 600, height: 400 },
  },
  {
    category: "side-table",
    nameZh: "邊桌 / 床頭櫃",
    description: "床側收納，可加單層抽屜",
    difficulty: "beginner",
    template: sideTable,
    defaults: { length: 450, width: 400, height: 600 },
  },
  {
    category: "low-table",
    nameZh: "矮桌",
    description: "和室低座桌、地板桌",
    difficulty: "beginner",
    template: lowTable,
    defaults: { length: 1000, width: 600, height: 350 },
  },
  {
    category: "open-bookshelf",
    nameZh: "開放書櫃",
    description: "多層開放式書櫃",
    difficulty: "intermediate",
    template: openBookshelf,
    defaults: { length: 800, width: 300, height: 1800 },
  },
  {
    category: "chest-of-drawers",
    nameZh: "斗櫃",
    description: "3-5 層抽屜收納櫃",
    difficulty: "intermediate",
    template: chestOfDrawers,
    defaults: { length: 800, width: 450, height: 900 },
  },
  {
    category: "shoe-cabinet",
    nameZh: "鞋櫃",
    description: "玄關鞋櫃，含可調層板",
    difficulty: "intermediate",
    template: shoeCabinet,
    defaults: { length: 900, width: 350, height: 1000 },
  },
  {
    category: "display-cabinet",
    nameZh: "玻璃展示櫃",
    description: "展示用櫃，含玻璃門",
    difficulty: "intermediate",
    template: displayCabinet,
    defaults: { length: 800, width: 400, height: 1600 },
  },
  {
    category: "dining-table",
    nameZh: "餐桌",
    description: "4-6 人餐桌",
    difficulty: "advanced",
    template: diningTable,
    defaults: { length: 1500, width: 800, height: 750 },
  },
  {
    category: "desk",
    nameZh: "書桌",
    description: "工作書桌，含抽屜",
    difficulty: "advanced",
    template: desk,
    defaults: { length: 1200, width: 600, height: 750 },
  },
  {
    category: "dining-chair",
    nameZh: "餐椅",
    description: "含椅背餐椅",
    difficulty: "advanced",
    template: diningChair,
    defaults: { length: 450, width: 450, height: 850 },
  },
];

export function getTemplate(category: FurnitureCategory): FurnitureCatalogEntry | undefined {
  return FURNITURE_CATALOG.find((e) => e.category === category);
}
