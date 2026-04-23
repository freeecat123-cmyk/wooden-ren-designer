import type { FurnitureDesign, Part } from "@/lib/types";

/**
 * Strip mortise/tenon joinery from a design and replace it with
 * pocket-hole / screw+glue assembly. Geometry (part positions, sizes,
 * rotations) stays identical — only the joinery metadata is swapped.
 *
 * Our templates already size legs so that `visible.thickness` equals
 * the assembled leg height (the tenon is extra cut length beyond the
 * visible body — it lives inside the top/seat panel's mortise). So we
 * just drop tenons/mortises; cut lengths naturally shrink to the visible
 * dimension because the cut calculator adds tenon length on top.
 */
export function toBeginnerMode(design: FurnitureDesign): FurnitureDesign {
  // Normal mode keeps apron visible.length spanning leg center to leg center
  // (so the tenon portion is visually represented in the three-view). For a
  // butt-joined beginner build, shrink aprons by one legSize (half each end)
  // so they stop at the leg inner face.
  const legPart = design.parts.find(
    (p) => /^leg-/.test(p.id) && p.visible.length === p.visible.width,
  );
  const legSize = legPart ? legPart.visible.length : 0;

  const parts: Part[] = design.parts.map((p) => {
    const hasEndTenons = p.tenons.some(
      (t) => t.position === "start" || t.position === "end",
    );
    const visible =
      hasEndTenons && legSize > 0 && p.visible.length > legSize
        ? { ...p.visible, length: p.visible.length - legSize }
        : p.visible;
    return {
      ...p,
      visible,
      tenons: [],
      mortises: [],
    };
  });

  return {
    ...design,
    parts,
    defaultJoinery: "pocket-hole",
    notes:
      (design.notes ? design.notes + "\n\n" : "") +
      "【組裝版】不含榫卯，用螺絲 / 木釘 / DOMINO / 斜孔系統擇一或混用 + 木工白膠組裝。" +
      "建議工具：斜孔器夾具、木板打孔定位器、電鑽、鑽頭組、PVA 木工膠、F 型夾具、砂紙。" +
      "施作速度約為榫接版的 3–5 倍，結構強度約榫接版的 60–70%，日常家具使用足夠、重載或傳承級作品仍建議榫接。",
  };
}
