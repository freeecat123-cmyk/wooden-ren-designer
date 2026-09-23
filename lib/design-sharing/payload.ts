import type { FurnitureDesign, Part } from "@/lib/types";
import { constructionCutBox } from "@/lib/geometry/construction-cuts";

export interface PublicDesign {
  schema: 1;
  design: FurnitureDesign;
  joineryMode: boolean;
}

function pick<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]])) as Pick<T, K>;
}
const dimensions = (v: Part["visible"]) => pick(v, ["length", "width", "thickness"]);
const vector = (v: Part["origin"]) => pick(v, ["x", "y", "z"]);
function construction(mortise: Part["mortises"][number]) {
  if (!("constructionCut" in mortise)) return {};
  const box = constructionCutBox(mortise);
  if (!box) throw new Error("Invalid public construction geometry");
  return { constructionCut: { version: 2 as const, box: pick(box, ["cx", "cy", "cz", "hx", "hy", "hz", "depthAxis"]) } };
}

function shape(v: Part["shape"]): Part["shape"] {
  if (!v) return undefined;
  // Only geometry fields cross the publication boundary, including nested shapes.
  const numeric = "bottomScale chamferMm bottomChamferMm dxMm dzMm hoofMm hoofScale dirX dirZ blockHeightMm shoulderMm insetMm dir squareFrac topLengthScale bottomLengthScale taperSpanMm bevelAngle depthMm cornerR notchLengthMm notchWidthMm bendMm segments topShiftMm baseHeightMm amplitudeMm topArchMm bottomArchMm insetEach tiltAngle segmentCount phase fingerDepth edgeChamferMm angleDeg pinDepth sides outerRadius angleOffsetDeg waveCount sizeMm sizeZMm squareness lobes".split(" ");
  const enums = "kind chamferStyle axis bevelMode style profile bendAxis outerSide corner orientation archSides".split(" ");
  const source = v as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of numeric) if (typeof source[key] === "number") out[key] = source[key];
  for (const key of enums) if (typeof source[key] === "string") out[key] = source[key];
  for (const key of ["twoWay", "sCurve", "halfPin", "bothEnds"]) if (typeof source[key] === "boolean") out[key] = source[key];
  if ("lowerCove" in v && v.lowerCove) out.lowerCove = pick(v.lowerCove, ["botMm", "topMm"]);
  if ("vertices" in v && v.vertices) out.vertices = v.vertices.map(([x, y, z]) => [x, y, z]);
  return out as unknown as Part["shape"];
}

export function publicGeometry(design: FurnitureDesign, joineryMode: boolean): PublicDesign {
  return {
    schema: 1, joineryMode,
    design: {
      id: "shared-design", category: design.category, nameZh: "Shared design",
      overall: dimensions(design.overall), defaultJoinery: design.defaultJoinery,
      primaryMaterial: design.primaryMaterial, useButtJointConvention: design.useButtJointConvention,
      parts: design.parts.map((p, index) => ({
        ...pick(p, ["id", "material", "grainDirection", "panelPieces", "panelSplit", "visual"]),
        nameZh: `Part ${index + 1}`, nameEn: `Part ${index + 1}`,
        visible: dimensions(p.visible), origin: vector(p.origin),
        rotation: p.rotation ? vector(p.rotation) : undefined,
        shape: shape(p.shape),
        peripheralRebate: p.peripheralRebate ? pick(p.peripheralRebate, ["widthMm", "depthMm"]) : undefined,
        joineryView: p.joineryView ? {
          shape: shape(p.joineryView.shape),
          visible: p.joineryView.visible ? dimensions(p.joineryView.visible) : undefined,
          origin: p.joineryView.origin ? vector(p.joineryView.origin) : undefined,
        } : undefined,
        tenons: p.tenons.map(t => ({
          ...pick(t, ["position", "type", "length", "width", "thickness", "offsetWidth", "offsetThickness"]),
          shoulderOn: t.shoulderOn ? [...t.shoulderOn] : undefined,
          axis: t.axis ? vector(t.axis) : undefined,
        })),
        mortises: p.mortises.map(m => ({
          ...construction(m),
          // Rendering uses this fixed semantic marker; never expose freeform suffixes.
          ...(m.label?.startsWith("百葉槽") ? { label: "百葉槽" } : {}),
          ...pick(m, ["depth", "length", "width", "through", "shape", "cosmetic", "rotX", "rotY", "rotZ"]),
          origin: vector(m.origin), axis: m.axis ? vector(m.axis) : undefined,
        })),
      })),
    },
  };
}
