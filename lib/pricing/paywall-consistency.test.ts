import { describe, it, expect } from "vitest";
import { getEffectivePlan, canUseFeature } from "@/lib/permissions";

/**
 * 付費牆只能有**一套**判準。
 *
 * 2026-08-24 大軍稽核抓到：`lib/userProfile.ts` 的 `isPaidUser()` 自己寫了
 * 「subscription_status !== 'active' → false」，跟 `permissions.ts` 的
 * `getEffectivePlan()` 不一致 →
 * 使用者一按「取消訂閱」（status 變 cancelled、付費期還沒到）就當場失去
 * 列印 / 裁切 / 報價，但設計頁上那些按鈕還在（它們走 permissions），
 * 點下去直接被踢到 /pricing。付到 9/4、8/4 就沒得用。
 *
 * 取消訂閱只是停止下次扣款，該期的錢已經收了 —— 這條規則整套後端都在遵守，
 * 只有那一支沒跟上。這支測試就是防止第二套判準再長出來。
 */
const future = new Date(Date.now() + 30 * 86400_000).toISOString();
const past = new Date(Date.now() - 30 * 86400_000).toISOString();

const profile = (over: Record<string, unknown>) => ({
  plan: "pro",
  subscription_status: "active",
  subscription_expires_at: future,
  student_expires_at: null,
  ...over,
}) as never;

describe("取消訂閱但還沒到期 = 仍然有權限", () => {
  it("cancelled + 未到期 → 方案仍是 pro（跟 active 一樣）", () => {
    expect(getEffectivePlan(profile({ subscription_status: "cancelled" }))).toBe("pro");
    expect(getEffectivePlan(profile({}))).toBe("pro");
  });

  it("cancelled + 未到期 → 列印 / 裁切 / 報價都還能用", () => {
    const p = profile({ subscription_status: "cancelled" });
    for (const f of ["canDownloadPdf", "canUseQuoteSystem", "canUseCutPlan"] as const) {
      const active = canUseFeature(profile({}), f as never);
      expect(canUseFeature(p, f as never), `${f} 在取消未到期時應該跟 active 一致`).toBe(active);
    }
  });

  it("到期之後才真的沒有（cancelled + 已過期 → free）", () => {
    expect(getEffectivePlan(profile({ subscription_status: "cancelled", subscription_expires_at: past }))).toBe("free");
  });

  it("expired / inactive 不在寬限之列（那是掃描降級、退款、停權明確標記的）", () => {
    expect(getEffectivePlan(profile({ subscription_status: "expired" }))).toBe("free");
    expect(getEffectivePlan(profile({ subscription_status: "inactive" }))).toBe("free");
  });

  it("學員版過期要降 free，沒過期算 student", () => {
    expect(getEffectivePlan(profile({ plan: "student", student_expires_at: past }))).toBe("free");
    expect(getEffectivePlan(profile({ plan: "student", student_expires_at: future }))).toBe("student");
  });

  it("lifetime 不看 status 也不看到期日", () => {
    expect(getEffectivePlan(profile({ plan: "lifetime", subscription_status: "cancelled", subscription_expires_at: null }))).toBe("lifetime");
  });
});

describe("扣款失敗的 3 天寬限期", () => {
  /**
   * 綠界月扣失敗時 subscription_status 還是 active（periodic-notify 只記一筆失敗的
   * payment、不動狀態）。到期日一過，getEffectivePlan 直接回 free → 付費功能當場全沒。
   * 但同一時間 /my-subscription 正顯示「⚠️ 訂閱已到期 — 寬限期剩 N 天 ·
   * **付費功能仍可使用**」（messages/zh-TW.json:2341-2342），
   * 而 cron 的 isExpiredPastGrace() 這 3 天內也不會降級。三邊各說各話。
   */
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

  it("到期後第 1 天（寬限期內）仍是 pro —— 跟畫面承諾一致", () => {
    expect(getEffectivePlan(profile({ subscription_expires_at: daysAgo(1) }))).toBe("pro");
  });

  it("到期後第 2 天仍可用列印 / 報價", () => {
    const p = profile({ subscription_expires_at: daysAgo(2) });
    expect(canUseFeature(p, "canDownloadPdf" as never)).toBe(true);
    expect(canUseFeature(p, "canUseQuoteSystem" as never)).toBe(true);
  });

  it("過了 3 天寬限期才降 free（跟 cron 的 isExpiredPastGrace 同一條線）", () => {
    expect(getEffectivePlan(profile({ subscription_expires_at: daysAgo(4) }))).toBe("free");
  });

  it("⚠️ 寬限期只給 active（扣款重試中）—— cancelled 是使用者自己按的，到期就到期", () => {
    expect(getEffectivePlan(profile({ subscription_status: "cancelled", subscription_expires_at: daysAgo(1) }))).toBe("free");
  });
});

describe("方案功能的閘要用對的判準（不是「有沒有付錢」）", () => {
  /**
   * 報價系統是**專業版**功能。個人版（NT$390）canUseQuoteSystem = false，
   * 但設計頁報價路由的伺服器閘原本用 isPaidUser()（只問有沒有付錢），
   * 個人版照樣通過 → 伺服器把整份報價 render 出去，只剩 client 端的 CSS 模糊擋著。
   * 那支元件的註解自己就寫「DevTools 砍 blur class 就破」。
   */
  it("個人版沒有報價系統，專業版 / 學員 / 終身有", () => {
    expect(canUseFeature(profile({ plan: "personal" }), "canUseQuoteSystem" as never)).toBe(false);
    for (const plan of ["pro", "lifetime"]) {
      expect(canUseFeature(profile({ plan }), "canUseQuoteSystem" as never), plan).toBe(true);
    }
  });

  it("個人版有列印（那是個人版就買得到的）—— 別把閘關過頭", () => {
    expect(canUseFeature(profile({ plan: "personal" }), "canDownloadPdf" as never)).toBe(true);
  });
});
