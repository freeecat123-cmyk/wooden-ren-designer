/**
 * 自由四邊形輪廓（`shape.kind = "quad"`）：板狀零件在 length(X) × width(Z) 平面上的
 * 四個角各自指定位置，沿 thickness(Y) 擠出。
 *
 * 為什麼要這個：技術士技能檢定家具木工丙級 01200-100301 的側板，
 * 左（背）緣垂直、上緣往前下斜 30、底緣往前上斜 15、前緣從 120 收到 95 ——
 * 四個邊各自不同，梯形（含靠邊梯形）都表達不出來，而斜切正是那題的考點，不能將就。
 *
 * corners 順序固定為 (−x,−z) → (+x,−z) → (+x,+z) → (−x,+z)，單位 mm、以零件中心為原點。
 * 一般矩形零件等價於 [[-lx/2,-lz/2],[lx/2,-lz/2],[lx/2,lz/2],[-lx/2,lz/2]]。
 *
 * ⭐ 3D、三視圖兩條投影路徑、輪廓取樣全部共用這一個雙線性內插，避免各寫一套走樣。
 */
export type QuadCorners = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

/**
 * 把正規化座標 (ex, ez) ∈ [−1, 1]² 對到四邊形上的實際 local (x, z)。
 * 角點 ex=±1, ez=±1 剛好回傳四個 corner；中間值用雙線性內插（圓料等會取樣中間點）。
 */
export function quadPoint(corners: QuadCorners, ex: number, ez: number): [number, number] {
  const [c00, c10, c11, c01] = corners; // (−,−) (+,−) (+,+) (−,+)
  const u = (ex + 1) / 2; // 0 = −x 邊, 1 = +x 邊
  const v = (ez + 1) / 2; // 0 = −z 邊, 1 = +z 邊
  const x = (1 - u) * (1 - v) * c00[0] + u * (1 - v) * c10[0] + u * v * c11[0] + (1 - u) * v * c01[0];
  const z = (1 - u) * (1 - v) * c00[1] + u * (1 - v) * c10[1] + u * v * c11[1] + (1 - u) * v * c01[1];
  return [x, z];
}

/** 直角梯形＋上下緣各自傾斜的常見寫法（檢定側板）：由深度/高度直接算四角，少一次手算出錯 */
export function sidePanelQuad(opts: {
  /** 零件 visible.length（深度方向總長，＝上緣深） */
  lx: number;
  /** 零件 visible.width（高度方向總長） */
  lz: number;
  /** 底緣深（前緣往內收） */
  bottomDepth: number;
  /** 上緣在前端往下降多少（0 = 上緣水平） */
  topDropFront?: number;
  /** 底緣在前端往上升多少（0 = 底緣水平） */
  bottomRiseFront?: number;
  /**
   * 垂直的背緣放在 local −x（"min"，預設）還是 +x（"max"）。
   * 🩸立板用 rotation x=π/2,y=π/2 時 local x 會**鏡像**到世界 z（實測 local −60 → 世界 z=+60），
   * 想讓背緣落在世界 −z 就要選 "max"。角點槽位 (−x,−z)(+x,−z)(+x,+z)(−x,+z) 順序不變，
   * 只是背/前互換，繞向跟矩形一致、法線不會翻。
   */
  backSide?: "min" | "max";
}): QuadCorners {
  const hx = opts.lx / 2, hz = opts.lz / 2;
  const drop = opts.topDropFront ?? 0, rise = opts.bottomRiseFront ?? 0;
  // −z = 上，+z = 下（apron-trapezoid 同慣例：local −Z 是頂端）
  if (opts.backSide === "max") {
    return [
      [-hx, -hz + drop],                     // 前上（下降 drop）
      [hx, -hz],                             // 背上
      [hx, hz],                              // 背下
      [hx - opts.bottomDepth, hz - rise],    // 前下（收到 bottomDepth、上升 rise）
    ];
  }
  return [
    [-hx, -hz],                              // 背上
    [hx, -hz + drop],                        // 前上（下降 drop）
    [-hx + opts.bottomDepth, hz - rise],     // 前下（收到 bottomDepth、上升 rise）
    [-hx, hz],                               // 背下
  ];
}
