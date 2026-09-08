import type { FurnitureDesign, Part } from "@/lib/types";
import { CERT_B1_REFERENCE } from "./cert-b1-reference";

/** Non-fabrication study; never register this with FURNITURE_CATALOG. */
export function certB1Study(): FurnitureDesign {
  const d = CERT_B1_REFERENCE.dimensions;
  const topThickness = 18; // Q1 A-A, PDF page 15.
  const parts: Part[] = [{
    id: "study-top", nameZh: "桌面外框（未拆封邊）", nameEn: "Top envelope (edging not separated)",
    material: "pine", grainDirection: "length",
    visible: { length: d.topLength.value, width: d.topWidth.value, thickness: topThickness },
    origin: { x: 0, y: d.height.value - topThickness, z: 0 }, tenons: [], mortises: [],
  }];
  for (const x of [-1, 1]) for (const z of [-1, 1]) parts.push({
    id: `study-leg-${x}-${z}`, nameZh: "腳柱外框（未開榫）", nameEn: "Leg envelope (no joinery)",
    material: "pine", grainDirection: "width",
    visible: { length: d.legThickness.value, width: d.height.value - topThickness, thickness: d.legWidth.value },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    origin: { x: x * (d.frameWidth.value - d.legThickness.value) / 2, y: 0, z: z * (d.frameDepth.value - d.legWidth.value) / 2 },
    tenons: [], mortises: [],
  });
  // A translucent envelope compares size only; it is not a glass drawer or cut-list part.
  parts.push({
    id: "study-drawer", nameZh: "抽屜尺寸比較框（位置示意）", nameEn: "Drawer size envelope (illustrative position)",
    material: "pine", grainDirection: "length", visual: "glass",
    visible: { length: d.drawerWidth.value, width: d.drawerDepth.value, thickness: d.drawerFrontHeight.value },
    origin: { x: 0, y: d.height.value - topThickness - 2 - d.drawerFrontHeight.value, z: 0 },
    tenons: [], mortises: [],
  });
  return {
    id: "cert-b1-dimension-study", category: "side-table", nameZh: "乙級第一題尺寸對照（非施工模型）",
    overall: { length: d.topLength.value, width: d.topWidth.value, thickness: d.height.value },
    parts, primaryMaterial: "pine", defaultJoinery: "blind-tenon", useButtJointConvention: true,
    warnings: ["僅供尺寸對照；抽屜位置示意，封邊、框架橫檔、榫孔、鳩尾榫及五金尚未建模，不可用於施工。"],
  };
}
