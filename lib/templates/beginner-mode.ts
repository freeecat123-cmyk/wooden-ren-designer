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
  // Traditional templates position aprons so their visible body spans leg-
  // center to leg-center — the tenon fills the gap to the leg inner face.
  // For a pocket-hole butt join we want the apron to end at the leg inner
  // face, so shrink its visible.length by one legSize (half on each end).
  // Detect legSize from any "leg-*" part's cross-section.
  const legPart = design.parts.find(
    (p) => /^leg-/.test(p.id) && p.visible.length === p.visible.width,
  );
  const legSize = legPart ? legPart.visible.length : 0;

  const parts: Part[] = design.parts.map((p) => {
    const hasEndTenons =
      p.tenons.some((t) => t.position === "start" || t.position === "end");
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
      "【初心者模式】已拆除所有榫卯。改用 Kreg 口袋孔螺絲（板材接合）+ 木螺絲（框架結構）+ 木工白膠組裝。" +
      "建議工具：Kreg K4/K5 夾具、3.2mm 鑽頭、電動起子、木工白膠、F 型夾具、砂紙。" +
      "比榫卯版本快 3–5 倍完工，但結構強度約為榫接版的 60–70%，日常使用足夠、重載家具仍建議榫接。",
  };
}
