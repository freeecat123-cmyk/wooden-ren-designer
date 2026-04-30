# 車旋木工經典深度（Woodturning）

> 範圍：補上 14 份既有檔幾乎沒寫的「車旋木工」整套知識——機台、刀具系統、主軸/端面車旋技法、木盒、食器塗裝、安全 SOP、木材處理。
>
> 引用書目（依重要性）：
> 1. Richard Raffan, *Turning Wood with Richard Raffan*（4th ed., 2008, Taunton）
> 2. Richard Raffan, *Turning Bowls*（2002, Taunton）
> 3. Richard Raffan, *Turning Boxes*（2002, Taunton）
> 4. Mike Mahoney, *Bowl Basics*（DVD/booklet, 2005, Bowlmakerinc）
> 5. Cindy Drozda, *Fabulous Finial Box*（DVD, 2008）+ Drozda 在 *American Woodturner* 期刊的多篇技法文
> 6. Mark Baker, *Woodturning Tools, Techniques & Projects*（2007, GMC）
> 7. Keith Rowley, *Woodturning: A Foundation Course*（3rd ed., 2008, GMC）
> 8. 大畑正裕《木工旋盤の基礎》（2018, 誠文堂新光社）
> 9. 木工旋盤テクニックシリーズ（《ろくろを楽しむ》系列, 木工誌集成）
> 10. Patrick Spielman, *Wood Lathe Projects for Fun & Profit*（1995, Sterling）
> 11. AAW（American Association of Woodturners）安全與技法規範
>
> 用法：跟既有檔互補：
> - 機台一般 PPE → `safety_workshop.md`；車床特有的 PPE/catch 防範 → 來這份 §7
> - 食器塗裝化學原理 → `finishing.md` ch.9；車旋木碗的特定塗料工序 → 來這份 §6
> - 木材含水率原理 → `books_english_classics.md` ch.1；green wood vs dry wood 對車旋的選擇 → 來這份 §8
> - 機台選購邏輯 → `machinery.md` 寫了桌鋸、帶鋸等；車床選購完全沒寫 → 來這份 §1

---

## 第 1 章 車床機台選擇

`machinery.md` 提到車床只在 PPE 段落（§594、§599）和台灣機台廠商（§621 湧東）兩三筆，沒有獨立章節。這一章補完。

### 1.1 三種尺寸層級：mini / midi / full-size

> 來源：Raffan《Turning Wood》ch.1 + Rowley《Foundation Course》ch.1 + 木工誌集成《木工旋盤の基礎》第 1 章。

| 層級 | swing（最大旋徑） | 床距 | 馬達 | 重量 | 適合 |
|---|---|---|---|---|---|
| Mini lathe | 250–300 mm（10–12"） | 350–500 mm | 1/3–1/2 HP | 30–50 kg | 筷筒、陀螺、筆、小燭台、入門 |
| Midi lathe | 300–400 mm（12–16"） | 500–900 mm | 3/4–1 HP | 60–100 kg | 桌腳、中型木碗、中階主力 |
| Full-size | 450–600 mm+（18–24"+） | 900–1500 mm+ | 1.5–3 HP | 150–400 kg | 大碗、大盆、桌腳量產 |

**Raffan 的觀點（《Turning Wood》ch.1）**：
- 寧可買「小一號但鑄鐵足夠重的機台」，不要買「大尺寸但機身輕、共振嚴重」的便宜貨。
- 共振是車旋的隱形殺手——尤其旋大件偏心料時，輕機台會震到刀具被彈飛。
- 入門優先 midi，因為主軸車旋（桌腳、燭台）能做、小到中型木碗也能做，性價比最高。

> **台灣現況**：mini lathe 蝦皮台製品 NT$ 8,000–15,000、Jet/Rikon 等中階 midi NT$ 35,000–60,000、Powermatic/Oneway 等全尺寸進口 NT$ 150,000+。湧東有出本土車床但偏製材用途。木匠學院如果開車旋課，midi 是首選。

### 1.2 變速：機械變速 vs 電子變速（VFD / DC）

> 來源：Mark Baker《Tools, Techniques & Projects》ch.2。

| 變速方式 | 原理 | 優點 | 缺點 |
|---|---|---|---|
| Step pulley（皮帶階） | 手動換皮帶位置 | 便宜、扭力穩定 | 換速度要停機開蓋 |
| Reeves drive（無段機械） | 可變徑滑輪手輪調整 | 不停機調速 | 低速扭力會掉、磨損件多 |
| VFD（變頻器 + AC 馬達） | 電子調頻 | 不停機、低速扭力保持好 | 貴、要 220V |
| DC 馬達 + 電子調速 | 直流變速 | 反應快、低速可用 | 高負載易過熱 |

**車旋常用轉速範圍（Raffan《Turning Wood》ch.1 表 1-2）**：

| 旋徑 | 主軸車旋 | 端面車旋（粗車） | 端面車旋（精修） |
|---|---|---|---|
| 50 mm 以下 | 2500–4000 rpm | — | — |
| 100 mm | 1500–2500 rpm | 800–1200 rpm | 1500–2000 rpm |
| 200 mm | 1000–1500 rpm | 600–900 rpm | 1000–1400 rpm |
| 300 mm | 700–1000 rpm | 400–700 rpm | 700–1000 rpm |
| 400 mm 以上 | 500–800 rpm | 300–500 rpm | 500–800 rpm |

> **Rowley 的安全公式（《Foundation Course》ch.3）**：旋徑（吋）× rpm ≤ 6,000–9,000。例如 12 吋木碗 rpm 上限約 750。新手寧可慢、不要快。

### 1.3 頂針（centers）系統

> 來源：Raffan《Turning Wood》ch.2 + 大畑正裕《木工旋盤の基礎》ch.2。

- **Drive center / spur center（主動頂針，主軸端 / headstock）**：4 爪或 2 爪刺入木料、靠摩擦帶動旋轉。spindle turning 起手用。
- **Live center（從動頂針，尾座端 / tailstock）**：旋轉軸承式（不再是死頂針），跟料一起轉、不會燒木頭。**1970 年代之後新車床都是 live center**，只有古早 dead center 才需要塗蠟潤滑。
- **Cup center**：杯狀面包覆木料端、適合不規則形狀的料。
- **Steb center / safety drive**：環形齒 + 中央彈簧頂針，碰到 catch 會打滑，比 spur center 安全（適合教學、新手）。

**Morse Taper（莫氏錐度）**：頂針裝在主軸與尾座的標準錐度——
- mini lathe 多半 MT1
- midi 多半 MT2
- full-size 多半 MT2 或 MT3

> 買新工具前先量自家車床主軸/尾座是哪一號，不然頂針裝不上去。

### 1.4 夾頭（chuck）系統

> 來源：Raffan《Turning Bowls》ch.3 + Mahoney *Bowl Basics* §1 + Drozda 多篇期刊文章。

**車旋的真正擴充性來自 chuck**，不是車床本身。一個四爪自定心夾頭（4-jaw scroll chuck，例：Oneway Stronghold、Vicmarc VM100、Nova G3、Record SC4）+ 各式 jaws 幾乎能搞定 90% 的端面車旋。

**主要 chuck 種類**：

| 名稱 | 用法 | 典型場合 |
|---|---|---|
| 4-jaw scroll chuck | 一鍵自定心、可換 jaw 對應不同尺寸 | 主力夾持，木碗 / 木盒 |
| Faceplate（面板） | 大螺絲鎖在木料端面 | 大碗、大盆、blank 不規則時 |
| Screw chuck | 中央一根粗螺絲 | 小碗 / 木盒 blank 起手 |
| Cole jaws（蝴蝶爪） | 大圓盤上 8 個橡膠頭抓碗外側 | 翻面修碗底（不留 tenon 痕） |
| Jumbo jaws | 同 Cole jaws 但更大 | 大碗外抓 |
| Pin jaws / spigot jaws | 抓內凹榫頭（spigot） | 木盒 lid、深碗 |

**tenon vs recess（兩種抓料策略）**：
- **Tenon（凸榫）**：在木料底端車一段直徑符合 jaws 的圓柱，jaws 從外往內咬。**最常用**，碗底完成後用 cole jaws 翻面再修掉。
- **Recess（凹榫）**：在木料底端車一個圓凹槽，jaws 從內往外撐。**節省木料**但要求底厚足夠（≥ 8 mm），否則撐爆。

> Raffan《Turning Bowls》ch.3 推薦：碗底厚度足夠（軟木≥15 mm、硬木≥10 mm）就用 recess、底太薄就用 tenon。Mahoney 個人偏好 tenon——「翻面修底時可以順便決定碗底美感」。

### 1.5 對台灣的買機建議

- **入門**：蝦皮 mini lathe（NT$ 10,000 以下）+ 一支 Robert Sorby 或 Hamlet 的 spindle gouge + skew 試水溫。不滿意再升級。
- **中階主力**：Jet JWL-1221VS / Rikon 70-220VSR / Laguna Revo 12|16，都是 NT$ 40,000–60,000 等級的好 midi，台灣 woodking、奇益等代理偶爾進。
- **大型**：Powermatic 3520C、Oneway 1640、Robust American Beauty——都要 NT$ 200,000+，且建議從美國代購（台灣代理稀少）。
- **chuck 預算**：機台預算的 30%。Oneway Stronghold 約 NT$ 12,000、Vicmarc VM100 約 NT$ 10,000、Nova G3 套組約 NT$ 6,000–8,000。

---

## 第 2 章 刀具系統與磨刀角度

`hand_tools.md` 寫過鋸/鑿/刨/磨刀，但車旋刀完全沒寫。這一章是車旋專用刀具的完整介紹。

### 2.1 六大基本刀具

> 來源：Raffan《Turning Wood》ch.3 + Rowley《Foundation Course》ch.4 + Mark Baker《Tools, Techniques & Projects》ch.3。

| 刀名 | 英文 | 形狀 | 主要用途 | 磨刀角度（典型） |
|---|---|---|---|---|
| 粗車刀 | Roughing gouge | 半圓深槽、刃口直 | 主軸車旋起手把方料車成圓 | 45° |
| 主軸鑿刀 | Spindle gouge | 淺 U 形槽、fingernail 形刃 | 主軸的 bead / cove 細修 | 30–35° |
| 木碗鑿刀 | Bowl gouge | 深 U 或 V 槽、fingernail 形 | 端面車旋的主力 | 40–60°（依 grind） |
| 切斷刀 | Parting tool | 窄長條、刃口直 | 切斷、修肩、量直徑 | 30°（兩面對稱） |
| 斜刃刀 | Skew chisel | 矩形截面、刃口斜 30° | 主軸的精修、平面、bead | 30°（單斜或對稱斜） |
| 刮刀 | Scraper | 厚扁、刃口平或弧 | 修內壁、tear-out 修補 | 70–80°（負角刃） |

**新手最少裝備（Rowley ch.4 推薦）**：
1. 19 mm（3/4"）roughing gouge
2. 10 mm（3/8"）spindle gouge
3. 3 mm parting tool
4. 25 mm（1"）skew chisel
5. 10 mm（3/8"）bowl gouge

> 木匠學院如果開車旋入門課，這 5 支 + 一支 round-nose scraper 就夠教完整門。

### 2.2 Bowl gouge 的三種 grind（磨型）

> 來源：Raffan《Turning Bowls》ch.5 + Mahoney *Bowl Basics* §3。

bowl gouge 不是一種磨型——是「同一支刀在不同 grind 下變不同工具」。三種主流：

| Grind | 角度 | 翼（wing）長度 | 用途 |
|---|---|---|---|
| Traditional / English grind | 40–45° | 短或無 | 大量去料、外側粗車 |
| Irish grind / fingernail（Ellsworth） | 55–65° | 長翼 | 內外通用、shear cut、最萬用 |
| Bottom feeder | 70–80° | 中等 | 碗底深處（碗深的最後 cut） |

**Ellsworth grind 為什麼萬用**：David Ellsworth 1980 年代推廣的長翼 fingernail grind 把刃口從刀尖延伸到兩翼，**翼上的刃口可以做 shear cut（剪切）**——切出來的表面比 traditional grind 光滑很多，幾乎不需要砂磨。Raffan 跟 Mahoney 都採這套。

### 2.3 磨刀治具：Wolverine jig

> 來源：Mark Baker ch.3 + AAW *American Woodturner* 雜誌多期。

Oneway Wolverine jig 是車旋圈最普及的磨刀治具系統，**幾乎所有英語車旋教學都假設你有一套**。

**主要組件**：
- **V-arm（V 型臂）**：放 spindle gouge / skew / parting tool
- **Vari-Grind（變角度爪）**：磨 bowl gouge 的 fingernail / Ellsworth grind
- **Skew jig**：磨 skew 的 30° 斜刃

**砂輪選擇（Baker ch.3）**：
- 8 吋慢速砂輪機（1750 rpm，不是高速 3450 rpm 那種）
- 白色氧化鋁（white aluminum oxide）砂輪、#80 粗 + #120 細
- CBN 砂輪（立方氮化硼）—— 不發燙、不起溝，現代主流，但一片 NT$ 8,000+

**為什麼不能用乾式砂輪機磨**：高速乾砂輪 3450 rpm 會把 HSS 燒到回火（藍化），刃口立刻失硬。慢速 1750 rpm + 散熱手法（每 5 秒抬起檢查、不沾水反而比較好）才不會燒刃。

### 2.4 HSS vs 碳鋼 vs 粉末冶金

> 來源：Raffan《Turning Wood》ch.3 + Robert Sorby / Crown 廠商規格。

| 鋼材 | 硬度 | 保持力 | 價位 | 場合 |
|---|---|---|---|---|
| 高碳鋼（Carbon Steel） | HRC 60+ | 短 | 便宜 | 古董刀、入門便宜貨 |
| HSS（M2 高速鋼） | HRC 62 | 中 | 中 | **絕大多數現代車旋刀** |
| HSS-PM / 粉末冶金 | HRC 64+ | 長 | 貴 | Crown PM、Sorby ProEdge 高階 |
| 鎢鋼刀片（碳化鎢） | 極高 | 不需磨 | 貴（耗材） | Easy Wood Tools 系列 |

**Easy Wood Tools 的位置**：碳化鎢刀片可換式車刀，「不用磨刀」。Raffan 跟傳統派批評它「車不出 shear cut 的細緻表面、刃口角度固定靠刮」。**但對純做粗胚、或量產木碗賣場貨**，效率非常高。木頭仁開教學課時碳化鎢刀比較不會教壞學生，但專業細工還是要傳統 gouge。

---

## 第 3 章 主軸車旋（Spindle Turning）

> 「主軸」（spindle）= 木紋平行於車床中心軸——即 endgrain along the bed。所有桌腳、燭台、棒狀件都屬於這類。
>
> 來源：Raffan《Turning Wood》ch.4–6 + Rowley《Foundation Course》ch.5–6。

### 3.1 起手 SOP：方料 → 圓料

1. **找中心**：兩端用對角線交叉法找出中心、刺一個小孔。
2. **裝料**：drive center 端用木槌敲入 1–2 mm 深、tailstock 推入 live center 鎖緊。
3. **檢查 swing**：手轉一圈確認料不撞 bed 或 tool rest。
4. **設 tool rest**：距料表面 6–10 mm（1/4"–3/8"）、高度跟料中心軸同高或略低。
5. **roughing gouge 起轉**：從料的中段開始（不要從端點起，端點容易跳），左右平推、把方角削掉成 8 角 → 16 角 → 圓。
6. **校直徑**：用 calipers + parting tool 在料兩端切到目標直徑、再用 roughing gouge 連起來。

> **Raffan 的口訣**（《Turning Wood》ch.4）：「ABC = Anchor, Bevel, Cut」——刀先靠在 tool rest（anchor）、刀斜面貼住料表面（bevel rub）、然後才提起刃口開始切（raise to cut）。catch 99% 都是因為沒做 bevel rub 就直接吃刀。

### 3.2 三種基本紋路：bead / cove / fillet

| 紋路 | 形狀 | 工具 | 技法重點 |
|---|---|---|---|
| Bead（凸珠） | 半圓凸出 | spindle gouge 或 skew | 從珠頂往兩側切下、不要中心起 |
| Cove（凹溝） | 半圓凹入 | spindle gouge | 從凹溝兩側往中心切、絕不從中心往外（會 catch） |
| Fillet（直平段） | 平面圓柱 | parting tool + skew | 兩端 parting tool 切深、中間 skew 推平 |

**Cove 的 catch 規則**：必須**從高處往低處切**——刃口進入時要從凹溝邊緣（高）往中心（低）走，反過來就會 catch。Rowley《Foundation Course》ch.6 強調這點：「cove 是新手最容易吃到 catch 的紋路」。

### 3.3 桌腳車旋（cabriole-spindle）

> 來源：Raffan《Turning Wood》ch.7 + Tage Frid Vol.3 提到車腳（在 books_workshop_manuals.md 有 Frid 三腳凳）。

桌腳的標準分段：
1. **Pommel（方圓交界）**：方料保留段不車。skew 切斷面定位。
2. **Upper turning**：bead + 小 cove 裝飾。
3. **Shaft（主柱）**：直長段或微 taper。
4. **Lower turning**：bead + cove 裝飾。
5. **Foot（腳）**：可能是球形、bun foot、tapered foot。

**典型尺寸**：餐桌腳長 700 mm、上下方料保留 80 mm（對應牙條 + 凳座）、車旋段長 540 mm、主柱直徑 50–55 mm、腳直徑 40–45 mm。

> 量產時用 **story stick（樣板棒）**：把所有 bead/cove/fillet 位置畫在一根長板上、貼在 tool rest 上方對應、確保每隻腳完全一致。Frid 的方法。

### 3.4 燭台、筷筒、陀螺、台球桿

**燭台（candlestick）**：
- 通常分 2–3 段車、再用 mortise-tenon 接起來（一根長料車不出來）
- 頂端杯口直徑 ≥ 蠟燭直徑 + 5 mm（西式蠟燭多 22 mm，杯口 28 mm）
- 底盤直徑 ≥ 燭台高度 1/3（穩定原則）

**筷筒（chopstick holder / pen pot）**：
- 端面車旋——掏空內部，跟木碗同類技法（見 §4）
- 但因為形狀直筒，常見錯誤是底太薄。Rowley 建議底厚 ≥ 8 mm

**陀螺（コマ / spinning top）**：
- 日本《木工旋盤テクニック》專章。短粗料（高 60–80 mm、徑 50 mm 起）
- 重心要在腳尖正上方 2/3 處——太高會晃、太低不轉
- 腳尖角度 30–45°，太尖（< 20°）會立刻磨損
- 木材選硬重——欅（zelkova）、櫻、橡，台灣可用相思木、烏心石

**台球桿（pool cue / billiard cue）**：
- 主軸專業中的專業——長 1500 mm、最大直徑 35 mm 起手、桿頭 12.5 mm。
- 需要長 bed lathe（bed ≥ 1100 mm）+ steady rest（中段支撐架，防共振）
- 楓木拼接黑檀的對比、雷射雕花、車旋後手工拋光到 #2000
- 台灣有專做 cue 的師傅、不是一般車旋人能跨進。提到場景時轉介比直接教更實在。

---

## 第 4 章 端面車旋 / 木碗（Bowl / Faceplate Turning）

> 「端面」= 木紋橫切過車床中心軸、即 grain across the bed。所有木碗、木盆、平盤都屬於這類。
>
> 來源：Raffan《Turning Bowls》全書 + Mahoney *Bowl Basics* + Mark Baker ch.5。

### 4.1 木碗的紋路方向：sidegrain vs endgrain

| 方向 | 紋路位置 | 特性 | 典型用途 |
|---|---|---|---|
| Sidegrain bowl | 木紋平行碗口（年輪繞碗壁） | **絕大多數木碗**、好車、強度均勻 | 沙拉碗、湯碗、果盤 |
| Endgrain bowl | 木紋垂直碗口（端面朝上下） | 像「車一個高杯」、難車（每轉切到 endgrain 兩次）、易裂 | 高杯、深筒、特殊裝飾 |

**Sidegrain bowl** = 從原木橫切下一塊「圓餅」當 blank。99% 的木碗教學都是這種。

> 「Endgrain bowl」完全是另一個技法、跟 box turning 比較像（見第 5 章）。新手別碰、教學別教。

### 4.2 Green wood vs dry wood

> 來源：Raffan《Turning Bowls》ch.4 + Mahoney *Bowl Basics* §2。

**Green wood turning（生材車旋）**：
- 含水率 30–60%（剛砍下到 1 年內）
- 優點：軟好車、出長條 ribbon-like 木屑、完成的碗有光滑 shear cut 表面
- 缺點：旋完會變形（橢圓）、必須 once-turned（一次到位）或 twice-turned（粗車後乾燥再精修）

**Dry wood turning（乾材車旋）**：
- 含水率 8–12%
- 優點：旋完尺寸穩定、可上膠 / 拼貼料
- 缺點：硬、出粉狀木屑、tear-out 風險高、需更多砂磨

**Twice-turned bowl 的 SOP（Raffan ch.6）**：
1. **粗車（rough turn）**：生材時車到「壁厚 = 直徑 × 10%」（例：300 mm 碗 → 壁厚 30 mm）
2. **乾燥**：袋裝刨花 + 報紙包覆放角落 6–12 個月、或用 LDD（Liquid Dishwashing Detergent）法 / DNA 浸泡（denatured alcohol）加速 1 個月
3. **再精修（finish turn）**：乾燥後重新上 chuck、車到最終尺寸（壁厚 5–8 mm）

**Once-turned（natural-edge / 一次到位）**：
- 直接在生材上車到最終厚度（壁厚 4–6 mm）、讓它自然乾燥變形
- 故意接受橢圓、追求自然感
- 北美 craft fair 大量這種風格、樹瘤 / burl / 自然樹皮邊（natural edge）的常用做法

### 4.3 木碗比例：rim / wall / base

> 來源：Raffan《Turning Bowls》ch.5 + Mahoney *Bowl Basics* §4。

**Raffan 的「均一壁厚法則」**：
- 從碗口到碗底壁厚應**均勻**（差異 ≤ 1 mm）
- 不均的碗烘乾時會應力不均、爆裂機率高 3–5 倍

**典型比例**：

| 碗類 | 直徑 | 壁厚 | 底厚 | 高度 |
|---|---|---|---|---|
| 小食碗 | 150 mm | 4–5 mm | 8 mm | 50 mm |
| 沙拉碗 | 250–300 mm | 6–8 mm | 12–15 mm | 80–120 mm |
| 大盆 | 400 mm+ | 10–12 mm | 20 mm | 150 mm+ |
| 裝飾深碗 | 200 mm | 5 mm | 10 mm | 150 mm |

**底厚為什麼比壁厚 ≥ 2 倍**：
1. 用 chuck 抓 tenon 時要承受撐力
2. 翻面修底（cole jaws）時要承受夾持
3. 視覺上薄底碗會「飄」、厚底碗會「穩」

### 4.4 Tear-out 防治

> 來源：Raffan《Turning Bowls》ch.7 + Mark Baker ch.5。

**端面車旋最大的敵人**：碗壁會經過 endgrain 兩次（碗的 12 點和 6 點方向）、那兩個位置最易撕裂（tear-out）。

**Raffan 的四階段防 tear-out**：
1. **shear cut（剪切）**：bowl gouge 翼接觸料、刀身轉 45°、切出來的纖維是「剪斷」不是「撕斷」
2. **bevel rub**：刃口進入時 bevel 必須先貼料、再抬刃，不可直接吃刀
3. **降轉速**：精修 cut 比粗胚 cut 慢 30%
4. **濕潤 endgrain**：硬木 endgrain 用噴霧瓶噴點水、纖維暫時變軟、tear-out 大減（Mahoney 推）

**最後絕招：scraper + shear scraping**：
- round-nose scraper 平躺 → 改為翻 45° 的 shear scrape
- 一刀薄到只切 0.1 mm、像刨花一樣捲出
- Mike Mahoney 在 *Bowl Basics* 演示：sidegrain 內壁完成後、shear scrape 可以把砂磨工序從 #80 起跳改成 #180 起跳

---

## 第 5 章 木盒車旋（Box Turning）

> 來源：Raffan《Turning Boxes》全書 + Drozda *Fabulous Finial Box* + Cindy Drozda 期刊文。

### 5.1 木盒 vs 木碗的根本差異

- **木碗**：sidegrain blank、年輪繞碗壁
- **木盒**：endgrain blank、年輪是同心圓、纖維方向跟長軸平行

**為什麼木盒用 endgrain**：
1. lid 與 body 接合面是 endgrain on endgrain，**伸縮一致**——sidegrain 會橢圓、lid 配不上
2. endgrain 旋出的內壁光滑、適合精細紋路
3. 紋路對稱（同心圓），lid 與 body 紋對得上

### 5.2 Lid 配合精度：friction-fit / pop-off / suction-fit

> 來源：Raffan《Turning Boxes》ch.4 + Drozda 文章。

| 配合方式 | 公差 | 拿起感 |
|---|---|---|
| Tight friction（緊摩擦） | -0.05 mm（內徑略大於外徑 0.05 mm） | 有抵抗、要旋一下才開 |
| Standard friction | 0 mm（理論完全等徑） | 順手取、有「啵」一聲 |
| Loose / suction | +0.05–0.1 mm | 內外有空氣感、輕輕拉就開 |
| Pop-off（彈出） | -0.1 mm + 內側微凹 | 翻倒不掉、按一下會跳出 |

**Raffan 的關鍵口訣**：「**先車 body、再車 lid 來配 body**」——絕不反過來。body 內徑量好、再用 calipers 量到 lid 榫頭、再修到剛好。

**Drozda 的 finial box（細工裝飾盒）**：
- lid 上有細高 finial（裝飾尖頂），高 30–80 mm、最細處 1–2 mm
- 用 detail gouge 1/4" 從外往內 shear cut
- 每完成 5 mm 用手指輕扶 finial 防共振
- 要求極乾燥木材（< 8% MC）+ 硬重木種（黑檀、黃楊、紫檀）

### 5.3 木盒紋理對配（grain matching）

> 來源：Raffan《Turning Boxes》ch.5。

從同一段料切出 body 與 lid、保持原本的紋路位置——
- 切之前用鉛筆在料側畫一條長線跨過 body 與 lid 段
- 旋完成把 lid 蓋上、線可以連起來 = 紋對配成功
- 如果 lid 是另一塊料、紋路必對不上、視覺差很多

### 5.4 木盒尺寸建議

| 用途 | 直徑 × 高 | 壁厚 | lid 厚 |
|---|---|---|---|
| 戒指盒 | 50×40 mm | 4 mm | 6 mm |
| 印章盒 | 60×80 mm | 5 mm | 8 mm |
| 茶葉小罐 | 80×100 mm | 6 mm | 10 mm |
| 裝飾大盒（finial） | 80×150 mm（含 finial） | 5 mm | 12 mm |

---

## 第 6 章 食器塗裝（食安重點）

> `finishing.md` ch.9 寫過食安塗料的化學原理跟廠牌（Tried & True、礦物油、Howard、Walrus Oil）、不重複。這一章專補**車旋木碗特有的塗裝工序**。
>
> 來源：Mahoney *Bowl Basics* §6 + Raffan《Turning Bowls》ch.10 + Mahoney 個人配方專案。

### 6.1 Mahoney's Walnut Oil（純胡桃油）

Mike Mahoney 自家經銷的純胡桃油是車旋圈的標準食安塗料、**不是預聚合品（沒有加金屬乾燥劑）、不會自燃**——這個跟 BLO 系亞麻仁油完全不同（亞麻仁油布揉一團 3 小時內可能自燃，見 `finishing.md` §1.1 的橘色警告）。

**配方原理**：
- 純胡桃油（Juglans regia）——天然不飽和脂肪酸自我聚合
- 沒加金屬鹽乾燥劑、所以乾很慢（48–72 小時表乾、2 週硬化）、但**處理布很安全**
- 食品級認證（FDA / NSF）

**塗裝 SOP**：
1. 砂磨車到 #320–#400（食器表面要光滑、不卡食物碎屑）
2. 第一道：未稀釋胡桃油全面塗、滲透 15 分鐘、布擦掉表面剩油
3. 24 小時等乾
4. 第二、三道：重複，每道間隔 24 小時
5. 最後一道乾透後用 #0000 鋼絲絨 + 蜜蠟拋光

**為什麼選胡桃油不選亞麻仁油**：
- 亞麻仁油黃化嚴重（過半年明顯變黃）
- 胡桃油不黃、不變色、可長期維持原木色
- 對堅果過敏者有疑慮（Mahoney 在 FAQ 說「真正過敏者請選礦物油」）

### 6.2 Tried & True（亞麻仁聚合系）

`finishing.md` 已寫，這裡補**車旋專屬用法**：
- 用 Tried & True Original（不含蜜蠟）薄塗於旋轉中的木碗——車床仍開（最低 rpm、200–400）、布擦油 + 摩擦熱輔助滲透
- 比平擦快 3 倍、且摩擦熱讓油層更均勻

### 6.3 礦物油 + 蜜蠟（最簡單、最便宜）

砧板派的萬用配方、車旋木碗也可以用：
- FDA 食品級白礦物油（Howard Cutting Board Oil 或藥房嬰兒礦物油）
- 純蜜蠟 1：礦物油 4（重量比）
- 加熱融蜜蠟 → 混入溫礦物油 → 倒入小罐降溫凝固成膏狀
- 用法：布沾膏擦碗、5 分鐘後擦掉多餘

> **缺點**：礦物油不聚合、永遠是「液態油」、會慢慢被吃光——所以**每用 1–2 個月要重補一次**。買碗時要附這個資訊給客人。

### 6.4 千萬不要的塗料（食器）

- **Polyurethane PU**：理論上 cured 後食安、但車旋木碗會被切刀刮傷露出底材、刮屑混食物有問題
- **Shellac 蟲膠**：酒精會溶解（沙拉醬含醋）、不耐熱
- **Polycrylic 水性漆**：碰熱湯會發白
- **Spray lacquer**：所有噴漆——食器原則「能擦不能噴」

> 對應 `finishing.md` §9.2：理論食安 vs 實際食安的差別。車旋食器**只用聚合油 + 蠟系**，沒有例外。

### 6.5 木匙、木鏟（utensil）的塗裝

- 不能用蜜蠟（碰熱會融）
- 只能用聚合油（Tried & True / 胡桃油 / 純桐油）
- 第一次用前先煮 5 分鐘殺菌（高溫不會破壞聚合油層）
- 客人的保養指引：手洗、不下洗碗機、不泡水、每月補一次油

---

## 第 7 章 車旋安全 SOP（Catch 防範與 PPE）

> `safety_workshop.md` 寫過一般 PPE、長髮、手套禁戒、自燃；這一章專補**車旋特有的事故模式**。
>
> 來源：AAW Safety Guidelines + Raffan《Turning Wood》ch.2 + Rowley《Foundation Course》ch.2 + Mahoney *Bowl Basics* §1。

### 7.1 必戴 PPE：face shield > goggles

`safety_workshop.md` §24 寫過「車削必用密閉護目鏡」——但 AAW 自 2010 年代起把標準提高到 **full face shield（全面罩）**。

**為什麼面罩 > 眼鏡**：
- 車床事故中 73% 涉及臉部（`safety_workshop.md` §28）
- 眼鏡只擋眼球、面罩擋整張臉
- 飛出的木塊不只進眼睛——可能撞鼻樑骨折、撞牙
- ANSI Z87.1+ impact rated face shield、不到 NT$ 1,500，不要省

**搭配層次**：
1. 安全眼鏡（底層）
2. Face shield（中層）
3. 防塵口罩 N95（最深層、長時間磨砂時）

> Raffan 從 1970 年代起所有教學影片都戴面罩、不戴的學生不准上機。

### 7.2 catch 的三種類型

> 來源：Rowley《Foundation Course》ch.6 + Raffan ch.4。

「catch（吃刀）」= 刀進料時瞬間咬太深、被旋轉力量帶走。輕則刀飛出、重則手指斷、料噴到臉。

**三種 catch**：
1. **Skew catch**：skew 平面切時刃口超過中心線、料把刀拉進去——最爆裂、會把料炸碎飛出
2. **Cove catch**：cove 切從低處往高處（錯的方向）——刀被料咬住、bevel 失去支撐
3. **Spindle gouge catch**：bevel 沒貼料就直接吃刀、轉 90° 卡在料側

**catch 的 90% 原因**：忘記 ABC（Anchor 靠 tool rest → Bevel 貼料 → Cut 抬刃）。新手三天內被 catch 一次很正常、不要因此放棄。

### 7.3 chuck 與 faceplate 鎖緊

> 來源：AAW Safety + Mahoney *Bowl Basics* §1。

車旋飛料事故的另一大主因：**chuck 沒鎖緊、料飛出來**。

- **Chuck**：每次裝料後、用 T 型扳手**用力鎖**（Mahoney：「鎖到你覺得鎖過頭再多 1/4 圈」）
- **Faceplate**：螺絲至少 4 顆、長度 ≥ 25 mm（不能用木螺絲、要用 sheet metal screws #10–#12）
- **Tailstock 支撐**：粗車任何件**永遠用 tailstock 頂住**——只在最後修底拿掉
- **新料試跑**：starts 開到最低 rpm、手保持距離、運轉 10 秒檢查震動才上手

### 7.4 Tool rest 1/8" 規則

> 來源：Raffan《Turning Wood》ch.2。

- Tool rest 距料表面 **3 mm（1/8"）**——太遠刀會被料拉進去（變長 lever arm）、太近刀沒空間操作
- 高度跟料中心軸**同高**（spindle）或**略高 3 mm**（bowl gouge）
- 每次旋徑變化要重新調 tool rest（粗車到精車中間至少調 3–4 次）

### 7.5 絕對禁止戴手套

`safety_workshop.md` §79 已強調過、車旋是這條規則最殘酷的場合：
- 主軸轉速 1500 rpm 時、手套被夾頭咬住的瞬間整隻手會被拽進去
- 已有美國案例：手套捲入 → 手腕骨折 + 撕脫
- 寒冬車間冷？穿厚衣、暖手、用 mukluks 暖腳——手永遠裸露

### 7.6 散料時的緊急停機

- **腳踏 e-stop**：好車床配腳踏緊急開關、踩下去馬上停
- **大件車旋（≥ 300 mm）**：操作時站在車床「side」（側邊）、不要站在「firing line」（料延伸方向）——萬一料飛出不會直接撞到人
- 料若聽到異常聲（喀喀聲、震動加劇）→ 馬上停 → 檢查是否有暗裂（hidden crack）或 chuck 鬆脫

---

## 第 8 章 木材選擇與處理

`books_english_classics.md` ch.1 寫過 FSP、含水率原理、reaction wood、徑切弦切——這一章專補**車旋特有的料選擇與處理**。

### 8.1 spindle 與 bowl 的紋理選擇完全相反

| 類型 | 紋路方向 | blank 怎麼切 |
|---|---|---|
| Spindle | 木紋平行 lathe 軸 | **長條料**：年輪平行頂針線 |
| Bowl（sidegrain） | 木紋垂直 lathe 軸 | **圓餅料**：從原木橫截一塊、年輪是同心圓 |
| Box | endgrain | 切跟 spindle 一樣的長條、但短粗 |

> 木匠學院教學最常見錯誤：學生拿一塊一般板材直接切方料當 bowl blank、車到一半發現木紋不對、爆裂。**車旋專用料要從原木下手、不能從成材板下手**。

### 8.2 Blank 切割：避髓心、避樹皮

> 來源：Raffan《Turning Bowls》ch.4 + Mahoney *Bowl Basics* §2。

**從原木切 sidegrain bowl blank**：
1. 截一段原木（直徑 ≥ 想要的碗直徑 + 50 mm 餘量、長度同等）
2. **避開髓心（pith）**：髓心是樹的中心、應力最大、最易裂——把髓心切成兩半（through-the-pith cut）讓兩個 blank 各自避開
3. 樹皮側朝外、年輪同心圓在 blank 兩端面
4. 用帶鋸切成圓餅（或八角）、這是 blank
5. 沒帶鋸用 chainsaw + faceplate 直接鎖、跳過帶鋸切圓也可以

**避免的 blank**：
- 髓心穿過中央的 → 必裂
- 帶 reaction wood（壓縮材）的軟木 → 縱向收縮 2%，旋完變椅子腿
- 蛀蟲洞穿透的 → 旋到一半噴洞
- 完全帶皮 + 樹皮鬆脫 → 高速時樹皮飛出來像砲彈

### 8.3 含水率對車旋的影響

> 來源：Mahoney *Bowl Basics* §2 + Hoadley（在 books_english_classics.md ch.1）。

| MC | 狀態 | 適合做什麼 |
|---|---|---|
| 60–100% | 剛砍 | 粗車（rough turn）、再乾燥 |
| 30–40% | 半乾 | 不適合——介於兩者最差 |
| 12–18% | 自然乾燥（戶外晾） | 一般車旋 |
| 8–12% | 室內乾 | 木盒、要求精密件 |
| < 8% | 窯乾 | 細工 box、finial、量產 |

**LDD 法（Liquid Dishwashing Detergent）加速乾燥**：
- 粗車木碗泡稀釋 LDD（1:10 水）24 小時
- 取出包紙、放角落
- 比純放置乾燥快 2–3 倍、開裂率降一半
- Raffan 跟 Mahoney 都用、原理是 LDD 取代部分結合水、釋放時細胞壁不會崩塌

**DNA 法（denatured alcohol）**：
- 浸泡 24 小時、原理是 DNA 取代水、揮發速度比水快 4 倍
- 缺點：易燃、味道大、要通風

### 8.4 台灣可用樹種（車旋適合度）

> 對應 `wood_species.md` 既有的台灣樹種介紹、這裡按車旋特性重排。

| 樹種 | 主軸 | 木碗 | 木盒 | 備註 |
|---|---|---|---|---|
| 相思木 | 優 | 優 | 中 | 重硬、紋細密、台灣最佳車旋木 |
| 烏心石 | 優 | 優 | 優 | 紋細色淡、刀痕收得漂亮 |
| 牛樟 | 優 | 中 | 中 | 軟、有香、好車但不耐刮 |
| 楓香 | 優 | 中 | 優 | 中硬、紋細、台灣常見 |
| 紅檜 / 扁柏 | 中 | 中 | 中 | 太軟、易壓痕、但氣氛獨特 |
| 龍眼 / 荔枝 | 優 | 優 | 優 | 重硬、紋路漂亮、果樹剪枝可得 |
| 樟木 | 優 | 中 | 中 | 軟硬度中、有樟腦氣味、避免食器（樟腦油） |
| 黑檀（紫檀進口） | 優 | 中 | 優 | finial 細工首選 |

> **台灣專屬建議**：龍眼、荔枝、芒果這類果樹剪枝後常被丟棄、找果園問可拿到大量免費生材 blank——做 once-turned bowl 風味極佳，台灣車旋圈圈內人都這樣搞。

---

## 第 9 章 對台灣木工的啟發

### 9.1 在地木種適合車什麼

從 §8.4 延伸：

- **沙拉碗 / 飯碗（食器）**：相思木、烏心石、龍眼——硬重、無毒、深色紋路漂亮
- **裝飾深碗**：牛樟、樟（非食器）——軟好車、有香氣、適合 craft 市場
- **燭台 / 桌腳**：相思木、楓香——主軸車旋的中性首選
- **木盒**：黑檀（進口、finial 用）、烏心石（國產替代）
- **筷筒 / 文具**：紅檜、扁柏——軟、易刻字、香氣加分、不接觸食物無妨
- **陀螺 / 玩具**：龍眼、相思木——重，慣性轉得久；染色用相思木便宜的小料

### 9.2 台灣車旋社群現況

- 台灣專做車旋的木工不多——車旋傳統來自歐美與日本、台灣老師傅多走家具系（榫卯/雕花）
- 社群 FB 有「台灣木工旋盤同好會」、「Woodturning Taiwan」等不定期聚會
- 台中有少數車旋師傅做 cue（撞球桿）、台灣 cue 工藝在亞洲算第二流（第一流是日本、菲律賓）
- 木匠學院如果要切入車旋市場、卡位「親民食器 + 教學」是最缺的——專業大師木碗（NT$ 8,000+）市場已被進口品牌佔、但 NT$ 800–2,000 的台灣本地相思木碗幾乎沒人做

### 9.3 木頭仁可以做的內容方向

YT 影片的角度建議（依操作門檻排序）：
1. **「台灣車旋第一支：陀螺」**——蝦皮 NT$ 8,000 mini lathe 開箱 + 第一個成品（陀螺料 60 元、相思木邊角料）
2. **「為什麼木碗會裂？green wood 二次車旋全紀錄」**——12 個月時間軸 vlog
3. **「台灣相思木 vs 美國橡木車旋對比」**——同尺寸碗、同工序、看刀感與成品
4. **「果園廢料變沙拉碗：龍眼木 once-turned」**——本土永續題材、易瘋傳
5. **「為什麼日本陀螺賣 3,000 元？コマ職人一天車多少」**——介紹日本車旋傳統
6. **「車床一定要買進口的嗎？台製 mini vs 日本 / 美國中階對比」**——買機建議型
7. **「車旋的四種致命 catch」**——安全教育型，也讓學員心裡先有準備

### 9.4 跟既有教學內容串接

- `teaching_kids.md` §126 提到「燭台車床作品需更高年齡、這裡只用手工具」——12 歲以上 + 家長陪同 + steb center 安全頂針可以開試水
- `joinery.md` 跟 `books_workshop_manuals.md` 的 Frid 三腳凳，腳是 tapered round tenon——木匠學院家具課的學員加學車旋可以一次補完三腳凳
- `finishing.md` 食安塗裝章是這份檔的姊妹章——車旋學員的塗裝段直接導去 `finishing.md` ch.9

---

## 跨檔速查（給 bot 用）

- 「車床怎麼選 / mini midi 差別」→ §1.1 + §1.5
- 「bowl gouge 跟 spindle gouge 差別」→ §2.1 表格
- 「Wolverine jig 是什麼」→ §2.3
- 「木碗壁厚多少」→ §4.3 表
- 「green wood 跟 dry wood 哪個好車」→ §4.2
- 「車旋木碗怎麼上塗料 / Mahoney walnut oil」→ §6.1（化學原理回 `finishing.md` §9）
- 「Tried & True 怎麼用在車旋木碗」→ §6.2
- 「車旋為什麼要戴面罩不只眼鏡」→ §7.1（補 `safety_workshop.md` §24）
- 「catch 是什麼 / 怎麼避免」→ §7.2 + §3.1 ABC 口訣
- 「車旋木碗裂掉怎麼辦」→ §4.2 + §8.3（含水率） + §8.2（避髓心）
- 「台灣什麼木適合車碗」→ §8.4 + §9.1
- 「木盒 lid 怎麼配得剛好」→ §5.2
- 「龍眼木 / 荔枝木怎麼來」→ §8.4 + §9.1（果園剪枝）
- 「車陀螺要多硬的木」→ §3.4 陀螺段 + §8.4
- 「初學車旋一次買哪 5 支刀」→ §2.1 Rowley 推薦五件
