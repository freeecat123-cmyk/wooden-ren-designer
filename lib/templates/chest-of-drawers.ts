import type { FurnitureTemplate, OptionSpec } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { caseFurniture } from "./_builders/case-furniture";
import {
  backModeOption,
  drawerBottomModeOption,
  drawerBottomThicknessOption,
  drawerBoxJoineryOption,
  drawerMountOption,
  drawerSlideOption,
  makeZoneOptions,
  resolveBackMode,
  resolveDrawerBottomMode,
  resolveDrawerBottomThickness,
  resolveDrawerBoxJoinery,
  resolveDrawerMount,
  resolveDrawerSlideGap,
  resolveZones,
} from "./_builders/zone-helpers";
import { applyStandardChecks, validateCabinetStructure, appendWarnings, appendSuggestion } from "./_validators";
import {
  toeKickOptions,
  toeKickNote,
  crownMoldingOptions,
  crownMoldingNote,
  withLegsOption,
  backPanelPlywoodOption,
  resolveLegHeight,
  pullStyleOption,
  pullStyleNote,
  lockTotalHeightOptions,
  resolveLockedTotalHeight,
} from "./_helpers";

export const chestOfDrawersOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "panelThickness", label: "板材厚 (mm)", defaultValue: 18, min: 9, max: 35, step: 1 },
  backModeOption,
  // 上中下分層 zone 設定：ascending 模式下整組隱藏（攤平改用 ratio 自動分配）
  ...makeZoneOptions({
    topType: "drawer", topHeight: 300, topCount: 2, topCols: 1,
    midType: "drawer", midCount: 2, midCols: 1,
    bottomType: "drawer", bottomHeight: 300, bottomCount: 2, bottomCols: 1,
  }).map((spec): OptionSpec => {
    // 斗櫃只有抽屜 + 開放層板，移除門板選項（門板櫃用其他範本：玻璃展示櫃、媒體櫃、衣櫃等）
    const dep = spec.dependsOn
      ? { all: [spec.dependsOn, { key: "drawerHeightStyle", notIn: ["ascending"] }] }
      : { key: "drawerHeightStyle", notIn: ["ascending"] };
    if (spec.type === "select" && (spec.key === "topType" || spec.key === "midType" || spec.key === "bottomType")) {
      return {
        ...spec,
        choices: spec.choices.filter((c) => c.value !== "door"),
        dependsOn: dep,
      };
    }
    return { ...spec, dependsOn: dep };
  }),
  // ascending 模式下顯示「總抽屜數」單一輸入
  { group: "zone-top", type: "number", key: "ascendingDrawerCount", label: "總抽屜數", defaultValue: 6, min: 3, max: 9, step: 1, help: "ascending 模式下整櫃只放抽屜，這裡設總數；每抽高度照 1.4 → 0.8 線性遞減自動分配", dependsOn: { key: "drawerHeightStyle", equals: "ascending" } },
  withLegsOption,
  backPanelPlywoodOption,
  { group: "leg", type: "number", key: "legHeight", label: "底座腳高 (mm)", defaultValue: 70, min: 0, max: 400, step: 10, help: "設 0 則貼地，>0 則加 4 隻沙發腳；70–80 是最常見的家具底座高。鎖定總高時此欄位自動算、設定值會被忽略", dependsOn: { all: [{ key: "withLegs", equals: true }, { any: [{ key: "lockTotalHeight", equals: false }, { key: "drawerHeightStyle", equals: "ascending" }] }] } },
  { group: "leg", type: "number", key: "legSize", label: "腳粗 (mm)", defaultValue: 40, min: 20, max: 120, step: 5, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "leg", type: "select", key: "legShape", label: "腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳（下方收窄）" },
    { value: "round", label: "圓柱腳" },
    { value: "round-tapered", label: "圓錐腳" },
    { value: "bracket", label: "帶托腳牙" },
    { value: "plinth", label: "平台底座（連板）" },
    { value: "panel-side", label: "側板延伸落地（中間空心）" },
  ] , dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }] } },
  { group: "leg", type: "number", key: "legInset", label: "腳內縮 (mm)", defaultValue: 0, min: 0, max: 300, step: 5, dependsOn: { all: [{ key: "withLegs", equals: true }, { key: "legHeight", notIn: [0] }, { key: "legShape", notIn: ["plinth", "panel-side"] }] } },
  drawerMountOption,
  drawerBottomModeOption,
  drawerBottomThicknessOption,
  drawerBoxJoineryOption,
  drawerSlideOption,
  pullStyleOption("drawer"),
  ...toeKickOptions("structure"),
  ...crownMoldingOptions("structure"),
  { group: "drawer", type: "select", key: "drawerFaceStyle", label: "抽屜面板樣式", defaultValue: "flat", choices: [
    { value: "flat", label: "平板（slab，現代極簡）" },
    { value: "raised-panel", label: "凸版（傳統雕花框 + 凸鑲板）" },
  ], help: "面板雕刻樣式（跟「面板安裝方式」獨立——那個控制蓋門/入柱）" },
  { group: "drawer", type: "select", key: "pullPosition", label: "把手位置", defaultValue: "center", choices: [
    { value: "center", label: "中央 1 顆" },
    { value: "dual", label: "左右各 1 顆（傳統斗櫃）" },
  ], help: "傳統明清斗櫃多用左右兩顆對稱把手；現代款多中央 1 顆。對小抽屜（< 400mm）只生中央 1 顆無視此設定" },
  { group: "drawer", type: "select", key: "drawerHeightStyle", label: "抽屜高度比例", defaultValue: "equal", choices: [
    { value: "equal", label: "等高（現代款）" },
    { value: "ascending", label: "下大上小（傳統明清比例 1.4 : 1.2 : 1）" },
  ], help: "傳統斗櫃下層抽屜較深放衣物棉被、上層較淺放小件；現代款多等高" },
  ...lockTotalHeightOptions({ extraDeps: [{ key: "drawerHeightStyle", notIn: ["ascending"] }] }),
  { group: "structure", type: "checkbox", key: "withGalleryRail", label: "頂面圍欄", defaultValue: false, help: "頂板左/右/後加 25mm 高木條圍欄（前面不裝避免擋取物），擺放物品防掉落、視覺更精緻", wide: true },
  { group: "structure", type: "number", key: "galleryInset", label: "圍欄內縮 (mm)", defaultValue: 0, min: 0, max: 80, step: 5, help: "圍欄從頂板邊緣向內縮的距離，0 = 切齊邊緣", dependsOn: { key: "withGalleryRail", equals: true } },
];

export const chestOfDrawers: FurnitureTemplate = (input) => {
  const o = chestOfDrawersOptions;
  const panelThickness = getOption<number>(input, opt(o, "panelThickness"));
  const legHeight = resolveLegHeight(input, o);
  const backPanelPlywood = getOption<boolean>(input, opt(o, "backPanelPlywood"));
  const legSize = getOption<number>(input, opt(o, "legSize"));
  const legShape = getOption<string>(input, opt(o, "legShape"));
  const legInset = getOption<number>(input, opt(o, "legInset"));
  const drawerMount = resolveDrawerMount(input, o);
  const withToeKick = getOption<boolean>(input, opt(o, "withToeKick"));
  const toeKickHeight = getOption<number>(input, opt(o, "toeKickHeight"));
  const toeKickRecess = getOption<number>(input, opt(o, "toeKickRecess"));
  const withCrownMolding = getOption<boolean>(input, opt(o, "withCrownMolding"));
  const crownProjection = getOption<number>(input, opt(o, "crownProjection"));
  const pullStyle = getOption<string>(input, opt(o, "pullStyle"));
  const pullPosition = getOption<string>(input, opt(o, "pullPosition"));
  const drawerFaceStyle = getOption<string>(input, opt(o, "drawerFaceStyle"));
  const drawerHeightStyle = getOption<string>(input, opt(o, "drawerHeightStyle"));
  const ascendingDrawerCount = getOption<number>(input, opt(o, "ascendingDrawerCount"));
  const withGalleryRail = getOption<boolean>(input, opt(o, "withGalleryRail"));
  const galleryInset = getOption<number>(input, opt(o, "galleryInset"));
  // plinth / panel-side 本身就是底座 → 強制取消 toeKick 避免兩個底座疊
  const legShapeIsBase = legShape === "plinth" || legShape === "panel-side";
  const effectiveWithToeKick = legShapeIsBase ? false : withToeKick;
  const baseConflictWarnings = (legShapeIsBase && withToeKick)
    ? [`腳樣式選了「${legShape === "plinth" ? "平台底座" : "側板延伸落地"}」，本身就是底座 → toeKick 自動關閉避免重疊`]
    : [];

  const { innerH, effectiveLegHeight, warnings: lockWarnings } = resolveLockedTotalHeight(
    input, o, panelThickness, legHeight, { active: drawerHeightStyle !== "ascending" },
  );
  const resolved = resolveZones(input, o, innerH, "木");
  const { notesLine, warnings } = resolved;
  warnings.push(...lockWarnings);
  let zones = resolved.zones;
  // 傳統 ascending 比例：bottom > top，逐抽遞減（每抽都不一樣高）。
  // 把原本 3 zone × N drawer 的設定攤平成 (totalDrawers) zone × 1 drawer，
  // 每 zone 高度照 ratio 算 → caseFurniture 會在每 zone 邊界生 boundary 板。
  // zones[] 順序：i=0 為最底層（最大），i=N-1 為最頂層（最小）。
  if (drawerHeightStyle === "ascending") {
    const totalDrawers = ascendingDrawerCount; // 直接用 ascendingDrawerCount，不再讀 zones
    const cols = 1;
    if (totalDrawers >= 2) {
      // 線性插值：底層 1.4、頂層 0.8（傳統明清比例約 1.4 : 1）
      const R_MAX = 1.4;
      const R_MIN = 0.8;
      const ratios: number[] = [];
      for (let i = 0; i < totalDrawers; i++) {
        const t = i / (totalDrawers - 1);
        ratios.push(R_MAX - (R_MAX - R_MIN) * t);
      }
      const total = ratios.reduce((a, b) => a + b, 0);
      const heights = ratios.map((r) => Math.round(innerH * r / total));
      heights[0] += innerH - heights.reduce((a, b) => a + b, 0);
      zones = heights.map((h) => ({ type: "drawer" as const, heightMm: h, count: 1, cols }));
    }
  }

  const design = caseFurniture({
    category: "chest-of-drawers",
    nameZh: "斗櫃",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    shelfCount: 0,
    zones,
    panelThickness,
    shelfThickness: panelThickness,
    backMode: resolveBackMode(input, o),
    backPanelMaterial: backPanelPlywood ? "plywood" : "inherit",
    legHeight: effectiveLegHeight,
    legSize,
    legShape: legShape as "box" | "tapered" | "bracket" | "plinth" | "panel-side" | "round" | "round-tapered",
    legInset,
    drawerMount,
    drawerBottomMode: resolveDrawerBottomMode(input, o),
    drawerBottomThickness: resolveDrawerBottomThickness(input, o),
    drawerBoxJoinery: resolveDrawerBoxJoinery(input, o),
    drawerSlideGap: resolveDrawerSlideGap(input, o),
    pullStyle,
    notes: buildChestNotes({
      notesLine,
      legHeight, legShape, legInset,
      pullStyle, pullPosition,
      withToeKick: effectiveWithToeKick, toeKickHeight, toeKickRecess,
      withCrownMolding, crownProjection,
      drawerFaceStyle,
      drawerHeightStyle,
      withGalleryRail,
    }),
    warnings,
  });
  // 抽屜面板樣式：raised-panel → 在面板前面加一片凸出 6mm 的中央鑲板（雕花用）
  // 注意 inset+無滑軌 模式下沒有獨立 -face，由 -front 兼任 → fallback 找 -front
  if (drawerFaceStyle === "raised-panel") {
    // 找 drawer face：preferred 是 -face；inset+無滑軌時由 -front 兼任。
    // case-furniture 的 drawer idPrefix = "z{i+1}-drawer"，所以 ID 形如 "z1-drawer-1-face" 或 "z1-drawer-1-front"
    let faceParts = design.parts.filter((p) => /^z\d+-drawer-\d+-face$/.test(p.id));
    if (faceParts.length === 0) {
      faceParts = design.parts.filter((p) => /^z\d+-drawer-\d+-front$/.test(p.id));
    }
    // 邊框寬度：X / Y 不同，避免在矮抽屜上 Y 邊框吃掉整個面板
    //   padX = 35mm（橫向比較有空間）
    //   padY = min(20, fH/4)（短抽屜自動縮，避免凸板變負值）
    //
    // finger-pull + raised-panel 同開時：指槽位於 face 頂端下方 14mm，寬 25mm
    // → 頂部 0~27mm 範圍是指槽佔用區。raised panel 頂緣必須 ≥ 32mm（留 5mm 空隙）
    // 才不會覆蓋指槽。對小抽屜（fH<64mm），padY=fH/4 太小會把 raised panel 直接壓
    // 到指槽上 → 指槽從 -Z 看被 raised panel 邊框擋住。
    //
    // 解法：finger-pull 時用「不對稱 padding」—— top padding 強制 ≥ 32，bottom
    // padding 縮到 fH/8（最小 8），把 raised panel 整片下移避開指槽區。
    //
    // 另一個 bug：raised panel 後緣 z 跟 face 前緣 z **完全共面** → Three.js
    // z-fighting，指槽凹陷邊緣的 normal 被 raised panel 的後緣壓掉、看起來像
    // 沒挖。把 raised panel 整片再往 -Z 推 0.5mm（z_EPS）斷開共面。
    const raisedPanelT = 6;
    const Z_EPS = 0.5;
    for (const face of faceParts) {
      const fL = face.visible.length;
      const fH = face.visible.width;
      const fT = face.visible.thickness;
      const baseOrigin = face.origin;
      const baseRot = face.rotation;
      const padX = Math.min(35, fL / 4);
      // 對稱 padding：finger-pull 模式需要 ≥32mm 避開指槽，無 finger-pull 用 20mm
      const padY = pullStyle === "finger-pull"
        ? Math.min(32, fH / 3)
        : Math.min(20, fH / 4);
      const padYTop = padY;
      const padYBot = padY;
      const panelLen = Math.max(20, fL - 2 * padX);
      const panelH = Math.max(20, fH - padYTop - padYBot);
      // origin.y = face 底 + padYBot（rotation x=π/2 把 visible.width=panelH 映成 world Y）
      design.parts.push({
        id: `${face.id}-raised-panel`,
        nameZh: face.nameZh + " 中央凸鑲板",
        nameEn: (face.nameEn ?? face.nameZh) + " center raised panel",
        material: input.material,
        grainDirection: "length",
        visible: { length: panelLen, width: panelH, thickness: raisedPanelT },
        origin: { x: baseOrigin.x, y: baseOrigin.y + padYBot, z: baseOrigin.z - fT / 2 - raisedPanelT / 2 - Z_EPS },
        rotation: baseRot,
        tenons: [],
        mortises: [],
      });
      // 把對應抽屜的所有 pull 也往前推 raisedPanelT，免得被凸鑲板擋住
      // face.id 形如 "z1-1-face" 或 "z1-1-front"（inset 時）
      // pull id 慣例 = `${faceIdWithFace}-pull` 或 `-pull-plate` 等
      const facePullPrefix = face.id.endsWith("-face") ? face.id : face.id.replace(/-front$/, "-face");
      const drawerPulls = design.parts.filter((p) => p.id.startsWith(`${facePullPrefix}-pull`));
      for (const p of drawerPulls) {
        p.origin = { ...p.origin, z: p.origin.z - raisedPanelT };
      }
    }
  }

  // 把手位置：dual = 左右各 1 顆。複製現有 pull part，左右各偏移 25% face 寬。
  // 小面板（< 400mm）保持中央 1 顆（兩顆會擠在一起）。
  // drop-bail / ring-chinese 等多 part 把手要整組搬（plate+bail / plate+ring 共用 face）
  // → 用 face-id 分組，整組左右偏移，避免 plate 分裂但 bail/ring 留中央。
  if (pullPosition === "dual") {
    const pullParts = design.parts.filter((p) => /-face-pull(-plate|-bail|-ring)?$/.test(p.id));
    // 依 face id 分組
    const groups = new Map<string, typeof pullParts>();
    for (const p of pullParts) {
      const faceId = p.id.replace(/-pull(-plate|-bail|-ring)?$/, "");
      const arr = groups.get(faceId) ?? [];
      arr.push(p);
      groups.set(faceId, arr);
    }
    for (const [faceId, pulls] of groups) {
      const face = design.parts.find((p) => p.id === faceId)
        || design.parts.find((p) => p.id === faceId.replace(/-face$/, "-front"));
      if (!face) continue;
      const fW = face.visible.length;
      if (fW < 400) continue; // 太窄不分裂
      const dx = fW * 0.25;
      // 整組左移 dx；右側複製整組 +dx
      const rightCopies: typeof pulls = [];
      for (const pull of pulls) {
        const origX = pull.origin.x;
        const right: (typeof pull) = {
          ...pull,
          id: pull.id + "-R",
          nameZh: (pull.nameZh ?? "把手") + "（右）",
          nameEn: (pull.nameEn ?? "Pull") + " (right)",
          origin: { ...pull.origin, x: origX + dx },
        };
        rightCopies.push(right);
        // 修原 part 變左側
        pull.origin = { ...pull.origin, x: origX - dx };
        pull.id = pull.id + "-L";
        pull.nameZh = (pull.nameZh ?? "把手") + "（左）";
        pull.nameEn = (pull.nameEn ?? "Pull") + " (left)";
      }
      design.parts.push(...rightCopies);
    }
  }

  // 頂面圍欄：左右後三條（前面不裝，避免擋住擺放/取物視線）
  if (withGalleryRail) {
    const railH = 25;
    const railT = 12;
    const inset = Math.max(0, galleryInset);
    // 案頂 Y = input.height（caseFurniture 把頂板上緣對齊到這），圍欄從這往上 25mm
    const yTop = input.height;
    // back：縮在兩條側條之間
    const backLen = Math.max(50, input.length - 2 * inset - 2 * railT);
    design.parts.push({
      id: "gallery-back",
      nameZh: "頂面圍欄 後條",
      nameEn: "Gallery rail back",
      material: input.material,
      grainDirection: "length",
      visible: { length: backLen, width: railH, thickness: railT },
      origin: { x: 0, y: yTop, z: input.width / 2 - railT / 2 - inset },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
    // left/right：前端切齊頂板前緣（前面開放），後端對齊後條外側面
    const sideLen = Math.max(50, input.width - inset);
    const sideCenterZ = -inset / 2;
    for (const side of [-1, 1]) {
      design.parts.push({
        id: `gallery-${side > 0 ? "right" : "left"}`,
        nameZh: `頂面圍欄 ${side > 0 ? "右" : "左"}條`,
        nameEn: `Gallery rail ${side > 0 ? "right" : "left"}`,
        material: input.material,
        grainDirection: "length",
        visible: { length: sideLen, width: railH, thickness: railT },
        origin: { x: side * (input.length / 2 - railT / 2 - inset), y: yTop, z: sideCenterZ },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  applyStandardChecks(design, {
    minLength: 500, minWidth: 300, minHeight: 500,
    maxLength: 1300, maxWidth: 600, maxHeight: 1500,
  });
  appendWarnings(design, baseConflictWarnings);
  const useDrawerSlide = getOption<boolean>(input, opt(o, "useDrawerSlide"));
  // 從 zones 累加實際抽屜總數（count × cols），使用者把區段改成層板/門時數量會跟著變
  const actualDrawerCount = zones.reduce(
    (sum, z) => sum + (z.type === "drawer" ? (z.count ?? 0) * (z.cols ?? 1) : 0),
    0,
  );
  appendWarnings(
    design,
    validateCabinetStructure({
      panelThickness,
      height: input.height,
      shelfSpan: input.length - 2 * panelThickness,
      hasDrawers: actualDrawerCount > 0,
      drawerCount: actualDrawerCount,
      hasDrawerSlide: useDrawerSlide,
    }),
  );
  if (input.height > 1500) {
    appendSuggestion(design, {
      text: `櫃高 ${input.height}mm 已接近衣櫃尺寸——衣櫃模板有吊衣桿、長褲架等收納選項。`,
      suggestedCategory: "wardrobe",
      presetParams: { length: input.length, width: input.width, height: input.height, material: input.material },
    });
  }
  return design;
};

// 把超長 notes 字串拆成可讀 helper
function buildChestNotes(cfg: {
  notesLine: string;
  legHeight: number; legShape: string; legInset: number;
  pullStyle: string; pullPosition: string;
  withToeKick: boolean; toeKickHeight: number; toeKickRecess: number;
  withCrownMolding: boolean; crownProjection: number;
  drawerFaceStyle: string;
  drawerHeightStyle: string;
  withGalleryRail: boolean;
}): string {
  const parts: string[] = [cfg.notesLine];
  if (cfg.legHeight > 0) {
    parts.push(`底座加 ${cfg.legHeight}mm ${cfg.legShape} 腳${cfg.legInset > 0 ? `（內縮 ${cfg.legInset}mm）` : ""}`);
  }
  if (cfg.pullStyle && cfg.pullStyle !== "none") {
    parts.push(`${pullStyleNote(cfg.pullStyle)}${cfg.pullPosition === "dual" ? "（左右各 1 顆）" : ""}`);
  }
  const tk = toeKickNote(cfg.withToeKick, cfg.toeKickHeight, cfg.toeKickRecess);
  if (tk) parts.push(tk);
  const cm = crownMoldingNote(cfg.withCrownMolding, cfg.crownProjection);
  if (cm) parts.push(cm);
  if (cfg.drawerFaceStyle === "raised-panel") parts.push("抽屜面板採凸版（中央凸 6mm 雕花板）");
  if (cfg.drawerHeightStyle === "ascending") parts.push("抽屜高度下大上小（傳統明清比例 1.4 : 1.2 : 1）");
  if (cfg.withGalleryRail) parts.push("頂面加 25mm 高圍欄");
  return parts.filter(Boolean).join("；") + "。";
}
