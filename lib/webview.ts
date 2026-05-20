/**
 * 偵測使用者目前是否處於各家 app 的內建 webview。
 * Google OAuth 在 webview 會回 disallowed_useragent (403)，
 * 因此 webview 環境需強制走 magic link 或提示外開瀏覽器。
 */
const WEBVIEW_PATTERNS = [
  /\bLine\//i,
  /\bFBAV\b/i, // Facebook
  /\bFBAN\b/i,
  /\bFB_IAB\b/i,
  /\bInstagram\b/i,
  /\bMessenger\b/i,
  /\bWhatsApp\b/i,
  /\bTwitter\b/i,
  /\bMicroMessenger\b/i, // WeChat
  /\bKAKAOTALK\b/i,
  /\bmusical_ly\b/i, // TikTok (UA 用舊 app name musical.ly)
  /\bBytedanceWebview\b/i, // TikTok / Bytedance app shell
  /\bTikTok\b/i,
  /\bBarcelona\b/i, // Threads (Meta，code name)
  /\bPinterest\b/i,
  /\bLinkedInApp\b/i,
];

export function isInAppBrowser(ua: string | undefined = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (!ua) return false;
  return WEBVIEW_PATTERNS.some((re) => re.test(ua));
}

/**
 * 判斷是哪一家 in-app browser（用來顯示對應的「請從這裡開外部瀏覽器」提示）。
 */
export function detectWebviewApp(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): string | null {
  if (/\bLine\//i.test(ua)) return "Line";
  if (/\b(FBAV|FBAN|FB_IAB)\b/i.test(ua)) return "Facebook";
  if (/\bInstagram\b/i.test(ua)) return "Instagram";
  if (/\bMessenger\b/i.test(ua)) return "Messenger";
  if (/\bMicroMessenger\b/i.test(ua)) return "WeChat";
  if (/\bKAKAOTALK\b/i.test(ua)) return "Kakao";
  if (/\bWhatsApp\b/i.test(ua)) return "WhatsApp";
  if (/\bTwitter\b/i.test(ua)) return "Twitter";
  if (/\b(musical_ly|TikTok|BytedanceWebview)\b/i.test(ua)) return "TikTok";
  if (/\bBarcelona\b/i.test(ua)) return "Threads";
  if (/\bPinterest\b/i.test(ua)) return "Pinterest";
  if (/\bLinkedInApp\b/i.test(ua)) return "LinkedIn";
  return null;
}
