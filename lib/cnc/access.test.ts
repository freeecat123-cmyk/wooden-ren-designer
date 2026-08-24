/**
 * CNC 權限判定的行為契約。
 *
 * 為什麼這個檔案值得測：access.ts 自己的檔頭就寫了「這個判斷有四個呼叫點，
 * 這裡是唯一定義」——單一來源錯一次，`/cnc` 頁、`/api/cnc-tool`、
 * `/api/cnc-license`、`/api/trial/start` 四個入口會一起錯。而且它是工具端
 * license.ts 的**上游**：工具那 28 條測試全部從 payload 開始，payload 就是這裡產的。
 * 這裡把 expiresAt 算錯，下游測試再密也擋不住。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN_EMAIL = "admin@woodenren.com";

vi.mock("@/lib/admin", () => ({
  getServerAdminEmails: () => [ADMIN_EMAIL],
  isAdminEmail: (email: string | null | undefined, list: string[]) =>
    !!email && list.includes(email.toLowerCase()),
}));

/** 每個測試自己設定這三張表要回什麼。 */
let tables: {
  users: { data: unknown; error: unknown };
  tool_unlocks: { data: unknown; error: unknown };
  tool_trials: { data: unknown; error: unknown };
};
/** 記錄 insert 進 tool_trials 的內容，以及要讓它回什麼錯。 */
let insertCalls: unknown[];
let insertError: { code?: string; message?: string } | null;

/**
 * 夠用的假 supabase：`.select().eq().eq().maybeSingle()` 與
 * 「直接 await 查詢建構器」（tool_unlocks 就是這樣用的）兩種都要支援，
 * 所以這個物件本身是 thenable。
 */
function makeQuery(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => result,
    single: async () => result,
    then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
    insert: async (row: unknown) => {
      insertCalls.push(row);
      return { error: insertError };
    },
  };
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: keyof typeof tables) => makeQuery(tables[table]),
  }),
}));

const { resolveCncAccess, startCncTrial, CNC_TRIAL_DAYS } = await import("./access");

const USER = { id: "u1", email: "buyer@example.com" };
const DAY = 86_400_000;
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const past = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const ok = (data: unknown) => ({ data, error: null });
const boom = { data: null, error: { code: "500", message: "資料庫爆了" } };

/** 沒訂閱、沒買斷、沒試用過的乾淨帳號。 */
function reset(): void {
  tables = {
    users: ok({
      plan: "free",
      subscription_status: "inactive",
      subscription_expires_at: null,
      student_expires_at: null,
    }),
    tool_unlocks: ok([]),
    tool_trials: ok(null),
  };
  insertCalls = [];
  insertError = null;
}

beforeEach(reset);

describe("判定順序：admin → 訂閱 → 買斷 → 試用", () => {
  it("admin 直接放行，而且**碰都不碰**資料表", async () => {
    // 這也解釋了為什麼站方帳號永遠測不出下面那些故障：他在查詢之前就 return 了
    tables.users = boom;
    tables.tool_unlocks = boom;
    tables.tool_trials = boom;

    const a = await resolveCncAccess({ id: "admin", email: ADMIN_EMAIL });
    expect(a.allowed).toBe(true);
    expect(a.reason).toBe("admin");
    expect(a.planLabel).toBeTruthy(); // 工具的授權狀態列靠這個值才顯示得出東西
    expect(a.expiresAt).toBeNull();
    expect(a.daysLeft).toBeNull();
  });

  it("🔴 同時有訂閱又試用過 → 回訂閱，不可回試用", async () => {
    // 順序寫反的話，付費訂閱戶會在工具裡看到「免費試用中 · 還剩 N 天」
    tables.users = ok({
      plan: "personal",
      subscription_status: "active",
      subscription_expires_at: future(200),
      student_expires_at: null,
    });
    tables.tool_trials = ok({ expires_at: future(3) });

    const a = await resolveCncAccess(USER);
    expect(a.reason).toBe("plan");
    expect(a.planLabel).toBe("個人版");
    expect(a.daysLeft).toBeGreaterThan(100);
  });

  it("🔴 買斷 + 試用中 → 回買斷，且不帶任何倒數", async () => {
    tables.tool_unlocks = ok([{ tool: "cnc" }]);
    tables.tool_trials = ok({ expires_at: future(3) });

    const a = await resolveCncAccess(USER);
    expect(a.reason).toBe("purchase");
    expect(a.expiresAt).toBeNull(); // 買斷不會到期 → 工具不該對他倒數
    expect(a.daysLeft).toBeNull();
  });

  it("只買了別的工具不算解鎖 CNC", async () => {
    tables.tool_unlocks = ok([{ tool: "ceiling" }, { tool: "floor" }]);
    const a = await resolveCncAccess(USER);
    expect(a.allowed).toBe(false);
  });
});

describe("到期日：算錯就是誤擋付費客或白送產品", () => {
  it("永久版（lifetime）不會到期 → expiresAt 必須是 null", async () => {
    // 回一個假到期日的話，工具會存進離線快取，斷網時被 graceStillValid 擋掉
    tables.users = ok({
      plan: "lifetime",
      subscription_status: "active",
      subscription_expires_at: past(30), // 刻意放一個過去的日期，不該被採用
      student_expires_at: null,
    });

    const a = await resolveCncAccess(USER);
    expect(a.allowed).toBe(true);
    expect(a.expiresAt).toBeNull();
    expect(a.daysLeft).toBeNull();
  });

  it("學員方案看 student_expires_at，不是 subscription_expires_at", async () => {
    tables.users = ok({
      plan: "student",
      subscription_status: "inactive",
      subscription_expires_at: null,
      student_expires_at: future(10),
    });

    const a = await resolveCncAccess(USER);
    expect(a.allowed).toBe(true);
    expect(a.expiresAt).toBe(tables.users.data && (tables.users.data as Record<string, string>).student_expires_at);
  });

  /**
   * ⚠️ 2026-08-24 更新：到期後有 3 天寬限期（GRACE_PERIOD_DAYS）。
   *
   * 這條原本用 past(1)（到期 1 天）當「已過期」，但那落在寬限期內。
   * 綠界月扣失敗時 subscription_status 還是 active、綠界還在重試，
   * /my-subscription 也正在跟使用者說「寬限期剩 N 天 · 付費功能仍可使用」，
   * cron 的 isExpiredPastGrace() 這 3 天內也不會降級。
   * CNC 沒有理由自己一套 —— 判準只能有一個。
   */
  it("到期後 1 天（扣款重試中，寬限期內）→ 還能用", async () => {
    tables.users = ok({
      plan: "personal",
      subscription_status: "active",
      subscription_expires_at: past(1),
      student_expires_at: null,
    });
    expect((await resolveCncAccess(USER)).allowed).toBe(true);
  });

  it("過了 3 天寬限期 → 擋下", async () => {
    tables.users = ok({
      plan: "personal",
      subscription_status: "active",
      subscription_expires_at: past(4),
      student_expires_at: null,
    });
    expect((await resolveCncAccess(USER)).allowed).toBe(false);
  });

  it("自己按取消 + 已到期 → 不給寬限，直接擋下", async () => {
    tables.users = ok({
      plan: "personal",
      subscription_status: "cancelled",
      subscription_expires_at: past(1),
      student_expires_at: null,
    });
    expect((await resolveCncAccess(USER)).allowed).toBe(false);
  });

  it("剩餘天數無條件進位（剩 1.5 天要講 2 天，不是 1 天）", async () => {
    // 進位方向是刻意的：對「還剩多久」低報會讓人以為時間比實際少。
    // 註：程式裡的 Math.max(1, …) 在這條路徑上不可達（allowed 就代表到期日在未來），
    // 那是純防禦，所以這裡驗的是 ceil 而不是那個下限。
    tables.tool_trials = ok({ expires_at: new Date(Date.now() + 1.5 * DAY).toISOString() });
    const a = await resolveCncAccess(USER);
    expect(a.reason).toBe("trial");
    expect(a.daysLeft).toBe(2);
  });

  it("剩不到一天也不會顯示 0 天", async () => {
    tables.tool_trials = ok({ expires_at: new Date(Date.now() + 60_000).toISOString() });
    expect((await resolveCncAccess(USER)).daysLeft).toBe(1);
  });

  it("allowed 為真時 planLabel 一定有值（工具要顯示它）", async () => {
    for (const setup of [
      () => { tables.tool_unlocks = ok([{ tool: "cnc" }]); },
      () => { tables.tool_trials = ok({ expires_at: future(3) }); },
      () => {
        tables.users = ok({
          plan: "pro", subscription_status: "active",
          subscription_expires_at: future(30), student_expires_at: null,
        });
      },
    ]) {
      reset();
      setup();
      const a = await resolveCncAccess(USER);
      expect(a.allowed).toBe(true);
      expect(a.planLabel, `reason=${a.reason}`).toBeTruthy();
    }
  });
});

describe("試用資格：trialUsed 跟 trialActive 是兩件事", () => {
  it("試用已過期 → 不能用，但資格算用掉了", async () => {
    tables.tool_trials = ok({ expires_at: past(1) });
    const a = await resolveCncAccess(USER);
    expect(a.allowed).toBe(false);
    expect(a.reason).toBe("trialExpired");
    expect(a.trialUsed).toBe(true); // 混淆這兩者 ＝ 試用可以無限重開
  });

  it("從沒試用過 → reason 是 none，資格還在", async () => {
    const a = await resolveCncAccess(USER);
    expect(a.reason).toBe("none");
    expect(a.trialUsed).toBe(false);
  });

  it("剛好在到期那一刻 → 判定為過期", async () => {
    tables.tool_trials = ok({ expires_at: new Date(Date.now() - 1).toISOString() });
    expect((await resolveCncAccess(USER)).allowed).toBe(false);
  });
});

describe("🔴 查不到 ≠ 沒權限（degraded）", () => {
  it.each([
    ["users 查詢失敗", "users"],
    ["tool_unlocks 查詢失敗", "tool_unlocks"],
    ["tool_trials 查詢失敗", "tool_trials"],
  ] as const)("%s → degraded，而不是靜默判成免費用戶", async (_name, table) => {
    tables[table] = boom;
    const a = await resolveCncAccess(USER);
    expect(a.degraded).toBe(true);
    expect(a.reason).toBe("unknown");
    expect(a.allowed).toBe(false);
  });

  it("一切正常時 degraded 必須是 false（否則上面那幾條恆真）", async () => {
    tables.tool_unlocks = ok([{ tool: "cnc" }]);
    const a = await resolveCncAccess(USER);
    expect(a.degraded).toBe(false);
    expect(a.allowed).toBe(true);
  });

  it("users 查無此列（新帳號）不算故障，照常判成免費版", async () => {
    // maybeSingle 對「查無資料」回 data:null / error:null。
    // 這裡若被當成故障，每個新註冊的人都會拿到 degraded。
    tables.users = ok(null);
    const a = await resolveCncAccess(USER);
    expect(a.degraded).toBe(false);
    expect(a.reason).toBe("none");
  });
});

describe("startCncTrial：一輩子一次的資格不能被燒掉", () => {
  it("正常開通 7 天", async () => {
    const r = await startCncTrial(USER);
    expect(r.ok).toBe(true);
    expect(insertCalls).toHaveLength(1);
    const row = insertCalls[0] as { tool: string; expires_at: string };
    expect(row.tool).toBe("cnc");
    const days = (new Date(row.expires_at).getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(CNC_TRIAL_DAYS - 0.1);
    expect(days).toBeLessThan(CNC_TRIAL_DAYS + 0.1);
  });

  it("🔴 查不到權限狀態時不准開試用（否則訂閱戶會被燒掉資格）", async () => {
    tables.users = boom;
    const r = await startCncTrial(USER);
    expect(r.ok).toBe(false);
    expect(insertCalls).toHaveLength(0); // 關鍵：不可以真的寫進去
  });

  it("已經有權限的人不准開（留著這張牌給他訂閱到期後用）", async () => {
    tables.tool_unlocks = ok([{ tool: "cnc" }]);
    const r = await startCncTrial(USER);
    expect(r).toEqual({ ok: false, code: "alreadyEntitled" });
    expect(insertCalls).toHaveLength(0);
  });

  it("已經試用過的人不准再開", async () => {
    tables.tool_trials = ok({ expires_at: past(30) });
    const r = await startCncTrial(USER);
    expect(r).toEqual({ ok: false, code: "alreadyUsed" });
    expect(insertCalls).toHaveLength(0);
  });

  it("併發連點兩下：unique 撞車要翻成 alreadyUsed，不能報成 failed", async () => {
    // 對使用者來說試用**已經開始**了（另一個 request 剛建好），
    // 報成 failed 會讓他看到「啟用失敗」然後一直重按
    insertError = { code: "23505", message: "duplicate key value" };
    const r = await startCncTrial(USER);
    expect(r).toEqual({ ok: false, code: "alreadyUsed" });
  });

  it("其他寫入錯誤才算真的失敗", async () => {
    insertError = { code: "23514", message: "check constraint" };
    const r = await startCncTrial(USER);
    expect(r).toEqual({ ok: false, code: "failed" });
  });
});
