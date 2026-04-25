/**
 * Core domain types for the furniture generator.
 *
 * Units: All dimensions in millimeters (mm). Never mix cm/inch.
 * Coordinate system: Right-handed, +X = length, +Y = height, +Z = depth.
 */

export type Millimeters = number;

export type FurnitureCategory =
  | "stool"
  | "bench"
  | "tea-table"
  | "low-table"
  | "side-table"
  | "open-bookshelf"
  | "chest-of-drawers"
  | "shoe-cabinet"
  | "display-cabinet"
  | "dining-table"
  | "desk"
  | "dining-chair"
  | "wardrobe"
  | "bar-stool"
  | "media-console"
  | "nightstand"
  | "round-stool"
  | "round-tea-table"
  | "round-table";

export type JoineryType =
  | "through-tenon"
  | "blind-tenon"
  | "shouldered-tenon"
  | "stub-joint"
  | "half-lap"
  | "dovetail"
  | "finger-joint"
  | "tongue-and-groove"
  | "dowel"
  | "mitered-spline"
  | "pocket-hole"
  | "screw";

export type TenonPosition =
  | "start"
  | "end"
  | "top"
  | "bottom"
  | "left"
  | "right";

export type GrainDirection = "length" | "width";

export interface Dimensions {
  length: Millimeters;
  width: Millimeters;
  thickness: Millimeters;
}

export interface Tenon {
  position: TenonPosition;
  type: JoineryType;
  length: Millimeters;
  width: Millimeters;
  thickness: Millimeters;
  shoulderOn?: Array<"top" | "bottom" | "left" | "right">;
}

export interface Mortise {
  origin: { x: Millimeters; y: Millimeters; z: Millimeters };
  depth: Millimeters;
  length: Millimeters;
  width: Millimeters;
  through: boolean;
}

export type MaterialId =
  // 實木
  | "taiwan-cypress"
  | "teak"
  | "white-oak"
  | "walnut"
  | "douglas-fir"
  | "maple"
  | "ash"
  | "beech"
  | "pine"
  // 板材（裝潢常用）— 跟 SheetGood 重疊但這裡作為「主材質」用
  | "blockboard-primary"
  | "plywood-primary"
  | "mdf-primary";

/** 板材類（計價用，不參與 3D 渲染與紋理） */
export type SheetGood = "plywood" | "mdf";

/** 計價單位：實木或板材 */
export type BillableMaterial = MaterialId | SheetGood;

export interface Part {
  id: string;
  nameZh: string;
  material: MaterialId;
  grainDirection: GrainDirection;

  visible: Dimensions;

  origin: { x: Millimeters; y: Millimeters; z: Millimeters };
  rotation?: { x: number; y: number; z: number };

  tenons: Tenon[];
  mortises: Mortise[];

  /**
   * 計價材質覆寫——零件實際使用板材（背板夾板、抽屜底板等）時用。
   * 渲染仍用 `material`（主木色），只影響單價計算。
   */
  materialOverride?: SheetGood;

  /**
   * 視覺渲染提示——影響 3D / 材料單 / 報價：
   * - "glass"：半透明玻璃，不計才、不進材料單、不進 CSV
   */
  visual?: "glass";

  /**
   * Visual shape hint used by renderers. Default "box". "tapered" narrows
   * toward the bottom (top face = visible dims, bottom face scaled by
   * `shape.bottomScale`). Geometry/material calculations still use the
   * upper/visible dimensions — this is purely a rendering override for
   * illustrating leg styles.
   */
  shape?:
    | { kind: "box" }
    /** Tapered: scale the bottom face relative to top. bottomScale > 1 = 倒錐
     *  (wider at bottom), bottomScale < 1 = 方錐漸縮 (narrower at bottom). */
    | { kind: "tapered"; bottomScale: number }
    /** Splayed: whole leg tilts so the bottom is offset in (dxMm, dzMm) from
     *  the top in the part's LOCAL frame. Positive values → bottom shifts
     *  toward +x/+z of the leg. */
    | { kind: "splayed"; dxMm: number; dzMm: number }
    /** Hoof: straight for most of the length, then flares outward over the
     *  bottom `hoofMm` by a factor of `hoofScale`. hoofScale > 1 widens. */
    | { kind: "hoof"; hoofMm: number; hoofScale: number }
    /** Round disc / 圓柱腳：直徑 = length = width，厚 = thickness。
     *  3D 用 cylinder，俯視圓、前/側視矩形。Cut plan 以方料 D×D 計算。 */
    | { kind: "round" }
    /** Round tapered: 圓錐腳。bottomScale < 1 = 上粗下細；> 1 = 上細下粗。
     *  3D 用 cylinder(topR, bottomR, height)；前/側視梯形。 */
    | { kind: "round-tapered"; bottomScale: number }
    /** Shaker: 夏克風腳。上方 25% 方料 + 下方 75% 圓錐腳（bottomScale 0.6）。
     *  經典實木家具腳形，兼顧結構（方頂接牙板）與優雅（圓錐落地）。 */
    | { kind: "shaker" }
    /** Splayed tapered: 外斜方錐腳——方料漸縮 + 整支外傾（底部偏移 dxMm/dzMm）。
     *  bottomScale < 1 上粗下細；> 1 上細下粗（搭配外斜常見：上細下粗 + splay = 倒角桶腳） */
    | { kind: "splayed-tapered"; bottomScale: number; dxMm: number; dzMm: number }
    /** Splayed round tapered: 外斜圓錐腳——圓料漸縮 + 整支外傾。
     *  bottomScale < 1 = 外斜圓錐；> 1 = 外斜倒圓錐 */
    | {
        kind: "splayed-round-tapered";
        bottomScale: number;
        dxMm: number;
        dzMm: number;
      }
    /** Apron trapezoid: 牙條/橫撐梯形（上窄下寬或反之），用於外斜腳家具。
     *  讓 apron 的 length 軸在頂端 (local z=-width/2) 縮為 length×topScale，
     *  在底端 (local z=+width/2) 縮為 length×bottomScale。對齊外斜腳中心軸。 */
    | {
        kind: "apron-trapezoid";
        topLengthScale: number;
        bottomLengthScale: number;
      }
    /** Apron beveled: 牙條上下緣切斜面，配合外斜腳家具的 apron tilt。
     *  本體仍是矩形截面，但 local z 方向 shear 量 = -y × tan(bevelAngle)。
     *  bevelAngle = 牙條補償用的「繞 local X 軸的旋轉量」(signed radians)。
     *  套用後上下緣面在 world 中保持水平 → 可貼緊椅面 / 地面。 */
    | { kind: "apron-beveled"; bevelAngle: number };
}

export interface FurnitureDesign {
  id: string;
  category: FurnitureCategory;
  nameZh: string;

  overall: Dimensions;
  parts: Part[];

  defaultJoinery: JoineryType;
  primaryMaterial: MaterialId;

  notes?: string;
  /** 設計參數不合理時（例如下層高度超過可用內高）自動產生的警告 */
  warnings?: string[];
}

export interface FurnitureTemplateInput {
  length: Millimeters;
  width: Millimeters;
  height: Millimeters;
  material: MaterialId;
  joinery?: JoineryType;
  options?: Record<string, string | number | boolean>;
}

export type FurnitureTemplate = (input: FurnitureTemplateInput) => FurnitureDesign;

/**
 * Per-template customization options (rendered in the design page form).
 * Templates declare their schema via FurnitureCatalogEntry.options and read
 * values from FurnitureTemplateInput.options at build time.
 */
/** Logical group for rendering — options with the same group cluster together. */
export type OptionGroup =
  | "structure"
  | "leg"
  | "top"
  | "apron"
  | "stretcher"
  | "drawer"
  | "door"
  | "back"
  | "misc"
  // 三層櫃體：上中下
  | "zone-top"
  | "zone-mid"
  | "zone-bot"
  // 三欄櫃體：左中右
  | "col-left"
  | "col-mid"
  | "col-right";

/** Only show this option when the referenced option has a matching value. */
export interface OptionDependency {
  key: string;
  /** If omitted, "truthy value" is enough (e.g. checkbox = true / select = any non-empty). */
  equals?: string | number | boolean;
}

export type OptionSpec =
  | {
      type: "number";
      key: string;
      label: string;
      defaultValue: number;
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
      help?: string;
      group?: OptionGroup;
      dependsOn?: OptionDependency;
    }
  | {
      type: "select";
      key: string;
      label: string;
      defaultValue: string;
      choices: Array<{ value: string; label: string }>;
      help?: string;
      group?: OptionGroup;
      dependsOn?: OptionDependency;
    }
  | {
      type: "checkbox";
      key: string;
      label: string;
      defaultValue: boolean;
      help?: string;
      group?: OptionGroup;
      dependsOn?: OptionDependency;
      /** 佔整行寬度（不擠 grid 欄位）— 適合 help 文字較長的選項 */
      wide?: boolean;
    };

/** Look up an option spec by its key (so templates don't break when order changes). */
export function opt(schema: OptionSpec[], key: string): OptionSpec {
  const found = schema.find((s) => s.key === key);
  if (!found) throw new Error(`option spec not found: ${key}`);
  return found;
}

export function getOption<T extends string | number | boolean>(
  input: FurnitureTemplateInput,
  spec: OptionSpec,
): T {
  const raw = input.options?.[spec.key];
  if (raw === undefined) return spec.defaultValue as T;
  if (spec.type === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    return (Number.isFinite(n) ? n : spec.defaultValue) as T;
  }
  if (spec.type === "checkbox") {
    if (typeof raw === "boolean") return raw as T;
    return (raw === "true" || raw === "on" || raw === "1") as T;
  }
  return (typeof raw === "string" ? raw : spec.defaultValue) as T;
}
