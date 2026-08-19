import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/pdf-font", () => {
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
});
