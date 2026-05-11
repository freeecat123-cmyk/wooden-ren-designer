# drafting-math.md vs code drift report · 2026-05-12

`drafting-math.md` 是改三視圖/榫卯前 grep 用的權威文件。
Memory `feedback_use_drafting_math_doc.md` 規定：改 wrd 渲染前先查 doc。
但 code 一直變動，doc 可能 drift。本檔列出 doc 提到但 code 已不存在的 symbol。

**Method**：grep all `` `inlineCode` `` identifiers in `drafting-math.md`,
filter out 4-letter+ alphanumerics, then check each against `app/ components/ lib/`.

Run time: ~ 1 minute. HEAD = `55eda49`.

---

## ⚠️ 真正 drift（過去 commit 存在過但已移除/重命名 → doc 沒同步更新）

這些是改 doc 時要優先修的：

| Symbol | Doc 用法 | 可能對應 | 備註 |
|---|---|---|---|
| `backTiltDeg` | 椅背後傾角 | `backRake`（dining-chair） | 重命名了 |
| `footStyle` | 腳款式 | `legShape` | 重命名了 |
| `grainLocked` | 木紋鎖定 | ? | 不確定，可能整個 feature 砍了 |
| `legThickness` | 腳的厚度（≠ legSize 粗細） | `legSize` 或 `apronThickness`？ | 看上下文 |
| `mouldingProfile` | 線板輪廓（cornice/wainscot） | ? | 可能規劃中尚未做 |
| `sculpted` | 雕花面板 | ? | 同上 |
| `waistHeight` | 中式櫃腰部高度 | ? | chinese-cabinet 規劃 |

**建議行動**：早上挑一段 doc 出來 grep + 對照 code 順手改，不要一次全改（doc 太長易誤改）。

---

## 📚 Doc-only refs（memory 檔名 / 規劃中常數，不算 drift）

不必修，列出來只是讓你知道為什麼 grep miss：

- `feedback_dynamic_option_visibility`、`feedback_user_questions_signal_cut`
  → memory 檔案路徑
- `project_wooden_ren_door_drawer`、`project_wooden_ren_round_leg_joinery`
  → memory 檔案路徑
- `terms_versions` → 規劃中 schema
- `EXPECTED_FAILS`、`JOINERY_MIN_PER_UNIT`、`SHAPE_AWARE_VARIANTS`
  → audit 規劃中常數
- `kerfMm`、`trimMm`、`L_plan`、`x_offset_back`、`svgpath`、`sightline`、`gomory`
  → 排版/裁切演算法規劃中變數名（doc 寫了 spec 但 code 還沒寫）
- `developable` → 概念詞（developable surface in differential geometry）

---

## 🔧 External lib refs（three.js 等，尚未用到）

doc 提到但 code 沒 import 的 three.js 模組：

- `Line2`、`OrthographicCamera`、`SVGRenderer`、`TubeGeometry`、
  `USDZExporter`、`ExtrudeGeometry`、`measureText`

這些是未來如果要做 SVG 匯出 / USDZ 匯出 / 線材渲染 等 feature 才會用到。
doc 寫了 spec 但 code 還沒實作。不算 drift。

---

## 🚦 結論

| 類別 | 數量 | 行動 |
|---|---|---|
| 真正 drift（重命名/移除） | 7 | 早上挑時間修 doc |
| Memory path refs | 4 | 不必修 |
| 規劃中尚未實作 | ~12 | 不必修 |
| External lib 規劃 | 7 | 不必修 |

**Total**：30 missing symbols / 72 doc symbols → drift 率 ~10%（其中 7 個是真 drift）。

文件整體健康度可接受，但「真 drift」的 7 個建議優先修，
免得有人改家具時被 doc 誤導去找不存在的 `backTiltDeg`。
