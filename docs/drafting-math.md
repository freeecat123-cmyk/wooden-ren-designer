# 三視圖與榫卯細節圖製圖數學

供 `lib/render/svg-views.ts` 與 `components/.../details.tsx` 等繪圖模組參考。
聚焦正投影 + 榫卯細節，不含透視 / 軸測。

---

## ⚠️ 軸慣例警示（看本 doc 前必讀）

本 doc 用**傳統製圖慣例**：`x = 寬, y = 深(後), z = 高(上)`
實際 wrd code 用 **Three.js 慣例**：`x = 寬(length), y = 高(thickness), z = 深(width)`

| 概念 | doc 慣例 | code 慣例（`Part.visible`） |
|---|---|---|
| 寬（左右） | x | length → x |
| 高（垂直） | z | thickness → y |
| 深（前後） | y | width → z |

讀 doc 公式時心裡換軸：**doc 的 z = code 的 y、doc 的 y = code 的 z**。
A1 表的「(svg_x, svg_y) = (y, −z)」對應 code 是「(svg_x, svg_y) = (z, −y)」=
`projectPart` 在 svg-views.tsx 實際做的事。

**不確定哪邊為準時先停下、問使用者**，別擅自挑。

---

## 🔍 快速 grep 索引（找 section 用）

| 我要做的事 | grep keyword | 對應 section |
|---|---|---|
| 三視圖座標投影 / silhouette | `"正視\|側視\|俯視\|projection"` | §A1 §A2 |
| hidden line 虛線判斷 | `"隱藏\|HLE"` | §A4 §E |
| 中心線 / 對稱軸 | `"中心線\|centerline"` | §A5 |
| 尺寸標註（箭頭、間距、字位、累進/並列） | `"標註\|dimension"` | §A6 |
| 剖面線（hatching） | `"剖面\|hatching"` | §A7 |
| 局部放大圖（detail view） | `"局部放大\|detail view"` | §A8 |
| 榫卯細節圖 / 公榫位置 / 強度 | `"榫\|joinery\|tenon\|mortise"` | §B §G |
| 爆炸圖 / 立體拆解 | `"爆炸\|exploded"` | §H |
| 自動標註生成 | `"自動標註\|auto-dim"` | §I |
| 板材展開 / 攤平 / 折線 | `"展開\|unfolding"` | §J |
| 派系預設（中式 / 日式 / 北歐） | `"派系\|preset"` | §K |
| 木紋方向結構 | `"木紋\|grain"` | §L |
| 板材撓度 / Span | `"span\|deflection\|撓度"` | §M |
| 五金孔位（鉸鏈 / 滑軌） | `"hardware\|hinge\|滑軌"` | §N |
| 人體工學（座高 / 靠背角 / 桌高） | `"ergonom\|人體\|座高\|靠背"` | §O |
| CNC 加工路徑 | `"toolpath\|CNC"` | §P |
| SVG → DXF 轉換 | `"DXF"` | §Q |
| 裁切排版 / bin packing / nesting | `"nesting\|bin packing\|排版"` | §R |
| 參數化曲線（Bezier / NURBS / 線腳） | `"bezier\|spline\|線腳"` | §S |
| 台灣木材市場規格 | `"台灣木材\|材積"` | §T |
| 中式紋樣 | `"紋樣\|pattern\|榫頭斷面"` | §U |
| 椅子穩定性力學 | `"穩定\|stability\|tip-over"` | §V |
| AI 看圖推薦模板 | `"vision\|GPT-4\|看圖"` | §W |
| 報價工時演算法 | `"報價\|工時\|labor"` | §X §AG |
| 3D 渲染（PBR / IBL / AO） | `"PBR\|IBL\|AO\|render"` | §Y |
| 打包出貨 / 紙箱規格 | `"打包\|出貨\|紙箱"` | §Z |
| 訂單管線 | `"訂單\|order pipeline"` | §AA |
| 明清古家具 20 款 | `"明清\|古家具\|圖譜"` | §AB |
| 木材非視覺屬性（味道 / 過敏 / 油性） | `"味道\|過敏\|油性"` | §AC |
| 配色與環境主題 | `"配色\|color science"` | §AD |
| 訂單條款 / 保險 | `"條款\|保險"` | §AE |
| 競品分析 | `"競品\|wrd 定位"` | §AF |
| 木工數位行銷 / SEO | `"SEO\|行銷\|關鍵字"` | §AH |
| 室內平面圖 / 裝潢計價 | `"室內\|裝潢\|平面圖"` | §AI |

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

### A9. 非 quarter rotation silhouette（後仰靠背 / 任意傾斜零件）

當零件有 X 軸非 90° 倍數的旋轉（例如靠背後仰 4°），`worldExtents` 算出來的
AABB 不認旋斜，導致 SVG 看不到傾斜——需要手算 silhouette polygon。

**A9.1 軸標籤**（用 code 慣例：y 上, z 後, x 寬）：
- `lyL = visible.thickness`（垂直高、局部 Y）
- `lzL = visible.width`（深度、局部 Z）
- `lxL = visible.length`（左右、局部 X）

**A9.2 X 軸旋轉公式**（局部 → 旋轉後）：
```
yR = yL · cos(θ) − zL · sin(θ)
zR = yL · sin(θ) + zL · cos(θ)
xR = xL  // X 軸不動
```

**A9.3 三視圖 silhouette 對應**：

| 視圖 | X 軸投影掉？ | silhouette 形狀 | 採樣點數 |
|---|---|---|---|
| 側視（看 Z-Y 平面） | ✓ X 不重要 | 平行四邊形（4 corner） | 4：(yL, zL) ∈ {±lyL/2} × {zMin, zMax} |
| 正視（看 X-Y 平面） | ✗ X 是螢幕橫軸 | 矩形（X 範圍固定 lxL） | 8：另加 xL ∈ {±lxL/2}，但 X 旋轉不動 X，silhouette 必為矩形：高 = max−min(yR), 寬 = lxL |
| 俯視（看 X-Z 平面） | ✗ Z 是螢幕縱軸 | 平行四邊形（4 corner） | 4：(yL, zL) ∈ {±lyL/2} × {zMin, zMax}，投影到 (x, zR) |

⚠️ **正視只取 X 一邊（4 corner）會塌成單條垂直線看不到**。X 兩端都要採。

**A9.4 face-rounded 帶 bend 的延伸**（例：弧形板大面彎曲 20mm）：
彎曲方向是局部 +Z，所以 silhouette 的 Z 範圍要拉長 |bendMm|：
```
zMin = bendMm < 0 ? −lzL/2 + bendMm : −lzL/2
zMax = bendMm > 0 ? +lzL/2 + bendMm : +lzL/2
```
再多畫一條「端面分隔線」在 zL = ±lzL/2（不含 bend），分出原板厚度 vs 彎曲延伸。
這條線也要套同樣的 X 旋轉。

**A9.5 round 圓柱不能用 `projectPartSilhouette` 通用採樣**
通用 silhouette function 假設 round shape 軸 = X（橫向 dowel），對垂直圓柱（軸 = Y，
ex: 椅腳 / 後仰靠背的圓柱支撐）會跑出三角形怪形狀。這 case 走 A9 公式手算
silhouette polygon 就對了。

**A9.6 三視圖必須同步**
改任一視圖 transform 前確認另兩個視圖會跟著對。X 旋轉只動 YZ，所以：
- 正視：X 不變、Y 範圍會拉寬（max yR − min yR）
- 側視：YZ 平面看到平行四邊形
- 俯視：X 不變、Z 範圍會拉寬

實作參考：`lib/render/svg-views.tsx` 在 default rect path 之前的 isXTilt 兜底。

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
1. ✅ **箭頭夾角從 30° 改 20°**（CNS 3-3 強制）— commit `97984df` 2026-04-28
2. **加第三角法投影符號**（CNS 強制）— 跳過：客戶看不懂（per `feedback_user_questions_signal_cut`）
3. ✅ **中文字體改黑體 / 等線體** — globals.css 已 fallback Noto Sans TC = 思源黑體，無需改

### 功能性建議
4. ✅ **三視圖加總長/寬/高三條主標註** — commit `aa3948d` 2026-04-28（加方向 prefix「寬/深/高」）
5. ✅ **燕尾榫斜度確認用 1:6 / 1:8** — commit `4efc081` 2026-04-29（pickDovetailAngle 依材料密度自動切軟硬木標準）
6. **隱藏線（虛線）** — 用 Painter's algorithm + polygon-clipping，先試 three-plotter-renderer
7. **木紋方向條紋** — 公榫木紋沿榫長軸、母榫垂直；視覺辨識度大幅提升
8. ✅ **比例尺**（100mm 參考棒）— commit `8a5b6a5` 2026-04-29（圖框左下角，含中央 tick + 「100 mm」label，靠視覺基準估其他尺寸）
9. **木材剖面用波浪線**（不要 ANSI31 45° 斜線——那是金屬）

### 榫卯擴充優先序
10. 銀錠榫、楔釘榫、走馬銷、包蟻組接、抱肩榫（高 CP 值，見 G3）

### 結構驗證（新）
11. ✅ **木紋方向檢查 MVP** — commit `aa3948d` 2026-04-28（`lib/design/grain.ts` 受力構件 leg/apron/stretcher 必須順紋；當前 templates 都正確，是 future-proof）

### 進階功能（新，估期長）
12. **爆炸圖** — Axis-Aligned + part type rules + ortho iso 視角 + slider（見 H）
13. **自動標註** — rbush + 4 側 layout + 短內長外 stacking + L 形 leader（見 I7）
14. ✅ **板材展開圖** — commit `7a79660` 2026-04-29（lib/design/unfold.ts 圓柱/圓錐/截頂/層壓+高斯曲率，純函數庫未整合 UI）
15. **派系 preset** — 中式家具加蘇/京/廣/徽/晉下拉選單（見 K2-K3）

### 結構驗證 v2
16. ✅ **撓度檢查** — commit `aa3948d` 2026-04-28（`lib/design/deflection.ts` 簡支樑均佈載重 + L/240 + 12 種材料 E 值 + 反向求建議厚度）
17. ✅ **人體工學警告** — commit `97984df` 2026-04-28（`lib/design/ergonomics.ts` 7 類家具 OK/WARN/ERROR + ErgoHints UI）

### 工程輸出 pipeline
18. **五金鑽孔圖** — 鉸鏈/滑軌/層板托/拉手孔位 + 分層 SVG（見 N7）
19. **DXF 輸出 MVP** — `@tarikjabiri/dxf`，從內部 model 直出，CUT/DRILL/ENGRAVE 分層 + ACI 顏色（見 Q6）
20. **CNC G-code（v3）** — 先 DXF（80% 解），再 jscut，最後自家 G-code（Clipper2）（見 P5）

### 裁切與曲線（新）
21. **CutPlan v2** — Skyline → MaxRects-BSSF + kerf 設定 + grainLocked（見 R8）
22. **邊緣導圓 + 線腳庫** — Three.js bevelEnabled + 5-8 個明西式線腳 preset（見 S10）
23. ✅ **市售規格對齊** — commit `aa3948d` 2026-04-28（`lib/design/standards.ts` STANDARD_THICKNESSES_MM + collectThicknessHints + DesignChecks UI）

### 美學擴充（新）
24. ✅ **中式紋樣庫** — commit `e6af139` 2026-04-29（4 個 MVP：meander/swastika/ruyi/iceCrack，純 SVG generator，未整合家具立面）

### 結構驗證 v3（新）
25. ✅ **椅子穩定性** — commit `bb67773` 2026-04-29（checkSideStability θ_side ≥ 20° OK / 12-20° WARN / < 12° ERROR，接到餐椅/凳/長椅）

### AI 入口（新）
26. **拍照推薦模板** — Claude Vision API + structured JSON，2-3 天工，月成本 $8（見 W2）

### 報價與工時（新）
27. **工時細項分項計算** — 抽 `joinery-labor.ts`、表面處理改面積×單價、複雜度四檔、批量學習曲線（見 X6）

### 視覺品質（新）
28. ⚠️ **3D 渲染 MVP** — commit `97984df` 2026-04-28（ACES tone mapping 已加；SoftShadows 因為 unpackRGBAToDepth shader 衝突暫時撤掉）
29. **三段品質模式** — edit/preview/render Quality switch + EffectComposer SSAO/Bloom/DoF（見 Y5）

### 工程交付（新）
30. ✅ **打包出貨估算** — commit `f8acc76` 2026-04-29（lib/design/shipping.ts 重量+三邊和+4 業者推薦+KD 警示，整合 DesignChecks）
31. **訂單管線 MVP** — Supabase orders 表 + LINE Notify + 綠界，工廠半自動 v2（見 AA5）

### 內容深化（新）
32. **經典家具 20 款** — 第一波 6 件 A 級，2 週可上（見 AB5）
33. ✅ **木材立體屬性** — commit `48b4d27` 2026-04-29（MaterialSpec.attrs 6 軸 + MaterialAttributesPanel 雷達圖 + 派系推薦 + CITES/油性警示）

### 三視圖 polish（新）
34. ✅ **CNS 線寬分層** — commit `8a5b6a5` 2026-04-29（標註線 0.4 / 延伸線 0.25 / 粗:細 2:1，per §C2）

### 3D 場景升級（新）
35. ✅ **環境主題切換**（5 個 preset 純白/北歐/日式/工業/中式）— commit `da6033a` 2026-04-29（地板 + 環境光 + 色溫 RGB tint，per §AD3）
36. **anisotropy 木紋方向反射** — 待實作（風險：跟 wrd 自訂 wood shader 互動需測，per §Y3）
37. **三段品質模式** edit/preview/render — 待實作（per §Y5）

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

---

## AD. 配色與環境主題（Color Science）

### AD1. 顏色空間
| 空間 | 用途 | wrd |
|------|------|-----|
| sRGB | 螢幕輸出標準 | Three.js `outputColorSpace = SRGBColorSpace`（必設） |
| HSL/HSV | 直覺調色，明度感知不均 | 不用於演算法 |
| Lab | 感知均勻 | 色差比對用 |
| **OKLCH** | 感知均勻 + L/C/H 三軸獨立 | **主力**：配色生成、明度排序、調和判斷 |
| P3 | 廣色域（紅木/深胡桃才不糊） | `THREE.ColorManagement.enabled = true` |

### AD2. 木材 OKLCH 色帶（H 集中 30-80° 暖色）
| 木種 | OKLCH | hex |
|------|-------|-----|
| 楓 / 白橡 | `oklch(82% 0.06 75)` | `#E8D4B0` |
| 松 | `oklch(78% 0.09 70)` | `#DCC093` |
| 櫻桃 | `oklch(58% 0.12 40)` | `#9C5A3C` |
| 胡桃 | `oklch(40% 0.07 50)` | `#5C4030` |
| 紫檀 | `oklch(35% 0.10 25)` | `#5A2A24` |
| 烏木 | `oklch(20% 0.02 60)` | `#2A2520` |

老化補償（場景可加 slider）：柚木 H 60→80（銀灰化）、胡桃 C 0.07→0.04（褪色）、櫻桃 L 58→48 + C +0.03（深紅化）。

### AD3. 環境 Preset（採 60-30-10：地板/牆 60%、家具 30%、布料燈具 10%）
| Preset | 牆 | 地板 | 木色 | 點綴 | 色溫 |
|--------|----|----|----|----|----|
| **Nordic** | `#F5F1EA` | `#E8D4B0` 楓 | 淺橡 | `#1A1A1A` 黑鐵 | 3000K |
| **Japandi** | `#EDE6D6` 米 | `#5C4030` 胡桃 | 淺楓對比 | `#7A8471` 苔綠 | 2700K |
| **Industrial** | `#6B6B6B` 水泥 | `#3A2A20` 深木 | 胡桃 | `#1A1A1A` 黑鐵 | 4000K |
| **Chinese** | `#F0E8D8` 米杏 | `#5A2A24` 紫檀 | 紅木 | `#3D5A3D` 軍綠 | 2700K |
| **American Modern** | `#FFFFFF` | `#9C5A3C` 櫻桃 | 中深木 | `#2C3E50` 深藍 | 3000K |
| **Mediterranean** | `#F8F4E8` | `#E8D4B0` 淺木 | 白橡 | `#4A6FA5` 海藍 | 3000K |
| **Wabi-Sabi** | `#D4C9B8` 灰土 | `#7A6850` 古木 | 老柚木 | `#2A2520` 墨黑 | 2700K |
| **Boho** | `#E8DCC8` | `#9C5A3C` 櫻桃 | 中木 | `#B85C3C` 磚紅 | 2700K |

### AD4. 搭配警告規則
- **家具與地板 ΔL > 15** → 對比 OK
- **ΔL < 5** → 同調 OK
- **5-15 是「半調髒區」→ WARN**
- 飽和點綴 C > 0.10 不超過畫面 10%
- 牆面 C < 0.04（中性，避免搶戲）

### AD5. 色溫對木色（kelvin → RGB multiplier）
| K | RGB mult | 效果 |
|---|---------|------|
| 2700K | (1.0, 0.85, 0.65) | 紅木更橘暖 |
| **3000K** | **(1.0, 0.92, 0.78)** | **居家預設** |
| 4000K | (1.0, 0.98, 0.92) | 真實木色（展示用） |
| 5000K+ | (0.95, 0.97, 1.0) | 拉藍，淺木顯髒（不建議） |

### AD6. Three.js 切換 pseudo-code
```ts
type ThemePreset = {
  id: 'nordic' | 'japandi' | ...
  wall, floor, accent: string;
  lightTempK, lightIntensity: number;
};

function applyTheme(scene, theme) {
  wallMesh.material.color.set(theme.wall);
  floorMesh.material.color.set(theme.floor);
  const rgb = kelvinToRGB(theme.lightTempK);
  ambientLight.color.setRGB(...rgb);
  ambientLight.intensity = theme.lightIntensity * 0.4;
  keyLight.color.setRGB(...rgb);
  keyLight.intensity = theme.lightIntensity;
  renderer.toneMappingExposure = theme.lightTempK >= 4000 ? 1.0 : 0.85;
  scene.environment = pmremGenerator.fromEquirectangular(
    hdrLoader.load(`/env/${theme.id}.hdr`)
  ).texture;
}

function checkPalette(woodHex, floorHex) {
  const dL = Math.abs(toOKLCH(woodHex).L - toOKLCH(floorHex).L);
  if (dL > 5 && dL < 15) {
    return { level: 'warn', msg: '家具與地板色階太接近但不一致，60% 客戶覺得髒亂' };
  }
}
```

### AD7. wrd 落地（短中長期）
**短期 2-3 天**：設計頁加「環境主題」下拉，5 組 preset；場景三件套 floor + 後牆 + ambient HDR；木色保留現有，只換 wall/floor/light
**中期**：加「自訂家裡顏色」吸色器，跑 checkPalette 警告；點綴色 swatch；色溫 slider 三檔（不要連續）
**長期**：AI 配色推薦（客戶上傳家裡照片 → 抽 dominant colors → 推薦最搭木色）；P3 色域支援

> **核心 takeaway**：3D 預覽從「孤立木色」升級「場景配色」，不需要做完整室內設計工具——5-8 組「不會出錯」preset + 60-30-10 + 半調警告就夠。

---

## AE. 訂單條款與保險

### AE1. 台灣國內運費保險
| 業者 | 預設保額 | 加保費率 |
|------|---------|---------|
| 黑貓宅急便 | 申報內，每件上限 NT$3,000（未申報）| 申報值 × 0.6%（最低 NT$30） |
| 新竹物流 | 基本責任 NT$3,000/件 | 申報值 × 0.5-1% |
| 嘉里大榮 | 棧板 NT$20,000/棧板 | 申報值 × 0.8-1.5% |
| 自營貨運 | 無保險 | 另投產險 1.5-2% |

**關鍵**：未申報只賠運費 10 倍或固定上限（民法 §634 限縮）。**家具動輒上萬，必須申報**。

### AE2. 國際運送
- DHL/FedEx 預設責任 USD 100/件（華沙/蒙特婁公約）
- 加保 0.5-3%（木製品約 1-2%）
- All-risk 包破損；basic 通常只賠全損
- **CIF**（賣方含保險到目的港）vs FOB — 客製品建議 CIF
- 海關留滯超過 14 天倉租買方負擔；HS Code 木家具 9403.xx

### AE3. 客製家具破損率
- 國內 3-5%、國際 8-15%
- 玻璃/鏡面最高，建議全保
- 木材開裂變形跟包裝、溫濕度有關 — 責任難認定
- 油漆刮傷靠開箱影片
- 拆裝零件遺失靠出貨清單拍照

### AE4. 法律重點（台灣）
- **消保法 §19**：通訊交易 7 日鑑賞期，但**客製品依「通訊交易解除權合理例外情事適用準則」§2 第 3 款不適用**
- 訂金（民法 §248-249）：上限無明文，業界 30-50%；買方違約沒收、賣方違約加倍返還
- 違約金（民法 §250-252）：「過高得酌減」，標準 20-30%
- 運送責任（§634）：常見「特約限縮」

### AE5. 保固期業界慣例
| 等級 | 保固期 | 範圍 |
|------|--------|------|
| 一般 | 3-6 個月 | 結構 |
| 中高端 | 1 年 | 結構 + 五金 |
| 高端 | 5 年-終身 | 結構（不含表面、人為） |

不保固：天然乾縮（≤ 1mm/月）、潮濕變形、人為撞擊、自行改裝

### AE6. 訂單條款必備段落
1. 雙方資訊（賣方/買方）
2. 商品（品名 + 數量 + wrd 設計編號 + 含水率 ≤12% + 公差 ±3mm）
3. 價格與付款（總價 + 訂金 50% 簽約 3 日內 + 尾款出貨前）
4. 出貨與運送（預計工期 + 含水率調節最多延 14 日 + 運費 + 保險）
5. 安裝（含/不含）
6. **驗收**（簽收 48 小時內以開箱影片報告，逾期視同合格；公差 ±3mm、平整度 ±2mm/m）
7. 保固（1 年；結構性瑕疵；不保固天然乾縮 ≤1mm/月）
8. 退換貨（**客製品依消保法 §19 不適用 7 日鑑賞期**；買方反悔訂金不退）
9. 違約（賣方逾期 30 日加倍返還訂金；買方拒收 30% 違約金）
10. 不可抗力（地震/颱風/疫情/戰爭/政府命令展延，協商不視違約）
11. 爭議解決（先協商；不成依消保法向消保官；訴訟以賣方所在地）

### AE7. wrd 應用建議
1. `/order/new` 加「運送+保險」步驟，預設「基本保險（申報值 1%）」+ 加購「全險（2%）」
2. 訂單送出前 modal 強制勾選條款，存 timestamp + IP
3. `/api/warranty-card` 自動產 PDF（購買日 + wrd 規格 + QR Code 連客戶 portal）
4. `/portal/[order-id]` 客戶查訂單、保固期、報修、開箱影片上傳
5. `terms_versions` 表存條款版本，未來改版可追溯哪份訂單適用哪版

---

## AF. 競品分析與 wrd 定位

### AF1. 市場規模
- 室內設計軟體：USD 53.7 億（2024）→ 96.6 億（2030），CAGR 10.3%
- 家具製造軟體：USD 132 億 → 201 億（2032）
- 台灣 DIY 木工估 5-10 萬活躍人口

### AF2. 競品矩陣
| 競品 | 客群 | 月費 | 中文 | 木工 | 榫卯 | 報價 |
|------|------|------|------|------|------|------|
| **SketchUp Pro** | 設計/木匠 | $33 | 部分 | 外掛 | 無 | 外掛 |
| **Fusion 360** | Maker/工程 | 免費 hobby / $85 | 是 | CAM 強 | 無 | 弱 |
| **SketchList 3D** | 木工專業 | $50 | 無 | 強 | 基本 | 有 |
| **Cabinet Vision** | 板櫃廠 | $5k-25k 一次 | 無 | 板櫃 | 無 | 強 |
| **Mozaik** | 中小櫃廠 | 月費低 | 無 | 板櫃 | 無 | 強 |
| **Roomle** | B2B 品牌 | €850-1450 | 無 | 弱 | 無 | 配置器 |
| **Sweet Home 3D** | DIY/老牌 | 免費 | 繁中 | 弱 | 無 | 弱 |
| **酷家樂 Coohom** | 設計/系統櫃 | NT$30-40k/年 | 簡中 | 板櫃 | 無 | 強 |
| **KD Max** | 系統櫃廠 | NT$30k+ 一次 | 繁中 | 板櫃 | 無 | 強 |
| **AtFAB / Opendesk** | Maker/開源 | 免費 + 工坊抽成 | 無 | CNC | 無 | 工坊報價 |

### AF3. wrd SWOT
**Strengths**
- 全球唯一 中文 + 木工專屬 + 榫卯細節圖 + 工序工時 + 板材按片計價 SaaS
- 木頭仁 200K YT 自帶教育流量+信任
- 實木家具參數化設計（圓腳/方腳、明清式）— 連 SketchList 都沒做這層
- 台灣木材市場 + 台幣定價 + CNS 規範

**Weaknesses**
- 無 CAM/CNC 出檔
- 3D 渲染寫實度 << Foyr Neo / 酷家樂
- 板櫃深度 << Cabinet Vision / Mozaik
- 單人開發、家具庫小（vs 酷家樂 200 萬模型）

**Opportunities**
- 北美純木工 SaaS 只剩 SketchList 一家英文且報價弱 → wrd 英文版能切北美獨立木匠
- 中國酷家樂走板櫃，**實木 + 榫卯華語圈空白**
- AI 看照片生成設計
- 木匠學院 + wrd 雙端綁定

**Threats**
- 酷家樂若推實木會碾壓
- SketchUp + 免費木工外掛持續壟斷愛好者
- Fusion 360 hobby 免費

### AF4. 精準定位（一句話）
> 「給華語圈實木木匠的設計+報價+教學一體化工具——榫卯、工序、板材計價、即出客戶報價單。」

**避開**：純板櫃（讓給 Mozaik/酷家樂）/ 室內空間規劃（Sweet Home/Planner 5D）/ 寫實渲染競賽（Foyr/酷家樂）/ CAM 出檔（Fusion）

**主攻**：
1. 實木家具參數化（圓腳/方腳/明清式）— 全球空白
2. 客戶端體驗（三視圖縮放、案號分享、LINE 報價）— 台灣木匠剛需
3. 教育閉環（木匠學院 + 木頭仁 YT）

### AF5. 定價對標
| 方案 | 價格 | 對標 |
|------|------|------|
| 免費版 | NT$ 0（限制） | Sweet Home 3D / Fusion hobby |
| 個人 | NT$ 290/月（年 2,990） | Foyr Basic $29 |
| 專業 | NT$ 890/月（年 8,990） | SketchList $50 |
| **終身** | **NT$ 9,990 一次** | KD Max NT$30k+ |
| 學員版 | 免費（綁學院終身會員） | 獨家 |

終身 NT$ 9,990 ≈ SketchList 一年 60%，打華語市場「對訂閱反感」痛點，同時學員版做課程招生轉換器。

### AF6. 行動順序
1. 1-3 月：英文版 landing page，主打「only Chinese-furniture parametric tool with joinery details」，切北美 maker / 華僑木匠
2. 3-6 月：明清家具派系庫（圓腳官帽椅/案/八仙桌）— 全球獨家
3. 6-12 月：AI 看照片生成設計 + 木匠社群媒合接單

---

## AG. 報價單心理學與轉換率

### AG1. 必備元素 Checklist
- LOGO + 品牌名 + 工坊地址 + LINE/電話/Email
- 客戶資訊（B2B 加統編）
- 報價編號（`WR-2026-0428-01`）+ 日期
- **有效期 14 天**（預設）
- 商品描述 + **wrd 設計圖**（三視圖 + 透視圖）
- 規格（尺寸/木種/工法/表面）
- 單價 × 數量 / 小計 / 折扣 / 稅 / 總計
- **B2C 訂金 30% / B2B 50%**
- 付款方式 + 帳號 + 出貨時程
- 保固條款 + 備註 + 簽章

### AG2. 心理學技巧（直接影響成交率）
| 技巧 | 數據 | wrd 怎麼用 |
|------|------|-----------|
| **錨定效應** | 高價前置 → 中階 +23% | 加可選欄位「市場行情 NT$50,000 / 我們 NT$35,000」 |
| **三方案誘餌** | 比單一方案 ARPU +25-40% | 基礎/標準/豪華；中階加「最多人選」標籤 |
| **左位數效應** | 99 結尾比整數 +24% | B2C 末三位 980/990；高端用整數（顯品味） |
| **分項列價** | 客戶感受「值」 | 預設展開分項 + 「總價簡版」切換鈕 |
| **訂金 30%** | 心理門檻最低 | B2C 預設 30%、B2B 50%、可覆寫 |
| **限時有效期** | 拉高轉換最高 332% | 預設 14 天，PDF 右上紅色「截止 X/Y」 |

### AG3. PDF Template 三套
| Template | 字體 | 配色 | TA |
|----------|------|------|-----|
| **A. 極簡商務**（預設） | 思源黑體 + Inter | #1a1a1a + #f5f5f5 | 設計師/工裝/一般客 |
| **B. 質感品牌** | 思源宋體 + Playfair | 米色 #f4ede4 + 深棕 #3a2e1f | 高端 5 萬以上 |
| **C. 手作溫度** | 手寫體標題 + 思源黑體內文 | 木紋邊框 + 大地色 | 年輕家庭客、學員 |

避免：大紅+雕花邊（傳統台式）— 顯廉價降信任。

### AG4. 排版規則
- 顏色 ≤ 3 種：主 + 強調 + #1a1a1a 文字（純黑太硬）
- 留白 30-40%（margin 30-40px、line-height 1.6）
- 字 10-12pt 內文、16-20pt 抬頭、**14-18pt 加粗總計**
- 版面：頭（LOGO/客戶/編號）→ 內容（圖+規格+價）→ 腳（條款/簽章）
- A4 一頁完整最佳；超過拆「報價單 + 設計圖附件」
- 信任色：藍 = 專業、綠 = 金錢/成長（總計欄可深綠）

### AG5. B2B vs B2C 預設
| 項目 | B2B | B2C |
|------|-----|-----|
| 用語 | 報價單 | 估價單 |
| 訂金 | 50% | 30% |
| 統編 | 必填 | 不顯示 |
| 設計圖 | 簡 | 必附透視圖 |
| 付款 | 30/60/90 天 | 訂金 + 完工 |
| 字體 | 極簡商務 | 質感/手作 |

### AG6. wrd 實作優先序
**P0 這個月**
1. 三套 PDF template（極簡/質感/手作），預設極簡，下拉切換
2. 報價有效期欄位，預設 14 天，PDF 角落紅色截止日
3. 訂金預設 30%（B2C）/ 50%（B2B），切換 toggle
4. 自動嵌入 wrd 三視圖 + 透視圖（已有 SVG → render PDF）
5. 報價編號自動產生（`WR-YYYY-MMDD-NN`）

**P1 下個月**
6. 三方案功能（基礎/標準/豪華）+ 「最多人選」標籤
7. 市場行情錨定欄位（可選打開）
8. 分項 vs 總價切換
9. B2B / B2C 模式切換

**P2 驗證後** A/B 測試（分項 vs 總價、3 方案 vs 1、極簡 vs 木色），收集轉換率 optimize。

---

## AH. 木工數位行銷與 SEO

### AH1. SEO 關鍵字 priority（依商業意圖 × 流量 × 木頭仁可信度）
**核心轉換型**（高優先，直接導 wrd 註冊）
1. 家具設計圖 / 客製家具 / 茶几設計圖 / 餐桌尺寸
5. 木工設計軟體 / 家具圖紙下載

**流量養客型**（教學引流，中段漏斗）
7. 榫卯種類 / 木工新手入門 / DIY 家具教學 / 木工工具推薦 / 木材種類比較 / 板材計價

**長尾轉換型**（搜尋量低意圖極強）
13. 四腳桌設計圖尺寸 / 書桌 DIY 圖紙 / 床架結構圖 / 餐椅高度標準 / 蓋3分蓋6分 / 抽屜滑軌計算 / 木工報價公式 / 自學木工順序

> Ahrefs 數據：92.42% 關鍵字月搜 < 10 次，**長尾才是 SaaS 主場**。

### AH2. 平台策略
**YouTube（70% 火力）**
- CTR 教育類平均 4.5%，目標 7%+
- **長片 + Shorts 雙開**（成長速度 +41%）
- Session time 才是關鍵：Shorts 結尾導長片，長片中段插 wrd demo 5 秒
- 國際對標：Steve Ramsey（195 萬訂）、April Wilkerson（158 萬）→ 木頭仁差異化「真實工坊 + 設計工具」

**Pinterest（被低估的家具設計沉睡金礦）**
- 月活 4.98 億，行為更像視覺搜尋引擎
- Pin 壽命幾個月到幾年（vs IG/FB 24 小時）
- niche specificity：不是「家具設計」是「日式低座 茶几 設計圖」「胡桃木 三抽斗櫃」
- **wrd 獨有飛輪**：每筆訂閱用戶生的三視圖 + 透視圖 → 自動生 Pin → 鏈回 woodenren.com 教學文 → CTA 推 wrd 試用

**IG/FB**
- Reels 3-4/週、輪播 2-3、靜態 1-2（Hootsuite 2026）
- Reels 前 2 秒鉤子定生死，優先「失敗→修復」「Before/After」
- Originality Score 嚴打搬運：YT 長片不要直搬，重剪重配字
- FB 社團：「台灣木工愛好者」「DIY 家具改造」軟引流

### AH3. 內容行銷「三類四週」節奏
| 週 | 主題 | YT 長片 | Shorts | Pinterest/Blog |
|----|------|--------|--------|---------------|
| W1 教學週 | 工具/榫卯/材料 | 1 支 15-20 分 | 3 支切片 | 1 篇 SEO 長文 |
| W2 案例週 | 客戶完成品 | 1 支 8-12 分 | 3 支 before/after | 5-10 張 Pin |
| W3 故事週 | 工坊日常/學徒 | 1 支 5-8 分 | 4 支日常 | IG Story 投票 |
| W4 產品週 | wrd 教學/報價案例 | 1 支 10 分 | 3 支「如何畫 X」 | wrd 範例 Pin pack |

### AH4. 馬上可拍的 10 個主題
1. 「我用 wrd 5 分鐘出三視圖，木匠 30 年沒這麼爽過」（產品週）
2. 「客戶傳 IG 截圖，我用 wrd 三天還原」（案例週）
3. 「板材片數計算到底怎麼算才不被坑」（教學週）
4. 「蓋3分 vs 蓋6分 vs 入柱齊平，門板差 9mm」（教學週）
5. 「我在工坊一整天 7am-9pm」（故事週 vlog）
6. 「學徒第一次做榫卯，我沒幫他」（故事週）
7. 「免費版 wrd 能做到哪、付費才解鎖什麼」（產品週）
8. Shorts：「圓腳家具千萬不要 through-tenon」（教學週）
9. Reels：「客戶報價單長這樣 vs 我學徒寫的」（產品週）
10. 「只能買 5 種木工工具，我選這 5 個」（教學週，工具商店導流）

### AH5. 關鍵建議
- **每支長片中段 30 秒固定 wrd demo**，讓觀眾從「木頭仁=木工 YouTuber」遷移到「木頭仁=設計工具供應者」
- **woodenren.com 開教學部落格**，每篇文末固定「想自己畫？試試 wrd」CTA
- **Newsletter 每週**：案例為主、教學為輔，加「最新模板」「精選 Pin」
- **棄單 follow-up**：看了報價頁 24h 沒下單 → 寄一封「我幫你看了一下這報價，這幾項可優化」（行為觸發 email 比時間排程 +35% 轉換）

### AH6. 付費廣告
- 預算測試：NT$ 5k/月起，Meta 至少 $5/天 × 6-7 天讓演算法收斂，CPC 預期 NT$ 15-60
- 受眾：已關注木頭仁 IG/FB（自訂受眾）+ 興趣 DIY/室內設計/木工 + 排除已註冊 wrd
- 80/20：80% 轉換型（看過 woodenren.com）、20% 拉新+教育

### AH7. 指標 stack
| 工具 | 用途 |
|------|------|
| GA4 + Mixpanel free | Analytics + SaaS funnel |
| MailerLite | Email（中文友善、免費 1000 訂閱） |
| Buffer 免費 | 社群排程 |
| Ubersuggest | SEO（便宜起步） |
| Notion + HubSpot 免費 | CRM |

**核心 4 個數字**：CAC、LTV、Trial→Paid 轉換率、月流失率

> Opt-out trial（刷卡才開試用）轉換 49%、Opt-in 18%、Freemium 2.6% — 免費版可加「填卡才解鎖完整三視圖」半牆

### AH8. 木頭仁 unique 飛輪
**真實工坊作品 → YT 教學流量 → 學院/工具/wrd 三產品線交叉導購 → 客戶完成品又變新內容**

重點不是學 April Wilkerson，是把「20 萬訂閱 + 工坊 + SaaS」這三個別人各只有一個的東西串起來。

---

## AI. 室內平面圖製圖規範

### AI1. 規範依據
- **CNS 11567（A1042）建築圖符號及圖例** — 台灣官方依據（不要跟 CNS 11666 木工製圖搞混）
- IDROC 補充規範
- 業界混用 CNS 標準 + 自家圖例

### AI2. 比例慣例
| 圖種 | 比例 |
|------|------|
| 整戶平面 | 1:100（標準）|
| 單房平面 | 1:50 |
| 配置平面 | 1:200 |
| 細部圖 | 1:30 / 1:20 / 1:10 / 1:5 |
| 立面 | 1:50 / 1:100 |
| 剖面 | 1:30-1:50 |

圖號代號：A=建築 / S=結構 / I=室內 / E=電氣 / P=給排水 / M=機械 / F=消防

### AI3. 牆體表示（最重要的規約）
- 既有 RC 牆：雙線粗實線 + 實心填塗（最黑最粗）
- 既有磚牆：雙線 + 斜線/磚紋
- 輕隔間：雙線中空或細點
- **拆除牆**：虛線 + ╳ 或斜線交叉，**紅色**
- **新建牆**：粗實線 + 不同填充，**藍/綠色**
- 半矮牆：雙線中空 + 標高度

### AI4. 門窗符號 + 標準尺寸
| 符號 | 表示 | 標準 mm |
|------|------|---------|
| 1/4 圓弧 | 單開門 | 房門 900×2100、玄關 900-1200×2100 |
| 兩個 1/4 圓 | 對開門 | 1500-1800×2100 |
| 平行線+中縫 | 推拉門 | 視開口 |
| 三平行線 | 一般窗 | 1200-1600 寬 |
| 同上+落地 | 落地窗 | 1800-2400×2100-2300 |

開門弧 90° 為主，180° 偶見。標 W××/H×× 在門框旁含開向。

### AI5. 平面圖必標 Checklist
- 房間名（中文：客廳/主臥/次臥/書房/廚房/浴廁/陽台）
- 面積（m² 為主，括號標坪）
- 開門方向箭頭
- 動線箭頭（設計師看的）
- 北方指北針
- 比例尺（圖右下）
- 圖框：案號、業主、設計者、日期、版次、比例
- 樓層高度 CH=ceiling height（標於房名下）

### AI6. 圖層慣例
1. 軸線/基準（細點劃線）
2. 牆體（粗實線）
3. 門窗
4. 家具（中實線）
5. 設備（廚衛/家電）
6. 文字標註
7. 尺寸標註（鏈式 + 總尺寸雙排）
8. 拆除/新建變更（紅/藍）

### AI7. 國際對照
| 地區 | 單位 | 面積 | 房型 |
|------|------|------|------|
| 台灣 | mm/cm | m² + 坪 | 3房2廳2衛 |
| 日本 | mm | 帖（≈1.62㎡）/坪 | 1LDK/2LDK |
| 中國 | mm | m² | N室N廳N衛 |
| 歐規 | mm | m² | bedroom/bath |
| 美規 | feet/inch | sq ft | bed/bath |

### AI8. wrd 擴充建議
**MVP（單房+家具）**
- 矩形房間：W×D×H（mm）
- 牆體單線示意（粗黑線）
- 1 個門（90°開門弧+寬度）+ 1-2 個窗
- 自動指北針 + 比例尺（1:50 預設）
- 家具拖拉到平面圖，自動算剩餘面積、走道寬（< 60cm 警示）

**v1**：多房間拼接、門開向選項、動線路徑、出 PNG/PDF
**v2**：CNS 牆體分既有/拆除/新建、廚衛符號庫、客戶 vs 設計師雙模式
**v3**：拍照量房（LiDAR + AI）、DXF 匯入匯出

---

## AJ. 量房工作流

### AJ1. 工具對照
| 工具 | 精度 | 價格 NT$ | 效率 |
|------|------|---------|------|
| Bosch GLM 50 C | ±1.5mm（50m） | 2500-3500 | 業界主流 |
| Stanley TLM50 | ±3mm（15m） | 1200-1800 | CP 入門 |
| 小米 / Sndway | ±2-3mm | 800-1500 | DIY |
| iPhone Pro LiDAR + RoomPlan | ±1-5cm | 內建 | 整房 5 分鐘 |
| Polycam | 約 98% | 訂閱 | 3D + 平面 |
| Magicplan | 約 95% | 訂閱 | PDF 平面 |
| Apple Measure | ±5-10cm | 內建 | 隨手量 |
| 5m 卷尺 | ±1mm | 100-300 | 真值校驗 |

**精度分層**：高端雷射 ±2mm / 中階 ±3mm / LiDAR ±1-5cm / 純 ARKit ±5-10cm

> 做家具用雷射，做平面圖初稿用 LiDAR，兩者搭配。

### AJ2. 量房 SOP（10 步）
1. 畫草圖（徒手不求比例，標牆面 A/B/C/D）
2. 總長量起（每面牆從牆角到牆角，最長那面先）
3. **對角線驗直角**（A→C / B→D 兩條，差 > 1cm 房間不方正，畢氏定理）
4. 門窗位置（牆角→門框邊→框內淨寬→框→下個牆角，三段加總 = 牆長）
5. 天花板高度（4 牆角 + 中心 5 點，樓板高低差 ±1cm）
6. 樑柱深寬（樑深影響可用淨高、柱寬影響家具卡位）
7. 窗台/開關插座離地高
8. 量兩次取平均
9. 拍照存檔（爭議用）
10. 二次量房（施工前再量）

### AJ3. 常見誤差
- 牆不直 ±2cm（台灣老屋常見）
- 地板不平 ±1cm
- 樓板高低差 1-3cm
- 塗漆/壁紙厚度 3-5mm
- 雷射光斑（深色/反光面誤差變大）

設計端對策：木作 +5-10mm 收邊縫；系統櫃 +10-20mm 調整腳；入柱齊平 ±3mm

### AJ4. wrd 整合建議
**MVP（2 週）**：3 數字建房間（W/D/H cm）+ 可選門位置；3D 場景半透明灰框，家具放進去看比例；右上即時警示「離牆 X cm」「離天花 Y cm」；報價單末頁印房間圖

**v2（1-2 月）**：完整量房 form（4 牆 + 對角線，自動算「您的牆不直 2.3cm」）；老屋勾選自動套 +10mm 收邊；匯出 PDF 量房單

**v3（半年）**：iOS native + RoomPlan API → USDZ → wrd 內部 schema；UI 明白告知「LiDAR ±5cm 不能拿去施工」

**不要做**：自己刻 ARKit / DXF 輸出 / 「掃完出施工圖」幻覺

### AJ5. 業界慣例
- 設計師量房 1-2 小時/戶（30 坪）
- 木作可現場修邊（誤差容忍高）vs 系統櫃量錯直接報廢板材（容忍低）
- 量錯責任原則歸量者；wrd 客戶自助量房 UI 要免責聲明
- 二次量房是行業常識；報價單可加「複量超 ±2cm 雙方協議」條款

---

## AK. 設備層符號（電氣/水電/空調）

### AK1. 圖號代號
| 代號 | 圖種 |
|------|------|
| A | 建築 |
| S | 結構 |
| **E** | **電氣**（燈具/插座/開關/弱電）|
| **P** | **給水排水**（衛生）|
| **M** | **空調機械** |
| F | 消防 |
| L | 景觀植栽 |

### AK2. 電氣符號（CNS 1006 + IEC 60617）
| 符號 | 意義 |
|------|------|
| `S` 或實心圓點 | 單切開關 |
| `S₂` / `S₃` | 雙切 / 三切 |
| `S_D` | 調光開關 |
| 雙橫線方框 | 一般雙插座（+WP=防水、+GR=接地）|
| 方框 `T` | 電視同軸 |
| 方框 `D` 或 `LAN` | 網路 RJ45 |
| 圓圈 `L` + 數字 | 燈具盞數（吸頂/吊燈）|
| 內含 `↓` 圓圈 | 嵌燈 downlight |
| 雙短線 | 軌道燈 |

### AK3. 水管代號（給排水）
| 代號 | 意義 |
|------|------|
| **CW** | 冷水（Cold Water）|
| **HW** | 熱水 |
| **WP** | 廢水 |
| **SP** | 污水（糞管）|
| **VP** | 通氣管 |
| **RP** | 雨水 |
| **ACP / AP** | 空調冷凝排水 |

### AK4. 水管尺寸（台制 vs 公制）
| 台制 | 外徑 mm | 用途 |
|------|---------|------|
| 3 分 | 16 | 馬桶、洗手台 |
| 4 分 | 20 | **一般家用主流** |
| 6 分 | 25 | 主供水 / 大用量 |
| 1 寸（8 分） | 32 | 戶外總進水 |

### AK5. 空調符號（M）
- 紅色矩形：分離式室內機
- 雙線粗管 + 圓圈：出風口（四向/條型/線型）
- 格柵符號：回風口
- 細線標 `Cu φ6.4 / φ12.7`：冷媒銅管

### AK6. 圖層命名與顏色
| Layer | 用途 | 顏色 |
|-------|------|------|
| E-LITE | 燈具 | 紅/黃 |
| E-POWR | 插座 | 紅 |
| E-SWCH | 開關 | 紅 |
| E-DATA | 弱電 | 灰/虛線 |
| P-WATR | 給水冷 | 藍 |
| P-WATR-H | 給水熱 | 紅粗 |
| P-DRAN | 排水 | 棕/綠虛 |
| M-AIR | 空調主管 | 綠/紫 |
| M-COND | 冷凝水 | 青點劃線 |

### AK7. 配置高度速查（最常用）
| 項目 | 標準離地 |
|------|---------|
| 一般插座 | **30 cm** |
| 流理台插座 | **110 cm** |
| 書桌插座 | 75-80 cm |
| 床頭插座 | 60 cm |
| 掃地機器人插座 | 15-20 cm |
| 一般開關 | **110-120 cm** |
| 冷氣專插 | 220-240 cm |
| 出風口距牆 | ≥ 30 cm |
| 馬桶冷水 | 22 cm |
| 洗手台給水 | 55 cm |

### AK8. wrd 應用建議
**不要做完整水電製圖**（太大）。

**設備障礙物標記層**（家具設計建議）：
- 插座 icon + 高度數字
- 開關 icon + 高度
- 出風口 + 30cm 安全距箭頭
- 給排水點藍/棕 + 高度

**碰撞檢查**：
- 家具背板擋插座 → 警告「離牆 5-10cm 留插線空間」
- 高櫃頂 vs 出風口 → 30cm 警告
- 餐邊櫃 vs 流理台插座 110cm → 高度衝突
- 嵌入式家電（冰箱/洗碗機）後方 → 預留 5-8cm

**木工要記住**：
- 桌面下藏線：書桌深 ≥ 60cm 才好藏理線盒
- 電視櫃預留穿線孔：60-80mm 圓孔，後方離牆 ≥ 5cm
- 嵌入式家電插頭面：插座要在側板，不能正後方
- 流理台下水管：U 型存水彎佔 30-35cm，下櫃抽屜深要扣

---

## AL. 系統櫃 / 木作 / 進口家具整合

### AL1. 三類比較
| 維度 | 系統櫃 | 木作（現場木工） | 進口成品 |
|------|--------|----------------|---------|
| 板材 | 18mm 塑合板 + 美耐皿 | 木芯/夾板 + 貼皮/噴漆 | 各品牌規格 |
| 客製度 | 中（模組組合） | 高（自由 mm 級） | 低（固定 SKU）|
| 最小單位 | 30/45/60/75/90cm 寬 | 完全自由 | SKU 規格 |
| 工期 | 訂購 14-21 天 + 現場 5-7 天 | 30 坪 4-6 週 | 庫存 1-3 天 / 訂製 4-12 週 |
| 價格 | 中（板材漲，逼近木作） | 高，2,500-8,000/尺 | IKEA 平、有情門高 |
| 設計軟體 | Cabinet Vision/Mozaik/KD Max/酷家樂 | AutoCAD/SketchUp/wrd | IKEA Home Planner |

業界混搭比例：**系統櫃 60% + 木作 30% + 進口 10%**（公共區木作多、私領域系統櫃多）

### AL2. 施工順序
標準台灣工序：
```
拆除 → 水電 → 泥作 → 木作 → 油漆 → 系統櫃進場 → 進口家具搬入 → 清潔
```
系統櫃在木作階段先進場丈量、油漆完成才組裝（避免噴到板材）；進口家具最後（避免碰撞）

### AL3. 整合介面案例
**廚房**：系統櫃做廚櫃本體 → 木作做包樑、上吊櫃側封板、修飾縫 → 進口冰箱/烤箱/洗碗機嵌入
**主臥**：系統衣櫃為主 + 木作頂封板（補天花差）+ 進口床架
**客廳**：木作電視牆 + 系統側邊收納 + 進口沙發/茶几
**書房**：系統書櫃 + 木作書桌（嵌牆）+ 進口椅

### AL4. 製圖差異
- **系統櫃**：型號 + 寬深高（W90×D60×H210）+ 五金清單，廠商 KD Max 直接 CNC 開料
- **木作**：3D 立面 + 局部詳圖 + 材料表 + 工法
- **進口家具**：品牌 + 型號 + 擺位平面圖

### AL5. 常見衝突
- 尺寸不合：牆 200cm，系統櫃 180/210（補側板或客製木作）
- 色差：木作橡木貼皮 vs 系統櫃橡木紋美耐皿，紋理深淺幾乎一定不一致
- 工期錯位：油漆延誤系統櫃無法進場；進口品 4-12 週要設計階段就下單
- 預算分配：「全系統櫃省錢」假設已不成立（板材漲到逼近木作）

### AL6. wrd 擴充建議
1. **系統櫃模組庫 reference**：建表收愛菲爾/歐德/IKEA PAX/KD 標準寬深高/踢腳，wrd 判斷「這尺寸用系統櫃做得到嗎」做不到提示客製木作
2. **混搭建議引擎**：拉 200cm 衣櫃 → 提示三方案「IKEA PAX 100+100 NT$2 萬 / 愛菲爾客製 NT$3.5 萬 / 木作 NT$6 萬」
3. **進口家具庫**（IKEA/無印/有情門 reference scene）：3D 預覽放沙發/床/餐桌看比例
4. **施工順序 Gantt**：報價單末頁印簡易工序圖，標出進口家具下單時間（提前 4-8 週）
5. **色票對照警告**：木作橡木 + 系統櫃橡木紋同時用 → 提示「色差不可避免，建議分區或統一」

---

## AM. 裝潢報價結構

### AM1. 工程分項對照（10 大類）
| # | 工項 | 計價單位 | 單價區間 NT$（2026） |
|---|------|---------|---------|
| 1 | 保護 | 坪/m² | 200-400/坪 |
| 2 | 拆除 | 坪/車 | 3,000-8,000/坪 + 8,000-15,000/車垃圾 |
| 3 | 泥作 | 坪/m² | 粉光 5,000-8,000、磁磚貼工 4,000-7,000、防水 2,500-4,500 |
| 4 | 水電 | 式 + 點位 | 整戶 80,000-200,000（30 坪）、追加燈具 800-1,500/點、插座 1,200-2,000/點 |
| 5 | **木作** | **尺/才** | 高櫃 5,000-15,000/尺、天花 3,500-6,000/坪、隔間 4,500-7,000/坪、木地板 4,500-8,000/坪 |
| 6 | 油漆 | 坪 | 乳膠漆 1,000-2,500、噴漆 1,800-3,500、特殊 3,000-6,000 |
| 7 | 金屬鐵件 | 才/件/m | 鐵件層板 800-1,800/才、鋁窗 6,000-12,000/才（含玻璃） |
| 8 | **系統櫃** | **片**（60×210）/才 | 標準片 5,000-12,000、進口五金 +20-40% |
| 9 | 燈具/空調/衛浴 | 件/組 | 燈具 1,500-30,000、分離冷氣 35,000-80,000、衛浴 30,000-150,000 |
| 10 | 軟裝家具 | 件 | wrd 主戰場 |

### AM2. 計價單位換算
- **1 才 ≈ 30.3×30.3 cm² 平方**（平作） / **30.3 cm³ 立體**（木材）
- 1 台尺 = 30.3 cm
- 1 坪 = 3.305785 m²
- 系統櫃 1 片 = 60×210 cm
- 1 式 = 一戶整體（水電常用）

### AM3. 預算分配範例（30 坪 / 100 萬）
| 工項 | 比例 | 金額 |
|------|------|------|
| 保護 + 拆除 | 5% | 50,000 |
| 泥作 | 15% | 150,000 |
| 水電 | 12% | 120,000 |
| **木作** | **25%** | **250,000** |
| 油漆 | 8% | 80,000 |
| 燈具/空調 | 10% | 100,000 |
| 系統櫃 | 12% | 120,000 |
| 軟裝家具 | 13% | 130,000 |
| 設計監工 | 另計 | 設計費 3,000-8,000/坪 + 監工 5-10% |

「木作 + 系統櫃 + 家具」常合佔 50%，是設計師主要操作區。

### AM4. 付款分期業界慣例
- 簽約金 30%
- 拆除/水電完工 20%
- 泥作完工 20%
- 木作完工 15%
- 油漆/收尾 10%
- 驗收 5%

### AM5. 報價單必備段落
1. 工程概要（案號/屋主/地址/坪數/工期/簽約日）
2. 總預算（未稅/含稅）
3. 分項明細（10 大類，項次/工項/規格/單位/數量/單價/小計）
4. 加項變更（後續追加用，留空白欄）
5. 折扣
6. 付款條件（5/7 期）
7. 工期（甘特圖另附）
8. 保固（結構 1 年 / 漏水 2 年 / 五金 1 年）
9. 附註（增減項書面為準、業主自購不在內、規格變更影響工期）

### AM6. wrd 擴展建議
**短期**：保持單件家具報價（已實作）
**中期**：「家具套組」（一房多件加總自動套折扣）；「業主版報價單」分頁（才/尺 → cm + 圖片）；板材片數 → BOQ；自動付款 5/7 期表
**長期**：木作 + 系統櫃整合 BOQ；整戶 BOQ 模板（10 大類預算）；設計費/監工費坪數×級距
**不要碰**：水電/泥作/拆除（不是 wrd 強項，計價邏輯也跟設計脫鉤）

挑 **#5 木作 + #8 系統櫃 + #10 軟裝** 三項深耕剛好是設計師最痛的計價區，也是 wrd 才積/片數/工時邏輯的延伸戰場。

---

## AN. 3D 軟體生態與檔案格式互通

### AN1. 主流軟體 × 檔案
| 軟體 | 主檔 | 客群 | 與 wrd 互通 |
|------|------|------|------------|
| **SketchUp** | .skp | 木匠/室設（YT 木工 80%）| GLB import 內建 |
| AutoCAD | .dwg/.dxf | 2D 平面 | DXF（已有 §Q）|
| Revit | .rvt | 大型 BIM | IFC → web-ifc → Three.js |
| ArchiCAD | .pln | 歐洲 BIM | 同上 |
| 3ds Max | .max | 渲染 | FBX 轉檔 |
| Rhino | .3dm | 曲面/工業 | OBJ |
| **Blender** | .blend | 開源全能 | GLB（首選） |
| 酷家樂 | KJL（雲）| 中國最大 | 僅 DXF 出 |
| Roomle | RML | B2B 配置 | GLB import |
| Live Home 3D | .lh3d | 消費者 | OBJ |

### AN2. 檔案格式定位
| 格式 | 優勢 | wrd 用途 |
|------|------|---------|
| **GLB / glTF 2.0** | Web 原生、PBR、~100KB/椅 | **首選 web/SketchUp/Blender** |
| OBJ | 99.7% 軟體支援 | 客戶端後援 |
| FBX | 動畫/骨骼/材質 | 暫不需要 |
| STEP/IGES | CAD 精準 NURBS | CNC/Rhino 工廠 |
| **USDZ** | iOS AR Quick Look | **iOS AR 預覽家具擺客廳** |
| DXF/DWG | 木工出圖 | 裁切/施工圖（已有） |
| IFC | BIM 國際 | 不需要 |

### AN3. 座標慣例（wrd 必踩）
| 軟體 / 格式 | 上方向 | 手系 | 預設單位 |
|------------|-------|------|---------|
| **Three.js / wrd** | **Y-up** | 右手 | mm（自定）|
| Blender | Z-up（顯示） | 右手 | meters |
| SketchUp | Z-up | 右手 | inches |
| 3ds Max | Z-up | **左手** | generic |
| Maya | Y-up | 右手 | cm |
| Revit / ArchiCAD | Z-up | 右手 | mm |
| **glTF 規範** | **Y-up，右手，meters** | | |
| **USDZ / ARKit** | **Y-up，右手，meters** | | |

**wrd 匯出 GLB / USDZ 三件事**：
1. pivot 在 (0,0,0) 地面（wrd 內部 origin = 底部中心 OK）
2. **scale ×0.001 → meters**（wrd 內部 mm，否則 ARKit 把椅子放大成樓）
3. 右手系 OK（轉 3ds Max/Unity 才需鏡像）

### AN4. wrd 格式輸出 priority
1. **DXF / SVG**（已上線 §Q）— 木匠裁切/施工圖，最高頻
2. **GLB**（短中期）— `new GLTFExporter().parse(scene, ...)` 一行；門檻最低、TAM 最大；讓使用者把 wrd 設計丟進 SketchUp / Blender 渲染
3. **USDZ**（中期）— iOS Safari `<a href="x.usdz" rel="ar">` 直接 AR Quick Look，「掃客廳預覽家具」殺手鐧；Three.js `USDZExporter` + `quickLookCompatible: true`
4. OBJ（後援，給保守客戶或 Rhino）
5. STEP（長期可能不做，wrd mesh 不是 NURBS 轉會掉精度）
6. FBX/IFC：暫不做

### AN5. 整合具體路徑
| 目的 | 路徑 |
|------|------|
| 給 SketchUp 用戶 | wrd → GLB → File→Import（SketchUp 2024+ 內建） |
| 給 Blender 用戶 | wrd → GLB → File→Import → glTF 2.0 |
| iOS AR 預覽 | wrd → USDZ → `<a rel="ar" href="x.usdz">` |
| Android AR | wrd → GLB → Scene Viewer intent |
| WebXR | wrd → GLB 直接讀 |
| BIM 反向（讀建築 IFC 進 wrd） | IFC → web-ifc-three → Three.js |

座標只要 Y-up + 單位轉 meters 就 99% 不會踩雷。BIM/FBX/STEP 對木頭仁客群暫不划算。

---

## AO. 計價單位深入（才/尺/坪/片/式/件/組/碼）

### AO1. 才（cái）— 木作核心
**歷史**：日治時期日本人引入「尺貫法」延續至今。木匠普遍用是因原木交易、傳統木工材料皆以才為單位。

**兩種「才」必須分清**（業界混用陷阱）：
| 種類 | 公式 | 用途 | 換算 |
|------|------|------|------|
| **面積才**（板才/平作才）| 30.3 × 30.3 cm = 900 cm² | 板材表面、立面木作 | 1 才 ≈ 0.0918 m²；1 坪 = 36 才 |
| **體積才**（立方才/材積才）| 1 寸 × 1 寸 × 10 尺 ≈ 30.3 × 30.3 × 303 cm³ | 原木、實木板、角材買賣 | 1 才 ≈ 0.00278 m³ ≈ 2,783 cm³ |

```
面積才 = 長(cm) × 寬(cm) ÷ 900
體積才 = 長(cm) × 寬(cm) × 厚(cm) ÷ 27,000
```

> **重要陷阱**：櫃體應該用面積才，被換算成體積才會多收數倍 — wrd UI 必須在 UI 明示是哪一種。

### AO2. 尺
- 1 台尺 = 30.3 cm；1 英呎 = 30.48 cm
- **木作衣櫃**以「寬度尺數」計價（高度普遍 7 尺=210cm 為基準）
- 木作衣櫃 NT$ 5,000-12,000/尺；系統櫃 NT$ 2,500-8,000/尺
- 不滿一尺以一尺計（業界慣例）

### AO3. 坪
- 1 坪 = 6 尺 × 6 尺 = 3.305785 m²（兩塊榻榻米）
- 用於拆除、保護、泥作、油漆、地板、隔間、天花板
- 民間沿用至今（雖法定 m²）

### AO4. 片（系統櫃）
- 標準片 = 60 × 210 cm（≈ 1.26 m²）
- 部分廠商用張：1 張 = 120 × 240 cm
- 衍生：半片（60×90）、加長片（60×240）

### AO5. 式 — 報價地雷
「水電一式」「拆除一式」= 籠統包價。**沒有業界統一定義**。
專業報價應避免使用「一式」，**能算就算明細**。wrd 系統建議內建「式」警示。

### AO6. 件 / 組 / 套
| 單位 | 範圍 | 範例 |
|------|------|------|
| 件 | 單一物品 | 一個拉手、一個鉸鏈 |
| 組 | 成套組合 | 一組衛浴（馬桶+洗手台+鏡子）|
| 套 | 多項整合 | 一套廚具（上下櫃+五金+嵌入家電）|

### AO7. 碼 / m²
- 1 碼 = 91.44 cm = 3 尺；窗簾用碼計（含布料皺摺，**遮光面積 × 2-2.5 = 用布量**）
- 國產窗簾布 NT$ 200-400/碼，進口 1,500-3,000
- m² 用塗料/地磚（國際標準），業主溝通直觀

### AO8. 換算速查
| 單位 | SI 換算 |
|------|---------|
| 1 才（材積）| 0.00278 m³ |
| 1 才（平作）| 0.0918 m² |
| 1 尺 | 30.3 cm |
| 1 坪 | 3.306 m² = 36 才（平作）|
| 1 片（系統櫃）| 1.26 m² |
| 1 碼 | 91.44 cm |

### AO9. 計算實例
- **餐桌 1500×900×750（30mm 板）**：板才 = 150×90÷900 = 15 才；材積才 = 150×90×3÷27000 ≈ 1.5 才
- **衣櫃 200×60×210**：6.6 尺 → 進 7 尺，木作 7 尺 × NT$ 7,500 = NT$ 52,500
- **廚具下櫃 4 米**：寬 400cm → 檯面 NT$ 20-250/cm × 400 = 8,000-100,000
- **地板 30 坪** = 99.17 m²

### AO10. 給師傅 vs 給業主策略
| 場景 | 給師傅看 | 給業主看 |
|------|---------|---------|
| 木作 | 才（材積）、尺 | cm、件數 |
| 系統櫃 | 尺、片 | 寬高（cm）+ 總價 |
| 拆除/油漆/地板 | 坪 | 坪+m² 雙顯 |
| 窗簾 | 碼、才 | 窗框 cm + 總價 |
| 廚具 | cm、件 | 套價 + 配件清單 |

**地區差**：北部設計師多「尺」報系統櫃；中南部老師傅仍「才」（材積）報木作

### AO11. wrd 報價系統建議
1. **內部統一 mm + m³** + display 切換台制
2. **單位切換按鈕**：一鍵切「業主版」vs「工班版」，同份報價匯出兩個 PDF
3. **才必標兩種**：UI 永遠寫「面積才」或「材積才」，後端兩個欄位分開存
4. **「式」警告**：選「式」時跳警示「建議拆解為可計量單位」，提供拆解模板
5. **業主翻譯欄**：每項同時顯示換算「衣櫃 6.6 尺 ≈ 200 cm」
6. **地區 preset**：依設計師縣市預設常用單位組合（北部 = 尺+片+坪；中南部 = 才+尺+坪）
7. **單位轉換 lib single source**：`unitConverter.ts` 所有頁面 import 同一個

---

## AP. 木作計價深層邏輯（以尺/以才/以坪）

### AP1. 計價單位分野邏輯
**用最能代表那個工程主要變數的維度來計價**：
| 工程類型 | 主要變數 | 單位 | 為什麼 |
|---------|---------|------|--------|
| **立式櫃**（衣櫃/書櫃/電視櫃） | 寬度 | 尺 | 高度普遍 210cm 固定，深度標準 45-60cm，剩寬度是變數 |
| **平作**（天花/隔間/收邊條） | 面積 | 才（小）/坪（大） | 沒固定深度，但有完整二維面 |
| **木地板** | 面積 | 坪 | 同上但量大、單位大 |

### AP2. 立式櫃單價（2026 北部）
| 櫃型 | 每尺 NT$ |
|------|---------|
| 木作衣櫃（木皮）| 7,000-12,000 |
| 木作書櫃 | 6,500-9,000 |
| 矮櫃/電視櫃 | 4,500-6,500 |
| 廚房電器櫃（含抽拉）| 6,000-8,000 |
| 系統衣櫃（對開）| 4,800-6,000 |
| 系統衣櫃（側滑門）| 6,000-8,000 |

加成：標準 7 尺（210cm），加高到 8 尺 ×1.15-1.25；標準 60cm 深，加深另計；不滿一尺以一尺算。

### AP3. 平作單價（2026）
| 項目 | 行情 |
|------|------|
| 木作天花板（平釘）| 4,200-5,600 / 坪 |
| 木作天花板（造型）| 6,000-9,000 / 坪 |
| 木作輕隔間（角材+矽酸鈣板）| 3,500-6,000 / 坪 |
| 海島型木地板 | 5,000-15,000 / 坪 |
| 超耐磨木地板 | 2,400-10,000 / 坪 |
| 架高木地板 | +2,000-5,000 / 坪 |

### AP4. 五金與油漆「另計」陷阱
**五金通常另計**：
- 鉸鏈：國產 30-80/個、Hettich 100-200、Blum 200-400
- 滑軌：國產三節 200-400、緩衝 600-800、Blum 緩衝 1,200-2,500
- 拉手：50-2,000（差距最大）

**油漆獨立報價**：
- 透明漆 800-1,000/尺（含/獨立都看師傅）
- 染色漆 +200/尺
- 噴漆 1,800-3,500/坪（按表面積）

### AP5. 工料分離 vs 統包
| 模式 | 計價 | 優 | 缺 |
|------|------|---|-----|
| **統包**（包工包料）| 6,000-15,000/尺 | 業主省事、議價空間 | 透明度低、易加料 |
| **工料分離** | 工錢 2,500-5,000/尺 + 業主買料 | 透明、可控 | 業主累、無散戶折扣 |

**多數情境統包反而划算**（師傅與木材行長期合作，板價低 15-25%）

### AP6. 通路加成
| 通路 | 加成 | 含 |
|------|------|---|
| 工班直接接 | 工班成本 × 1.2-1.3 | 工班利潤 |
| 統包 | × 1.3-1.5 | 統籌+跨工種協調 |
| 設計公司 | × 1.4-1.8 | 設計+監工+保固 |

業主自找熟工班可省 30-40%，但要承擔工序協調風險。

### AP7. 計算實例
**衣櫃 W200×D60×H210**
- 寬 200cm = 6.6 尺 → 進 7 尺
- 木作（木芯+木皮）7×7,500 = 52,500
- 五金（鉸 8+緩衝滑軌 2+拉手 8）≈ 5,000
- 噴漆（展開 ≈ 3.5 坪 × 2,500）≈ 8,750
- **總 ≈ NT$ 66,250**

**廚下櫃 W240、3 抽**
- 8 尺 × 6,500（基本）= 52,000
- Blum 滑軌 3 × 2,000 = 6,000
- 美耐皿（含）vs 木皮（+1,500/尺 = 12,000）
- **總 NT$ 58,000-70,000**

### AP8. 複雜度加成（業界默認）
| 工法 | 倍率 |
|------|------|
| 直線、矩形 | × 1.0 |
| 含弧形/曲線 | × 1.2-1.5 |
| 雕花、線板 | × 1.5-2.5 |
| 入柱齊平（無門縫）| × 1.2 |
| 異形 45° 斜切/不規則 | × 1.3 |

### AP9. wrd 計價邏輯升級
1. **依櫃型自動切單位**：立式自動算尺，平作算才/坪，地板算坪
2. **三層報價結構**：業主版總價分區 / 設計師版分項 × 倍率 / 工班版工料分離
3. **五金清單獨立模組**：鉸鏈/滑軌/拉手分等級（國產/Hettich/Blum），依櫃內格數推算數量
4. **複雜度 slider**：標準/含弧形/含雕花/入柱齊平 → ×1.0/1.3/1.8/1.2
5. **油漆獨立**：依板材展開面積（不是櫃寬）算坪數 × 噴漆單價
6. **加高/加深自動加成**：超 7 尺、60cm 自動跳警語 +15-25%
7. **不滿一尺進位**：197cm = 6.5 尺 → 進 7 尺（業界默契）

---

## AQ. 計價爭議（水電/泥作/系統櫃）

### AQ1. 水電「一式」爭議

**標準「一式」通常含**：
- 配管/配線（總管路、分電箱重整）
- 30 坪約 30-40 個雙插 + 燈具迴路
- 衛浴給排水（馬桶/洗手台/浴缸 1 套）
- 廚房給排水（流理台/瓦斯/抽油煙機 1 套）

**標準「一式」通常不含**（最多糾紛）：
- **弱電系統**（網路/第四台/監視器/對講機）— 追加 NT$ 30,000-80,000
- 智慧家居配線（HomeKit/米家/Aqara）
- 追加點位：雙插 1,200-2,000/點、專插 1,500-2,500/點
- **接家電**：冷氣（含銅管排水）8,000-15,000/台、嵌入式烤箱/洗碗機
- 照明迴路追加 800-1,500/組

### AQ2. 業主常踩
- 簽約沒清點點位 → 進場追加 20-50 個 → 爆 NT$ 50,000-100,000
- 冷氣銅管位置變更 → 拆牆重拉 +20,000
- 弱電當「附送」結果完工才知要算錢

### AQ3. 泥作「以坪」爭議
| 算法 | 定義 | 對誰有利 |
|------|------|---------|
| 實貼面積 | 實際磁磚覆蓋（含牆）| 業主吃虧 |
| 投影面積 | 地坪面積 ×N | 業主好算 |
| 業界慣例 | 地坪 ×1.5（含牆 1.5 面）| 中間值 |
| 防水 | 地坪 ×1.2（牆腰 1.2m）| 標準 |

衛浴爭議最大：5 面 vs 4 面 vs 3 面，差 30-50%。業界改用「衛浴整套」**一間 NT$ 60,000-150,000**（含拆除+防水+磁磚+設備安裝）。

### AQ4. 系統櫃「以片」爭議
標準片 = 60×210cm。業主最常算錯：「一片 NT$ 10,000」**≠**「一個衣櫃 NT$ 10,000」。

實例 200cm 衣櫃：
- 數學：200÷60 = 3.33 片 → 實際用 4 片（切邊損料）
- 加層板/背板/抽屜 → 總片數 8-12 片
- 加五金（鉸鏈/滑軌/拉手）→ 總價 NT$ 25,000-40,000

**系統櫃慣例不含**：天花補頂（櫃未到頂時補 2,000-5,000/尺）、油漆、特殊五金（推拉門 +50%、緩衝 +200/組、電子鎖）、玻璃/烤漆門板（+30-80%）

### AQ5. 共通陷阱
| 陷阱 | 說明 | 金額 |
|------|------|------|
| 規格未定 | 簽約時「磁磚另選」「五金另議」 | 追加 20,000-100,000 |
| 補強另計 | 「需補強」中途追加 | 5,000-30,000 |
| 不可預期 | 拆除後漏水/蟲蛀/結構裂 | 20,000-200,000 |
| 業主自購安裝 | 自買設備出問題誰負責 | 工錢爭議 |
| 追加口頭 | 沒寫合約事後算錢 | 爭議無據 |
| 設計變更 | 動位置→水電重拉 | 10,000-50,000 |

### AQ6. 透明度分級

**A 級（透明）— 推薦給 wrd**：
```
雙插座     20 × NT$ 800   = 16,000
專用迴路   8  × NT$ 1,500 = 12,000
燈具迴路   30 × NT$ 600   = 18,000
弱電出線   5  × NT$ 1,500 = 7,500
衛浴給排水 1 套 × 25,000  = 25,000
廚房給排水 1 套 × 18,000  = 18,000
─────────────────────
小計                     = 96,500
※ 超出原訂位數每雙插 NT$ 1,200/點（明文）
```

**規格分檔**：A（國際 Panasonic/Legrand+Grohe/TOTO）/ B（國產 中一電工+凱撒）/ C（白牌+HCG 基礎）

### AQ7. wrd 應用建議
**核心原則**：不做完整裝潢計價，做家具的配套估算
1. **家具配套點位估算**（推薦）：書桌附近建議「雙插 ×2 + USB ×1 + 桌下燈具 ×1」，預估 NT$ 4,800
2. **報價單預留「實際施工後追加」欄位**，明文「結構補強/配管調整/不可預期」
3. **規格分檔內建**：木材/五金/塗裝 A/B/C 三檔
4. **點位數透明拆分**：未來整戶要拆「點位數 × 單價」（學酷家樂、簡室裝）
5. **透明度自評徽章**：報價單自動標 A/B/C 級

---

## AR. 業主常踩計價陷阱與防範

### AR1. 八個經典陷阱
1. **「7 千一尺」沒寫含什麼** — 木作含糊：可能不含烤漆/特殊五金/門板造型/運輸
2. **系統櫃「3 萬一個衣櫃」沒含上櫃/內抽/緩衝** — 比例約 板 40% / 門 30% / 五金 20% / 特殊 10%
3. **Blum 變 ocblum** — 規格降級經典案（Blum 緩衝 160-200/組 vs ocblum 50-70）
4. **板材 F1 報價 F3 進場** — 甲醛問題不只是價差
5. **油漆「一坪 X 元」沒寫批幾次/上幾道** — 300-1500/坪差 5 倍
6. **「水電一式」追加 20 個點位** — 輕鬆爆 3 萬+
7. **拆除後「不可預期」漏水** — 補強 5 萬起跳
8. **保固縮水** — 報價說 1 年、合約寫「結構 1 年/表面 3 個月/五金 6 個月」

### AR2. 業主防範 Checklist
- [ ] 每項都有**品牌、型號、規格、數量、產地**（不接受「五金一組」）
- [ ] 每項明列**「含什麼/不含什麼」**
- [ ] 計價**單位**寫清楚：實貼 vs 投影？立體 vs 平作？
- [ ] **「一式」全部換成數量**（水電 → 插座 X 個 + 迴路 X 條）
- [ ] 變更**書面簽署變更單**（口頭一律不算）
- [ ] 不可預期**先約定處理方式與單價上限**
- [ ] 保固**分項列**（結構 X 年/表面 X 年/五金 X 年/漏水建議 3 年）
- [ ] 拒絕純口頭「免費送」
- [ ] 拒絕純「全包價」（無法比價/追責）
- [ ] 至少 3 家比價（**比規格不只是比總價**）
- [ ] 驗收拍照/錄影留證

### AR3. wrd 報價單避陷阱設計清單
| # | 功能 | 對應陷阱 |
|---|------|---------|
| 1 | **品牌型號欄位強制必填** | 規格降級 |
| 2 | **「含/不含」勾選清單**（含安裝/搬運/烤漆/五金）| 含糊陷阱 |
| 3 | **板材 F 等級下拉**（F1/F2/F3，自動寫附件）| F 等級降級 |
| 4 | **「一式」自動展開為數量**（bot 提醒拆插座/迴路）| 一式陷阱 |
| 5 | **變更單模板一鍵生成** | 追加無上限 |
| 6 | **保固條款分項可編輯** | 保固縮水 |
| 7 | **業主自購項目自動標 ⚠** | 自購陷阱 |
| 8 | **「不可預期」上限欄位** | 拆除追加 |
| 9 | **油漆工法下拉**（批土次數/上漆道數）| 工法不明 |
| 10 | **報價單末頁附「規格附件」** | 偷料 |

### AR4. 業主版 vs 師傅版報價單對比
| 項目 | 師傅版（內部） | 業主版（對客）|
|------|---------------|---------------|
| 單位 | 才/尺/坪 | cm/m²/件 |
| 衣櫃 | 7 尺衣櫃 | 衣櫃 200×60×210 cm |
| 五金 | 鉸鏈一組 | Blum 緩衝鉸鏈 8 個（型號 71B3550）|
| 板材 | 木芯板 | 木芯板 18mm F1 等級（永盛）|
| 油漆 | 油漆一坪 | 牆面乳膠漆（虹牌 X 色），批土 2 次/上漆 2 道 |
| 安裝 | 打包 | 含安裝/含現場切割；不含搬運上樓/不含舊家具拆除 |
| 追加 | 口頭 | 變更單編號 + 單價（追加鉸鏈 NT$ 50）|
| 保固 | 一年 | 結構 1 年 / 表面 6 月 / 五金 1 年 / 漏水 3 年 |
| 總價 | 一行打包 | 分項小計 + 總計 |

**wrd 切換邏輯**：同份設計，toggle「業主版/師傅版」匯出兩種 PDF。業主版預設打開「含/不含清單」「品牌型號」「規格附件」「保固條款」。

### AR5. wrd schema 核心欄位
```ts
quote_item {
  name, dimensions_cm, qty,
  brand, model,            // 必填
  material_grade,           // F1/F2/F3
  includes: string[],       // ["安裝","現場切割"]
  excludes: string[],       // ["搬運","舊家具拆除"]
  unit_price, subtotal,
  warranty_months,
  is_owner_supplied: bool   // true → 自動標 ⚠
}
quote_meta {
  warranty_terms: { structure, surface, hardware, leakage },
  unforeseen_cap: number,    // 不可預期單價上限
  change_order_unit_prices,  // 追加單價表
}
```

---

## AS. BATT 算法 — Bottom-Anchored Top-Tracking（圓料下錨上追式）

> Windsor 椅背 / 任何「直立圓料 + 旋轉斜橫木」結構通用幾何法則。
> 用於 `lib/templates/bench.ts` 的 windsor 分支，可推廣到 dining-chair、bar-stool 的背靠彎弧 bow。

### AS1. 適用場景

- 一組 **垂直細圓料 / 邊柱** 連接 **座板** 到 **頂端橫木 (bow)**
- 頂端橫木有以下任一或全部：
  - 整體後傾旋轉（rotation.x = rakeRad）
  - 沿 X 軸彎弧（arch-bent，bendMm 沿 +Z 凸）
- 要求圓料底端固定錨在座板背緣，頂端「追蹤」橫木旋轉 + 彎弧後的底面中軸線。

### AS2. 五條基本原則

1. **底錨不動**：所有圓料/邊柱底端 (BOTTOM) 中心 z 永遠 = `halfW − D/2 − backInset`，背面齊座板背緣。
2. **頂追中軸**：圓料頂端中軸線必須落在橫木旋轉 + 彎弧後底面中軸線曲線上。
3. **圓料整支斜（splay）**：用 `splayed-round-tapered` shape，dzMm = zBottom − zTop，讓 BOTTOM 跟 TOP 在不同 Z 位置但同 X，圓料是 slanted prism。
4. **允許穿透**：圓料 TOP 圓盤是水平面、橫木底面是斜面 → 必有局部穿透。先讓 TOP 軸心抵達中軸線，後修剪。
5. **修剪規則**：把 TOP 軸心 Y 再下降 `tan(rakeRad) × D/2`，讓圓料 back 邊 (z = zTop + D/2) 剛好落在橫木底面平面上，圓料外緣不再穿入橫木內部。Front 邊會留 `tan(rakeRad) × D` 的小三角缺口（不可避免）。

### AS3. 幾何推導

**輸入**：
- `rakeRad` — 整組後傾角度（弧度）
- `topRailH` — 橫木 cross-section 高（Y 方向，旋轉前）
- `topRailT` — 橫木 cross-section 厚（Z 方向，旋轉前）
- `bowBendMm` — 橫木沿 X 中央往 +Z 彎弧最大量
- `bowLength` — 橫木總長
- `D` — 圓料/邊柱直徑
- `partH = railBotY − seatTop` — 椅背料完整直立基準高度
- `rakeMm = partH × tan(rakeRad)` — 整組後傾的位移

**橫木 (bow) 中軸線（旋轉後）**：

橫木未旋轉時 cross-section 中心位於 (Y, Z) = (railBotY + topRailH/2, railZ)，railZ 已含 rakeMm 偏移。
旋轉 X 軸 rakeRad 後，**底面中軸線**位移：

```
ΔY = (topRailH / 2) × (1 − cos(rakeRad))      # 上提
ΔZ = -(topRailH / 2) × sin(rakeRad)           # 前縮
```

加上 archDz(x) 的沿 X 彎弧偏移：

```
y_center(x) = railBotY + ΔY
z_center(x) = railZ + ΔZ + archDz(x)
```

其中 `archDz(x) = bowBendMm × max(0, 1 − (2x / bowLength)²)`。

**圓料 TOP 軸心位置**：

```
zTop(x) = z_center(x)
yTop(x) = y_center(x) − tan(rakeRad) × (D / 2)        # 修剪：back 邊不穿透 bow 底面
```

**圓料 BOTTOM 軸心位置**：

```
zBottom = halfW − D/2 − backInset                     # 底錨（不依賴 X 或 archDz）
```

**Splay shape 參數**：

```
visible.thickness = yTop − seatTop
origin = (x, seatTop, zTop)
shape = splayed-round-tapered, dzMm = zBottom − zTop
```

`splayed-round-tapered` 慣例：origin.z 是 TOP 中心、bottom 中心 = origin.z + dzMm。

### AS4. 設計取捨

| 方案 | 優點 | 缺點 |
|---|---|---|
| 圓料垂直 + bow 不旋轉 | 完全貼合無縫 | bow 視覺不傾斜 |
| 圓料 splay + bow 旋轉 + 底錨上追（**BATT**） | bow 跟圓料同角度後傾，視覺正確 | front 邊有 tanθ×D 三角缺口 |
| 圓料整支也旋轉（rotation.x = rakeRad） | 完美貼合 | 圓料底面也斜，離開座板平面 |

**BATT 是視覺平衡點**：bow 看起來跟圓料同角度斜、底面跟圓料 back 邊接觸、唯一可見小瑕疵是 front 邊的 tanθ×D 缺口（θ=10° D=16 → ~2.8mm，θ=20° D=16 → ~5.5mm，視覺可忽略）。

### AS5. 推廣

任何「N 根圓料垂直連接平面到旋轉橫木」結構皆適用 BATT：
- `dining-chair.ts` 的 Windsor 椅背
- `bar-stool.ts` 帶 bow 的矮背
- 未來鞦韆椅、長椅、雙人椅的後傾結構
- 床頭板（headboard）的圓料 + 橫木組合

只要替換 `seatTop` → 結構底面 Y、`halfW` → 結構背緣 Z，公式不變。

---

## AT. 木工幾何與放樣參考公式（複斜角 / 單斜角 / 投影 / 放樣）

> 蒐集自 Fine Woodworking、Lost Art Press、Tage Frid、Toshio Odate、王世襄、JIS/GB 製圖標準等來源。
> 用於 designer 內部建模 + 木匠學院教材公開引用。所有公式以**度**為輸入單位，工程上直接代入。

### AT1. 複斜角 (Compound Angles)

複斜角出現於：鬥形容器 (hopper)、外撇腿凳椅、煙囪罩、傾斜畫框、Windsor 椅後腿。
構件同時有**外撇 (splay)**與**側傾 (cant)**時，鋸片需同時調整**傾角 (bevel)**與**斜切角 (miter)**。

#### AT1.1 Hopper Formula（n 邊形對稱外撇盒，最廣泛引用）

```
Miter (M)      = arctan( cos(S) × tan(180°/n) )
Blade Tilt (B) = arcsin( sin(S) × cos(180°/n) )
```

| 變數 | 意義 |
|---|---|
| `S` | 側板外撇角（與垂直線夾角） |
| `n` | 邊數（方鬥 n=4、六角桶 n=6、八角桶 n=8） |
| `M` | 鋸枱左右轉角（複斜切鋸） |
| `B` | 鋸片左右傾倒角 |

**來源**：Gary Rogowski《Complete Illustrated Guide to Joinery》Taunton 2002；Wally Kunkel "Compound Miters Made Simple" *FWW* #84 (1990)；Bridge City Tool Works *CT-12 Manual*

#### AT1.2 替代形式（Tage Frid 派）

```
Blade Tilt  = arctan( sin(S) × tan(T) )
Miter Angle = arctan( cos(S) / tan(T) )    後再 90° 補角
```

T = 半夾角（方鬥 T=45°）。**注意**：Rogowski 派跟 Frid 派 miter 定義差 90° 補角，使用前確認該書鋸枱讀數方向。

#### AT1.3 Windsor 椅 Resultant + Sightline（鑽座板腿榫眼）

後腿同時外撇 (splay) + 後傾 (rake) 時：

```
α_resultant = arccos( cos(splay) × cos(rake) )
sightline   = arctan( tan(rake) / tan(splay) )
```

從椅後方拉一條 `sightline` 角度的視線，沿視線鑽 `α_resultant` 即同時得到外撇 + 後傾。

**來源**：Pete Galbert《Chairmaker's Notebook》LAP 2015；Drew Langsner《The Chairmaker's Workshop》Lark 1997；Christopher Schwarz《The Stick Chair Book》LAP 2021

#### AT1.4 工作範例

**方鬥 S=15°, n=4**：
- M = arctan(cos15° × tan45°) = arctan(0.9659) = **44.00°**
- B = arcsin(sin15° × cos45°) = arcsin(0.1830) = **10.54°**

**Windsor 後腿 splay=14°, rake=8°**：
- Resultant = arccos(cos14° × cos8°) = **16.06°**
- Sightline = arctan(tan8° / tan14°) = **29.40°**

### AT2. 單斜角 (Single Bevel)

只有外撇、無側傾的純 splay 結構（凳腳、桌腳、簡易花架）。

#### AT2.1 Splay 換算

```
頂部榫眼角 θ_m = 90° − S
腳底水平偏移 d = h × tan(S)
```

| 變數 | 意義 |
|---|---|
| `S` | 外撇角（垂直線量測） |
| `h` | 腿長 |
| `d` | 腳底距垂直投影點偏移 |

#### AT2.2 真角 vs 視角（前後 + 左右雙向 splay）

```
tan(α_apparent_front) = tan(S_side) / cos(S_front)
tan(α_true)           = √( tan²(S_side) + tan²(S_front) )
```

#### AT2.3 燕尾比 Rule of Thumb

| 木性 | 比例 | 角度 |
|---|---|---|
| 硬木 | 1:8 | 7.13° |
| 軟木 | 1:6 | 9.46° |
| 折衷 | 1:7 | 8.13° |

**來源**：Frank Klausz *Dovetail a Drawer*；Ian Kirby《The Complete Dovetail》；Schwarz "1:8 vs 1:6 — pick one and move on"

### AT3. 投影 / 軸測 (Projection / Axonometric)

#### AT3.1 第一角法 vs 第三角法

- **第三角法**（美/日/台主流）：上視在上、左視在左。JIS B 0001 採用。
- **第一角法**（歐陸/中國 GB 主流）：視圖配置鏡像。GB/T 17452 採用。
- 跨國圖紙必須標 ISO 圓錐符號。

#### AT3.2 真長公式

```
True Length = √( L_top² + h² ) = √( L_front² + d² ) = √( Δx² + Δy² + Δz² )

線與水平面夾角 θ = arctan( Δz / √(Δx² + Δy²) )
```

#### AT3.3 軸測縮短率

| 投影 | X | Y | Z | 軸夾角 |
|---|---|---|---|---|
| Isometric 等角 | 0.816 (實務 1.0) | 0.816 | 0.816 | 120°/120°/120° |
| Dimetric 二測 | 1.0 | 1.0 | 0.5 | 7°/41°/41° |
| Cabinet 斜二測 | 1.0 | 1.0 | 0.5 @ 30° | 適家具速繪 |
| Cavalier 斜等測 | 1.0 | 1.0 | 1.0 @ 45° | 深度看似太長 |

**等角 (isometric) 速繪**：所有水平線畫成 30° 仰角；圓變橢圓，長/短軸比 = cos(35.26°) = 0.816。
**Cabinet projection**：正面 1:1 真比例、深度 30° 角縮一半。Krenov / Frid 教科書速繪標配。

**來源**：Frederick Giesecke《Technical Drawing》15th ed Pearson；JIS B 0001:2019；GB/T 17452-1998；Krenov《The Fine Art of Cabinetmaking》Sterling 1977

### AT4. 放樣 (Setting Out / Full-Size Layout)

#### AT4.1 1:1 地面放樣 (Lofting)

源自造船業 (lofting floor)、Roubo 工作台、Welsh stick chair。

1. 在地板/合板上畫 1:1 平面 + 正面 + 側面三視
2. 椅腳落點四角（footprint rectangle）
3. 座板天花投影榫眼四角（mortise rectangle）
4. 連線得腿水平投影 `L_plan`
5. 側面圖量垂直高度 `h`
6. **真長 `L_true = √(L_plan² + h²)`**
7. **腿與地夾角 `= arctan(h / L_plan)`**

#### AT4.2 日本曲尺 (Sashigane / さしがね)

曲尺背面有兩種特殊刻度：

| 刻度 | 倍率 | 用途 |
|---|---|---|
| 角目 (kakume) | ×√2 | 量正方料邊長即得對角線 → 方料變八角 |
| 丸目 (marume) | ×1/π | 量直徑即得圓周 → 桶箍料 |

**規矩術 (kiku-jutsu)**：屋頂隅木複斜角全靠曲尺幾何作圖求得，不用三角函數。

```
隅勾配（屋頂隅木斜率） = 本勾配 / √2
```

→ 此即角目 ×√2 刻度的由來，曲尺直接讀取免計算。

**來源**：Toshio Odate《Japanese Woodworking Tools》Linden 1984；大江新太郎《規矩術の基礎》井上書院

#### AT4.3 中華傳統丈杆 (Story Stick)

一根長木條，刻墨線標每個關鍵尺寸（座高、肩高、榫位）。明式家具匠人「不用尺，只用杆」（王世襄《明式家具研究》三聯書店 1985）。批量做同款椅子一杆到底，避免抄寫誤差。

西方對應：Roy Underhill 在 *The Woodwright's Shop* (PBS) 多次示範 story stick；Schwarz《The Anarchist's Design Book》Ch. 2 詳述。

#### AT4.4 Welsh / Stick Chair Schwarz 法

不用 sightline，改在座板下用 bevel gauge 直接設定 resultant 角度。Schwarz 推通用可坐參數：**resultant 12°-14°、sightline 25°-30°**。

#### AT4.5 Roubo 工作台腿距

Roubo (1769)《L'Art du Menuisier》Plate 11：腿距台面端頭 = 台面長 / 5。
現代換算（Schwarz《Workbenches》2007）：250 cm 台面 → 腿距端 50 cm。

### AT5. 常見錯誤檢查清單

1. **Miter 定義方向錯誤** — Rogowski 派 vs Frid 派差 90° 補角
2. **Splay 量測基準錯誤** — 須從垂直線量、非水平線
3. **公式套用對象錯誤** — n 邊形對稱鬥公式不適用於不對稱外撇
4. **單位錯誤** — Excel `TAN()` 吃弳度、多數計算機吃度
5. **三視真長假設錯誤** — 只有平行於投影面的線段才在該視為真長
6. **跨海圖紙忘標第一/第三角法符號**
7. **1:6 vs 1:8 燕尾比迷信** — 差別小於季節木材變動

### AT6. Excel / 計算機速查

```
方鬥 n=4 一行求 tilt + miter (S 為外撇角):
  Miter  =DEGREES(ATAN(COS(RADIANS(S)) * TAN(RADIANS(180/n))))
  Bevel  =DEGREES(ASIN(SIN(RADIANS(S)) * COS(RADIANS(180/n))))

Windsor resultant + sightline (rake/splay 為角度):
  Resultant =DEGREES(ACOS(COS(RADIANS(rake)) * COS(RADIANS(splay))))
  Sightline =DEGREES(ATAN(TAN(RADIANS(rake)) / TAN(RADIANS(splay))))
```

### AT7. 參考來源彙整

| 主題 | 主要來源 |
|---|---|
| 複斜角 | Rogowski 2002、Kunkel FWW#84 1990、Hoadley *Understanding Wood* 2000 附錄 B、Frid Vol.1 1979、Galbert 2015、Schwarz *Stick Chair Book* 2021、Langsner 1997 |
| 單斜角 | John Brown《Welsh Stick Chairs》1990、Klausz、Kirby |
| 投影 | Giesecke《Technical Drawing》、JIS B 0001:2019、GB/T 17452-1998、Krenov 1977 |
| 放樣 | Galbert 2015、Schwarz LAP 全套、王世襄《明式家具研究》1985、Odate 1984、大江新太郎《規矩術の基礎》、Roubo 1769（archive.org PDF） |


