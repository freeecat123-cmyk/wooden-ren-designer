# 英文木工經典深度補充

> 範圍：補上 Hoadley 木材科學、Schwarz 工具觀、Krenov 設計觀、Flexner 塗裝化學、Odate 日式工具——這些既有 9 份檔沒蓋到的「書級深度」。
>
> 引用書目（依重要性）：
> 1. R. Bruce Hoadley, *Understanding Wood*（2nd ed., 2000, Taunton）
> 2. R. Bruce Hoadley, *Identifying Wood*（1990, Taunton）
> 3. Christopher Schwarz, *The Anarchist's Tool Chest*（2011, rev. 2025, Lost Art Press）
> 4. Christopher Schwarz, *The Anarchist's Workbench*（2020, Lost Art Press, free PDF）
> 5. James Krenov, *A Cabinetmaker's Notebook*（1976）/ *The Impractical Cabinetmaker*（1984）
> 6. Toshio Odate, *Japanese Woodworking Tools: Their Tradition, Spirit and Use*（1984）
> 7. Bob Flexner, *Understanding Wood Finishing*（3rd rev. ed., 2021, Fox Chapel）
>
> 用法：跟既有檔互補。木材生物學細胞層級 → 來這份；台灣常見樹種數據 → `wood_species.md`。塗料化學機制 → 來這份；台灣管道與品牌 → `finishing.md`。

---

## 第 1 章 木材科學的 first principle（Hoadley）

`wood_species.md` 已寫了 FSP、徑切弦切收縮比、各樹種 Janka，但沒解釋**為什麼**。這一章是 Hoadley 的 first principle：細胞構造決定一切。

### 1.1 樹幹是中空管子的集合

Hoadley §2 開宗明義：**木材不是均質固體，是「細胞壁 + 細胞腔」的纖維束**。
- **細胞壁（cell wall）**：佔木材體積 28–60%，是真正承重的「材料」。主要由 cellulose（纖維素，約 45%）+ hemicellulose（半纖維素，約 25%）+ lignin（木質素，約 25%）組成。
- **細胞腔（cell lumen）**：中空，新鮮木材裡裝水，乾燥後裝空氣，貢獻木材的輕量但不承重。
- **微纖維（microfibril）**：纖維素分子鏈束在細胞壁裡呈螺旋排列，**和細胞長軸夾角 5–30°**。這個角度決定了縱向 vs 橫向收縮的差距（見 §1.4）。

> **為什麼這對木工有用**：你刨削、鋸切、上膠時面對的不是「木頭」，是「定向的纖維管束」。順紋 vs 橫紋強度差 10 倍以上、不是經驗法則，是細胞壁排列的直接結果。

### 1.2 軟木 vs 硬木：細胞構造完全不同

| 類別 | 主要細胞 | 比例 | 功能 |
|---|---|---|---|
| 軟木（針葉樹 / Softwood） | tracheid（管胞） | 90%+ | 同時負責輸水 + 機械支撐 |
| 硬木（闊葉樹 / Hardwood） | vessel（導管）+ fiber（纖維）+ parenchyma（薄壁細胞） | 各佔不同比例 | **分工**：導管輸水、纖維承重、薄壁儲存 |

**Hoadley §1.4 重點**：軟木構造比硬木簡單得多，因此辨識相對容易（用樹脂道、早晚材對比即可）；硬木因為導管/薄壁細胞的排列千變萬化，才有「ring porous（環孔）/ semi-ring porous（半環孔）/ diffuse porous（散孔）」的分類。

> 對應：`wood_species.md` 已有環孔/散孔的工程性描述（紋理、用途）。Hoadley 的價值是說清「為什麼環孔木會在春材爆出大導管」——因為環孔樹種（橡、白蠟、栗）春天水份需求暴增，每年只在生長季初期長一圈大導管，所以年輪一定看得很清楚；散孔樹種（楓、櫻桃、樺）整年導管大小一致，所以年輪要靠纖維色差才看得出來。

### 1.3 含水率動力學：自由水 vs 結合水

`wood_species.md §FSP` 已寫到「FSP 約 28%、低於 FSP 才會收縮」。Hoadley §4 解釋為什麼：

**水在木材裡有兩種存在形式：**

1. **自由水（free water）**：裝在細胞腔（lumen）裡，像水裝在試管裡。
   - 木材新鮮砍下時 MC 可能 60–200%（含水重 / 乾重），主要是自由水。
   - 自由水蒸發**只影響重量、不影響尺寸**——因為細胞腔本來就是空腔，水走了空腔還在。
2. **結合水（bound water）**：吸附在細胞壁的纖維素/半纖維素分子上，像水滲進海綿。
   - 結合水蒸發時，**細胞壁本身收縮**——這才會造成木材尺寸改變。

**纖維飽和點（FSP, Fiber Saturation Point）**：自由水全走完、結合水滿載的瞬間。**這個臨界點對絕大多數樹種約 28–30% MC**，不會差太多——因為它是細胞壁的物理上限，不是樹種特性（Hoadley §4.2）。

> **關鍵推論**：MC 60% → 28% 木材尺寸不變（只是變輕）；MC 28% → 12% 才會劇烈收縮。所以**乾燥窯的工作其實是把 MC 從 30% 降到 8–12%**，前面那段「下到 30%」隨便晾就行。
>
> 含水率計：如果讀到 28% 以上的數字，告訴你的不是「還要晾多久」，是「自由水走完之前都不會動」。你要的數字是 6–12% 之間（看你做的家具放在哪裡）。

### 1.4 為什麼弦切收縮是徑切的 2 倍

`wood_species.md` 已寫弦切橫向收縮 6–12%、徑切 3–5%（約 2:1）。Hoadley §3.5 解釋這個比例：

**三個原因（從強到弱）：**

1. **髓線（rays）約束徑向**：髓線是橫躺的薄壁細胞束，從髓心放射出去。徑向收縮時要壓縮髓線、髓線「撐住」木材，所以徑向收縮少。弦向收縮時跟髓線平行、沒人擋，所以弦向收縮多。**這是主因**。
2. **早晚材交替**：年輪上的早材（軟）+ 晚材（硬）在徑向是「夾心餅乾」式分層，硬層撐住軟層。弦向則是同一層延著切，沒有夾心效應。
3. **微纖維角差異**：S2 層微纖維和細胞長軸夾角約 5–30°，這個夾角越大、橫向收縮越大。橡木這類大髓線樹種徑向收縮小，輕木（balsa）這類髓線少的徑向收縮反而接近弦向。

> **設計慣例**：寬桌面用徑切（quarter-sawn）→ 收縮量直接砍半。`wood_species.md §徑切弦切` 已給應用建議，這裡補上「為什麼」。

**縱向（longitudinal）收縮**：正常木材 0.1–0.3%，幾乎可忽略。**例外**是 reaction wood（§1.6），縱向可達 2%——足以讓一塊 2 公尺的板自己彎掉。

### 1.5 異向收縮（dimensional change coefficient）

工程算法：**Δ尺寸 = 原尺寸 × 收縮係數 × ΔMC%**

- 收縮係數（C）= 從 FSP 乾到 0%（全乾）的總收縮率 ÷ FSP%（約 28）
- 弦向係數 Ct、徑向係數 Cr 不同樹種差很大

**幾個常見樹種（Hoadley §3 + USDA Wood Handbook）：**

| 樹種 | Cr（徑向 / per 1% MC change） | Ct（弦向） | 弦/徑比 |
|---|---|---|---|
| 紅橡 Red Oak | 0.00158 | 0.00369 | 2.3 |
| 白橡 White Oak | 0.00180 | 0.00365 | 2.0 |
| 硬楓 Hard Maple | 0.00165 | 0.00353 | 2.1 |
| 黑胡桃 Black Walnut | 0.00190 | 0.00274 | 1.4 |
| 櫻桃 Cherry | 0.00126 | 0.00248 | 2.0 |
| 桃花心 Mahogany (Honduran) | 0.00172 | 0.00238 | 1.4 |
| 柚木 Teak | 0.00100 | 0.00186 | 1.9 |
| 美西松 White Pine | 0.00071 | 0.00212 | 3.0 |

> 引用：Hoadley §3 + USDA FPL *Wood Handbook* Ch.3, Table 3-5。

**算例**：胡桃木弦切桌面 800 mm 寬，從台灣冬天 12% MC 到夏天 16% MC（差 4%）：
> Δ寬 = 800 × 0.00274 × 4 = **8.8 mm**

→ 設計時桌面側邊一定要留 ≥10 mm 的伸縮空間（slot 螺絲、伸縮鈕、不要四邊鎖死）。

### 1.6 反應木 / 應力木（Reaction Wood）

`repair_restoration.md` 提了「reaction wood 易翹」，沒展開。Hoadley §6 是這個主題的權威整理。

**形成原因**：樹被風吹斜、長在山坡上、樹幹彎曲時，樹會在受力側長「特殊木材」當支撐。

| 類型 | 樹種 | 位置 | 特徵 | 問題 |
|---|---|---|---|---|
| **壓縮材（Compression Wood）** | 軟木 | 樹幹**下側**（受壓側） | 年輪偏寬、晚材色深、髓心偏離 | 縱向收縮**正常的 10–20 倍**，會讓板自己彎成弓形；脆性破壞 |
| **拉伸材（Tension Wood）** | 硬木 | 樹幹**上側**（受拉側） | 表面顯絨毛狀、刨削起毛、髓心偏離 | 刨不平、上塗料吃色不均、加工時毛邊嚴重 |

**辨識訣竅（Hoadley + bowyersedge.com）：**
- 看端面：**髓心嚴重偏心**（一邊年輪寬、一邊窄）→ 八成有 reaction wood。
- 軟木壓縮材：晚材色帶**異常深紅、佔比超過 1/3**。
- 硬木拉伸材：刨完表面**永遠有絨毛**，砂磨到 320 號還是糊糊的。

**處理建議**：
- 大件結構件、桌面、椅腳——**直接淘汰**，連邊條都別用。
- 縱向收縮 1–2% 在 1 公尺料上 = 10–20 mm，無法靠加工修正。
- 木材店買料時看端面、別只看面材紋路。

### 1.7 應力釋放：為什麼粗料要靜置一週

`repair_restoration.md §536` 已建議「粗料 → 靜置 1 週 → 細刨」。Hoadley §5.4 解釋機制：

**樹在生長時，外側細胞被拉伸、內側被壓縮——整棵樹有「生長應力（growth stress）」**。砍下、鋸開的瞬間，這個平衡被打破，木材會慢慢釋放應力（彎、扭、開裂）。

**順序是關鍵：**
1. 粗鋸（rough cut）→ 應力部分釋放
2. **靜置 3–7 天**（讓木材在現場濕度下穩定）
3. 細刨到最終尺寸（再釋放就是小到可忽略）

如果省略中間靜置直接細刨到尺寸，那就是把「未來會發生的彎曲」凍結進你的成品裡——一個月後板才彎，那時已經組裝了。

> 對台灣的特殊情況：木材店進口料船運後 MC 通常 12–14%，但實際送到台中盆地夏天可能升到 16%。**買回來不要當天就開料**，至少在工作室放一週（讓 MC 跟你工作環境平衡）。這個「一週」不是迷信，是 Hoadley §4 的 EMC 平衡時間。

---

## 第 2 章 木材辨識（Hoadley *Identifying Wood*）

`wood_species.md` 列了 50+ 種台灣/進口樹種的特性，但**沒教你「拿到不知名木頭怎麼判斷是哪一種」**。Hoadley 的 *Identifying Wood* 是這個主題的標竿。

### 2.1 三步驟：Expose / Examine / Use

Hoadley §1 提出的辨識 SOP：

1. **Expose**：用銳利刀片**斜削端面**（不是鋸、不是砂紙），把端面切到平整光滑。鈍刀會把細胞壓扁糊掉。
2. **Examine**：用 **10× 放大鏡（jeweler's loupe）**看端面。手持式就好、不用顯微鏡。
3. **Use**：對照辨識 key（Hoadley 書末有完整的決策樹）。

> 為什麼端面（end grain）：木材的辨識特徵 90% 在端面——導管分布、髓線粗細、薄壁細胞排列、年輪過渡。看徑切/弦切面只能看到「紋理風格」，那個太主觀。

### 2.2 端面看的四個關鍵特徵

| 特徵 | 觀察什麼 | 可區分什麼 |
|---|---|---|
| **孔型（porosity）** | 環孔 / 半環孔 / 散孔 | 軟木 vs 硬木、再分硬木大類 |
| **髓線（rays）** | 大小、密度、是否肉眼可見 | 橡（粗大髓線、徑切起虎斑）vs 楓（細密髓線） |
| **薄壁細胞（parenchyma）** | 有無翼狀、帶狀、繞孔等模式 | 桃花心 vs 沙比利、柚木 vs 雞翅 |
| **年輪過渡** | 早晚材對比強弱 | 環孔（強對比）/ 散孔（弱對比） |

### 2.3 環孔 / 半環孔 / 散孔對照

| 類型 | 端面特徵 | 例 | 木工性質 |
|---|---|---|---|
| **環孔（ring porous）** | 春材一整圈大導管、夏材小導管 | 紅/白橡、白蠟、栗、榆、櫟、teak | 紋理鮮明、徑切弦切差很大、開孔木需 grain filler |
| **半環孔（semi-ring porous）** | 大導管漸減、不形成清晰圈 | 胡桃、櫻桃部分品種、butternut | 紋理柔和、好刨好染 |
| **散孔（diffuse porous）** | 導管大小一致、整片均勻分布 | 楓、樺、桃花心、楊、椴、azelia | 紋理細密、適合精細雕刻、染色易斑駁需先 sealer |

> 對照 `wood_species.md`：那邊是「樹種視角」，這邊是「拿到一塊木頭判斷類別」的視角。家具修復時遇到不明木材（古董、二手料）→ 用這個 key。

### 2.4 軟木辨識的快速 key

軟木辨識比硬木容易（只用樹脂道 + 早晚材即可）：

- **有樹脂道（resin canal）**：松、雲杉、落葉松、Douglas fir。割木屑會有松脂味。
- **無樹脂道**：杉、檜、扁柏、柳杉、紅木（redwood）。
- **早晚材對比強烈**（晚材一條條深色帶）：松、Douglas fir、落葉松。
- **早晚材對比弱**（接近均質）：杉、檜、扁柏、雲杉。

> 台灣常見軟木：紅檜（無樹脂道、淡香）、扁柏（無樹脂道、檜醇香較濃）、台灣杉（無樹脂道、淡）、進口松（有樹脂道、明顯松香）。

---

## 第 3 章 Schwarz 工具觀（*The Anarchist's Tool Chest*）

`hand_tools.md` 列了一堆台灣常見工具品牌和規格。Schwarz 的價值不在「列工具」，在**「為什麼你不需要更多」**——少而精的哲學。

### 3.1 核心命題：< 50 件工具能做出絕大多數家具

> "You can build almost anything with a kit of fewer than 50 high-quality tools."  
> —— *The Anarchist's Tool Chest*, Introduction

Schwarz 的論證（ch.1–2）：
- 工業時代之前，傳統櫥櫃師傅一輩子的工具箱就是這些。
- 工具行銷讓你以為「需要新型號才能做更好」——其實 1850 年的工具箱裡的東西，今天還是夠用。
- 「集合工具的人」不是「會做東西的人」。買新工具比練熟舊工具容易。

### 3.2 完整工具清單（依類別）

依 Lost Art Press blog 整理 + 2025 修訂版增刪：

#### 刨刀（Planes）
- **Jack plane（粗刨）** — Stanley #5 / Lie-Nielsen #5。第一支該買的刨。粗料整平、去厚度。
- **Jointer plane（直刨 / try plane）** — Stanley #7 / Lie-Nielsen #7。長刨、拼板邊處理。
- **Smooth plane（細刨）** — Stanley #4 / Lie-Nielsen #4 或木刨。最後一刀。
- **Block plane（小刨）** — Lie-Nielsen 60-1/2。倒角、修端面。
- **Plow plane（裂槽刨）** — Veritas Small Plow / 古董 Stanley #45。挖溝、做企口。
- **Rabbet/Shoulder plane** — 修榫頭肩部、做企口邊。
- **Router plane** — Veritas / Stanley #71。刨槽底、調平凹陷。

> 注意：Schwarz 2025 修訂版**拿掉了 cabinet scraper（刮刀）**，認為調好的細刨可取代。原版有、新版沒。

#### 鋸（Saws）
- **Dovetail saw（鳩尾鋸）** — Lie-Nielsen 帶 apple 木把、15+ ppi。
- **Carcase saw（細榫鋸 / 端面）** — 古董 Wheeler/Madden 14 ppi 橫切。
- **Tenon saw（榫鋸）** — Wenzloff & Sons 10 ppi rip 帶少量 fleam。
- **Crosscut panel saw** — 古董 Disston 8 ppi 橫切。
- **Rip panel saw** — 古董 Spear & Jackson 7 ppi 縱切。
- **Coping saw** — 鋸鳩尾廢料。
- **Flush-cut saw** — Veritas 黑塑膠把。修木釘、修暗榫。

> Schwarz 認為**手鋸品牌不重要、磨銳度才重要**——他用很多古董鋸是因為新鋸貴 5 倍但只好 5%。

#### 鑿（Chisels）
- **Bench chisel set**：1/4″, 1/2″, 3/4″（Lie-Nielsen A2 socket）+ 1-1/4″（Blue Spruce）。
- **Mortise chisel**：Ray Iles 1/4″ + 5/16″（其他尺寸他丟掉了）。
- **Fishtail chisel**：Blue Spruce（鳩尾死角用，奢侈品）。

> 「3 支磨利的鑿子勝過 24 支半鈍的」——他明確反對買 set。

#### 量測 / 劃線（Marking & Measuring）
- 6″ combination square（Starrett 或同等級 — 不要省這支）
- 24″ folding rule（傳統黃楊木）+ 12′ tape measure
- **Marking knife**（劃刀，比鉛筆精確 10 倍）
- Wooden winding sticks（檢翹曲）
- 36″ wooden straightedge
- Wooden try square 12″（自己做）
- Sliding bevel
- Dividers（2–4 副，不同尺寸劃鳩尾、間距）
- Trammel points（畫大圓）
- Cutting gauge + Panel gauge

#### 敲擊 / 緊固
- Chisel mallet（圓木槌）
- Cross-peen hammer（榔頭、修細件）
- 13–16 oz claw hammer（八角把）
- 8 oz claw hammer（圓把、修小件）
- Dead-blow mallet
- Nail sets / 螺絲起子組 / countersink
- 10″ brace（手動鑽）+ auger bits
- Hand drill（小型手動鑽）+ brad points
- Birdcage awl（劃孔）
- Dowel plate（自製木釘）

#### 磨刀
- 中砥（honing stone）+ 細砥（polishing stone）
- Strop（皮革條）
- 砂輪機（grinder, 慢速）
- 油壺（oil can）或噴霧器
- Burnisher（鋼棒，給 card scraper 用——但 2025 版可能拿掉了 scraper 整套）

#### 工作台周邊
- 工作台本身（→ 第 4 章）
- 鋸架（sawbenches）2 個
- Bench hook（鋸切擋板）
- End-grain shooting board + Long-grain shooting board
- Cork-backed sanding block
- Miter box（精修角度）

> **總計約 48–52 件**（依版本+你算法不同）。Schwarz 自己說「我不在乎你算 47 還 53，重點是它**不會超過 60**」。

### 3.3 新手最該先買的 10 件（Schwarz 視角下的 woodworker minimum）

如果你完全沒工具、預算有限，按 Schwarz 的邏輯（手工為主、台灣可得性 + 木頭仁學員程度）排序：

1. **6″ combination square**（Starrett 或同級，NT$ 1500 起）— 沒有這個別說精準。
2. **Marking knife**（劃刀）— 鉛筆永遠劃不出 0.2mm 線。
3. **Bench chisel 1/4″ + 1/2″ + 3/4″**（先 3 支不要買套）— Narex 入門可、長遠 Lie-Nielsen 或日式追入。
4. **Block plane**（Lie-Nielsen 60-1/2 或台灣可買到的 Stanley）— 用最多、修最多面。
5. **Dovetail saw**（日式 Z-Saw Dozuki 7寸 8寸都行；西式 Lie-Nielsen）。
6. **Crosscut + Rip panel saw**（粗料分料用，便宜的 Stanley Sharptooth + 一支古董磨利的縱切）。
7. **Cross-peen hammer + 木槌**。
8. **磨刀組**（中砥 1000 # + 細砥 6000 #）— 不會磨刀就什麼都不會。
9. **Sliding bevel + dividers**（劃鳩尾必備）。
10. **工作台**（自製 Roubo 或現有工作桌都行，重點是夠重、夠平）。

> 預算規劃：以上 10 件在台灣大約 NT$ 25,000–40,000 可以全包（部分用台灣製/日本入門款代替西式高階）。後面 40 件按需要補。

### 3.4 為什麼不需要 buying more（Schwarz 反工具陷阱）

Schwarz 在 ch.13 列了「拒絕買的工具」清單：
- **Power tools 進階款**：domino、track saw、router lift——他不反對機械，但反對「為了補手工弱項而買」。
- **多餘的鑿子**：超過 8 支已經沒意義。
- **特殊鳩尾鋸、燕尾鋸、各種角度榫鋸**：一支磨利的 dovetail saw 加一支 tenon saw 蓋掉 95% 工作。
- **彎曲刨、圓刨、各種曲面工具**：除非你做樂器或船，spokeshave + chisel 就夠。

> 對木頭仁招生課的啟發：教學員時與其給「全套工具表」讓他們花 NT$10萬買齊，不如先給 10 件清單、做半年、想擴充再加。學院購物清單可以套這個邏輯。

---

## 第 4 章 工作台哲學（Schwarz *The Anarchist's Workbench*）

`hand_tools.md §6.2` 已介紹 Roubo / English / Nicholson 三種台和高度公式。這一章補上**為什麼這樣設計**。

### 4.1 工作台高度的 pinky knuckle 公式

Schwarz 重新提出傳統公式：

> **站直、手臂自然垂下，從小指（pinky）下緣的指關節量到地板，這個距離 = 你的工作台高度。**

`hand_tools.md` 已寫到「手腕自然垂下時手掌中心到地板」——Schwarz 的版本更精確（小指下緣指關節，比手掌中心低約 2 cm）。

**為什麼這個高度？** 因為 Schwarz 的台是**為手刨設計**的。手刨刨削時，你要把上半身重量壓在刨上推進，太高 → 重量壓不下去；太低 → 你彎腰背痛。pinky 高度剛好讓上半身自然前傾、用體重而非肩膀施力。

> **修正建議**：木頭仁學員多做組合木工（手 + 機），如果以機械為主、手工為輔，台高可以加 5–10 cm（約到肚臍），更適合手工卡榫、組裝。純手工 then 用 pinky。

### 4.2 為什麼 holdfast 比 vise 強

Schwarz §3 反駁了「現代工作台必須有大 vise」的迷思：

| 工法 | Vise（虎鉗） | Holdfast（夾扣） |
|---|---|---|
| 安裝 | 鎖在台邊、固定位置 | 插進台面孔、隨處可用 |
| 夾持力 | 強但僅在虎鉗位置 | 強且**任何台面孔位** |
| 夾大件 | 受限於虎鉗開口 | 不受限 |
| 速度 | 旋鈕慢 | 一鎚搞定（< 1 秒） |
| 保留台面 | 占用台邊空間 | 用完拔出、台面全空 |

**holdfast 工作原理**：圓鋼棒插入台面孔（直徑略大於鋼棒），敲一下頂部、鋼棒輕微彎曲卡住孔壁、頂端壓住工件。釋放就敲側面、彈出。

> Schwarz 的台面布滿 holdfast 孔（網狀）——他主張「孔多到永遠有一個在你需要的位置」。這是 Roubo 設計的核心。

**Schwarz 的台只用 3 個工裝**（§4）：
1. **Leg vise**（腿虎鉗 / 法式）— 主要夾木板邊（鳩尾鋸切時）
2. **Planing stop**（刨削擋）— 鐵製有齒、頂端高出台面 3–5 mm，刨削時板靠在它前面、靠摩擦+齒固定
3. **Holdfast**（5–8 個孔分布）— 其他所有夾持

→ 沒有 tail vise（尾虎鉗）、沒有 wagon vise、沒有 quick release。Schwarz 認為這些都是工業時代的虛榮。

### 4.3 Roubo vs Nicholson vs English：怎麼選

| 特徵 | Roubo（法式） | Nicholson（美式） | English |
|---|---|---|---|
| 結構 | 厚實單塊台面（10–15 cm 厚）+ 厚腿 | 薄台面（5 cm）+ 圍裙加強 | 厚台面 + 抽屜櫃 |
| 重量 | 200–300 kg | 80–120 kg | 200+ kg |
| 適合 | 純手工、有空間 | 預算有限、空間小 | 混合工法、有儲物需求 |
| 台面 | 平面、無圍裙 | 有圍裙（apron） | 平面 |
| 木頭仁學員推薦 | 教室主桌 | 學員自製練習用 | 工作室商業使用 |

> Schwarz 自己選 Roubo。他在 *Anarchist's Workbench* 全書 100% 是 Roubo 教學（PDF 免費，開來看就懂）。

### 4.4 對台灣工作室的啟發

- **重量是關鍵**：台越重越好。台灣常見的合板工作桌 < 50 kg，刨削時整桌跳——刨個鬼。Roubo 的 200 kg 重量就是設計重點，靠重量吃住推進力。
- **基隆/北部潮濕**：台面用乾燥到 8% MC 的硬木（白橡、相思木、台灣櫸）整合，避免合板（吸濕變形）或松（太軟、planning stop 一壓就凹）。
- **預算版**：3 層 18mm 木芯板疊膠 + PU 漆封水做台面，預算 NT$ 3,000–5,000 起（`hand_tools.md` 已寫）。
- **要不要 leg vise**：台灣手工課程少，leg vise 鑄鐵組件難買、不如先用一般木工虎鉗（NT$ 1,500–3,000）。台面打 10 個 19 mm 孔、買 2 個 holdfast（NT$ 800–1,500/個），九成工件都能搞定。

---

## 第 5 章 Krenov 設計觀（材料對話 / 「讓木頭說話」）

Krenov 是 1970–2000 年代美國 fine woodworking 復興的精神領袖。他的設計觀和 Schwarz 的工具觀其實互補——Schwarz 講「夠用就好」，Krenov 講「為什麼做這件家具」。

### 5.1 中心命題：design follows material（材料先行）

> "Too many students get lost in their drawings and find themselves only able to think on paper."  
> —— Krenov, *A Cabinetmaker's Notebook*

Krenov 的設計流程是**反過來的**：

| 一般流程 | Krenov 流程 |
|---|---|
| 1. 想要做什麼（function） | 1. **找到一塊讓你激動的木頭** |
| 2. 畫圖 | 2. 把它放在工作室、看幾天/幾週 |
| 3. 選材料 | 3. **木材本身告訴你它想變什麼** |
| 4. 加工 | 4. 順著木紋、節疤、紋理特性設計 |
| 5. 完工 | 5. 加工時持續對話、調整設計 |

> 這對台灣木工有什麼意義？多數初學者（和我們的學院學員）習慣先決定「我要做一張椅子」、然後去買松、做出來。Krenov 的提醒是：先逛木材行、找到一片**你看到就停下來的板**（紋路漂亮、節疤位置特別、徑切虎斑出現）、再想這片木頭適合做什麼。

### 5.2 Wood Pairing（紋路配對）

Krenov 在 *Impractical Cabinetmaker* §3 講拼板選色配紋的原則：

1. **連續紋路（book-match）**：兩片相鄰板從同一根木頭剖開，翻開像翻書，紋路鏡像對稱。櫃門最常用。
2. **滑動紋路（slip-match）**：相鄰板紋路同方向延伸，連續感最強。長桌面用。
3. **節疤位置**：節疤要藏在邊角或會被擋住的地方，不要放在視覺中心（除非你**故意**用節疤做主題）。
4. **紋路走向 + 受力方向**：紋路要平行於主要受力方向，這是結構也是視覺——一塊家具看起來「強壯」一半靠紋路指向。

> 對木頭仁招生課：教學員選板時，這個觀念可以單獨開一堂課（材料學 + 設計初階）。比起「Janka 數值」，Krenov 的「紋路配對」更直接影響成品好不好看。

### 5.3 Krenov 風格手刨（Wooden Plane）

Krenov 親手做木刨，不用市售金屬刨。他在學校（CR Krenov School）教學生第一週就做自己的刨。

**規格（多方來源整理）：**

| 部位 | 尺寸/角度 |
|---|---|
| 刀床（bed）角度 | **55°**（為硬木交錯紋設計）→ 高難紋木材（如台灣牛樟、烏心石）刨削關鍵 |
| 喉部（throat）角度 | 同 55°（也可拉到 65° 配 45° 床） |
| 喉口（mouth）開口 | 0.2–0.5 mm（比 Stanley 細刨還細） |
| 整體長度 | 7–9 inch（180–230 mm，smoother 用） |
| Cross pin（橫銷）位置 | 距底面 32 mm（1-1/4″）— 關鍵低重心 |
| 板材厚度 | 兩側 cheek 10 mm、中心 70×70 mm |

**為什麼 55° vs Stanley 45°？**
- 45° 適合直紋軟木 / 中等硬木，省力、好推。
- 55° 適合**交錯紋硬木**（圖紋木、烏心石、相思、桃花心、橡），不會「跳鋸」掀起木屑。
- Krenov 的學派幾乎全做 55°，因為他們處理的是高級硬木家具。

**Cross pin 為什麼是 1-1/4″ 高（32 mm）？** 重心低，回饋好。台高的 jack plane 可能會 cross pin 高一點（拉刨力臂）。Krenov smoother 刻意做矮，**手刨削時感覺像「滑」過去**——這是他追求的觸感。

> 對台灣自製刨：Hock Tool（美國，可郵購）賣木刨組件（刀片 + cap iron + 圖紙），約 USD 50–80。配台灣硬木（櫸、相思、烏心石）做殼，總成本 NT$ 2,500–4,000，完成一支可用一輩子的木刨。

### 5.4 Krenov 對「機器 vs 手工」的態度

不像某些手工原教旨主義者，Krenov 並不反機器。他自己工作室有桌鋸、平刨、壓刨——他用機器做粗料、機器**省下的時間**用來做更精細的手工最後加工。

> Krenov: "The machine takes you to within 1/32 inch. The hand takes you the last 1/32."
>
> 機器把你帶到 1/32 inch（≈0.8 mm）誤差內，最後 1/32 是手的事。

→ 台灣多數木工學院的教學模式（先用桌鋸+平刨整料，再手工修最後）其實就是 Krenov 路線。但很多學員不理解「為什麼最後還要手刨」——他們覺得砂紙磨完就好。Krenov 的答案是：**砂紙會把木頭弄得「死」**（fibres 撕裂變糊），手刨會讓木頭表面**「活」**（fibres 切削乾淨、反光、有靈魂）。這也是為什麼高級家具不用砂紙、用 card scraper + 細刨完工。

---

## 第 6 章 塗裝化學（Flexner *Understanding Wood Finishing*）

`finishing.md` 已詳細介紹各種塗料的應用、台灣管道、SOP，但**沒講為什麼某些塗料失敗**。Flexner 的書是塗裝失敗診斷的權威來源。

### 6.1 塗料的三大類分法（Flexner ch.5）

Flexner 不按「油性/水性」分，按**乾燥/固化機制**分——這是理解失敗原因的關鍵。

| 類型 | 機制 | 例 | 特性 |
|---|---|---|---|
| **Evaporative（蒸發型）** | 樹脂溶於溶劑、溶劑揮發、樹脂留下 | 蟲膠、硝化纖維素漆（NC lacquer） | 可重塗（新層溶解舊層黏合）、易修復、抗刮抗熱差 |
| **Reactive（反應型）** | 樹脂與氧氣或催化劑反應、形成新化合物（cross-link） | 油（亞麻、桐）、油性 varnish、油性 PU、催化漆 | 不可重塗（化學交聯後新舊層不互溶）、極耐用、修復難 |
| **Coalescing（融合型）** | 水中乳膠粒子隨水蒸發靠在一起、表面張力擠壓融合 | 水性 PU、水性丙烯酸 | 介於兩者之間、大多無交聯（除非加 crosslinker） |

> **核心洞察**：「水性 PU」不是「真 PU」——它的固化機制和油性 PU 完全不同。油性 PU 是 reactive 交聯成網狀；水性 PU 多數是 coalescing（粒子靠攏），結果是耐用度差很多。

### 6.2 為什麼水性 PU 比油性 PU 弱

`finishing.md §5.4` 已有「水性 vs 油性 PU 對照表」、有提強度差異。Flexner 解釋為什麼（ch.16）：

1. **油性 PU**：樹脂在液態時就是長鏈聚合物，乾燥時與空氣中氧氣反應、鏈間 cross-link 形成緊密網狀結構。**結果**：分子間幾乎沒空隙、水/酒精/熱無法滲透、耐刮（要切斷化學鍵才會傷）。
2. **水性 PU**：樹脂以小顆粒（10–100 nm）懸浮於水。水蒸發時粒子靠攏、靠表面張力擠壓融合、部分形成弱氫鍵。**沒有真正的 cross-link**（除非加 crosslinker、多數家用產品沒有）。**結果**：粒子界面是弱點、酒精/熱可以擴散進去、耐刮差。

> **Flexner 的建議**：要表面硬度、抗刮、抗化學品 → 用油性 PU。要快乾、無 VOC、易清理 → 用水性 PU。**不要期待水性 PU 有油性 PU 的耐用度**——它就不是同一種東西。

**台灣常見水性 PU 失敗案例**（對應 `finishing.md §5.4`）：
- **白霧（blushing）**：太冷或太濕時水蒸發慢、粒子來不及融合，留下散粒結構 → 折射率變化呈白霧。
- **撕膜（peeling）**：底層含蠟（含蠟蟲膠、油類殘留）阻擋粒子接觸基材 → 整片剝落。
- **Alligatoring（鱷魚紋）**：表面先乾、底下沒乾，差異收縮 → 龜裂。

### 6.3 為什麼亞麻仁油會自燃

`safety_workshop.md §1` 和 `finishing.md §1` 都警告了亞麻仁油布自燃，但**沒解釋化學機制**。Flexner ch.6 + 化學課本：

亞麻仁油是「乾燥油（drying oil）」，主成分為**亞麻酸（α-linolenic acid，C18:3）**——脂肪酸鏈上有 3 個雙鍵。雙鍵是「不飽和」的弱點。

**反應鏈**：
1. 雙鍵 + 氧氣 → peroxide（過氧化物）
2. peroxide 分解 → 自由基（free radical）
3. 自由基攻擊另一個雙鍵 → 形成新 C-C 鍵
4. 鏈式反應持續、所有油分子交聯成網狀（這就是亞麻仁油「乾」的機制——其實是固化）
5. **這個反應放熱**，每個交聯反應釋放 60–80 kJ/mol。

**為什麼布堆會自燃？**
- 反應需要「氧氣 + 油 + 表面積」
- 揉成一團的布，內部布料有油但**散熱慢**（布是熱絕緣體）
- 反應熱量累積、溫度上升、反應速率上升（Arrhenius 定律）→ 正反饋
- 溫度到棉布燃點（120–250°C）→ 自燃

**桐油為什麼也會但風險較低**：桐油主成分為 α-eleostearic acid（C18:3 但雙鍵共軛排列），反應更快但放熱稍少；丹麥油、Tru-Oil 多含亞麻仁 + varnish，風險取決於亞麻仁佔比。

**為什麼 BLO（boiled linseed oil）反而比純亞麻仁油風險更高**：BLO 加了金屬乾燥劑（manganese / cobalt），加速氧化反應 → 放熱更快 → 自燃更易。**所以 BLO 油布比純亞麻仁油布還更危險**。

> 處置 SOP（Flexner + NFPA）：油布用完攤開（不揉團）→ 浸泡水 → 放金屬密閉容器（裝水）→ 隔天扔掉。**永遠不要揉團丟垃圾桶**。

### 6.4 蟲膠的 dewaxed 為什麼這麼重要

`finishing.md §6` 已介紹蟲膠基本用法。Flexner ch.10 解釋一個關鍵問題：**含蠟蟲膠 vs 脫蠟蟲膠**。

天然蟲膠（從紫膠介殼蟲分泌物精煉）含 5–6% 蠟。這個蠟讓蟲膠：
- 接觸潮濕時容易發白（白霧、blushing）
- **頂部塗料（特別是水性 PU）無法附著**——蠟層阻隔

**脫蠟蟲膠（dewaxed shellac）** 把蠟過濾掉，得到清澈樹脂。優勢：
- **任何上塗料都附著**：水性 PU、油性 PU、油、wax 都行
- 防水稍好
- 透明度更高、不發白

> Flexner 的萬能 sealer 公式：**任何不確定能上什麼的時候，先刷一層 1lb cut 脫蠟蟲膠當底**。這層幾乎和所有東西都相容，把舊底料（油、染色劑、未知殘膠）和新塗料隔開。

**台灣管道**（補 `finishing.md §6.5`）：
- Zinsser SealCoat（脫蠟蟲膠、2lb cut、即用）— 蝦皮約 NT$ 800/quart
- Zinsser Bullseye Shellac（含蠟 amber）— NT$ 600/quart
- 純蟲膠片（dewaxed flake）— 美亞馬遜 / 金石堂進口、NT$ 1,500/lb，自己泡酒精

### 6.5 桐油為什麼乾這麼慢

`finishing.md §4.2` 已提「純桐油 1 週/層、3 週才完全硬化」。Flexner ch.6 解釋：

桐油主成分 α-eleostearic acid（C18:3 共軛雙鍵）。共軛雙鍵反應動力學上其實**快**——但桐油含**抗氧化天然成分**（從種子萃取時帶出來），會抑制氧化反應的起始階段。

→ 結果：桐油表面乾得慢（要 24–72 小時）、內部硬化要 1–3 週。但一旦乾透，桐油的耐水性比 BLO 好（共軛雙鍵交聯更密）。

**「中國木油（China Wood Oil）」就是純桐油**——名字不同。台灣店家如果寫「中國木油」就是桐油（不是中國山寨）。

**市售陷阱**：
- "Tung Oil Finish"（如 Minwax、Formby's）= 桐油 + varnish + 溶劑稀釋的混合物（wiping varnish），**不是純桐油**。乾得快是因為加了 varnish，不是桐油本身。
- "100% Pure Tung Oil"（如 Hope's、Real Milk Paint）= 真純桐油。乾很慢、要等。

→ 木頭仁買油時看標籤主成分；想要快乾耐用 → 選 "Tung Oil Finish" 標籤的；想要食安純油 → 選 "100% Pure Tung Oil"。

---

## 第 7 章 日式手工具（Odate *Japanese Woodworking Tools*）

`hand_tools.md` 提到了 Z-Saw 等日系品牌，但沒系統化介紹日式工具的設計哲學。Odate 的書是英文圈唯一系統化整理。

### 7.1 鋸：拉切 vs 推切的根本差別

| | 西式鋸 | 日式鋸 |
|---|---|---|
| 切削方向 | 推（push） | 拉（pull） |
| 鋸身 | 厚（0.8–1.2 mm）防屈曲 | 薄（0.3–0.6 mm）省力 |
| 鋸路 | 寬（kerf 1.5–2.5 mm） | 窄（kerf 0.5–1.2 mm） |
| 鋸齒 | 較鈍角、 fewer ppi | 銳角、more ppi、impulse-hardened（不能修磨） |
| 適合 | 粗料分料、長距離切 | 精密榫接、薄板、卡榫 |

**Odate §3 的觀點**：拉切的物理本質是**鋸身在拉伸狀態下保持直線**——拉力會把薄鋸身拉直、不會屈曲。推切時鋸身被壓縮，必須做厚才不會彎；但厚鋸身就有寬鋸路、就費力。日式鋸用拉切繞過這個 trade-off，所以可以做超薄超精密。

> 對木頭仁學員：教鋸切時別只教動作（推 vs 拉），講物理為什麼——學員理解後就懂為什麼日式鋸特別適合鳩尾榫（鋸路窄 → 縫小 → 精度高）。

### 7.2 鉋（Kanna）：拉刨 vs 推刨

`hand_tools.md` 沒提日式鉋的拉切。Odate §5：

- 西式刨（Stanley、Lie-Nielsen、Krenov 木刨）：**推**（從你方向往外推）
- 日式鉋：**拉**（從遠端往你拉）

**為什麼差別？** 跟鋸一樣，物理。日式鉋鉋台（dai）短而薄、用拉力保持平整；西式刨厚實長身、用推力穩定。兩種都對——適應不同身體姿勢和文化（日式坐地工作 vs 歐式站立工作）。

**鉋台調整（dai conditioning）**：
- 日式鉋的鉋台不是平的，故意做成 3 點接觸（toe / 鉋口前 5 mm / heel），中間略凹（0.05–0.1 mm）
- 這個 3 點設計確保只有刀刃前後 5 mm 接觸工件、減少摩擦、增加切削穩定
- 西式金屬刨底面是全平的（理論上），實際上也常需研磨修正——但設計概念不同

> 木頭仁學員如果用日式鉋，**買回來不能直接用**，要先學鉋台調整（用刮鏟修出 3 點接觸）。這是日式工具的入門門檻。

### 7.3 鑿（Nomi）：ura（裏）+ uradashi（裏出し）

日式鑿子背面（ura）有**人為的凹（urasuki）**——故意不全磨平的設計。

**為什麼凹？**
1. **節省研磨時間**：背面只有刃口前 1–2 mm 的小帶子（itto-ura）需要平整磨亮，整個背面不用磨。
2. **保持鋒利**：薄帶（itto-ura）在反覆研磨中會變寬，需「uradashi（裏出し）」——用鎚子敲鑿頭背面、把硬鋼層（hagane）擠向刃口，恢復薄帶。
3. **層壓鋼結構**：日式鑿是「軟鐵（jigane）+ 硬鋼（hagane）」層壓，硬鋼只在刃口。uradashi 的物理是讓硬鋼前進、軟鐵後退。

**對比西式鑿**（單一鋼材、背面全平）：西式鑿磨一陣子要把整個背面磨平、費時；日式鑿只磨小帶子、省時但要會 uradashi 技術。

> 對台灣木工：日式鑿適合精細榫接（卡榫、鳩尾、燕尾），西式鑿適合粗木做工（鑿大眼、敲擊）。學員兩種都該各買 1–2 支體會差異。

### 7.4 職人精神（shokunin）

Odate 的書最後一章談 shokunin（職人）的精神：

> "The shokunin has a social obligation to work his/her best for the general welfare of the people. This obligation is both spiritual and material."  
> —— Odate, *Japanese Woodworking Tools*, ch.1

職人不是「工匠」——是有社會責任的手藝人。他做的家具不只是商品，是貢獻給社會的「正物」。

> 這個概念對木頭仁這種台灣木工 YouTuber 有特別意義——你不只是做木工，是把這個技藝傳承給觀眾。每做一件作品、教一個觀念，背後是對台灣木工生態的貢獻。

---

## 第 8 章 對台灣木工的啟發（書外的本地化整理）

這幾本書都是英美/日本背景。直接套用台灣有些會適用、有些要調整。下面整理「在地翻譯表」。

### 8.1 適用 / 部分適用 / 不適用

| 主題 | 直接適用 | 需調整 | 不適用 |
|---|---|---|---|
| Hoadley 木材科學 | 細胞構造、FSP、徑切弦切原理（物理通用） | 台灣樹種數據要查台灣林試所而非 USDA | — |
| Schwarz 工具觀（< 50 件） | 哲學、邏輯通用 | 台灣管道：Lie-Nielsen 等高階品牌進口貴 50%+；建議用台灣製/日本入門 | — |
| Schwarz 工作台（Roubo） | pinky 高度公式、holdfast 概念 | 台灣空間小、200 kg 台太佔位；多數工作室合板版即可 | — |
| Krenov 設計觀 | 通用 | 木材選擇要考慮台灣可得性（牛樟、烏心石、相思替代美式硬木） | — |
| Flexner 塗裝化學 | 化學機制通用 | 台灣濕度高（70–85%）→ 蟲膠/水性 PU 更易發白；需更長乾燥時間 | — |
| Odate 日式工具 | 完全適用（地理近、文化親） | 日本工具直購便宜（樂天/夢職人、運費考量） | — |

### 8.2 關鍵差異

**氣候**：
- 台灣全年濕度 65–85%、室內 EMC 通常 12–14%（北部）/ 11–13%（中部）/ 10–12%（南部）。
- 美國中西部冬天室內 EMC 可能跌到 6%、夏天 10%——年度 MC 變化 4%。
- 台灣 MC 變化只有 2–3%——**台灣家具實際 wood movement 比美國少 30%**。
- 但濕度絕對值高 → 塗料乾燥慢、蟲膠易白霧、油類乾燥劑反應慢。

**材料**：
- 台灣本土：紅檜（軟木、香）、台灣杉、相思木（硬木、本土）、台灣櫸（重硬木）、烏心石、牛樟、楠木。
- 美式經典樹種（紅橡、白橡、櫻桃、胡桃、楓）在台灣全是進口、貴 2–4 倍。
- Hoadley 講的「橡木徑切虎斑」在台灣可用「台灣櫸徑切」替代（紋路有些類似）。

**慣用工法**：
- 美式 Roubo + holdfast 文化在台灣幾乎不存在；多數工作室是合板桌 + 機械為主。
- 日式拉切、鉋台調整在台灣更有市場（地理 + 木頭仁這類 YouTuber 的影響）。
- 西式鳩尾榫在台灣高級訂製家具有市場，但量產家具還是袋形榫 + 木釘 + 商業 Domino。

### 8.3 給木頭仁學員的閱讀順序建議

如果學員問「哪本書值得學英文買原文」，按可消化度排序：

1. **Flexner *Understanding Wood Finishing***（最實用、塗裝失敗診斷必讀）
2. **Schwarz *Anarchist's Workbench***（PDF 免費、Lost Art Press 官網下載；做工作台之前看）
3. **Schwarz *Anarchist's Tool Chest***（買工具之前看、避免亂買）
4. **Krenov *A Cabinetmaker's Notebook***（哲學書、薄、好讀）
5. **Hoadley *Understanding Wood***（木材科學深度、要查公式時用）
6. **Odate *Japanese Woodworking Tools***（用日式工具時參考）
7. **Hoadley *Identifying Wood***（修古董/二手家具時用）

> 每本台灣可從 Amazon/Bookdepository/誠品進口，價格 NT$ 800–2,000。木匠學院圖書館可考慮各買 1 本當參考書。

---

## 第 9 章 跨檔對應索引

這份檔和既有 9 份檔的對應：

| 主題 | 本檔章節 | 配合檔 |
|---|---|---|
| 為什麼 FSP = 28% | §1.3 | `wood_species.md §FSP` |
| 弦切收縮 2× 徑切（深度） | §1.4 | `wood_species.md §徑切弦切`、`repair_restoration.md §145` |
| Reaction wood 辨識 | §1.6 | `repair_restoration.md §163`、`wood_species.md §619` |
| 應力釋放為何重要 | §1.7 | `repair_restoration.md §536` |
| 木材辨識（不知名木頭怎麼判斷） | §2 | `wood_species.md`（樹種視角） |
| 50 件清單 + 為何不需更多 | §3 | `hand_tools.md`（台灣品牌與管道） |
| Pinky 高度公式 | §4.1 | `hand_tools.md §6.2.1`（既有公式） |
| Holdfast vs vise | §4.2 | `hand_tools.md §6.2.2` |
| 材料先行設計 | §5.1 | `joinery.md` 不涵蓋（哲學層面） |
| Krenov 木刨 55° 床 | §5.3 | `hand_tools.md §刨刀` |
| 為什麼水性 PU 比油性弱 | §6.2 | `finishing.md §5.4` |
| 為什麼亞麻仁油自燃 | §6.3 | `safety_workshop.md §1`、`finishing.md §1` |
| 脫蠟蟲膠 vs 含蠟 | §6.4 | `finishing.md §6` |
| 桐油慢乾 + 市售陷阱 | §6.5 | `finishing.md §4.2` |
| 拉鋸 vs 推鋸物理 | §7.1 | `hand_tools.md §鋸` |
| 日式鑿 ura/uradashi | §7.3 | `hand_tools.md §鑿` |

## 第 10 章 來源

### 主要書目
1. **Hoadley, R. Bruce.** *Understanding Wood: A Craftsman's Guide to Wood Technology* (2nd ed.). Taunton Press, 2000. — 木材科學標竿。第 1 章引用最多。
2. **Hoadley, R. Bruce.** *Identifying Wood: Accurate Results with Simple Tools.* Taunton Press, 1990. — 第 2 章主要引用。
3. **Schwarz, Christopher.** *The Anarchist's Tool Chest* (Revised Edition). Lost Art Press, 2025 (orig. 2011). — 第 3 章。
4. **Schwarz, Christopher.** *The Anarchist's Workbench.* Lost Art Press, 2020. PDF 免費 https://lostartpress.com — 第 4 章。
5. **Krenov, James.** *A Cabinetmaker's Notebook.* Van Nostrand Reinhold, 1976. — 第 5 章。
6. **Krenov, James.** *The Impractical Cabinetmaker: Krenov on Composing, Making, and Detailing.* Linden Pub, 1984. — 第 5 章。
7. **Odate, Toshio.** *Japanese Woodworking Tools: Their Tradition, Spirit and Use.* Linden Pub, 1984 (rev. 1998). — 第 7 章。
8. **Flexner, Bob.** *Understanding Wood Finishing: How to Select and Apply the Right Finish* (3rd Revised Edition). Fox Chapel Publishing, 2021. — 第 6 章。

### 補充資料來源
- USDA Forest Products Laboratory, *Wood Handbook* (2010), Ch.3 Physical Properties — §1.5 收縮係數表
- Lost Art Press blog（lostartpress.com/blog）— Schwarz 工具清單細節（2016, 2025 系列）
- Krenov Foundation（thekrenovfoundation.org）— Krenov 刨刀規格
- The Wood Database（wood-database.com）— 硬木解剖補充
- bowyersedge.com — Reaction wood 辨識
- WoodBin Shrinkulator（woodbin.com/calcs/shrinkulator/）— 收縮係數計算器

### 不確定 / 需查證
- 第 §1.5 收縮係數表的具體數值是 USDA Wood Handbook + Hoadley §3 整理，**個別樹種數值可能在不同版本有微調**——查證以最新版 Wood Handbook 為準。
- 第 §3.2 工具清單以 2025 修訂版為主，但部分品牌型號可能已停產（如某些 Wenzloff & Sons 鋸 2020 後停售）。
- 第 §5.3 Krenov 刨規格綜合多份資料、原書未列詳細數據——以「典型 Krenov-style」為準，個別作者實作會略不同。
