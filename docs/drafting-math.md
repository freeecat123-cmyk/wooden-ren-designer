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
