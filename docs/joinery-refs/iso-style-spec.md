# 黃俊傑老師等角圖畫法 Spec（給 architect agent 的可實作規範）

> 研究來源：`/Users/wengevaq989/Desktop/CLAUDE/joinery-batch/榫卯圖庫/` 中 8 張代表圖（手繪示意系列 7 張 + CAD 嚴謹級 1 張）
> 撰寫者：參考研究員 agent
> 日期：2026-05-09
> 用途：wrd JoineryDetail 第四象限等角圖（30° axonometric）重繪規範

---

## A. 老師等角畫法分類

### A.1 主流派系：Cabinet Projection（斜二測），不是真 Isometric

老師「家具結構圖樣」系列**全部 7 張等角圖都是 cabinet projection**（斜二測投影），**不是** ISO 標準 30°/30°/30° 真 isometric：

- **正面**保持原始矩形（front face = true elevation，不變形）
- **深度軸**從正面右下角往**右上 30°** 斜出去
- **頂面**因此是平行四邊形（不是 60° rhombus）
- **垂直軸**保持垂直

唯一例外：CAD 級「插肩榫-08」是純三視圖（第一角法），**沒有等角圖**——這代表老師 CAD 教材重三視，手繪示意才補等角，wrd 第四象限應依照手繪示意風格畫。

### A.2 為什麼是 cabinet projection 不是 iso

- 教科書/示意圖傳統：cabinet 較好讀（正面真實、深度暗示）
- 手繪友好：只需畫一條 30° 斜線，不需算 60° 菱形
- **wrd 之前「榫頭壓平 2D」的根因**：可能用了 cabinet 但深度比例給 0，導致變純正視圖。修法是固定 30° + depth × 0.7。

### A.3 三大畫法子流派

| 子流派 | 例 | 特徵 | wrd 採用建議 |
|---|---|---|---|
| **線稿型** | 圖1 通榫、圖2 鳩尾、圖3 木釘 | 純黑單粗實線+虛線，無填色 | **wrd 主要採用**（清晰、好程式化生成） |
| **斜線陰影型** | 圖4 舌槽 | 頂面/木口面加 45° 斜線 hatching | 木口面提示用 |
| **木紋筆觸型** | 圖5 半搭、圖6 短榫、圖7 指接 | 密集手繪木紋線 | **不採用**（手繪味道太重，程式化會醜） |

---

## B. 視覺常數建議（給 architect 直接寫進 `lib/joinery/draw-primitives.tsx`）

### B.1 投影參數

```ts
export const ISO = {
  // Cabinet projection: 正面不變形, 深度軸 30° 右上斜
  ANGLE_DEG: 30,                    // 深度軸與水平夾角
  ANGLE_RAD: Math.PI / 6,            // = 30°
  DEPTH_SCALE: 0.7,                  // 深度方向縮放（cabinet 慣例 0.5–0.75，老師偏 0.7）
  // 投影矩陣: [x', y'] = [x + d * cos(30°) * 0.7, -y - d * sin(30°) * 0.7]
  // 注意 SVG y 軸朝下，所以 y 取負
  COS30: Math.cos(Math.PI / 6),      // ≈ 0.866
  SIN30: Math.sin(Math.PI / 6),      // = 0.5
} as const;
```

### B.2 線型分層（**這是關鍵，wrd 之前沒分層所以平面感**）

```ts
export const ISO_STROKE = {
  OUTLINE_VISIBLE: 1.4,              // 可見外輪廓（最粗）
  EDGE_INTERIOR:    0.8,             // 內結構邊線（中粗）
  HIDDEN_DASHED:    0.6,             // 隱藏邊（虛線、細）
  GRAIN_HINT:       0.4,             // 木紋暗示線（非必要）
  HATCH:            0.5,             // 剖面斜線
} as const;

export const ISO_DASH = {
  HIDDEN: "4 3",                     // 隱藏邊虛線 pattern
  CENTER: "8 2 2 2",                 // 中心線
} as const;
```

### B.3 三面色階（給線稿型用 fill，斜線陰影型用 hatch）

老師手繪是**全白填色**（純線稿）。但 wrd 為了 3D 感建議三面差階：

```ts
export const ISO_FILL = {
  // 公榫 (TENON) #e6c89a 米黃棕為基底
  TENON_FRONT:  "#e6c89a",           // 正面（最亮，原色）
  TENON_TOP:    "#d9b889",           // 頂面（中間，-7% 暗度）
  TENON_SIDE:   "#c9a878",           // 側面（最暗，-14% 暗度）
  // 母榫 (MORTISE) #b08a4e 為基底
  MORTISE_FRONT: "#b08a4e",
  MORTISE_TOP:   "#9d7842",
  MORTISE_SIDE:  "#8a6936",
  // 榫眼黑洞（穿過 → 透到背面，用深灰表示「進去後看不到底」）
  MORTISE_HOLE_INTERIOR: "#3a2a1c",
  // 剖面 hatching 紅色（沿用 wrd 既有 #c8553d）
  HATCH_SECTION: "#c8553d",
} as const;
```

**老師原圖無填色** → wrd 可選 `mode: "outline" | "shaded"`，預設 `shaded` 比較直觀，`outline` 給高解析輸出用。

### B.4 排版常數（第四象限等角圖區）

```ts
export const ISO_LAYOUT = {
  QUADRANT_W: 480,                   // 第四象限寬（ThreeViewLayout 既有）
  QUADRANT_H: 280,                   // 第四象限高
  PADDING: 20,                       // 內邊距
  EXPLODE_GAP: 60,                   // 拆解動畫兩件預設距離（mm 模型空間）
  EXPLODE_ARROW_LEN: 40,             // 拆解箭頭長度（px）
} as const;
```

---

## C. 6 個 helper API 建議（給 architect 直接 implement）

> 全部加進 `lib/joinery/draw-primitives.tsx`。命名前綴 `Iso*` 避免跟既有 helper 衝突。

### C.1 `isoProject(x, y, z) → [px, py]`

純函式，model space → SVG screen。

```ts
/**
 * Cabinet projection: 正面 (x, y) 平面不變形, z 軸 30° 右上斜 × depthScale
 * @param x 寬度方向 (mm)
 * @param y 高度方向 (mm), y+ 朝上
 * @param z 深度方向 (mm), z+ 朝後
 * @returns [px, py] SVG 座標
 */
export function isoProject(
  x: number, y: number, z: number,
  opts?: { depthScale?: number; originX?: number; originY?: number }
): [number, number];
```

### C.2 `<IsoCuboid>` — 畫一個立方體

```ts
interface IsoCuboidProps {
  x: number; y: number; z: number;       // model 座標（左下後角）
  w: number; h: number; d: number;       // 寬/高/深 (mm)
  fillFront?: string;                    // 正面色（預設 ISO_FILL.TENON_FRONT）
  fillTop?: string;                      // 頂面色
  fillSide?: string;                     // 側面色（右側）
  stroke?: string;                       // 描邊色（預設 #333）
  strokeWidth?: number;                  // 預設 ISO_STROKE.OUTLINE_VISIBLE
  hidden?: boolean;                      // true → 全部用虛線
  showHiddenBackEdges?: boolean;         // true → 畫背後 3 條看不到的邊（虛線）
}

// 內部畫 3 個 polygon（front/top/right-side），可選 3 條虛線（背面 hidden edges）
export function IsoCuboid(props: IsoCuboidProps): JSX.Element;
```

**關鍵**：必須畫**三個面**（不只畫正面+頂面），這是老師等角圖立體感的根本。wrd 之前只畫 1-2 面所以「壓平」。

### C.3 `<IsoCylinder>` — 畫圓柱（dowel / 圓榫用）

```ts
interface IsoCylinderProps {
  x: number; y: number; z: number;       // 底面圓心
  radius: number;
  height: number;
  axis: "x" | "y" | "z";                 // 圓柱軸向（z=軸朝後最常見）
  fillSide?: string;
  fillCap?: string;                       // 頂面圓 fill
  stroke?: string;
  strokeWidth?: number;
  hidden?: boolean;
}

// 內部：軸=z 時畫橢圓底（投影後）+ 兩條母線 + 橢圓頂；軸=y 時直立圓柱
export function IsoCylinder(props: IsoCylinderProps): JSX.Element;
```

**老師畫木釘 = 兩條垂直線 + 頂部小橢圓**，極簡。隱藏圓柱（埋在板內）= 全虛線。

### C.4 `<IsoTenon>` — 凸出的公榫（從一個 cuboid 表面長出來）

```ts
interface IsoTenonProps {
  baseX: number; baseY: number; baseZ: number;  // 母件表面上的榫頭根部中心
  width: number;                                 // 榫頭寬 (tw)
  thickness: number;                             // 榫頭厚 (tt)
  length: number;                                // 榫頭長 (tl)
  direction: "+x" | "-x" | "+y" | "-y" | "+z" | "-z";  // 榫頭凸出方向
  shape?: "rect" | "round" | "dovetail";        // 方榫/圓榫/燕尾
  dovetailAngleDeg?: number;                     // shape=dovetail 時用（預設 8°）
  fill?: { front?: string; top?: string; side?: string };
  showShoulder?: boolean;                        // true → 畫出榫肩線
}

// 內部：根據 direction 算出榫頭 6 個頂點，畫 3 個可見面 + 3 條 hidden edge
export function IsoTenon(props: IsoTenonProps): JSX.Element;
```

**關鍵**：老師畫榫頭一定有**頂面+正面+一側面**（六邊形輪廓 not rectangle），wrd 之前可能只畫 2 面所以「壓平」。

### C.5 `<IsoMortise>` — 凹進去的榫眼（在 cuboid 表面挖洞）

```ts
interface IsoMortiseProps {
  faceX: number; faceY: number; faceZ: number;  // 母件表面上的榫眼中心
  width: number;
  height: number;                                // 榫眼開口大小
  depth: number;                                 // 榫眼深度（盲榫 < 母厚 / 通榫 = 母厚）
  faceNormal: "+x" | "-x" | "+y" | "-y" | "+z" | "-z";  // 哪個面有洞
  through?: boolean;                             // true=通榫, false=盲榫
  shape?: "rect" | "round" | "dovetail";
  dovetailAngleDeg?: number;
  interiorFill?: string;                         // 黑洞色（預設 ISO_FILL.MORTISE_HOLE_INTERIOR）
  drawBackOpening?: boolean;                     // through=true 時畫出背面開口（虛線）
}

// 內部：
// 1. 畫表面開口（depth 投影到表面 → 矩形/圓形/梯形）
// 2. 畫內壁 1-2 條可見邊（深度感關鍵）
// 3. 通榫 → 背面開口用虛線
// 4. 盲榫 → 內壁底用 interiorFill 填深色
export function IsoMortise(props: IsoMortiseProps): JSX.Element;
```

**關鍵**：老師畫榫眼**一定畫內壁深度線**（不是純黑洞），這是「凹陷感」的來源。wrd 不要只畫一個黑色矩形 fill。

### C.6 `<IsoExplode>` — 拆解動畫的兩件配對顯示

```ts
interface IsoExplodeProps {
  pieceA: JSX.Element;                           // 母件（含 IsoCuboid + IsoMortise）
  pieceB: JSX.Element;                           // 公件（含 IsoCuboid + IsoTenon）
  gap: number;                                   // 兩件分開距離 (mm)
  axis: "x" | "y" | "z";                         // 沿哪個軸分開
  showArrow?: boolean;                           // 畫組裝箭頭（虛線+箭頭）
  arrowColor?: string;
  labelA?: string;                               // 例 "母件 (柱)"
  labelB?: string;                               // 例 "公件 (橫枋)"
}

// 內部：把 pieceB 沿 axis 平移 +gap，可選畫一條虛線箭頭從 B 指向 A
export function IsoExplode(props: IsoExplodeProps): JSX.Element;
```

**關鍵**：老師**所有等角圖都是 explode view**（兩件永遠分開畫），不畫合體狀態。wrd 應該全部採用 explode，第四象限預設 explode gap=榫長×1.5。

---

## D. 12 種 wrd JoineryType 等角圖改造方案

每種 1 句話的具體指引，給 architect 直接照抄。

| # | JoineryType | 中文 | 等角圖實作方案 |
|---|---|---|---|
| 1 | `through-tenon` | 通榫 | `IsoExplode` 含母件 `IsoCuboid` + `IsoMortise(through=true, shape="rect")`（畫背面虛線開口）；公件 `IsoCuboid` + `IsoTenon(shape="rect", direction="+z")`，gap = tl × 1.5 |
| 2 | `blind-tenon` | 半隱榫 | 同上但 `IsoMortise(through=false)`，內壁用 `ISO_FILL.MORTISE_HOLE_INTERIOR` 填深色；標 `mt - tl` 留底厚 |
| 3 | `shouldered-tenon` | 帶肩榫 | 同 1 但 `IsoTenon(showShoulder=true)`，公件 cuboid 比 tenon 寬，肩面用更亮 fill 突顯承力面 |
| 4 | `dovetail` | 燕尾榫 | `IsoExplode` 含 N 個 `IsoTenon(shape="dovetail", dovetailAngleDeg=...)` 並列；母件對應 N 個 `IsoMortise(shape="dovetail", through=true)`；參考圖 2 排版 |
| 5 | `finger-joint` | 指接 | 兩塊 `IsoCuboid` 端面咬合，每片用多個小 `IsoTenon(shape="rect")` 交錯畫；不用 explode（手指已咬合呈現） |
| 6 | `half-lap` | 半搭 | 兩個 `IsoCuboid`，每件削去一半厚度（用 `IsoCuboid` 子部件減去）；建議用 `IsoExplode(axis="y", gap=cw×1.2)` 上下分開，參考圖 5 |
| 7 | `tongue-and-groove` | 舌槽 | 公件 `IsoCuboid` + `IsoTenon(shape="rect", direction="+x", thickness=mt/3)`（薄長舌）；母件 `IsoCuboid` + `IsoMortise(shape="rect", through=true)` 但 height=tt 寬槽；參考圖 4 加頂面 hatch 標木口面 |
| 8 | `stub-joint` | 短榫 | 同 `blind-tenon` 但 tl 更短（tl ≤ min(mt-3, ct/2)），標 WarningCallout「榫長 ≤ 母厚-3mm」 |
| 9 | `dowel` | 木釘 | 兩個 `IsoCuboid` + N 個 `IsoCylinder(axis="z", hidden=false)`（凸出段）+ N 個 `IsoCylinder(hidden=true)`（埋入段虛線）；參考圖 3 |
| 10 | `mitered-spline` | 斜接帶餅 | 兩個 `IsoCuboid` 45° 斜接，用 `clipPath` 切斜面；中間插一個小 `IsoCuboid`（餅片）；標 45° 角度 |
| 11 | `pocket-hole` | 口袋孔 | 兩個 `IsoCuboid` 垂直接合，公件加一個 `IsoCylinder(axis 斜 15°, hidden=true)` 表示斜孔；老師圖庫無 ref，wrd 自繪 |
| 12 | `screw` | 螺釘 | 兩個 `IsoCuboid` + `IsoCylinder(hidden=true)` 表示螺絲（軸向沿接合方向）；可加螺紋暗示線（細實線斜紋） |

---

## E. 必避免的反模式（wrd 之前踩過的坑）

1. **❌ 只畫正面+頂面**（缺側面 → 平面感）→ ✅ `IsoCuboid` 強制畫 3 面
2. **❌ 榫頭畫成單一矩形**（沒立體）→ ✅ `IsoTenon` 必須畫 6 邊形（3 面）
3. **❌ 榫眼畫成純黑矩形**（缺深度）→ ✅ `IsoMortise` 必畫內壁 1-2 條可見邊
4. **❌ 兩件合體畫**（看不出榫卯關係）→ ✅ 一律用 `IsoExplode` 拆開
5. **❌ 線型全部同粗**（缺層次）→ ✅ 用 `ISO_STROKE` 三層粗細
6. **❌ 隱藏邊不畫或畫實線**（缺穿透感）→ ✅ 通榫背面開口、埋入木釘必用虛線
7. **❌ 深度比例 = 0 或 = 1**（壓平 or 變形）→ ✅ 固定 `ISO.DEPTH_SCALE = 0.7`
8. **❌ 角度亂選**（45° 看起來像玩具）→ ✅ 鎖死 30°（cabinet projection 標準）

---

## F. 額外觀察（給未來 reference）

### F.1 老師 explode 慣例

- **柱 vs 枋**：柱在左下、枋在右上（沿榫長方向分開）
- **板 vs 板**：上下分開（圖 5 半搭）或左右分開（圖 4 舌槽）
- **拆解距離**：約等於榫長 × 1.5，不太遠不太近

### F.2 何時加木紋陰影（圖 5/6/7 風格）

老師手繪時會加，wrd 程式化生成**不建議模仿**——機器畫的木紋很僵硬會醜。改用乾淨的三面色階達到立體感即可。如果未來真要加，建議用 `<pattern>` 定義木紋 SVG pattern，而不是逐線畫。

### F.3 CAD 級（圖 8 插肩榫）的學習點

雖然沒等角圖，但**標題欄格式**值得抄：

```
+-------------------+--------+
| 黃俊傑木工訓練教材-台南魯班學堂  |
+------+----------+-----+-----+
| 班級  |  圖名   |投影 |工作時數|
+------+----------+-----+-----+
| 進階班|插肩榫  |第一角|       |
+------+----------+-----+-----+
| 繪圖  |   黃俊傑           |
+-------------------+--------+
```

wrd 既有 `TitleBlock` 應對齊這個格式：班級/圖名/投影/工作時數/繪圖/圖號 六欄。

### F.4 中心線/輔助線顏色（CAD 圖學的）

圖 8 用：
- **綠色**細實線 = 中心線 / 軸測輔助線
- **藍色** 45° 斜線 = 主剖面 hatching
- **橙色** 45° 斜線 = 輔助剖面（不同方向）
- **紅色**標註指引線

wrd 既有用紅色 hatching 是對的，可加綠色中心線增強專業感。

---

## G. 驗收檢查清單（給 architect 完工後跑）

- [ ] 所有等角圖採用 cabinet projection 30° + depth × 0.7
- [ ] 每個 `IsoCuboid` 畫出 3 個面（不只 2 面）
- [ ] 每個 `IsoTenon` 畫出 6 邊形（3 面）不是矩形
- [ ] 每個 `IsoMortise` 有內壁深度線
- [ ] 全部用 `IsoExplode` 拆解，不畫合體
- [ ] 三層 stroke width（1.4 / 0.8 / 0.6）有套用
- [ ] 隱藏邊用虛線（dash="4 3"）
- [ ] 12 種 JoineryType 全部跑過 audit 不出新錯
