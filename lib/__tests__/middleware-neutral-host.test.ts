/**
 * middleware 中性品牌網域分流：
 *  - 中性網域：沒有 /en 前綴 → 308 到 /en 同路徑；封鎖頁 → 307 到中性網域自己的 /en（不能導回 woodenren）
 *  - 主站 / CNC 網域：行為不變
 */
import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// next-intl 的 ESM 在 vitest 裡 import "next/server" 解析不到；這裡測的是我們自己的網域分流，
// intl 那段換成直接放行即可。
vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

const { default: middleware } = await import("@/middleware");

function req(url: string, host: string) {
  return new NextRequest(new URL(url, `https://${host}`), {
    headers: { host, "accept-language": "en-US" },
  });
}

describe("middleware：中性網域", () => {
  const HOST = "furniture-blueprints.vercel.app";

  it("封鎖頁導到中性網域自己的 /en（不導回 woodenren）", async () => {
    for (const p of ["/en/about", "/about", "/en/contact", "/en/cnc", "/en/changelog", "/en/chat", "/en/admin", "/en/pricing/student"]) {
      const res = await middleware(req(p, HOST));
      expect(res.status, p).toBe(307);
      expect(res.headers.get("location"), p).toBe(`https://${HOST}/en`);
    }
  });

  it("沒有 /en 前綴 → 308 到 /en 同路徑（保留 query）", async () => {
    const r1 = await middleware(req("/", HOST));
    expect(r1.status).toBe(308);
    expect(r1.headers.get("location")).toBe(`https://${HOST}/en`);
    const r2 = await middleware(req("/design/stool?length=500", HOST));
    expect(r2.status).toBe(308);
    expect(r2.headers.get("location")).toBe(`https://${HOST}/en/design/stool?length=500`);
  });

  it("開放的 /en 頁面放行（不轉址）", async () => {
    for (const p of ["/en/pricing", "/en/design/stool", "/en/templates/stool", "/en/login"]) {
      const res = await middleware(req(p, HOST));
      expect([200, undefined].includes(res.status) || res.status < 300, p).toBe(true);
      expect(res.headers.get("location"), p).toBeNull();
    }
  });

  it("//evil.com 開放重導不成立", async () => {
    const res = await middleware(req("https://" + HOST + "//evil.com/x", HOST));
    const loc = res.headers.get("location") ?? "";
    expect(loc.startsWith(`https://${HOST}/`)).toBe(true);
  });
});

describe("middleware：主站 / CNC 網域不變", () => {
  it("designer.woodenren.com 的 /about、/en/about 不轉址", async () => {
    for (const p of ["/about", "/en/about", "/en/pricing"]) {
      const res = await middleware(req(p, "designer.woodenren.com"));
      expect(res.headers.get("location"), p).toBeNull();
    }
  });

  it("cnc.woodenren.com 的非白名單頁仍 308 回主站", async () => {
    const res = await middleware(req("/about", "cnc.woodenren.com"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://designer.woodenren.com/about");
  });
});
