import type { FurnitureDesign, Part } from "@/lib/types";

/**
 * Strip mortise/tenon joinery from a design and replace it with
 * pocket-hole / screw+glue assembly. Geometry (part positions, sizes,
 * rotations) stays identical — only the joinery metadata is swapped.
 *
 * Visible dimensions of legs etc. already include tenon protrusions in
 * our templates. When tenons are stripped, real cut lengths should equal
 * the visible length (no tenon extension), so we shorten legs by the
 * removed tenon length to keep assembled height accurate.
 */
export function toBeginnerMode(design: FurnitureDesign): FurnitureDesign {
  const parts: Part[] = design.parts.map((p) => {
    let visible = p.visible;
    const legTenon = p.tenons.find(
      (t) => t.position === "top" && t.type === "through-tenon",
    );
    if (legTenon && /^leg/.test(p.id)) {
      visible = {
        ...visible,
        thickness: Math.max(10, visible.thickness - legTenon.length),
      };
    }
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
