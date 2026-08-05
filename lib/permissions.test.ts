import { describe, it, expect } from "vitest";
import {
  getEffectivePlan,
  getPlanFeatures,
  canUseFeature,
  type UserPlanProfile,
} from "./permissions";

/**
 * 🔐 方案權限判定。
 *
 * ⭐這檔案存在的原因是一起真實客訴（2026-08-05）：客戶付了個人版、按下「取消訂閱」後
 * 頁面卻寫「目前生效的方案：免費版」——而且不只是標籤，`getPlanFeatures` 走同一支函式，
 * 所以他**真的**在還付費到 2026-09-04 的期間內被降成免費版。這類 bug 會直接變成退費爭議，
 * 所以每一種 (status × 到期日) 組合都在這裡釘死。
 */

const future = () => new Date(Date.now() + 30 * 86_400_000).toISOString();
const past = () => new Date(Date.now() - 30 * 86_400_000).toISOString();

function profile(p: Partial<UserPlanProfile>): UserPlanProfile {
  return {
    plan: "personal",
    subscription_status: "active",
    subscription_expires_at: future(),
    ...p,
  };
}

describe("getEffectivePlan — 一般訂閱", () => {
  it("① active 且未到期 → 保有方案", () => {
    expect(getEffectivePlan(profile({}))).toBe("personal");
    expect(getEffectivePlan(profile({ plan: "pro" }))).toBe("pro");
  });

  /**
   * ⭐本檔頭條：取消訂閱＝停止下次扣款，不是立刻收回這期的權益。
   * 後端全部都這樣運作（cancel API 不動 plan/expires_at、sweep 到期後才降級），
   * UI 也白紙黑字寫「2026-09-04 之前仍可使用」。
   */
  it("② cancelled 但未到期 → 仍保有方案（回歸測試：客戶按取消後當場被降 free）", () => {
    expect(getEffectivePlan(profile({ subscription_status: "cancelled" }))).toBe("personal");
  });

  it("③ cancelled 且已過期 → 降 free", () => {
    expect(
      getEffectivePlan(profile({ subscription_status: "cancelled", subscription_expires_at: past() })),
    ).toBe("free");
  });

  it("④ active 但已過期 → 降 free（掃描排程還沒跑到也不能放行）", () => {
    expect(getEffectivePlan(profile({ subscription_expires_at: past() }))).toBe("free");
  });

  it("⑤ expired / inactive 即使日期未到也一律 free（退款、admin 停權、掃描降級的明確標記）", () => {
    expect(getEffectivePlan(profile({ subscription_status: "expired" }))).toBe("free");
    expect(getEffectivePlan(profile({ subscription_status: "inactive" }))).toBe("free");
  });

  it("⑥ 沒有到期日 → free（資料不全時取保守解）", () => {
    expect(getEffectivePlan(profile({ subscription_expires_at: null }))).toBe("free");
  });

  it("⑦ 沒有 profile（未登入／trigger 還沒建 row）→ free", () => {
    expect(getEffectivePlan(null)).toBe("free");
    expect(getEffectivePlan(undefined)).toBe("free");
  });
});

describe("getEffectivePlan — lifetime / student", () => {
  it("⑧ lifetime 不看 status 也不看到期日", () => {
    expect(
      getEffectivePlan(profile({ plan: "lifetime", subscription_status: "expired", subscription_expires_at: past() })),
    ).toBe("lifetime");
  });

  it("⑨ student 看 student_expires_at，不看訂閱狀態", () => {
    expect(
      getEffectivePlan(profile({ plan: "student", student_expires_at: future() })),
    ).toBe("student");
    expect(
      getEffectivePlan(profile({ plan: "student", student_expires_at: past() })),
    ).toBe("free");
    expect(getEffectivePlan(profile({ plan: "student", student_expires_at: null }))).toBe("free");
  });
});

describe("權限（不只是標籤）跟著一起對", () => {
  /**
   * ⭐這組才是真正的傷害面：頁面上的字寫錯只是難看，`getPlanFeatures` 判錯＝
   * 付了錢的人被鎖在功能外面。兩者共用 getEffectivePlan，所以一起驗。
   */
  it("⑩ cancelled 未到期的使用者，拿到的是付費版功能而不是免費版", () => {
    const p = profile({ subscription_status: "cancelled" });
    expect(getPlanFeatures(p)).toEqual(getPlanFeatures(profile({})));
    expect(getPlanFeatures(p)).not.toEqual(getPlanFeatures(profile({ subscription_status: "expired" })));
  });

  it("⑪ canUseFeature 對 cancelled 未到期者與 active 一致", () => {
    const cancelled = profile({ subscription_status: "cancelled" });
    const active = profile({});
    const keys = Object.keys(getPlanFeatures(active)) as (keyof ReturnType<typeof getPlanFeatures>)[];
    for (const k of keys) {
      expect(canUseFeature(cancelled, k)).toBe(canUseFeature(active, k));
    }
  });
});
