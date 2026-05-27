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

/**
 * spec.choices 內 select 選項的 EN label 對應表，key = `${spec.key}:${value}`。
 * 找不到對應就 fallback 回原本的 zh label。
 *
 * 這個表跟 SPEC_LABEL_EN 同樣是漸進式覆蓋；長尾選項先放著，常用 / 高曝光的
 * 先補。當下覆蓋的是 legShape / cornerJoinery / layoutMode / backStyle /
 * pullStyle / doorStyle / drawerStyle / lowerStretcherStyle / bodyShape /
 * stretcherStyle / withLowerStretcher 等高頻 dropdown。
 */
export const CHOICE_LABEL_EN: Record<string, string> = {
  // === legShape ===
  "legShape:box": "Square (straight)",
  "legShape:tapered": "Tapered",
  "legShape:splayed": "Splayed (square)",
  "legShape:splayed-tapered": "Splayed + tapered",
  "legShape:splayed-width": "Splayed (front-back)",
  "legShape:splayed-length": "Splayed (side)",
  "legShape:round": "Round (straight)",
  "legShape:round-tapered": "Round + tapered",
  "legShape:round-taper-up": "Round, taper up",
  "legShape:round-taper-down": "Round, taper down",
  "legShape:splayed-round-taper-up": "Splayed round, taper up",
  "legShape:splayed-round-taper-down": "Splayed round, taper down",
  "legShape:chamfered": "Chamfered",
  "legShape:waisted": "Waisted",
  "legShape:cabriole": "Cabriole",
  "legShape:horse-hoof": "Horse-hoof (Ming)",
  "legShape:reverse-horse-hoof": "Reverse horse-hoof (Qing)",

  // === bodyShape / boxShape ===
  "bodyShape:square": "Square",
  "bodyShape:rect": "Rectangular",
  "bodyShape:round": "Round",
  "bodyShape:hex": "Hexagonal",
  "bodyShape:oct": "Octagonal",
  "boxShape:square": "Square",
  "boxShape:rect": "Rectangular",
  "boxShape:round": "Round",
  "boxShape:hex": "Hexagonal",
  "boxShape:oct": "Octagonal",

  // === backStyle ===
  "backStyle:slat": "Slat back",
  "backStyle:ladder": "Ladder back",
  "backStyle:windsor": "Windsor (spindles)",
  "backStyle:panel": "Solid panel",
  "backStyle:splat": "Single splat",
  "backStyle:fan": "Fan back",
  "backStyle:cross": "Cross back",
  "backStyle:none": "None",

  // === doorType / doorStyle ===
  "doorType:flush": "Flush",
  "doorType:inset": "Inset",
  "doorType:overlay": "Overlay",
  "doorType:glass": "Glass panel",
  "doorType:panel": "Frame and panel",
  "doorType:none": "No doors",
  "doorStyle:flat": "Flat",
  "doorStyle:shaker": "Shaker",
  "doorStyle:panel": "Frame and panel",
  "doorStyle:glass": "Glass",
  "doorStyle:inset-panel": "Inset panel",

  // === drawerStyle ===
  "drawerStyle:flush": "Flush front",
  "drawerStyle:inset": "Inset",
  "drawerStyle:overlay": "Overlay",
  "drawerStyle:shaker": "Shaker",

  // === handle / pullStyle ===
  "pullStyle:none": "None",
  "pullStyle:bar": "▬ Bar pull",
  "pullStyle:knob": "● Knob",
  "pullStyle:wood-knob": "🍄 Wood knob (turned)",
  "pullStyle:cup": "Cup pull",
  "pullStyle:drop-bail": "Drop bail (traditional)",
  "pullStyle:recessed": "Recessed finger pull",
  "handleShape:bar": "▬ Bar pull",
  "handleShape:knob": "● Knob",
  "handleShape:cup": "Cup pull",
  "handleShape:recessed": "Recessed finger pull",
  "handleShape:none": "None",

  // === layoutMode ===
  "layoutMode:vertical": "Vertical",
  "layoutMode:horizontal": "Horizontal",
  "layoutMode:single-layer": "Single tier",
  "layoutMode:h-2col": "Horizontal (2 columns)",
  "layoutMode:h-3col": "Horizontal (3 columns)",
  "layoutMode:v-1col": "Vertical (1 column)",
  "layoutMode:v-2col": "Vertical (2 columns)",

  // === cornerJoinery ===
  "cornerJoinery:through-tenon": "Through tenon",
  "cornerJoinery:blind-tenon": "Blind tenon",
  "cornerJoinery:dovetail": "Dovetail",
  "cornerJoinery:finger-joint": "Finger joint",
  "cornerJoinery:miter": "Miter",
  "cornerJoinery:mitered-spline": "Mitered with spline",
  "cornerJoinery:butt": "Butt joint",
  "cornerJoinery:stub-joint": "Housing joint",
  "cornerJoinery:half-lap": "Half lap",
  "cornerJoinery:rebated": "Rebated",

  // === stretcher style ===
  "lowerStretcherStyle:h-frame": "H-frame (4 stretchers, sturdiest)",
  "lowerStretcherStyle:x-cross": "X-cross (2 diagonal braces)",
  "lowerStretcherStyle:box": "Box (perimeter ring)",
  "lowerStretcherStyle:single": "Single center stretcher",
  "lowerStretcherStyle:none": "None",
  "stretcherStyle:h-frame": "H-frame",
  "stretcherStyle:x-cross": "X-cross",
  "stretcherStyle:box": "Box",
  "stretcherStyle:single": "Single",
  "stretcherStyle:none": "None",
  "standingBraceStyle:h-frame": "H-frame",
  "standingBraceStyle:x-cross": "X-cross",
  "standingBraceStyle:cross": "Cross",
  "standingBraceStyle:none": "None",

  // === withLowerStretcher / generic on-off ===
  // (booleans don't have choices; skipped)

  // === layer / zone / row types (open-bookshelf, chest, etc.) ===
  "upperType:open-shelf": "Open shelf",
  "upperType:drawer-row": "Drawer row",
  "upperType:door-row": "Door row",
  "upperType:glass-door": "Glass door",
  "upperType:none": "None",
  "midType:open-shelf": "Open shelf",
  "midType:drawer-row": "Drawer row",
  "midType:door-row": "Door row",
  "midType:none": "None",
  "bottomType:open-shelf": "Open shelf",
  "bottomType:drawer-row": "Drawer row",
  "bottomType:door-row": "Door row",
  "bottomType:plinth": "Plinth base",
  "bottomType:legs": "Legs",
  "bottomType:none": "None",

  // === edge profile ===
  "seatEdge:square": "Square edge",
  "seatEdge:rounded": "Rounded over",
  "seatEdge:chamfered": "Chamfered",
  "seatEdge:bullnose": "Bullnose",
  "seatEdge:ogee": "Ogee",
  "seatEdge:waterfall": "Waterfall",
  "apronEdge:square": "Square",
  "apronEdge:rounded": "Rounded over",
  "apronEdge:chamfered": "Chamfered",
  "stretcherEdge:square": "Square",
  "stretcherEdge:rounded": "Rounded over",
  "stretcherEdge:chamfered": "Chamfered",
  "legEdge:square": "Square",
  "legEdge:rounded": "Rounded over",
  "legEdge:chamfered": "Chamfered",

  // === apron-drawer position ===
  "apronDrawerPosition:front": "Front apron",
  "apronDrawerPosition:both-sides": "Both side aprons",
  "apronDrawerPosition:left": "Left apron",
  "apronDrawerPosition:right": "Right apron",

  // === drop leaf / lid ===
  "dropLeaf:none": "None",
  "dropLeaf:one-side": "One side",
  "dropLeaf:both-sides": "Both sides",
  "dropLeaf:front": "Front",
  "dropLeaf:back": "Back",
  "lidType:flat": "Flat",
  "lidType:hinged": "Hinged",
  "lidType:slide": "Sliding",

  // === useCase / sizingMode (common select) ===
  "useCase:custom": "Custom",
  "useCase:standard": "Standard",
  "sizingMode:byCount": "By count (overall calculated)",
  "sizingMode:byOverall": "By overall (count calculated)",
  "sizingMode:auto": "Auto",
  "sizingMode:custom": "Custom",

  // === rearPostMode / headStyle ===
  "rearPostMode:integral": "Integral with rear leg",
  "rearPostMode:separate": "Separate post",
  "rearPostMode:none": "None",
};

export function choiceLabel(
  specKey: string,
  value: string,
  originalLabel: string,
  locale: string,
): string {
  if (locale !== "en") return originalLabel;
  return CHOICE_LABEL_EN[`${specKey}:${value}`] ?? originalLabel;
}
