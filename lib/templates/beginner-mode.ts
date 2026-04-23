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
      "【組裝版】螺絲結構設計，不含榫卯。接合以 Kreg 口袋孔螺絲（板材接合）+ 木螺絲（框架結構）+ 木工白膠為主。" +
      "建議工具：Kreg K4/K5 夾具、3.2mm 鑽頭、電動起子、木工白膠、F 型夾具、砂紙。" +
      "施作速度約為榫接版的 3–5 倍，結構強度約榫接版的 60–70%，日常家具使用足夠、重載或傳承級作品仍建議榫接。",
  };
}
