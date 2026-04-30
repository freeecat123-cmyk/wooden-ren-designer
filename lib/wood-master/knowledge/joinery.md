# 榫卯結構知識庫（木頭仁 AI 木工大師客服用）

> 整理對象：台灣木工學員、木匠學院觀眾。
> 寫作原則：用台灣業界術語、繁體中文、實作導向；比例與角度都查證過國際標準與 Fine Woodworking、Popular Woodworking、Paul Sellers、Festool 官方資料。
> 度量制統一以公釐（mm）為主、英制做對照；木材以「母材厚度 T」為基準寫公式。

---

## 0. 通用規則（先讀這段，否則下面看不懂）

- **母材厚度 T**：榫卯所在那塊板材的厚度。例如桌腳 40mm 開榫眼，T=40。
- **三分之一定律（One-Third Rule）**：榫頭厚度 ≈ 母材 1/3。這是 18 世紀以來歐美與日本木工教科書共同公認的起點，目的是讓榫眼兩側木料各保留 1/3，三方等強。
- **公榫 / 母榫**：公榫是凸出來那塊（tenon、tail、tongue、finger）；母榫是被挖開的那塊（mortise、pin socket、groove、slot）。
- **緊度設定（手工經驗值）**：
  - 一般膠合：母榫 = 公榫 + 0.1mm（用力推可入、敲一下到底）
  - CNC 緊配：母榫 = 公榫 + 0（CNC 精度高、留 0 即可）
  - 活動拆卸（拆裝家具、楔榫）：母榫 = 公榫 + 0.5mm
- **木紋方向**：榫頭的長軸要順著木紋走，否則 short grain（橫紋短料）會直接斷掉。這是新手最常犯、最致命的錯誤。

---

## 1. 方榫家族（Mortise & Tenon）

> 木工界的「萬用螺絲釘」。從中世紀椅腳到現代 Domino，本質都是這玩意。

### 1.1 通榫（Through Tenon）

- **用途**：桌椅腳對橫撐、長凳、Shaker 椅、戶外結構。榫頭穿透對方件、外露端面。
- **結構**：公榫長 = 對方件厚度（剛好齊平或稍微突出 1mm 後刨平）。
- **比例**：
  - 榫厚 t = T/3（硬木）；軟木可放寬到 T/2
  - 榫寬 w = 母材寬 W − 2 × 肩寬（每邊肩寬 4–6mm）
  - 通榫長 L = 對方件厚度
- **製作步驟**：
  1. 在母材上劃線：榫眼中心線、寬度線、厚度線（用劃線規一刀劃進纖維，後面鑿刀沿線會自動定位）
  2. 鑽孔去料（手工用方鑽機；半手工先鑽 ⌀ = t − 1mm 的圓孔串連）
  3. 鑿刀修四壁直角，雙面下鑿避免崩口（背面襯板）
  4. 公榫先鋸肩線（橫切）、再鋸頰線（縱切），鑿刀清根
  5. 試組、薄刨修到剛好可推入
- **強度**：高，外露榫端可加楔榫（1.5）變成「永不鬆動」結構。
- **常見錯誤**：母榫從一面下鑿打到底→另一面崩出大缺口。要兩面下鑿、各鑿一半深度於中間會合。

### 1.2 盲榫 / 暗榫（Blind / Stopped Tenon）

- **用途**：現代家具主流（門框、抽屜框、桌腳）。外觀無接縫，最常用。
- **比例**：
  - 榫厚 t = T/3
  - 榫長 L = 母材厚度的 2/3，最少 25mm；常見深度 30–50mm
  - 肩寬 = T/4 左右（兩邊各一個肩，避免邊緣崩裂）
- **製作步驟**：與通榫相同，差別在母榫不打穿，要設定鑿深定位（鑿刀貼膠帶當深度尺，或用 plunge router 設深度限制器）。
- **強度**：略低於通榫（少了端面摩擦），但實務差距 < 5%，外觀加分巨大。
- **常見錯誤**：母榫深度不夠 → 公榫推到底還露肩 → 整個榫頭鬆掉。盲榫永遠要先把母榫鑿到比公榫長 1–2mm 的深度。

### 1.3 帶肩榫 vs 無肩榫

- **帶肩榫（Shouldered Tenon）**：標準做法，肩部蓋住母榫的縫隙、提供正面阻擋面，承壓時力量分散到肩面。
- **無肩榫（Bare-faced Tenon）**：只在兩面留肩、上下無肩。用在薄料（<15mm，留肩會剩骨頭）或門板入框。
- **肩寬選擇**：
  - 4mm：細件、椅子橫撐
  - 6mm：一般家具
  - 8–10mm：粗料、桌腳

### 1.4 出入榫 / 半肩榫（Haunched Tenon）

- **用途**：門框、相框、座板入腿（凡是要在端頭開溝放入板材的框架轉角）。
- **結構**：榫頭一側保留全肩、另一側做一段「短突起」（haunch，約榫長 1/3）填補溝槽，避免框架轉動。
- **比例**：
  - 主榫部分照盲榫公式
  - haunch 長度 = 榫長 1/3
  - haunch 厚度 = 溝槽寬度（通常 6–8mm）
- **常見錯誤**：忘了開 haunch → 框架做久了會繞著榫頭旋轉鬆動。

### 1.5 楔榫（Wedged Through Tenon）

- **用途**：戶外長凳、工作台、Shaker 椅、不靠膠的純機械鎖結構。
- **結構**：通榫端頭鋸兩道楔縫（通常 2 道），組裝時敲入硬木楔（hardwood wedge），把榫頭撐開、咬死榫眼擴張的喇叭口。
- **比例（國際公認）**：
  - 楔片角度 3–5°（最常用 5°）
  - 楔縫長度 = 榫頭長度的 60–70%（不要鋸到肩部，會把母材劈裂）
  - 母榫的喇叭口開口端比榫頭厚 + 楔片寬度（通常 +2 到 +3mm）
  - 楔片長度 ≈ 楔縫深度 90%（不要打到底，留空間給膨脹）
- **製作關鍵**：
  - 楔縫位置與木紋平行（楔片要敲進去把榫頭往兩側撐，垂直木紋會劈裂榫頭）
  - 楔片頭尾比例 1:5 到 1:8（頭厚 5mm、尾厚 1mm、長 30mm）
- **強度**：木工榫接最強的單一結構之一，免膠也夠（古船塢都這樣做）。
- **常見錯誤**：楔縫太短（<50%） → 撐不開；楔片角度太大（>10°） → 一打就劈。

### 1.6 雙榫頭（Twin Tenon / Double Tenon）

- **用途**：寬料（W > 100mm）。單榫太寬會因木材橫向伸縮把榫眼撐裂。
- **結構**：把一個寬榫拆成兩個小榫，中間留 10–15mm 「奶」（cheek bridge）。
- **比例**：
  - 每個小榫寬 ≈ 30–40mm
  - 中間奶寬 ≥ 10mm（太薄會崩）
- **常見錯誤**：兩個小榫排成一直線而非分開 → 等於一個寬榫，沒解決問題。中間必須留實心奶。

### 1.7 方榫家族比較表

| 類型 | 榫厚 | 榫長 | 是否外露 | 強度 | 難度 |
|---|---|---|---|---|---|
| 通榫 | T/3 | = 對方件厚 | 外露 | ★★★★ | ★★★ |
| 盲榫 | T/3 | 2/3 對方件厚 | 隱藏 | ★★★★ | ★★★ |
| 出入榫 | T/3 | 同盲榫 | 隱藏 | ★★★★ | ★★★★ |
| 楔榫 | T/3 | 通榫長 + 楔縫 | 外露 + 楔片 | ★★★★★ | ★★★★ |
| 雙榫 | T/3 | 同盲榫 | 隱藏 | ★★★★★ | ★★★★ |

---

## 2. 燕尾榫 / 鳩尾榫家族（Dovetail）

> 抽屜的代名詞、木工技藝的標誌。看一個木工師傅手藝，先看他的鳩尾。

### 2.1 角度標準（Lost Art Press、Popular Woodworking 共識）

- **軟木 1:6（≈ 9.5°）**：松木、雲杉、Pine。軟木纖維弱，需要更陡角度增加機械咬合與膠合面積。
- **硬木 1:8（≈ 7.1°）**：橡木、胡桃、櫻桃。硬木纖維強，較緩角度避免短紋（short grain）裸露而崩斷。
- **可接受區間**：7.5°–10° 都算合格、英美傳統建議軟木 8.5°、硬木 7.5°。
- **日式版**：日本箱組接用 1:4（≈ 14°），更陡、外觀更張揚。

### 2.2 通鳩尾（Through Dovetail）

- **用途**：抽屜後角、傳統木箱、書匣。兩面外露。
- **製作順序兩派**：
  - **Tails first（先尾後針，Rob Cosman、Paul Sellers 派）**：先在公榫鋸尾、再用尾當模板劃針位。手作派最愛，誤差最容易吸收。
  - **Pins first（先針後尾，Frank Klausz 派）**：先在母榫鋸針、再劃尾位。較舊歐洲傳統，視野好（鋸時能看到劃線）。
  - **建議**：手作初學選 tails first；CNC 或機器治具選 pins first（治具設計簡單）。
- **比例**：
  - 尾寬:針寬 = 1:1 到 3:1（西式抽屜常見 2:1，日式 1:1）
  - 兩端的「半尾」（half-pin）寬度 ≈ 全尾的 1/2，作用是抗剪力扯裂端頭
- **製作步驟（tails first 簡述）**：
  1. 兩塊板對齊、刨平、端正切方
  2. 用劃線規劃出深度線（= 對方件厚度）
  3. 公榫上劃尾、用斜角規（dovetail marker）按 1:6 或 1:8 角度劃線
  4. 鋸尾（鋸縫留在線外側、廢料側）
  5. 鑿廢料、清底
  6. 把尾當模板、靠在母榫端面、用劃刀劃針位
  7. 鋸針（鋸縫一樣留廢料側）、鑿廢料
  8. 試組、薄刨修
- **強度**：在 Fine Woodworking 2009 #203 期 18 種接合測試裡，傳統鳩尾排前段，破壞荷重 ≈ 1400 lb 級。
- **常見錯誤**：鋸縫切到線內側 → 太緊、敲下去會把尾撐崩；切到太外側 → 出現縫隙。永遠把線留在木料上、鋸縫吃廢料。

### 2.3 半隱鳩尾 / 半藏鳩尾（Half-blind / Lapped Dovetail）

- **用途**：抽屜前板。前板正面看不到接縫、側面看得到鳩尾。
- **結構**：母榫不鑿穿、留 1/3 板厚當「藏面」。
- **比例**：
  - 藏面厚度 = 母材厚度的 1/4 到 1/3（Krenov 派 1/4、傳統英式 1/3）
  - 公榫尾長 = 母材厚度 − 藏面厚度
- **製作關鍵**：母榫的廢料只能從內側鑿（無法從外側下鑿到穿透），鑿刀要靈活、底部要平整。Lie-Nielsen 鳩尾鑿（fishtail chisel）就是為這個設計的。
- **常見錯誤**：藏面太薄 → 鑿廢料時崩穿；藏面太厚 → 鳩尾咬合面積不足、強度下降。

### 2.4 全隱鳩尾 / 暗鳩尾（Full-blind / Mitred Dovetail）

- **用途**：高級珠寶盒、Krenov 風格櫥櫃、雙面看不到接縫。
- **結構**：兩件外角各留 45° 斜肩、內部仍是鳩尾互鎖。外觀看到的只是 45° 對角線。
- **比例**：
  - 外側留肩厚度 = 板厚 1/4 到 1/3（< 1/4 易崩）
  - 內部鳩尾比照通鳩尾比例
- **難度**：木工最高難度之一、大師等級炫技。
- **常見錯誤**：外肩厚度配不上鳩尾深度 → 試組時尾打不到底。

### 2.5 滑動鳩尾（Sliding Dovetail）

- **用途**：書架隔板、抽屜底板支撐、桌面延伸滑軌。
- **結構**：公榫做成貫穿一條的鳩尾長條、母榫做成對應的鳩尾長槽，從一端滑入。
- **比例**：
  - 槽深 = 板厚 1/3
  - 鳩尾角度 1:8（軟硬木都偏緩，太陡會卡住推不動）
- **製作工具**：修邊機（router）+ 鳩尾刀（dovetail bit），常見 14°、9°。
- **常見錯誤**：槽兩端寬度不一致（修邊機歪了）→ 推到一半卡死。建議用導板（fence guide）一氣呵成。

### 2.6 鳩尾家族比較表

| 類型 | 外露面 | 角度 | 強度 | 難度 |
|---|---|---|---|---|
| 通鳩尾 | 兩面 | 1:6 軟 / 1:8 硬 | ★★★★★ | ★★★ |
| 半隱鳩尾 | 一面 | 同上 | ★★★★ | ★★★★ |
| 全隱鳩尾 | 無 | 同上 | ★★★★ | ★★★★★ |
| 滑動鳩尾 | 端頭 | 1:8 | ★★★★ | ★★★ |

---

## 3. 半搭接 / 半合榫（Half-lap）

> 最簡單、最被低估的接合。

### 3.1 變體

- **端對端（end-to-end / scarf）**：延長木料用，兩端各刮一半厚度後膠合。
- **十字交叉（cross-lap）**：兩件中段交叉相搭。最常用在窗格、桌底十字撐。
- **L 角（corner half-lap）**：兩件端部各刮一半，組成直角。畫框、屏風常用。
- **T 接（T half-lap）**：一件端部、另一件中段，組成 T 字型。

### 3.2 比例

- **深度 = 母材厚度的 1/2**（剛好兩件相疊厚度 = 單件厚度）
- 寬度 = 對方件寬度（精度差 ±0.2mm 內）

### 3.3 製作工具

- 台鋸 + 開榫片（dado stack）：最快，一次到位
- 修邊機 + 平刀：需要治具引導
- 手鋸 + 鑿刀：傳統做法，初學者練手感最好

### 3.4 強度

- 純膠合 + 半搭 > 純對接無搭接 > 但弱於方榫
- 加木釘或螺絲穿過搭接面後接近方榫強度

### 3.5 常見錯誤

- 兩件深度沒切到剛好 1/2 → 組起來不齊平。對策：兩件疊在一起、台鋸刀片高度直接設定為兩件厚度 / 2。

---

## 4. 指接 / 箱接（Box Joint / Finger Joint）

> 鳩尾的機械化簡化版。抽屜、收納盒主流。

### 4.1 用途

- 抽屜（中低端家具）、收納盒、玩具、木盒包裝。
- 機械化生產的首選（鳩尾治具複雜，指接治具一根 key 搞定）。

### 4.2 比例

- **指寬 = 板厚（1:1 比例）**：最常見、外觀均衡。
- **指寬 = 板厚 × 0.5**（2:1 比例）：細料、首飾盒
- **指寬 = 板厚 × 2**（1:2 比例）：粗獷風格、玩具盒
- 指數 = 板寬 / 指寬（必須整數，不是的話要調整指寬）

### 4.3 治具邏輯（Box Joint Jig）

- 一片背靠板（fence）+ 一根定位 key（凸起的小木條）
- key 的中心離鋸片中心 = 一個指寬距離
- 切完一刀，把已切好的縫卡在 key 上、再切下一刀
- 鋸片寬度（kerf 或 dado 厚度）= 指寬

### 4.4 指接 vs 鳩尾

| 項目 | 指接 | 鳩尾 |
|---|---|---|
| 外觀 | 等寬方塊 | 楔形漸變 |
| 機械鎖 | 無（純靠膠 + 摩擦） | 有（梯形咬合） |
| 製作 | 治具一次設定 | 手作或專用治具 |
| 強度 | 中上（夠用） | 高 |
| 適用 | 量產、現代風 | 高級、傳統風 |

### 4.5 常見錯誤

- 指寬與板寬不能整除 → 兩端剩半個指、外觀醜。設計時先把板寬反推成指寬整數倍。

---

## 5. 企口接 / 凹凸接（Tongue & Groove）

> 地板、護牆板、櫃背板的標準接法。

### 5.1 用途

- 實木地板拼接（一片片鎖在一起、不直接膠合）
- 牆板、天花板裝飾條
- 抽屜底板、櫃背板嵌入框架

### 5.2 比例

- **舌頭厚度 = 板厚 1/3**（標準 3/4 吋板厚 ≈ 19mm，舌頭 ≈ 6mm）
- **舌頭長度 = 板厚 1/2 左右**（標準 19mm 板 → 舌頭長 ≈ 6–8mm）
- **凹槽（groove）寬度 = 舌頭厚度 + 0.1–0.2mm**（容木材伸縮、不卡死）
- **凹槽深度 = 舌頭長度 + 1mm**（給膠和容差空間）

### 5.3 製作工具

- 修邊機 + tongue & groove 刀組（一公一母、配對）
- 銑刨機（shaper）+ 多片組合刀
- 台鋸 + dado 切兩刀（手工派）

### 5.4 木材伸縮考量

- **絕對不能在企口接內塗膠**（地板、牆板）：實木橫紋會 8–12% 伸縮，膠死了 = 季節變化時會自行劈裂或凸起。
- 例外：櫃背板的單一接合處可膠，但兩側仍要留伸縮槽。

### 5.5 常見錯誤

- 凹槽太緊（沒留 0.1mm 容差）→ 夏天潮濕板材膨脹擠不下 → 地板拱起。

---

## 6. 斜接 / 米字接（Mitre）

> 畫框、線板、皇冠線收尾的唯一選擇。但純 45° 斜接幾乎無強度。

### 6.1 弱點

- 純斜接面 100% 是端面紋（end grain）：膠合強度只有縱面紋的 1/4 到 1/3。
- 沒有任何機械鎖：只要拉伸或扭力一上就開。

### 6.2 強化方案（依強度排序）

| 方案 | 結構 | 強度 | 難度 |
|---|---|---|---|
| 純膠 + 角夾 | 無 | ★ | ★ |
| 餅乾榫 | 一片 #20 | ★★ | ★★ |
| 木釘穿入 | 1–2 根⌀8 | ★★★ | ★★★ |
| Through spline | 通斜片 | ★★★★ | ★★★ |
| Dovetailed spline | 鳩尾形片 | ★★★★★ | ★★★★ |
| 暗榫斜接（mitered M&T） | 內藏方榫 | ★★★★★ | ★★★★★ |

### 6.3 通斜片（Through Spline）做法

- 框架組裝、膠乾後，在 45° 角外側鋸出與板厚平行的縫
- 縫寬通常 3–5mm、深度 = 框寬的 1/2 到 2/3
- 嵌入硬木薄片、膠合、修齊
- 木紋方向：斜片木紋要與框架木紋垂直（橫切面），才有抗剪強度

### 6.4 鳩尾片（Dovetailed Spline）

- 同上，但用鳩尾刀銑出鳩尾形溝槽
- 嵌入對應鳩尾形薄片
- 機械鎖+膠合、強度大幅提升、外觀也漂亮

### 6.5 常見錯誤

- 切角不準（45° 跑掉 0.5°）→ 四個角加起來就是 2°、整個框架歪斜或縫隙明顯。對策：用精準角度治具（mitre saw + 反覆校刀，或 shooting board 修角）。

---

## 7. 木釘接 / Dowel

> 機械化最早的隱藏式接合。便宜、快、但強度與精度限制大。

### 7.1 規格

- ⌀6 / 8 / 10 / 12mm 最常用，⌀8 是黃金尺寸
- 表面通常有溝紋（fluted）讓膠分散、空氣排出

### 7.2 比例

- **每端深度 = 釘長 1/2 + 1mm 容膠**（⌀8 釘長 40mm → 兩端各鑽 21mm）
- 兩釘間距 ≥ 釘徑 × 3（避免木料劈裂）
- 釘到邊緣距離 ≥ 釘徑 × 2

### 7.3 治具

- **Joint Genie**：英製、便宜入門款
- **Dowelmax**：加拿大製、CNC 鋁合金、精度 ±0.05mm，不便宜但一輩子受用
- **Wolfcraft Dowel Pro**：德製平價款

### 7.4 強度比較（與 M&T、Domino）

- Dowelmax 廠商測試：3 × ⌀10 木釘 ≈ 同等截面 M&T 強度
- Fine Woodworking 測試：木釘略弱於方榫、約 75–80% 強度
- 缺點：木釘是兩個圓柱、抗扭能力不如方榫的方形截面

### 7.5 常見錯誤

- 鑽孔深度不夠 → 釘子插不到底 → 兩件擠不齊。永遠鑽深一點（每端 +1mm）。
- 鑽孔位置兩件對不上 → 治具沒夾緊或基準面不同。基準面要事先標記、永遠靠同一面。

---

## 8. 餅乾榫（Biscuit）

> 對齊神器、不靠它撐強度。

### 8.1 規格（國際標準）

| 編號 | 寬度 | 長度 | 厚度 |
|---|---|---|---|
| #0 | ≈ 16mm | ≈ 47mm | 4mm |
| #10 | ≈ 19mm | ≈ 53mm | 4mm |
| #20 | ≈ 23mm | ≈ 56mm | 4mm |

舊製英寸對照：#0 = 5/8" × 1-3/4"；#10 = 3/4" × 2-1/8"；#20 = 1" × 2-3/8"。

### 8.2 主要用途

- **拼板對齊**（最大用途）：拼大板時兩塊板的端面對不齊、用 #20 餅乾穩住高度差
- **櫃體側板對接**：純對接 + 餅乾，比純膠強一點
- **不適合**：椅腳、桌腳、任何承載結構

### 8.3 比例與位置

- 餅乾邊距 ≥ 50mm（離板邊太近會崩）
- 兩餅乾間距 ≈ 150–200mm
- 板厚 < 12mm 的料不要用 #20（厚度刻溝會穿）

### 8.4 強度

- Fine Woodworking 18 種接合測試裡排倒數第二，破壞荷重 ≈ 545 lb（最強的傳統 M&T 是 1444 lb）
- 結論：餅乾不是榫、是「對齊銷釘」+「微膠合補強」。

### 8.5 常見錯誤

- 把餅乾當主要接合 → 椅腳座板用餅乾 → 三個月內鬆脫。任何承力部位都不要單靠餅乾。

---

## 9. Festool Domino

> 現代家具的方榫小革命。比鳩尾快、比木釘強、比方榫整齊。

### 9.1 規格（DF 500 機型）

| 刀徑 | Domino 長度選項 | 預設榫眼寬度 |
|---|---|---|
| 4mm | 20mm | 17mm |
| 5mm | 30mm | 19mm |
| 6mm | 40mm | 20mm |
| 8mm | 40mm / 50mm | 22mm |
| 10mm | 50mm | 24mm |

DF 700（XL）支援 8/10/12/14mm，最長 140mm。

### 9.2 鬆緊度設定（Loose / Tight Slot）

機器側面有三段切換：
- **Tight（最窄）**：榫眼寬度 = Domino 寬度 + 0（剛好咬合）
- **Medium**：榫眼寬度 = Domino + 3mm（容差校正用）
- **Loose（最寬）**：榫眼寬度 = Domino + 6mm（完全自由橫向移動）

**標準做法**：第一個榫位設 Tight 當基準、其他位置設 Medium 或 Loose 吸收誤差。

### 9.3 Domino vs M&T vs 木釘

| 項目 | Domino | M&T | 木釘 |
|---|---|---|---|
| 速度 | 30 秒/榫 | 10 分鐘/榫 | 2 分鐘/釘 |
| 精度 | ±0.2mm | 看師傅 | ±0.5mm |
| 強度 | ★★★★ | ★★★★★ | ★★★ |
| 機器成本 | 高（>NT$60,000） | 鑿刀 NT$2,000 | NT$5,000 治具 |
| 最大尺寸 | 14mm × 140mm | 無限 | 有限 |

### 9.4 Fine Woodworking 強度測試（2009 #203）

- 傳統 M&T：1444 lb
- Floating tenon（活榫，與 Domino 同概念）：1396 lb
- Domino：597 lb（注意：當時測試用 5mm Domino，較細）
- 結論：同尺寸下 Domino ≈ M&T，但 Domino 機器只能到 14mm 寬，超過就要回到傳統。

### 9.5 常見錯誤

- 兩件對位時兩件都用 Tight → 累積誤差導致對不齊。永遠一件 Tight、另一件 Medium。
- 用 5mm Domino 接桌腳 → 強度不足。桌椅承重結構至少 8mm，安全 10mm。

---

## 10. 古典中式榫卯（簡介）

> 這部分木頭仁的設計器有完整 docs，這裡只列存在的種類給 bot 知道。

| 名稱 | 用途 | 結構特徵 |
|---|---|---|
| 抱肩榫 | 束腰桌、案類腿足上端 | 半榫 + 45° 斜肩 + 三角眼咬牙條 |
| 粽角榫 | 三方腿件交角（方桌四角） | 三方各斜肩 45°、Y 字三斜縫共點 |
| 走馬銷 | 活動拆卸接合 | 燕尾形木栓 + 葫蘆形眼，推入鎖定 |
| 霸王棖 | 圓桌腿與面板接合 | 端勾掛榫 + 半榫，曲線拉撐 |
| 夾頭榫 | 案類腿足與牙條 | 腿頂開三向卡口 |
| 楔釘榫 | 圈椅扶手弧形件接合 | 兩弧件搭口 + 中央木楔 |
| 銀錠榫（蝴蝶榫） | 拼板背面防裂 | 雙燕尾片嵌入跨縫淺槽 |

詳細幾何見 `wooden-ren-designer/docs/drafting-math.md` G 段。

---

## 11. 拼板（Edge Joint）

> 沒有寬大原木怎麼辦？拼。

### 11.1 純膠合（Butt + Glue）

- **基本原則**：PVA 膠（Titebond II/III）膠合的純拼板邊接，強度 = 木材本身。實驗室測試破壞點通常出現在木料、不是膠線。
- **前提**：邊面要刨直、平整（鋼直尺貼上去無透光）。
- **不需要任何機械輔助就能做**，但對齊高度差難控制。

### 11.2 對齊輔助方式

| 方式 | 對齊精度 | 強度貢獻 | 速度 |
|---|---|---|---|
| 純膠（無輔助） | 差 | 100%（夠了） | 慢（要邊夾邊調） |
| 餅乾 #20 | 好 | +5%（可忽略） | 中 |
| 木釘 ⌀8 | 好 | +10% | 慢（要鑽精準） |
| Domino 5mm | 極好 | +5% | 快 |

### 11.3 木紋方向：交替原則（Cathedral Grain Alternation）

- 看板材端面年輪：年輪呈拱形（cathedral）的板材
- 拼板時相鄰板**年輪方向上下交錯**：一塊拱口朝上、下一塊拱口朝下
- 目的：分散翹曲應力，避免整片板向同一方向凹
- 例外：高級做法是看「最佳面」朝上、不顧木紋方向，靠厚度與穩定性吸收應力

### 11.4 夾合壓力（Titebond 官方建議）

| 木材類型 | 建議壓力 |
|---|---|
| 軟木（松、雲杉） | 100–150 psi |
| 中等（櫻桃、桃花心） | 125–175 psi |
| 硬木（橡、胡桃、楓） | 175–250 psi |

實務換算：每吋拼板長度 100 psi ≈ 一個中型 F 夾的扭力（手轉到中等吃力但不費力）。

### 11.5 夾合間距

- 邊緣每 6–8 吋（150–200mm）一個夾
- 上下交替放夾（避免夾合力造成板材弓曲）
- 看到一條均勻細小的膠線擠出（squeeze-out）就是壓力剛好

### 11.6 常見錯誤（最致命）

- **過度夾合 → starved joint（缺膠）**：夾太緊把膠擠光，留下乾木對乾木 → 看起來有縫卻是空的，膠完全失效。對策：壓到看到細膠線就停，不要拼老命扭。

---

## 12. 膠合與夾合

### 12.1 膠的選擇

| 膠種 | 開放時間 | 夾合時間 | 防水 | 適用 |
|---|---|---|---|---|
| Titebond Original (I) | 4–6 分 | 30 分 | 無 | 室內家具 |
| Titebond II | 5 分 | 30–60 分 | Type II（短時間水濺） | 廚房、戶外有遮蓋 |
| Titebond III | 8–10 分 | 30 分 | Type I（防水） | 戶外、浴室 |
| Epoxy | 5–60 分（依配方） | 數小時 | 完全防水 | 異材接合、戶外、填縫 |
| Hide Glue（生膠） | 30 秒 – 5 分 | 30 分 | 弱 | 古典家具修復、可逆接合 |
| CA（瞬間膠） | 5–30 秒 | 1–2 分 | 中 | 小修補、止血、定位 |

### 12.2 環境條件

- **溫度**：Titebond II 不可低於 13°C（55°F）、Titebond III 不可低於 8°C（47°F）。冬天台灣山區工作室要注意。
- **濕度**：50% 是標準測試環境。台灣夏天 70%+ 開放時間會變短、要更快。

### 12.3 各膠何時用

- **PVA（Titebond）**：室內 95% 接合都用這個。
- **環氧（Epoxy）**：木料含油量高（柚木、紫檀）PVA 抓不住、或要填縫不只是貼合、或極端戶外。
- **生膠（Hide Glue）**：古董修復原則上要用同樣的膠、或現代「液體生膠」（Liquid Hide Glue）開放時間長到 30 分。
- **CA**：小東西點滴、定位輔助、絕對不是主要接合膠。

### 12.4 木材伸縮係數

- **橫紋（横切，跨年輪方向）**：8–12% 季節性變化
- **縱紋（順年輪、長軸方向）**：< 0.1%（幾乎不變）
- **設計鐵則**：寬實木板（>200mm）絕對不能四邊膠死進框架，要做浮動板（floating panel）、留伸縮溝。
- **伸縮溝設計**：實木板入框槽，槽寬 > 板厚 + 6mm（兩邊各 3mm 容夏冬伸縮），中間打一根 brad 釘固定中心點、兩側自由滑動。

---

## 13. 接合強度比較表

> 以下排序綜合 Fine Woodworking 2009 #203、Wood Magazine、Dowelmax 廠測，數值為相對強度而非絕對值。實際強度受木種、尺寸、膠種、施工品質影響極大。

| 排名 | 接合方式 | 相對強度（M&T = 100） | 用途 |
|---|---|---|---|
| 1 | 鳩尾通榫（Through Dovetail） | 105–110 | 抽屜後角、木箱 |
| 2 | 楔通榫（Wedged Through M&T） | 105 | Shaker 椅、長凳 |
| 3 | 通方榫（Through M&T） | 100 | 桌椅腳 |
| 4 | 浮動方榫 / Floating Tenon | 95 | 自製版 Domino |
| 5 | 盲方榫（Blind M&T） | 90–95 | 一般家具 |
| 6 | Festool Domino（同尺寸） | 85–90 | 現代家具 |
| 7 | 半搭接（Half-lap） | 60–70 | 框架、十字撐 |
| 8 | 木釘 ⌀8 × 3 根 | 70–75 | 平價家具 |
| 9 | 指接（Box Joint） | 65–75 | 抽屜、收納盒 |
| 10 | 餅乾 #20 | 35–40 | 對齊用、不撐強度 |
| 11 | 純斜接 + 膠 | 15–20 | 畫框（必須加 spline） |

> 重要：上表是「破壞荷重」相對值。實務上家具設計只要超過實際使用負載 3–5 倍就夠了，不需要永遠選最強。一張椅子用盲方榫（90 強度）跟用通鳩尾（110 強度）使用 30 年壽命都遠遠夠。**選接合方式的順序：外觀考量 > 製作難度 > 強度**。

---

## 14. 木頭仁學員最常見的 5 個榫卯錯誤（教學重點）

1. **盲榫深度只挖到剛好等於榫頭** → 試組推到底榫肩離縫 1mm。對策：母榫永遠比公榫深 1–2mm。
2. **鳩尾鋸縫切到線內** → 太緊敲下去崩尾。對策：把線留在木料、鋸縫吃廢料側。
3. **拼板夾太緊** → starved joint。對策：膠線出細小一條就停。
4. **木紋方向選錯** → 榫頭橫紋短料、組裝時直接斷。對策：榫頭長軸永遠順木紋。
5. **斜接純膠** → 一年內開縫。對策：永遠加 spline 或 biscuit 機械加固。

---

## 引用來源（Sources）

### 國際英文資料
1. [Fine Woodworking #203 (2009) — Wood Joint Strength Test](https://www.finewoodworking.com/forum/to-domino-or-not-to-domino-that-is-the-question)
2. [Wood Joint Strength Testing — Woodgears.ca by Matthias Wandel](https://woodgears.ca/joint_strength/)
3. [Dowelmax vs Domino vs M&T Strength Tests](https://www.dowelmax.com/wood-joint-strength-tests/)
4. [Popular Woodworking — Dovetail Layout: What Ratio or Degree?](https://www.popularwoodworking.com/editors-blog/dovetail-layout-what-ratio-or-degree/)
5. [Lost Art Press — The 'Right' Angle for Dovetails](https://blog.lostartpress.com/2022/10/18/the-right-angle-for-dovetails/)
6. [Heartwood Tools — What's the deal with dovetail ratios?](https://www.heartwoodtools.com/blog/2019/12/20/whats-the-deal-with-dovetail-ratios)
7. [Popular Woodworking — Tenons Rule! Rules on Tenons](https://www.popularwoodworking.com/techniques/tenons-rule-so-here-are-the-rules-on-tenons/)
8. [Paul Sellers — Mortise and Tenon Knowledge Base](https://paulsellers.com/knowledge-base/mortice-and-tenon/)
9. [Rob Cosman — Mortise and Tenon Joint Types](https://robcosman.com/pages/newsletter-article-mortise-and-tenon-joints)
10. [Wikipedia — Mortise and tenon](https://en.wikipedia.org/wiki/Mortise_and_tenon)
11. [Wikipedia — Biscuit joiner](https://en.wikipedia.org/wiki/Biscuit_joiner)
12. [WoodWorkers Guild of America — Joiner Biscuit Sizes](https://www.wwgoa.com/post/joiner-biscuit-sizes)
13. [Festool Owners Group — Physical Dimensions of Dominos](https://festoolownersgroup.com/threads/physical-dimensions-of-dominos.73214/)
14. [Festool Domino Tenon Sizing Guide](https://diytroop.com/festool-domino-tenon-sizing/)
15. [Titebond III Ultimate Wood Glue — Specifications](https://www.titebond.com/product/glues/e8d40b45-0ab3-49f7-8a9c-b53970f736af)
16. [Titebond II Premium Wood Glue — Specifications](https://www.titebond.com/product/glues/2ef3e95d-48d2-43bc-8e1b-217a38930fa2)
17. [The Wood Whisperer — Differences Between Titebond Glues](https://thewoodwhisperer.com/articles/differences-between-titebond-glues/)
18. [Timbecon — Quick Guide to Clamping Pressure in Woodworking](https://www.timbecon.com.au/blogs/articles/a-quick-guide-to-clamping-pressure)
19. [Homefixated — Ideal Glue Clamping Pressure and How to Measure It](https://homefixated.com/glue-clamping-pressure/)
20. [Dimensions.com — Tongue & Groove Wood Joint](https://www.dimensions.com/element/wood-joint-tongue-groove)
21. [NWFA/NOFMA — Factory Finished Standards (Tongue & Groove)](https://nwfa.org/wp-content/uploads/2020/03/NWFA_NOFMA_Factory_Finished_Standards_Updated2019.pdf)
22. [Box Joints on a Table Saw — Setup and Spacing](https://blog.woodworkingforamateurs.com/box-joints-on-a-table-saw-setup-and-spacing-that-actually-works/)
23. [Katz-Moses Tools — Box Joint Jig Setup](https://kmtools.com/blogs/news/box-joint-jig-setup)
24. [Woodsmith — Loose-Wedge Mortise & Tenon Joints](https://www.woodsmith.com/article/loose-wedge-mortise-tenon-joints-basic-tusk-tenon/)
25. [Canadian Woodworking — Wedged Mortise & Tenon](https://canadianwoodworking.com/techniques_and_tips/wedged-mortise-tenon/)
26. [Stumpy Nubs — Wedged Mortise Joint](https://www.stumpynubs.com/shop-vlog/wedged-mortise-joint)
27. [Frontier Tradesman — What Dowel Sizes Mean for Joint Strength](https://frontiertradesman.com/what-dowel-sizes-mean-for-joint-strength)
28. [WoodWeb — Dowel Joint Design, Strength, and Precision](https://woodweb.com/knowledge_base/Dowel_Joint_Design_Strength_and_Precision.html)
29. [Australian Wood Review — Mortise and Tenons, Types and Methods](https://www.woodreview.com.au/how-to/mortise-and-tenons-types-and-methods)
30. [Woodworking Squad — Dovetail Joints vs Mortise and Tenon](https://woodworkingsquad.com/dovetail-joints-vs-mortise-and-tenon-when-to-use-which/)

### 中文 / 內部資料
31. 王世襄《明式家具研究》— 中式榫卯系統分類基礎
32. 李乾朗《一柱擎天》— 中國古建築木構造
33. wooden-ren-designer 內部 docs：`/Users/wengevaq989/Desktop/wooden-ren-designer/docs/drafting-math.md` B 段（榫卯細節圖）、G 段（中式榫卯擴充）
