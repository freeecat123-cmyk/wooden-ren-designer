/**
 * 只做中文的範本（FURNITURE_CATALOG 裡 zhOnly: true 的那幾款）。
 *
 * 給 middleware 用：英文瀏覽器打 /templates/<slug> 會被導去 /en/templates/<slug>，
 * 但這幾款沒有英文頁（404），所以要排除。middleware 跑在 edge，不能 import 整個
 * lib/templates/index.ts（會把所有家具 builder 拉進來），才另外放一份。
 *
 * ⚠️ 跟 FURNITURE_CATALOG 的 zhOnly 必須一致 —— lib/__tests__/zh-only-sync.test.ts 會擋。
 */
export const ZH_ONLY_CATEGORIES: ReadonlySet<string> = new Set([
  "cert-c1",
  "cert-c2",
  "cert-c3",
  "cert-b1",
  "cert-b2",
  "cert-b3",
  "cert-b4",
]);
