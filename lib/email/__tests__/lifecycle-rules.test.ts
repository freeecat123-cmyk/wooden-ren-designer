import { describe, it, expect } from "vitest";
import { pickLifecycleEmail, type LifecycleContext, type LifecycleUser } from "../lifecycle-rules";
import { lifecycleEmail, LIFECYCLE_EMAIL_KEYS, parseSendKey } from "../templates/lifecycle";

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
    expect(m.html).toContain('href="https://designer.woodenren.com/workbench"');
    expect(m.text).toContain("先把你的工作桌畫出來");
  });
});

// ── 2026-09-03 晚加的三類 ─────────────────────────────────────────────────────
describe("post_purchase_photo — 買後 7 天要照片", () => {
  const now = launchMs + 30 * DAY;
  it("買滿 7 天 → 寄，且不看 plan（pro 也寄）", () => {
    expect(
      pickLifecycleEmail(user({ plan: "pro", subscription_status: "active" }), ctx({ now, lastPurchaseAt: iso(now - 7 * DAY) })),
    ).toBe("post_purchase_photo");
    expect(pickLifecycleEmail(user(), ctx({ now, lastPurchaseAt: iso(now - 6 * DAY) }))).toBe("post_purchase_photo");
    expect(pickLifecycleEmail(user(), ctx({ now, lastPurchaseAt: iso(now - 8 * DAY) }))).toBe("post_purchase_photo");
  });
  it("窗外不寄（5 天 / 9 天）", () => {
    expect(pickLifecycleEmail(user({ plan: "pro" }), ctx({ now, lastPurchaseAt: iso(now - 5 * DAY) }))).toBeNull();
    expect(pickLifecycleEmail(user({ plan: "pro" }), ctx({ now, lastPurchaseAt: iso(now - 9 * DAY) }))).toBeNull();
  });
  it("寄過不再寄；沒買過不寄", () => {
    expect(
      pickLifecycleEmail(user({ plan: "pro" }), ctx({ now, lastPurchaseAt: iso(now - 7 * DAY), sent: { post_purchase_photo: "x" } })),
    ).toBeNull();
    expect(pickLifecycleEmail(user({ plan: "pro" }), ctx({ now, lastPurchaseAt: null }))).toBeNull();
  });
  it("優先於其他信（同時符合 reengage_1 也先寄照片信）", () => {
    expect(
      pickLifecycleEmail(user({ created_at: iso(launchMs - 30 * DAY) }), ctx({ now, lastPurchaseAt: iso(now - 7 * DAY) })),
    ).toBe("post_purchase_photo");
  });
});

describe("checkout_abandoned — 結帳沒付", () => {
  const now = launchMs + 30 * DAY;
  const HOUR = 3_600_000;
  // 用 LAUNCH 後註冊但還不到 24h 的人，避免撞 new_d1；或直接 sent 掉舊信
  const base = () => user({ created_at: iso(launchMs + 1 * DAY) });
  const sentOld = { new_d1: "x", new_d3: "x", new_d7: "x" } as const;
  it("pending 24～72h 前、之後沒買 → 寄", () => {
    expect(pickLifecycleEmail(base(), ctx({ now, sent: sentOld, lastPendingCheckoutAt: iso(now - 30 * HOUR) }))).toBe("checkout_abandoned");
    expect(pickLifecycleEmail(base(), ctx({ now, sent: sentOld, lastPendingCheckoutAt: iso(now - 71 * HOUR) }))).toBe("checkout_abandoned");
  });
  it("太新（12h）或太舊（80h）不寄", () => {
    expect(pickLifecycleEmail(base(), ctx({ now, sent: sentOld, lastPendingCheckoutAt: iso(now - 12 * HOUR) }))).toBeNull();
    expect(pickLifecycleEmail(base(), ctx({ now, sent: sentOld, lastPendingCheckoutAt: iso(now - 80 * HOUR) }))).toBeNull();
  });
  it("pending 之後有買（成功付款 / 買斷）→ 不寄；買在 pending 之前 → 照寄", () => {
    expect(
      pickLifecycleEmail(base(), ctx({ now, sent: { ...sentOld, post_purchase_photo: "x" }, lastPendingCheckoutAt: iso(now - 30 * HOUR), lastPurchaseAt: iso(now - 20 * HOUR) })),
    ).toBeNull();
    expect(
      pickLifecycleEmail(base(), ctx({ now, sent: sentOld, lastPendingCheckoutAt: iso(now - 30 * HOUR), lastPurchaseAt: iso(now - 20 * DAY) })),
    ).toBe("checkout_abandoned");
  });
  it("非 free / active / 寄過 → 不寄", () => {
    expect(pickLifecycleEmail(user({ plan: "personal" }), ctx({ now, lastPendingCheckoutAt: iso(now - 30 * HOUR) }))).toBeNull();
    expect(pickLifecycleEmail(base(), ctx({ now, sent: { ...sentOld, checkout_abandoned: "x" }, lastPendingCheckoutAt: iso(now - 30 * HOUR) }))).toBeNull();
  });
  it("排在新註冊三封之前", () => {
    expect(pickLifecycleEmail(base(), ctx({ now, lastPendingCheckoutAt: iso(now - 30 * HOUR) }))).toBe("checkout_abandoned");
  });
});

describe("viewed_template_<c> — 看過付費範本沒買", () => {
  const now = launchMs + 30 * DAY;
  const sentOld = { new_d1: iso(now - 20 * DAY), new_d3: iso(now - 20 * DAY), new_d7: iso(now - 20 * DAY) } as const;
  const base = () => user({ created_at: iso(launchMs + 1 * DAY) });
  it("3～10 天前看過、沒買 → viewed_template_<category>，挑最近的那款", () => {
    expect(
      pickLifecycleEmail(base(), ctx({ now, sent: sentOld, templateViews: [
        { category: "wardrobe", viewedAt: iso(now - 8 * DAY) },
        { category: "shoe-cabinet", viewedAt: iso(now - 4 * DAY) },
      ] })),
    ).toBe("viewed_template_shoe-cabinet");
  });
  it("窗外（2 天 / 11 天）不寄", () => {
    expect(pickLifecycleEmail(base(), ctx({ now, sent: sentOld, templateViews: [{ category: "wardrobe", viewedAt: iso(now - 2 * DAY) }] }))).toBeNull();
    expect(pickLifecycleEmail(base(), ctx({ now, sent: sentOld, templateViews: [{ category: "wardrobe", viewedAt: iso(now - 11 * DAY) }] }))).toBeNull();
  });
  it("那款已買斷 → 跳過它挑別款；全買斷 → 不寄", () => {
    expect(
      pickLifecycleEmail(base(), ctx({ now, sent: sentOld, unlockedCategories: ["shoe-cabinet"], templateViews: [
        { category: "wardrobe", viewedAt: iso(now - 8 * DAY) },
        { category: "shoe-cabinet", viewedAt: iso(now - 4 * DAY) },
      ] })),
    ).toBe("viewed_template_wardrobe");
    expect(
      pickLifecycleEmail(base(), ctx({ now, sent: sentOld, unlockedCategories: ["wardrobe"], templateViews: [{ category: "wardrobe", viewedAt: iso(now - 5 * DAY) }] })),
    ).toBeNull();
  });
  it("每人只寄一款：收過任何 viewed_template_* 就不再寄", () => {
    expect(
      pickLifecycleEmail(base(), ctx({ now, sent: { ...sentOld, ["viewed_template_desk"]: iso(now - 15 * DAY) }, templateViews: [{ category: "wardrobe", viewedAt: iso(now - 5 * DAY) }] })),
    ).toBeNull();
  });
  it("3 天內剛收過別封 → 這輪不寄（補位不轟炸）", () => {
    expect(
      pickLifecycleEmail(base(), ctx({ now, sent: { ...sentOld, new_d7: iso(now - 1 * DAY) }, templateViews: [{ category: "wardrobe", viewedAt: iso(now - 5 * DAY) }] })),
    ).toBeNull();
  });
  it("排在舊六封之後（同時符合 new_d3 先寄 new_d3）", () => {
    expect(
      pickLifecycleEmail(user({ created_at: iso(now - 4 * DAY) }), ctx({ now, sent: { new_d1: iso(now - 3 * DAY) }, templateViews: [{ category: "wardrobe", viewedAt: iso(now - 3.5 * DAY) }] })),
    ).toBe("new_d3");
  });
  it("非 free 不寄", () => {
    expect(pickLifecycleEmail(user({ plan: "personal" }), ctx({ now, templateViews: [{ category: "wardrobe", viewedAt: iso(now - 5 * DAY) }] }))).toBeNull();
  });
});

describe("新三封的模板", () => {
  it("parseSendKey 拆得出款名", () => {
    expect(parseSendKey("viewed_template_shoe-cabinet")).toEqual({ key: "viewed_template", category: "shoe-cabinet" });
    expect(parseSendKey("winback")).toEqual({ key: "winback" });
  });
  it("viewed_template 帶款名 / 連結 / 提示 / 價格", () => {
    const m = lifecycleEmail("viewed_template", { name: "阿仁", vars: { category: "wardrobe", label: "衣櫃", hint: "吊衣桿深度 55 公分起", price: 499, link: "https://designer.woodenren.com/design/wardrobe" } });
    expect(m.subject).toBe("你上週看的衣櫃設計圖");
    expect(m.text).toContain("開過衣櫃的設計圖");
    expect(m.text).toContain("吊衣桿深度 55 公分起。");
    expect(m.text).toContain("買斷，499 元");
    expect(m.html).toContain('href="https://designer.woodenren.com/design/wardrobe"');
    expect(m.text).not.toMatch(/\{\{/);
  });
  it("viewed_template 沒 hint / 沒價格也不留佔位符", () => {
    const m = lifecycleEmail("viewed_template", { name: null, vars: { category: "bed", label: "床架" } });
    expect(m.text).not.toMatch(/\{\{/);
    expect(m.text).toContain("可以單獨買斷，永久是你的");
    expect(m.text).toContain("https://designer.woodenren.com/design/bed");
  });
  it("checkout_abandoned 帶 link；沒 link 退 pricing", () => {
    expect(lifecycleEmail("checkout_abandoned", { vars: { link: "https://designer.woodenren.com/design/desk" } }).text).toContain("https://designer.woodenren.com/design/desk");
    expect(lifecycleEmail("checkout_abandoned", {}).text).toContain("https://designer.woodenren.com/pricing");
  });
  it("post_purchase_photo 主旨固定", () => {
    expect(lifecycleEmail("post_purchase_photo", {}).subject).toBe("做出來了嗎？");
  });
});
