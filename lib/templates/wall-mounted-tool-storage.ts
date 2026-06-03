import type { FurnitureTemplate, OptionSpec, OptionDependency, Part, MaterialId } from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { applyStandardChecks } from "./_validators";

/**
 * 木工工具牆（wall-mounted tool storage）— 壁掛、無腳、貼牆。
 *
 * 混合型可自訂分區：上 / 中 / 下三帶，每帶獨立選
 *   - shelf  開放層板（兩側立板 + N 片層板）
 *   - cleat  法式斜切條牆（背板上釘 N 條水平 french-cleat）
 *   - rail   掛桁 + 掛鉤橫桿
 * 另可附 3 種通用工具座（鑿刀座 / 平台架 / 掛鉤條），用 lower cleat 倒扣咬在牆條上。
 *
 * 座標：X = 牆面水平（length），Y = 高（0 在地、往上到 height），Z = 深度
 *       （房間/前 = -Z，牆 = +Z，沿用 case-furniture 慣例）。
 * 軸向約定：一般方料 visible.length→X、visible.thickness→Y、visible.width→Z（免旋轉）。
 *           cleat 例外——shape 截面固定 (thickness=Y, width=Z)，要 rotation x=-90°
 *           才能把「凸出量→Z 深度、條高→Y 上下」擺正（3D 與三視圖同步，因共用截面）。
 */

const CLEAT_ROT = { x: -Math.PI / 2, y: 0, z: 0 } as const;

// 任一帶設成某型時才顯示的 dependsOn
const anyZoneIs = (value: string): OptionDependency => ({
  any: [
    { key: "topType", equals: value },
    { key: "midType", equals: value },
    { key: "bottomType", equals: value },
  ],
});
const ANY_ZONE_IS_CLEAT = anyZoneIs("cleat");
const ANY_ZONE_IS_SHELF = anyZoneIs("shelf");
const ANY_ZONE_IS_RAIL = anyZoneIs("rail");

const ZONE_TYPE_CHOICES = [
  { value: "cleat", label: "法式斜切條牆" },
  { value: "shelf", label: "開放層板" },
  { value: "rail", label: "掛桁 + 掛鉤" },
];

export const wallMountedToolStorageOptions: OptionSpec[] = [
  // ── 整體結構 ──
  { group: "structure", type: "number", key: "backThickness", label: "背板厚", defaultValue: 18, unit: "mm", min: 12, max: 30, step: 1, help: "整片背板，鎖在牆上" },
  // ── 三帶 ──
  { group: "zone-top", type: "select", key: "topType", label: "上帶類型", defaultValue: "shelf", choices: ZONE_TYPE_CHOICES, wide: true },
  { group: "zone-top", type: "number", key: "topHeight", label: "上帶高度", defaultValue: 450, unit: "mm", min: 100, max: 1500, step: 10 },
  { group: "zone-top", type: "number", key: "topShelfCount", label: "上帶層板數", defaultValue: 2, min: 1, max: 6, step: 1, dependsOn: { key: "topType", equals: "shelf" } },
  { group: "zone-mid", type: "select", key: "midType", label: "中帶類型（自動填滿剩餘高度）", defaultValue: "cleat", choices: ZONE_TYPE_CHOICES, wide: true },
  { group: "zone-mid", type: "number", key: "midShelfCount", label: "中帶層板數", defaultValue: 3, min: 1, max: 8, step: 1, dependsOn: { key: "midType", equals: "shelf" } },
  { group: "zone-bot", type: "select", key: "bottomType", label: "下帶類型", defaultValue: "rail", choices: ZONE_TYPE_CHOICES, wide: true },
  { group: "zone-bot", type: "number", key: "bottomHeight", label: "下帶高度", defaultValue: 250, unit: "mm", min: 100, max: 1500, step: 10 },
  { group: "zone-bot", type: "number", key: "bottomShelfCount", label: "下帶層板數", defaultValue: 1, min: 1, max: 6, step: 1, dependsOn: { key: "bottomType", equals: "shelf" } },
  // ── 斜切條（任一帶 = cleat 才顯示）──
  { group: "structure", type: "number", key: "cleatPitch", label: "斜切條間距", defaultValue: 120, unit: "mm", min: 60, max: 300, step: 10, help: "每帶從下往上每隔此距離放一條牆條", dependsOn: ANY_ZONE_IS_CLEAT },
  { group: "structure", type: "number", key: "cleatHeight", label: "斜切條料寬（高）", defaultValue: 60, unit: "mm", min: 40, max: 120, step: 5, dependsOn: ANY_ZONE_IS_CLEAT },
  { group: "structure", type: "number", key: "cleatThickness", label: "斜切條料厚（凸出）", defaultValue: 18, unit: "mm", min: 12, max: 25, step: 1, dependsOn: ANY_ZONE_IS_CLEAT },
  { group: "structure", type: "checkbox", key: "includeSampleTools", label: "附示範工具座（鑿刀座 / 平台架 / 掛鉤條）", defaultValue: true, wide: true, dependsOn: ANY_ZONE_IS_CLEAT },
  // ── 層板 ──
  { group: "structure", type: "number", key: "shelfThickness", label: "層板厚", defaultValue: 18, unit: "mm", min: 12, max: 30, step: 1, dependsOn: ANY_ZONE_IS_SHELF },
  // ── 掛桁 ──
  { group: "structure", type: "number", key: "railHookCount", label: "每帶掛鉤數", defaultValue: 5, min: 2, max: 16, step: 1, dependsOn: ANY_ZONE_IS_RAIL },
];

type ZoneType = "shelf" | "cleat" | "rail";

export const wallMountedToolStorage: FurnitureTemplate = (input) => {
  const locale = input.locale ?? "zh-TW";
  const isEn = locale === "en";
  const o = wallMountedToolStorageOptions;
  const W = input.length;       // 牆面水平寬
  const H = input.height;       // 牆面高
  const depth = input.width;    // 深度（層板伸出量）

  const backT = getOption<number>(input, opt(o, "backThickness"));
  const topType = getOption<string>(input, opt(o, "topType")) as ZoneType;
  const midType = getOption<string>(input, opt(o, "midType")) as ZoneType;
  const bottomType = getOption<string>(input, opt(o, "bottomType")) as ZoneType;
  const topH = getOption<number>(input, opt(o, "topHeight"));
  const bottomH = getOption<number>(input, opt(o, "bottomHeight"));
  const topShelfCount = getOption<number>(input, opt(o, "topShelfCount"));
  const midShelfCount = getOption<number>(input, opt(o, "midShelfCount"));
  const bottomShelfCount = getOption<number>(input, opt(o, "bottomShelfCount"));
  const cleatPitch = getOption<number>(input, opt(o, "cleatPitch"));
  const cleatHeight = getOption<number>(input, opt(o, "cleatHeight"));
  const cleatThickness = getOption<number>(input, opt(o, "cleatThickness"));
  const includeSampleTools = getOption<boolean>(input, opt(o, "includeSampleTools"));
  const shelfT = getOption<number>(input, opt(o, "shelfThickness"));
  const railHookCount = getOption<number>(input, opt(o, "railHookCount"));

  const warnings: string[] = [];
  const parts: Part[] = [];
  const material = input.material;

  // 深度基準面：背板貼牆（+Z 最後面），前面（房間側 -Z）= 掛載基準面 mountZ
  const wallZ = depth / 2;                 // 背板後face（貼牆）
  const mountZ = wallZ - backT;            // 背板前face = cleat / 層板掛載面
  const backCenterZ = wallZ - backT / 2;

  // ── 背板（整片，貼牆）──
  parts.push({
    id: "back",
    nameZh: "背板",
    nameEn: "Back panel",
    material,
    grainDirection: "length",
    visible: { length: W, width: backT, thickness: H },
    origin: { x: 0, y: 0, z: backCenterZ },
    tenons: [],
    mortises: [],
  });

  // ── 三帶 Y 範圍：下 [0,botH] / 中 [botH, botH+midH] / 上 [botH+midH, H] ──
  const midH = Math.max(80, H - topH - bottomH);
  if (H - topH - bottomH < 80) {
    warnings.push(
      isEn
        ? `Top + bottom band (${topH}+${bottomH}mm) leaves too little for the middle band; middle clamped to 80mm.`
        : `上帶 + 下帶（${topH}+${bottomH}mm）擠掉中帶空間，中帶已壓到最小 80mm。`,
    );
  }
  const bands: Array<{ name: string; nameEn: string; idp: string; type: ZoneType; y0: number; y1: number; shelfCount: number }> = [
    { name: "下帶", nameEn: "lower", idp: "zbot", type: bottomType, y0: 0, y1: bottomH, shelfCount: bottomShelfCount },
    { name: "中帶", nameEn: "mid", idp: "zmid", type: midType, y0: bottomH, y1: bottomH + midH, shelfCount: midShelfCount },
    { name: "上帶", nameEn: "upper", idp: "ztop", type: topType, y0: bottomH + midH, y1: H, shelfCount: topShelfCount },
  ];

  // upper cleat 收集（給工具座掛載）
  const upperCleats: Array<{ y: number; bandIdp: string }> = [];

  for (const band of bands) {
    const bandH = band.y1 - band.y0;
    if (bandH < 30) continue;
    if (band.type === "shelf") {
      buildShelfBand(parts, band, { W, depth, mountZ, shelfT, material, isEn });
    } else if (band.type === "cleat") {
      buildCleatBand(parts, band, upperCleats, { W, mountZ, cleatPitch, cleatHeight, cleatThickness, material, isEn });
    } else {
      buildRailBand(parts, band, { W, depth, mountZ, railHookCount, material, isEn });
    }
  }

  // ── 示範工具座：掛在前幾條 upper cleat 上 ──
  if (includeSampleTools && upperCleats.length > 0) {
    const holders = ["chisel", "shelf", "hook"] as const;
    // 由上往下選不同的牆條，平均分散
    const sorted = [...upperCleats].sort((a, b) => b.y - a.y);
    holders.forEach((kind, i) => {
      const target = sorted[Math.min(i, sorted.length - 1)];
      if (!target) return;
      // 水平錯開避免重疊：左 / 中 / 右
      const xCenter = (i - 1) * Math.min(360, W / 3.2);
      buildToolHolder(parts, kind, target.y, xCenter, {
        mountZ, cleatHeight, cleatThickness, material, isEn,
      });
    });
  }

  const notes = isEn
    ? `Wall-mounted tool storage, ${W}×${H}mm, ${depth}mm deep. Three bands — lower: ${bandLabelEn(bottomType)}, middle: ${bandLabelEn(midType)}, upper: ${bandLabelEn(topType)}. French cleats ripped at 45° interlock; holders hang on the lower-cleat half.`
    : `木工工具牆，${W}×${H}mm、深 ${depth}mm。三帶——下：${bandLabel(bottomType)}、中：${bandLabel(midType)}、上：${bandLabel(topType)}。法式斜切條 45° 縱剖互鎖，工具座靠 lower cleat 倒扣掛上。`;

  const design = {
    id: "wall-mounted-tool-storage",
    category: "wall-mounted-tool-storage" as const,
    nameZh: "木工工具牆",
    overall: { length: W, width: depth, thickness: H },
    parts,
    defaultJoinery: "screw" as const,
    primaryMaterial: material,
    notes,
    warnings,
  };

  applyStandardChecks(design, {
    minLength: 300, minWidth: 80, minHeight: 300,
    maxLength: 2400, maxWidth: 400, maxHeight: 2000,
  });
  return design;
};

function bandLabel(t: ZoneType): string {
  return t === "shelf" ? "開放層板" : t === "cleat" ? "法式斜切條牆" : "掛桁掛鉤";
}
function bandLabelEn(t: ZoneType): string {
  return t === "shelf" ? "open shelves" : t === "cleat" ? "French cleat wall" : "rail & hooks";
}

// ── 層板帶：兩側立板 + N 片層板 ──
function buildShelfBand(
  parts: Part[],
  band: { name: string; nameEn: string; idp: string; y0: number; y1: number; shelfCount: number },
  ctx: { W: number; depth: number; mountZ: number; shelfT: number; material: MaterialId; isEn: boolean },
) {
  const { W, depth, mountZ, shelfT, material } = ctx;
  const bandH = band.y1 - band.y0;
  const sideT = shelfT;
  const shelfDepth = depth - 10;
  const shelfZ = mountZ - shelfDepth / 2;
  // 兩側立板（thin in X）
  for (const sx of [-1, 1] as const) {
    parts.push({
      id: `${band.idp}-side-${sx < 0 ? "left" : "right"}`,
      nameZh: `${band.name}側立板（${sx < 0 ? "左" : "右"}）`,
      nameEn: `${band.nameEn} side panel (${sx < 0 ? "left" : "right"})`,
      material,
      grainDirection: "length",
      visible: { length: sideT, width: shelfDepth, thickness: bandH },
      origin: { x: sx * (W / 2 - sideT / 2), y: band.y0, z: shelfZ },
      tenons: [],
      mortises: [],
    });
  }
  // N 片層板（含頂底，等距）
  const n = Math.max(1, band.shelfCount);
  const innerW = W - 2 * sideT;
  for (let i = 0; i <= n; i++) {
    const y = band.y0 + (bandH - shelfT) * (i / n);
    parts.push({
      id: `${band.idp}-shelf-${i + 1}`,
      nameZh: `${band.name}層板 ${i + 1}`,
      nameEn: `${band.nameEn} shelf ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: innerW, width: shelfDepth, thickness: shelfT },
      origin: { x: 0, y, z: shelfZ },
      tenons: [],
      mortises: [],
    });
  }
}

// ── 斜切條帶：N 條水平 french-cleat(upper) ──
function buildCleatBand(
  parts: Part[],
  band: { name: string; nameEn: string; idp: string; y0: number; y1: number },
  upperCleats: Array<{ y: number; bandIdp: string }>,
  ctx: { W: number; mountZ: number; cleatPitch: number; cleatHeight: number; cleatThickness: number; material: MaterialId; isEn: boolean },
) {
  const { W, mountZ, cleatPitch, cleatHeight, cleatThickness, material } = ctx;
  const bandH = band.y1 - band.y0;
  const margin = 20;
  const cleatLen = W - 2 * margin;
  const cleatZ = mountZ - cleatThickness / 2; // 牆條背面貼背板前面
  const n = Math.max(1, Math.floor((bandH - cleatHeight) / cleatPitch) + 1);
  for (let i = 0; i < n; i++) {
    const y = band.y0 + cleatHeight / 2 + (n === 1 ? (bandH - cleatHeight) / 2 : i * cleatPitch);
    if (y + cleatHeight / 2 > band.y1 + 1) break;
    parts.push({
      id: `${band.idp}-cleat-${i + 1}`,
      nameZh: `${band.name}牆條 ${i + 1}`,
      nameEn: `${band.nameEn} wall cleat ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: cleatLen, thickness: cleatThickness, width: cleatHeight },
      origin: { x: 0, y, z: cleatZ },
      rotation: CLEAT_ROT,
      shape: { kind: "french-cleat", bevelAngle: Math.PI / 4, orientation: "upper" },
      tenons: [],
      mortises: [],
    });
    upperCleats.push({ y, bandIdp: band.idp });
  }
}

// ── 掛桁帶：頂端一根橫桁 + 等距掛鉤 ──
function buildRailBand(
  parts: Part[],
  band: { name: string; nameEn: string; idp: string; y0: number; y1: number },
  ctx: { W: number; depth: number; mountZ: number; railHookCount: number; material: MaterialId; isEn: boolean },
) {
  const { W, mountZ, railHookCount, material } = ctx;
  const railT = 30;
  const railY = band.y1 - railT - 10;
  const railZ = mountZ - 25;
  parts.push({
    id: `${band.idp}-rail`,
    nameZh: `${band.name}掛桁`,
    nameEn: `${band.nameEn} hanging rail`,
    material,
    grainDirection: "length",
    visible: { length: W - 40, width: 40, thickness: railT },
    origin: { x: 0, y: railY, z: railZ },
    tenons: [],
    mortises: [],
  });
  // 掛鉤（圓棒，朝下伸出）
  const n = Math.max(2, railHookCount);
  const span = W - 120;
  const hookLen = Math.min(80, (band.y1 - band.y0) * 0.4);
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span * i) / (n - 1);
    parts.push({
      id: `${band.idp}-hook-${i + 1}`,
      nameZh: `${band.name}掛鉤 ${i + 1}`,
      nameEn: `${band.nameEn} hook ${i + 1}`,
      material,
      grainDirection: "length",
      visible: { length: 16, width: 16, thickness: hookLen },
      origin: { x, y: railY - hookLen, z: railZ - 20 },
      shape: { kind: "round" },
      tenons: [],
      mortises: [],
    });
  }
}

// ── 通用工具座：lower cleat（倒扣）+ 機能件 ──
function buildToolHolder(
  parts: Part[],
  kind: "chisel" | "shelf" | "hook",
  cleatY: number,
  xCenter: number,
  ctx: { mountZ: number; cleatHeight: number; cleatThickness: number; material: MaterialId; isEn: boolean },
) {
  const { mountZ, cleatHeight, cleatThickness, material } = ctx;
  const holderW = kind === "shelf" ? 250 : kind === "chisel" ? 300 : 320;
  // lower cleat 掛在牆條前方（更靠房間 -Z），倒扣咬合
  const lowerCleatZ = mountZ - cleatThickness * 1.5;
  const cleatId = `tool-${kind}-cleat`;
  parts.push({
    id: cleatId,
    nameZh: `${holderNameZh(kind)}掛條`,
    nameEn: `${holderNameEn(kind)} cleat`,
    material,
    grainDirection: "length",
    visible: { length: holderW, thickness: cleatThickness, width: cleatHeight },
    origin: { x: xCenter, y: cleatY, z: lowerCleatZ },
    rotation: CLEAT_ROT,
    shape: { kind: "french-cleat", bevelAngle: Math.PI / 4, orientation: "lower" },
    tenons: [],
    mortises: [],
  });
  // 機能件前緣 z（再往房間側 -Z）
  const frontZ = lowerCleatZ - cleatThickness;

  if (kind === "shelf") {
    // 平台架：水平層板 + 兩側三角托（right-triangle）
    const plateDepth = 150;
    const plateT = 15;
    const plateY = cleatY - cleatHeight / 2;
    const plateZ = frontZ - plateDepth / 2;
    parts.push({
      id: "tool-shelf-plate",
      nameZh: "平台架層板",
      nameEn: "Shelf bracket plate",
      material,
      grainDirection: "length",
      visible: { length: holderW, width: plateDepth, thickness: plateT },
      origin: { x: xCenter, y: plateY, z: plateZ },
      tenons: [],
      mortises: [],
    });
    for (const sx of [-1, 1] as const) {
      parts.push({
        id: `tool-shelf-bracket-${sx < 0 ? "left" : "right"}`,
        nameZh: `平台架三角托（${sx < 0 ? "左" : "右"}）`,
        nameEn: `Shelf bracket gusset (${sx < 0 ? "left" : "right"})`,
        material,
        grainDirection: "length",
        visible: { length: 15, width: plateDepth, thickness: cleatHeight },
        origin: { x: xCenter + sx * (holderW / 2 - 15), y: plateY - cleatHeight, z: plateZ },
        // right-triangle 在 X-Z 平面切角；直角在後上方
        shape: { kind: "right-triangle", corner: "+x-z" },
        tenons: [],
        mortises: [],
      });
    }
  } else if (kind === "chisel") {
    // 鑿刀座：前擋板 + 底托（插孔用 cosmetic mortise）
    const frontH = 70;
    const frontT = 18;
    const baseDepth = 90;
    const topY = cleatY - cleatHeight / 2;
    const baseY = topY - frontH;
    const baseZ = frontZ - baseDepth / 2;
    // 底托
    parts.push({
      id: "tool-chisel-base",
      nameZh: "鑿刀座底托",
      nameEn: "Chisel holder base",
      material,
      grainDirection: "length",
      visible: { length: holderW, width: baseDepth, thickness: 15 },
      origin: { x: xCenter, y: baseY, z: baseZ },
      tenons: [],
      mortises: [],
    });
    // 前擋板（含一排插孔）
    const holeCount = Math.max(3, Math.floor(holderW / 45));
    const mortises = Array.from({ length: holeCount }, (_, h) => {
      const hx = -holderW / 2 + (holderW * (h + 0.5)) / holeCount;
      return {
        origin: { x: hx, y: 0, z: 0 },
        depth: 12,
        length: 22,
        width: 22,
        through: true as const,
        shape: "round" as const,
        cosmetic: true as const,
      };
    });
    parts.push({
      id: "tool-chisel-front",
      nameZh: "鑿刀座前擋板",
      nameEn: "Chisel holder front board",
      material,
      grainDirection: "length",
      visible: { length: holderW, width: frontT, thickness: frontH },
      // 立在底托上方（y = baseY + 底托厚 15），不與底托重疊；貼後緣當擋板
      origin: { x: xCenter, y: baseY + 15, z: frontZ - baseDepth + frontT / 2 },
      tenons: [],
      mortises,
    });
  } else {
    // 掛鉤條：橫木條 + N 個圓掛鉤
    const stripT = 22;
    const stripH = 40;
    const stripY = cleatY - cleatHeight / 2 - stripH;
    parts.push({
      id: "tool-hook-strip",
      nameZh: "掛鉤條橫木",
      nameEn: "Hook strip bar",
      material,
      grainDirection: "length",
      visible: { length: holderW, width: stripT, thickness: stripH },
      origin: { x: xCenter, y: stripY, z: frontZ - stripT / 2 },
      tenons: [],
      mortises: [],
    });
    const n = 4;
    for (let i = 0; i < n; i++) {
      const hx = xCenter - holderW / 2 + (holderW * (i + 0.5)) / n;
      parts.push({
        id: `tool-hook-peg-${i + 1}`,
        nameZh: `掛鉤 ${i + 1}`,
        nameEn: `Hook peg ${i + 1}`,
        material,
        grainDirection: "length",
        visible: { length: 14, width: 14, thickness: 55 },
        origin: { x: hx, y: stripY - 55, z: frontZ - stripT - 5 },
        shape: { kind: "round" },
        tenons: [],
        mortises: [],
      });
    }
  }
}

function holderNameZh(kind: "chisel" | "shelf" | "hook"): string {
  return kind === "chisel" ? "鑿刀座" : kind === "shelf" ? "平台架" : "掛鉤條";
}
function holderNameEn(kind: "chisel" | "shelf" | "hook"): string {
  return kind === "chisel" ? "Chisel holder" : kind === "shelf" ? "Shelf bracket" : "Hook strip";
}
