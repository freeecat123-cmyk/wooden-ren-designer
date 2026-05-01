<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 製圖 / 幾何 / 報價 公式集 = `docs/drafting-math.md`

碰到下列任何 code 前**必須先 grep `docs/drafting-math.md` 對應 section**，
提案要引用 § 編號（不引等於沒做）：

- `lib/render/svg-views.tsx` — 三視圖 → §A
- `lib/render/geometry.ts` — silhouette / projection → §A1, §A9
- `components/.../details.tsx` — 榫卯細節圖 → §B, §G
- `lib/pricing/*` — 報價 / 工時 / 材積 → §X, §AG, §T
- `lib/knowledge/style-*` / 古家具參數 → §AB
- `lib/templates/*` 任何家具 → §K（派系）, §L（木紋）, §M（撓度）, §O（人體工學）

doc 開頭有 grep keyword 索引表，動手前花 30 秒查：
```bash
grep -nE "<keyword>" docs/drafting-math.md
```

⚠️ **doc 軸慣例（z 上 y 後）跟 code（y 上 z 後）不一樣**——doc 開頭有對照表，
讀公式時心裡換軸。撞到 doc/code 衝突先停下、問使用者哪邊為準。

修完發現新公式 / 新規則 → **回頭補進 doc 對應 section**，下個 dev / 下次 session
才看得到。

## 卡住 / 改不好時也要查 doc（不要瞎試）

下列訊號出現 → **先停手 grep doc**，不要靠直覺亂改：

- 改 2-3 次還不對、使用者說「沒改好」/「還是怪怪的」/「還是失敗」
- 自己也覺得邏輯沒把握、要靠多次 trial & error 收斂
- 不確定某個視覺問題是「幾何錯」還是「投影錯」還是「camera 角度錯」
- 某個值（座高 / 靠背角 / 腳間距 / 板厚）不確定多少才合理
- 撞到「換軸 / 換座標系」的奇怪 bug

doc 3760 行涵蓋很多 edge case：
- 視覺扭曲 / silhouette 不對 → §A 三視圖, §A9 非 quarter rotation
- 椅子坐起來不舒服 / 不穩 → §O 人體工學, §V 椅子穩定性力學
- 板會撓 / 結構斷 → §M 撓度, §L 木紋方向
- 古家具型態怪怪 → §AB 明清 20 款圖譜
- 報價算錯 → §X 報價演算法, §T 台灣木材規格
- 五金孔位 / 抽屜尺寸 → §N 五金孔位

**規則：** 改第 2 次還不對，第 3 次出手前必 grep doc，不能直接再改。

---

# 家具設計器：加新家具種類的 SOP

每次新增家具種類（FurnitureCategory）必走完這 4 步，否則「風格快速套用」按鈕的覆蓋會缺一塊。

## 1. 加 template
- `lib/templates/<new-category>.ts` 寫 OptionSpec[] + builder 函式
- 在 `lib/templates/index.ts` 註冊
- 在 `lib/types/index.ts` 的 `FurnitureCategory` union 加上字串

## 2. 加 base style coverage（自動 ✓）
做完上面就夠 60-70% 風格差異——`STYLE_PRESETS[id]` 的 base params（legShape /
legSize / legEdge / material / apronWidth / backStyle / seatProfile / splayAngle）
會被 `applyStylePreset()` 寫進 URL，UI 過濾後留下 template 有的 key。
**這部分不用手動做**。

## 3. 補 detail packs（半自動 ✓）

跑：

```bash
npm run gen-style-pack <new-category>
```

這個 script（`scripts/gen-style-pack.ts`）會：
- 讀新 template 的 OptionSpec[]（含 min/max/choices）
- 對 8 風格各打一次 `/api/style-suggest`（用 wood-master 知識的 SYSTEM_PROMPT）
- 產生 detail pack JSON 放在 `/tmp/style-pack-<category>.json`
- 印出建議 merge 進 `lib/knowledge/style-detail-packs.ts` 的 diff

**人工審改後** 把 JSON 段 paste 進 `style-detail-packs.ts`（每個 style 物件下加
`"<new-category>": {...}` 那一格），跑 `npx tsc --noEmit` 確認、commit。

需要 `ANTHROPIC_API_KEY`（local `.env.local` 或匯出）。

## 4. （可選）給 Windsor null

Windsor 是椅匠傳統，不做櫃 / 桌 / 小物件。如果新家具不是椅 / 凳 / bench，
在 detail packs 加 `"windsor": { "<new-category>": null }`。null 會跳過套用，
fallback 到 base preset。

## Why 這個流程

- base preset 是萬用層（任何 template 都套）→ 新家具立刻有 60-70% 風格差異
- detail pack 是 per-template 的 fine tune → 風格內聚力 + 視覺差異拉開
- 漏 step 3 → 風格切換時細部設定全 fallback 到 template default → 使用者
  看不出差別（典型抱怨：「8 風格看起來都一樣」）
