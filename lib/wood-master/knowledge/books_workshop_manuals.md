# 西方工法寶典精華（木頭仁 AI 木工大師客服用）

> 這份檔案專門整理 Tage Frid、Fine Woodworking 雜誌精選合輯（Best of FWW）、Sam Allen《The Complete Book of Joinery》、Albert Jackson & David Day《The Complete Manual of Woodworking》、Andy Rae《Choosing & Using Hand Tools》、Kelly Mehler《The Table Saw Book》、George Nakashima《The Soul of a Tree》這幾本「實作寶典」的獨門深度。
>
> 寫作原則：
> - 跟現有 9 份知識檔（hand_tools / machinery / joinery / wood_species / finishing / safety_workshop / structure_strength / repair_restoration / teaching_kids）**不重複**——重複的部分（如榫卯分類字典、Fine Woodworking #203 強度測試、油布自燃、台灣木材識別）已經寫在那邊。
> - 這份補的是**系統觀**：接合決策邏輯、磨刀全流程、家具製作 pipeline、椅子幾何、櫥櫃工法、塗裝系統選擇、木紋對配、Nakashima 設計觀。
> - 每段引用都註明來源，不確定的數字不編。
> - 繁體中文，職人口吻。

---

## 1. Tage Frid 的接合系統觀（北歐工法 → 美國延續）

> 來源：Tage Frid《Teaches Woodworking》Vol.1 *Joinery*、Vol.3 *Furnituremaking*；Frid 在 RISD（羅德島設計學院）任教 30+ 年，把丹麥傳統工法系統化引入美國。

### 1.1 Frid 的核心信念：先 prep stock，再談接合

Frid 在 Vol.1 開宗明義：**「沒有平整、方正、尺寸一致的料，所有接合都白做。」** 他要求學生在進入榫卯之前，先把 4 道工序做到絕對：
1. **Joint 一面**（用刨臺/手刨刨平）—— 這面是基準面（reference face）。
2. **Joint 一邊**（用刨臺側靠基準面，刨成 90°）—— 這是基準邊（reference edge）。
3. **Plane 對面**（厚薄機到設計厚度）。
4. **Rip + crosscut 對邊**（桌鋸或手鋸到設計寬度長度）。

每根料都要做完這 4 步**才開始畫線**。Frid 強調：**用粉筆或鉛筆在基準面/邊畫上「✓」記號**，整個製作過程都用這兩個面當量測起點，才不會因翻面累積誤差。

> 實戰意義：木匠學院初學者最常犯的錯就是「料還沒整完就急著畫榫」，最後榫做好但裝不起來。Frid 的方法是先慢後快。

### 1.2 Mortise-Tenon 變體系統表（Frid 整理 + 木頭仁補充）

Frid 在 Vol.1 ch.5–7 把 mortise-tenon 系統化成 12 種變體，依用途排序：

| 變體 | 英文名 | Frid 推薦用途 | 關鍵比例 |
|---|---|---|---|
| 標準帶肩榫 | Standard shouldered M&T | 桌椅腳 → 牙條 | 厚 = 料厚 1/3，肩 ≥ 6mm |
| 半肩榫 | Haunched tenon | 框架邊條（防扭轉） | 主榫長 2/3 板寬，肩榫 1/3 |
| 雙榫頭 | Twin / double tenon | 寬料 ≥ 100mm | 兩個小榫 + 中間料 |
| 楔榫 | Wedged through tenon | 凳面、工作台、椅腳 | 楔角 5–7°，深度 = 榫長 2/3 |
| 暗楔榫 | Foxed wedged tenon | 看不見要永久固定 | 鑿刀鑿出底 dovetail 形空間 |
| 拉桿榫 | Drawbored M&T | 古式椅、無膠永久固定 | offset 1.5–3mm，木釘穿過 |
| 滑動榫 | Sliding / loose tenon | Festool Domino、現代量產 | 兩邊都鑿凹槽 + 獨立榫片 |
| 斜榫 | Angled M&T | 椅子座框 → 椅腳（5° 後傾） | 榫頰平行椅腳，肩面斜切 |
| 圓榫 | Round tenon | 圓腳/車枳件 | 直徑 = 料厚 1/3，配 reamer |
| 凹槽榫 | Bridle joint / open M&T | 框架角（門窗框） | 三面開口，露 endgrain |
| 出入榫 | Through-haunched | 大型框架（工作台） | 主榫穿透 + 上方 haunch |
| 偏置榫 | Offset M&T | 抽屜面板側邊 | 榫不在中央而靠近一面 |

> 不要再記分類字典，joinery.md 第 1 章已經寫過細節。**這張表的價值是「看到家具就知道該選哪個」**。

### 1.3 Frid 的接合決策邏輯（Vol.1 ch.4 序言）

Frid 教學生「**選接合的 4 個提問**」：
1. **這個接合要承受什麼力？**（壓縮、拉伸、剪切、扭轉）
2. **看不看得見？**（看不見就用最強的，看得見就考慮 dovetail / 露榫頭當設計）
3. **以後要不要拆？**（拆得開 → drawbored M&T 或 dry-fit；不拆 → 上膠 + 楔）
4. **木材會怎麼動？**（順紋 vs 橫紋的伸縮要讓接合允許）

> 這 4 題拿來檢查「為什麼桌面不能直接螺絲鎖在邊框上」就懂了——桌面橫紋會動 ±5mm，鎖死會裂。要用 z-clip / button / figure-8 fastener。

### 1.4 北歐工法的特色（Frid Vol.3 序）

- **三腳凳（Three-legged stool）**：Frid 的招牌作品。三腳永遠平穩（三點決定一面），所以工作椅、酒吧椅、擠奶凳都用三腳。Frid Vol.3 第一個 project 就是三腳凳，他說「教這個是因為它把 mortise-tenon、tapered round tenon、楔榫一次學完」。
- **Wedge 是裝飾也是結構**：北歐傳統把楔做成對比色（如橡木腳 + 黑檀楔），既當機械鎖死，也是設計語言。
- **Through-tenon 看得見不丟臉**：Shaker、北歐都把通榫露出來，當作「誠實接合」（honest joinery）的展現。

> 對台灣的啟發：台灣師傅習慣把所有接合藏起來，但「露榫」反而是國際工藝市場的賣點。木匠學院做工作椅時可以考慮露楔。

---

## 2. Fine Woodworking 三十年累積的核心知識

> 來源：《The Best of Fine Woodworking》系列、FWW 雜誌歷年精選文章。雜誌從 1975 創刊到現在累積 270+ 期，是英語世界最重要的木工技術媒體。

### 2.1 Sharpening Pyramid（磨刀金字塔法）

> 來源：FWW 多位作者整合（Brian Boggs、Chris Gochnour、Garrett Hack）；最早由 Harrelson Stanley 在 FWW 推廣，後成為通用方法。

**Pyramid 的概念**：磨刀不是每次都從最粗開始，而是**根據刃口狀況決定從哪個 grit 起手**。
- **完整磨刀（reshape）**：刃口大缺角或角度全跑掉 → 從 #220–#400 起手 → #1000 → #4000 → #8000。
- **常規磨刀（regular sharpen）**：刃口微鈍但沒缺 → 從 #1000 起手 → #4000 → #8000。
- **修刃（hone / touch up）**：剛鈍幾分鐘 → 直接 #8000 + strop（磨皮）30 秒。

**順序原則**：
1. 每一級都磨到「上一級的刮痕完全消失」才換下一級——這是 FWW 反覆強調的。
2. 起 burr（毛邊）的判斷：手指輕輕從刃背滑過，能感覺到一條微凸線就是 burr 出來了。一般刨刀刃 #1000 約 30 秒就出 burr。
3. 換 grit 不沖水：但要把石頭表面的金屬泥擦掉，否則粗顆粒會劃傷細石。
4. 最後 stropping（皮革條 + 紅色或綠色 chromium oxide 膏）：FWW 多位作者建議刨刀刃磨完後一定要 strop，可以把 burr 完整撕掉。

> hand_tools.md 第 3 章已經寫過台灣常用磨刀石品牌（Shapton / King / Naniwa）和台幣價格——這裡只補「Pyramid 思維」。

### 2.2 Wood Movement（木材伸縮）的 FWW 圖表式思考

> 來源：FWW 反覆引用 USDA Wood Handbook + Bruce Hoadley《Understanding Wood》；wood_species.md 第 7 章已寫過完整伸縮率，這裡補的是「FWW 怎麼教學生用」。

FWW 的教學技巧是 **「3% 拇指法則」**：
- 北美橡木、楓木、胡桃這類常見硬木，**橫紋方向（across the grain）伸縮率年週期約 ±3%**——記這個就夠了。
- 一塊 600mm 寬的桌面 → 300mm 是中心點 → 兩邊各最多動 9mm（300 × 3%）。
- 這就是為什麼桌面要留 **expansion gap（脹縮縫）** 9–12mm，桌面用 **button / z-clip** 浮接而不是鎖死。

順紋方向（沿 grain）伸縮幾乎為 0（< 0.1%），所以**門板、抽屜面板的長邊永遠順紋**，短邊容許動。

**踩雷案例**（FWW Forum 經典）：抽屜底板用 plywood 沒問題；用實木的話必須**底板順紋平行抽屜面板長邊**，且後緣不上膠只用螺絲在中央鎖一顆——讓底板自由前後脹縮。

### 2.3 Glue Strength 比較（FWW Aug 2007 測試）

> 來源：Fine Woodworking, "How Strong is Your Glue?", Aug 2007；測試送至 Case Western Reserve University 材料工程系。

FWW 把 7 種膠用 bridle joint（楓木、橡木、ipe）測剪切強度，結果（相對強度）：

| 膠種 | 相對強度 | 耐水 | Frid / FWW 評語 |
|---|---|---|---|
| Titebond III | 100% | 室外 Type I | 室外案件首選，價格貴一點但安心 |
| 2-part 慢乾 epoxy | 99% | 完全防水 | 適合縫隙填充、油性木材（柚木、紫檀） |
| Titebond Original (PVA) | 95% | 室內 Type II | 室內家具 90% 場合最佳選擇 |
| Liquid hide glue | 79% | 不防水 | 可逆（熱水拆得開）、修復古董首選 |
| Granular hide glue | 76% | 不防水 | 樂器、修復、傳統家具 |
| Polyurethane（如 Gorilla） | 58% | 防水 | 強度遜於 PVA、會發泡、沾手難洗 |

**FWW 結論的 3 個重點**：
1. **大多數現代膠都比家具實際需要的強度高**——意思是接合做對了，膠選 Titebond Original 就夠了，不用迷信 Titebond III。
2. **PU 膠（Gorilla）行銷很猛但實測最弱**——FWW 不建議當主要木工膠。
3. **油性木材（柚木、紫檀、cocobolo）必用 epoxy**——PVA 在這些木種上會被天然油排斥，膠線會剝離。

> joinery.md 第 9.4 章是寫接合**結構**強度（Fine Woodworking #203），這裡是寫**膠本身**強度（FWW 2007）——是兩篇不同的測試。

### 2.4 FWW 的「Build It / Drawing First」哲學

FWW 編輯部反覆強調的工作流程：
1. **設計圖先用 1:1 全尺寸畫在膠合板上**（story stick / full-size drawing）。任何疑慮在圖上解決，不要在木料上解決。
2. **做一個 mock-up**（用便宜松木 / MDF 做原型）—— 椅子、有曲線的桌子尤其要做。
3. **木料切割順序：先粗切（rough cut）多 25mm 各方向，靜置 1 週**讓內應力釋放，再 final mill。FWW 雜誌反覆強調這步「省一週、毀一個月」。

---

## 3. 家具製作完整流程（Design → Install）

> 來源：Tage Frid Vol.3 *Furnituremaking*、Albert Jackson & David Day《The Complete Manual of Woodworking》Part 5。

這是 Frid 在 RISD 教書 30 年的 8 階段 pipeline，每個學生做大型家具都要走完：

### 3.1 階段 1：Design（設計）

- 全尺寸畫圖（不管現在 SketchUp / Fusion 360 / 木頭仁的家具設計生成器都好）。
- 三視圖（Top / Front / Side）+ 至少 1 個剖面（cross section）。
- 標註所有接合的位置和尺寸。
- 如果是椅子或有人體接觸面 → 必做 mock-up。

### 3.2 階段 2：Material Selection（選料）

- 先看設計需要的料表（cut list），加 25–30% 浪費餘量。
- **挑料原則（Frid Vol.1 ch.1）**：
  - 結構件（椅腳、桌腳）→ **straight grain，木紋平行料長**，避免短紋。
  - 桌面 → **挑色澤接近的板**，最好同一棵樹。
  - 抽屜面板 → 同一片板鋸開保證紋路連續。
  - 看得見的接合（dovetail）→ 顏色對比讓接合「跳出來」當設計。

### 3.3 階段 3：Rough Cut + Acclimate（粗切 + 適應環境）

- 粗切到比設計尺寸**長 25mm、寬 10mm、厚 3mm**。
- 在工作室靜置 **1–2 週**——FWW 反覆強調這步。
- 期間檢查有沒有翹/扭/裂，內應力大的料粗切後會立刻變形，這時候丟掉比後面做完才發現好。

### 3.4 階段 4：Mill to Final Dimension（精磨）

依 Frid 的 4 步序（見本檔 1.1）：joint 面 → joint 邊 → plane 對面 → rip/crosscut 對邊。**全部料一次磨完**，不要邊做邊磨——空氣濕度變了，前一週磨好的料會跟這週磨的有 0.5mm 差。

### 3.5 階段 5：Joinery（榫卯加工）

順序：**先做 mortise（鑿凹），再做 tenon（鋸凸）**。為什麼？凹比較難精準調，凸可以一刀刀慢慢配。
- 全部 mortise 同一台機器、同一個設定一次做完 → 確保深度一致。
- Tenon 用「rib by rib」測試法：鋸完先 dry fit 一根，緊度對了，後面其他根照同樣設定切。
- **Dry assembly（乾組）必做**：所有零件不上膠先組一次，檢查方正、間隙、扭轉。發現問題現在改還來得及。

### 3.6 階段 6：Glue-up（上膠組裝）

Frid Vol.3 反覆強調的「**glue-up 前 5 分鐘決定 5 年品質**」：
1. **先把所有夾具預先擺好**——上膠後沒時間找夾具。
2. **準備防滑墊片**（plywood scrap + wax paper）保護成品。
3. **複雜家具分階段組**：椅子先組 2 個側邊，等乾，再組前後牙條。一次全組會手忙腳亂。
4. **Open time（操作時間）**：Titebond 約 5 分鐘，PU 約 20 分鐘，epoxy 看廠牌（slow set 60+ 分鐘）。複雜組裝用 epoxy 或 hide glue 換時間。
5. **擦膠不要等乾**——上膠後立刻用熱水濕布擦溢出膠，乾了就不好擦，且影響後續上漆。
6. **方正檢查**：對角線量兩條，差 < 1mm 算合格。差太多用 clamp 斜壓校正。

### 3.7 階段 7：Surface Prep + Finishing（表面處理 + 上漆）

砂磨進程：
- 機器砂磨：#80 → #120 → #150 → #180。
- 手砂磨（沿 grain）：#180 → #220（油性塗料停這）/ #320（水性 / shellac / 噴漆）。
- 上漆前：**raise the grain**（升毛）—— 噴一層水，等乾，#320 輕磨——避免上水性塗料後起毛。

> finishing.md 已寫得很全，這裡不重複砂磨進程細節。

### 3.8 階段 8：Install / Delivery（安裝 / 交件）

- Built-in 家具（櫥櫃、書牆）→ 現場 scribe（描邊配合不平的牆）。
- 組裝家具（桌椅）→ 現場做 final wax 一遍。
- **客戶交件前一定要說明保養**：Frid 在 Vol.3 說「家具的壽命一半是做的人決定，一半是用的人決定」。

---

## 4. 椅子製作專章（FWW + Frid 累積三十年經驗）

> 來源：FWW *Best of Fine Woodworking: Tables and Chairs*；FWW 多篇專文（Michael Fortune、Hank Gilpin、Brian Boggs）；Tage Frid Vol.3 ch.10–14（5 件椅子設計）。

### 4.1 椅子幾何的關鍵角度

> 來源：FWW "On Making Chairs Comfortable"、Michael Fortune "Side-Chair Geometry"。

| 角度 | 範圍 | 木頭仁解釋 |
|---|---|---|
| 椅面後傾（座面相對地面） | **3–8°**（餐椅 5° 最常見） | 屁股不會往前滑 |
| 椅背相對椅面角度 | **100–113°**（餐椅 105–108°） | 越大越休閒，餐椅要直一點才好用餐 |
| 椅背相對地面角度（總和） | **103–118°** | = 椅面後傾 + 椅背相對椅面 |
| 椅腳外八（splay） | **2–5° 餐椅 / 5–10° 工作椅** | 防側翻，三腳凳 splay 必做 |
| 扶手高 | **椅面上 200–250mm** | 取決於使用者前臂長度 |

> Frid Vol.3 的三腳凳和工作椅都用 **5° 椅面後傾 + 105° 椅背**——他說這是「用了 30 年沒人抱怨」的組合。

**為什麼餐椅是 5° 不是 0°？**
椅面 0°（純水平）坐久了大腿前緣會頂到椅面前緣，血流不暢。後傾 5° 把重心往骨盆後方移，靠到椅背靠墊，腰會放鬆。

### 4.2 椅腳尺寸法則

> 來源：FWW 多篇 + Frid Vol.3。

- **後腳上端（椅背柱）**：通常 35–45mm 見方，因為要承受椅背反推力。
- **前腳**：30–40mm 見方，純承重。
- **前腳常做 taper（從上往下漸縮 1/3）**：上端 35mm 見方，下端 25mm，視覺輕盈，重量也減 30%。
- **椅腳全長**：座高 450mm + 椅腳穿過椅面深度（30mm）+ 餘量。
- **椅子座面寬**：前緣 ≥ 450mm，後緣可窄到 380mm（梯形座面更貼合人體）。

### 4.3 座面與椅腳的接合（最容易壞的點）

椅子最常壞在「**前腳和椅面的接合**」——人坐下時的前後晃動會讓這個榫不斷被拉。Frid 和 FWW 一致推薦：
1. **斜榫（angled M&T）**：椅腳上端 5° 後傾接椅面，肩面要切成同樣角度。
2. **drawbored**：榫做好後鑽穿固定木釘（offset 1.5mm），讓木釘把榫頰永久拉緊。即使膠老化也不會鬆。
3. **後腳一體成型（continuous back leg）**：傳統 Windsor、Shaker 椅後腳和椅背柱是同一根料彎成或直接弧切，避免接合點。

### 4.4 椅背曲面（Back Splat）

- **直背（straight splat）**：最簡單，但坐久不舒服。
- **單曲（curved splat）**：用 bandsaw 鋸一個橫向弧（半徑約 600mm），貼合人體腰背。
- **複曲（compound curve）**：腰托位置 + 上肩位置兩個弧——這是 Maloof rocking chair 的招牌。

**做法**：thickness ≥ 12mm 的料，bandsaw 鋸彎，用 spokeshave / scraper 順紋整形——不要試圖用砂帶機，會磨出方塊感。

### 4.5 扶手 join

扶手最難接的是**和椅背柱的角度**——兩個方向都不是 90°（一個有椅背後傾角，一個有扶手向外擴展角）。
- **解法 1：double-tenon angled M&T**——複雜但精度高。
- **解法 2：dowel + epoxy** —— 設計師椅常用，看起來更簡潔。
- **解法 3：sliding dovetail 從上往下滑入**——Maloof 經典手法，不需 clamp，重力 + 楔自鎖。

---

## 5. Built-in Cabinet 工法（櫥櫃、書牆、廚房）

> 來源：FWW *Best of Fine Woodworking: Built-In Furniture*；Albert Jackson & David Day《The Complete Manual of Woodworking》Cabinetmaking 章。

### 5.1 兩大流派：Face Frame vs Frameless

| 項目 | Face Frame（美式） | Frameless（歐式 / 32mm system） |
|---|---|---|
| 起源 | 美國早期實木櫥櫃 | 1950s 德國，二戰後夾板量產化 |
| 結構 | 箱體前緣有一圈實木框架（face frame） | 無框，門直接裝在箱體側板 |
| 鉸鏈 | 暗藏式 / 半藏式 / 露式都可 | 必用歐式 cup hinge（35mm 杯孔） |
| 內部空間 | 因為 face frame 擋住一些，內部可用空間少 10–15% | 全箱體可用，多 10–15% |
| 安裝 | face frame 可 scribe（描邊修牆） | 整箱用 levellers 調水平 |
| 適合 | 古典、Shaker、傳統美式 | 現代、北歐、IKEA 風 |
| 製作難度 | 需要好木工技術 | CNC 友善，量產容易 |

### 5.2 Frameless 的 32mm system（核心觀念）

歐式櫥櫃的精髓是「**所有五金都用同一套 5mm 孔系統**」：
- 側板每 32mm 一個 5mm 孔（line bore），整柱排下來。
- 鉸鏈底座、層板支撐、抽屜滑軌——**全部用這套孔**，不用另外鑽。
- 客戶以後想改格層位置 → 拿出去插另一個孔就好。

**標準距離（front edge → first hole）**：37mm（這是 IKEA、Hettich、Blum 的全球標準）。

> 為什麼是 32mm？因為這是德國工業設計的「人手最舒服的調整單位」——一格約一個拇指寬，視覺上等距感最強。

### 5.3 歐式 cup hinge（杯式鉸鏈）安裝

- **杯孔直徑**：35mm（國際標準，Blum、Hettich、Salice 全部一致）。
- **杯孔深度**：13mm（不能鑽穿 18mm 板）。
- **杯孔到門邊距離（C 值）**：3–6mm，決定門開角度（C 越小角度越大）。
- **常用角度**：90°（基本款）、110°（角落櫃）、165°（180° 全開）。
- **板厚最小**：18mm 才能裝，板太薄杯孔會穿。

**Overlay / Inset / Half-overlay 三種覆蓋方式**：
- **Full overlay**：門完全蓋住側板邊緣（現代風）。
- **Half overlay**：兩扇門共用一個側板，各蓋一半（雙開櫃常見）。
- **Inset**：門嵌入側板裡面，門面齊平側板（傳統美式 face frame 風格，要求精度極高）。

### 5.4 Built-in 安裝實戰流程

> 來源：FWW *Best of Built-In Furniture*。

1. **現場量測 3 次**：地板、牆、天花都不平。每個牆面量上中下三點。
2. **把家具拆成可運的 module**：全幅 3 米的書牆要拆成 3 段 1 米。
3. **scribe（描邊）**：靠牆、靠地的邊緣用 compass 沿牆面/地面描線，刨刀修到貼合。
4. **levellers 調水平**：櫥櫃底部裝可調腳，水平儀調平。
5. **接縫處用 face frame 蓋**或實木線板（trim）蓋——不要試圖讓兩個 module 完美對齊，永遠有 1–2mm 縫。
6. **鎖牆**：上方鎖一條 ledger（夾板 2x4）到牆裡的木骨/水泥，櫥櫃掛上去。

---

## 6. 上漆系統實作：四大流派

> 來源：Tage Frid Vol.2 *Shaping, Veneering, Finishing*；FWW *Best of: Finishes & Finishing*。

> finishing.md 已經寫了完整 SOP（油性、水性、shellac、PU、Osmo）。這裡補的是「**Frid 的油浸法**、**FWW shellac 萬用論**、**何時噴何時擦**」這層的選擇邏輯。

### 6.1 Tage Frid 的 Danish Oil 油浸法（Vol.2 ch.21）

Frid 從丹麥帶來的傳統做法，至今仍是 RISD 學生的入門指定塗法：

**SOP**：
1. 木料砂磨到 #220。
2. **第一道：濕砂（wet sanding with #320）+ Danish Oil（Watco 或自配 BLO 1 : turpentine 1 : varnish 1）**。在木面倒一灘油，立刻用 #320 砂紙在油裡濕砂——產生的 **slurry（木屑 + 油的泥漿）會自然填滿木孔**。
3. 砂 5–10 分鐘，木孔填飽，**用乾棉布順紋擦掉表面所有殘油**——這步絕對不能跳，否則乾了會黏。
4. 等 24 小時。
5. **第二道：濕砂 #400 + 同樣的油**——這次 slurry 更細，把上一道留下的微小坑洞填滿。
6. 24 小時後擦掉殘油。
7. **第三道：純擦（不砂）**——乾棉布沾油，全身擦一遍，5 分鐘後擦乾。

**結果**：木孔完全填飽（不需要另外用 grain filler）、表面像絲綢、低光澤、強調木紋自然感。

**油布處理**：擦完的油布會自燃！必須泡水 / 攤開晾乾後再丟。（safety_workshop.md 有完整警告）

> 這個方法為什麼好？因為 slurry 填的是「**這塊料自己的木屑**」，顏色跟木材完美吻合，不會像市售 grain filler 留下色差。

### 6.2 Shellac（蟲膠）的萬用性（FWW 反覆強調）

> finishing.md 第 6 章已寫完整 SOP。這裡補「為什麼 FWW 編輯部叫 shellac 為 'the universal finish'」。

**Shellac 的 5 大不可取代特性**：
1. **跟所有其他塗料相容**——可以當 PU 的底漆、可以蓋住染色防止滲色、可以蓋油性塗料防止 PU 不黏。
2. **修復古董唯一不會傷原塗裝的塗料**——可逆，酒精就能溶。
3. **食品安全**（乾後）—— 砧板、玩具、嬰兒家具可用。
4. **乾得最快**——15 分鐘可以再上下一道。
5. **自帶補洞能力**——多上幾層自然填木孔，不需 grain filler。

**FWW 推薦的「**Universal Schedule**」**：
- 1 道 1lb cut shellac 當 sealer（封閉）
- 1 道染色（如需要）
- 2 道 2lb cut shellac
- 2–3 道任何塗料（油性 PU / 水性 PU / wipe-on）

> 蟲膠像「萬用底漆 + 中介層」。如果不知道怎麼上漆，直接 3 道 2lb cut shellac + wax 完事，永遠不會錯。

### 6.3 何時噴 / 何時擦 / 何時刷（決策表）

| 場景 | 推薦方式 | 理由 |
|---|---|---|
| 大平面（桌面、衣櫃門） | 噴 HVLP 或 wipe-on | 噴最快但要噴塗環境；wipe-on 慢但無設備 |
| 椅子（曲面多） | 噴 + 擦結合 | 曲面噴不均勻，凹處用擦補 |
| 小物件（盒、杯墊） | 全擦 | 沒必要架噴塗系統 |
| 一次性、初學者 | wipe-on + shellac | 失敗率最低 |
| 戶外家具 | 油性 spar varnish 刷 | 厚漆膜抗 UV |
| 修復古董 | shellac 刷 + french polish | 可逆 + 復古風 |

**Wipe-on（擦塗）的隱藏優勢**：
- 不會有刷痕。
- 不會堆漆造成淚痕。
- 失敗了可以擦掉重來。
- FWW 反覆推薦給初學者：「wipe-on poly thinned 50% with mineral spirits」這種自配版，效果跟 Watco 一樣但便宜一半。

### 6.4 噴塗 vs 刷塗的 FWW 共識

> 來源：FWW *Best of: Finishes*。

- **噴塗**：噴 1 次 = 刷 3 次的薄度。但設備、噴塗房、防護裝備一筆固定投資。
- **刷塗**：用好刷子（如 Wooster 紫貂毛或日本馬毛刷）+ 油性 PU 適度稀釋（10% mineral spirits）—— 可以做出近乎噴塗的平整度。
- **FWW 觀點**：**業餘 / 一週做 1 件 → 學擦塗（wipe-on）；半專業 / 一週做 5 件 → 投資 HVLP**。

---

## 7. 木紋對配（Grain Matching）細節

> 來源：FWW 多篇文章；Tage Frid Vol.2 *Veneering* 章；Albert Jackson & David Day 第 11 章。

當你切開一片實木板，或是用鋸開的兩片貼皮，怎麼擺放會直接決定家具的「貴氣」。

### 7.1 主要 4 種對配

#### Book Match（書本對開）
最常見。把 2 片連續鋸下來的板/皮**像翻書一樣翻開**，得到對稱鏡像。
- **優勢**：紋路鏡像很美，是奢侈家具、樂器面板的標配。
- **問題**：因為一片是「正面（tight side）」、翻過來那片是「反面（loose side）」，**反射光的方式不同**——同樣的染色塗上去，會出現明顯色差，叫做 **barber pole effect**（理髮店招牌效應）。
- **解法**：用 dye stain（染料）不要用 pigment stain（顏料）；或用 wipe-on poly 不染色。

#### Slip Match（滑接）
**不翻面**，連續鋸下來的板直接平移併接。
- **優勢**：沒有 barber pole 問題，所有板都同方向，染色均勻。
- **問題**：紋路是重複而不是鏡像，視覺上比較單調。
- **適合**：直紋木材（quarter-sawn oak、cherry），或想要低調效果。

#### Random Match（隨機）
不講究順序，亂排。
- **優勢**：自然感、便宜（可用零頭料）。
- **適合**：地板、櫥櫃內部、農家風家具。

#### Four-Way Match（四方對配）
**4 片**先 book match 兩兩成對，再上下鏡像。
- **效果**：從中心向外發散的對稱花紋——像萬花筒。
- **適合**：高端桌面、門板花心、樂器背板。
- **挑戰**：需要 4 片連續切下、紋路完整的料。

### 7.2 木紋對配的選料順序（Frid Vol.2）

1. 先看你有的木板——找紋路最美、最連續的那片。
2. 在板上**畫設計輪廓**（用粉筆），看哪一段紋路最有特色。
3. 沿紋路裁切——而不是「先按尺寸切再看紋」。
4. **桌面拼板時，相鄰兩片紋路方向要協調**——不要一片直紋接一片大花紋，視覺打架。

> Frid 名言（Vol.2）：「**An average piece of wood with great grain matching looks expensive; an expensive piece with poor matching looks cheap.**」（普通木料配上好的對配看起來貴；好木料配上爛對配看起來廉價）。

### 7.3 板材選色與選紋的台灣應用

- **台灣檜木**：紋路很美但伸縮大，做大桌面要 book match + 留充足脹縮縫。
- **山毛櫸（白櫸）**：直紋穩定，slip match 最合適，染色後均勻。
- **紅花梨、緬甸柚木**：油性大，做 book match 時膠合難——用 epoxy 或先用酒精擦油。
- **進口黑胡桃**：花紋大、色差也大——四方對配（four-way match）效果最強烈。

---

## 8. George Nakashima 設計觀：木料的對話

> 來源：George Nakashima《The Soul of a Tree: A Master Woodworker's Reflections》(1981)；New Hope, Pennsylvania 工坊；Nakashima Studio 仍由女兒 Mira Nakashima 經營。

### 8.1 Nakashima 的核心理念

Nakashima 出身日裔美籍家庭，在巴黎、東京、印度（Pondicherry 修行）、二戰美國集中營都待過。他的設計是 **「Hindu Catholic Shaker Japanese American」** 的綜合體（他自己的話）。

**核心 3 原則**：
1. **「Each tree has its own destiny」**：每棵樹都有它「想成為什麼」的天命。木匠的工作不是強迫木料變成某個設計，而是**讀木料、找出它最合適的用途**。
2. **保留自然形態**：樹皮、自然邊緣（live edge / free edge）、節疤、裂痕——都是樹的「**人生紀錄**」，不要砂掉。
3. **缺陷即裝飾**：裂痕用 **butterfly key（蝴蝶榫）** 鎖住，當設計亮點。蟲洞、節疤都保留。

### 8.2 招牌技法

#### Live Edge（自然邊）桌面
- 整片大板，至少一邊保留樹皮 / 自然樹形邊。
- 樹皮要不要留：Nakashima 通常**保留樹皮但加固**（從背面用樹脂塗一層防止剝落）。如果樹皮鬆，用尖嘴鉗夾掉，露出邊材自然紋。
- 邊緣**不打磨成直線**——讓它彎、讓它有節。

#### Book-Matched 大桌面
- 一段直徑 1.5m+ 的胡桃 / 楓木，鋸開兩片 book match，做出 3m 寬的桌面。
- 中縫不直接膠合——而是**保留 5–15mm 縫**，用 **butterfly key（蝴蝶榫，又叫 bowtie）** 跨過縫鎖住。
- Butterfly key 通常用對比色（如黑檀 / 紫檀），鳩尾形，深度 = 板厚 1/2，讓它變成**結構 + 設計**。

#### Conoid Chair / Mira Chair
- Nakashima 標誌椅子，三腳結構（前腳 splay 6° 外八）。
- 椅面 hand-shaped 凹陷貼合臀部。
- 椅背用 spindle（細圓桿）多支撐——透視感、結構感兼顧。

### 8.3 對木料的選擇（Nakashima 工坊一直延續的傳統）

- 工坊在 New Hope, PA 有一個 **巨大的木料倉**（lumber yard），存了幾十年的胡桃、楓木、櫻桃、Persian walnut 大板。
- 每次接訂單，**Mira（Nakashima 女兒）會帶客戶走進倉庫**，親自挑那塊「**屬於這個客戶**」的木板。
- 一塊 3m 大胡桃板可能存了 20 年才被選中——樹的命運在這時候揭曉。

### 8.4 對台灣木工的啟發

> 木頭仁觀察。

台灣的樟木、檜木、肖楠、烏心石等本土大樹，每棵都是百年級老樹。但台灣師傅的傳統是「把所有缺陷砂掉、所有邊鋸直」——出來的桌面看起來「乾淨」但失去了樹的故事。

Nakashima 的做法在台灣可以這樣轉譯：
1. **鋸大板時保留至少一邊 live edge**（特別是大樟木板）。
2. **不要怕節疤、蟲洞、開裂**——用 epoxy 填透明、或用 butterfly key 鎖。
3. **每塊大板給它一個身份**：拍照記錄樹的來源、樹齡、產地，跟成品一起交給客戶——客戶買的不是家具，是這棵樹的最後一段人生。

---

## 9. Andy Rae 與 Sam Allen 的補充（手工具實戰、接合圖鑑）

### 9.1 Andy Rae《Choosing & Using Hand Tools》核心觀念

> 來源：Andy Rae, *Choosing & Using Hand Tools* (Lark Books, 2002)。

Rae 是 FWW 長期作者、在 RISD 教書，跟 Frid 同期。他的書最大價值是 **「機器做不到的，手工具能做到」** 這個論點：

- **Block plane（小刨刀）是萬用工具**：倒角、修接合、整形小料——比任何電動工具都快。
- **手鉋過的木面比砂磨過的好**：手鉋切斷木纖維留下平整反光面，砂磨是磨碎纖維造成漫反射。**油性塗料上去**，手鉋過的面看起來更深邃。
- **手鋸（dovetail saw）做小榫快過機器**：dovetail 用手鋸 30 秒一邊，桌鋸換 jig 換刀片要 5 分鐘。
- **Card scraper（刮刀片）解決所有 tearout 問題**：困難木紋（楓木、櫻桃）刨會撕，scraper 一刮就平。

> hand_tools.md 已寫過刨刀、鑿刀、磨刀的台灣用法。Rae 的書值得讀的是「**為什麼還要學手工具**」這個哲學。

### 9.2 Sam Allen《The Complete Book of Joinery》觀念

> 來源：Sam Allen, *The Complete Book of Joinery* (Sterling, 1996)。

Allen 的書是「百科全書」風格，把 50+ 種接合用同樣的版面排出來——每個接合都包含：
1. 用途
2. 強度等級（1–5）
3. 加工難度（1–5）
4. 建議工具
5. 步驟圖
6. 變體

**Allen 的接合「**選擇樹**」**（決策邏輯）：
1. 木紋方向 → 順紋對順紋（強度高）/ 順紋對橫紋（要伸縮空間）/ 橫紋對橫紋（最弱，避免）。
2. 接合是否承重 → 是 → mortise-tenon 系列；否 → biscuit、dowel、pocket screw。
3. 看不看得見 → 看得見 → dovetail、through M&T；看不見 → blind M&T、domino。
4. 製作預算 → 高 → 手切 dovetail；低 → biscuit、pocket screw。

> joinery.md 已經寫了完整接合分類字典——這裡引用 Allen 的「**選擇樹**」邏輯，是寫成「決策流程」而不是「分類字典」，幫木頭仁回答「這個家具該用什麼接合」這種問題。

---

## 10. Albert Jackson & David Day《The Complete Manual of Woodworking》定位

> 來源：Albert Jackson & David Day, *The Complete Manual of Woodworking* (Knopf, 1989, 多版重印)。英國視角的「教科書」。

這本書最獨特的是：
1. **整合了英國傳統工藝 + 現代美式工法**——從 18 世紀英式櫥櫃到 1980s 美式工作室。
2. **完整工具圖鑑**（手工具 + 電動工具 + 機具，每件附剖面圖、用法）。
3. **木材識別圖鑑**（120+ 種木材彩圖 + 物理性質）。
4. **設計章節**（家具比例、尺度、人體工學）—— 這是其他寶典缺的。

### 10.1 設計比例的「黃金法則」

> 來源：Jackson & Day 第 13 章 *Design and Drawing*。

書中整理英國家具學派的標準比例：
- **桌：座椅高度差 = 270–300mm**（書桌 / 餐桌都適用，肘部到桌面剛好垂直手臂放鬆）。
- **餐桌每人寬度 = 600mm，深度 = 350mm（最少）/ 450mm（舒服）**。
- **書架層板深度 = 250mm**（精裝書）/ **300mm**（藝術書、相簿）。
- **抽屜操作高度範圍**：地面 ↑400mm 到肩 ↑300mm（即 400–1500mm 之間最方便）。
- **黃金比例 1 : 1.618**：櫃門寬高比常用 1 : 1.618 或 1 : 1.414（√2）—— 看起來「對」。

### 10.2 對台灣的轉譯

台灣家具尺寸有些跟歐美不同：
- **餐椅高 410–430mm**（歐美 450mm）—— 台灣人腿短一點。
- **餐桌高 720–740mm**（歐美 760mm）。
- **沙發座面深 500mm**（歐美 550–600mm）。

> 不要照抄歐美比例，依台灣使用者調整。木匠學院的家具設計生成器已經內建台灣標準（參見 wrd repo）。

---

## 11. Kelly Mehler《The Table Saw Book》核心觀念

> 來源：Kelly Mehler, *The Table Saw Book* (Taunton, 2003 修訂版)。Mehler 是肯塔基州木工學校 Kelly Mehler's School of Woodworking 創辦人。

> machinery.md 已寫桌鋸操作 SOP、安全、kickback。Mehler 補的是「**進階技巧**」：

### 11.1 Thin Strip Cutting（細條切割）— Mehler 的反向法

傳統做法：fence 設窄寬度（如 5mm），把細料推進去——**極危險**（細料會被吸入、push stick 會碰到 blade）。

**Mehler 的方法**（書 p.110）：
1. **Fence 設大寬度**（如 100mm），主料是大料。
2. **Push stick 推主料，細條（fall-off side）自然落下**。
3. 切完一條 → 不動 fence，再切下一條（用同樣大料法則）。

優勢：
- Push stick 推的是大料，blade 旁邊永遠有結實的料當靠墊，不會吸入。
- 不用每次調 fence——切 10 條只設一次。

### 11.2 Resaw on Table Saw（桌鋸劈板）

桌鋸劈板（把厚板鋸成兩片薄板）—— **不如 bandsaw 安全**，但 Mehler 教了一套技巧：
1. 兩面都鋸（先鋸一面到 ½ 深度，翻面再鋸）。
2. 中間若有 1–2mm 沒鋸開，用 handsaw 完成。
3. **Riving knife 一定要在**——劈板木料容易夾鋸。
4. 高度不要超過 blade 半徑（10” 鋸最多劈 75mm 深）。

> 木頭仁工作室建議：劈板優先用 bandsaw，桌鋸劈板是不得已的方案。

### 11.3 Mehler 的 4 個 Jig 哲學

1. **Crosscut sled（橫切滑台）**：所有橫切都用，比 miter gauge 精準 10 倍。
2. **Tenon jig（榫頰治具）**：榫頰垂直料切，比平躺切安全。
3. **Tapering jig（漸縮治具）**：椅腳、桌腳的 taper 必備。
4. **Featherboards（羽毛板）**：壓住料貼 fence，防止 kickback、提升精度。

> Mehler 名言：「**A jig is a tool that pays for itself the first time you use it.**」（治具是用第一次就回本的工具）。

---

## 12. 對木頭仁工作室的綜合啟發（總結）

把以上 11 章融會起來，給木頭仁工作室、木匠學院的具體建議：

### 12.1 教學課程編排（從 Frid pipeline 借）

木匠學院初階課程的 8 週可以對應 Frid 的 8 階段：
- 第 1 週：Design + 全尺寸畫圖
- 第 2 週：選料 + 認木紋（book match / slip match）
- 第 3 週：Mill stock（4 步序）
- 第 4–5 週：Joinery（選 1 個榫做透）
- 第 6 週：Glue-up + 方正校正
- 第 7 週：Surface prep + 一個 finish 系統做透（推薦從 Tage Frid 油浸法或 shellac 入手）
- 第 8 週：交件 + 客戶保養說明

### 12.2 影片內容點子（從寶典抓的獨特角度）

1. **「木紋對配」一支影片**：拿 4 塊木板示範 4 種 match 法（book / slip / random / four-way），染色後對比給觀眾看 barber pole 效應。
2. **「Tage Frid 油浸法」實作**：30 年前丹麥傳來的方法，跟現在台灣常見的 Osmo 對比——觸感、價格、難度。
3. **「Sharpening Pyramid」磨刀全流程**：把 reshape / regular / touch up 三種狀況拍清楚，破解「磨刀好麻煩」的迷思。
4. **「為什麼椅面要 5° 後傾」**：拿木匠學院的椅子設計用全尺寸圖示範，演示 0° vs 5° vs 10° 的差別。
5. **「Nakashima 蝴蝶榫」的台灣版**：找一塊有大裂的台灣樟木板，用對比色（黑檀或非洲花梨）做 butterfly key，把缺陷變成設計亮點。
6. **「歐式 32mm system」入門**：拍一支讓觀眾理解櫥櫃為什麼是這樣設計的影片——很多木工新手做櫥櫃失敗是因為不懂這套系統。

### 12.3 不要再迷信的事（FWW + Frid 共識）

1. **不需要花大錢買 Titebond III**——95% 的家具用 Titebond Original 就夠（6.3 章）。
2. **不需要買最高 grit 磨石**——#8000 已經夠用，#12000 是奢侈品（2.1 章）。
3. **不需要買全套電動工具才開始**——一把好刨、一把鑿、一把鋸就能做完整套家具（Andy Rae 觀點）。
4. **不需要追求「沒有縫的接合」**——預留脹縮縫才是專業（2.2 章）。
5. **不需要把每塊板砂得像鏡面**——保留刨痕、保留 live edge 反而更高級（Nakashima 觀點）。

---

## 引用來源彙整

### 書籍
1. Tage Frid, *Tage Frid Teaches Woodworking, Vol.1: Joinery* (Taunton, 1979)
2. Tage Frid, *Tage Frid Teaches Woodworking, Vol.2: Shaping, Veneering, Finishing* (Taunton, 1981)
3. Tage Frid, *Tage Frid Teaches Woodworking, Vol.3: Furnituremaking* (Taunton, 1985)
4. *The Best of Fine Woodworking: Tables and Chairs* (Taunton)
5. *The Best of Fine Woodworking: Working with Wood* (Taunton)
6. *The Best of Fine Woodworking: Built-In Furniture* (Taunton)
7. *The Best of Fine Woodworking: Finishes & Finishing* (Taunton)
8. Sam Allen, *The Complete Book of Joinery* (Sterling, 1996)
9. Albert Jackson & David Day, *The Complete Manual of Woodworking* (Knopf, 1989)
10. Andy Rae, *Choosing & Using Hand Tools* (Lark Books, 2002)
11. Kelly Mehler, *The Table Saw Book*, revised edition (Taunton, 2003)
12. George Nakashima, *The Soul of a Tree: A Master Woodworker's Reflections* (Kodansha, 1981; reissued 2012)
13. Bruce Hoadley, *Understanding Wood* (Taunton, 2000) — wood movement 章節參考

### Fine Woodworking 雜誌特定文章
- "How Strong is Your Glue?" Aug 2007 (FWW #192)
- "Side-Chair Geometry" — Michael Fortune
- "On Making Chairs Comfortable"
- "Designing a Rocking Chair" — May 1998
- "Sharpening Stones Forum" 累積討論
- "Table-Saw Kickback" Dec 2024

### 其他線上資源（公開資料佐證）
- Sharpening Supplies — Sharpening Stone Grit Chart
- Tools for Working Wood — Routine sharpening sequences
- Dooge Veneers / Mundy Veneer — Veneer Matching Techniques
- Architectural Forest Products — Wood Veneer Matching
- Nakashima Studio (官方網站)

---

*（本知識檔由木頭仁團隊整理，內容來自上述西方工法寶典、Fine Woodworking 雜誌累積、實作社群討論與木頭仁工作室實戰經驗。所有引用皆已註明出處；不確定的數字均未列入。）*
