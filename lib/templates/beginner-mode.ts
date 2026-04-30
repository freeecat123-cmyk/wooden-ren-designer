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
  // 圓腳沒有平面可以當 butt joint 著陸——beginner 模式不縮短 apron，
  // 維持「腳中心到腳中心」讓 apron 在視覺上連到腳（實際接合靠 stub-joint
  // 或圓榫進入腳內，apron body 延伸到腳邊緣已經視覺正確）。
  const isRoundLeg =
    legPart?.shape?.kind === "round" ||
    legPart?.shape?.kind === "round-tapered" ||
    legPart?.shape?.kind === "shaker" ||
    legPart?.shape?.kind === "lathe-turned" ||
    legPart?.shape?.kind === "splayed-round-tapered";
  const legSize = legPart && !isRoundLeg ? legPart.visible.length : 0;
  const legHeight = legPart?.visible.thickness ?? 0;
  // tapered / splayed-tapered 腳的下半部比較細——下橫撐高度的腳寬要照
  // bottomScale 算，不然 stretcher 縮太多會跟腳之間有縫
  const legBottomScale = (() => {
    const k = legPart?.shape?.kind;
    if (k === "tapered" || k === "splayed-tapered") {
      return legPart?.shape && "bottomScale" in legPart.shape
        ? legPart.shape.bottomScale
        : 1;
    }
    return 1;
  })();
  // 給定世界 Y，算腳在這個 Y 的橫切寬度
  const legWidthAt = (worldY: number): number => {
    if (legSize === 0 || legHeight === 0) return legSize;
    const yFromBottom = Math.max(0, Math.min(legHeight, worldY));
    // 上端寬 = legSize（尺度=1），下端寬 = legSize × bottomScale
    const scale = legBottomScale + (1 - legBottomScale) * (yFromBottom / legHeight);
    return legSize * scale;
  };

  // 只有真正「接腳」的零件（牙板、橫撐、背橫木）才需要縮短；
  // 櫃體的側板、層板、zone 分隔板、抽屜箱、門框 等都是面板對面板接合，
  // 長度已經是正確的內部尺寸，不能再縮——否則會比櫃體內高少 legSize，
  // 在 3D 看起來到處有縫、分解。
  // tea-table 的 ID 是 upper-apron-* / lower-stretcher-*，所以 apron / stretcher
  // 用 substring（不限定開頭）抓得到 upper- / lower- 等前綴變體
  const isApronLike = (id: string): boolean =>
    /(?:^|-)apron/.test(id) ||
    /(?:^|-)stretcher/.test(id) ||
    /^ls-/.test(id) ||
    id === "center-stretcher" ||
    id === "back-rail" ||
    id === "back-top-rail";

  const parts: Part[] = design.parts.map((p) => {
    const hasEndTenons = p.tenons.some(
      (t) => t.position === "start" || t.position === "end",
    );
    const shouldShrink =
      hasEndTenons &&
      isApronLike(p.id) &&
      legSize > 0 &&
      p.visible.length > legSize;
    // apron 在世界 Y 中心位置 ≈ origin.y + visible.width/2（rotation x:π/2 後
    // visible.width 變成世界垂直軸）
    const apronYCenter = p.origin.y + p.visible.width / 2;
    // joinery mode 的 visible.length 額外加 2×tenonLen（榫頭凸出端進入腿的
    // 母榫）+ 2×splayXc（splay 補償，已 baked in）。Beginner mode 要 butt 到
    // 腳的「在這個 Y 的內面」：
    //   shrink = 2×tenonLen（去掉榫頭凸出部分） − taperOffset（腿在這個 Y 比
    //   較細的話、stretcher 該再延長一點補回來）
    // 之前 shrink = legWidthAt 是錯的——只砍掉 legSize 不夠（少 1/3 個
    // legSize），所以 beginner mode stretcher 仍凸出腳邊每側 6mm，看起來像
    // 「穿過腳」。
    const endTenonLen = p.tenons
      .filter((t) => t.position === "start" || t.position === "end")
      .reduce((sum, t) => sum + t.length, 0);
    const widthAtY = legWidthAt(apronYCenter);
    const taperOffset = legSize - widthAtY; // 腿在這個 Y 比 top 細多少
    const shrinkAmount =
      endTenonLen > 0 ? endTenonLen - taperOffset : widthAtY;
    const visible = shouldShrink
      ? { ...p.visible, length: p.visible.length - shrinkAmount }
      : p.visible;
    // 梯形 apron 縮短後 topLengthScale 要重算——不然 top edge 仍按原比例縮，
    // 對齊不到 leg 內面（splay 角度大時尤其明顯，會看到 2-3mm 重疊）
    // beginnerTop = joineryTop − legSize、beginnerBot = joineryBot − legSize
    // 新 topScale = beginnerTop / beginnerBot
    let shape = p.shape;
    if (shouldShrink && shape?.kind === "apron-trapezoid") {
      const Lorig = p.visible.length;
      const Lnew = Lorig - shrinkAmount;
      if (Lnew > 0) {
        const newTopScale = (shape.topLengthScale * Lorig - shrinkAmount) / Lnew;
        const newBotScale = (shape.bottomLengthScale * Lorig - shrinkAmount) / Lnew;
        shape = { ...shape, topLengthScale: newTopScale, bottomLengthScale: newBotScale };
      }
    }
    return {
      ...p,
      visible,
      shape,
      tenons: [],
      mortises: [],
    };
  });

  // 組裝版改名：鳩尾盒 → 木盒（鳩尾是榫接版本才有的稱呼）
  const beginnerNameMap: Record<string, string> = {
    "鳩尾盒": "木盒",
  };
  const newNameZh = beginnerNameMap[design.nameZh] ?? design.nameZh;

  return {
    ...design,
    parts,
    nameZh: newNameZh,
    defaultJoinery: "pocket-hole",
    notes:
      (design.notes ? design.notes + "\n\n" : "") +
      "【組裝版】不含榫卯，用螺絲 / 木釘 / DOMINO / 斜孔系統擇一或混用 + 木工白膠組裝。" +
      "建議工具：斜孔器夾具、木板打孔定位器、電鑽、鑽頭組、PVA 木工膠、F 型夾具、砂紙。" +
      "施作速度約為榫接版的 3–5 倍，結構強度約榫接版的 60–70%，日常家具使用足夠、重載或傳承級作品仍建議榫接。",
  };
}
