/**
 * 英文瀏覽器的語言跳轉：根 `/` + 家具介紹頁 `/templates`、`/templates/<slug>`（2026-11-04）。
 * 只做中文的範本沒有英文頁 → 不跳；/design 等其他路徑維持不跳。
 */
import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { ZH_ONLY_CATEGORIES } from "@/lib/templates/zh-only";

vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

const { default: middleware } = await import("@/middleware");
const HOST = "designer.woodenren.com";

function req(path: string, lang: string, cookie?: string) {
  const headers: Record<string, string> = { host: HOST };
  if (lang) headers["accept-language"] = lang;
  if (cookie) headers.cookie = cookie;
  return new NextRequest(new URL(path, `https://${HOST}`), { headers });
}
const loc = (r: Response) => r.headers.get("location");

describe("英文偵測:/templates", () => {
  it("英文瀏覽器 /templates/stool → /en/templates/stool(保留 query)", async () => {
    const r = await middleware(req("/templates/stool?x=1", "en-US,en;q=0.9"));
    expect(r.status).toBe(307);
    expect(loc(r)).toBe(`https://${HOST}/en/templates/stool?x=1`);
  });

  it("英文瀏覽器 /templates → /en/templates", async () => {
    const r = await middleware(req("/templates", "en-GB"));
    expect(loc(r)).toBe(`https://${HOST}/en/templates`);
  });

  it("根 / 行為不變", async () => {
    expect(loc(await middleware(req("/", "en-US")))).toBe(`https://${HOST}/en`);
  });

  it("中文瀏覽器、爬蟲(無 Accept-Language)、手動選過語言都不跳", async () => {
    for (const [lang, cookie] of [["zh-TW,zh;q=0.9", undefined], ["zh-CN", undefined], ["", undefined], ["en-US", "NEXT_LOCALE=zh-TW"]] as const) {
      const r = await middleware(req("/templates/stool", lang, cookie));
      expect(loc(r) ?? "", `${lang}|${cookie}`).not.toContain("/en/templates");
    }
  });

  it("只做中文的範本不跳(沒有英文頁)", async () => {
    for (const s of ZH_ONLY_CATEGORIES) {
      const r = await middleware(req(`/templates/${s}`, "en-US"));
      expect(loc(r) ?? "", s).not.toContain("/en/templates");
    }
  });

  it("其他路徑維持不跳(/design、/pricing、/templates 子路徑)", async () => {
    for (const p of ["/design/stool", "/pricing", "/templates/stool/extra"]) {
      const r = await middleware(req(p, "en-US"));
      expect(loc(r) ?? "", p).not.toContain(`/en${p}`);
    }
  });
});

describe("zh-only 清單跟目錄同步", () => {
  it("ZH_ONLY_CATEGORIES === FURNITURE_CATALOG 裡 zhOnly 的那幾款", () => {
    const fromCatalog = FURNITURE_CATALOG.filter((e) => e.zhOnly).map((e) => e.category).sort();
    expect([...ZH_ONLY_CATEGORIES].sort()).toEqual(fromCatalog);
  });
});
