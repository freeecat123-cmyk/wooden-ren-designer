import { describe, it, expect } from "vitest";
import { pickLifecycleEmail, type LifecycleContext, type LifecycleUser } from "../lifecycle-rules";
import { lifecycleEmail, LIFECYCLE_EMAIL_KEYS } from "../templates/lifecycle";

const DAY = 86_400_000;
const LAUNCH = "2026-09-03T00:00:00+08:00";
const launchMs = new Date(LAUNCH).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

function user(over: Partial<LifecycleUser> = {}): LifecycleUser {
  return {
    id: "u1",
    email: "a@b.c",
    plan: "free",
    subscription_status: "inactive",
    created_at: iso(launchMs + DAY),
    ...over,
  };
}
function ctx(over: Partial<LifecycleContext> = {}): LifecycleContext {
  return {
    now: launchMs + 10 * DAY,
    hasDesign: false,
    hasAnySubscription: false,
    lastEndedSubscriptionExpiresAt: null,
    sent: {},
    ...over,
  };
}

describe("pickLifecycleEmail — 共通門檻", () => {
  it("非 free 不寄", () => {
    expect(pickLifecycleEmail(user({ plan: "pro" }), ctx())).toBeNull();
    expect(pickLifecycleEmail(user({ plan: "lifetime" }), ctx())).toBeNull();
  });
  it("subscription_status=active 不寄", () => {
    expect(pickLifecycleEmail(user({ subscription_status: "active" }), ctx())).toBeNull();
  });
  it("沒 email 不寄", () => {
    expect(pickLifecycleEmail(user({ email: null }), ctx())).toBeNull();
  });
});

describe("新註冊（LAUNCH 之後）", () => {
  const created = launchMs + DAY;
  it("滿 24h 且沒存設計 → new_d1", () => {
    expect(pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now: created + DAY }))).toBe("new_d1");
  });
  it("未滿 24h → 不寄", () => {
    expect(pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now: created + DAY - 1 }))).toBeNull();
  });
  it("滿 24h 但已存設計 → 跳過 d1，未滿 3 天不寄", () => {
    expect(pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now: created + 2 * DAY, hasDesign: true }))).toBeNull();
  });
  it("滿 3 天、d1 已寄 → new_d3", () => {
    expect(
      pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now: created + 3 * DAY, sent: { new_d1: iso(created + DAY) } })),
    ).toBe("new_d3");
  });
  it("滿 7 天、d1/d3 已寄 → new_d7；d7 也寄過 → null", () => {
    const sent = { new_d1: iso(created + DAY), new_d3: iso(created + 3 * DAY) };
    expect(pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now: created + 7 * DAY, sent }))).toBe("new_d7");
    expect(
      pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now: created + 8 * DAY, sent: { ...sent, new_d7: iso(created + 7 * DAY) } })),
    ).toBeNull();
  });
  it("同一輪只挑一封：滿 7 天什麼都沒寄過 → 先 d1", () => {
    expect(pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now: created + 7 * DAY }))).toBe("new_d1");
  });
  it("新註冊的人不會拿到 reengage", () => {
    const r = pickLifecycleEmail(
      user({ created_at: iso(created) }),
      ctx({ now: created + 7 * DAY, hasDesign: true, sent: { new_d3: "x", new_d7: "x" } }),
    );
    expect(r).toBeNull();
  });
});

describe("舊免費用戶（LAUNCH 之前註冊）", () => {
  const created = launchMs - 100 * DAY;
  it("沒訂閱過、沒寄過 → reengage_1", () => {
    expect(pickLifecycleEmail(user({ created_at: iso(created) }), ctx())).toBe("reengage_1");
  });
  it("reengage_1 寄出未滿 7 天 → 不寄", () => {
    const now = launchMs + 10 * DAY;
    expect(
      pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now, sent: { reengage_1: iso(now - 6 * DAY) } })),
    ).toBeNull();
  });
  it("reengage_1 寄出滿 7 天 → reengage_2；之後不再寄", () => {
    const now = launchMs + 10 * DAY;
    expect(
      pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ now, sent: { reengage_1: iso(now - 7 * DAY) } })),
    ).toBe("reengage_2");
    expect(
      pickLifecycleEmail(
        user({ created_at: iso(created) }),
        ctx({ now, sent: { reengage_1: iso(now - 14 * DAY), reengage_2: iso(now - 7 * DAY) } }),
      ),
    ).toBeNull();
  });
  it("舊用戶但訂閱過（沒到期紀錄）→ 不算 reengage、也不 winback", () => {
    expect(pickLifecycleEmail(user({ created_at: iso(created) }), ctx({ hasAnySubscription: true }))).toBeNull();
  });
});

describe("回流（訂閱到期 / 取消）", () => {
  const created = launchMs - 100 * DAY;
  it("到期超過 14 天 → winback", () => {
    const now = launchMs + 10 * DAY;
    expect(
      pickLifecycleEmail(
        user({ created_at: iso(created) }),
        ctx({ now, hasAnySubscription: true, lastEndedSubscriptionExpiresAt: iso(now - 15 * DAY) }),
      ),
    ).toBe("winback");
  });
  it("到期未滿 14 天 → 不寄", () => {
    const now = launchMs + 10 * DAY;
    expect(
      pickLifecycleEmail(
        user({ created_at: iso(created) }),
        ctx({ now, hasAnySubscription: true, lastEndedSubscriptionExpiresAt: iso(now - 13 * DAY) }),
      ),
    ).toBeNull();
  });
  it("winback 寄過 → 不再寄", () => {
    const now = launchMs + 10 * DAY;
    expect(
      pickLifecycleEmail(
        user({ created_at: iso(created) }),
        ctx({ now, hasAnySubscription: true, lastEndedSubscriptionExpiresAt: iso(now - 30 * DAY), sent: { winback: "x" } }),
      ),
    ).toBeNull();
  });
});

describe("lifecycleEmail 模板", () => {
  it("六封都有主旨、text 帶名字、html 有跳脫", () => {
    for (const k of LIFECYCLE_EMAIL_KEYS) {
      const m = lifecycleEmail(k, { name: "<b>阿仁</b>" });
      expect(m.subject.length).toBeGreaterThan(3);
      expect(m.text.startsWith("<b>阿仁</b>，")).toBe(true);
      expect(m.html).toContain("&lt;b&gt;阿仁&lt;/b&gt;");
      expect(m.html).not.toContain("<b>阿仁</b>");
      expect(m.html).toContain("木頭仁");
    }
  });
  it("沒名字用「你好」；網址變連結", () => {
    const m = lifecycleEmail("new_d1", { name: "  " });
    expect(m.text.startsWith("你好，")).toBe(true);
    expect(m.html).toContain('href="https://designer.woodenren.com/design/stool"');
  });
});
