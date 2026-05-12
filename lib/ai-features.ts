/**
 * AI 功能總開關。env `AI_FEATURES_ENABLED=true` 才打 Anthropic API。
 * 預設 false（為了避免公開端點 API 費用爆量），手動開才能用。
 *
 * 影響：wood-master / style-suggest / photo-to-params 的 GET available
 * 旗標 + POST 預先 503 拒絕。前端按鈕自動隱藏 / disabled。
 *
 * 重啟 dev server 才會生效。
 */
export function aiFeaturesEnabled(): boolean {
  return process.env.AI_FEATURES_ENABLED === "true";
}
