# 相框 (Photo Frame) — 木頭仁 wrd 設計參考

> 本文是 wrd 家具設計器「相框」模板（`lib/templates/photo-frame.ts`）的深度設計研究，目標是把 12-18 種款式、照片標準、補強工法、玻璃槽、立架、裝飾、市售品牌規格全部攤平成可直接餵給生成器的 mm 數值。所有尺寸以 mm 為主、英寸為輔（1" ≈ 25.4 mm）。

---

## 1. 款式 18 種（從基本到進階）

| # | 款式 | 中文俗稱 | 適用照片 | 邊框面寬 | 邊框厚 | 深度 | 重點工法 |
|---|---|---|---|---|---|---|---|
| 01 | Flat | 平面框 | 4×6~8×10 | 18-30 | 12-18 | 12-18 | 45°斜接 + spline |
| 02 | Ogee | 古典雙曲線（S 線） | 5×7~16×20 | 25-50 | 18-25 | 25-40 | Ogee router bit + 斜接 |
| 03 | Cove | 凹弧內凹 | 5×7~11×14 | 25-40 | 18-22 | 22-30 | Cove bit + 4 邊內凹 |
| 04 | Chamfer-out | 外緣 45° 倒角 | 4×6~8×10 | 20-30 | 15-20 | 15-22 | 桌鋸 45° 銑切外角 |
| 05 | Chamfer-in | 內緣斜下（朝照片） | 4×6~8×10 | 20-30 | 15-20 | 15-22 | 內緣 22.5° 或 30° 斜面 |
| 06 | Roundover | 圓角邊 | 4×6~8×10 | 20-30 | 15-20 | 15-22 | 1/4"或3/8" R bit |
| 07 | Double-mat | 雙層 mat 留白邊 | 5×7~11×14 | 25-40 | 18-22 | 22-30 | 兩片 mat（外白內彩） |
| 08 | Floating-canvas | 浮動帆布框 | 帆布畫專用 | 15-20 | 35-50 | 35-50 | L 形截面 + 反背栓 |
| 09 | Floating-print | 浮動相片框（雙玻璃） | 4×6~8×10 | 18-25 | 15-22 | 15-22 | 兩片玻璃夾照片 |
| 10 | Shadow-box | 立體深框 | 紀念品/勳章 | 25-40 | 50-100 | 50-100 | 加深 rabbet + 背板厚 |
| 11 | Diorama | 3D 場景框 | 公仔/微縮 | 30-50 | 100-200 | 100-200 | 玻璃前 + 內襯背板 |
| 12 | Round | 圓形相框 | 圓形剪裁 | 25-40 | 18-25 | 18-25 | 段組（segment ring）8 段 |
| 13 | Oval | 橢圓相框 | 橢圓剪裁 | 25-40 | 18-25 | 18-25 | 段組長短軸不等 |
| 14 | Octagon | 八角相框 | 5×5~8×8 | 25-35 | 18-22 | 18-22 | 22.5° 八等分斜接 |
| 15 | Multi-grid | 多照片格組 | 4×6 × N | 30-50 | 18-22 | 18-22 | 中央 mullion 隔條 |
| 16 | Hinged-book | 書頁式雙連 | 4×6 對 | 25-35 | 15-20 | 15-20 | 鉸鏈側接 + 雙立架 |
| 17 | Vinyl-LP | 12" 黑膠唱片框 | 12×12" 唱片 | 22-30 | 22-30 | 22-30 | 內徑 318mm 方框 |
| 18 | Mirror-dual | 鏡框雙用 | 鏡片或照片 | 30-60 | 18-25 | 18-25 | rabbet 深一點容鏡片 |

> **wrd 模板現況**：目前 `photo-frame.ts` 已支援 #01 #04 #05 #02 #03（`frameProfile` 五選）以及 #15 多照片排列（`multiPhotoLayout`）和 V-easel/wall-hung/both 立架。**待擴**：#08 floating canvas、#10 shadow box、#12 圓形（段組）、#13 橢圓、#14 八角、#17 黑膠唱片框。

---

## 2. 照片標準尺寸表（必背）

### 2.1 沖印照片（英制起源）

| 規格 | 英寸 | 公制 (mm) | mat 內徑 (5mm 留白邊) | mat 內徑 (10mm 留白邊) |
|---|---|---|---|---|
| 名片 | 2×3 | 51×76 | 41×66 | 31×56 |
| 4×6 | 4×6 | **102×152** | 92×142 | 82×132 |
| 5×7 | 5×7 | **127×178** | 117×168 | 107×158 |
| 6×8 | 6×8 | 152×203 | 142×193 | 132×183 |
| 8×10 | 8×10 | **203×254** | 193×244 | 183×234 |
| 10×12 | 10×12 | 254×305 | 244×295 | 234×285 |
| 11×14 | 11×14 | **279×356** | 269×346 | 259×336 |
| 12×16 | 12×16 | 305×406 | 295×396 | 285×386 |
| 16×20 | 16×20 | **406×508** | 396×498 | 386×488 |
| 20×24 | 20×24 | 508×610 | 498×600 | 488×590 |
| 24×36 | 24×36 | 610×914 | 600×904 | 590×894 |

### 2.2 ISO/A 系列（紙張）

| 規格 | mm | 中文俗稱 |
|---|---|---|
| A6 | 105×148 | 明信片 |
| A5 | 148×210 | 半 A4 |
| A4 | **210×297** | 證書/獎狀最常見 |
| A3 | **297×420** | 海報入門 |
| A2 | 420×594 | 大海報 |

### 2.3 特殊規格

| 規格 | mm | 用途 |
|---|---|---|
| Polaroid | **88×107** | 寶麗來 |
| Polaroid Mini (Instax) | 54×86 | 富士拍立得 |
| 6×6 | 152×152 | 中片幅 / 唱片小盤 |
| 6×9 | 152×229 | 中片幅 645/690 |
| 12×12 黑膠 | **305×305**（套封 318×318） | 12" LP |
| 7×7 黑膠 | 178×178（套封 184×184） | 7" 單曲 |

> **wrd 預設**：input.length = 照片寬、input.width = 照片高，模板預設 4×6 (102×152) 起跳。Mat 留白邊建議做成 option：`matReveal` 5 / 10 / 15 / 20 / 30 mm。

---

## 3. Mat（卡紙板）系統

### 3.1 兩種 mat 角色

- **Window mat（窗 mat）**：上層，挖洞露照片；標準 1/16" (1.6mm) 厚博物館棉芯卡紙。
- **Backing mat（背 mat）**：下層，貼照片；3/16" (4.8mm) foam board 最常用。

### 3.2 留白邊 (reveal / border) 標準

| 留白邊寬 | mm | 適用照片 | 風格 |
|---|---|---|---|
| 細 | 5-8 | 4×6 / 5×7 | 緊湊現代 |
| 標準 | 10-15 | 5×7 / 8×10 | 平衡日常 |
| 寬 | 20-30 | 8×10 / 11×14 | 美術館感 |
| 戲劇 | 40-75 | 16×20+ | 畫廊風 |

業界鐵則：**頂留白邊 = 兩側留白邊**，**底留白邊 +5~10mm**（重力視覺補償，叫 weighted bottom）。但現代攝影展多採四邊等距。

### 3.3 開窗計算

```
window_w = photo_w − 5mm  (照片每邊被 mat 蓋 2.5mm)
window_h = photo_h − 5mm
mat_outer_w = photo_w + 2 × reveal
mat_outer_h = photo_h + 2 × reveal
frame_inner = mat_outer + 2mm 鬆動量（4 邊 rabbet 內緣）
```

> 4×6 照片 + 10mm 留白邊 → window 97×147、mat 122×172、frame 內徑 124×174。

---

## 4. 邊框輪廓刀（Router Bit）庫

### 4.1 五大基本輪廓（修邊機可一刀完成）

| 輪廓 | 刀型 | 規格 | 視覺 | 用途 |
|---|---|---|---|---|
| Flat | 不用刀 | — | 直角 | 北歐極簡 |
| Chamfer | 45° / 22.5° / 30° 倒角刀 | 切深 6-12mm | 斜面 | 工業/包浩斯 |
| Roundover | R3 / R6 / R9 / R12 圓角刀 | R = 半徑 | 凸圓 | 現代柔和 |
| Cove | R6 / R9 / R12 凹弧刀 | R = 半徑 | 凹圓 | 古典過渡 |
| Ogee | R6+R6 雙曲線 / R9+R9 | 標準 Roman ogee 1/4"+1/4" | S 形 | 維多利亞 |

### 4.2 進階組合輪廓

- **Stepped ogee**：ogee + 直階 → 古典裝飾框，需 2-3 把刀疊銑
- **Bullnose**：上下對稱半圓 → 老件感
- **Beadboard**：細圓珠線 → 鄉村風
- **Crown**：頂部加冠線 → 教堂感、鏡框雙用

### 4.3 切深與順序原則

1. **先銑後切**：先在長板邊銑輪廓，最後才 45° 切段，否則內外角會裂。
2. **逆向走刀**：避免崩邊，順紋走完再倒著補。
3. **每刀切深 ≤ 3mm**：硬木（橡木/胡桃）多刀分次，否則燒焦。
4. **rabbet 切在背面**：先銑正面輪廓 → 翻面銑 rabbet → 切 45°。

---

## 5. 45° 斜接補強工法（六選一）

### 5.1 強度排序（相對於純膠斜接 = 1×）

| 方法 | 強度倍率 | 工時 | 工具 | 視覺 |
|---|---|---|---|---|
| 純膠 45° | 1× | 5 min | 帶夾 | 隱藏 |
| V-nail（穿釘） | 1.5× | 1 min | underpinner | 背面可見 |
| Biscuit | 2× | 3 min | 餅乾機 | 隱藏 |
| Spline 鴿尾木片 | 3× | 10 min | 桌鋸 jig | **正面可見** |
| Hidden dowel | 4× | 8 min | 鑽床 | 隱藏 |
| Mitered half-lap | 4× | 15 min | 桌鋸/帶鋸 | 隱藏 |

### 5.2 Spline 規格（wrd 預設工法）

```
spline 長度 (嵌入深度) = 12 mm
spline 厚度 = 3-5 mm（建議 4 mm，配 4mm 直刀切槽）
spline 寬度 = frameWidth × 0.6（不要切到 rabbet 邊）
spline 距內緣偏移 = frameWidth × 0.25 ~ 0.35
spline 角度 = 45°（垂直於斜接面）；90°（平行框面）也常見更顯眼
spline 數量 = 1 條 / 角（小框）、2 條 / 角（大框 ≥11×14）
```

> spline 用對比木材（深框配楓木、淺框配胡桃）才出色。**wrd 已實作**：`mitered-spline` joinery，`splineT=4mm splineW=frameW`。

### 5.3 V-nail（量產用）

商業相框工廠用 underpinner（V-nailer）打 7mm-15mm V 形不鏽鋼釘，背面像「V」。一般家用木工不用。

### 5.4 Half-lap miter（最強組合）

正面看是 45°，背面是搭接（half-lap）。每根半厚切除（厚 18mm → 切 9mm 深 × 寬 frameWidth），長紋對長紋膠接，強度 4×。代價：拆/裝玻璃較難。

---

## 6. 玻璃槽（Rabbet / Groove）系統

### 6.1 rabbet 截面標準

```
rabbet 寬 = 8-12 mm（夠塞玻璃 + mat + 背板）
rabbet 深 = 玻璃厚 + mat 厚 + 背板厚 + 2mm 餘裕
       = 2 + 2(mat) + 4(背板) + 2 = 10 mm（典型）
       = 2 + 0(無mat) + 4 + 2 = 8 mm（最簡）
```

### 6.2 wrd 預設值（`photo-frame.ts`）

```typescript
glassThickness: 2 mm    // 標準透明玻璃，玻璃行可裁
glassGrooveDepth: 6 mm  // 4 邊鋸槽深，玻璃 2 + 背板 4 = 剛好
backThickness: 4 mm     // 三合板/夾紙板背板
BACK_PANEL_CLEARANCE: 4 // 每邊背板比玻璃大 4mm 卡入裕度
GLASS_FRAME_INSET: 2    // 玻璃槽內縮 2mm 不從正面看到
```

### 6.3 切槽工法選擇

| 工法 | 工具 | 切口品質 |
|---|---|---|
| 桌鋸薄鋸片 | 2mm dado | 快但毛邊多 |
| 修邊機 + rabbet bit | 帶軸承的 1/4" rabbet 刀 | 最乾淨 |
| 銑刨機 | 整片銑 | 量產 |
| 手鑿 | 小型作品專用 | 最慢 |

> 內緣 rabbet 是「在邊框背面內側挖一個凹台」，從正面看不到。和「玻璃槽」(groove) 的差別是：rabbet 開放（L 形截面）、groove 封閉（U 形截面）。**相框幾乎都用 rabbet**，不用 groove，因為要從背面塞玻璃/背板/照片。

### 6.4 玻璃選擇

- **Float glass 浮法玻璃 2mm**：最便宜、4 邊磨砂。
- **Anti-reflective 抗反射玻璃**：博物館用、價格 5-10×。
- **UV 阻隔玻璃**：保護珍貴照片、檔案。
- **Acrylic 壓克力 2-3mm**：輕、不破，但易刮花。
- **無玻璃**：北歐極簡、有些 floater frame 不裝玻璃。

---

## 7. 立架背面系統（Easel Back）

### 7.1 V 形折收立架（最常見）

```
立架板厚度 = 3-5 mm（夾板或 MDF）
立架寬 = frameOuterW × 0.4 ~ 0.5
立架高 = frameOuterH × 0.7
固定鉸鏈 = 距上邊 1/3 框高
打開角度 = 15-30°（重心穩）
收起時平貼背面，可掛牆兩用
```

### 7.2 鋸齒鈎 (Sawtooth hanger)

- 規格：寬 28mm × 高 8mm 鍍鋅鋼
- 釘 2 顆 5mm 銅釘
- 承重 ≤ 11 kg（24×36" 以下安全）
- 安裝：背板上緣中央，距邊 30mm

### 7.3 D 形掛勾 (D-ring)

- 規格：D 環 + 雙孔金屬底座，雙孔承重達 18 kg
- 安裝：背面左右各 1 個，距上緣 1/3 處
- 配畫線（picture wire）拉緊
- 大相框 (16×20" 以上) 必用

### 7.4 雙鈎 (two-hole keyhole)

兩個鎖孔讓螺絲頭穿過後下滑卡住，最穩、不會晃，但要求牆釘間距絕對精準。

### 7.5 wrd 模板邏輯

```
stand: easel | wall-hung | both
- easel: 加 V-strut + hinge，不出 D-ring
- wall-hung: 加 sawtooth + D-ring，不出 V-strut
- both: 兩者都加，可摺收
```

---

## 8. 裝飾系統

### 8.1 Inlay（鑲嵌）

- **Stringing**：細木條鑲線，1.5-3mm 寬、深 1-2mm，沿框邊走一圈。
- **Banding**：寬鑲帶，5-15mm 寬，預製花紋條。
- **Marquetry**：拼花，邊角放小花紋。
- 工具：鑿刀 + 修邊機 inlay bit 套組。

### 8.2 銅角護角 (Corner brackets)

- 規格：邊長 25-40mm L 形黃銅
- 厚度 1-2mm
- 古典/工業/復古風常見
- 釘法：4 顆迷你銅釘（每邊 2 顆）

### 8.3 烙印 (Wood burning / pyrography)

- 工具：烙鐵 60-100W
- 角落或中段烙 logo / 落款
- 適合 4×6 / 5×7 紀念框

### 8.4 Gilded 金箔（最高等級）

- **Water gilding 水鍍金**：傳統工法，gesso 底 + bole 紅泥 + 23K 金箔 + 拋光
- **Oil gilding 油鍍金**：較快，size 油底 + 金箔，無法拋光但更耐久
- **Gilding wax 鍍金蠟**：偷懶版，蠟膏直接擦，用於修補
- 老化 (patina)：金箔上塗深 shellac、鋼絲絨打磨、bitumen 蠟仿古

### 8.5 雕刻 (Carving)

歐式古典框雕葉飾（acanthus）、中式框雕雲紋/萬字格。需 V 形雕刻刀組 + 圓口刀，5-10 把起跳。

---

## 9. 圓形 / 橢圓 / 八角框工法

### 9.1 八角（最簡單，wrd 易擴）

- 8 段、每段內角 135°、斜接 22.5°
- 段長 (對邊) = 內徑 / (1 + √2) × 2 ≈ 內徑 × 0.828
- 等同直框做法，只是斜切 22.5° 取代 45°

### 9.2 圓形（段組 segment ring）

- 推薦 8 段 / 12 段 / 16 段
- 每段內角 = 180° − (360° / N)
- 8 段：每段 135°，斜接 22.5°
- 12 段：每段 150°，斜接 15°
- 16 段：每段 157.5°，斜接 11.25°
- 段組膠接後，車床或修邊機 jig 銑成圓
- **wrd 圓形相框可用 polygon-N 近似**，N=12 視覺上已是圓

### 9.3 橢圓

- 段數不等：長軸 4 段、短軸 4 段，共 8 段（每段角度不同）
- 或 16 段近似、車床橢圓 jig
- 難度最高，工業上用 routing template + 雙樞 trammel

---

## 10. Floating Frame / Shadow Box 細節

### 10.1 Floating canvas frame（帆布浮動框）

- L 形截面：水平腳 = canvas 厚 + 5mm（典型 25-50mm）
- 直立腳 = 35-50mm 高，不蓋 canvas 邊
- canvas 與框之間留 reveal = 3mm / 6mm / 12mm（窄/中/寬）
- canvas 從背面用 L 角片 + 螺絲固定
- **不裝玻璃**

### 10.2 Floating photo frame（雙玻璃浮動框）

- 兩片玻璃夾照片
- 照片懸在 mat 中央，邊緣可見
- 邊框 rabbet 加深至 4 + 4 + 2 = 10mm
- 鉸鏈雙連版：兩片合書本，桌面立或掛牆

### 10.3 Shadow box（深框）

- 內深 = 50 / 70 / 90 / 100 mm 規格
- 物件厚度 + 10mm 餘裕
- 框面 + 內 spacer：玻璃壓在前緣 rabbet，背板深處 spacer 撐高物件
- 紀念品（軍勳、結婚捧花、簽名球）必用
- 日本叫「立体額／ボックスフレーム」，奥行き 30mm 起跳

### 10.4 Diorama box（3D 場景）

- shadow box 加深版，內深 100-200mm
- 內襯紙 / 微縮場景
- 玻璃前 + 雙開背板（方便擺設）

---

## 11. 黑膠唱片框 (Vinyl LP frame)

- 12" LP 套封外尺寸：**315×315 mm**（USA 12.5×12.5"）
- 7" 單曲：**185×185 mm**
- 框內徑：套封 + 5mm 鬆動 = 320×320
- 框面寬：22-30mm（要克制，唱片本身就大）
- 框深：22-30mm（含 mat + 唱片 1mm + 套封 3mm + 背板 4mm + 餘裕）
- 立架 / 掛牆兩用，且要承重（套封+唱片 ≈ 250g）

---

## 12. 市售品牌規格參考

| 品牌 | 系列 | 4×6 外徑 | 5×7 外徑 | 8×10 外徑 | 框深 | 邊框寬 |
|---|---|---|---|---|---|---|
| IKEA Ribba | shallow | 130×180 | 180×230 | 230×280 | 18 | 25 |
| IKEA Ribba | deep | — | 180×230 | 230×280 | 40-50 | 35 |
| 無印良品 | 木製相框 | 130×180 | 180×230 | 230×280 | 15 | 20 |
| Pottery Barn | Wood Gallery | 150×200 | 200×250 | 250×300 | 25 | 35-50 |
| Anthropologie | Gleaming Gilded | 不規則 | 不規則 | 不規則 | 30 | 40-60 |

> IKEA Ribba **shallow** = 18mm 深、**deep** = 40-50mm 深，兩個檔次涵蓋平面與 shadow box。wrd 模板可內建 `style preset`：北歐極簡 / 古典深框 / 浮動畫布 / 黑膠唱片。

---

## 13. wrd 模板擴充建議（第一性原理）

### 13.1 已有 option（保留）

- `frameWidth` / `frameThickness` / `backThickness` / `glassThickness` / `glassGrooveDepth`
- `frameProfile`: flat / chamfer-out / chamfer-in / ogee / cove
- `multiPhotoLayout`: single / horizontal-2/3 / vertical-2 / grid-4
- `stand`: easel / wall-hung / both

### 13.2 建議新增 option

| key | 中文 | 預設 | 範圍/選項 | 影響 |
|---|---|---|---|---|
| `matReveal` | mat 留白邊 (mm) | 0 | 0/5/10/15/20/30 | 新增 mat 部件 |
| `splineMaterial` | spline 對比木 | "auto" | 楓/胡桃/橡木 | 部件材料分流 |
| `splineCount` | 每角 spline 數 | 1 | 1 / 2 | 大框補強 |
| `frameShape` | 整體形狀 | rectangle | rect/oct/round-12/round-16/oval | 段組生成 |
| `depth` | 內深規格 | flat | flat(18)/shadow-50/shadow-90/diorama-150 | 替換厚度 |
| `floatingMode` | 浮動模式 | none | none/canvas/double-glass | L 截面或雙玻璃 |
| `decorStyle` | 裝飾風格 | none | none/inlay-stringing/corner-brass/gilded | 裝飾子部件 |
| `vinyl` | 黑膠模式 | off | off/7"/12" | 鎖定方框尺寸 |
| `cornerJoinery` | 補強工法 | spline | spline / biscuit / dowel / half-lap / v-nail | joinery 切換 |

### 13.3 三視圖渲染要點

- **正視圖**：照片可視窗 + mat 留白邊 + 邊框輪廓（不同 profile 對應不同剖面線）
- **側視圖**：邊框厚度剖面（flat / chamfer / ogee 各畫不同線條）+ 玻璃 + 背板層次
- **俯視圖**：rabbet 槽位置 + spline 槽位置（背面虛線）
- **3D**：浮動模式時 canvas 要從框背露出 5mm 表現懸浮感

### 13.4 工序對偶（組裝 SOP）

1. 選材、依 photoSize 計算 4 條邊長 = (photoW + 2×frameW), (photoH + 2×frameW)
2. 銑正面輪廓（ogee / cove / roundover）
3. 翻面銑 rabbet（玻璃槽）
4. 桌鋸 45° 切段（4 段）
5. 試組、修肩
6. 上膠 + 帶夾或斜接夾固
7. 桌鋸 spline jig 切槽（每角 1-2 條）
8. spline 對比木裁切 + 上膠塞入
9. 鋸平 spline、砂光全身
10. 上漆／油 / 蠟（依 finish）
11. 裝玻璃 + mat + 照片 + 背板，背板四周用釘鈀或彈性夾片固定
12. 背面裝立架 / 鋸齒鈎 / D 環

---

## 14. 預設尺寸 preset (wrd 模板可內建)

| Preset | photoSize | frameW | frameT | profile | shape | depth | corner | stand | matReveal |
|---|---|---|---|---|---|---|---|---|---|
| 北歐極簡 4×6 | 102×152 | 20 | 15 | flat | rect | 15 | spline | easel | 5 |
| 北歐極簡 8×10 | 203×254 | 25 | 18 | chamfer-out | rect | 18 | spline | both | 10 |
| 古典 5×7 | 127×178 | 35 | 22 | ogee | rect | 22 | spline | wall-hung | 15 |
| 浮動畫布 | 400×500 帆布 | 18 | 40 | flat | rect | 40 | half-lap | wall-hung | 0 |
| Shadow box | 200×250 | 30 | 70 | flat | rect | 70 | spline | both | 0 |
| 黑膠 12" | 315×315 | 25 | 25 | flat | rect | 25 | spline | both | 0 |
| 八角 6×6 | 152×152 | 28 | 18 | roundover | oct | 18 | spline | easel | 8 |
| 圓形 5×5 | 127×127 | 30 | 18 | cove | round-12 | 18 | spline | wall-hung | 0 |
| Diorama | 200×250×150 | 35 | 150 | flat | rect | 150 | half-lap | wall-hung | 0 |

---

## 15. 木工陷阱與細節（木頭仁實戰）

1. **45° 角不準的真因**：通常不是斜切角度跑掉，是 4 條邊不等長。先過長 5mm，最後修一刀。
2. **玻璃會卡死**：rabbet 內側要倒一點點 0.5mm 斜面，玻璃才塞得進去。
3. **背板會凸**：背板比 rabbet 大 1mm 是常見錯誤，永遠 -1mm 餘裕。
4. **spline 鋸不平**：先鋸帶鋸切大段、再桌鋸修平面、再砂光，三道工序不能省。
5. **寬框會翹**：frameWidth > 50mm 時，木料一定要四面刨直，否則組起來呈 banana。
6. **油性塗料吃進 rabbet**：刷漆順序 → 銑完輪廓 → 切段前先漆內緣 → 切 45° → 組合（保護內緣不沾膠）。
7. **大框 16×20"+ 必加 D 環 + 鋼絲**：sawtooth 撐不住 5kg 以上。
8. **玻璃要訂 2.0mm 不是 3.0mm**：3mm 雖然不易破，但重量 +50%、影響掛牆穩定。
9. **mat 要無酸**：100% cotton museum board，否則 5 年照片會發黃。
10. **臺灣濕度 75%+**：相框木料平衡含水率 12-14%，比家具 8-10% 高。烘乾過頭會裂。

---

## 16. 參考資料來源

### 英文 / 國際
- [Frame Destination — Picture Frame Sizes & Profiles](https://www.framedestination.com/info/picture-frame-sizes.html)
- [Articient — Picture Frame Rabbet Information](https://articient.com/pages/picture-frame-rabbet-informtation)
- [WebPictureFrames — Floating Frames Guide](https://www.webpictureframes.com/floating-frames.html)
- [Rockler — Mitered Half-Lap Corner Picture Frame Plan](https://www.rockler.com/learn/mitered-half-lap-corner-picture-frame-plan)
- [WoodworkingForAmateurs — Why Miters Fail and 3 Better Corner Options](https://blog.woodworkingforamateurs.com/picture-frame-joinery-why-miters-fail-and-3-better-corner-options/)
- [Stumpy Nubs — Making Picture Frames with Regular Router Bits](https://www.stumpynubs.com/shop-vlog/frames-router-bits)
- [Popular Woodworking — 3 Routed Picture Frames](https://www.popularwoodworking.com/projects/3-routed-picture-frames/)
- [Frameworthy — Hanging Hardware Guide](https://frameworthy.com/picture-framing-hardware)
- [Frame My Collection — 12" LP Vinyl Record Frame](https://framemycollection.com/products/12-inch-lp-record-album-frame)
- [Vermont Hardwoods — Picture Frame Wood Species](https://vermonthardwoods.com/picture-frame-wood-species/)

### 日文
- [マルニ額縁画材店 — ボックス額縁／フローティングフレーム](https://www.art-maruni.com/products/list?category_id=630)
- [アートおおがき — 額縁の規格サイズ](https://art-ogaki.com/?p=1438)
- [アートおおがき — シャドーボックス額 特注製作](https://art-ogaki.com/?p=2223)

### 中文
- [簡易手工相框製作教學 (silvatang)](https://blog.xuite.net/silvatang/wretch/173775887-%E7%B0%A1%E6%98%93%E6%89%8B%E5%B7%A5%E7%9B%B8%E6%A1%86%E8%A3%BD%E4%BD%9C%E6%95%99%E5%AD%B8)
- [客製禮品 — 木相框 FAQ](https://sourceec.com.tw/%E5%AE%A2%E8%A3%BD%E5%8C%96%E7%A6%AE%E5%93%81%E8%B3%87%E8%A8%8A%E8%A9%B3%E6%83%85/%E6%9C%A8%E7%9B%B8%E6%A1%86FAQ/)

### 品牌
- [IKEA Ribba Frame Series](https://www.ikea.com/us/en/cat/ribba-series-16456/)
- [Dimensions.com — IKEA Ribba Medium](https://www.dimensions.com/element/ikea-ribba-frame-medium)

---

> 本文版本：2026-05-08 第一版。對應 wrd `lib/templates/photo-frame.ts` HEAD。後續若擴 floating-canvas / shadow-box / round / oct / vinyl 模式，本文要同步補入「13.2 建議新增 option」實作後狀態。
