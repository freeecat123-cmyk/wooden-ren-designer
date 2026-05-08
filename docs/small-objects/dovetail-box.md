# 鳩尾盒（Dovetail Box）設計參考

> wrd 家具設計器 small-objects 系列研究文件
> 對應模板：dovetail-box（已存在）+ 衍生變體（首飾盒 / 雪茄盒 / 茶葉盒 / 手錶盒 / 文件盒 / 工具盒 / 紀念盒…）
> 版本：v1（2026-05-08 初版）

---

## 0. 為什麼鳩尾盒值得一個獨立模板（不是「方盒+裝飾」）

鳩尾盒不是「方盒貼鳩尾」這麼簡單。它的設計參數比一般 small-object 多三層：

1. **接合層**：通鳩尾 / 半隱 / 全隱密接（含鳩尾傾角、tail/pin 比、間距）。
2. **蓋型層**：滑入 / 鉸鏈 / 整片活動 / 嵌入 / 翻蓋 / fitted lip。
3. **內裝層**：絨布 / 磁吸 / 鎖扣 / 隔板 tray / 西班牙杉 / 軟枕。

任一層改變都牽動其他層（例：選 hinged 蓋 → 內側不能太深 → tray 高度上限改變；選 secret-mitered → 蓋沿不能用嵌入式 rabbet，否則破功）。所以 wrd 模板必須把這三層用 option group 分開，且 dynamic visibility 互鎖。

---

## 1. 18 種款式總覽（含尺寸建議與重點選項）

| # | 款式 | 外尺寸 W×D×H (mm) | 板厚 (mm) | 接合 | 蓋型 | 內裝重點 |
|---|---|---|---|---|---|---|
| 1 | 首飾盒（Jewelry Box） | 250×150×80 | 12 | 通鳩尾 / 半隱 | 鉸鏈 + 鏡 | 絨布 + 活動 tray |
| 2 | 雪茄盒（Humidor） | 280×200×120 | 18（外殼）+ 8（內 cedar） | 半隱 / 全隱密接 | 嵌入 + 濕度計 | 西班牙杉內襯 + Boveda |
| 3 | 茶葉盒（Tea Caddy） | 100×100×120（罐型）/ 200×120×80（盒型） | 10 | 半隱 / 通鳩尾 | 內 lip 雙層蓋 | 防潮膠條 + 錫箔 |
| 4 | 手錶盒（Watch Box） | 350×200×80（4 格）| 12 | 通鳩尾 | 玻璃鉸鏈蓋 | 軟枕 ×4 + 絨襯 |
| 5 | 文件盒 A4（Document） | 350×260×100 | 15 | 通鳩尾 | 翻蓋 + 黃銅扣鎖 | 皮革底襯 |
| 6 | 雪茄旅行盒（Travel Humidor） | 200×120×60（5 支） | 10 | 全隱密接 | 嵌入 + 矽膠封條 | 厚 6mm 西班牙杉 |
| 7 | 工具盒（Tool Chest mini） | 500×280×280 | 18 | 通鳩尾（粗 1:6） | 翻蓋 + 內 till | 隔板 + 磁吸刀座 |
| 8 | 樂器配件盒（Pick / Reed） | 160×100×40 | 8 | 半隱 | 滑蓋 | 絨布六格 |
| 9 | 棋盤 + 收子盒（Chess） | 480×480×60（盒）+ 棋盤蓋 | 15 | 通鳩尾 | 整片活動 + cleat | 雙抽屜放黑白子 |
| 10 | 名片盒（Card） | 110×70×35 | 6 | 半隱（小齒） | 滑蓋 / 磁吸 | 絨襯 |
| 11 | 印章盒（Seal / Hanko） | 80×80×60 | 8 | 通鳩尾 | 滑蓋 / 內 lip | 朱泥盒位 + 海綿 |
| 12 | 香煙盒（Cigarette） | 110×70×25 | 6 | 半隱 | 鉸鏈翻蓋 | 金屬內襯（鋁箔） |
| 13 | 急救藥盒（First-Aid） | 240×160×80 | 12 | 通鳩尾 | 翻蓋 + 黃銅扣 | 隔板 + 標籤 |
| 14 | 紀念盒（Keepsake） | 305×190×90（12"×7.5"×3.5"）| 15 | 通鳩尾 / 半隱 | 鉸鏈 + 內框 | 皮革 / 絨布 |
| 15 | 兒童玩具盒（Toy） | 600×400×300 | 18 | 通鳩尾（粗） | 翻蓋 + 緩降鉸鏈 | 圓角 + 安全閉合 |
| 16 | 客製禮物盒（Gift） | 200×140×60 | 10 | 半隱 | 滑蓋 + 烙印 | 絨襯 + 緞帶 |
| 17 | 茶道具盒（Chadōgu） | 360×240×140 | 12 | 通鳩尾 | 滑蓋 + 內 till | 桐木隔板 |
| 18 | 書法用品盒（Calligraphy） | 380×260×80 | 12 | 通鳩尾 | 翻蓋 | 硯位 + 筆架 + 印泥格 |

> wrd preset 可先做 5 個熱門：jewelry / humidor / watch / document / keepsake，其他 13 種以 option 微調覆蓋。

---

## 2. 鳩尾接合三大類型（核心亮點）

### 2.1 通鳩尾 Through-Dovetail（4 角全顯）

兩面都看得見尾與销，是教科書級表現面。

**參數規則：**
- **傾角 angle**：硬木 1:8（約 7.1°）／ 軟木 1:6（約 9.5°）。Lost Art Press 建議 7°-15° 都可接受；視覺上 1:7（約 8.1°）是折衷。
- **tail / pin 比例**：傳統 1:1（粗工/英式）、1:2（tail 比 pin 寬，中性）、1:3（tail 明顯比 pin 粗，現代設計感）。比例超過 3:1 後 pin 太細，強度開始崩。
- **end-pin（首尾半 pin）**：寬度約 = 板厚 × 1.0~1.5（例：12mm 板 → 端 pin 半寬 12-18mm），保護端面爆裂。
- **間距**：tail 中心到中心可採等距或漸變。古典英式做法常採等距；當代多用漸變（中央 tail 較寬，端部較窄）凸顯造型。
- **板厚 vs 齒寬**：齒寬（tail wide end）約 = 板厚 × 1.5~3。12mm 板配 tail 18-36mm 寬。

**工序（手工 7 步）：**
1. **劃線**：用 marking gauge 設成「板厚 + 0.2mm」（伸出量），在端面畫出 baseline；兩面都要。
2. **畫 tail**：在 tail board（盒側板）端面用 dovetail marker（1:8 模板）畫出尾形。
3. **鋸 tail**：Dovetail saw（小齒 15-20 TPI）沿線外側下鋸（waste 側），鋸到 baseline。
4. **去廢**：先 coping saw 鋸掉中段廢料；剩下用 chisel 沿 baseline 鑿到位（兩面對鑿，避免劈裂）。
5. **轉印 pin**：把切好的 tail board 立在 pin board 端面上，用刻線刀沿 tail 輪廓劃線。
6. **鋸 pin**：沿轉印線「線內側（waste 側）」鋸；鋸完同樣 coping saw + chisel 去廢。
7. **試合修配**：乾組裝時應「敲得進去、沒膨脹、看不到縫」；過緊用 chisel 修 pin、tail 不動。

**wrd 渲染要點：** 三視圖中正視 / 側視都會看到 tail 端面菱形圖樣；俯視看到 zigzag。SVG 用 `<polygon>` 列出 tail 頂寬、底寬、端 pin 半寬。

---

### 2.2 半隱鳩尾 Half-Blind Dovetail（前看不到）

抽屜前板經典做法。前面（show face）看不到接合線，只在側板端面看到 pin。

**參數規則：**
- **半隱深度 lap**：前板厚度通常分三等份；接合佔 2/3，前面留 1/3 厚做為 lap（隱藏層）。例：18mm 前板 → tail 入 12mm，留 6mm lap。
- **tail board（側板）**：與 through 一樣切 tail，沒有區別。
- **pin board（前板）**：只挖到 lap 線停住，不通透。

**工序（手工 9 步）：**
1. 劃線（同 through，但 pin board 多劃一條 lap 線在內側）。
2. 切 tail（與 through 完全一樣）。
3. **轉印 pin**：tail 對齊 pin board 內面 baseline，刻線刀劃線。
4. **斜鋸 pin**：dovetail saw 鋸時，鋸子斜放（45° 抬起鋸柄），只能鋸到 lap 線深度，不能鋸穿。
5. **鑿 pin 廢料**：chisel 從內面垂直入刀，分多次往 lap 線推進；最後一刀對著 baseline 垂直切下。
6. **修底**：用窄 chisel（4-6mm）清理 pin 底角（lap 內角難處理）。
7. **試合**：tail 應該完全藏進 pin board，前面看不到任何痕跡。
8. **修配**：過緊時只動 pin 內壁，不動 lap。
9. **膠合**：膠塗在 pin 兩側壁與 tail 兩側壁；lap 內壁不要塗（防止溢膠）。

**wrd 渲染要點：** 前視圖只畫一條「實線板邊」，鳩尾完全隱藏；側視才會看到 pin 端面。詳細圖要區分 through 與 half-blind 的線條分布。

---

### 2.3 全隱密接鳩尾 Secret-Mitered / Blind-Mitered Dovetail（最高難度）

四角從外面看是 45° 斜接（mitre），鳩尾全部藏在內部。是箱類接合的「強度 + 美觀」雙冠王。

**參數規則：**
- **外觀**：四角內外都是 45° miter line，看不到任何 tail / pin。
- **內部結構**：板厚分四層 — 外 mitre 層（厚度 ≈ 板厚 × 0.2~0.3）→ tail/pin 接合區 → 內 mitre 層 → 內面。
- **要求**：板厚 ≥ 12mm 才有意義（更薄空間擠不下 tail+miter）；最佳 15-20mm。
- **適用**：高級首飾盒、雪茄盒、奢侈品包裝；不適合工具盒（過頭了）。

**工序（手工 14 步，硬核版）：**
1. 板厚精準刨平到 ±0.1mm（誤差會在 mitre 處放大）。
2. 兩端內面劃 baseline（深 = 板厚 - mitre 層厚度）。
3. **切外 mitre 槽**：用 shoulder plane 或 router 在端面內角刨出一條 45° 斜面，深度約 = 板厚 × 0.25。
4. 在剩下的「板厚 × 0.75」區域內畫 tail 線（角度同 through 1:8）。
5. **鋸 tail**：tail board 切 tail，但 tail 不能切到「外 mitre 層」，必須留住。
6. **修 tail**：用窄 chisel 清廢，端部留 45° 斜邊（與外 mitre 層連續）。
7. 轉印 pin（pin board 同樣留好外 mitre 層）。
8. **鋸 pin**：斜鋸到 baseline；同樣不能切穿外 mitre 層。
9. **鑿 pin 廢料**：與 half-blind 類似，但要更謹慎；最後修整 pin 端 45° 斜邊。
10. **試合外觀**：兩板乾組，外面四角線必須是完美 45° miter，無縫無段差。
11. **試合內部**：內部 tail/pin 應緊密咬合。
12. **膠合**：tail/pin 全面塗膠；外 mitre 接縫塗薄薄一層即可。
13. **加壓**：用 band clamp + 角塊；需四角同時施壓，避免歪斜。
14. **後修**：膠乾後用刨子修平四角，但不能露出鳩尾內構（微透即破功）。

**Fine Woodworking 評語**：「the strongest dovetail joint, but only worth doing when the box is the centerpiece」。
**wrd 渲染要點**：外觀視圖純粹是四角 45° miter 線；唯有在「joinery 詳圖頁」剖面才顯示內部 tail/pin。

---

## 3. 蓋型 6 種

### 3.1 滑入式 Sliding Lid（前後鋸槽）
- 蓋板厚 6-10mm。
- 前後板內面距底部「總高 - 8mm」處鋸 4mm 深 × 6mm 寬 dado；蓋板兩長邊刨出 3.5mm × 5.5mm tongue。
- 蓋板從一端滑入，另一端做 stop（可拆 cleat 或半開放）。
- 用於名片盒、印章盒、樂器配件盒、小禮物盒、Japanese tool box。

### 3.2 鉸鏈式 Hinged Lid（小銅 hinge）
- 黃銅 quadrant hinge / butt hinge / Brusso 不鏽鋼 stop hinge。
- 後板上沿鑿入 hinge 厚度 mortise；蓋後沿同樣 mortise。
- Quadrant hinge 內含開啟角度限位器（90° 或 95°），首飾盒最常用。
- Brusso 1500-001 系列尺寸：38mm 長、5mm 厚（mortise 深 2.5mm）。

### 3.3 整片活動式 Lift-off + Cleat
- 蓋板平整一片，不裝鉸鏈；底面四角貼 cleat 卡入盒口內側。
- 或蓋板下緣刨 rabbet，與盒口 lip 緊配。
- 用於茶葉盒、棋盤盒（蓋本身就是棋盤）、傳統紀念盒。

### 3.4 嵌入式 Rabbeted Lid
- 盒口四邊刨 rabbet（5×5mm）；蓋板裁切後正好嵌入。
- 蓋板與盒口齊平（flush）。
- 雪茄盒常用，搭配矽膠封條 + 磁吸或扣鎖。

### 3.5 翻蓋 + 限位 Hinged + Chain Stop
- 一般 butt hinge + 內側 brass chain（長度設計成蓋翻 100° 時拉緊）。
- 古式工具箱、文件盒、書法盒。
- chain 一端螺絲固定盒內側、另一端固定蓋內側；可用皮帶或細鐵鏈。

### 3.6 內 lip 嵌合 Fitted Lid
- 蓋內面四邊向下凸出一圈薄邊（lip），高度 5-8mm；正好嵌入盒口。
- 蓋與盒之間靠 lip 摩擦定位，無 hinge、無滑軌。
- 茶葉罐、印章盒、客製禮物盒。**雙層蓋**版本還會在 lip 內再做一個內蓋（chazutsu 風格防潮）。

---

## 4. 內部選項（11 種，可組合）

| 選項 | 規格 / 採購 | 安裝重點 |
|---|---|---|
| 絨布內襯 felt | 1mm 自黏絨布 / velvet（200×300mm 整片裁） | 底+四壁分片貼，避免氣泡；邊緣用 chisel 壓邊 |
| 磁吸閉合 | 釹磁鐵 6mm × 2mm × 2 對 | 蓋與前板各埋一顆，極性對齊；epoxy 固定 |
| 隔板 tray | 活動 tray，6 格或 12 格 | tray 框比盒內寬小 1mm；底部加 cleat 防下沉 |
| 鎖扣 | 黃銅 hasp lock / 古銅機關鎖 / 皮繩釦 | 鎖扣螺絲先打 pilot hole；皮繩釦用銅釘固定 |
| 雪茄保濕器 | Boveda 60g 包 + 西班牙杉內襯 + 數位濕度計 | 杉木 5-8mm 厚整面貼；Boveda 放專屬槽 |
| 手錶軟枕 | 記憶海綿 50×50×40mm + 絨布套 | 枕直徑 25-50mm 可調；底部 velcro 黏在槽內 |
| 香煙金屬內襯 | 鋁箔貼紙 / 不鏽鋼薄板 0.3mm | 預先裁切後折邊插入；防菸味滲入木材 |
| 內襯絨皮革 | 義大利全粒面 0.6-0.8mm 皮革 | 強力膠（contact cement）；24h 加壓 |
| 鏡子（首飾盒蓋內側） | 2mm 銀鏡 + 黃銅鏡框 | 蓋內面挖 rabbet，鏡子放入後上鏡框條壓邊 |
| 西班牙杉內襯（雪茄） | 5-8mm Cedrela odorata | 整面貼，留 1mm 膨脹縫；不上漆 |
| 防潮膠條（茶葉盒） | EPDM 矽膠條 3×3mm | 蓋 lip 內側貼一圈；切角時用刀片 45° 接 |

**動態互鎖規則：**
- 選 secret-mitered → 不能選嵌入式 rabbet 蓋（rabbet 會破壞外 mitre）。
- 選 humidor 預設 → 自動鎖定西班牙杉內襯 + 矽膠封條 + 嵌入式蓋。
- 選滑蓋 → 不能選磁吸閉合（路徑衝突）。
- 選 jewelry 預設 → tray 與鏡子可同時存在；hinged 蓋強制 quadrant hinge。

---

## 5. 裝飾 7 種

1. **黃銅角包 corner brackets**：四角各一片 L 形銅片，銅釘固定。常見尺寸 25×25×0.8mm。古典工具箱必備。
2. **烙印名字 branding**：客製化必殺；wrd 模板可在 textures 裡掛 name SVG。
3. **雕刻 carving**：手雕（chisel + V tool）或 CNC；常在蓋面做 monogram。
4. **鑲嵌 inlay**：不同色木料（如黑檀條 + 楓木）在蓋面鑲幾何圖案；double-bevel inlay 是 FW 推薦做法。
5. **雷射雕刻 laser engraving**：黑白圖、文字；最快也最便宜。
6. **噴砂玻璃蓋 sandblasted glass**：玻璃蓋（5mm 強化玻璃）噴砂出半透明圖；常見手錶盒、紀念盒。
7. **鑲嵌珠寶**：珍珠母貝 / 銅釘星座圖；高級首飾盒做法。

---

## 6. 木材選擇對照表

| 木材 | 硬度（Janka, lbf） | 顏色 | 紋理 | 鳩尾適性 | 建議用途 |
|---|---|---|---|---|---|
| 黑胡桃 Black Walnut | 1010 | 深棕巧克力色 | 直紋偶波浪 | ★★★★★ 易切、咬合好 | 首飾盒、紀念盒、文件盒 |
| 櫻桃 Black Cherry | 950 | 紅棕（會深化） | 細直紋 | ★★★★★ | 紀念盒、禮物盒、書法盒 |
| 硬楓 Hard Maple | 1450 | 乳白象牙 | 細密直紋 | ★★★★ 緻密、需鋒利刀 | 棋盤盒、首飾盒、現代極簡 |
| 紅橡 Red Oak | 1290 | 淡紅褐 | 粗直紋大孔 | ★★★ 開放孔需填 | 工具盒、傳統文件盒 |
| 白橡 White Oak | 1360 | 黃褐 | 直紋（鏡面 ray） | ★★★★ 防水佳 | 茶道具盒、戶外用 |
| 緬甸柚 Burmese Teak | 1070 | 金黃帶黑線 | 直紋油性 | ★★★ 油性需脫油 | 雪茄旅行盒、海事用 |
| 印度紫檀 East Indian Rosewood | 2440 | 紫黑帶紋 | 交錯紋 | ★★★ 硬、需小齒鋸 | 高級首飾盒、樂器盒 |
| 鐵刀木 Sok | 2380 | 深紅黑 | 細直紋 | ★★★ 重、難加工 | 印章盒、棋子盒 |
| 西班牙杉 Spanish Cedar | 600 | 淺粉紅 | 直紋香氣 | ★★ 軟、僅做內襯 | 雪茄盒內襯（不做外殼） |
| 桐木 Paulownia | 280 | 淺灰白 | 直紋輕 | ★ 太軟 | 茶道具盒內襯（防潮抗蟲） |

**搭配原則：**
- 外殼硬木 + 內襯軟香木（雪茄盒：胡桃外 + 西班牙杉內；茶盒：櫻桃外 + 桐木內）。
- Tail board 與 pin board 選同種木最簡單；異種木做對比款（楓 + 胡桃）會讓鳩尾更明顯。
- 含水率 8-12%，avoid 變形；製作前木料先在工房放 2 週適應。

---

## 7. 市售品牌 / 標竿參考

| 品牌 | 國家 | 主打 | 價位帶 | 借鑑點 |
|---|---|---|---|---|
| Daniel Marshall | USA | 雪茄盒（白宮御用） | USD 800-15000 | 厚壁 cedar、品牌烙印、20 年保固 |
| Visol | USA | 入門雪茄盒 | USD 50-300 | 模組化內裝、平價漆面 |
| Wolf Designer | USA | 手錶盒 / Winder | USD 200-3000 | 自動上鏈馬達、LED 內燈 |
| Orbita | USA | 高端 Winder + Cushion | USD 500-10000 | Cushion 標準 2.5"×1.5" |
| Barrington | UK | 手錶 cushion 配件 | GBP 25-80 | 軟枕尺寸 SOP |
| Kaikado 開化堂 | 京都 | 銅製茶筒（chazutsu） | JPY 12000-80000 | 雙層內蓋密合、130 道工序 |
| MUJI 無印良品 | 日本 | 桐木茶道具盒 | JPY 3000-12000 | 滑蓋 + 桐木簡潔美學 |
| Lost Art Press | USA | Anarchist's Tool Chest 書 + 圖紙 | USD 50（書） | 13 dovetails / 角，dust seal 設計 |
| Klaro | USA | 平價精品雪茄盒 | USD 150-500 | 5mm cedar veneer 規格 |
| Boveda | USA | 濕度包（不是盒，但必裝） | USD 15-40 | 69%/72%/75% RH 三種 |

---

## 8. wrd 模板實作建議

### 8.1 Option group 拆解（v2 提案）

```
Group A — 接合（dovetail joint）
  joinery.type:        through | half-blind | secret-mitered
  joinery.angle:       1:6 | 1:7 | 1:8（ratio）
  joinery.tailToPin:   1:1 | 1:2 | 1:3
  joinery.endPinHalfWidth: 0.8×t | 1.0×t | 1.5×t（t = 板厚）
  joinery.tailCount:   3 | 5 | 7（auto by H）

Group B — 蓋型（lid）
  lid.type:            sliding | hinged | lift-off | rabbeted | flip-chain | fitted-lip
  lid.thickness:       6 | 8 | 10 | 12 mm
  lid.hingeBrand:      brusso | quadrant | butt | none
  lid.lipDepth:        5 | 8 mm（fitted-lip only）

Group C — 內裝（interior）
  interior.felt:       none | bottom | full
  interior.magnet:     none | 6×2mm | 8×3mm
  interior.tray:       none | 6cell | 12cell | adjustable
  interior.lock:       none | brass-hasp | leather-strap | hidden-cam
  interior.cedarLiner: none | 5mm | 8mm
  interior.watchPillow: none | 4-pillow | 6-pillow
  interior.mirror:     none | lid-inside

Group D — 裝飾（decoration）
  deco.cornerBracket:  none | brass-25mm | iron-30mm
  deco.brand:          none | name-laser | name-burned
  deco.inlay:          none | line-banding | medallion
  deco.glass:          none | clear-5mm | sandblasted

Group E — 預設套用（preset）
  preset: jewelry | humidor | watch | document | keepsake | tea-caddy | tool-chest
```

### 8.2 動態 visibility 規則
- `joinery.type == 'secret-mitered'` → hide `lid.type == 'rabbeted'`
- `lid.type == 'sliding'` → hide `interior.magnet`、hide `lid.hingeBrand`
- `preset == 'humidor'` → 強制 `interior.cedarLiner = 5mm`、`lid.type = rabbeted`
- `preset == 'watch'` → 強制 `interior.watchPillow = 4-pillow`
- `joinery.type == 'half-blind'` → 限制 `joinery.endPinHalfWidth >= 1.0×t`（lap 強度需求）

### 8.3 三視圖渲染重點
- **正視**：依 `joinery.type` 切換
  - through → 顯示 tail 端面菱形列（zigzag baseline）
  - half-blind → 純板邊實線，無鳩尾
  - secret-mitered → 四角 45° 斜接線
- **側視**：always 顯示 pin 端面（through / half-blind 都看得到）
- **俯視**：顯示蓋型輪廓（hinge 位置 / 滑蓋 dado / lip 邊）

### 8.4 拆解動畫（?explode=N）
- N=0：完整盒
- N=1：蓋抬起 30mm
- N=2：tray 抬起 20mm
- N=3：四片側板分開 60mm（鳩尾外露）
- N=4：底板下沉 40mm + 內襯展開

---

## 9. 工序總工時（人工估算）

| 款式 | 接合 | 工時（小時） | 難度 |
|---|---|---|---|
| 名片盒（半隱小齒）| half-blind | 6-10 | 中 |
| 首飾盒（通鳩尾 + tray + 鏡）| through | 15-25 | 中高 |
| 雪茄盒（半隱 + cedar + 嵌入蓋）| half-blind | 25-40 | 高 |
| 手錶盒（通鳩尾 + 玻璃蓋 + 軟枕）| through | 20-30 | 中高 |
| 文件盒 A4（通鳩尾 + 翻蓋 + 鎖）| through | 18-25 | 中 |
| 紀念盒（通鳩尾 + 皮革 + 鉸鏈）| through | 18-28 | 中高 |
| 全隱密接盒（任何尺寸）| secret-mitered | 30-60 | 極高 |
| 兒童玩具盒（粗鳩尾）| through | 12-18 | 中 |

> 木匠學院課程設計建議：先教 through dovetail（首飾盒入門）→ 再教 half-blind（抽屜實戰）→ 進階班才碰 secret-mitered。

---

## 10. 與既有 wrd 模板的關係

- **dovetail-box（已存在小物件 v1）**：目前只有 through dovetail + 簡單翻蓋；本 doc 是 v2 升級藍圖。
- **3D CSG 挖洞**：wrd Phase 2 已對 26 模板做 CSG，鳩尾盒應該也已有 tail / pin 鏤空；確認 `templates/dovetail-box.tsx` 的 joinery mode 是否吃 `joinery.type`。
- **drafting-math.md §鳩尾**：本 doc 的角度／比例規則需與 drafting-math.md 對齊；若衝突 doc 為主，code 為輔。
- **details.tsx 渲染**：通鳩尾、半隱、密接三種都需要對應 SVG fallback（目前只有 dovetail 一種泛用渲染，需擴充）。

---

## 11. 後續 backlog（不在本次實作）

- [ ] 加 `joinery.tailCountMode = auto | manual`，auto 時依 H 計算（每 50mm 一個 tail）
- [ ] 加 `quote.dovetailHourPerCorner` 工時模型（through 0.4h、half-blind 0.6h、secret 1.5h）
- [ ] 雪茄盒專屬：濕度計位 + Boveda 槽 CSG
- [ ] 手錶盒專屬：軟枕 4/6/8 自動排版（W 分配演算法）
- [ ] 棋盤盒專屬：盒蓋上層棋盤格（黑白格 SVG 用 pattern fill）
- [ ] 茶葉盒專屬：雙層蓋（外蓋 + 內 lip 蓋）剖面詳圖
- [ ] details.tsx 補上 secret-mitered 剖面圖（顯示內部隱藏 tail）
- [ ] preset auto 套用 deco.brand = `木頭仁` 烙印（個人品牌彩蛋）

---

## 12. 參考資料

- [Designing Dovetails for Strength and Style — Fine Woodworking](https://www.finewoodworking.com/2012/05/31/designing-dovetails-for-strength-and-style)
- [Dovetail Layout: What Ratio or Degree? — Popular Woodworking](https://www.popularwoodworking.com/editors-blog/dovetail-layout-what-ratio-or-degree/)
- [The 'Right' Angle for Dovetails — Lost Art Press](https://blog.lostartpress.com/2022/10/18/the-right-angle-for-dovetails/)
- [Half-Blind Dovetails Cut by Hand — Fine Woodworking](https://www.finewoodworking.com/2015/09/30/half-blind-dovetails-cut-by-hand)
- [How to Cut Half-Blind Mitered Dovetails — Fine Woodworking](https://www.finewoodworking.com/2019/07/31/how-to-cut-half-blind-mitered-dovetails)
- [Secret Dovetails for the Rest of Us — Popular Woodworking](https://www.popularwoodworking.com/techniques/secret-dovetails-for-the-rest-of-us/)
- [Mitered Dovetail Box — Popular Woodworking](https://www.popularwoodworking.com/projects/mitered-dovetail-box/)
- [An Elegant Jewelry Box — Fine Woodworking](https://www.finewoodworking.com/project-guides/boxes/an-elegant-jewelry-box)
- [Jessica's Jewelry Box — Popular Woodworking](https://www.popularwoodworking.com/article/jessicas-jewelry-box-2/)
- [The Humidor — The Wood Whisperer Guild](https://thewoodwhispererguild.com/product/the-humidor/)
- [Why Spanish Cedar Thickness Matters in Your Humidor — Case Elegance](https://caseelegance.com/blogs/humidor-resources/why-cedar-thickness-matters-in-your-humidor)
- [Anatomy of a Cigar Humidor — Robustojoe](https://robustojoe.com/tobacco-cigars/humidor/)
- [Japanese Sliding-lid Box — Popular Woodworking](https://www.popularwoodworking.com/projects/japanese_sliding-lid_box/)
- [Crafting a Traditional Japanese-Style Tool Box — Woodworkers Institute](https://woodworkersinstitute.com/making-a-japanese-style-tool-box-2/)
- [Anarchist's Tool Chest — Lost Art Press](https://blog.lostartpress.com/category/books-in-print/the-anarchists-tool-chest/)
- [Decorative Keepsake Box — Woodsmith Plans](https://www.woodsmithplans.com/plan/decorative-keepsake-box/)
- [Kaikado Tea Canisters — Tortoise General Store](https://shop.tortoisegeneralstore.com/products/kaikado-tea-canisters)
- [Wood Joint - Dovetail, Blind Miter Dimensions — Dimensions.com](https://www.dimensions.com/element/wood-joint-dovetail-blind-miter)

---

> 本文件為 wrd 鳩尾盒模板設計參考，與 `docs/drafting-math.md` 配合使用。
> 修 dovetail-box.tsx 前請先 grep 本 doc 確認規則，再決定 code 改動。
