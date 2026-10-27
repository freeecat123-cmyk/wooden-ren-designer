/**
 * 中性品牌（Furniture Blueprints）網域分流的守門測試。
 *
 * 1. en.json 轉換後整包不能有任何 Wooden Ren / woodenren / 木頭仁 / 200K / YouTuber
 * 2. 模板行銷文案（marketing-en.ts）轉換後同樣乾淨
 * 3. Lemon Squeezy 三封英文信 + 英文歡迎信轉換後乾淨、LINE 連結拿掉、連結指中性網域
 * 4. 網域白名單 / 允許路徑 / 本機強制開關只在非 production 生效
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import en from "@/messages/en.json";
import { neutralizeMessages, neutralizeText, BRAND_LEAK_RE, KEY_OVERRIDES } from "@/lib/brand-text";
import {
  NEUTRAL_HOSTS,
  allowedOnNeutralHost,
  brandFromHeaders,
  isNeutralHost,
  neutralOrigin,
} from "@/lib/brand-hosts";
import { TEMPLATE_MARKETING_EN } from "@/lib/templates/marketing-en";
import { lemonUnlockSuccessEmail } from "@/lib/email/templates/lemon-single-template-success";
import { lemonSubscriptionActivatedEmail } from "@/lib/email/templates/lemon-subscription-activated";
import { lemonPaymentFailedEmail } from "@/lib/email/templates/lemon-payment-failed";
import { welcomeEmail } from "@/lib/email/templates/welcome";
import { isNeutralCustomData, neutralizeEmail } from "@/lib/email/brand";

const ORIGIN = `https://${NEUTRAL_HOSTS[0]}`;

function collectLeaks(node: unknown, path = "", out: string[] = []): string[] {
  if (typeof node === "string") {
    if (BRAND_LEAK_RE.test(node)) out.push(`${path} = ${node.slice(0, 160)}`);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => collectLeaks(v, `${path}.${i}`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) collectLeaks(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

function countStrings(node: unknown): number {
  if (typeof node === "string") return 1;
  if (Array.isArray(node)) return node.reduce((n: number, v) => n + countStrings(v), 0);
  if (node && typeof node === "object") return Object.values(node).reduce((n: number, v) => n + countStrings(v), 0);
  return 0;
}

describe("en.json 中性化", () => {
  const out = neutralizeMessages(en, ORIGIN);

  it("轉換前確實有品牌字（測試本身會失敗得了）", () => {
    expect(collectLeaks(en).length).toBeGreaterThan(50);
  });

  it("轉換後整包沒有 /wooden ?ren|woodenren|木頭仁|200K|YouTuber/i", () => {
    expect(collectLeaks(out)).toEqual([]);
  });

  it("結構不變：字串數量相同、不改原物件", () => {
    expect(countStrings(out)).toBe(countStrings(en));
    expect((en as { common: { siteName: string } }).common.siteName).toMatch(/Wooden Ren/);
  });

  it("主要品牌字換成 Furniture Blueprints、網域換成中性網域", () => {
    const o = out as typeof en;
    expect(o.common.siteName).toBe("Furniture Blueprints");
    expect(o.login.brandName).toBe("Furniture Blueprints");
    expect(o.landing.faq.sourceA).toContain(NEUTRAL_HOSTS[0]);
    expect(JSON.stringify(out)).not.toMatch(/Keelung City|Dongshi St|Bin-Ren Weng/);
  });

  it("KEY_OVERRIDES 的每個 key 都真的存在於 en.json（防 key 改名後覆寫失效）", () => {
    const get = (p: string) => p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en);
    const missing = Object.keys(KEY_OVERRIDES).filter((k) => typeof get(k) !== "string");
    expect(missing).toEqual([]);
  });

  it("模板行銷文案（marketing-en.ts）中性化後乾淨，且沒有「幾秒出圖」的假宣稱", () => {
    expect(collectLeaks(TEMPLATE_MARKETING_EN).length).toBeGreaterThan(0);
    expect(collectLeaks(neutralizeMessages(TEMPLATE_MARKETING_EN, ORIGIN))).toEqual([]);
    // 中文站一律寫「3 分鐘」。英文版 23 處誤譯成 three seconds / Three-second，
    // 等於對英文客人自誇快 60 倍（2026-10-27 修）。「3-view」不在規則內，別誤抓。
    expect(JSON.stringify(TEMPLATE_MARKETING_EN).match(/(?:three|3)[ -]seconds?/gi) ?? []).toEqual([]);
  });

  it("neutralizeText 不會疊出重複品牌名", () => {
    expect(neutralizeText("Wooden Ren Carpentry Academy · Furniture Blueprints v0.5", ORIGIN)).toBe(
      "Furniture Blueprints v0.5",
    );
  });
});

describe("寄信中性化", () => {
  const mails = {
    unlock: lemonUnlockSuccessEmail({ kind: "template", itemLabel: "stool", amount: 9, itemHref: "/en/design/stool" }),
    lifetime: lemonUnlockSuccessEmail({ kind: "lifetime", itemLabel: "Lifetime", amount: 129, itemHref: "/en/app" }),
    sub: lemonSubscriptionActivatedEmail({ planLabel: "Pro Monthly", renewsAt: "2026-11-25T00:00:00Z", amount: 9 }),
    failed: lemonPaymentFailedEmail({ planLabel: "Pro Monthly", amount: 9, reason: "card_declined", attemptNumber: undefined }),
    welcome: welcomeEmail({ name: "Alex", locale: "en" }),
  };

  for (const [name, mail] of Object.entries(mails)) {
    it(`${name}：轉換後 subject/text/html 都沒有品牌字、沒有 LINE、連結指中性網域`, () => {
      const n = neutralizeEmail(mail, ORIGIN);
      for (const part of [n.subject, n.text, n.html]) {
        expect(part).not.toMatch(BRAND_LEAK_RE);
        expect(part).not.toMatch(/lin\.ee|LINE official/i);
      }
      if (/https?:\/\//.test(mail.text)) expect(n.text).toContain(NEUTRAL_HOSTS[0]);
    });
  }

  it("custom_data.brand 判斷", () => {
    expect(isNeutralCustomData({ user_id: "u", brand: "neutral" })).toBe(true);
    expect(isNeutralCustomData({ user_id: "u" })).toBe(false);
    expect(isNeutralCustomData(undefined)).toBe(false);
  });
});

describe("網域判斷", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  const H = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

  it("白名單網域（含 port / 大小寫）才是中性", () => {
    expect(isNeutralHost("furniture-blueprints.vercel.app")).toBe(true);
    expect(isNeutralHost("Furniture-Blueprints.vercel.app:443")).toBe(true);
    expect(isNeutralHost("designer.woodenren.com")).toBe(false);
    expect(isNeutralHost("cnc.woodenren.com")).toBe(false);
    expect(isNeutralHost("evil-furniture-blueprints.vercel.app")).toBe(false);
  });

  it("neutralOrigin 不接受白名單外的 host（不能信任任意 Host 組回跳網址）", () => {
    expect(neutralOrigin("furniture-blueprints.vercel.app")).toBe("https://furniture-blueprints.vercel.app");
    expect(neutralOrigin("evil.com")).toBe(`https://${NEUTRAL_HOSTS[0]}`);
  });

  it("production 只看 Host：x-forwarded-host / BRAND_FORCE_NEUTRAL 都切不過去", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BRAND_FORCE_NEUTRAL", "1");
    expect(brandFromHeaders(H({ host: "designer.woodenren.com", "x-forwarded-host": NEUTRAL_HOSTS[0] }))).toBe("woodenren");
    expect(brandFromHeaders(H({ host: NEUTRAL_HOSTS[0] }))).toBe("neutral");
  });

  it("非 production 可用 x-forwarded-host 或 BRAND_FORCE_NEUTRAL 模擬", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(brandFromHeaders(H({ host: "localhost:3078", "x-forwarded-host": NEUTRAL_HOSTS[0] }))).toBe("neutral");
    expect(brandFromHeaders(H({ host: "localhost:3078" }))).toBe("woodenren");
    vi.stubEnv("BRAND_FORCE_NEUTRAL", "1");
    expect(brandFromHeaders(H({ host: "localhost:3078" }))).toBe("neutral");
  });

  it("允許路徑（/en 前綴剝掉後比對）", () => {
    for (const p of ["/en", "/en/app", "/en/templates/stool", "/en/design/stool/print", "/en/pricing", "/en/login",
      "/en/auth/error", "/en/my-subscription", "/en/account/designs", "/en/projects/abc", "/en/shared-design/t", "/en/install",
      "/en/terms", "/en/privacy", "/en/refund", "/en/help", "/en/workbench"]) {
      expect(allowedOnNeutralHost(p), p).toBe(true);
    }
    for (const p of ["/en/about", "/en/contact", "/en/cnc", "/en/ceiling", "/en/floor", "/en/raised-floor", "/en/research",
      "/en/admin", "/en/changelog", "/en/calc", "/en/chat", "/en/customers", "/en/survey/x", "/en/pricing/student"]) {
      expect(allowedOnNeutralHost(p), p).toBe(false);
    }
  });
});
