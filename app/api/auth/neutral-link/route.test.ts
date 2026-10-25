/**
 * /api/auth/neutral-link：中性網域自己寄登入信的守門測試。
 * - Host 白名單外一律 404、不碰 Supabase
 * - email 格式驗證
 * - 同 email / 同 IP 60 秒冷卻
 * - 連結指向中性網域的 /auth/callback?token_hash=...&type=...，信件無品牌字
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generateLink = vi.fn();
const sendNeutralEmail = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getServiceSupabase: () => ({ auth: { admin: { generateLink } } }),
}));
vi.mock("@/lib/shorten/redis", () => ({ getRedis: () => null }));
vi.mock("@/lib/email/neutral-smtp", () => ({
  neutralSmtpConfigured: () => !!process.env.NEUTRAL_SMTP_USER && !!process.env.NEUTRAL_SMTP_PASS,
  sendNeutralEmail: (m: unknown) => sendNeutralEmail(m),
}));

import { POST } from "./route";
import { __resetCooldownMemoryForTest, normalizeEmail, buildCallbackLink, isOtpLinkType } from "@/lib/auth/neutral-link";
import { BRAND_LEAK_RE } from "@/lib/brand-text";
import { neutralSignInEmail } from "@/lib/email/templates/neutral-sign-in";

const NEUTRAL = "furniture-blueprints.vercel.app";

function req(body: unknown, { host = NEUTRAL, ip = "1.1.1.1" }: { host?: string; ip?: string } = {}) {
  return new Request(`https://${host}/api/auth/neutral-link`, {
    method: "POST",
    headers: { host, "x-forwarded-for": ip, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function okLink(type: "magiclink" | "signup" = "magiclink") {
  generateLink.mockResolvedValue({
    data: { properties: { hashed_token: "abc123hash", verification_type: type } },
    error: null,
  });
}

beforeEach(() => {
  __resetCooldownMemoryForTest();
  generateLink.mockReset();
  sendNeutralEmail.mockReset();
  sendNeutralEmail.mockResolvedValue({ ok: true });
  vi.stubEnv("NEUTRAL_SMTP_USER", "furnitureblueprints@gmail.com");
  vi.stubEnv("NEUTRAL_SMTP_PASS", "x");
  vi.stubEnv("BRAND_FORCE_NEUTRAL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Host 白名單", () => {
  it("主站網域 → 404，不呼叫 generateLink", async () => {
    okLink();
    for (const host of ["designer.woodenren.com", "cnc.woodenren.com", "evil-furniture-blueprints.vercel.app"]) {
      const r = await POST(req({ email: "a@example.com" }, { host }));
      expect(r.status, host).toBe(404);
    }
    expect(generateLink).not.toHaveBeenCalled();
    expect(sendNeutralEmail).not.toHaveBeenCalled();
  });

  it("production：x-forwarded-host 切不到中性 → 404", async () => {
    vi.stubEnv("NODE_ENV", "production");
    okLink();
    const r = new Request("https://designer.woodenren.com/api/auth/neutral-link", {
      method: "POST",
      headers: { host: "designer.woodenren.com", "x-forwarded-host": NEUTRAL },
      body: JSON.stringify({ email: "a@example.com" }),
    });
    expect((await POST(r)).status).toBe(404);
    expect(generateLink).not.toHaveBeenCalled();
  });
});

describe("email 驗證", () => {
  it("格式錯 → 400 invalid_email", async () => {
    okLink();
    for (const email of ["", "abc", "a@b", "a b@c.com", "<x>@y.com", "a..b@c.com", 123, null]) {
      const r = await POST(req({ email }, { ip: `9.9.9.${String(email).length}` }));
      expect(r.status, String(email)).toBe(400);
      expect(await r.json()).toEqual({ error: "invalid_email" });
    }
    expect((await POST(req("not json"))).status).toBe(400);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("normalizeEmail：去空白、轉小寫", () => {
    expect(normalizeEmail("  Alex+Test@Gmail.COM ")).toBe("alex+test@gmail.com");
    expect(normalizeEmail("x".repeat(65) + "@a.com")).toBeNull();
  });
});

describe("寄信流程", () => {
  it("既有使用者：magiclink，連結指中性網域 callback，信件英文無品牌字", async () => {
    okLink("magiclink");
    const r = await POST(req({ email: "Alex@Example.com", next: "/en/design/stool?w=40" }));
    expect(r.status).toBe(200);
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "alex@example.com" });
    const mail = sendNeutralEmail.mock.calls[0][0] as { to: string; subject: string; text: string; html: string };
    expect(mail.to).toBe("alex@example.com");
    const link = new URL(mail.text.match(/https:\/\/\S+/)![0]);
    expect(link.origin).toBe(`https://${NEUTRAL}`);
    expect(link.pathname).toBe("/auth/callback");
    expect(link.searchParams.get("token_hash")).toBe("abc123hash");
    expect(link.searchParams.get("type")).toBe("magiclink");
    expect(link.searchParams.get("next")).toBe("/en/design/stool?w=40");
    for (const part of [mail.subject, mail.text, mail.html]) expect(part).not.toMatch(BRAND_LEAK_RE);
    expect(mail.html).toContain("Sign in to Furniture Blueprints");
  });

  it("新使用者：Supabase 回 verification_type=signup → 連結 type=signup、主旨是確認信", async () => {
    okLink("signup");
    expect((await POST(req({ email: "new@example.com" }))).status).toBe(200);
    const mail = sendNeutralEmail.mock.calls[0][0] as { subject: string; text: string };
    expect(mail.subject).toMatch(/Confirm your email/);
    expect(mail.text).toContain("type=signup");
  });

  it("next 不是本站路徑 → 清成 /", async () => {
    okLink();
    await POST(req({ email: "a@example.com", next: "//evil.com" }));
    const mail = sendNeutralEmail.mock.calls[0][0] as { text: string };
    expect(new URL(mail.text.match(/https:\/\/\S+/)![0]).searchParams.get("next")).toBe("/");
  });

  it("沒設 SMTP → 503，不先產連結", async () => {
    vi.stubEnv("NEUTRAL_SMTP_PASS", "");
    okLink();
    expect((await POST(req({ email: "a@example.com" }))).status).toBe(503);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("generateLink 失敗 / SMTP 失敗 → 非 200", async () => {
    generateLink.mockResolvedValue({ data: { properties: null }, error: { message: "boom", status: 500 } });
    expect((await POST(req({ email: "a@example.com" }, { ip: "2.2.2.2" }))).status).toBe(502);
    okLink();
    sendNeutralEmail.mockResolvedValue({ ok: false, error: "ECONNRESET" });
    expect((await POST(req({ email: "b@example.com" }, { ip: "3.3.3.3" }))).status).toBe(502);
  });
});

describe("60 秒冷卻", () => {
  it("同 email 換 IP、同 IP 換 email 都擋；兩者都不同才放行", async () => {
    okLink();
    expect((await POST(req({ email: "a@example.com" }, { ip: "5.5.5.5" }))).status).toBe(200);
    expect((await POST(req({ email: "a@example.com" }, { ip: "6.6.6.6" }))).status).toBe(429);
    expect((await POST(req({ email: "c@example.com" }, { ip: "5.5.5.5" }))).status).toBe(429);
    expect((await POST(req({ email: "d@example.com" }, { ip: "7.7.7.7" }))).status).toBe(200);
    expect(sendNeutralEmail).toHaveBeenCalledTimes(2);
  });

  it("60 秒後解除", async () => {
    vi.useFakeTimers();
    try {
      okLink();
      expect((await POST(req({ email: "t@example.com" }, { ip: "8.8.8.8" }))).status).toBe(200);
      expect((await POST(req({ email: "t@example.com" }, { ip: "8.8.8.8" }))).status).toBe(429);
      vi.advanceTimersByTime(61_000);
      expect((await POST(req({ email: "t@example.com" }, { ip: "8.8.8.8" }))).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("工具函式", () => {
  it("callback 只接受 magiclink / signup / email", () => {
    expect(isOtpLinkType("magiclink")).toBe(true);
    expect(isOtpLinkType("signup")).toBe(true);
    expect(isOtpLinkType("recovery")).toBe(false);
    expect(isOtpLinkType(null)).toBe(false);
  });

  it("buildCallbackLink 編碼正確", () => {
    const l = new URL(buildCallbackLink(`https://${NEUTRAL}`, "h&x", "magiclink", "/en/app"));
    expect(l.searchParams.get("token_hash")).toBe("h&x");
    expect(l.searchParams.get("next")).toBe("/en/app");
  });

  it("新使用者信件也沒有品牌字", () => {
    const m = neutralSignInEmail({ link: `https://${NEUTRAL}/auth/callback?token_hash=x&type=signup`, isNewUser: true });
    for (const part of [m.subject, m.text, m.html]) expect(part).not.toMatch(BRAND_LEAK_RE);
  });
});
