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
  | "wardrobe";

export type JoineryType =
  | "through-tenon"
  | "blind-tenon"
  | "shouldered-tenon"
  | "half-lap"
  | "dovetail"
  | "finger-joint"
  | "tongue-and-groove"
  | "dowel"
  | "mitered-spline";

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
  | "taiwan-cypress"
  | "teak"
  | "white-oak"
  | "walnut"
  | "douglas-fir";

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
    }
  | {
      type: "select";
      key: string;
      label: string;
      defaultValue: string;
      choices: Array<{ value: string; label: string }>;
      help?: string;
    }
  | {
      type: "checkbox";
      key: string;
      label: string;
      defaultValue: boolean;
      help?: string;
    };

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
