import { describe, expect, it } from "vitest";
import { createRetryingFetch, isRetryableStatus, isRscGet, MAX_RETRIES } from "./rsc-retry";

/** 測試用：不真的睡、不真的等連線。 */
const fastDeps = { sleep: async () => {}, waitForOnline: async () => {} };

function okResponse(status = 200) {
  return new Response("ok", { status });
}

/** 記錄每次呼叫的假 fetch；`plan` 決定第 n 次要成功還是失敗。 */
function fakeFetch(plan: Array<"fail" | number>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const i = calls.length;
    calls.push({ url: String(input), init });
    const outcome = plan[i] ?? 200;
    if (outcome === "fail") throw new TypeError("Failed to fetch");
    return okResponse(outcome);
  }) as typeof fetch;
  return { fn, calls };
}

const RSC_INIT: RequestInit = { headers: { RSC: "1" } };

describe("isRscGet", () => {
  it("認得普通物件 header 上的 RSC", () => {
    expect(isRscGet("/design/stool", RSC_INIT)).toBe(true);
  });

  it("認得 Headers 物件與陣列形式（大小寫都要認）", () => {
    expect(isRscGet("/design/stool", { headers: new Headers({ rsc: "1" }) })).toBe(true);
    expect(isRscGet("/design/stool", { headers: [["Rsc", "1"]] })).toBe(true);
  });

  it("認得網址上的 _rsc= query", () => {
    expect(isRscGet("/design/stool?legSize=35&_rsc=abc123")).toBe(true);
  });

  it("一般請求不算", () => {
    expect(isRscGet("/api/quote")).toBe(false);
    expect(isRscGet("/design/stool", { headers: { "content-type": "text/html" } })).toBe(false);
  });

  it("⭐ POST 一律不算 —— Server Action / 結帳絕不能被重送", () => {
    expect(isRscGet("/design/stool", { method: "POST", headers: { RSC: "1" } })).toBe(false);
    expect(isRscGet("/checkout?_rsc=abc", { method: "post" })).toBe(false);
  });
});

describe("isRetryableStatus", () => {
  it("5xx / 408 / 429 要重試，4xx 其餘不重試", () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe("createRetryingFetch", () => {
  it("網路失敗一次 → 重試後成功，呼叫端完全不知道出過事", async () => {
    const { fn, calls } = fakeFetch(["fail", 200]);
    const res = await createRetryingFetch(fn, fastDeps)("/design/stool", RSC_INIT);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("連續失敗到用盡重試 → 把錯誤丟回去（交還 Next 原本的硬導航行為）", async () => {
    const { fn, calls } = fakeFetch(["fail", "fail", "fail", "fail"]);
    await expect(
      createRetryingFetch(fn, fastDeps)("/design/stool", RSC_INIT),
    ).rejects.toThrow();
    expect(calls).toHaveLength(MAX_RETRIES + 1); // 第一次 + 2 次重試
  });

  it("5xx 也重試，拿到 200 就回傳", async () => {
    const { fn, calls } = fakeFetch([503, 200]);
    const res = await createRetryingFetch(fn, fastDeps)("/design/stool", RSC_INIT);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
  });

  it("404 不重試，直接把 response 交回去", async () => {
    const { fn, calls } = fakeFetch([404]);
    const res = await createRetryingFetch(fn, fastDeps)("/design/stool", RSC_INIT);
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it("⭐ 非 RSC 請求原封不動轉發，失敗就是失敗（不重試）", async () => {
    const { fn, calls } = fakeFetch(["fail", 200]);
    await expect(createRetryingFetch(fn, fastDeps)("/api/quote")).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("⭐ POST 不重試 —— 重試等於重複送出訂單", async () => {
    const { fn, calls } = fakeFetch(["fail", 200]);
    await expect(
      createRetryingFetch(fn, fastDeps)("/design/stool", { method: "POST", headers: { RSC: "1" } }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("AbortError 不重試 —— 那是 Next 自己取消導航（使用者又動了參數）", async () => {
    const abort = (async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as typeof fetch;
    let calls = 0;
    const counting = (async (...args: Parameters<typeof fetch>) => {
      calls++;
      return abort(...args);
    }) as typeof fetch;
    await expect(
      createRetryingFetch(counting, fastDeps)("/design/stool", RSC_INIT),
    ).rejects.toThrow("aborted");
    expect(calls).toBe(1);
  });

  it("重試之間有等待，而且離線時會先等回到線上", async () => {
    const order: string[] = [];
    const { fn } = fakeFetch(["fail", 200]);
    await createRetryingFetch(fn, {
      sleep: async () => { order.push("sleep"); },
      waitForOnline: async () => { order.push("online"); },
    })("/design/stool", RSC_INIT);
    expect(order).toEqual(["online", "sleep"]); // 先等連線回來，再 backoff
  });
});
