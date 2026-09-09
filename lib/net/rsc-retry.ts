/**
 * RSC 請求重試 —— 修「手機用到一半畫面自己重整」。
 *
 * ## 為什麼需要這個
 *
 * 設計頁每改一次參數就走 `router.replace`（`components/design/DesignFormShell.tsx`
 * debounce 200/600ms），頁面是 server component → **每動一下滑桿就發一次 RSC 請求
 * 回伺服器**。實測方凳頁隨手改 10 次參數 = 10 個 RSC 請求。
 *
 * 而 Next.js App Router 對「RSC 請求失敗」的預設處理是**退回整頁硬導航**
 * （MPA fallback），使用者看到的就是「畫面突然自己重整」。
 * 2026-09-09 在正式站實測：只要攔下**一次** RSC fetch 讓它 reject，改一個參數
 * 就會 fire beforeunload 然後整頁重載。**一次網路打嗝就夠。**
 *
 * 手機才明顯，是因為行動網路會斷、切去別的 App 再回來連線要重建、弱訊號；
 * 桌機有線網路幾乎不會失敗。
 *
 * ## 做法
 *
 * 包一層 fetch：只對「GET 的 RSC 請求」加重試，其餘請求原封不動轉發。
 * - 網路層失敗（fetch reject）或暫時性狀態碼 → backoff 重試，最多 {@link MAX_RETRIES} 次
 * - 離線中 → 先等 `online` 事件（最多 {@link OFFLINE_WAIT_MS}）再重試，涵蓋
 *   「切去別的 App、走進電梯、回來繼續調」這種最常見的情境
 * - 重試都失敗 → 把原本的錯誤丟回去，Next 照舊硬導航（維持現狀，不會更糟）
 *
 * 只補 GET：RSC 導航一定是 GET，重試沒有副作用。Server Action 走 POST，
 * **絕不重試**（重試等於重複送出訂單／付款）。
 */

/** 最多重試次數（不含第一次）。2 次 + backoff 最壞多等約 1.2 秒，遠比整頁重載便宜。 */
export const MAX_RETRIES = 2;
/** 每次重試前等待毫秒，index 對應第幾次重試。 */
export const BACKOFF_MS = [300, 900];
/** 離線時最多等多久回到線上才重試。 */
export const OFFLINE_WAIT_MS = 8000;

export interface RetryDeps {
  /** 等待（可注入以便測試不用真的睡）。 */
  sleep?: (ms: number) => Promise<void>;
  /** 等回到線上（可注入）。 */
  waitForOnline?: () => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 等回到線上（或逾時）。已經在線上、或環境沒有 navigator 就立刻 resolve。 */
export function waitForOnline(): Promise<void> {
  if (typeof navigator === "undefined" || navigator.onLine !== false) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("online", finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, OFFLINE_WAIT_MS);
    window.addEventListener("online", finish);
  });
}

/**
 * 判斷這是不是 App Router 的 RSC 導航請求。
 *
 * Next 在 RSC fetch 上掛 `RSC: 1` header（另有 `Next-Router-State-Tree`、
 * `Next-Router-Prefetch`）。header 可能是 Headers 物件、`[k, v]` 陣列或普通物件，
 * 三種都要認；另外也認網址上的 `_rsc=` query（Next 用來破 CDN 快取）當保險。
 */
export function isRscGet(input: RequestInfo | URL, init?: RequestInit): boolean {
  const req = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
  if (method !== "GET") return false;

  const headers = init?.headers ?? req?.headers;
  if (headers) {
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      if (headers.has("RSC")) return true;
    } else if (Array.isArray(headers)) {
      if (headers.some(([k]) => String(k).toLowerCase() === "rsc")) return true;
    } else if (typeof headers === "object") {
      if (Object.keys(headers).some((k) => k.toLowerCase() === "rsc")) return true;
    }
  }

  const url = req?.url ?? (typeof input === "string" ? input : String(input));
  return url.includes("_rsc=");
}

/** 值得重試的狀態碼：邊緣節點／冷啟動的暫時性錯誤，重送一次多半就過了。 */
export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

function signalOf(input: RequestInfo | URL, init?: RequestInit): AbortSignal | null {
  if (init?.signal) return init.signal;
  if (typeof Request !== "undefined" && input instanceof Request) return input.signal;
  return null;
}

/**
 * 包一層 fetch：RSC GET 加重試，其餘原封不動轉發。
 *
 * @param baseFetch 底層 fetch（正式碼傳 `window.fetch`，測試傳假的）
 */
export function createRetryingFetch(
  baseFetch: typeof fetch,
  deps: RetryDeps = {},
): typeof fetch {
  const sleep = deps.sleep ?? defaultSleep;
  const online = deps.waitForOnline ?? waitForOnline;

  return async function retryingFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (!isRscGet(input, init)) return baseFetch(input, init);

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await online();
        await sleep(BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]);
      }
      try {
        const response = await baseFetch(input, init);
        if (attempt < MAX_RETRIES && isRetryableStatus(response.status)) {
          lastError = new Error(`RSC ${response.status}`);
          // 這個 response 不會被用到，主動關掉 body 免得連線掛著
          try { await response.body?.cancel(); } catch { /* 已關就算了 */ }
          continue;
        }
        return response;
      } catch (err) {
        lastError = err;
        // AbortError = Next 自己取消了這個導航（使用者又改了參數），不要重試
        if (err instanceof Error && err.name === "AbortError") throw err;
        if (signalOf(input, init)?.aborted) throw err;
      }
    }
    // 重試用盡：把錯誤丟回去，交還給 Next 原本的行為（整頁硬導航）。
    throw lastError instanceof Error ? lastError : new Error("RSC request failed");
  } as typeof fetch;
}

interface PatchedWindow extends Window {
  __wrRscRetryInstalled?: boolean;
}

/**
 * 把重試層裝到 `window.fetch` 上。回傳一個還原函式（重複安裝會被擋掉）。
 */
export function installRscFetchRetry(): () => void {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return () => {};
  const w = window as PatchedWindow;
  if (w.__wrRscRetryInstalled) return () => {};
  w.__wrRscRetryInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = createRetryingFetch(originalFetch);

  return () => {
    window.fetch = originalFetch;
    w.__wrRscRetryInstalled = false;
  };
}
