import { describe, it, expect, vi, beforeEach } from "vitest";

// Upstash 在測試環境沒設 UPSTASH_REDIS_REST_URL/TOKEN，checkIpRateLimit 會走
// getRedis() 回 null 的 fallback，永遠回 ok:true，無法測到真正的 429。改用
// vi.mock 直接控制回傳值：驗證 handler 有正確呼叫 checkIpRateLimit（prefix /
// perDay），且回傳 ok:false 時 handler 真的回 429，而不是硬造一個假斷言。
const { mockCheckIpRateLimit } = vi.hoisted(() => ({
  mockCheckIpRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/ip-rate-limit", () => ({
  checkIpRateLimit: mockCheckIpRateLimit,
  getClientIp: () => "127.0.0.1",
}));

import { POST } from "./route";

describe("POST /api/pdf-font", () => {
  beforeEach(() => {
    mockCheckIpRateLimit.mockReset();
    mockCheckIpRateLimit.mockResolvedValue({ ok: true, remaining: 199 });
  });

  it("回傳子集 TTF，且明顯小於全字庫", async () => {
    const req = new Request("http://localhost/api/pdf-font", {
      method: "POST",
      body: JSON.stringify({ chars: "凳腳牙條座板松木榫眼P-01×4" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(buf.byteLength).toBeLessThan(500_000);
  });

  it("chars 空字串回 400", async () => {
    const req = new Request("http://localhost/api/pdf-font", {
      method: "POST",
      body: JSON.stringify({ chars: "" }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("chars 不是字串（數字）回 400，而不是 500", async () => {
    const req = new Request("http://localhost/api/pdf-font", {
      method: "POST",
      body: JSON.stringify({ chars: 123 }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("chars 超過 MAX_CHARS 回 400", async () => {
    // 遠超過單張樣板實測的 47 字，也遠超過整包上限 2000
    const longChars = "字".repeat(2001);
    const req = new Request("http://localhost/api/pdf-font", {
      method: "POST",
      body: JSON.stringify({ chars: longChars }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("rate limit 觸發時回 429，且用正確 prefix/perDay 呼叫 checkIpRateLimit", async () => {
    mockCheckIpRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0 });
    const req = new Request("http://localhost/api/pdf-font", {
      method: "POST",
      body: JSON.stringify({ chars: "凳腳" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(mockCheckIpRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "pdf-font", perDay: 200 }),
    );
  });
});
