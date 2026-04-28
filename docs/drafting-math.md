# 三視圖與榫卯細節圖製圖數學

供 `lib/render/svg-views.ts` 與 `components/.../details.tsx` 等繪圖模組參考。
聚焦正投影 + 榫卯細節，不含透視 / 軸測。

---

## A. 三視圖（Orthographic Projection）

### A1. 座標投影
專案慣例：**origin = 底部中心，z 向上，y 向後（深度）**

| 視圖 | 公式 | 觀察方向 |
|------|------|---------|
| 正視圖 Front | `(svg_x, svg_y) = (x, −z)` | +y |
| 側視圖 Side | `(svg_x, svg_y) = (y, −z)` | −x |
| 俯視圖 Top | `(svg_x, svg_y) = (x, y)` | −z |

SVG 的 y 軸向下，所以高度 z 取負；俯視圖 y 不翻轉（第三角法慣例）。

### A2. 第三角法視圖排列
```
        [ 俯視圖 ]
[ 左側 ] [ 正視圖 ] [ 右側 ]
        [ 仰視圖 ]
```
本工具只用 正/側/俯 三張，水平排列即可。

- 視圖間距 = `max(物件寬, 物件高) × 0.15`，最小 30mm
- A4 橫式邊距：上下 10、左 25（裝訂）、右 5 mm

### A3. 比例尺自動計算
給定圖紙可用區域 (W, H) 與模型 bounding box (w, h, d)：
```
總寬 = w + d + gap
總高 = h + d + gap
scale = min(W / 總寬, H / 總高)
```
取最近的整數倍標準比例：1:1, 1:2, 1:5, 1:10, 1:20, 1:50。
用 `⌈log10(1/scale)⌉` 找級數。

### A4. 隱藏線（虛線）判斷
邊 e 被遮 ⇔ 沿投影方向射線經過 e 中點時，途中存在不透明面。

```
for each edge e (端點 a, b):
  mid = (a + b) / 2
  ray = mid + ε · viewDir → ∞ (反方向)，ε = 0.5mm
  for each face f in model:
    if f 不含 e and ray ∩ f 在前方:
      e 為隱藏 → 畫虛線
```

SVG 樣式：`stroke-dasharray="3 2"` (mm)

### A5. 中心線（Centerline）
圓孔、對稱軸用長劃線：`stroke-dasharray="8 2 1 2"`，伸出輪廓 3–5mm。

### A6. 標註（Dimension Line）幾何

**間距**
- 標註線距輪廓 ≥ 7mm
- 平行多條間距 ≥ 5mm

**箭頭**（CNS 3-3 / JIS B 0001）：等腰三角形，夾角 **20°**，長 = 字高 h，寬 = h/3（長寬比 3:1）
```
箭頭寬 = 箭頭長 × tan(10°) ≈ 箭頭長 × 0.176
```
可填實或開叉兩種。ISO 128 約 15°，業界 15–30° 都有人用，但**台灣 CNS 標準是 20°**。

**延伸線**
- 起點離輪廓 1–2mm（不貼著畫）
- 越過標註線 2–3mm

**數字位置**
- 水平標註：字在標註線上方居中，離線 1mm
- 垂直標註：字旋轉 −90°，在標註線左側

**標註方式選擇**
- 累進（baseline）：所有尺寸從同一基準算 → 公差不累積
- 並列（chain）：相鄰標註首尾相連 → 公差會累加

### A7. 剖面線（Hatching）

| 材料 | 樣式 |
|------|------|
| 一般木材 | 45° 平行線，間距 2mm |
| 木材（有紋） | 45° + 木紋曲線 |
| 金屬 | 45° 細線，間距 1.5mm |
| 玻璃 | 三條細線一組 |

```
法向量 n = (cos45°, sin45°)
[d_min, d_max] = P 各頂點 · n 的 min/max
for d in range(d_min, d_max, 間距):
  線 L: P · n = d
  L ∩ 多邊形 取線段
```

### A8. 局部放大圖（Detail View）
1. 主圖圈出區域 + 字母標籤（"A"）
2. 放大圖標題：`詳圖 A   2:1`
3. 引線從圓 → 詳圖標題
4. 放大比例選 2:1, 5:1, 10:1（整數倍最好認）

---

## B. 榫卯細節圖（Joinery Detail）

### B1. 渲染慣例
- 主視圖：榫頭水平向右，公榫從左件伸出，母榫在右件
- 同一張圖尺度一致，不要某榫放大其他不放
- 對應檔案：`components/.../details.tsx`

### B2. 榫卯尺寸標準比例

設榫件厚度 = T，寬度 = W：

| 榫卯 | 關鍵尺寸 | 公式 |
|------|---------|------|
| **直榫** | 榫厚 t | `T/3`（硬木 1/3，軟木可到 1/2） |
|  | 榫寬 w | `W − 2×肩寬`，肩寬 4–6mm |
|  | 通榫長 | = 對方件厚度 |
|  | 盲榫長 L | `(2/3) × 對方件厚度`，最少 25mm |
| **燕尾榫** | 斜度 | 軟木 1:6 (≈9.46°)；硬木 1:8 (≈7.13°) |
|  | 燕尾寬:間距 | 1:1 ~ 2:3 |
|  | 邊縫 half pin | 寬 = 板厚 / 2 |
| **指接 Box** | 指寬 | = 板厚 |
|  | 指數 n | `板高 / 板厚`（取奇數對稱） |
| **企口** | 舌厚 | `T/3` |
|  | 舌深 | `T/2` 或 6mm |
|  | 槽深 | 比舌深 +1mm（容膠） |
| **半搭 half-lap** | 搭接深 | `T/2` |
| **鳩尾搭** | 側壁斜度 | 1:8 |

### B3. 配合公差（細節圖渲染示意值）
- 一般手作：母榫 = 公榫 + 0.1mm
- CNC 緊配：母榫 = 公榫 + 0
- 活動拆卸：母榫 = 公榫 + 0.5mm

> 渲染時畫成 0 間隙即可——細節圖是示意，不是 CNC 圖檔。

### B4. 燕尾榫斜度繪製
給斜度比 1:N（N=6 或 8），板厚 h：
- 斜邊水平投影 = `h / N`
- 斜邊垂直投影 = `h`
- 與垂直線夾角 α = `arctan(1/N)`：軟木 9.46°、硬木 7.13°

立面 SVG path（公榫梯形，底部較寬咬合）：
```
M (x_left_top)
L (x_left_top - h/N, y + h)
L (x_right_top + h/N, y + h)
L (x_right_top, y)
Z
```

### B5. 通榫端面木紋
通榫貫穿時，對方件側畫端面：
```
draw_tenon_end_grain(x, y, w, h):
  rect(x, y, w, h) stroke
  for i in 0..n:
    隨機點 inside rect, fill black, r = 0.3mm
```

### B6. 半榫 / 暗榫的隱藏線
- 公榫部分畫實線（外露）
- 進入母榫的部分畫虛線（隱藏）
- 母榫底部畫虛線（孔底看不到）

切換點：
```
visible_length = 公榫件厚度 − 0  (肩部)
hidden_start = visible_length
hidden_end = visible_length + 母榫深度
```

### B7. 木紋方向
- 公榫件：木紋沿榫頭長軸 → 平行條紋（淺褐色 0.3mm 線）
- 母榫件：木紋與榫頭垂直 → 條紋旋轉 90°
- 紋路間距：1.5–2mm（細紋）或 4–6mm（明顯紋）

### B8. 必標尺寸
1. 榫厚 t（橫向）
2. 榫長 L（縱向）
3. 肩深 s（有肩榫時）
4. 斜度 1:N（燕尾必標）
5. 配合面：`⊥` 符號或 "緊配 / 推入式"

### B9. 細節圖排版
- 標準比例：1:1 或 2:1
- A4 排兩套同類榫卯：總寬 = 2 × 細節寬 + 中縫 30 + 邊距 2 × 25
- 標題格式：`圖 X-N · 燕尾榫 1:8 · 比例 2:1`

---

## C. 共通精度規則

### C1. SVG 浮點精度
檔案輸出 round 到小數第 2 位（mm 級）。
UI 顯示則 round 到 1 位（內部計算保持高精度）。

```ts
const fmt = (n: number) => Math.round(n * 100) / 100;
```

### C2. 線寬分層（CAD 慣例：粗:細 ≈ 2:1）

| 用途 | 線寬 |
|------|------|
| 輪廓 visible | 0.5mm |
| 隱藏線 hidden | 0.35mm（虛線） |
| 標註線 dimension | 0.25mm |
| 中心線 centerline | 0.25mm |
| 剖面線 hatching | 0.15mm |

### C3. 角度誤差容忍
- 人眼可辨 ≈ 0.5°
- 燕尾 1:6 (9.46°) vs 1:8 (7.13°) 差 2.3° → 一定看得出
- 細節圖角度 round 到 0.1°

---

## D. 實作 Priority 建議

### 規範性修正（先做）
1. **箭頭夾角從 30° 改 20°**（CNS 3-3 強制）
2. **加第三角法投影符號**（CNS 強制）
3. **中文字體改黑體 / 等線體**（noto-sans-tc / 思源黑體）

### 功能性建議
4. **三視圖加總長/寬/高三條主標註**（目前只有 bbox）
5. **燕尾榫斜度確認用 1:6 / 1:8** 而非任意值
6. **隱藏線（虛線）** — 用 Painter's algorithm + polygon-clipping，先試 three-plotter-renderer
7. **木紋方向條紋** — 公榫木紋沿榫長軸、母榫垂直；視覺辨識度大幅提升
8. **比例尺自動選整數**（1:1/2/5/10/20/50）
9. **木材剖面用波浪線**（不要 ANSI31 45° 斜線——那是金屬）

### 榫卯擴充優先序
10. 銀錠榫、楔釘榫、走馬銷、包蟻組接、抱肩榫（高 CP 值，見 G3）

### 結構驗證（新）
11. **木紋方向檢查 MVP**：P0-1 順紋承載、P0-2 公榫紋向、P0-4 寬板 movement、P1-6 母榫壁厚（見 L5）

### 進階功能（新，估期長）
12. **爆炸圖** — Axis-Aligned + part type rules + ortho iso 視角 + slider（見 H）
13. **自動標註** — rbush + 4 側 layout + 短內長外 stacking + L 形 leader（見 I7）
14. **板材展開圖** — 圓柱/圓錐/截頂圓錐公式直接套，自由曲面警示後 LSCM（見 J8）
15. **派系 preset** — 中式家具加蘇/京/廣/徽/晉下拉選單（見 K2-K3）

### 結構驗證 v2
16. **撓度檢查** — shelf/top 均佈簡支，警告 OK/WARN/ERROR + 加橫撐建議（見 M6-M7）
17. **人體工學警告** — 椅高/桌高/椅桌差/座深等邊緣值警告，hobbyist 友善文字（見 O8）

### 工程輸出 pipeline
18. **五金鑽孔圖** — 鉸鏈/滑軌/層板托/拉手孔位 + 分層 SVG（見 N7）
19. **DXF 輸出 MVP** — `@tarikjabiri/dxf`，從內部 model 直出，CUT/DRILL/ENGRAVE 分層 + ACI 顏色（見 Q6）
20. **CNC G-code（v3）** — 先 DXF（80% 解），再 jscut，最後自家 G-code（Clipper2）（見 P5）

### 裁切與曲線（新）
21. **CutPlan v2** — Skyline → MaxRects-BSSF + kerf 設定 + grainLocked（見 R8）
22. **邊緣導圓 + 線腳庫** — Three.js bevelEnabled + 5-8 個明西式線腳 preset（見 S10）
23. **市售規格對齊** — STANDARD_THICKNESSES + SHEET_SIZES 常數，UI 顯示「市售 X 差 Δ」（見 T7）

### 美學擴充（新）
24. **中式紋樣庫** — 4 個 MVP（meander/swastika/ruyi/iceCrack）+ 派系 preset 自動帶（見 U6）

### 結構驗證 v3（新）
25. **椅子穩定性** — θ_side 先上（公式最簡），加 backTiltDeg 一個欄位（見 V6）

### AI 入口（新）
26. **拍照推薦模板** — Claude Vision API + structured JSON，2-3 天工，月成本 $8（見 W2）

### 報價與工時（新）
27. **工時細項分項計算** — 抽 `joinery-labor.ts`、表面處理改面積×單價、複雜度四檔、批量學習曲線（見 X6）

### 視覺品質（新）
28. **3D 渲染 MVP** — ACES tone + Environment preset + SoftShadows，30 行內視覺 +50%（見 Y7）
29. **三段品質模式** — edit/preview/render Quality switch + EffectComposer SSAO/Bloom/DoF（見 Y5）

### 工程交付（新）
30. **打包出貨估算** — 三邊和材積 + 黑貓/新竹分級報價 + KD 拆裝建議（見 Z7）
31. **訂單管線 MVP** — Supabase orders 表 + LINE Notify + 綠界，工廠半自動 v2（見 AA5）

### 內容深化（新）
32. **經典家具 20 款** — 第一波 6 件 A 級，2 週可上（見 AB5）
33. **木材立體屬性** — 雷達圖 + 屬性 chips + 派系推薦 + CITES 警示（見 AC9）

---

## 相關慣例

座標、Euler 角、visible/tenon mesh 區分等几何約定，散在程式碼註解；改幾何前先看：
- `lib/templates/*` 各家具的 origin 與 axis 慣例
- `lib/render/svg-views.ts` 投影實作
- `components/quote/JoineryDetails*` 細節圖實作

---

## E. Hidden-Line Removal 演算法

### E1. 演算法比較
| 演算法 | 複雜度 | 實作難度 | SVG 輸出品質 | wrd 適用 |
|--------|--------|---------|-------------|---------|
| Painter (line clip) | O(E·F) | 低 | 高（精確 dashed） | **推薦** |
| BSP + 2D clip | 建 O(F²logF) / 查 O(F) | 中 | 高 | 視角固定可考慮 |
| Roberts | O(E²) | 中 | 限凸多面體 | 不適合（家具非凸） |
| Appel QI | O(E·F) | 高 | 最高 | 過度工程 |
| Scan-line | O(scanlines·F) | 中 | 低（raster） | 不適合 SVG |

### E2. Painter's Algorithm（推薦實作）
**核心**：face 依深度排序，從遠到近；對每條 edge，與每個擋在前面的 face 做 2D 多邊形剪裁——剪出的部分實線、被剪掉的虛線。

```
faces.sortBy(avgZ DESC)
for edge in edges:
  segments = [edge]
  for face in faces where face.maxZ > edge.minZ:
    segments = clip2D(segments, face.projected2DPolygon)
  draw visible as solid, hidden as dashed
```

**正投影特化加速**（家具沿主軸看）：
1. backface culling 廉價：face normal 對應分量符號就決定 front/back
2. 深度排序退化成 sort by 單一座標
3. 用 2D bucket grid：face 投影 bbox 灌進 grid，edge 只測 grid cell 裡的 face → O(E·F) → ~O(E·√F)
4. 三視圖共用 mesh，face/edge 結構不重算

### E3. 實作建議
- mesh 100–300 面，純 JS < 50ms
- 用 [polygon-clipping](https://github.com/mfogel/polygon-clipping) 做 2D 多邊形差集，5 行 code 解決 edge 切割
- 把每條 edge 切成 visible/hidden 兩個 `<path>`，hidden 套 `stroke-dasharray="3,2"`
- **先試 [three-plotter-renderer](https://github.com/neurofuzzy/three-plotter-renderer)**：專為 pen plotter 寫，已做 backface filter / profile detection / midpoint raycast occlusion，輸出就是 SVG，可能直接套就解決 80%
- Three.js `SVGRenderer` 不處理 dashed edge，只能當參考
- 共面 edge 注意 polygonOffset 避免被自己面誤判遮蔽

---

## F. 規範依據（CNS / JIS / ISO）

### F1. 規範對照
| 項目 | CNS 3 / 11666 | JIS B 0001:2019 | ISO 128 |
|------|--------------|----------------|---------|
| 線寬數列 (mm) | 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0 | 同 | 0.13 起，同 |
| 線寬比例 | 細:中:粗 = 1:2:4 | 細:粗 = 1:2 | 1:2:4 |
| 箭頭夾角 | **20°**（強制） | ~15–30°（無強制） | ~15° |
| 字高最小 | 2.5mm | 2.5mm | 2.5mm |
| 投影法 | 第三角法（台灣慣例） | 第三角法 | 兩者皆可 |

### F2. 木工專業規範（台灣 CNS 11666 系列）
| 編號 | 主題 |
|------|------|
| CNS 11666-1 | 木工製圖總則 |
| CNS 11666-2 | 製圖符號 |
| CNS 11666-3 | 木材表面織構（粗糙度）符號 |
| CNS 11666-4 | 公差與配合（木工專用） |

> 注意：**CNS 11567 是建築製圖**，不是木工。坊間常混淆。

### F3. 木工配合公差（CNS 11666-4）
木材吸濕脹縮，公差約 ±0.5 ~ ±1.0 mm（不是機械的 ±0.01-0.1）。
| 配合 | 偏差 |
|------|------|
| 緊配 / 壓入 | 負偏差 0.1–0.3mm |
| 滑配 / 活榫 | ±0 |
| 鬆配 / 可拆 | 正偏差 0.3–0.5mm |

機械級 H7/g6 等代號對木工沒意義，**不要寫**。

### F4. 木材剖面線（hatching）
ISO 128-50 規範材料，但木材**沒有強制統一規格**。常見：
- **橫切面**：細實線 + 不規則年輪同心曲線；中央加短橫或圓點代表髓心
- **縱切面（順紋）**：細實線拉長條波浪線，間距 2–4mm
- **合板 / 集成材**：平行細直線分層描繪，每層厚度依實際板材，層交錯方向（45°/-45°）
- **MDF / 粒片板**：滿佈細點、無方向性顆粒紋

> AutoCAD 預設「ANSI31」（45° 等距斜線）對木材是**錯誤用法**——那是金屬。

### F5. 投影符號（CNS 強制）
三視圖右下角加第三角法符號（截頭圓錐的兩視圖）。

### F6. 中文字體（CNS 3-1）
- **黑體 / 等線體**（noto-sans-tc、思源黑體）— 製圖正體
- 楷體、仿宋只用於政府公文
- 數字直立或 75° 斜體，同圖須一致
- 字高最小 2.5mm；建築圖常 3.5–5mm；筆畫粗 ≈ 字高 × 1/10

### F7. 圖紙未標註公差總則
給工廠的圖加註「未標註公差 ±1mm」這類文字（CNS 11666-4 慣例）。給客戶看的不用。

---

## G. 擴充榫卯類型（中式 / 日式）

### G1. 中式（明式家具）

#### 粽角榫
- 三方料角點交會，外表 45° 斜拼線，三棱角共一交點
- 腿料 ≥ 40×40mm；長榫 ≈ 腿厚 0.8、短榫 ≈ 0.4；斜肩 45°
- 視圖：頂視 Y 字三斜縫共點；正/側只見 45° 斜線；榫頭全藏（虛線）
- **2D 三視圖難表達內部讓位**，建議「示意圖+文字說明」

#### 霸王棖
- 端勾掛榫掛腿足內側、另端半榫插桌面下穿帶；曲線上揚 30–45°
- 截面為腿料 1/3–1/2；勾頭厚 ≈ 棖料 2/3
- 視圖：正視被腿擋；側視看曲線；底視四棖朝中心穿帶
- 曲線形隨桌型變動，**SVG 模板化會失真**，建議 3D 呈現+細節只標連接點

#### 抱肩榫
- 束腰家具腿足上端兩個半榫，束腰 45° 斜肩開三角形眼，牙條斜尖咬入；榫脊上小下大受壓越緊
- 斜肩 45°；榫脊上下寬比 ≈ 2:3；牙條厚 ≈ 腿料 0.6–0.7
- 必畫剖面，否則「上小下大」鎖緊邏輯講不清

#### 楔釘榫
- 兩弧形件「手掌形」上下交疊搭口，前端各留小直榫互鎖，中央方孔打入木楔
- 搭口長 ≈ 件徑 2–3 倍；中央楔孔正方形（≈ 件徑 0.3 倍）；楔長:厚 = 6:1
- 視圖：側視+剖面雙圖；圈椅椅圈三接、圓桌面框

#### 銀錠榫 / 蝴蝶榫
- 兩頭大中腰細的雙燕尾片，鑲入兩拼板背面跨縫淺槽，防膠失效
- 總長 80–120mm；端寬:腰寬 = 2:1；嵌入深 ≈ 板厚 1/2；燕尾角 1:6–1:7
- 純頂視即可，標端寬/腰寬/深度

#### 鈎掛榫
- 榫頭做倒鉤狀（端部上翹），對應榫眼開斜口；平推插入再下壓鎖緊
- 鉤頭斜面 60–70°；鉤頭長 ≈ 榫頭厚 1.5 倍
- 必須剖面，立面看不出鉤

#### 走馬銷
- 燕尾形木栓栽植在 A 件，B 件開葫蘆形榫眼（一寬一窄），組裝時銷頭從寬端塞入推到窄端鎖定
- 銷頭燕尾角 ≈ 1:6；銷長 ≈ 銷厚 2 倍；榫眼大孔徑為銷大端 +1mm
- 頂視必畫葫蘆形眼+燕尾路徑（虛線箭頭表示推入方向）

### G2. 日式（指物 / 建具）

#### 蟻組接（あり組接ぎ）
- 等同 western through-dovetail，但比例更陡
- 角度 ≈ 76°（**1:4**，較西式 1:6–1:8 陡）；分割奇數對稱
- 沿用現有燕尾渲染器，加「日式 1:4 vs 西式 1:6/1:8」切換即可

#### 隅留蟻組接（留形隠し蟻組み）
- 兩件外角各 45° 留斜肩，內部仍燕尾互鎖；外觀只見 45° 角線
- 留厚 ≈ 板厚 1/4–1/3（過薄易崩）；內部燕尾角 ≈ 76°
- 必畫剖面+立面對照

#### 包蟻組接（包み蟻 / 半隠し蟻）
- 燕尾從一面藏起——一塊板留厚實「包」面遮燕尾端面
- 包面厚 ≈ 板厚 1/4
- **等同現有燕尾的變體**，只需加「藏面厚度」一個參數

#### 二段三方留組接（三方留隠し蟻組）
- 箱角三面同時 45° 留接，內部兩段燕尾交錯互鎖；外觀全是斜線
- 三面留 45°；料厚 ≥ 18mm
- **2D 視圖根本看不懂，必須 3D 爆炸圖**，ROI 太低暫跳過

#### 寄蟻（寄せ蟻 / 蟻落とし）
- 主件側開燕尾形槽，副件端做對應燕尾舌；副件不從端頭推入而從上方滑落
- 槽深 ≈ 件厚 1/2；舌長 = 件厚全長
- 端面剖視最清楚

### G3. wrd 優先實作清單
**高 CP 值（建議優先）**
1. 銀錠榫 / 蝴蝶榫 — 純頂視幾何簡單，拼板實用
2. 楔釘榫 — 圈椅模板配套
3. 走馬銷 — 葫蘆形榫眼是標誌性圖示
4. 包蟻組接 — 加「藏面厚度」一個參數即可
5. 抱肩榫 — 束腰家具必備，剖面幾何固定可參數化

**中等難度（第二波）**
6. 鈎掛榫 — 加「鉤頭斜角」參數
7. 隅留蟻組接 — 燕尾基礎 + 45° 留肩，雙視圖
8. 蟻組接日式版 — 沿用燕尾渲染器，加角度切換

**不建議自動渲染**
9. 粽角榫 — 內部讓位邏輯 2D 難表達
10. 霸王棖 — 曲線非定值
11. 二段三方留組接 — 必須 3D

### G4. 全域參數建議
```ts
joinery.style: "western" | "ming" | "japanese"
// 控制角度/比例預設值：
//   western:  1:6 (軟木) / 1:8 (硬木)
//   ming:     1:6–1:7（明式偏陡）
//   japanese: 1:4（76°）
```
銀錠榫 / 走馬銷可共用「葫蘆形/蝴蝶形」幾何 primitive。

---

## H. 爆炸圖（Exploded View）

### H1. 演算法策略對照
| 策略 | 公式 | 適合 wrd 嗎 |
|------|------|------------|
| Radial-from-Centroid | `dir = normalize(center_i - O); pos += dir × dist × k` | 簡單但「炸飛」不像「拆開」 |
| **Axis-Aligned**（推薦） | 投影到主導軸（argmax \|delta\|），桌面+y、腳-y | 家具最對味 |
| Assembly-Direction | mating face 法向當 dir，沿榫頭軸推 | 榫卯特寫用 |

### H2. 第一版實作（Axis-Aligned + part type rules）
讀 wrd 現有的 part metadata（top/leg/apron/drawer），寫死規則：
```ts
type='top'    → +y axis
type='bottom' → -y axis
type='leg'    → radial in xz plane, signed
type='apron'  → 沿其長軸的法向
type='drawer' → +z (front)
```

### H3. 位移量（避免重疊）
簡化版：`distance = max(2 × size_i[axis], min_neighbour_gap)`
碰撞測試用 Three.js `Box3.intersectsBox()`。
精細版（Li et al. 2008）：sort by |delta| ascending，從內向外累積 bounding box，反覆膨脹直到不交。

### H4. 視角與動畫
- **平行投影 + iso 視角**（30°/30°）— IKEA、SolidWorks、Onshape 業界慣例
- Three.js `OrthographicCamera`，相機朝 (1,1,1)
- 爆炸度 0~1 slider 給使用者刮（scrub）比按鈕好用
- 動畫：GSAP `power2.inOut`，1.5–2.5s，從外向內 stagger 0.1–0.2s

### H5. 引導虛線（trace lines）
- 直線版：`Line2` + dashed material，`stroke-dasharray="3 2"`
- L 形折線：`mid = start + axis_dominant_component(end - start)`
- z-order：`depthTest=false` + `renderOrder=-1` 避免穿插

### H6. 複雜榫卯特寫
粽角榫、三方留組接等：**局部爆炸**——只爆該節點的 2-4 件、其他半透明（opacity 0.15）。

### H7. 沒有現成 lib
- akella/ExplodingObjects（程式可參考）
- react-three-fiber + GSAP 自己組（DevDojo 範例 30 行 demo 完）
- 結論：**自己寫 ~150 行**比找 lib 快，wrd 的 part metadata 是優勢

---

## I. 自動標註（Auto-Dimensioning）

### I1. 標註位置選擇
四側評分：`score(side) = freeWidth × freeHeight × (1 − occupancy)`
經驗法則：
- 水平尺寸（長度）→ 下方
- 垂直尺寸（寬度）→ 右側
- 孔位中心線 → 最近輪廓側

### I2. 平行多條尺寸線堆疊
規則（CNS / ISO 129-1）：
- 間距 ≥ 7mm（建議）/ 5mm（最低）
- **短在內、長在外**（near-to-far）— 短尺寸貼輪廓，長尺寸往外推，避免引線交叉
- 同方向對齊在同一基準

```ts
function stackDimensions(dims, side) {
  dims.sort((a, b) => a.length - b.length);
  let offset = 10;  // mm
  for (const d of dims) {
    d.lineOffset = offset;
    offset += 7;
  }
}
```

### I3. 碰撞偵測
- R-tree（rbush.js）做空間索引，O(log n) 查詢
- 文字 bbox 用 SVG `getBBox()` 或 canvas `measureText`

解決順序（cost 由低到高）：
1. 平移文字到尺寸線另一側
2. 沿尺寸線移動到端點外
3. 加引線拉到空白區
4. 旋轉文字 90°（最後手段）
5. 縮小字體（避免）

這是 NP-hard 的 Map Labeling 問題，用啟發式：
- Greedy with backtracking（MVP）
- Force-directed（d3-force）— 標註之間互斥
- Simulated Annealing（Christensen 1995）

### I4. 引線（Leader Line）
| 類型 | 用法 | 難度 |
|------|------|------|
| 直線 | 短距離 | 低 |
| L 形 | 90° 轉折，標孔位常用 | 中 |
| 45° 折線 | 機械製圖標準 | 中 |
| Bezier | 多障礙繞行 | 高 |

MVP：L 形 + 45°，折點在文字 bbox 角與目標點曼哈頓中點，落在輪廓內就退回 45° 直線。
進階：A* / visibility graph 找避障最短路徑（pathfinding.js）。

### I5. Chain vs Baseline 自動切換
```
if 孔位等重複特徵 && 累計誤差不敏感   → chain
if 從同一基準量測 && 精度敏感         → baseline
if 尺寸數 > 5                         → baseline
```
**家具製作偏 baseline**（從板邊量孔位最直觀），wrd 板件預設 baseline。

### I6. 數量取捨（足夠 + 不冗餘）
- 必標：板長、板寬、板厚（3 自由度）
- 特徵尺寸：每孔/榫的兩座標 + 直徑
- 可推導不標：對角線、總長 = 各段和、對稱件對稱尺寸
- 冗餘檢測：`dimA + dimB == dimC` 則 dimC 過約束，刪除短的或標 `(REF)`

### I7. wrd MVP 實作路徑
1. 每塊板獨立 SVG，固定 4 側 layout：上=長度、左=寬度、下=baseline 孔位、右=備用
2. **rbush** 做 bbox 碰撞偵測
3. Stacking 短內長外，固定間距 8mm
4. 文字碰撞只做「平移到另一側」一招
5. Leader line 只用直線 + L 形

> JS 生態這塊幾乎空白（OpenCASCADE/CadQuery 都沒自動標註），自幹 600 行內可拿到 80% 效果。

---

## J. 板材展開圖（Surface Unfolding）

### J1. 可展性判斷（Gaussian Curvature）
```
function gaussianCurvatureAtVertex(v, mesh):
  angleSum = Σ interior angles at v
  areaSum  = Σ adjacent triangle areas / 3
  K_v = (2π − angleSum) / areaSum
function isDevelopable(mesh, eps=1e-3):
  return all(|K_v| < eps for v in vertices)
```
| K | 形狀 | 可展？ |
|---|------|-------|
| K=0 | 平面、圓柱、圓錐、切線面 | 是 |
| K>0 | 球面 | 否（會撕裂） |
| K<0 | 馬鞍 | 否（會皺褶） |
| 變號 | 環面、自由曲面 | 否（必須切片） |

### J2. 圓柱展開
完整：半徑 R、高 H → 矩形 `(2πR, H)`
部分（弧角 θ rad）：寬 = `R·θ`，高 = H
弦長 `c = 2R·sin(θ/2)`，矢高 `h = R − R·cos(θ/2)`

### J3. 圓錐展開
```
slant L = √(h² + r²)
扇形半徑 = L
扇形角 α = 360° × r / L  （rad: 2π · r / L）
```

### J4. 截頂圓錐（喇叭口、收口家具）
下半徑 r₁、上半徑 r₂、垂直高 h：
```
slant s = √((r₁ − r₂)² + h²)
外半徑 R = s · r₁ / (r₁ − r₂)
內半徑 r = s · r₂ / (r₁ − r₂)
扇環角 θ = 360° × r₁ / R
```
若 r₁ ≈ r₂ 時公式發散，fallback 為部分圓柱（s × π × (r₁+r₂) 條狀）。

### J5. 任意 mesh 展開（Triangle Strip / LSCM）
- **Triangle Strip**：把 mesh 切三角形帶，沿共邊翻轉到 2D；累積失真 > 5% 換新 strip
- **LSCM**（Lévy 2002）：解 (2·#tri) × #vert 稀疏線性系統，最小化角度失真。lib：libigl `igl::lscm()`
- **ARAP**（as-rigid-as-possible）保面積較好，視覺更接近實木板狀態

### J6. 蒸彎 / 層壓彎曲補正
- 最小彎曲半徑：未蒸 R ≥ 20–30t；蒸彎 R ≥ 5t（白臘木可到 2t）
- 回彈補償：冷卻 +30%、乾燥 +1–4%；模具半徑 = 目標 × 0.7（過彎 30%）
- 層壓：單層 9–12mm；總長 = 弧長 × (1 + 5–8% 損料)
- 第 i 層長：`L_i = (R + i·t) × θ`

### J7. 木紋方向（展開後標示）
| 件 | 木紋方向 | 理由 |
|------|---------|------|
| 蒸彎/層壓彎件 | **沿弧長** | 纖維平行受力，強度最大 |
| 圓柱貼皮 | 沿弧長 | 視覺連續、避免裂 |
| 圓錐 / 截頂圓錐 | 沿母線 | 母線是直線，順紋裁切 |

### J8. wrd 元件分類建議
```ts
type ComponentType = 'developable' | 'bent-laminated' | 'sculpted'
```
- `developable` → 跑公式產 SVG，接 CutPlan
- `bent-laminated` → 產**料表**（總長 = 弧長×(1+ε)、層數）而非展開圖
- `sculpted`（鞍形椅面、雙曲椅背）→ 跳過展開，給「成形料」最小外包 bbox + 警示「展開有失真」+ max distortion

座標慣例：展開圖 origin = 板材左下，對齊 CutPlan 排料邏輯。

---

## K. 派系預設（中式家具 Style Preset）

### K1. 五大派系特徵對照
| 派系 | 比例 | 構件粗細 | 榫卯偏好 | 裝飾 | 材質 |
|------|------|---------|---------|------|------|
| **蘇作** Suzhou | 椅背:座寬 1.3-1.4；腿徑/腿高 1/22-1/25 | 細瘦（28-32mm） | 格肩榫、暗榫、霸王棖 | 線腳簡練，留白多 | 黃花梨、紫檀、櫸木 |
| **京作** Beijing | 1.2-1.3；1/16-1/18 | 中粗 | 抱肩榫、夾頭榫、粽角榫 | 雕花密集（雲龍、回紋） | 紫檀、紅木、雞翅木 |
| **廣作** Guangzhou | 1.1-1.2；1/12-1/15 | 厚實（≥45mm） | 走馬銷、明榫多、長榫到底 | 西洋捲草、貝殼，雕地深 | 老紅木、酸枝、花梨 |
| **徽作** Huizhou | 櫃高:寬 2.2-2.5 | 中細 | 透榫、燕尾榫、悶榫 | 文房題材、淺浮雕 | 楠木、櫸木、樟木 |
| **晉作** Shanxi | 桌高 820-860 | 最粗（≥1/13） | 大進大出榫、栽銷 | 大塊面雕飾、漆飾 | 核桃木、榆木 |

### K2. Preset 自動帶入參數
| 參數 | 蘇 | 京 | 廣 | 徽 | 晉 |
|------|---|---|---|---|---|
| `legThickness`（×高度） | 0.042 | 0.060 | 0.090 | 0.045 | 0.100 |
| `apronT:W` | 1:3.2 | 1:2.2 | 1:1.8 | 1:3.0 | 1:1.5 |
| `waistHeight`(mm) | 0-40 | 60-80 | 80-110 | 0-40 | 40-60 |
| `topThickness`(mm) | 25-30 | 32-38 | 38-45 | 28-32 | 40-50 |
| `joinery.preferred` | 格肩/霸王棖 | 抱肩/粽角 | 走馬銷/明榫 | 燕尾/透榫 | 大進大出 |
| `mouldingProfile` | 單線/皮條 | 雲紋/回紋 | 西洋捲草 | 兩柱香 | 平直起線 |
| `footStyle` | 內翻馬蹄 | 雕雲頭馬蹄 | 鼓腿彭牙 | 內翻矮馬蹄 | 直方足 |

### K3. UI 建議
- 下拉選單只在「中式家具」模板顯示（per `feedback_dynamic_option_visibility`）
- preset 套用後使用者改任一參數 → 跳「已偏離 XX 作預設」banner，可一鍵 revert
- 中位數當預設、極值在 advanced 面板開放（派系是傾向不是定律）

---

## L. 木紋方向結構規則

### L1. 三向強度（MPa, ~12% MC）
| 性質 | 順紋 L | 徑向 R | 切向 T | L:R:T |
|------|-------|--------|--------|-------|
| 抗拉 | 80-180 | 5-7 | 3-5 | ~30:2:1 |
| 抗壓 | 30-60 | 5-10 | 5-10 | ~6:1:1 |

**橫紋抗拉只有順紋的 1/20–1/40**。任何受拉構件，纖維必須沿受力方向。

### L2. 線收縮率（green → oven-dry）
| 樹種 | 切向 T% | 徑向 R% | T/R |
|------|---------|---------|-----|
| 松 | 6.1 | 2.1 | 2.9 |
| 紅橡 | 8.6 | 4.0 | 2.2 |
| 胡桃 | 7.8 | 5.5 | 1.4 |

順紋 < 0.1%（可視為 0）。每 1% MC 變化 → 切向 0.1–0.3%、徑向 0.05–0.15%。
**設計含意**：跨木紋接合面（桌面接腿、面板嵌邊條）必須允許橫向滑動。

### L3. 規則清單（priority 排序）

#### P0-1 順紋承載原則
受力構件（椅腿、桌腿、橫撐、面框、榫頭）長軸 = L 方向。
檢查：`angle(piece.longAxis, piece.grainDir) > 15°` → ERROR。
違反：橫紋當腿一掰就斷（橫紋抗拉只 5%）。

#### P0-2 公榫（tenon）木紋方向
公榫纖維沿榫長軸。
檢查：tenon 子 mesh 長軸 vs parent grainDir > 15° → ERROR。

#### P0-3 燕尾抽屜配置
- 抽屜「側板=tail board、前後板=pin board」（tails 抗拉開抽屜的力）
- 上下端為 half-pin 不可 half-tail（half-tail 內角短紋會崩）
- drawer template 強制 side=tails、front/back=pins

#### P0-4 跨紋寬板必須允許 movement
寬度 > 200mm 的板跨紋接合：
- 桌面用穿帶 + 鈕扣 / 8 字鐵
- 面板入溝**不上膠**（留 2-3mm 縮脹空間）
- breadboard end 中央榫上膠、兩端浮動

檢查：board.width > 200mm 且法線跨另一件 grainDir → 要求 `floating: true` 或附 movement hardware。

#### P1-5 桌面拼板年輪交替（heart-bark-heart）
flat-sawn 拼面年輪交替（bark-up / bark-down），降低整體 cup；或全 quarter-sawn。

#### P1-6 母榫壁厚
母榫到木件邊緣壁厚 ≥ 公榫厚度；端面距邊 ≥ 25mm 避免 blow-out。
檢查：mortise 邊框最薄處 < tenonThickness 或 < 8mm → ERROR；距端面 < 25mm → WARN。

#### P1-7 圓腳/曲面禁通榫
（per memory `project_wooden_ren_round_leg_joinery`）
parent.shape ∈ {round, turned, curved} 且 tenon.type=through → ERROR。

#### P1-8 面板入溝不上膠
panel 嵌 groove 留 2-3mm 縮脹；panel 寬 = 開口寬 − 2×gap − tongue 深。

#### P1-9 抽屜面板木紋走向
抽屜前板木紋**水平**（沿開拉方向看是橫向）。
檢查：drawer.front.grainDir 應與 width 軸平行。

#### P1-10 結構件節疤
腿/橫撐/榫頭 30mm 內禁大節疤。

### L4. 資料結構建議
```ts
interface Piece {
  bbox: { l, w, t };
  grainAxis: 'length' | 'width' | 'thickness';  // 99% 是 'length'
  cutType?: 'flat' | 'quarter' | 'rift';
  ringNormal?: Vec3;  // bark-side 法線（拼板用）
}
```
- **不要存 free vector** — 木工實務 grain 永遠對齊主軸
- `grainAxis` 預設 `length`，弧形貼皮才允許其他值（且必噴 WARN）
- 世界座標 grainDir = `transform.rotation × axisVector(grainAxis)`

### L5. wrd MVP 先做這四條
1. **P0-1 順紋承載**（最高 ROI）
2. **P0-2 公榫紋向**
3. **P0-4 寬板 movement**
4. **P1-6 母榫壁厚**

第二期：P0-3 燕尾、P1-5 拼板年輪交替（後者需 cutType 資料）。

---

## M. 板材力學與撓度（Span / Deflection）

### M1. 撓度公式
矩形截面慣性矩：`I = b·h³/12`（h 是受力方向板厚）。**厚度立方主導剛度** — 加厚 3mm 比加寬 50mm 有用。

| 邊界條件 | 中央集中 P | 均佈 w (N/mm) |
|---------|----------|-------------|
| 簡支樑（兩端平擱） | δ = P·L³ / (48·E·I) | δ = 5·w·L⁴ / (384·E·I) |
| 兩端固定（入榫/dado） | δ = P·L³ / (192·E·I) | δ = w·L⁴ / (384·E·I) |
| 一固一簡 | δ = 7·P·L³ / (768·E·I) | δ = w·L⁴ / (185·E·I) |
| 懸臂（出挑） | δ = P·L³ / (3·E·I) | δ = w·L⁴ / (8·E·I) |

### M2. 材料彈性模數 E（MPa, 含水率 12%）
| 材料 | E |
|------|---|
| 松木 / SPF / 雲杉 | 9,000–11,000 |
| 杉木 / 紅檜 / 扁柏 | 8,000–11,000 |
| 橡木 | 12,000–13,000 |
| 楓木 | 12,600 |
| 胡桃 | 11,500 |
| 櫸木 | 14,000 |
| 集成材 | 11,000–13,500 |
| 樺木夾板 | 7,000–10,000 ‖ / 1,500–2,500 ⊥ |
| 木芯板 | 5,500–7,500 |
| MDF | 3,500–4,000 |
| 粒片板 | 2,400–3,500 |
| OSB | 4,500–5,500 ‖ / 1,500–1,700 ⊥ |

夾板異性：載荷沿面紋平行用 E∥，垂直用 E⊥；不確定保守取 E⊥。**設計原則：長邊一定要對齊面紋**。

### M3. 撓度容許比
| 比 | 用途 |
|------|------|
| L/360 | 餐桌、書桌面、玻璃面（嚴格） |
| L/240 | 書架、餐櫃層板（一般） |
| L/180 | 工具櫃、儲物（粗放） |
| L/600 | 視覺察覺門檻（Sagulator 推薦） |

### M4. 經驗法則（書本載荷 ≈ 30kg/m，板寬 250mm，L/240）
| 材料 | 板厚 | 安全跨距 |
|------|------|---------|
| 松木 | 18 / 25mm | 750 / 950mm |
| 橡木 | 18 / 25mm | 850 / 1050mm |
| 夾板（紋平行） | 18mm | 700mm |
| 木芯板 | 18mm | 600mm |
| MDF | 18 / 25mm | 500 / 650mm |
| 粒片板 | 18mm | 400mm |

### M5. 反向求最大載荷
```
P_max (集中) = δ_max · 48·E·I / L³
w_max (均佈) = δ_max · 384·E·I / (5·L⁴)
```
撓度是使用性極限；強度極限（彎矩 M ≤ MOR·b·h²/6 / SF, SF≈3）家具一般撓度先爆，撓度檢查就夠用。

### M6. wrd 警告 pseudo-code
```ts
function checkDeflection(p: Piece, mat: Material) {
  const E = effectiveE(mat, p);  // 處理夾板方向
  const I = (p.width * p.thickness ** 3) / 12;
  const w = LOAD_PRESETS[p.loadType](p.width);
  const L = p.span;
  const delta = boundaryFormula(p.endCondition, w, L, E, I);
  const limit = L / DEFLECTION_RATIO[p.type];  // top:360, shelf:240
  const ratio = delta / limit;
  if (ratio < 0.7) return { level: 'OK' };
  if (ratio < 1.0) return { level: 'WARN', msg: `跨距偏長，預計下垂 ${delta.toFixed(1)}mm，建議加厚或加中央橫撐` };
  return { level: 'ERROR', msg: `會明顯下垂！建議：① 換 ${suggestMaterial(mat)}；② 厚度 → ${suggest}mm；③ 中央橫撐切半跨距（撓度 ÷16）` };
}
```

### M7. wrd 實作優先序
1. shelf + top 均佈簡支檢查（80% 案例）
2. 材料表先放 9 種：松/橡/胡桃/楓/夾板/木芯板/MDF/粒片板/集成材
3. 端條件用 piece type 推：榫接=fixed、平擱=simple、出挑=cantilever
4. 「中央加橫撐」按鈕：L 砍半，撓度立刻 ÷16

---

## N. 五金孔位（Hardware Hole Patterns）

### N1. 歐式杯狀鉸鏈（Cup Hinge）
- 杯孔 **Φ35mm × 12.5mm 深**
- 杯孔中心距板邊 **21.5–22.5mm**（C 值 4–5mm 最常見）
- 杯心兩側 ±**48mm** 螺絲孔（CLIP top）/ ±45.5mm（Sensys），Φ2.5mm
- 鉸鏈數：`n = ceil(door_height / 600) + 1`，最少 2 個
- 門板上下距邊緣 **80–100mm** 起算
- 側板安裝座：距板前緣 **37mm**，32mm 倍數
- Overlay：全蓋 = door_thickness − overlay；半蓋 = (side/2) − gap；內蓋 C 較大（5–7mm）

### N2. 抽屜滑軌
- **抽屜寬 = 內框淨寬 − 25mm**（per memory `project_wooden_ren_door_drawer`）
- 抽屜深 = 滑軌標稱深 − 0~10mm（標準 250/300/350/400/450/500/550mm）
- 側掛孔：距板前緣 **37mm** 第一孔，後續 **32mm 倍數**，Φ5×13mm
- 底掛 undermount：底板後端離後板 37mm 開 10mm 寬避空槽
- 推按式（TIP-ON）後端避空 ~30mm

### N3. 32mm 系統孔（層板托）
- 孔 **Φ5mm × 13mm 深**（板厚 18mm 不可鑽穿）
- 縱向間距嚴格 **32mm**
- 距板前/後緣 **37mm**
- 起始基準：距底 9mm 或 32mm 倍數 + 9mm 偏移

雙排規則：
- 板深 ≤ 200mm → 1 排（中間 37mm）
- 200–400mm → 2 排（前後各 37mm）
- > 400mm → 3 排（前/中/後）

`hole_count = floor((zone − 2×64) / 32) + 1`（edge_margin 64mm 避免太靠頂底）

### N4. 拉手 / 把手
- 標準 C/C：32 / 64 / 96 / 128 / 160 / 192 / 224 / 256 / 320 / 416 / 480mm
- 抽屜寬 < 400 → 96/128；400–600 → 128/160；600–900 → 160/192
- 抽屜拉手：水平居中，高度 = face/2 或上 1/3
- **上開門**：距底 2/3（向下伸手）；**吊櫃下開**：距頂 1/3（向上伸手）
- 距門邊水平 50–75mm

### N5. 對照表
| 五金 | 孔徑 | 孔深 | 距板邊 | 間距/CC |
|------|-----|------|-------|---------|
| 鉸鏈杯孔 | Φ35 | 12.5 | 中心 22.5 | 杯心 ±48 螺絲 |
| 鉸鏈臂 | Φ5 | 13 | 前緣 37 | 32 |
| 滑軌側掛 | Φ5 | 13 | 前緣 37 | 32 倍數 |
| 層板托 | Φ5 | 13 | 前/後 37 | 32 |
| 拉手螺絲 | Φ5 | 穿 | 視 CC | 96/128/160/192 |

### N6. 鑽孔圖規則
- 標註：座標式（板左下 0,0），列 (X, Y, Φ, depth, type)
- 圖例：杯孔 Φ35 = 粗實線圓 + ⌀35×12.5；系統孔 Φ5 = 細實線圓 + ⌀5×13
- 分層：系統孔（綠）vs 功能孔（紅）vs 避空槽（藍）

### N7. wrd Pseudo-code
```ts
function generateHolePattern(board, hardware): Hole[] {
  const holes: Hole[] = [];
  for (const hw of hardware) {
    if (hw.type === 'hinge') {
      for (const y of computeHingePositions(board.height)) {
        holes.push({ x: 22.5, y, dia: 35, depth: 12.5, kind: 'cup' });
        holes.push({ x: 22.5 - 48, y, dia: 2.5, depth: 10, kind: 'screw' });
        holes.push({ x: 22.5 + 48, y, dia: 2.5, depth: 10, kind: 'screw' });
      }
    }
    if (hw.type === 'shelfPin') {
      const rows = board.depth > 400 ? [37, board.depth/2, board.depth-37]
                 : board.depth > 200 ? [37, board.depth-37] : [board.depth/2];
      for (const x of rows)
        for (let y = 64; y < board.height - 64; y += 32)
          holes.push({ x, y, dia: 5, depth: 13, kind: 'system' });
    }
    // ... slide / pull
  }
  return holes;
}
```

---

## O. 人體工學（Ergonomics）

### O1. 椅子
| 尺寸 | OK | WARN | ERROR |
|------|----|------|-------|
| 餐椅座高 | 430-460 | 410-429 / 461-480 | <410 / >480 |
| 辦公椅座高（可調） | 410-540 | 400-409 / 541-550 | <400 / >550 |
| 座深 | 400-430 | 380-399 / 431-460 | <380 / >460（壓膕窩） |
| 座寬（單椅） | ≥400 | 380-399 | <380 |
| 座寬（扶手椅） | ≥500 | 460-499 | <460 |
| 椅背高（腰靠） | 350-500 | <350 | — |
| 椅背高（含頸） | ≥730 | 600-729 | — |
| 椅背角度（餐） | 100-105° | 95-99 / 106-110 | <90 / >115 |
| 椅背角度（辦公） | 95-100° | 90-94 / 101-105 | — |
| 扶手高 | 200-250 | 180-199 / 251-280 | <170 / >300 |

### O2. 桌子
| 類型 | 高 OK | 深 OK | 註 |
|------|-------|-------|-----|
| 餐桌 | 720-760 | 750-1100 | 椅桌差 270-310 |
| 書桌（坐） | 730-760 | 600-800 | |
| 站姿工作桌 | 950-1100 | — | 立姿肘高 −50~100 |
| 吧台 | 900-1100 | — | 配吧椅 600-800 |
| 茶几 | 380-460 | — | 沙發座面 −50~+25 |
| 邊桌 | 550-650 | 400-500 | 沙發扶手齊 |

### O3. 餐桌容量
| 人數 / 形 | 推薦 | 最小 |
|----------|------|------|
| 4 方 | 900×900 | 750×750 |
| 4 長 | 1200×800 | 1100×750 |
| 4 圓 Ø | 1100 | 900 |
| 6 長 | 1800×900 | 1500×900 |
| 6 圓 Ø | 1370 | 1200 |
| 8 圓 Ø | 1500 | 1300 |

### O4. 櫃類
| 尺寸 | OK | 依據 |
|------|------|------|
| 衣櫃總高 | 2100-2400 | 天花淨高 |
| 掛長外套 | 1400-1700mm 高 | 身高 +50 |
| 掛襯衫 | 1000-1100mm | 雙層下層 |
| 抽屜區 | ≤1300 | 俯視取物 |
| 廚房地櫃高 | 850-900 | NKBA 36 in |
| 廚房地櫃深 | 580-600 | NKBA 24 in |
| 吊櫃離檯面 | 450-600 | NKBA 18 in |
| 吊櫃深 | 300-350 | NKBA 12 in |
| 鞋櫃女鞋 | 150-180/層 | |
| 鞋櫃男鞋 | 180-220/層 | |
| 書櫃層深（書） | 220-280 | |
| 書櫃層高 | 280-380 | |

### O5. 沙發 / 床
| 尺寸 | OK | WARN |
|------|----|------|
| 沙發座高 | 400-460 | 380-399 / 461-500 |
| 沙發座深（坐） | 550-650 | 530-549 |
| 沙發座深（躺） | 800-1000 | — |
| 沙發扶手 | 600-700 | 560-599 / 701-740 |
| 床高（含床墊） | 450-600 | 400-449 / 601-650 |
| 床頭板 | 900-1200 | 850-899 / 1201-1400 |

### O6. 抽屜內高
| 用途 | 高 |
|------|---|
| 餐具 | 50-80 |
| 文具 | 60-100 |
| 衣物 | 150-200 |
| 棉被/深抽 | 200-300 |
| 外露面板 | 80-300（過 300 順手度差） |

內深 = 櫃深 − 50mm（滑軌避空，per N2）。

### O7. 與身高 H 的縮放公式
```
座高（popliteal） = H × 0.25 (±20)
書桌高           = H × 0.43
椅桌差           = H × 0.18
肘高（站）        = H × 0.63 → 工作桌高 = 肘高 −50~100
眼高（坐）        = H × 0.45 → 螢幕中心線
肩寬             = H × 0.245 → 椅寬下限 ×1.1
臀寬             = H × 0.20  → 座寬下限
膕窩深           = H × 0.27  → 座深上限
```
預設 H=1700（台灣男性中位）→ 座 425 / 餐桌 731 / 差 306mm。
派系/體型三檔：迷你（1550）/ 標準（1700）/ 高大歐美（1820）

### O8. UI 提示風格（給 hobbyist）
- 餐桌高 800 → `WARN：太高了，手肘會抬，建議 720–760mm`
- 椅深 500 → `WARN：太深，膝蓋後會壓到，建議 380–430mm`
- 椅桌差 250 → `WARN：差距太小，腿會卡，建議 270–310mm`
- 衣櫃 2600 → `ERROR：超出標準天花，建議 ≤2400mm`

---

## P. CNC 加工路徑（Toolpath）

### P1. 作業類型
| 類型 | 用途 | 演算法 | 銑刀 |
|------|------|--------|------|
| Profile cut | 切穿輪廓 | Polygon offset（外偏 r） | end mill / compression |
| Engrave | 表面淺刻 | 沿線 G01，深 0.5–2mm | V-bit / ball nose |
| Pocket | 挖槽榫眼 | Offset spiral / Zigzag | end mill |
| Drill | 定點鑽孔 | G81 / G83 啄鑽 | drill bit |
| 3D carving | 立體浮雕 | Drop-cutter / Waterline（不做） | ball nose |

### P2. 核心演算法

**Cutter Offset**（用 Clipper2 lib `js-angusj-clipper`）：
```
function offsetPath(polygon, r, side):
  return ClipperOffset.Execute(polygon, side * r, joinType=Round)
// 外切 side=+1，內挖 side=-1
```

**Pocket spiral**（推薦）：
```
inset = -bit/2
while True:
  ring = ClipperOffset(boundary, inset)
  if ring.empty: break
  rings.push(ring)
  inset -= stepover
return connectRingsAsSpiral(rings)
```

**Pocket zigzag**（最簡）：產 parallel lines → clip by polygon → chain zigzag。首尾要加 contour pass 收邊。

**路徑排序**：nearest-neighbor TSP 簡化版即可，差距 < 10%。

### P3. 切削參數對照
公式：`feed = chipload × flutes × RPM`

| 木材 | 刀徑 | 刀數 | RPM | Chipload | Feed | Pass |
|------|------|------|-----|---------|------|------|
| 軟木 | 6mm | 2 | 18000 | 0.10 | 3600 | 6-9mm |
| 軟木 | 3mm | 2 | 22000 | 0.05 | 2200 | 3-4.5mm |
| 硬木 | 6mm | 2 | 18000 | 0.07 | 2520 | 4-6mm |
| 硬木 | 3mm | 2 | 22000 | 0.04 | 1760 | 2-3mm |
| 合板 | 6mm | 2 (compression) | 18000 | 0.08 | 2880 | 6mm |
| MDF | 6mm | 2 | 18000 | 0.10 | 3600 | 8mm |
| V-bit | — | 1 | 24000 | 0.03 | 1500 | 0.3-1mm |

Stepover：粗 0.4–0.6×刀徑、精 0.1–0.3×刀徑。**順銑（climb）撕裂少，wrd 預設用 climb**（Clipper offset 順時針）。

### P4. 木工 CNC 特殊考量
- **Holding tabs**（留筋）：5–8mm 寬、1–2mm 高（金屬可 3/0.5，木頭脆要大）。實作：外輪廓最後一層 cut 沿輪廓間隔 80–150mm 抬刀
- **Pocket relief**（榫眼避空）：圓銑刀做不出方角，方榫進不去 → 四角加 1–2mm 半徑「狗骨 dogbone」凹弧
- **Plunge**：直下燒刀，pocket 入刀用螺旋（半徑 = bit/4，斜率 1° 內）
- **Compression bit**：合板上下不撕邊，但只能一刀切到底（壓縮段必須沒入板材）

### P5. wrd 階段建議

**MVP — 輸出 DXF**（解 80% 用戶需求）：每板畫成 DXF（外輪廓 + 榫眼 + 鑽孔），分層 CUT/POCKET/DRILL/ENGRAVE，操作員拿進 VCarve/Fusion CAM 自己排。**這階段就夠**。lib 用 `dxf-writer` 或自寫 ASCII。

**第二階段 — jscut JSON**：產 jscut 規格 SVG（path 用 colour/class 標 operation），用戶丟 jscut.org 一鍵生 G-code。

**第三階段 — 自家 G-code**：Clipper2 JS 做 offset + pocket，三組預設參數（軟/硬/合板），對應 GRBL / Mach3 兩方言。

**不做**：3D carving、Adaptive clearing、CAM 模擬（Carve / Fusion 已經做得很好）。

### P6. G-code 基礎
| 指令 | 作用 |
|------|------|
| G00 | 快速定位 |
| G01 F | 直線插補（切削） |
| G02 / G03 | CW / CCW 圓弧 |
| G81 / G83 | 鑽孔 / 啄鑽（**GRBL 不支援，要展開**） |
| G20 / G21 | 英吋 / 公釐 |
| M03 S | 主軸正轉 + 轉速 |

GRBL 不支援 G81、刀具補正、G41/G42。Mach3 / LinuxCNC 完整。

### P7. 開源工具鏈
| 階段 | 工具 |
|------|------|
| Polygon | Clipper2 / `js-angusj-clipper` |
| 2.5D CAM | jscut |
| 3D toolpath | OpenCAMLib |
| Nesting 排版 | SVGnest / Deepnest |

---

## Q. SVG → DXF 轉換

### Q1. DXF 格式重點
- ASCII 純文字，五段：HEADER / TABLES / BLOCKS / ENTITIES / OBJECTS
- 版本：**R12 或 R2000**（CNC/雷切業界），DWG 是 binary 私有 → **MVP 放棄**
- 每 entity 用 group code：`0` entity type、`8` layer、`10/20` x/y、`11/21` end x/y...

### Q2. SVG → DXF Entity 對照
| SVG | DXF | 註 |
|-----|-----|-----|
| `<line>` | LINE | 直接 |
| `<rect>` | LWPOLYLINE flag=1 | 4 點 + close |
| `<polyline>` | LWPOLYLINE flag=0 | |
| `<polygon>` | LWPOLYLINE flag=1 | |
| `<circle>` | CIRCLE | |
| `<ellipse>` | ELLIPSE | major axis vec + ratio |
| `<path>` | LWPOLYLINE / SPLINE / ARC | 最難（見 Q3） |
| `<text>` | TEXT / MTEXT | 中文字要轉外框 |
| `<g>` | BLOCK + INSERT 或展平 | MVP 直接展平 transform |
| `<image>` | 跳過 | 雷切多忽略 |

屬性：`stroke` color → DXF ACI（0-255）；`stroke-width` → lineweight（370 group code，0.01mm）。

### Q3. 演算法重點

**Y 軸翻轉**（SVG 向下、DXF 向上）：
```
y_dxf = viewBox.minY + viewBox.height - y_svg
```
不要只 `y = -y` 會跑到第三象限。

**單位**：HEADER `$INSUNITS = 4`（mm）+ `$MEASUREMENT = 1`，**只看 viewBox 不看 width/height attr**。

**Path 解析**（最痛）：
1. Tokenize（用 `svg-path-parser` / `svgpath`）正規化成絕對座標
2. 直線（L H V）→ LWPOLYLINE 頂點
3. Cubic Bezier（C/S）→ flatten 成多段折線（弦高誤差 0.05–0.1mm，雷切 0.05mm）
4. Quadratic（Q/T）→ 升階 cubic 再 flatten
5. Arc（A）→ 轉 center parametrization 才能寫 DXF ARC（W3C SVG spec Appendix B.2.4）
6. Z → 閉合 polyline（70 group code = 1）

**Transform 展平**：DOM 走訪累乘 CTM，apply 到每座標再寫 DXF。不要對應到 DXF BLOCK transform，mirror/skew 會爆。

### Q4. 雷切 Layer 顏色慣例
| 作業 | 顏色 | DXF ACI |
|------|------|---------|
| 切穿 CUT | 紅 | 1 |
| 雕刻 ENGRAVE | 藍 | 5 |
| 刻線 SCORE | 綠 | 3 |
| 標註不切 | 黃/灰 | 2 / 8 |

下游 RD-Works / Lightburn 用顏色分配雷射功率。

### Q5. JS Lib 比較
| Lib | 特性 | wrd 適用 |
|-----|------|---------|
| **@tarikjabiri/dxf** | TS、AutoCAD 2007+、SPLINE/ELLIPSE/MTEXT/BLOCK | **強烈推薦** |
| **dxf-writer** | API 直觀、R12、無 SPLINE | MVP 首選 |
| **maker.js** | SVG import + DXF/SVG/PNG export | 中型 |
| **dxf** | parse 用，寫不全 | 不適 |
| **inkscape CLI** | 後端 `--export-type=dxf` | Vercel serverless 部署噩夢，不適 |

### Q6. wrd 實作建議

**MVP（一週）**
1. Lib：`@tarikjabiri/dxf`（純前端打包）
2. 從 wrd 內部資料模型直接寫 DXF entity，**不要先 render SVG 再 parse 回來**會丟資訊
3. 三視圖：每視圖一個 BLOCK
4. 裁切圖：每板 BLOCK，CUT 紅色 / DRILL 藍色 / LABEL 黃色
5. 強制 mm，輸出 round 0.1mm
6. 下載：`new Blob([str], {type: 'application/dxf'})` + `<a download>`

### Q7. 要避開的坑
- **中文字**：DXF 預設 SHX 字體不含中文 → 用 `opentype.js` 把字外框拆成 polyline 輸出（**雷切首選**）
- **stroke-width 不是切割線寬**：雷切線寬是雷射光斑，by-layer 即可
- **base64 圖片**：跳過，警告使用者
- **Path arc flag**：SVG large-arc-flag / sweep-flag 跟 DXF 對應方向**相反**，用對稱形狀驗證
- **Cubic flatten 誤差**：木工 0.1mm 夠、雷切要 0.05mm
- **負數座標**：DXF OK，但部分 CAM 抗議；可平移到第一象限

---

## R. 裁切排版（Bin Packing / Nesting）

wrd cutplan 屬 2D Bin Packing with guillotine constraint。NP-hard，必走啟發式。

### R1. 演算法對照
| 演算法 | 複雜度 | 省料率 | Guillotine | 難度 |
|--------|-------|-------|-----------|------|
| BL / BLF | O(n²) | 70-80% | 否 | ★ |
| **Skyline (BL/BF)** | O(n·s) | 75-85% | 部分 | ★★（wrd 現況） |
| Guillotine split | O(n²) | 75-82% | 是 | ★★ |
| **MaxRects (BSSF)** | O(n²) | **82-90%** | 否 | ★★★（v2 推薦） |
| Hybrid GA | O(n²·G) | 85-92% | 視 | ★★★★ |
| ILP / Column Gen | 指數 | **95%+** | 視 | ★★★★★ |
| NFP + GA (Deepnest) | 很慢 | 88-95% | 否 | ★★★★★ |

### R2. Guillotine vs Free Placement
| | Guillotine | Free |
|---|------------|------|
| 限制 | 一刀切到底（板鋸） | 任意（CNC/雷切） |
| 省料 | 75-85% | 88-95% |
| wrd 受眾 | **多數**（DIY+小工坊） | 少數（有 CNC） |

**wrd 應預設 guillotine，選配 free**。

### R3. Pre-sort 策略
- **DFD（Decreasing First Dimension）**：max(w,h) 降冪 — 通用最強
- **Area Decreasing**：FFD/BFD 標配
- **Height Decreasing**：適合 Skyline column-major（wrd 現況，per memory）
- **Width Decreasing**：適合 row-major guillotine
- 紋理綁定 sort：先按紋理方向長邊降冪

實測：FFD 最壞比 11/9，BFD > FFD ≈ 5%。

### R4. MaxRects 偽碼（v2 推薦）
```
freeRects = [{x:0, y:0, w:W, h:H}]
sort(parts, by: max(w,h) desc)
for each part p:
  best = null; bestScore = ∞
  for each fr in freeRects:
    for orient in orientations(p):
      if fits(orient, fr):
        score = BSSF(fr, orient)  // Best Short Side Fit
        if score < bestScore: best = {fr, orient}; bestScore = score
  if best == null: openNewBin()
  place(p)
  splitRects = guillotineSplit(best.fr, kerf)
  freeRects = freeRects.filter(notIntersect(p)).concat(splitRects)
  pruneContained(freeRects)
```

### R5. Kerf 處理
- 推台鋸 kerf = 3.0–3.2mm（家用）/ 3.5–4.5mm（工業）
- 每零件 +kerf/2 各邊 或 split 時新 free rect 起點 +kerf
- 60 刀 × 3.2mm = 192mm 損料 ≈ 少一片大零件

wrd 加參數：`kerfMm`（預設 3）、`trimMm`（預設 5）。

### R6. 紋理約束
- 木芯板/夾板 face grain → `rotation = false`
- MDF/塑合板無紋理 → `rotation = true` 多省 3-8%
- 必須 piece metadata 掛 `grainLocked: boolean`

### R7. 切割順序（2-stage）
1. Stage 1：水平/垂直主切（rip）→ 切成「條（strip）」
2. Stage 2：條內二次切 → 切成「件」
3. 優化：最少翻板 + 主切方向與紋理一致；先大件、先長刀

### R8. 改進路線
**v2（1-2 週）**
1. Skyline-BFD → **MaxRects-BSSF** offline，省料 +5-10%
2. 加 `kerfMm` 設定（預設 3）
3. 加 `grainLocked` per-part flag
4. 餘料報告：每板剩餘可用面積（>100×100）

**v3（1 個月）**
5. 多板規格 stock list
6. Offcut 入庫（>200×200 自動進 stock pool）
7. 切割順序輸出（含翻板次數）
8. 多 packer 競賽：Skyline + Guillotine + MaxRects 取最佳

**v4（可選）**：Free placement 模式（CNC 用戶），整合 `maxrects-packer` (npm)

### R9. 推薦 lib
- `maxrects-packer`（npm）— Next.js 直接 import
- `bin-packing-2d-js`（npm）— 輕量
- `gomory`（GitHub）— 兩階段 guillotine，woodworking 導向
- Deepnest / SVGnest — free placement 參考

---

## S. 參數化曲線（Bezier / B-spline / NURBS / 線腳）

### S1. Cubic Bezier（最常用）
```
B(t) = (1-t)³P₀ + 3t(1-t)²P₁ + 3t²(1-t)P₂ + t³P₃
```
- 經過 P₀ 和 P₃，**不經過** P₁、P₂
- 起點切線方向 = (P₁ − P₀)
- C1 連續：兩段相接相鄰控制點共線等距
- 仿射不變性：對控制點變換 = 對曲線變換

### S2. B-spline (Cox-de Boor 遞迴)
```
N_{i,0}(u) = 1 if u_i <= u < u_{i+1} else 0
N_{i,p}(u) = (u-u_i)/(u_{i+p}-u_i) · N_{i,p-1}
           + (u_{i+p+1}-u)/(u_{i+p+1}-u_{i+1}) · N_{i+1,p-1}
```
- Clamped knot：頭尾各重複 p+1 次 → 經過首尾控制點（最常用）
- knot 重複度 k → C^(p−k) 連續

### S3. NURBS
B-spline + 權重 wᵢ。可**精確**表達圓、橢圓、二次曲線（Bezier 只能近似圓 0.027% 誤差用 4 段 cubic）。

單位圓 NURBS：9 控制點、knot = {0,0,0,¼,¼,½,½,¾,¾,1,1,1}、權重 = {1, √2/2, 1, ...}

### S4. de Casteljau（Bezier 求點 + 細分）
```js
function deCasteljau(P, t) {
  const Q = P.map(p => p.clone());
  for (let r = 1; r < Q.length; r++)
    for (let i = Q.length - 1; i >= r; i--)
      Q[i].lerp(Q[i-1], 1 - t);
  return Q[Q.length - 1];
}
```

### S5. Adaptive Flattening（細分到容差 ε）
```js
function flatten(P, eps, out) {
  if (chordHeight(P) < eps) { out.push(P[3]); return; }
  const [L, R] = subdivide(P, 0.5);
  flatten(L, eps, out); flatten(R, eps, out);
}
```
弦高 = max(distance(P₁ 到 P₀P₃), distance(P₂ 到 P₀P₃))。
SVG/DXF 輸出 ε = 0.1mm（雷切 0.05mm）。

### S6. 線腳（Moulding）參數化

統一資料結構：
```ts
type Moulding = {
  id: string;
  name: string;       // "皮條線" | "ogee" | ...
  width: number;
  height: number;
  path: string;       // SVG path
  params: { r?: number; flat?: number; ... };
};
```

**明式線腳**
- 皮條線：`M 0,0 L flat,0 A r,r 0 0,1 flat+2r,0 L width,0`（半圓 + 兩側平台）
- 兩柱香：兩個半圓中間夾平台
- 冰盤沿：階梯狀，多段 cubic Bezier 串接

**西式線腳**（截面公式）
- Ovolo（凸 1/4 圓）：`A r,r 0 0,1 r,-r`
- Cavetto（凹 1/4 圓）：`A r,r 0 0,0 r,-r`
- Cyma recta（S 形，凹上凸下）：兩段 1/4 圓 C1 連續
- Ogee（S 形，凸上凹下）：cyma recta 反轉

### S7. 椅背 / 椅腿曲線
- 官帽椅搭腦：3 點 quadratic Bezier，中央 P₁ 高出 30-50mm，R ≈ 800mm
- 圈椅椅圈：clamped cubic B-spline，5-7 控制點繞圓心橢圓化
- 馬蹄腿（cabriole）：兩段 cubic Bezier 形成 S 曲線（cyma）
- 鼓腿彭牙：單段 quadratic，P₁ 向外推

### S8. Sweep / Revolve
**Revolve**（車削椅腿，Three.js `LatheGeometry`）：
```
surface(u, v) = (profile_x(u)·cos(v), profile_y(u), profile_x(u)·sin(v))
```

**Sweep**（邊緣導圓，`ExtrudeGeometry` / `TubeGeometry`）：
```
surface(u, v) = path(v) + frame(v) · profile(u)
```

### S9. JS Lib 取捨
| Lib | 用途 | wrd |
|-----|------|-----|
| **Three.js 內建** | CubicBezierCurve3、CatmullRomCurve3、LatheGeometry、ExtrudeGeometry | **首選** 3D |
| **bezier-js** | 求點/切線/長度/求交/offset | 線腳 offset、CNC toolpath |
| **paper.js** | 完整 2D 曲線編輯（boolean、smooth） | 線腳編輯器 UI |
| **verb-nurbs** | 純 JS NURBS（含 surface） | 真要 NURBS 才上 |
| **opentype.js** | 字體外框 → Bezier | 雕字、招牌 |

### S10. wrd 實作優先序
1. **P0 邊緣導圓**：所有桌面/椅面套 quadratic Bezier 圓角，r ∈ {2, 5, 10, 20}mm。Three.js `ExtrudeGeometry` 的 `bevelEnabled`。**1-2 天可上**
2. **P1 線腳庫**：5-8 個 preset（皮條線/兩柱香/冰盤沿/ovolo/cavetto/cyma/ogee）SVG path 存 JSON
3. **P2 椅背搭腦**：官帽椅、圈椅模板加 quadratic/cubic Bezier 控制
4. **P3 車削輪廓編輯器**：drag 控制點 → `LatheGeometry` 即時更新
5. **P4 DXF/CNC 輸出**：adaptive flatten ε=0.1mm 後輸出 polyline
6. **P5（最後）NURBS**：cubic Bezier + B-spline 已夠 90%，NURBS 留高擬真才上

> **不需要全套 NURBS**——cubic Bezier + clamped B-spline + Three.js 內建 Lathe/Extrude 已涵蓋椅背、線腳、車削、導圓 90% 需求。

---

## T. 台灣木材市場規格

### T1. 分 → mm 轉換
| 台分 | mm | 用途 |
|------|----|------|
| 1 分 | 3.03 (≈3) | 薄合板、貼皮 |
| 2 分 | 6.06 (≈6) | 背板、抽屜底 |
| 3 分 | 9.09 (≈9) | 線板、薄門板 |
| 4 分 | 12.12 (≈12) | 抽屜側板 |
| 5 分 | 15.15 (≈15) | 集成材 |
| **6 分** | **18.18 (≈18)** | **主流板厚** |
| 8 分 | 24.24 (≈24) | 厚板桌面 |
| 1 寸 | 30.30 (≈30) | 角料、桌面 |

實務上「6分板」業界直接念 18mm。

### T2. 尺與才積
- 1 台寸 = 30.3mm；1 台尺 = 303mm
- 1 英呎 = 304.8mm（差 1.8mm，板材標尺常混用）
- 4×8 尺板：1212×2424（台尺）/ 1220×2440（公制 ISO）

**1 才 = 1 寸 × 1 寸 × 10 尺 = 30.3 × 30.3 × 3030mm = 2,781.87 cm³**
- 簡記：1 才 ≈ 2782 cc，1 m³ ≈ 360 才
- 才數 = 厚(寸) × 寬(寸) × 長(尺)

### T3. 板材規格
| 板材 | 標準 (mm) | 常見厚度 |
|------|----------|---------|
| 木芯板 | 1220×2440 | **18**, 12, 25 |
| 夾板 | 1220×2440 | 3 / 4.5 / 6 / 9 / 12 / 15 / **18** |
| 防水夾板 | 1220×2440 | 12, 18 |
| 可彎夾板 | 1220×2440 | 5.5, 9 |
| MDF | 1220×2440 | 3 / 6 / 9 / 12 / 15 / **18** / 25 |
| 塑合板 | 1220×2440 | **18**, 25 |
| 松木集成材 | 600×1800 / 800×1800 | **18**, 24, 30, 38 |
| 橡木集成材 | 600×1800 / 800×2400 | 18, 24, 30 |

### T4. 實木角料
| 寸規格 | mm | 用途 |
|--------|-----|------|
| 1×3 | 30×90 | 框料 |
| 1×4 | 30×120 | 牙條 |
| 1×6 | 30×180 | 桌面拼板 |
| 2×3 | 60×90 | 椅腳 |
| 2×4 | 60×120 | 結構材 |
| 3×3 | 90×90 | 桌腳 |
| 4×4 | 120×120 | 大桌腳/柱料 |

長度：6 / 8 / 10 / 12 尺（1818 / 2424 / 3030 / 3636mm）

### T5. 設計 vs 市售缺口
| 設計值 | 市售可選 | 處理 |
|--------|---------|------|
| 寬 280 | 250 / 300 | 取 300 修邊 20 |
| 寬 350 | 300 / 400 | 取 400 修 50，或 300 拼 |
| 厚 16 | 15 / 18 | 取 18 刨 16 |
| 厚 20 | 18 / 24 | 取 24 刨削 |
| 長 1850 | 1800 / 2400 | 取 2400 切 550 損 |
| 長 2000 | 1800 / 2400 | 取 2400 切 400 損 |

### T6. 損料常數
- 推台鋸 kerf 3mm、手持圓鋸 2.5mm、線鋸 1mm、手鋸 1.5mm
- 修邊每邊 5-10mm
- 試切首切損 30-50mm
- 排版安全餘裕 ≥ 5%

### T7. wrd 資料結構
```ts
export const STANDARD_THICKNESSES_MM = [3, 6, 9, 12, 15, 18, 24, 25, 30] as const;
export const STANDARD_SHEET_SIZES = [
  { w: 1220, l: 2440 },  // 公制 4×8
  { w: 1212, l: 2424 },  // 台尺 4×8
  { w: 600,  l: 1800 },  // 集成材小片
  { w: 800,  l: 1800 },
  { w: 800,  l: 2400 },
];
export const KERF_MM = { tableSaw: 3, circularSaw: 2.5, jigsaw: 1, handsaw: 1.5 };
export const TRIM_PER_EDGE_MM = 8;
export const TSAI_TO_M3 = 0.00278;
export const SUN_TO_MM = 30.3;
export const CHI_TO_MM = 303;
```

對齊演算法：給設計尺寸 (t, w, l) → 從 STANDARD 找最小可包覆規格 → 回傳 `{spec, wasteMm³, wastePercent, suggestion}`

UI：欄位下方加灰字「市售 18mm（你設計 16mm，刨光 2mm）」；材料單列「採購：松木集成材 18×600×1800 ×2 片，預估 NT$1,200，損料 12%」

---

## U. 中式紋樣參數化

### U1. 主要紋樣對照
| 紋樣 | 結構 | 參數 | 適合派系 |
|------|------|------|----------|
| **回紋 Meander** | 直角折線單元 × 四方連續 | a (邊長 8-20mm), t (線粗 a/4), turns | 京、晉 |
| **卐字錦 Swastika** | 4 個 L 形旋轉 90° 對稱 | a (寬), t (a/5), spacing, linked | 京、晉 |
| **如意雲頭 Ruyi** | 雲頭(270°圓弧) + 雲身(S) + 雲尾(卷收) | L, r, amp, layers | 京、廣 |
| **夔龍/拐子龍** | 折線 + 圓眼 + 卷尾 | linew, segments, headStyle, tailCurl | 京 |
| **纏枝** | S 形正弦波主莖 + 葉/花節點 | λ, A, leafDensity, flower | 廣、徽 |
| **博古** | 寫實器物（鼎/瓶/書/卷） | — 不參數化，建 SVG 圖庫 | 徽 |
| **捲草 Acanthus** | 阿基米德螺線 + 葉脈 | pitch, turns, leafCount | 廣 |
| **冰裂紋** | Voronoi tessellation | density, seed, relax | 蘇、徽 |
| **龜背紋** | 規則六邊形網格 | r | 徽 |
| **五瓣花/海棠** | n 重旋轉對稱 | petals, petalLen, coreR | 通用 |

### U2. 雲紋（如意）SVG 公式
```js
function ruyiCloud(cx, cy, r) {
  const c = 0.5523 * r;  // 圓弧 Bezier 近似
  return `M ${cx},${cy-r}
          C ${cx+c},${cy-r} ${cx+r},${cy-c} ${cx+r},${cy}
          C ${cx+r},${cy+c} ${cx+c*0.5},${cy+r*0.6} ${cx},${cy+r*0.3}
          C ${cx-c*0.5},${cy+r*0.6} ${cx-r},${cy+c} ${cx-r},${cy}
          C ${cx-r},${cy-c} ${cx-c},${cy-r} ${cx},${cy-r} Z`;
}
```

### U3. 冰裂紋（Voronoi）
```js
import { Delaunay } from "d3-delaunay";
const points = poissonDisk(w, h, minDist, seed);  // Poisson-disk 比 random 均勻
const voronoi = Delaunay.from(points).voronoi([0,0,w,h]);
return voronoi.render();
// Lloyd 鬆弛：每次迭代把點移到 cell 的 centroid，≥2 次更勻稱
```
**重點**：seed 要可重現，用 Poisson-disk 不用 `Math.random()`。

### U4. 派系紋樣偏好
| 派系 | 主紋樣 | 雕飾密度 | preset 配置 |
|------|--------|---------|-------------|
| 蘇作 | 線腳為主，少紋 | 極低 (10-20%) | meander 細、ruyi 單枚 |
| 京作 | 雲龍、回紋、夔龍、卐字錦 | 極高 (70-90%) | kuilong + meander + swastika |
| 廣作 | 西洋捲草、貝殼、束帶、纏枝 | 高 (60-80%) | acanthus + twiningVine |
| 徽作 | 博古、淺浮雕花鳥 | 中 (30-50%) | bogu 圖庫 + 小面積 vine |
| 晉作 | 卐字、福壽、漆飾大塊面 | 中（漆色搶戲） | swastika 大尺度 + fushou |

### U5. wrd 紋樣庫資料結構
```ts
type PatternId = 'meander' | 'swastika' | 'ruyi' | 'kuilong'
               | 'twiningVine' | 'bogu' | 'acanthus'
               | 'iceCrack' | 'turtle' | 'flower' | 'fushou';

interface PatternDef {
  id: PatternId;
  nameZh: string;
  category: 'geometric' | 'cloud' | 'dragon' | 'floral' | 'lattice';
  generator: (opts: PatternOptions) => SVGString;
  defaults: PatternOptions;
  schools: ('su'|'jing'|'guang'|'hui'|'jin')[];
  applicableTo: ('apron'|'waist'|'chairBack'|'panel')[];
  thumbnail: string;
}
```

統一函數簽名 `(opts) => string`，座標 viewBox `[0,0,100,100]` 正規化。
雕刻深度純 fill/stroke 表現（`stroke="#5a3a20" stroke-width="0.3"`），不展開 3D。

### U6. 實作優先序
1. **MVP**：meander + swastika + ruyi + iceCrack（4 個蓋蘇/京/晉 80%）
2. 第二批：kuilong + twiningVine + flower（補京/廣）
3. 第三批：bogu 圖庫 + acanthus（徽/廣完備）

---

## V. 椅子穩定性力學

### V1. 重心估算
```
椅子重心 h_chair ≈ 座面高 × 0.55 + 椅背高 × 0.15
人體重心 h_user  = 座面高 + 200mm（成人坐姿，腰椎 L4-L5）
合體重心 h_total = (8·h_chair + 70·h_user) / 78  ≈ h_user + 微調
                 ≈ 座面高 + 180mm（保守近似）
```
水平：人體重心約座面前緣後 150-180mm（坐骨結節後）。

### V2. 支撐多邊形與傾倒角
四腳椅支點線：
- 後仰：兩後腳連線
- 前傾：兩前腳連線
- 側向：同側兩腳連線

```
θ_back  = atan(d_back  / h_total)
θ_front = atan(d_front / h_total)
θ_side  = atan(b/2 / h_total)
```
其中 `d_back = a/2 − x_offset_back`、`d_front = a/2 + x_offset_back`、`a` 前後腳距、`b` 左右腳距、`x_offset_back` ≈ 50 + (椅背傾角°−5)·8mm

### V3. 警告閾值
| 指標 | ERROR | WARN | OK |
|------|-------|------|-----|
| 後仰 θ_back | < 8° | 8-15° | ≥ 15° |
| 側向 θ_side | < 12° | 12-20° | ≥ 20° |
| 前傾 θ_front | < 6° | 6-12° | ≥ 12° |
| 邊際比 d/h | < 0.15 | 0.15-0.3 | ≥ 0.3 |

依據：ANSI/BIFMA X5.1（商用），EN 1022（家用），JIS S 1203。

### V4. wrd Pseudo-code
```ts
function checkChairStability(c) {
  const a = c.legDepth;
  const b = (c.frontLegSpan + c.rearLegSpan) / 2;
  const hChair = c.seatH * 0.55 + c.backH * 0.15;
  const hUser  = c.seatH + 200;
  const hTotal = (c.chairMass*hChair + c.userMass*hUser) / (c.chairMass + c.userMass);
  const xBack  = 50 + (c.backTiltDeg - 5) * 8;
  const dBack  = Math.max(a/2 - xBack, 0);
  const dFront = a/2 + xBack;
  const dSide  = b/2;
  const θBack  = Math.atan(dBack  / hTotal) * 180/Math.PI;
  const θFront = Math.atan(dFront / hTotal) * 180/Math.PI;
  const θSide  = Math.atan(dSide  / hTotal) * 180/Math.PI;
  const lvl = (v, e, w) => v < e ? 'ERROR' : v < w ? 'WARN' : 'OK';
  return {
    back:  { angle: θBack,  level: lvl(θBack,  8, 15) },
    front: { angle: θFront, level: lvl(θFront, 6, 12) },
    side:  { angle: θSide,  level: lvl(θSide, 12, 20) },
    margin: Math.min(dBack, dFront, dSide) / hTotal,
  };
}
```

### V5. 反例
- 吧椅 750mm 高 + 腳距 350mm → θ_side ≈ 10.4° ERROR；修：腳底外撇 +80mm
- 細腳餐椅 380×380 + 座 450 → θ ≈ 14° WARN，靠材料剛性
- 後仰躺椅 30° → 重心後移 ~200mm，後腳離座面後緣 < 100mm 直接倒；傳統休閒椅後腳外伸 100-150mm 補償
- 三腳凳邊緣坐：靜態穩，但有效翻倒角小（內切圓半徑）

### V6. wrd 實作優先建議
**最該先上**：θ_side（公式最簡，只用 b 和 seatH，不依賴椅背參數，覆蓋率最高）
**唯一新欄位**：`backTiltDeg`（椅背傾角）
**不要做**：即時跑完整剛體模擬。靜態傾倒角夠用且 0 計算成本，每次拖滑桿都能算。

---

## W. AI 看圖推薦模板（Vision LLM）

### W1. 為何不做真 3D 重建
| 方案 | wrd 適用 | 理由 |
|------|---------|------|
| NeRF / 3DGS | 低 | 要 mesh 不是 radiance field |
| Photogrammetry | 低 | 要拍 20-50 張 |
| iPhone LiDAR | 中（要 native app） | wrd 是 Web |
| TripoSR / Trellis / Hunyuan3D | 低-中 | 家具特化沒到位、無絕對尺寸、Vercel 不能跑 GPU |
| 雲端 API（Meshy/Tripo/Luma） | 低 | mesh 不接 wrd 工程流 |
| **Vision LLM → 模板參數** | **極高** | 直接落在合法模板上，免費，1 張圖即可 |

**關鍵洞察**：wrd 輸出不是 mesh 是「模板 + 參數」。任何輸出 mesh 的方案都需要再做 mesh→ 模板擬合，**Vision LLM 直接出參數**才是最短路徑。

### W2. 推薦實作流程
1. 使用者點「上傳參考照片」
2. 前端壓縮到 1024px → 上傳 Vercel API route
3. 後端呼叫 `claude-sonnet-4` Vision API（或 4.7 Opus）
4. structured output JSON
5. 確認 modal：「我猜這是【四腳椅】，座高 ~470mm、椅背高 ~850mm、有扶手。要套用嗎？」
6. 確認後直接帶入模板 designer state

### W3. Prompt 範例
```
你是家具辨識助手。看圖判斷：
- furniture_type: 從這 26 種選一個 [chair_4leg, dining_table, ...]
- estimated_dims_mm: { width, depth, height, seat_height? }
- style_tags: ["太師椅", "束腰", "圓腳"...]
- confidence: 0–1
- notes: 給木匠看的觀察重點
回 JSON only。
```

### W4. 尺寸絕對化策略
1. **MVP**：常識先驗（座高 420-480、餐桌 720-760），LLM 推估
2. **v2**：用戶選「畫面中有信用卡 / A4 / 寶特瓶」當 reference
   - 信用卡 85.6×53.98mm 是最穩標的
3. **v3**：要求兩張不同角度 + 已知物 → DUSt3R-like 幾何

### W5. 成本
Claude Sonnet 4 vision：input ~1500 tokens（含圖）+ output ~300 tokens ≈ **$0.008/次**。月 1000 次才 $8。

### W6. 文案要點
不承諾「精準尺寸」，寫「AI 估算，請以實際丈量為準」。

### W7. 入口擴展
客戶 LINE 傳家裡舊椅子照片 → telegram bot 直接回「我猜這是 X 型椅，座高 Y」→ 木頭仁複製到 wrd。把入口接到 Telegram bot。

---

## X. 報價與工時演算法

### X1. 工時細項對照（台灣行情中位）
| 類別 | 項目 | 工時 |
|------|------|------|
| **基礎** | 板材選料+平刨+厚刨 | 0.3-0.5 hr/板（硬木 ×1.3） |
| | 縱橫切（推台鋸） | 0.05 hr/切口（CNC ×0.4） |
| | 砂磨 80→120→180→240 | ≈ 1 hr/m² 全程 |
| | 試組+微調 | 件數 × 0.3 hr |
| | 膠合+夾具 | 0.5 hr/主結構 |
| **榫卯**（手作）| 半搭/企口 | 8-12 min（router 模板砍半）|
| | 通榫 | 10-15 min |
| | 盲榫 | 12-18 min |
| | 抱肩榫 | 30-45 min |
| | 手切燕尾 | 30-45 min（抽屜 4 角 ≈ 2-3 hr）|
| | 機切燕尾（jig+router）| 8-12 min |
| | **粽角榫** | **60-120 min/角** |
| | **霸王棖（含掛榫）** | **90-180 min/支** |
| | 圓榫釘 dowel | 2-3 min |
| | 口袋孔 pocket-hole | 1-2 min |
| **車削** | 圓腳車削 | 15-25 min/支 |
| | 圓腳車紋裝飾 | +10-20 min/支 |
| **雕花** | 平面淺雕 | 1.5-3 hr/dm² |
| | 高浮雕/透雕 | 4-8 hr/dm² |
| | 線腳 router 跑模 | 2 min/m + setup 30 min |
| **拼板** | 直拼 | 0.3 hr/m 縫 |
| | 燕尾/龍鳳榫拼 | 1.5 hr/m 縫 |
| **表面處理** | 護木油（擦塗 2 道）| 0.4 hr/m² |
| | 水性漆（噴 2 底 2 面）| 0.8 hr/m² |
| | 染色+透明漆 | 1.2 hr/m² |
| | 鋼刷做舊 | +0.5 hr/m² |
| **組裝/出貨** | 五金安裝（鉸鏈/滑軌）| 10 min/組 |
| | 現場組裝+調水平 | 0.5-2 hr/件 |

> 業界俗語「三分木工、七分油工」— 表面處理工時容易被低估，**獨立科目不要併入塗裝固定金額**。

### X2. 損料率分級
- 實木 10%
- 硬雜木（紅木/胡桃）15%
- accessory 小件 25%
- 彎料/曲面 20-30%

### X3. 複雜度係數（不要憑感覺打整體分數，依特徵累加）
```
base = 1.00
形狀（取最大）：
  全直線板狀         + 0.00
  含倒角/圓角        + 0.10
  含曲線/弧形腿      + 0.30
  含雕花             + 0.50（淺）/ 1.50（深）
榫卯（取最大）：
  螺絲/口袋孔        + 0.00
  圓榫/半搭          + 0.10
  通榫/盲榫          + 0.20
  燕尾/抱肩          + 0.40
  粽角/霸王棖/一腿三牙 + 1.00–2.00
派系標籤：
  明式/京/蘇          ×1.3
  簡約北歐            ×1.0
  日式茶道具          ×1.2
最終 complexity = clamp(base + 加總, 1.0, 4.0)
```
**只套工時不套料費**。

### X4. 規模經濟（80% 學習曲線）
NASA 對「75% 手工 + 25% 機器」建議：
```
T(n) = T(1) × n^(log2(0.8)) = T(1) × n^(-0.322)
第 1 件 = 1.00 × T1
第 2 件 = 0.80
第 4 件 = 0.64
第 10 件 = 0.48
```
實作上做批次平均：`avg = T1 × n^(-0.322)`。料費不享學習折讓（線性堆積）。

### X5. wrd Pseudo-code v2
```ts
function calculateQuoteV2(design, opts) {
  // 工時分項
  const baseHours = sum(parts.map(planeAndSandHours));
  const cutHours = sum(parts.map(p => 0.05 * cutCount(p)));
  const joineryHours = sum(joineryUsages.map(j =>
    JOINERY_MIN[j.type] / 60 * j.count));
  const turningHours = roundLegs.length * 0.33;
  const carvingHours = carvingArea_dm2 * (depth==="deep" ? 6 : 2);
  const finishHours = surfaceArea_m2 * FINISH_HR[opts.finish];
  const assemblyHours = 0.5 + hardwareCount * (10/60);

  let laborHours = (baseHours + cutHours + joineryHours +
    turningHours + carvingHours + finishHours + assemblyHours)
    * complexityFactor(design)
    * batchFactor(opts.quantity);

  // 料費分項
  const woodCost = sum(materials.map(m =>
    m.bdft * (1 + wasteRate(design.category, m.kind)) * m.unitPrice));
  const finishCost = surfaceArea_m2 * FINISH_COST[opts.finish];
  const hardwareCost = sum(hardware.map(h => h.qty * h.unitPrice));
  const consumables = 200 + joineryHours * 30; // 榫多耗膠多

  // 間接成本
  const overhead = laborHours * (opts.equipmentRate + opts.shopRentPerHr);

  // 訂價
  const cost = woodCost + finishCost + hardwareCost +
               consumables + laborHours * opts.hourlyRate + overhead;
  const price = cost * (1 + opts.marginRate) * (1 + opts.designerMarkupRate);

  return { laborHours, breakdown: {...}, price };
}
```

### X6. wrd 既有程式升級建議
1. 榫卯工時走 `extractJoineryUsages` × `JOINERY_MIN_PER_UNIT` 表 — 抽出 `lib/pricing/joinery-labor.ts`
2. 表面處理工時改用「外露表面積 × finish/m²」表，不用固定 `finishingCost: 1500`
3. 複雜度開放使用者調：UI 加四檔（簡單/普通/複雜/明式高難度）→ 1.0/1.2/1.5/2.5
4. 批量學習曲線：`quantity > 1` 平均工時打折，line item 列「批量折讓 −X hr」
5. 耗材動態化：`consumables = 200 + joineryHours × 30`
6. 派系 preset：明式/北歐/日式 各自一組 hourlyRate × complexity × finishType 預設

---

## Y. 3D 渲染品質（PBR / IBL / AO / Postprocess）

### Y1. 技術階段對照
| 階段 | 技術 | 套件 | wrd |
|------|------|------|-----|
| **MVP** | HDRI 環境光 (IBL) | drei `Environment` | 立刻加 |
| MVP | ACES Filmic Tone Mapping | three core | 立刻加（0 成本）|
| MVP | PCFSoftShadowMap | three core | 立刻加 |
| MVP | AO map（烘焙） | 木紋紋理打包 | v1 |
| 中 | SSAO postprocess | `@react-three/postprocessing` | 預覽模式 |
| 中 | MeshPhysicalMaterial + clearcoat | three core | 上漆家具 |
| 中 | anisotropy（木紋方向反射）| three r163+ | 中階 |
| 中 | Bloom + Vignette + DoF | postprocessing | 出圖模式 |
| 進階 | AccumulativeShadows / SoftShadows | drei | 靜態出圖 |
| 進階 | three-gpu-pathtracer | 獨立套件 | 出最終圖才用 |

### Y2. MVP 改 Canvas 立刻見效
```tsx
<Canvas
  shadows
  gl={{
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    outputColorSpace: THREE.SRGBColorSpace,
    antialias: true,
  }}
  camera={{ position: [2, 1.5, 3], fov: 35 }}
>
  <SoftShadows size={25} samples={16} focus={0.5} />
  <Environment preset="apartment" background={false} environmentIntensity={0.8} />
  <directionalLight position={[5,8,4]} intensity={2.5} castShadow
    shadow-mapSize={[2048,2048]} shadow-bias={-0.0001} />
  ...
</Canvas>
```
drei 內建 HDRI presets：apartment / city / studio / sunset / warehouse / lobby — 零下載即用。

### Y3. 木紋 PBR Material（v2）
```tsx
<meshPhysicalMaterial
  map={albedo}
  normalMap={normal}
  roughnessMap={roughness}
  aoMap={ao}             // 需 geometry uv2（r152 後 uv1）
  aoMapIntensity={1.0}
  metalness={0}
  roughness={0.7}
  // 上漆家具
  clearcoat={0.3}
  clearcoatRoughness={0.4}
  // 木紋方向反射 (r163+)
  anisotropy={0.6}
  anisotropyRotation={Math.PI / 2}
/>
```

### Y4. 後製鏈（出圖模式）
```tsx
<EffectComposer multisampling={4}>
  <SSAO samples={31} radius={0.1} intensity={20} luminanceInfluence={0.6} />
  <Bloom mipmapBlur intensity={0.4} luminanceThreshold={0.9} />
  <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={3} />
  <Vignette offset={0.3} darkness={0.6} />
</EffectComposer>
```

### Y5. 三段品質模式
```ts
type Quality = 'edit' | 'preview' | 'render'
const cfg = {
  edit:    { shadowMap: 512,  ssao: false, bloom: false, dof: false, samples: 0 },
  preview: { shadowMap: 2048, ssao: true,  bloom: false, dof: false, samples: 4 },
  render:  { shadowMap: 4096, ssao: true,  bloom: true,  dof: true,  samples: 8 },
}
```
- **edit**：拖滑桿 60fps 流暢比畫質重要 — 全關 postprocess
- **preview**：放開滑桿觸發，等 0.5s
- **render**：「匯出圖」按鈕，AccumulativeShadows + DoF 對焦主體 + Vignette

### Y6. 木紋 procedural（cathedral grain）
wrd 已有 (commit daae5bc)，被打槍要拉更長。
- **Cathedral (flat sawn)**：3D simplex noise，**X 比 Y 長 8-15 倍**才像長條木板
- **Straight (quarter sawn)**：純條紋 + 髓線小斑點（0.5-2mm 隨機白點）
- **Burl/雜紋**：fbm noise 加旋轉場

procedural 0 紋理檔；極致照片感還是貼圖贏 — MVP procedural、render 模式換 4K 貼圖。

### Y7. 立刻可動三步
1. **今天**：`gl={{toneMapping: ACESFilmic}}` + `<Environment preset="apartment" />` + `<SoftShadows />` — 視覺立刻 +50%
2. **這週**：木紋貼圖四張一組（albedo/normal/rough/ao）+ MeshPhysicalMaterial + clearcoat 0.3，分「原木/上漆」preset
3. **下週**：preview/render 模式切換 + EffectComposer 包 SSAO + Vignette

> path tracing 等 v3 客戶報價單需要 hero shot 再上。

---

## Z. 打包出貨（Packaging & Shipping）

### Z1. 體積重 / 材積公式
**國際快遞**（DHL/FedEx/UPS）：
```
體積重 (kg) = (L × W × H cm) / 5000   # 國際空運
            = (L × W × H cm) / 6000   # 部分海運/陸運
應收費重 = MAX(實重, 體積重)
```

**台灣國內貨運**（黑貓/新竹/大榮）：
```
材積 = (L + W + H) cm    # 三邊和，台灣慣例（不是體積重）
```
台灣多採三邊和分級計費，**不是**國際的 L×W×H/5000。

**海運**：
```
CBM = L × W × H (m³)
運費 = MAX(CBM × 費率, 重量噸 × 費率)   # W/M
```

### Z2. 台灣貨運規格
| 業者 | 限制（三邊和/單邊） | 重量 | 適用 |
|------|-------------------|------|------|
| 黑貓宅急便 | 三邊和 ≤ 150cm，單邊 ≤ 100cm | 20kg | 椅子、小桌、拆裝板片 |
| 黑貓超商取貨 | 45×30×30 / 45×30×45cm | 5kg | 五金包、配件 |
| 新竹物流 | 三邊和 ≤ 220，最長 ≤ 150 | 30kg（大件 60kg）| 中型家具、長板 |
| 新竹大型 | 最長 200-240cm | 議價 | 床板、衣櫃側板 |
| 嘉里大榮 | 棧板 110×110×150 | 1000kg/棧板 | 整裝家具、批次出貨 |
| 宅配通 | 三邊和 ≤ 160 | 25kg | 一般家具 |
| DHL Express | 單邊 ≤ 120，總 ≤ 300 | 70kg/件 | 國際小件 |

**關鍵紅線**：台灣國內單邊 **≤ 150cm** 是甜蜜點，超過跳到大件議價/棧板。

### Z3. 拆裝設計（KD）決策
```
for each 接合點:
  if 接合 == 膠合 + 榫卯: 永久接合（出廠前組好）
  elif 接合 == 純榫卯（無膠）: 可拆但需客戶現場敲合 → 不建議 KD
  elif 接合 == 螺絲/偏心鎖/木榫釘: KD 候選

if 任一邊 > 150cm OR 三邊和 > 220cm: 必須 KD
elif 體積重 > 實重 × 1.5: 建議 KD
else: 整裝
```

### Z4. KD 五金優先序（IKEA 風格）
1. **偏心鎖（cam lock）+ 木榫釘（dowel）**：板對板隱形，最常用
2. **KD fitting / minifix**：可重複拆裝
3. **直角鐵 + 自攻螺絲**：粗框（衣櫃背板、桌腳橫撐）
4. **連接螺栓（connector bolt）**：床架、桌腳（重承載）

### Z5. 緩衝材
- 角保護：每外露角 + 50mm EPE 保麗龍角套
- 板平面：每片 + 5mm PE 泡棉全包
- 易碎面（玻璃、烤漆）：再加 10mm 珍珠棉
- 紙箱：5 層瓦楞 BC 楞 ≥ 0.4 kg/m²
- **包裝重 ≈ 家具實重 × 8-15%**

### Z6. 五種家具標準打包
| 家具 | 整裝可行 | KD 方案 | 箱數 |
|------|---------|---------|------|
| 椅子 450×450×900 | 可（黑貓） | 椅腳 4 + 椅面 + 靠背 | 1 |
| 餐桌 1500×900×750 | 否 | 桌面板 + 4 桌腳 + 牙條 | 2 |
| 床（雙人 2000×1500） | 否 | 床頭 + 床尾 + 邊軌×2 + 床板條 | 3 |
| 衣櫃 800×600×2400 | 否 | 側板×2 + 頂底 + 門 + 層板 + 背板 + 抽屜 | 4-5 |
| 書櫃 800×300×1800 | 否 | 側板×2 + 層板×N + 背板 | 2 |

### Z7. wrd MVP 建議
最小可行：「**單一最佳箱推薦 + 三邊和材積 + 黑貓/新竹分級報價**」
- 跳過 3D bin packing solver
- 用啟發式：板材按厚度疊、桌腳併一束、五金一袋
- 等真實出貨資料後再上 packing solver

---

## AA. 訂單管線（Design → Manufacturing）

### AA1. 管線概觀
```
[wrd 設計] → [報價] → [訂金 30-50%] → [DXF + 裁切圖 + BOM + 三視圖]
板式分流 → CAM → CNC → 封邊/鑽孔 → 五金植入
實木分流 → 人工裁料 → 機加工 → 拼板/榫接 → 雕花/車削
合流 → 組裝 + 表面處理 → QC 拍照 → 尾款 → 出貨/安裝
```

### AA2. 標準檔格式
| 環節 | 格式 | 工具 |
|------|------|------|
| 設計交付師傅 | PDF 三視圖 + DXF | AutoCAD / Illustrator（wrd 已有）|
| 設計交付工廠 | DXF 2D + STEP 3D | SolidWorks / Fusion 360 |
| 板材 nesting | DXF（顏色分 layer）| AlphaCAM / Enroute / SigmaNEST |
| CNC | G-code (.nc/.tap) | 機台 post-processor 自動產 |
| 板式櫃體 | XML / 機台原生 | Cabinet Vision / Mozaik / KD Max |
| Homag 機台 | WoodWOP MPR | WoodWOP |
| 雷切/雕花 | DXF + 顏色 layer | LightBurn |
| 五金清單 | CSV / Excel BOM | Cabinet Vision 出 |
| 板片標籤 | 條碼 PDF + 編號貼紙 | 標籤機 |

### AA3. 工廠 CAM 系統
- **AlphaCAM**（Hexagon）：歐美 CNC 木工標準
- **Cabinet Vision**：櫃體界霸主，但只吃自家設計（wrd 難直接餵）
- **Mozaik**：北美獨立工坊愛用
- **WoodWOP**：Homag/Weeke 機台原生
- **Fusion 360**：個人工坊+小工廠 CAM 入門

> **台灣現實**：多數中小木工廠是「收 PDF + DXF，師傅看圖手動操作 CNC」。完全自動化 CAM 在台灣板式大廠才有（櫻花、愛菲爾、歐德內部供應鏈）。

### AA4. 板式 vs 實木自動化差距
| 項目 | 板式 | 實木 |
|------|------|------|
| 標準化 | 高 | 低（每塊紋理不同） |
| Setup time | 短 | 長（挑料+定位） |
| 一條龍 | 是 | 否 |
| wrd 切入點 | **直接出 CAM 檔** | **出尺寸表 + 三視圖讓師傅做** |
| 損益平衡 | 5-10 件可開批次 | 通常單件接 |

### AA5. wrd 三階段
**MVP（現在 → 6 個月）**：個人接案
- wrd 出 PDF/DXF/BOM → 木頭仁工坊接單手工製作
- 訂單系統：Supabase + `/orders` 頁，狀態 enum：`draft/paid/making/qc/shipped/done`
- 訂單編號：`YYMMDD-001`
- 客戶通知：LINE Notify / Email
- 付款：綠界（國內）+ Stripe（國外）

**v2（6-18 個月）**：合作工廠半自動
- 簽 1-2 家板式工廠當供應鏈，wrd 自動寄 DXF + BOM
- 工廠端人工把 DXF 餵 AlphaCAM/Cabinet Vision
- 進度回報：工廠拍照上傳 → wrd timeline 顯示
- 客戶看到「裁切完成 / 封邊完成 / 組裝完成」三張照片
- **不要追求工廠 API**（台灣木工廠沒有）

**v3（18 個月+）**：設計交易平台
- 木匠在 wrd 上架自己會做的家具型 → 客戶下單 → 多家工坊競標
- 平台抽 10-15%
- 對標 Custommade.com / Etsy 客製化模式
- 風險：QC 不可控，要有評分+保固機制

### AA6. 數位化不可能解的環節（接受）
- 木紋配色 → 工廠拍照給客戶選板
- 上漆顏色 → 寄色板樣
- 現場安裝 → 派人去
- 最終驗收 → 影片+簽名

不要做進 wrd，做了只是讓系統變重。

### AA7. 規模經濟（板式書桌 120×60×75 粗估）
- **單件客製**：板材 NT$3,500 + 工時 6h × 800 = NT$8,300，售價 NT$15,000
- **10 件批次同款**：板材 NT$30,000 + 工時 25h × 800 = NT$50,000 → 單件 NT$5,000，售 NT$10,000
- **100 件開模**：模具 NT$30,000 + 單件 NT$3,500 → 售 NT$7,500

**5-10 件就有顯著規模效益**，wrd v3 平台若能聚集「同型訂單」批次生產，能讓客戶享半量產價格。

### AA8. 對標
- **Opendesk**（英國）：開源檔 + 全球在地工廠網絡 — **最接近 wrd 想做的事**
- **Custommade**（美國）：設計師媒合平台
- **AtFAB**：CNC 開源家具

---

## AB. 經典家具圖譜（明清 20 款）

### AB1. 學術圖譜核心
| 著作 | 對 wrd 的價值 |
|------|--------------|
| 王世襄《明式家具研究》《珍賞》 | 分類（5 大類 16 品 8 病）+ 162 件實物彩圖含尺寸 |
| Ecke《中國花梨家具圖考》 | 最早系統測繪含三視圖比例 |
| 楊耀《明式家具研究》 | 工程角度測繪+結構詳圖 |
| 田家青《清代家具》 | 清式系統，補京/廣作差異 |
| 上博莊氏館藏圖錄、故宮《明清家具》卷 | 可附「× 上博藏」「× 故宮藏」浮水印 |

### AB2. 推薦「經典 20 款」分級
**A 級｜簡單可參數化（4-6 參數搞定，6 件）**
| # | 名稱 | 典型尺寸 cm | 關鍵參數 |
|---|------|------------|---------|
| 1 | 黃花梨無束腰方凳 | 52×52×50 | 面寬/高/腿粗/棖高 |
| 2 | 黃花梨夾頭榫平頭案 | 350×62.7×93 | 長/寬/高/牙頭厚/腿粗 |
| 3 | 黃花梨夾頭榫畫案 | 151×69×82.5 | 同上 |
| 4 | 條桌（無束腰直足）| 130×40×85 | 長/寬/高/腿粗 |
| 5 | 黃花梨架格三層 | 90×45×170 | 寬/深/高/層數/板厚 |
| 6 | 燈掛椅 | 51×40×105 | 座寬/座深/座高/通高/搭腦長 |

**B 級｜中等含曲線可參數化（5 件）**
| # | 名稱 | 尺寸 cm |
|---|------|--------|
| 7 | 八仙方桌（束腰馬蹄足）| 96×96×85 |
| 8 | 六仙方桌 | 74×74×79 |
| 9 | 玫瑰椅 | 59×45×84 |
| 10 | 黃花梨大燈掛椅 | 57.5×41.5×117 |
| 11 | 圓角櫃（櫸木王世襄舊藏）| 95×50×167 |
| 12 | 翹頭案 | 200×45×85 |

**C 級｜複雜（4 件，需 mesh 模板，先簡化版）**
| # | 名稱 | 尺寸 |
|---|------|------|
| 13 | 圈椅（黃花梨五接）| 63×49.3×106 |
| 14 | 四出頭官帽椅（上博柔婉款）| 56×44×120 |
| 15 | 南官帽椅（黃花梨高扶手）| 57×43×88.6 |
| 16 | 矮南官帽椅 | 71×58×77 |

**D 級｜大件（4 件，先做框架雕花後補）**
| # | 名稱 | 尺寸 |
|---|------|------|
| 17 | 羅漢床（三屏風式）| 199×103.5×48 |
| 18 | 架子床 | 220×140×220 |
| 19 | 頂箱櫃（一對）| 100×55×220+50 |
| 20 | 黃花梨坐墩（鼓墩）| Φ34×46 |

> 明式椅人因參數：座高 ~45cm（≈ 小腿高）、座深 40cm，wrd 可作為 default 限制。

### AB3. wrd 資料結構
```ts
type ClassicFurniture = {
  id: string;                // "ming_yokeback_chair_shanghai"
  name_zh: string; name_en: string;
  category: 'chair'|'stool'|'table'|'case'|'bed'|'misc';
  template_id: string;       // 對應 wrd 既有模板
  school: 'su'|'jing'|'guang'|'hui'|'jin';
  era: 'late_ming'|'early_qing'|'mid_qing';
  source: {
    book: '王世襄珍賞'|'王世襄研究'|'Ecke'|'田家青清代'|'故宮'|'上博';
    page?: number; plate?: string; collection?: string;
  };
  thumb: string;             // /classics/thumbs/xxx.jpg
  watermark: string;         // "× 上海博物館藏"
  dimensions: {
    L,W,H: number;           // mm
    seat_h?, seat_w?, seat_d?, leg_d?, apron_h?, waist_h?: number;
  };
  features: {
    waisted: boolean;
    foot: 'straight'|'horse_hoof'|'splayed'|'round';
    joinery: ('jiatou'|'baojian'|'zongjiao'|'bawang'|'xieding')[];
    arm: 'none'|'four_out'|'south'|'rose'|'arm_chair';
    ornament: 'plain'|'beading'|'carved'|'pierced';
  };
  material_default: 'huanghuali'|'zitan'|'jichi'|'hongmu';
  notes_zh: string;
};
```

UI：選經典款 → 套 template_id + dimensions + features → 派系 preset 自動切到 school → 「× 上博藏」浮水印 → 使用者所有欄位仍可改（標 *已偏離原型*）

### AB4. 法律
- 古代尺寸是公開知識，**不涉版權**
- 已出版實測值屬學術引用，必須註明出處（書名/頁碼/圖版號）
- **不要照搬** 3D mesh / 線稿（袁荃猷手繪、Ecke 圖版仍受版權保護）
- wrd 既有模板自己生的就 OK
- 浮水印要謹慎：只在尺寸引自其著作時用，不要暗示「王世襄監製」

### AB5. Roadmap
1. **第一波 6 款（A 級）**：方凳/平頭案/畫案/條桌/架格/燈掛椅 — 直接套既有模板，2 週可上
2. **第二波 5 款（B 級）**：擴模板能力（束腰、側腳收分、翹頭）
3. **第三波 9 款（C/D 級）**：先框架版（直線化扶手/平直圍子），慢慢補曲線 spline + 雕花
4. 模板新能力：**側腳收分角**、**搭腦起翹**、**S 形靠背板**、**馬蹄足曲線**、**圍子攢接圖案**

---

## AC. 木材非視覺屬性

### AC1. 聲學
聲速 c = √(E/ρ)；阻尼 tan δ（低=共鳴持久、高=吸音溫暖）

| 木材 | 聲速 m/s | tan δ | 用途 |
|------|---------|-------|------|
| 雲杉 | 5000-6000 | 0.006-0.009 | 吉他/小提琴面板 |
| 紅松 | 4800-5400 | 0.008 | 古典吉他面板 |
| 楓 | 4400 | 0.004（低）| 提琴背板、亮音 |
| 印度玫瑰 | 3800-4200 | 0.010 | 指板、背側板 |
| 桃花心 | 4000 | 0.012（高）| 溫暖音色 |
| 胡桃 | 3900 | 0.011 | 中性、聲學透明 |

家具關聯：抽屜開合聲、桌面敲擊感。**老師傅「敲一敲聽聲音」就是在用人耳量 tan δ**。

### AC2. 氣味
| 類別 | 木材 | 主香 | 揮發週期 |
|------|------|------|---------|
| 強香 | 紅檜、扁柏 | 檜木素（柑橘樟腦）| 5-10 年衰減 |
| 強香 | 雪松 | balsamic 樟腦 | 3-5 年 |
| 強香 | 樟木 | 樟腦（防蟲）| 終身淡出 |
| 強香 | 印度檀香 | 奶香木質 | 數十年 |
| 中性 | 松、杉 | 淡松脂 | 1-2 年 |
| 異味 | 橡木 | 單寧澀酸 | 永久（與酒互動才好）|
| 過敏原 | 紫檀、紅木 | 粉塵刺激 | 加工時最嚴重 |

家具場景：衣櫃用樟/雪松、香盒用檜、廚房收納避橡木（單寧污染食物）。

### AC3. 觸感（5 大類）
- **dense-cool**：紫檀、烏木、鐵刀木 — 表面如石、導熱快、上手涼
- **oily-smooth**：黃花梨、酸枝、柚木 — 天然油脂滑順、免上漆已有光
- **warm-firm**：櫸、橡、白蠟 — 中密度、導熱慢、握感踏實
- **soft-warm**：松、杉、雲杉 — 指甲可壓痕、溫暖
- **coarse-grain**：白橡（髓線）、栗、榆 — 顆粒感明顯、未填孔粗

### AC4. 加工性（Janka 硬度為主軸）
| 木材 | Janka N | 切削 | 釘接 | 黏合 |
|------|---------|------|------|------|
| 杉/雲杉 | 1100 | 易 | 直接 | 好 |
| 松 | 1570 | 易 | 直接 | 好 |
| 櫻桃 | 4225 | 中 | 預鑽 | 好 |
| 胡桃 | 4490 | 中 | 預鑽 | 好 |
| 柚木 | 5070 | 中（鈍刀）| 預鑽 | **差**（油性）|
| 紅/白橡 | 5990-6000 | 中 | 預鑽 | 好 |
| 硬楓 | 6450 | 中 | 預鑽 | 好（易翹）|
| 印度玫瑰 | 10870 | 難 | 必鑽 | 差（油）|
| 黑檀 | 14000+ | 極難 | 必鑽 | 差 |
| 癒創木 | 20000+ | 極難磨刀 | 必鑽 | 極差 |

**踩雷點**：
- 柚/紫檀/黃花梨多油 — 上膠前用丙酮擦油，否則一週後分離
- 楓/榆易翹 — 板厚留 +2mm 修整裕度

### AC5. 耐久性（USDA 抗腐 5 級）
| 等級 | 代表 | 戶外 |
|------|------|------|
| 5 極佳 | 柚木、洋槐、紅檜、紫檀 | 是（柚木為標竿）|
| 4 佳 | 白橡、雪松、栗 | 是（需上油）|
| 3 中 | 胡桃、櫻桃 | 限有遮蔽 |
| 2 差 | 紅橡、櫸 | 否 |
| 1 極差 | 楓、樺、松、白楊、雲杉 | 否 |

抗 UV：胡桃褪色變灰、櫻桃變深紅、柚木氧化銀灰
耐衝擊：白蠟、橡、櫸（棒球棍/工具柄首選）

### AC6. 永續
- **CITES Appendix II**：所有 *Dalbergia*（紫檀屬）、所有馬達加斯加 *Diospyros*（黑檀屬部分）、Bubinga、Pernambuco
- **#15 Annotation 豁免**：≤10kg 個人攜帶 + 樂器成品免證 — **家具不在豁免名單**，整批進口必申報
- FSC：北美胡桃/櫻桃/白橡普及；東南亞柚木 FSC 較稀
- 碳足跡：本地（台灣相思/櫸/烏心石）< 北美 < 歐洲 < 非洲 < 南美

### AC7. 文化定位
| 派系 | 推薦木種 | 象徵 |
|------|---------|------|
| 明式/清式 | 黃花梨、紫檀、酸枝、雞翅 | 文人/皇室 |
| 新中式 | 胡桃、烏心石、黑檀（克制）| 當代東方 |
| 日式/禪 | 紅檜、扁柏、栓木、櫸 | 神社、長壽 |
| 北歐 | 白橡、白蠟、樺、松 | 簡約 |
| 美式工藝 | 黑胡桃、櫻桃、紅橡 | Stickley/Shaker |
| 殖民風 | 柚、桃花心 | 船舶、戶外 |
| 工業風 | 松實木 + 鐵件、舊料 | 復古、再生 |

### AC8. WoodSpec 擴充資料結構
```ts
interface WoodSpec {
  id, nameZh, nameEn, scientific: string;
  // 力學（已有）
  density, janka, E: number;
  shrinkage: { radial, tangential: number };
  // 聲學
  acoustic: { soundSpeed, tanDelta: number; tone: 'bright'|'warm'|'balanced'|'transparent' };
  // 氣味
  aroma: { intensity: 'strong'|'mild'|'none'|'unpleasant'; note?: string;
           decayYears?: number; allergen?: 'dust'|'skin'|'respiratory'|null };
  // 觸感
  tactile: ('dense-cool'|'oily-smooth'|'warm-firm'|'soft-warm'|'coarse-grain')[];
  thermalFeel: 'cool'|'neutral'|'warm';
  // 加工性 1-5
  workability: { cutting, nailing, gluing, warpRisk: 1|2|3|4|5; bluntsBlade: boolean };
  // 耐久 1-5
  durability: { decay, insect, impact: 1|2|3|4|5; uv: 'darkens'|'fades'|'greys'|'stable' };
  outdoor: boolean;
  // 永續
  cites: 'I'|'II'|'III'|null;
  fscAvailable: boolean;
  origin: 'local-tw'|'na'|'eu'|'sea'|'africa'|'sa';
  carbonTier: 1|2|3|4|5;  // 1=本地最低
  // 文化
  styles: ('ming'|'qing'|'neo-cn'|'jp'|'nordic'|'american-craft'|'colonial'|'industrial')[];
  // 視覺、商業
  colorRange, pricetag, weightAlertKg;
}
```

### AC9. UI 建議
1. **6 軸雷達圖**（硬度/加工性/耐候/香氣/環保/價格）— 0-5 normalize，雷達比文字快 10× 判讀
2. **屬性 chips**：4 個最強 tag，例「[強香][抗蟲][難黏][CITES II]」
3. **過濾器**：戶外用/有香氣/易加工/本地材/無 CITES/預算
4. **派系一鍵推薦**：選「新中式」→ 推胡桃 + 烏心石；「明式」→ 黃花梨 + 紫檀（CITES 警示）
5. **警示卡**：選柚木自動跳「⚠ 油性木，黏合前需擦丙酮 / 重量大」
6. **三維對比視圖**：兩款木並排，差異維度高亮（像 Wood Database）
7. **「敲一聽」聲音樣本**（進階）：每木種錄敲擊聲 30s 預覽
8. **CITES 角標**：受限木種右上紅角，hover 顯示豁免條件

### AC10. 落地優先序
1. 資料結構 + 雷達圖 + 文字描述卡（D2-D3，3 天）— 選材體驗從 2D 變 3D
2. 香氣/觸感/派系推薦（D4，第二批）
3. 「敲一聽」聲音樣本最後（要真去錄音）
