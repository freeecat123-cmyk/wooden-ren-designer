/**
 * 專案報價單號：Q-YYYYMMDD-XXXX（XXXX 從專案 id 衍生穩定後綴）
 * 不寫入 DB——同一專案任何時間生成都一致，不需要存欄位。
 */
export function projectQuoteNumber(projectId: string, today: Date): string {
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  // 取 project id 末 4 碼（uuid 末段最隨機），轉大寫
  const tail = projectId.replace(/-/g, "").slice(-4).toUpperCase();
  return `Q-${yyyy}${mm}${dd}-${tail}`;
}
