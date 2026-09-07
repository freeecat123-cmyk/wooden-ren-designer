/**
 * 每款範本「怎麼抓尺寸」的白話句子（2026-09-04）。
 *
 * 依據：~/CLAUDE/wood-master/knowledge/furniture_design.md §一 人體工學標準尺寸
 * （台灣／東亞成人常用區間）。**沒有依據的款式不寫**（留空陣列），寧缺勿編。
 * 數字是「經驗區間」，跟表格裡程式的可調範圍是兩回事，頁面上分開呈現。
 */
import type { FurnitureCategory } from "@/lib/types";

export interface SizingNotes {
  zh: string[];
  en: string[];
}

export const SIZING_NOTES: Partial<Record<FurnitureCategory, SizingNotes>> = {
  "dining-table": {
    zh: [
      "桌高 72～75 cm（台灣常取 73～74），配座高 42～45 cm 的椅子，桌面減座面固定抓 27～30 cm。",
      "每個座位寬 55～65 cm、深 35～40 cm：4 人桌長邊抓 120～130 cm，6 人 165～195 cm。",
      "桌面下淨空至少 58～65 cm、膝蓋伸入深度至少 40 cm，有牙條的餐桌要特別量。",
      "餐桌離牆或櫃至少留 75～90 cm 才拉得開椅子。",
    ],
    en: [
      "Table height 72–75 cm, paired with 42–45 cm seat height; keep the table-to-seat gap at 27–30 cm.",
      "Allow 55–65 cm width and 35–40 cm depth per seat: a 4-seater runs 120–130 cm long, a 6-seater 165–195 cm.",
      "Leave at least 58–65 cm of clearance under the top and 40 cm of knee depth; check this whenever there is an apron.",
      "Keep 75–90 cm between the table and a wall or cabinet so chairs can be pulled out.",
    ],
  },
  desk: {
    zh: [
      "書桌高 72～76 cm；純寫字 74 cm 最舒服，長時間打鍵盤桌面壓到 68～72 cm 或配可調椅。",
      "桌面下淨空 58～65 cm、膝蓋伸入深度至少 40 cm。",
    ],
    en: [
      "Desk height 72–76 cm; 74 cm suits handwriting, drop to 68–72 cm for long typing sessions or use an adjustable chair.",
      "Leave 58–65 cm of clearance under the top and at least 40 cm of knee depth.",
    ],
  },
  workbench: {
    zh: [
      "工作桌高 85～95 cm，依手肘高抓：站直、手腕自然垂下的位置就是桌面高度。",
      "範本的「你的身高」欄位會照這個原則反推桌高，改身高就好。",
      "不會做榫卯就選「材料樣式：夾板疊層」：18mm 夾板一層層膠合＋螺絲。桌面 2 層（36mm）只適合當夾具台，holdfast 咬不住；3 層（54mm）手刨、holdfast 都夠，是建議值；4 層（72mm）給重刨重敲。桌腳 3 層（54mm 方）輕量、4 層（72mm 方）建議、5 層（90mm 方）重型。",
      "夾板版的橫撐固定 2 層（36mm），嵌進腳上疊層時預留的缺口再鎖螺絲；料單會把每一層列成一片，說明裡有 4×8 呎張數估算。",
    ],
    en: [
      "Workbench height 85–95 cm, set by elbow height: stand upright and let the wrist hang naturally — that is your top height.",
      "The template's “Your height” field derives the bench height from this rule; just enter your height.",
      "No joinery skills? Pick “Material style: laminated plywood” — 18mm sheets glued and screwed layer by layer. A 2-layer top (36mm) is a clamping table only (holdfasts will not bite); 3 layers (54mm) handles planing and holdfasts and is the recommended value; 4 layers (72mm) is for heavy planing and chopping. Legs: 3 layers (54mm square) light, 4 layers (72mm) recommended, 5 layers (90mm) heavy duty.",
      "Plywood stretchers are always 2 layers (36mm) and sit in notches left in the leg lamination, then screwed; the material list shows one piece per layer and the notes estimate the number of 4×8 ft sheets.",
    ],
  },
  "dining-chair": {
    zh: [
      "座高 42～45 cm（台灣常取 43～44），坐下大腿水平、腳掌平貼地，配 72～75 cm 的餐桌。",
      "座面深 40～45 cm，膝窩到椅面前緣留 2～3 指；單椅座寬至少 40～45 cm。",
      "椅背頂離地約 80～90 cm，腰靴支撐點在座面上 15～25 cm；扶手在座面上 20～25 cm。",
    ],
    en: [
      "Seat height 42–45 cm: thighs level, feet flat, matched to a 72–75 cm dining table.",
      "Seat depth 40–45 cm with two or three fingers of clearance behind the knee; seat width at least 40–45 cm.",
      "Back top around 80–90 cm from the floor, lumbar support 15–25 cm above the seat; armrests 20–25 cm above the seat.",
    ],
  },
  "bar-stool": {
    zh: [
      "口訣：檯面高減座高 ≈ 25～30 cm。廚房中島檯面 85～90 cm 配座高 60～65 cm；吧台 100～110 cm 配座高 75 cm。",
      "腳踏高度讓腳有地方放，坐得久才不會腿麻。",
    ],
    en: [
      "Rule of thumb: counter height minus seat height ≈ 25–30 cm. An 85–90 cm kitchen island takes a 60–65 cm seat; a 100–110 cm bar takes 75 cm.",
      "Give the feet a footrest — it is what makes a tall seat comfortable over time.",
    ],
  },
  stool: {
    zh: [
      "當餐凳用座高 42～45 cm，配 72～75 cm 的桌子；玄關穿鞋凳 40～45 cm。",
      "桌面減座面抓 27～30 cm，量你家的桌子回推凳高最準。",
    ],
    en: [
      "As a dining stool use 42–45 cm seat height for a 72–75 cm table; an entryway shoe stool is 40–45 cm.",
      "Keep the table-to-seat gap at 27–30 cm — measure your own table and work backwards.",
    ],
  },
  "round-stool": {
    zh: [
      "座高 42～45 cm 配 72～75 cm 的桌子；穿鞋、矮凳用 40～45 cm。",
    ],
    en: [
      "Seat height 42–45 cm for a 72–75 cm table; 40–45 cm as a low or shoe stool.",
    ],
  },
  bench: {
    zh: [
      "餐桌長凳座高 42～45 cm，配 72～75 cm 的桌子；每個座位寬 55～65 cm，兩人坐抓 110～130 cm。",
    ],
    en: [
      "A dining bench sits at 42–45 cm for a 72–75 cm table; allow 55–65 cm per person, so two people need 110–130 cm.",
    ],
  },
  "low-table": {
    zh: [
      "茶几高 35～45 cm，跟沙發座面齊或略低（取沙發座高 ±5 cm）；放飲料 40 cm 上下最順手。",
    ],
    en: [
      "Coffee table height 35–45 cm, level with or slightly below the sofa seat (sofa seat height ±5 cm); around 40 cm is handiest for drinks.",
    ],
  },
  "round-tea-table": {
    zh: [
      "茶几高 35～45 cm，取沙發座高 ±5 cm。",
    ],
    en: [
      "Coffee table height 35–45 cm, within ±5 cm of the sofa seat height.",
    ],
  },
  "tea-table": {
    zh: [
      "沙發邊几高度與扶手齊，約 55～65 cm，放手機水杯不用低頭；當茶几用則 35～45 cm。",
    ],
    en: [
      "A sofa side table sits level with the armrest, about 55–65 cm; used as a coffee table it drops to 35–45 cm.",
    ],
  },
  "round-table": {
    zh: [
      "圓桌每人弧長抓 55～60 cm：直徑 ≈ 人數 × 55～60 ÷ 3.14。4 人約 70～80 cm、6 人約 105～115 cm、8 人約 140～155 cm。",
      "桌高 72～75 cm，配座高 42～45 cm 的椅子。",
    ],
    en: [
      "Allow 55–60 cm of rim per person: diameter ≈ seats × 55–60 ÷ 3.14. Four seats ≈ 70–80 cm, six ≈ 105–115 cm, eight ≈ 140–155 cm.",
      "Table height 72–75 cm with 42–45 cm seat-height chairs.",
    ],
  },
  "open-bookshelf": {
    zh: [
      "層板深度：一般書 20～25 cm，雜誌／大開本 30～35 cm，太深書會往後倒。",
      "層板淨間距：平裝 25～30 cm，精裝／A4 30～35 cm，展示再加 5 cm。",
      "層板跨距實木不超過 75～90 cm、夾板 60～75 cm，超過就加中立板或背板。",
    ],
    en: [
      "Shelf depth: 20–25 cm for ordinary books, 30–35 cm for magazines and large formats — deeper and books tip backwards.",
      "Clear shelf spacing: 25–30 cm for paperbacks, 30–35 cm for hardcovers and A4, add 5 cm for display.",
      "Keep shelf spans under 75–90 cm in solid wood or 60–75 cm in plywood; beyond that add a divider or back panel.",
    ],
  },
  wardrobe: {
    zh: [
      "深度 55～60 cm，吊掛衣物正面寬約 55 cm，低於 55 衣架會頂門。",
      "掛衣桿離地：長衣區 150～180 cm；短衣／上衣區 90～110 cm，可做雙層（上桿約 180～200、下桿約 90～100）。",
      "疊放衣物的層板間距 30～40 cm。",
    ],
    en: [
      "Depth 55–60 cm: a hanging garment is about 55 cm across, so anything shallower jams the doors.",
      "Rod height from the floor: 150–180 cm for long garments, 90–110 cm for shirts; a double rod runs about 180–200 cm over 90–100 cm.",
      "Shelves for folded clothes 30–40 cm apart.",
    ],
  },
  "shoe-cabinet": {
    zh: [
      "深度 35～40 cm 放一般鞋；靴子或鞋盒 40～45 cm。",
      "開放鞋格層板間距 15～20 cm，靴格 30 cm 以上。",
      "旁邊的穿鞋椅高 40～45 cm。",
    ],
    en: [
      "Depth 35–40 cm for everyday shoes; 40–45 cm for boots or shoe boxes.",
      "Open shoe shelves 15–20 cm apart, boot compartments 30 cm or more.",
      "A matching shoe bench sits at 40–45 cm.",
    ],
  },
  "media-console": {
    zh: [
      "櫃面高 40～60 cm，多用 45～50 cm，讓坐姿視線略平視螢幕中心；螢幕壁掛的話櫃子只放設備，35～45 cm 就夠。",
    ],
    en: [
      "Top height 40–60 cm, usually 45–50 cm so the screen centre sits at seated eye level; with a wall-mounted screen 35–45 cm is enough.",
    ],
  },
  bed: {
    zh: [
      "床墊上緣離地 45～55 cm 最好起身；矮床 25～35 cm。床頭板高出床墊 40～60 cm，靠著看書才夠。",
      "床框內徑比床墊大 1～2 cm 留塞墊空間，不要做剛好。",
      "台灣常見床墊：單人 3 尺 91×188、雙人 5 尺 152×188、加大 6 尺 182×188 cm。",
    ],
    en: [
      "Mattress top 45–55 cm from the floor is easiest to get up from; a low bed is 25–35 cm. Headboard 40–60 cm above the mattress for reading.",
      "Make the frame's inside 1–2 cm larger than the mattress — never an exact fit.",
      "Common Taiwan mattress sizes: single 91×188, double 152×188, queen 182×188 cm.",
    ],
  },
};

export function getSizingNotes(category: FurnitureCategory, locale: string): string[] {
  const n = SIZING_NOTES[category];
  if (!n) return [];
  return locale === "en" ? n.en : n.zh;
}
