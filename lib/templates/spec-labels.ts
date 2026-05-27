/**
 * spec.label 英文翻譯字典 — 用 spec.key 當主鍵，跨 26 個 template 共享。
 *
 * 為什麼不直接改 template 檔的 label：26 支 template × 平均 20 個 spec ≈ 500 個
 * 字串散布在 17K 行 code 內，硬塞 nameEn/labelEn 改動量過大、出錯機率高。
 * 改在 render layer 攔截，spec.label 維持 zh，多開一份 zh→en map。
 *
 * Coverage 策略：先涵蓋出現在 ≥3 個 template 的高頻 key（~100 個），長尾少見
 * key 直接 fallback 回 spec.label（zh）。未來補譯只要往這檔加 key 即可。
 *
 * 用法：`specLabel(spec, locale)` — locale='en' 且 key 在表內 → 回英文；
 * 其他情況都回 spec.label。
 *
 * 維護紀律：新增 template 或新 key 時，常用 key 同步加進來。
 * 對齊譯詞表（之後建）：docs/glossary-zh-en.md
 */

import type { OptionSpec } from "@/lib/types";

export const SPEC_LABEL_EN: Record<string, string> = {
  // === Legs ===
  legShape: "Leg shape",
  legSize: "Leg size (mm)",
  legWidth: "Leg width X (mm)",
  legDepth: "Leg depth Z (mm)",
  legHeight: "Leg height (mm)",
  legInset: "Leg inset (mm)",
  legEdge: "Leg edge profile",
  legWidthOverride: "Leg width override (mm)",
  legDepthOverride: "Leg depth override (mm)",
  legPenetratingTenon: "Through tenons (decorative)",
  splayAngle: "Splay angle (°)",
  withLegs: "🦿 With legs",
  withFootboard: "With footboard",

  // === Top / Seat ===
  topType: "Top type",
  topThickness: "Top thickness (mm)",
  seatThickness: "Seat thickness (mm)",
  seatEdge: "Seat edge profile",
  seatEdgeBottom: "Seat bottom edge",
  seatBendMm: "Seat dish (mm)",
  seatCornerR: "Seat corner radius (mm)",
  seatPenetratingTenon: "Through-seat tenon (legs visible on top)",

  // === Apron ===
  apronWidth: "Apron height (mm)",
  apronThickness: "Apron thickness (mm)",
  apronDropFromTop: "Apron drop from top (mm)",
  apronOffset: "Apron offset (mm)",
  apronStaggerMm: "Apron stagger (mm)",
  apronEdge: "Apron edge profile",
  apronEdgeStyle: "Apron edge style",
  withApron: "With apron",
  spandrelStyle: "Spandrel style",
  friezePanel: "Frieze panel",

  // === Stretchers ===
  withLowerStretcher: "Add lower stretcher",
  withLowerStretchers: "Add lower stretchers",
  withCenterStretcher: "Add center stretcher",
  lowerStretcherStyle: "Lower stretcher style",
  lowerStretcherWidth: "Lower stretcher height (mm)",
  lowerStretcherThickness: "Lower stretcher thickness (mm)",
  lowerStretcherHeight: "Lower stretcher floor height (mm)",
  lowerStretcherStaggerMm: "Lower stretcher stagger (mm)",
  lowerStretcherArrangement: "Lower stretcher layout",
  stretcherStyle: "Stretcher style",
  stretcherEdge: "Stretcher edge profile",
  standingBraceStyle: "Standing brace style",

  // === Back / chair-specific ===
  backStyle: "Back style",
  backHeight: "Back height (mm)",
  backInsetFromEndMm: "Back inset from seat end (mm)",
  backInsetFromRearMm: "Back inset from seat rear (mm)",
  endSplat: "End splat",
  withArmrest: "With armrest",
  armrestHeight: "Armrest height (mm)",
  armrestPlankWidth: "Armrest plank width (mm)",
  armrestPlankThickness: "Armrest plank thickness (mm)",
  armrestPostWidth: "Armrest front post X (mm)",
  armrestPostThickness: "Armrest front post Z (mm)",
  rearPostMode: "Rear post mode",
  headStyle: "Headboard style",

  // === Carcase / panels ===
  panelThickness: "Panel thickness (mm)",
  bottomThickness: "Bottom panel thickness (mm)",
  bottomType: "Bottom panel type",
  bottomAttach: "Bottom panel attachment",
  pedestalTopAttach: "Pedestal-top attachment",
  wallThickness: "Wall thickness (mm)",
  cabinetCorner: "Cabinet corner",
  cornerJoinery: "Corner joinery",
  bodyShape: "Body shape",
  boxShape: "Box shape",
  panelStyle: "Panel style",

  // === Layout / zones / columns ===
  layoutMode: "Layout mode",
  compoundMode: "Compound mode",
  layerCount: "Number of tiers",
  layer1Type: "Tier 1 type",
  layer2Type: "Tier 2 type",
  layer3Type: "Tier 3 type",
  layer4Type: "Tier 4 type",
  layer5Type: "Tier 5 type",
  layer6Type: "Tier 6 type",
  layer7Type: "Tier 7 type",
  layer8Type: "Tier 8 type",
  upperType: "Upper zone type",
  midType: "Mid zone type",
  bottomType_zone: "Lower zone type",
  withUpperZone: "Add upper zone",
  leftType: "Left column type",
  rightType: "Right column type",
  centerType: "Center column type",
  leftCount: "Left column rows",
  rightCount: "Right column rows",
  centerCount: "Center column rows",
  left: "Left column",
  right: "Right column",
  front: "Front",
  back: "Back",
  verticalDividerCount: "Vertical divider count",
  dividerThickness: "Divider thickness (mm)",
  dividerHeight: "Divider height (mm)",
  polygonDividerStyle: "Polygon divider style",
  gridLayout: "Grid layout",

  // === Drawers ===
  withDrawer: "With drawer",
  withPullOutDrawer: "With pull-out drawer",
  drawerCount: "Drawer count",
  drawerRows: "Drawer rows",
  drawerStyle: "Drawer style",
  drawerSide: "Drawer side",
  drawerFaceStyle: "Drawer face style",
  drawerBackMode: "Drawer back mode",
  drawerHeightStyle: "Drawer height style",
  ascendingDrawerCount: "Total drawer count",
  apronDrawerPosition: "Apron-drawer position",
  apronDrawerWidth: "Apron-drawer width (mm)",
  apronDrawerFrontInset: "Drawer front inset (mm)",

  // === Doors / handles / hardware ===
  doorType: "Door type",
  doorStyle: "Door style",
  withHandle: "With pulls",
  handleShape: "Pull shape",
  pullStyle: "Pull style",
  withLid: "With lid",
  lidType: "Lid type",

  // === Misc structure ===
  hasLowerShelf: "Add lower shelf",
  withSlatRack: "Add slat rack",
  withGalleryRail: "Add gallery rail",
  withLedderRail: "Add ladder-back rail",
  withBookStop: "Add book stop",
  withLazySusan: "Add lazy Susan",
  withToeKick: "Add toe kick",
  withCrownMolding: "Add crown molding",
  withGrooveBack: "Add grooved back panel",
  withRebate: "Add rebate",
  dropLeaf: "Drop leaf",
  liveEdge: "Live edge",
  lockTotalHeight: "🔒 Lock total height",
  sizingMode: "Sizing mode",
  useCase: "Use case",
  balustradeStyle: "Balustrade style",
  angledRack: "Angled shoe shelves",
  angledRackTilt: "Angle (°)",
};

export function specLabel(spec: OptionSpec, locale: string): string {
  if (locale === "en") {
    const en = SPEC_LABEL_EN[spec.key];
    if (en) return en;
  }
  return spec.label;
}

/** spec.help 是次要 tooltip，現階段一律維持 zh；之後可在這填 EN_HELP[key]。 */
export function specHelp(spec: OptionSpec, locale: string): string | undefined {
  void locale;
  return spec.help;
}
