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
  legEdge: "Leg edge size (mm)",
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
  seatEdge: "Edge size (mm)",
  seatEdgeStyle: "Edge profile",
  seatEdgeBottom: "Bottom edge size (mm)",
  seatProfile: "Seat scoop",
  topPanelPieces: "Top board glue-up",
  backRake: "Back rake (°)",
  seatBendMm: "Seat dish (mm)",
  seatCornerR: "Seat corner radius (mm)",
  seatPenetratingTenon: "Through-seat tenon (legs visible on top)",

  // === Apron ===
  apronWidth: "Apron height (mm)",
  apronThickness: "Apron thickness (mm)",
  apronDropFromTop: "Apron drop from top (mm)",
  apronOffset: "Apron offset (mm)",
  apronStaggerMm: "Apron stagger (mm)",
  apronEdge: "Apron edge size (mm)",
  apronEdgeStyle: "Apron edge profile",
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
  stretcherEdge: "Stretcher edge size (mm)",
  stretcherEdgeStyle: "Stretcher edge profile",
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

  // === Tier-2 long-tail (deduplicated against the main map above) ===
  backPanelBottomArch: "Bottom-edge arch rise (mm)",
  backPanelCornerR: "Curved panel corner radius (mm)",
  backPanelEmbed: "Backrest cylinder embed depth (mm)",
  backPanelFaceBend: "Curved panel face bend (mm)",
  backPanelHeight: "Back panel height (mm)",
  backPanelInset: "Back panel inset (mm)",
  backPanelMaterial: "Back panel material",
  leftWidthMm: "Left column width (mm)",
  rightWidthMm: "Right column width (mm)",
  singleLayerLeftWidthMm: "Left column width (mm)",
  singleLayerRightWidthMm: "Right column width (mm)",
  legEdgeStyle: "Leg edge profile",
  pedestalTopGap: "Pedestal-top gap (mm)",
  pedestalStretcherHeight: "Pedestal stretcher floor height (mm)",
  headHeight: "Headboard height (mm)",
  wallHeight: "Ceiling height (mm)",
  ceilingHeight: "Ceiling height (mm)",
  withFrenchCleat: "Add French cleat",

  // Round-table / lazy-susan / center stretcher
  withLazySusanBearing: "Lazy Susan bearing",
  withTrim: "Add trim molding",
  withMolding: "Add molding",

  // Box / dovetail-box detail
  segmentCount: "Segment count",
  angleDeg: "Angle (°)",
  insideDimsMode: "Inside-dim mode",

  // Coat rack
  hookCount: "Hook count",
  hookHeight: "Hook height (mm)",

  // Bed
  mattressLength: "Mattress length (mm)",
  mattressWidth: "Mattress width (mm)",
  slatCount: "Slat count",
};

/**
 * spec.help EN map. Long-tail; only the most-commonly-hovered tooltips translated.
 * Missing → falls back to spec.help (zh).
 */
export const SPEC_HELP_EN: Record<string, string> = {
  legInset: "Distance from leg center to seat edge. > 0 makes the top overhang the legs — crisper visual.",
  splayAngle: "Splay angle relative to vertical, in the splayed-leg family. Default ~3° is mild; 10°+ reads boldly (Nordic), max ~15°.",
  legPenetratingTenon: "Checked: apron / stretcher tenons go all the way through the leg (Ming-style decorative). Unchecked: blind tenon at 2/3 mother thickness.",
  seatPenetratingTenon: "Checked: leg-top tenon passes through the seat (visible end-grain — traditional). Unchecked: blind tenon at ≤ 4/5 seat thickness.",
  withLowerStretcher: "Adds a stretcher ring at the lower 1/4 of leg height — significantly stiffer; classic four-leg stool detail.",
  lowerStretcherHeight: "0 = auto (22% of leg height).",
  lowerStretcherStaggerMm: "How much the left/right lower stretchers ride above the front/back pair. 0 = even-height (auto half-lap to avoid clash).",
  apronDropFromTop: "Distance from apron's top face down to the seat's bottom edge. Small stools should leave 10–15 mm so it doesn't look top-heavy.",
  apronStaggerMm: "How much the front/back aprons drop relative to the left/right pair. 0 = even-height (auto half-lap to avoid clash).",
  lockTotalHeight: "Locked: total height is fixed; remaining height after each tier becomes the leg, min 30 mm (warning shown if smaller). Unlocked: legs are set directly, lower zone fills remainder.",
  seatBendMm: "Whole seat bends like a laminated panel — center dips for comfort; corner mortise positions are unaffected. > 0 overrides saddle / edge profile.",

  // Edge profile hints (shared via _helpers.ts)
  legEdge:
    "Default 1 mm light ease (anti-splinter); 3–5 mm subtle chamfer; 8 mm+ pronounced octagonal cross-section (Ming/Qing style). Stretchers set separately.",
  stretcherEdge:
    "Default 1 mm light ease (anti-splinter); 3–5 mm subtle chamfer; 8 mm+ pronounced octagonal cross-section.",
  apronEdge:
    "Default 1 mm light ease (anti-splinter); 3–5 mm subtle chamfer. Tapered / splayed legs turn the apron into a trapezoid and the chamfer is ignored.",
  seatEdge:
    "0 = square; 3–5 mm gentle ease (won't press the thigh); 8–15 mm pronounced chamfer / egg-shaped rounded edge. Pick the style (45° / round) below.",
  seatEdgeStyle:
    "Pairs with “Edge size”. At 0 mm neither setting affects the geometry.",
  seatEdgeBottom:
    "Chamfer on the seat/top *underside* edge. Only effective once the legs are inset — the value is auto-clamped to the leg inset so it never cuts into the apron. Style is shared with the top edge.",
  apronEdgeStyle:
    "Pairs with “Apron edge size”. At 0 mm neither setting affects the geometry.",
  legEdgeStyle: "Style for the leg edge chamfer (V-bit 45° vs. round-over bit).",
  seatProfile:
    "Whether to scoop the seat. A scooped seat is more comfortable but needs a hand plane or carving router.",
  topPanelPieces:
    "Affects the cut-list / material display. Solid tops > 300 mm wide should be glued up from narrower pieces to resist cupping.",
  backRake:
    "How far the back tilts rearward. 0° = fully vertical; 5° is comfortable, 15° is reclined.",
};

/**
 * spec.label 繁中字典 — 用 spec.key 當主鍵，跨 26 個 template 共享。
 *
 * 注意：各 template 內 spec.label 仍是 source-of-truth（且可能有 template-
 * specific 措辭，例如 bar-stool 用「椅腳樣式」、square-stool 用「腳樣式」）。
 * 這份 ZH map 提供「跨 template 一致」的中性 label，供需要統一顯示的場景使用。
 * 透過 `specLabel(spec, locale)` 解析時，locale='zh' 一律 fallback 回 spec.label
 * 以保留 template-specific 措辭；明確要中性 ZH label 時用 `SPEC_LABEL_ZH[key]`。
 */
export const SPEC_LABEL_ZH: Record<string, string> = {
  // === Legs ===
  legShape: "腳樣式",
  legSize: "腳粗 (mm)",
  legWidth: "腳寬 X (mm)",
  legDepth: "腳深 Z (mm)",
  legHeight: "腳高 (mm)",
  legInset: "腳內縮 (mm)",
  legEdge: "腳邊緣處理",
  legWidthOverride: "腳寬覆寫 (mm)",
  legDepthOverride: "腳深覆寫 (mm)",
  legPenetratingTenon: "腳上榫頭通透（明榫裝飾）",
  splayAngle: "外斜角度 (°)",
  withLegs: "🦿 有腳",
  withFootboard: "加腳踏板",

  // === Top / Seat ===
  topType: "桌面類型",
  topThickness: "桌面厚 (mm)",
  seatThickness: "座板厚 (mm)",
  seatEdge: "座板邊緣處理",
  seatEdgeBottom: "座板下緣",
  seatBendMm: "椅面彎曲 (mm)",
  seatCornerR: "座板圓角半徑 (mm)",
  seatPenetratingTenon: "椅面通透（腳頂穿透）",

  // === Apron ===
  apronWidth: "牙條高度 (mm)",
  apronThickness: "牙條厚度 (mm)",
  apronDropFromTop: "牙條距座板 (mm)",
  apronOffset: "牙條偏移 (mm)",
  apronStaggerMm: "牙條錯開 (mm)",
  apronEdge: "牙條邊緣處理",
  apronEdgeStyle: "牙條邊緣樣式",
  withApron: "有牙條",
  spandrelStyle: "牙花樣式",
  friezePanel: "壁緣板",

  // === Stretchers ===
  withLowerStretcher: "加下橫撐",
  withLowerStretchers: "加下橫撐",
  withCenterStretcher: "加中央橫撐",
  lowerStretcherStyle: "下橫撐樣式",
  lowerStretcherWidth: "下橫撐高 (mm)",
  lowerStretcherThickness: "下橫撐厚 (mm)",
  lowerStretcherHeight: "下橫撐離地高 (mm)",
  lowerStretcherStaggerMm: "下橫撐錯開 (mm)",
  lowerStretcherArrangement: "下橫撐排列",
  stretcherStyle: "橫撐樣式",
  stretcherEdge: "橫撐邊緣處理",
  standingBraceStyle: "立撐樣式",

  // === Back / chair-specific ===
  backStyle: "椅背樣式",
  backHeight: "椅背高度 (mm)",
  backInsetFromEndMm: "椅背距座板端 (mm)",
  backInsetFromRearMm: "椅背距座板後 (mm)",
  endSplat: "端板",
  withArmrest: "加扶手",
  armrestHeight: "扶手高度 (mm)",
  armrestPlankWidth: "扶手板寬 (mm)",
  armrestPlankThickness: "扶手板厚 (mm)",
  armrestPostWidth: "扶手前柱 X (mm)",
  armrestPostThickness: "扶手前柱 Z (mm)",
  rearPostMode: "後柱模式",
  headStyle: "床頭板樣式",

  // === Carcase / panels ===
  panelThickness: "板厚 (mm)",
  bottomThickness: "底板厚 (mm)",
  bottomType: "底板類型",
  bottomAttach: "底板固定方式",
  pedestalTopAttach: "桌墩頂面固定方式",
  wallThickness: "壁厚 (mm)",
  cabinetCorner: "櫃體轉角",
  cornerJoinery: "轉角接合",
  bodyShape: "本體形狀",
  boxShape: "盒體形狀",
  panelStyle: "板樣式",

  // === Layout / zones / columns ===
  layoutMode: "排列模式",
  compoundMode: "複合模式",
  layerCount: "層數",
  layer1Type: "第 1 層類型",
  layer2Type: "第 2 層類型",
  layer3Type: "第 3 層類型",
  layer4Type: "第 4 層類型",
  layer5Type: "第 5 層類型",
  layer6Type: "第 6 層類型",
  layer7Type: "第 7 層類型",
  layer8Type: "第 8 層類型",
  upperType: "上層類型",
  midType: "中層類型",
  bottomType_zone: "下層類型",
  withUpperZone: "加上層",
  leftType: "左欄類型",
  rightType: "右欄類型",
  centerType: "中欄類型",
  leftCount: "左欄列數",
  rightCount: "右欄列數",
  centerCount: "中欄列數",
  left: "左欄",
  right: "右欄",
  front: "前",
  back: "後",
  verticalDividerCount: "垂直分隔板數",
  dividerThickness: "分隔板厚 (mm)",
  dividerHeight: "分隔板高 (mm)",
  polygonDividerStyle: "多邊形分隔樣式",
  gridLayout: "格網排列",

  // === Drawers ===
  withDrawer: "加抽屜",
  withPullOutDrawer: "加抽拉屜",
  drawerCount: "抽屜數",
  drawerRows: "抽屜列數",
  drawerStyle: "抽屜樣式",
  drawerSide: "抽屜方向",
  drawerFaceStyle: "抽屜面板樣式",
  drawerBackMode: "抽屜背板模式",
  drawerHeightStyle: "抽屜高度樣式",
  ascendingDrawerCount: "抽屜總數",
  apronDrawerPosition: "牙條抽屜位置",
  apronDrawerWidth: "牙條抽屜寬 (mm)",
  apronDrawerFrontInset: "抽屜面板內縮 (mm)",

  // === Doors / handles / hardware ===
  doorType: "門片類型",
  doorStyle: "門片樣式",
  withHandle: "加把手",
  handleShape: "把手形狀",
  pullStyle: "把手樣式",
  withLid: "加蓋",
  lidType: "蓋體類型",

  // === Misc structure ===
  hasLowerShelf: "加下層板",
  withSlatRack: "加條板架",
  withGalleryRail: "加圍欄",
  withLedderRail: "加梯式靠背",
  withBookStop: "加書擋",
  withLazySusan: "加旋轉盤",
  withToeKick: "加踢腳",
  withCrownMolding: "加上緣線板",
  withGrooveBack: "加凹槽背板",
  withRebate: "加企口",
  dropLeaf: "活動桌翼",
  liveEdge: "自然邊",
  lockTotalHeight: "🔒 鎖總高",
  sizingMode: "尺寸模式",
  useCase: "使用情境",
  balustradeStyle: "欄杆樣式",
  angledRack: "傾斜鞋架",
  angledRackTilt: "傾斜角度 (°)",

  // === Tier-2 long-tail ===
  backPanelBottomArch: "背板下緣弧高 (mm)",
  backPanelCornerR: "曲面背板圓角 (mm)",
  backPanelEmbed: "靠背圓柱嵌入深度 (mm)",
  backPanelFaceBend: "曲面背板正面彎曲 (mm)",
  backPanelHeight: "背板高度 (mm)",
  backPanelInset: "背板內縮 (mm)",
  backPanelMaterial: "背板材質",
  leftWidthMm: "左欄寬 (mm)",
  rightWidthMm: "右欄寬 (mm)",
  singleLayerLeftWidthMm: "左欄寬 (mm)",
  singleLayerRightWidthMm: "右欄寬 (mm)",
  legEdgeStyle: "腳邊緣樣式",
  pedestalTopGap: "桌墩頂面留縫 (mm)",
  pedestalStretcherHeight: "桌墩橫撐離地高 (mm)",
  headHeight: "床頭板高度 (mm)",
  wallHeight: "天花高度 (mm)",
  ceilingHeight: "天花高度 (mm)",
  withFrenchCleat: "加 French cleat",

  // Round-table / lazy-susan / center stretcher
  withLazySusanBearing: "旋轉盤軸承",
  withTrim: "加飾條線板",
  withMolding: "加線板",

  // Box / dovetail-box detail
  segmentCount: "分段數",
  angleDeg: "角度 (°)",
  insideDimsMode: "內尺寸模式",

  // Coat rack
  hookCount: "掛鉤數",
  hookHeight: "掛鉤高度 (mm)",

  // Bed
  mattressLength: "床墊長 (mm)",
  mattressWidth: "床墊寬 (mm)",
  slatCount: "床板條數",
};

export function specLabel(spec: OptionSpec, locale: string): string {
  if (locale === "en") {
    const en = SPEC_LABEL_EN[spec.key];
    if (en) return en;
  }
  return spec.label;
}

/** spec.help — EN tooltip lookup; falls back to spec.help (zh). */
export function specHelp(spec: OptionSpec, locale: string): string | undefined {
  if (locale === "en") {
    const en = SPEC_HELP_EN[spec.key];
    if (en) return en;
  }
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

  // === seatProfile (seat scoop) ===
  "seatProfile:flat": "Flat (simplest)",
  "seatProfile:saddle": "Saddle scoop (ergonomic, needs ~5° arc)",
  "seatProfile:scooped": "Twin scoop (~6 mm each side)",
  "seatProfile:waterfall": "Waterfall front (won't dig into thighs)",
  "seatProfile:dished": "Dished centre (single-axis, for long sitting)",

  // === edge style (45° vs rounded) — used by seatEdgeStyle / apronEdgeStyle / stretcherEdgeStyle / legEdgeStyle ===
  "seatEdgeStyle:chamfered": "45° chamfer (V-bit)",
  "seatEdgeStyle:rounded": "Round-over (round bit)",
  "apronEdgeStyle:chamfered": "45° chamfer (V-bit)",
  "apronEdgeStyle:rounded": "Round-over (round bit)",
  "stretcherEdgeStyle:chamfered": "45° chamfer (V-bit)",
  "stretcherEdgeStyle:rounded": "Round-over (round bit)",
  "legEdgeStyle:chamfered": "45° chamfer (V-bit)",
  "legEdgeStyle:rounded": "Round-over (round bit)",

  // === topPanelPieces ===
  "topPanelPieces:1": "Single board (< 300 mm wide)",
  "topPanelPieces:2": "2-board glue-up",
  "topPanelPieces:3": "3-board glue-up (most common, ~200–300 mm each)",
  "topPanelPieces:4": "4-board glue-up (large tops)",

  // === rectLegShape choices (RECT_LEG_SHAPE_CHOICES) ===
  "legShape:strong-taper": "Strong taper (heavily narrowed at bottom)",
  "legShape:inverted": "Inverted taper (thicker at bottom)",

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
