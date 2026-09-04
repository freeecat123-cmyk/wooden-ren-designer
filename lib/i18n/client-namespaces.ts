// 這個檔案由 scripts/gen-client-namespaces.ts 產生,不要手改。
// 改完 client 元件的 useTranslations 之後重跑:npx tsx scripts/gen-client-namespaces.ts
//
// 為什麼存在:整包翻譯字典會被塞進每一頁的 HTML(gzip 後佔傳輸量約 69%),
// 其中九成以上是那一頁用不到的。只送 client 元件真的會讀的命名空間。
//
// ⚠️ 漏一個 → 畫面直接顯示 key 名稱,而且只在那個元件被 render 到才看得出來。
//    所以名單一律由掃描產生,不手寫。
//
// 掃描結果:client 元件用到 92 個命名空間 /
//          messages 共 130 個 / 省下 38 個不送。
// 不帶命名空間的 useTranslations()(已從實際 key 反推):
//   - components/PricingClient.tsx
//   - components/SiteFooter.tsx

export const CLIENT_NAMESPACES = [
  "admin",
  "aiRefine",
  "apronTilt",
  "askMaster",
  "branded",
  "brandingForm",
  "brandingGate",
  "bugReport",
  "catalogSearch",
  "ceilingTool",
  "chat",
  "copyShareLink",
  "csvExport",
  "customerForm",
  "customersPage",
  "cutPlanApp",
  "cutPlanConfig",
  "cutPlanSection",
  "designError",
  "designHistory",
  "difficulty",
  "engQuoteClient",
  "engQuoteForm",
  "engQuotePrint",
  "error",
  "floorTool",
  "footer",
  "furniture",
  "headerUser",
  "heightChip",
  "heightToSize",
  "installApp",
  "installPage",
  "invoiceModal",
  "invoicePref",
  "iosInstall",
  "joineryDetail",
  "lazyPerspective",
  "lemon",
  "login",
  "loginButton",
  "logo",
  "material3dPip",
  "messageThread",
  "mobile",
  "myDesignsPage",
  "mySubscription",
  "nav",
  "numberInput",
  "partDrawings",
  "perspectiveView",
  "photoToParams",
  "planCard",
  "planLabel",
  "pricingErrors",
  "pricingFaqs",
  "pricingPage",
  "pricingPlans",
  "printGate",
  "projectDetailClient",
  "projectShare",
  "projectsClient",
  "qrCode",
  "quoteGate",
  "quoteHistory",
  "quoteLaborForm",
  "quoteShareActions",
  "raisedFloorQuote",
  "raisedFloorTool",
  "refund",
  "resetDefaults",
  "saveDesign",
  "sceneToggle",
  "shareButtons",
  "shareDesign",
  "sheetBinSvg",
  "sizePreset",
  "studentLoginHint",
  "styleMismatch",
  "stylePreset",
  "suggestionsBox",
  "survey",
  "templateUnlock",
  "threeDExport",
  "toolUnlock",
  "upgradePrompt",
  "viewModeToggle",
  "webInstall",
  "wireframeToggle",
  "woodMaster",
  "xrayToggle",
  "zoomableViews",
] as const;

/** 從整包 messages 挑出 client 需要的那些 */
export function pickClientMessages<T extends Record<string, unknown>>(all: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const ns of CLIENT_NAMESPACES) if (ns in all) out[ns] = all[ns as keyof T];
  return out as Partial<T>;
}
