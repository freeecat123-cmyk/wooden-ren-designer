# 複斜腳零件圖標準參考

> 對象：wooden-ren-designer 複斜腳（compound splay / rake+splay）零件圖工作流
> 日期：2026-05-25
> 範圍：端面 detail、桌鋸 setup 表、真實長度 vs 投影長度

---

## 1. 端面 detail view 慣例

複斜腳的核心問題：**單張正視圖看不到真實角度**。腳本身在 X、Z 兩個方向同時傾斜（rake + splay），三視圖看到的都是投影角度，不是工人實際要設定鋸片或鑽孔的角度。標準解法是**加一張「沿腳軸方向看」的 end view detail**，把腳的截面以「真實尺寸」+「真實夾角」畫出來。

**慣例做法：**

- 正視（front）標 splay 角，側視（side）標 rake 角，這兩個是「投影角度」(projected) — 給設計者看比例用，不是給工人設機器用。
- 另起一張 **end view / sightline view**，視線方向沿著腳的中心軸俯瞰，把腳頂、腳底、榫頭真實截面畫出來。
- 端視圖上必須標出 **resultant angle**（合角，Christopher Schwarz 的講法）或 **sightline angle**（視線角，Peter Galbert 的講法）— 這是把 rake、splay 合成成單一傾角的真實值。
- 端視圖一定要寫清楚「detail view, true size」並標基準軸（通常用腳中心線 + 一條代表 sightline 的水平線）。

**來源：**
1. Fine Woodworking — Raked and Splayed Legs（前/側兩視圖標 rake/splay 投影角，另畫 end view 標真實角度）
2. Lost Art Press / Christopher Schwarz — Introduction to Leg Angles（resultant angle = 把 rake+splay 合成單一斜角，給單一 bevel gauge 設定用）
3. Fine Woodworking — Determining Sightlines in SketchUp / Galbert's Sightlines in SketchUp（sightline = 該腳看起來剛好垂直的那條基準線，沿這條線看到的就是真實夾角）

**結論：**
> 工程圖**至少要有三層**：(A) 前+側投影圖標 rake/splay 投影值；(B) 沿腳軸的 end view detail 標真實角度（resultant）；(C) 在俯視圖（top view）上畫 sightline 標基準。三層缺一不可，否則工人無法把投影角度換算成實際機台值。

---

## 2. 桌鋸 setup 表慣例

複斜腳的腳頂、腳底切面是**複合斜切（compound miter）**：要同時設定「鋸片傾角（bevel / blade tilt）」+「米角機台或夾具角度（miter / fence wedge angle）」。**圖上不能只標一個角度**，必須兩個一起標，且要分清楚哪個給哪台機器。

**慣例做法：**

- 表格化呈現，至少三欄：**操作（cut）／鋸片傾角 (blade tilt °)／米角機 (miter gauge °) 或 楔形夾具 (wedge °)**。
- 鋸片傾角：以**垂直 = 0°** 為基準，傾向哪邊用 L/R 或圖示標。常見複斜腳是 3°–7° 之間。
- 米角機台：以**90°（垂直推進）= 0° 偏移**為基準，標角度 + 方向；或改用木楔（wedge）貼雙面膠固定在米角機上，標楔形角度。
- 同一張表至少寫腳頂（top cut）+ 腳底（bottom cut）兩列。複斜腳兩端常**鏡像**不是相同。
- 旁邊放一張小示意圖：俯視顯示工件如何抵著米角機/楔形塊推過鋸片，並用粗箭頭標進刀方向。

**典型範例（來源 Woodcraft Four-Legged Stool / Fine Woodworking forum）：**
| Cut | Blade Tilt | Miter Gauge / Wedge | 備註 |
|------|-----------|---------------------|------|
| 腳頂 | 5° L | 楔 5°（窄端朝鋸片） | 同時做 splay + rake |
| 腳底 | 5° L | 楔 5°（窄端朝鋸片，反向擺） | 與腳頂鏡像，腳長量真實長度 |

**來源：**
1. Woodcraft — Four-Legged Stool（blade 傾 5°、米角機上貼楔形 wedge 雙面膠固定）
2. Popular Woodworking — Compound Angles; No Math（鋸片傾 3.5° + 米角 93.5° 範例）
3. Jansson Compound Miter Saw Calculator（公開計算器：輸入腳 tilt 角，算出 saw bevel + miter）

**結論：**
> Saw setup 表必須是**兩欄（tilt + miter）成對標記**，且每個 cut 一列，不可只給一個合角數字。鋸片傾角以 0°（垂直）為基準，米角以 0°（90° 推進）為基準，方向用 L/R 或圖示。腳頂腳底一定要分開列，明確標鏡像關係。

---

## 3. 真實長度 vs 投影長度

複斜腳因為傾斜，**正視/側視看到的長度是投影長度（projected / apparent length）**，比真實長度短。畫圖時這兩個必須分清楚標註，否則工人照投影長度切料會切短。

**慣例做法：**

- **投影長度（projected）**：標在前/側視圖上，配尺寸線，加註「proj.」或括號 `(proj.)`。給整體比例、家具高度檢視用。
- **真實長度（true length / TL）**：標在端視圖 detail 或單獨拉出來的「腳零件圖」上，明確寫 "TL" 或 "true length"，這是給工人切料的數字。
- 真實長度通常**沿腳中心軸線**量，從腳頂中心到腳底中心。
- 如果腳兩端是複合斜切，真實長度通常標**長邊**或**中心軸長**兩種，**圖上要寫清楚是哪一種**（標 "to long point" / "to centerline"），避免歧義。
- 三角法換算：真實長度 = 投影高度 / cos(resultant angle)。圖上可附小公式或計算表。

**日本傳統規矩術／四方転び傳統做法：**
- 「四方転び」是日本傳統四面對稱外斜腳手法。
- 計算公式：當正視角 75°，榫眼角度 = arctan(tan75° / √2) = 69.2°。腳長 = 投影長 / sin(69.2°)。
- 圖上明確區分「正面角度」（投影）vs「ほぞ穴角度」（真實），這個概念跟西方 rake/splay 投影 vs resultant 真實是同一件事。

**結論：**
> 圖上每個長度尺寸都要明示是「投影」還是「真實」。建議規則：**前/側視圖一律投影並加 `(proj.)`，端視 detail / 零件圖一律真實並加 `TL`**。複合斜切的腳，真實長度標到中心軸或長邊擇一並寫清楚。

---

## 4. 對 wooden-ren-designer 的具體建議

針對未完成的 W4（端面 detail view）與 W5（saw setup table）。

### W4 — 端面 detail view 該怎麼產

1. **每支複斜腳產一張獨立 detail**：標題 "Leg End Detail (true size)"，靠在原 part drawing 旁邊或下一頁。
2. **視線方向**：沿腳中心軸從腳頂往腳底看（或反過來），把腳橫斷面、榫頭、倒角畫成真實尺寸。
3. **必標角度**：
   - `resultant angle θ_R = arctan(√(tan²(rake) + tan²(splay)))` — 寫在 detail 中央，配角度符號弧線。
   - `sightline angle φ = arctan(tan(splay) / tan(rake))` — 是 sightline 與正面（X 軸）的夾角，用虛線標在俯視圖上。
4. **基準線**：detail 內畫一條 sightline（虛線、標 SL），代表「沿這條線看腳是垂直的」。
5. **與三視圖連動**：俯視圖上同步畫四條 sightline 虛線並標角度，前/側視圖的 rake/splay 投影角加 `(proj.)`。
6. **資料來源**：直接用 designer 內已算好的 `legSplayX` + `legSplayZ`，再算 `θ_R`、`φ` 兩個衍生值塞進 part metadata。

### W5 — Saw setup table 該怎麼產

1. **每支腳一張表**，表頭：`Cut | Blade Tilt | Miter / Wedge | Long Point | 備註`。
2. **至少兩列**：腳頂（top）+ 腳底（bottom）。如果腳上有額外榫切（榫肩、橫貫接合處），再加列。
3. **數值來源**：
   - Blade tilt = splay 角（朝 X 方向那個分量），預設以 0° 垂直為基準。
   - Miter gauge offset = rake 角（朝 Z 方向那個分量），預設以 0°（90° 推進）為基準。
   - 或者：blade tilt + miter 都改用 `resultant angle` 配 `sightline angle` 為基準的等價表示，二擇一不要混用，旁邊明確寫**慣例採用哪一種**。
4. **方向標記**：blade tilt 加 L/R（鋸片倒向哪邊），miter 加 CW/CCW 或 +/−。
5. **附小圖**：表格旁邊一張俯視小示意，畫工件抵著米角機/楔形塊推過鋸片的姿態，箭頭標進刀方向。
6. **鏡像處理**：四支腳如果是四方對稱，**只畫一張表 + 一句「其他三支腳鏡像」**，不要重複四份污染圖紙。
7. **真實長度欄位**：表格下方加一行「Leg TL（中心軸真實長度）= XXX mm」，配公式 `TL = H / cos(θ_R)` 供工人驗算。

### 共同建議

- 把 rake、splay、resultant、sightline 這四個名詞**統一中文翻譯**並寫在圖紙圖例（legend）：建議用「前後傾角 rake」「左右開角 splay」「合角 resultant / 真實傾角」「視線角 sightline」。
- 端視 detail 與 saw setup table 都加一句「角度以工件靜止、機器設定值為準，不是投影值」。
- 同步在 designer 的工序卡（process steps）裡，把 saw setup 那一步直接帶這張表的數值。

---

## 5. 參考連結

- Fine Woodworking — [Raked and Splayed Legs](https://www.finewoodworking.com/2015/06/07/raked-and-splayed-legs)
- Fine Woodworking — [Determining Sight Lines in SketchUp](https://www.finewoodworking.com/2018/11/08/determining-sight-lines-sketchup)
- Fine Woodworking — [SketchUp: Modeling Table and Stool Legs with Rake and Splay](https://www.finewoodworking.com/2018/07/18/sketchup-modeling-table-stool-legs-rake-splay)
- Fine Woodworking forum — [Compound Angle Table Legs](https://www.finewoodworking.com/forum/compound-angle-table-legs)
- Popular Woodworking — [Compound Angles; No Math](https://www.popularwoodworking.com/techniques/compound-angles-no-math/)
- Popular Woodworking — [Five Lessons from the Staked Chair Project](https://www.popularwoodworking.com/woodworking-blogs/five-lessons-from-the-staked-chair/)
- Lost Art Press / Christopher Schwarz — [Introduction to Leg Angles](https://blog.lostartpress.com/2025/09/18/introduction-to-leg-angles/)
- Lost Art Press — [Build the Christopher Schwarz Staked Chair](https://blog.lostartpress.com/2015/01/19/build-the-christopher-schwarz-tm-staked-chair/)
- Lost Art Press — [Chairmaking Practice: Make a Low Staked Stool](https://blog.lostartpress.com/2023/11/07/chairmaking-practice-make-a-low-staked-stool/)
- Benchcrafted — [Galbert's Sightlines In SketchUp](http://benchcrafted.blogspot.com/2015/07/galberts-sightlines-in-sketchup.html)
- WoodWeb — [Figuring Complex Leg Angles for Furniture](https://woodweb.com/knowledge_base/Figuring_Complex_Leg_Angles_for_Furniture.html)
- Woodcraft — [Four-Legged Stool](https://www.woodcraft.com/blogs/cabinetry-furniture-making/four-legged-stool)
- Jansson — [Compound Miter Saw Calculator](https://jansson.us/jcompound.html)
- 日本傳統「四方転び」— [リーベルクラフト・スツールの脚の角度](https://jujubois.shopinfo.jp/posts/6902145/)（投影角 75° → 榫眼角 69.2° 三角換算）
