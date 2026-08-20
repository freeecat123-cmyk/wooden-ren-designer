import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// getRedis 是唯一的外部相依，整支測試靠 mock 它來模擬三種狀態：
// 沒設環境變數、Redis 正常、Redis 拋錯。
const getRedis = vi.fn();
vi.mock("@/lib/shorten/redis", () => ({ getRedis: () => getRedis() }));

const { checkIpRateLimit, getClientIp } = await import("./ip-rate-limit");

describe("getClientIp", () => {
  it("優先取 x-forwarded-for 的第一段", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });
  it("沒有任何 header 時回 unknown", () => {
    expect(getClientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("checkIpRateLimit", () => {
  beforeEach(() => { getRedis.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("沒設 Upstash 環境變數時直接放行", async () => {
    getRedis.mockReturnValue(null);
    expect(await checkIpRateLimit({ prefix: "t", ip: "1.1.1.1", perDay: 5 })).toEqual({
      ok: true, remaining: 5,
    });
  });

  it("未達上限放行、超過上限擋下", async () => {
    getRedis.mockReturnValue({ incr: vi.fn().mockResolvedValue(3), expire: vi.fn() });
    expect((await checkIpRateLimit({ prefix: "t", ip: "1.1.1.1", perDay: 5 })).ok).toBe(true);
    getRedis.mockReturnValue({ incr: vi.fn().mockResolvedValue(6), expire: vi.fn() });
    expect((await checkIpRateLimit({ prefix: "t", ip: "1.1.1.1", perDay: 5 })).ok).toBe(false);
  });

  it("⭐ Redis 拋錯時要放行，不可讓例外往上炸掉呼叫端", async () => {
    // 2026-08-20 正式站事故：Upstash 連不上 → incr 拋錯 → 這支 helper 沒有 try/catch
    // → /api/pdf-font、/api/design/shorten、/api/quote/shorten、/api/ceiling/share
    // 四個 endpoint 的每一個 POST 都變成 500，連「參數格式錯誤」都還沒檢查就掛了。
    // 限流器的職責是「擋過量」，不是「決定服務生死」；它壞掉時應該讓路，
    // 跟「沒設環境變數就放行」是同一個取捨。
    const err = new Error("upstash unreachable");
    getRedis.mockReturnValue({ incr: vi.fn().mockRejectedValue(err), expire: vi.fn() });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await checkIpRateLimit({ prefix: "t", ip: "1.1.1.1", perDay: 5 });

    expect(r.ok).toBe(true);
    expect(spy).toHaveBeenCalled(); // 放行但要留下痕跡，否則 Redis 掛了沒人知道
  });

  it("expire 拋錯也不能影響這次判定", async () => {
    getRedis.mockReturnValue({
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockRejectedValue(new Error("boom")),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await checkIpRateLimit({ prefix: "t", ip: "1.1.1.1", perDay: 5 })).ok).toBe(true);
  });
});
