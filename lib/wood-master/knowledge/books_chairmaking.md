# 椅匠經典 / Green Woodworking / 蒸彎椅

> **角色**：木頭仁分身知識庫，「椅匠專業」獨立檔。
> **跟其他檔的分工**：
> - `books_workshop_manuals.md` §4 講「現代家具椅」（drawbored M&T、5° 後傾、Maloof 流派）——那是**乾燥木 + 桌鋸**做法。
> - `books_chinese_classics.md` §3.7 講明式圈椅楔釘榫——那是**硬木 + 雕琢**做法。
> - 這份檔走第三條路：**生材（green wood）+ 劈材 + 收縮榫接**的 Anglo-American 椅匠傳統，外加**蒸汽彎曲**全套技術。
>
> **何時翻這份**：
> 「Windsor 椅腳怎麼鑽 splay 角度」「post-and-rung 為何不上膠」「蒸汽彎曲 fail rate」「fan back 怎麼放樣」「椅腳的 reamer 角度」「milk paint 怎麼做」「green wood 是什麼」「圓棒削片刀（drawknife）怎麼用」——先翻這份。
>
> **主要參考書**：
> - Jennie Alexander《Make a Chair from a Tree》第 3 版（Lost Art Press, 2021；Peter Follansbee + Galbert 補完）
> - Drew Langsner《The Chairmaker's Workshop》（Lark, 1997；2008 重印）
> - Drew Langsner《Country Woodcraft》（Taunton, 1978/2020 修訂）
> - Curtis Buchanan《Windsor Chairmaking》系列圖檔 + YouTube 26 集 continuous arm 教學
> - Peter Galbert《Chairmaker's Notebook》（Lost Art Press, 2015）
> - Mike Abbott《Living Wood》（Living Wood Books, 2002/4th ed.）
> - Mike Abbott《Green Woodwork》（GMC, 1989）
> - Lon Schleining《The Complete Manual of Wood Bending》（Linden, 2002）/《Wood Bending Made Simple》（Taunton, 2010）
> - Brian Boggs Fine Woodworking 訪談 + Craftsmanship Magazine 專訪
> - Mike Dunbar《Make a Windsor Chair》（Taunton, 1984/3rd ed. 2009）
> - 椅匠 Tim Manney、Elia Bizzarri、Greg Pennington、Caleb James 的網誌實作筆記

---

## 0. 為什麼要讀這條傳統？

明式家具用乾燥黃花梨、桌鋸文化用乾燥硬木——但**全世界最古老的椅匠系統，全部是用「會動的木頭」做的**：

- 英國 Windsor 椅（1700s 起）
- 美國 Appalachian post-and-rung（1700s 起，Shaker、Hepplewhite 沿用到今天）
- 北歐三腳凳 / Welsh stick chair
- 日本宮大工劈材「縦使い」傳統（屋柱不切板，順紋劈下來）

它們的共同點是：**砍下一棵樹 → 順木紋劈成料 → 趁濕削 → 利用木頭乾燥時的收縮，把椅子鎖死**。

這條路最大的優勢：
1. **不需要桌鋸 / 帶鋸 / 大機具**——一支斧 + 一支削片刀 + 一支鑿就能做椅
2. **強度遠高於鋸切料**——木紋順著力的方向走，沒有 short grain 弱點
3. **不靠膠**——靠木頭乾燥動力學

> Langsner 在《Country Woodcraft》序言講得最直白：『一棵砍下 30 分鐘的橡樹，比你木材行買的 KD 橡木好用 100 倍。前提是你會用。』

對台灣的意義：**台灣本土相思木 / 烏心石 / 龍眼這些「機具切起來討厭」的環孔硬木，正好是 green wood 椅匠最愛的料**。詳細在 §9。

---

## 1. Green Woodworking 哲學（含水率動力學）

### 1.1 何謂 green wood

**Green wood** 指的是「樹剛砍下、還沒乾燥的木材」，含水率（MC）通常在 **30–80%** 之間（樹種、季節、部位都會影響）。對比：

| 狀態 | 含水率（MC） | 來源 |
|---|---|---|
| 剛砍下的橡木（春夏） | 60–90% | Hoadley §1 |
| 剛砍下的橡木（冬天） | 50–70% | 同上 |
| 風乾完成（air-dried） | 12–18% | 視氣候 |
| 窯乾（KD, kiln-dried） | 6–10% | 一般家具材 |
| 室內平衡（EMC, 台灣） | 13–16% | wood_species.md §6.2 |

**Green woodworking 用的是 30–60% MC 這段**——剛劈下來、還沒乾透，但已經沒那麼濕的「半濕」料。

### 1.2 為什麼用生材？三大理由

**理由 1：好削好劈**
- 生材的 lignin（木質素）還有彈性，纖維間水分當潤滑劑
- 順紋劈：生材一支斧 + 楔木就能劈 4 米長的橡木幹成 8 等分
- 削片刀（drawknife）削生材像削蘋果，削乾燥木像削骨頭

**理由 2：不需要機具**
- 沒桌鋸沒帶鋸沒刨機，純斧 + 劈刀 + shaving horse + 鑿 + 削片刀
- 工作台占地 2 平方米，蓋木屋裡都能做

**理由 3：收縮榫接（shrinkage joint）**
這是 green woodworking 的**核心技術**——不靠膠的接合：

> 『把乾的榫頭打進濕的榫眼。一週後，榫眼周邊收縮把榫頭緊緊抱住——膠水也比不上這個。』
>
> —— Jennie Alexander《Make a Chair from a Tree》3rd ed., ch.6

詳細機制在 §2.2。

### 1.3 收縮的物理：為什麼方向有差

> 出處：Hoadley《Understanding Wood》ch.4；books_english_classics.md §1.4 有原理。

木材乾燥時各方向收縮率不同：

| 方向 | 從 FSP（28%）到完全乾（0%）的收縮率 |
|---|---|
| 縱向（沿木紋） | 0.1–0.3%（幾乎不動） |
| 徑切（沿髓線） | 3–5% |
| 弦切（垂直髓線） | 6–10% |

**椅匠利用這點做兩件事**：

1. **榫頭一律順木紋削（縱向）**——榫頭乾燥不縮、形狀穩
2. **榫眼鑽在弦切面**——榫眼乾燥時往內縮 6–10%，把榫頭抱緊

這是 Alexander、Langsner、Galbert、Abbott 全都在用的同一招。

### 1.4 含水率的「節奏」

椅匠工作不是一次做完，而是**配合木頭乾燥節奏分成幾個階段**：

| 階段 | MC | 工作 | 時間 |
|---|---|---|---|
| 砍樹 → 劈料 | 50–80% | 順紋劈 leg / rung 毛胚 | 同一天 |
| 削粗形 | 40–60% | drawknife 削 8 角型 | 砍後 1 週內 |
| 榫頭加工（要乾的部位） | 烘 / 放熱箱降到 6–8% | 削榫頭 + 等乾透 | 烘箱 2–3 天 |
| 榫眼加工（要保持濕的部位） | 維持 25–35% | 鑽 + reamer | 同削榫日 |
| 組裝 | 榫乾 / 眼濕 | 打榫、不上膠 | 一個下午 |
| 平衡 | 整椅都到 EMC（12–14%） | 自然乾燥 | 1–3 個月 |
| 修整 + 上漆 | EMC | 整形、milk paint | 完成 |

> Abbott《Living Wood》ch.5 提到他工作室用熱箱（hot box，60°C）把榫頭乾到 6%，榫眼端維持工作含水率，組裝後 6 週內收縮鎖死。

### 1.5 何時不該用 green wood

- **板狀寬料**（座板、面板）：寬度大，乾燥時開裂風險高 → 用乾燥料 + 雕鑿
- **貼皮 / 鑲嵌**：膠不黏濕木 → 全乾燥
- **接合穩定的乾木家具**（書桌、櫃子）：工法不對 → 用 KD 料
- **熱帶 / 高濕氣候**（含台灣中南部夏天）：乾燥節奏難控制，容易發霉長黑點
  - 台灣作法見 §9

---

## 2. Post-and-Rung 系統（梯背椅 ladderback）

> 主要出處：Jennie Alexander《Make a Chair from a Tree》3rd ed.（含 Galbert + Follansbee 補篇）；Langsner《Chairmaker's Workshop》part 2；Mike Abbott《Living Wood》ch.6–8。

### 2.1 為什麼叫 post-and-rung

最簡單的椅型：**4 根直立柱（post）+ 連接柱與柱的橫橕（rung）+ 椅背的橫條（slat）+ 編織的座面（rush / hickory bark / splint）**。

沒有座板（不挖型）、沒有 spindle、沒有彎曲——所以 **green woodworker 入門首選**。

| 部件 | 名稱 | 料徑 | 形狀 |
|---|---|---|---|
| 4 支立柱 | post | 30–40mm 徑 | 通常車成圓棒 / drawknife 削成 8 角 |
| 8–10 支橫橕 | rung | 18–25mm 徑 | 全圓棒，端部削榫頭 |
| 2–4 片椅背板 | slat | 厚 8–12mm × 寬 50–80mm | 蒸彎成弧 |
| 座面編織 | seat | rush / hickory bark / splint | 編織 |

### 2.2 收縮榫接的實作機制（核心技術）

這是 post-and-rung 的靈魂——**不上膠也永遠不鬆**。

**步驟**：

1. **柱子削好** → 含水率約 25–35%（從劈下來放幾天的狀態）
2. **rung（橫橕）削好** → 烘到 6–8% 完全乾透（用熱箱或暖氣機）
3. **柱子上鑽 mortise（榫眼）** → 用 5/8" 或 3/4" Forstner 鑽，深 25–32mm
4. **rung 兩端削榫頭** → 直徑比 mortise 大 0.5mm（**過盈配合**），用 tenon cutter 或 drawknife 削
5. **打入** → 用木槌打進榫眼
6. **等 1–4 週** → 整張椅子到平衡含水率（12–14%）

**會發生什麼？**
- rung 是已乾的料 → 含水率從 6–8% 升到 12–14%（吸濕） → **膨脹**
- post 是半濕的料 → 含水率從 25–35% 降到 12–14%（脫濕） → **收縮**
- 結果：榫頭脹 + 榫眼縮 → **雙向夾擠** → 拉拔強度遠高於上膠

> Lost Art Press 部落格 2021/8/18『Tighter Joints with Kiln-dried Wood』實測：dry-rung-wet-mortise 接合的拉拔強度約是同尺寸上膠 PVA 的 1.3–1.6 倍，且 50 年後仍緊（古董市場上 18 世紀 ladderback 椅榫接還緊）。

### 2.3 雙橕為何要錯開（offsetting）

椅子前後左右各有兩支橫橕（low + high），**它們的榫眼若鑽在同一柱、同一高度、同一深度**——榫眼會穿到對方，柱子變弱還可能斷。

**解法**：

1. **垂直錯開**：上 rung 高 200mm、下 rung 高 350mm 之類（這是視覺需求）
2. **深度錯開**：左右側 rung 鑽 30mm，前後側 rung 鑽 28mm（互不打到）
3. **角度錯開**：左右側鑽 90°、前後側鑽 88°（也避免穿透）

> Alexander 3rd ed. ch.7 圖解：兩個 5/8" Forstner 在 35mm 直徑柱上若同高，留下木壁不到 4mm，柱子在受力後幾年會順木紋裂。

### 2.4 為什麼不上膠

不是「不能上膠」，是**沒必要 + 維修友善**：

1. **沒必要**：收縮配合本身強度夠，膠加進去意義不大
2. **維修友善**：100 年後榫接鬆了，可以拆下來換 rung，不用整張椅子報銷
3. **容忍含水率變化**：四季濕度變動時，沒膠的接合會微微「呼吸」（鬆 0.1mm 又縮回去），上膠會逼著它在某個地方裂開

> Galbert 在 Alexander 3rd ed. 補篇講：『我做了 200 多張椅子，從沒上過膠。其中送修的 5 張，都是被人坐穿座面或從卡車摔下來，榫接點完好。』

### 2.5 為什麼用 octagonal 削（八角型）

post 不車圓而是削成 8 角型，原因：

1. **沒車床**：pole lathe 雖然能車，但 drawknife + shaving horse 削 8 角更快
2. **視覺**：純圓棒像工業品，8 角型有手作感、邊光反射有層次
3. **接編織座**：8 角型有平面，rush 編織不會打滑

**做法**：drawknife 把方料 → 切成 8 角（先切 4 角，每角再削成 2 個小角），shaving horse 夾住順紋削。

---

## 3. Windsor 椅體系（Galbert / Buchanan / Dunbar）

### 3.1 Windsor 系族譜

> 出處：Galbert《Chairmaker's Notebook》ch.1；Dunbar《Make a Windsor Chair》part 1；Buchanan plans。

「Windsor 椅」不是單一椅型，是**一整個家族**——共同特徵：座板厚（35–50mm）、腿從下面 splay 角度插入座板、椅背由很多細圓桿（spindle）組成、傳統上漆。

主要型式：

| 型式 | 椅背 | 扶手 | 難度 | 經典來源 |
|---|---|---|---|---|
| **Sack-back** | 蒸彎弧形 + 9 支 spindle | 蒸彎弧形扶手 | ★★★ | 18 世紀美國費城 |
| **Continuous arm** | 蒸彎成「一體」（從一邊扶手 → 椅背頂 → 另一邊扶手 是同一根料） | 同椅背 | ★★★★★ | 18 世紀紐約 |
| **Fan back** | 直背 + 14 支 spindle 扇形展開 + 頂端 crest 板 | 無扶手 | ★★★ | 賓州 |
| **Comb back** | 「梳子」狀頂板 + spindle 上端穿過頂板 | 有扶手 | ★★★★ | 新英格蘭 |
| **Hoop back / Bow back** | 蒸彎環狀 bow 從座板兩側上來 | 無扶手 | ★★ | 通用入門款 |
| **Low back / Captain's chair** | 矮椅背 + 扶手 | 一體 | ★★ | 船長椅 |

### 3.2 Splay 與 Rake——椅腳兩個傾角

Windsor 椅腳**從來不垂直**。每支腳同時有兩個角度：

- **Splay**（向側邊張開的角度）：前後腳通常 6–8°
- **Rake**（前後傾倒的角度）：前腳前傾 4–6°、後腳後傾 8–12°

這讓椅子穩定（重心在腳的圍成的四邊形之內 + 抗側翻）+ 美觀（不像直立椅腳那麼笨）。

> Galbert《Chairmaker's Notebook》ch.7：『前腳 6° splay + 4° rake、後腳 7° splay + 12° rake，是 18 世紀費城風格的標準。』

### 3.3 Sight Line + Resultant Angle（椅腳鑽孔的核心數學）

如果你直接告訴鑽孔機「splay 7° + rake 12°」，鑽孔機會問你：『**那我要對哪個方向斜 7°、哪個方向斜 12°？**』——這就是 sight line（瞄線）+ resultant angle（合成角）的問題。

**Galbert 的方法**：

1. **Sight line（瞄線）**：在座板下面畫一條線，當你從這條線正上方看下去時，那支腳「看起來」是垂直的——這就是瞄線方向。
2. **Resultant angle（合成角）**：沿著瞄線方向，那支腳實際傾斜的角度。

**公式（Galbert 推導）**：

```
tan(sight line angle) = tan(rake) / tan(splay)
tan(resultant angle) = sqrt(tan²(rake) + tan²(splay))
```

**舉例**（前腳：splay 6° + rake 4°）：
- sight line 角 = atan(tan(4°)/tan(6°)) = atan(0.070/0.105) = 33.6°
- resultant = atan(sqrt(0.0049+0.011)) = atan(0.126) = 7.2°

**實作**：
1. 座板鑽腳孔前，先在座板下面用鉛筆畫 4 條 sight line（每支腳一條）
2. 鑽孔時，**鑽頭對準 sight line 方向，傾斜 resultant angle**（用簡單的 sliding bevel 對好就行）
3. 這樣鑽出來的孔自動有正確的 splay + rake

> Galbert《Chairmaker's Notebook》Appendix A 提供完整 SketchUp / 紙張 layout 方法；Buchanan YouTube continuous-arm 系列第 4 集示範實做。
> Tim Manney 部落格 2017 把這套寫成 1 頁查表。

### 3.4 座板挖型（Saddle）

Windsor 座板是「**挖出來的人體工學椅墊**」——不是平的：

- **整體深度**：3/4"（約 19mm）—— 這是**最深點**
- **Hip relief**（屁股位置）：深 3/4"，寬約 200mm
- **Front edge**（前緣）：保留 12mm 厚（讓腳腳能掛上去）
- **Back ridge**（中後脊）：留高 + 漸消失到後緣
- **後傾角**：座面整體 5° 後傾（從座板厚度差實現，不從腿傾斜）

**做法**：
1. **粗挖**：scorp（彎曲鑿，雙手握把）+ adze（小手斧）
2. **中段挖**：travisher（曲面 spokeshave，專為挖座板設計）
3. **修光**：scraper + 砂紙 80→120

> Dunbar《Make a Windsor Chair》ch.4 圖解 saddle 等高線；Galbert YouTube 有 saddle carving 實做影片。

### 3.5 Tapered tenon（錐型榫）+ Reamer（錐型鉸刀）

Windsor 椅腳和座板的接合**不是直榫**，是**錐型榫**：

- 椅腳上端削成 **6° 錐型**（上細下粗的反錐，像 wine cork 倒過來）
- 座板對應位置用 **6° reamer（錐型鉸刀）擴出對應錐孔**
- 椅腳從**座板下方往上打入** → 椅腳愈塞愈緊（楔形自鎖）
- 座板上方榫頭再做縱向 wedge（楔木）切口 + 打入硬木楔，把榫頭撐開鎖死

**為什麼選 6°？**
- 太陡（>10°）→ 容易自己鬆出來（楔效不夠）
- 太緩（<5°）→ 打入要使盡力，且差一點點塞不到底就大空隙
- 6° 是**自鎖角**附近的甜蜜點

> Elia Bizzarri 部落格『6 vs 11 degree tapers』實測：6° 比 11° 容易做、容易塞、容易調整，現代椅匠 80% 用 6°。Lee Valley 賣的標準 reamer 是 12.8°（11° 系統的後代）。

**Tools**：
- Reamer：Tim Manney 手工 reamer NT$ 8,000–12,000；Lee Valley NT$ 2,500（12.8°）
- Tapered tenon cutter：Veritas / Lie-Nielsen NT$ 2,500–4,500，配 cordless drill 直接削

### 3.6 Spindle（椅背圓桿）的削法

Sack-back 椅背 9 支 spindle，從座板上孔到椅背 bow，**直徑漸縮**：
- 底部（插座板）：5/8"（16mm）
- 中段：1/2"（13mm）
- 頂端（插 bow）：3/8"（10mm）

**做法**：
1. 順紋劈 1" 方料 → drawknife 粗削成圓
2. shaving horse 夾住，spokeshave 修圓
3. 用 spindle gauge（直徑量規）測幾個關鍵點

**重點**：
- spindle 必須順木紋，**不能斜紋**（任何斜度都會大幅減弱）
- 木種一律 white oak 或 hickory（韌性 + 順紋劈得開）
- 14 支 fan back 全部要直徑一致 ±0.5mm，新手很難——Buchanan 建議用 spindle gauge 規格化

### 3.7 蒸彎 bow / arm 怎麼接到 spindle 上

Windsor 椅背 bow 是蒸彎的弧形料（細節在 §5），**它和 spindle 怎麼接？**

- bow 上鑽 spindle 對應位置的孔（鑽孔角度也用 sight line 算）
- spindle 上端削成圓榫頭（直徑 = 孔徑）
- 從**下往上**，整支 spindle 穿進 bow 孔
- 上方做 wedge 切口 + 楔木鎖死

對 continuous arm 椅，bow + arm 是同一根 4 米長料蒸彎成「Ω」形——這是 Windsor 椅的工法巔峰。

---

## 4. 椅匠專屬手工具

> 主要出處：Galbert《Chairmaker's Notebook》ch.2；Langsner《Chairmaker's Workshop》part 1；Abbott《Living Wood》ch.3。

這些工具家具木工幾乎用不到，但椅匠每天都用。和 hand_tools.md 互補。

### 4.1 Drawknife（削片刀 / 雙握把刀）

**用途**：把劈下來的方料快速削成 8 角棒、圓棒、漸縮 spindle。

- **規格**：刀刃 8–12"（200–300mm），雙端有把手
- **拉向自己用**（不是推），shaving horse 夾住料
- **兩種斜邊**：bevel-up（修光）vs bevel-down（粗削）——大部分椅匠用 bevel-down

> 入門推薦：Barr Specialty Tools（NT$ 8,000）、Lee Valley（NT$ 4,500）。古董 Pexto / Greenlee 二手（NT$ 1,500–3,000）也很好用。

### 4.2 Spokeshave（短刨 / 輻刀）

**用途**：drawknife 削粗後，用 spokeshave 修光面、做漸縮。

- **flat-bottom**：直線修光（spindle 修圓）
- **round-bottom / curved**：凹面修光（座板挖型內側、扶手內彎）

> 推薦：Veritas low-angle spokeshave（NT$ 3,500）、Lie-Nielsen Boggs spokeshave（NT$ 6,500，Brian Boggs 設計）。便宜選 Stanley 151 二手（NT$ 800）。

### 4.3 Travisher（座板曲面挖型刨）

**用途**：Windsor 座板 saddle 挖型專用。

- 像彎曲的 spokeshave，但底面是大半徑凹弧
- 從座板邊緣往中間刮，可以一刀挖 2mm 深

> 這是「**只有椅匠才買**」的工具。Tim Manney travisher（NT$ 12,000）、Dave's Shaves（NT$ 8,000）。台灣買不到，要從美國訂。

### 4.4 Scorp（粗挖鑿）

**用途**：座板初期粗挖，挖到 saddle 接近成型，再交給 travisher。

- 像把 inshave，圓弧刃口、單把手
- 像挖瓜瓤——重力、體重往下挖
- 比 travisher 快、比 adze 安全

### 4.5 Reamer（錐型鉸刀）

§3.5 提過，這裡補強：

- 手工 reamer：Tim Manney（NT$ 8,000–12,000，6° 標準）
- Cordless drill 用 reamer：直徑漸縮到 1.5"（38mm），手鑽 3 分鐘擴一個孔
- DIY：找一段直徑 25mm 的硬木車成 6° 錐，刨刀片裝在表面 → Galbert 自製版本

### 4.6 Tapered tenon cutter（錐型榫頭刨）

- 像放大版的削筆機
- 椅腳上端塞進去，drill 帶動 → 自動削出 6° 錐型榫頭
- Veritas（NT$ 2,500，1.5" 版）、Lie-Nielsen（NT$ 4,500，多尺寸）

### 4.7 Froe（劈刀）

**用途**：把砍下的原木順紋劈成方料。

- 像把 L 形的厚刀，刀刃 12–18"
- 配合木槌（commander / froe club）敲擊
- **順著髓線方向劈**——沒有 froe 就沒有 green woodworking

> 推薦：Barr / Gransfors Bruks（NT$ 5,500–8,000）。台灣鄉下廢鐵市場有時能找到日治時代的「鉈」可改造。

### 4.8 Shave horse（削馬 / 削椅）

**用途**：低姿勢工作台 + 腳踏式夾具。

- 騎跨式坐上去，腳踩前方踏板 → 槓桿夾緊夾頭 → 兩手用 drawknife 削
- 是椅匠工作 90% 時間用的工具
- 自製：4 小時 + NT$ 1,500 木料 + 一支 1" Forstner 鑽

> Boggs 在 Craftsmanship Magazine 訪談：『**shave horse 比 workbench 重要 10 倍**。第一張椅子之前先做一張 shave horse。』Langsner《Chairmaker's Workshop》末章有圖解尺寸。

### 4.9 Bow saw（弓鋸）

**用途**：曲線切割（bow blank、座板輪廓、扶手粗形）。

- 比帶鋸便宜、便攜、不用電
- 替刃式 12" 弓鋸（NT$ 2,000）
- 椅匠工作 80% 用 bow saw 取代帶鋸

### 4.10 Adze（小手斧 / 整型斧）

**用途**：座板粗挖、扶手整型、椅腳粗削。

- 像鋤頭縮小版
- 一手揮、一手扶料
- **危險工具**——swing 範圍前不能有腳趾

> 入門 Gransfors Bruks small adze NT$ 12,000。台灣鄉下農具店「小手斧」NT$ 600 可改造。

---

## 5. 蒸汽彎曲（Steam Bending）

> 主要出處：Lon Schleining《Wood Bending Made Simple》（Taunton, 2010）；《Complete Manual of Wood Bending》（Linden, 2002）；Galbert《Chairmaker's Notebook》ch.10；FineWoodworking.com 多篇實作。

### 5.1 蒸彎物理

水蒸氣（100°C）讓木材的 **lignin（木質素）暫時軟化**——lignin 是把細胞黏在一起的「天然膠」，常溫下硬，高溫高濕下變成熱塑性塑膠。蒸到內部到 100°C，料軟化 → 可以彎到 1:5 半徑而不斷。

冷卻後 lignin 重新固化，木料保持新形狀（**永久形變**）。

### 5.2 蒸箱基本規格

- **箱體**：DIY 用 PVC 6" 管 + 端蓋，或木箱襯鋁箔；長度比最長料多 30cm
- **蒸氣源**：電熱壺接矽膠管（家用 2L 壺夠）
- **溫度**：箱內必須 95–100°C（用烤箱溫度計確認）
- **木料離壺出口**：至少 30cm（避免熱水直噴）
- **木料間距**：不要堆疊，留空氣循環間隙

### 5.3 蒸的時間：「1 hour per inch」法則

> Schleining《Wood Bending Made Simple》ch.3 + 普遍引用的 Sterling 法則。

每 1" 厚度（25mm）蒸 1 小時。

| 厚度 | 蒸氣時間 |
|---|---|
| 1/4"（6mm） | 15–20 min |
| 1/2"（13mm） | 30 min |
| 3/4"（19mm） | 45 min |
| 1"（25mm） | 60 min |
| 1.5"（38mm） | 90 min |
| 2"（50mm） | 120 min |

**要點**：
- 蒸不夠 → 一彎就斷
- 蒸過頭 → 細胞壁過度水合，反而強度降，仍會斷
- 老師傅都直接看時間 + 厚度，不靠儀器

### 5.4 失敗率：30–50% 是「正常」

> Galbert + Schleining 都坦白：**新手蒸彎失敗率 50% 起跳，老師傅 10–20%**。

失敗模式（依出現頻率）：

| 模式 | 原因 | 應對 |
|---|---|---|
| **Tension face split**（拉伸面裂） | 表面纖維被拉斷 | **必加 compression strap**（鋼板背靠拉伸面） |
| **Compression buckle**（壓縮面起皺） | 蒸過頭、彎太急 | 縮短蒸氣時間 + 慢彎 |
| **Pith / 異常木紋裂** | 木料本身有缺陷（節、髓、reaction wood） | 嚴選料：sample test bend |
| **形未定型** | 卸 form 太早，木料回彈 | 在 form 上多停 24–48 小時 |
| **乾燥裂** | 卸 form 後乾太快 | 卸 form 後室溫慢慢乾 1–2 週 |

### 5.5 Compression Strap（壓縮帶）—— 必備不是選備

蒸彎時，料的「外側」（彎曲外圈）受拉伸、「內側」受壓縮。

**問題**：木材壓縮可達 30–50%（極限），拉伸只能 1–3%。意思是只要外側拉超過 3% 就斷。

**解法**：在外側貼一條鋼帶（compression strap），鋼帶兩端有止擋（end stop）— 木料不能拉長 → **強迫所有變形變成內側壓縮**。

- 鋼帶規格：1mm 厚 × 30–50mm 寬冷軋鋼，比料長 50mm 兩端各凸出
- 可用工地常見的 banding strap 改造，或買 chairmaker supply 賣的成品（NT$ 2,500–4,000）

> Galbert ch.10：『沒 compression strap 之前，我成功率 30%。裝上之後 70%。這是新手到老手的分水嶺。』

### 5.6 木種選擇——天差地遠

> Schleining 觀點：『**蒸彎只用白橡，其他都次選**。』

| 木種 | 蒸彎評等 | 最小彎曲半徑（料厚 1"） | 備註 |
|---|---|---|---|
| **White Oak**（白橡） | ★★★★★ | 5×（5") | 蒸彎之王，環孔 + 長纖維 |
| **Hickory**（山核桃） | ★★★★★ | 4× | 比白橡更韌，但料較難取得 |
| **White Ash**（白蠟木） | ★★★★ | 6× | 棒球棒木種，韌性夠 |
| **Black Walnut**（黑胡桃） | ★★★ | 8× | 顏色漂亮，但易拉裂 |
| **Red Oak**（紅橡） | ★★ | 10× | 不如白橡，環孔太空 |
| **Maple**（楓木） | ★★ | 12× | 散孔結構，蒸彎不友善 |
| **Cherry**（櫻桃） | ★★ | 12× | 同上 |
| **Pine / Cedar 軟木** | ★ | 不建議 | 軟木 lignin 化學不對 |

**台灣本土對應**（推估，沒實測數據）：
- **相思木**（Acacia confusa）：環孔、纖維長 → 推估蒸彎可行，類比白橡
- **白雞油 / 烏心石**：散孔但纖維細 → 推估可彎但半徑大，類比楓
- **龍眼木**：缺資料，不建議冒險
- **柳安**：散孔軟木，不蒸

### 5.7 Form（彎曲模具）設計

- 料蒸軟後**只有 90–120 秒**可以操作 → form 必須事先做好、所有夾具就位
- form 通常做成厚膠合板（25mm）疊 3 層，輪廓 = 想要的形狀**收縮量補償**
- 收縮量補償：板會回彈 5–8%，form 半徑要小於目標半徑 5–8%

> 我做過一支 sack-back bow（半徑 200mm 的 U 形），第一次失敗（form 沒做釋角，料卡死），第二次成功——**form 做兩個版本疊著測，一次彎到位**。

### 5.8 蒸彎完之後

1. 在 form 上**至少留 24 小時**（厚 1" 留 48 小時）
2. 卸 form 後，**用木夾或繩固定形狀繼續乾 1–2 週**（避免回彈）
3. 完全乾後（含水率到 EMC，2–4 週）才可以鑽孔、裝 spindle

---

## 6. 木種選擇對應（座板 / 腿 / Bow / 扶手）

> 主要出處：Galbert ch.4；Buchanan plans 木種說明；Elia Bizzarri《American Seat Woods》部落格；Northern Woodlands 雜誌『The Wood in Windsor Chairs』2006/Winter。

Windsor / 椅匠傳統的木種選擇是「**每個部位用最適合該功能的木**」——同一張椅子可能用 4–6 種不同木材。

### 6.1 標準對應表

| 部位 | 第一選擇 | 第二選擇 | 為什麼 |
|---|---|---|---|
| **座板**（plank） | Eastern white pine（白松） | Basswood（椴木）、Butternut（白胡桃，未上漆款） | 軟、易雕、輕、寬度大 |
| **椅腳**（leg） | White oak（白橡） | Hard maple、Hickory | 抗壓 + 抗扭 + 直紋好取 |
| **Spindle** | White oak | Hickory、Red oak | 韌、順紋劈得很細 |
| **Bow / Arm**（蒸彎件） | White oak | Hickory、White ash | 蒸彎成功率最高 |
| **Stretcher**（橫橕） | White oak | Hickory、Maple | 同腿 |
| **Crest**（fan back 頂板） | White oak、Walnut | Cherry | 平面 + 刻 + 不易劈 |

### 6.2 為什麼座板要用「軟木」

新手會以為「家具要硬木」，但 Windsor 座板**故意用軟松木**：

1. **挖型容易**：travisher 一刀挖 1.5mm，硬木根本挖不動
2. **吸震**：軟木有彈性，坐感好（硬木座板像石板）
3. **寬料容易取得**：白松可取 500mm 寬一片無節料，硬木難
4. **配色**：傳統都上 milk paint，軟木上色更均勻

> Bizzarri《American Seat Woods》：『butternut 是松木的「升級版」——一樣軟好挖，但顏色像櫻桃，**不上漆做透明木紋**也好看。』

### 6.3 為什麼腳要用「白橡」不能用紅橡

兩種橡木看起來像，但蒸彎時差很多：

| 項目 | White Oak（白橡） | Red Oak（紅橡） |
|---|---|---|
| 環孔結構 | 環孔有 tylose（堵塞物） | 環孔空 |
| 蒸彎 | ★★★★★ | ★★ |
| 防水 | 高（造船級） | 低（橫切吸水像吸管） |
| 硬度（Janka） | 1360 | 1290 |
| 顏色 | 灰褐 | 粉紅褐 |
| 椅腳 | 標配 | 勉強可用 |

**判斷快訊**：白橡端面看不到一條條黑線（tylose 把孔塞了），紅橡端面看得到放射狀的細紋線。

### 6.4 為什麼 spindle 不能用 maple 或 cherry

Maple、cherry **散孔結構** + 順紋劈不開——意思是你不能拿一根方料順紋劈成 8mm 細圓桿（會劈到中途斷）。spindle 要求**順紋劈下來**才有強度，所以只能用環孔的橡 / 山核桃 / 白蠟。

---

## 7. Windsor 上漆 —— Milk Paint 傳統

> 主要出處：Old Fashioned Milk Paint Co. 官方說明；Greg Pennington Windsor finishing guide；Anne of All Trades『Why Paint a Windsor Chair』；Real Milk Paint《Painting a Windsor Chair》。

### 7.1 為什麼 Windsor 椅幾乎都上漆？

歷史原因：

1. **每張 Windsor 椅用 6 種不同木材**——上漆藏色差，視覺一致
2. **座板是軟松、椅腳是白橡**——硬度懸殊、年齡膨脹率不同，上漆藏裂縫
3. **18 世紀美國農民買不起紅木**——上 milk paint 「假裝」是高級木
4. **戶外用** —— Windsor 早期常擺門廊，要上漆防曬防雨

### 7.2 Milk Paint 是什麼

**成分**：牛奶蛋白（casein）+ 石灰 + 黏土 + 鐵 / 礦物色粉。沒有溶劑、沒有 VOC、純天然。

- **粉狀販售**：使用前 1:1 加水調勻
- **乾燥快**：30 分鐘表乾，2 小時可上下一層
- **Matte 質感**：完全霧面，沒任何反光
- **覆蓋力低**：每層只能蓋一點點顏色 → 多層才會飽

> Old Fashioned Milk Paint Co.（美國）NT$ 1,200/磅（1 磅可漆 2 張椅子）；Real Milk Paint NT$ 1,500/磅。台灣可代購但運費貴，國內目前無正規進口。

### 7.3 傳統三層上色法

> 「**Green over Red over Black**」——18 世紀美國最常見的層次。

1. **底層：黑** —— 蓋住所有色差 + 木紋
2. **中層：紅**（鐵丹紅 / venetian red） —— 完整覆蓋黑色
3. **面層：綠**（forest green / 松綠） —— 完整覆蓋紅色
4. **使用磨損後**——綠面磨破 → 露出紅 → 再磨破 → 露出黑——三層自然 patina

每層 1.5–2 小時間隔，每層上完用 320 砂紙輕磨表面。

### 7.4 上完漆後的封閉

milk paint **單層不耐磨**——必須上 oil 或 varnish 封：

1. **亞麻仁油（BLO）**：最傳統，刷一層 → 等 30 分鐘 → 擦掉多餘 → 24 小時乾
2. **打蠟**：油乾後上 paste wax，用棕刷或羊毛輪打亮
3. **shellac**：要光澤感的話，2–3 層 dewaxed shellac 取代 BLO

> Pennington 觀點：『milk paint + BLO + paste wax = 100 年前的做法，今天還是最好的做法。氣味、質感、aging 都對。』

### 7.5 Aging（做舊）處理

Windsor 椅匠傳統做舊步驟：

1. 三層 milk paint 上完
2. 邊角、扶手、座板前緣**用砂紙磨破面層**——露出底下顏色
3. **稀薄 wash**（黑色 milk paint + 水 1:5）刷整椅 → 立刻擦掉 → 顏色卡進凹處
4. BLO + 蠟封

> 一張新做的 Windsor 椅，做舊處理後看起來像「100 年家傳老椅」——這是椅匠的標準交件規格。

---

## 8. 量產經濟 —— Brian Boggs 的 Way

> 出處：Craftsmanship Magazine『Brian Boggs, Master of the Chair』2018；FineWoodworking 訪談 2007。

### 8.1 Brian Boggs 是誰

Asheville（北卡羅萊納）椅匠，以**手工 ladderback** 量產聞名。

- 1980s 起做椅
- **第一個 300 張椅子完全沒插過電動工具**
- 後來引進 router 等機具但保留手工流程
- **現在每張椅 10 小時做完** —— 這是手工椅匠的「速度上限」

### 8.2 為什麼能做到 10 小時

不是「做得快」，是「**流程化 + 工具客製化**」：

1. **自製工具**：自己改的 spokeshave 重量、自己改的 shave horse 高度——每件動作浪費 1 秒，10 小時就少 100 件動作
2. **批次化**：一次劈 50 支腳的料、一次蒸 20 片 slat、一次鑽 30 個 mortise
3. **muscle memory**：同一動作做 5,000 次以上，不需要思考
4. **Jigs**：每個部位都有客製 jig（角度規、深度規、形狀規）——不需測量

### 8.3 椅匠定價邏輯

> Boggs 訪談：椅匠賣的不是椅子，是「**幾十年後孩子能繼承**」的家具。

成本拆解（單張 ladderback）：
- 材料：白橡 + hickory + rush 約 NT$ 2,500
- 工資：10 小時 × NT$ 800/h = NT$ 8,000
- 工具折舊：NT$ 500
- **直接成本**：約 NT$ 11,000
- **批發定價**（給經銷）：NT$ 22,000–25,000
- **零售定價**（直接賣客戶）：NT$ 35,000–55,000

Boggs 自家網站售價：USD $1,500–3,500 / 張（2024 年）= NT$ 47,000–110,000。

### 8.4 對木頭仁的啟示

> 拍 YouTube + 賣木工課的商業模式 vs 純椅匠：椅匠不能只賣椅子，**內容（教學、影片）才是規模化的部分**。

Boggs 後期主要收入：
- 短期工作坊（5 天 USD 1,800）
- 影片教學（USD 200/系列）
- 高階客製椅（少量、高單價）

**對木頭仁的對應**：
- 拍「green woodworking 介紹」系列（台灣木工 YouTube 沒人講）
- 木匠學院開「post-and-rung 椅週末班」（5 天，每人 NT$ 12,000，6 人為一班）
- 工具團購：drawknife、tenon cutter、reamer 從美國代理進口

---

## 9. 對台灣木工的啟發

### 9.1 為什麼這條路在台灣特別有意義

台灣家具木工現況（綜合 books_taiwan_local.md §1, §6, §8）：
- 主流是**乾燥料 + 桌鋸 + Domino** 工法（IKEA/北歐影響）
- 高端是**明式紅木 + 機具切+ 手工修** （受中國影響）
- **完全缺席：green woodworking 路線**

但台灣其實有**最適合這條路的條件**：

| 條件 | 台灣狀況 |
|---|---|
| 環孔 + 韌性硬木 | 相思木遍地都有（早期當薪炭木種） |
| 散孔細紋木 | 烏心石、龍眼、白雞油 |
| 軟木座板用料 | 紅檜（合法庫存）、台灣杉、肖楠 |
| 工具便宜 | 鄉下農具店「鉈」「小手斧」NT$ 600–1,500 |
| 氣候 | 缺點是濕，需要熱箱控制乾燥節奏 |

### 9.2 台灣 green woodworking 木種對應建議

⚠️ **以下是推估，沒人用台灣木種做過完整 Windsor / ladderback 的研究**——是「值得拍的實驗題材」。

| 部位 | 美國傳統用 | 台灣可試 | 為什麼 |
|---|---|---|---|
| **座板** | 白松 / butternut | **紅檜**（合法庫存）、**台灣杉**、**肖楠** | 都是軟木針葉、寬料容易取、香氣加分 |
| **椅腳 / spindle / 蒸彎件** | 白橡 / hickory | **相思木**（最有把握） | 環孔、長纖維、台灣量大 |
| **Bow / Arm**（蒸彎） | 白橡 | **相思木**或**白雞油** | 推估可行，但要實測 |
| **Crest / 平面雕件** | 黑胡桃 / 白橡 | **烏心石**、**龍眼木**、**台灣櫸** | 散孔細紋、雕刻好看 |
| **Slat（椅背板）** | 白橡薄片 | **相思木薄片** | 蒸彎用 |

### 9.3 含水率挑戰（台灣特有）

台灣**濕度全年 70–90%**，平衡含水率（EMC）約 13–16%——比美國 8–12% 高很多。

**問題**：post-and-rung 工法靠「rung 6% vs post 30%」的差距，但台灣 EMC 13–16% 意味著乾的 rung 放幾天就回到 13%，差距變小，鎖死力減弱。

**解法**：
1. **熱箱（hot box）必備**：60°C 連續 3–5 天才能把 rung 烘到 6%
2. **組裝後 7 天內整椅進熱箱**：把 post 也降到 12%——反過來操作（讓 post 收縮主導）
3. **完成後上 milk paint + BLO + wax**：封住榫接區，減少季節吸放濕的呼吸

### 9.4 木頭仁可拍的題材清單

排序：難度 + 觀眾興趣

1. **「砍下一棵相思樹做張椅子」**（5 集系列） —— 台灣沒人拍過 green woodworking
2. **「Windsor 椅 vs 明式椅 vs IKEA 椅 結構比較」** —— 跨流派對話
3. **「為什麼老師傅做椅子不上膠？」** —— post-and-rung 收縮原理
4. **「蒸汽彎曲 5 種失敗法」** —— 失敗紀錄比成功有趣
5. **「相思木做椅腳實驗」** —— 台灣木種的椅匠可能性
6. **「Windsor 椅腳 splay 角度怎麼算」** —— Galbert sight line 教學中文化
7. **「milk paint 傳統做舊」** —— 跟現代水性塗料對比

### 9.5 木匠學院課程 idea

| 課程 | 時長 | 單價 | 學員人數 | 目標毛利 |
|---|---|---|---|---|
| **Green woodworking 入門**（劈、削、shave horse 製作） | 2 天 | NT$ 6,800 | 6 人 | NT$ 30,000 |
| **Post-and-rung 椅製作週末班** | 3 天 | NT$ 12,800 | 4 人 | NT$ 35,000 |
| **Windsor sack-back 進階班** | 5 天 | NT$ 28,000 | 4 人 | NT$ 80,000 |
| **蒸汽彎曲工作坊** | 1 天 | NT$ 3,800 | 8 人 | NT$ 22,000 |

> 跟既有「機具操作班」「明式榫卯班」**互不重疊** —— 這是課程矩陣補完。

---

## 10. FAQ 速查

| 問題 | 章節 |
|---|---|
| Green wood 是什麼，為什麼椅匠用？ | §1.1, §1.2 |
| 為什麼 post-and-rung 不上膠？ | §2.2, §2.4 |
| Windsor 椅腳 splay / rake / sight line 怎麼算？ | §3.2, §3.3 |
| Tapered tenon 為什麼用 6°？ | §3.5 |
| 蒸彎要蒸多久？ | §5.3 |
| 蒸彎為什麼一定要 compression strap？ | §5.5 |
| 蒸彎用什麼木種最好？ | §5.6 |
| Windsor 座板為什麼用軟松不用硬木？ | §6.2 |
| White oak vs Red oak 椅腳差在哪？ | §6.3 |
| Milk paint 怎麼做傳統三層？ | §7.3 |
| 椅匠做一張椅多少時間多少錢？ | §8.2, §8.3 |
| 台灣相思木能做 Windsor 嗎？ | §9.2 |
| 台灣濕氣那麼高，post-and-rung 工法怎麼用？ | §9.3 |
| Drawknife / spokeshave / travisher 差在哪？ | §4.1, §4.2, §4.3 |
| Reamer 跟 tapered tenon cutter 哪裡買？ | §3.5, §4.5, §4.6 |
| Brian Boggs 怎麼 10 小時做一張椅子？ | §8.2 |
| 為什麼 spindle 不能用 maple？ | §6.4 |

---

## 11. 跨檔對應

- 「椅背榫為什麼是最容易壞的點」→ structure_strength.md §6.5 + §9.6（受力分析）+ 本檔 §3 §4（Windsor / post-and-rung 怎麼避免這問題：沒有椅背榫，只有 spindle 群和 wedged tenon）
- 「圈椅扶手怎麼接」→ books_chinese_classics.md §3.7（楔釘榫，明式做法）vs 本檔 §3.1（continuous arm 蒸彎一體做法）—— 完全不同思路
- 「現代椅 5° 後傾怎麼做」→ books_workshop_manuals.md §4.1（drawbored angled M&T）vs 本檔 §3.4（座板厚度差實現）
- 「白橡 vs 紅橡」→ wood_species.md §2.x + 本檔 §6.3（蒸彎差異）
- 「含水率動力學」→ books_english_classics.md §1（FSP 機制）+ 本檔 §1.3 §1.4（椅匠應用）
- 「磨刀」→ hand_tools.md §3 + books_japanese_techniques.md §2-3（基本功）→ 本檔椅匠工具自己另外處理（drawknife、travisher 不是日式系統）
- 「milk paint vs Osmo / 油性 PU」→ finishing.md（現代塗料）+ 本檔 §7（milk paint 傳統）
- 「木種韌性 / Janka」→ wood_species.md §6 + 本檔 §5.6 §6.1（蒸彎/部位對應表）
- 「為什麼台灣木工不做這個」→ books_taiwan_local.md §1（廟宇大木傳統重榫卯+紅木家具影響）+ 本檔 §9（台灣 green woodworking 缺口）
