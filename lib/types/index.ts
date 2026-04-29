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
  | "round-table"
  // 小物件 (accessories)
  | "pencil-holder"
  | "bookend"
  | "photo-frame"
  | "tray"
  | "dovetail-box"
  | "wine-rack"
  | "coat-rack";

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
   * 拼板片數——大面板（桌面、座板）實際買料要按片計，例如 600mm 寬桌面
   * 通常拼 3 片 200mm 寬實木。設 > 1 時：
   * - 材料單顯示 "×N" 並把 width 切成 N 等份
   * - 裁切計算器把這個零件展開成 N 個小片
   * - 3D / 報價總材積不變（同一塊概念面板）
   */
  panelPieces?: number;

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
     *  toward +x/+z of the leg.
     *  chamferMm / chamferStyle 可選——讓外斜腳同時帶 4 條長邊倒角。 */
    | { kind: "splayed"; dxMm: number; dzMm: number; chamferMm?: number; chamferStyle?: "chamfered" | "rounded" }
    /** Hoof: 明式馬蹄腳——直料 + 底部「外側」2 面以 S 形外撇形成腳趾。
     *  hoofMm = 馬蹄區段高度（從底部往上算）
     *  hoofScale = 外側面 flare 倍率（>1 = 外撇，傳統 ~1.3）
     *  dirX/dirZ ∈ {-1, 0, +1}：外側方向。一般四角腳取自 sign(c.x)/sign(c.z)，
     *  讓馬蹄都朝家具外側「踢出去」。0 = 該軸不外撇（中柱腳用）。
     *  渲染分 4 段：straight body → 外緣轉 (S 上半) → 內凹收腰 → 外撇腳趾 (S 下半)。
     *  舊資料沒帶 dirX/dirZ → fallback 對稱 4 面外擴（僅相容用，視覺較差）。 */
    | { kind: "hoof"; hoofMm: number; hoofScale: number; dirX?: -1 | 0 | 1; dirZ?: -1 | 0 | 1 }
    /** Round disc / 圓柱腳：直徑 = length = width，厚 = thickness。
     *  3D 用 cylinder，俯視圓、前/側視矩形。Cut plan 以方料 D×D 計算。
     *  chamferMm > 0：頂面外緣倒角（圓凳座板用），3D 改用 lathe geometry，
     *  前/側視多兩個斜切角。 */
    | { kind: "round"; chamferMm?: number; chamferStyle?: "chamfered" | "rounded" }
    /** Round tapered: 圓錐腳。bottomScale < 1 = 上粗下細；> 1 = 上細下粗。
     *  3D 用 cylinder(topR, bottomR, height)；前/側視梯形。 */
    | { kind: "round-tapered"; bottomScale: number }
    /** Shaker: 夏克風腳。上方 squareFrac 方料 + 下方圓錐腳（bottomScale）。
     *  默認 squareFrac=0.25, bottomScale=0.6。
     *  「胖夏克」可用 squareFrac=0.4, bottomScale=0.75（方頂占比大、收斂少）。 */
    | { kind: "shaker"; squareFrac?: number; bottomScale?: number }
    /** Lathe-turned: 車旋腳——多段圓柱組合（上頸圈 + 主桿 + 下頸圈 + 球節）。
     *  整支沿 Y 軸切若干段，每段是不同半徑的圓柱，視覺上像車床車出來的腳。
     *  半徑全部以 legSize/2 為基準，每段相對縮放 + 高度比例。 */
    | { kind: "lathe-turned" }
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
     *  在底端 (local z=+width/2) 縮為 length×bottomScale。對齊外斜腳中心軸。
     *  bevelAngle 可選——同時做梯形 + 傾角，用於對稱外斜（X+Z 都外）腳。 */
    | {
        kind: "apron-trapezoid";
        topLengthScale: number;
        bottomLengthScale: number;
        bevelAngle?: number;
      }
    /** Apron beveled: 牙條上下緣切斜面，配合外斜腳家具的 apron tilt。
     *  本體仍是矩形截面，但 local z 方向 shear 量 = -y × tan(bevelAngle)。
     *  bevelAngle = 牙條補償用的「繞 local X 軸的旋轉量」(signed radians)。
     *  套用後上下緣面在 world 中保持水平 → 可貼緊椅面 / 地面。 */
    | { kind: "apron-beveled"; bevelAngle: number }
    /** Chamfered top: 板狀零件（座板 / 桌面）的頂緣 4 邊倒角。
     *  chamferMm = 從外緣往內倒掉的水平距離（=== 從頂面往下倒掉的垂直距離）。
     *  視覺上頂面變小一點點、外側多一個 45° 斜邊。
     *  rounded R5/R12 也用這個 shape，差別在 chamferMm（5 vs 12）。
     *  bottomChamferMm > 0：底面 4 邊也倒角（腳內縮時座板下緣外露才用得到）。 */
    | { kind: "chamfered-top"; chamferMm: number; bottomChamferMm?: number; style?: "chamfered" | "rounded" }
    /** Chamfered long edges：4 條沿最長軸的角線各倒 45° 角或圓角。
     *  腳（length=legSize × width=legSize × thickness=legHeight，最長軸 = thickness=Y）
     *  橫撐（length=長 × width × thickness，最長軸 = length=X）
     *  style="chamfered"（45°）→ cross-section 八角形
     *  style="rounded"（圓角）→ 多段 chamfer 拼出近似圓弧 */
    | { kind: "chamfered-edges"; chamferMm: number; style?: "chamfered" | "rounded" }
    /** Live edge 板狀零件——桌面長邊用 sin 組合 noise 做不規則波浪，
     *  模擬保留樹皮的原木板。amplitudeMm = 波幅（±值），預設 12mm。
     *  跟 chamfered-top 互斥（live-edge 已含造型，不疊倒角）。 */
    /** 4 角缺角板：層板要避開腳柱時，4 個角各切掉一塊矩形。
     *  notchLengthMm = 沿 length 軸切掉長度（兩側對稱）
     *  notchWidthMm  = 沿 width 軸切掉長度
     *  常見用途：座下層板延伸到下橫撐齊平、跟腳重疊的部分要切掉。 */
    | { kind: "notched-corners"; notchLengthMm: number; notchWidthMm: number }
    /** 弧形彎料：沿 length 軸切 N 段，每段 z 偏移 = bendMm × (1 - (2x/L)²)
     *  用於椅背頂橫木向後彎的弧形（蒸彎或疊片），向 +Z 凸出。
     *  bendMm > 0 → 向 +Z（背後）凸；bendMm < 0 → 向 -Z 凸。 */
    | { kind: "arch-bent"; bendMm: number; segments?: number }
    /** 沿 Z 軸傾斜的長條（椅背直料配合彎頂橫木）：底面在 origin.z，頂面 z 偏移 topShiftMm。
     *  baseHeightMm = 未傾斜時的世界 Y 高度（visible.width 是已含 cos 補償的料長）。
     *  side view 渲染為平行四邊形而非 AABB，避免跟上方頂橫木視覺重疊。 */
    | { kind: "tilt-z"; topShiftMm: number; baseHeightMm: number }
    | { kind: "live-edge"; amplitudeMm?: number }
    /** Seat scoop: 座板挖型。saddle = 馬鞍式中央凹（雙軸 paraboloid），
     *  scooped = 雙凹（左右兩個沿前後方向的凹槽）。
     *  depthMm = 最深處下挖量（mm），通常 6–12mm。
     *  俯視/前視/側視仍以矩形 bbox 顯示（不影響材料計算）；3D 顯示挖型曲面。 */
    | { kind: "seat-scoop"; profile: "saddle" | "scooped" | "dished"; depthMm: number };
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
  /** 尺寸超出本模板合理範圍時的「換模板」建議。比 warnings 更具體：
   *  - text: 顯示給使用者的整句說明
   *  - suggestedCategory: 建議跳到哪個 catalog
   *  - presetParams: 跳轉時要帶過去的 URL params（length/width/height/material 等）
   *  UI 會自動依使用者方案決定 link：
   *    付費 → 直接 /design/<suggestedCategory>?{params}
   *    免費 → /pricing?locked=<suggestedCategory> */
  suggestions?: Array<{
    text: string;
    suggestedCategory: FurnitureCategory;
    presetParams: Record<string, string>;
  }>;
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
  /** Hide when the referenced option's value is in this list（select 用，例如
   *  pedestal/trestle 切換時把 4-leg 專屬選項藏起來） */
  notIn?: Array<string | number | boolean>;
  /** Show only when the referenced option's value is in this list（外斜系列
   *  只 3 個值要 splayAngle 顯示，比 notIn 列 6 個排除值清爽） */
  oneOf?: Array<string | number | boolean>;
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
      /** 每個 choice 可選帶 dependsOn，依其他選項值動態隱藏該選項
       *  （例如某些椅背樣式只在 box 腳時可選）。 */
      choices: Array<{ value: string; label: string; dependsOn?: OptionDependency }>;
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
