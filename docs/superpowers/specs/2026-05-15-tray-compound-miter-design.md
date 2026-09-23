# 托盤複斜 miter 設計 Spec

## Goal

矩形托盤 4 片直立壁向外撇角度 θ 時，corner miter 接合**真正視覺上密合**（無 V 縫、無底邊錯位）。木匠拿到 cut list 能直接照角度切到組合。

## Background

托盤模板（`lib/templates/tray.ts`）有 `wallSplay` 選項（0–15°）。當前實作：4 片牆 rotation 套 ±θ、`mitered-ends` shape 用簡單 45° insetEach。**幾何上不可能密合**——傾斜後簡單 45° miter 兩牆面交線在 3D 中不再是直線，corner 必出 V 縫（仰視截圖實證）。

過去 5 輪 origin 補償全失敗，因為它治標不治本：補的是「壁中心位置」，沒改「壁本身的形狀」。Agent A/C/D 三路研究確認真解是改零件 shape。

## Architecture

擴充既有 `mitered-ends` shape kind，加 `tiltAngle`（牆外撇 θ）+ `bevelAngle`（鋸片傾角 B）。tilt=0/bevel=0 退回原行為，pencil-holder/photo-frame 不動。

3D 渲染走 8 頂點 convex polyhedron（梯形棱柱）：俯視梯形、端面是 miter+bevel 雙轉的平行四邊形。Three.js 用 BufferGeometry 自構 vertex+三角面，避開 CSG / ExtrudeGeometry 限制。

## Tech Stack

- 既有 React Three Fiber + Three.js（BufferGeometry）
- 既有 svg-views 投影系統（geometry.ts 已認 mitered-ends，要擴充梯形 silhouette）
- 既有 audit-overlaps OBB SAT（§A10.7 已支援非 90° rotation，新 shape 餵 8 頂點凸殼即可）

## 公式（drafting-math.md §AT1.1，已驗證）

```
θ = wallSplay（從垂直線量，0° = 直立）
n = 邊數（托盤 rect → n=4）

Miter（鋸盤水平轉角）M = arctan(cos θ × tan(180°/n))
                       = arctan(cos θ)              [n=4]

Bevel（鋸片垂直傾角）B = arcsin(sin θ × cos(180°/n))
                       = arcsin(sin θ / √2)         [n=4]
```

### 具體角度（n=4，validation table）

| θ | Miter M | Bevel B |
|---|---------|---------|
|  0° | 45.00° |  0.00° |
|  5° | 44.89° |  3.54° |
| 10° | 44.56° |  7.05° |
| 15° | 44.01° | 10.50° |

θ=15° n=4 case = drafting-math.md §AT1.4 worked example，數字對得起來。

## 零件 8 頂點公式

每片牆 local frame：origin = 底外緣中心、+u 沿牆長、+v 牆面向上、+n 牆面法線（外正）。

設 `m = tan M = cos θ`、`b = tan B = sin θ / √(2-sin²θ)`、A = 牆外長/2、wallT = 牆厚、wallH = 牆面高度。

**底面 4 點**（v=0）：
```
P1 = (-A,            0, 0)       外底左
P2 = (+A,            0, 0)       外底右
P3 = (+A - wallT·m,  0, -wallT)  內底右
P4 = (-A + wallT·m,  0, -wallT)  內底左
```

**頂面 4 點**（v=wallH，bevel 讓上緣 u 方向再內縮 wallH·b）：
```
P5 = (-A + wallH·b,           wallH, 0)
P6 = (+A - wallH·b,           wallH, 0)
P7 = (+A - wallH·b - wallT·m, wallH, -wallT)
P8 = (-A + wallH·b + wallT·m, wallH, -wallT)
```

**12 個三角面**（外側面 2、內側面 2、頂面 2、底面 2、兩端 cut face 各 2）。

## 五件套改動

### 1. `lib/types/index.ts`

擴充 `mitered-ends` discriminator：
```ts
| { kind: "mitered-ends";
    insetEach: number;
    outerSide: "+y" | "-y";
    tiltAngle?: number;      // θ in radians, default 0
    bevelAngle?: number;     // B in radians, default 0
  }
```

不加新 kind、向後相容 pencil-holder/photo-frame。

### 2. `lib/templates/tray.ts`

`wallSplay` rotation block 改成：每片牆 set `shape.tiltAngle = wallSplayRad`、`shape.bevelAngle = Math.asin(Math.sin(θ)/Math.sqrt(2))`。**不再對 rotation 套 ±θ**——tilt 由 shape 本身承擔。

origin 仍在底外緣中心對應位置（不再做 origin 補償）。

### 3. `lib/render/geometry.ts`

`buildMiteredEndsGeometry`（或新 `buildCompoundMiterGeometry`）改吃 tiltAngle+bevelAngle。tilt=0 時用既有路徑（向後相容）；tilt>0 時走 8 頂點 BufferGeometry：
- 8 個 Vector3（公式如上）
- 12 個 face index（手寫展開）
- 每面法線手算（保留 flat shading）

### 4. `lib/render/svg-views.tsx`

silhouette 投影（geometry.ts:735 附近）：tilt>0 時把 8 頂點各自投影到目標平面，取 convex hull 作 silhouette。三視圖：
- 俯視（XZ）：梯形（端面內縮 wallH·b，因 bevel）
- 正視（XY）：tilt 後牆面斜線
- 側視（YZ）：tilt 後牆面斜線

### 5. `scripts/audit-overlaps.ts`

`mitered-ends` 已被 OBB SAT 路徑認，但 AABB 是按 visible（長方體）算的。tilt>0 後 AABB 會比真實 polyhedron 大些（保守、不會漏 overlap，但可能 false positive）。**先觀察**——如果 audit 0 overlaps 就不動，有 false positive 再走 §A10.7 凸殼路徑。

## 驗收

1. tray rect bodyShape + wallSplay = 0°：與目前完全一樣（regression）
2. tray rect + wallSplay = 10°：3D 看 4 corner 完美密合、底邊與底板齊
3. tray rect + wallSplay = 15°：同上 + cut list 顯示 Miter 44.01° / Bevel 10.50°
4. `scripts/audit-overlaps.ts` 全綠（tray rect 維持 0 overlaps）
5. pencil-holder / photo-frame：無 regression（tilt 未指定 = 0 → 原行為）
6. 三視圖：俯視看到梯形端面、正/側視看到傾斜牆面

## Out of Scope（先不做）

- cut list / 報價頁面顯示 Miter + Bevel 角度標註（Phase 2）
- 八角托盤（`bodyShape=oct`）的 wallSplay 套用（n=8 公式一樣，但 polygon-staves 是另一條路徑，先不動）
- 三視圖標複斜角度線（標註圖、Phase 2）
- 榫卯細節圖端面 compound cut 視覺（Phase 2）

## 開發風險

1. **Three.js BufferGeometry 手寫面法線**：face winding 錯會出現 backface culling 黑面。寫完要 360° 旋轉檢查每面都亮。
2. **三視圖 silhouette**：tilt 後牆 silhouette 從矩形變梯形，要小心 §A 軸慣例（doc 軸跟 code 軸差 y/z 互換）。
3. **cut list 切料長度**：tilt 後外側 length=2A、內側 length=2A-2wallT·m、頂面更短。**「應切多長」**要從哪邊量是個 UX 問題，可能要等 user 點頭。

## References

- `docs/drafting-math.md` §AT1.1 Hopper Formula（行 3992-4006）
- `docs/drafting-math.md` §AT1.4 Worked example（行 4030-4038）
- Bjorn Jansson: https://jansson.us/nsideboxderive.html （完整向量法推導）
- Fine Woodworking #156 「Compound Miters Made Simple」by Steve Latta（2002）
- Matthias Wandel: https://woodgears.ca/miter/ （工程師實作驗證 + 板形=梯形強調）
- The Carpentry Way / Chris Hall: https://thecarpentryway.blog/2009/05/hopper/
