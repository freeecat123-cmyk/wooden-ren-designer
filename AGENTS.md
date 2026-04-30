<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

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
